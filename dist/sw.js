const CACHE_NAME = 'kitchen-log-pro-v5';
const STATIC_ASSETS = ['/manifest.json', '/icon.svg'];

let lastShownNotifId = '';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Tuyệt đối không can thiệp API hoặc SSE để luôn đồng bộ dữ liệu thời gian thực
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Với trang HTML chính (Navigation): LUÔN DÙNG NETWORK-FIRST
  // Giúp trình duyệt luôn nhận được file index.html mới nhất với đúng mã hash JS/CSS sau mỗi lần deploy
  const isHtmlNavigation =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    event.request.destination === 'document';

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Chỉ khi mất mạng hoàn toàn mới dùng cache fallback
          return caches.match('/index.html').then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // 3. Với các file tĩnh có hash (JS, CSS trong /assets/): Dùng Cache-First để nạp siêu nhanh
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Các tài nguyên khác: Network-First với cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

async function buildAndShowNotification(payload) {
  if (!payload || !payload.title) return;
  if (payload.id && payload.id === lastShownNotifId) return;
  if (payload.id) {
    lastShownNotifId = payload.id;
  }

  const isUrgent = Boolean(payload.urgent);
  const title = payload.title || '🔔 Thông báo mới từ Bếp Pro';
  const options = {
    body: payload.body || 'Có cập nhật công việc mới trong ca bếp.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.tag || payload.id || `bep-pro-${Date.now()}`,
    renotify: true,
    requireInteraction: isUrgent,
    silent: false,
    vibrate: isUrgent ? [400, 120, 400, 120, 500] : [200, 100, 200],
    data: {
      url: payload.url || '/',
      id: payload.id,
      timestamp: payload.timestamp || Date.now(),
    },
    actions: [
      { action: 'open', title: 'Mở Checklist Bếp' },
      { action: 'dismiss', title: 'Đã xem' },
    ],
  };

  if ('setAppBadge' in self.navigator) {
    try {
      self.navigator.setAppBadge(1).catch(() => {});
    } catch {
      // ignore
    }
  }

  try {
    await self.registration.showNotification(title, options);
  } catch (showErr) {
    // Fallback cho iOS Safari và trình duyệt không hỗ trợ actions / vibrate
    try {
      await self.registration.showNotification(title, {
        body: payload.body || 'Có cập nhật công việc mới.',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: options.tag,
        renotify: true,
        data: options.data,
      });
    } catch {
      // ignore
    }
  }
}

// 1. Sự kiện Web Push: Đánh thức Service Worker ngay cả khi tắt app / kill app / khóa màn hình
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = null;
      if (event.data) {
        try {
          payload = event.data.json();
        } catch {
          try {
            const text = event.data.text();
            if (text) {
              payload = {
                id: `push-${Date.now()}`,
                title: '🔔 [Bếp Pro] Thông báo ca bếp',
                body: text,
                urgent: true,
              };
            }
          } catch {
            // ignore
          }
        }
      }

      // Nếu gói tin rỗng (Tickle Push), tự động gọi API lấy thông báo mới nhất từ Server
      if (!payload) {
        try {
          const res = await fetch('/api/push/latest', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data.latestPushMessage) {
              payload = data.latestPushMessage;
            } else if (data.latestNotification) {
              const n = data.latestNotification;
              payload = {
                id: n.id || `push-latest-${Date.now()}`,
                title: `🔔 [Bếp Pro] ${n.actorName || 'Thông báo ca bếp'}`,
                body: `${n.actorName || ''} ${n.actionText || ''} ${
                  n.targetText ? `"${n.targetText}"` : ''
                }`.trim(),
                urgent: n.type === 'task_urgent',
                url: '/',
              };
            }
          }
        } catch {
          // ignore
        }
      }

      if (!payload) {
        payload = {
          id: `push-fallback-${Date.now()}`,
          title: '🚨 [Bếp Pro] Cập nhật công việc ca bếp',
          body: 'Có thông báo mới từ hệ thống Bếp Pro. Chạm để mở ứng dụng!',
          urgent: true,
          url: '/',
        };
      }

      await buildAndShowNotification(payload);
    })()
  );
});

// 2. Tự động gia hạn đăng ký Push ngầm nếu hệ điều hành đổi token
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keyRes = await fetch('/api/push/vapid-public-key');
        const keyData = await keyRes.json();
        if (!keyData?.publicKey) return;

        const padding = '='.repeat((4 - (keyData.publicKey.length % 4)) % 4);
        const base64 = (keyData.publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSub }),
        });
      } catch {
        // ignore
      }
    })()
  );
});

// 3. Đồng bộ định kỳ ngầm (Periodic Background Sync & Background Sync trên Android/PWA)
async function checkLatestServerNotification() {
  try {
    const res = await fetch('/api/push/latest', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.latestPushMessage && Date.now() - (data.latestPushMessage.timestamp || 0) < 3600000) {
      await buildAndShowNotification(data.latestPushMessage);
    }
  } catch {
    // ignore
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'bep-pro-bg-sync') {
    event.waitUntil(checkLatestServerNotification());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'bep-pro-bg-sync') {
    event.waitUntil(checkLatestServerNotification());
  }
});

// 4. Nhận lệnh hiển thị thông báo trực tiếp từ App (chuẩn Mobile PWA Lock Screen)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SHOW_SYSTEM_NOTIFICATION' && data.payload) {
    event.waitUntil(buildAndShowNotification(data.payload));
  } else if (data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in self.navigator) {
      try {
        self.navigator.clearAppBadge().catch(() => {});
      } catch {
        // ignore
      }
    }
  }
});

// 5. Xử lý khi người dùng chạm vào thông báo trên màn hình khóa / thanh trạng thái
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in self.navigator) {
    try {
      self.navigator.clearAppBadge().catch(() => {});
    } catch {
      // ignore
    }
  }

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
