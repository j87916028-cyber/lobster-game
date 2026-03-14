// 龍蝦大戰 Service Worker - 離線支援
const CACHE_NAME = 'lobster-game-v1';
const urlsToCache = [
  './lobster-game.html',
  './manifest.json'
];

// 安裝事件 - 緩存資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('Cache install failed:', err);
      })
  );
  // 立即啟用 service worker
  self.skipWaiting();
});

// 啟用事件 - 清理舊緩存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 立即控制所有客戶端
  self.clients.claim();
});

// 請求事件 - 優先使用緩存，失敗時回退到網絡
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 返回緩存或從網絡獲取
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          // 不緩存非正常響應
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // 克隆響應
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
      .catch(() => {
        // 離線時返回離線頁面或緩存的遊戲
        return caches.match('./lobster-game.html');
      })
  );
});
