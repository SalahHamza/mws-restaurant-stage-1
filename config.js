/**
 * abstracting away configuration for every task
 * so that we don't have to change every occurence
 * of that path when we we need to
 */
module.exports = {
  destBase: 'app/',
  styles: {
    src: 'src/css/**/*.css',
    dest: 'app/assets/css',
    revDest: 'assets/css'
  },
  js: {
    main: {
      src: [
        'src/js/dbhelper.js',
        'src/js/main.js',
        '!node_modules/**'
      ],
      fileName: 'main.js'
    },
    inside: {
      src: [
        'src/js/dbhelper.js',
        'src/js/restaurant_info.js',
        '!node_modules/**'
      ],
      fileName: 'inside.js'
    },
    dest: 'app/assets/js/bundles',
    revDest: 'assets/js/bundles',
  },
  mjs: {
    src: ['src/js/**/*.js', '!src/js/sw.js' ,'!node_modules/**'],
    dest: 'app/assets/js/modules',
    revDest: 'assets/js/modules'
  },
  sw: {
    src: 'src/js/sw.js',
    dest: 'app'
  },
  html: {
    src: 'src/templates/*.html',
    dest: 'app'
  },
  lint: {
    // linting files with both .js and .mjs extensions
    src: ['src/js/**/*.js','!node_modules/**']
  },
  imgs: {
    src: ['src/img/**', '!src/img/offline.png'],
    dest: 'app/assets/img',
    revDest: 'assets/img',
    // widths to generate images
    // if src_image_width > generated_img_width
    // set object with value=width
    // and enlarge=true
    widths: [
      300,
      400,
      500,
      600,
      800,
      {value: 1000, enlarge: true},
      {value: 1200, enlarge: true}
    ],
    offline: {
      src: ['!src/img/offline.png'],
      dest: 'app/'
    }
  },
  data: {
    src: 'src/data/*.json',
    dest: 'app/assets/data'
  },
  revManifest: {
    dest: 'app/',
    path: 'app/rev-manifest.json'
  }
};