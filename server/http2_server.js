/*global __dirname process:true*/
const
  fs = require('fs'),
  path = require('path'),
  spdy = require('spdy');

/**********************************
            spdy setup
**********************************/

const spdyOptions = {
  key: fs.readFileSync(path.join(__dirname, '/../server.key')),
  cert:  fs.readFileSync(path.join(__dirname, '/../server.crt'))
};

const http2Server = (app, port) => {
  const server = spdy.createServer(spdyOptions, app);

  server.listen(port, (error) => {
    if (error) {
      console.error(error);
      return process.exit(1);
    }
    console.log(`Listening on port ${server.address().port}`);
  });

};

module.exports = http2Server;

// based on: https://webapplog.com/http2-node/
