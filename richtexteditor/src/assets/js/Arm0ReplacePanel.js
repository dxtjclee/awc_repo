// Copyright (c) 2022 Siemens

/**
 * This provides functionality related to traceability matrix to replace the structure after matrix gets generated
 * @module js/Arm0ReplacePanel
 */
var exports = {};

/**
 * Set the selected objects on search panel.
 * @param {Object} data - the viewmodel data for this panel
 * @param {Object} selectedObjects - selected objects on search results
 */
export let handleSearchSelection = function( data, selectedObjects ) {
    if( selectedObjects.length > 0 ) {
        data.selectedObject = selectedObjects[ 0 ];
    } else {
        data.selectedObject = undefined;
    }
    return data.selectedObject;
};

export default exports = {
    handleSearchSelection
};
