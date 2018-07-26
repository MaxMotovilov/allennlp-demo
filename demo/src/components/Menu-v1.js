/* global window */

import React, {Fragment} from 'react';
import { Link, Switch, Route, Redirect } from 'react-router-dom';

import { get, post } from '../api-config';

/*******************************************************************************
  <Header /> Component
*******************************************************************************/

const AddButton = ({onClick}) => (
    <a href="javascript:" className="nav__add" onClick={onClick}>[+]</a>
);

class AddDoc extends React.Component {

    state = {}

    attach = (elt) => {
        this.input = elt;
        if( elt )
            elt.focus();
    }

    focus = () => {
        this.setState({ defocusing: false });
    }

    defocus = () => {
        window.setTimeout(
            () => this.setState({ defocusing: true }),
            100
        );
    }

    save = () => {
        const {input} = this;

        if( !input || !input.value )
            this.defocus();
        else
            post( '/data', [ input.value ] )
                .then(
                    response => {
                        this.props.onOK( response );
                        this.setState({ navigate: input.value });
                    },
                    () => this.defocus()
                );
    }

    funcKeys = ({keyCode}) => {
        if( keyCode === 13 )
            // Enter
            this.save();
        else if( keyCode === 27 )
            // Escape
            this.defocus();
    }

    componentDidUpdate() {
        if( this.state.defocusing )
            window.history.back();
    }

    render() {

        const {navigate} = this.state;

        if( navigate )
            return (
                <Redirect to={`/${navigate}`} />
            );

        return (<span>
            <input type="text" ref={this.attach} onFocus={this.focus} onBlur={this.defocus} onKeyUp={this.funcKeys} />
            <AddButton onClick={this.save} onFocus={this.focus} onBlur={this.defocus}  />
        </span>);
    }
}

class Menu extends React.Component {

    state = {docs: []};

    update = docs => this.setState({ docs });

    componentWillMount() {
        get( "/data/v1" ).then( this.update );
    }

    render() {
        const {match: {path, params: {doc}}} = this.props;
        const {docs} = this.state;

        const prefix = path.replace( /\/:.*$/, "" );

        return (
            <div className="menu">
              <div className="menu__content">
                <nav>
                  <ul>
                    {docs.map(
                        id => (
                          <li key={id}>
                            <span className={`nav__link ${id === doc ? "nav__link--selected" : ""}`}>
                              <Link to={`${prefix}/${id}`}>
                                <span>{id}</span>
                              </Link>
                            </span>
                          </li>
                        )
                    )}
                    <li key="add">
                        <span className={`nav__link ${doc === "add" ? "nav__link--selected" : ""}`}>
                            <Switch>
                                <Route path={`${prefix}/add`} children={
                                    <AddDoc onOK={this.update} />
                                }/>
                                <Route children={
                                    <Link to={`${prefix}/add`}>
                                        <span>
                                            <AddButton /> Add
                                        </span>
                                    </Link>
                                }/>
                            </Switch>
                        </span>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
        );
    }
}

export default Menu;
