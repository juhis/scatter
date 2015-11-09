'use strict'

var React = require('react')
var Radium = require('radium')

module.exports = Radium(React.createClass({

    propTypes: {

        width: React.PropTypes.number.isRequired,
        height: React.PropTypes.number.isRequired,
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

        this.state.ctx.fillStyle = (newProps.style && newProps.style.color) || 'rgb(' + config.defaultGray + ',' + config.defaultGray + ',' + config.defaultGray + ')'
        if (newProps.dimensions) {
            for (var i = 0, len = newProps.dimensions.length; i < len; i++) {
                var loc = Math.min(newProps.dimensions[i] / (newProps.maxDimensions || 10), 1) * newProps.height - 1
                this.state.ctx.fillRect(i / len * newProps.width, loc, (i + 1) / len * newProps.width, newProps.height)
            }
        }
    },
    
    render: function() {
        
        return (
                <canvas width={this.props.width} height={this.props.height} style={this.props.style} onClick={this.props.onClick && this.props.onClick.bind(null, this.props.dimensions)}>
                </canvas>
        )
    }
}))
