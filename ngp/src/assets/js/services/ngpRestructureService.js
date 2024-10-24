// Copyright (c) 2022 Siemens

import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import mfeTableSvc from 'js/mfeTableService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import ngpAssignmentMappSvc from 'js/services/ngpAssignmentMappingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import popupSvc from 'js/popupService';
import localeService from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import msgSvc from 'js/messagingService';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import ngpLoadService from 'js/services/ngpLoadService';

/**
 * NGP Restructure service
 *
 * @module js/services/ngpRestructureService
 */

const localizedMsgs = localeService.getLoadedText( 'NgpBuildStrategyMessages' );
const localizedMessages = localeService.getLoadedText( 'NgpDataMgmtMessages.json' );

/**
 * This method restructures the "toBeMoved" objects to be under the new parent
 * @param {TreeNodeVMO[]} treeNodesToBeMoved - modelObjects to be moved
 * @param {modelObject} newParent - the parent modelObject
 * @return {Promise} a promise
 */
export function restructure( treeNodesToBeMoved, newParent ) {
    const input = [];
    const movedObjectWithOldParentArray = [];
    treeNodesToBeMoved.forEach( ( obj ) => {
        const oldParentUid = obj.props[ngpModelUtils.getParentPropertyName( obj )].dbValue;
        if ( oldParentUid !== newParent.uid ) {
            movedObjectWithOldParentArray.push( {
                uidToBeMoved: obj.uid,
                oldParentUid
            } );
            input.push( {
                child: obj,
                newParent
            } );
        }
    } );
    if ( input.length > 0 ) {
        return callRestructureSoa( input, movedObjectWithOldParentArray, newParent );
    }
    const msg = treeNodesToBeMoved.length > 1 ? localizedMsgs.cannotReparentItemsToTheirOwnParent :
        localizedMsgs.cannotReparentItemToItsOwnParent.format( treeNodesToBeMoved[ 0 ].props.object_string.dbValue );
    msgSvc.showError( msg );
    return new Promise( ( resolve ) => resolve( null ) );
}

/**
 *
 * @param {object[]} movedObjectsWithNewParentArray - a given set of objects which are a pair of object and new parent object
 * @param {object[]} movedObjectWithOldParentArray - a given set of objects which are a pair of object and old parent object
 * @param {modelObject} newParent - the new parent modelObject
 * @return {Promise} a promise
 */
function callRestructureSoa( movedObjectsWithNewParentArray, movedObjectWithOldParentArray, newParent ) {
    return ngpSoaSvc.executeSoa( 'Process-2017-05-RelationManagement', 'restructure', { input: movedObjectsWithNewParentArray } ).then(
        publishResturctureEvent.bind( this, movedObjectWithOldParentArray, newParent ),
        publishResturctureEvent.bind( this, movedObjectWithOldParentArray, newParent )
    );
}

/**
 *  This method publishes that a restructure event has occured
 * @param {object} movedObjectWithOldParentArray - an object with moved uid and its old parent uid
 * @param {modelObject} newParent - the new parent
 */
function publishResturctureEvent( movedObjectWithOldParentArray, newParent ) {
    eventBus.publish( 'ngp.restructureAction', {
        movedObjectWithOldParentArray,
        moveTo: newParent
    } );
}

/**
 * This method restructures the "toBeMoved" objects to be under the new parent
 * @param {TreeNodeVMO[]} treeNodesToBeMoved - modelObjects to be moved
 * @param {modelObject} newTarget - the parent modelObject
 */
export function displayMovePEsConfirmationMsg( treeNodesToBeMoved, newTarget ) {
    //show confirmation message
    const validForMove = treeNodesToBeMoved.filter( ( treeNode ) => {
        const oldParentUid = treeNode.props[ngpModelUtils.getParentPropertyName( treeNode )].dbValue;
        return oldParentUid !== newTarget.uid;
    } );
    if ( validForMove.length > 0 ) {
        const msg = treeNodesToBeMoved.length > 1 ? localizedMsgs.moveHereMultipleSelectionConfirmMsg :
            localizedMsgs.moveHereSingleSelectionConfirmMsg.format( treeNodesToBeMoved[0].props.object_string.dbValue );
        mfgNotificationUtils.displayConfirmationMsgWithNumerousButtons( msg, [ localizedMsgs.cancel, localizedMsgs.moreInformation, localizedMsgs.move ] ).then(
            ( clickedOn ) => {
                switch ( clickedOn ) {
                    case localizedMsgs.move:
                        movePEsToNewTarget( validForMove, newTarget );
                        break;
                    case localizedMsgs.moreInformation:
                        displayMoveProcessDialog( validForMove, newTarget );
                        break;
                    default:
                        break;
                }
            }
        );
    } else {
        const msg = treeNodesToBeMoved.length > 1 ? localizedMsgs.cannotReparentItemsToTheirOwnParent :
            localizedMsgs.cannotReparentItemToItsOwnParent.format( treeNodesToBeMoved[0].props.object_string.dbValue );
        msgSvc.showError( msg );
    }
}

/**
 * Displays Move Process dialog.
 * @param {TreeNodeVMO[]} moveCandidates - modelObjects to be moved
 * @param {modelObject} newTarget - the parent modelObject
 */
function displayMoveProcessDialog( moveCandidates, newTarget ) {
    popupSvc.show( {
        declView: 'NgpMoveProcessInfoDialog',
        locals: {
            caption: localizedMessages.movePEsTitle
        },
        options: {
            width: '475'
        },
        subPanelContext: {
            moveCandidates: moveCandidates,
            newTarget: newTarget
        }
    } );
}

/**
 * This method restructures the "toBeMoved" objects to be under the new parent
 * @param {TreeNodeVMO[]} treeNodesToBeMoved - modelObjects to be moved
 * @param {modelObject} newTarget - the parent modelObject
 */
export function movePEsToNewTarget( treeNodesToBeMoved, newTarget ) {
    const movedObjectWithOldParentArray = [];
    treeNodesToBeMoved.forEach( ( obj ) => {
        movedObjectWithOldParentArray.push( {
            uidToBeMoved: obj.uid,
            oldParentUid: obj.props[ ngpModelUtils.getParentPropertyName( obj ) ].dbValue
        } );
    } );
    const soaInput = {
        input: [ {
            processes: treeNodesToBeMoved,
            targetActivity: newTarget
        } ]
    };
    ngpSoaSvc.executeSoa( 'Internal-Process-2021-06-RelationManagement', 'moveProcesses', soaInput ).then(
        ( response ) => {
            if ( response.assignmentMappingFailures ) {
                ngpAssignmentMappSvc.showAssignmentMappingFailureDialog( response.assignmentMappingFailures, localizedMsgs.assignmentsCouldNotBeMoved );
            }
            eventBus.publish( 'ngp.restructureAction', {
                movedObjectWithOldParentArray,
                moveTo: newTarget
            } );
        }
    );
}

/**
 * Updates the table after the restructure
 * @param {object[]} movedObjectWithOldParentArray - an array of objects which contain the moved object and the old parent uid
 * @param {modelObject} moveTo - the objects which were moved to
 * @param {object} dataProvider - the dataprovider object
 * @param {object} viewModelData - the data object of the viewModel which called this service
 * @param {object} rootNodeTree - root table node
 */
function updateTableAfterRestructure( movedObjectWithOldParentArray, moveTo, dataProvider, viewModelData, rootNodeTree ) {
    const movedObjectsUids = [];
    movedObjectWithOldParentArray.forEach( ( { uidToBeMoved, oldParentUid } ) => {
        const toBeMoved = cdm.getObject( uidToBeMoved );
        const newParentProp = ngpModelUtils.getParentPropertyName( toBeMoved );
        const newParentUid = toBeMoved.props[ newParentProp ].dbValues[ 0 ];
        //actual restructure occurs if new parent is different from old parent
        if ( newParentUid === moveTo.uid && newParentUid !== oldParentUid ) {
            const oldParentTreeNode = _.find( dataProvider.getViewModelCollection().getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === oldParentUid );
            if ( oldParentTreeNode ) {
                mfeTableSvc.removeChildNodes( oldParentTreeNode, [ toBeMoved ], dataProvider );
            } else {
                const uidToBeMovedOldTreeNode = _.find( dataProvider.getViewModelCollection().getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === uidToBeMoved );
                if ( uidToBeMovedOldTreeNode && !uidToBeMovedOldTreeNode.isLeaf ) {
                    mfeTableSvc.removeChildNodes( uidToBeMovedOldTreeNode, uidToBeMovedOldTreeNode.children, dataProvider );
                }
                mfeTableSvc.removeFromDataProvider( [ toBeMoved.uid ], dataProvider );
            }
            movedObjectsUids.push( toBeMoved.uid );
        }
    } );

    if ( movedObjectsUids.length > 0 ) {
        let moveToTreeNode = _.find( dataProvider.getViewModelCollection().getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === moveTo.uid );
        if ( !moveToTreeNode ) {
            moveToTreeNode = moveTo.uid === rootNodeTree.uid ? rootNodeTree : moveToTreeNode;
        }
        if ( moveToTreeNode ) {
            updateNodes( moveToTreeNode, movedObjectsUids, dataProvider, viewModelData, rootNodeTree.uid );
        }
    }
}

/**
 * Updates the table after the restructure
 * @param {modelObject} parentObject -the parent object
 * @param {modelObject[]} childrenCreated - the objects which were created
 * @param {object} dataProvider - the dataprovider object
 * @param {object} viewModelData - the data object of the viewModel which called this service
 * @param {object} rootNodeTree - root table node
 */
export function updateTableAfterObjectCreated( parentObject, childrenCreated, dataProvider, viewModelData, rootNodeTree ) {
    const childrenCreatedUids = childrenCreated.map( ( object ) => object.uid );
    let parentTreeNode = null;

    if ( parentObject ) {
        parentTreeNode = _.find( dataProvider.getViewModelCollection().getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === parentObject.uid );
    }
    if ( !parentTreeNode ) {
        parentTreeNode = rootNodeTree;
    }
    updateNodes( parentTreeNode, childrenCreatedUids, dataProvider, viewModelData, rootNodeTree.uid );
}
/**
 * update tree with node that created/moved in tbale
 *
 * @param {object} parentTreeNode -the parent tree node
 * @param {String[]} modelObjectUids - the objects uid which were created/moved
 * @param {object} dataProvider - the dataprovider object
 * @param {object} viewModelData - the data object of the viewModel which called this service
 * @param {string} rootTreeNodeUid - the root tree node uid
 */
function updateNodes( parentTreeNode, modelObjectUids, dataProvider, viewModelData, rootTreeNodeUid ) {
    const modelObjects = modelObjectUids.map( ( uid ) => cdm.getObject( uid ) );
    const isLeafFunc = ( modelObj ) => !ngpModelUtils.hasContentElements( modelObj );
    if ( parentTreeNode.isExpanded || parentTreeNode.uid === rootTreeNodeUid ) {
        mfeTableSvc.appendChildNodes( parentTreeNode, modelObjects, dataProvider, isLeafFunc );
        selectWithTimeout( dataProvider, modelObjectUids );
    } else {
        parentTreeNode.isLeaf = false;
        mfeTableSvc.expandTreeNode( dataProvider, parentTreeNode, viewModelData ).then( ( ) =>
            selectWithTimeout( dataProvider, modelObjectUids )
        );
    }
}

/**
 * Updates the table after remove/delete object
 * @param {string[]} toBeDeletedUidArray - an array of objects which contain the removed/deleted objects
 * @param {string[]} toBeUpdatedUidArray - an array of objects which contain the updated objects after remove/delete
 * @param {object} dataProvider - the dataprovider object
 */
function updateTableAfterRemove( toBeDeletedUidArray, toBeUpdatedUidArray, dataProvider ) {
    let toBeUpdatedVmos = [];
    toBeUpdatedUidArray.forEach( ( uidToBeUpdated ) => {
        const parentTreeNode = _.find( dataProvider.getViewModelCollection().getLoadedViewModelObjects(),
            ( loadedVmo ) => loadedVmo.uid === uidToBeUpdated || ngpDataUtils.getFoundationId( loadedVmo ) === uidToBeUpdated );
        if ( parentTreeNode ) {
            const children = parentTreeNode.children;
            const updatedChildren = children.filter( ( child ) => toBeDeletedUidArray.indexOf( child.uid ) === -1 );
            parentTreeNode.children = updatedChildren;
            parentTreeNode.isLeaf = Boolean( parentTreeNode.children.length === 0 );
            mfeTableSvc.updateChildIndexes( parentTreeNode );
            if ( parentTreeNode.uid !== uidToBeUpdated ) {
                toBeUpdatedVmos.push( parentTreeNode.uid );
            }
        } else if( dataProvider.topTreeNode.foundationID === uidToBeUpdated ) {
            toBeUpdatedVmos.push( dataProvider.topTreeNode.uid );
            const obj = cdm.getObject( dataProvider.topTreeNode.uid );
            let childrenPropArray = ngpModelUtils.getChildrenProperties( obj );
            childrenPropArray.forEach( ( prop ) => delete obj.props[ prop ] );
        }
    } );
    mfeTableSvc.removeFromDataProvider( toBeDeletedUidArray, dataProvider );
    if ( toBeUpdatedVmos.length > 0 ) {
        ngpLoadService.loadObjects( toBeUpdatedVmos );
    }
}

/**
 *
 * @param {object} dataProvider - the dataprovider object
 * @param {string[]} uidsToSelect - the uids to select post expand
 */
function selectWithTimeout( dataProvider, uidsToSelect ) {
    setTimeout( () => {
        const loadedVmos = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        const vmosToSelect = loadedVmos.filter( ( vmo ) => uidsToSelect.indexOf( vmo.uid ) > -1 );
        dataProvider.selectionModel.setSelection( vmosToSelect );
    }, 100 );
}

/**
 *
 * @param {modelObject} orphanModelObj - the orphan modelObject
 * @param {modelObject} selectedParent - a potential parent modelObject
 * @param {modelObject} contextParent - a potential parent modelObject
 */
export function reparentOrphan( orphanModelObj, selectedParent, contextParent ) {
    const newParent = selectedParent ? selectedParent : contextParent;
    restructure( [ orphanModelObj ], newParent ).then(
        () => {
            //fetch orphan from cache to get most up to date properties
            const orphanObj = cdm.getObject( orphanModelObj.uid );
            const parentPropName = ngpModelUtils.getParentPropertyName( orphanObj );
            if ( orphanObj.props[ parentPropName ].dbValues[ 0 ] === newParent.uid ) {
                appCtxSvc.unRegisterCtx( 'ngpMarkedOrphanForMove' );
            }
        }
    );
}

let exports = {};
export default exports = {
    restructure,
    updateTableAfterRestructure,
    updateTableAfterObjectCreated,
    updateTableAfterRemove,
    displayMovePEsConfirmationMsg,
    movePEsToNewTarget,
    reparentOrphan
};
