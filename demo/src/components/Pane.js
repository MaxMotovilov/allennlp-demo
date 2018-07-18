import React from 'react';

/*******************************************************************************
  <PaneRight /> Component
*******************************************************************************/

export const PaneRight = ({children}) => (
    <div className="pane__right model__output">
        {children}
    </div>
);

export const PaneSeparator = ({children}) => (
    <div className="pane__thumb">{children}</div>
);

export const PaneTab = ({children, selected, onClick}) => (
    <div className={`pane__tab ${selected ? "selected" : ""}`}><a href="javascript:" onClick={onClick}>{children}</a></div>
);


/*******************************************************************************
  <PaneBottom /> Component
*******************************************************************************/

export class PaneBottom extends React.Component {
  render() {
    const { outputState } = this.props;

    return (
        null
    )
  }
}


/*******************************************************************************
<PaneLeft /> Component
*******************************************************************************/

export class PaneLeft extends React.Component {

    render () {
      return (
        <div className="pane__left model__input">
          {this.props.children}
        </div>
      );
    }
}

/*******************************************************************************
<PaneTop /> Component
*******************************************************************************/

export class PaneTop extends React.Component {

  render () {
    return (
      <div className="pane__top model__input">
        {this.props.children}
      </div>
    );
  }
}
