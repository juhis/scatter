'use strict'

if (!window.SCATTER || !window.SCATTER.config) {
    console.error('scatter configuration not loaded')
}
var config = window.SCATTER.config

var _ = require('lodash')
var async = require('async')
var superagent = require('superagent')
var React = require('react')
var ReactRouter = require('react-router')
var Router = ReactRouter.Router
var Route = ReactRouter.Route
var Radium = require('radium')
var createBrowserHistory = require('history/lib/createBrowserHistory')
var styles = require('./styles')
var Spread = require('./Spread')
var Bar = require('./Bar')
var scatter = require('../js/scatter')

var message = _.sample([
    'LOADING VISUALIZATION',
])

var Arrow = Radium(React.createClass({

    propTypes: {
        direction: React.PropTypes.string.isRequired,
        disabled: React.PropTypes.bool,
        onClick: React.PropTypes.func,
    },
    
    render: function() {

        var x1 = 20, x2 = 60
        if (this.props.direction === 'left') {
            x2 = 20, x1 = 60
        }

        var style = styles.arrow
        if (this.props.disabled) {
            style = {fill: '#4d4d4d'}
        }
        
        return (
                <span onClick={this.props.disabled !== true && this.props.onClick}>
                <svg viewBox='0 0 80 100' width='14' height='14' style={style}>
                <circle cx={x1} cy='20' r='15' strokeWidth='0'></circle>
                <circle cx={x1} cy='80' r='15' strokeWidth='0'></circle>
                <circle cx={x2} cy='50' r='15' strokeWidth='0'></circle>
                </svg>
                </span>

        )
    }
}))

var ScatterApp = Radium(React.createClass({
    
    getInitialState: function() {

        return {
            pointData: [],
            annotations: {},
            x: 0,
            y: 0,
            z: 0,
            numLoads: 0,
            isInitialized: false,
            selectedAnnotationItems: [],
            selectedAnnotationValues: [],
        }
    },

    componentDidMount: function() {

        var domNode = React.findDOMNode(this)
        var dimensions = [1, 2, 3]

        async.waterfall([
            this.loadAnnotationItems,
            this.loadAllAnnotations,
            this.loadLabels,
            this.loadData.bind(this, dimensions)
        ], function(err) {
            if (err) {
                this.setState({
                    error: err
                })
                return console.error(err)
            } else {
                this.setState({
                    pointData: this.state.pointData,
                    x: dimensions[0],
                    y: dimensions[1],
                    z: dimensions[2],
                    numLoads: this.state.numLoads + 1
                })
                setTimeout(function() { // timeout to allow state update before scatter initialization
                    var scatterWidth = window.innerWidth - ((this.refs.menu && this.refs.menu.getDOMNode().offsetWidth) || 100)
                    var scatterHeight = window.innerHeight
                    scatter.initialize(domNode,
                                       this,
                                       scatterWidth,
                                       scatterHeight,
                                       this.state.pointData[dimensions[0]],
                                       this.state.pointData[dimensions[1]],
                                       this.state.pointData[dimensions[2]],
                                       this.state.labels,
                                       this.state.onlyPositive)
                    this.updateAnnotationColors(scatter.getAnnotationColorsRGBString())
                    window.addEventListener('resize', this.handleResize);
                    this.setState({
                        isInitialized: true
                    })
                }.bind(this), 50)
            }
        }.bind(this))
    },

    handleResize: function(e) {
        
        styles.menu.height = window.innerHeight
        var scatterWidth = window.innerWidth - ((this.refs.menu && this.refs.menu.getDOMNode().offsetWidth) || 100)
        var scatterHeight = window.innerHeight
        scatter.resize(scatterWidth, scatterHeight)
        this.setState({
            //update
        })
    },

    loadLabels: function(callback) {

        var filename = config.data.dir + '/labels.json'

        superagent
            .get(filename)
            .accept('json')
            .end(function(err, res) {
                if (err) {
                    return callback(err)
                } else {
                    this.setState({
                        labels: res.body
                    })
                    return callback(null)
                }
            }.bind(this))
    },

    loadData: function(dimensions, callback) {

        var min = Number.MAX_VALUE
        
        async.eachSeries(dimensions, function(dimension, cb) {
            if (config.data.type === 'buffer') {
                var filename = config.data.dir + '/' + dimension + '.buffer'
                superagent
                    .get(filename)
                    .on('request', function() {
                        this.xhr.responseType = 'arraybuffer'
                    })
                    .end(function(err, res) {
                        if (err) {
                            if (err.message === 'Not Found') err.message += ': ' + filename
                            return cb(err)
                        } else {
                            var arr = new Uint16Array(res.xhr.response)
                            for (var i = 0; i < arr.length; i++) {
                                min = Math.min(min, arr[i])
                            }
                            this.state.pointData[dimension] = arr
                            return cb(null)
                        }
                    }.bind(this))
            } else if (config.data.type === 'json') {
                var filename = config.data.dir + '/' + dimension + '.json'
                superagent
                    .get(filename)
                    .accept('json')
                    .end(function(err, res) {
                        if (err) {
                            if (err.message === 'Not Found') err.message += ': ' + filename
                            return cb(err)
                        } else {
                            var data = res.body
                            if (!data.values || data.max == undefined) {
                                return cb({name: 'DataError', message: filename + ': invalid data, has to contain .values and .max'})
                            } else {
                                // scale to 0-65535
                                var arr = new Uint16Array(data.values.length)
                                for (var i = 0; i < data.values.length; i++) {
                                    if (data.min != undefined) {
                                        arr[i] = ((data.values[i] - data.min) / (data.max - data.min) + 1) / 2 * 65535
                                    } else {
                                        arr[i] = (data.values[i] / data.max + 1) / 2 * 65535
                                    }
                                    min = Math.min(min, arr[i])
                                }
                                this.state.pointData[data.index] = arr
                                return cb(null)
                            }
                        }
                    }.bind(this))
            } else {
                cb({name: 'ConfigError', message: 'Unknown type in config.data: ' + config.data.type})
            }
        }.bind(this), function(err) {
            if (err) return callback(err)
            else {
                this.setState({
                    onlyPositive: true//min >= 32767
                })
                return callback(null)
            }
        }.bind(this))
    },

    loadAnnotationItems: function(callback) {
        if (!config.data.annotationDir) {
            return callback(null, null)
        }
        var filename = config.data.annotationDir + '/annotations.json'
        superagent
            .get(filename)
            .accept('json')
            .end(function(err, res) {
                if (err) {
                    if (err.message === 'Not Found') err.message += ': ' + filename
                    return callback(err)
                } else {
                    var error = null
                    _.forEach(res.body, function(item) {
                        error = this.checkAnnotationItem(filename, item)
                        if (error) return false
                    }.bind(this))
                    if (error) {
                        this.setState({
                            error: error
                        })
                    } else {
                        this.setState({
                            menuItems: _.sortBy(res.body, 'name')
                        })
                    }
                    return callback(error, res.body)
                }
            }.bind(this))
    },

    checkAnnotationItem: function(filename, item) {
        var error = null
        if (!item.name || !item.type) {
            error = {name: 'DataError', message: filename + ': items have to contain .name and .type'}
        } else if (item.type === 'continuous' && (item.min == undefined || item.max == undefined)) {
            error = {name: 'DataError', message: filename + ': continuous items have to contain .min and .max'}
        } else if (item.type !== 'binary' && item.type !== 'continuous') {
            error = {name: 'DataError', message: filename + ': unknown item type: ' + item.type}
        } else {
            _.forEach(item.children, function(child) {
                error = this.checkAnnotationItem(filename, child)
                if (error) return false
            }.bind(this))
        }
        return error
    },

    loadAllAnnotations: function(items, callback) {

        if (!items) {
            return callback(null)
        }
        
        var itemsWithChildren = _.chain(items)
            .map(function(item) {
                return [item, item.children]
            })
            .flatten(true)
            .compact()
            .value()

        if (config.data.annotationType === 'json') { // annotations are in separate files
            async.eachSeries(itemsWithChildren, function(item, cb) {
                if (!item.filename) {
                    item.filename = 'annotations_' + item.name.replace(/\s/g, '_') + '.json'
                }
                var lcase = item.name.toLowerCase()
                var filename = config.data.annotationDir + '/' + item.filename
                superagent
                    .get(filename)
                    .accept('json')
                    .end(function(err, res) {
                        if (err) {
                            if (err.message === 'Not Found') err.message += ': ' + filename
                            return cb(err)
                        } else {
                            this.state.annotations[lcase] = res.body
                            return cb(null)
                        }
                    }.bind(this))
            }.bind(this), function(err) {
                if (err) {
                    return callback(err)
                } else {
                    this.setState({
                        annotations: this.state.annotations
                    })
                    return callback(null)
                }
            }.bind(this))
        } else if (config.data.annotationType === 'buffer') { // binary annotations // TODO bitmasking for binary binary annotations
            superagent
                .get(config.data.annotationDir + '/annotations.buffer')
                .on('request', function() {
                    this.xhr.responseType = 'arraybuffer'
                })
                .end(function(err, res) {
                    if (err) {
                        if (err.message === 'Not Found') err.message += ': ' + filename
                        return callback(err)
                    } else {
                        var allAnnotations = new Uint8Array(res.xhr.response)
                        var dataLength = allAnnotations.length / itemsWithChildren.length
                        for (var i = 0; i < itemsWithChildren.length; i++) {
                            var arr = []
                            for (var j = 0; j < dataLength; j++) {
                                arr.push(allAnnotations[i * dataLength + j])
                            }
                            this.state.annotations[itemsWithChildren[i].name.toLowerCase()] = arr
                        }
                        this.setState({
                            annotations: this.state.annotations
                        })
                        return callback(null)
                    }
                }.bind(this))
        } else {
            callback({name: 'ConfigError', message: 'Unknown annotationType in config.data: ' + config.data.annotationType})
        }
    },

    updateHighlights: function(highlights) {

        this.setState({
            highlights: highlights
        })
    },

    setDimensions: function(dimensions) {

        if (!dimensions || dimensions.length !== 3) {
            return console.warn('setDimensions takes three dimensions, got', dimensions)
        }

        async.each(dimensions, function(dimension, cb) { // load data for each dimension if not loaded
            if (!this.state.pointData[dimension]) {
                this.loadData(dimension, function(err) {
                    if (err) {
                        return cb(err)
                    } else {
                        return cb(null)
                    }
                })
            } else {
                return cb(null)
            }
        }.bind(this), function(err) {
            if (err) {
                this.setState({
                    error: err
                })
            } else {
                this.setDimension('x', dimensions[0], true)
                this.setDimension('y', dimensions[1], true)
                this.setDimension('z', dimensions[2], true)
            }
        }.bind(this))
    },
    
    setDimension: function(axis, dimension, spread) {

        if (this.state.pointData[dimension]) {
            scatter.setValues(axis, this.state.pointData[dimension], config.data)
            if (this.state.labels) {
                scatter.setLabel(axis, this.state.labels[dimension - 1])
            }
            var newState = {}
            newState[axis] = dimension
            if (spread !== true) {
                newState.spreadAnnotationItem = null
            }
            this.setState(newState)
        } else {
            this.loadData([dimension], function(err) {
                if (err) {
                    this.setState({
                        error: err
                    })
                    return console.error(err)
                } else {
                    scatter.setValues(axis, this.state.pointData[dimension], config.data)
                    if (this.state.labels) {
                        scatter.setLabel(axis, this.state.labels[dimension - 1])
                    }
                    var newState = {}
                    newState[axis] = dimension
                    if (spread !== true) {
                        newState.spreadAnnotationItem = null
                    }
                    newState.numLoads = this.state.numLoads + 1
                    this.setState(newState)
                }
            }.bind(this))
        }
    },

    updateAnnotationColors: function(colors) {

        for (var i = 0; i < colors.length; i++) {
            styles.selectedAnnotationItems[i].color = colors[i]
        }
        this.setState({
            // update
        })
    },

    setAnnotationByName: function(name) {

        var foundItem = null
        _.forEach(this.state.menuItems, function(item) {
            if (item.name.toLowerCase() === name) {
                foundItem = item
                return false
            }
        }.bind(this))
        return this.setAnnotation(foundItem)
    },

    deselectAnnotation: function(index) {

        this.state.selectedAnnotationItems.splice(index, 1)
        this.state.selectedAnnotationValues.splice(index, 1)
        styles.selectedAnnotationItems.push(styles.selectedAnnotationItems.splice(index, 1))
        scatter.cycleAnnotationColors(index)
    },
    
    onAnnotationClick: function(item, isChild, setDimensions) {

        var openItem = false, closeItem = false
        var index = this.state.selectedAnnotationItems.indexOf(item)
        if (index > -1) { // item is currently selected
            if (!setDimensions) {
                this.deselectAnnotation(index)
            }
            if (this.state.openAnnotationItem === item) { // close item
                if (item.children && item.children.length > 0) { // deselect selected children
                    _.forEach(item.children, function(child) {
                        var childIndex = this.state.selectedAnnotationItems.indexOf(child)
                        if (childIndex > -1) {
                            this.deselectAnnotation(childIndex)
                        }
                    }.bind(this))
                }
                closeItem = true
            }            
        } else {
            if (item.type === 'continuous') {
                // deselect all selected annotations
                for (var i = 0, len = this.state.selectedAnnotationItems.length; i < len; i++) {
                    this.state.selectedAnnotationItems.shift()
                    this.state.selectedAnnotationValues.shift()
                }
            } else {
                // if a continuous annotation is selected, deselect it
                if (this.state.selectedAnnotationItems.length === 1 && this.state.selectedAnnotationItems[0].type === 'continuous') {
                    this.state.selectedAnnotationItems.shift()
                    this.state.selectedAnnotationValues.shift()
                }
                // keep max three annotations selected, fifo
                if (this.state.selectedAnnotationItems.length === 3) {
                    this.state.selectedAnnotationItems.shift()
                    this.state.selectedAnnotationValues.shift()
                    // keep color order
                    styles.selectedAnnotationItems.push(styles.selectedAnnotationItems.shift())
                    scatter.cycleAnnotationColors()
                } else if (this.state.selectedAnnotationItems.length === 0) { // open children dropdown if the item has children
                    if (item.children && item.children.length > 0) {
                        openItem = true
                    }
                } else if (isChild) { // deselect parent if selected
                    _.forEach(this.state.selectedAnnotationItems, function(possibleParent, parentIndex) {
                        if (possibleParent.children && _.includes(possibleParent.children, item)) {
                            this.deselectAnnotation(parentIndex)
                            return false
                        }
                    }.bind(this))
                }
            }
            this.state.selectedAnnotationItems.push(item)
            this.state.selectedAnnotationValues.push(this.state.annotations[item.name.toLowerCase()])
        }

        this.setState({
            openAnnotationItem: openItem ? item : closeItem ? null : this.state.openAnnotationItem,
            selectedAnnotationItems: this.state.selectedAnnotationItems
        })

        if (setDimensions) {
            this.setDimensions(item.dimensions)
            this.setState({
                spreadAnnotationItem: item
            })
        }
    },
    
    render: function() {

        var axisOptions = _.map(['x', 'y', 'z'], function(a, i) {
            return (
                    <div key={'options' + a} style={styles.optionRow}>
                    <span style={{cursor: 'pointer', paddingRight: '10px'}} onClick={this.setDimension.bind(null, a, (i + 1))}>{a.toUpperCase()}</span>
                    <Arrow direction='left' onClick={this.setDimension.bind(null, a, this.state[a] - 1)} disabled={this.state[a] - 1 < 1} />
                    <span style={{padding: '0 5px'}}>{this.state[a]}</span>
                    <Arrow direction='right' onClick={this.setDimension.bind(null, a, this.state[a] + 1)} disabled={this.state[a] + 1 > (this.state.labels && this.state.labels.length || 10) || this.state[a] < 1} />
                </div>
            )
        }, this)

        var menuOptions = _.map(this.state.menuItems, function(item, index) {

            var childItems = null
            if (this.state.openAnnotationItem === item) {
                childItems = _.map(item.children, function(child) {
                    var dynamicStyle = null
                    _.forEach(this.state.selectedAnnotationItems, function(selectedItem, selectedIndex) {
                        if (child === selectedItem) {
                            dynamicStyle = styles.selectedAnnotationItems[selectedIndex]
                            return false
                        }
                    })
                    var desc = (<span style={styles.annotationItemQuantity}>{!!child.numAnnotated ? child.numAnnotated : ''}</span>)
                    if (this.state.highlights && this.state.highlights[child.name.toLowerCase()]) {
                        var highlight = this.state.highlights[child.name.toLowerCase()]
                        var percentage = Math.round(100 * highlight.numHighlighted / highlight.numHighlightedTotal)
                        desc = (<Bar width={50} height={10} percentage={percentage} style={styles.bar} />)
                        dynamicStyle = {
                            color: 'rgb(' + highlight.color.r + ', ' + highlight.color.g + ', ' + highlight.color.b + ')'
                        }
                    }
                    return (
                            <div
                        key={child.name}
                        style={[styles.annotationItem, styles.annotationItemChild, dynamicStyle]}
                        onClick={this.onAnnotationClick.bind(null, child, true, false)}>
                            {child.name.toUpperCase().replace(/_/g, ' ')}
                            <span style={styles.annotationItemQuantity}>{desc}</span>
                        </div>
                    )
                }, this)
            }

            var dynamicStyle = null
            _.forEach(this.state.selectedAnnotationItems, function(selectedItem, selectedIndex) {
                if (item === selectedItem) {
                    dynamicStyle = styles.selectedAnnotationItems[selectedIndex]
                    return false
                }
            })

            var desc = (<span style={styles.annotationItemQuantity}>{!!item.numAnnotated ? item.numAnnotated : ''}</span>)
            if (this.state.highlights && this.state.highlights[item.name.toLowerCase()]) {
                var highlight = this.state.highlights[item.name.toLowerCase()]
                var percentage = Math.round(100 * highlight.numHighlighted / highlight.numHighlightedTotal)
                desc = (<Bar width={50} height={10} percentage={percentage} style={styles.bar} />)
                dynamicStyle = {
                    color: 'rgb(' + highlight.color.r + ', ' + highlight.color.g + ', ' + highlight.color.b + ')'
                }
            }
            
            var spreadStyle = styles.spread
            if (this.state.spreadAnnotationItem === item) {
                spreadStyle = _.clone(styles.spread)
                spreadStyle.color = '#ffffff'
            }
            
            return (
                    <div key={item.name}>
                    {config.data.spread ? (<Spread width={10} height={10} style={spreadStyle} dimensions={item.dimensions} maxDimensions={this.state.labels && this.state.labels.length}
                                           onClick={this.onAnnotationClick.bind(null, item, false, true)} />) : null}
                    <div style={[styles.annotationItem, dynamicStyle]} onClick={this.onAnnotationClick.bind(null, item, false, false)}>
                    <div>{item.name.toUpperCase().replace(/_/g, ' ')}
                {desc}
                    </div>
                    </div>
                    {childItems}
                </div>
            )
        }, this)

        var msg = this.state.error ? this.state.error.message : message
        return (
                <div id='app' style={styles.app}>
                <div ref='menu' id='menu' style={styles.menu}>
                {axisOptions}
                <div id='annotation'>
                {menuOptions}
            </div>
                </div>
                {!this.state.isInitialized || this.state.error ?
                 <div id='message' style={styles.message}><div>{msg}</div></div>
                 : null}
            </div>
        )
    }
}))

var routes = (
        <Router history={createBrowserHistory()}>
        <Route path='/' component={ScatterApp} />
        </Router>
)

React.render(routes, document.getElementById('content'))
