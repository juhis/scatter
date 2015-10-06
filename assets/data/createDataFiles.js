var fs = require('fs')
var splitter = require('split')
var tab = /\t/

if (process.argv.length < 3) {
    console.log('converts a given tab-delimited matrix to JSON files, one file per column in the input matrix')
    console.log('usage: node createDataFiles inputfile [outputfileprefix]')
    process.exit(1)
}

var filePrefix = process.argv[3] || 'PC'
var pcData = []
var lineNum = 0

fs.createReadStream(process.argv[2])
    .pipe(splitter())
    .on('data', function(line) {
        var split = line.split(tab)
        if (lineNum === 0) {
            for (var i = 0; i < split.length; i++) {
                pcData.push({
                    index: (i+1),
                    max: 0,
                    values: []
                })
            }
        } else {
            var max = 0
            for (var i = 1; i < split.length; i++) {
                pcData[i-1].values.push(+split[i])
                pcData[i-1].max = Math.max(pcData[i-1].max, Math.abs(+split[i]))
            }
        }
        lineNum++
        if (lineNum % 1000 === 0) {
            console.log(lineNum + ' lines processed')
        }
    })
    .on('end', function() {
        console.log('writing json files')
        for (var i = 0; i < pcData.length; i++) {
            fs.writeFileSync(filePrefix + (i+1) + '.json', JSON.stringify(pcData[i], null, 4))
        }
        console.log('done')
    })
