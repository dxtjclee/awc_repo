// Copyright (c) 2022 Siemens

/**
 * This is the Output parameters table for Custom BO
 *
 * @module js/Att1OutputParametersTableForCustomBO.parametersTableKey
 */

var contribution = {
    id: 'Att1OutputParametersTableForCustomBO',
    priority: 1,
    usage: 'output',
    clientScopeURI: 'OutputParameterTableForCustomBO',
    disabledCommands: [ 'compare' ],
    containerHeight: 600,
    condition:'commandContext.parametersTable.parentObjects[0].modelType.typeHierarchyArray.indexOf(\'E2KItem9Revision\') > -1'
};

/**
 * @param {*} key
 * @param {*} deferred
 */
export default function( key, deferred ) {
    if( key === 'att1ShowOutputParametersTableKey' ) {
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}
