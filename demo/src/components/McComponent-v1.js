import React, {Fragment} from 'react';
import HeatMap from './heatmap/HeatMap'
import Collapsible from 'react-collapsible'

import { get, post } from '../api-config';

import { withRouter } from 'react-router-dom';
import {PaneLeft, PaneRight, PaneSeparator, PaneTab} from './Pane'
import Button from './Button'
import ModelIntro from './ModelIntro'


/*******************************************************************************
  <McInput /> Component
*******************************************************************************/

const title = "DeepNow - Autonomous QA";
const description = (
  <span>
      Autonomous QA answers natural language questions by selecting an answer span within evidence text using DeepNow AI platform running on Oracle BareMetal GPUs.
      This visualization works with a single specific PDF document; search through the entire document collection will be
      demonstrated by the next PoC.
  </span>
);

const modelNotes = {
    doc: (
        <p>The entire document is processed by a pre-trained machine comprehension model to find the answer. As the model is optimized for text fragments of limited size,
           this mode works best on smaller documents and may be less accurate or slow on larger ones</p>
    ),
    section: (
        <p>The document is split into sections detected by analysis of the PDF content during the ETL. The section with the best frequency score for the
           search term is selected and processed by the pre-trained model to find answer. This mode is fast on all documents but may be less accurate
           due to errors inherent in detecting sessions.</p>
    ),
    "doc-slice": (
        <p>The term frequency scores are determined for all overlapping sequences of consecutive paragraphs of certain length within the document and the best matching
           sequence is processed by the pre-trained model to find answer. This yields better accuracy than sectioning and can be speeded up considerably by the
           use of ElasticSearch indexing.</p>
    ),
    "baseline": (
        <p>A paragraph from the text is selected on the basis of its term frequency score alone. This establishes a baseline for evaluation of the deep learning
           model performance.</p>
    )
}

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

class McInput extends React.Component {

    state = { questions: [], questionText: "", running: 0 }

    update = (doc) => {
        if( /^\d+$/.test(doc) )
            get( `/data/v1/${doc}/questions` ).then( questions => this.setState({ questions }) );
        else
            this.setState({ questions: [] });
    }

    componentWillMount() {
        this.update( this.props.doc );
    }

    componentWillReceiveProps( {doc} ) {
        if( doc !== this.props.doc )
            this.update( doc );
    }

    handleListChange = ({target: {value}}) => {
        if( value )
            this.setState({ questionText: this.state.questions[value] });
    }

    handleQuestionChange = ({target: {value}}) => {
        this.setState({ questionText: value });
    }

    handleOptionChange = ({target: {value}}) => {
        this.props.mc.setState({ sliceSize: parseInt(value) });
    }

    handleModelChange = ({target: {value: model}}) => {
        if( model )
            this.props.mc.setState({ model });
    }

    save = () => {
        const {questions, questionText} = this.state;
        const {doc} = this.props;

        if( questionText && questions.indexOf(questionText) < 0 )
            post( `/data/v1/${doc}/questions`, [ questionText ] )
                .then( questions => this.setState({ questions }) );
    }


    go = () => {
        this.save();
        this.props.mc.predict( this.state.questionText )
             .then( () => this.setState({ running: 0 }) );
        this.setState({ running: +new Date() });
    }

    componentDidUpdate() {
        if( this.state.running )
            setTimeout( () => this.forceUpdate(), 0 );
    }

    render() {

        const {questions, questionText, running} = this.state;
        const {model, sliceSize} = this.props;

        const waitingFor = (+new Date()) - running;

        return (
            <div className="model__content">
                <ModelIntro title={title} description={description} />
                <div className="form__instructions">
                    <span>Enter question or</span>
                    <select onChange={this.handleListChange} disabled={running || questions.length == 0}>
                        <option value="">select from history...</option>
                        {questions.map( (text, index) => (
                              <option value={index} key={index}>{text}</option>
                        ))}
                    </select>
                </div>

                <div className="form__field">
                    <label htmlFor="#input--mc-question">Question</label>
                    <input
                        readOnly={running}
                        onChange={this.handleQuestionChange}
                        id="input--mc-question"
                        type="text"
                        required="true"
                        value={questionText}
                        placeholder="E.g. &quot;How do I get the boot menu?&quot;"
                    />
                </div>

                <div className="form__field form__field--btn">
                    <Button enabled={!running && /...\?$/.test( questionText )} onClick={this.go}>{running ? formatMMSSTTT(waitingFor) : "Answer this!"}</Button>
                </div>

                <div className="form__field">
                    <label>Options</label>
                    <select onChange={this.handleModelChange} value={model} disabled={running}>
                        <option value="">Select MC model...</option>
                        <option value="section" key="section">Pick section (TF/IDF+BiDAF)</option>
                        <option value="doc-slice" key="doc-slice">Pick best slice (TF/IDF+BiDAF)</option>
                        <option value="doc" key="doc">Document at once (BiDAF)</option>
                        {/[?&]baseline=[^&]/.test( window.location.search ) ? (
                            <option value="baseline" key="baseline">Term search baseline (TF/IDF)</option>
                        ):null}
                    </select>
                </div>

                <div>{modelNotes[model]}</div>

                {model === "doc-slice" ? (
                    <label>Number of paragraphs in a slice:&nbsp;
                    <input
                        readOnly={running}
                        onChange={this.handleOptionChange}
                        type="text"
                        required="true"
                        value={sliceSize}
                        placeholder="10"
                    /></label>
                ) : null}
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

    state = { content: [], model: "doc-slice", sliceSize: 20 }

    update( doc ) {
        if( /^\d+$/.test(doc) )
            get( `/data/v1/${doc}` ).then( content => this.setState({ doc, content, prediction: null, tab: "pdf" }) );
        else
            this.setState({ doc, content: [] });
    }

    predict = ( question ) => {
        const {model, content, sliceSize} = this.state;
        this.setState({ prediction: null });
        return post( `/predict/${model}`, {question, doc: content, sliceSize} )
                    .then(
                        prediction => { console.log( prediction ); this.setState({ prediction, tab: "text" }); },
                        err => console.error( err )
                    );
    }

    componentWillMount() {
        this.update( this.props.match.params.doc );
    }

    componentWillReceiveProps( {match: {params: {doc}}} ) {
        if( doc !== this.state.doc )
            this.update( doc );
    }

    render() {
      const {doc, content, model, prediction, sliceSize, tab} = this.state;

      return (
       <div className="pane model">
          <PaneLeft>
            <McInput mc={this} doc={doc} model={model} sliceSize={sliceSize} />
          </PaneLeft>
          <PaneRight>
            <PaneSeparator>
                {doc && [
                    <PaneTab key="pdf" selected={tab==="pdf"} onClick={() => this.setState({tab: "pdf"})}>PDF</PaneTab>,
                    <PaneTab key="text" selected={tab==="text"} onClick={() => this.setState({tab: "text"})}>Text</PaneTab>
                ]}
            </PaneSeparator>
            <McOutput mc={this} doc={doc} content={content} prediction={prediction} className={tab!=="text" ? "hidden" : ""} />
            <McPDF doc={doc} className={tab!=="pdf" ? "hidden" : ""} />
          </PaneRight>
        </div>
      );

    }
}

const McComponent = withRouter(_McComponent);

export default McComponent;
