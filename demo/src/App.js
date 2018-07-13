import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
// import McComponent from './components/McComponent';
import Menu from './components/Menu';
import { PaneLeft, PaneRight } from './components/Pane'

/*******************************************************************************
  <App /> Container
*******************************************************************************/

const McComponent = ({match: {params: {doc}}}) => (
    <div className="pane model">
      <PaneLeft doc={doc}>
        Blah
      </PaneLeft>
      <PaneRight doc={doc} />
    </div>
);

const App = () => (
  <Router>
    <div>
        <div className="pane-container">
            <Route path="/:doc?" component={Menu} />
            <Route path="/:doc?" component={McComponent} />
        </div>
    </div>
  </Router>
);

export default App;
