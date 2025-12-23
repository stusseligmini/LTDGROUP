// Push Notification Service Worker
// This handles background push notifications when the app is closed

const CACHE_NAME = 'celora-v2-cache-v1';

// Files to cache for offline functionality
const urlsToCache = [
  '/',
  '/offline',
  '/manifest.json',
  '/logo.png',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache if available, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the new response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If fetch fails, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline');
            }
          });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received');
  console.log(`[Service Worker] Push had this data: "${event.data?.text() || 'no data'}"`);

  if (!event.data) {
    console.log('No push data received');
    return;
  }

  let notificationData;
  try {
    notificationData = event.data.json();
  } catch (error) {
    console.error('Failed to parse push notification data:', error);
    // Fallback for non-JSON payloads
    notificationData = {
      title: 'Celora Notification',
      body: event.data.text() || 'New notification',
      icon: '/icons/icon-192x192.png'
    };
  }

  const {
    title = 'Celora Notification',
    body = 'No message content',
    icon = '/icons/icon-192x192.png',
    badge = '/icons/icon-72x72.png',
    data = {},
    actions = [],
    tag = 'celora-notification',
    renotify = false,
    requireInteraction = false
  } = notificationData;

  // Enhanced options based on notification type
  const enhancedOptions = {
    body,
    icon,
    badge,
    data,
    actions,
    tag: `${tag}-${data.notification_type || 'default'}`,
    renotify,
    requireInteraction,
    timestamp: Date.now(),
    ...getSolanaNotificationStyling(data.notification_type, data)
  };

  event.waitUntil(
    self.registration.showNotification(title, enhancedOptions)
      .then(() => {
        console.log('Solana notification shown successfully');
        // Update app badge count
        updateAppBadge(1);
        // Track notification display
        return trackNotificationEvent('displayed', data.notification_type);
      })
      .catch(error => {
        console.error('Failed to show notification:', error);
      })
  );
});

// Get enhanced styling for Solana notifications
function getSolanaNotificationStyling(notificationType, data) {
  const commonOptions = {
    vibrate: [200, 100, 200],
    silent: false,
    dir: 'ltr'
  };

  switch (notificationType) {
    case 'solana_transaction':
      return {
        ...commonOptions,
        vibrate: data.transaction_type === 'incoming' ? [300, 100, 300] : [200],
        image: getTransactionImage(data.transaction_type),
        actions: [
          { action: 'view', title: '👁️ View', icon: '/icons/view.png' },
          { action: 'dismiss', title: '✕ Dismiss', icon: '/icons/dismiss.png' }
        ]
      };

    case 'auto_link_success':
      return {
        ...commonOptions,
        vibrate: [100, 50, 100],
        image: '/images/auto-link-success.png',
        actions: [
          { action: 'view', title: '🔗 View Link', icon: '/icons/link.png' }
        ]
      };

    case 'auto_link_failed':
      return {
        ...commonOptions,
        vibrate: [300, 200, 300, 200, 300],
        requireInteraction: true,
        image: '/images/auto-link-failed.png',
        actions: [
          { action: 'review', title: '👀 Review', icon: '/icons/review.png' },
          { action: 'dismiss', title: '✕ Dismiss', icon: '/icons/dismiss.png' }
        ]
      };

    case 'security_alert':
      return {
        ...commonOptions,
        vibrate: [500, 200, 500, 200, 500],
        requireInteraction: true,
        image: '/images/security-alert.png',
        actions: [
          { action: 'secure', title: '🔐 Secure Account', icon: '/icons/shield.png' },
          { action: 'view', title: '👁️ View Details', icon: '/icons/view.png' }
        ]
      };

    case 'price_alert':
      return {
        ...commonOptions,
        vibrate: [150],
        image: `/images/price-${data.direction || 'neutral'}.png`,
        actions: [
          { action: 'view', title: '📊 View Portfolio', icon: '/icons/portfolio.png' }
        ]
      };

    default:
      return commonOptions;
  }
}

// Helper function to get transaction-specific images
function getTransactionImage(transactionType) {
  const images = {
    incoming: '/images/transaction-incoming.png',
    outgoing: '/images/transaction-outgoing.png',
    swap: '/images/transaction-swap.png',
    stake: '/images/transaction-stake.png'
  };
  
  return images[transactionType] || '/images/transaction-default.png';
}

// Update app badge count
function updateAppBadge(increment = 0) {
  if ('setAppBadge' in navigator) {
    // Get current count from IndexedDB or storage
    // For now, just increment by the provided amount
    const currentCount = parseInt(localStorage.getItem('notification-count') || '0');
    const newCount = Math.max(0, currentCount + increment);
    
    localStorage.setItem('notification-count', newCount.toString());
    navigator.setAppBadge(newCount > 0 ? newCount : undefined);
  }
}

// Track notification events
function trackNotificationEvent(event, notificationType) {
  return fetch('/api/notifications/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event,
      notification_type: notificationType,
      timestamp: Date.now()
    })
  }).catch(err => console.error('Failed to track notification event:', err));
}

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event.notification.tag, 'Action:', event.action);
  
  const { data } = event.notification;
  const action = event.action;

  // Close the notification
  event.notification.close();
  
  // Update badge count (decrement)
  updateAppBadge(-1);

  if (action) {
    // Handle action button clicks
    event.waitUntil(handleSolanaNotificationAction(action, data));
  } else {
    // Handle notification body click
    event.waitUntil(handleSolanaNotificationClick(data));
  }
});

// Handle Solana notification action button clicks
async function handleSolanaNotificationAction(action, data) {
  console.log('Handling Solana notification action:', action, data);

  // Track the action
  await trackNotificationEvent(`action_${action}`, data.notification_type);

  switch (action) {
    case 'view':
      return openSolanaAppPage(data.url || getSolanaDefaultUrl(data.notification_type, data));

    case 'review':
      if (data.notification_type === 'auto_link_failed') {
        return openSolanaAppPage(`/dashboard/auto-link?signature=${data.signature}&action=review`);
      }
      break;

    case 'secure':
      if (data.notification_type === 'security_alert') {
        return openSolanaAppPage('/dashboard/security?action=secure');
      }
      break;

    case 'dismiss':
      // Mark notification as dismissed
      return fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_type: data.notification_type,
          data: data
        })
      }).catch(err => console.error('Failed to dismiss notification:', err));

    default:
      console.log('Unknown Solana notification action:', action);
  }
}

// Handle notification body click
async function handleSolanaNotificationClick(data) {
  console.log('Handling Solana notification click:', data);

  // Track the click
  await trackNotificationEvent('clicked', data.notification_type);

  const url = data.url || getSolanaDefaultUrl(data.notification_type, data);
  return openSolanaAppPage(url);
}

// Get default URL based on Solana notification type
function getSolanaDefaultUrl(notificationType, data) {
  switch (notificationType) {
    case 'solana_transaction':
      return `/dashboard/transactions?signature=${data.signature}&network=${data.network || 'mainnet'}`;

    case 'auto_link_success':
    case 'auto_link_failed':
      return `/dashboard/auto-link?signature=${data.signature}`;

    case 'price_alert':
      return `/dashboard/portfolio?token=${data.token}&highlight=price`;

    case 'security_alert':
      return '/dashboard/security';

    default:
      return '/dashboard';
  }
}

// Open Solana app page or focus existing window
async function openSolanaAppPage(url) {
  const fullUrl = new URL(url, self.location.origin).href;

  try {
    // Try to find an existing client (open tab/window)
    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    // If we have an existing client, focus it and navigate
    for (const client of clientList) {
      if (client.url.includes(self.location.origin)) {
        await client.focus();
        
        // Navigate to the specific URL if it's different
        const currentPath = new URL(client.url).pathname + new URL(client.url).search;
        const targetPath = new URL(fullUrl).pathname + new URL(fullUrl).search;
        
        if (currentPath !== targetPath) {
          return client.postMessage({
            type: 'SOLANA_NAVIGATE',
            url: url,
            source: 'notification'
          });
        }
        
        return client;
      }
    }

    // No existing client, open new window
    return clients.openWindow(fullUrl);

  } catch (error) {
    console.error('Failed to open Solana app page:', error);
    // Fallback: just open the URL
    return clients.openWindow(fullUrl);
  }
}

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
  
  const { data } = event.notification;
  
  // Update badge count (decrement)
  updateAppBadge(-1);
  
  // Track notification dismissal
  event.waitUntil(
    trackNotificationEvent('dismissed', data?.notification_type || 'unknown')
  );
});

      // Handle subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[Service Worker] Push subscription changed');
  
  // Re-subscribe the user with the new subscription
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.applicationServerKey
    }).then((newSubscription) => {
      // Store the new subscription on your server
      console.log('[Service Worker] New subscription:', newSubscription);
      
      // Send the new subscription to your server
      return fetch('/api/notifications/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: newSubscription
        })
      });
    })
  );
});// Set the application server key for VAPID
// This will be set by the main thread when registering the service worker
self.applicationServerKey = null;

// Enhanced message handling for Solana features
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  const { type, data } = event.data || {};

  switch (type) {
    case 'SET_VAPID_PUBLIC_KEY':
      self.applicationServerKey = data || event.data.key;
      console.log('[Service Worker] VAPID public key set');
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'UPDATE_BADGE':
      updateAppBadge(data?.increment || 0);
      break;

    case 'CLEAR_BADGE':
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge();
        localStorage.setItem('notification-count', '0');
      }
      break;

    case 'SOLANA_SYNC_NOTIFICATIONS':
      // Trigger background sync for Solana notifications
      event.waitUntil(syncSolanaNotifications());
      break;

    case 'GET_SUBSCRIPTION_STATUS':
      if (event.ports && event.ports[0]) {
        self.registration.pushManager.getSubscription().then(subscription => {
          event.ports[0].postMessage({
            hasSubscription: !!subscription,
            subscription: subscription
          });
        });
      }
      break;

    default:
      console.log('[Service Worker] Unknown message type:', type);
  }
});

// Background sync for offline Solana notifications
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);

  if (event.tag === 'solana-notification-sync') {
    event.waitUntil(syncSolanaNotifications());
  } else if (event.tag === 'solana-transaction-sync') {
    event.waitUntil(syncSolanaTransactions());
  }
});

// Sync pending Solana notifications when back online
async function syncSolanaNotifications() {
  console.log('[Service Worker] Syncing Solana notifications...');

  try {
    const response = await fetch('/api/notifications/pending', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const pendingNotifications = await response.json();
      
      console.log(`[Service Worker] Found ${pendingNotifications.length} pending Solana notifications`);
      
      // Process each pending Solana notification
      for (const notification of pendingNotifications) {
        const enhancedOptions = {
          body: notification.message,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          data: {
            ...notification.data,
            notification_type: notification.notification_type,
            url: getSolanaDefaultUrl(notification.notification_type, notification.data)
          },
          tag: `pending-${notification.id}`,
          timestamp: Date.now(),
          ...getSolanaNotificationStyling(notification.notification_type, notification.data)
        };

        await self.registration.showNotification(
          notification.title,
          enhancedOptions
        );

        // Mark as processed
        await fetch(`/api/notifications/${notification.id}/processed`, {
          method: 'POST'
        }).catch(err => console.error('Failed to mark notification as processed:', err));
      }
    }
  } catch (error) {
    console.error('[Service Worker] Failed to sync Solana notifications:', error);
  }
}

// Sync pending Solana transactions when back online
async function syncSolanaTransactions() {
  console.log('[Service Worker] Syncing Solana transactions...');

  try {
    // Check for any pending Solana transaction data that needs to be sent
    const response = await fetch('/api/solana/sync-pending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Service Worker] Solana transaction sync result:', result);
    }
  } catch (error) {
    console.error('[Service Worker] Failed to sync Solana transactions:', error);
  }
}