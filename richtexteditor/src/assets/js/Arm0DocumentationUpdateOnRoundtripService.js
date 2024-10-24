// Copyright (c) 2023 Siemens

/**
 * @module js/Arm0DocumentationUpdateOnRoundtripService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import ckeditorOperations from 'js/ckeditorOperations';
import eventBus from 'js/eventBus';
import occmgmtViewModelTreeNodeCreateService from 'js/occmgmtViewModelTreeNodeCreateService';
import occmgmtStructureEditService from 'js/occmgmtStructureEditService';
import reqACEUtils from 'js/requirementsACEUtils';

var exports = {};

let reqTreeUpdateEventSub;

export let documentationTabRefreshOnRoundTripImport = function( eventData, occContext ) {
    if( reqTreeUpdateEventSub ) {
        eventBus.unsubscribe( reqTreeUpdateEventSub );
        reqTreeUpdateEventSub = undefined;
    }
    if( eventData ) {
        if( eventData.createdObjects ) {
            reqTreeUpdateEventSub = eventBus.subscribe( 'requirmentDocumentation.updateTreeOnRoundTripImport', function() {
                eventBus.unsubscribe( reqTreeUpdateEventSub );
                reqTreeUpdateEventSub = undefined;
                let activeContext = appCtxSvc.getCtx( 'aceActiveContext' );
                addChildTreeNode( activeContext.context.vmc, eventData.createdObjects, occContext );
            } );
        }
        let updatedRevisions = [];
        if( eventData.updatedobjects ) {
            eventData.updatedobjects.forEach( uid => {
                const mo = cdm.getObject( uid );
                if( mo && mo.modelType && mo.modelType.typeHierarchyArray && mo.modelType.typeHierarchyArray.includes( 'ItemRevision' ) ) {
                    updatedRevisions.push( mo );
                }
            } );
        }
        updateDocTab( updatedRevisions, eventData.createdObjects );
    }
    // eventBus.publish( 'requirementDocumentation.refreshDocumentationTab' );
};

export let getSpecSegmentInputForRoundtripContent = function( data, ctx, createdObject ) {
    var inputCtxt = reqACEUtils.getInputContext();
    return {
        inputCtxt: inputCtxt,
        inputObjects: createdObject,
        options: [ 'ExportContentWithTraceLinks' ]
    };
};

export let updateDocTab = function( updatedRevisions, createdObjects ) {
    if( updatedRevisions && updatedRevisions.length > 0 ) {
        let updatedObjs = [];
        let deleteMarkupsForUids = [];

        if( createdObjects && createdObjects.length > 0 ) {
            // Refresh full Doc tab on created, as there is no data to add created objects in Doc tab without refresh
            eventBus.publish( 'requirementDocumentation.refreshDocumentationTab' );
            return;
        }

        updatedRevisions.forEach( obj => {
            let occUID = ckeditorOperations.getCKEditorModelElementUIDByRevID( obj.uid );
            let occObj = cdm.getObject( occUID );
            if( occObj ) {
                updatedObjs.push( occObj );
                deleteMarkupsForUids.push( obj.uid );
            }
        } );

        if( updatedObjs.length > 0 ) {
            // appCtxSvc.registerCtx( 'requirementEditorContentChanged', false );
            eventBus.publish( 'requirementDocumentation.loadUpdatedContentDataForRoundtrip', {
                CreatedObject: updatedObjs,
                DeleteMarkupsForUids: deleteMarkupsForUids
            } );
        }
    }
};

let docTabUpdateEventSub;

export let checkUpdatedObjectsForDocTab = function( updatedObjs, createdObjs ) {
    if( docTabUpdateEventSub ) {
        eventBus.unsubscribe( docTabUpdateEventSub );
        docTabUpdateEventSub = undefined;
    }

    if( createdObjs && createdObjs.length > 0 ) {
        return; // In case of new object creatation, there will be a new collab session. No need to update content.
    }

    if( updatedObjs && updatedObjs.length ) {
        docTabUpdateEventSub = eventBus.subscribe( 'requirmentDocumentation.updateDocTabOnRoundTripImportPreview', function( eventData ) {
            eventBus.unsubscribe( docTabUpdateEventSub );
            docTabUpdateEventSub = undefined;

            if( eventData && eventData.collabMode ) {
                let updatedRevisions = [];
                updatedObjs.forEach( uid => {
                    const mo = cdm.getObject( uid );
                    if( mo && mo.modelType && mo.modelType.typeHierarchyArray && mo.modelType.typeHierarchyArray.includes( 'ItemRevision' ) ) {
                        updatedRevisions.push( mo );
                    }
                } );
                updateDocTab( updatedRevisions, undefined );
            }
        } );
    }
};

/**
 * Add New Child Node In Tree for Round Trip Import
 */
let addChildTreeNode = ( vmc, createdObjects, occContext ) => {
    var parentToCreatedObjsMap = new Map();
    parentToCreatedObjsMap = getAllChildInParent( createdObjects );
    for( let [ key ] of parentToCreatedObjsMap.entries() ) {
        var parentToCreatedObjsMapValue = parentToCreatedObjsMap.get( key );
        var getNewCreatedObjectIndexInParent = new Map();
        getNewCreatedObjectIndexInParent = getNewChildIndexInParent( key, parentToCreatedObjsMapValue );
        for( let i = 0; i < parentToCreatedObjsMapValue.length; i++ ) {
            let crearedObject1 = cdm.getObject( parentToCreatedObjsMapValue[ i ] );
            let parentProperty = crearedObject1.props.awb0Parent;
            let parentTreeNode = vmc.getViewModelObject( vmc.findViewModelObjectById( parentProperty.dbValues[ 0 ] ) );
            let childNdx = 0;
            let levelNdx = parentTreeNode.levelNdx;
            const occurrenceInfo = occmgmtViewModelTreeNodeCreateService.createVMNodeUsingModelObjectInfo( crearedObject1, childNdx, levelNdx );
            occurrenceInfo.occurrenceId = crearedObject1.uid;
            occurrenceInfo.underlyingObjectType = crearedObject1.type;
            occurrenceInfo.numberOfChildren = 0;
            let loadedViewModelObjects = vmc.getLoadedViewModelObjects();
            if( parentTreeNode.isExpanded && parentTreeNode.isExpanded === true ) {
                addChildNode( occurrenceInfo, parentTreeNode, loadedViewModelObjects, levelNdx, getNewCreatedObjectIndexInParent );
                occContext.treeDataProvider.update( loadedViewModelObjects );
            }
        }
    }
};

/**
 *
 * @param {*} createdObjects
 * @returns
 */
var getAllChildInParent = function( createdObjects ) {
    var parentToCreatedObjsMap = new Map();
    for( const uid of createdObjects ) {
        var obj = cdm.getObject( uid );
        var parentUID = obj.props.awb0Parent.dbValues[ 0 ];
        if( !createdObjects.includes( parentUID ) ) {
            if( !parentToCreatedObjsMap.get( parentUID ) ) {
                parentToCreatedObjsMap.set( parentUID, [ uid ] );
            } else {
                parentToCreatedObjsMap.get( parentUID ).push( uid );
            }
        }
    }
    return parentToCreatedObjsMap;
};

/**
 *
 * @param {*} occurrenceInfo
 * @param {*} parentTreeNode
 * @param {*} loadedViewModelObjects
 * @param {*} levelNdx
 * @param {*} getNewCreatedObjectIndexInParent
 * @returns
 */
var addChildNode = function( occurrenceInfo, parentTreeNode, loadedViewModelObjects, levelNdx, getNewCreatedObjectIndexInParent ) {
    var parentNodeIndex = parentTreeNode ? getIndexFromArray( loadedViewModelObjects, parentTreeNode ) : -1;
    if( parentNodeIndex < 0 ) {
        return;
    }
    for( let [ key ] of getNewCreatedObjectIndexInParent.entries() ) {
        if( occurrenceInfo.occurrenceId === key ) {
            var getparentIndexInParent = getNewCreatedObjectIndexInParent.get( key );
            var newChildNode = occmgmtViewModelTreeNodeCreateService.createVMNodeUsingOccInfo( occurrenceInfo, parentTreeNode, levelNdx + 1 );
            var expectedVmcIndex = occmgmtStructureEditService.getVmcIndexForParentsNthChildIndex( loadedViewModelObjects,
                parentNodeIndex, getparentIndexInParent );
            loadedViewModelObjects.splice( expectedVmcIndex, 0, newChildNode );
            occmgmtStructureEditService.addChildToParentsChildrenArray( parentTreeNode, newChildNode, getparentIndexInParent );
        }
    }

    return loadedViewModelObjects;
};

/**
 * To Find the Child Index For New Child Index
 */
var getNewChildIndexInParent = function( parentObjectId, parentToCreatedObjsMapValue ) {
    var getchildIndexToCreatedObjsMap = new Map();
    var currentSpanInserted = document.querySelectorAll( '[parentid*="' + parentObjectId + '"]' );
    for( let i = 0; i < parentToCreatedObjsMapValue.length; i++ ) {
        for( let index = 0; index < currentSpanInserted.length; index++ ) {
            if( currentSpanInserted[ index ].id === parentToCreatedObjsMapValue[ i ] ) {
                getchildIndexToCreatedObjsMap.set( parentToCreatedObjsMapValue[ i ], index );
            }
        }
    }
    return getchildIndexToCreatedObjsMap;
};

/**
 *
 * @param {*} arr
 * @param {*} nodeInfo
 * @returns
 */
var getIndexFromArray = function( arr, nodeInfo ) {
    return arr.findIndex( function( co ) {
        return nodeInfo.stableId && co.stableId === nodeInfo.stableId ||
            nodeInfo.occurrenceId && co.uid === nodeInfo.occurrenceId ||
            nodeInfo.uid && co.uid === nodeInfo.uid;
    } );
};


export default exports = {
    documentationTabRefreshOnRoundTripImport,
    getSpecSegmentInputForRoundtripContent,
    checkUpdatedObjectsForDocTab
};
