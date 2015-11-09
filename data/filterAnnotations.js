var _ = require('lodash')
var fs = require('fs')
var splitter = require('split')

if (process.argv.length != 5) {
    console.log('filter annotation files based on a subset of samples')
    console.log('usage: node filterAnnotations annotationDir oldSampleFile newSampleFile')
    process.exit(1)
}
if (!fs.existsSync(process.argv[2])) {
    console.error('directory does not exist: ' + process.argv[2])
    process.exit(1)
}

var samples = {}
_.forEach(_.compact(fs.readFileSync(process.argv[4], 'utf8').split(/\r?\n|\r/)), function(sample) {
    samples[sample] = true
})
console.log(_.size(samples) + ' samples to include')

var oldSamples = _.compact(fs.readFileSync(process.argv[3], 'utf8').split(/\r?\n|\r/))
var removeIndices = {}
for (var i = 0; i < oldSamples.length; i++) {
    if (!samples[oldSamples[i]]) {
	removeIndices[i] = true
    }
}
console.log(oldSamples.length + ' old samples, ' + _.size(removeIndices) + ' samples to remove')

var newDir = process.argv[2] + '_new'
if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir)
}
var files = fs.readdirSync(process.argv[2])
_.forEach(files, function(file) {
    if (file.indexOf('annotation_') === 0) {
	var annotations = JSON.parse(fs.readFileSync(process.argv[2] + '/' + file))
	if (annotations.annotated.length != oldSamples.length) {
	    console.error('wrong number of annotations in ' + file + ': ' + annotations.annotated.length)
	} else {
	    var newAnnotated = []
	    var newNum = 0
	    for (var i = 0; i < annotations.annotated.length; i++) {
		if (!removeIndices[i]) {
		    newAnnotated.push(annotations.annotated[i])
		    if (annotations.annotated[i] === 1) {
			newNum++
		    }
		}
	    }
	    annotations.annotated = newAnnotated
	    annotations.numAnnotated = newNum
	    fs.writeFileSync(newDir + '/' + file, JSON.stringify(annotations, null, 4), 'utf8')
	}
    }
})

