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
 * This is the parameters table for Project contribution
 *
 * @module js/Att1ShowParametersTableForProject.parametersTableKey
 */

'use strict';

var contribution = {
    id: "Att1ShowParametersTableForProject",
    priority: 2,
    clientScopeURI: 'Att1ProjectParameterTable',
    disabledCommands: ['replace', 'setDirection', 'map'],
    containerHeight: 350,
    condition: '( commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'Att0ParamProject\') > -1 || commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'Att0ParamGroup\') > -1 ) && commandContext.parametersTable.parentObjects.length === 1'
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
