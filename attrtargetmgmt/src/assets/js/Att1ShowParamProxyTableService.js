// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ShowParamProxyTableService
 */
import selectionService from 'js/selection.service';
import adapterService from 'js/adapterService';

var exports = {};

/**
 * @param {sourceObjects} sourceObjects of the selected Objects
 * @returns {Objects} adapted Objects
 */
export let getAdaptedObjects = function( sourceObjects ) {
    var adaptedObjects = [];
    var selection = selectionService.getSelection();
    if( sourceObjects.length > 0 && selection && selection.parent ) {
        selectionService.updateSelection( sourceObjects, selection.parent );
        adaptedObjects = adapterService.getAdaptedObjects( sourceObjects );
    }
    return adaptedObjects;
};

/**
 * @param {sourceObjects} sourceObjects of the selected Objects
 * @returns {Objects} adapted Objects
 */
export let updateSelectionToOwningObjects = function( sourceObjects ) {
    var selection = selectionService.getSelection();
    if( sourceObjects.length > 0 && selection ) {
        selectionService.updateSelection( sourceObjects, selection.parent );
    }
};

/**
 * Returns the Att1ShowParamProxyTableService instance
 *
 * @member Att1ShowParamProxyTableService
 */

export default exports = {
    getAdaptedObjects,
    updateSelectionToOwningObjects
};
