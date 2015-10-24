var config = {

    port: 8080, // which port to run the server on
    
    dataDir: '/data/example', // directory for data files (one file per dimension)
    dataType: 'buffer', // 'buffer' or 'json'
    dataPrefix: 'PC', // file name prefix, files go 'PC1.buffer' (or 'PC1.json'), 'PC2.buffer' etc.
    numDimensions: 200, // equal or smaller than the number of data files
    
    annotationDir: '/data/example_annotations_binary', // leave empty for no annotations
    annotationType: 'buffer', // 'buffer' or 'json'
    
    defaultGray: 153, // default shade for ui

    //// dat.GUI defaults
    
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

if (typeof module === 'object' && module.exports) {
    module.exports = config
}
if (typeof window === 'object') {
    window.SCATTER = window.SCATTER || {}
    window.SCATTER.config = config
}
