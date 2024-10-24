// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/ngpBuildStrategyDragAndDropService
 */

import ngpDragAndDropSvc from 'js/services/ngpDragAndDropService';
import awDragAndDropUtils from 'js/awDragAndDropUtils';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpModelConstants from 'js/constants/ngpModelConstants';
import ngpAssignedService from 'js/services/ngpAssignedObjectsService';

let dragDataCache = {
    draggedObjUids: [],
    contextObject: null,
    sourceTable: ''
};

/**
 * @returns {Object} config for preventing default action
 */
export function dragOverAssignmentBucket() {
    //Check to ensure only Parts are dragged
    const sourceUids = awDragAndDropUtils.getCachedSourceUids();
    if( Array.isArray( sourceUids ) && sourceUids.length === 1 ) {
        const sourceObj = cdm.getObject( sourceUids[0] );
        if( mfeTypeUtils.isOfType( sourceObj, ngpModelConstants.BUILD_ELEMENT_TYPE ) ) {
            return ngpDragAndDropSvc.getValidToDropReturnObject();
        }
    }
    return ngpDragAndDropSvc.getInvalidToDropReturnObject();
}

/**
 * @returns {Object} config for preventing default action
 */
export function dropOnAssignmentBucket() {
    const sourceUids = awDragAndDropUtils.getCachedSourceUids();
    const sourceObj = cdm.getObject( sourceUids[0] );
    eventBus.publish( 'ngp.setProductSourceContext', { context : [ sourceObj ] } );
    return {
        preventDefault: true
    };
}

/**
 * @param {Object} dragData dragAndDrop Params
 */
export function dragStartAssignedPartsTable( dragData ) {
    dragDataCache.sourceTable = 'NgpAssignedPartsTable';
    if( dragData && dragData.targetObjects && ngpTypeUtils.isPlanningScope( dragData.declViewModel.data.contextObject ) ) {
        dragDataCache.contextObject = dragData.declViewModel.data.contextObject;
        dragDataCache.draggedObjUids = dragData.targetObjects.map( object => object.uid );
    } else {
        dragData.event.preventDefault();
    }
}

/**
 *
*/
export function dragEndAssignedPartsTable() {
    clearDragDataCache();
    ngpDragAndDropSvc.clearCurrentlyHighlightedElement();
}

/**
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
export function dragOverBuildStrategyTable( dropData ) {
    let draggedUids = awDragAndDropUtils.getCachedSourceUids();
    let validToDrag = false;

    if( dragDataCache.contextObject ) {
        draggedUids = dragDataCache.draggedObjUids;
    }

    if( Array.isArray( dropData.targetObjects ) && Array.isArray( draggedUids ) && draggedUids.length > 0 ) {
        let assignToTargets = dropData.targetObjects;
        if ( dragDataCache.sourceTable === 'NgpAssignedPartsTable' ) {
            assignToTargets = assignToTargets.filter( ( obj ) =>   ngpTypeUtils.isPlanningScope( obj )  ||
            ngpTypeUtils.isProcessElement( obj ) &&
            ngpTypeUtils.isActivity( dragDataCache.contextObject ) &&
            obj.props.mpr0activity.dbValue === dragDataCache.contextObject.uid );
        } else {
            assignToTargets = assignToTargets.filter( ( obj ) =>   ngpTypeUtils.isPlanningScope( obj )  );
        }
        validToDrag = assignToTargets.length === 1 && containsAssignableObjects( draggedUids );
    }

    ngpDragAndDropSvc.clearCurrentlyHighlightedElement();
    if( validToDrag ) {
        ngpDragAndDropSvc.highlightValidTableRowDropTarget( dropData.callbackAPIs, dropData.targetElement );
        dropData.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dropData.targetElement
        } );
        return ngpDragAndDropSvc.getValidToDropReturnObject();
    }
    return ngpDragAndDropSvc.getInvalidToDropReturnObject();
}


/**
 * @param {Object} dragAndDropParams dragAndDrop Params
 * @returns {Object} config for preventing default action
 */
export function dropOnBuildStrategy( dragAndDropParams ) {
    let sourceUids = awDragAndDropUtils.getCachedSourceUids();
    const targetObject = cdm.getObject( dragAndDropParams.targetObjects[0].uid );
    const contextObj =  dragDataCache.contextObject;
    if( contextObj && !ngpTypeUtils.isProcessElement( targetObject ) ) {
        reassignObjects( sourceUids, targetObject, contextObj  );
    } else {
        if( ngpTypeUtils.isProcessElement( targetObject ) ) {
            sourceUids = dragDataCache.draggedObjUids;
        }
        assignObjects( sourceUids, targetObject );
    }
    ngpDragAndDropSvc.clearCurrentlyHighlightedElement();
    clearDragDataCache();
    return {
        preventDefault: true
    };
}

/**
 * @param {Object[]} objectsUids - array of uids that are being reassigned
 * @param {Object} targetObject - new parent for reassigned objects
 */
function assignObjects( objectsUids, targetObject ) {
    let assignedObjects = [];
    if ( Array.isArray( objectsUids ) && objectsUids.length > 0 ) {
        assignedObjects = getAssignableObjects( objectsUids );
        ngpAssignedService.assignObjects( assignedObjects, targetObject );
    }
}

/**
 * @param {Object[]} objectsUids - array of uids that are being reassigned
 * @param {Object} targetObject - new parent for reassigned objects
 * @param {Object} contextObj - scope object for the Assign Parts view
 */
function reassignObjects( objectsUids, targetObject, contextObj ) {
    let assignedObjects = [];
    objectsUids = dragDataCache.draggedObjUids;
    assignedObjects = objectsUids.map( ( uid ) => cdm.getObject( uid ) ).filter( ( obj ) => ngpTypeUtils.isAssignableObject( obj ) );

    ngpAssignedService.reassignObjects( assignedObjects, contextObj, targetObject ).then( ( reassignedUids ) => {
        reassignedUids.length > 0 && eventBus.publish( 'ngp.objectsUnassignedEvent', {
            unassignedUids:reassignedUids,
            unassignedFromObject: contextObj
        } );
    } );
}

/**
 * Drag parts from Product Assignment Bucket view to Assigned Parts view
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
export function dragOverAssignedPartsTable( dropData ) {
    const draggedUids = awDragAndDropUtils.getCachedSourceUids();
    let validToDrag = false;

    validToDrag = ngpTypeUtils.isPlanningScope( dropData.declViewModel.data.contextObject )  && Array.isArray( draggedUids ) && draggedUids.length > 0 &&
            containsAssignableObjects( draggedUids );

    return validToDrag ? ngpDragAndDropSvc.getValidToDropReturnObject() : ngpDragAndDropSvc.getInvalidToDropReturnObject();
}

/**
 * @param {Object} dragAndDropParams dragAndDrop Params
 * @returns {Object} config for preventing default action
 */
export function dropOnAssignedPartsTable( ) {
    const sourceUids = awDragAndDropUtils.getCachedSourceUids();
    let assignedObjects = [];
    if ( Array.isArray( sourceUids ) && sourceUids.length > 0 ) {
        assignedObjects = getAssignableObjects( sourceUids );
        eventBus.publish( 'ngp.dropAssignableObjects', { assignedObjects } );
    }
    return {
        preventDefault: true
    };
}

/**
 * @param {Object[]} objectsUid dragAndDrop Params
 * @returns {Boolean} true if at least one of the objects is of type of assignable (DE/DF)
 */
function containsAssignableObjects( objectsUid ) {
    return objectsUid.map( ( uid ) => cdm.getObject( uid ) ).some( ( obj ) => ngpTypeUtils.isAssignableObject( obj ) );
}

/**
 * @param {Object[]} sourceUids dragAndDrop Params
 * @returns {Object[]} vector of assignable objects
 */
function getAssignableObjects( sourceUids ) {
    const assignedObjects = [];
    sourceUids.forEach( ( sourceUid ) => {
        const sourceObj = cdm.getObject( sourceUid );
        if ( ngpTypeUtils.isAssignableObject( sourceObj ) ) {
            assignedObjects.push( sourceObj );
        }
    } );
    return assignedObjects;
}

//Clear the local dragged objects cache as soon as dran and drop action completes.
const clearDragDataCache = () => {
    dragDataCache.draggedObjUids = [];
    dragDataCache.contextObject = null;
    dragDataCache.sourceTable = '';
};


let exports = {};
export default exports = {
    dragOverAssignmentBucket,
    dropOnAssignmentBucket,
    dragOverBuildStrategyTable,
    dropOnBuildStrategy,
    dragOverAssignedPartsTable,
    dropOnAssignedPartsTable,
    dragStartAssignedPartsTable,
    dragEndAssignedPartsTable
};
