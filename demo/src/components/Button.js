import React from 'react';

/*******************************************************************************
  <Button /> Component
*******************************************************************************/

class Button extends React.Component {
    render() {
      const { enabled, onClick, children } = this.props;

      return (
      <button id="input--mc-submit" type="button" disabled={!enabled} className="btn btn--icon-disclosure" onClick={onClick}>
        {children}
        <svg>
          <use xlinkHref="#icon__disclosure"></use>
        </svg>
      </button>
      );
    }
  }

  export default Button;
