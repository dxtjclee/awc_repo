// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * This is the parameters table for Analysis Request contribution
 *
 * @module js/Crt1ShowParametersTableForARArchitectureTab.parametersTableKey
 */

import _ from 'lodash';

'use strict';

var contribution = {
    id: 'Crt1ShowParametersTableForARArchitectureTab',
    priority: 10,
    clientScopeURI: 'ARMappingAttrTableForSplitPanel',
    enableSync: true,
    listenToPrimarySelectionEvent: true,
    dataProvider:'Att1ShowParametersProvider',
    options: {
        showInOut: '',
        showUnusedAttrs: false,
        showSubtreeAttrs: false,
        connectionInfo: '',
        showMappedParameters : true
    },
    parentObjects: function( commandContext ) {
        return _.map( commandContext.selection.nodeModels, 'modelObject' );
    },
    disabledCommands: [ 'replace', 'showFromChildren', 'remove', 'delete', 'paste', 'compare', 'setDirection' ],
    condition: 'commandContext.context.openedObject.modelType.typeHierarchyArray.indexOf( \'Crt0VldnContractRevision\' ) > -1 && commandContext.context.pageContext.secondaryActiveTabId === "Ase0ArchitectureFeature" && commandContext.context.pageContext.secondaryActiveTabId !== "tc_xrt_AttributesForDCP" && commandContext.context.pageContext.secondaryActiveTabId !== "Att1ShowParametersTableForSync"',
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
