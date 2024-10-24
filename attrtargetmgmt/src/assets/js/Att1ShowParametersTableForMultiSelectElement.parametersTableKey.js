// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the parameters table for Multiple selection of Element contribution
 *
 * @module js/Att1ShowParametersTableForMultiSelectElement.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForMultiSelectElement',
    priority: 5,
    clientScopeURI: 'AttributeMappingTable',
    enableSync: false,
    listenToPrimarySelectionEvent: true,
    options: { showMappedParameters: 'true' },
    parentObjects: 'ctx.occmgmtContext.selectedModelObjects',
    containerHeight: 600,
    condition: 'ctx.occmgmtContext && ctx.occmgmtContext.selectedModelObjects.length > 1 && (ctx.occmgmtContext.selectedModelObjects[0].modelType.typeHierarchyArray.indexOf(\'Awb0ConditionalElement\') > -1 || ctx.occmgmtContext.selectedModelObjects[0].modelType.typeHierarchyArray.indexOf(\'Awb0Interface\') > -1)'
};

/**
 *
 * @param {*} key
 * @param {*} deferred
 */
export default function( key, deferred ) {
    if( key === 'att1ShowParametersTableKey' ) {
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}
