var fs = require('fs')
var splitter = require('split')
var tab = /\t/

if (process.argv.length < 4) {
    console.log('transposes a given tab-delimited matrix')
    console.log('usage: node transpose inputfile outputfile')
    process.exit(1)
}


var data = []
var rowHeaders = []
var colHeaders = null

var lineNum = 0
fs.createReadStream(process.argv[2])
    .pipe(splitter())
    .on('data', function(line) {
        var split = line.split(tab)
        if (split.length > 1) {
            if (lineNum === 0) {
                colHeaders = split.slice(1)
            } else {
                rowHeaders.push(split[0])
                var row = []
                for (var i = 1; i < split.length; i++) {
                    row.push(+split[i])
                }
                data.push(row)
            }
            lineNum++
            if (lineNum % 1000 === 0) {
                console.log(lineNum + ' lines processed')
            }
        }
    })
    .on('end', function() {
        console.log('writing ' + process.argv[3])
        var fh = fs.openSync(process.argv[3], 'w')
        fs.writeSync(fh, '-\t' + rowHeaders.join('\t') + '\n')
        for (var i = 0; i < data[0].length; i++) {
            fs.writeSync(fh, colHeaders[i])
            for (var j = 0; j < data.length; j++) {
                fs.writeSync(fh, '\t' + data[j][i])
            }
            fs.writeSync(fh, '\n')
        }
    })
