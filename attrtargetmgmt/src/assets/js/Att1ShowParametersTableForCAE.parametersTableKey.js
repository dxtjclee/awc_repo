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
 * This is the parameters table for CAE contribution
 *
 * @module js/Att1ShowParametersTableForCAE.parametersTableKey
 */

 import appCtxSvc from 'js/appCtxService';

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForCAE',
    priority: 2,
    clientScopeURI: 'ShowParametersTableForCAE',
    disabledCommands: [ 'showFromChildren', 'map', 'compare' ],
    containerHeight: 600,
    condition: 'commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'CAEItemRevision\') > -1'
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
