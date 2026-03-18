// 龍蝦大戰 Service Worker - 離線支援
// 版本號：使用固定版本号，避免每次加載都創建新緩存
const CACHE_VERSION = 'v1.0.3';  // 手动更新版本号以触发缓存更新
const CACHE_NAME = 'lobster-game-' + CACHE_VERSION;

// 離線頁面 HTML 緩存（效能優化：避免每次請求時重新生成 HTML 字串）
let cachedOfflinePage = null;

// 導航預加載（效能優化：讓導航請求更快）
const navigationPreloadSupported = 'navigationPreload' in self.registration;

// 離線頁面 HTML（當完全沒有緩存時顯示）
function getOfflinePage() {
  // 如果已經緩存，直接返回
  if (cachedOfflinePage) {
    return cachedOfflinePage;
  }

  cachedOfflinePage = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🦞 離線狀態 - 龍蝦大戰</title>
  <style>
    body {
      font-family: 'Comic Sans MS', cursive, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
      padding: 20px;
    }
    h1 { font-size: 2.5rem; margin-bottom: 20px; }
    p { font-size: 1.2rem; margin-bottom: 30px; opacity: 0.8; }
    .lobster { font-size: 5rem; margin-bottom: 20px; }
    button {
      background: #00d4ff;
      border: none;
      padding: 15px 30px;
      font-size: 1.2rem;
      border-radius: 25px;
      color: #1a1a2e;
      cursor: pointer;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="lobster">🦞</div>
  <h1>網路已離線</h1>
  <p>龍蝦大戰需要網路連線才能載入。<br>請檢查您的網路設定後再試一次。</p>
  <button onclick="window.location.reload()">重新載入</button>
</body>
</html>`;
}
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
        return cache.addAll(urlsToCache);
      })
      .catch(() => {
        // 緩存安裝失敗時靜默忽略
      })
  );
  // 立即啟用 service worker
  self.skipWaiting();
});

// 定期更新緩存（後台更新）- Periodic Background Sync 並非所有瀏覽器都支援
if ('periodicsync' in self) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-cache') {
      event.waitUntil(updateCache());
    }
  });
}

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

// 啟用事件 - 清理舊緩存並啟用導航預加載
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
    .then(() => {
      // 啟用導航預加載（效能優化：讓導航請求更快）
      if (navigationPreloadSupported) {
        return self.registration.navigationPreload.enable();
      }
    })
    .then(() => {
      // 立即控制所有客戶端
      return self.clients.claim();
    })
  );
});

// 請求事件 - 緩存優先，失敗時回退到網絡（優化離線遊戲體驗）
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

  // 導航請求（HTML 頁面）- 緩存優先，失敗時網絡回退（優化離線體驗）
  // 使用 Stale-While-Revalidate 策略 + Navigation Preload 提升效能
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // 同時發起預加載請求（如果支援）
          // 修復：當 navigationPreload 不支援時，不應該執行 fetch，避免不必要的網絡請求
          const preloadPromise = navigationPreloadSupported 
            ? self.registration.navigationPreload.getState()
                .then(state => state.enabled ? fetch(request) : Promise.reject('preload disabled'))
            : Promise.reject('preload not supported');
          
          // 如果有緩存，立即返回並在背景更新
          if (cachedResponse) {
            preloadPromise
              .then(response => {
                if (response && response.ok) {
                  const responseClone = response.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseClone);
                  }).catch(() => {});
                }
              })
              .catch(() => {}); // 忽略預加載錯誤
            return cachedResponse;
          }
          
          // 沒有緩存，使用預加載結果或網絡請求
          return preloadPromise
            .then(response => {
              if (response && response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                }).catch(() => {});
              }
              return response;
            })
            .catch(() => {
              // 預加載失敗，嘗試普通網絡請求
              return fetch(request)
                .then((response) => {
                  // 複製響應並緩存
                  if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                      cache.put(request, responseClone);
                    }).catch(() => {});
                  }
                  return response;
                })
                .catch(() => {
                  // 網絡失敗時，返回離線提示頁面
                  return caches.match('./lobster-game.html').then(response => {
                    if (response) {
                      return response;
                    }
                    return new Response(getOfflinePage(), {
                      status: 503,
                      statusText: 'Service Unavailable',
                      headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                  });
                });
            });
        })
    );
    return;
  }

  // 靜態資源（JS、CSS、圖片、字體、媒體）- 緩存優先，失敗時網絡回退
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font' ||
      request.destination === 'media') {
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
