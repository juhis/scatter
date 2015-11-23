# scatter
Fast 3D visualization of large, high-dimensional datasets in the browser

Made with [three.js](http://threejs.org), WebGL, [React](https://facebook.github.io/react) and [restify](https://github.com/restify/node-restify).

* [Running](#running)
* [Developing](#developing)
* [Hotkeys](#hotkeys)
* [Screenshot](#screenshot)

### <a name="running"></a> Running

1. Clone or download the repository
2. Start the web server:

   ```
   npm install
   npm start
   ```
   
   Or, if you don't have node installed:
   
   ````
   python -m SimpleHTTPServer
   ````
3. Open localhost:8080 in a browser
4. See config/data.js to use your own dataset and config/config.js for other configuration

### <a name="developing"></a> Developing

1. Install required npm packages:

   ```
   npm install
   ```

2. Make a build each time a source file changes:

   ```
   npm run build:watch
   ```

   Or, to make a single build:
   
   ```
   npm run build
   ```

### <a name="hotkeys"></a> Hotkeys

| Key   | Behavior                 |
| ----- | ------------------------ |
| f     | toggle fps meter         |
| g     | toggle grid              |
| h     | toggle control panel     |
| l     | toggle projection labels |
| m     | toggle mouse tracking    |
| p     | toggle projections       |
| r     | toggle rotation          |
| x     | toggle axes              |

### <a name="screenshot"></a> Screenshot

![screenshot](https://raw.githubusercontent.com/juhis/scatter/master/assets/images/screenshot.png)
