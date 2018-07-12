const
    express = require('express'),
    app = express(),

    {resolve} = require('path'),

    port = arg( "--port", 3020 ),
    docpath = resolve( __dirname, arg( "--docs", "../../Alorica/etl" ) );

app
    .use( "/data/docs", express.static( docpath, { setHeaders(res) { res.set( 'content-type', 'application/json' ) } } ) )
    .use( express.json() );

app
    .route( "/data/list" )
        .get( api( listDocuments ) )
        .post( api( addDocuments ) );

app
    .route( "/data/list/:doc" )
        .get( api( listQuestions ) )
        .post( api( addQuestions ) );


app.listen( port );

function arg( name, default_value ) {
    const i = process.argv.indexOf( name );
    return i >= 0 && process.argv[i+1] || default_value;
}

function api( handler ) {
    return (req, res, next) => {
        try {
            const result = handler( req );
            if( typeof( result.then ) === "function" )
                result.then( ok, fail );
            else
                ok( result );
        } catch( err ) {
            fail( err );
        }

        function ok( response ) {
            res.writeHead( 200, { 'content-type': 'application/json' } );
            res.end( JSON.stringify( response ) );
        }

        function fail( err ) {
            res.writeHead( 500, { 'content-type': 'text/plain' } );
            console.error( err.stack );
            res.end( err.stack );
        }
    }
}

function listDocuments() {
    return [ "123", "456" ]
}

function addDocuments( {body: docs} ) {
    console.log( `Adding: ${docs}` );
    return {}
}

function listQuestions( {params:{doc}} ) {
    console.log( `Listing questions for ${doc}` );
    return [ "Why?" ]
}

function addQuestions( {params:{doc}, body: questions} ) {
    console.log( `Adding questions for ${doc}: ${questions}` );
    return {}
}

