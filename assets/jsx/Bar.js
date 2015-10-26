'use strict'

var React = require('react')
var Radium = require('radium')

module.exports = Radium(React.createClass({

    propTypes: {

        width: React.PropTypes.number.isRequired,
        height: React.PropTypes.number.isRequired,
        percentage: React.PropTypes.number,
        style: React.PropTypes.object
    },

    getInitialState: function() {

        return {
            ctx: null
        }
    },
    
    componentDidMount: function() {

        var domNode = React.findDOMNode(this)
        var ctx = domNode.getContext('2d')

        this.setState({
            ctx: ctx
        })
    },

    componentWillReceiveProps: function(newProps) {
        
        this.state.ctx.fillStyle = (newProps.style && newProps.style.backgroundColor) || 'rgb(' + config.defaultGray + ',' + config.defaultGray + ',' + config.defaultGray + ')'
        this.state.ctx.fillRect(0, 0, newProps.width, newProps.height)
        
        var w = (newProps.percentage || 0) / 100 * newProps.width
        this.state.ctx.fillStyle = (newProps.style && newProps.style.barColor) || '#ffffff'
        this.state.ctx.fillRect(0, 0, w, newProps.height)
    },
    
    render: function() {
        return (
                <canvas width={this.props.width} height={this.props.height} style={this.props.style}>
                </canvas>
        )
    }
}))
