/* global window */

import React, {Fragment} from 'react';
import {createPortal} from 'react-dom';
import { Link, Switch, Route, Redirect } from 'react-router-dom';
import Dropzone from 'react-dropzone';

import { get, post, upload } from '../api-config';

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
        const {location: {state}} = this.props;

        if( !input || !input.value )
            this.defocus();
        else
            post( '/data/v2',  [ {name: input.value, ...state} ] )
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

class UploadResults extends React.PureComponent {
    componentWillMount() {
        this.portal = document.getElementById( "upload_portal" );
        this.portal.style.display = "block";
    }

    componentWillUnmount() {
        this.portal.style.display = "none";
    }

    render() {
        const {reader, close} = this.props;
        const decoder = new TextDecoder( "utf-8" );

        return createPortal( (
            <div>
                <pre ref={div => div && next(div)} />
                <button onClick={close}>Close</button>
            </div>
        ), this.portal );

        function next( div ) {
            reader.read().then(
                ({value, done}) => {
                    if( done ) {
                        write( div, "\n\nFinished..." );
                    } else {
                        write( div, decoder.decode( value ) );
                        next( div );
                    }
                }
            );
        }

        function write( div, text ) {
            div.innerHTML = div.innerHTML + text;
            div.scrollTop = div.scrollHeight;
        }
    }
}

class Upload extends React.Component {

    state = {}

    onDrop = files => {
        upload("/upload", files)
            .then(
                uploading => this.setState({ uploading }),
                err => { console.error( err ); this.setState({ navigate: "new" }); }
            );
    }

    render() {
        let dropzone;
        const {uploading, navigate} = this.state;

        if( navigate )
            return (
                <Redirect to={`/v2/${navigate}`} />
            );

        if( uploading )
            return (
                <UploadResults reader={uploading} close={() => this.setState({ navigate: "new" })} />
            );

        return (
            <Dropzone
                className="nav__dropzone"
                ref={elt => { dropzone = elt }}
                accept="application/pdf"
                disableClick
                disablePreview
                onDrop={this.onDrop}
            >
                Drag and drop PDF files here<br/>
                <a href="javascript:" onClick={() => dropzone && dropzone.open()}>Click to browse</a>
            </Dropzone>
        );
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
                                <Route path={`${prefix}/save`} render={
                                    ({location}) => (
                                        <SaveAsButton onOK={this.update} location={location} />
                                    )
                                }/>
                                <Route children={
                                    <Link to={{pathname: `${prefix}/save`, state: {}}}>
                                        <span>
                                            <AddButton /> Save As...
                                        </span>
                                    </Link>
                                }/>
                            </Switch>
                        </span>
                    </li>
                    <li key="upload">
                        <span className={`nav__link ${page === "upload" ? "nav__link--selected" : ""}`}>
                            <Switch>
                                <Route path={`${prefix}/upload`} component={Upload} />
                                <Route children={
                                    <Link to={{pathname: `${prefix}/upload`, state: {}}}>
                                        <span>
                                            <AddButton /> Upload...
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
