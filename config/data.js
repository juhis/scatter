var data = {

    // directory for data files (one file per dimension)
    // run 'node data/createDatafiles.js' to create the files based on a tab-delimited matrix
    dir: '/data/example',
    // data type can be 'buffer' or 'json'
    // 'buffer' is preferred for large datasets as buffer files are smaller than json files
    // data files go 1.buffer (or 1.json), 2.buffer etc.
    type: 'buffer',
    // whether data contains most informative dimensions
    // TODO determine automatically
    spread: false,
    
    // leave annotationDir empty for no annotations
    annotationDir: '/data/example-annotations-binary',
    // annotation type can be 'buffer' or 'json'
    // 'buffer' is preferred for large datasets as buffer files are smaller than json files
    annotationType: 'buffer',
}

if (typeof module === 'object' && module.exports) {
    module.exports = data
}
if (typeof window === 'object' && typeof window.SCATTER.config === 'object') {
    window.SCATTER.config.data = data
}
