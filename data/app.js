'use strict';

const
    express = require('express'),
    app = express(),

    {resolve} = require('path'),
    {read, update} = require('./update'),
    {elasticSearch} = require('./search'),
    {pathExists, readFile, readdir, lstat} = require('fs-extra'),

    port = arg( "--port", 3020 ),
    docpath = resolve( __dirname, arg( "--docs", "../../Alorica/etl" ) ),
    pdfpath = resolve( __dirname, arg( "--pdfs", "../../Alorica/data" ) );

let pdf_subdirs = [ "." ];

readdir(pdfpath)
    .then(
        files =>
            Promise.all( files.map( file => lstat( resolve( pdfpath, file ) ).then( stat => stat.isDirectory() ) ) )
                   .then( isDir => files.map( (file, i) => isDir[i] && file ).filter( x => x ) )
    ).then(
        subdirs => pdf_subdirs = subdirs.concat( "." )
    ).catch( err => console.error(err) );

app
    .get( "/pdf/:file", pdfResolver )
    .use( "/pdf", express.static( pdfpath, {maxAge: "1d"} ) );

app
    .use( express.json() )
    .route( "/data/v1" )
        .get( api( listDocuments ) )
        .post( api( addDocuments ) );

app
    .route( "/data/v1/:doc" )
        .get( api( readDocument ) );

app
    .route( "/data/v1/:doc/questions" )
        .get( api( listQuestions ) )
        .post( api( addQuestions ) );

app
    .route( "/data/v2" )
        .get( api( listPages ) )
        .post( api( addPages ) );

app
    .route( "/data/v2/:page" )
        .get( api( getPage ) )
        .put( api( updatePage ) );

app
    .get( "/search/:terms(*)", api( elasticSearch ) );

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

const v1DocList = ({v1}) => Object.keys( v1 );

function listDocuments() {
    console.log( "Listing documents" );
    return read().then( v1DocList );
}

function addDocuments( {body: docs} ) {
    console.log( `Adding documents: ${docs}` );

    return Promise
        .all( docs.map( id => pathExists( resolve( docpath, `${id}.l.json` ) ) ) )
        .then(
            checks => {
                const missing = docs.filter( (_,i) => !checks[i] );
                if( missing.length )
                    throw failure( 400, `Missing data files: ${missing}` );

                return update(
                    ({v1: all, ...rest}) => ({
                        ...rest,
                        v1: docs.reduce(
                                (dict, id) => {
                                    if( !dict[id] )
                                        dict[id] = []
                                    return dict;
                                }, all
                            )
                    })
                ).then( v1DocList );
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
        ({v1: all}) => {
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
        ({v1: all, ...rest}) => {
            if( !all[doc] ) {
                throw failure( 404, "No such document" );
            } else {
                questions.forEach( q => all[doc].push( q ) );
                return {v1: all};
            }
        }
    ).then( ({v1: all}) => all[doc] );
}

const v2PageList =
    ({v2}) =>
        Object.keys( v2 ).reduce(
            (result, id) => {
                const {name} = v2[id];
                result[id] = name;
                return result
            }, {}
        );

function listPages() {
    console.log( "Listing pages" );
    return read().then( v2PageList );
}

function addPages( {body: pages} ) {
    console.log( `Adding pages: ${pages.map(({name}) => name)}` );
    return update(
                ({v2, ...rest}) => ({
                    ...rest,
                    v2: pages.reduce(
                        (result, page) => {
                            let id = page.name.toLowerCase().replace( /[^a-z0-9]+/g, "-" );
                            while( id in result )
                                id = id.replace( /(?:-(\d))?$/, (_, suffix) => `-${1 + parseInt(suffix||0)}` );
                            result[id] = page;
                            return result
                        }, v2
                    )
                })
            ).then( v2PageList );
}

function getPage( {params: {page}} ) {
    console.log( `Retrieving page: ${page}` );
    return read().then(
                ({v2}) => {
                    if( !(page in v2) )
                        throw failure( 404, "Page not found" );
                    return v2[page]
                }
            );
}

function updatePage( {params: {page}, body: content} ) {
    console.log( `Updating page: ${page}` );
    return update(
                ({v2, ...rest}) => ({
                    ...rest,
                    v2: Object.assign( v2, {[page]: {...v2[page], ...content}} )
                })
            ).then( () => ({}) );
}

function pdfResolver( req, res, next ) {
    const {file} = req.params;

    Promise.all( pdf_subdirs.map( subdir => pathExists( resolve( pdfpath, subdir, `${file}.pdf` ) ) ) )
           .then(
                exists => {
                    const i = exists.indexOf( true );

                    if( i < 0 ) {
                        res.writeHead( 404, { 'content-type': 'text/plain' } );
                        res.end( `${file}.pdf not found` );
                    } else {
                        req.url = req.url.replace( /[^\/]+\/?(?=\?|$)/, `${pdf_subdirs[i]}/${file}.pdf` );
                        next();
                    }
                }
            ).catch(
                err => {
                    res.writeHead( 500, { 'content-type': 'text/plain' } );
                    res.end( err.stack );
                }
            );
}


