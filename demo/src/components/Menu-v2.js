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

class SaveAsButton extends React.Component {

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
            post( '/data/v2',  [ {name: input.value /* rest of page state */} ] )
                .then(
                    response => {
                        this.props.onOK( response );
                        const newPage = Object.keys(response).filter( key => response[key] === input.value )[0];
                        if( newPage )
                            this.setState({ navigate: newPage });
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
                <Redirect to={`/v2/${navigate}`} />
            );

        return (<span>
            <input type="text" ref={this.attach} onFocus={this.focus} onBlur={this.defocus} onKeyUp={this.funcKeys} />
            <AddButton onClick={this.save} onFocus={this.focus} onBlur={this.defocus}  />
        </span>);
    }
}

class Menu extends React.Component {

    state = {pages: []};

    update = pages => this.setState({ pages });

    componentWillMount() {
        get( "/data/v2" ).then( this.update );
    }

    render() {
        const {match: {path, params: {page}}} = this.props;
        const {pages} = this.state;

        const prefix = path.replace( /\/:.*$/, "" );

        return (
            <div className="menu">
              <div className="menu__content">
                <nav>
                  <ul>
                    <li key="new">
                        <span className={`nav__link ${page === "new" ? "nav__link--selected" : ""}`}>
                          <Link to={`${prefix}/new`}>
                            <span>New search</span>
                          </Link>
                        </span>
                    </li>
                    {Object.keys(pages).map(
                        id => (
                          <li key={id}>
                            <span className={`nav__link ${id === page ? "nav__link--selected" : ""}`}>
                              <Link to={`${prefix}/${id}`}>
                                <span>{pages[id]}</span>
                              </Link>
                            </span>
                          </li>
                        )
                    )}
                    <li key="save">
                        <span className={`nav__link ${page === "save" ? "nav__link--selected" : ""}`}>
                            <Switch>
                                <Route path={`${prefix}/save`} children={
                                    <SaveAsButton onOK={this.update} />
                                }/>
                                <Route children={
                                    <Link to={`${prefix}/save`}>
                                        <span>
                                            <AddButton /> Save As...
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
