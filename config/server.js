var server = {

    // which port to run the server on by default
    // can be overridden with a command line argument
    port: 8080,
}

if (typeof module === 'object' && module.exports) {
    module.exports = server
}
