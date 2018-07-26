'use strict';

const
    {resolve} = require('path'),
    {readJson, writeJson, pathExists} = require('fs-extra');

const
    db = resolve( __dirname, "db.json" ),
    queue = [],
    MAX_QUEUE = 10;

let locked = false;

module.exports.read = () => lock().then( data => (unlock(), data) );

module.exports.update = updater => lock().then( updater ).then( unlock );

pathExists( db ).then( exists => exists || writeJson( db, {v1:{}, v2:{}} ) );

function lock() {
    if( locked ) {
        if( queue.length >= MAX_QUEUE )
            throw Error( `Likely deadlock - queue reached ${queue.length}!` );
        return new Promise(
            (resolve, reject) =>
                queue.push(
                    () => lock().then( resolve )
                )
        );
    } else {
        locked = true;
        return readJson( db ).then( content => (content.v1 ? content : { v1: content, v2: {} }) );
    }
}

function unlock( new_data ) {
    if( new_data )
        return writeJson( db, new_data, {spaces: '\t'} ).then( done );
    else
        return done();

    function done() {
        locked = false;
        if( queue.length )
            queue.shift();
        return new_data;
    }
}

