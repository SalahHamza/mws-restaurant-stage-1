/*global __dirname :true*/

const
  fs = require('fs'),
  path = require('path'),
  config = require('./../config'),
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
 streaming service worker
 https://www.youtube.com/watch?v=3Tr-scf7trE&index=99&list=WL&t=1286s
*/
router.get('/sw.js', (req, res) => {
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
  let toCache = [];
  try {
    const revManifest = JSON.parse(fs.readFileSync(`${__dirname}/../${config.revManifest.path}`));
    toCache = Object.keys(revManifest)
      .filter(filename => !filename.endsWith('.map'))
      // returning relative paths './../..'
      .map(filename => `./${revManifest[filename]}`);
  } catch(err) {
    // in development the rev-manifest.json file doesn't exist
    // so fallback to the non-fingerprinted filenames
    toCache = config.toCache;
  }

  input
    // static-module gives access to functions
    // as modules
    .pipe(staticModule({
      'static-to-cache': () => {
        return JSON.stringify(toCache, null, 2);
      }
    }))
    .pipe(res);
});

// these two files are not within the scope of the
// public directory '/assets', so we need to serve them
// TODO: Find an alternative!
router.get(['/manifest.json','/rev-manifest.json'], (req, res) => {
  const readStream = fs.createReadStream(path.join(__dirname, '/../app/', req.path));
  readStream.pipe(res);
});

module.exports = router;