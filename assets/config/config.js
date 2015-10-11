window.SCATTER = window.SCATTER || {}

SCATTER.config = {

    url: 'http://localhost',
    port: 8080,
    
    dataDir: '/assets/data/example',
    dataPrefix: 'PC',
    numDimensions: 6,
    annotationDir: '/assets/data/example_annotations_binary',
    
    defaultGray: 153,
    
    defaultPointSize: 1.3,
    defaultPointSizeAnnotated: 3.5,
    defaultPointSizeHighlight: 5,
    defaultOpacity: 0.25,
    defaultLegendOpacity: 0.75,
    defaultGridOpacity: 0.2,
    defaultTransitionSpeed: 50,
    defaultHighlightThreshold: 5,

    continuousAnnotationScale: 0.35,

    hueAnnotated: 0.54,
    saturationAnnotated: 1,
    lightnessAnnotated: 0.5,
    hueNotAnnotated: 0.5,
    saturationNotAnnotated: 0.8,
    lightnessNotAnnotated: 1,

    defaultHeadXSensitivity: 8,
    defaultHeadYSensitivity: 8,
}
