// Copyright (c) 2023 Siemens

/**
 * This implements the graph filter
 *
 * @module js/Rv1RelationBrowserGraphFilter
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import graphPathsService from 'js/graphPathsService';

/**
 * This filter will be applied to each graph item. This function
 * customizes which nodes/edges/ports cannot be filtered.
 *
 * @param {Object} graphModel the graph Model
 * @param {Object} category the graph legend category
 * @returns {Boolean} true or false whether the graph object can be filtered
 */
export let customerItemFilter = function( graphModel, category ) {
    return function( item ) {
        // return false means cannot be filtered

        if( !item ) {
            return false;
        }

        // if node type is root it cannot be filtered
        if( category.categoryType === 'objects' && item.isRoot() ) {
            return false;
        }

        // return true means apply default filters
        return true;
    };
};

/**
 * getNextLevelNodes
 * @param {Object} graphModel Graph Model
 * @returns {Function} Function that returns Next Level Nodes of input node
 */
var getNextLevelNodes = function( graphModel ) {
    return function( node ) {
        var nextLevelNodes = [];
        if( node.getItemType() !== 'Node' ) {
            return;
        }
        var edges = node.getEdges();
        var visibleEdges = _.filter( edges, function( edge ) {
            return !edge.isFiltered();
        } );

        _.forEach( visibleEdges, function( edge ) {
            var sourceNode = edge.getSourceNode();
            var targetNode = edge.getTargetNode();
            if( sourceNode === node && !targetNode.isFiltered() ) {
                nextLevelNodes.push( targetNode );
            } else if( targetNode === node && !sourceNode.isFiltered() ) {
                nextLevelNodes.push( sourceNode );
            }
        } );

        var children = node.getGroupMembers();
        if( children ) {
            var groupRelationCategory = graphModel.categoryApi.getGroupRelationCategory();
            var activeLegendView = appCtxSvc.ctx.graph.legendState.activeView;

            var category = _.find( activeLegendView.filteredCategories, function( category ) {
                return category.internalName === groupRelationCategory;
            } );

            if( !category ) {
                nextLevelNodes = nextLevelNodes.concat( children );
            }
        }

        nextLevelNodes = _.uniq( nextLevelNodes );
        nextLevelNodes = _.filter( nextLevelNodes, function( node ) { return !node.isFiltered(); } );
        return nextLevelNodes;
    };
};

/**
 * This will return any unconnected/orphan nodes
 *
 * Note: this is called directly by GC and it is not the same as the function
 * in Rv1RelationBrowserUtils.
 *
 * @param {Object} graphModel graph Model
 * @returns {Array} Orphan Nodes
 */
export let resolveConnectedGraph = function( graphModel ) {
    let orphanNodes = [];
    // based on all visible graph items
    var visibleNodes = graphModel.graphControl.graph.getNodes();
    visibleNodes = _.filter( visibleNodes, function( node ) { return !node.isFiltered(); } );

    // hide unconnected node items
    // unconnected node only meaningful under RootNode context.
    if( visibleNodes ) {
        var rootNodes = _.filter( visibleNodes, function( node ) { return node.isRoot(); } );
        if( rootNodes && rootNodes.length > 0 ) {
            var connectedGraphNodes = graphPathsService.getConnectedGraph( rootNodes, getNextLevelNodes( graphModel ) );
            orphanNodes = _.difference( visibleNodes, connectedGraphNodes );
        }
    }

    return orphanNodes;
};

const exports = {
    customerItemFilter,
    resolveConnectedGraph
};
export default exports;
