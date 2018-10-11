/*global __dirname process:true*/

const
  path = require('path'),
  yargs = require('yargs'),
  express = require('express'),
  compression = require('compression');

const app = express();
// enabling text based responses compression
app.use(compression());


// setting views engine
app.set('views', path.join(__dirname, '../app'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

/**
 * requiring and using routes
 */
app.use(require('./routes'));

const argv = yargs.options({
  'port': {
    describe: 'server port',
    default: 3000,
    type: 'number'
  },
  'protocol': {
    describe: 'protocol to serve with',
    default: 'h1',
    type: 'string'
  }
}).argv;

console.log(argv);

if(argv.protocol === 'h2') {
  require('./http2_server')(app, argv.port);
} else {
  const server = app.listen(argv.port, (err) => {
    if(err) {
      console.error(err);
      return process.exit(1);
    }
    console.log(`Listening on port ${server.address().port}`);
  });
}
