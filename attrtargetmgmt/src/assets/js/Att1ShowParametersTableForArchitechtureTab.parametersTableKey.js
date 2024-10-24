// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the parameters table for Architechture Tab contribution
 *
 * @module js/Att1ShowParametersTableForArchitechtureTab.parametersTableKey
 */


import conditionService from 'js/conditionService';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForArchitechtureTab',
    priority: 6,
    clientScopeURI: 'AttributeMappingTable',
    enableSync: true,
    listenToPrimarySelectionEvent: true,
    options: {
        showFromChildren : false,
        showMappedParameters : true
    },
    parentObjects: function(commandContext){
        return _.map(commandContext.selection.nodeModels,'modelObject');
    }, 
    condition: 'commandContext.selection.nodeModels[0].modelObject.modelType.typeHierarchyArray.indexOf(\'Awb0ConditionalElement\') > -1 && commandContext.activeTab.pageId === "Ase0ArchitectureFeature"'
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
