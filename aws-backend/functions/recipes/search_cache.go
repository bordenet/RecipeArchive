package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"recipe-archive/models"
)

// SearchCacheEntry represents a cached search result
type SearchCacheEntry struct {
	Results    []models.Recipe
	Total      int
	CachedAt   time.Time
	AccessedAt time.Time
}

// SearchCache implements an in-memory LRU cache for search results
type SearchCache struct {
	mu       sync.RWMutex
	entries  map[string]*SearchCacheEntry
	maxSize  int
	ttl      time.Duration
	hits     int64
	misses   int64
	evictions int64
}

// NewSearchCache creates a new search cache
func NewSearchCache(maxSize int, ttl time.Duration) *SearchCache {
	return &SearchCache{
		entries: make(map[string]*SearchCacheEntry),
		maxSize: maxSize,
		ttl:     ttl,
	}
}

// generateCacheKey creates a deterministic cache key from search parameters
func generateCacheKey(userID, searchQuery string, maxPrepTime, maxCookTime *int,
	semanticTags, primaryIngredients, cookingMethods, dietaryTags, flavorProfile,
	equipment, mealTypes []string, timeCategory, complexity, sourceFilter, sortBy, sortOrder string) string {

	// Create a string representation of all parameters
	key := fmt.Sprintf("%s|%s|%v|%v|%v|%v|%v|%v|%v|%v|%v|%s|%s|%s|%s|%s",
		userID,
		searchQuery,
		ptrIntToStr(maxPrepTime),
		ptrIntToStr(maxCookTime),
		semanticTags,
		primaryIngredients,
		cookingMethods,
		dietaryTags,
		flavorProfile,
		equipment,
		mealTypes,
		timeCategory,
		complexity,
		sourceFilter,
		sortBy,
		sortOrder,
	)

	// Hash the key to keep it compact
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// ptrIntToStr converts *int to string for cache key generation
func ptrIntToStr(val *int) string {
	if val == nil {
		return "nil"
	}
	return fmt.Sprintf("%d", *val)
}

// Get retrieves a cached search result if it exists and is not expired
func (c *SearchCache) Get(key string) ([]models.Recipe, int, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.entries[key]
	if !exists {
		c.misses++
		return nil, 0, false
	}

	// Check if entry is expired
	if time.Since(entry.CachedAt) > c.ttl {
		c.misses++
		// Note: We don't delete here to avoid write lock, cleanup happens in Set()
		return nil, 0, false
	}

	// Update access time (for LRU)
	entry.AccessedAt = time.Now()
	c.hits++

	// Return a copy of the results to prevent external modification
	resultsCopy := make([]models.Recipe, len(entry.Results))
	copy(resultsCopy, entry.Results)

	return resultsCopy, entry.Total, true
}

// Set adds or updates a search result in the cache
func (c *SearchCache) Set(key string, results []models.Recipe, total int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if we need to evict entries
	if len(c.entries) >= c.maxSize {
		c.evictLRU()
	}

	// Clean up expired entries periodically
	c.cleanupExpired()

	// Store the entry
	c.entries[key] = &SearchCacheEntry{
		Results:    results,
		Total:      total,
		CachedAt:   time.Now(),
		AccessedAt: time.Now(),
	}
}

// evictLRU removes the least recently used entry
func (c *SearchCache) evictLRU() {
	var oldestKey string
	var oldestTime time.Time

	// Find the least recently accessed entry
	for key, entry := range c.entries {
		if oldestKey == "" || entry.AccessedAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.AccessedAt
		}
	}

	if oldestKey != "" {
		delete(c.entries, oldestKey)
		c.evictions++
	}
}

// cleanupExpired removes expired entries from the cache
func (c *SearchCache) cleanupExpired() {
	now := time.Now()
	for key, entry := range c.entries {
		if now.Sub(entry.CachedAt) > c.ttl {
			delete(c.entries, key)
		}
	}
}

// GetStats returns cache statistics
func (c *SearchCache) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	totalRequests := c.hits + c.misses
	hitRate := 0.0
	if totalRequests > 0 {
		hitRate = float64(c.hits) / float64(totalRequests) * 100
	}

	return map[string]interface{}{
		"size":       len(c.entries),
		"maxSize":    c.maxSize,
		"hits":       c.hits,
		"misses":     c.misses,
		"evictions":  c.evictions,
		"hitRate":    hitRate,
		"ttlSeconds": c.ttl.Seconds(),
	}
}

// Clear removes all entries from the cache
func (c *SearchCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries = make(map[string]*SearchCacheEntry)
	c.hits = 0
	c.misses = 0
	c.evictions = 0
}

// Global search cache instance (survives across warm Lambda invocations)
var searchCache = NewSearchCache(
	100,              // maxSize: cache up to 100 unique search queries
	5*time.Minute,    // ttl: cache entries valid for 5 minutes
)
