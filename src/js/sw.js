// the version will be replaced in the build step
const version = '<<-!version->>';
const staticCacheName = `reviews-app--static-${version}`;
const contentImgsCacheName = 'reviews-app--content-imgs';
const fontsCacheName = 'reviews-app--fonts';
const allCaches = [staticCacheName, contentImgsCacheName, fontsCacheName];

/*
  this is an array of all fingerprinted filenames
  which will be set dynamically when sending the file.
  this is done with static-module
  check '/sw.js' route in '/server/routes.js' for more details
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
  './assets/offline.png'
];

addEventListener('install', event => {
  event.waitUntil(
    (async function() {
      console.log('caching assets');
      const cache = await caches.open(staticCacheName);
      await cache.addAll(toCache);
    })()
  );
});

addEventListener('activate', event => {
  event.waitUntil(
    (async function() {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            key => key.startsWith('reviews-app--') && !allCaches.includes(key)
          )
          .map(key => caches.delete(key))
      );
    })()
  );
});

/*
NOTE: the offline image (in servePhotos()) was inspired by james priest's
https://james-priest.github.io/mws-restaurant-stage-1/stage1.html

NOTE: overall handling of the service worker is self implemented due
to extra learning from this article by Jake Archibald
https://jakearchibald.com/2014/offline-cookbook/

NOTE: learnt async/await implementation in service worker
in this Supercharged video by Jake Archibald & Surma
https://www.youtube.com/watch?v=3Tr-scf7trE&t=2018s

NOTE: Removed MAP caching because caching everything that
comes from the MAPBOX API is not a good idea since the
content to cache is too much

*/
addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (location.origin === requestUrl.origin) {
    // only match /restaurant.html or /restaurant
    if (/^\/restaurant(\.html)?$/.test(requestUrl.pathname)) {
      event.respondWith(
        (async function() {
          const cachedResponse = await caches.match('./restaurant');
          // if there is no match the cachedResponse will be 'null' (i.e. falsey)
          if (cachedResponse) return cachedResponse;

          // when we return fetch, it's going to pass the Promise
          // even if the promise rejects
          // TODO:
          // create a offline.html and use it as fallback
          return fetch('./restaurant');
        })()
      );
      return;
    }

    if (requestUrl.pathname.startsWith('/assets/img/')) {
      event.respondWith(servePhoto(event.request));
      return;
    }
  }
  // font related request: google fonts & myfontastic(icons)
  if (isFontRelated(requestUrl.href)) {
    console.log('here', requestUrl.href);
    event.respondWith(serveFonts(event.request));
    return;
  }

  // other requests
  event.respondWith(
    (async function() {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;

      return fetch(event.request);
    })()
  );
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
  const requestedImageSize = Number(
    imageUrl.slice(imageUrl.indexOf('-') + 1, imageUrl.indexOf('w'))
  );

  // opening cache and getting cached response if it exists
  const cache = await caches.open(contentImgsCacheName);
  const cachedResponse = await cache.match(storageUrl);

  if (cachedResponse) {
    const cachedImageSize = Number(cachedResponse.headers.get('size'));
    if (cachedImageSize < requestedImageSize) {
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
      } catch (err) {
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
async function imageFetchAndCache({ cache, request, storageUrl, size }) {
  const networkResponse = await fetch(request);
  const blob = await networkResponse.blob();
  const headers = new Headers({ size });
  const res = new Response(blob, { headers });
  await cache.put(storageUrl, res.clone());
  return res;
}

/**
 * checks if url matches the pattern for
 * google fonts or myfontastic urls
 * @param {String} url - url to check
 * @returns {Boolean} - returns true if url matches pattern, else false.
 */
function isFontRelated(url) {
  const pattern =
    'https://(?:file|fonts).(?:googleapis|gstatic|myfontastic).com/(.*)';
  return new RegExp(pattern).test(url);
}
/**
 * serves cached response if it exists
 * else, fetch response, caches clone then
 * serves response
 * @param {Object} request - request object
 */
async function serveFonts(request) {
  // opening cache and getting cached response if it exists
  const cache = await caches.open(fontsCacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;
  try {
    const fetchedResponse = await fetch(request);
    cache.put(request, fetchedResponse.clone());
    return fetchedResponse;
  } catch (err) {
    console.log(err);
  }
}

/* ================== Background sync related ================== */
/*
  When the sync event is fired with a 'postOubox' tag:
  - get all pending reviews from the 'reviews-outbox' store
  - loop through the pending reviews:
    - make a post request with review as body
    - add review to 'reviews' store
    - delete review from 'reviews-outbox' store

  Note: idealy, there is no need for a sync event,
  since the reviews are posted the next time the user
  visits the page with internet.
  check 'postOubox' method in 'src/js/dbHelper.js'


  the *concept* is derived from these sources:
  * Google developers - Intro to background sync:
  https://developers.google.com/web/updates/2015/12/background-sync
  * Emojoy, Push API demo on App Engine by Jake archibald:
  https://github.com/jakearchibald/emojoy/
  * IndexedDB implementation from 'Client-Side Data Storage [book]'

*/

/**
 * converts an idb operations success/error
 * to a promise based resolve/reject
 * @param {function} dbOperation - idb process to
 * @param {*} err - error to pass as param on reject
 * (mainly for transaction errors)
 * @returns promise that resolves with the result of
 * the operation and rejects with its error
 */
const getPromise = (dbOperation, err) => {
  return new Promise((res, rej) => {
    dbOperation().onsuccess = event => res(event.target.result);
    dbOperation().onerror = event => rej(err || event.target.error);
  });
};

/**
 * Opens idb database and
 *
 * @param {string} dbName - idb database name to open
 * @param {number} version - idb database version
 * @returns returns promise that resolves with the database object
 */
const openDB = (dbName, version) => {
  const req = indexedDB.open(dbName, version);
  return getPromise(() => req);
};

/**
 * sends a post request to create new review in (server) database
 * @param {object} review - review to send as body of request
 * @returns created review
 */
async function createNewReview(review) {
  try {
    const url = 'http://localhost:1337/reviews';
    // the review object already has an id
    // given by IDB because the reviews-outbox store
    // has 'autoIncrement: true', so we clone the review
    // and we delete the 'id' key from it
    const data = Object.assign({}, review);
    delete data.id;

    const options = {
      method: 'POST',
      cors: 'no-cors',
      body: JSON.stringify(data)
    };

    const res = await fetch(url, options);
    if (res.status !== 201) throw new Error('Review wasn\'t created');

    return await res.json();
  } catch (err) {
    console.log(err);
  }
}

/**
 * adds newly created to 'reviews' store and deletes
 * its counterpart in 'reviews-outbox' store
 * @param {object} db - opened idb db object
 * @param {objec} review - newly created review
 * @param {number} id - pending review idea to delete from
 * 'reviews-outbox' store
 * @returns a promise that resolves on the completion of the transaction
 */
async function handleReviewCreated(db, review, id) {
  try {
    const tx = db.transaction(['reviews-outbox', 'reviews'], 'readwrite');
    const outboxStore = tx.objectStore('reviews-outbox');
    getPromise(() => outboxStore.delete(id));

    // the add() operation caused an error with no
    // messages/code, but by checking the transaction itself
    // it shows 'ConstraintError: Key already exists in the object store'
    // although the key doesn't really exist,
    // the error doesn't happen when I create 2 transactions
    // one for adding review to 'reviews' store and another to
    // delete review from 'outbox-store', so I went with put()
    // that doesn't cause problem in both cases and won't overwrite
    // a review because the server responds with a review with unique 'id'
    const reviewsStore = tx.objectStore('reviews');
    getPromise(() => reviewsStore.put(review));

    return await getPromise(() => tx, tx);
  } catch (err) {
    console.log(err);
  }
}

// caching the idbPromise in the global scope
// so that we don't run openDB() function everytime
// read more about this here:
// https://stackoverflow.com/questions/38835273/when-does-code-in-a-service-worker-outside-of-an-event-handler-run/38835274#38835274
let idbPromise;

/**
 * posts reviews in 'reviews-outbox' store, adds them to
 * reviews store then deletes them from 'reviews-outbox' store
 */
async function postOutbox() {
  try {
    const db = await idbPromise;
    if (!db) throw new Error('idbPromise failed to resolve db');
    if (
      !db.objectStoreNames.contains('reviews') &&
      !db.objectStoreNames.contains('reviews-outbox')
    )
      throw new Error('Stores not yet created');

    const tx = db.transaction('reviews-outbox');
    const outboxStore = tx.objectStore('reviews-outbox');
    const pendingReviews = await getPromise(() => outboxStore.getAll());
    for (let pr of pendingReviews) {
      createNewReview(pr).then(review =>
        handleReviewCreated(db, review, pr.id)
      );
    }

    return await getPromise(() => tx, tx.error);
  } catch (err) {
    console.log(err);
  }
}

addEventListener('sync', event => {
  if (event.tag == 'postOutbox') {
    if (!idbPromise) {
      idbPromise = openDB('reviews-app', 1);
    }
    event.waitUntil(postOutbox());
  }
});
