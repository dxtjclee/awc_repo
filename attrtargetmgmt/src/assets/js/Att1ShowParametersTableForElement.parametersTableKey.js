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
 * This is the parameters table for Element contribution
 *
 * @module js/Att1ShowParametersTableForElement.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForElement',
    priority: 1,
    clientScopeURI: 'ShowAttrProxyTableForDCP_TC122',
    options: { showMappedParameters: 'true' },
    containerHeight: 600,
    disabledCommands: [],
    condition: '(commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'Awb0ConditionalElement\') > -1 || commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'Awb0Interface\') > -1 ) && commandContext.context.pageContext.secondaryActiveTabId === "tc_xrt_AttributesForDCP"'
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

