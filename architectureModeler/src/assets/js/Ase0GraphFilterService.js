// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global

 */

/**
 * This implements the graph filter
 *
 * @module js/Ase0GraphFilterService
 */
import utilSvc from 'js/Ase0ArchitectureUtilService';

/**
 * Optional
 *
 * custom graph item filter, this filter will be applied to each graph item. By defining this, function application can
 * customize their own requirement by specifying which nodes/edges/ports cannot be filtered
 *
 * Here is a filter by setting not filtering root node.
 *
 * @param {Object} graphModel - the graph Model
 * @param {Object} category the graph legend category
 * @param {Object} item - the graph item, could be node, port, edge
 * @return {boolean} true or false whether the graph object can be filtered
 */
export let customerItemFilter = function( graphModel, category ) {
    return function( item ) {
        if( !item ) {
            return false;
        }

        // custom filter rule for object type
        // return false means cannot be filtered
        // if node type is root, set it cannot be filtered
        if( category.categoryType === 'objects' && item.isRoot() ) {
            return false;
        }

        return true;
    };
};

/**
 * Optional
 *
 * custom graph resolver. by defining this function user can customize their own graph resolver to ensure the
 * connectivity of the their own graph after it was filtered. In this resolver function, application can define their
 * own requirements regarding handle and process any unconnected nodes/edges/ports.
 *
 *
 * Here is a resolver by hiding any unconnected nodes/edges/ports
 *
 * @param {Object} graphModel - the graph Model
 */
export let resolveConnectedGraph = function( graphModel ) {
    var unConnectedItems = utilSvc.getUnconnectedItems( graphModel );

    // hide unconnected node items
    // unconnected node only meaningful under RootNode context.
    graphModel.graphControl.graph.setVisible( unConnectedItems, false );
};

/**
 * Define
 *
 * @member Ase0GraphFilterService

 * @param {Object} utilSvc - Architecture Util Service
 * @return {Object} exports
 */

const exports = {
    customerItemFilter,
    resolveConnectedGraph
};
export default exports;
