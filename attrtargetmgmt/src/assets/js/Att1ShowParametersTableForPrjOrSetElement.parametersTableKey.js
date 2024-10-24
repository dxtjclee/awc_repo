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
 * This is the parameters table for Project or Set(Group) Element contribution
 *
 * @module js/Att1ShowParametersTableForPrjOrSetElement.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForPrjOrSetElement',
    priority: 2,
    clientScopeURI: 'ShowAttrProxyTableForDCP_TC122',
    listenToPrimarySelectionEvent: true,
    options: { showMappedParameters: 'true' },
    containerHeight: 600,
    disabledCommands: [ 'replace' ],
    condition: '(commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'Att1ParameterPrjElement\') > -1 || commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'Att1ParameterSetElement\') > -1 )  && (commandContext.context.pageContext.secondaryActiveTabId === "tc_xrt_AttributesForDCP" || commandContext.context.pageContext.secondaryActiveTabId === "Att1ShowParametersTableForSync")'
};

/**
 *
 * @param {*} key
 * @param {*} deferred
 */
export default function( key, deferred ) {
    if ( key === 'att1ShowParametersTableKey' ) {
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}

