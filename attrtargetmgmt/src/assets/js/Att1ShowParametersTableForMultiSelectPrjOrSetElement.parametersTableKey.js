// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the parameters table for Multiple selection of Project or Group(Set) Element contribution
 *
 * @module js/Att1ShowParametersTableForMultiSelectPrjOrSetElement.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForMultiSelectPrjOrSetElement',
    priority: 6,
    clientScopeURI: 'AttributeMappingTable',
    enableSync: false,
    listenToPrimarySelectionEvent: true,
    options: { showMappedParameters: 'true' },
    parentObjects: 'ctx.occmgmtContext.selectedModelObjects',
    containerHeight: 600,
    disabledCommands: [ 'replace' ],
    condition: 'ctx.occmgmtContext.selectedModelObjects.length > 1 && (ctx.occmgmtContext.selectedModelObjects[0].modelType.typeHierarchyArray.indexOf(\'Att1ParameterPrjElement\') > -1 || ctx.occmgmtContext.selectedModelObjects[0].modelType.typeHierarchyArray.indexOf(\'Att1ParameterSetElement\') > -1)'
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
