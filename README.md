# scatter
Fast 3D visualization of large, high-dimensional datasets

Made with [three.js](http://threejs.org), WebGL, [React](https://facebook.github.io/react) and [restify](https://github.com/restify/node-restify).

To run:

1. Clone or download the repository
2. Start a web server
  * node server/server.js
  * If you don't have node installed, any web server will do (animations cannot be saved without the node server, though): python -m SimpleHTTPServer

To develop:

1. Install required npm packages:
  * npm install
2. Install watchify for bundling the files:
  * [sudo] npm install -g watchify
3. Run watchify to recreate the bundle file each time a source file changes:
  * watchify -t reactify -v -o build/bundle.js assets/jsx/App.js

See configuration in config/config.js

![screenshot](https://raw.githubusercontent.com/juhis/scatter/master/assets/images/screenshot.png)
