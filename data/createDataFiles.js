'use strict'

var fs = require('fs')
var splitter = require('split')
var tab = /\t/

if (process.argv.length < 4) {
    console.log('converts a given tab-delimited matrix to JSON and binary files, one file per column in the input matrix. note: scales data to 0-65535 for each column!')
    console.log('usage: node createDataFiles inputfile outdir')
    process.exit(1)
}

var ids = []
var data = []
var lineNum = 0

var outDir = process.argv[3]
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir)
}
var headers = null

fs.createReadStream(process.argv[2])
    .pipe(splitter())
    .on('data', function(line) {
        var split = line.split(tab)
        if (lineNum === 0) {
            headers = split.slice(1)
            for (var i = 0; i < split.length; i++) {
                data.push({
                    index: (i+1),
                    max: 0,
                    min: Number.MAX_VALUE,
                    values: []
                })
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
                ids.push(split[0])
                for (var i = 1; i < split.length; i++) {
                    data[i-1].values.push(+split[i])
                    data[i-1].max = Math.max(data[i-1].max, Math.abs(+split[i]))
                    data[i-1].min = Math.min(data[i-1].min, +split[i])
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
        fs.writeFileSync(outDir + '/ids.json', JSON.stringify(ids, null, 4))
        fs.writeFileSync(outDir + '/labels.json', JSON.stringify(headers, null, 4))
        for (var i = 0; i < data.length; i++) {
            if (isNaN(data[i].max) || isNaN(data[i].min)) {
                console.error('incorrect data, max/min is NaN for dimension ' + (i + 1) + ': ' + headers[i])
            }
            fs.writeFileSync(outDir + '/' + data[i].index + '.json', JSON.stringify(data[i], null, 4))
            var buf = new Buffer(2 * data[i].values.length)
            for (var j = 0; j < buf.length; j+=2) {
                buf.writeUInt16LE(((data[i].values[j/2] - data[i].min) / (data[i].max - data[i].min) + 1) / 2 * 65535, j)
            }
            fs.writeFileSync(outDir + '/' + data[i].index + '.buffer', buf)
        }
        console.log('done')
    })
