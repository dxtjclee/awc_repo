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
 * This is the parameters table for Analysis Request => Overview Tab
 *
 * @module js/Crt1ShowParametersTableForAROverviewTab.parametersTableKey
 */

'use strict';


var contribution = {
    id: 'Crt1ShowParametersTableForAROverviewTab',
    priority: 10,
    clientScopeURI: 'ARInputAttrTable',
    dataProvider:'Att1ShowParametersProvider',
    options: {
        getChartInfo : 'True',
        showInOut: '',
        hideParameterHeader:true,
        showMappedParameters : true
    },
    searchCriteria: {
        showUnusedAttrs : 'false'
    },
    disabledCommands: [ 'replace', 'showFromChildren', 'remove', 'delete', 'paste', 'add', 'compare', 'setDirection', 'export', 'import', 'edit' ],
    condition: 'commandContext.context.openedObject.modelType.typeHierarchyArray.indexOf( \'Crt0VldnContractRevision\' ) > -1 && commandContext.context.vrSublocationState.mselected.length > 0 && ((commandContext.context.vrSublocationState.mselected[0].modelType.typeHierarchyArray.indexOf( \'Crt0StudyRevision\' ) > -1 && commandContext.context.vrSublocationState.mselected[0].modelType.typeHierarchyArray.indexOf( \'Crt0RunRevision\' ) > -1 ) || (commandContext.context.vrSublocationState.mselected[0].modelType.typeHierarchyArray.indexOf( \'Crt0SimStudyRevision\' ) === -1)) && commandContext.xrtState.selectedTab === "tc_xrt_Overview"',
    policy: {
        types: [ {
            name: 'Att1AttributeAlignmentProxy',
            properties: [ {
                name: 'att1AttrInOut'
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
