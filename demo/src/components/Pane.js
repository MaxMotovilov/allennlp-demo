import React from 'react';

/*******************************************************************************
  <PaneRight /> Component
*******************************************************************************/

export const PaneRight = ({children}) => (
    <div className="pane__right model__output">
        <div className="pane__thumb"></div>
        {children}
    </div>
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
