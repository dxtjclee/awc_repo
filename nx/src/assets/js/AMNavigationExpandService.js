// Copyright (c) 2022 Siemens

/**
 * @module js/AMNavigationExpandService
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awTableStateSvc from 'js/awTableStateService';

let exports;

const toggleTreeNodeConst = 'objNavTree.plTable.toggleTreeNode';

/**
 * Function to perform expand operation for selected node which includes nested children
 * @param {Object} declViewModel data object
 */
export let performExpandBelow = ( declViewModel ) => {
    let treeNode = declViewModel.dataProviders.objNavTreeDataProvider.getSelectedObjects()[0];
    if( !treeNode || treeNode.isLeaf ) {
        return;
    }

    treeNode.isInExpandBelowMode = true;
    // Check if selected object is not leaf node and its children are already loaded
    if( treeNode.__expandState ) {
        let childNodeList = [];
        getChildNodeListToNLevel( treeNode, childNodeList );
        eventBus.publish( 'objNavTreeDataProvider.expandTreeNode', {
            parentNode: {
                id: treeNode.uid
            }
        } );

        if( childNodeList && childNodeList.length > 0 ) {
            expandFirstLevelChildren( childNodeList, declViewModel );
        }
    } else if( !treeNode.__expandState ) {
        // Check if selected node is already expanded
        if( treeNode.isExpanded && treeNode.children && treeNode.children.length > 0 ) {
            eventBus.publish( toggleTreeNodeConst, treeNode );
            expandFirstLevelChildren( treeNode.children, declViewModel );
        } else {
            // if selected object is not leaf node and its children are not loaded
            eventBus.publish( 'objNavTreeDataProvider.expandTreeNode', {
                parentNode: {
                    id: treeNode.uid
                }
            } );
        }
    }
};

/**
 * Function to perform collapse operation for selected node
 * @param {Object} declViewModel data object
 * @param {Object} treeDataProvider tree data provider
 */
export let performCollapseBelow = ( declViewModel, treeDataProvider ) => {
    let treeNode = declViewModel.dataProviders.objNavTreeDataProvider.getSelectedObjects()[0];
    if( !treeNode ) {
        return;
    }
    let nodesInfo = getApplicableNodesInfoForCollapse( treeNode.children, treeDataProvider );
    let nodesToCollapse = nodesInfo.nodes;
    while( nodesInfo.children.length ) {
        nodesInfo = getApplicableNodesInfoForCollapse( nodesInfo.children, treeDataProvider );
        nodesToCollapse = nodesToCollapse.concat( nodesInfo.nodes );
    }

    nodesToCollapse.reverse().map( ( vmo ) => awTableStateSvc.saveRowCollapsed( declViewModel, 'objNavTree', vmo ) );

    delete treeNode.isExpanded;
    treeNode.isInExpandBelowMode = false;
    eventBus.publish( toggleTreeNodeConst, treeNode );
    delete treeNode.__expandState;
};

/**
 * Function to get nested children information which is to collapse
 * @param {Array} vmoNodes array of viewModelObjects
 * @param {Object} treeDataProvider data provider object.
 * @returns {Object} nodesInfo
 */
let getApplicableNodesInfoForCollapse = function( vmoNodes, treeDataProvider ) {
    let nodesInfo = {
        nodes: [],
        children: []
    };
    vmoNodes && vmoNodes.forEach( ( vmoNode ) => {
        if( awTableStateSvc.isNodeExpanded( treeDataProvider.ttState, vmoNode ) ) {
            nodesInfo.nodes.push( vmoNode );
            if( vmoNode.children && vmoNode.children.length > 0 ) {
                nodesInfo.children = nodesInfo.children.concat( vmoNode.children );
            }
        }
    } );
    return nodesInfo;
};

/**
 * Get the child node list up to N level
 * @param {Object} parentVmo parent viewModelTree Node
 * @param {Array} childNodeList list of child objects
 */
let getChildNodeListToNLevel = function( parentVmo, childNodeList ) {
    _.forEach( parentVmo.__expandState.expandedNodes, function( node ) {
        if( !node.isLeaf ) {
            if( !node.__expandState ) {
                childNodeList.push( node );
            } else {
                if( node.__expandState.expandedNodes ) {
                    getChildNodeListToNLevel( node, childNodeList );
                }
            }
        }
    } );
};

/**
 * Expand child nodes upto first level
 * @param {Object} childNodes child viewModelTreeNode objects
 * @param {Object} declViewModel data object
 */
let expandFirstLevelChildren = function( childNodes, declViewModel ) {
    childNodes && childNodes.forEach( childNode => {
        if( !childNode.isLeaf ) {
            childNode.isInExpandBelowMode = true;
            awTableStateSvc.saveRowExpanded( declViewModel, 'objNavTree', childNode );
            if( childNode.isExpanded && childNode.children && childNode.children.length > 0 ) {
                eventBus.publish( toggleTreeNodeConst, childNode );
                expandFirstLevelChildren( childNode.children, declViewModel );
            }
        }
    } );
};

exports = {
    performExpandBelow,
    performCollapseBelow
};

export default exports;
