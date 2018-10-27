// the version will be replaced in the build step
const version = '<<-!version->>';
const staticCacheName  = `reviews-app--static-${version}`;
const mapCacheName = 'reviews-app--mapAPI';
const contentImgsCacheName = 'reviews-app--content-imgs';
const allCaches = [
  staticCacheName,
  mapCacheName,
  contentImgsCacheName
];


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
  './manifest.json',
  ...staticToCache,
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

NOTE: Caching everything that comes from the MAPBOX API is not
a good idea since the content size increases quickly

*/
addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if(location.origin === requestUrl.origin)  {

    // only match /restaurant.html or /restaurant
    if(/^\/restaurant(\.html)?$/.test(requestUrl.pathname)) {
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

    if(requestUrl.pathname.startsWith('/assets/img/')) {
      event.respondWith(servePhoto(event.request));
      return;
    }
  }

  // if the request is for an MAPBOX asset
  if (requestUrl.origin === 'https://api.tiles.mapbox.com') {
    event.respondWith(fetchAndUpdateCacheThenRespond(event.request, mapCacheName));
    return;
  }
  // other requests
  event.respondWith(async function() {
    const cachedResponse = await caches.match(event.request);
    if(cachedResponse) return cachedResponse;

    return fetch(event.request);
  }());
});


/**
 * listening for a message from the client
 * stating that service worker should skip the
 * waiting state
 */
addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});


/* ========== Helper functions ========== */

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


/*
  pseudo code:
  - extract storageUrl (url without size and extension)
  - extract requested_image_size
  - open cache and get cached response if it exists
  - if cached response exists:
    * extract cached_image_size from custome header 'size'
    * if requested_image_size > cached_image_size:
      - fetch image (with bigger requested size) from network
      - create new response with a custome header 'size'
      - update cache entry for that storageURl
      - return response
    else: return cached response
  else:
    - fetch image (with bigger requested size) from network
    - create new response with a custome header 'size'
    - update cache entry for that storageURl
    - return response
*/
/**
 * fetch and cache the largest requested copy of the image
 */
async function servePhoto(request) {
  // images are not fingerprinted so it's as simple
  // as: 5-800w.jpg
  const imageUrl = request.url;
  const storageUrl = imageUrl.replace(/-\d+w\.jpg$/, '');

  // extracting the requested image size i.e. 5-'800'w.jpg
  const requestedImageSize = Number(imageUrl.slice(
    imageUrl.indexOf('-') + 1,
    imageUrl.indexOf('w')
  ));

  // opening cache and getting cached response if it exists
  const cache = await caches.open(contentImgsCacheName);
  const cachedResponse = await cache.match(storageUrl);

  if(cachedResponse) {
    const cachedImageSize = Number(cachedResponse.headers.get('size'));
    if(cachedImageSize < requestedImageSize) {
      try {
        // imageFetchAndCache() is async, so if we return
        // the promise it will be passed to event.respondWith()
        // even if the promise will reject, that's why we need
        // to 'return await' so that we can catch if the fetching fails
        return await imageFetchAndCache({
          cache,
          request,
          storageUrl,
          size: requestedImageSize
        });
      } catch(err) {
        return cachedResponse;
      }
    }
    return cachedResponse;
  }

  try {
    return await imageFetchAndCache({
      cache,
      request,
      storageUrl,
      size: requestedImageSize
    });
  } catch (err) {
    return caches.match('./assets/offline.png');
  }
}



/**
 * makes a fetch request for the provided request,
 * creates a new response with a costume header
 * 'size' (with image sizeas value) from the response we get,
 * caches a clone of the response and returns the response
 */
async function imageFetchAndCache({cache, request, storageUrl, size}) {
  const networkResponse = await fetch(request);
  const blob = await networkResponse.blob();
  const headers = new Headers({ size });
  const res = new Response(blob, { headers });
  await cache.put(storageUrl, res.clone());
  return res;
}