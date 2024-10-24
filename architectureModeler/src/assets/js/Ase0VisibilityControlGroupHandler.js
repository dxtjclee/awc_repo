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
 * @module js/Ase0VisibilityControlGroupHandler
 */
import archDataCache from 'js/Ase0ArchitectureDataCache';
import archNodeService from 'js/Ase0ArchitectureNodeService';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import utilSvc from 'js/Ase0ArchitectureUtilService';
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import archGraphSetUnsetAnchorService from 'js/Ase0ArchitectureSetUnsetAnchorService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import graphConstants from 'js/graphConstants';
import templateService from 'js/Ase0ArchitectureGraphTemplateService';
import cmm from 'soa/kernel/clientMetaModel';

/*******************************************************************************************************************
 * All Off Handler
 * @param {object} archGraphModel the architecture graph model object
 * @param {Object} graphModel graph model
 * @param {Object} graphState Architecture graph state
 */
export let handleClearDiagram = function( archGraphModel, graphModel, graphState ) {
    const graphStateValue = { ...graphState.value };
    clearGraph( archGraphModel, graphModel );
    graphStateValue.isEmpty = true;
    graphState.update && graphState.update( graphStateValue );
};

/*******************************************************************************************************************
 * Fit graph Visibility Handler
 * @param {Object} graphModel graph model
 */
export let fitGraphVisibility = function( graphModel ) {
    if( graphModel && graphModel.graphControl ) {
        graphModel.graphControl.fitGraph();
    }
};

/*******************************************************************************************************************
 * Fit Selected Node Visibility Handler
 * @param {Object} graphModel graph model
 */
export let fitSelectedDiagram = function( graphModel ) {
    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        var selectedNodes = graphControl.getSelected( 'Node' );

        if( selectedNodes && selectedNodes.length > 0 ) {
            graphControl.panToView( selectedNodes, graphConstants.PanToViewOption.CENTER );
        }
    }
};
/*******************************************************************************************************************
 * Selected Only Visibility Handler
 * @param {Object} graphModel graph model
 */
export let selectedOnlyInDiagram = function( graphModel ) {
    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        var selectedNodes = graphControl.getSelected( 'Node' );
        if( selectedNodes && selectedNodes.length > 0 ) {
            clearAndSetSelectedNodes( selectedNodes, graphModel );
        }
        if( selectedNodes && selectedNodes.length > 0 ) {
            graphControl.panToView( selectedNodes, graphConstants.PanToViewOption.CENTER );
        }
    }
};
/*******************************************************************************************************************
 * SelectedOn Command Handler
 * @param {Array} selectedACEObjects selected ACE objects
 * @param {Object} graphModel graph model
 */
export let selectedOnVisibilityHandler = function( selectedACEObjects, graphModel ) {
    var selectedNodesInDiagram = [];
    var nodesToToggleVisibility = [];
    if( graphModel && graphModel.graphControl ) {
        selectedNodesInDiagram = graphModel.graphControl.getSelected( 'Node' );
    }
    nodesToToggleVisibility = _.difference( selectedACEObjects, selectedNodesInDiagram );

    var eventData = {
        elementsToAdd: nodesToToggleVisibility,
        isFadeRequired: false,
        isVisible: true
    };

    eventBus.publish( 'AM.toggleOnVisibilityEvent', eventData );
};
/*******************************************************************************************************************
 * selected Off Condition
 * @param {Object} graphModel graph model
 */
export let selectedOffInDiagram = function( graphModel ) {
    var selectedNodeModels = [];
    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        var selectedNodes = graphControl.getSelected( 'Node' );
        if( selectedNodes && selectedNodes.length > 0 ) {
            selectedNodeModels = getModelObjects( selectedNodes );
        }
        var eventData = {
            elementsToRemove: selectedNodeModels,
            isFadeRequired: false,
            isVisible: true
        };
        eventBus.publish( 'AM.toggleOffVisibilityEvent', eventData );
    }
};

var showParentNode = function( selectedNode ) {
    if( selectedNode ) {
        eventBus.publish( 'AMManageDiagramEvent', {
            primaryObjects: [ selectedNode ],
            userAction: 'Expand.Parent'
        } );
    }
};

export let showParentVisibilityHandler = function( graphModel ) {
    var selectedNode = null;

    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        let selectedNodes = graphControl.getSelected( 'Node' );
        if( selectedNodes.length === 1 && selectedNodes[ 0 ].modelObject ) {
            selectedNode = selectedNodes[ 0 ].modelObject;
        }
    }
    showParentNode( selectedNode );
};

var hideParentNode = function( selectedNode, parentNode, graphModel, newGraphState ) {
    var affectedNodeList = [];
    if( parentNode && parentNode.isVisible() ) {
        var unconnectedItems = [];
        var graphControl = graphModel.graphControl;
        var groupedGraph = graphControl.groupGraph;
        var children = archNodeService.getChildNodes( parentNode, graphModel );

        graphControl.graph.update( function() {
            groupedGraph.setParent( null, children );
        } );

        if( children && children.length > 0 ) {
            _.forEach( children, function( child ) {
                var grandChildren = archNodeService.getChildNodes( child, graphModel );
                affectedNodeList.push( child );
                if( grandChildren && grandChildren.length > 0 ) {
                    _.forEach( grandChildren, function( grandChild ) {
                        if( _.indexOf( affectedNodeList, grandChild ) === -1 ) {
                            affectedNodeList.push( grandChild );
                        }
                    } );
                }
            } );
        }

        if( parentNode.isRoot() ) {
            parentNode.isRoot( false );
            var rootNodeList = graphModel.rootNodeList;
            var index = rootNodeList.indexOf( parentNode.modelObject.uid );
            if( index > -1 ) {
                rootNodeList.splice( index, 1 );
            }
            var nodeItem = selectedNode;
            nodeItem.isRoot( true );
            var nodeUid = nodeItem.modelObject.uid;
            if( rootNodeList.indexOf( nodeUid ) < 0 ) {
                rootNodeList.push( nodeUid );
            }
            setRootStyle( nodeItem );
        }
        unconnectedItems = utilSvc.getUnconnectedItems( graphModel );
        if( !_.includes( unconnectedItems, parentNode ) ) {
            unconnectedItems.push( parentNode );
        }

        var elementsToRemove = _.map( unconnectedItems, 'modelObject' );

        if( elementsToRemove.length > 0 ) {
            var eventData = {
                elementsToRemove: elementsToRemove
            };
            eventBus.publish( 'AM.toggleOffEvent', eventData );
        }

        const selectedNodes = graphControl.getSelected( 'Node' );
        if( selectedNodes.length === 1 && selectedNodes[0] === selectedNode ) {
            newGraphState.parentVisibilityCommand = 'Show';
            newGraphState.anchorState = selectedNode.isRoot();
        }

        affectedNodeList = _.difference( affectedNodeList, unconnectedItems );

        if( affectedNodeList && affectedNodeList.length > 0 ) {
            affectedNodeList = _.uniq( affectedNodeList );
            //fire graph node degree update event
            eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
                affectedNodeList: affectedNodeList
            } );
        }
    }
};

export let hideParentVisibilityHandler = function( graphModel, graphState ) {
    const newGraphState = { ...graphState.value };
    var graphControl = graphModel.graphControl;
    var groupedGraph = graphControl.groupGraph;
    var parent = null;

    var selectedNode = graphControl.getSelected( 'Node' );

    if( selectedNode && selectedNode.length === 1 ) {
        parent = groupedGraph.getParent( selectedNode[ 0 ] );

        hideParentNode( selectedNode[ 0 ], parent, graphModel, newGraphState );
    }
    graphState.update && graphState.update( newGraphState );
    return {
        actionState: {}
    };
};

/**
 * Toggle ON/OFF parent node visibility
 *
 * @param {Object} clickedGraphItem clicked graph item
 * @param {Object} graphModel graph model
 * @param {Object} graphState graph state
 * @returns {Object} action state
 */
export let toggleParentVisibilityHandler = function( clickedGraphItem, graphModel, graphState ) {
    const newGraphState = { ...graphState.value };
    if( clickedGraphItem && clickedGraphItem.getItemType() === 'Node' && clickedGraphItem.modelObject ) {
        var graphControl = graphModel.graphControl;
        var groupedGraph = graphControl.groupGraph;
        var parent = groupedGraph.getParent( clickedGraphItem );

        if( parent ) {
            hideParentNode( clickedGraphItem, parent, graphModel, newGraphState );
        } else {
            showParentNode( clickedGraphItem.modelObject );
        }
    }
    graphState.update && graphState.update( newGraphState );

    return {
        actionState: {}
    };
};

var showChildren = function( clickedGraphItem, graphModel ) {
    if( clickedGraphItem && clickedGraphItem.modelObject ) {
        var hiddenChildNodes = archNodeService.getHiddenChildNodes( clickedGraphItem, graphModel );
        if( hiddenChildNodes && hiddenChildNodes.length > 0 && hiddenChildNodes.length === clickedGraphItem.numChildren ) {
            var groupGraph = graphModel.graphControl.groupGraph;

            groupGraph.setExpanded( clickedGraphItem, true );
            architectureLayoutService.addGroupNodeToExpand( clickedGraphItem );

            eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
                affectedNodeList: [ clickedGraphItem ]
            } );
            architectureLayoutService.applyGraphLayout( graphModel, true /* Not used if later 2 are false */, false, false );

            //fire Diagram Model Change Event;
            eventBus.publish( 'AMDiagram.ModelChange' );
            eventBus.publish( 'occMgmt.visibilityStateChanged' );
        } else {
            eventBus.publish( 'AMManageDiagramEvent', {
                primaryObjects: [ clickedGraphItem.modelObject ],
                userAction: 'Expand.Group'
            } );
        }
    }
};

var hideChildren = function( clickedGraphItem, graphModel ) {
    var groupGraph = graphModel.graphControl.groupGraph;
    if( clickedGraphItem && groupGraph.isGroup( clickedGraphItem ) ) {
        if( !clickedGraphItem.isRoot() ) {
            clickedGraphItem.isRoot( true );
            graphModel.rootNodeList.push( clickedGraphItem.modelObject.uid );
            setRootStyle( clickedGraphItem );
        }

        // Reset anchor state for all children going to hide
        var childNodes = archNodeService.getChildNodes( clickedGraphItem, graphModel );
        if( childNodes && childNodes.length > 0 ) {
            archGraphSetUnsetAnchorService.unsetAnchorNodes( childNodes, graphModel );
        }

        groupGraph.setExpanded( clickedGraphItem, false );
        architectureLayoutService.addGroupNodesToCollapse( clickedGraphItem );
        architectureLayoutService.applyGraphLayout( graphModel, true /* Not used if later 2 are false */, false, false );

        eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
            affectedNodeList: [ clickedGraphItem ]
        } );

        //fire Diagram Model Change Event;
        eventBus.publish( 'AMDiagram.ModelChange' );

        eventBus.publish( 'occMgmt.visibilityStateChanged' );
    }
};

/**
 * Toggle ON/OFF all child nodes visibility
 *
 * @param {Object} clickedGraphItem clicked graph item
 * @param {Object} graphModel graph model
 * @returns {Object} action state
 */
export let toggleChildrenVisibilityHandler = function( clickedGraphItem, graphModel ) {
    if( clickedGraphItem && clickedGraphItem.getItemType() === 'Node' && clickedGraphItem.modelObject ) {
        var visibleChildNodes = archNodeService.getVisibleChildNodes( clickedGraphItem, graphModel );
        if( visibleChildNodes && visibleChildNodes.length > 0 ) {
            hideChildren( clickedGraphItem, graphModel );
        } else {
            showChildren( clickedGraphItem, graphModel );
        }

        // update the edge style as per node visibility
        checkVisibilityOfArrow( graphModel, clickedGraphItem );
    }

    return {
        actionState: {}
    };
};

var checkVisibilityOfArrow = function( graphModel, clickedGraphItem ) {
    var childnodes = graphModel.graphControl.groupGraph.getChildNodes( clickedGraphItem );
    if( childnodes ) {
        for( var i = 0; i < childnodes.length; i++ ) {
            var edges = childnodes[ i ].getEdges( 'IN' );
            for( var j = 0; j < edges.length; j++ ) {
                var edgestyle = edges[ j ].style;
                var sourcePort = edges[ j ].getSourcePort();

                if( sourcePort.isVisible() && edges[ j ].modelObject && cmm.isInstanceOf( 'Awb0Connection', edges[ j ].modelObject.modelType ) ) {
                    var targetNode = edges[ j ].getTargetNode();
                    if( !targetNode.isVisible() && edgestyle ) {
                        edgestyle.targetArrow = {
                            arrowShape: 'TRIANGLE',
                            fillInterior: true
                        };
                    } else {
                        delete edgestyle.targetArrow;
                    }
                    graphModel.graphControl.graph.setEdgeStyle( edges[ j ], edgestyle );
                }
            }
        }
    }
};

/**
 * Toggle ON/OFF child nodes visibility when in partial state
 *
 * @param {Object} clickedGraphItem clicked graph item
 * @param {Boolean} visible flag to show/hide
 * @param {Object} graphModel graph model
 * @returns {Object} action state
 */
export let toggleAllChildrenVisibilityHandler = function( clickedGraphItem, visible, graphModel ) {
    if( clickedGraphItem && clickedGraphItem.getItemType() === 'Node' && clickedGraphItem.modelObject ) {
        if( visible ) {
            showChildren( clickedGraphItem, graphModel );
        } else {
            hideChildren( clickedGraphItem, graphModel );
        }
    }

    return {
        actionState: {}
    };
};

var showRelations = function( selectedNode, action ) {
    if( selectedNode ) {
        eventBus.publish( 'AMManageDiagramEvent', {
            primaryObjects: [ selectedNode ],
            userAction: action
        } );
    }
};

var hideRelations = function( visibleEdges, graphModel ) {
    var unconnectedItems = [];
    _.forEach( visibleEdges, function( visibleEdge ) {
        if( visibleEdge && visibleEdge.category && visibleEdge.category.localeCompare( 'Structure' ) !== 0 ) {
            unconnectedItems.push( visibleEdge );
        }
    } );
    var unconnectedNodes = utilSvc.getUnconnectedItems( graphModel );
    unconnectedItems = unconnectedItems.concat( unconnectedNodes );

    if( unconnectedItems && unconnectedItems.length > 0 ) {
        unconnectedItems = _.uniq( unconnectedItems );
    }

    var elementsToRemove = _.map( unconnectedItems, 'modelObject' );

    if( elementsToRemove.length > 0 ) {
        var eventData = {
            elementsToRemove: elementsToRemove
        };
        eventBus.publish( 'AM.toggleOffEvent', eventData );
    }
};

/**
 * Toggle ON/OFF incoming or outgoing relations as per given direction
 *
 * @param {Object} clickedGraphItem clicked graph item
 * @param {String} direction 'IN'/'OUT'
 * @param {Object} graphModel graph model
 * @param {Object} activeLegendView active legend view
 * @returns {Object} action state
 */
export let toggleRelationsVisibilityHandler = function( clickedGraphItem, direction, graphModel, activeLegendView ) {
    if( clickedGraphItem && clickedGraphItem.getItemType() === 'Node' && clickedGraphItem.modelObject ) {
        var allRelations = null;
        if( direction === 'IN' ) {
            allRelations = archGraphLegendManager.getVisibleRelationTypes( clickedGraphItem.incomingRelations, activeLegendView ).length;
        }
        if( direction === 'OUT' ) {
            allRelations = archGraphLegendManager.getVisibleRelationTypes( clickedGraphItem.outgoingRelations, activeLegendView ).length;
        }
        var visibleRelations = archNodeService.getVisibleEdgesAtNode( clickedGraphItem, direction );
        if( allRelations > 0 && visibleRelations && visibleRelations.length === allRelations ) {
            hideRelations( visibleRelations, graphModel );
        } else {
            var key = 'Expand.OutRelations';
            if( direction === 'IN' ) {
                key = 'Expand.InRelations';
            }
            showRelations( clickedGraphItem.modelObject, key );
        }
    }

    return {
        actionState: {}
    };
};

/**
 * Toggle ON/OFF incoming or outgoing relations as per given direction when in partial state
 *
 * @param {Object} clickedGraphItem clicked graph item
 * @param {String} direction 'IN'/'OUT'
 * @param {Boolean} visible flag to show/hide
 * @param {Object} graphModel graph model
 * @returns {Object} action state
 */
export let toggleAllRelationsVisibilityHandler = function( clickedGraphItem, direction, visible, graphModel ) {
    if( clickedGraphItem && clickedGraphItem.getItemType() === 'Node' && clickedGraphItem.modelObject ) {
        if( visible ) {
            var key = 'Expand.OutRelations';
            if( direction === 'IN' ) {
                key = 'Expand.InRelations';
            }
            showRelations( clickedGraphItem.modelObject, key );
        } else {
            var visibleRelations = archNodeService.getVisibleEdgesAtNode( clickedGraphItem, direction );
            hideRelations( visibleRelations, graphModel );
        }
    }

    return {
        actionState: {}
    };
};

/*******************************************************************************************************************
 * convert To Parent
 * @param {Object} graphModel graph model
 * @param {Object} graphState Architecture graph state
 */
export let convertToParent = function( graphModel, graphState ) {
    const newGraphState = { ...graphState.value };
    if( graphModel && graphModel.graphControl ) {
        var graphControl = graphModel.graphControl;
        var selectedNodes = graphControl.getSelected( 'Node' );
        if( selectedNodes && selectedNodes.length === 1 ) {
            archNodeService.convertNodeToParent( graphModel, selectedNodes[ 0 ] );

            var groupGraph = graphControl.groupGraph;
            if( groupGraph.isGroup( selectedNodes[ 0 ] ) ) {
                newGraphState.isGroupSelectedNode = true;
            }
        }
    }
    graphState.update( newGraphState );
};
/*******************************************************************************************************************
 *
 * clears the graph
 * @param {Object} archGraphModel the architecture graph model object
 * @param {Object} graphModel graph model
 */
function clearGraph( archGraphModel, graphModel ) {
    archGraphModel.isGraphFitted = false;
    graphModel.rootNodeList = [];
    archDataCache.clearDataCache();
    graphModel.clearGraph();
    const layout = graphModel.graphControl.layout;
    if( layout ) {
        layout.deactivate();
    }
}

/*******************************************************************************************************************
 *
 * function to clear the graph item except the selected Node(s) and Set the selected node(s) as Root.
 * @param {ObjectArray} selectedNodes the array of selected nodes in graph
 * @param {Object} graphModel graph model
 */
function clearAndSetSelectedNodes( selectedNodes, graphModel ) {
    var graphControl = graphModel.graphControl;
    var groupGraph = graphControl.groupGraph;
    var anchorElementsUid = [];

    graphModel.rootNodeList = [];

    // remove selected Nodes from Visible Nodes
    _.forEach( selectedNodes, function( selectedNode ) {
        //Set the Selected Node As root
        selectedNode.isRoot( true );
        graphModel.rootNodeList.push( selectedNode.modelObject.uid );
        setRootStyle( selectedNode );
        anchorElementsUid.push( selectedNode.modelObject.uid );
    } );

    // get object with list of nodes to keep on graph and list of nodes without parent
    var nodesListObj = getAllNodesToKeepOnGraph( selectedNodes, graphModel );
    var nodesToKeepOnGraph = nodesListObj.allNodesToKeepInGraph;
    var nodesWithoutParent = nodesListObj.nodesWithoutParent;

    // Remove nodesToRemove from nodesToCheckForNormal
    var nodesToRemove = _.difference( graphControl.graph.getNodes(), nodesToKeepOnGraph );

    // get the current Anchored Node and set its root property to false
    _.forEach( nodesToRemove, function( node ) {
        if( node.isRoot() ) {
            node.isRoot( false );
        }
    } );

    // set parent as null for nodes that are not going to have parent node
    graphControl.groupGraph.setParent( null, nodesWithoutParent );

    //remove the visible nodes from graph
    var removedItems = graphControl.graph.removeItems( nodesToRemove, true );

    // Remove nodesToRemove from NodesToFitAncestors
    _.forEach( removedItems.nodes, function( node ) {
        architectureLayoutService.removeNodeToFitAncestors( node );
        architectureLayoutService.addNodeToBeRemoved( node );
    } );

    if( removedItems.edges && removedItems.edges.length > 0 ) {
        architectureLayoutService.addEdgeToBeRemoved( removedItems.edges );
    }

    if( removedItems.ports && removedItems.ports.length > 0 ) {
        architectureLayoutService.addPortToBeRemoved( removedItems.ports );
    }

    if( nodesToKeepOnGraph && nodesToKeepOnGraph.length > 0 ) {
        //fire graph node degree update event
        eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
            affectedNodeList: nodesToKeepOnGraph
        } );
    }

    _.forEach( selectedNodes, function( node ) {
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
                graphControl.graph.setNodeStyle( node, nodeStyle, bindData );
                groupGraph.setExpanded( node, false );
                groupGraph.setAsLeaf( node );
                graphControl.graph.setBounds( node, node.getResizeMinimumSize() );
                architectureLayoutService.addNodeToBecomeNormal( node );
            }
        }
    } );

    architectureLayoutService.applyGraphLayout( graphModel, true /* Not used if later 2 are false */, false, false );

    var visibleEdgesOnGraph = graphControl.graph.getVisibleEdges();
    var visiblePortsOnGraph = graphControl.graph.getVisiblePorts();
    var remainingElementsOnGraph = _.clone( nodesToKeepOnGraph );

    //get visible Ports And Add them to remainingElementsOnGraph
    if( visiblePortsOnGraph && visiblePortsOnGraph.length > 0 ) {
        remainingElementsOnGraph = remainingElementsOnGraph.concat( visiblePortsOnGraph );
    }
    // get Visible Edge Models And and them to remainingElementsOnGraph
    if( visibleEdgesOnGraph && visibleEdgesOnGraph.length > 0 ) {
        remainingElementsOnGraph = remainingElementsOnGraph.concat( visibleEdgesOnGraph );
    }
    var selectedModelObjects = getModelObjects( remainingElementsOnGraph );
    // then clear and draw graph(by calling ManangeDiagram2
    var inputDataList = [];
    var clearDataInput = {
        userAction: 'ClearDiagram',
        skipEvent: true
    };

    inputDataList.push( clearDataInput );

    var addToDiagInput = {
        userAction: 'AddToDiagram',
        elementsToAdd: selectedModelObjects,
        anchorElements: anchorElementsUid,
        skipVisibleObjects: true
    };

    inputDataList.push( addToDiagInput );
    eventBus.publish( 'AMManageDiagramEvent', inputDataList );
}
/*******************************************************************************************************************
 *
 * find the list of a nodes those keeps on graph and list of nodes without parent
 * @param {ObjectArray} nodeList the array of visible nodes
 * @param {Object} graphModel graph model
 * @returns {Object} nodeListObj
 */
function getAllNodesToKeepOnGraph( nodeList, graphModel ) {
    var allNodesToKeepInGraph = _.clone( nodeList );
    var nodesWithoutParent = [];
    var hierarchicalNodes = null;
    var parent = null;
    if( graphModel && graphModel.graphControl && graphModel.graphControl.groupGraph ) {
        let graphControl = graphModel.graphControl;
        _.forEach( nodeList, function( node ) {
            hierarchicalNodes = [];
            parent = graphControl.groupGraph.getParent( node );
            while( parent ) {
                //check parent in selected Nodes
                var index = _.indexOf( allNodesToKeepInGraph, parent );
                if( index !== -1 ) {
                    if( hierarchicalNodes.length > 0 ) {
                        allNodesToKeepInGraph = allNodesToKeepInGraph.concat( hierarchicalNodes );
                    }
                    break;
                }

                hierarchicalNodes.push( parent );
                parent = graphControl.groupGraph.getParent( parent );
            }

            if( !parent ) {
                nodesWithoutParent.push( node );
            }
        } );
    }

    return {
        allNodesToKeepInGraph: allNodesToKeepInGraph,
        nodesWithoutParent: nodesWithoutParent
    };
}
/*******************************************************************************************************************
 *
 * return Model Object
 * @param {ObjectArray} objects the array of nodes to get Model Object
 * @returns {ObjectArray} the array of Model Objects of input nodes
 */
var getModelObjects = function( objects ) {
    var modelObjects = [];
    if( Array.isArray( objects ) ) {
        _.forEach( objects, function( obj ) {
            modelObjects.push( obj.modelObject );
        } );
    } else {
        modelObjects.push( objects.modelObject );
    }
    return modelObjects;
};
var setRootStyle = function( nodeItem ) {
    nodeItem.getSVG().bindNewValues( 'isRoot' );
};

var isAllEdgesReady = function( node, activeLegendView ) {
    var result = false;
    var visibleInRelations = 0;
    var visibleOutRelations = 0;
    var allVisibleInRelations = archGraphLegendManager.getVisibleRelationTypes( node.incomingRelations, activeLegendView ).length;
    var allVisibleOutRelations = archGraphLegendManager.getVisibleRelationTypes( node.outgoingRelations, activeLegendView ).length;
    if( allVisibleInRelations ) {
        visibleInRelations = archNodeService.getVisibleEdgesAtNode( node, 'IN' ).length;
    }
    if( allVisibleOutRelations ) {
        visibleOutRelations = archNodeService.getVisibleEdgesAtNode( node, 'OUT' ).length;
    }
    result = allVisibleInRelations === visibleInRelations && allVisibleOutRelations === visibleOutRelations;
    return result;
};

/*******************************************************************************************************************
 * Expand Relations 1 Level
 * @param {Object} graphModel graph model
 * @param {Object} activeLegendView active legend view
 */
export let expandAllRelationsVisibilityHandler = function( graphModel, activeLegendView ) {
    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        var nodesToExpand = [];
        var selectedNodes = graphControl.getSelected( 'Node' );

        if( selectedNodes && selectedNodes.length > 0 ) {
            nodesToExpand = selectedNodes;
        } else {
            var visibleNodesOnGraph = graphControl.graph.getVisibleNodes();
            if( visibleNodesOnGraph && visibleNodesOnGraph.length > 0 ) {
                nodesToExpand = visibleNodesOnGraph;
            }
        }
        if( nodesToExpand && nodesToExpand.length > 0 ) {
            var nodeObjectsToExpand = [];
            _.forEach( nodesToExpand, function( node ) {
                if( node.modelObject && !isAllEdgesReady( node, activeLegendView ) ) {
                    nodeObjectsToExpand.push( node.modelObject );
                }
            } );

            if( nodeObjectsToExpand.length > 0 ) {
                eventBus.publish( 'AMManageDiagramEvent', {
                    primaryObjects: nodeObjectsToExpand,
                    userAction: 'Expand.All'
                } );
            }
        }
    }
};

const exports = {
    handleClearDiagram,
    fitGraphVisibility,
    fitSelectedDiagram,
    selectedOnlyInDiagram,
    selectedOnVisibilityHandler,
    selectedOffInDiagram,
    showParentVisibilityHandler,
    hideParentVisibilityHandler,
    toggleParentVisibilityHandler,
    toggleChildrenVisibilityHandler,
    toggleAllChildrenVisibilityHandler,
    toggleRelationsVisibilityHandler,
    toggleAllRelationsVisibilityHandler,
    convertToParent,
    expandAllRelationsVisibilityHandler
};
export default exports;
