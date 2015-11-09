'use strict'

module.exports = {

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
        flex: '1 1 auto',
        padding: '10px',
        backgroundColor: '#000000',
        userSelect: 'none',
        width: '15%',
        maxWidth: '300px',
        minWidth: '150px',
        height: window.innerHeight,
        overflowY: 'auto'
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
    selectedAnnotationItems: [
        {
            color: '#ffffff'
        },
        {
            color: '#ffffff'
        },
        {
            color: '#ffffff'
        }
    ],
    arrow: {
        cursor: 'pointer',
        fill: '#999999',
        ':hover': {
            fill: '#ffffff'
        }
    },
    bar: {
        float: 'right',
        backgroundColor: '#000000'
    },
    spread: {
        cursor: 'pointer',
        float: 'left',
        padding: '5px 5px 0 0'
    }
}
