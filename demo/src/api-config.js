/* global FormData */
// Everything will be proxied -- no CORS or URL magic required

export const API_ROOT = window && window.location && window.location.origin || "";

const process = fetch =>
        fetch.then(
            (response) => {
                if( response.ok )
                    return response.json();
                else
                    return response.text().then( text => { throw Error( text ) } );
            }
        );

export function get( url ) {
    return process( fetch( API_ROOT + url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }) )
}

export function post( url, data ) {
    return process( fetch( API_ROOT + url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify( data )
            }) );
}

export function put( url, data ) {
    return process( fetch( API_ROOT + url, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify( data )
            }) );
}

export function upload( url, files ) {
    return fetch( API_ROOT + url, {
                method: 'POST',
                headers: {
                    'Accept': 'text/plain'
                },
                body: packFiles(files)
            }).then(
                response => response.ok
                    ? response.body.getReader()
                    : response.text().then( text => { throw Error( text ) } )
            );
}

function packFiles( files ) {
    const form = new FormData();
    files.forEach( (file, i) => form.append( `file-${i}`, file ) );
    return form;
}
