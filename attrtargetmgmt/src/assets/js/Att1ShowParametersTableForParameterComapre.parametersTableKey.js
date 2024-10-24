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

import compareService from 'js/Att1CompareParametersService';
/**
  * This is the parameters table for Project contribution
  *
  * @module js/Att1ShowParametersTableForParameterComapre.parametersTableKey
  */

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForParameterComapre',
    priority: 2,
    enableSync: true,
    clientScopeURI: 'ParamCompareAttrProxy',
    listenToPrimarySelectionEvent: false,
    dataProvider: 'Att1CompareParamProvider', //'Att1CompareParamProvider',
    options: {
        compareParameters: true,
        hasServerCache: true
    },
    separator: 'paramCompareViewContext.separator',
    showContextMenu: false,
    searchCriteria: {
        comparisonElements: 'paramCompareViewContext.comparisonElements'
    },
    requestId: 'paramCompareViewContext.requestId',
    disabledCommands: [ 'manageMeasurements', 'replace', 'setDirection', 'map', 'showFromChildren', 'import', 'export', 'remove', 'delete', 'paste', 'add' ],
    condition: 'ctx.locationContext && ctx.locationContext["ActiveWorkspace:SubLocation"]==="parameterComparison"'
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


