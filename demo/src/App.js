import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import McComponentV1 from './components/McComponent-v1';
import MenuV1 from './components/Menu-v1';

/*******************************************************************************
  <App /> Container
*******************************************************************************/


const App = () => (
  <Router>
    <div>
        <div className="pane-container">
            <Route path="/v1/:doc?" component={MenuV1} />
            <Route path="/v1/:doc?" component={McComponentV1} />
        </div>
    </div>
  </Router>
);

export default App;
