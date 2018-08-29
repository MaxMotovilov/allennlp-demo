'use strict';

const
    {spawn} = require('child_process'),
    byline = require('byline'),
    {Transform} = require('stream');

exports = module.exports =
    uploadScriptPath =>
        function( {files}, res ) {
            const child = spawn(
                uploadScriptPath,
                files.map( ({path}) => path ),
                { shell: true, stdio: [ 'ignore', 'pipe', 'pipe' ] }
            );

            res.writeHead( 200, { 'content-type': 'text/plain' } );

            child.on( 'error', finalize( "\n*** Child process failed ***\n" ) )
                 .on( 'exit', finalize() );

            byLine(child.stdout).pipe( res, {end: false} );
            byLine(child.stderr).pipe( res, {end: false} );

            function finalize( last ) {
                return () => {
                    if( last )
                        res.write( last );
                    res.end();
                }
            }
        }

function byLine( stream ) {
    const eolAppender = new Transform({
                transform(what, _, done) {
                    this.push( what );
                    this.push( "\n" );
                    done();
                }
           });

    byline(stream, {keepEmptyLines: true}).pipe( eolAppender );

    return eolAppender;
}
