/*global process:true*/
const dotenv = require('dotenv');
dotenv.config();
/**
 * abstracting away configuration for every task
 * so that we don't have to change every occurence
 * of that path when we we need to
 */
module.exports = {
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
      src: ['src/img/offline.png'],
      dest: 'app/assets'
    }
  },
  data: {
    src: 'src/data/*.json',
    dest: 'app/assets/data'
  },
  revManifest: {
    dest: 'app/',
    path: 'app/rev-manifest.json'
  },
  webpack: {
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
  },
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