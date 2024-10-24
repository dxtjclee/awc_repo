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
 * This is the parameters table for Analysis Request => Content => Parameters Tab contribution
 *
 * @module js/Crt1ShowParametersTableForARParametersTab.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Crt1ShowParametersTableForARParametersTab',
    priority: 10,
    clientScopeURI: 'ARInputAttrTable',
    dataProvider:'Att1ShowParametersProvider',
    options: {
        showInOut: '',
        showMappedParameters : true
    },
    searchCriteria: {
        showUnusedAttrs : ''
    },
    listenToPrimarySelectionEvent: true,
    disabledCommands: [ 'replace', 'map', 'showFromChildren', 'remove', 'delete', 'paste', 'compare', 'setDirection', 'add', 'export', 'import' ],
    condition: '( commandContext.context.pageContext.secondaryActiveTabId === "tc_xrt_AttributesForDCP" || commandContext.context.pageContext.secondaryActiveTabId === "Att1ShowParametersTableForSync" ) && commandContext.context.openedObject.modelType.typeHierarchyArray.indexOf( \'Crt0VldnContractRevision\' ) > -1',
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
