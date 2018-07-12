import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
// import McComponent from './components/McComponent';
import Menu from './components/Menu';
import { PaneLeft, PaneRight } from './components/Pane'

/*******************************************************************************
  <App /> Container
*******************************************************************************/

const McComponent = () => (
    <div className="pane model">
      <PaneLeft>
        Blah
      </PaneLeft>
      <PaneRight>
        Blah
      </PaneRight>
    </div>
);

const App = () => (
  <Router>
    <div>
        <div className="pane-container">
            <Route path="/:doc?" component={Menu} />
            <Route component={McComponent} />
        </div>
    </div>
  </Router>
);

export default App;
