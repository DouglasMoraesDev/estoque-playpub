self.addEventListener('install', e => {
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  clients.claim();
});
self.addEventListener('fetch', () => {
  // você pode adicionar cache aqui se quiser
});
