/*global process __dirname:true*/
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

/**
 * abstracting away configuration for every task
 * so that we don't have to change every occurence
 * of that path when we we need to
 */
const globsAndPaths = {
  // globs and paths start
  destBase: 'app/',
  styles: {
    src: ['src/css/styles.css', 'node_modules/@salahhamza/snackbars/lib/snackbar.css'],
    dest: 'app/assets/css',
    revDest: 'assets/css'
  },
  js: {
    main: {
      entry: 'src/js/main.js',
      fileName: 'main.js'
    },
    inside: {
      entry: 'src/js/restaurant_info.js',
      fileName: 'inside.js'
    },
    dest: 'app/assets/js',
    revDest: 'assets/js'
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
    src: ['src/img/**', '!src/img/offline.png', '!src/img/rating.png'],
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
    /* the offline fallback for images */
    offline: {
      src: 'src/img/offline.png',
      dest: 'app/assets'
    },
    /* the icons used in the pwa and as favicon */
    icons: {
      src: 'src/img/rating.png',
      // specifying the full relative path because
      // icons will be handled by webpack stream directly
      dest: 'assets/img/icons',
      sizes: [192, 512],
      // return the link tag to reference to inject in html
      tag(size = 192) {
        if(!this.sizes.includes(size)) throw new Error('Icon is not generated for this size');

        const sizeString = `${size}x${size}`;
        return `<link rel="shortcut icon"
          sizes="${sizeString}"
          href="${path.join(this.dest, `icon_${sizeString}.png`)}">`;
      },
      // return the icon paths to cache in the service worker
      toCache() {
        return this.sizes
          .map(size => path.join(this.dest, `icon_${size}x${size}.png`));
      }
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

/* =========== webpack config: start =========== */

const webpackConfig = {
  entry : {
    inside: path.join(__dirname, globsAndPaths.js.inside.entry),
    main: path.join(__dirname, globsAndPaths.js.main.entry)
  },
  output: {
    filename: '[name].js'
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                useBuiltIns: 'entry'
              }]
            ]
          }
        }
      }
    ]
  }
};


/* =========== webpack config: end =========== */


const other = {
  toCache: [
    './assets/js/inside.js',
    './assets/js/main.js',
    './assets/css/styles.css'
  ],
  port: process.env.PORT || 3000,
  mapboxKey: process.env.MAPBOX_TOKEN,
  get devURL() {
    return `localhost:${this.port}`;
  }
};

module.exports = Object.assign(globsAndPaths, { webpack: webpackConfig }, other);