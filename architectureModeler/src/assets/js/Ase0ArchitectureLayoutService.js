//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 *
 *
 * @module js/Ase0ArchitectureLayoutService
 */
import _ from 'lodash';
import graphConstants from 'js/graphConstants';

var _nodesToAddWithPosition = [];
var _nodesToAdd = [];
var _portsToAddWithPosition = [];
var _portsToAdd = [];
var _groupsToAdd = [];
var _groupNodesToLayout = [];
var _groupNodesToExpand = [];
var _nodesToBecomeGroup = [];
var _edgesToAdd = [];
var _nodesToRemove = [];
var _portsToRemove = [];
var _edgesToRemove = [];
var _nodesToFitAncestors = [];
var _nodesToBecomeNormal = [];
var _groupNodesToCollapse = [];

/**
 * Constants for Layout Directions.
 */
export let LayoutDirections = {
    'Top-to-Bottom': graphConstants.LayoutDirections.TopToBottom,
    'Bottom-to-Top': graphConstants.LayoutDirections.BottomToTop,
    'Right-to-Left': graphConstants.LayoutDirections.RightToLeft,
    'Left-to-Right': graphConstants.LayoutDirections.LeftToRight,
    TopToBottom: graphConstants.LayoutDirections.TopToBottom,
    BottomToTop: graphConstants.LayoutDirections.BottomToTop,
    RightToLeft: graphConstants.LayoutDirections.RightToLeft,
    LeftToRight: graphConstants.LayoutDirections.LeftToRight
};

/**
 * Apply layout to graph
 *
 * @param {Object} graphModel the graph model object
 * @param {Boolean} isKeepPosition the flag to keep graph items position or not.
 * @param {Boolean} isRecallCase the flag to indicate if this is recall case or not.
 * @param {Boolean} isApplyGlobalLayout the flag to apply global layout or not.
 * @param {Boolean} isAutoLayoutOn the flag to apply autolayout or not.
 */
export let applyGraphLayout = function( graphModel, isKeepPosition, isRecallCase, isApplyGlobalLayout, isAutoLayoutOn ) {
    //the layout is initialized by GC by default, it's directly available
    var layout = graphModel.graphControl.layout;
    var keepPosition = isKeepPosition;

    if( isAutoLayoutOn === false ) {
        if( !isRecallCase ) {
            exports.clearGraphItemLists();
        }
        return;
    }

    if( !layout ) {
        return;
    }

    if( isApplyGlobalLayout || isRecallCase ) {
        if( isApplyGlobalLayout ) {
            //need apply global layout first for incremental update
            layout.applyLayout();
            keepPosition = false;
        }
        layout.activate( keepPosition );
    } else {
        // activate method does nothing if layout is active. So we can call activate method directly.
        layout.activate( keepPosition );
        procesGraphItemLists( graphModel, layout );
        exports.clearGraphItemLists();
    }
};

/**
 * Ensure group node hierarchy is added to layout before adding itself
 *
 * @param {Object} groupGraph the groupGraph object
 * @param {Object} layout the layout object
 * @param {Object} group the groupNode object
 */
var ensureGroupNodeVisibility = function( groupGraph, layout, group ) {
    var children = groupGraph.getChildNodes( group );
    _.forEach( children, function( child ) {
        if( groupGraph.isGroup( child ) ) {
            if( !layout.containsNode( child ) ) {
                ensureGroupNodeVisibility( groupGraph, layout, child );
            }
        } else {
            if( !layout.containsNode( child ) ) {
                // This should not happen.
                layout.addNode( child, false );
            }
        }
    } );
    layout.addNewGroupNode( group, children );
};

/**
 * Layout each graph item list
 *
 * @param {Object} graphModel the graph model object
 * @param {Object} layout the layout model object
 */
var procesGraphItemLists = function( graphModel, layout ) {
    var graphControl = graphModel.graphControl;
    var groupGraph = graphControl.groupGraph;

    layout.applyUpdate( function() {
        // First process removed item lists
        _.forEach( _nodesToRemove, function( node ) {
            layout.removeNode( node, true );
        } );
        _.forEach( _portsToRemove, function( port ) {
            // To do should connections from port be removed as well?
            layout.removePort( port );
        } );
        _.forEach( _edgesToRemove, function( edge ) {
            layout.removeEdge( edge );
        } );

        // Now process added and updated item lists
        _.forEach( _nodesToBecomeGroup, function( node ) {
            layout.convertToGroup( node );
        } );
        _.forEach( _nodesToAddWithPosition, function( node ) {
            if( !layout.containsNode( node ) ) {
                layout.addNode( node, true );
            }
        } );

        _.forEach( _nodesToAdd, function( node ) {
            if( !layout.containsNode( node ) ) {
                layout.addNode( node, false );
            }
        } );

        _.forEach( _groupNodesToLayout, function( node ) {
            var descendants = _.filter( node.getAllMembers(), function( item ) {
                return   item instanceof window.SDF.Models.Node  &&  !layout.containsNode( item );
            } );
            if( descendants.length > 0 ) {
                layout.expandAndLayoutExistingGroupNode( node, descendants, [] );
            }
        } );

        // Groups should be added before adding ports or edges
        // As edge or port might be connected to these groups
        _.forEach( _groupsToAdd, function( group ) {
            if( !layout.containsNode( group ) ) {
                ensureGroupNodeVisibility( groupGraph, layout, group );
            }
        } );
        _.forEach( _portsToAddWithPosition, function( port ) {
            if( !layout.containsPort( port ) ) {
                layout.addPort( port, true );
            }
        } );

        _.forEach( _portsToAdd, function( port ) {
            if( !layout.containsPort( port ) ) {
                layout.addPort( port, false );
            }
        } );
        _.forEach( _edgesToAdd, function( edge ) {
            if( !layout.containsEdge( edge ) ) {
                layout.addEdge( edge );
            }
        } );
        _.forEach( _groupNodesToExpand, function( node ) {
            layout.expandGroupNode( node );
            layout.fitGroupNode( node );
        } );
        _.forEach( _nodesToFitAncestors, function( node ) {
            // Check if node is in layout
            if( layout.containsNode( node ) ) {
                layout.fitAncestorNodes( node );
            }
        } );
        _.forEach( _nodesToBecomeNormal, function( node ) {
            // Check if node is in layout
            if( layout.containsNode( node ) ) {
                layout.convertGroupNodeToNode( node );
            }
        } );
        _.forEach( _groupNodesToCollapse, function( node ) {
            // Check if node is in layout
            if( layout.containsNode( node ) ) {
                layout.collapseGroupNode( node );
            }
        } );
    } );
};

/**
 * Clear all graph items list
 */
export let clearGraphItemLists = function() {
    _nodesToAddWithPosition = [];
    _nodesToAdd = [];
    _portsToAddWithPosition = [];
    _portsToAdd = [];
    _groupsToAdd = [];
    _groupNodesToExpand = [];
    _nodesToBecomeGroup = [];
    _edgesToAdd = [];
    _nodesToRemove = [];
    _portsToRemove = [];
    _edgesToRemove = [];
    _nodesToFitAncestors = [];
    _nodesToBecomeNormal = [];
    _groupNodesToLayout = [];
    _groupNodesToCollapse = [];
};

export let setLayoutType = function( data, layoutCommandId, layoutOption, layoutString ) {
    data.layoutCommandId = layoutCommandId;
    data.layoutOption = layoutOption;
    data.layoutString = layoutString;
};

/**
 * Add node to the list of nodes to be added to layout
 * @param {Object} node the node to add to list
 */
export let addNodeToBeAdded = function( node ) {
    if( _.indexOf( _nodesToAdd, node ) === -1 ) {
        _nodesToAdd.push( node );
    }
};

/**
 * Remove node from the list of nodes to be added to layout
 * @param {Object} node the node to remove from list
 */
export let removeNodeToBeAdded = function( node ) {
    _.pull( _nodesToAdd, node );
};

/**
 * Add node to the list of nodes to be added to layout with position
 * @param {Object} node the node to add to list
 */
export let addNodeToBeAddedWithPosition = function( node ) {
    if( _.indexOf( _nodesToAddWithPosition, node ) === -1 ) {
        _nodesToAddWithPosition.push( node );
    }
};

/**
 * Remove node from the list of nodes to be added to layout with position
 * @param {Object} node the node to remove from list
 */
export let removeNodeToBeAddedWithPosition = function( node ) {
    _.pull( _nodesToAddWithPosition, node );
};

/**
 * Add port to the list of ports to be added to layout
 * @param {Object} port the port to add to list
 */
export let addPortToBeAdded = function( port ) {
    if( _.indexOf( _portsToAdd, port ) === -1 ) {
        _portsToAdd.push( port );
    }
};

/**
 * Remove port from the list of ports to be added to layout
 * @param {Object} port the port to remove from list
 */
export let removePortToBeAdded = function( port ) {
    _.pull( _portsToAdd, port );
};

/**
 * Add port to the list of ports to be added to layout with position
 * @param {Object} port the port to add to list
 */
export let addPortToBeAddedWithPosition = function( port ) {
    if( _.indexOf( _portsToAddWithPosition, port ) === -1 ) {
        _portsToAddWithPosition.push( port );
    }
};

/**
 * Remove port from the list of ports to be added to layout with position
 * @param {Object} port the port to remove from list
 */
export let removePortToBeAddedWithPosition = function( port ) {
    _.pull( _portsToAddWithPosition, port );
};

/**
 * Add groupNode to the list of groupNodes to be added to layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addGroupToBeAdded = function( groupNode ) {
    if( _.indexOf( _groupsToAdd, groupNode ) === -1 ) {
        _groupsToAdd.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to be added to layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeGroupToBeAdded = function( groupNode ) {
    _.pull( _groupsToAdd, groupNode );
};

/**
 * Add groupNode to the list of groupNodes to be expanded and layouted in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addGroupNodeToExpandAndLayout = function( groupNode ) {
    if( _.indexOf( _groupNodesToLayout, groupNode ) === -1 ) {
        _groupNodesToLayout.push( groupNode );
    }
};

/**
 * Add groupNode to the list of groupNodes to be expanded in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addGroupNodeToExpand = function( groupNode ) {
    if( _.indexOf( _groupNodesToExpand, groupNode ) === -1 ) {
        _groupNodesToExpand.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to be expanded in layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeGroupNodeToExpand = function( groupNode ) {
    _.pull( _groupNodesToExpand, groupNode );
};

/**
 * Add node to the list of nodes to become groupNode in layout
 * @param {Object} node the node to add to list
 */
export let addNodeToBecomeGroup = function( node ) {
    if( _.indexOf( _nodesToBecomeGroup, node ) === -1 ) {
        _nodesToBecomeGroup.push( node );
    }
};

/**
 * Remove node from the list of nodes to become groupNode in layout
 * @param {Object} node the node to remove from list
 */
export let removeNodeToBecomeGroup = function( node ) {
    _.pull( _nodesToBecomeGroup, node );
};

/**
 * Add edge to the list of edges to be added in layout
 * @param {Object} edge the edge to add to list
 */
export let addEdgeToBeAdded = function( edge ) {
    if( _.indexOf( _edgesToAdd, edge ) === -1 ) {
        _edgesToAdd.push( edge );
    }
};

/**
 * Remove edge from the list of edges to be added in layout
 * @param {Object} edge the edge to remove from list
 */
export let removeEdgeToBeAdded = function( edge ) {
    _.pull( _edgesToAdd, edge );
};

/**
 * Add node to the list of nodes to be removed from layout
 * @param {Object} node the node to add to list
 */
export let addNodeToBeRemoved = function( node ) {
    if( _.indexOf( _nodesToRemove, node ) === -1 ) {
        _nodesToRemove.push( node );
    }
};

/**
 * Remove node from the list of nodes to be removed from layout
 * @param {Object} node the node to remove from list
 */
export let removeNodeToBeRemoved = function( node ) {
    _.pull( _nodesToRemove, node );
};

/**
 * Add port to the list of ports to be removed from layout
 * @param {Object} ports ports to add to list
 */
export let addPortToBeRemoved = function( ports ) {
    _.forEach( ports, function( port ) {
        if( _.indexOf( _portsToRemove, port ) === -1 ) {
            _portsToRemove.push( port );
        }
    } );
};

/**
 * Remove port from the list of ports to be removed from layout
 * @param {Object} port the port to remove from list
 */
export let removePortToBeRemoved = function( port ) {
    _.pull( _portsToRemove, port );
};

/**
 * Add edge to the list of edges to be removed from layout
 * @param {Object} edges edges to add to list
 */
export let addEdgeToBeRemoved = function( edges ) {
    _.forEach( edges, function( edge ) {
        if( _.indexOf( _edgesToRemove, edge ) === -1 ) {
            _edgesToRemove.push( edge );
        }
    } );
};

/**
 * Remove edge from the list of edges to be removed from layout
 * @param {Object} edge the edge to remove from list
 */
export let removeEdgeToBeRemoved = function( edge ) {
    _.pull( _edgesToRemove, edge );
};

/**
 * Add groupNode to the list of groupNodes to fit ancestors in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addNodeToFitAncestors = function( groupNode ) {
    if( _.indexOf( _nodesToFitAncestors, groupNode ) === -1 ) {
        _nodesToFitAncestors.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to fit ancestors in layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeNodeToFitAncestors = function( groupNode ) {
    _.pull( _nodesToFitAncestors, groupNode );
};

/**
 * Add groupNode to the list of groupNodes to become normalNode in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addNodeToBecomeNormal = function( groupNode ) {
    if( _.indexOf( _nodesToBecomeNormal, groupNode ) === -1 ) {
        _nodesToBecomeNormal.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to become normalNode in layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeNodeToBecomeNormal = function( groupNode ) {
    _.pull( _nodesToBecomeNormal, groupNode );
};

/**
 * Add groupNode to the list of groupNodes to collapse in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addGroupNodesToCollapse = function( groupNode ) {
    if( _.indexOf( _groupNodesToCollapse, groupNode ) === -1 ) {
        _groupNodesToCollapse.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to collapse in layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeGroupNodesToCollapse = function( groupNode ) {
    _.pull( _groupNodesToCollapse, groupNode );
};

const exports = {
    LayoutDirections,
    applyGraphLayout,
    clearGraphItemLists,
    setLayoutType,
    addNodeToBeAdded,
    removeNodeToBeAdded,
    addNodeToBeAddedWithPosition,
    removeNodeToBeAddedWithPosition,
    addPortToBeAdded,
    removePortToBeAdded,
    addPortToBeAddedWithPosition,
    removePortToBeAddedWithPosition,
    addGroupToBeAdded,
    removeGroupToBeAdded,
    addGroupNodeToExpandAndLayout,
    addGroupNodeToExpand,
    removeGroupNodeToExpand,
    addNodeToBecomeGroup,
    removeNodeToBecomeGroup,
    addEdgeToBeAdded,
    removeEdgeToBeAdded,
    addNodeToBeRemoved,
    removeNodeToBeRemoved,
    addPortToBeRemoved,
    removePortToBeRemoved,
    addEdgeToBeRemoved,
    removeEdgeToBeRemoved,
    addNodeToFitAncestors,
    removeNodeToFitAncestors,
    addNodeToBecomeNormal,
    removeNodeToBecomeNormal,
    addGroupNodesToCollapse,
    removeGroupNodesToCollapse
};
export default exports;
