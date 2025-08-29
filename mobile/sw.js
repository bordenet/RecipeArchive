// RecipeArchive Mobile Service Worker
// Provides offline functionality and caching for the mobile PWA

const CACHE_NAME = 'recipe-archive-mobile-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '../extensions/chrome/icon16.png',
  '../extensions/chrome/icon32.png',
  '../extensions/chrome/icon48.png',
  '../extensions/chrome/icon128.png',
  '../extensions/chrome/supported-sites.js',
  '../extensions/chrome/config.js'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installed successfully');
        return self.skipWaiting();
      })
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated successfully');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip extension-scheme requests (chrome-extension://, safari-extension://)
  if (event.request.url.startsWith('chrome-extension://') || 
      event.request.url.startsWith('safari-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              // Only cache same-origin requests
              if (event.request.url.startsWith(self.location.origin)) {
                cache.put(event.request, responseToCache);
              }
            });

          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Background sync for offline recipe saves
self.addEventListener('sync', (event) => {
  if (event.tag === 'recipe-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(syncRecipes());
  }
});

// Sync offline recipes when back online
async function syncRecipes() {
  try {
    // Get pending recipes from IndexedDB
    const pendingRecipes = await getPendingRecipes();
    
    for (const recipe of pendingRecipes) {
      try {
        // Attempt to save recipe to backend
        await saveRecipeToBackend(recipe);
        
        // Remove from pending list if successful
        await removePendingRecipe(recipe.id);
        
        // Notify users of successful sync
        self.registration.showNotification('Recipe Saved!', {
          body: `"${recipe.title}" has been saved to your collection`,
          icon: '../extensions/chrome/icon48.png',
          badge: '../extensions/chrome/icon16.png'
        });
        
      } catch (error) {
        console.error('Failed to sync recipe:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helpers (simplified)
async function getPendingRecipes() {
  // This would integrate with IndexedDB to get offline recipes
  return [];
}

async function removePendingRecipe(id) {
  // Remove recipe from IndexedDB pending list
}

async function saveRecipeToBackend(recipe) {
  // Save recipe to AWS backend
  const response = await fetch('/api/mobile/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(recipe)
  });
  
  if (!response.ok) {
    throw new Error('Failed to save recipe');
  }
  
  return response.json();
}

// Push notification handler
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New recipe saved!',
    icon: '../extensions/chrome/icon48.png',
    badge: '../extensions/chrome/icon16.png'
  };

  event.waitUntil(
    self.registration.showNotification('RecipeArchive', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});