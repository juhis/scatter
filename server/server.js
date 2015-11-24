'use strict'

var restify = require('restify')
var fs = require('fs')
var config = require('../config/server.js')

var port = config.port || 8080
if (process.argv.length > 2) {
    port = +process.argv[2]
}

var rootDir = process.cwd().substring(__dirname.length - 6) === 'server' ? '../' : './'
console.log('serving from %s', rootDir)

// create dir for png uploads if necessary
var uploadDir = rootDir + '/server/uploads'
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir)
    console.log('directory created: /server/uploads')
} else {
    console.log('directory already created: /server/uploads')
}

var server = restify.createServer({
    name: 'scatter-server',
    version: '0.0.0'
})
server.use(restify.acceptParser(server.acceptable))
server.use(restify.queryParser())
server.use(restify.bodyParser())

// serve all static files under root
console.log(__dirname)
server.get(/\/.*/, restify.serveStatic({
    directory: __dirname + '/../', // using rootDir here gives 403
    default: 'index.html'
}))

// handle png uploads
server.post('/upload', function (req, res, next) {

    console.log(getTime(), 'upload', req.body.id, req.body.frame, req.body.png.length)
    
    if (req.body.id == undefined || req.body.frame == undefined || req.body.png == undefined) {
	return next(new restify.BadRequestError())
    }
    
    if (req.body.frame === 0) { // receiving the first frame: create directory for a new image sequence
	fs.mkdir(uploadDir + '/' + req.body.id, function(err) {
	    if (err && err.code !== 'EEXIST') {
		console.error(err)
		return next(new restify.InternalServerError())
	    } else {
		saveImage(req.body.id, req.body.frame, req.body.png,
			  function(err) {
			      if (err) {
				  console.error(err)
				  return next(new restify.InternalServerError())
			      } else {
				  res.end()
				  return next()
			      }
			  })
	    }
	})
    } else {
	saveImage(req.body.id, req.body.frame, req.body.png,
			  function(err) {
			      if (err) {
				  console.error(err)
				  return next(new restify.InternalServerError())
			      } else {
				  res.end()
				  return next()
			      }
			  })
    }
})

server.on('error', function(err) {
    console.error('Cannot start server:')
    console.error(err)
})

server.listen(port, function () {
    console.log('%s listening at %s', server.name, server.url)
    console.log('open http://localhost:%d in your browser (Chrome recommended for speed)', port)
})

function saveImage(id, frame, png, callback) {
    var imageData = png.replace(/^data:image\/png;base64,/, '')
    fs.writeFile(uploadDir + '/' + id + '/frame_' + pad(frame, 5) + '.png',
		 imageData,
		 'base64',
		 callback)
}

function pad(n, width, z) {
    z = z || '0'
    n = n + ''
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n
}

function getTime() {
    var date = new Date()
    var millisecond = pad(date.getMilliseconds(), 3)
    var second = pad(date.getSeconds(), 2)
    var minute = pad(date.getMinutes(), 2)
    var hour = pad(date.getHours(), 2)
    var day = pad(date.getDate(), 2)
    var month = pad(date.getMonth(), 2)
    var year = date.getFullYear()
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second + ':' + millisecond
}
