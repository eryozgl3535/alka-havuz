// Servis çalışanı: uygulamanın yüklenebilir olması ve hatırlatma bildirimleri için. Veriler her zaman canlı çekilir.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', (e) => {
  let v = {};
  try { v = e.data ? e.data.json() : {}; } catch { v = { govde: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(v.baslik || 'ALKA Hatırlatma', {
    body: v.govde || '',
    icon: '/ikon-192.png',
    badge: '/ikon-192.png',
    tag: v.etiket || 'alka-hatirlatma',
    renotify: true,
    // Alarm gibi: ekranda kalır (destekleyen cihazlarda), titreşir, sessiz değildir
    requireInteraction: !!v.alarm,
    vibrate: v.alarm ? [500, 250, 500, 250, 900] : [200],
    silent: false,
    data: { url: v.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hedef = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
    for (const c of liste) { if ('focus' in c) { c.navigate(hedef).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(hedef);
  }));
});
