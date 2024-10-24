// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitectureEdgeService
 */
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import archDataCache from 'js/Ase0ArchitectureDataCache';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import clientMetaModel from 'soa/kernel/clientMetaModel';
import labelService from 'js/Ase0ArchitectureLabelService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import graphLegendSvc from 'js/graphLegendService';
import templateService from 'js/Ase0ArchitectureGraphTemplateService';
import cdm from 'soa/kernel/clientDataModel';

/*
 * method to process edgeData from manageDiagram2 SOA response and draw the edges in graph
 */
export let processEdgeData = function( activeLegendView, graphModel, graphData, isRecallCase, graphState ) {
    var returnData = {
        structureEdges: []
    };
    var addedEdges = [];
    var isKeepPosition = true;
    if( graphData && graphData.output ) {
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;

        _.forEach( graphData.output, function( output ) {
            //TODO: edgedata should have the endelement information against id
            //eg. id:[{},{}]
            _.forEach( output.edgeData,
                function( edgeInformation ) {
                    let edge;
                    let edgeModel;
                    let edgeModelObj;
                    var isConnection = false;
                    var uidToCheck;
                    var underlyingObject;
                    if( edgeInformation.edge ) {
                        edgeModelObj = cdm.getObject( edgeInformation.edge.uid );
                        if( edgeModelObj ) {
                            isConnection = clientMetaModel.isInstanceOf( 'Awb0Connection', edgeModelObj.modelType );
                            if( !isConnection ) {
                                underlyingObject = edgeModelObj;
                                if( edgeInformation.end1Element.uid && edgeInformation.end2Element.uid ) {
                                    var end1ElementUid = edgeInformation.end1Element.uid;
                                    var end2ElementUid = edgeInformation.end2Element.uid;
                                    uidToCheck = edgeInformation.edge.uid + '+' + end1ElementUid + '+' + end2ElementUid;
                                }
                            } else {
                                uidToCheck = edgeInformation.edge.uid;
                                var underlyingObjUid = edgeModelObj.props.awb0UnderlyingObject.dbValues[ 0 ];
                                underlyingObject = cdm.getObject( underlyingObjUid );
                            }
                            edgeModel = graphModel.dataModel.edgeModels[ uidToCheck ];
                        }
                    }

                    edge = edgeModel?.graphItem;
                    if( !edge ) {
                        let sourceNodeModel;
                        let targetNodeModel;
                        let sourcePortModel;
                        let targetPortModel;
                        let edgeType;

                        if( isConnection ) {
                            sourcePortModel = graphModel.dataModel.portModels[ edgeInformation.end1Element.uid ];
                            targetPortModel = graphModel.dataModel.portModels[ edgeInformation.end2Element.uid ];
                        } else {
                            sourceNodeModel = graphModel.dataModel.nodeModels[ edgeInformation.end1Element.uid ];
                            targetNodeModel = graphModel.dataModel.nodeModels[ edgeInformation.end2Element.uid ];
                        }

                        var edgeStyle;
                        var edgeScopeFilter;
                        if( edgeInformation.edgeInfo.scopeFilter ) {
                            edgeScopeFilter = edgeInformation.edgeInfo.scopeFilter[ 0 ];
                        }

                        var edgeCategory;
                        if( underlyingObject ) {
                            edgeType = underlyingObject.type;
                            edgeCategory = archGraphLegendManager.getCategoryType(
                                edgeType, edgeScopeFilter, activeLegendView );
                        }
                        //get edge style from graph legend
                        if( !edgeCategory || edgeCategory && edgeCategory.localeCompare( '' ) === 0 ) {
                            edgeCategory = 'Structure';
                        }

                        edgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory,
                            activeLegendView );

                        if( sourcePortModel && targetPortModel ) {
                            edge = createEdgeWithStyleWithPorts( graph, sourcePortModel.graphItem, targetPortModel.graphItem, edgeStyle, edgeInformation );
                        } else if( sourceNodeModel && targetNodeModel ) {
                            if( edgeCategory && ( edgeCategory.localeCompare( 'Structure' ) === 0 ||
                                    edgeCategory.localeCompare( '' ) === 0 ) ) {
                                var returnEdgeData = processParentChildRelation( sourceNodeModel.graphItem, targetNodeModel.graphItem, graphModel, isRecallCase, edgeStyle, edgeInformation.edgeInfo );
                                if( returnEdgeData.structureEdge ) {
                                    edge = returnEdgeData.structureEdge;
                                    isKeepPosition = isKeepPosition && returnEdgeData.isKeepPosition;
                                }
                            } else {
                                edge = graph.createEdgeWithNodesStyleAndTag( sourceNodeModel.graphItem, targetNodeModel.graphItem, edgeStyle,
                                    null );
                            }
                        }

                        if( edge ) {
                            var hasPosition = setEdgePosition( graph, edgeInformation.edgeInfo, edge );
                            isKeepPosition = isKeepPosition && hasPosition;
                            edge.category = edgeCategory;
                            edge.modelObject = edgeModelObj;
                            edge.edgeType = edgeType;
                            edge.appData = {
                                edgeUid: uidToCheck
                            };
                            edgeModel = {
                                id: uidToCheck,
                                modelObject: edgeModelObj,
                                category: edgeCategory
                            };
                            graphModel.addEdgeModel( edge, edgeModel );
                            setEdgeLabel( graph, edgeInformation.edgeInfo, edgeCategory, edge, graphState );

                            if( !isRecallCase ) {
                                architectureLayoutService.addEdgeToBeAdded( edge );
                            }
                            // record all added edges
                            addedEdges.push( edge );
                        }
                    } else {
                        if( !edge.isVisible() ) {
                            graph.setVisible( [ edge ], true );
                            // We will not have this situation for open diagram case
                            architectureLayoutService.addEdgeToBeAdded( edge );
                        }
                    }
                } );
        } );
        archDataCache.addEdgeCache( graphData.output );
    }
    returnData.addedEdges = addedEdges;
    returnData.isKeepPosition = isKeepPosition;
    return returnData;
};

var setEdgeIndicatorStyle = function( edgeStyle, edgeInformation ) {
    if( edgeStyle && edgeInformation.edgeInfo ) {
        if( edgeInformation.edgeInfo.showIndicator && edgeInformation.edgeInfo.showIndicator.length > 0 ) {
            if( edgeInformation.edgeInfo.showIndicator[ 0 ] === '1' ) {
                edgeStyle.indicator = {
                    strokesWidth: 1,
                    strokesColor: 'rgb(255,255,0)',
                    fillColor: 'rgb(0,128,0)',
                    scale: 0.4,
                    position: 0.4
                };
            }
        }
    }
};

/**
 * Updates the edge style for the source port
 *
 * @param {object} graph graph
 * @param {object} sourcePort source port
 * @param {object} targetPort target port
 * @param {object} edgeStyle edge style
 * @param {object} edgeInformation edgeInformation
 * @returns {object} edgeObject.
 */
var createEdgeWithStyleWithPorts = function( graph, sourcePort, targetPort, edgeStyle, edgeInformation ) {
    var edgeStyleClone = _.clone( edgeStyle );
    if( sourcePort.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Output' ) {
        if( edgeStyleClone.sourceArrow ) {
            delete edgeStyleClone.sourceArrow;
        }
    }
    setEdgeIndicatorStyle( edgeStyleClone, edgeInformation );
    return graph.createEdgeWithPortsStyleAndTag( sourcePort, targetPort, edgeStyleClone, null );
};

/**
 * Set position for edge in graph
 *
 * @param {Object} graph the graph object
 * @param {Object} edgeInfo the edge information object containing edge position
 * @param {Object} edge the edge object from graph
 * @returns {Boolean} TRUE if the position information was present.
 */
var setEdgePosition = function( graph, edgeInfo, edge ) {
    var isKeepPosition = true;
    if( !graph || !edgeInfo || !edge ) {
        return isKeepPosition;
    }
    var edgePosition = [];
    if( edgeInfo.positionalInfo && edgeInfo.positionalInfo.length > 0 ) {
        var positions = edgeInfo.positionalInfo[ 0 ].split( ':' );
        for( var i = 0; i < positions.length && i + 1 < positions.length; i += 2 ) {
            var pt = new window.SDF.Utils.Point( Number( positions[ i ] ),
                Number( positions[ i + 1 ] ) );
            edgePosition.push( pt );
        }
    }
    if( edgePosition.length > 0 ) {
        graph.setEdgePosition( edge, edgePosition );
    } else {
        isKeepPosition = false;
    }
    return isKeepPosition;
};

/**
 * Set label with position for edge in graph
 *
 * @param {Object} graph the graph object
 * @param {Object} edgeInfo the edge information object containing label text and position
 * @param {Object} edgeCategory the internal name of the category of edge
 * @param {Object} edge the edge object from graph
 * @param {Object} graphState graph state
 */
var setEdgeLabel = function( graph, edgeInfo, edgeCategory, edge, graphState ) {
    if( !graph || !edgeInfo || !edge ) {
        return;
    }
    //TODO: manageDiagram3: Createconnection should also return
    // edgeLabel information for connection
    var labelPosition = null;
    if( edgeInfo.labelPositionalInfo && edgeInfo.labelPositionalInfo.length > 0 ) {
        var positions = edgeInfo.labelPositionalInfo[ 0 ].split( ':' );
        if( positions.length === 2 ) {
            labelPosition = {
                x: Number( positions[ 0 ] ),
                y: Number( positions[ 1 ] )
            };
        }
    }
    var isLabelVisible = _.get( edgeInfo, 'labelVisible[0]' ) === '1';

    if( !isLabelVisible && graphState && graphState.labelCategories ) {
        var labelCategories = graphState.labelCategories;
        _.forEach( labelCategories, function( labelCategory ) {
            if( labelCategory.internalName === edgeCategory && labelCategory.categoryState ) {
                isLabelVisible = true;
                return false;
            }
        } );
    }

    if( labelPosition ) {
        edge.labelPosition = labelPosition;
    }

    if( isLabelVisible ) {
        var label = _.get( edgeInfo, 'edgeInfo.edgeLabel[0]' );
        if( !label && edge.modelObject ) {
            var propPath = 'modelObject.props.' +
                labelService.getPropertyName( edge.modelObject ) + '.uiValues[0]';
            label = _.get( edge, propPath );
        }
        graph.setLabel( edge, label );
        var edgeLabel = edge.getLabel();
        edgeLabel.setVisible( true );
        if( labelPosition ) {
            edgeLabel.setPosition( labelPosition );
        }
    }
};

/**
 * Establish parent-child relation in graph
 *
 * @param {Object} sourceNode the source node of the parent-child relation
 * @param {Object} targetNode the target node of the parent-child relation
 * @param {Object} graphModel the graph model object
 * @param {Boolean} isRecallCase the flag to indicate if this is recall case or not.
 * @param {Object} edgeStyle the style to use for creating parent-child relation in network mode.
 * @param {Object} edgeInfo the edge information object containing edge details like position and label.
 * @returns {Object} the object containing added structure edge and flag indicating to keep graph items position or not.
 */
function processParentChildRelation( sourceNode, targetNode, graphModel, isRecallCase, edgeStyle, edgeInfo ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var edge;
    var returnData = {};
    var isKeepPosition = true;

    if( !isRecallCase ) {
        var layout = graphModel.graphControl.layout;
        var isSourceVisible = false;
        var isTargetVisible = false;

        if( layout && layout.isActive() && layout.type === 'IncUpdateLayout' ) {
            if( layout.containsNode( sourceNode ) ) {
                isSourceVisible = true;
            }
            if( layout.containsNode( targetNode ) ) {
                isTargetVisible = true;
            }
        }

        // Update Layout service lists
        if( !isSourceVisible ) {
            architectureLayoutService.addGroupToBeAdded( sourceNode );
            groupGraph.setExpanded( sourceNode, true );
            architectureLayoutService.removeNodeToBeAdded( sourceNode );
            architectureLayoutService.removeNodeToBeAddedWithPosition( sourceNode );
        } else if( isSourceVisible && !isTargetVisible ) {
            if( !groupGraph.isGroup( sourceNode ) ) {
                architectureLayoutService.addNodeToBecomeGroup( sourceNode );
                groupGraph.setExpanded( sourceNode, true );
                architectureLayoutService.removeNodeToBeAdded( sourceNode );
                architectureLayoutService.removeNodeToBeAddedWithPosition( sourceNode );
            } else if( !groupGraph.isExpanded( sourceNode ) ) {
                architectureLayoutService.addGroupNodeToExpand( sourceNode );
                groupGraph.setExpanded( sourceNode, true );
            } else {
                architectureLayoutService.addGroupNodeToExpandAndLayout( sourceNode );
            }
        } else {
            // Both source and target visibile but source is collapsed.
            if( groupGraph.isGroup( sourceNode ) && !groupGraph.isExpanded( sourceNode ) ) {
                architectureLayoutService.addGroupNodeToExpand( sourceNode );
                groupGraph.setExpanded( sourceNode, true );

                eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
                    affectedNodeList: [ sourceNode ]
                } );
            }
        }
    }

    if( !groupGraph.isGroup( sourceNode ) ) {
        var props = templateService
            .getBindPropertyNames( sourceNode.modelObject );
        var nodeStyle = templateService.getNodeTemplate( graphModel.nodeTemplates,
            props, true );
        var bindData = {};
        bindData.HEADER_HEIGHT = nodeStyle.initialBindData.HEADER_HEIGHT;
        if( !graph.isNetworkMode() ) {
            if( isRecallCase ) {
                var nodeRect = graph.getBounds( sourceNode );
                if( nodeRect.height < 312 ) {
                    isKeepPosition = false;
                }
            } else {
                bindData.HEADER_HEIGHT = sourceNode.getHeight();
            }
        }

        graph.setNodeStyle( sourceNode, nodeStyle, bindData );

        groupGraph.setAsGroup( sourceNode );
        sourceNode.setGroupingAllowed( true );
    }
    if( sourceNode !== groupGraph.getParent( targetNode ) ) {
        groupGraph.setParent( sourceNode, [ targetNode ] );
    }

    //the group node is in group display by default, it can be switched to network display
    sourceNode.isNestedDisplay = !graph.isNetworkMode();
    if( graph.isNetworkMode() ) {
        var edges = targetNode.getEdges();
        var validEdges = null;
        if( edges && edges.length > 0 ) {
            var validEdges = _.filter( edges, function( currentEdge ) {
                return currentEdge.category === 'Structure' && currentEdge.getSourceNode() && currentEdge.getSourceNode() === sourceNode;
            } );
        }
        if( validEdges === null || validEdges.length === 0 ) {
            edge = graph.createEdgeWithNodesStyleAndTag( sourceNode, targetNode, edgeStyle, null );
            edge.category = 'Structure';
            if( isRecallCase ) {
                var hasPosition = setEdgePosition( graph, edgeInfo, edge );
                isKeepPosition = isKeepPosition && hasPosition;
            }
        }
    }

    returnData.structureEdge = edge;
    returnData.isKeepPosition = isKeepPosition;
    return returnData;
}

/**
 * update the edge style if ports are visible
 *
 * @param {Object} graphModel graph model
 * @param {Object} activeLegendView active legend view
 */
export let updateEdgeStyle = function( graphModel, activeLegendView ) {
    let graph = graphModel.graphControl.graph;

    var edgeStyle;
    var edges = graph.getEdges();
    for( var i = 0; i < edges.length; i++ ) {
        if( edges[ i ].modelObject && clientMetaModel.isInstanceOf( 'Awb0Connection', edges[ i ].modelObject.modelType ) ) {
            //get edge style from graph legend
            var edgeCategory = edges[ i ].category;
            edgeStyle = _.clone( graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory, activeLegendView ) );

            var sourcePort = edges[ i ].getSourcePort();
            var targetNode = edges[ i ].getTargetNode();
            if( !sourcePort.isFiltered() ) {
                if( edgeStyle.sourceArrow ) {
                    delete edgeStyle.sourceArrow;
                }
                if( edgeStyle.targetArrow && targetNode.isVisible() ) {
                    delete edgeStyle.targetArrow;
                }
            } else if( sourcePort.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Output' ) {
                if( edgeStyle.sourceArrow ) {
                    delete edgeStyle.sourceArrow;
                }
            }
            graph.setEdgeStyle( edges[ i ], edgeStyle );
        }
    }
};

const exports = {
    processEdgeData,
    updateEdgeStyle
};
export default exports;
