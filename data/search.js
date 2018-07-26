const
    {Client} = require( 'elasticsearch' ),

    es = new Client({ host: "localhost:9200", log: "info" });

exports.elasticSearch =
    function( {params: {terms}, query: {q, max=5}} ) {
        return es.search({ index: "alorica", body: Object.assign(
            {
                _source: false,
                sort: [ "_score" ],
                size: max,
                query: {
                    bool: {
                        must:
                            terms.split( "/" ).filter( x => x ).map( x => x.replace( /[+]/g, " " ) )
                                 .map( term_or_phrase => ({
                                    [/\s/.test( term_or_phrase ) ? "match_phrase" : "match"]:
                                        { cpar: term_or_phrase }
                                 }))
                    }
                }
            },
            q ? {
                highlight: {
                    fields: { cpar: {} },
                    highlight_query: {
                        match: {
                            cpar: q
                        }
                    }
                }
            } : null
        )}).then(
            ({hits: {total, hits}}) => ({
                total,
                results: hits.map(
                    ({_id, highlight:{cpar}={}}) =>
                        ({id: _id, highlights: cpar})
                )
            })
        );
    }

