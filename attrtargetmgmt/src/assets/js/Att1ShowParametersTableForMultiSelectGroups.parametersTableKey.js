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
 * This is the parameters table for Multiple selection of parameters Group contribution
 *
 * @module js/Att1ShowParametersTableForMultiSelectGroups.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForMultiSelectGroups',
    priority: 2,
    clientScopeURI: 'Att1ProjectParameterTableMultiSelect',
    enableSync: false,
    listenToPrimarySelectionEvent: true,
    parentObjects: 'commandContext.parametersTable.parentObjects',
    disabledCommands: [ 'replace', 'setDirection', 'map' ],
    condition: 'commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'Att0ParamGroup\') > -1 && commandContext.parametersTable.parentObjects.length > 1'
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

