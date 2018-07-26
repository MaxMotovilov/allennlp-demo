import React from 'react';
import { BrowserRouter as Router, Route, Redirect, Switch } from 'react-router-dom';
import McComponentV1 from './components/McComponent-v1';
import MenuV1 from './components/Menu-v1';
import MenuV2 from './components/Menu-v2';

/*******************************************************************************
  <App /> Container
*******************************************************************************/


const App = () => (
  <Router>
    <div>
        <div className="pane-container">
            <Switch>
                <Redirect from="/:id(\d+)" to="/v1/:id" />
                <Redirect from="/" to="/v2/new" exact />
                <Redirect from="/v2/" to="/v2/new" exact />
            </Switch>
            <Route path="/v1/:doc?" component={MenuV1} />
            <Route path="/v1/:doc?" component={McComponentV1} />
            <Route path="/v2/:page?" component={MenuV2} />
            { /* <Route path="/v1/:page?" component={McComponent} /> */ }
        </div>
    </div>
  </Router>
);

export default App;
