'use strict'

if (!window.SCATTER || !window.SCATTER.config) {
    console.error('scatter configuration not loaded')
}
var config = window.SCATTER.config

var async = require('async')
var superagent = require('superagent')

var react
var scene, legendScene, renderer
var camera, projectionCameras, legendCamera, cameraControls
var isAnimating = false, isRecording = false, animationId, savedFrames = []
var targetHSL = {h: config.hueAnnotated, s: config.saturationAnnotated, l: 1}
var targetPointSize = {size: config.defaultPointSize}
var prevTargetHSL = {h: config.hueAnnotated, s: config.saturationAnnotated, l: 0.5}
var prevTargetPointSize = {size: config.defaultPointSizeAnnotated}

var effectController, stats
var uniforms, shaderMaterial
var legendPlane, legendUniforms, legendShaderMaterial
var lineMaterial

var scale = 10
var textSize = 0.1 * scale
var colorsAnnotated = [
    new THREE.Color().setHSL(config.colorsAnnotated[0].h, config.colorsAnnotated[0].s, config.colorsAnnotated[0].l),
    new THREE.Color().setHSL(config.colorsAnnotated[1].h, config.colorsAnnotated[1].s, config.colorsAnnotated[1].l),
    new THREE.Color().setHSL(config.colorsAnnotated[2].h, config.colorsAnnotated[2].s, config.colorsAnnotated[2].l)
]    
var colorNotAnnotated = new THREE.Color().setHSL(config.colorNotAnnotated.h, config.colorNotAnnotated.s, config.colorNotAnnotated.l)
var colorHighlight = new THREE.Color().setHSL(config.colorHighlight.h, config.colorHighlight.s, config.colorHighlight.l)

var pointCloud, axes, grid, labels
var destinations = []

var mouse = {
    x: -1,
    y: -1,
    prevX: -1,
    prevY: -1,
    isDown: false
}

var head = {
    x: -1,
    y: -1,
    prevX: -1,
    prevY: -1,
    tracker: null
}

var raycaster = new THREE.Raycaster()
raycaster.params.Points.threshold = config.defaultHighlightThreshold / scale

var clock = new THREE.Clock()

function printPerformance() {

    if (!window.performance) return
    
    var items = window.performance.getEntriesByType('measure')
    for (var i = 0; i < items.length; i++) {
        console.log(items[i].duration + 'ms: ' + items[i].name)
    }
}

function drawTexts(config) {

    labels = new THREE.Object3D()
    var geo, text
    var mat = new THREE.MeshBasicMaterial({color: 0xffffff})

    // XY plane
    geo = new THREE.TextGeometry((config && config.labels && config.labels[0]) || 'X', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.position.set(textSize / 2, -1.5 * textSize, -1000 * scale)
    labels.add(text)
    geo = new THREE.TextGeometry((config && config.labels && config.labels[1]) || 'Y', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.position.set(-1.2 * textSize, textSize / 2, -1000 * scale)
    labels.add(text)

    // XZ plane
    geo = new THREE.TextGeometry((config && config.labels && config.labels[0]) || 'X', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.x = Math.PI / 2
    text.position.set(textSize / 2, -1000 * scale, -1.5 * textSize)
    labels.add(text)
    geo = new THREE.TextGeometry((config && config.labels && config.labels[2]) || 'Z', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.rotation.x = Math.PI / 2
    text.position.set(-1.2 * textSize, -1000 * scale, textSize / 2)
    labels.add(text)

    // YZ plane
    geo = new THREE.TextGeometry((config && config.labels && config.labels[1]) || 'Y', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.rotation.y = Math.PI / 2
    text.position.set(-1000 * scale, -1.2 * textSize, textSize / 2)
    labels.add(text)
    geo = new THREE.TextGeometry((config && config.labels && config.labels[2]) || 'Z', {size: textSize, height: 1, bevelEnabled: false})
    text = new THREE.Mesh(geo, mat)
    text.rotation.z = Math.PI / 2
    text.rotation.y = Math.PI / 2
    text.rotation.x = Math.PI / 2
    text.position.set(-1000 * scale, textSize / 2, -1.5 * textSize)
    labels.add(text)

    scene.add(labels)
}

function drawLegendPlane() {

    var geometry = new THREE.BufferGeometry()
    var vertexAttribute = new THREE.Float32Attribute(2 * 3 * 3, 3)
    vertexAttribute.setXYZ(0, 0, 0, 0) // top left
    vertexAttribute.setXYZ(1, 0, 1, 0) // bottom left
    vertexAttribute.setXYZ(2, 1, 1, 0) // bottom right
    vertexAttribute.setXYZ(3, 1, 1, 0) // bottom right
    vertexAttribute.setXYZ(4, 1, 0, 0) // top right
    vertexAttribute.setXYZ(5, 0, 0, 0) // top left
    
    legendUniforms = {
        uColor: {type: 'c', value: []},
        opacity: {type: 'f', value: config.defaultLegendOpacity}
    }

    var color = new THREE.Color().setRGB(0, 1, 1)
    var colorAttribute = new THREE.Float32Attribute(vertexAttribute.count * 3, 3)
    for (var i = 0; i < vertexAttribute.count; i++) {
        legendUniforms.uColor.value.push(new THREE.Color().setHSL(Math.random(), Math.random(), Math.random()))
        colorAttribute.setXYZ(i, color.r, color.g * Math.random(), color.b)
    }
    geometry.addAttribute('position', vertexAttribute)
    geometry.addAttribute('color', colorAttribute)

    legendShaderMaterial = new THREE.ShaderMaterial({
        uniforms:       legendUniforms,
        vertexShader:   document.getElementById('legendVertexShader').textContent,
        fragmentShader: document.getElementById('legendFragmentShader').textContent,
        transparent:    true,
        depthTest:      false,
        blending:       THREE.NormalBlending
    })

    legendPlane = new THREE.Mesh(geometry, legendShaderMaterial)
    legendPlane.position.set(0, -scale / 20, 0)

    legendScene = new THREE.Scene()
    legendScene.add(legendPlane)
}

function drawLine(v1, v2) {
    var geometry = new THREE.Geometry()
    geometry.vertices.push(new THREE.Vector3(v1[0], v1[1], v1[2]),
                           new THREE.Vector3(v2[0], v2[1], v2[2]))
    var line = new THREE.Line(geometry, lineMaterial)
    grid.add(line)
}

function drawGrid() {

    grid = new THREE.Object3D()
    lineMaterial = new THREE.LineBasicMaterial({color: 0xffffff, opacity: config.defaultGridOpacity, transparent: true})

    drawLine([-scale, 0, 0],
             [scale, 0, 0])
    drawLine([0, -scale, 0],
             [0, scale, 0])
    drawLine([0, 0, -scale],
             [0, 0, scale])
    
    drawLine([-scale, -scale, -scale],
             [-scale, -scale, scale])
    drawLine([-scale, -scale, -scale],
             [-scale, scale, -scale])
    drawLine([-scale, -scale, -scale],
             [scale, -scale, -scale])
    drawLine([scale, scale, scale],
             [scale, scale, -scale])
    drawLine([scale, scale, scale],
             [scale, -scale, scale])
    drawLine([scale, scale, scale],
             [-scale, scale, scale])
    drawLine([scale, -scale, scale],
             [-scale, -scale, scale])
    drawLine([scale, -scale, scale],
             [scale, -scale, -scale])
    drawLine([-scale, scale, scale],
             [-scale, -scale, scale])
    drawLine([-scale, scale, scale],
             [-scale, scale, -scale])
    drawLine([scale, scale, -scale],
             [scale, -scale, -scale])
    drawLine([scale, scale, -scale],
             [-scale, scale, -scale])

    drawLine([-scale, -scale, 0],
             [scale, -scale, 0])
    drawLine([-scale, -scale, 0],
             [-scale, scale, 0])
    drawLine([scale, -scale, 0],
             [scale, scale, 0])
    drawLine([-scale, scale, 0],
             [scale, scale, 0])

    drawLine([0, -scale, -scale],
             [0, -scale, scale])
    drawLine([0, -scale, -scale],
             [0, scale, -scale])
    drawLine([0, scale, scale],
             [0, -scale, scale])
    drawLine([0, scale, scale],
             [0, scale, -scale])

    drawLine([-scale, 0, -scale],
             [scale, 0, -scale])
    drawLine([-scale, 0, -scale],
             [-scale, 0, scale])
    drawLine([scale, 0, scale],
             [scale, 0, -scale])
    drawLine([scale, 0, scale],
             [-scale, 0, scale])

    scene.add(grid)
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

    var numPoints = dataX.length
    var geometry = new THREE.BufferGeometry()
    var positions = new Float32Array(numPoints * 3)
    var colors = new Float32Array(numPoints * 3)
    var sizes = new Float32Array(numPoints)
    var customs = new Float32Array(numPoints)
    for (var i = 0, i3 = 0; i < numPoints; i++, i3 += 3) {
        positions[i3] = 2 * scale * (dataX[i] / 65535 - 0.5)
        positions[i3 + 1] = 2 * scale * (dataY[i] / 65535 - 0.5)
        positions[i3 + 2] = 2 * scale * (dataZ[i] / 65535 - 0.5)
        colors[i3] = colorNotAnnotated.r
        colors[i3 + 1] = colorNotAnnotated.g
        colors[i3 + 2] = colorNotAnnotated.b
        sizes[i] = config.defaultPointSize
        customs[i] = 1
    }
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.addAttribute('custom', new THREE.BufferAttribute(customs, 1))
    
    pointCloud = new THREE.Points(geometry, shaderMaterial)
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
    
    camera = new THREE.PerspectiveCamera(45, width / (2/3 * height), 0.1, 100 * scale)
    //camera.position.set(3 * scale, 3 * scale, 3 * scale)
    camera.position.set(0, 0, 5 * scale)

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
            cam.position.y = -1
        }
        if (i === 2) {
            cam.up.set(0, 0, 1)
            cam.position.x = 1
        }
        projectionCameras.push(cam)
    }

    legendCamera = new THREE.OrthographicCamera(
            -aspectRatio, aspectRatio, // lr
            -aspectRatio / (width / height), aspectRatio / (width / height), // tb
            -10, 10 // nf
    )
    legendCamera.position.set(0, 0, -1)
    
    // CONTROLS
    cameraControls = new THREE.OrbitControls(camera, renderer.domElement)
    cameraControls.noPan = true
    cameraControls.target.set(0, 0, 0)

    // SHADING
    uniforms = {
        opacity: {type: 'f', value: config.defaultOpacity}
    }
    shaderMaterial = new THREE.ShaderMaterial({
        uniforms:       uniforms,
        vertexShader:   document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent,
        transparent:    true,
        depthTest:      true,
        blending:       THREE.NormalBlending
    })
}

function setupGUI() {

    var hsvAnnotated = colorsAnnotated.map(function(color) {
        var hsv = THREE.ColorConverter.getHSV(color)
        hsv.h *= 360
        return hsv
    })
    var hsvNotAnnotated = THREE.ColorConverter.getHSV(colorNotAnnotated)
    hsvNotAnnotated.h *= 360
    var hsvHighlight = THREE.ColorConverter.getHSV(colorHighlight)
    hsvHighlight.h *= 360
    
    effectController = {

        pointSize: config.defaultPointSize,
        pointSizeAnnotated: config.defaultPointSizeAnnotated,
        pointSizeHighlight: config.defaultPointSizeHighlight,
        opacity: config.defaultOpacity,
        
        hsvAnnotated1: hsvAnnotated[0],
        hsvAnnotated2: hsvAnnotated[1],
        hsvAnnotated3: hsvAnnotated[2],
        hsvNotAnnotated: hsvNotAnnotated,
        hsvHighlight: hsvHighlight,
        
        showProjections: false,
        showLabels: false,
        showGrid: false,
        gridOpacity: config.defaultGridOpacity,
        showAxes: false,
        showFPS: false,

        highlight: false,
        highlightAnnotations: true,
        highlightThreshold: config.defaultHighlightThreshold,

        headtracking: false,
        headXSensitivity: config.defaultHeadXSensitivity,
        headYSensitivity: config.defaultHeadYSensitivity,
        
        transitionSpeed: config.defaultTransitionSpeed,
        legendOpacity: config.defaultLegendOpacity,
        depthTest: true,
        additiveBlending: false,
    }
    
    var gui = new dat.GUI()
    var folder = gui.addFolder('Points')
    folder.add(effectController, 'pointSize', 1, 10).name('SizeNotAnnotated')
    folder.add(effectController, 'pointSizeAnnotated', 1, 10).name('SizeAnnotated')
    folder.add(effectController, 'pointSizeHighlight', 1, 10).name('SizeHighlighted')
    folder.add(effectController, 'opacity', 0, 1).name('Opacity')    

    folder = gui.addFolder('Colors')
    folder.addColor(effectController, 'hsvNotAnnotated').name('NotAnnotated')
        .onChange(function(value) {
            colorNotAnnotated = THREE.ColorConverter.setHSV(new THREE.Color(), value.h / 360, value.s, value.v)
        })
    folder.addColor(effectController, 'hsvAnnotated1', 0, 1).name('Annotated1')
        .onChange(function(value) {
            colorsAnnotated[0] = THREE.ColorConverter.setHSV(new THREE.Color(), value.h / 360, value.s, value.v)
            var rgbs = colorsAnnotated.map(function(color) {
                return 'rgb(' + Math.round(color.r * 255) + ',' + Math.round(color.g * 255) + ',' + Math.round(color.b * 255) + ')'
            })
            react.updateAnnotationColors(rgbs)
        })
    folder.addColor(effectController, 'hsvAnnotated2', 0, 1).name('Annotated2')
        .onChange(function(value) {
            console.log(value)
            colorsAnnotated[1] = THREE.ColorConverter.setHSV(new THREE.Color(), value.h / 360, value.s, value.v)
            var rgbs = colorsAnnotated.map(function(color) {
                return 'rgb(' + Math.round(color.r * 255) + ',' + Math.round(color.g * 255) + ',' + Math.round(color.b * 255) + ')'
            })
            react.updateAnnotationColors(rgbs)
        })
    folder.addColor(effectController, 'hsvAnnotated3', 0, 1).name('Annotated3')
        .onChange(function(value) {
            colorsAnnotated[2] = THREE.ColorConverter.setHSV(new THREE.Color(), value.h / 360, value.s, value.v)
            var rgbs = colorsAnnotated.map(function(color) {
                return 'rgb(' + Math.round(color.r * 255) + ',' + Math.round(color.g * 255) + ',' + Math.round(color.b * 255) + ')'
            })
            react.updateAnnotationColors(rgbs)
        })
    folder.addColor(effectController, 'hsvHighlight', 0, 1).name('Highlight')
        .onChange(function(value) {
            colorHighlight = THREE.ColorConverter.setHSV(new THREE.Color(), value.h / 360, value.s, value.v)
        })

    folder = gui.addFolder('Show')
    folder.add(effectController, 'showProjections').name('Projections').listen()
    folder.add(effectController, 'showLabels').name('ProjectionLabels')
    folder.add(effectController, 'showGrid').name('Grid')
    folder.add(effectController, 'gridOpacity', 0, 1).name('GridOpacity')
    folder.add(effectController, 'showAxes').name('Axes')
    folder.add(effectController, 'showFPS').name('FPS').listen()

    folder = gui.addFolder('Mouse tracking')
    folder.add(effectController, 'highlight').name('Track mouse').listen()
        .onChange(function(value) {
            react.updateHighlights(null)
        })
    folder.add(effectController, 'highlightAnnotations').name('ShowAnnotations')
    folder.add(effectController, 'highlightThreshold', 0, 20).name('Threshold')

    folder = gui.addFolder('Head tracking')
    folder.add(effectController, 'headtracking').name('Track head').listen()
        .onChange(function(value) {
            if (value) {
                if (!head.tracker) {
                    setupHeadTracker()
                }
                cameraControls.enabled = false
                camera.position.set(0, 0, 4 * scale)
                pointCloud.rotation.set(0, 0, 0)
                head.tracker.start()
                document.getElementById('inputVideo').style.display = 'block'
            } else {
                cameraControls.enabled = true
                camera.position.set(0, 0, 4 * scale)
                pointCloud.rotation.set(0, 0, 0)
                head.tracker.stop()
                head.tracker.stopStream()
                head.tracker = null
                document.getElementById('inputVideo').style.display = 'none'
            }
        })
    folder.add(effectController, 'headXSensitivity', 0, 20).name('XSensitivity')
    folder.add(effectController, 'headYSensitivity', 0, 20).name('YSensitivity')

    folder = gui.addFolder('Other')
    folder.add(effectController, 'transitionSpeed', 1, 100).name('TransitionSpeed')
    folder.add(effectController, 'legendOpacity', 0, 1).name('LegendOpacity')
    folder.add(effectController, 'depthTest').name('DepthTest')
    folder.add(effectController, 'additiveBlending').name('AdditiveBlending')
    gui.close()
}

function setupHeadTracker() {

    head.tracker = new headtrackr.Tracker({ui: true, headPosition: true})
    head.tracker.init(document.getElementById('inputVideo'), document.getElementById('inputCanvas'))
    document.addEventListener('headtrackingEvent', function(e) {
        head.prevX = head.x
        head.prevY = head.y
        head.x = e.x
        head.y = e.y
        var dx = head.x - head.prevX
        if (Math.abs(dx) < 3) {
            pointCloud.rotation.y += dx / 100 * effectController.headXSensitivity
        }
        var dy = head.y - head.prevY
        if (Math.abs(dy) < 3) {
            pointCloud.rotation.x -= dy / 100 * effectController.headYSensitivity
        }
    })
}    

function addToDOM(domElement) {

    renderer.domElement.id = 'scattercanvas'
    var canvas = document.getElementById('scattercanvas')
    if (canvas) {
        canvas.parentNode.removeChild(canvas)
    }
    domElement.appendChild(renderer.domElement)

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
    //legendUniforms.opacity.value = effectController.legendOpacity
    var hsl = colorsAnnotated[0].getHSL()

    var targetHSLColor = new THREE.Color().setHSL(targetHSL.h, targetHSL.s, targetHSL.l)
    var prevTargetHSLColor = new THREE.Color().setHSL(prevTargetHSL.h, prevTargetHSL.s, prevTargetHSL.l)

    //TODO legend
    // if (annotations && annotationType == 'continuous') {
    //  var legendColors = legendPlane.geometry.attributes.color.array
    //     var h = hsl.h
    //  var color = new THREE.Color().setHSL(h, hsl.s, hsl.l)
    //  for (var i3 = 0; i3 < legendColors.length; i3 += 3) {
    //      legendColors[i] = color.r
    //      legendColors[i + 1] = color.g * Math.random()
    //      legendColors[i + 2] = color.b
    //  }
    //  legendPlane.geometry.attributes.color.needsUpdate = true
    // }

    var positions = pointCloud.geometry.attributes.position.array
    var sizes = pointCloud.geometry.attributes.size.array
    var colors = pointCloud.geometry.attributes.color.array
    var customs = pointCloud.geometry.attributes.custom.array
    
    for (var i = 0, i3 = 0; i < sizes.length; i++, i3 += 3) {

        if (react.state.selectedAnnotationItems.length > 0 && react.state.selectedAnnotationItems[0].type === 'continuous') {
            var h = hsl.h - customs[i] * config.continuousAnnotationScale
            var color = new THREE.Color().setHSL(h, hsl.s, hsl.l)
            colors[i3] = color.r
            colors[i3 + 1] = color.g
            colors[i3 + 2] = color.b
            sizes[i] = effectController.pointSize
        } else if (react.state.selectedAnnotationValues[0] && react.state.selectedAnnotationValues[0][i] === 1) {
            colors[i3] = isAnimating ? targetHSLColor.r : colorsAnnotated[0].r
            colors[i3 + 1] = isAnimating ? targetHSLColor.g : colorsAnnotated[0].g
            colors[i3 + 2] = isAnimating ? targetHSLColor.b : colorsAnnotated[0].b
            sizes[i] = isAnimating ? targetPointSize.size : effectController.pointSizeAnnotated
        } else if (react.state.selectedAnnotationValues[1] && react.state.selectedAnnotationValues[1][i] === 1) {
            colors[i3] = isAnimating ? targetHSLColor.r : colorsAnnotated[1].r
            colors[i3 + 1] = isAnimating ? targetHSLColor.g : colorsAnnotated[1].g
            colors[i3 + 2] = isAnimating ? targetHSLColor.b : colorsAnnotated[1].b
            sizes[i] = isAnimating ? targetPointSize.size : effectController.pointSizeAnnotated
        } else if (react.state.selectedAnnotationValues[2] && react.state.selectedAnnotationValues[2][i] === 1) {
            colors[i3] = isAnimating ? targetHSLColor.r : colorsAnnotated[2].r
            colors[i3 + 1] = isAnimating ? targetHSLColor.g : colorsAnnotated[2].g
            colors[i3 + 2] = isAnimating ? targetHSLColor.b : colorsAnnotated[2].b
            sizes[i] = isAnimating ? targetPointSize.size : effectController.pointSizeAnnotated
        } else {
            colors[i3] = colorNotAnnotated.r
            colors[i3 + 1] = colorNotAnnotated.g
            colors[i3 + 2] = colorNotAnnotated.b
            sizes[i] = effectController.pointSize
        }

        if (destinations[i] && destinations[i].x != undefined) {
            var distX = destinations[i].x - positions[i3]
            if (Math.abs(distX) > 0.1) {
                positions[i3] += distX / 1000 * effectController.transitionSpeed * 3
            } else {
                positions[i3] = destinations[i].x
            }
        }
        if (destinations[i] && destinations[i].y != undefined) {
            var distY = destinations[i].y - positions[i3 + 1]
            if (Math.abs(distY) > 0.1) {
                positions[i3 + 1] += distY / 1000 * effectController.transitionSpeed * 3
            } else {
                positions[i3 + 1] = destinations[i].y
            }
        }
        if (destinations[i] && destinations[i].z != undefined) {
            var distZ = destinations[i].z - positions[i3 + 2]
            if (Math.abs(distZ) > 0.1) {
                positions[i3 + 2] += distZ / 1000 * effectController.transitionSpeed * 3
            } else {
                positions[i3 + 2] = destinations[i].z
            }
        }
    }

    raycaster.params.Points.threshold = effectController.highlightThreshold / scale
    raycast()

    pointCloud.geometry.attributes.position.needsUpdate = true
    pointCloud.geometry.attributes.size.needsUpdate = true
    pointCloud.geometry.attributes.color.needsUpdate = true
    
    shaderMaterial.blending = effectController.additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending
    shaderMaterial.depthTest = effectController.depthTest
    grid.visible = effectController.showGrid
    lineMaterial.opacity = effectController.gridOpacity
    axes.visible = effectController.showAxes
    labels.visible = effectController.showLabels
    stats.domElement.style.visibility = effectController.showFPS ? 'visible' : 'hidden'

    // cameras
    renderer.clear()
    if (effectController.showProjections) {
        for (var i = 0; i < 3; i++) {
            var cam = projectionCameras[i]
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

    // legend camera TODO
    // renderer.setViewport(0, 9 / 10 * renderer.domElement.offsetHeight, renderer.domElement.offsetWidth / 10, renderer.domElement.offsetHeight / 10)
    // renderer.render(legendScene, legendCamera)
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

    var canvas = document.getElementById('scattercanvas')
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

    var key = e.keyCode || e.charCode

    if (key === 97 || key === 65) { // 'a'nimate, 'A'nimate and record

        var splines = []
        // zoom out from origo
        splines.push(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-4 * scale, 0, 0)]))

        // rotation around y
        var splinePoints = [new THREE.Vector3(-4 * scale, 0, 0)]
        for (var angle = 0; angle <= 2 * Math.PI; angle += 2 * Math.PI / 16) {
            splinePoints.push(new THREE.Vector3(-4 * scale * Math.cos(angle), 0, 4 * scale * Math.sin(angle)))
        }
        splines.push(new THREE.CatmullRomCurve3(splinePoints))

        var tweenPos = [
            {x: -8, y: 25, z: 0},
            {x: -20, y: -21, z: -21}
        ]
        var tweenAnnotations = [
            'blood',
            'brain'
        ]

        splines.push(new THREE.CatmullRomCurve3([
            new THREE.Vector3(tweenPos[1].x, tweenPos[1].y, tweenPos[1].z),
            new THREE.Vector3(-7, 6, 28),
            new THREE.Vector3(0, 0, 0)
        ]))
        
        if (key === 65) {
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

    if (key === 114) { // 'r'otate
        cameraControls.autoRotate = !cameraControls.autoRotate
    }
    
    if (key === 115) { // 's'ave frame
        saveFrame('test')
    }
    
    if (key === 99) { // 'c'amera
        console.log(camera.position)
    }

    if (key === 102) { // toggle 'f'ps
        effectController.showFPS = !effectController.showFPS
    }

    if (key === 103) { // toggle 'g'rid
        effectController.showGrid = !effectController.showGrid
    }

    if (key === 108) { // toggle 'l'abels
        effectController.showLabels = !effectController.showLabels
    }

    if (key === 109) { // track 'm'ouse
        effectController.highlight = !effectController.highlight
        react.updateHighlights(null)
    }

    if (key === 112) { // toggle 'p'rojections
        effectController.showProjections = !effectController.showProjections
    }

    if (key === 120) { // toggle a'x'es
        effectController.showAxes = !effectController.showAxes
    }
}

function handleMousemove(e) {

    var width = renderer.getSize().width
    var height = renderer.getSize().height
    if (effectController.showProjections) {
        height *= 2 / 3
    }
    mouse.prevX = mouse.x
    mouse.prevY = mouse.y
    mouse.x = ((e.clientX - document.getElementById('menu').offsetWidth) / width) * 2 - 1
    mouse.y = -(e.clientY / height) * 2 + 1
}

function raycast(e) {

    if (!effectController.highlight) {
        return        
    }
        
    raycaster.setFromCamera(mouse, camera)
    var intersects = raycaster.intersectObject(pointCloud)

    var sizes = pointCloud.geometry.attributes.size.array
    var colors = pointCloud.geometry.attributes.color.array

    if (intersects.length > 0) {

        // highlight intersecting samples or, if an annotation is selected, only annotated intersecting points
        for (var i = 0; i < intersects.length; i++) {
            if (react.state.selectedAnnotationValues.length === 0
                || (react.state.selectedAnnotationValues[0] && react.state.selectedAnnotationValues[0][intersects[i].index] === 1)
                || (react.state.selectedAnnotationValues[1] && react.state.selectedAnnotationValues[0][intersects[i].index] === 1)
                || (react.state.selectedAnnotationValues[2] && react.state.selectedAnnotationValues[0][intersects[i].index] === 1)) {
                sizes[intersects[i].index] = effectController.pointSizeHighlight
                colors[3 * intersects[i].index] = colorHighlight.r
                colors[3 * intersects[i].index + 1] = colorHighlight.g
                colors[3 * intersects[i].index + 2] = colorHighlight.b
            }
        }
        
        if (effectController.highlightAnnotations && react.state.menuItems) {
            var highlights = null
            // if an annotation is selected, only highlight its children or itself if no children
            var items = react.state.menuItems.slice(0)
            react.state.selectedAnnotationItems.forEach(function(item) {
                if (react.state.openAnnotationItem === item) {
                    items = item.children
                }
            })
            for (var i = 0; i < items.length; i++) { // calculate number of highlighted points for each item
                var name = items[i].name.toLowerCase()
                if (items[i].type === 'binary' && react.state.annotations[name]) {
                    var ann = react.state.annotations[name]
                    var numAnn = 0
                    for (var j = 0; j < intersects.length; j++) {
                        if (ann[intersects[j].index] === 1) {
                            ++numAnn
                        }
                    }
                    highlights = highlights || {}
                    var gray = Math.round(config.defaultDark + numAnn / intersects.length * (255 - config.defaultDark))
                    if (numAnn === 0) {
                        gray = 0
                    }
                    highlights[name] = {
                        numHighlighted: numAnn,
                        numHighlightedTotal: intersects.length,
                        color: {
                            r: gray,
                            g: gray,
                            b: gray
                        }
                    }
                }
            }
            if (highlights) {
                react.updateHighlights(highlights)
            }
        }
    } else if (effectController.highlightAnnotations) {
        react.updateHighlights(null)
    }
    
    pointCloud.geometry.attributes.size.needsUpdate = true
    pointCloud.geometry.attributes.color.needsUpdate = true
}

var Scatter = {

    initialize: function(domElement, reactClass, width, height, dataX, dataY, dataZ, config) {

        console.log('initializing scatterplot, data length: ' + dataX.length)
        react = reactClass
        init(width, height)
        //TODO
        //drawLegendPlane()
        drawGrid()
        drawAxes()
        drawTexts(config)
        fillScene(dataX, dataY, dataZ)
        if (config.onlyPositive === true) { // translate origo to the halfway point
            pointCloud.position.x = -scale / 2
            pointCloud.position.y = -scale / 2
            pointCloud.position.z = -scale / 2
            // pointCloud.scale.multiplyScalar(2)
        }
        addToDOM(domElement)
        setupGUI()
        // printPerformance()
        animate()

        document.onkeypress = handleKeypress
        document.onmousemove = handleMousemove

        console.log('scatterplot initialized')
    },

    resize: function(width, height) {
        renderer.setSize(width, height)
    },
    
    setValues: function(axis, values) {
        
        for (var i = 0; i < pointCloud.geometry.attributes.size.count; i++) {
            destinations[i] = {
                x: axis === 'x' ? 2 * scale * (values[i] / 65536 - 0.5) : destinations[i] ? destinations[i].x : null,
                y: axis === 'y' ? 2 * scale * (values[i] / 65536 - 0.5) : destinations[i] ? destinations[i].y : null,
                z: axis === 'z' ? 2 * scale * (values[i] / 65536 - 0.5) : destinations[i] ? destinations[i].z : null,
            }
        }
    },

    setLabel: function(axis, label) {

        if (!axis || !label) return

        if (axis === 'x') {
            var geo = new THREE.TextGeometry(label, {size: textSize, height: 1, bevelEnabled: false})
            labels.children[0].geometry = geo
            labels.children[2].geometry = geo
        }
        if (axis === 'y') {
            var geo = new THREE.TextGeometry(label, {size: textSize, height: 1, bevelEnabled: false})
            labels.children[1].geometry = geo
            labels.children[4].geometry = geo
        }
        if (axis === 'z') {
            var geo = new THREE.TextGeometry(label, {size: textSize, height: 1, bevelEnabled: false})
            labels.children[3].geometry = geo
            labels.children[5].geometry = geo
        }
    },

    getAnnotationColorsRGBString: function() {

        return colorsAnnotated.map(function(color) {
            return 'rgb(' + Math.round(color.r * 255) + ',' + Math.round(color.g * 255) + ',' + Math.round(color.b * 255) + ')'
        })
    },

    cycleAnnotationColors: function(index) {

        index = index || 0
        colorsAnnotated.push(colorsAnnotated.splice(index, 1)[0])
    },
}

module.exports = Scatter
