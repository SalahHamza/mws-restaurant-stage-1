/*global __dirname :true*/
/*=========== external ===========*/
const
  gulp = require('gulp'),
  // used to version static files
  rev = require('gulp-rev'),
  // used to delete folders and files
  rimraf = require('rimraf'),
  // used to lint code for syntax errors
  eslint = require('gulp-eslint'),
  // used to rename files
  rename = require('gulp-rename'),
  // used to combine a set of defined files into one big file
  concat = require('gulp-concat'),
  // used to replace string
  replace = require('gulp-replace'),
  // used to minify css
  cleanCSS = require('gulp-clean-css'),
  // used to generate source map
  sourcemaps = require('gulp-sourcemaps'),
  // used to generate/optimize images
  responsive = require('gulp-responsive'),
  // used to replace filename occurences with their fingerprinted counterparts
  revRewrite = require('gulp-rev-rewrite'),
  // used to run webpack as a stream to use with gulp
  webpack = require('webpack-stream'),
  // used to autoprefix css
  autoprefixer = require('gulp-autoprefixer'),
  // used to delete original file after revision (adding fingerprint)
  revDelete = require('gulp-rev-delete-original'),
  // used to do live editing in the browser
  browserSync = require('browser-sync').create();
/*=========== internal ===========*/
// config contains all file build paths, image sizes and all
const config = require('./config');
const pkg = require('./package.json');
const path = require('path');

/******************
    Styles tasks
******************/

gulp.task('styles', () => {
  return gulp.src(config.styles.src)
    .pipe(
      autoprefixer({
        browsers: ['last 2 versions']
      })
    )
    .pipe(concat('styles.css'))
    .pipe(gulp.dest(config.styles.dest))
    .pipe(browserSync.stream());
});

gulp.task('build:styles', () => {
  return gulp.src(config.styles.src)
    .pipe(sourcemaps.init())
    // auto prefexing
    .pipe(
      autoprefixer({
        browsers: ['last 2 versions']
      })
    )
    .pipe(concat('styles.css'))
    .pipe(cleanCSS())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(config.styles.dest));
});


/******************
    Linting tasks
******************/

gulp.task('lint', () => {
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
const bundleScripts = (mode = 'production') => {
  return () => {
    return gulp.src(config.js.main.entry)
      .pipe(webpack(
        Object.assign({}, {
          entry : {
            inside: path.join(__dirname, config.js.inside.entry),
            main: path.join(__dirname, config.js.main.entry)
          },
          mode
        }, config.webpack)))
      .pipe(gulp.dest(config.js.dest));
  };
};

gulp.task('scripts', bundleScripts('development'));
gulp.task('build:scripts', bundleScripts());
/*======= service worker =======*/


gulp.task('sw-rev', () => {
  return gulp.src(config.sw.src)
    .pipe(replace('<<-!version->>', pkg.version))
    .pipe(gulp.dest(config.sw.dest));
});

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
const getResponsiveConfig = (widths, ext = 'jpg') => {
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
};

/**
 * generates images for given widths
 */
gulp.task('optimize-images', () => {
  return gulp.src(config.imgs.src)
    .pipe(responsive(
      getResponsiveConfig(config.imgs.widths)
    ))
    .pipe(gulp.dest(config.imgs.dest));
});

gulp.task('copy-images', () => {
  return gulp.src(config.imgs.offline.src)
    .pipe(gulp.dest(config.imgs.offline.dest));
});

gulp.task('build:images', gulp.parallel('copy-images', 'optimize-images'));

/******************
    Copy tasks
******************/

gulp.task('copy-data', () => {
  return gulp.src(config.data.src)
    .pipe(gulp.dest(config.data.dest));
});

gulp.task('copy-html', () => {
  return gulp.src(config.html.src)
    .pipe(gulp.dest(config.html.dest));
});


/**
 * add fingerprint to all files specified in globs arrays
 * @param {Array.<Objects>} globs - array of objects with options for gulp.src and gulp.dest
 * @returns an array of task functions
 */
const revisionTasks = globs => {
  return globs.map( glob => () => {
    console.log('revision');
    return gulp.src(`${glob.opt.dest}/*.${glob.ext}?(.map)`)
      .pipe(rev())
      .pipe(revDelete()) // Remove the unrevved files
      .pipe(gulp.dest(glob.opt.dest))
      .pipe(rename({
        dirname: glob.opt.revDest
      }))
      .pipe(rev.manifest(config.revManifest.path, {
        base: config.revManifest.dest,
        merge: true
      }))
      .pipe(gulp.dest(config.destBase));
  });
};

gulp.task('revision', gulp.series(
  gulp.parallel('build:styles', 'build:scripts'),
  gulp.parallel(...revisionTasks([
    {opt: config.js, ext: 'js'},
    {opt: config.styles, ext: 'css'}
  ]))
));

/**
 * since Source Mapping URL is relative
 * we only keep the filename. e.g.
 * return 'styles.css.map' instead of 'assets/css/styles.css.map'
 * =======================================================
 * also, for modules the import statement must either have a
 * absolute '/assets/.../*.mjs' or relative './*.mjs' paths,
 * in this case relative, so we return './*.mjs'
 */
const replacePath = (filename, vynil) => {
  if (filename.endsWith('.map')) {
    return filename.slice(filename.lastIndexOf('/')+1);
  }
  if((filename.endsWith('.mjs') && vynil.path.endsWith('.mjs'))) {
    return './' + filename.slice(filename.lastIndexOf('/')+1);
  }
  return filename;
};


/**
 *
 * Replaces occurences of file paths with their
 * fingerprinted counterparts from the rev-manifest.json.
 * @param {Array.<Objects>} globs - array of objects with options for gulp.src and gulp.dest
 * @returns an array of task functions
 */
const revReplaceTasks = globs => {
  return globs.map( glob => () => {
    const manifest = gulp.src(config.revManifest.path);
    return gulp.src(`${glob.dest}/*.${glob.ext}?(.map)`)
      .pipe(revRewrite({
        replaceInExtensions: ['.js', '.css', '.html', '.mjs'],
        manifest: manifest,
        modifyUnreved: replacePath,
        modifyReved: replacePath
      }))
      .pipe(gulp.dest(glob.dest));
  });
};

gulp.task('rev-rewrite', gulp.series(
  'revision',
  gulp.parallel(...revReplaceTasks([
    {dest: config.html.dest, ext: 'html'},
    {dest: config.styles.dest, ext: 'css'},
    {dest: config.js.dest, ext: 'js'}
  ]))
));

/******************
    dev task
******************/

gulp.task('live-editing', done => {
  gulp.watch(config.styles.src, gulp.parallel('styles'));
  gulp.watch(config.lint.src, gulp.parallel('lint'));
  gulp.watch('src/js/**/*.js', gulp.parallel('scripts'));
  // listening for changes in the html file
  // and reloading browserSync on changes
  gulp.watch(config.html.src)
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

gulp.task('build', gulp.series(
  cb => {
    rimraf(config.destBase, cb);
  },
  gulp.parallel(
    'copy-html',
    // linting before running any tasks on scripts
    gulp.series('lint', 'rev-rewrite'),
    'sw-rev',
    'build:images',
    'copy-data'
  )
));

/******************
    default task
******************/

exports.default = gulp.series(
  function (cb) {
    rimraf(config.destBase, cb);
  },
  gulp.parallel(
    'copy-html',
    'build:images',
    'styles',
    'copy-data',
    gulp.series(
      'lint',
      'scripts'
    )
  ),
  'live-editing'
);