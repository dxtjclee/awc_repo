// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * EP Planning service
 *
 * @module propRenderTemplates/planningPropRenderService
 */

import epPlanningService from 'js/epPlanningService';

/**
   * Render the weighted time column.
   * @param {Object} vmo - the vmo for the cell
   * @param {DOMElement} containerElement - the container element
   */
function rendererWeightedTime( vmo, containerElement ) {
    if( !containerElement || !vmo.uid ) {
        return;
    }
    let weightedTime = epPlanningService.getWeightedTime( vmo.uid );
    let renderedElement = document.createElement( 'div' );
    renderedElement.className = 'aw-splm-tableCellText';
    renderedElement.innerHTML = weightedTime.toFixed( 2 );
    containerElement.append( renderedElement );
}

export default {
    rendererWeightedTime
};
