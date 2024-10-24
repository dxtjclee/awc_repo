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
 * This is the parameters table Crt1ShowParametersTableForTestResultTab
 *
 * @module js/Crt1ShowParametersTableForTestResultTab.parametersTableKey
 */

'use strict';

var contribution = {
    id: 'Crt1ShowParametersTableForTestResultTab',
    priority: 10,
    clientScopeURI: 'ARInputAttrTable',
    dataProvider:'Att1ShowParametersProvider',
    options: {
        getChartInfo : 'True',
        showInOut: '',
        showUnusedAttrs: false,
        hideParameterHeader:false,
        showMappedParameters : true
    },
    searchCriteria: {
        rootElementUids:'',
        productContextUids:''
    },
    parentObjects: function( commandContext ) {
        return commandContext.selectionData.selected;
    },
    separator:'#',
    disabledCommands: [ 'replace', 'map', 'showFromChildren', 'remove', 'delete', 'paste', 'add', 'compare', 'setDirection', 'edit', 'addTableValue', 'manageMeasurements' ],
    condition: 'commandContext.context.pageContext.secondaryActiveTabId === "Crt1ShowPlanTable"',
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
