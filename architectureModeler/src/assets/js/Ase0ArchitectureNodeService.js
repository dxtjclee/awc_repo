// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitectureNodeService
 */
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import archDataCache from 'js/Ase0ArchitectureDataCache';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import declUtils from 'js/declUtils';
import templateService from 'js/Ase0ArchitectureGraphTemplateService';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';

var MIN_NODE_SIZE = [ 312, 120 ];

/*
 * method to process nodeData from manageDiagram2 SOA response and draw the nodes in graph
 */
export let processNodeData = function( activeLegendView, graphModel, graphData, data, isRecallCase ) {
    var returnData = {};
    var addedNodes = [];
    var isKeepPosition = true;
    if( graphData && graphData.output ) {
        var nodesInfo = getGraphNodeData( graphData.output, activeLegendView );
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;

        _.forEach( nodesInfo.nodes, function( nodeData ) {
            let nodeModel = graphModel.dataModel.nodeModels[ nodeData.id ];

            //Node data to be bind in SVG template
            if( !nodeModel ) {
                var nodeObject = cdm.getObject( nodeData.id );

                if( nodeData.displayProps.length > 0 && nodeObject && nodeObject.modelType && !nodeObject.props.awp0CellProperties ) {
                    var nodeCellPropertyDescriptor = nodeObject.modelType.propertyDescriptorsMap.awp0CellProperties;
                    nodeObject.props.awp0CellProperties = {
                        uiValues: nodeData.displayProps,
                        dbValues: nodeData.displayProps,
                        propertyDescriptor: nodeCellPropertyDescriptor
                    };
                }
                if( !nodeData.hasPosition ) {
                    isKeepPosition = false;
                }

                var scopeFilter;
                var underlyingObjUid = nodeObject.props.awb0UnderlyingObject.dbValues[ 0 ];
                var nodeCategory = archGraphLegendManager.getCategoryTypeFromObjectUid( underlyingObjUid,
                    scopeFilter, activeLegendView );

                nodeData.props.StyleTag = nodeCategory;
                var props = templateService.getBindPropertyNames( nodeObject );
                var template = templateService.getNodeTemplate( graphModel.nodeTemplates, props, false );
                if( !template ) {
                    logger
                        .error( 'Failed to get SVG template for node object. Skip drawing the node. Object UID: ' +
                            nodeObject.uid );
                    return;
                }

                var bindData = templateService.getBindProperties( nodeObject, props, data, nodeData.typeHierarchy );
                //get node style from graph legend
                var nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, activeLegendView );
                if( nodeStyle ) {
                    bindData.node_fill_color = nodeStyle.borderColor;
                }

                if( data.nodeOpacityPropName && !nodeObject.props[ data.nodeOpacityPropName ] && nodeData.isOpaque ) {
                    nodeObject.props[ data.nodeOpacityPropName ] = {
                        dbValues: nodeData.isOpaque
                    };
                }
                //fill node command binding data
                if( graphModel.nodeCommandBindData ) {
                    declUtils.consolidateObjects( bindData, graphModel.nodeCommandBindData );
                }

                const node = graph.createNodeWithBoundsStyleAndTag( nodeData.position, template, bindData );
                node.setMinNodeSize( MIN_NODE_SIZE );
                node.appData = {
                    category: nodeCategory
                };
                node.modelObject = nodeObject;
                node.portDegree = nodeData.portDegree;
                node.isRoot( nodeData.isAnchor );
                node.hasDanglingConnection = nodeData.hasDanglingConnection;
                node.connectionType = nodeData.connectionType;
                addedNodes.push( node );
                if( !isRecallCase ) {
                    if( nodeData.hasPosition ) {
                        architectureLayoutService.addNodeToBeAddedWithPosition( node );
                    } else {
                        architectureLayoutService.addNodeToBeAdded( node );
                    }
                }

                // for node commands
                node.incomingRelations = nodeData.incomingRelations;
                node.outgoingRelations = nodeData.outgoingRelations;
                node.hasParent = nodeData.hasParent;
                node.numChildren = nodeData.numChildren;
                node.nodeType = nodeData.nodeType;

                const nodeModel = {
                    id: nodeData.id,
                    modelObject: nodeObject,
                    category: nodeCategory
                };

                //build node map to help create edges
                graphModel.addNodeModel( node, nodeModel );
            } else {
                const node = nodeModel.graphItem;
                if( !node.isVisible() ) {
                    graph.setVisible( [ node ], true );
                    // We will not have this situation for open diagram case
                    architectureLayoutService.addNodeToBeAddedWithPosition( node );
                }
                node.incomingRelations = nodeData.incomingRelations;
                node.outgoingRelations = nodeData.outgoingRelations;
                node.hasParent = nodeData.hasParent;
                node.numChildren = nodeData.numChildren;
            }
        } );
        archDataCache.addNodeCache( graphData.output );
    }
    returnData.addedNodes = addedNodes;
    returnData.isKeepPosition = isKeepPosition;
    return returnData;
};

/**
 * Update the node cell properties if it's changed
 * @param {Object} nodesToUpdate nodes
 * @param {Object} graphModel graph Model
 * @param {Object} data data object
 */
export let updateNodeProperties = function( nodesToUpdate, graphModel, data ) {
    var updateNodes = {};
    var graphControl = graphModel.graphControl;
    _.forEach( nodesToUpdate, function( node ) {
        var modelObject = node.modelObject;
        var props = templateService.getBindPropertyNames( modelObject );
        var objectBindData = templateService.getBindProperties( modelObject, props, data );

        var properties = {};
        _.forEach( props, function( prop ) {
            var bindData = node.getAppObj();
            var bindValue = bindData[ prop ];
            if( bindValue && objectBindData[ prop ] !== bindValue ) {
                properties[ prop ] = objectBindData[ prop ];
            }
        } );
        if( Object.keys( properties ).length > 0 ) {
            updateNodes[ node.modelObject.uid ] = properties;
        }
    } );
    if( Object.keys( updateNodes ).length > 0 ) {
        graphControl.graph.update( function() {
            _.forEach( updateNodes, function( value, key ) {
                const nodeModel = graphModel.dataModel.nodeModels[ key ];
                graphControl.graph.updateNodeBinding( nodeModel.graphItem, value );
            } );
        } );
    }
};

/**
 * nodes: nodes in open diagram
 *
 * @param {Object} outputList output list
 * @param {Object} legendData legend data
 * @return {Object} graph node data
 */
function getGraphNodeData( outputList, legendData ) {
    var nodesInfo = {
        nodes: []
    };
    _.forEach( outputList, function( output ) {
        _.forEach( output.nodeData, function( nodeInformation ) {
            var node = {
                id: '',
                props: {
                    StyleTag: ''
                },
                position: {},
                portDegree: [],
                displayProps: [],
                isAnchor: false,
                hasPosition: false,
                isOpaque: [],
                hasParent: false,
                numChildren: 0,
                outgoingRelations: [],
                incomingRelations: [],
                nodeType: ''
            };
            node.id = nodeInformation.node.uid;
            node.typeHierarchy = nodeInformation.nodeInfo.nodeType;
            node.isAnchor = nodeInformation.nodeInfo.isAnchor && nodeInformation.nodeInfo.isAnchor[ 0 ] === '1';
            node.isOpaque = nodeInformation.nodeInfo.isOpaque;
            if( nodeInformation.nodeInfo.positionalInfo.length > 0 ) {
                var positions = nodeInformation.nodeInfo.positionalInfo[ 0 ].split( ':' );
                if( positions.length > 1 ) {
                    node.position.x = Number( positions[ 0 ] );
                    node.position.y = Number( positions[ 1 ] );
                    if( positions.length > 3 ) {
                        node.position.width = Number( positions[ 2 ] );
                        node.position.height = Number( positions[ 3 ] );
                    }
                    node.hasPosition = true;
                }
            }

            _.forEach( nodeInformation.nodeInfo.interfaceTypes, function( portType ) {
                var scopeFilter;
                var category = archGraphLegendManager.getCategoryType( portType, scopeFilter, legendData );
                node.portDegree.push( category );
            } );

            if( nodeInformation.nodeInfo.displayProperties.length > 0 ) {
                node.displayProps = nodeInformation.nodeInfo.displayProperties;
            }

            node.hasDanglingConnection = false;
            node.connectionType = null;
            if( nodeInformation.nodeInfo.danglingConnectionTypes && nodeInformation.nodeInfo.danglingConnectionTypes.length > 0 ) {
                node.hasDanglingConnection = true;
                node.connectionType = nodeInformation.nodeInfo.danglingConnectionTypes[ 0 ];
            }

            node.hasParent = nodeInformation.nodeInfo.hasParent && nodeInformation.nodeInfo.hasParent[ 0 ] === '1';
            node.numChildren = Number( _.get( nodeInformation, 'node.props.awb0NumberOfChildren.dbValues[0]', '0' ) );
            node.incomingRelations = nodeInformation.nodeInfo.incomingConnectionTypes.concat( nodeInformation.nodeInfo.definingTraceLinkTypes );
            node.outgoingRelations = nodeInformation.nodeInfo.outgoingConnectionTypes.concat( nodeInformation.nodeInfo.complyingTraceLinkTypes );
            var underlyingObjectUid = _.get( nodeInformation.node, 'props.awb0UnderlyingObject.dbValues[0]', undefined );
            var underlyingObject = cdm.getObject( underlyingObjectUid );
            if( underlyingObject ) {
                node.nodeType = _.get( underlyingObject, 'type', undefined );
            }
            nodesInfo.nodes.push( node );
        } );
    } );

    return nodesInfo;
}

/*******************************************************************************************************************
 * Updates the node degrees of the Node on the graph with nodeInfo from the server
 * @param {Object} node node on the graph
 * @param {Object} nodeInformation node info fetched from the server
 * @param {Object} activeLegendView the active legend view
 */
export let updateNodeDegreesFromNodeInformation = function( node, nodeInformation, activeLegendView ) {
    if( activeLegendView ) {
        _.forEach( nodeInformation.nodeInfo.interfaceTypes, function( portType ) {
            var scopeFilter;
            var category = archGraphLegendManager.getCategoryType( portType, scopeFilter, activeLegendView );
            node.portDegree.push( category );
        } );
    }

    node.hasDanglingConnection = false;
    node.connectionType = null;
    if( nodeInformation.nodeInfo.danglingConnectionTypes && nodeInformation.nodeInfo.danglingConnectionTypes.length > 0 ) {
        node.hasDanglingConnection = true;
        node.connectionType = nodeInformation.nodeInfo.danglingConnectionTypes[ 0 ];
    }

    node.incomingRelations = nodeInformation.nodeInfo.incomingConnectionTypes.concat( nodeInformation.nodeInfo.definingTraceLinkTypes );
    node.outgoingRelations = nodeInformation.nodeInfo.outgoingConnectionTypes.concat( nodeInformation.nodeInfo.complyingTraceLinkTypes );
};

/*******************************************************************************************************************
 * converts normal node to Parent Node
 * @param {Object} graphModel graph model
 * @param {Object} selectedNode selected Node object
 */
export let convertNodeToParent = function( graphModel, selectedNode ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var nodeObject = selectedNode.modelObject;
    var nodeRect = graph.getBounds( selectedNode );
    if( graphModel && nodeObject ) {
        //update normal node to group node
        var props = templateService.getBindPropertyNames( nodeObject );
        var nodeTemplate = templateService.getNodeTemplate( graphModel.nodeTemplates, props, true );
        if( !nodeTemplate ) {
            logger.error( 'Failed to get SVG template for node object. Skip converting. Object UID: ' +
                nodeObject.uid );
            return;
        }
        var bindData = {
            HEADER_HEIGHT: nodeRect.height
        };

        graph.setNodeStyle( selectedNode, nodeTemplate, bindData );
        groupGraph.setAsGroup( selectedNode );
        nodeRect.height *= 2;
        graph.setBounds( selectedNode, nodeRect );
        graphControl.layout.convertToGroup( selectedNode );
    }
};

/**
 *update GC when node resized due to word wrap or manually resized
 *
 * @param {array} resizedNodes graph items
 * @param {object} graphControl instance of graph control
 */
var resizeElements = function( resizedNodes, graphControl ) {
    if( resizedNodes.length > 0 ) {
        var layout = graphControl.layout;
        if( layout && layout.isActive() ) {
            layout.applyUpdate( function() {
                _.forEach( resizedNodes, function( item ) {
                    var node;
                    if( item.node ) {
                        node = item.node;
                    } else {
                        node = item;
                    }
                    if( node && node.getItemType() === 'Node' ) {
                        layout.resizeNode( node, true );
                    }
                } );
            } );
        } else {
            var groupGraph = graphControl.groupGraph;
            var graph = graphControl.graph;
            _.forEach( resizedNodes, function( item ) {
                var node;
                if( item.node ) {
                    node = item.node;
                } else {
                    node = item;
                }
                if( node && groupGraph.isGroup( node ) && ( graph.isNetworkMode() || !groupGraph.isExpanded( node ) ) ) {
                    graphControl.updateHeaderHeight( node, node.getHeight() );
                }
            } );
        }
    }
};

/**
 * when node is resized manually in authoring mode
 *
 * @param {array} graphItems graph Item
 * @param {object} graphModel current instance of graph model
 */
export let graphItemResized = function( graphItems, graphModel ) {
    resizeElements( graphItems, graphModel.graphControl );
};

/**
 *update the size of the node based on the wrapped text height
 *
 * @param {object} graphModel graph model
 * @param {array} nodes array of nodes being added in graph
 */
export let setNodeHeightOnWrappedHeightChanged = function( graphModel, nodes ) {
    resizeElements( nodes, graphModel.graphControl );
};

/**
 * Get the visible edges for given node
 *
 * @param {node} node graph node
 * @param {direction} direction direction of edges
 * @return {visibleEdges} visible Edges
 */
export let getVisibleEdgesAtNode = function( node, direction ) {
    var visibleEdges = [];
    var ports = node.getPorts();
    if( ports && ports.length > 0 ) {
        _.forEach( ports, function( port ) {
            var actualDirection = 'BOTH';
            var portObject = null;
            if( port.modelObject ) {
                if( direction === 'BOTH' || port.modelObject.props.awb0Direction && (  ( port.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Input' || port.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Bidirectional' ) && direction === 'IN'  ||
                         ( port.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Output' || port.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Bidirectional' ) && direction === 'OUT'  ) ) {
                    actualDirection = 'BOTH';
                    portObject = port;
                }
            } else {
                actualDirection = direction;
                portObject = port;
            }

            if( portObject ) {
                var edges = portObject.getEdges( actualDirection );
                if( edges && edges.length > 0 ) {
                    _.forEach( edges, function( edge ) {
                        if( edge && edge.category && edge.category.localeCompare( 'Structure' ) !== 0 && edge.isVisible() && !edge.isFiltered() && _.indexOf( visibleEdges, edge ) === -1 ) {
                            visibleEdges.push( edge );
                        }
                    } );
                }
            }
        } );
    }
    return visibleEdges;
};

/**
 * Get all child nodes
 *
 * @param {node} node graph node
 * @param {graphModel} graphModel graph Model
 * @return {childNodes} child Nodes
 */
export let getChildNodes = function( node, graphModel ) {
    var groupedGraph = graphModel.graphControl.groupGraph;
    return groupedGraph.getChildNodes( node );
};

/**
 * Get all visible child nodes ignoring filtered out nodes
 *
 * @param {node} node graph node
 * @param {graphModel} graphModel graph Model
 * @return {visibleChildNodes} visible child Nodes
 */
export let getVisibleChildNodes = function( node, graphModel ) {
    var visibleChildNodes = [];
    var groupedGraph = graphModel.graphControl.groupGraph;
    var childNodes = groupedGraph.getChildNodes( node );
    if( childNodes && childNodes.length > 0 ) {
        visibleChildNodes = _.filter( childNodes, function( childNode ) {
            return !childNode.isFiltered() && childNode.isVisible();
        } );
    }
    return visibleChildNodes;
};

/**
 * Get all hidden child nodes which are visibled off in case of collapsed children
 *
 * @param {node} node graph node
 * @param {graphModel} graphModel graph Model
 * @return {hiddenChildNodes} hidden child Nodes
 */
export let getHiddenChildNodes = function( node, graphModel ) {
    var hiddenChildNodes = [];
    var groupedGraph = graphModel.graphControl.groupGraph;
    var childNodes = groupedGraph.getChildNodes( node );
    if( childNodes && childNodes.length > 0 ) {
        hiddenChildNodes = _.filter( childNodes, function( childNode ) {
            return !childNode.isFiltered() && !childNode.isVisible();
        } );
    }
    return hiddenChildNodes;
};

/**
 * Get all child nodes
 *
 * @param {object} node graph node
 * @return {array} all child Nodes
 */
export let getAllLevelChildNodes = function( node ) {
    return _.filter( node.getAllMembers(), function( item ) {
        return item instanceof window.SDF.Models.Node;
    } );
};

const exports = {
    processNodeData,
    updateNodeProperties,
    updateNodeDegreesFromNodeInformation,
    convertNodeToParent,
    graphItemResized,
    setNodeHeightOnWrappedHeightChanged,
    getVisibleEdgesAtNode,
    getChildNodes,
    getVisibleChildNodes,
    getHiddenChildNodes,
    getAllLevelChildNodes
};
export default exports;
