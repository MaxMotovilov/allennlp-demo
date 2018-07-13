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
