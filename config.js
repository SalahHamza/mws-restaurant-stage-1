/*global process __dirname:true*/
const path = require('path');
const dotenv = require('dotenv');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
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
  },
  blank: {
    src: './src/js/blank.js',
    filename: 'app/blank.js'
  }
};

/* =========== webpack config: start =========== */

// webpack configuration object for script bundling
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

// pwa manifest.json config object
const manifestConfig = {
  filename: './manifest.json',
  fingerprints: false,
  name: 'Restaurant Reviews',
  short_name: 'RR',
  description: 'Restaurant Reviews Progressive Web App',
  background_color: '#252831',
  theme_color: '#252831',
  icons: [
    {
      src: path.resolve(globsAndPaths.imgs.icons.src),
      sizes: globsAndPaths.imgs.icons.sizes, // multiple sizes
      destination: path.join(globsAndPaths.imgs.icons.dest),
    }
  ],
  includeDirectory: false,
  inject: true
};

// configration for the HtmlWebpackPlugin
const htmlPluginConfig = {
  // excluding this chunck so that the plugin
  // doesn't inject a script tag for it
  excludeChunks: ['blank'],
  meta: {
    description: manifestConfig.description
  },
  // a custome template parameter to inject
  // the <link> tag for the icon
  relIcon: globsAndPaths.imgs.icons.tag()
};

const webpackPWAConfig = {
  // since webpack doesn't run without entry point
  // we are specifing the index.js as an entry point
  // but it will be overwritten later when the
  // sw-rev task runs
  entry: {
    blank: globsAndPaths.blank.src
  },
  output: {
    filename: '[name].js'
  },
  plugins: [
    // running the plugin for both .html files
    new HtmlWebpackPlugin(Object.assign(htmlPluginConfig, {
      template: 'src/templates/index.html',
      filename: 'index.html',
    })),
    new HtmlWebpackPlugin(Object.assign(htmlPluginConfig, {
      template: 'src/templates/restaurant.html',
      filename: 'restaurant.html',
    })),
    new WebpackPwaManifest(manifestConfig)
  ],
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

module.exports = Object.assign(globsAndPaths, {
  webpack: webpackConfig,
  webpackPWA: webpackPWAConfig
}, other);