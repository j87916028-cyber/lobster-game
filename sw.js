// 龍蝦大戰 Service Worker - 離線支援
const CACHE_NAME = 'lobster-game-v3';
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

// 定期更新緩存（後台更新）
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    // 後台更新靜態資源
    await Promise.all(
      urlsToCache.map(url => 
        fetch(url, { cache: 'no-store' })
          .then(response => {
            if (response.ok) {
              cache.put(url, response);
            }
          })
          .catch(() => {}) // 忽略失敗
      )
    );
  } catch (e) {
    // 後台更新失敗不影響用戶
  }
}

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

  // 排除非 GET 請求
  if (request.method !== 'GET') {
    return;
  }

  // 排除外部請求（跨域）
  if (url.origin !== self.location.origin) {
    return;
  }

  // 導航請求（HTML 頁面）- 網絡優先，回退緩存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 複製響應並緩存（只緩存成功的響應）
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            }).catch(() => {}); // 忽略緩存錯誤
          }
          return response;
        })
        .catch(() => {
          // 網絡失敗時返回緩存的首頁
          return caches.match('./lobster-game.html').then(response => {
            return response || new Response('Offline - Please check your connection', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
    );
    return;
  }

  // 靜態資源（JS、CSS、圖片、字體）- 緩存優先，失敗時網絡回退
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
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              }).catch(() => {});
            }
            return networkResponse;
          }).catch(() => {
            // 離線時返回空響應而非錯誤（更優雅的失敗處理）
            return new Response('', { status: 200 });
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
            })
            .catch(() => {});
          return response;
        });
      })
      .catch(() => {
        // 離線時返回離線頁面或緩存的遊戲
        return caches.match('./lobster-game.html').then(response => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});
