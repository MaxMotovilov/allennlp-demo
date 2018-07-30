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

    render() {

        const {newTerm} = this.state;
        const {question, terms, mc} = this.props;

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
            </div>
        );
    }
}


/*******************************************************************************
  <McOutput /> Component
*******************************************************************************/

const makeHighlight = (text, top) => (
    <span className="passage__answer" ref={top && (elt => elt && elt.scrollIntoView())}>{text}</span>
);

const highlightAnswer = (text, prediction, offset=0) => {
    function highlight( text, n ) {
        const {range: [[begin, beginPos], [end, endPos]]} = prediction;
        return n < begin || n > end ? text :
                begin == end ? (
                    <Fragment>
                        {text.substring( 0, beginPos )}
                        {makeHighlight(text.substring( beginPos, endPos ), true)}
                        {text.substring( endPos )}
                    </Fragment>
                ) :	n == begin ? (
                    <Fragment>
                        {text.substring( 0, beginPos )}
                        {makeHighlight(text.substring( beginPos ), true)}
                    </Fragment>
                ) : n == end ? (
                    <Fragment>
                        {makeHighlight(text.substring( 0, endPos ))}
                        {text.substring( endPos )}
                    </Fragment>
                ) : makeHighlight(text);
    }

    return text.map(
                (t, i) => t ? (
                    <p key={i + offset}>
                        {prediction ? highlight(t, i + offset) : t}
                    </p>
                ) : null
            );
}

const McText = ({doc: {text, prediction}, className}) => (
    <div key="text" className={"pane__text " + className}>
        {highlightAnswer( text, prediction )}
    </div>
);

const
    MAX_LINES_IN_SNIPPET = 5,
    MAX_CHARS_IN_SNIPPET = 500;

const McAnswerSnippet = ({ text, prediction }) => {
    let
        {range: [[begin], [end]]} = prediction,
        lines = end - begin + 1,
        chars = text.slice( begin, end+1 ).reduce( (n, t) => n + t.length, 0 ),
        atStart = 0, atEnd = 0;

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

    return (<Fragment>{highlightAnswer(text.slice(begin, end), prediction, begin)}</Fragment>);
}

const McSearch = ({mc, docs, more, canAnswer, expanded}) => {

    const expandPdf = index => mc.setState({ expanded: index, tab: "pdf" });

    return docs.length == 0 ? (
        <div className="search__result info">No search terms were supplied.</div>
    ) : (
        <Fragment>
            { docs.map(
                ({id, highlights, prediction, text}, index) => (
                    <div key={id} className={"search__result " + (expanded === index ? "selected" : "")}>
                        <a href="javascript:" onClick={() => expandPdf(index)} className={"pdf " + (prediction ? "" : "selected")}>{id}</a>
                        {canAnswer ? (
                            <a href="javascript:" onClick={() => mc.predict(index)} className={prediction ? "selected" : ""}>ANSWER{prediction ? "!" : "?"}</a>
                        ) : null}
                        { prediction ?
                            ( <McAnswerSnippet text={text} prediction={prediction} /> )
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

const TARGET_BYTE_COUNT = 4096;

function windowSizes(text) {
    const counts = [], last = [];
    let weight = 0;

    text.forEach(
        par => {
            if( last.length == 0 ) {
                last.push( par.length );
                weight += par.length;
            } else {
                last.push( par.length );
                weight += 1 + par.length;
                if( weight + 1 + par.length > TARGET_BYTE_COUNT ) {
                    counts.push( last.length - 1 );
                    while( last.length > 1 && weight > TARGET_BYTE_COUNT )
                        weight -= 1 + last.shift();
                }
            }
        }
    );

    if( last.length > 0 )
        counts.push( last.length );

    return counts
}

function topQuintile( lengths ) {
    const pos = Math.floor( lengths.length * 0.8 );
    return lengths.sort()[pos]
}

class _McComponent extends React.Component {

    state = { terms: [], question: "", docs: [], more: null, tab: "search" }

    predict( index ) {
        const {question, docs} = this.state;

        this.setState({ running: +new Date() });

        const go = (docs) => {
            const
                {text} = docs[index],
                sizes = windowSizes(text),
                sliceSize = sizes.length > 1 && topQuintile( sizes ) || undefined;

            return post( `/predict/${sliceSize?"doc-slice":"doc"}`, {question, doc: text.map( t => ({cpar: t}) ), sliceSize} )
                        .then(
                            prediction => {
                                console.log( prediction );
                                this.setState({
                                    docs: docs.map(
                                        (doc, i) => index === i ? {...doc, prediction} : doc
                                    ),
                                    running: null,
                                    tab: "text",
                                    expanded: index
                                });
                            },
                            err => console.error( err )
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
                                    searching: false
                                });
                                return results
                            }
                        );
        }
    }

    load( page ) {
        get( `/data/v2/${page}` )
            .then( content => this.setState( content ) );
    }

    save( page, data ) {
        put( `/data/v2/${page}`, data );
    }

    componentWillMount() {
        const {match: {params: {page}}} = this.props;
        if( !(page in {save: 1, new: 1}) )
            this.load( page );
    }

    componentWillReceiveProps({match: {params: {page}}}) {
        const {match: {params: {page: currentPage}}} = this.props;
        if( page !== currentPage && !(page in {save: 1, new: 1}) )
            this.load( page );
    }

    componentWillUpdate({location: {state}}, {terms, question}) {
        if( state ) {
            state.terms = terms;
            state.question = question;
        }
    }

    componentDidUpdate() {
        const {match: {params: {page}}} = this.props;
        const {terms, question} = this.state;

        const searched = this.search();

        if( searched )
            searched.then( () => this.save( page, {terms, question} ) );
    }

    render() {
      const {terms, docs, question, more, tab, expanded, running} = this.state;

      return (
       <div className="pane model">
          <McWait running={running} />
          <PaneLeft>
            <McInput mc={this} terms={terms} question={question} />
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
