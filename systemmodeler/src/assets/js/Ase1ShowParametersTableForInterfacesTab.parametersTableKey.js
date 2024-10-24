// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * This is the parameters table for Interfaces table contribution
 *
 * @module js/Ase1ShowParametersTableForInterfacesTab.parametersTableKey
 */

import _ from 'lodash';

'use strict';

var contribution = {
    id: 'Ase1ShowParametersTableForInterfacesTab',
    priority: 10,
    clientScopeURI: 'ARMappingAttrTableForSplitPanel',
    enableSync: true,
    listenToPrimarySelectionEvent: true,
    dataProvider:'Att1ShowParametersProvider',
    options: {
        showFromChildren : false,
        showMappedParameters : true
    },
    condition: '(commandContext.selection[0].modelType.typeHierarchyArray.indexOf( "PSConnectionRevision" ) > -1 || commandContext.selection[0].modelType.typeHierarchyArray.indexOf( "Seg0InterfaceRevision" ) > -1 || commandContext.selection[0].modelType.typeHierarchyArray.indexOf( "Seg0IntfSpecRevision" ) > -1) && (commandContext.context.pageContext.secondaryActiveTabId === "tc_xrt_Interfaces" || commandContext.activeTab.pageId === "tc_xrt_Interfaces")'
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
