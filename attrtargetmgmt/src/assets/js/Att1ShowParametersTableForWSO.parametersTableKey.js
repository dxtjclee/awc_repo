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
 * This is the parameters table for WSO contribution
 *
 * @module js/Att1ShowParametersTableForWSO.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForWSO',
    priority: 1,
    clientScopeURI: 'ShowParametersTableForWSO',
    disabledCommands: [ 'showFromChildren', 'map', 'compare' ],
    containerHeight: 600,
    condition: 'commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'WorkspaceObject\') > -1'
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
