// Everything will be proxied -- no CORS or URL magic required

export const API_ROOT = window && window.location && window.location.origin || "";

export function get( url ) {
    return fetch( API_ROOT + url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }).then(
                response => response.json()
            ).catch( (error) => {
                console.error( error );
                throw error;
            } );
}

export function post( url, data ) {
    return fetch( API_ROOT + url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify( data )
            }).then(
                response => response.json()
            ).catch( (error) => {
                console.error( error );
                throw error;
            } );
}
