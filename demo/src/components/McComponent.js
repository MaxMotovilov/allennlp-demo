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

const mcExamples = [
    {
      passage: "A reusable launch system (RLS, or reusable launch vehicle, RLV) is a launch system which is capable of launching a payload into space more than once. This contrasts with expendable launch systems, where each launch vehicle is launched once and then discarded. No completely reusable orbital launch system has ever been created. Two partially reusable launch systems were developed, the Space Shuttle and Falcon 9. The Space Shuttle was partially reusable: the orbiter (which included the Space Shuttle main engines and the Orbital Maneuvering System engines), and the two solid rocket boosters were reused after several months of refitting work for each launch. The external tank was discarded after each flight.",
      question: "How many partially reusable launch systems were developed?",
    },
    {
      passage: "Robotics is an interdisciplinary branch of engineering and science that includes mechanical engineering, electrical engineering, computer science, and others. Robotics deals with the design, construction, operation, and use of robots, as well as computer systems for their control, sensory feedback, and information processing. These technologies are used to develop machines that can substitute for humans. Robots can be used in any situation and for any purpose, but today many are used in dangerous environments (including bomb detection and de-activation), manufacturing processes, or where humans cannot survive. Robots can take on any form but some are made to resemble humans in appearance. This is said to help in the acceptance of a robot in certain replicative behaviors usually performed by people. Such robots attempt to replicate walking, lifting, speech, cognition, and basically anything a human can do.",
      question: "What do robots that resemble humans attempt to do?",
    },
    {
      passage: "The Matrix is a 1999 science fiction action film written and directed by The Wachowskis, starring Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss, Hugo Weaving, and Joe Pantoliano. It depicts a dystopian future in which reality as perceived by most humans is actually a simulated reality called \"the Matrix\", created by sentient machines to subdue the human population, while their bodies' heat and electrical activity are used as an energy source. Computer programmer \"Neo\" learns this truth and is drawn into a rebellion against the machines, which involves other people who have been freed from the \"dream world.\"",
      question: "Who stars in The Matrix?",
    },
    {
      passage: "Kerbal Space Program (KSP) is a space flight simulation video game developed and published by Squad for Microsoft Windows, OS X, Linux, PlayStation 4, Xbox One, with a Wii U version that was supposed to be released at a later date. The developers have stated that the gaming landscape has changed since that announcement and more details will be released soon. In the game, players direct a nascent space program, staffed and crewed by humanoid aliens known as \"Kerbals\". The game features a realistic orbital physics engine, allowing for various real-life orbital maneuvers such as Hohmann transfer orbits and bi-elliptic transfer orbits.",
      question: "What does the physics engine allow for?",
    }
];

const title = "Machine Comprehension";
const description = (
  <span>
      Machine Comprehension (MC) answers natural language questions by selecting an answer span within evidence text.
      This visualization works with a single specific PDF document; search through the entire document collection will be
      demonstrated by the next PoC.
  </span>
);

class McInput extends React.Component {

    state = { questions: [], questionText: "" }

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

    save = () => {
        const {questions, questionText} = this.state;
        const {doc} = this.props;

        if( questionText && questions.indexOf(questionText) < 0 )
            post( `/data/${doc}/questions`, [ questionText ] )
                .then( questions => this.setState({ questions }) );
    }

    go = () => {
        this.save();
    }

    render() {

        const {questions, questionText} = this.state;

        return (
            <div className="model__content">
                <ModelIntro title={title} description={description} />
                <div className="form__instructions">
                    <span>Enter question or</span>
                    <select onChange={this.handleListChange} disabled={questions.length == 0}>
                        <option value="">select from history...</option>
                        {questions.map( (text, index) => (
                              <option value={index} key={index}>{text}</option>
                        ))}
                    </select>
                </div>

                <div className="form__field">
                    <label htmlFor="#input--mc-question">Question</label>
                    <input
                        onChange={this.handleQuestionChange}
                        id="input--mc-question"
                        type="text"
                        required="true"
                        value={questionText}
                        placeholder="E.g. &quot;How do I get the boot menu?&quot;"
                    />
                </div>

                <div className="form__field form__field--btn">
                    <Button enabled={/...\?$/.test( questionText )} onClick={this.go}>Answer this!</Button>
                </div>
            </div>
        );
    }
}


/*******************************************************************************
  <McOutput /> Component
*******************************************************************************/

class McOutput extends React.Component {

    state = { content: [] }

    update( doc ) {
        if( /^\d+$/.test(doc) )
            get( `/data/${doc}` ).then( content => this.setState({ content }) );
        else
            this.setState({ content: [] });
    }

    componentWillMount() {
        this.update( this.props.doc );
    }

    componentWillReceiveProps( {doc} ) {
        if( doc !== this.props.doc )
            this.update( doc );
    }

    render() {

      let odd = 0;

      return (
        <div className="pane__text">
            {this.state.content.map(
                ({cpar, section}, i) => cpar ? (
                    <p key={i} className={(odd ^= !!section) ? 'pane__odd' : ''}>
                        {cpar}
                    </p>
                ) : null
            )}
        </div>
      )
    }
}


/*******************************************************************************
  <McComponent /> Component
*******************************************************************************/

class _McComponent extends React.Component {
/*
    constructor(props) {
      super(props);

      const { requestData, responseData } = props;

      this.state = {
        outputState: responseData ? "received" : "empty", // valid values: "working", "empty", "received", "error"
        requestData: requestData,
        responseData: responseData
      };

      this.runMcModel = this.runMcModel.bind(this);
    }
    runMcModel(event, inputs) {
      this.setState({outputState: "working"});

      var payload = {
        passage: inputs.passageValue,
        question: inputs.questionValue,
      };
      fetch(`${API_ROOT}/predict/machine-comprehension`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }).then((response) => {
        return response.json();
      }).then((json) => {
        // If the response contains a `slug` for a permalink, we want to redirect
        // to the corresponding path using `history.push`.
        const { slug } = json;
        const newPath = slug ? '/machine-comprehension/' + slug : '/machine-comprehension';

        // We'll pass the request and response data along as part of the location object
        // so that the `Demo` component can use them to re-render.
        const location = {
          pathname: newPath,
          state: { requestData: payload, responseData: json }
        }
        this.props.history.push(location);
      }).catch((error) => {
        this.setState({outputState: "error"});
        console.error(error);
      });
    }
*/
    render() {
      const {match: {params: {doc}}} = this.props;
/*
      const passage = requestData && requestData.passage;
      const question = requestData && requestData.question;
      const answer = responseData && responseData.best_span_str;
      const attention = responseData && responseData.passage_question_attention;
      const question_tokens = responseData && responseData.question_tokens;
      const passage_tokens = responseData && responseData.passage_tokens;
*/

      return (
       <div className="pane model">
          <PaneLeft>
            <McInput doc={doc} />
          </PaneLeft>
          <PaneRight>
            <McOutput doc={doc} />
          </PaneRight>
        </div>
      );

    }
}

const McComponent = withRouter(_McComponent);

export default McComponent;
