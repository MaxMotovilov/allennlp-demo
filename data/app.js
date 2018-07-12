'use strict';

const
    express = require('express'),
    app = express(),

    {resolve} = require('path'),
    {read, update} = require('./update'),
    {pathExists, readFile} = require('fs-extra'),

    port = arg( "--port", 3020 ),
    docpath = resolve( __dirname, arg( "--docs", "../../Alorica/etl" ) );

app
    .use( express.json() )
    .route( "/data" )
        .get( api( listDocuments ) )
        .post( api( addDocuments ) );

app
    .route( "/data/:doc" )
        .get( api( readDocument ) );

app
    .route( "/data/:doc/questions" )
        .get( api( listQuestions ) )
        .post( api( addQuestions ) );

console.log( `Listening on ${port}` );
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
            res.writeHead( err.httpCode || 500, { 'content-type': 'text/plain' } );
            console.error( err.stack );
            res.end( err.stack );
        }
    }
}

function failure( code, message ) {
    const e = new Error( message );
    e.httpCode = code;
    return e;
}

function readJsonLine( path ) {
    return readFile( path ).then( buf => buf.toString("utf8").split( "\n" ).filter( x => x ).map( x => JSON.parse( x ) ) );
}

function listDocuments() {
    console.log( "Listing documents" );
    return read().then( Object.keys );
}

function addDocuments( {body: docs} ) {
    console.log( `Adding: ${docs}` );

    return Promise
        .all( docs.map( id => pathExists( resolve( docpath, `${id}.l.json` ) ) ) )
        .then(
            checks => {
                const missing = docs.filter( (_,i) => !checks[i] );
                if( missing.length )
                    throw failure( 400, `Missing data files: ${missing}` );

                return update(
                    all => docs.reduce(
                        (dict, id) => {
                            if( !dict[id] )
                                dict[id] = []
                            return dict;
                        }, all
                    )
                ).then( Object.keys );
            }
        );
}

function readDocument( {params: {doc}} ) {
    console.log( `Serving document ${doc}` );
    return readJsonLine( resolve( docpath, `${doc}.l.json` ) ).then(
        docs => docs.map( ({cpar, section}) => ({cpar, section}) )
    );
}

function listQuestions( {params:{doc}} ) {
    console.log( `Listing questions for ${doc}` );
    return read().then(
        all => {
            if( !all[doc] )
                throw failure( 404, "No such document" );
            else
                return all[doc];
        }
    );
}

function addQuestions( {params:{doc}, body: questions} ) {
    console.log( `Adding questions for ${doc}: ${questions}` );
    return update(
        all => {
            if( !all[doc] ) {
                throw failure( 404, "No such document" );
            } else {
                questions.forEach( q => all[doc].push( q ) );
                return all;
            }
        }
    ).then( all => all[doc] );
}

