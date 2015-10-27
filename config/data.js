var data = {

    dir: '/data/pc-eigenvectors', // directory for data files (one file per dimension)
    type: 'buffer', // 'buffer' or 'json'
    prefix: 'PC', // file name prefix, files go 'PC1.buffer' (or 'PC1.json'), 'PC2.buffer' etc.
    numDimensions: 100, // equal or smaller than the number of data files
    
    annotationDir: '/data/pc-annotations', // leave empty for no annotations
    annotationType: 'buffer', // 'buffer' or 'json'
}

if (typeof module === 'object' && module.exports) {
    module.exports = data
}
if (typeof window === 'object' && typeof window.SCATTER.config === 'object') {
    window.SCATTER.config.data = data
}
