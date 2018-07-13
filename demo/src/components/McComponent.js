import React from 'react';
import HeatMap from './heatmap/HeatMap'
import Collapsible from 'react-collapsible'

import { get, post } from '../api-config';

import { withRouter } from 'react-router-dom';
import {PaneLeft, PaneRight} from './Pane'
import Button from './Button'
import ModelIntro from './ModelIntro'


/*******************************************************************************
  <McInput /> Component
*******************************************************************************/

const title = "Machine Comprehension";
const description = (
  <span>
      Machine Comprehension (MC) answers natural language questions by selecting an answer span within evidence text.
      This visualization works with a single specific PDF document; search through the entire document collection will be
      demonstrated by the next PoC.
  </span>
);

class McInput extends React.Component {

    state = { questions: [], questionText: "", running: false }

    update = (doc) => {
        if( /^\d+$/.test(doc) )
            get( `/data/${doc}/questions` ).then( questions => this.setState({ questions }) );
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

    handleModelChange = ({target: {value: model}}) => {
        if( model )
            this.props.mc.setState({ model });
    }

    save = () => {
        const {questions, questionText} = this.state;
        const {doc} = this.props;

        if( questionText && questions.indexOf(questionText) < 0 )
            post( `/data/${doc}/questions`, [ questionText ] )
                .then( questions => this.setState({ questions }) );
    }


    go = () => {
        this.save();
        this.props.mc.predict();
    }

    render() {

        const {questions, questionText, running} = this.state;
        const {model} = this.props;

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
                    <Button enabled={!running && /...\?$/.test( questionText )} onClick={this.go}>Answer this!</Button>
                </div>

                <div className="form__field">
                    <label>Options</label>
                    <select onChange={this.handleModelChange} value={model} disabled={running}>
                        <option value="">Select MC model...</option>
                        <option value="doc" key="doc">Document at once (BiDAF)</option>
                        <option value="section" key="doc">Pick section (MP+BiDAF)</option>
                        <option value="doc-slice" key="doc">Pick best slice (MP+BiDAF)</option>
                    </select>
                </div>
            </div>
        );
    }
}


/*******************************************************************************
  <McOutput /> Component
*******************************************************************************/

const McOutput = ({content}) => {
      let odd = 0;

      return (
        <div className="pane__text">
            {content.map(
                ({cpar, section}, i) => cpar ? (
                    <p key={i} className={(odd ^= !!section) ? 'pane__odd' : ''}>
                        {cpar}
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

    state = { content: [], model: "doc" }

    update( doc ) {
        if( /^\d+$/.test(doc) )
            get( `/data/${doc}` ).then( content => this.setState({ doc, content }) );
        else
            this.setState({ doc, content: [] });
    }

    predict = () => {
        const {questionText, model} = this.state;
//		post( `/predict/${model}`,
    }

    componentWillMount() {
        this.update( this.props.match.params.doc );
    }

    componentWillReceiveProps( {match: {params: {doc}}} ) {
        if( doc !== this.state.doc )
            this.update( doc );
    }

    render() {
      const {doc, content, model} = this.state;

      return (
       <div className="pane model">
          <PaneLeft>
            <McInput mc={this} doc={doc} model={model} />
          </PaneLeft>
          <PaneRight>
            <McOutput mc={this} doc={doc} content={content} />
          </PaneRight>
        </div>
      );

    }
}

const McComponent = withRouter(_McComponent);

export default McComponent;
