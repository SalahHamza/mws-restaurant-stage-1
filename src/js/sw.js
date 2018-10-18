// the version will be replaced in the build step
const version = '<<-!version->>';
const staticCacheName  = `reviews-app--static-${version}`;
const mapCacheName = 'reviews-app--mapAPI';
const allCaches = [
  staticCacheName,
  mapCacheName
];

/**
 * this allows the website to work in
 * both github pages and local env
 */
const BASE_URL = (() => {
  if(location.origin.includes('localhost:')){
    return location.origin;
  }
  return `${location.origin}/mws-restaurant-stage-1`;
})();

/*
  this is an array of all fingerprinted filenames
  which will be set dynamically when sending the file.
  this is done with static-module
*/
const staticToCache = require('static-to-cache')();

const toCache = [
  './',
  './index.html',
  './restaurant',
  './restaurant.html',
  ...staticToCache,
  /* works as replacement for the server data */
  './assets/data/restaurants.json',
  /* will work as replacement to images */
  './assets/offline.png',
  /* Caching map assets */
  'https://unpkg.com/leaflet@1.3.1/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.3.1/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.3.1/dist/images/marker-icon.png',
  /* Cashing font face */
  'https://fonts.googleapis.com/css?family=Lato:400,700'
];

addEventListener('install', event => {
  event.waitUntil(async function() {
    console.log('caching assets');
    const cache = await caches.open(staticCacheName);
    await cache.addAll(toCache);
  }());
});

addEventListener('activate', event => {
  event.waitUntil(async function() {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => (
          key.startsWith('reviews-app--') && !allCaches.includes(key)
        ))
        .map(key => caches.delete(key))
    );
  }());

});

/*
  - If request if for an inside page respond with '/restaurant'
  - If it's a MAP API asset request:
    - if there is internet access:
     * fetch new data from the network.
     * update cache with new data.
    - else:
      * match the cache for a similar request and respond with it
  - else:
    match other requests
    - if request for an image respond with offline.png image

NOTE: the offline image was inspired by james priest's
https://james-priest.github.io/mws-restaurant-stage-1/stage1.html

NOTE: overall handling of the service worker is self implemented due
to extra learning from this article by Jake Archibald
https://jakearchibald.com/2014/offline-cookbook/

NOTE: learnt async/await implementation in service worker
in this Supercharged video by Jake Archibald & Surma
https://www.youtube.com/watch?v=3Tr-scf7trE&t=2018s

*/
addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const mapAPIBaseUrl = 'https://api.tiles.mapbox.com/v4/';
  const insideBaseUrlRE = new RegExp(`^${BASE_URL}/restaurant(.html)?(\\?id=\\d*)?$`);

  if(insideBaseUrlRE.test(event.request.url)) {
    event.respondWith(async function() {
      const cachedResponse =  await caches.match('./restaurant');
      // if there is no match the cachedResponse will be 'null' (i.e. falsey)
      if(cachedResponse) return cachedResponse;

      // when we return fetch, it's going to pass the Promise
      // even if the promise rejects
      // TODO:
      // create a offline.html and use it as fallback
      return fetch('./restaurant');
    }());

    return;
  }
  // if the request is for an MAPBOX asset
  if (event.request.url.includes(mapAPIBaseUrl)) {
    event.respondWith(fetchAndUpdateCacheThenRespond(event.request, mapCacheName));
    return;
  }
  // other requests
  event.respondWith(async function() {
    const cachedResponse = await caches.match(event.request);
    if(cachedResponse) return cachedResponse;
    try {
      return await fetch(event.request);
    } catch (err) {
      if (event.request.url.includes('.jpg')) {
        /* If no cache match for the image,
          return offline image */
        return await caches.match('./assets/offline.png');
      }
    }
  }());
});

/**
 * checks if online, fetch data from network,
 * updates cache and repond with data
 * if offline responds with cached data
 * @param {Object} request - The Request the browser intends to make
 * @param {string} cacheName - Cache name to cache data in
 * @returns {Object.<Response>} response object for the given request
 */
async function fetchAndUpdateCacheThenRespond(request, cacheName) {
  const cache = await caches.open(cacheName);
  // fetch data from network and update cache for that request
  // if network fetch fails fallback to cache response
  try {
    const networkResponse = await fetch(request);
    await cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch(err) {
    return await cache.match(request);
  }
}