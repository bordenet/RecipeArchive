package main

import (
	"time"
)

// RecipeTrace contains the complete end-to-end trace of a recipe
type RecipeTrace struct {
	RecipeID    string       `json:"recipeId"`
	Timeline    []TraceEvent `json:"timeline"`
	S3Events    []S3Event    `json:"s3Events"`
	SQSEvents   []SQSEvent   `json:"sqsEvents"`
	LogEvents   []LogEvent   `json:"logEvents"`
	Summary     TraceSummary `json:"summary"`
	CurrentData *RecipeData  `json:"currentData,omitempty"`
}

// TraceEvent represents a timestamped event in the recipe lifecycle
type TraceEvent struct {
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source"` // "s3", "sqs", "logs"
	Type      string    `json:"type"`   // "created", "updated", "queued", "processed"
	Message   string    `json:"message"`
	Details   string    `json:"details,omitempty"`
}

// S3Event represents an S3 operation on the recipe
type S3Event struct {
	Timestamp    time.Time `json:"timestamp"`
	Operation    string    `json:"operation"` // "PUT", "GET"
	Key          string    `json:"key"`
	Size         int64     `json:"size,omitempty"`
	LastModified time.Time `json:"lastModified,omitempty"`
}

// SQSEvent represents an SQS message related to the recipe
type SQSEvent struct {
	Timestamp time.Time `json:"timestamp"`
	Action    string    `json:"action"` // "sent", "received", "processed"
	MessageID string    `json:"messageId"`
	QueueName string    `json:"queueName"`
	Body      string    `json:"body,omitempty"`
}

// LogEvent represents a CloudWatch log entry related to the recipe
type LogEvent struct {
	Timestamp time.Time `json:"timestamp"`
	LogGroup  string    `json:"logGroup"`
	LogStream string    `json:"logStream"`
	Message   string    `json:"message"`
	Level     string    `json:"level"` // "INFO", "ERROR", "DEBUG"
}

// TraceSummary provides a high-level overview of the recipe trace
type TraceSummary struct {
	CreatedAt         time.Time `json:"createdAt"`
	LastUpdated       time.Time `json:"lastUpdated"`
	ProcessingSteps   int       `json:"processingSteps"`
	NormalizationRuns int       `json:"normalizationRuns"`
	CacheHits         int       `json:"cacheHits"`
	CacheStores       int       `json:"cacheStores"`
	Errors            int       `json:"errors"`
	Status            string    `json:"status"` // "created", "processing", "normalized", "error"
}

// RecipeData represents the current recipe data from S3
type RecipeData struct {
	Title              string    `json:"title"`
	SourceURL          string    `json:"sourceUrl"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
	Version            int       `json:"version"`
	IngredientCount    int       `json:"ingredientCount"`
	InstructionCount   int       `json:"instructionCount"`
	CookingMethodCount int       `json:"cookingMethodCount"`
	QualityScore       float64   `json:"qualityScore,omitempty"`
}
