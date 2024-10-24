// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for ep table views
 *
 * @module js/epTableService
 */
import _ from 'lodash';
import epSaveService from 'js/epSaveService';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import policySvc from 'soa/kernel/propertyPolicyService';
import saveInputWriterService from 'js/saveInputWriterService';
import {
    constants as epLoadConstants
} from 'js/epLoadConstants';
import {
    constants as epSaveConstants
} from 'js/epSaveConstants';
import {
    constants as epBvrConstants
} from 'js/epBvrConstants';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import mfeTableService from 'js/mfeTableService';
import viewModelObjectService from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import mfeSyncUtils from 'js/mfeSyncUtils';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import awPromiseService from 'js/awPromiseService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import mfeFilterAndSortService from 'js/mfeFilterAndSortService';
import mfeContentPanelUtil from 'js/mfeContentPanelUtil';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import epBvrObjectService from 'js/epBvrObjectService';
import awTableStateSvc from 'js/awTableStateService';
import appCtxService from 'js/appCtxService';
import epCutCopyService from 'js/epCutCopyService';
import * as eventBus from 'js/eventBus';

const HAS_CHILDREN_PROP = 'hasChildren';
const propertiesForNumericSort = [
    epBvrConstants.BL_SEQUENCE_NO
];

// List of property names that should be non editable in all ep tables
const NON_EDITABLE_PROPERTIES = [ epBvrConstants.BL_FORMULA, epBvrConstants.BL_OCC_EFFECTIVITY_PROP_NAME ];

/**
 * As reusable tree table gets a random numeric id like EpTreeTable_1693320182041
 * We can't catch the tree table cellStartEdit in the tree table view model
 * So we need to find its id and register to its EpTreeTable_1693320182041.cellStartEdit event
 * to prevent the read only cell edit.
 * This is the map where the key is the viewId and
 * the value is the subscription to the current tree table cellStartEdit event
 */
let editCellEventSubscr = new Map();

/**
 * Load table columns data
 *
 * @param {String} objUid - the object uid to load its related data to display in table
 * @param {String} loadInputObject has loadTypes, propertiesToLoad, targetUid, additionalLoadParams, loadedObjectMapKeys
 *
 * @return {ObjectArray} rowsObjects - the table rows objects
 * @return {ObjectArray} totalRows - the number of table rows
 */
export function loadColumnsData( objUid, loadInputObject, toSortByClient = true ) {
    const deferred = awPromiseService.instance.defer();
    if( !objUid ) {
        return {
            rowsObjects: [],
            totalRows: 0
        };
    }

    const {
        loadTypes,
        propertiesToLoad,
        targetUid,
        additionalLoadParams,
        loadedObjectMapKeys,
        relatedObjectMapKey
    } = loadInputObject;
    loadDataFromLoadedResponse( objUid, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, loadedObjectMapKeys, relatedObjectMapKey, toSortByClient ).then( ( result ) => {
        deferred.resolve( result );
    } );
    return deferred.promise;
}

/**
 * Function accepts loadTypeInputs for creating inputs data for SOA call
 *
 * @param {string} objUid - the node uid
 * @param {StringArray} loadTypes - the load types
 * @param {StringArray} propertiesToLoad - the properties to load
 * @param {string} targetUid - the target uid
 * @param {StringArray} additionalLoadParams - additional params
 * @param {StringArray} loadedObjectMapKeys - keys for loadedObjectsMap
 * @param {StringArray} relatedObjectMapKey - key for relatedObjectMap
 * @param {boolean} toSortByClient - true if sort should be done by client, false to keep existing order returned by server
 * @returns {Object} data for table
 */
export function loadDataFromLoadedResponse( objUid, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, loadedObjectMapKeys, relatedObjectMapKey, toSortByClient = true ) {
    if( !objUid ) {
        return;
    }

    const policyId = registerGetPropertyPolicy();

    return loadAllProperties( objUid, propertiesToLoad, loadTypes, targetUid, additionalLoadParams ).then( ( response ) => {
        let rowsObjects = [];
        if( propertiesToLoad ) {
            rowsObjects.push( ...getProperties( objUid, propertiesToLoad ) );
        }
        if( loadedObjectMapKeys && response.loadedObjectsMap ) {
            const loadedObjects = response.loadedObjectsMap[ loadedObjectMapKeys ];
            loadedObjects && rowsObjects.push( ...loadedObjects );
        }

        policyId && policySvc.unregister( policyId );

        //check if response.relatedObjectsMap contains relatedObjectMapKey
        if( doesResponseContainRelatedObjectsMapKey( objUid, response, relatedObjectMapKey ) ) {
            if( !Array.isArray( relatedObjectMapKey ) ) {
                relatedObjectMapKey = [ relatedObjectMapKey ];
            }
            relatedObjectMapKey.forEach( prop => {
                if( response.relatedObjectsMap[ objUid ].additionalPropertiesMap2[ prop ] ) {
                    const relatedObjects = response.relatedObjectsMap[ objUid ].additionalPropertiesMap2[ prop ];
                    relatedObjects.indexOf( '' ) === -1 && relatedObjects.forEach( relatedObject => {
                        rowsObjects.push( response.ServiceData.modelObjects[ relatedObject ] );
                    } );
                }
            } );
        }

        const totalRows = rowsObjects ? Object.keys( rowsObjects ).length : 0;
        if( toSortByClient && toSortByClient !== 'false' ) {
            sortChildrenByProp( rowsObjects, epBvrConstants.BL_SEQUENCE_NO ); //this sort will not be needed when server will be fixed to create non decimal find numbers
        }
        return {
            rowsObjects,
            totalRows
        };
    } );
}

/**
 * Check if response.relatedObjectsMap contains given relatedObjectMapKey. If yes, then only add it to rowsObjects.
 *
 * @param {String} objUid objUid
 * @param {Object} response response
 * @param {Array/Object} relatedObjectMapKey relatedObjectMapKey
 *
 * @returns {Boolean} true or false based on if response.relatedObjectsMap contains given relatedObjectMapKey
 */
function doesResponseContainRelatedObjectsMapKey( objUid, response, relatedObjectMapKey ) {
    if( response.relatedObjectsMap && response.relatedObjectsMap.hasOwnProperty( objUid ) && relatedObjectMapKey ) {
        if( Array.isArray( relatedObjectMapKey ) ) {
            return relatedObjectMapKey.some( key => Object.keys( response.relatedObjectsMap[ objUid ].additionalPropertiesMap2 ).includes( key ) );
        }
        return Object.keys( response.relatedObjectsMap[ objUid ].additionalPropertiesMap2 ).includes( relatedObjectMapKey );
    }
}

/**
 * set hasChildren property to vmo.
 * @param { Object } vmo - viewModel Object onto which property will be set
 * @param { String } propertyKey - property key name
 */
function setHasChildrenPropertyValues( vmo, propertyKey ) {
    const updatedVmo = constructHasChildrenPropOnVmo( vmo );
    const additionalPropertiesMap = epObjectPropertyCacheService.getProperty( updatedVmo.uid, propertyKey );
    const isLeafNode = !( additionalPropertiesMap && additionalPropertiesMap[ 0 ] === 'TRUE' );
    updatedVmo.props.hasChildren.value = !isLeafNode;
    updatedVmo.props.hasChildren.dbValues = isLeafNode === true ? [ '0' ] : [ '1' ];
}

/**
 * Add hasChilderen property to the vmo object
 *
 * @param {Object} vmo - the view model object
 * @returns {Object} the updated vmo with the hasChildren property
 */
function constructHasChildrenPropOnVmo( vmo ) {
    const hasChildrenProperty = {
        value: false,
        displayValue: '',
        dbValues: [],
        propType: 'BOOLEAN',
        displayName: HAS_CHILDREN_PROP
    };
    vmo.props.hasChildren = viewModelObjectService.constructViewModelProperty( hasChildrenProperty, HAS_CHILDREN_PROP, vmo, false );
    return vmo;
}

/**
 * Load properties in order to have each tab contentCount (number of object displayed in the tab content)
 *
 * @param {String} objUid - the object uid to load its related data to display in tabs
 * @param {StringArray} propertiesToLoad - list of all tabs properties to get their content
 * @param {StringArray} loadTypes - the load types such as: GetScopeAssembly
 * @param {String} targetUid - the target uid
 * @param {StringArray} additionalLoadParams - additional load params
 *
 * @returns {Object} the object properties
 */
export function loadAllProperties( objUid, propertiesToLoad, loadTypes = [], targetUid, additionalLoadParams ) {
    propertiesToLoad && loadTypes.indexOf( epLoadConstants.GET_PROPERTIES ) < 0 && loadTypes.push( epLoadConstants.GET_PROPERTIES );
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( loadTypes, objUid, propertiesToLoad, targetUid, additionalLoadParams );
    return epLoadService.loadObject( loadTypeInput, false );
}

/**
 * Function accepts Object UID and Properties array to get
 *
 * @param { String } objUid : objects UID
 * @param { array } propertiesToLoad the props to load
 *
 * @returns {Object} data for table
 */
function getProperties( objUid, propertiesToLoad ) {
    const currModelObject = cdm.getObject( objUid );
    const relatedObjectsUids = propertiesToLoad.flatMap( prop => {
        if( currModelObject.props[ prop ] ) {
            return currModelObject.props[ prop ].dbValues;
        }
    } ).filter( Boolean );
    return relatedObjectsUids.map( uid => cdm.getObject( uid ) );
}

/**
 * Load data for tree for the first time i.e. entire process tree
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {String} topNodeUid : trees top node Uid
 * @param {Object} rootLoadInputData - the table data provider
 * @param {Object} childLoadInputData - the table data provider
 * @param {String} isLeafProperty - is leaf property
 *
 * @return {ObjectArray} treeLoadResult - treeLoadResult
 */
export function initializeLoadDataForTree( treeLoadInput, topNodeUid, rootLoadInputData, childLoadInputData, isLeafProperty = 'bl_has_children', toSortByClient = true ) {
    const parentNode = treeLoadInput.parentNode;
    const nodeToExpand = parentNode.uid;
    const isRootNode = nodeToExpand === topNodeUid;

    treeLoadInput.parentNode.cursorObject = {
        startReached: true,
        endReached: true
    };

    const inputDataObject = isRootNode ? rootLoadInputData : childLoadInputData;
    const {
        loadTypes = 'CommonExpand',
        propertiesToLoad = '',
        targetUid,
        additionalLoadParams,
        relatedObjectMapKey
    } = inputDataObject;

    return loadDataFromLoadedResponse( nodeToExpand, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, {}, relatedObjectMapKey, toSortByClient ).then( function( result ) {
        /**
         * For initial load, the top process and its children must be visible
         */

        const childTreeNodes = [];
        let topNode;
        const topNodeModelObject = cdm.getObject( topNodeUid );
        const topNodeVMO = mfeVMOService.createViewModelObjectFromModelObject( topNodeModelObject );
        if( topNodeVMO && isLeafProperty === HAS_CHILDREN_PROP ) {
            setHasChildrenPropertyValues( topNodeVMO, HAS_CHILDREN_PROP );
        }
        topNode = mfeTableService.getTreeNodeObject( topNodeVMO, parentNode, mfeTableService.isLeaf( topNodeVMO, isLeafProperty ), 0 );
        topNode.children = [];
        childTreeNodes.push( topNode );

        result.rowsObjects.forEach( ( rowObject, childNdx ) => {
            let rowObjectVMO = mfeVMOService.createViewModelObjectFromModelObject( rowObject );
            if( rowObjectVMO && isLeafProperty === HAS_CHILDREN_PROP ) {
                setHasChildrenPropertyValues( rowObjectVMO, HAS_CHILDREN_PROP );
            }
            const childNode = mfeTableService.getTreeNodeObject( rowObjectVMO, topNode, mfeTableService.isLeaf( rowObjectVMO, isLeafProperty ), childNdx );

            childTreeNodes.push( childNode );
            // if bomline we have bl_parent
            if( childNode.props.bl_parent ) {
                childNode.props.bl_parent.dbValues[ 0 ] === topNode.uid && topNode.children.push( childNode );
            }
            // Not a bom line a persistent object or some other type
            // Get the parent from the cache properties
            else {
                let parentUid = epObjectPropertyCacheService.getProperty( rowObjectVMO.uid, 'ParentUID' )[ 0 ];

                topNode.uid === parentUid && rowObjectVMO.uid !== topNode.uid && topNode.children.push( childNode );
            }
        } );

        //Disabling pagination
        treeLoadInput.pageSize = childTreeNodes.length;
        const endReached = treeLoadInput.startChildNdx + treeLoadInput.pageSize > childTreeNodes.length;
        const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childTreeNodes, false, true, endReached, null );

        if( nodeToExpand === topNodeUid && !parentNode.isExpanded ) {
            topNode.isExpanded = true;
        }
        return {
            treeLoadResult: treeLoadResult
        };
    } );
}

/**
 * loadTreeTableData
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {String} topNodeUid - trees top node Uid
 * @param {Boolean} isTopNode - if topNodeUid is a top node
 * @param {Object} rootLoadInputData - the table data provider
 * @param {Object} childLoadInputData - the table data provider
 * @param {String} isLeafProperty - is leaf property
 *
 *
 * @return {ObjectArray} treeLoadResult - treeLoadResult
 */
export function loadTreeTableData( treeLoadInput, topNodeUid, isTopNode, rootLoadInputData, childLoadInputData,
    isLeafProperty = epBvrConstants.MBC_HAS_SUB_ELEMENTS, toSortByClient = true ) {
    const parentNode = treeLoadInput.parentNode;
    const nodeToExpand = parentNode.uid;
    const isRootNode = nodeToExpand === topNodeUid;

    treeLoadInput.parentNode.cursorObject = {
        startReached: true,
        endReached: true
    };

    const inputDataObject = isRootNode ? rootLoadInputData : childLoadInputData;
    const {
        loadTypes = 'CommonExpand',
        propertiesToLoad = '',
        targetUid,
        additionalLoadParams,
        relatedObjectMapKey
    } = inputDataObject;

    return loadDataFromLoadedResponse( nodeToExpand, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, null, relatedObjectMapKey, toSortByClient ).then( function( result ) {
        let childTreeNodes = [];
        let isEmptyTopNode = false;

        if( isTopNode && isRootNode && result.rowsObjects.length === 0 ) {
            const topNodeModelObject = cdm.getObject( topNodeUid );
            let topNodeVMO = mfeVMOService.createViewModelObjectFromModelObject( topNodeModelObject );
            let topNode = mfeTableService.getTreeNodeObject( topNodeVMO, parentNode, mfeTableService.isLeaf( topNodeVMO, isLeafProperty ), 0 );
            topNode.children = [];
            childTreeNodes.push( topNode );
            isEmptyTopNode = true;
        }
        result.rowsObjects.forEach( ( rowObject, childNdx ) => {
            if( rowObject ) {
                let rowObjectVMO = mfeVMOService.createViewModelObjectFromModelObject( rowObject );
                if( rowObjectVMO && isLeafProperty === HAS_CHILDREN_PROP ) {
                    setHasChildrenPropertyValues( rowObjectVMO, HAS_CHILDREN_PROP );
                }
                childTreeNodes.push( mfeTableService.getTreeNodeObject( rowObjectVMO, parentNode, mfeTableService.isLeaf( rowObjectVMO, isLeafProperty ), childNdx ) );
            }
        } );

        //Disabling pagination
        treeLoadInput.pageSize = childTreeNodes.length;
        const endReached = treeLoadInput.startChildNdx + treeLoadInput.pageSize > childTreeNodes.length;
        const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childTreeNodes, false, true, endReached, null );

        if( isTopNode && nodeToExpand === topNodeUid && !parentNode.isExpanded && !isEmptyTopNode ) {
            const vmo = mfeVMOService.createViewModelObjectFromUid( topNodeUid );
            const topNode = mfeTableService.getTreeNodeObject( vmo, parentNode, false, 0 );
            topNode.isExpanded = true;
            topNode.children = childTreeNodes;
            treeLoadResult.rootPathNodes = [ parentNode, topNode ];
        }

        return {
            treeLoadResult: treeLoadResult
        };
    } );
}

/**
 * Remove or Add Objects
 *
 * @param {String} actionType - Remove or Add
 * @param {Object/ObjectArray} inputObj - the object/objects: its related objects to remove or add new objects to
 * @param {ObjectArray} selectedObjects - the objects to remove or add
 * @param {String} entryName - the save input entry name
 * @param {String} relationType - the relation type name
 *
 * @returns {Object} the save changes response
 */
export function removeOrAddObjects( actionType, inputObj, selectedObjects, entryName, relationType ) {
    const objectsToRemoveOrAdd = selectedObjects.map( obj => obj.uid );
    const saveInputWriter = saveInputWriterService.get();
    let relatedObject = [];

    if( Array.isArray( inputObj ) ) {
        const inputObjUid = inputObj.map( obj => obj.uid );
        saveInputWriter.addRemoveOrAddObjects( actionType, inputObjUid, objectsToRemoveOrAdd, entryName, relationType );


        relatedObject = [ ...selectedObjects, ...inputObj ];
    } else {
        saveInputWriter.addRemoveOrAddObjects( actionType, inputObj.uid, objectsToRemoveOrAdd, entryName, relationType );
        relatedObject = [ ...selectedObjects, inputObj ];
    }

    return epSaveService.saveChanges( saveInputWriter, true, relatedObject );
}

/**
 * Handle the events which were returned from the save soa server call
 *
 * @param {Object} saveEvents - the save events as json object
 * @param {String} relationNames - the relation type names
 * @param {Object} dataProvider - the table data provider
 * @param {String} inputObjectUid - selected tab scopeObject Uid
 * @param {Boolean} selectAddedObjects - flag indicating if the added objects should be selected
 * @param {Boolean} shouldHandleCreateEvent - flag indicating if want to handle create events
 */
export function handleAddRemoveSaveEvents( saveEvents, relationNames, dataProvider, inputObjectUid, selectAddedObjects = true, shouldHandleCreateEvent ) {
    if( !Array.isArray( relationNames ) ) {
        relationNames = [ relationNames ];
    }
    let objectsToBeSelected = [];
    relationNames.forEach( ( relationName ) => {
        let relevantEvents = saveEvents[ relationName ];
        if( relevantEvents ) {
            if( !Array.isArray( relevantEvents ) ) {
                relevantEvents = [ relevantEvents ];
            }
            relevantEvents.forEach( ( event ) => {
                // confirm tab scope object and save event object is same, or else no need to update tab content
                if( event.eventObjectUid === inputObjectUid && event.relatedEvents ) {
                    const relatedEvents = event.relatedEvents;
                    const objUidToDeleteList = relatedEvents[ epSaveConstants.DELETE ];
                    const objUidToRemoveList = relatedEvents[ epSaveConstants.REMOVED_FROM_RELATION ];
                    const objUidToAddList = relatedEvents[ epSaveConstants.ADDED_TO_RELATION ] || relatedEvents[epSaveConstants.CREATE_EVENT];
                    if( objUidToRemoveList && objUidToRemoveList.length > 0 ) {
                        mfeTableService.removeFromDataProvider( objUidToRemoveList, dataProvider );
                    }
                    if( objUidToDeleteList && objUidToDeleteList.length > 0 ) {
                        mfeTableService.removeFromDataProvider( objUidToDeleteList, dataProvider );
                    }
                    addNewObjectsToDataProvider( objUidToAddList, dataProvider, selectAddedObjects );
                    objUidToAddList && objUidToAddList.forEach( ( uid ) => {
                        objectsToBeSelected.push( cdm.getObject( uid ) );
                    } );
                }
            } );
        }
    } );
    return objectsToBeSelected;
}

/**
 * Add new objects to data provider
 *
 * @param {StringArray} objUidToAddList - the new object uid list to be added to the data provider
 * @param {Object} dataProvider - the table data provider
 * @param {Boolean} selectAddedObjects - flag indicating if the added objects should be selected
 */
export function addNewObjectsToDataProvider( objUidToAddList, dataProvider, selectAddedObjects ) {
    if( objUidToAddList && objUidToAddList.length > 0 ) {
        mfeTableService.addToDataProvider( objUidToAddList, dataProvider, selectAddedObjects );
    }
}

/**
 * @param {object} column - column configuration
 * @param {object} rowVMO - row vmo
 *
 * @return {Boolean} isOpaque - returns true if the partial visibility for row vmo is set
 */
function isOpaque( column, rowVMO ) {
    return epCutCopyService.isObjectCut( rowVMO );
}

/**
 * Add child nodes
 *
 * @param {Object} dataProvider - the table data provider
 * @param {Array} createdObjUIDs - createdObjUIDs
 * @param {Array} objUIDsToSelect - uids of objects to be selected
 * @param {String} isLeafProperty - property type
 * @param {Object} viewModelData - view Model Data
 * @param {String} gridId - Tree table id
 */
export function addChildNodes( dataProvider, createdObjUIDs, objUIDsToSelect, isLeafProperty = epBvrConstants.MBC_HAS_SUB_ELEMENTS, viewModelData, gridId = '' ) {
    const createdObjects = createdObjUIDs.map( uid => cdm.getObject( uid ) );
    const objectsToBeSelected = objUIDsToSelect ? objUIDsToSelect.map( uid => cdm.getObject( uid ) ) : [];
    for( let key in createdObjects ) {
        let createdObj = createdObjects[ key ];
        if( createdObj && isLeafProperty === HAS_CHILDREN_PROP ) {
            setHasChildrenPropertyValues( createdObj, HAS_CHILDREN_PROP );
        }
        let parentObject = epBvrObjectService.getProcessResourceOrStationParent( createdObj );
        const objectToAddAfter = getObjectToAddAfter( createdObj, parentObject );
        const parentTreeNode = getTreeNode( dataProvider, parentObject );
        if( parentTreeNode ) {
            const childNodeToAddAfter = objectToAddAfter ? getTreeNode( dataProvider, objectToAddAfter ) : undefined;
            if( parentTreeNode.isExpanded || parentTreeNode.isLeaf ) {
                if( objectToAddAfter.uid === createdObj.uid ) {
                    mfeTableService.appendChildNodeAsFirstIndex( parentTreeNode, [ createdObj ], dataProvider, mfeTableService.isLeaf, isLeafProperty );
                } else {
                    mfeTableService.appendChildNodes( parentTreeNode, [ createdObj ], dataProvider, mfeTableService.isLeaf, isLeafProperty, childNodeToAddAfter );
                }
                parentTreeNode.isExpanded = true;
                parentTreeNode.isLeaf = false;
                if( gridId ) { // This will store expanded state in case of 'enableExpansionStateCaching'
                    awTableStateSvc.saveRowExpanded( viewModelData, gridId, parentTreeNode );
                }
                const createdObjNode = getTreeNode( dataProvider, createdObj );
                if( parseInt( key ) === createdObjects.length - 1 ) { //we want to set selection for created objects only in last iteration
                    if( !createdObjNode.isExpanded && createdObjects[ key ].uid === objectsToBeSelected[ 0 ].props.bl_parent.dbValues[ 0 ] ) {
                        mfeTableService.expandTreeNode( dataProvider, createdObjNode, viewModelData ).then( function() {
                            objUIDsToSelect && mfeSyncUtils.setSelectionInSelectionModel( dataProvider.selectionModel, objectsToBeSelected );
                        } );
                    } else {
                        objUIDsToSelect && mfeSyncUtils.setSelectionInSelectionModel( dataProvider.selectionModel, objectsToBeSelected );
                    }
                }
            } else {
                mfeTableService.expandTreeNode( dataProvider, parentTreeNode, viewModelData ).then( function() {
                    objUIDsToSelect && mfeSyncUtils.setSelectionInSelectionModel( dataProvider.selectionModel, objectsToBeSelected );
                } );
                if( createdObjects.length > 1 ) { break; } //parent is already expanded and displays all created objects
            }
        }
    }
}

/**
 * Remove child nodes
 *
 * @param {Object} dataProvider - the table data provider
 * @param {String} sourceParentUid - the source parent uid to remove child from
 * @param {Array} childObjectUidsToRemove - child objects to remove
 */
export function removeChildNodes( dataProvider, sourceParentUid, childObjectUidsToRemove ) {
    mfeTableService.removeSelectionUsingUIDs( dataProvider, childObjectUidsToRemove );
    childObjectUidsToRemove.forEach( ( childObjectToRemoveUID ) => {
        let childObjectToRemove = cdm.getObject( childObjectToRemoveUID );
        let sourceParent = cdm.getObject( sourceParentUid );
        const sourceParentTreeNode = getTreeNode( dataProvider, sourceParent );
        if( sourceParentTreeNode ) {
            let hasChildren = epObjectPropertyCacheService.getProperty( sourceParentTreeNode.uid, HAS_CHILDREN_PROP )[ 0 ];
            if( hasChildren === 'FALSE' ) {
                sourceParentTreeNode.isLeaf = true;
            }
            mfeTableService.removeChildNodes( sourceParentTreeNode, [ childObjectToRemove ], dataProvider );
        }
    } );
}

/**
 * get Tree Node from dataProvider
 *
 * @param {Object} dataProvider - the save events as json object
 * @param {Object} modelObject - event Type
 *
 * @returns {Object} the tree node
 */
function getTreeNode( dataProvider, modelObject ) {
    return modelObject && dataProvider.viewModelCollection.getLoadedViewModelObjects().find( loadedVmo => loadedVmo.uid === modelObject.uid );
}

/**
 * set selection in tree
 * if objectsToSelect isn't loaded, load hierarchy till objectsToSelect.
 * Note : objectsToSelect is a vmo when an object is selected.But objectsToSelect is a null array when an object is deselected.
 *
 * @param { Object } dataProvider data provider
 * @param { Object } objectsToSelect vmo of object to select
 * @param { Boolean } unselectIfEmpty unselect if empty
 * @param { String } isLeafProperty - is leaf property
 * @param { Object } additionalGetHierarchyInputParams
 * Ex: {
 *          "tagName": "hierarchyType",
 *          "attributeName": "type",
 *          "attributeValue": "GetHierarchyProcessHighLevelPlanning"
 *     }
 * @param {String} propertyToSort : property to sort objects
 * @returns { Promise } promise
 */
export function setSelection( dataProvider, objectsToSelect, unselectIfEmpty = false, isLeafProperty, additionalGetHierarchyInputParams, propertyToSort ) {
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    /* Check if objectsToSelect is empty {}. If empty, we need to skip loading hierarchy.
         Otherwise it gives "Structure type not supported" error. */
    if( objectsToSelect && !( Object.keys( objectsToSelect ).length === 0 && objectsToSelect.constructor === Object ) ) {
        objectsToSelect = !Array.isArray( objectsToSelect ) ? [ objectsToSelect ] : objectsToSelect;
        if( loadedObjects.length !== 0 ) {
            let vmosAlreadySelect = mfeSyncUtils.setSelection( dataProvider, objectsToSelect, unselectIfEmpty );
            const uidListForVmosAlreadySelected = vmosAlreadySelect ? vmosAlreadySelect.map( object => object.uid ) : [];
            let objectsToExpand = objectsToSelect.filter( loadedObj => loadedObj.uid && uidListForVmosAlreadySelected.indexOf( loadedObj.uid ) === -1 );
            if( objectsToExpand && objectsToExpand[ 0 ] ) {
                return loadHierarchy( dataProvider, objectsToSelect, objectsToExpand, isLeafProperty, additionalGetHierarchyInputParams, propertyToSort );
            }
        }
    }
    return awPromiseService.instance.resolve();
}

/**
 * loads the hierarchy till objectToSelect and expand
 *
 * @param {Object} dataProvider data provider
 * @param {ObjectsList} objectsToSelect objects to select
 * @param {Object} objectsToExpand object to expand
 * @param { String } isLeafProperty - is leaf property
 * @param { Object } additionalGetHierarchyInputParams
 * Ex:  {
 *          "tagName": "hierarchyType",
 *          "attributeName": "type",
 *          "attributeValue": "GetHierarchyProcessHighLevelPlanning"
 *      }
 * @param {String} propertyToSort : property to sort objects
 * @returns {Object} the loaded hierarchy
 */
function loadHierarchy( dataProvider, objectsToSelect, objectsToExpand, isLeafProperty, additionalGetHierarchyInputParams, propertyToSort ) {
    if( objectsToExpand.length > 0 ) {
        const policyId = registerLoadHierarchyPolicy();
        let loadTypeInput = [];


        objectsToExpand.forEach( object => {
            loadTypeInput.push( epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.GET_HIERARCHY ], object.uid, '', '', additionalGetHierarchyInputParams )[ 0 ] );
        } );
        return epLoadService.loadObject( loadTypeInput, false ).then( ( response ) => {
            policyId && policySvc.unregister( policyId );
            const hierarchyObjects = _.uniqBy( [ ...response.loadedObjects, ...objectsToSelect ], 'uid' );
            const parentChildObjectsMap = getParentChildObjectsMap( dataProvider, hierarchyObjects, isLeafProperty );
            let parentUids = [];
            objectsToExpand.forEach( object => {
                const allParentUids = epBvrObjectService.getParentUids( object, epBvrConstants.BL_PARENT );
                const newParentUids = allParentUids.filter( ( parentUid ) => parentUids.indexOf( parentUid ) === -1 );
                parentUids.push( ...newParentUids );
            } );
            expandNodes( dataProvider, parentChildObjectsMap, parentUids, isLeafProperty, propertyToSort );
            dataProvider.selectionModel.setSelection( objectsToSelect );
        } );
    }
    return awPromiseService.instance.resolve();
}

/**
 * Register the policy
 *
 * @return {Object}  null
 */
function registerLoadHierarchyPolicy() {
    const loadHierarchyPolicy = {
        types: [ {
            name: epBvrConstants.MFG_BVR_OPERATION,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            } ]
        },
        {
            name: epBvrConstants.MFG_BVR_PROCESS,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            },
            {
                name: epBvrConstants.MBC_HAS_SUB_ELEMENTS
            }
            ]
        },
        {
            name: 'BOMLine',
            properties: [ {
                name: 'bl_sequence_no'
            },
            {
                name: 'bl_has_children'
            }
            ]
        }
        ]
    };
    return policySvc.register( loadHierarchyPolicy );
}

/**
 * creates parent to child objects map
 *
 * @param {Object} dataProvider data provider
 * @param {Array} hierarchyObjects objects in hierarchy
 * @param { String } isLeafProperty - is leaf property
 * @return {Array} parent to child objects map
 */
function getParentChildObjectsMap( dataProvider, hierarchyObjects, isLeafProperty ) {
    let parentChildObjectsMap = {};
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    const ctx = appCtxService.getCtx();
    hierarchyObjects.filter( ( object, index ) => {
        return hierarchyObjects.indexOf( object ) === index;
    } ).forEach( hierarchyObject => {
        const index = loadedObjects.findIndex( loadedObj => loadedObj.uid === hierarchyObject.uid );
        if( index === -1 ) {
            let parentUid = epBvrObjectService.getProcessResourceOrStationParent( hierarchyObject )?.uid;
            if ( parentUid ) {
                if( isLeafProperty && isLeafProperty === HAS_CHILDREN_PROP && ( ctx.sublocation.nameToken === 'highLevelPlanning' || ctx.sublocation.nameToken === 'assemblyPlanning' ) ) {
                    setHasChildrenPropertyValues( hierarchyObject, HAS_CHILDREN_PROP );
                }
                parentChildObjectsMap[ parentUid ] ? parentChildObjectsMap[ parentUid ].push( hierarchyObject ) : parentChildObjectsMap[ parentUid ] = [ hierarchyObject ];
            }
        }
    } );
    return parentChildObjectsMap;
}

/**
 * Sort children node according to property
 *
 * @param {Object} childObjects Objects to sort
 * @param {String} propertyToSort the property to sort by
 */
function sortChildrenByProp( childObjects, propertyToSort ) {
    //TODO : Server is sending bl_sequence number property as a string so we need to tweak it.
    if( propertyToSort === epBvrConstants.BL_SEQUENCE_NO ) {
        // eslint-disable-next-line array-callback-return
        childObjects.map( ( obj ) => {
            //Updating property type to 5(Integer)
            if( obj.props[ propertyToSort ] ) {
                obj.props[ propertyToSort ].propertyDescriptor.valueType = 5;
            }
        } );
    }
    mfeFilterAndSortService.sortModelObjectsByProp( childObjects, propertyToSort, true );
}

/**
 * Expands parent nodes of selected object. And sort according to property to sort.
 * e.g. "bl_sequence_no"
 *
 * @param {Object} dataProvider data provider
 * @param {Map} parentChildObjectsMap Map of parent uid to child objects
 * @param {Array} parentUids - parent objects Uids of selected object
 * @param { String } isLeafProperty - is leaf property
 * @param { String } propertyToSort - property based on which sorting will be done
 */
function expandNodes( dataProvider, parentChildObjectsMap, parentUids, isLeafProperty, propertyToSort ) {
    let isLeafPropertyToConsider = null;

    if( parentUids.length > 0 ) {
        let modelObject = cdm.getObject( parentUids[ 0 ] );
        const ctx = appCtxService.getCtx();
        //Only in case of HLP & PP, the hasChidren prop is being loaded in the getHierarchy call, hence check is required.
        if( isLeafProperty && isLeafProperty === HAS_CHILDREN_PROP && ( ctx.sublocation.nameToken === 'highLevelPlanning' || ctx.sublocation.nameToken === 'assemblyPlanning' ) ) {
            isLeafPropertyToConsider = isLeafProperty;
        } else {
            if( modelObject.type === epBvrConstants.MFG_BVR_PROCESS ) {
                isLeafPropertyToConsider = epBvrConstants.MBC_HAS_SUB_ELEMENTS;
            } else if( modelObject.type === 'BOMLine' ) {
                isLeafPropertyToConsider = 'bl_has_children';
            }
        }
    }
    for( let i = parentUids.length - 1; i >= 0; i-- ) {
        const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        const parentTreeNode = loadedObjects.find( loadedObj => loadedObj.uid === parentUids[ i ] );

        if( parentTreeNode && !parentTreeNode.isExpanded ) {
            parentTreeNode.isExpanded = true;
            const childObjects = parentChildObjectsMap[ parentTreeNode.uid ];
            propertyToSort && sortChildrenByProp( childObjects, propertyToSort );
            mfeTableService.appendChildNodes( parentTreeNode, childObjects, dataProvider, mfeTableService.isLeaf, isLeafPropertyToConsider );
        }
    }
}

/**
 * get Operation Parent Object
 * @param {Object} modelObject Object
 * @param {Object} targetAssembly Object
 * @return {Object} scope object for Create Object
 */
export function getOperationParent( commandContext ) {
    let scopeInfo = {
        targetAssembly: commandContext.targetAssembly
    };
    let modelObject = getInputObject( commandContext );
    scopeInfo.modelObject = modelObject;
    if( mfeTypeUtils.isOfType( modelObject, epBvrConstants.MFG_BVR_OPERATION ) && modelObject.props.bl_parent ) {
        scopeInfo.modelObject = cdm.getObject( modelObject.props.bl_parent.dbValues[ 0 ] );
    }
    scopeInfo.isResequenceNeeded = modelObject.isResequenceNeeded;

    //Tree reloadType = CommonExpand
    scopeInfo.reloadType = {
        epCreate: [ {
            reloadTypeName: 'CommonExpand',
            object: scopeInfo.modelObject,
            additionalLoadParams: [ {
                tagName: 'expandType',
                attributeName: 'type',
                attributeValue: 'ExpandProcessDetailedPlanning'
            },
            {
                tagName: 'expandInfo',
                attributeName: 'level',
                attributeValue: 'CHILDREN'
            }
            ]
        } ]
    };
    // For ex. WIEDitor reloadType = GetWIData
    if( modelObject.reloadType ) {
        scopeInfo.reloadType.epCreate.push( {
            reloadTypeName: modelObject.reloadType.epCreate
        } );
    }
    return scopeInfo;
}

/**
 * get input object from commandContext object
 * @param {Object} commandContext object
 * @return {Object} input object from commandContext object
 */
export function getInputObject( commandContext ) {
    if( Array.isArray( commandContext.inputObject ) ) {
        return commandContext.inputObject[ 0 ];
    }
    if( commandContext.vmo ) {
        return commandContext.vmo;
    }
    return commandContext.inputObject;
}

/**
 * get the object parent
 * @param {Object} modelObject object
 * @return {Object} object parent
 */
function getObjectParent( modelObject ) {
    let objectParent;
    if( modelObject.props.bl_parent ) {
        objectParent = cdm.getObject( modelObject.props.bl_parent.dbValues[ 0 ] );
    } else {
        const objectParentUid = epObjectPropertyCacheService.getProperty( modelObject.uid, 'bl_parent' )[ 0 ];
        objectParent = cdm.getObject( objectParentUid );
    }
    return objectParent;
}

/**
 * get the object parent if single object is selected
 * @param {Array} selectedObjects the objects selected in tree
 * @return {Object} selected object parent
 */
export function getSelectedObjectParent( selectedObjects ) {
    let selectedObjectParent;
    if( selectedObjects.length === 1 ) {
        selectedObjectParent = getObjectParent( selectedObjects[ 0 ] );
    }
    return {
        selectedObjectParent: selectedObjectParent
    };
}

/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column object_string
 *
 * @param {Object} eventData containing viewModelObjects
 */
export function updateDisplayName( eventData ) {
    //update the display name for all ViewModelObjects which should be viewModelTreeNodes

    if( eventData && eventData.modifiedObjects && eventData.vmc ) {
        let loadedVMObjects = eventData.vmc.loadedVMObjects;
        eventData.modifiedObjects.forEach( modifiedObject => {
            let modifiedVMOs = loadedVMObjects.filter( function( vmo ) {
                return vmo.id === modifiedObject.uid;
            } );
            modifiedVMOs.forEach( modifiedVMO => {
                modifiedVMO.displayName = modifiedObject.props.object_string.dbValues[ 0 ];
            } );
        } );
    }
}

/**
 * sets the commandContext if the save event data is related
 *
 * @param {Object} subPanelContext - subPanelContext object
 * @param {object} commandContext - anything you want to be set as the command context
 * @param {object} saveEventsData - save events data
 */
export function initTableRowsSelectionBasedOnSaveEvents( subPanelContext, commandContext, saveEventsData ) {
    let isEventRelated = false;
    if( saveEventsData ) {
        const saveEventsDataKeys = Object.keys( saveEventsData );
        let relationNames = subPanelContext.relationName;
        if( !Array.isArray( relationNames ) ) {
            relationNames = [ relationNames ];
        }
        saveEventsDataKeys && saveEventsDataKeys.some( ( saveEventDataKey ) => {
            relationNames && relationNames.forEach( ( relationName ) => {
                if( saveEventDataKey === relationName ) {
                    isEventRelated = true;
                    return true;
                }
            } );
        } );
    }
    if( isEventRelated ) {
        mfeContentPanelUtil.setCommandContext( subPanelContext.tabContext, commandContext );
    }
}

/**
 * Register the policy
 *
 * @return {Object}  null
 */
function registerGetPropertyPolicy() {
    const getPropertiesPolicy = {
        types: [ {
            name: 'Mfg0BvrBOPWorkarea',
            properties: [ {
                name: 'bl_item_object_name'
            } ]
        } ]
    };
    return policySvc.register( getPropertiesPolicy );
}

/**
 * get the object parent
 * @param {Object} newInput - Array of model objects to be checked
 * @param {Object} existingInput - Source array of model objects to find
 * @return {boolean} returns whether same objects or not
 */
function isObjectArraySubsetofOtherObjectArray( newInput, existingInput ) {
    if( !newInput || !existingInput || _.isEmpty( newInput ) || _.isEmpty( existingInput ) || newInput.length === 0 || existingInput.length === 0 ) {
        return false;
    }

    newInput = Array.isArray( newInput ) ? newInput : [ newInput ];
    existingInput = Array.isArray( existingInput ) ? existingInput : [ existingInput ];

    if( newInput.length !== existingInput.length ) {
        return false;
    }

    const newInputUidList = newInput.map( obj => obj.uid );
    const existingInputUidList = existingInput.map( obj => obj.uid );

    return newInputUidList.every( function( val ) {
        return existingInputUidList.indexOf( val ) >= 0;
    } );
}

/**
 * Get the object to add after
 *
 * @param {Object} createdObj - the created Object
 * @param {Object} parent - the parent of created Object
 * @returns {Object} object to add after
 */
function getObjectToAddAfter( createdObj, parent ) {
    let children = cdm.getObjects( epObjectPropertyCacheService.getProperty( parent.uid, epBvrConstants.RELATED_OBJECT_CHILDREN_KEY ) );
    children = children.filter( children => children.props.bl_sequence_no );
    children.sort( function( object1, object2 ) {
        const bl_sequence_no_obj1 = Number( object1.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[ 0 ] );
        const bl_sequence_no_obj2 = Number( object2.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[ 0 ] );
        return bl_sequence_no_obj1 - bl_sequence_no_obj2;
    } );

    const toAddAfterIndex = children.findIndex( obj => obj.uid === createdObj.uid );
    return children[ toAddAfterIndex > 0 ? toAddAfterIndex - 1 : toAddAfterIndex ];
}

/**
 * This function renders the row with partial Visibility styling
 *
 * @param {object} columns - column configuration
 */
export function renderCutIndicationWithDashedOutline( columns ) {
    if( columns ) {
        columns.forEach( ( column ) => {
            if( !column.cellRenderers ) {
                column.cellRenderers = [];
            }
            column.cellRenderers.push( mfeTableService.getRowRenderer( 'aw-ep-partialVisibilityWithDashedOutline', 'opaqueRowRenderer', isOpaque ) );
        } );
    }
}

/**
 * This method will sort the data based on criteria
 * @param { ObjectsArray } loadedTreeNodes : tree nodes loaded from the Load SOA call
 * @param { Array } sortCriteria: sort criteria based on which nodes will be sorted, E.G: { fieldName:'Oject_string', sortDirection:'ASC' }
 * @returns { ObjectsArray } loadedTreeNodes : sorted nodes
 */
export function getSortedNodesIfSortCriteriaGiven( loadedTreeNodes, sortCriteria ) {
    if( sortCriteria && sortCriteria[ 0 ] ) {
        const ctx = appCtxService.getCtx();
        let rootnode;
        if( loadedTreeNodes && loadedTreeNodes.childNodes && loadedTreeNodes.childNodes.length > 0 && ctx.epPageContext && loadedTreeNodes.childNodes[0].uid === ctx.epPageContext.loadedObject.uid ) {
            //Remove root node from loadedTreeNodes if present, Since the root node should not be included in the sorting process
            rootnode = loadedTreeNodes.childNodes[0];
            loadedTreeNodes.childNodes.splice( 0, 1 );
        }
        //If criteria given then sort accordingly.
        const { fieldName, sortDirection } = sortCriteria[ 0 ];
        if( propertiesForNumericSort.includes( fieldName ) ) {
            if( loadedTreeNodes.childNodes ) {
                loadedTreeNodes.childNodes = mfeFilterAndSortService.sortModelObjectsBasedOnStringNumericValue( loadedTreeNodes.childNodes, sortCriteria );
            } else {
                loadedTreeNodes = mfeFilterAndSortService.sortModelObjectsBasedOnStringNumericValue( loadedTreeNodes, sortCriteria );
            }
        } else {
            if( loadedTreeNodes.childNodes ) {
                loadedTreeNodes.childNodes = mfeFilterAndSortService.sortModelObjects( loadedTreeNodes.childNodes, sortCriteria );
            } else {
                loadedTreeNodes = mfeFilterAndSortService.sortModelObjects( loadedTreeNodes, sortCriteria );
            }
        }
        if( rootnode && ctx.epPageContext && rootnode.uid === ctx.epPageContext.loadedObject.uid ) {
            // Add the root node once the child nodes are sorted
            loadedTreeNodes.childNodes.unshift( rootnode );
        }
    }

    //If no criteria given then return as it is.
    return {
        loadedTreeNodes: loadedTreeNodes
    };
}

/**
 * @param {*} treeNodeResults treeNodeResults
 * @param {*} selectedObject selectedObject
 */
function getParentOfSelectionFromSubPanelContext( treeNodeResults, selectedObject ) {
    if( !treeNodeResults || !selectedObject ) {
        return;
    }
    const parentNode = treeNodeResults.parentNode;

    if( selectedObject.uid === parentNode.uid ) {
        return selectedObject;
    }
    const selectedObjectParent = getSelectedObjectParent( [ selectedObject ] ).selectedObjectParent;
    if( selectedObjectParent && selectedObjectParent.uid === parentNode.uid ) {
        return parentNode;
    }
    return selectedObjectParent && treeNodeResults.childNodes.find( vmo => vmo.uid === selectedObjectParent.uid );
}

/**
 * Get the input object for the details table, based on the parameters:
 * If there is an input object on the sync port and the object type isn't excluded, return it.
 * Otherwise return empty string.
 *
 * @param {*} portsEpDetailsInputObject input object from the sync port
 * @param {*} excludeInputTypes types that aren't appropriate for this details table, as should be defined in the containing view.
 * @returns {*} the appropriate input object
 */
export function getValidInputForDetailsTable( portsEpDetailsInputObject, excludeInputTypes ) {
    // if there was an input object on the subpanel context on init, return it.
    if( portsEpDetailsInputObject && portsEpDetailsInputObject.uid ) {
        if( !excludeInputTypes ) {
            return portsEpDetailsInputObject;
        }
        // else need to check if the type needs to be excluded.
        let isTypeToExclude = false;
        excludeInputTypes.forEach( element => {
            if( portsEpDetailsInputObject.modelType.typeHierarchyArray.includes( element ) ) {
                isTypeToExclude = true;
            }
        } );
        if( !isTypeToExclude ) {
            return portsEpDetailsInputObject;
        }
    }
    // else
    return '';
}

/**
 * Make cell non editable
 *
 * @param {object} eventData - the event data object
 * @param {StringArray} nonEditableProps list of property names that should be non editable in table
 */
export function updateCellPropNonEditable( eventData, nonEditableProps ) {
    const propName = eventData?.columnInfo?.propertyName;
    let shouldBeNonEditable = propName && nonEditableProps && nonEditableProps.includes( propName );
    if( propName && NON_EDITABLE_PROPERTIES.includes( propName ) || shouldBeNonEditable ) {
        eventData.vmo.props[ propName ].isEditable = false;
    }
}

/**
 * As reusable tree table gets a random numeric id like EpTreeTable_1693320182041
 * We can't catch the tree table cellStartEdit in the tree table view model
 * So we need to find its id and register to its EpTreeTable_1693320182041.cellStartEdit event
 * to prevent the read only cell edit
 *
 * @param {String} viewId the viewId containing the reusable tree table
 * @param {StringArray} nonEditableProps list of property names that should be non editable in table
 */
export function registerCellEditEvent( viewId, nonEditableProps ) {
    const epTreeTableElement = document.querySelector( '.' + viewId + ' [id^="EpTreeTable_"].aw-splm-table' );
    if( epTreeTableElement && !editCellEventSubscr.get( viewId ) ) {
        editCellEventSubscr.set( viewId, eventBus.subscribe( epTreeTableElement.id + '.cellStartEdit', function( eventData ) {
            updateCellPropNonEditable( eventData, nonEditableProps );
        } ) );
    }
}

/**
 * Unregister the EpTreeTable_1693320182041.cellStartEdit event
 * which is registered to prevent the read only cell edit
 *
 * @param {String} viewId the viewId containing the generic tree table
 */
export function unregisterCellEditEvent( viewId ) {
    eventBus.unsubscribe( editCellEventSubscr.get( viewId ) );
    editCellEventSubscr.delete( viewId );
}

export default {
    addChildNodes,
    loadColumnsData,
    loadDataFromLoadedResponse,
    loadAllProperties,
    initializeLoadDataForTree,
    loadTreeTableData,
    removeOrAddObjects,
    handleAddRemoveSaveEvents,
    addNewObjectsToDataProvider,
    removeChildNodes,
    setSelection,
    getOperationParent,
    getInputObject,
    getSelectedObjectParent,
    updateDisplayName,
    initTableRowsSelectionBasedOnSaveEvents,
    isObjectArraySubsetofOtherObjectArray,
    renderCutIndicationWithDashedOutline,
    getSortedNodesIfSortCriteriaGiven,
    getTreeNode,
    getParentOfSelectionFromSubPanelContext,
    getValidInputForDetailsTable,
    updateCellPropNonEditable,
    registerCellEditEvent,
    unregisterCellEditEvent
};
