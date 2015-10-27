// scatter configuration
//
// see data.js for dataset config and sercer.js for server config

var config = {

    defaultGray: 153, // default shade for ui
    defaultDark: 99, // default dark shade for ui

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

    colorsAnnotated: [
        {
            h: 0.54,
            s: 0.9,
            l: 0.5
        },
        {
            h: 0.25,
            s: 0.9,
            l: 0.5
        },
        {
            h: 0.09,
            s: 0.9,
            l: 0.5
        },
    ],
    colorNotAnnotated: {
        h: 0.5,
        s: 0.9,
        l: 1
    },
    colorHighlight: {
        h: 1,
        s: 0.9,
        l: 0.5
    },

    defaultHeadXSensitivity: 8,
    defaultHeadYSensitivity: 8,
}

if (typeof module === 'object' && module.exports) {
    config.data = require('./data')
    module.exports = config
}
if (typeof window === 'object') {
    window.SCATTER = window.SCATTER || {}
    window.SCATTER.config = config
}
