//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*
 global
 */

/**
 * Ase0RemoveFromDiagramService Removes nodes from diagram
 *
 * @module js/Ase0RemoveFromDiagramService
 */
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import utilSvc from 'js/Ase0ArchitectureUtilService';
import cmm from 'soa/kernel/clientMetaModel';
import archNodeService from 'js/Ase0ArchitectureNodeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import fadeNodeAnimation from 'js/fadeNodeAnimation';
import templateService from 'js/Ase0ArchitectureGraphTemplateService';

var FADE_TIMER = 2000;
var nodeAnimationMap = {};

/**
 * Check if Toggle off element is anchor
 * @param {Object} eventData data required to toggle off node
 * @param {Object} data view model data
 * @param {boolean} hasSystemModelerLicense has SystemModeler License flag
 * @return {Object} updated flags
 */
export let isToggleOffElementAnchor = function( eventData, data, hasSystemModelerLicense ) {
    let selectedAnchorNodes = [];
    let nodeContainsAnchor = false;
    let nodeExpandedOrHasRelation = false;
    let msgCount = 0;

    if( hasSystemModelerLicense && eventData && eventData.elementsToRemove && eventData.elementsToRemove.length > 0 ) {
        var graphModel = data.graphModel;
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;
        var visibleNodes = graph.getVisibleNodes();
        if( visibleNodes.length > 1 ) {
            _.forEach( eventData.elementsToRemove, function( element ) {
                const elementToRemoveModel = graphModel.dataModel.nodeModels[ element.uid ];
                const elementToRemove = elementToRemoveModel?.graphItem;
                if( elementToRemove ) {
                    if( elementToRemove.isRoot() ) {
                        selectedAnchorNodes.push( elementToRemove );
                        nodeExpandedOrHasRelation = isNodeHasVisibleRelations( elementToRemove ) || isNodeExpanded( elementToRemove, graphModel );
                    } else {
                        if( cmm && !cmm.isInstanceOf( 'Awb0Connection', elementToRemove.modelObject.modelType ) ) {
                            nodeContainsAnchor = isNodeContainsAnchor( elementToRemove, graphModel );
                        }
                    }
                }
                if( nodeExpandedOrHasRelation || nodeContainsAnchor ) {
                    ++msgCount;
                }
            } );
        }
    }
    return {
        selectedAnchorNodes : selectedAnchorNodes,
        nodeContainsAnchor : nodeContainsAnchor,
        msgCount : msgCount,
        nodeExpandedOrHasRelation : nodeExpandedOrHasRelation
    };
};

var isNodeContainsAnchor = function( selectedNode, graphModel ) {
    let nodeContainsAnchor = false;
    if( selectedNode ) {
        nodeContainsAnchor = traverse( selectedNode, graphModel );
    }
    return nodeContainsAnchor;
};

/**
 * traverse all childs
 * @param {Object} node graph item
 * @param {Object} graphModel graph model
 * @returns {boolean} if node contains anchor
 */
function traverse( node, graphModel ) {
    let nodeContainsAnchor = false;
    if( graphModel && node ) {
        var groupGraph = graphModel.graphControl.groupGraph;
        if( groupGraph.isGroup( node ) && groupGraph.isExpanded( node ) ) {
            var childrens = groupGraph.getChildNodes( node );
            if( childrens ) {
                _.forEach( childrens, function( child ) {
                    if( child.isRoot() ) {
                        nodeContainsAnchor = true;
                        return false;
                    } else if( groupGraph.isGroup( child ) && groupGraph.isExpanded( child ) ) {
                        traverse( child );
                    }
                } );
            }
        }
    }
    return nodeContainsAnchor;
}

var isNodeHasVisibleRelations = function( selectedNode ) {
    if( selectedNode ) {
        var edges = selectedNode.getEdges();
        var visibleEdges = _.find( edges, function( edge ) {
            return edge.isVisible();
        } );
        if( visibleEdges ) {
            return true;
        }
    }
    return false;
};

var isNodeExpanded = function( selectedNode, graphModel ) {
    if( selectedNode && graphModel ) {
        var groupGraph = graphModel.graphControl.groupGraph;
        if( groupGraph && groupGraph.isGroup( selectedNode ) && groupGraph.isExpanded( selectedNode ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Toggle off element from ace
 *
 * @param {Object} eventData data required to toggle off node
 * @param {boolean} hasSystemModelerLicense has SystemModeler License flag
 * @returns {boolean} isItemRemovedFromDiagram
 */
export let toggleOffVisibility = function( eventData, hasSystemModelerLicense ) {
    //User is trying to toggle off in diagram
    let isItemRemovedFromDiagram = false;
    var elementsToRemove = [];
    elementsToRemove = _.clone( eventData.elementsToRemove );

    if( hasSystemModelerLicense && elementsToRemove && elementsToRemove.length > 0 && !isItemRemovedFromDiagram ) {
        // Set this flag to check if Item is removed not deleted from Diagram.
        isItemRemovedFromDiagram = true;
    }
    return isItemRemovedFromDiagram;
};

/**
 * Invoke the method removeObjectsFromDiagram based on the flag isItemRemovedFromDiagram
 *
 * @param {Object} data required to get primary object excluded list.
 * @param {Object} eventData data required to toggle off node
 */
export let removeFromDiagram = function( data, eventData ) {
    var elementsToRemove = [];
    if( data.isItemRemovedFromDiagram ) {
        if( !_.isUndefined( eventData ) ) {
            elementsToRemove = _.clone( eventData.elementsToRemove );
        }
        if( !_.isUndefined( eventData ) && eventData.isFadeRequired ) {
            startAnimation( elementsToRemove, data.graphModel );
        } else {
            removeObjectsFromDiagram( elementsToRemove, data.graphModel );
        }
    }
};

/**
 * API to remove items from graph.
 *
 * @param {Object} elements elements to remove from diagram
 * @param {Object} graphModel graph model
 */
export let removeElementsFromDiagram = function( elements, graphModel ) {
    removeObjectsFromDiagram( elements, graphModel );
};

var processEdgesForRemoval = function( edges, itemsToRemove ) {
    var affectedNodeList = [];
    if( edges && edges.length > 0 ) {
        _.forEach( edges, function( edge ) {
            var srcNode = edge.getSourceNode();
            if( srcNode && srcNode.isVisible() && _.indexOf( itemsToRemove, srcNode ) === -1 ) {
                affectedNodeList.push( srcNode );
            }
            var tarNode = edge.getTargetNode();
            if( tarNode && tarNode.isVisible() && _.indexOf( itemsToRemove, tarNode ) === -1 ) {
                affectedNodeList.push( tarNode );
            }
        } );
    }
    return affectedNodeList;
};

/**
 * It will remove Graph Items from Diagram.
 *
 * @param {Object} elements elements to remove from diagram
 * @param {Object} graphModel graph model
 */
var removeObjectsFromDiagram = function( elements, graphModel ) {
    if( !elements || elements.length < 1 ) {
        return;
    }

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;

    // First Remove From Graph
    var itemsToRemove = [];
    var nodesToRemove = [];
    var edgesToRemove = [];
    var nodesToCheckForNormal = [];

    architectureLayoutService.clearGraphItemLists();
    _.forEach( elements, function( element ) {
        if( element ) {
            let elementToRemoveModel = graphModel.dataModel.nodeModels[ element.uid ];
            let elementToRemove = elementToRemoveModel?.graphItem;
            if( elementToRemove ) {
                itemsToRemove.push( elementToRemove );
                nodesToRemove.push( elementToRemove );
                var parent = graphControl.groupGraph.getParent( elementToRemove );
                if( parent ) {
                    architectureLayoutService.addNodeToFitAncestors( parent );
                    nodesToCheckForNormal.push( parent );
                }
            } else {
                elementToRemoveModel = graphModel.dataModel.portModels[ element.uid ];
                if( elementToRemoveModel ) {
                    itemsToRemove.push( elementToRemoveModel.graphItem );
                } else {
                    var isTracelink = false;
                    var tracelinksToRemove = [];
                    isTracelink = cmm.isInstanceOf( 'FND_TraceLink', element.modelType );
                    if( isTracelink ) {
                        var keys = Object.keys( graphModel.dataModel.edgeModels );
                        _.forEach( keys, function( key ) {
                            if( key.indexOf( element.uid ) !== -1 ) {
                                var edgeModel = graphModel.dataModel.edgeModels[ key ];
                                if( edgeModel ) {
                                    tracelinksToRemove.push( edgeModel.graphItem );
                                }
                            }
                        } );
                        if( tracelinksToRemove.length > 0 ) {
                            _.forEach( tracelinksToRemove, function( traceLink ) {
                                itemsToRemove.push( traceLink );
                                edgesToRemove.push( traceLink );
                            } );
                        }
                    } else {
                        elementToRemoveModel = graphModel.dataModel.edgeModels[ element.uid ];
                        elementToRemove = elementToRemoveModel?.graphItem;
                    }
                    if( elementToRemove ) {
                        itemsToRemove.push( elementToRemove );
                        edgesToRemove.push( elementToRemove );
                        var sourceItem = elementToRemove.getSourcePort();
                        var targetItem = elementToRemove.getTargetPort();

                        if( sourceItem && sourceItem.getConnections().length === 1 ) {
                            itemsToRemove.push( sourceItem );
                        }
                        if( targetItem && targetItem.getConnections().length === 1 ) {
                            itemsToRemove.push( targetItem );
                        }
                    }
                }
            }
        }
    } );

    if( itemsToRemove.length > 0 ) {
        itemsToRemove = _.uniq( itemsToRemove );
        var unConnectedItems = utilSvc.getUnconnectedItems( graphModel, nodesToRemove, edgesToRemove );
        if( unConnectedItems && unConnectedItems.length > 0 ) {
            _.forEach( unConnectedItems, function( unConnectedItem ) {
                itemsToRemove.push( unConnectedItem );
            } );
        }

        var affectedNodeList = [];
        var edgesToBeRemoved = [];
        itemsToRemove = _.uniq( itemsToRemove );
        _.forEach( itemsToRemove, function( itemToRemove ) {
            if( itemToRemove.getItemType() === 'Node' ) {
                var parentNode = graphControl.groupGraph.getParent( itemToRemove );
                if( parentNode && parentNode.isVisible() && _.indexOf( itemsToRemove, parentNode ) === -1 ) {
                    affectedNodeList.push( parentNode );
                }
                var edges = archNodeService.getVisibleEdgesAtNode( itemToRemove, 'BOTH' );
                edgesToBeRemoved = edgesToBeRemoved.concat( edges );
                var children = archNodeService.getAllLevelChildNodes( itemToRemove );
                if( children && children.length > 0 ) {
                    _.forEach( children, function( childNode ) {
                        var childEdges = archNodeService.getVisibleEdgesAtNode( childNode, 'BOTH' );
                        if( childEdges && childEdges.length > 0 ) {
                            edgesToBeRemoved = edgesToBeRemoved.concat( childEdges );
                        }
                    } );
                }
            } else if( itemToRemove.getItemType() === 'Edge' ) {
                edgesToBeRemoved.push( itemToRemove );
            } else if( itemToRemove.getItemType() === 'Port' && itemToRemove.modelObject ) {
                var portEdges = itemToRemove.getEdges( 'BOTH' );
                edgesToBeRemoved = edgesToBeRemoved.concat( portEdges );
            }
        } );

        // Calculate affected nodes on removal of edges from diagram
        affectedNodeList = affectedNodeList.concat( processEdgesForRemoval( edgesToBeRemoved, itemsToRemove ) );

        var removedItems = graph.removeItems( itemsToRemove, true );

        // Remove nodesToRemove from nodesToCheckForNormal
        nodesToCheckForNormal = _.difference( nodesToCheckForNormal, removedItems.nodes );
        // Remove nodesToRemove from NodesToFitAncestors
        _.forEach( removedItems.nodes, function( node ) {
            architectureLayoutService.removeNodeToFitAncestors( node );
            architectureLayoutService.addNodeToBeRemoved( node );
        } );

        architectureLayoutService.addEdgeToBeRemoved( removedItems.edges );
        architectureLayoutService.addPortToBeRemoved( removedItems.ports );

        _.forEach( nodesToCheckForNormal, function( node ) {
            // Check if it has no children and add to nodes to convert to normal node.
            var children = groupGraph.getChildNodes( node );
            if( !children || children.length === 0 ) {
                var nodeObject = node.modelObject;
                if( graphModel && nodeObject ) {
                    //update group node to normal node
                    var props = templateService.getBindPropertyNames( nodeObject );
                    var nodeStyle = templateService.getNodeTemplate( graphModel.nodeTemplates,
                        props, false );
                    var bindData = {
                        HEADER_HEIGHT: 0
                    };
                    graph.setNodeStyle( node, nodeStyle, bindData );
                    groupGraph.setExpanded( node, false );
                    groupGraph.setAsLeaf( node );
                    graph.setBounds( node, node.getResizeMinimumSize() );
                    architectureLayoutService.addNodeToBecomeNormal( node );
                }
            }
        } );

        if( removedItems.nodes && removedItems.nodes.length > 0 && affectedNodeList.length > 0 ) {
            _.forEach( removedItems.nodes, function( node ) {
                var index = affectedNodeList.indexOf( node );
                if( index !== -1 ) {
                    affectedNodeList.splice( index, 1 );
                }
            } );
        }

        if( affectedNodeList && affectedNodeList.length > 0 ) {
            affectedNodeList = _.uniq( affectedNodeList );
            //fire graph node degree update event
            eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
                affectedNodeList: affectedNodeList
            } );
        }
    }

    architectureLayoutService.applyGraphLayout( graphModel, true /* Not used if later 2 are false */, false, false );
};

/**
 *  Start node animation
 *
 * @param {Object} elementsToRemove array of elements to be removed
 * @param {Object} graphModel graph model
 */
var startAnimation = function( elementsToRemove, graphModel ) {
    if( graphModel && elementsToRemove.length > 0 ) {
        _.forEach( elementsToRemove, function( element ) {
            if( graphModel.dataModel.nodeModels[ element.uid ] ) {
                const nodeModel = graphModel.dataModel.nodeModels[ element.uid ];
                if( !nodeAnimationMap[ element.uid ] ) {
                    var nodeAnimationHandler = fadeNodeAnimation.fadeNode( nodeModel.graphItem, FADE_TIMER, function finishCallback() {
                        if( nodeAnimationMap[ element.uid ] ) {
                            delete nodeAnimationMap[ element.uid ];
                            removeObjectsFromDiagram( [ element ], graphModel );
                        }
                    } );
                    nodeAnimationMap[ element.uid ] = nodeAnimationHandler;
                } else {
                    var nodeAnimationHandler1 = nodeAnimationMap[ element.uid ];
                    delete nodeAnimationMap[ element.uid ];
                    nodeAnimationHandler1.cancel( function cancelCallback() {
                        // do nothing
                    } );
                }
            }
        } );
    }
};

const exports = {
    isToggleOffElementAnchor,
    toggleOffVisibility,
    removeElementsFromDiagram,
    removeFromDiagram
};
export default exports;
