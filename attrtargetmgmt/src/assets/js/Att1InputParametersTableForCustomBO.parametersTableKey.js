// Copyright (c) 2022 Siemens

/**
 * This is the Input parameters table for Custom BO
 *
 * @module js/Att1InputParametersTableForCustomBO.parametersTableKey
 */

var contribution = {
    id: 'Att1InputParametersTableForCustomBO',
    priority: 1,
    usage: 'input',
    clientScopeURI: 'InputParameterTableForCustomBO',
    disabledCommands: [ 'compare' ],
    containerHeight: 600,
    condition:'commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'E2KItem9Revision\') > -1'
};

/**
 * @param {*} key
 * @param {*} deferred
 */
export default function( key, deferred ) {
    if( key === 'att1ShowInputParametersTableKey' ) {
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}
