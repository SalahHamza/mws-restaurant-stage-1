/*=========== external ===========*/
const gulp = require('gulp');
// used to version static files
const rev = require('gulp-rev');
// used to delete folders and files
const rimraf = require('rimraf');
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
// used to replace filename occurences with their fingerprinted counterparts
const revRewrite = require('gulp-rev-rewrite');
// used to minify .js files (compatible with es6)
const uglify = require('gulp-uglify-es').default;
// used to autoprefix css
const autoprefixer = require('gulp-autoprefixer');
// used to delete original file after revision (adding fingerprint)
const revDelete = require('gulp-rev-delete-original');
// used to do live editing in the browser
const browserSync = require('browser-sync').create();
/*=========== internal ===========*/
// config contains all file build paths, image sizes and all
const config = require('./config');


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
    .pipe(cleanCSS({debug: true}, (details) => {
      console.log(`${details.name}: ${details.stats.originalSize}`);
      console.log(`${details.name}: ${details.stats.minifiedSize}`);
    }))
    .pipe(gulp.dest(config.styles.dest))
    .pipe(sourcemaps.write())
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

/*======= bundled scripts =======*/

/**
 * concat scripts and transpile to es5
 */
const concatScript = (details, dest) => {
  return () => gulp.src(details.src)
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(concat(details.fileName))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(dest));
};

gulp.task('js-scripts', gulp.parallel(
  concatScript(config.js.main, config.js.dest),
  concatScript(config.js.inside, config.js.dest)
));


/**
 * concat, uglify and transpile (to es5) scripts
 */
const concatAndUglifyScript = (details, dest) => {
  return () => gulp.src(details.src)
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(concat({path: details.fileName, cwd: ''}))
    .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(dest));
};

/**
 * the two tasks were run in series because
 * there was a conflict when writing to
 * rev-manifest.json file
 */
gulp.task('build:js-scripts', gulp.series(
  concatAndUglifyScript(config.js.main, config.js.dest),
  concatAndUglifyScript(config.js.inside, config.js.dest)
));


/*======= modules =======*/

gulp.task('mjs-scripts', () => {
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

gulp.task('build:mjs-scripts', () => {
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
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write('.', {
      mapFile(mapFilePath) {
        // source map files are named *.mjs.map instead of *.js.map
        return mapFilePath.replace('.js.map', '.mjs.map');
      },
      sourceMappingURL(file) {
        return file.relative.replace('.js', '.mjs') + '.map';
      }
    }))
    .pipe(rename( filePath => {
      if(filePath.extname === '.js') {
        filePath.extname = '.mjs';
      }
    }))
    .pipe(gulp.dest(config.mjs.dest));
});

/*======= service worker =======*/


gulp.task('sw-rev', () => {
  return gulp.src(config.sw.src)
    .pipe(gulp.dest(config.sw.dest));
});

/*======= scripts =======*/

gulp.task('scripts', gulp.parallel('js-scripts', 'mjs-scripts'));

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
    {opt: config.mjs, ext: 'mjs'},
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
    {dest: config.js.dest, ext: 'js'},
    {dest: config.mjs.dest, ext: 'mjs'}
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
    'optimize-images',
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
    'optimize-images',
    'styles',
    'copy-data',
    gulp.series(
      'lint',
      'scripts'
    )
  ),
  'live-editing'
);