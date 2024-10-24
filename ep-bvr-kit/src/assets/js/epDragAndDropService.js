// Copyright (c) 2022 Siemens

/**
 * @module js/epDragAndDropService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import epSaveService from 'js/epSaveService';
import { constants as _epBvrConstants } from 'js/epBvrConstants';
import saveInputWriterService from 'js/saveInputWriterService';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import appCtxService from 'js/appCtxService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import epChangeIndicationService from 'js/epChangeIndicationService';
import eventBus from 'js/eventBus';
import epBOPClonePasteService from 'js/epBOPClonePasteService';

const EP_SCOPE_OBJECT = 'ep.scopeObject';
const VALID_TO_DROP_OBJECT = {
    dropEffect: 'copy',
    preventDefault: true,
    stopPropagation: true
};
const INVALID_TO_DROP_OBJECT = {
    dropEffect: 'none',
    stopPropagation: true
};
let dragDataCache = {
    draggedObjUids: [],
    draggedFromView: null,
    resequence: {},
    assignment: {}
};

// let resequenceData = null;
const RESEQUENCE_INDICATION_TOP = 'aw-epDragDrop-resequenceTop';
const RESEQUENCE_INDICATION_BOTTOM = 'aw-epDragDrop-resequenceBottom';
const ASSIGNMENT_INDICATION = 'aw-epDragDrop-assignment';

/**
 * @param {Object} dragData dragAndDrop Params
 */
export const handleDragStart = ( dragData ) => {
    if( dragData && dragData.targetObjects ) {
        dragDataCache.draggedFromView = dragData.declViewModel._internal.viewId;
        dragDataCache.draggedObjUids = dragData.targetObjects.map( object => object.uid );
    } else {
        dragData.event.preventDefault();
    }
};

/**
 *
*/
export function handleDragEnd() {
    dragDataCache.draggedFromView = null;
    dragDataCache.draggedObjUids = [];
    resetResequence();
    resetAssignment();
}

/**
 * Check that only allowed types are dragged from allowed views
 *
 * @param {Array} allowedTypesFromViews Array of views and type of objects the drag is allowed from
 * @param {Boolean} readOnlyMode readonly flag
 * @param {Object} supportedTargetTypes object which should contain sourceViewId(drag from) as a key and supported types in array as value
 * @param {objUid} unSupportedTargetTypes objects which should not be dragged based on the key which is property name and types in array as value
 * @param {Object} withSequence show drag over indication between objects - to allow sequence
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function handleDragOver( allowedTypesFromViews, readOnlyMode, supportedTargetTypes, unSupportedTargetTypes, withSequence, dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const dragFrom = dragDataCache.draggedFromView;
    const targetSelected = dropData.declViewModel?.getData()?.inputObject;

    if( readOnlyMode === true ) {
        return INVALID_TO_DROP_OBJECT;
    }
    if( !targetSelected || !targetSelected.uid ) {
        return INVALID_TO_DROP_OBJECT;
    }
    if( _.isEmpty( sourceUids ) || !dragFrom ) {
        return INVALID_TO_DROP_OBJECT;
    }

    if( !_.isEmpty( unSupportedTargetTypes ) ) {
        for ( const unsupportedType of unSupportedTargetTypes ) {
            const propKey = unsupportedType.key;
            const propValues = unsupportedType.values;
            for ( const sourceUid of sourceUids ) {
                const sourceObj = cdm.getObject( sourceUid );
                if( sourceObj.props[propKey] && propValues.includes( sourceObj.props[propKey].dbValues[0] ) ) {
                    return INVALID_TO_DROP_OBJECT;
                }
            }
        }
    }
    if( supportedTargetTypes && supportedTargetTypes[ dragFrom ] ) {
        const operationSelected = targetSelected && targetSelected.type && supportedTargetTypes[ dragFrom ].includes( targetSelected.type );
        if( !operationSelected ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }

    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        const sourceObj = cdm.getObject( sourceUids[ sourceUidsIndex ] );
        if( !allowedTypesFromViews.find( entry => entry.views.includes( dragFrom ) && entry.types.includes( sourceObj.type ) ) ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }
    resetAssignment();
    dropData.targetElement.classList.add( ASSIGNMENT_INDICATION );
    dragDataCache.assignment.element = dropData.targetElement;
    if( withSequence ) {
        resetResequence();
        if ( _.isEmpty( dropData.targetObjects ) ) {
            if( dragDataCache.draggedFromView === 'EpBalancingProductBOP_EpTreeTable' ) {
                return VALID_TO_DROP_OBJECT;
            }
            return INVALID_TO_DROP_OBJECT;
        }
        const domRectForTarget = dropData.targetElement.getBoundingClientRect();
        const rowTopEdge = domRectForTarget.y;
        const threshold = domRectForTarget.height / 2;
        const currentTargetCoordinate = dropData.event.y;
        if( currentTargetCoordinate > rowTopEdge && currentTargetCoordinate < rowTopEdge + domRectForTarget.height ) {
            dragDataCache.resequence.element = dropData.targetElement;
            if( currentTargetCoordinate < rowTopEdge + threshold ) {
                dropData.targetElement.classList.add( RESEQUENCE_INDICATION_TOP );
                dragDataCache.resequence.before = true;
            } else if( currentTargetCoordinate > rowTopEdge + threshold ) {
                dropData.targetElement.classList.add( RESEQUENCE_INDICATION_BOTTOM );
                dragDataCache.resequence.before = false;
            }
        }
    }
    return VALID_TO_DROP_OBJECT;
}

/**
 * resetResequence
 */
function resetResequence() {
    if( dragDataCache.resequence.element ) {
        dragDataCache.resequence.element.classList.remove( RESEQUENCE_INDICATION_TOP );
        dragDataCache.resequence.element.classList.remove( RESEQUENCE_INDICATION_BOTTOM );
        dragDataCache.resequence = {};
    }
}

/**
 * resetAssignment
 */
function resetAssignment() {
    if( dragDataCache.assignment.element ) {
        dragDataCache.assignment.element.classList.remove( ASSIGNMENT_INDICATION );
        dragDataCache.assignment = {};
    }
}

/**
 *
 * @param {Object} partsAssignmentMode object to add specific assignmentMode to partsAddObject, should contains sourceViewId and assignmentMode
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dropParts( partsAssignmentMode, dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    let handleDropResult = handleDrop( dropData );
    // Part Assignment should pick Occurance based on MEAssignCustomizedOccurrenceType
    const partsAddObject = createAssignmentObject( null, sourceUids );
    const dragFrom = dragDataCache.draggedFromView;

    if( dragFrom && partsAssignmentMode && partsAssignmentMode.sourceViewId && partsAssignmentMode.sourceViewId === dragFrom && partsAssignmentMode.assignmentMode ) {
        partsAddObject.AssignmentMode = partsAssignmentMode.assignmentMode;
    }

    handleDropResult.saveInputWriter.addAssignedParts( handleDropResult.targetObjectInput, partsAddObject );
    //Tree handles adding of new obj
    return epSaveService.saveChanges( handleDropResult.saveInputWriter, true, handleDropResult.relatedObject ).then( function() {
        if( appCtxService.getCtx( 'epAssignmentIndication' ) && appCtxService.getCtx( 'epAssignmentIndication' ).isIndicationToggleOn === true && appCtxService.getCtx( 'state' ).params.tracking_cn ) {
            return epChangeIndicationService.loadChangeIndication().then( () => {
                eventBus.publish( 'ep.publishAssignmentIndicationChange' );
                return {
                    preventDefault: true,
                    stopPropagation: true
                };
            } );
        }
        return {
            preventDefault: true,
            stopPropagation: true
        };
    } );
}

/**
 * @param {Object} dropData objects
 * @returns {Object} target object data
 */
function getTargetObject( dropData ) {
    let inputObjectUid;
    let inputObjectType;
    if ( dropData.declViewModel.getData().inputObject ) {
        inputObjectUid = dropData.declViewModel.getData().inputObject.uid;
        inputObjectType = dropData.declViewModel.getData().inputObject.type;
    } else if( dropData.declViewModel.inputObject ) {
        inputObjectUid = dropData.declViewModel.inputObject.uid;
        inputObjectType = dropData.declViewModel.inputObject.type;
    }else if( dropData.targetObjects[0] ) {
        inputObjectUid = dropData.targetObjects[0].uid;
        inputObjectType = dropData.targetObjects[0].type;
    }
    return {
        type: inputObjectType,
        uid: inputObjectUid
    };
}

/**
 *
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function handleDrop( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const saveInputWriter = saveInputWriterService.get();
    const getTargetObjectData = getTargetObject( dropData );
    const relatedObject = sourceUids.map( sourceUid => cdm.getObject( sourceUid ) );
    const targetObjectInput = {
        id: getTargetObjectData.uid
    };
    relatedObject.push( cdm.getObject( getTargetObjectData.uid ) );
    saveInputWriter.addRelatedObjects( relatedObject );
    return {
        saveInputWriter: saveInputWriter,
        targetObjectInput: targetObjectInput,
        relatedObject: relatedObject
    };
}

/**
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dragOverWorkareas( dropData ) {
    //Check to ensure only Parts are dragged
    const sourceUids = dragDataCache.draggedObjUids;
    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        const sourceObj = cdm.getObject( sourceUids[ sourceUidsIndex ] );
        const inputObj = dropData.declViewModel.getData().inputObject;
        if( !inputObj || !inputObj.uid || !isWorkareaDropAllowedOnTarget( sourceObj, inputObj ) ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }
    return VALID_TO_DROP_OBJECT;
}

/**
 *
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dropWorkareas( dropData ) {
    return dropBoeData( dropData, _epBvrConstants.ME_WORKAREA );
}

/**
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dragOverResources( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const inputObj = dropData.declViewModel.getData().inputObject;
    //Check that we can't drag multiple resources to the Process Resource
    if( !inputObj || !inputObj.uid || sourceUids.length > 1 && mfeTypeUtils.isOfType( inputObj, _epBvrConstants.MFG_BVR_PROCESS_RESOURCE ) ) {
        return INVALID_TO_DROP_OBJECT;
    }
    //Check to ensure only Resources are dragged Target may be operation, process or process resource
    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        const sourceObj = cdm.getObject( sourceUids[ sourceUidsIndex ] );
        if( !isResourceDropAllowedOnTarget( sourceObj, inputObj ) ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }
    if( sourceUids.length === 0 ) {
        return INVALID_TO_DROP_OBJECT;
    }
    return VALID_TO_DROP_OBJECT;
}

/**
 *
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dropResources( dropData ) {
    return dropBoeData( dropData );
}

/**
 *
 * @param {Object} dropData objects
 * @param {String} relationType objects
 * @returns {Object} config for preventing default action
 */
const dropBoeData = function( dropData, relationType ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const saveInputWriter = saveInputWriterService.get();
    let relatedObject = [];
    const getTargetObjectData = getTargetObject( dropData );
    _.forEach( sourceUids, function( sourceUid ) {
        const sourceObj = cdm.getObject( sourceUid );
        relatedObject.push( sourceObj );
    } );
    const targetObjectInput = {
        id: getTargetObjectData.uid
    };
    const workareasAddObject = createAssignmentObject( relationType, sourceUids );
    relatedObject.push( cdm.getObject( getTargetObjectData.uid ) );
    saveInputWriter.addRelatedObjects( relatedObject );
    saveInputWriter.addAssignedTools( targetObjectInput, workareasAddObject );
    //Tree handles adding of new obj
    epSaveService.saveChanges( saveInputWriter, true, relatedObject );
    return {
        preventDefault: true,
        stopPropagation: true
    };
};

/**
 * @param {String} relationType relation Type
 * @param {String} assignedObjIds assigned Obj Ids
 * @return {Object} assignment jsn object
 */
let createAssignmentObject = function( relationType, assignedObjIds ) {
    if( relationType ) {
        return {
            relationType: relationType,
            Add: assignedObjIds
        };
    }
    return {
        Add: assignedObjIds,
        useDefaultRelationType: 'true'
    };
};

/**
 * @param {Object} sourceObj sourceObj Object that is dragged
 * @param {Object} targrtObj target Object to drop workarea on it
 * @return {Boolean} is drop allowed
 */
const isWorkareaDropAllowedOnTarget = function( sourceObj, targrtObj ) {
    if( !mfeTypeUtils.isOfType( sourceObj, _epBvrConstants.MFG_BVR_WORKAREA ) ) { return false; }
    if( mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_OPERATION ) ||
        mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_PROCESS ) ) {
        const scopeObject = appCtxService.getCtx( EP_SCOPE_OBJECT );
        return mfeTypeUtils.isOfType( scopeObject, _epBvrConstants.MFG_BVR_PROCESS );
    }
    return true;
};

/**
 * @param {Object} sourceObj sourceObj Object that is dragged
 * @param {Object} targrtObj target Object to drop workarea on it
 * @return {Boolean} is drop allowed
 */
const isResourceDropAllowedOnTarget = function( sourceObj, targrtObj ) {
    if( mfeTypeUtils.isOfType( sourceObj, _epBvrConstants.MFG_BVR_WORKAREA ) ) { return false; }

    const dragFrom = dragDataCache.draggedFromView;
    if( dragFrom !== 'AssemblyPlanningBoeTree_EpBoeTreeTable' ) { return false; }
    if( !mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_OPERATION ) &&
        !mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_PROCESS ) &&
        !mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_PROCESS_RESOURCE ) ) { return false; }
    return true;
};

/**
 * Drop over Target Assemblies
 * @param {Object} dropData objects
 * @returns {Promise} save promise
 */
function dropTargetAssemblies( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const resource = localeService.getLoadedText( 'PlanningMessages' );
    const saveInputWriter = saveInputWriterService.get();
    const getTargetObjectData = getTargetObject( dropData );
    let relatedObjects = {
        [ getTargetObjectData.uid ]: {
            type: getTargetObjectData.type,
            uid: getTargetObjectData.uid
        }
    };
    let objectsToModifyEntry = {
        Object: {
            nameToValuesMap: {
                id: [ getTargetObjectData.uid ]
            }
        }
    };

    let objectToAdd = [];
    //Handling drag+drop of multiple assemblies
    _.forEach( sourceUids, function( uid ) {
        relatedObjects[ uid ] = {
            type: 'BOMLine',
            uid: uid
        };
        objectToAdd.push( uid );
        objectsToModifyEntry.ProductScopes = {
            nameToValuesMap: {
                Add: objectToAdd
            }
        };
    } );
    saveInputWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, objectsToModifyEntry );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        if( response.ServiceData ) {
            const saveEventsArray = response.saveEvents;
            const modelObjects = response.ServiceData.modelObjects;
            let assemblyNameArray = [];
            let modifiedProcName = '';
            _.forEach( saveEventsArray, function( params ) {
                if( params.eventType === 'addedToRelation' ) {
                    assemblyNameArray.push( modelObjects[ params.eventObjectUid ].props.object_string.uiValues[ 0 ] );
                }
                if( params.eventType === 'modifyRelations' ) {
                    modifiedProcName = modelObjects[ params.eventObjectUid ].props.object_string.uiValues[ 0 ];
                }
            } );
            if( assemblyNameArray.length > 0 ) {
                const assemblyName = assemblyNameArray.join( ',' );
                let msg = resource.scopingSuccessMsg;
                msg = msg.format( assemblyName, modifiedProcName );
                messagingService.showInfo( msg );
            }
        }
        return {
            preventDefault: true,
            stopPropagation: true
        };
    } );
}

/**
 * Drop operations from product BOP tree to operations table or tiles
 * OR
 * Drop operations from operations table to station or process resource tile to assign operation to process resource
 *
 * @param {Object} dropData dragAndDrop Params
 */
function dropOperations( dropData ) {
    switch ( dragDataCache.draggedFromView ) {
        case 'EpBalancingProductBOP_EpTreeTable':
            dropOperationsFromProductBOP( dropData );
            break;
        case 'EpBalancingOperationsTable_EpDetailsTable':
            dropOperationsFromOperationsTable( dropData );
            break;
        default:
            // Do nothing
    }
}

/**
 * Drop operations from product BOP to operations table or tiles
 *
 * @param {Object} dropData dragAndDrop Params
 * @returns {Object} config for preventing default action
 */
function dropOperationsFromProductBOP( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    let handleDropResult = handleDrop( dropData );
    let newObjectUidArray = [];
    const localTextBundle = localeService.getLoadedText( 'BalancingMessages' );

    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        let newObjectUid = 'new_object_id' + Math.random().toString();
        newObjectUidArray.push( newObjectUid );
    }

    const sourceUidsWithClientId = {
        id: sourceUids,
        client_id: newObjectUidArray
    };

    let relatedObjects = [ dropData.targetObjects[0] ];
    if( _.isEmpty( dropData.targetObjects ) ) {
        handleDropResult.saveInputWriter.addAllocatedOperations( handleDropResult.targetObjectInput, sourceUidsWithClientId );
    } else {
        // Dragged before/ after an existing operation in operations table
        const operations = sourceUids.map( objUid => cdm.getObject( objUid ) );
        relatedObjects.push( ...operations );

        const processResourceUid = dropData.targetObjects[0].props.Mfg0processResource?.dbValues[0];
        const processResourceObj = processResourceUid ? cdm.getObject( processResourceUid ) : null;
        if( processResourceUid ) {
            // Assign to process resource
            relatedObjects.push( processResourceObj );
            handleDropResult.saveInputWriter.addAllocatedOperations( { id: processResourceUid }, sourceUidsWithClientId );
        } else {
            handleDropResult.saveInputWriter.addAllocatedOperations( handleDropResult.targetObjectInput, sourceUidsWithClientId );
        }
        handleDropResult.saveInputWriter.addRelatedObjects( relatedObjects );

        if( dragDataCache.resequence.before ) {
            newObjectUidArray.forEach( element => {
                epBOPClonePasteService.addSuccessor( handleDropResult.saveInputWriter, element, dropData.targetObjects[0] );
            } );
        } else {
            newObjectUidArray.forEach( element => {
                epBOPClonePasteService.addPredecessor( handleDropResult.saveInputWriter, element, dropData.targetObjects[0] );
            } );
        }

        const epAllowAutoRegenerateFN = appCtxService.getCtx( 'preferences.EP_AllowAutoRegenerateFindNumbers' );
        if( epAllowAutoRegenerateFN && epAllowAutoRegenerateFN[ 0 ] === 'true' ) {
            epBOPClonePasteService.addRegenarateFindNumberInput( handleDropResult.saveInputWriter, processResourceObj ? processResourceObj : dropData.declViewModel.getData().inputObject );
        }
    }
    return epSaveService.saveChanges( handleDropResult.saveInputWriter, true, handleDropResult.relatedObject ).then( function( response ) {
        if( response.ServiceData ) {
            const saveEventsArray = response.saveEvents;
            const modelObjects = response.ServiceData.modelObjects;
            let processStationsNameArray = [];
            let operationsNameArray = [];
            _.forEach( saveEventsArray, function( params ) {
                if( params.eventType === 'create' ) {
                    operationsNameArray.push( modelObjects[ params.eventObjectUid ].props.bl_rev_object_name.uiValues[ 0 ] );
                }
                if( params.eventType === 'modifyRelations' ) {
                    processStationsNameArray.push( modelObjects[ params.eventObjectUid ].props.bl_rev_object_name.uiValues[ 0 ] );
                }
            } );
            if( processStationsNameArray.length > 0 ) {
                const operationsName = operationsNameArray.join( ',' );
                let localTextBundleMessage = localTextBundle.operationsAllocationSuccessMsg.format( operationsName, processStationsNameArray[ 0 ] );
                messagingService.showInfo( localTextBundleMessage );
            }
        }
        return {
            preventDefault: true,
            stopPropagation: true
        };
    } );
}

/**
 * Drop dragged process/ operations from operations table to task/ process resource tile
 *
 * @param {Object} dropData dragAndDrop Params
 *
 * @returns {Object} config for preventing default action
 */
function dropOperationsFromOperationsTable( dropData ) {
    const draggedUids = dragDataCache.draggedObjUids;
    const operations = draggedUids.map( objUid => cdm.getObject( objUid ) );
    if ( dropData.targetElement.attributes.vmouid ) {
        // drop on station tiles
        const targetUid = dropData.targetElement.attributes.vmouid.value;
        const processResource = cdm.getObject( targetUid );

        const saveInputWriter = saveInputWriterService.get();
        // Add reassign input
        operations.forEach( operation => {
            saveInputWriter.addMoveObject( { id: [ operation.uid ] }, { bl_parent: [ processResource.uid ] } );
        } );

        // Add related objects
        const relatedObjects = [ processResource, ...operations ];
        saveInputWriter.addRelatedObjects( relatedObjects );
        epSaveService.saveChanges( saveInputWriter, true, relatedObjects );
    } else if ( dragDataCache.resequence ) {
        // resequence objects
        epBOPClonePasteService.pasteBeforeAfter( dropData.targetObjects[0], dragDataCache.resequence.before, {}, operations, undefined, true );
    }


    return {
        preventDefault: true,
        stopPropagation: true
    };
}
export default {
    handleDragOver,
    dropParts,
    dragOverWorkareas,
    dropWorkareas,
    handleDragStart,
    handleDragEnd,
    dragOverResources,
    dropResources,
    dropTargetAssemblies,
    handleDrop,
    dropOperations
};
