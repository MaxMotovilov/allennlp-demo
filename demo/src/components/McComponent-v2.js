import React, {Fragment} from 'react';

import { stringify } from 'query-string';

import { get, put, post } from '../api-config';

import { withRouter } from 'react-router-dom';
import {PaneLeft, PaneRight, PaneSeparator, PaneTab} from './Pane'
import Button from './Button'
import ModelIntro from './ModelIntro'


/*******************************************************************************
  <McInput /> Component
*******************************************************************************/

const title = "DeepNow - Autonomous QA At Scale";
const
    topDescription = [
      <p>
        Autonomous QA answers natural language questions by selecting an answer span within evidence text using DeepNow AI platform running on Oracle BareMetal GPUs.
        To handle large collections of documents, this implementation employs a full text search index, implemented with an&nbsp;
        <a href="https://www.elastic.co/">Elasticsearch</a>&nbsp;cluster hosted in Oracle Cloud. The user is expected to provide context to the question by supplying
        search terms or phrases that select a small subset of the entire collection that AI platform will operate upon.
      </p>,

      <p>
        While the question itself could be used as a search phrase, important highly selective terms such as appliance model number are not normally part of the
        question asked by the customer. This implementation makes a choice of separating the two, relying on the user to pre-select a relevant
        set of documents interactively before asking the question itself.
      </p>
    ],
    midDescription = (
      <p>
        Type in the search terms or multi-word phrases; comma or semicolon completes the term and opens a new one. Snippets from the top 5 documents containing
        search terms and the words of the question are shown in the pane at right.
      </p>
    );

function formatMMSSTTT( t ) {
    const	ms = t % 1000,
            s = Math.floor(t/1000),
            m = Math.floor(s/60);

    const fillz = (what, n) => {
        const s = "000" + what;
        return s.substr( s.length - n );
    }

    return `${m}:${fillz(s%60, 2)}.${fillz(ms, 3)}`;
}

const McPDF = ({doc, className}) => (
    <div
        key="pdf"
        className={"pane__pdf " + className}
    >
        <object data={"/pdf/" + doc} className="pane__pdf" />
    </div>
)

const TermButton =
    ({disabled, mc, index, children}) => (
        <a
            href="javascript:"
            className="form__oval_button"
            onClick={
                () => mc.setState(
                    ({terms, ...rest}) =>
                        ({...rest, terms: terms.filter( (_, i) => i !== index )})
                )
            }
        >{children}&nbsp;✘</a>
    );

class McInput extends React.Component {

    state = { newTerm: "" }

    handleQuestionChange = ({target: {value}}) => {
        this.props.mc.setState({ question: value });
    }

    handleTermChange = ({target: {value}}) => {
        const newTerm = value.replace( /[,;]$/, "" );
        if( newTerm && newTerm != value )
            this.addTerm();
        else
            this.setState({newTerm});
    }

    keyUp = ({keyCode}) => {
        if( keyCode in {13:1, 10:1} )
            // Enter, tab, delimiters
            this.addTerm();
        else if( keyCode === 27 )
            // Escape
            this.setState({ newTerm: "" });
    }

    addTerm = () => {
        let {newTerm} = this.state;
        if( newTerm ) {
            this.props.mc.setState({ terms: this.props.terms.concat( newTerm ) });
            this.setState({ newTerm: "" });
        }
    }

    handleOptionChange =
        (prop, cvt=parseInt) =>
            ({target: {value}}) => {
                const {mc, model} = this.props;
                mc.setState(
                    ({options, ...state}) => ({
                        ...state,
                        options: {
                            ...options,
                            [model]: { ...options[model], [prop]: value ? cvt(value) : null }
                        }
                    })
                );
            }

    handleModelChange = ({target: {value: model}}) => {
        if( model )
            this.props.mc.setState({ model });
    }

    render() {

        const {newTerm} = this.state;
        const {question, terms, mc, model, options} = this.props;

        return (
            <div className="model__content">
                <ModelIntro title={title} description={topDescription} />

                <div className="form__field">
                    <label htmlFor="#input--mc-term">Filter by</label>
                    { terms.map( (term, i) => (<TermButton mc={mc} index={i} key={i}>{term}</TermButton>) ) }
                    <input
                        onChange={this.handleTermChange}
                        onKeyUp={this.keyUp}
                        id="input--mc-term"
                        type="text"
                        value={newTerm}
                        placeholder="Term or phrase"
                    /><a href="javascript:" className="form__oval_button" onClick={this.addTerm}>✔</a>
                </div>

                <ModelIntro description={midDescription} />

                <div className="form__field">
                    <label htmlFor="#input--mc-question">Question</label>
                    <input
                        onChange={this.handleQuestionChange}
                        id="input--mc-question"
                        type="text"
                        required="true"
                        value={question}
                        placeholder="E.g. &quot;How do I get the boot menu?&quot;"
                    />
                </div>

                <div className="form__field">
                    <label>Options</label>
                    <select onChange={this.handleModelChange} value={model}>
                        <option value="auto" key="auto">Slice based on word embeddings</option>
                        <option value="doc-slice" key="doc-slice">Slice based on paragraph count</option>
                        <option value="doc" key="doc">Force document at once</option>
                    </select>

                    {model in options ? (<Fragment>
                        <select onChange={this.handleOptionChange("limit")} value={options[model].limit}>
                            <option value="1" key="1">The best matching slice only</option>
                            <option value="2" key="2">Use 2 best matching slices</option>
                            <option value="3" key="3">Use 3 best matching slices</option>
                            <option value="4" key="4">Use 4 best matching slices</option>
                            <option value="5" key="5">Use 5 best matching slices</option>
                        </select>
                        <div>
                            {"sliceSize" in options[model] ? (
                                <Fragment>
                                    <input
                                        className="form__option"
                                        onChange={this.handleOptionChange("sliceSize")}
                                        type="text"
                                        required="true"
                                        value={options[model].sliceSize || ""}
                                    />
                                    <span>paragraphs</span>
                                </Fragment>
                            ):null}
                            {"sliceByteCount" in options[model] ? (
                                <Fragment>
                                    <input
                                        className="form__option"
                                        onChange={this.handleOptionChange("sliceByteCount")}
                                        type="text"
                                        required="true"
                                        value={options[model].sliceByteCount || ""}
                                    />
                                    <span>bytes</span>
                                </Fragment>
                            ):null}
                            {"atLeast" in options[model] ? (
                                <Fragment>
                                    <input
                                        className="form__option"
                                        onChange={this.handleOptionChange("atLeast",parseFloat)}
                                        type="text"
                                        required="true"
                                        value={options[model].atLeast || ""}
                                    />
                                    <span>score drop-off</span>
                                </Fragment>
                            ):null}
                        </div>
                    </Fragment>) : null}
                </div>

            </div>
        );

/*

*/
    }
}


/*******************************************************************************
  <McOutput /> Component
*******************************************************************************/

const highlightAnswer =
    makeHighlight =>
        (text, prediction, offset=0, index) => {
            function highlight( text, n ) {
                const {range: [[begin, beginPos], [end, endPos]]} = prediction;
                return n < begin || n > end ? text :
                        begin == end ? (
                            <Fragment>
                                {text.substring( 0, beginPos )}
                                {makeHighlight(text.substring( beginPos, endPos ), index)}
                                {text.substring( endPos )}
                            </Fragment>
                        ) :	n == begin ? (
                            <Fragment>
                                {text.substring( 0, beginPos )}
                                {makeHighlight(text.substring( beginPos ), index)}
                            </Fragment>
                        ) : n == end ? (
                            <Fragment>
                                {makeHighlight(text.substring( 0, endPos ), index)}
                                {text.substring( endPos )}
                            </Fragment>
                        ) : makeHighlight(text, index);
            }

            return text.map(
                        (t, i) => t ? (
                            <p key={i + offset}>
                                {prediction ? highlight(t, i + offset) : t}
                            </p>
                        ) : null
                    );
        }

const setHash = elt => elt && (window.location.hash = window.location.hash || elt.id);

const McText = ({doc: {text, prediction}, className}) => {
    let last = 0, index = 0, last_index;

    const plain = offset => (t, i) => (<p key={i + offset}>{t}</p>);

    const highlight = highlightAnswer(
        (text, index) => {
            const result = (
                <a key={`answer-${index}`} id={last_index != index ? `answer-${index}` : null} href={`#answer-${(index+1)%prediction.length}`} className="passage__answer"
                   ref={index > 0 || last_index != null ? null : setHash}>{text}</a>
            );

            last_index = index;

            return result;
        }
    );

    return (
        <div key="text" className={"pane__text " + className}>
            {prediction.reduce(
                (list, prediction) => {
                    const {range: [[begin], [end]]} = prediction, from = last;
                    last = end+1;
                    if( begin > from )
                        list.push.apply( list, text.slice( from, begin ).map( plain(from) ) );
                    list.push.apply( list, highlight( text.slice(begin, end+1), prediction, begin, index++ ) );
                    return list;
                }, []
            ).concat(
                text.length > last ? text.slice( last ).map( plain(last) ) : []
            )}
        </div>
    );
}

const
    MAX_LINES_IN_SNIPPET = 5,
    MAX_CHARS_IN_SNIPPET = 500;

const McAnswerSnippet = ({ mc, text, prediction, index, docIndex }) => {
    let
        {range: [[begin], [end]]} = prediction,
        lines = end - begin + 1,
        chars = text.slice( begin, end+1 ).reduce( (n, t) => n + t.length, 0 ),
        atStart = 0, atEnd = 0;

    const highlight = highlightAnswer(
        (text, index) => (
            <a href={`#answer-${index}`} className="passage__answer" onClick={() => mc.setState({ expanded: docIndex, tab: "text" })}>{text}</a>
        )
    );

    while( lines < MAX_LINES_IN_SNIPPET && chars < MAX_CHARS_IN_SNIPPET ) {
        if( atEnd <= atStart && end < text.length ) {
            ++lines;
            ++atEnd;
            chars += text[++end].length;
        } else if( atStart < atEnd && begin > 0 ) {
            ++lines;
            ++atStart;
            chars += text[--begin].length;
        } else {
            break;
        }
    }

    return (<div key={index} className="passage__snippet">{highlight(text.slice(begin, end+1), prediction, begin, index)}</div>);
}

const McSearch = ({mc, docs, more, canAnswer, expanded}) => {

    const expand = (expanded, tab) => () => mc.setState({ expanded, tab });
    const predict = index => () => mc.predict(index);

    return docs.length == 0 ? (
        <div className="search__result info">No search terms were supplied.</div>
    ) : (
        <Fragment>
            { docs.map(
                ({id, highlights, prediction, text}, index) => (
                    <div key={id} className={"search__result " + (expanded === index ? "selected" : "")}>
                        <a href="javascript:" onClick={expand(index, "pdf")} className={"pdf " + (prediction ? "tab" : "tab selected")}>{id}</a>
                        {canAnswer ? (
                            <a href="javascript:" onClick={prediction ? expand(index, "text") : predict(index)} className={prediction ? "tab selected" : "tab"}>ANSWER{prediction ? "!" : "?"}</a>
                        ) : null}
                        { prediction ?
                            prediction.length ?
                                prediction.map( (p, i) => ( <McAnswerSnippet mc={mc} key={i} text={text} prediction={p} index={i} docIndex={index} /> ) )
                              : ( <p>This document does not contain an answer.</p> )
                          : highlights ?
                            highlights.map( t => (<p dangerouslySetInnerHTML={{__html: t}} />) )
                          : ( <p>Enter your question to see content snippets</p> ) }
                    </div>
                )
            ) }
            { more ? (
                <div className="search__result info">{more} more documents match the filter, consider making your terms more specific</div>
            ) : null }
        </Fragment>
    );
}

class McWait extends React.Component {
    componentDidUpdate() {
        if( this.props.running )
            setTimeout( () => this.forceUpdate(), 0 );
    }

    render() {
        const {running} = this.props;
        const waitingFor = (+new Date()) - running;

        return running ? (
            <div className="pane__wait"><div>{formatMMSSTTT(waitingFor)}</div></div>
        ) : null;
    }
}

/*******************************************************************************
  <McComponent /> Component
*******************************************************************************/

const
    defaultState = { terms: [], question: "", docs: [], more: null, expanded: null, tab: "search" },
    defaultOptions = { auto: { sliceSize: 50, sliceByteCount: 4096, limit: 1, atLeast: null }, "doc-slice": { sliceSize: 50, limit: 1 } };

const startOf = ({range: [[from]]}) => from;

class _McComponent extends React.Component {

    state = {...defaultState, model: "auto", options: defaultOptions}

    predict( index ) {
        const {question, docs, model, options: allOpts} = this.state;
        const {limit, ...options} = allOpts[model] || {}

        this.setState({ running: +new Date() });

        const go = (docs) => {
            const {text} = docs[index];

            return post( `/predict${limit>1 && model!="doc"?"N":""}/${model}`,
                          {question, doc: text.map( t => ({cpar: t}) ), ...options, limit: limit <= 1 ? undefined : limit}
                    ).then(
                        prediction => {
                            console.log( prediction );
                            if( !Array.isArray(prediction) )
                                prediction = [prediction];
                            else
                                prediction.sort( (a, b) => startOf(a)-startOf(b) );
                            this.setState({
                                docs: docs.map(
                                    (doc, i) => index === i ? {...doc, prediction } : doc
                                ),
                                running: null,
                                tab: prediction.length ? "text" : "search",
                                expanded: index
                            });
                        },
                        err => {
                            console.error( err );
                            this.setState({
                                running: null
                            });
                        }
                    );
        }

        if( docs[index].text )
            go(docs);
        else
            this.search( true ).then( go );
    }

    canAnswer() {
        return /...\?$/.test( this.state.question )
    }

    search( withText ) {
        const
            {terms, question, lastSearchUrl, searching} = this.state,
            query = stringify({ max: 5, q: this.canAnswer() && question || undefined, text: withText ? 1 : undefined }),
            url = `/search/${terms.map( t => t.replace( /\s+/g, "+" ) ).join( "/" )}${query && "?"}${query}`;

        if( terms.length && !searching && url != lastSearchUrl
            && (!lastSearchUrl || url != lastSearchUrl.replace( /(&?)withText=1(&?)/, (_,a,b) => (a+b).substr(1) ))
        ) {
            this.setState({ searching: true });

            return get( url )
                        .then(
                            ({total, results}) => {
                                this.setState({
                                    more: total - results.length,
                                    docs: results,
                                    lastSearchUrl: url,
                                    searching: false,
                                    tab: "search"
                                });
                                return results
                            }
                        );
        }
    }

    load( page ) {
        get( `/data/v2/${page}` )
            .then( ({sliceSizes, limit, options, ...content}) =>
                this.setState( {
                    ...content,
                    docs: [], expanded: null, tab: "search", lastSearchUrl: null,
                    // Auto-convert from sliceSizes/limit to options
                    options: options || {
                        auto: Object.assign( {}, defaultOptions.auto, sliceSizes && {sliceByteCount: sliceSizes.auto, limit} ),
                        "doc-slice": Object.assign( {}, defaultOptions["doc-slice"], sliceSizes && {sliceSize: sliceSizes["doc-slice"], limit} )
                    }
                } )
            );
    }

    save( page, data ) {
        put( `/data/v2/${page}`, data );
    }

    componentWillMount() {
        const {match: {params: {page}}} = this.props;
        if( page && !(page in {save: 1, new: 1}) )
            this.load( page );
    }

    componentWillReceiveProps({match: {params: {page}}}) {
        const {match: {params: {page: currentPage}}} = this.props;
        if( page && page !== currentPage && !(page in {save: 1, new: 1}) )
            this.load( page );
        else if( page == "new" && page !== currentPage )
            this.setState( defaultState );
    }

    componentWillUpdate({location: {state}}, {terms, question, tab}) {
        if( state ) {
            state.terms = terms;
            state.question = question;
        }

        if( tab != "text" )
            window.location.hash = "";
    }

    componentDidUpdate() {
        const {match: {params: {page}}} = this.props;
        const {terms, question, model, options} = this.state;

        const searched = this.search();

        if( searched && !(page in {save: 1, new: 1}) )
            searched.then( () => this.save( page, {terms, question, model, options} ) );
    }

    render() {
      const {terms, docs, question, more, tab, expanded, running, model, options} = this.state;

      return (
       <div className="pane model">
          <McWait running={running} />
          <PaneLeft>
            <McInput mc={this} terms={terms} question={question} model={model} options={options} />
          </PaneLeft>
          <PaneRight>
            <PaneSeparator>
                <PaneTab key="search" selected={tab==="search"} onClick={() => this.setState({tab: "search"})}>Filter</PaneTab>
                {expanded != null ? (
                    <PaneTab key="pdf" selected={tab==="pdf"} onClick={() => this.setState({tab: "pdf"})}>PDF</PaneTab>
                ) : null}
                {expanded != null && docs[expanded].prediction ? (
                    <PaneTab key="text" selected={tab==="text"} onClick={() => this.setState({tab: "text"})}>Answer</PaneTab>
                ) : null}
            </PaneSeparator>
            { tab==="search" ? (
                <McSearch mc={this} docs={docs} expanded={expanded} more={more} canAnswer={this.canAnswer()} />
            ) : null }
            {expanded != null && tab === "pdf" ? (
                <McPDF doc={docs[expanded].id} />
            ) : null}
            {expanded != null && tab === "text" ? (
                <McText doc={docs[expanded]} />
            ) : null}
          </PaneRight>
        </div>
      );

    }
}

const McComponent = withRouter(_McComponent);

export default McComponent;
