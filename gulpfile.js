/*=========== external ===========*/
const gulp = require('gulp');
// used to version static files
const rev = require('gulp-rev');
// used to delete folders and files
const rimraf = require('rimraf');
// used to loop over files specified in gulp.src
const each = require('gulp-each');
// used to convert files to es5
const babel = require('gulp-babel');
// used to lint code for syntax errors
const eslint = require('gulp-eslint');
// used to rename files
const rename = require('gulp-rename');
// used to combine a set of defined files into one big file
const concat = require('gulp-concat');
// used to replace string
const replace = require('gulp-replace');
// used to minify css
const cleanCSS = require('gulp-clean-css');
// used to generate source map
const sourcemaps = require('gulp-sourcemaps');
// used to generate/optimize images
const responsive = require('gulp-responsive');
// used to minify .js files (compatible with es6)
const uglify = require('gulp-uglify-es').default;
// used to autoprefix css
const autoprefixer = require('gulp-autoprefixer');
// used to do live editing in the browser
const browserSync = require('browser-sync').create();
// used to compile .hbs files to .html
const handlebars = require('gulp-compile-handlebars');
/*=========== internal ===========*/
const fs = require('fs');
const path = require('path');
// config contains all file build paths, image sizes and all
const config = require('./config');

/******************
    Styles tasks
******************/

gulp.task('styles', function() {
  return gulp.src(config.styles.src)
    .pipe(
      autoprefixer({
        browsers: ['last 2 versions']
      })
    )
    .pipe(cleanCSS({debug: true}, (details) => {
      console.log(`${details.name}: ${details.stats.originalSize}`);
      console.log(`${details.name}: ${details.stats.minifiedSize}`);
    }))
    .pipe(gulp.dest(config.styles.dest))
    .pipe(sourcemaps.write())
    .pipe(browserSync.stream());
});

gulp.task('build:styles', function () {
  return gulp.src(config.styles.src)
    .pipe(sourcemaps.init())
    // auto prefexing
    .pipe(
      autoprefixer({
        browsers: ['last 2 versions']
      })
    )
    .pipe(cleanCSS())
    .pipe(sourcemaps.write('.'))
    .pipe(rev())
    .pipe(gulp.dest(config.styles.dest))
    .pipe(rename({
      dirname: config.styles.revDest
    }))
    .pipe(rev.manifest(config.revManifest.path, {
      base: config.revManifest.dest,
      merge: true
    }))
    .pipe(gulp.dest(config.revManifest.dest));
});



/******************
    Linting tasks
******************/

gulp.task('lint', function() {
  return gulp.src(config.lint.src)
    // eslint() attaches the lint output to the 'eslint' property
    // of the file object so it can be used by other modules.
    .pipe(eslint())
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe(eslint.formatEach())
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError last.
    .pipe(eslint.failAfterError());
});

/******************
    Scripts tasks
******************/

/*======= bundled scripts =======*/

/**
 * concat scripts and transpile to es5
 */
function concatScript(details) {
  return () => gulp.src(details.src)
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(concat(details.fileName))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(details.dest));
}

gulp.task('js-scripts', gulp.parallel(
  concatScript(config.js.main),
  concatScript(config.js.inside)
));


/**
 * concat, uglify and transpile (to es5) scripts
 */
function concatAndUglifyScript(details) {
  return () => gulp.src(details.src)
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(concat({path: details.fileName, cwd: ''}))
    .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(rev())
    .pipe(gulp.dest(details.dest))
    .pipe(rename({
      dirname: details.revDest
    }))
    .pipe(rev.manifest(config.revManifest.path, {
      base: config.revManifest.dest,
      merge: true
    }))
    .pipe(gulp.dest(config.revManifest.dest));
}

/**
 * the two tasks were run in series because
 * there was a conflict when writing to
 * rev-manifest.json file
 */
gulp.task('build:js-scripts', gulp.series(
  concatAndUglifyScript(config.js.main),
  concatAndUglifyScript(config.js.inside)
));


/*======= modules =======*/

gulp.task('mjs-scripts', function() {
  return gulp.src(config.mjs.src)
    .pipe(replace('//<<-!->>', ''))
    .pipe(replace('//<<-!->>', ''))
    .pipe(rename({
      extname: '.mjs'
    }))
    .pipe(gulp.dest(config.mjs.dest));
});

/**
 * task to build modules scripts with .mjs extension
 * instead of .js extension to be used as modules
 */
function mjsScriptsBuildTask() {
  return gulp.src(config.mjs.src)
    /*
      since we are creating both .js (bundles)
      and .mjs (modules), the import/export statements
      are preceded with a comment '//<<-!->>' that we
      get rid off when we are generating .mjs files
      using the replace plugin.
    */
    .pipe(replace('//<<-!->>', ''))
    .pipe(replace('//<<-!->>', ''))
    .pipe(rename({
      extname: '.mjs'
    }))
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(rev())
    .pipe(gulp.dest(config.mjs.dest))
    .pipe(rename({
      dirname: config.mjs.revDest
    }))
    .pipe(rev.manifest(config.revManifest.path, {
      base: config.revManifest.dest,
      merge: true
    }))
    .pipe(gulp.dest(config.revManifest.dest));
}

/**
 * Replaces occurences of files in the import statement
 * with fingerprinted (versioned) file name.
 * Details:
 * as there is no plugin related to gulp-rev that
 * takes care of replacing file names in scripts
 * this task uses gulp-each to loop through files
 * and changes the accurences of the file name
 * with it's fingerprinted counterpart in the rev-manifest.json
 */
function revReplaceTask() {
  const revManifest = JSON.parse(fs.readFileSync(config.revManifest.path, 'utf8'));

  return gulp.src(`${config.mjs.dest}/**/*.mjs`)
    .pipe(each((content, file, callback) => {
      let newContent = content;
      for(const key of Object.keys(revManifest)) {
        newContent = newContent.replace(key, revManifest[key]);
      }
      callback(null, newContent);
    }))
    .pipe(gulp.dest(config.mjs.dest));
}

/**
 * we run the tasks in series because revReplace
 * task depends on the existence of the built files
 */
gulp.task('build:mjs-scripts', gulp.series(mjsScriptsBuildTask, revReplaceTask));

/*======= service worker =======*/


gulp.task('sw-rev', function () {
  return gulp.src(config.sw.src)
    .pipe(gulp.dest(config.sw.dest));
});

/*======= scripts =======*/

gulp.task('scripts', gulp.parallel('js-scripts', 'mjs-scripts'));

/**
 * we run the tasks in series so that
 * there won't be any conflicts when
 * writing to rev-manifest.json
 */
gulp.task('build:scripts', gulp.parallel('build:js-scripts', 'build:mjs-scripts'));

/******************
    images tasks
******************/

/**
 * PS. I can honestly say that I have wasted
 * more time writing this helper than I have
 * or will ever save
 *
 * generate gulp-responsive configuration object
 * @param {Array} widths - image widths to genrate.
 *  if element is an object, must provide 'width'
 *  property && (optional) 'enlarge' which is the opposite of
 * 'withoutEnlargement' option, defaults to 'false'.
 * check: http://sharp.dimens.io/en/stable/api-resize/#withoutenlargement
 * @param {string} ext - extension to generate this for, defaults to 'jpg'
 */
function getResponsiveConfig(widths, ext = 'jpg') {
  const arr = [];
  for(const width of widths) {
    let w, enlarge = false;
    if(typeof width === 'number') {
      w = width;
    } else if (typeof width === 'object' &&
              width.hasOwnProperty('value')) {
      w = width.value;
      enlarge = Boolean(width.enlarge);
    }
    arr.push({
      width: w,
      rename: {
        suffix: `-${w}w`,
      },
      progressive: true,
      withoutEnlargement: !enlarge
    });
  }
  return {[`*.${ext}`]: arr};
}

/**
 * generates images for given widths
 */
gulp.task('optimize-images', function() {
  return gulp.src(config.imgs.src)
    .pipe(responsive(
      getResponsiveConfig(config.imgs.widths)
    ))
    .pipe(gulp.dest(config.imgs.dest));
});

/******************
    Copy tasks
******************/

/**
 * looks up all files in directory recursively
 * (i.e. and all its subdirectories)
 * @param {string} base - base path that won't be include in file paths
 * @param {String} dir - directory path to include in file paths
 * @param {Array} filelist - array to append
 * @returns array of file paths
 */
const walkSync = (base, dir, filelist = []) => {
  const files = fs.readdirSync(path.join(base, dir));
  files.forEach( file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(path.join(base, filePath)).isDirectory()) {
      filelist = walkSync(base, filePath, filelist);
    } else {
      filelist.push(filePath);
    }
  });
  return filelist;
};

/**
 * creates an object where keys are the
 * same as values, from a given array
 * @param give
 */
const arrToObj = (arr = []) => {
  const obj = {};
  for(const elem of arr) {
    obj[elem] = elem;
  }
  return obj;
};

/**
 * looks up rev-manifest.json of the gulp-rev module
 * if it exists, it parses it and returns the object
 * if not, it gets all generated file names and returns
 * a version rev-manifest that works as a fallback
 * @param {string} path - path to rev-manifest.json
 * @param {string}
 */
function getRevManifestObj(path, base, dir) {
  // read in our manifest file
  let revManifest = {};
  try {
    revManifest = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (err) {
    if(!base || !dir) {
      throw new Error('manifest.json doesn\'t exist,\
      you must specify directory Path for fallbacks');
    }
    /* if rev-manifest.json doesn't exist */
    revManifest = arrToObj(walkSync(base, dir));
    fs.writeFileSync(path, JSON.stringify(revManifest, null, 2), 'utf8');
  }
  return revManifest;
}

gulp.task('compile-html', function() {
  const revManifest = getRevManifestObj(config.revManifest.path, config.destBase, 'assets/');

  /* read in our handlebars template,
    compile it using our manifest, and output */
  return gulp.src(config.hbs.src)
    .pipe(handlebars(revManifest, {
      /* create a handlebars helper to look up
      fingerprinted asset by non-fingerprinted name */
      helpers: {
        assetPath(path, context) {
          return context.data.root[path];
        }
      }
    }))
    .pipe(rename({
      extname: '.html'
    }))
    .pipe(gulp.dest(config.hbs.dest));
});

gulp.task('copy-data', function() {
  return gulp.src(config.data.src)
    .pipe(gulp.dest(config.data.dest));
});

/******************
    dev task
******************/

gulp.task('live-editing', function (done) {
  gulp.watch(config.styles.src, gulp.parallel('styles'));
  gulp.watch(config.lint.src, gulp.parallel('lint'));
  gulp.watch('src/js/**/*.js', gulp.parallel('scripts'));
  // listening for changes in the html file
  // and reloading browserSync on changes
  gulp.watch(config.hbs.src)
    .on('change', browserSync.reload);

  browserSync.init({
    server: {
      baseDir: config.destBase
    }
  });
  done();
});

/******************
    prod task
******************/

/**
 * running all tasks in parallel
 * for the exception of the linting task
 * that runs before the scripts task
 */
exports.build = gulp.series(
  function (cb) {
    rimraf(config.destBase, cb);
  },
  gulp.parallel(
    // the reason why these tasks are in series
    // because we shouldn't do one before the other
    // if we have a syntax error we want to be notified
    gulp.series('lint', 'build:scripts'),
    'optimize-images',
    'build:styles',
    'copy-data',
  ),
  'compile-html'
);

/******************
    default task
******************/


exports.default = gulp.series(
  function (cb) {
    rimraf(config.destBase, cb);
  },
  gulp.parallel(
    'optimize-images',
    'styles',
    'copy-data',
    gulp.series(
      'lint',
      'scripts'
    )
  ),
  'compile-html',
  'live-editing'
);