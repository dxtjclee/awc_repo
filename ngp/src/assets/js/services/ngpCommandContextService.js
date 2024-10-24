// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpDataUtils from 'js/utils/ngpDataUtils';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpStorageSvc from 'js/services/ngpStorageService';
import ngpStorageConstants from 'js/constants/ngpStorageConstants';
import ngpVmoPropSvc from 'js/services/ngpViewModelPropertyService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

/**
 * The ngp page load service
 *
 * @module js/services/ngpCommandContextService
 */
'use strict';

/**
 * update Predecessors in CommandContext
 * @returns {string[]} - the type hierarchy of the predecessor candidates
 */
export function getPredecessorCandidateTypes() {
    const predecessors = ngpStorageSvc.getModelObjectsFromStorage( ngpStorageConstants.CONSTRAINT_FLOW_PROCESS );
    let predecessorTypeHierarchyArray = [];
    if ( Array.isArray( predecessors ) && predecessors.length > 0 ) {
        predecessorTypeHierarchyArray = predecessors[0].modelType.typeHierarchyArray;
    }
    return predecessorTypeHierarchyArray;
}

/**
 * @param {modelObject[]} selectedPasteContext - the potential context we want to paste a clone at
 * @param {modelObject} pagePasteContext - the potential context we want to paste a clone at
 * @returns {object} object containing the clone information
 */
export function getCloneConditionsData(  selectedPasteContext, pagePasteContext ) {
    let pasteContext = pagePasteContext;
    let cloneCandidatesAreFromSameHull = false;
    let cloneCandidatesTypeHierarchy = [];
    //Currently, selection context has priority over page context
    //once we involve this api in work unit tab we will need to change implementation
    if( Array.isArray( selectedPasteContext ) && selectedPasteContext.length === 1 && selectedPasteContext[0] ) {
        pasteContext = selectedPasteContext[0];
    }
    if( ngpTypeUtils.isBuildElement( pasteContext ) || ngpTypeUtils.isActivity( pasteContext ) ) {
        const selectedModelObjectHullUid = ngpDataUtils.getMfgModelUid( pasteContext, true );
        const cloneCandidates = ngpStorageSvc.getModelObjectsFromStorage( ngpStorageConstants.CLONE_CANDIDATE );
        const cloneCandidatesHull = ngpStorageSvc.getModelObjectsFromStorage( ngpStorageConstants.ORIGINAL_CLONE_HULL )[ 0 ];

        if( cloneCandidates && cloneCandidates.length > 0 ) {
            const hullUid = ngpDataUtils.getFoundationId( cloneCandidatesHull );
            cloneCandidatesAreFromSameHull = selectedModelObjectHullUid === hullUid;
            cloneCandidatesTypeHierarchy = cloneCandidates[ 0 ].modelType.typeHierarchyArray;
        }
    }
    return {
        cloneCandidatesAreFromSameHull,
        cloneCandidatesTypeHierarchy
    };
}

/**
 *
 * @param {object} object - the object which contains the value and update function
 * @param {string} pathToSaveInCmdCtx - path to save in
 * @param {any} valueToSave - the value to save
 */
export function updateObjectWithValue( { value, update }, pathToSaveInCmdCtx, valueToSave ) {
    const cloneObj = _.cloneDeep( value );
    _.set( cloneObj, pathToSaveInCmdCtx, valueToSave );
    update( cloneObj );
}

/**
 *
 * @param {object} object - the object which contains the value and update function
 * @param {string} pathToVmos - path to the vmos
 */
export function updatePropertiesOfVmos( { value, update }, pathToVmos ) {
    const vmos = _.get( value, pathToVmos );
    const updateVmos = ngpVmoPropSvc.updatePropertiesOfVmos( vmos );
    const cloneObj = _.cloneDeep( value );
    _.set( cloneObj, pathToVmos, updateVmos );
    update( cloneObj );
}

let exports;
export default exports = {
    getPredecessorCandidateTypes,
    getCloneConditionsData,
    updateObjectWithValue,
    updatePropertiesOfVmos
};
