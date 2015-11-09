'use strict'

var _ = require('lodash')
var fs = require('fs')
var path = require('path')
var genstats = require('genstats')

if (process.argv.length != 4) {
    console.log('calculate enrichment of each dimension for each annotation, rewriting annotations.json')
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
_.forEach(annotations, function(annotation, i) {
    cleanNameHash[annotation.name.replace(/[^a-zA-Z0-9-_: ]/g, '').replace(/ /g, '_').toUpperCase()] = annotation
    _.forEach(annotation.children, function(child) {
        cleanNameHash[child.name.replace(/[^a-zA-Z0-9-_: ]/g, '').replace(/ /g, '_').toUpperCase()] = child
    })
})

var enrichments = _.compact(fs.readFileSync(datafile, 'utf8').split(/\r?\n|\r/))

_.forEach(enrichments, function(e) {
    var split = e.split(/\t/)
    var annotation = cleanNameHash[split[0]]
    if (annotation !== undefined) {
        var sorted = _.sortBy(split.slice(1), function(value) {
            return -Math.abs(+value)
        })
        var used = {}
        annotation.dimensions = _.map(sorted.slice(0, 3), function(value) {
            var index = split.indexOf(value) // indexing starts from 1 because split[1] is the first value
            while (used[index]) { // resolve ties
                index = split.indexOf(value, index + 1)
            }
            used[index] = true
            return index
        })
    }
})

fs.writeFileSync(annotationfile, JSON.stringify(annotations, null, 4))
console.log(annotationfile + ' written')
