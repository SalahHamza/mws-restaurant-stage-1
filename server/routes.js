/*global __dirname Buffer:true*/

const
  fs = require('fs'),
  path = require('path'),
  config = require('./../config'),
  memCache = require('memory-cache'),
  staticModule = require('static-module');

const express = require('express');
const router = express.Router();


/*
 In order to have a good cache policy, maxAge of 1year has been
 given to static assets, but there won't be any conflicts since
 a version will be added to the name of each file.
 for that to happen we need to give all html files a
 Cache-Control: no-cache, so that when we do change the version
 we get the latest html with the right path to files.
 learn more here:
 https://medium.com/pixelpoint/best-practices-for-cache-control-settings-for-your-website-ff262b38c5a2
*/
router.use('/assets', express.static(path.join(__dirname, '../app/assets'), {maxAge: '1y'}));
router.use('/manifest.json', express.static(path.join(__dirname, '../app/manifest.json'), {maxAge: '1y'}));

// Set default caching headers
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

router.get(['/', '/index.html'], (req, res) => {
  res.render('index.html');
});

/**
 * within index.html 'view detail' we are referencing the
 * /restaurant.html?id=*, which will resault in a 404 error
 * that's why the need to implicitly include both routes paths
 */
router.get(['/restaurant', '/restaurant.html'], (req, res) => {
  res.render('restaurant.html');
});


/*
  middleware to cache the toCache array

  toCache array: array containing the fingerprinted
  filenames to pass to the service worker.
  we don't want to repeat this everytime we receive
  a GET request for '/sw.js'.

  - if array is already cached:
    * we set it to response object
    * invoke next() (handle request)
    * Update the cache
  - else:
    * add new cache entry with toCache as value
    * invoke next() (handle request)

  NOTE: The memory cache is cleared on server's
  close event
*/
const cacheToCacheMiddleware = (duration) => {
  return (req, res, next) => {
    const toCacheKey = 'sw-toCache';
    const cachedBody = memCache.get(toCacheKey);
    if(cachedBody) {
      res.toCache = cachedBody;
      return next();
    }
    const toCache = [];
    try {
      const revManifest = JSON
        .parse(fs.readFileSync(`${__dirname}/../${config.revManifest.path}`));

      // adding fingerprinted filenames to the cached files array
      const revedFilenames = Object.values(revManifest)
        .filter(filename => !filename.endsWith('.map'));

      for(const filename of revedFilenames) {
        toCache.push(`./${filename}`);
      }
    } catch(err) {
      // in development the rev-manifest.json file doesn't exist
      // so fallback to the non-fingerprinted filenames
      for(const filename of config.toCache) {
        toCache.push(filename);
      }
    }
    // adding the generated icons to the cached files array
    for(const icon of config.imgs.icons.toCache) {
      toCache.push(`./${icon}`);
    }
    res.toCache = toCache;
    memCache.put(toCacheKey, toCache, duration*1000);
    next();
  };
};



/*
 streaming service worker
 https://www.youtube.com/watch?v=3Tr-scf7trE&index=99&list=WL&t=1286s
*/
router.get('/sw.js', cacheToCacheMiddleware(1*60*60), (req, res) => {
  const input = fs.createReadStream(`${__dirname}/../app/sw.js`);
  /*
    since service workers have strict
    mime type checking, we are setting
    content-type header
  */
  res.set('Content-Type', 'application/javascript');
  // getting all fingerprinted filenames
  // their paths is relative to the service
  // worker location in the app

  input
    // static-module gives access to functions
    // as modules
    .pipe(staticModule({
      'static-to-cache': () => {
        return JSON.stringify(res.toCache, null, 2);
      }
    }))
    .pipe(res);
});


/**
 * route for api_key, it is not completely secured
 * but it won't show on the client unless the
 * auth header is set with the secret
 */
router.get('/mapbox_api_key', (req, res) => {
  // checking if there are credentials
  if (!req.headers.authorization) {
    return res.json({ error: 'No credentials sent!' });
  }
  // extraction secret
  const encoded = req.headers.authorization.split(' ')[1];
  const decoded = new Buffer(encoded, 'base64').toString('utf8');
  if(decoded !== config.mapboxSecret) {
    return res.json({ error: 'Credentials are not correct!' });
  }
  res.json({MAPBOX_TOKEN: config.mapboxKey});
});

module.exports = router;