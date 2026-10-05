// Basit servis çalışanı: uygulamanın yüklenebilir olması için. Veriler her zaman canlı çekilir.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
