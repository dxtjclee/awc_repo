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
 * This is the parameters table for Analysis Request from Project
 *
 * @module js/Crt1ShowParametersTableForARProject.parametersTableKey
 */

'use strict';


var contribution = {

    id: 'Crt1ShowParametersTableForARProject',
    priority: 10,
    clientScopeURI: 'ARProjectInputAttrTable',
    dataProvider: 'Att1ShowParametersProvider',
    options: {
        getChartInfo: 'True',
        showInOut: '',
        hideParameterHeader: true
    },
    searchCriteria: {
        showUnusedAttrs : 'false'
    },
    parentObjects: function( commandContext ) {
        return [ commandContext.selected ];
    },
    disabledCommands: [ 'replace', 'map', 'showFromChildren', 'remove', 'delete', 'paste', 'add', 'compare', 'setDirection' ],
    condition: '(commandContext.openedObject.props.crt0VerificationType.dbValues[0] === "Project") || (commandContext.selected.props.crt0VerificationType.dbValues[0] === "Project")',
    policy: {
        types: [ {
            name: 'Att1AttributeAlignmentProxy',
            properties: [ {
                name: 'att1AttrContext'
            } ]
        } ]
    }
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
