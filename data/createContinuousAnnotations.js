'use strict'

var fs = require('fs')
var splitter = require('split')
var tab = /\t/

if (process.argv.length < 5) {
    console.log('creates continuous annotations from a given tab-delimited matrix')
    console.log('usage: node createContinuousAnnotations inputfile outdir col1 [col2 ...]')
    process.exit(1)
}

var outDir = process.argv[3]
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir)
}

var lineNum = 0
var annotations = []
var annotationData = []
var colNames = []
var colIndices = []

fs.createReadStream(process.argv[2])
    .pipe(splitter())
    .on('data', function(line) {
        var split = line.split(tab)
        if (lineNum === 0) {
            for (var i = 4; i < process.argv.length; i++) {
                var index = split.indexOf(process.argv[i])
                if (index >= 0) {
                    colNames.push(process.argv[i])
                    colIndices.push(index)
                } else {
                    console.log('column not found: %s', process.argv[i])
                }
            }
            for (var i = 0; i < colIndices.length; i++) {
                annotations.push({
                    name: colNames[i],
                    type: 'continuous',
                    min: Number.MAX_VALUE,
                    max: -Number.MAX_VALUE,
                    filename: 'annotation_' + colNames[i] + '.json'
                })
                annotationData.push([])
            }
        } else if (split.length > 1) {
            var isOK = true
            for (var i = 1; i < split.length; i++) {
                if (split[i] === 'NA') {
                    isOK = false
                    break
                }
            }
            if (isOK) {
                for (var i = 0; i < colIndices.length; i++) {
                    var value = +split[colIndices[i]]
                    annotationData[i].push(value)
                    annotations[i].max = Math.max(annotations[i].max, value)
                    annotations[i].min = Math.min(annotations[i].min, value)
                }
            } else {
                console.log('skipping line %d: %s', lineNum + 1, split[0])
            }
        }
        lineNum++
        if (lineNum % 1000 === 0) {
            console.log(lineNum + ' lines processed')
        }
    })
    .on('end', function() {
        console.log('writing files')
        fs.writeFileSync(outDir + '/annotations.json', JSON.stringify(annotations, null, 4))
        for (var i = 0; i < annotationData.length; i++) {
            if (isNaN(annotations[i].max) || isNaN(annotations[i].min)) {
                console.error('incorrect data, max/min is NaN for ' + annotations[i].name)
            }
            fs.writeFileSync(outDir + '/' + annotations[i].filename, JSON.stringify(annotationData[i], null, 4))
        }
        console.log('done')
    })
