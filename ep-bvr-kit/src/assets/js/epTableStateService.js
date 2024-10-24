// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for keeping the selection in ep tree table views
 * As after tree configuration, all UIDs are getting updated
 *
 * @module js/epTableStateService
 */

import AwPromiseService from 'js/awPromiseService';
import mfeTableService from 'js/mfeTableService';

let treeNodesState = new Map();

/**
 * Store the current tree loaded view model objects
 * to restore the expansion and selection after configuration page reload
 *
 * @param {String} tabKey the tabKey as map key
 * @param {ObjectArray} loadedVMObjects the tree loaded view model
 */
export function storeTreeState( tabKey, loadedVMObjects ) {
    loadedVMObjects && treeNodesState.set( tabKey, loadedVMObjects );
}

/**
 * Clear the stored tree state of the tabKey
 *
 * @param {String} tabKey the tabKey as key
 */
export function clearStoredTreeState( tabKey ) {
    treeNodesState.delete( tabKey );
}

/**
 * Restore the tree state
 *
 * @param {String} tabKey the tabKey as map key
 * @param {Object} dataProvider the dataProvider
 * @param {Object} viewModelData - view Model Data
 *
 * @returns {Object} promise
 */
export function restoreTreeState( tabKey, dataProvider, viewModelData ) {
    let promiseAll = [];
    let objectsToBeSelected = [];
    const storedTreeState = treeNodesState.get( tabKey );
    if( storedTreeState && dataProvider.viewModelCollection.loadedVMObjects && dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        storedTreeState.forEach( currentVmo => {
            if( currentVmo.isExpanded && currentVmo.isExpanded === true || currentVmo.selected === true ) {
                const stableOccurrenceId = currentVmo.props?.bl_clone_stable_occurrence_id?.dbValues[0];
                if( stableOccurrenceId ) {
                    const foundNode = dataProvider.viewModelCollection.loadedVMObjects.find( vmo => vmo.props?.bl_clone_stable_occurrence_id?.dbValues[0] === stableOccurrenceId );
                    const isExpanded = foundNode.isExpanded && currentVmo.isExpanded === true;
                    if( foundNode ) {
                        if( !isExpanded && currentVmo.isExpanded && currentVmo.isExpanded === true ) {
                            promiseAll.push( mfeTableService.expandTreeNode( dataProvider, foundNode, viewModelData ) );
                        }
                        if( currentVmo.selected === true ) {
                            objectsToBeSelected.push( foundNode );
                        }
                    }
                }
            }
        } );
    }
    storedTreeState && objectsToBeSelected.length > 0 && restoreSelection( tabKey, dataProvider, objectsToBeSelected );
    return AwPromiseService.instance.all( promiseAll );
}

/**
 * Restore the selection
 *
 * @param {String} tabKey the tabKey as map key
 * @param {Object} dataProvider the dataProvider
 * @param {ObjectArray} objectsToBeSelected the object to select
 */
function restoreSelection( tabKey, dataProvider, objectsToBeSelected ) {
    dataProvider.selectionModel.setSelection( objectsToBeSelected );
    clearStoredTreeState( tabKey );
}

export default {
    storeTreeState,
    clearStoredTreeState,
    restoreTreeState
};
