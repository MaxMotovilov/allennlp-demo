import React, {Fragment} from 'react';

import { stringify } from 'query-string';

import { get, post } from '../api-config';

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
    bottomDescription = (
      <p>
        Type in the search terms, or space-separated phrases; comma or semicolon completes the term and opens a new one. Fragments from the top 5 documents containing
        words of the question are also shown in the pane at right if the question field is not empty. When satisfied with the selected subset, press the button below.
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
    <div key="pdf" className={`pane__pdf ${className}`}><object data={`/pdf/${doc}`} className="pane__pdf" /></div>
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

    state = { running: 0, newTerm: "" }

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

    go = () => {/*
        this.props.mc.predict()
             .then( () => this.setState({ running: 0 }) );
        this.setState({ running: +new Date() });
    */
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

    componentDidUpdate() {
        if( this.state.running )
            setTimeout( () => this.forceUpdate(), 0 );
    }

    render() {

        const {running, newTerm} = this.state;
        const {question, terms, mc} = this.props;

        const waitingFor = (+new Date()) - running;

        return (
            <div className="model__content">
                <ModelIntro title={title} description={topDescription} />

                <div className="form__field">
                    <label htmlFor="#input--mc-term">Filter by</label>
                    { terms.map( (term, i) => (<TermButton disabled={running} mc={mc} index={i} key={i}>{term}</TermButton>) ) }
                    <input
                        readOnly={running}
                        onChange={this.handleTermChange}
                        onKeyUp={this.keyUp}
                        id="input--mc-term"
                        type="text"
                        value={newTerm}
                        placeholder="Term or phrase"
                    /><a href="javascript:" className="form__oval_button" onClick={this.addTerm}>✔</a>
                </div>

                <div className="form__field">
                    <label htmlFor="#input--mc-question">Question</label>
                    <input
                        readOnly={running}
                        onChange={this.handleQuestionChange}
                        id="input--mc-question"
                        type="text"
                        required="true"
                        value={question}
                        placeholder="E.g. &quot;How do I get the boot menu?&quot;"
                    />
                </div>

                <ModelIntro description={bottomDescription} />

                <div className="form__field form__field--btn">
                    <Button enabled={!running && /...\?$/.test( question )} onClick={this.go}>{running ? formatMMSSTTT(waitingFor) : "Answer this!"}</Button>
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

const McOutput = ({content, prediction, className}) => {
    let odd = 0;

    function highlight( text, n ) {
        const {range: [[begin, beginPos], [end, endPos]]}	 = prediction;
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

    return (
        <div key="text" className={`pane__text ${className}`}>
            {content.map(
                ({cpar, section}, i) => cpar ? (
                    <p key={i} className={(odd ^= !!section) ? 'pane__odd' : ''}>
                        {prediction ? highlight(cpar, i) : cpar}
                    </p>
                ) : null
            )}
        </div>
    )
}


/*******************************************************************************
  <McComponent /> Component
*******************************************************************************/

class _McComponent extends React.Component {

    state = { terms: [], question: "", docs: [], more: null, tab: "search" }

    predict = ( question ) => {
        const {model, content, sliceSize} = this.state;
        this.setState({ prediction: null });
        return post( `/predict/doc-slice`, {question, doc: content, sliceSize: 20} )
                    .then(
                        prediction => { console.log( prediction ); this.setState({ prediction, tab: "text" }); },
                        err => console.error( err )
                    );
    }

    search( withText ) {
        const
            {terms, question} = this.state,
            query = stringify({ max: 5, q: question || undefined, text: withText ? 1 : undefined });

        if( terms.length )
            return get( `/search/${terms.map( t => t.replace( /\s+/g, "+" ) ).join( "/" )}${query && "?"}${query}` )
                        .then( ({total, results}) =>
                            this.setState({ more: total - results.length, docs: results })
                        );
    }

    componentWillMount() {
        this.search();
    }

    render() {
      const {terms, docs, question, more, tab, expanded} = this.state;

      return (
       <div className="pane model">
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
                    <PaneTab key="text" selected={tab==="text"} onClick={() => this.setState({tab: "text"})}>Text</PaneTab>
                ) : null}
            </PaneSeparator>
            {expanded != null ? (
                <McPDF doc={docs[expanded].id} className={tab!=="pdf" ? "hidden" : ""} />
                /* <McText doc={docs[expanded]} className={tab!=="text" ? "hidden" : ""} /> */
            ) : null}
          </PaneRight>
        </div>
      );

    }
}

/* <McSearch mc={this} docs={docs} expanded={expanded} className={tab!=="search" ? "hidden" : ""} /> */

const McComponent = withRouter(_McComponent);

export default McComponent;
