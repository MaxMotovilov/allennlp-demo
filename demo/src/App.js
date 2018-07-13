import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import McComponent from './components/McComponent';
import Menu from './components/Menu';

/*******************************************************************************
  <App /> Container
*******************************************************************************/


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
