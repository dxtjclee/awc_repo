// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import mfeTableSvc from 'js/mfeTableService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import ngpClientRequiredInfoConstants from 'js/constants/ngpClientRequiredInfoConstants';
import ngpSelectUponLoadSvc from 'js/services/ngpSelectUponLoadService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpVmoPropSvc from 'js/services/ngpViewModelPropertyService';
import ngpTableService from 'js/services/ngpTableService';
import appCtxSvc from 'js/appCtxService';

/**
 * NGP Assigned Objects service
 *
 * @module js/services/ngpAssignedObjectsService
 */
'use strict';

let setSelectionFromStorage = true;

const clientRequiredInfoForPlanningScope = [ ngpClientRequiredInfoConstants.MISSING_IN_SOURCE_KEY, ngpClientRequiredInfoConstants.MISMATCH_STATUS_IN_BUILD_STRATEGY_KEY ];
const clientRequiredInfoForPlanElement = [ ngpClientRequiredInfoConstants.MISSING_IN_SOURCE_KEY, ngpClientRequiredInfoConstants.MISMATCH_STATUS_KEY, ngpClientRequiredInfoConstants.ASSSIGNMENT_TYPE_KEY ];
/**
 * This method builds a tree load result based on the assigned parts of a selected object
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {Object} contextObject - the context object
 * @param {Object} dataProvider - the data provider
 * @param {Object} sortCriteria - the sort criteria object
 * @return {Promise} - a promise object
 */
export function getAssignedParts( treeLoadInput, contextObject, dataProvider, sortCriteria ) {
    if( !contextObject ) {
        return new Promise( () => {
            const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, [], true, true, true, null );
            return {
                treeLoadResult,
                assignedParts: [],
                lastLoadedObject: {}
            };
        } );
    }
    const nodeToExpand = treeLoadInput.parentNode;
    nodeToExpand.cursorObject = {
        startReached: true,
        endReached: false
    };
    const scopeObject = nodeToExpand.uid === 'top' ? null : nodeToExpand;
    const hasMismatchOrMissingColumn = dataProvider.cols.some( ( column ) => column.propertyName === ngpClientRequiredInfoConstants.MISMATCH_OR_MISSING_COLUMN );
    let clientRequiredInfo = [];
    if( hasMismatchOrMissingColumn ) {
        if( ngpTypeUtils.isPlanningScope( contextObject ) ) {
            clientRequiredInfo = clientRequiredInfoForPlanningScope;
        } else if( ngpTypeUtils.isPlanElement( contextObject ) ) {
            clientRequiredInfo = _.clone( clientRequiredInfoForPlanElement );
            if( ngpTypeUtils.isOperation( contextObject ) ) {
                clientRequiredInfo.push( ngpClientRequiredInfoConstants.ASSIGNED_TO_OPERATION_KEY );
            }
        }
    }

    let pageSize = treeLoadInput.pageSize;
    let ctxPreferences = appCtxSvc.getCtx( 'preferences' );
    if ( ctxPreferences.NGPAssignmentsPageSize && ctxPreferences.NGPAssignmentsPageSize.length > 0 ) {
        pageSize = parseInt( ctxPreferences.NGPAssignmentsPageSize[ 0 ] );
    }

    const soaInput = {
        input: [
            {
                context: contextObject,
                clientRequiredInformation: clientRequiredInfo,
                scope: scopeObject,
                searchOptions: {
                    startFrom: cdm.getObject( treeLoadInput.cursorNodeId ),
                    pageSize: pageSize
                }
            }
        ]
    };
    if( Array.isArray( sortCriteria ) && sortCriteria.length > 0 ) {
        soaInput.input[ 0 ].searchOptions.sortOptions = [ {
            sortAttribute: sortCriteria[ 0 ].fieldName,
            ascending: sortCriteria[ 0 ].sortDirection === 'ASC'
        } ];
    }
    let treeLoadResult = {};
    const options = {
        errorsToIgnore : [ {
            description: 'User does not have READ permissions to this object.',
            errorNum: 214000,
            printError: false
        } ],
        propertyPolicyOverride : ngpTableService.getEffectiveOverriddenPolicy()
    };
    return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getAssignmentData', soaInput, options ).then(
        ( result ) => {
            const assignedObjects = result.output[ 0 ].assignedObjects;
            result.output[ 0 ].finished ? nodeToExpand.cursorObject.endReached = true : nodeToExpand.cursorObject.endReached = false;
            let childTreeNodes = [];
            if( assignedObjects ) {
                const assignObjClientRequiredInfo = result.output[ 0 ].assignObjClientRequiredInfo;
                // in case this is not the first page, then in the beginning of the array there is the "startFrom" object which was already loaded in previous page, so remove it
                if( assignedObjects.length > 0 && treeLoadInput.startChildNdx !== 0 ) {
                    assignedObjects.shift();
                    assignObjClientRequiredInfo.shift();
                }
                const showExpand = ngpTypeUtils.isPlanningScope( contextObject );
                assignedObjects.forEach( ( object, index ) => {
                    if( object.props !== undefined ) {
                        const isLeaf = !showExpand || !( object.props[ ngpPropConstants.IS_LEAF ] && object.props[ ngpPropConstants.IS_LEAF ].dbValues[ 0 ] === '0' );
                        childTreeNodes = childTreeNodes.concat( createTreeNodes( nodeToExpand, object, assignObjClientRequiredInfo[ index ], isLeaf, contextObject ) );
                    }
                } );
            }
            if( childTreeNodes.length === 0 ) {
                nodeToExpand.isLeaf = true;
            }
            childTreeNodes.forEach( ( node, index ) => node.childNdx = treeLoadInput.startChildNdx + index );
            treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childTreeNodes, true, true, nodeToExpand.cursorObject.endReached, null );
            return {
                treeLoadResult
            };
        }
    );
}
/**
 *
 * @param {ModelObject} parentNode the parent node
 * @param {ModelObject} object the object
 * @param {Object} assignObjClientRequiredInfo the client required info of the object
 * @param {Boolean} isLeaf true if node should be a leaf
 * @param {Object} contextObject - the context object
 * @return {ViewModelTreeNode[]} Array of ViewModelTreeNode
 */
function createTreeNodes( parentNode, object, assignObjClientRequiredInfo, isLeaf, contextObject ) {
    let childTreeNodes = [];
    if( assignObjClientRequiredInfo.tagArrayInfo &&  assignObjClientRequiredInfo.tagArrayInfo[ ngpClientRequiredInfoConstants.ASSSIGNMENT_TYPE_KEY ] ) {
        assignObjClientRequiredInfo.tagArrayInfo[ ngpClientRequiredInfoConstants.ASSSIGNMENT_TYPE_KEY ].forEach( ( assignmentType ) => {
            let treeNodeObject = mfeTableSvc.getTreeNodeObject( object, parentNode, isLeaf );
            treeNodeObject.assignmentType = assignmentType;
            treeNodeObject.props.assignmentType = ngpVmoPropSvc.createStringViewModelProperty( 'assignmentType', assignmentType.props[ ngpPropConstants.OBJECT_STRING ].uiValues[ 0 ], treeNodeObject );
            treeNodeObject.contextObject = contextObject;
            addMismatchOrMissingProperty( treeNodeObject, assignObjClientRequiredInfo );
            childTreeNodes.push( treeNodeObject );
        } );
    } else {
        const treeNodeObject = mfeTableSvc.getTreeNodeObject( object, parentNode, isLeaf );
        addMismatchOrMissingProperty( treeNodeObject, assignObjClientRequiredInfo );
        childTreeNodes.push( treeNodeObject );
    }
    return childTreeNodes;
}
/**
 *
 * @param {ViewModelTreeNode} treeNode the tree node
 * @param {Object} assignObjClientRequiredInfo the client required info of the object
 */
function addMismatchOrMissingProperty( treeNode, assignObjClientRequiredInfo ) {
    if( assignObjClientRequiredInfo.stringInfo ) {
        const missingInSourceVal = assignObjClientRequiredInfo.stringInfo[ ngpClientRequiredInfoConstants.MISSING_IN_SOURCE_KEY ];
        let missmatchStatusVal = '';
        if(  ngpTypeUtils.isPlanElement( treeNode.contextObject ) ) {
            missmatchStatusVal = assignObjClientRequiredInfo.stringInfo[ ngpClientRequiredInfoConstants.MISMATCH_STATUS_KEY ];
        } else {
            missmatchStatusVal = assignObjClientRequiredInfo.stringInfo[ ngpClientRequiredInfoConstants.MISMATCH_STATUS_IN_BUILD_STRATEGY_KEY ];
        }
        const status = missingInSourceVal.length === 0 ? missmatchStatusVal : missingInSourceVal;
        treeNode.props[ ngpClientRequiredInfoConstants.MISMATCH_OR_MISSING_COLUMN ] =
            ngpVmoPropSvc.createStringViewModelProperty( ngpClientRequiredInfoConstants.MISMATCH_OR_MISSING_COLUMN, status, treeNode );
    }
}

/**
 * This method unassigns objects from the selected context object
 *
 * @param {Object} contextObject - the context object
 * @param {Object[]} unassignCandidates - an array of the assigned objects to be unassigned
 * @return {Promise} - a promise object
 */
export function unassignObjects( contextObject, unassignCandidates ) {
    const assignedObjects = unassignCandidates.map( ( object ) =>
        ( {
            assignedObject: object,
            assignmentType: object.assignmentType
        } )
    );
    const input = [
        {
            assignedObjects,
            assignedTo: contextObject
        }
    ];
    return ngpSoaSvc.executeSoa( 'Process-2017-05-Assignment', 'unassignObjects', { input } ).then(
        ( result ) => {
            const unassignedObjects = result.output[ 0 ].unassignObjects;
            if( unassignedObjects.length > 0 && ngpTypeUtils.isPlanElement( contextObject ) ) {
                eventBus.publish( 'ngp.objectsUnassignedFromPlanElementEvent', {
                    unassignedObjects,
                    unassignedFromObject: contextObject
                } );
            } else {
                const unassignedUids = unassignedObjects.map( ( object ) => object.assignedObject.uid );
                unassignedUids.length > 0 && eventBus.publish( 'ngp.objectsUnassignedEvent', {
                    unassignedUids,
                    unassignedFromObject: contextObject
                } );
            }
        }
    );
}

/**
 * @param {Object[]} assignedObjects array of source objects
 * @param {Object} targetObject target object
 * @returns {Promise} promise
 */
function assignObjects( assignedObjects, targetObject ) {
    const input = [];
    input.push( {
        assignedObjects: assignedObjects,
        assignedTo: targetObject
    } );
    const options = {
        propertyPolicyOverride: {}
    };
    return ngpSoaSvc.executeSoa( 'Process-2017-05-Assignment', 'assignObjects', { input }, options ).then(
        ( response ) => {
            if( response.data[0].assignedObjectData.length > 0 ) {
                eventBus.publish( 'ngp.assignedPartsTableRefreshEvent', { targetObject } );
            }
        }
    );
}

/**
 * @param {Object} contextObject array of source objects
 * @param {Object} objectToAssignTo target object
 * @return {boolean} true if the selected object and the object that the parts were assigned to are the same
 */
export function checkIfNeedToUpdateTable( contextObject, objectToAssignTo ) {
    return contextObject ? contextObject.uid === objectToAssignTo.uid : false;
}

/**
 * @param {Object[]} assignedObjects array of source objects
 * @param {Object} unassignFrom old parent object
 * @param {Object} assignTo new parent object
 * @returns {Promise} promise
 */
function reassignObjects( assignedObjects, unassignFrom, assignTo ) {
    const input = assignedObjects.map( ( obj ) => ( {
        assignedObject: obj,
        unassignFrom,
        assignTo
    } ) );

    return ngpSoaSvc.executeSoa( 'Process-2017-05-Assignment', 'reassignObjects', { input } ).then(
        ( response ) => {
            let reassignedObjects = response.data;
            return reassignedObjects.map( ( object ) => object.reassignedObject.uid );
        }
    );
}

/**
 * findAndSetSelection
 * @param {String[]} selectionArray - an array of string arrays, with the ids chain of the selected elements
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 */
export function findAndSetSelection( selectionArray, dataProvider, viewModelData ) {
    if( dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        setSelectionFromStorage = false;
        const selectedObjects = [];
        let result = selectionArray.reduce( ( previousPromise, selection ) => previousPromise.then( ( vmo ) => {
            if( vmo ) {
                selectedObjects.push( vmo );
            }
            return findSelectionInTree( selection, dataProvider, viewModelData );
        } ), Promise.resolve() );
        result.then( ( vmo ) => {
            if( vmo ) {
                selectedObjects.push( vmo );
            }
            dataProvider.selectionModel.setSelection( selectedObjects );
            setSelectionFromStorage = true;
        } );
    }
}

/**
 *
 * @param {String[]} selection the selection
 * @param {Object} dataProvider the data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @returns {Promise} - a promise resolved with the found vmo
 */
function findSelectionInTree( selection, dataProvider, viewModelData ) {
    let vmo;
    if( selection.length > 0 ) {
        const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        vmo = loadedObjects.find( vmo => ngpTypeUtils.getProductElementID( vmo ) === selection[ 0 ] );
        if( !vmo ) {
            for( let i = 1; i < selection.length; i++ ) {
                const vmo = loadedObjects.find( vmo => ngpTypeUtils.getProductElementID( vmo ) === selection[ i ] );
                if( vmo ) {
                    if( !vmo.isExpanded ) {
                        return mfeTableSvc.expandTreeNode( dataProvider, vmo, viewModelData ).then(
                            () => findSelectionInTree( selection, dataProvider, viewModelData ) );
                    }
                    if( !vmo.cursorObject.endReached ) {
                        return dataProvider.getTreeNodePage( { data: viewModelData }, vmo, _.last( vmo.children ).id, true ).then(
                            () => findSelectionInTree( selection, dataProvider, viewModelData ) );
                    }
                    break;
                }
            }
            if( !vmo && !dataProvider.topTreeNode.cursorObject.endReached ) {
                return dataProvider.getTreeNodePage( { data: viewModelData }, dataProvider.topTreeNode, _.last( dataProvider.topTreeNode.children ).id, true ).then(
                    () => findSelectionInTree( selection, dataProvider, viewModelData ) );
            }
        }
    }
    return new Promise( ( res ) => res( vmo ) );
}

/**
 * updateSelection
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 */
export function setSelectionFromStorageData( dataProvider, viewModelData ) {
    if( setSelectionFromStorage ) {
        const selectionUids = ngpSelectUponLoadSvc.getUidsToSelectUponLoad( true );
        if( selectionUids.length > 0 ) {
            findAndSetSelection( [ selectionUids ], dataProvider, viewModelData );
        }
    }
}

/**
 *
 * @param {Object[]} unassignedObjects the unassigned objects
 * @param {Object} dataProvider the data provider
 */
export function updateTableAfterRemoveFromPlanElement( unassignedObjects, dataProvider ) {
    const viewModelCollection = dataProvider.getViewModelCollection();
    unassignedObjects.forEach( ( object ) => {
        const index = viewModelCollection.getLoadedViewModelObjects().findIndex( ( vmo ) => vmo.uid === object.assignedObject.uid && vmo.assignmentType.uid === object.assignmentType.uid );
        if( index > -1 ) {
            const removedVmos = viewModelCollection.getLoadedViewModelObjects().splice( index, 1 );
            dataProvider.selectionModel.removeFromSelection( removedVmos[ 0 ] );
        }
    } );
    dataProvider.viewModelCollection.setTotalObjectsFound( viewModelCollection.getLoadedViewModelObjects().length );
    dataProvider.noResults = viewModelCollection.getLoadedViewModelObjects().length === 0;
}

let exports = {};
export default exports = {
    getAssignedParts,
    assignObjects,
    unassignObjects,
    reassignObjects,
    checkIfNeedToUpdateTable,
    findAndSetSelection,
    setSelectionFromStorageData,
    updateTableAfterRemoveFromPlanElement
};
