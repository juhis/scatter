# scatter
Fast 3D visualization of large, high-dimensional datasets in the browser

![screenshot](https://raw.githubusercontent.com/juhis/scatter/master/assets/images/screenshot2.png)

Made with [three.js](http://threejs.org), WebGL, [React](https://facebook.github.io/react) and [restify](https://github.com/restify/node-restify).

* [Running](#running)
* [Developing](#developing)
* [Hotkeys](#hotkeys)

### <a name="running"></a> Running

1.    Clone the repository:

      ```
      git clone https://github.com/juhis/scatter.git
      ```

      or download the zip file from GitHub and unzip

2.1   To run with the example data:

      ```
      cd scatter
      python -m SimpleHTTPServer 8080
      ```
      
      Any other web server will also do
   
2.2   Or, to run with Node (this is needed when using your own data):

      ```
      cd scatter
      npm install
      npm start
      ```
      
      Node (including npm) can be downloaded [here](https://nodejs.org/en/download)

3. Open [http://localhost:8080](http://localhost:8080) in a browser (Chrome is the fastest one)

See config/data.js to use your own dataset and config/config.js for other configuration

If you have issues or suggestions, please e-mail me at juha dot karjalainen at iki dot fi and I'll see what I can do

### <a name="developing"></a> Developing

1. Install required npm packages:

   ```
   npm install
   ```

2. Start the web server:

   ```
   npm start [port_number]
   ```

3. Make a build each time a source file changes:

   ```
   npm run build:watch
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
