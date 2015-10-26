var fs = require('fs')
var splitter = require('split')
var tab = /\t/

if (process.argv.length < 4) {
    console.log('converts a given tab-delimited matrix to JSON and binary files, one file per column in the input matrix. note: scales data to 0-65535 for each column!')
    console.log('usage: node createDataFiles inputfile outdir [outputfileprefix]')
    process.exit(1)
}

var filePrefix = process.argv[4] || 'PC'
var pcData = []
var lineNum = 0

var outDir = process.argv[3]
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir)
}
var samples = {}
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
        console.log('writing files')
        for (var i = 0; i < pcData.length; i++) {
            if (isNaN(pcData[i].max)) {
                console.error('incorrect data, max is NaN for dimension ' + (i + 1))
            }
            fs.writeFileSync(outDir + '/' + filePrefix + (i+1) + '.json', JSON.stringify(pcData[i], null, 4))
            var buf = new Buffer(2 * pcData[i].values.length)
            for (var j = 0; j < buf.length; j+=2) {
                buf.writeUInt16LE((pcData[i].values[j/2] / pcData[i].max + 1) / 2 * 65535, j)
            }
            fs.writeFileSync(outDir + '/' + filePrefix + pcData[i].index + '.buffer', buf)
        }
        console.log('done')
    })
