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
 * This is the parameters table for Analysis Request => Trends Tab
 *
 * @module js/Crt1ShowParametersTableForARTrendsTab.parametersTableKey
 */

'use strict';


var contribution = {
    id: 'Crt1ShowParametersTableForARTrendsTab',
    priority: 10,
    clientScopeURI: 'Att1StudiesAttrTable',
    dataProvider:'Att1ShowParametersProvider',
    options: {
        getChartInfo : 'True',
        showInOut: '',
        hideParameterHeader:true
    },
    parentObjects: function( commandContext ) {
        return [];
    },
    disabledCommands: [ 'replace', 'map', 'showFromChildren', 'remove', 'delete', 'paste', 'add', 'compare', 'setDirection', 'edit' ],
    condition: '(commandContext.context.openedObject.modelType.typeHierarchyArray.indexOf( \'Crt0VldnContractRevision\' ) > -1 || commandContext.context.nameToken === "com.siemens.splm.client.search:SearchResultsSubLocation") && (commandContext.xrtState.selectedTab === "tc_xrt_Trends" || commandContext.xrtState.selectedTab === "tc_xrt_Runs" || commandContext.xrtState.selectedTab === "tc_xrt_TestEvents")',
    policy: {
        types: [ {
            name: 'Att1AttributeAlignmentProxy',
            properties: [ {
                name: 'att1ContextObject'
            },
            {
                name: 'att1AttrInOut'
            },
            {
                name: 'att1Result'
            },
            {
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
