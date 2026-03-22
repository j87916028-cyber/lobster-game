// 龍蝦大戰 Service Worker - 離線支援
// 版本號：使用固定版本号，避免每次加載都創建新緩存
const CACHE_VERSION = 'v1.0.5';  // 手动更新版本号以触发缓存更新
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
  return cachedOfflinePage;
}

const urlsToCache = [
  './',
  './index.html',
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
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => {
        // 快取完成後才啟用，確保所有資源都正確緩存後才接管客戶端
        self.skipWaiting();
      })
      .catch(() => {
        // 快取安裝失敗時靜默忽略，SW 保持等待狀態，瀏覽器稍後會重試
      })
  );
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

// 輔助函式：嘗試更新緩存中的資源
function updateCacheFromResponse(request, response) {
  if (response && response.ok) {
    const responseClone = response.clone();
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(request, responseClone);
    }).catch(() => {});
    return response;
  }
  return null;
}

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

  // 導航請求（HTML 頁面）- Stale-While-Revalidate 策略
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // 同時發起網絡請求（無論是否有緩存都用 Stale-While-Revalidate）
          const networkPromise = fetch(request)
            .then((networkResponse) => {
              updateCacheFromResponse(request, networkResponse);
              return networkResponse;
            })
            .catch(() => null); // 網絡失敗時返回 null，不阻斷流程

          if (cachedResponse) {
            // 有緩存：立即返回緩存，同時在背景更新緩存
            // 只有當 navigationPreload 可用時才嘗試使用它，否則直接用普通 fetch
            if (navigationPreloadSupported) {
              // 檢查預加載是否啟用（不阻塞返回緩存）
              self.registration.navigationPreload.getState()
                .then((state) => {
                  if (state && state.enabled) {
                    // 預加載已啟用，額外發起一次預加載 fetch 來加速後續導航
                    // 但不等待結果，因為我們已經在用網絡結果更新緩存了
                    fetch(request).catch(() => {});
                  }
                })
                .catch(() => {});
            }
            return cachedResponse;
          }

          // 無緩存：等待網絡響應
          return networkPromise.then((response) => {
            if (response) {
              return response;
            }
            // 網絡也失敗：返回離線提示頁面
            return caches.match('./lobster-game.html').then((fallback) => {
              if (fallback) {
                return fallback;
              }
              return new Response(getOfflinePage(), {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
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
            updateCacheFromResponse(request, networkResponse);
            return networkResponse;
          }).catch(() => {
            // 離線時返回 503 錯誤，讓瀏覽器自然處理失敗
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
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
          // 克隆響應並緩存
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
        return caches.match('./lobster-game.html').then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});
