self.addEventListener('install', function(e) {
  console.log('Service Worker установлен');
});

self.addEventListener('fetch', function(e) {
  console.log('Запрос: ', e.request.url);
});