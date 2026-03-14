// 龍蝦大戰 Service Worker - 離線支援
const CACHE_NAME = 'lobster-game-v2';
const urlsToCache = [
  './',
  './lobster-game.html',
  './lobster-adventure.html',
  './music-master.html',
  './music-theory.html',
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
  const { request } = event;
  const url = new URL(request.url);

  // 導航請求（HTML 頁面）- 網絡優先，回退緩存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 複製響應並緩存
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 網絡失敗時返回緩存的首頁
          return caches.match('./lobster-game.html');
        })
    );
    return;
  }

  // 靜態資源（JS、CSS、圖片、字體）- 緩存優先
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((networkResponse) => {
            // 緩存新的靜態資源
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          });
        })
    );
    return;
  }

  // 其他請求 - 默認策略
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // 不緩存非正常響應
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // 克隆響應
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
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
