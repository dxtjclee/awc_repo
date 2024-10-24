// Copyright (c) 2022 Siemens

/**
 * Service to drag and drop on cells
 *
 * @module js/ssp0DragAndDropOnCells
 */

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localStrg from 'js/localStorage';
import occmgmtBackingObjectProviderSvc from 'js/occmgmtBackingObjectProviderService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';

let exports = {};

/**
    * Clear the cache data.
    */
const clearCachedData = () => {
    localStrg.publish( 'draggedListData' );
};

/**
    * deHighlight Element
    */
const dehighlightElement = () => {
    const allHighlightedTargets = document.body.querySelectorAll( '.aw-theme-dropframe.aw-widgets-dropframe' );
    if ( allHighlightedTargets ) {
        _.forEach( allHighlightedTargets, function( target ) {
            eventBus.publish( 'dragDropEvent.highlight', {
                isHighlightFlag: false,
                targetElement: target
            } );
        } );
    }
};

/**
    * dragOverTreeTable
    * @param {Object} dragAndDropParams dragAndDropParams
    * @return {Object} the object with dropEffect
    */
export const dragOverTreeTable = ( dragAndDropParams ) => {
    const targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[0] : null;

    if ( targetObject !== undefined && targetObject && ( targetObject.modelType && targetObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS )
        || targetObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_WORK_CARD_PROCESS ) ) ) {
        dehighlightElement();
        dragAndDropParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dragAndDropParams.targetElement
        } );
        return {
            preventDefault: true,
            dropEffect: 'copy'
        };
    }

    dehighlightElement();
    return {
        dropEffect: 'none'
    };
};

export const createSourceObjectForSOA = ( sourceObjects ) => {
    let sourceObjectForSOA = [];
    sourceObjects.forEach( sourceObject => {
        if ( sourceObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_PART_PROCESS ) ) {
            sourceObjectForSOA.push( { uid: sourceObject.uid, type: sourceObject.type } );
        }
    } );
    return sourceObjectForSOA;
};
/**
    * dropOnTreeTable
    * @param {Object} dragAndDropParams dragAndDropParams
    * @return {Object} the object with dropEffect
    */
export const dropOnTreeTable = ( dragAndDropParams ) => {
    // dehighlightElement();
    const targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[0] : null;
    let sourceObjects = localStrg.get( 'draggedListData' );
    sourceObjects = sourceObjects ? JSON.parse( sourceObjects ) : [];
    if ( sourceObjects.length > 0 ) {
        if ( sourceObjects[0].type === servicePlannerConstants.TYPE_AWB_PART_ELEMENT || sourceObjects[0].type === servicePlannerConstants.TYPE_EQUIPMENT_REVISION ||
            sourceObjects[0].modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_AWB_ELEMENT ) ||
             sourceObjects[0].modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_EQUIPMENT_REVISION ) )  {
            return occmgmtBackingObjectProviderSvc.getBackingObjects( sourceObjects ).then( function( response ) {
                const eventData = {
                    sourceObject: response,
                    targetObject: targetObject
                };
                _highlighTargetAndClearCacheData( dragAndDropParams, eventData );
            } );
        }
        let sourceObjectsForSOA = createSourceObjectForSOA( sourceObjects );

        const eventData = {
            sourceObject: sourceObjectsForSOA,
            targetObject: targetObject
        };
        _highlighTargetAndClearCacheData( dragAndDropParams, eventData );
    }
};

let _highlighTargetAndClearCacheData = ( dragAndDropParams, eventData ) => {
    eventBus.publish( 'Ssp0ServicePlanTree.consumePart', { consumePartData: eventData } );
    dragAndDropParams.callbackAPIs.highlightTarget( {
        isHighlightFlag: false,
        targetElement: dragAndDropParams.targetElement
    } );
    clearCachedData();
};

/**
    * Publish the dragged List data
    * @param {Object} extraParams extraParams
    * @param {Object} dnDParams dragged and dropped parameters
    */
export let listDragStart = ( extraParams, dnDParams ) => {
    localStrg.publish( 'draggedListData', JSON.stringify( dnDParams.targetObjects ) );
};

/**
    * VMO entering to Mfe Message View
    * @return {Object} the object with dropEffect
*/
export let mfeMessageViewDragEnter = () => {
    return {
        preventDefault: true,
        stopPropagation: true
    };
};

/**
    * VMO entering to Mfe Message View
    * @param {Object} dnDParams dragged and dropped parameters
    * @return {Object} the object with dropEffect
*/
export let mfeMessageViewDragLeave = ( dnDParams ) => {
    if ( !dnDParams.targetElement.contains( dnDParams.event.fromElement ) ) {
        dnDParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: false,
            targetElement: dnDParams.targetElement
        } );
    }
    return {
        dropEffect: 'none',
        stopPropagation: true
    };
};

/**
    * VMO dragging over Mfe Message View
    * @return {Object} the object with dropEffect
*/
export let mfeMessageViewDragOver = () => {
    if ( appCtxSvc.ctx.selectedVMO.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS )
        || appCtxSvc.ctx.selectedVMO.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_WORK_CARD_PROCESS ) ) {
        return {
            preventDefault: true,
            stopPropagation: true,
            dropEffect: 'copy'
        };
    }
    return {
        dropEffect: 'none',
        stopPropagation: true
    };
};
/**
    * VMO dropping on Mfe Message View
    * @param {Object} extraParams extraParams
    * @param {Object} dnDParams dragged and dropped parameters
    * @return {Object} the object with dropEffect
*/
export let mfeMessageViewDragDrop = ( extraParams, dnDParams ) => {
    let sourceObjects = localStrg.get( 'draggedListData' );
    sourceObjects = sourceObjects ? JSON.parse( sourceObjects ) : [];
    const targetObject = appCtxSvc.ctx.selectedVMO;
    if ( sourceObjects && sourceObjects.length ) {
        return occmgmtBackingObjectProviderSvc.getBackingObjects( sourceObjects ).then( function( response ) {
            const eventData = {
                sourceObject: response,
                targetObject: targetObject,
                selection: true
            };
            _highlighTargetAndClearCacheData( dnDParams, eventData );
        } );
    }
    return {
        stopPropagation: true
    };
};
/**
    * VMO dragging over Parts Tree View
    * @param {Object} dragAndDropParams dragged and dropped parameters
    * @return {Object} the object with dropEffect
*/
export let partsTreeViewDragOver = ( dragAndDropParams ) => {
    const targetElement = dragAndDropParams.targetElement;
    if ( targetElement ) {
        return {
            dropEffect: 'copy',
            preventDefault: true,
            stopPropagation: true
        };
    }
    return {
        dropEffect: 'none',
        stopPropagation: true
    };
};

/**
    * VMO dragging over Parts Tree View
    * @param {Object} dnDParams dragged and dropped parameters
    * @return {Object} the object with dropEffect
*/
export let partsTreeViewDragDrop = ( dnDParams ) => {
    let sourceObjects = localStrg.get( 'draggedListData' );
    sourceObjects = sourceObjects ? JSON.parse( sourceObjects ) : [];
    const targetObject = appCtxSvc.ctx.selectedVMO;
    if ( sourceObjects && sourceObjects.length ) {
        return occmgmtBackingObjectProviderSvc.getBackingObjects( sourceObjects ).then( function( response ) {
            const eventData = {
                sourceObject: response,
                targetObject: targetObject,
                selection: true
            };
            _highlighTargetAndClearCacheData( dnDParams, eventData );
        } );
    }
    return {
        stopPropagation: true
    };
};
export default exports = {
    partsTreeViewDragOver,
    partsTreeViewDragDrop,
    mfeMessageViewDragEnter,
    mfeMessageViewDragLeave,
    mfeMessageViewDragOver,
    mfeMessageViewDragDrop,
    dropOnTreeTable,
    dragOverTreeTable,
    listDragStart
};

