'use strict'

var async = require('async')
var superagent = require('superagent')
var config = require('../../config/config.js')

var react
var scene, renderer
var camera, projectionCameras, cameraControls
var isAnimating = false, isRecording = false, animationId, savedFrames = []
var targetHSL = {h: config.hueAnnotated, s: config.saturationAnnotated, l: 1}
var targetPointSize = {size: config.defaultPointSize}
var prevTargetHSL = {h: config.hueAnnotated, s: config.saturationAnnotated, l: 0.5}
var prevTargetPointSize = {size: config.defaultPointSizeAnnotated}

var effectController, stats
var attributes, uniforms, shaderMaterial

var scale = 10
var colorAnnotated = new THREE.Color().setHSL(config.hueAnnotated, config.saturationAnnotated, config.lightnessAnnotated)
var colorNotAnnotated = new THREE.Color().setHSL(config.hueNotAnnotated, config.saturationNotAnnotated, config.lightnessNotAnnotated)

var pointCloud, axes, labels
var destinations = [], annotations = [], prevAnnotations = [], annotationType = null, customValue = []
var clock = new THREE.Clock()

function printPerformance() {

    if (!window.performance) return
    
    var items = window.performance.getEntriesByType('measure')
    for (var i = 0; i < items.length; i++) {
        console.log(items[i].duration + 'ms: ' + items[i].name)
    }
}

function drawTexts() {

    labels = new THREE.Object3D()
    var geo, text
    var mat = new THREE.MeshBasicMaterial({color: 0xffffff})
    var textSize = 0.1 * scale

    // XY plane
    geo = new THREE.TextGeometry('X', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.position.set(textSize / 2, -1.5 * textSize, -1000 * scale)
    labels.add(text)
    geo = new THREE.TextGeometry('Y', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.position.set(-1.2 * textSize, textSize / 2, -1000 * scale)
    labels.add(text)

    // XZ plane
    geo = new THREE.TextGeometry('X', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.x = Math.PI / 2
    text.position.set(textSize / 2, -1000 * scale, -1.5 * textSize)
    labels.add(text)
    geo = new THREE.TextGeometry('Z', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.x = Math.PI / 2
    text.position.set(-1.2 * textSize, -1000 * scale, textSize / 2)
    labels.add(text)

    // YZ plane
    geo = new THREE.TextGeometry('Y', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.rotation.y = Math.PI / 2
    text.position.set(-1000 * scale, -1.2 * textSize, textSize / 2)
    labels.add(text)
    geo = new THREE.TextGeometry('Z', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.rotation.y = Math.PI / 2
    text.position.set(-1000 * scale, textSize / 2, -1.5 * textSize)
    labels.add(text)

    scene.add(labels)
}

function drawAxes() {

    axes = new THREE.Object3D()
    var axisLength = scale / 4
    var axisThickness = scale / 50
    var axisThickness1 = scale / 500
    var mat, geo, axis
    
    mat = new THREE.MeshBasicMaterial({color: 0x000000})
    geo = new THREE.SphereGeometry(axisThickness, 32, 32)
    var sphere = new THREE.Mesh(geo, mat)
    axes.add(sphere)

    // X
    mat = new THREE.MeshBasicMaterial({color: 0xff3c00})
    geo = new THREE.CylinderGeometry(axisThickness, axisThickness1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.z = Math.PI / 2
    axis.position.x = axisLength / 2
    axes.add(axis)
    mat = new THREE.MeshBasicMaterial({color: 0xff3c00})
    geo = new THREE.CylinderGeometry(axisThickness, axisThickness1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.z = -Math.PI / 2
    axis.position.x = -axisLength / 2
    axes.add(axis)

    // Y
    mat = new THREE.MeshBasicMaterial({color: 0xa0d200})
    geo = new THREE.CylinderGeometry(axisThickness, axisThickness1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.z = Math.PI
    axis.position.y = axisLength / 2
    axes.add(axis)
    mat = new THREE.MeshBasicMaterial({color: 0xa0d200})
    geo = new THREE.CylinderGeometry(axisThickness, axisThickness1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.position.y = -axisLength / 2
    axes.add(axis)

    // Z
    mat = new THREE.MeshBasicMaterial({color: 0x00a0d2})
    geo = new THREE.CylinderGeometry(axisThickness, axisThickness1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.x = -Math.PI / 2
    axis.position.z = axisLength / 2
    axes.add(axis)
    mat = new THREE.MeshBasicMaterial({color: 0x00a0d2})
    geo = new THREE.CylinderGeometry(axisThickness, axisThickness1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.x = Math.PI / 2
    axis.position.z = -axisLength / 2
    axes.add(axis)

    scene.add(axes)
}

function fillScene(dataX, dataY, dataZ) {

    var dotColors = [
        new THREE.Color().setHSL(0.2, 0.8, 0.8),
        new THREE.Color().setHSL(0.4, 0.8, 0.8),
        new THREE.Color().setHSL(0.7, 0.8, 0.8),
    ]

    var geometry = new THREE.Geometry()
    geometry.colors = []
    for (var i = 0; i < dataX.length; i++) {
	var vertex = new THREE.Vector3()
        vertex.x = 2 * scale * (dataX[i] / 65535 - 0.5)
        vertex.y = 2 * scale * (dataY[i] / 65535 - 0.5)
        vertex.z = 2 * scale * (dataZ[i] / 65535 - 0.5)
	geometry.vertices.push(vertex)
        attributes.size.value.push(config.defaultPointSize)
        attributes.customColor.value.push(colorNotAnnotated)
        customValue.push(1)
    }
    
    pointCloud = new THREE.PointCloud(geometry, shaderMaterial)
    scene.add(pointCloud)

}

function init(width, height) {

    width = width || window.innerWidth
    height = height || window.innerHeight
    
    scene = new THREE.Scene()

    // RENDERER
    renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true})
    renderer.gammaInput = true
    renderer.gammaOutput = true
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    renderer.autoClear = false

    // CAMERAS
    
    camera = new THREE.PerspectiveCamera(45, width / (2/3 * height), 2, 100 * scale)
    camera.position.set(3 * scale, 3 * scale, 3 * scale)

    projectionCameras = []
    var aspectRatio = width > height ? width / height : height / width
    for (var i = 0; i < 3; i++) {
        var cam = new THREE.OrthographicCamera(
                -1.2 * aspectRatio * scale, 1.2 * aspectRatio * scale, // lr
            1.2 * aspectRatio * scale / (width / height), -1.2 * aspectRatio * scale / (width / height), // tb
                -aspectRatio * scale * 2000, aspectRatio * scale * 2000 // nf
        )
        if (i === 0) {
            cam.up.set(0, 1, 0)
        }
        if (i === 1) {
            cam.up.set(0, 0, 1)
        }
        if (i === 2) {
            cam.up.set(0, 0, 1)
        }
        projectionCameras.push(cam)
    }
    
    // CONTROLS
    cameraControls = new THREE.OrbitControls(camera, renderer.domElement)
    cameraControls.noPan = true
    cameraControls.target.set(0,0,0)

    // SHADING
    attributes = {
        size: {type: 'f', value: []},
        customColor: {type: 'c', value: []},
    }
    uniforms = {
        color: {type: 'c', value: new THREE.Color(0xffffff)},
        opacity: {type: 'f', value: 0.5}
    }
    
    var vertexShader = 'attribute float size;' +
        'attribute vec3 customColor;' +
        'varying vec3 vColor;' +
        'void main() {' +
        'vColor = customColor;' +
        'vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );' +
        'gl_PointSize = size;' +
        'gl_Position = projectionMatrix * mvPosition;' +
        '}'

    var fragmentShader = 'uniform vec3 color;' +
        'uniform float opacity;' +
        'varying vec3 vColor;' +
        'void main() {' +
        'gl_FragColor = vec4( color * vColor, opacity );' +
        '}'
    
    shaderMaterial = new THREE.ShaderMaterial({
        uniforms:       uniforms,
        attributes:     attributes,
        vertexShader:   vertexShader,
        fragmentShader: fragmentShader,
        transparent:    true,
        depthTest:      false,
        blending:       THREE.NormalBlending,
    })
}

function setupGUI() {
    
    effectController = {
        pointSize: config.defaultPointSize,
        pointSizeAnnotated: config.defaultPointSizeAnnotated,
        hueAnnotated: colorAnnotated.getHSL().h,
        saturationAnnotated: colorAnnotated.getHSL().s,
        lightnessAnnotated: colorAnnotated.getHSL().l,
        hueNotAnnotated: colorNotAnnotated.getHSL().h,
        saturationNotAnnotated: colorNotAnnotated.getHSL().s,
        lightnessNotAnnotated: colorNotAnnotated.getHSL().l,
        opacity: config.defaultOpacity,
        transitionSpeed: config.defaultTransitionSpeed,
        animationSpeed: config.defaultAnimationSpeed,
	showFPS: false,
	showProjections: false,
        showAxes: false,
        showLabels: false,
        depthTest: false,
        additiveBlending: false,
    }
    
    var gui = new dat.GUI()
    folder = gui.addFolder('Points')
    folder.add(effectController, 'pointSize', 1, 10).name('PointSize')
    folder.add(effectController, 'pointSizeAnnotated', 1, 10).name('PointSizeAnnotated')
    folder.add(effectController, 'opacity', 0, 1).name('Opacity')    
    var folder = gui.addFolder('Colors')
    folder.add(effectController, 'hueAnnotated', 0, 1).name('HueAnnotated')
    folder.add(effectController, 'saturationAnnotated', 0, 1).name('SaturationAnnotated')
    folder.add(effectController, 'lightnessAnnotated', 0, 1).name('LightnessAnnotated')
    folder.add(effectController, 'hueNotAnnotated', 0, 1).name('HueNotAnnotated')
    folder.add(effectController, 'saturationNotAnnotated', 0, 1).name('SaturationNotAnnotated')
    folder.add(effectController, 'lightnessNotAnnotated', 0, 1).name('LightnessNotAnnotated')
    folder = gui.addFolder('Show')
    folder.add(effectController, 'showProjections').name('ShowProjections')
    folder.add(effectController, 'showAxes').name('ShowAxes')
    folder.add(effectController, 'showLabels').name('ShowLabels')
    folder.add(effectController, 'showFPS').name('ShowFPS')
    folder = gui.addFolder('Other')
    folder.add(effectController, 'transitionSpeed', 1, 100).name('TransitionSpeed')
    folder.add(effectController, 'animationSpeed', 1, 100).name('AnimationSpeed')
    folder.add(effectController, 'depthTest').name('DepthTest')
    folder.add(effectController, 'additiveBlending').name('AdditiveBlending')
}

function addToDOM(domElement) {

    var canvas = domElement.getElementsByTagName('canvas')
    if (canvas.length > 0) {
	domElement.removeChild(canvas[0])
    }
    domElement.appendChild(renderer.domElement)

    var w = window.innerWidth - ((document.getElementById('menu') && document.getElementById('menu').offsetWidth) || 100)
    var h = window.innerHeight
    renderer.setSize(w, h)

    stats = new Stats()
    stats.domElement.style.position = 'absolute'
    stats.domElement.style.bottom = '0px'
    stats.domElement.style.right = '0px'
    domElement.appendChild(stats.domElement)
}

function animate() {
    if (isRecording && isAnimating) {
	saveFrame(function() {
	    window.requestAnimationFrame(animate)
	    render()
	})
    } else {
	window.requestAnimationFrame(animate)
	render()
    }
}

function render() {

    // LPT: put TWEEN.update as the first thing in render to avoid jerky movement
    TWEEN.update()

    var delta = clock.getDelta()
    cameraControls.update(delta)
    stats.update()
    
    uniforms.opacity.value = effectController.opacity
    var hsl = colorAnnotated.getHSL()

    if (!isAnimating) {
	colorAnnotated = new THREE.Color().setHSL(effectController.hueAnnotated, effectController.saturationAnnotated, effectController.lightnessAnnotated)
    }
    colorNotAnnotated = new THREE.Color().setHSL(effectController.hueNotAnnotated, effectController.saturationNotAnnotated, effectController.lightnessNotAnnotated)

    var targetHSLColor = new THREE.Color().setHSL(targetHSL.h, targetHSL.s, targetHSL.l)
    var prevTargetHSLColor = new THREE.Color().setHSL(prevTargetHSL.h, prevTargetHSL.s, prevTargetHSL.l)
    for (var i = 0; i < pointCloud.geometry.vertices.length; i++) {

        var v = pointCloud.geometry.vertices[i]
        if (annotations || prevAnnotations) {
            if (annotations && annotationType == 'continuous') {
                var h = hsl.h + customValue[i]
                attributes.customColor.value[i] = new THREE.Color().setHSL(h, hsl.s, hsl.l)
                attributes.size.value[i] = effectController.pointSize
            } else if (annotations && annotations[i] === 1) {
		attributes.customColor.value[i] = isAnimating ? targetHSLColor : colorAnnotated
		attributes.size.value[i] = isAnimating ? targetPointSize.size : effectController.pointSizeAnnotated
            } else if (isAnimating && prevAnnotations && prevAnnotations[i] === 1) {
		attributes.customColor.value[i] = prevTargetHSLColor
		attributes.size.value[i] = prevTargetPointSize.size
	    } else {
                attributes.customColor.value[i] = colorNotAnnotated
                attributes.size.value[i] = effectController.pointSize
            }
        } else {
            attributes.customColor.value[i] = colorNotAnnotated
            attributes.size.value[i] = effectController.pointSize
        }

        if (destinations[i] && destinations[i].x != undefined) {
            var distX = destinations[i].x - v.x
            if (Math.abs(distX) > 0.1) {
                v.x += distX / 1000 * effectController.transitionSpeed * 3
            } else {
                v.x = destinations[i].x
            }
        }
        if (destinations[i] && destinations[i].y != undefined) {
            var distY = destinations[i].y - v.y
            if (Math.abs(distY) > 0.1) {
                v.y += distY / 1000 * effectController.transitionSpeed * 3
            } else {
                v.y = destinations[i].y
            }
        }
        if (destinations[i] && destinations[i].z != undefined) {
            var distZ = destinations[i].z - v.z
            if (Math.abs(distZ) > 0.1) {
                v.z += distZ / 1000 * effectController.transitionSpeed * 3
            } else {
                v.z = destinations[i].z
            }
        }
    }

    pointCloud.geometry.verticesNeedUpdate = true
    attributes.size.needsUpdate = true
    attributes.customColor.needsUpdate = true
    
    shaderMaterial.blending = effectController.additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending
    shaderMaterial.depthTest = effectController.depthTest
    axes.visible = effectController.showAxes
    labels.visible = effectController.showLabels
    stats.domElement.style.visibility = effectController.showFPS ? 'visible' : 'hidden'

    // cameras
    renderer.clear()
    if (effectController.showProjections) {
	for (var i = 0; i < 3; i++) {
            var cam = projectionCameras[i]
            if (i === 1) {
		cam.position.y = -1
            }
            if (i === 2) {
		cam.position.x = 1
            }
            cam.lookAt(cameraControls.target)
            renderer.setViewport(i * 1 / 3 * renderer.domElement.offsetWidth, 0, 1 / 3 * renderer.domElement.offsetWidth, 1 / 3 * renderer.domElement.offsetHeight)
            renderer.render(scene, cam)
	}
	camera.aspect = renderer.domElement.offsetWidth / (2 / 3 * renderer.domElement.offsetHeight)
	camera.updateProjectionMatrix()
	renderer.setViewport(0, 1 / 3 * renderer.domElement.offsetHeight, renderer.domElement.offsetWidth, 2 / 3 * renderer.domElement.offsetHeight)
	renderer.render(scene, camera)
    } else {
	camera.aspect = renderer.domElement.offsetWidth / renderer.domElement.offsetHeight
	camera.updateProjectionMatrix()
	renderer.setViewport(0, 0, renderer.domElement.offsetWidth, renderer.domElement.offsetHeight)
	renderer.render(scene, camera)
    }
}

function startAnimation(splines, tweenPos, tweenAnnotationNames, record) {

    annotations = null
    prevAnnotations= null
    
    var tweenLength = 1500
    var tweenLength2 = 1500
    var tweenTime = []
    var tweens = []
    for (var i = 0; i < splines.length - 1; i++) { // tween along splines, save last one
	tweenTime.push({t: 0})
	var tween = new TWEEN.Tween(tweenTime[i])
	    .to({t: 1}, tweenLength)
	    .easing(TWEEN.Easing.Quadratic.InOut)
	    .onUpdate(function(i) {
		var point = splines[i].getPoint(tweenTime[i].t)
		// if (point.x > -40) {
		camera.position.set(point.x, point.y, point.z)
		// }
	    }.bind(null, i))
	tweens.push(tween)
    }

    var tweenTargetHSL = new TWEEN.Tween(targetHSL)
	.to({l: 0.5}, tweenLength2)
	.easing(TWEEN.Easing.Quadratic.InOut)
	.onComplete(function() {
	    targetHSL.l = 1
	})
    var tweenTargetPointSize = new TWEEN.Tween(targetPointSize)
	.to({size: config.defaultPointSizeAnnotated}, tweenLength2)
	.easing(TWEEN.Easing.Quadratic.InOut)
	.onComplete(function() {
	    targetPointSize.size = config.defaultPointSize
	})
    var tweenPrevTargetHSL = new TWEEN.Tween(prevTargetHSL)
	.to({l: 1}, tweenLength2)
	.easing(TWEEN.Easing.Quadratic.InOut)
	.onComplete(function() {
	    prevTargetHSL.l = 0.5
	})
    var tweenPrevTargetPointSize = new TWEEN.Tween(prevTargetPointSize)
	.to({size: config.defaultPointSize}, tweenLength2)
	.easing(TWEEN.Easing.Quadratic.InOut)
	.onComplete(function() {
	    prevTargetPointSize.size = config.defaultPointSizeAnnotated
	})

    for (var i = 0; i < tweenAnnotationNames.length; i++) {
	tweens.push(new TWEEN.Tween(camera.position)
		    .to(tweenPos[i], tweenLength2)
		    .easing(TWEEN.Easing.Quadratic.InOut)
		    .onStart(function(j) {
			react.setAnnotationByName(tweenAnnotationNames[j])
			tweenTargetHSL.start()
			tweenTargetPointSize.start()
		    }.bind(this, i))
		    .onComplete(function(j) {
			prevAnnotations = annotations && annotations.slice(0)
			annotations = null
			if (j == tweenAnnotationNames.length - 1) {
			    tweenPrevTargetHSL.onComplete(function() {})
			    tweenPrevTargetPointSize.onComplete(function() {})
			}
			tweenPrevTargetHSL.start()
			tweenPrevTargetPointSize.start()
		    }.bind(this, i)))
    }
    
    tweens.push(new TWEEN.Tween({t: 0})
    		.to({t: 1}, tweenLength)
		.onUpdate(function() {
		    var point = splines[splines.length - 1].getPoint(this.t)
		    camera.position.set(point.x, point.y, point.z)
		}))

    for (var i = 0; i < tweens.length; i++) {
	if (i < tweens.length - 1) {
	    tweens[i].chain(tweens[i+1])
	} else {
	    tweens[i]
		.onComplete(function() {
		    isAnimating = false
		    if (isRecording) {
			isRecording = false
			uploadSavedFrames(animationId, function(err) {
			    if (err) {
				window.alert('could not upload png files to server: ' + err)
			    } else {
				window.alert(savedFrames.length + ' png files uploaded to server with name ' + animationId)
				savedFrames = []
			    }
			})
		    }
		})
	}
    }
    tweens[0].start()
    isAnimating = true
    isRecording = record
}

function uploadSavedFrames(id, callback) {
    var numFrame = 0
    async.eachSeries(savedFrames, function(png, cb) {
	superagent
	    .post('/upload')
	    .send({id: id})
	    .send({frame: numFrame++})
	    .send({png: png})
	    .end(function(err, res) {
		if (err) {
		    console.error(err)
		    return cb(err)
		} else {
		    return cb(null)
		}
	    })
    }, callback)
}
    
function saveFrame(callback) {

    var canvas = document.getElementsByTagName('canvas')[0]
    var png = canvas.toDataURL('image/png')
    savedFrames.push(png)
    callback()
}

function showSplines() {

    var splineMat = new THREE.MeshBasicMaterial({
	color: 0xffffff,
	opacity: 0.3,
	wireframe: false,
	transparent: true
    })
    for (var i = 0; i < splines.length; i++) {
	var splineGeo = new THREE.TubeGeometry(splines[i], 1000, 2, 8, false)
	scene.add(new THREE.Mesh(splineGeo, splineMat))
    }
}    

function handleKeypress(e) {

    console.log('key', e.keyCode)

    if (e.keyCode === 97 || e.keyCode === 65) { // 'a'nimate, 'A'nimate and record

	var splines = []
	// zoom out from origo
	splines.push(new THREE.SplineCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-4 * scale, 0, 0)]))

	// rotation around y
	var splinePoints = [new THREE.Vector3(-4 * scale, 0, 0)]
	for (var angle = 0; angle <= 2 * Math.PI; angle += 2 * Math.PI / 16) {
	    splinePoints.push(new THREE.Vector3(-4 * scale * Math.cos(angle), 0, 4 * scale * Math.sin(angle)))
	}
	splines.push(new THREE.SplineCurve3(splinePoints))

	var tweenPos = [
	    {x: -8, y: 25, z: 0},
	    {x: -20, y: -21, z: -21}
	]
	var tweenAnnotations = [
	    'blood',
	    'brain'
	]

	splines.push(new THREE.SplineCurve3([
	    new THREE.Vector3(tweenPos[1].x, tweenPos[1].y, tweenPos[1].z),
	    new THREE.Vector3(-7, 6, 28),
	    new THREE.Vector3(0, 0, 0)
	]))
	
	if (e.keyCode === 65) {
	    animationId = window.prompt('Please enter a name for your animation')
	    if (animationId) {
		startAnimation(splines, tweenPos, tweenAnnotations, true)
	    } else {
		window.alert('A name is needed')
	    }
	} else {
	    startAnimation(splines, tweenPos, tweenAnnotations, false)
	}
    }
    
    if (e.keyCode === 115) { // 's'ave frame
	saveFrame('test')
    }
    
    if (e.keyCode === 99) { // 'c'amera
	console.log(camera.position)
    }
}

var Scatter = {

    initialize: function(domElement, reactClass, width, height, dataX, dataY, dataZ) {

        console.log('initializing scatterplot, data length: ' + dataX.length)
	react = reactClass
        init(width, height)
        drawAxes()
        drawTexts()
        fillScene(dataX, dataY, dataZ)
        addToDOM(domElement)
        setupGUI()
        printPerformance()
        animate()

	document.onkeypress = handleKeypress
	
        console.log('scatterplot initialized')
    },
    
    setValues: function(axis, values) {
        
        for (var i = 0; i < pointCloud.geometry.vertices.length; i++) {
            destinations[i] = {
                x: axis === 'x' ? 2 * scale * (values[i] / 65536 - 0.5) : destinations[i] ? destinations[i].x : null,
                y: axis === 'y' ? 2 * scale * (values[i] / 65536 - 0.5) : destinations[i] ? destinations[i].y : null,
                z: axis === 'z' ? 2 * scale * (values[i] / 65536 - 0.5) : destinations[i] ? destinations[i].z : null,
            }
        }
    },

    setAnnotations: function(obj) {
        
        var values = obj && (obj.values || obj.annotated)
        var type = obj && obj.type
        if (values && values.length != attributes.customColor.value.length) {
            console.error('incorrect length of annotations: ' + values.length)
        } else {
            if (type == 'continuous') {
                for (var i = 0; i < customValue.length; i++) {
                    customValue[i] = values[i]
                }
            } else {
                for (var i = 0; i < customValue.length; i++) {
                    customValue[i] = 1
                }
            }
            customValue.needsUpdate = true
            annotations = values
            annotationType = type
        }
    }
}

module.exports = Scatter
