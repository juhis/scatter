'use strict'

var _ = require('lodash')
var React = require('react')
var ReactRouter = require('react-router')
var Router = ReactRouter.Router
var Route = ReactRouter.Route
var Radium = require('radium')
var createBrowserHistory = require('history/lib/createBrowserHistory')
var config = require('../../config/config')
var scatter = require('../js/scatter')

var styles = {
    app: {
        display: 'flex',
        flexFlow: 'row nowrap',
        cursor: 'default',
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
        width: '15%'
    },
    optionRow: {
        padding: '0 0 10px 0'
    },
    annotations: {
        padding: ''
    },
    annotationItem: {
        cursor: 'pointer',
        fontSize: '0.75em',
        padding: '2px 0',
    },
    annotationItemChild: {
        padding: '0 10px',
        fontSize: '0.75em',
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
            if (err) {
                callback(err)
            } else {
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
            }
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
                scatter.setAnnotations(this.state.annotations[lcase])
            } else {
                d3.json(config.annotationDir + item.filename, function(err, data) {
                    if (err) console.error(err)
                    else {
                        scatter.setAnnotations(data)
                        that.state.annotations[lcase] = data
                        that.setState({
                            annotations: that.state.annotations
                        })
                    }
                })
            }
        }
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
                    return (
                            <div
                        key={child.name}
                        style={[styles.annotationItem, styles.annotationItemChild, dynamicStyle]}
                        onClick={this.onAnnotationClick.bind(null, child, true)}>
                            {child.name.toUpperCase() + (!!child.numAnnotated ? ' (' + child.numAnnotated + ')' : '')}
                        </div>
                    )
                }, this)
            }
            
            var dynamicStyle = null
            if (this.state.selectedAnnotationItem === item) {
                dynamicStyle = {
                    color: '#ffffff'
                }
            }
            return (
                    <div key={item.name} >
                    <div style={[styles.annotationItem, dynamicStyle]} onClick={this.onAnnotationClick.bind(null, item, false)}>
                    {item.name.toUpperCase() + (!!item.numAnnotated ? ' (' + item.numAnnotated + ')' : '')}
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

React.render(routes, document.body)
