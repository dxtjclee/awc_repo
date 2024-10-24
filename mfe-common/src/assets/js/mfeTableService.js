// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import vMOService from 'js/viewModelObjectService';
import eventBus from 'js/eventBus';
import tcPropConstants from 'js/constants/tcPropertyConstants';
import mfeSyncUtils from 'js/mfeSyncUtils';
import iconSvc from 'js/iconService';
import awTableStateSvc from 'js/awTableStateService';
import mfeColumnServices from 'js/mfeColumnService';

/**
 * Service for mfe table views
 *
 * @module js/mfeTableService
 */

const BL_REV_OBJECT_NAME = 'bl_rev_object_name';

/**
 * Build table columns and the columns property policy from the passed in object properties
 *
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table
 * @param {Object} dataProvider - the table data provider
 * @param {object} columnProvider - the table column provider
 * @param {Object} additionalPolicyObjects - additional objects to add to policy
 * @param {string} tableCmdColumnPropName - the table column property name we want to display our commands icons
 * @param {string} tableTreeNavColumnPropName - the table column property name we want to display our expand icon
 * @param {int} treeNavigationColumnIndex - the expandable column index
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @return {promise<null>} returns a promise which is resolved once we finished to create the columns
 */
export function createColumns( preferenceName, dataProvider, columnProvider = {}, additionalPolicyObjects = {}, tableCmdColumnPropName = '', tableTreeNavColumnPropName = '', treeNavigationColumnIndex =
'', viewModelData ) {
    return mfeColumnServices.createColumns( preferenceName, dataProvider, columnProvider,
        additionalPolicyObjects, tableCmdColumnPropName, tableTreeNavColumnPropName, treeNavigationColumnIndex, viewModelData );
}

/**
 * this function adds icon column just before name column if present
 *
 * @param {Object} columns - table columns
 * @param {Object} nameColumn - name column that is not object_string or bl_rev_object_name
 *
 * @returns {Object} the columns with the icon next to the object name column
 */
export function addIconColumn( columns, nameColumn ) {
    const iconColumnFound = columns.find( column => column.name === 'icon' );
    if( iconColumnFound ) {
        return columns;
    }

    const nameColumnIndex = columns.findIndex( column => column.name === tcPropConstants.OBJECT_STRING || column.name === BL_REV_OBJECT_NAME || column.name === nameColumn );
    columns.splice( nameColumnIndex, 0, createHardCodedClientColumnInfo( { name: 'icon' } ) );
    return columns;
}

/**
 *
 * @param {String} className name of the class which you want to add on the row object
 * @param {String} name renderer name
 * @param {function} condition the condition function which decides if style should be applied to a row or not
 * @param {function} action responsible for adding style on each cell(pass you own action if you want to override default action)
 * @returns {Object} row renderer definition
 */
export function getRowRenderer( className, name, condition, action ) {
    return {
        action: action ? action : function( column, vmo, tableElem, rowElem ) {
            rowElem.classList.add( className );
        },
        condition,
        name
    };
}

/**
 * getTreeNodeObject
 *
 * @param {Object} nodeObject - model object or view model object
 * @param {Object} parentNode - the parent node
 * @param {boolean} isLeaf - check if node has further children
 * @param {int} childNdx - child index
 * @param {int} displayNameProp - display name property for node name
 *
 * @return {Object} vmNode - tree node object
 */
export function getTreeNodeObject( nodeObject, parentNode, isLeaf, childNdx, displayNameProp = tcPropConstants.OBJECT_STRING ) {
    if( !vMOService.isViewModelObject( nodeObject ) ) {
        nodeObject = vMOService.createViewModelObject( nodeObject );
    }
    const type = nodeObject.type;

    let iconURL = null;
    if( nodeObject.hasThumbnail ) {
        iconURL = nodeObject.thumbnailURL;
    } else if( nodeObject.typeIconURL ) {
        iconURL = nodeObject.typeIconURL;
    } else if( nodeObject.iconURL ) {
        iconURL = nodeObject.iconURL;
    }
    if( !iconURL ) {
        iconURL = iconSvc.getTypeIconURL( type );
    }

    const nodeName = nodeObject.props[ displayNameProp ].uiValues[ 0 ];
    const nodeId = nodeObject.uid;
    const levelNdx = parentNode ? parentNode.levelNdx + 1 : -1;
    const vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, nodeName, levelNdx, childNdx, iconURL );
    _.merge( vmNode, nodeObject );
    vmNode.isLeaf = isLeaf;
    return vmNode;
}

/**
 * Check if a tree node is a leaf or it has children
 *
 * @param {Object} object - the object we want to check if is leaf
 * @param {String} leafProp - the boolean property indicating if the object has children/ isLeaf
 *
 * @return {Boolean} if object is leaf
 */
export function isLeaf( object, leafProp ) {
    return object && object.props[ leafProp ] ? object.props[ leafProp ].dbValues[ 0 ] === '0' : true;
}

/**
 * Create column info
 *
 * @param {Object} column - the column data
 *
 * @return {AwTableColumnInfo} Newly created AwTableColumnInfo object.
 */
function createHardCodedClientColumnInfo( column = {} ) {
    return mfeColumnServices.createHardCodedClientColumnInfo( column );
}

/**
 * Save the resized columns width
 *
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table with each column width
 * @param {Object} updatedcolumns - the table columns with their width
 * @param {Object} dataProvider - the table data provider
 * @returns {Promise} promise
 */
export function saveResizedColumnsWidth( preferenceName, updatedcolumns, dataProvider ) {
    return  mfeColumnServices.saveModifiedColumns( preferenceName, updatedcolumns, dataProvider );
}

/**
 * Expands the given tree node
 *
 * @param {Object} dataProvider - the data provider object
 * @param {ViewModelTreeNode} vmoTreeNode - the view model tree node object
 * @param {Object} viewModelData - the viewmodel data
 * @param {String} gridId - the tree table id
 * @return {Promise} a promise object
 */
export function expandTreeNode( dataProvider, vmoTreeNode, viewModelData, gridId = '' ) {
    vmoTreeNode.isExpanded = true;
    return expandOrCollapseTreeNode( dataProvider, vmoTreeNode, viewModelData, true, gridId );
}

/**
 * Collapses the given tree node
 *
 * @param {Object} dataProvider - the data provider object
 * @param {ViewModelTreeNode} vmoTreeNode - the view model tree node object
 * @param {Object} viewModelData - the viewmodel data
 * @param {String} gridId - the tree table id
 * @return {Promise} a promise object
 */
export function collapseTreeNode( dataProvider, vmoTreeNode, viewModelData, gridId = ''  ) {
    vmoTreeNode.isExpanded = false;
    return expandOrCollapseTreeNode( dataProvider, vmoTreeNode, viewModelData, false, gridId );
}

/**
 * Collapses the given tree node
 *
 * @param {Object} dataProvider - the data provider object
 * @param {ViewModelTreeNode} vmoTreeNode - the view model tree node object
 * @param {Object} viewModelData - the viewmodel data
 * @param {boolean} expand - true if we need to expand the given tree node
 * @param {String} gridId - the tree table id
 * @return {Promise} a promise object
 */
function expandOrCollapseTreeNode( dataProvider, vmoTreeNode, viewModelData, expand, gridId = '' ) {
    const dataObj = {
        data: { ...viewModelData },
        ctx: appCtxSvc.ctx
    };
    let objectToBeReturn = {};
    if( expand ) {
        objectToBeReturn = dataProvider.expandObject( dataObj, vmoTreeNode ).then( ( updatedViewModelCollection ) => {
            dataProvider.update( updatedViewModelCollection.loadedVMObjects );
        } );
        if( gridId ) { // This will store expanded state in case of 'enableExpansionStateCaching'
            awTableStateSvc.saveRowExpanded( viewModelData, gridId, vmoTreeNode );
        }
    } else{
        objectToBeReturn = dataProvider.collapseObject( dataObj, vmoTreeNode ).then( ( updatedViewModelCollection ) => {
            dataProvider.update( updatedViewModelCollection.loadedVMObjects );
        } );
        if( gridId ) { // This will store collapsed state
            awTableStateSvc.saveRowCollapsed( viewModelData, gridId, vmoTreeNode );
        }
    }

    return  objectToBeReturn;
}

/**
 * Refreshes the table
 * @param {String} tableId - the table id
 */
export function refreshTable( tableId ) {
    eventBus.publish( `${tableId}.plTable.clientRefresh` );
}

/**
 * Reloads the table
 * @param {String} tableId - the table id
 */
export function reloadTable( tableId ) {
    eventBus.publish( `${tableId}.plTable.reload` );
}

/**
 * This methods added VMOs to dataProvider.viewModelCollection.loadedVMObjects
 * This can be used only in case you flat tree, a tree without expand. As method doesn't creates treeNode.
 *
 * @param { string[] } objUidToAddList - Array of objects UID we want to Add to data - provider
 * @param { Object } dataProvider - data provider which need to be updated
 * @param {boolean} selectAddedObjects - true if we want to select the objects we added
 * @param {Function} sorter - sorter function for the vmo collection
 */
export function addToDataProvider( objUidToAddList, dataProvider, selectAddedObjects = false, sorter = undefined ) {
    if( !Array.isArray( objUidToAddList ) || objUidToAddList.length <= 0 ) {
        return;
    }
    const viewModelCollection = dataProvider.getViewModelCollection();
    const loadedVMObjects = viewModelCollection.getLoadedViewModelObjects();
    const newVmos = objUidToAddList.map( ( objUid ) => vMOService.createViewModelObject( objUid, 'EDIT' ) );
    let updatedVMOs = [ ...loadedVMObjects, ...newVmos ];
    if( sorter ) {
        updatedVMOs = sorter( updatedVMOs );
    }
    dataProvider.update( updatedVMOs, updatedVMOs.length );
    dataProvider.noResults = updatedVMOs.length === 0;
    if( selectAddedObjects ) {
        mfeSyncUtils.setSelection( dataProvider, newVmos );
    }
}

/**
 * This methods removes VMOs from dataProvider.viewModelCollection.loadedVMObjects
 *
 * @param {String[]} uidsToRemove - Array of objects UID we want to remove from data-provider
 * @param {Object} dataProvider - data provider which need to be updated
 */
export function removeFromDataProvider( uidsToRemove, dataProvider ) {
    const viewModelCollection = dataProvider.getViewModelCollection();
    const loadedVMObjects = viewModelCollection.getLoadedViewModelObjects();
    const remainingObjects = loadedVMObjects.filter( obj => uidsToRemove.indexOf( obj.uid ) === -1 );

    if( remainingObjects.length !== loadedVMObjects.length ) {
        dataProvider.update( remainingObjects, remainingObjects.length );
        dataProvider.noResults = remainingObjects.length === 0;
    }
}

/**
 * Clear the dataProvider
 *
 * @param {*} dataProvider the dataProvider to empty
 */
export function emptyDataProvider( dataProvider ) {
    if ( dataProvider ) {
        if ( dataProvider.viewModelCollection?.loadedVMObjects?.length > 0 ) {
            dataProvider.getViewModelCollection().clear();
        }
    }
}

/**
 * This method appends child tree nodes to a given parent tree node
 * @param {TreeViewModelObject} parentTreeNode - the parent tree node we want to append children to
 * @param {modelObject[]} childObjects - the child objects we want to append
 * @param {object} dataProvider - the data provider object
 * @param {Function} isLeafFunc - the function to calculate if a node is a leaf or not
 * @param {string} isLeafProperty - a given property name
 * @param {TreeViewModelObject} childNodeToAddAfter - a given child node to add after
 */
export function appendChildNodes( parentTreeNode, childObjects, dataProvider, isLeafFunc, isLeafProperty, childNodeToAddAfter ) {
    if( !parentTreeNode.children ) {
        parentTreeNode.children = [];
    }
    parentTreeNode.isLeaf = false;
    const childIndex = childNodeToAddAfter ? childNodeToAddAfter.childNdx + 1 : parentTreeNode.children.length;
    let childNdx = childIndex;
    const childTreeNodes = childObjects.map( ( childModelObj ) => {
        return getTreeNodeObject( childModelObj, parentTreeNode, isLeafFunc( childModelObj, isLeafProperty ), childNdx++ );
    } );
    const loadedVmos = [ ...dataProvider.getViewModelCollection().getLoadedViewModelObjects() ];
    let refIndex = childNodeToAddAfter ? loadedVmos.indexOf( childNodeToAddAfter ) : loadedVmos.indexOf( parentTreeNode );
    const descendantTreeNodes = getAllDescendantTreeNodes( childNodeToAddAfter ? childNodeToAddAfter : parentTreeNode );
    descendantTreeNodes.forEach( descendant => {
        let index = loadedVmos.indexOf( descendant );
        if( index > refIndex ) {
            refIndex = index;
        }
    } );
    loadedVmos.splice( refIndex + 1, 0, ...childTreeNodes );
    parentTreeNode.children.splice( childIndex, 0, ...childTreeNodes );
    if( childNodeToAddAfter ) {
        updateChildIndexes( parentTreeNode );
    }
    dataProvider.update( loadedVmos, loadedVmos.length );
}

/**
 * This method append child tree node to a given parent tree node
 * @param {TreeViewModelObject} parentTreeNode - the parent tree node we want to append children to
 * @param {modelObject[]} childObject - the child object we want to append
 * @param {object} dataProvider - the data provider object
 * @param {Function} isLeafFunc - the function to calculate if a node is a leaf or not
 * @param {string} isLeafProperty - a given property name
 */
export function appendChildNodeAsFirstIndex( parentTreeNode, childObject, dataProvider, isLeafFunc, isLeafProperty ) {
    if( !parentTreeNode.children ) {
        parentTreeNode.children = [];
    }
    parentTreeNode.isLeaf = false;
    const childTreeNodes = childObject.map( ( childModelObj ) => {
        return getTreeNodeObject( childModelObj, parentTreeNode, isLeafFunc( childModelObj, isLeafProperty ), 0 );
    } );
    const loadedVmos = [ ...dataProvider.getViewModelCollection().getLoadedViewModelObjects() ];
    let refIndex = loadedVmos.indexOf( parentTreeNode );

    loadedVmos.splice( refIndex + 1, 0, ...childTreeNodes );
    parentTreeNode.children.splice( 0, 0, ...childTreeNodes );
    updateChildIndexes( parentTreeNode );
    dataProvider.update( loadedVmos, loadedVmos.length );
}

/**
 * This methods removes VMOs from dataProvider.viewModelCollection.loadedVMObjects
 *
 * @param {TreeViewModelObject} parentTreeNode - the parent tree node we want to append children to
 * @param { Object } childObjectsToRemove - Array of objects UID we want to remove from data-provider
 * @param { Object } dataProvider - data provider which need to be updated
 */
export function removeChildNodes( parentTreeNode, childObjectsToRemove, dataProvider ) {
    if( childObjectsToRemove && dataProvider && parentTreeNode && parentTreeNode.children ) {
        const viewModelCollection = dataProvider.getViewModelCollection();
        const loadedVMObjects = viewModelCollection.getLoadedViewModelObjects();
        const objectUidToRemoveList = childObjectsToRemove.map( object => object.uid );
        const childNodesToRemove = loadedVMObjects.filter( object => objectUidToRemoveList.indexOf( object.uid ) > -1 );
        if( childNodesToRemove.length > 0 ) {
            let nodesToRemove = [];
            childNodesToRemove.forEach( node => nodesToRemove.push( node, ...getAllDescendantTreeNodes( node ) ) );
            viewModelCollection.removeLoadedObjects( nodesToRemove );
            dataProvider.viewModelCollection.setTotalObjectsFound( loadedVMObjects.length );
            childNodesToRemove.forEach( childNode => {
                const indexOfChild = parentTreeNode.children.indexOf( childNode );
                if ( indexOfChild >= 0 ) {
                    parentTreeNode.children.splice( indexOfChild, 1 );
                }
            } );
            parentTreeNode.isLeaf = Boolean( parentTreeNode.children.length === 0 );
        }
    }
}

/**
 * Returns all of the decendant tree nodes
 * @param {ViewModelTreeNode} treeNode - a given tree node object
 * @return {ViewModelTreeNode[]} array of tree node objects
 */
export function getAllDescendantTreeNodes( treeNode ) {
    const descendants = [];
    if( !treeNode.isLeaf && treeNode.children && treeNode.children.length > 0 ) {
        treeNode.children.forEach( ( childTreeNode ) => {
            descendants.push( ...getAllDescendantTreeNodes( childTreeNode ) );
        } );
        descendants.push( ...treeNode.children );
    }
    return descendants;
}

/**
 * Update child indexes after adding child node

 * @param {ViewModelTreeNode} parentTreeNode - a given tree node object
 */
export function updateChildIndexes( parentTreeNode ) {
    parentTreeNode.children.forEach( ( childNode, index ) => childNode.childNdx = index );
}

/**
 * Set the "toDeSelectObjects" to the given data provider
 *
 * @param {Object} dataProvider the data provider object
 * @param {Array} objectsToDeSelect objects to select
 */
export function removeSelection( dataProvider, objectsToDeSelect ) {
    if( !Array.isArray( objectsToDeSelect ) ) {
        objectsToDeSelect = [ objectsToDeSelect ];
    }
    const loadedObjects = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    const uidList = objectsToDeSelect.map( object => object.uid );

    const loadedObjectToToDeSelect = loadedObjects.filter( loadedObj => uidList.indexOf( loadedObj.uid ) > -1 );
    dataProvider.selectionModel.removeFromSelection( loadedObjectToToDeSelect );
}

/**
 * Set the "toDeSelectObjects" to the given data provider
 *
 * @param {Object} dataProvider the data provider object
 * @param {Array} objectsToDeSelect objects to select
 */
export function removeSelectionUsingUIDs( dataProvider, objectUIdsToDeSelect ) {
    if( !Array.isArray( objectUIdsToDeSelect ) ) {
        objectUIdsToDeSelect = [ objectUIdsToDeSelect ];
    }
    const loadedObjects = dataProvider.getViewModelCollection().getLoadedViewModelObjects();

    const loadedObjectToToDeSelect = loadedObjects.filter( loadedObj => objectUIdsToDeSelect.indexOf( loadedObj.uid ) > -1 );
    dataProvider.selectionModel.removeFromSelection( loadedObjectToToDeSelect );
}

/**
 *
 * @param {string[]} childUids - a given array of child uids
 * @param {object} dataProvider - a given data provider object
 * @return {string[]} - the parent uids of the given children array.
 */
export function getParentUids( childUids, dataProvider ) {
    if( childUids && childUids.length > 0 ) {
        const parentUids = childUids.map( ( childUid ) => getParentNode( childUid, dataProvider ) && getParentNode( childUid, dataProvider ).uid );
        //remove duplicates
        return parentUids.filter( ( value, index ) => parentUids.indexOf( value ) === index );
    }
    return [];
}

/**
 * This method filters out node uids that are of the first level tree from a list of uids
 *
 * @param {string[]} treeObjectUids - a given tree objects uids
 * @param {object} dataProvider - a given data provider object
 * @return {string[]} the tree objects uids after filtering first level nodes
 */
export function filterOutFirstLevelTreeObjectUidsFromList( treeObjectUids, dataProvider ) {
    if( treeObjectUids.length > 0 && dataProvider ) {
        return treeObjectUids.filter( ( treeObjectUid ) => getParentNode( treeObjectUid, dataProvider ) );
    }
    return [];
}

/**
 *
 * @param {string} childUid - a given child uid
 * @param {object} dataProvider - a given data provider object
 * @return {TreeNodeViewModelObject} - the parent tree node of the given child uid. If it doesn't have a parent, then returns undefined.
 */
export function getParentNode( childUid, dataProvider ) {
    if( childUid && dataProvider ) {
        const loadedObjects = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
        const childNodeIndex = _.findIndex( loadedObjects, ( obj ) => obj.uid === childUid );
        if( childNodeIndex > -1 ) {
            const childTreeLevel = loadedObjects[ childNodeIndex ].$$treeLevel;
            if( childTreeLevel > 0 ) {
                for( let i = childNodeIndex - 1; i >= 0; i-- ) {
                    if( loadedObjects[ i ].$$treeLevel === childTreeLevel - 1 ) {
                        return loadedObjects[ i ];
                    }
                }
            }
        }
    }
    return undefined;
}

/**
 * This method clears the expansion state of the given tree nodes.
 * This is relevant only if the table uses the "cache collapse" mechanisim
 * @param {TreeNodeViewModelObject[]} treeNodes -  a set of given tree nodes
 */
export function clearCollapseCache( treeNodes ) {
    treeNodes.forEach( ( node ) => {
        delete node.__expandState;
    } );
}

/**
 *
 * @param {object} dataProvider - the dataProvider object
 */
export function unselectInvisibleNodes( dataProvider ) {
    if( dataProvider && dataProvider.selectionModel ) {
        const selected = dataProvider.selectionModel.getSelection();
        if( selected.length > 0 ) {
            const loadedObjects = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
            const removeFromSelection = selected.filter( ( selectedUid ) => {
                return _.findIndex( loadedObjects, ( obj ) => obj.uid === selectedUid ) === -1;
            } );
            if( removeFromSelection.length > 0 ) {
                dataProvider.selectionModel.removeFromSelection( removeFromSelection );
            }
        }
    }
}

/**
 *
 * @param {ViewModelObject[]} viewModelObjects - a given set of VMOs
 * @param {object} uidToUpdatedProps - map of uids to updated prop names array
 * @param {string} displayNameProp - the property name used as the display name
 */
export function updateDisplayName( viewModelObjects, uidToUpdatedProps, displayNameProp = tcPropConstants.OBJECT_STRING ) {
    if( Array.isArray( viewModelObjects ) ) {
        const updatedUids = Object.keys( uidToUpdatedProps );
        const updatedVmos = viewModelObjects.filter( ( vmo ) => updatedUids.indexOf( vmo.uid ) > -1 );
        updatedVmos.forEach( ( vmo ) => {
            if( vmo.displayName ) {
                vmo.displayName = vmo.props[ displayNameProp ].uiValues[ 0 ];
            }
        } );
    }
}

/**
 * Get the last row in the table
 *
 * @param {Object} dataProvider - the dataProvider object
 *
 * @returns {Object} the last row in table
 */
export function getLastRowInTable( dataProvider ) {
    const viewModelCollection = dataProvider.getViewModelCollection();
    const loadedVMObjects = viewModelCollection.getLoadedViewModelObjects();
    return loadedVMObjects[ loadedVMObjects.length - 1 ];
}

/**
 * This method finds and retrieves the tree node according to a property inside it
 * @param {TreeNodeViewModelObject[]} treeNodeObjects - a given set of tree nodes
 * @param {string} key - the property key
 * @param {string} value - the property value
 * @return {TreeNodeViewModelObject} - the tree node that was found
 */
export function getTreeNodeObjectByPropertyAndValue( treeNodeObjects, key, value ) {
    if( treeNodeObjects.length > 0 ) {
        let returnedTreeNode = undefined;
        treeNodeObjects.some( ( treeNode ) => {
            if( treeNode[ key ] && treeNode[ key ] === value ) {
                returnedTreeNode = treeNode;
            }
        } );
        return returnedTreeNode;
    }
    return undefined;
}

/**
 * renderRowByType
 * @param {*} columns column configuration
 * @param {*} rowRenderer renderer parameters (css class, types, revision types)
 */
function renderRowByType( columns, { style, types, revisionTypes } ) {
    if( columns ) {
        columns.forEach( ( column ) => {
            if( !column.cellRenderers ) {
                column.cellRenderers = [];
            }
            if( types ) {
                types.map( ( type ) =>
                    column.cellRenderers.push( getRowRenderer( style, type + style,
                        ( _column, rowVMO ) => rowVMO.modelType.typeHierarchyArray.indexOf( type ) > -1 ) )
                );
            }
            if( revisionTypes ) {
                revisionTypes.map( ( revisionType ) =>
                    column.cellRenderers.push( getRowRenderer( style, revisionType + style,
                        ( column, rowVMO ) =>
                            rowVMO.props.bl_rev_object_type && rowVMO.props.bl_rev_object_type.dbValue === revisionType )
                    )
                );
            }
        } );
    }
}

/**
 *
 * @param {Object} rowVMO - row VMO
 * @param {Object} condition - condition object
 * @returns {boolean} - result condition
 */
function checkPropertyCondition( rowVMO, condition ) {
    if( !condition || !rowVMO || !rowVMO.props || !rowVMO.props[condition.property] || !rowVMO.props[condition.property].displayValues.length ) {
        return false;
    }

    return rowVMO.props[condition.property].displayValues[0] === condition.value;
}
/**
 *
 * @param {Object[]} columns - column configuration
 * @param {Object[]} conditions - array conditions
 * @param {String[]} classNames - class names for each condition
 */
function rowRenderByPropertyValue( columns, conditions, classNames ) {
    if ( conditions && columns ) {
        columns.forEach( ( column ) => {
            if( !column.cellRenderers ) {
                column.cellRenderers = [];
            }
            conditions.map( ( condition, index ) =>
                column.cellRenderers.push( getRowRenderer( classNames[index], condition.name,
                    ( column, rowVMO ) => checkPropertyCondition( rowVMO, condition ) ) ) );
        } );
    }
}

/**
 * Selects all  / clears selection in mfe table
 * @param {Boolean} selectAll
 * @param {Object} selectionModel
 */
function  selectAllOrSelectNoneAction( selectAll, selectionModel )  {
    if( selectionModel ) {
        const dp = selectionModel.getDpListener();
        if( dp ) {
            if( selectAll ) {
                dp.selectAll();
            } else {
                dp.selectNone();
            }
        }
    }
}

/**
 * Multi-selects / clears selection in mfe table
 * @param {Boolean} selectAll
 * @param {Object} selectionModel
 */
function  multiSelectAction( multiSelect, selectionModel )  {
    if( selectionModel ) {
        const dp = selectionModel.getDpListener();
        if( dp ) {
            dp.selectionModel.setMultiSelectionEnabled( multiSelect );
            if( !multiSelect ) {
                dp.selectNone();
            }
        }
    }
}

export default {
    createColumns,
    addIconColumn,
    getTreeNodeObject,
    isLeaf,
    saveResizedColumnsWidth,
    expandTreeNode,
    collapseTreeNode,
    refreshTable,
    reloadTable,
    getRowRenderer,
    addToDataProvider,
    removeFromDataProvider,
    emptyDataProvider,
    appendChildNodes,
    appendChildNodeAsFirstIndex,
    getAllDescendantTreeNodes,
    removeChildNodes,
    removeSelection,
    removeSelectionUsingUIDs,
    getParentNode,
    clearCollapseCache,
    unselectInvisibleNodes,
    updateDisplayName,
    updateChildIndexes,
    getLastRowInTable,
    getParentUids,
    filterOutFirstLevelTreeObjectUidsFromList,
    getTreeNodeObjectByPropertyAndValue,
    createHardCodedClientColumnInfo,
    renderRowByType,
    rowRenderByPropertyValue,
    selectAllOrSelectNoneAction,
    multiSelectAction
};
