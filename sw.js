// Service Worker für den Fuerteventura-Reiseplaner.
// Zweck: (1) Benachrichtigungen anzeigen dürfen, (2) die Seite offline verfügbar halten.
var CACHE = 'fuerte-v2';
var CORE = ['./', './index.html', './manifest.json', './vendor/leaflet.js', './vendor/leaflet.css'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE).catch(function(){}); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// Netz zuerst, Cache als Rückfall — so ist die Seite immer aktuell,
// funktioniert aber auch ohne Empfang (z. B. auf der Fahrt nach Cofete).
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // Wetter-API & Co. nie cachen
  e.respondWith(
    fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy).catch(function(){}); });
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});

// Echte Push-Nachrichten von einem Server (falls später eingerichtet).
self.addEventListener('push', function(e){
  var data = {title: '🌅 Sonnenuntergang Fuerteventura', body: 'Gleich geht die Sonne unter.'};
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch(err){}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'images/icon-192.png',
    badge: 'images/icon-192.png',
    tag: 'sunset'
  }));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list){
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) return list[i].focus();
    }
    if (clients.openWindow) return clients.openWindow('./index.html#wetter');
  }));
});
