var data = {

    // directory for data files (one file per dimension)
    dir: '/data/example',
    // data type can be 'buffer' or 'json'
    type: 'buffer',
    // number of dimensions available in the ui, equal or smaller than the number of data files
    numDimensions: 6,
    // the scatterplot will be positioned differently if data only contains positive numbers
    // TODO determine automatically from data
    onlyPositive: false,
    // whether data contains most informative dimensions
    spread: false,
    
    // leave annotationDir empty for no annotations
    annotationDir: 'data/example_annotations',
    // annotation type can be 'buffer' or 'json'
    annotationType: 'json',
}

if (typeof module === 'object' && module.exports) {
    module.exports = data
}
if (typeof window === 'object' && typeof window.SCATTER.config === 'object') {
    window.SCATTER.config.data = data
}
