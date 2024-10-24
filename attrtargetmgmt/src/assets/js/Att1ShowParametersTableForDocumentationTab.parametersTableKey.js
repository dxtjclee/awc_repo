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
 * This is the parameters table for Element contribution
 *
 * @module js/Att1ShowParametersTableForDocumentationTab.parametersTableKey
 */


import conditionService from 'js/conditionService';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForDocumentationTab',
    priority: 5,
    clientScopeURI: 'ReqAttributeMappingTable',
    enableSync: true,
    listenToPrimarySelectionEvent: true,
    options: {
        showFromChildren : false,
        showMappedParameters : true
    },
    parentObjects:  'ctx.requirements.selectedObjects',
    condition: 'commandContext.selection[0].modelType.typeHierarchyArray.indexOf(\'Awb0ConditionalElement\') > -1 && (commandContext.context.pageContext.secondaryActiveTabId === "tc_xrt_Documentation" || commandContext.activeTab.pageId === "tc_xrt_summary_table" || commandContext.activeTab.view === "Arm0RequirementDocumentationACEEditor")'
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
