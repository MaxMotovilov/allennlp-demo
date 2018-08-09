const
    {Client} = require( 'elasticsearch' ),

    es = new Client({ host: "localhost:9200", log: "info" });

exports.elasticSearch =
    function( {params: {terms}, query: {q, max=5, text}} ) {
        terms = terms.split( "/" ).filter( x => x ).map( x => x.replace( /[+]/g, " " ) )
                     .map( term_or_phrase => ({
                                [/\s/.test( term_or_phrase ) ? "match_phrase" : "match"]:
                                    { cpar: term_or_phrase }
                     }));

        return es.search({ index: "alorica", body: {
            _source: text ? {includes: [ "cpar" ]} : false,
            sort: [ "_score" ],
            size: max,
            query: { bool: Object.assign(
                { [q ? "filter" : "must"]: terms },
                q && { should: { match: {cpar: {analyzer: "my_snowball_analyzer", query: q}} } }
            ) },
            highlight: {
                fields: { cpar: {} },
                highlight_query: {
                    bool: { should: terms.concat(
                        q ? {match: { cpar: {analyzer: "my_snowball_analyzer", query: q} }} : []
                    ) }
                }
            }
        }}).then(
            ({hits: {total, hits}}) => ({
                total,
                results: hits.map(
                    ({_id: id, highlight:{cpar: highlights}={}, _source: {cpar: text}={}}) =>
                        ({id, highlights, text})
                )
            })
        );
    }

