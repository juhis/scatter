var fs = require('fs')

if (process.argv.length !== 4) {
    console.log('converts json annotations in given directory to binary ones writing to given out directory')
    console.log('usage: node convertAnnotationsToBinary indir outdir')
    process.exit(1)
}

var inDir = process.argv[2]
var outDir = process.argv[3]

var annotationItems = JSON.parse(fs.readFileSync(inDir + '/annotations.json', 'utf8'))
var numAnnotationItems = 0
for (var i = 0; i < annotationItems.length; i++) {
    numAnnotationItems++
    if (annotationItems[i].children) {
        numAnnotationItems += annotationItems[i].children.length
    }
}
var dataLength = JSON.parse(fs.readFileSync(inDir + '/' + annotationItems[0].filename, 'utf8')).length
console.log('number of annotation items: ' + numAnnotationItems + ', data length: ' + dataLength)

var buf = new Buffer(numAnnotationItems * dataLength)
var numDone = 0
for (var i = 0; i < annotationItems.length; i++) {
    var item = annotationItems[i]
    var ann = JSON.parse(fs.readFileSync(inDir + '/' + item.filename, 'utf8'))
    if (ann.length !== dataLength) {
        console.error('data length has to be the same for all annotation files')
        process.exit(1)
    }
    handleItem(item, ann)
    if (item.children) {
        for (var j = 0; j < item.children.length; j++) {
            var annC = JSON.parse(fs.readFileSync(inDir + '/' + item.children[j].filename, 'utf8'))
            handleItem(item.children[j], annC)
            delete item.children[j].filename
        }
    }
    delete item.filename
}

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir)
}
fs.writeFileSync(outDir + '/annotations.json', JSON.stringify(annotationItems, null, 4), 'utf8')
fs.writeFileSync(outDir + '/annotations.buffer', buf)
console.log('annotations written to ' + outDir)

function handleItem(item, ann) {

    if (item.type === 'binary') {
        for (var j = 0; j < ann.length; j++) {
            buf[numDone * dataLength + j] = ann[j]
        }
    } else if (item.type === 'continuous') {
        for (var j = 0; j < ann.length; j++) {
            buf[numDone * dataLength + j] = Math.floor(255 * (ann[j] - item.min) / (item.max - item.min))
        }
    } else {
        console.error('unknown annotation type: ' + item.type)
        process.exit(1)
    }
    numDone++
}
