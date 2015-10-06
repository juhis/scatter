'use strict'

var config = require('../../config/config.js')

var scene, renderer
var camera, projectionCameras, cameraControls
var effectController, stats
var attributes, uniforms, shaderMaterial

var scale = 1000
var colorAnnotated = new THREE.Color().setHSL(config.hueAnnotated, config.saturationAnnotated, config.lightnessAnnotated)
var colorNotAnnotated = new THREE.Color().setHSL(config.hueNotAnnotated, config.saturationNotAnnotated, config.lightnessNotAnnotated)

var pointCloud, axes, labels
var destinations = [], annotations = [], annotationType = null, customValue = []
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
    var textSize = 150

    // XY plane
    geo = new THREE.TextGeometry('X', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.position.set(75, -textSize - 75, -scale * scale / 2)
    labels.add(text)
    geo = new THREE.TextGeometry('Y', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.position.set(-textSize - 25, 75, -scale * scale / 2)
    labels.add(text)

    // XZ plane
    geo = new THREE.TextGeometry('X', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.x = Math.PI / 2
    text.position.set(75, -scale * scale / 2, -textSize - 75)
    labels.add(text)
    geo = new THREE.TextGeometry('Z', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.x = Math.PI / 2
    text.position.set(-textSize - 25, scale * scale / 2, 75)
    labels.add(text)

    // YZ plane
    geo = new THREE.TextGeometry('Y', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.rotation.y = Math.PI / 2
    text.position.set(scale * scale / 2, 75, -textSize - 75)
    labels.add(text)
    geo = new THREE.TextGeometry('Z', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.rotation.y = Math.PI / 2
    text.position.set(scale * scale / 2, -textSize - 25, 75)
    labels.add(text)

    scene.add(labels)
}

function drawAxes() {

    axes = new THREE.Object3D()
    var axisLength = scale / 4
    var axisThickness = scale / 50
    var mat, geo, axis
    
    mat = new THREE.MeshBasicMaterial({color: 0x000000})
    geo = new THREE.SphereGeometry(axisThickness, 32, 32)
    var sphere = new THREE.Mesh(geo, mat)
    axes.add(sphere)

    // X
    mat = new THREE.MeshBasicMaterial({color: 0xff3c00})
    geo = new THREE.CylinderGeometry(axisThickness, 1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.z = Math.PI / 2
    axis.position.x = axisLength / 2
    axes.add(axis)
    mat = new THREE.MeshBasicMaterial({color: 0xff3c00})
    geo = new THREE.CylinderGeometry(axisThickness, 1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.z = -Math.PI / 2
    axis.position.x = -axisLength / 2
    axes.add(axis)

    // Y
    mat = new THREE.MeshBasicMaterial({color: 0xa0d200})
    geo = new THREE.CylinderGeometry(axisThickness, 1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.z = Math.PI
    axis.position.y = axisLength / 2
    axes.add(axis)
    mat = new THREE.MeshBasicMaterial({color: 0xa0d200})
    geo = new THREE.CylinderGeometry(axisThickness, 1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.position.y = -axisLength / 2
    axes.add(axis)

    // Z
    mat = new THREE.MeshBasicMaterial({color: 0x00a0d2})
    geo = new THREE.CylinderGeometry(axisThickness, 1, axisLength, 32, 128, false)
    var axis = new THREE.Mesh(geo, mat)
    axis.rotation.x = -Math.PI / 2
    axis.position.z = axisLength / 2
    axes.add(axis)
    mat = new THREE.MeshBasicMaterial({color: 0x00a0d2})
    geo = new THREE.CylinderGeometry(axisThickness, 1, axisLength, 32, 128, false)
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
        vertex.x = 2 * scale * (dataX[i] / 65536 - 0.5)
        vertex.y = 2 * scale * (dataY[i] / 65536 - 0.5)
        vertex.z = 2 * scale * (dataZ[i] / 65536 - 0.5)
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
    renderer = new THREE.WebGLRenderer({antialias: true})
    renderer.gammaInput = true
    renderer.gammaOutput = true
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    renderer.autoClear = false

    // CAMERAS
    
    camera = new THREE.PerspectiveCamera(45, width / (2/3 * height), 2, 200000)
    camera.position.set(3 * scale, 3 * scale, 3 * scale)

    projectionCameras = []
    var maxScale = width > height ? width / height : height / width
    for (var i = 0; i < 3; i++) {
        var cam = new THREE.OrthographicCamera(
                -1.2 * maxScale * scale, 1.2 * maxScale * scale, // lr
            1.2 * maxScale * scale / (width / height), -1.2 * maxScale * scale / (width / height), // tb
                -maxScale * scale * scale, maxScale * scale * scale // nf
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
    folder = gui.addFolder('Other')
    folder.add(effectController, 'transitionSpeed', 1, 500).name('TransitionSpeed')
    folder.add(effectController, 'showAxes').name('ShowAxes')
    folder.add(effectController, 'showLabels').name('ShowLabels')
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
    //camera.aspect = w/h
    //camera.updateProjectionMatrix()

    stats = new Stats()
    stats.domElement.style.position = 'absolute'
    stats.domElement.style.bottom = '0px'
    stats.domElement.style.right = '0px'
    domElement.appendChild(stats.domElement)
}

function animate() {
    window.requestAnimationFrame(animate)
    render()
}

function render() {

    var delta = clock.getDelta()
    cameraControls.update(delta)
    stats.update()
    
    uniforms.opacity.value = effectController.opacity
    colorAnnotated = new THREE.Color().setHSL(effectController.hueAnnotated, effectController.saturationAnnotated, effectController.lightnessAnnotated)
    colorNotAnnotated = new THREE.Color().setHSL(effectController.hueNotAnnotated, effectController.saturationNotAnnotated, effectController.lightnessNotAnnotated)
    var hsl = colorAnnotated.getHSL()
    
    for (var i = 0; i < pointCloud.geometry.vertices.length; i++) {

        var v = pointCloud.geometry.vertices[i]
        if (annotations) {
            if (annotationType == 'continuous') {
                attributes.size.value[i] = effectController.pointSize
                var h = hsl.h + customValue[i]
                attributes.customColor.value[i] = new THREE.Color().setHSL(h, hsl.s, hsl.l)
            } else if (annotations[i] === 1) {
                attributes.size.value[i] = effectController.pointSizeAnnotated
                attributes.customColor.value[i] = colorAnnotated
            } else {
                attributes.size.value[i] = effectController.pointSize
                attributes.customColor.value[i] = colorNotAnnotated
            }
        } else {
            attributes.size.value[i] = effectController.pointSize
            attributes.customColor.value[i] = colorNotAnnotated
        }

        if (destinations[i] && destinations[i].x != undefined) {
            var distX = destinations[i].x - v.x
            if (Math.abs(distX) > scale / 75) {
                v.x += distX / scale * effectController.transitionSpeed
            } else {
                v.x = destinations[i].x
            }
        }
        if (destinations[i] && destinations[i].y != undefined) {
            var distY = destinations[i].y - v.y
            if (Math.abs(distY) > scale / 75) {
                v.y += distY / scale * effectController.transitionSpeed
            } else {
                v.y = destinations[i].y
            }
        }
        if (destinations[i] && destinations[i].z != undefined) {
            var distZ = destinations[i].z - v.z
            if (Math.abs(distZ) > scale / 75) {
                v.z += distZ / scale * effectController.transitionSpeed
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

    renderer.clear()

    // main cam
    //renderer.setViewport(0, 1 / 3 * canvasHeight, canvasWidth, 2 / 3 * canvasHeight)
    renderer.setViewport(0, 1 / 3 * renderer.domElement.offsetHeight, renderer.domElement.offsetWidth, 2 / 3 * renderer.domElement.offsetHeight)
    renderer.render(scene, camera)

    // projection cams
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
}

var Scatter = {

    initialize: function(domElement, width, height, dataX, dataY, dataZ) {

        console.log('initializing scatterplot, data length: ' + dataX.length)
        init(width, height)
        drawAxes()
        drawTexts()
        fillScene(dataX, dataY, dataZ)
        addToDOM(domElement)
        setupGUI()
        printPerformance()
        animate()
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
