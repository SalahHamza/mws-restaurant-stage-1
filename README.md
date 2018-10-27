# MWS Restaurant Reviews

Restaurant Reviews project is a capstone project in the Mobile Web Specialist program provided by Udacity.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development.

### Prerequisites

You first need a copy of the code in your local machine, make sure to fork and clone, you can clone by running this command.

Create a directory where the app resides (name it whatever you'd like)
```
mkdir restaurant-app && cd restaurant-app
```

Clone the app
```
git clone https://github.com/SalahHamza/mws-restaurant-stage-1.git
```

and the dev server
```
git clone https://github.com/SalahHamza/mws-restaurant-stage-2.git
```

### Installing

#### Install dependencies

To get up and running all you need to do is install the dependencies for both client side of the app and dev server.

Go to each directory and run:
```
npm install
```

or you can do that from the directory you created like this:
```
$ (cd mws-restaurant-stage-1 && npm install)
$ (cd mws-restaurant-stage-2 && npm install)
```
**Note**: the parentheses denotes a subshell.

#### Run task runner

After that make sure to run Gulp in order to generate the needed assests (stylesheets, images, js, ...etc).

Run the build task to generate files for production

```
gulp build
```

Run the default task to generate files + live editing (with browser-sync):

```
gulp
```

Note: browsersync is used with proxy, so make sure to spin up the server.

**Note**: Make sure you run the tasks in the root directory or run the command with parentheses.

#### Start servers

Spin up the dev server, make sure you are in the `mws-restaurant-stage-2/` directory:

```
$ cd mws-restaurant-stage-2/
$ node app.js
```
or just do it from the root directory of the project:
```
(cd mws-restaurant-stage-2 && node app.js)
```

And client side server. Remember you need to be within the `mws-restaurant-stage-1/` directory:
```
npm run serve
```
or
```
(cd mws-restaurant-stage-1 && npm run serve)
```

**Note**:
You can serve with http/2.
```
npm run serve -- --protocol=h2
```
But you first need to have a SSL cert, but you can just make a self-signed SSL cert. Follow this link to know [how to make a self-signed cert](https://webapplog.com/http2-node/) and other details, or (unfortunately) the http/2 server won't work.
Also, service worker will not register with a self-signed, if you want to do so check this [stackover thread](https://stackoverflow.com/questions/38728176/can-you-use-a-service-worker-with-a-self-signed-certificate)

## Running the tests

No tests available.

## Built With

* [npm](https://npmjs.com) - Dependency Management
* [https://gulpjs.com/](Gulp) - Used task runner
* [https://babeljs.io/](Babel) - Used to compile ES2015 to ES5
* Rating icon from [Freepik](http://www.freepik.com) is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/).

## Code Owners

* [@forbiddenvoid](https://github.com/udacity/mws-restaurant-stage-1/commits?author=forbiddenvoid)
* @hbkwong

## License

No license.

## Acknowledgments

* Thanks to ALC and Udacity for giving us the chance to learn new things
* Thanks to instructors and reviewers for being helpful and patient with us