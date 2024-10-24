// Copyright (c) 2022 Siemens

import _appCtxService from 'js/appCtxService';

'use strict';

var exports = {};


/**
 * This function will call at the reveal action of deliverables.
 *
 * @param {Object} ctx - The current context.
 */
export let updateSelectionData = function( subPanelContext ) {
    let selectedObj = subPanelContext.selected;
    let newSelectedData = subPanelContext.selectionData.selected;
    if( newSelectedData.length > 0 ) {
        if( newSelectedData[0].modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 || newSelectedData[0].modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
            selectedObj = newSelectedData[0];
        }
    }
    return {
        selected: selectedObj
    };
};

export default exports = {
    updateSelectionData
};
