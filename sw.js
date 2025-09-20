// Enhanced Service Worker for background notifications
const CACHE_NAME = 'map-tracker-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/script.js',
    '/styles.css',
    '/sw.js'
];

// Install event - 立即激活新版本
self.addEventListener('install', function(event) {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
            .then(function() {
                return self.skipWaiting(); // 立即激活
            })
    );
});

// Activate event - 清理舊緩存
self.addEventListener('activate', function(event) {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim(); // 立即控制所有頁面
        })
    );
});

// Fetch event
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            }
        )
    );
});

// Message event - 處理來自主線程的消息
self.addEventListener('message', function(event) {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'LOCATION_ALERT') {
        const { title, body, data } = event.data;
        showLocationNotification(title, body, data);
    }
    
    if (event.data && event.data.type === 'KEEP_ALIVE') {
        // 保持Service Worker活躍
        console.log('Service Worker keep alive signal received');
    }
});

// Push event for notifications
self.addEventListener('push', function(event) {
    let notificationData = {
        title: '位置提醒',
        body: '您有新的位置提醒',
        data: {}
    };
    
    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }
    
    event.waitUntil(
        showLocationNotification(notificationData.title, notificationData.body, notificationData.data)
    );
});

// 顯示位置通知的統一函數
function showLocationNotification(title, body, data = {}) {
    const options = {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4444"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4444"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
        vibrate: [200, 100, 200, 100, 200],
        tag: data.tag || 'location-alert',
        requireInteraction: true,
        silent: false,
        timestamp: Date.now(),
        data: data,
        actions: [
            {
                action: 'view',
                title: '查看位置',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23007AFF"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>'
            },
            {
                action: 'dismiss',
                title: '關閉',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
            }
        ]
    };
    
    return self.registration.showNotification(title, options);
}

// Notification click event - 增強版
self.addEventListener('notificationclick', function(event) {
    console.log('Notification clicked:', event.notification.tag, event.action);
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return; // 只關閉通知
    }
    
    // 處理查看位置或默認點擊
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                // 嘗試聚焦到現有窗口
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(self.location.origin)) {
                        // 發送消息給主頁面
                        if (event.notification.data && event.notification.data.markerId) {
                            client.postMessage({
                                type: 'FOCUS_MARKER',
                                markerId: event.notification.data.markerId
                            });
                        }
                        return client.focus();
                    }
                }
                // 如果沒有現有窗口，打開新窗口
                return clients.openWindow('/');
            })
    );
});

// Background sync event (如果支援)
self.addEventListener('sync', function(event) {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'location-check') {
        event.waitUntil(
            // 執行背景位置檢查
            performBackgroundLocationCheck()
        );
    }
});

// 背景位置檢查函數
function performBackgroundLocationCheck() {
    return new Promise((resolve) => {
        // 向所有客戶端發送位置檢查請求
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'BACKGROUND_LOCATION_CHECK'
                });
            });
            resolve();
        });
    });
}

// 定期保持Service Worker活躍
setInterval(() => {
    console.log('Service Worker heartbeat:', new Date().toISOString());
}, 30000); // 每30秒一次心跳