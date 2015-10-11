'use strict'

if (!window.SCATTER || !window.SCATTER.config) {
    console.error('scatter configuration not loaded')
}
var config = window.SCATTER.config

var _ = require('lodash')
var React = require('react')
var ReactRouter = require('react-router')
var Router = ReactRouter.Router
var Route = ReactRouter.Route
var Radium = require('radium')
var createBrowserHistory = require('history/lib/createBrowserHistory')
var scatter = require('../js/scatter')

var styles = {
    app: {
        display: 'flex',
        flexFlow: 'row nowrap',
        cursor: 'default',
	color: 'rgb(' + config.defaultGray + ',' + config.defaultGray + ',' + config.defaultGray + ')'
    },
    message: {
        flex: '2 0 auto',
        display: 'flex',
        flexFlow: 'row nowrap',
        alignItems: 'center',
        justifyContent: 'center'
    },
    menu: {
        flex: '0 0 auto',
        padding: '10px',
        backgroundColor: '#000000',
        userSelect: 'none',
        width: '15%',
	maxWidth: '250px'
    },
    optionRow: {
        padding: '0 0 10px 0'
    },
    annotations: {
        padding: ''
    },
    annotationsLoadAll: {
        cursor: 'pointer',
        fontSize: '0.75em',
        padding: '4px 0',
    },
    annotationItem: {
        cursor: 'pointer',
        fontSize: '0.75em',
        padding: '2px 0',
    },
    annotationItemChild: {
        fontSize: '0.75em',
        padding: '0 0 0 10px',
    },
    annotationItemQuantity: {
	float: 'right'
    },
    arrow: {
        cursor: 'pointer',
        fill: '#999999',
        ':hover': {
            fill: '#ffffff'
        }
    }
}

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
            selectedAnnotationItem: null,
        }
    },

    componentDidMount: function() {

        var domNode = React.findDOMNode(this)
        var hashIndex = {x: 1, y: 2, z: 3}

        var that = this
        d3.json(config.annotationDir + 'annotations.json', function(err, data) {
            if (err) console.error(err)
            else {
                that.setState({
                    menuItems: data
                })
            }
        })
        this.loadData(hashIndex, function(err) {
            if (err) this.setState({error: err})
            else {
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
                    scatter.initialize(domNode, this, scatterWidth, scatterHeight, this.state.pointData[hashIndex['x']], this.state.pointData[hashIndex['y']], this.state.pointData[hashIndex['z']])
                    this.setState({
                        isInitialized: true
                    })
                }.bind(this), 50)
            }
        }.bind(this))
    },

    // TODO binary data
    loadData: function(hashIndex, callback) {

        var that = this
        window.performance && window.performance.mark('data_load_start_' + this.state.numLoads)

        var q = queue()
        _.forEach(hashIndex, function(index, axis) {
            q.defer(d3.json, config.dataDir + config.dataPrefix + index + '.json')
        }, this)

        q.awaitAll(function(err, results) {
            if (err) return callback(err)
            _.forEach(results, function(result) {
                if (!result.values || result.index == undefined || result.max == undefined) {
                    console.error('invalid data, has to contain .values, .index and .max')
                } else {
                    var arr = new Uint16Array(result.values.length)
                    for (var i = 0; i < result.values.length; i++) {
                        arr[i] = (result.values[i] / result.max + 1) / 2 * 65535
                    }
                    that.state.pointData[result.index] = arr
                }
            })
            window.performance && window.performance.mark('data_load_stop')
            window.performance && window.performance.measure('data_load', 'data_load_start_' + that.state.numLoads, 'data_load_stop')
            callback(null)
        })
    },

    loadAllAnnotations: function() {

	var that = this
	window.performance && window.performance.mark('annotations_load_start')
	var q = queue()
	_.forEach(this.state.menuItems, function(item) {
	    _.forEach(item.children, function(child) {
		var lcase = child.name.toLowerCase()
		d3.json(config.annotationDir + child.filename, function(err, data) {
		    if (err) console.error(err)
		    else {
			that.state.annotations[lcase] = data
		    }
		})
	    })
	    var lcase = item.name.toLowerCase()
	    d3.json(config.annotationDir + item.filename, function(err, data) {
		if (err) console.error(err)
		else {
		    that.state.annotations[lcase] = data
		}
	    })
	})
	q.awaitAll(function(err, results) {
	    if (err) return callback(err)
	    window.performance && window.performance.mark('annotations_load_stop')
	    window.performance && window.performance.measure('annotations_load', 'annotations_load_start', 'annotations_load_stop')
	    window.performance && console.log(window.performance.getEntriesByName('annotations_load')[0].duration + 'ms: annotations_load')
	    that.setState({
		annotations: that.state.annotations
	    })
	})
    },

    setAnnotationByName: function(name) {
	this.setAnnotation(this.state.annotations[name.toLowerCase()])
    },
    
    setAnnotation: function(item) {

        var that = this
        if (!item) {
            scatter.setAnnotations(null)
        } else {
	    var lcase = item.name.toLowerCase()
            if (this.state.annotations[lcase]) {
                scatter.setAnnotations(this.state.annotations[lcase], item.type, item.min, item.max)
            } else {
                d3.json(config.annotationDir + item.filename, function(err, data) {
                    if (err) console.error(err)
                    else {
                        scatter.setAnnotations(data, item.type, item.min, item.max)
                        that.state.annotations[lcase] = data
                        that.setState({
                            annotations: that.state.annotations
                        })
                    }
                })
            }
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
                if (err) console.error(err)
                else {
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

    onAnnotationClick: function(item, isChild) {

        if (this.state.selectedAnnotationItem === item || _.includes(item.children, this.state.selectedAnnotationItem)) {
            this.setAnnotation(null)
            var isOpen = this.state.openAnnotationItem === item
            this.setState({
                openAnnotationItem: isOpen ? null : item,
                selectedAnnotationItem: null
            })
        } else {
            this.setAnnotation(item)
            if (isChild) {
                this.setState({
                    selectedAnnotationItem: item
                })
            } else {
                var isOpen = this.state.openAnnotationItem === item
                this.setState({
                    openAnnotationItem: isOpen ? null : item,
                    selectedAnnotationItem: item
                })
            }
        }
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
                    var dynamicStyle = this.state.selectedAnnotationItem === child ? {color: '#ffffff'} : null
		    var desc = !!child.numAnnotated ? child.numAnnotated : ''
		    if (this.state.highlights && this.state.highlights[child.name.toLowerCase()]) {
			var highlight = this.state.highlights[child.name.toLowerCase()]
			desc = Math.round(100 * highlight.numHighlighted / highlight.numHighlightedTotal) + ' %'
			dynamicStyle = {
			    color: 'rgb(' + highlight.color.r + ', ' + highlight.color.g + ', ' + highlight.color.b + ')'
			}
		    }
                    return (
                            <div
                        key={child.name}
                        style={[styles.annotationItem, styles.annotationItemChild, dynamicStyle]}
                        onClick={this.onAnnotationClick.bind(null, child, true)}>
                            {child.name.toUpperCase()}
			    <span style={styles.annotationItemQuantity}>{desc}</span>
                        </div>
                    )
                }, this)
            }
            
            var dynamicStyle = this.state.selectedAnnotationItem === item ? {color: '#ffffff'} : null
	    var desc = !!item.numAnnotated ? item.numAnnotated : ''
	    if (this.state.highlights && this.state.highlights[item.name.toLowerCase()]) {
		var highlight = this.state.highlights[item.name.toLowerCase()]
		desc = Math.round(100 * highlight.numHighlighted / highlight.numHighlightedTotal) + ' %'
		dynamicStyle = {
		    color: 'rgb(' + highlight.color.r + ', ' + highlight.color.g + ', ' + highlight.color.b + ')'
		}
	    }
            return (
                    <div key={item.name}>
                    <div style={[styles.annotationItem, dynamicStyle]} onClick={this.onAnnotationClick.bind(null, item, false)}>
		    <div>{item.name.toUpperCase()}
		    <span style={styles.annotationItemQuantity}>{desc}</span>
		    </div>
                    </div>
                    {childItems}
                </div>
            )
        }, this)
        
        return (
                <div id='app' style={styles.app}>
                <div ref='menu' id='menu' style={styles.menu}>
                {axisOptions}
                <div id='annotation'>
		<div style={styles.annotationsLoadAll} onClick={this.loadAllAnnotations}>LOAD ALL</div>
                {menuOptions}
            </div>
                </div>
                {!this.state.isInitialized ?
                 <div id='message' style={styles.message}><div>{message}</div></div>
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
