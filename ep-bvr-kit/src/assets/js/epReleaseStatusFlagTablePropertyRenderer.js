// Copyright (c) 2022 Siemens

/**
 * Service for In a workflow table column renderer
 *
 * @module js/epReleaseStatusFlagTablePropertyRenderer
 */
import epTableCellRenderer from 'js/epTableCellRenderer';
import epWorkflowIndicationService from 'js/epWorkflowIndicationService';

/**
 * This will render Release Status Flag on released object into 'In a workflow' table column.
 * @param { ViewModelObject } vmo - a given viewModelObject
 * @param { DOM } containerElement - the DOM element which will contain what is eventually rendered
 */
export function rendererReleaseStatusFlagVisibility( vmo, containerElement ) {
    if( !containerElement ) {
        return;
    }
    epWorkflowIndicationService.updateVmoToWorkflow( vmo );
    vmo.indicators.forEach( indicator => {
        if( indicator.release ) {
            const releaseIconSource = indicator.release.image;
            if( releaseIconSource ) {
                const iconClass = releaseIconSource ? 'aw-ep-tableCellindicator' : 'aw-ep-AssignmentIndicationHiddenCellIcon';
                epTableCellRenderer.appendIconCellElement( releaseIconSource, containerElement, iconClass );
            }
        }

        if( indicator.workflow ) {
            const workflowIconSource = indicator.workflow.image;
            if( workflowIconSource ) {
                const iconClass = workflowIconSource ? 'aw-ep-tableCellindicator' : 'aw-ep-AssignmentIndicationHiddenCellIcon';
                epTableCellRenderer.appendIconCellElement( workflowIconSource, containerElement, iconClass );
            }
        }
    } );
}

/**
 * Renderer for releaseStatusFlagH column header
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} tooltip - tooltip object
 * @param {Object} column - column object
 */
export function releaseStatusFlagHeaderRenderer( containerElement, columnField, tooltip, column ) {
    epTableCellRenderer.columnHeaderIndicationRenderer( containerElement, columnField, column );
}

let exports;
export default exports = {
    rendererReleaseStatusFlagVisibility,
    releaseStatusFlagHeaderRenderer
};
