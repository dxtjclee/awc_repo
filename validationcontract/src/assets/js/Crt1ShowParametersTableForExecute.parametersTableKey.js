// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the parameters table for Analysis Request => Overview Tab
 *
 * @module js/Crt1ShowParametersTableForExecute.parametersTableKey
 */
import _ from 'lodash';

'use strict';

var contribution = {
    id: 'Crt1ShowParametersTableForExecute',
    priority: 10,
    clientScopeURI: 'ARInputAttrTable',
    dataProvider: 'Att1ShowParametersProvider',
    options: {
        getChartInfo: 'True',
        showInOut: '',
        hideParameterHeader: true,
        showMappedParameters: true
    },
    parentObjects: function( commandContext ) {
        return _.map( commandContext.context.vrSublocationState.executeLocation );
    },
    searchCriteria: {
        showUnusedAttrs: 'false'
    },
    disabledCommands: [ 'replace', 'showFromChildren', 'remove', 'delete', 'paste', 'add', 'compare', 'setDirection', 'map', 'manageMeasurements', 'addTableValue', 'export', 'import' ],
    condition: '(commandContext.context.nameToken==="com.siemens.splm.client.vrtarget.vrExecuteSubLocation:Crt1VRSubLocationForExecute")'
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
