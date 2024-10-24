// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the parameters table for Requirements tab
 *
 * @module js/Ase0ShowParametersTableForRequirementsTab.parametersTableKey
 */


import conditionService from 'js/conditionService';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

'use strict';

var contribution = {
    id: 'Ase0ShowParametersTableForRequirementsTab',
    priority: 5,
    clientScopeURI: 'AttributeMappingTable',
    enableSync: true,
    listenToPrimarySelectionEvent: true,
    options: {
        showFromChildren : false,
        showMappedParameters : true
    },
    condition: 'commandContext.context.pageContext.secondaryActiveTabId === "tc_xrt_SystemRequirements"'
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
