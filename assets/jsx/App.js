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
        var hashIndex = {x: 1, y: 2, z: 3}

        async.waterfall([
            this.loadAnnotationItems,
            this.loadAllAnnotations,
            this.loadData.bind(this, hashIndex)
        ], function(err) {
            if (err) {
                this.setState({
                    error: err
                })
                return console.error(err)
            } else {
                this.setState({
                    pointData: this.state.pointData,
                    x: hashIndex['x'],
                    y: hashIndex['y'],
                    z: hashIndex['z'],
                    numLoads: this.state.numLoads + 1
                })
                setTimeout(function() { // timeout to allow state update before scatter initialization
                    var scatterWidth = window.innerWidth - ((this.refs.menu && this.refs.menu.getDOMNode().offsetWidth) || 100)
                    var scatterHeight = window.innerHeight
                    scatter.initialize(domNode,
                                       this,
                                       scatterWidth,
                                       scatterHeight,
                                       this.state.pointData[hashIndex['x']],
                                       this.state.pointData[hashIndex['y']],
                                       this.state.pointData[hashIndex['z']])
                    this.updateAnnotationColors(scatter.getAnnotationColorsRGBString())
                    this.setState({
                        isInitialized: true
                    })
                }.bind(this), 50)
            }
        }.bind(this))
    },

    loadData: function(hashIndex, callback) {

        var numLoads = this.state.numLoads

        async.eachSeries(_.keys(hashIndex), function(axis, cb) {
            if (config.data.type === 'buffer') {
                var filename = config.data.dir + '/' + config.data.prefix + hashIndex[axis] + '.buffer'
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
                            this.state.pointData[hashIndex[axis]] = arr
                            return cb(null)
                        }
                    }.bind(this))
            } else if (config.data.type === 'json') {
                var filename = config.data.dir + '/' + config.data.prefix + hashIndex[axis] + '.json'
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
                                    arr[i] = (data.values[i] / data.max + 1) / 2 * 65535
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
                return callback(null)
            }
        })
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
                            menuItems: res.body
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
        } else if (item.type === 'binary' && item.numAnnotated == undefined) {
            error = {name: 'DataError', message: filename + ': binary items have to contain .numAnnotated'}
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
    
    setComponent: function(axis, component) {

        if (this.state.pointData[component]) {
            scatter.setValues(axis, this.state.pointData[component])
            this.setState({
                pointData: this.state.pointData,
                x: axis === 'x' ? component : this.state.x,
                y: axis === 'y' ? component : this.state.y,
                z: axis === 'z' ? component : this.state.z,
            })
        } else {
            var obj = {}
            obj[axis] = component
            this.loadData(obj, function(err) {
                if (err) {
                    scatter.hide()
                    this.setState({
                        error: err
                    })
                    return console.error(err)
                } else {
                    scatter.setValues(axis, this.state.pointData[component])
                    this.setState({
                        pointData: this.state.pointData,
                        x: obj['x'] || this.state.x,
                        y: obj['y'] || this.state.y,
                        z: obj['z'] || this.state.z,
                        numLoads: this.state.numLoads + 1
                    })
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
    
    // TODO if continuous, clear previous
    onAnnotationClick: function(item, isChild) {

        var openItem = false, closeItem = false
        var index = this.state.selectedAnnotationItems.indexOf(item)
        if (index > -1) { // item is currently selected
            this.deselectAnnotation(index)
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
            this.state.selectedAnnotationItems.push(item)
            this.state.selectedAnnotationValues.push(this.state.annotations[item.name.toLowerCase()])
        }

        this.setState({
            openAnnotationItem: openItem ? item : closeItem ? null : this.state.openAnnotationItem
        })
    },
    
    render: function() {

        var axisOptions = _.map(['x', 'y', 'z'], function(a) {
            return (
                    <div key={'options' + a} style={styles.optionRow}>
                    <span style={{paddingRight: '10px'}}>{a.toUpperCase()}</span>
                    <Arrow direction='left' onClick={this.setComponent.bind(null, a, this.state[a] - 1)} disabled={this.state[a] - 1 < 1} />
                    <span style={{padding: '0 5px'}}>{this.state[a]}</span>
                    <Arrow direction='right' onClick={this.setComponent.bind(null, a, this.state[a] + 1)} disabled={this.state[a] + 1 > (config.numDimensions || 10) || this.state[a] < 1} />
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
                        onClick={this.onAnnotationClick.bind(null, child, true)}>
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
            return (
                    <div key={item.name}>
                    <div style={[styles.annotationItem, dynamicStyle]} onClick={this.onAnnotationClick.bind(null, item, false)}>
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
