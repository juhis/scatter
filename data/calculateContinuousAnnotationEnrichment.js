'use strict'

var _ = require('lodash')
var fs = require('fs')
var path = require('path')
var genstats = require('genstats')
var readMatrix = require('./readMatrix')

if (process.argv.length != 4) {
    console.log('calculate most informative dimensions for each continuous annotation based on correlation, rewriting annotations.json')
    console.log('usage: node calculateAnnotationEnrichment annotationDir datafile')
    process.exit(1)
}
if (!fs.existsSync(process.argv[2])) {
    console.error('directory does not exist: ' + process.argv[2])
    process.exit(1)
}
if (!fs.existsSync(process.argv[3])) {
    console.error('file does not exist: ' + process.argv[3])
    process.exit(1)
}

var annotationfile = process.argv[2] + path.sep + 'annotations.json'
var datafile = process.argv[3]

var annotations = JSON.parse(fs.readFileSync(annotationfile, 'utf8'))

var cleanNameHash = {}
_.forEach(annotations, function(annotation) {
    cleanNameHash[annotation.name.replace(/[^a-zA-Z0-9-_: ]/g, '').replace(/ /g, '_').toUpperCase()] = annotation
    _.forEach(annotation.children, function(child) {
        cleanNameHash[child.name.replace(/[^a-zA-Z0-9-_: ]/g, '').replace(/ /g, '_').toUpperCase()] = child
    })
})

readMatrix(datafile, true, function(err, matrix) {
    
    _.forEach(cleanNameHash, function(annotation, cleanName) {

        var afile = process.argv[2] + path.sep + annotation.filename
        var values = JSON.parse(fs.readFileSync(afile, 'utf8'))
        if (values.length != matrix.data[0].length) {
            console.error('incorrect number of annotations (%d) vs. data points (%d): %s', values.length, matrix.data.length, afile)
        }

        var correlations = []
        for (var i = 0; i < matrix.data.length; i++) {
            var corr = genstats.correlation(values, matrix.data[i])
            // TODO magic string
            if (matrix.headers[i].indexOf('GI_') !== 0) {
                correlations.push({
                    annotationClean: cleanName,
                    variable: matrix.headers[i],
                    index: i,
                    correlation: corr
                })
            }
        }
        //var sorted = _.sortBy(correlations, 'correlation').reverse()
        var sorted = _.sortBy(correlations, 'correlation')

        var used = {}
        annotation.dimensions = _.map(sorted.slice(0, 3), function(value) {
            return value.index + 1
            // TODO
            // while (used[index]) { // resolve ties
            //     index = split.indexOf(value, index)
            // }
            // used[index] = true
            // return index
        })
    })

    fs.writeFileSync(annotationfile, JSON.stringify(annotations, null, 4))
    console.log(annotationfile + ' written')
    
})
