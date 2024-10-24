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
 * @module js/Crt1ShowParametersTableForSearchContent.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Crt1ShowParametersTableForSearchContent',
    priority: 10,
    clientScopeURI: 'Att1StudiesAttrTable',
    dataProvider: 'Att1ShowParametersProvider',
    options: {
        getChartInfo: 'True',
        showInOut: '',
        hideParameterHeader: true
    },
    separator: '#',
    disabledCommands: [ 'replace', 'map', 'showFromChildren', 'remove', 'delete', 'paste', 'add', 'compare', 'setDirection', 'edit', 'manageMeasurements' ],
    condition:'(commandContext.context.nameToken==="com.siemens.splm.clientfx.tcui.xrt.objectNavigationSubLocation"||commandContext.context.nameToken==="com.siemens.splm.client.search:SearchResultsSubLocation") &&(commandContext.xrtState.selectedTab === "tc_xrt_Overview")',
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
