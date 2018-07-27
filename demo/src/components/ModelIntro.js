import React from 'react';


/*******************************************************************************
  <ModelIntro /> Component
*******************************************************************************/

class ModelIntro extends React.Component {
    render() {

      const { title, description } = this.props;

      return (
        <div>
          {title ? (
              <h2>
                <span>{title}</span>
              </h2>
          ) : null}
          {description}
        </div>
      );
  }
}

export default ModelIntro;
