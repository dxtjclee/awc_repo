//@<COPYRIGHT>@
//==================================================
//Copyright 2018.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Interfaces tab graph service
 *
 * @module js/Ase1InterfacesGraphService
 */
import appCtxSvc from 'js/appCtxService';
import AwTimeoutService from 'js/awTimeoutService';
import layoutService from 'js/Ase1IntefacesGraphLayoutService';
import interfacesGraphLegendManager from 'js/Ase1InterfacesGraphLegendManager';
import interfacesUtilService from 'js/Ase1InterfacesUtilService';
import nodeService from 'js/Ase1IntefacesGraphNodeService';
import edgeService from 'js/Ase1InterfacesGraphEdgeService';
import _ from 'lodash';
import graphConstants from 'js/graphConstants';
import graphLegendSvc from 'js/graphLegendService';

var exports = {};

var _timeoutPromise;

var _hoveredItem;

/**
 * Default padding distance for boundary
 */
var DEFAULT_PADDING = 35;

/**
 * Default label margin
 */
var DEFAULT_MARGIN = 8;

/**
 * Binding class name for node
 */
export let NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';

/**
 * Node default style class
 */
const NODE_STYLE_CLASS = 'aw-widgets-cellListItemNode';

/**
 * Node selected style class
 */
const NODE_SELECTED_STYLE_CLASS = 'aw-widgets-cellListItemNodeSelected';

/**
 * System of Interest Node style class
 */
const SOI_NODE_LABEL_STYLE_CLASS = 'aw-graph-node-filter ';

/**
 * System of Interest Node Selected style class
 */
const SOI_NODE_LABEL_SELECTED_STYLE_CLASS = 'aw-graph-node-filter-selected ';

var systemContainsIn = function( modelObject, systems ) {
    var isValidSystem = false;
    if( !modelObject || !systems || systems.length === 0 ) { return false; }

    var matchSystem = _.find( systems, function( system ) {
        return  system.nodeObject.uid === modelObject.uid;
    } );
    if( matchSystem ) {
        isValidSystem = true;
    }
    return isValidSystem;
};

const removePreviousGraphItems = function( graphModel, interfacesCtx ) {
    if( _.isEmpty( graphModel.dataModel.edgeModels ) && _.isEmpty( graphModel.dataModel.nodeModels ) ) {
        return;
    }
    var visibleExternalSystems = interfacesCtx.visibleExternalSystems;

    var nodesToRemove = [];

    _.forEach( graphModel.dataModel.nodeModels, function( value ) {
        var isVisibleSystem = systemContainsIn( value.modelObject, visibleExternalSystems );
        if( !isVisibleSystem ) {
            nodesToRemove.push( value.graphItem );
        }
    } );

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;

    var boundaries = graph.getBoundaries();
    if( boundaries ) {
        graph.removeBoundaries( boundaries );
    }

    if( nodesToRemove.length > 0 ) {
        graph.removeNodes( nodesToRemove );
    }
};

/**
 * Clearing previous graph selections before updating graph
 * @param {Object} graphModel Graph Model
 */
export let clearGraphSelection = function( graphModel ) {
    graphModel.graphControl.setSelected( null, false );
};

/**
 * Update Interfaces tab graph to show contents
 * @param {Object} graphModel Graph Model
 * @param {Object} activeLegendView Active Legend View
 * @param {Object} modelData Model Data
 * @param {Object} actionState action state
 */
export let updateGraphView = function( graphModel, activeLegendView, modelData, actionState, data ) {
    const interfacesCtx = { ...modelData }; // appCtxSvc.getCtx( 'interfacesCtx' );
    if( !activeLegendView ) {
        activeLegendView = data.data.activeLegendView;
    }
    if( graphModel && activeLegendView && interfacesCtx && interfacesCtx.systemOfInterest && interfacesCtx.systemInView ) {
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;

        removePreviousGraphItems( graphModel, interfacesCtx );

        // Process node data for external nodes
        if( interfacesCtx.visibleExternalSystems && interfacesCtx.visibleExternalSystems.length > 0 ) {
            nodeService.processNodeData( graphModel, interfacesCtx.visibleExternalSystems, 'ExternalSystem', activeLegendView, interfacesCtx );
        }

        // Process node data for internal systems or system in view
        if( interfacesCtx.internalSystems && interfacesCtx.internalSystems.length > 0 ) {
            nodeService.processNodeData( graphModel, interfacesCtx.internalSystems, 'InternalSystem', activeLegendView, interfacesCtx );
            // To do : add code for annotation drawing
        } else if( interfacesCtx.systemInView && interfacesCtx.systemInView.nodeObject.uid === interfacesCtx.systemOfInterest.nodeObject.uid ) {
            nodeService.processNodeData( graphModel, [ interfacesCtx.systemInView ], 'SystemOfInterest', activeLegendView, interfacesCtx );
        }

        // Process edge data to draw edges
        var addedEdges = [];
        if( interfacesCtx.edges && interfacesCtx.edges.length > 0 ) {
            addedEdges = edgeService.processEdgeData( graphModel, interfacesCtx.edges, activeLegendView );
        }

        //apply graph filters and notify item added event
        graph.updateOnItemsAdded( addedEdges );
        graph.showLabels( true );
        layoutService.activateColumnLayout( graphModel, interfacesCtx, addedEdges );
        drawBoundary( interfacesCtx.systemOfInterest, graphModel, activeLegendView, interfacesCtx );
        if( interfacesCtx.systemInView && interfacesCtx.systemInView.nodeObject.uid !== interfacesCtx.systemOfInterest.nodeObject.uid ) {
            drawBoundary( interfacesCtx.systemInView, graphModel, activeLegendView, interfacesCtx );
        }
        adjustBoundarySize( graphModel, interfacesCtx );
    }

    actionState && actionState.update( {} );
};

/**
 * Adding boundary annotation for internal systems
 * @param {Object} system System of Interest/System in View
 * @param {Object} graphModel Graph Model
 * @param {Object} activeLegendView Active Legend View
 * @param {Object} interfacesCtx Model Data
 */
var drawBoundary = function( system, graphModel, activeLegendView, interfacesCtx ) {
    var height = 0;
    var width = 0;
    var x = 0;
    var y = 0;
    var labelConfiguration = {
        margin: [ 5, 10, 2, 2 ],
        style: 'aw-widgets-cellListCellTitle',
        textAlignment: graphConstants.TextAlignment.LEFT
    };
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    if( interfacesCtx && interfacesCtx.internalSystems && interfacesCtx.internalSystems.length > 0 ) {
        var size = interfacesCtx.internalSystems.length;
        var internalSystems = interfacesCtx.internalSystems;
        var topNodeObject = internalSystems[ 0 ].nodeObject;
        var bottomNodeObject = internalSystems[ size - 1 ].nodeObject;
        if( topNodeObject ) {
            const topGraphNodeModel = graphModel.dataModel.nodeModels[ topNodeObject.uid ];
            var topNodeRect = null;
            if( topGraphNodeModel ) {
                topNodeRect = graph.getBounds( topGraphNodeModel.graphItem );
                x = topNodeRect.x - DEFAULT_PADDING;
                y = topNodeRect.y;
            }
            if( bottomNodeObject ) {
                const bottomGraphNodeModel = graphModel.dataModel.nodeModels[ bottomNodeObject.uid ];
                if( bottomGraphNodeModel ) {
                    var bottomNodeRect = graph.getBounds( bottomGraphNodeModel.graphItem );
                    if( bottomNodeRect && topNodeRect ) {
                        height = bottomNodeRect.y - topNodeRect.y + bottomNodeRect.height + DEFAULT_PADDING;
                    }
                    if( topNodeRect ) {
                        width = topNodeRect.width + DEFAULT_PADDING * 2;
                    }
                }
            }
        }
        if( height !== 0 || width !== 0 ) {
            var rect = {
                x: x,
                y: y,
                width: width,
                height: height
            };
            var boundaryCategory = interfacesGraphLegendManager.getCategoryType( 'SystemInView', activeLegendView );
            var boundaryStyle = graphLegendSvc.getStyleFromLegend( 'annotations', boundaryCategory,
                activeLegendView );
            if( interfacesCtx.systemInView && interfacesCtx.systemOfInterest &&
                interfacesCtx.systemInView.nodeObject.uid !== interfacesCtx.systemOfInterest.nodeObject.uid &&
                system.nodeObject.uid === interfacesCtx.systemOfInterest.nodeObject.uid ) {
                boundaryCategory = interfacesGraphLegendManager.getCategoryType( 'SystemOfInterest', activeLegendView );
                boundaryStyle = graphLegendSvc.getStyleFromLegend( 'annotations', boundaryCategory,
                    activeLegendView );
            }
            var boundary = graph.createBoundary( rect, boundaryStyle );
            graph.setLabel( boundary, system.nodeLabel, labelConfiguration );
            boundary.modelObject = system.nodeObject;
        }
    }
};

/**
 * Adjusting size of boundary as per height of label on boundary
 * @param {Object} graphModel Graph Model
 * @param {Object} interfacesCtx Model Data
 */
var adjustBoundarySize = function( graphModel, interfacesCtx ) {
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var outerBoundary;
    var innerBoundaryRect;
    var boundaries = graph.getBoundaries();
    if( boundaries ) {
        _.forEach( boundaries, function( boundary ) {
            var boundaryRect = graph.getBounds( boundary );
            var labelHeight = boundary.getLabel().getHeightValue();
            boundaryRect.y = boundaryRect.y - labelHeight - DEFAULT_MARGIN;
            boundaryRect.height = boundaryRect.height + labelHeight + DEFAULT_MARGIN;
            if( boundary.modelObject.uid === interfacesCtx.systemOfInterest.nodeObject.uid && interfacesCtx.systemInView && interfacesCtx.systemOfInterest &&
                interfacesCtx.systemInView.nodeObject.uid !== interfacesCtx.systemOfInterest.nodeObject.uid ) {
                outerBoundary = boundary;
            } else {
                innerBoundaryRect = boundaryRect;
                graph.setBounds( boundary, boundaryRect );
            }
        } );
        if( outerBoundary && innerBoundaryRect ) {
            var outerBoundaryRect = graph.getBounds( outerBoundary );
            outerBoundaryRect.y = innerBoundaryRect.y - DEFAULT_PADDING;
            outerBoundaryRect.height = innerBoundaryRect.height + DEFAULT_PADDING * 2;
            outerBoundaryRect.width = innerBoundaryRect.width + DEFAULT_PADDING * 2;
            outerBoundaryRect.x = innerBoundaryRect.x - DEFAULT_PADDING;
            graph.setBounds( outerBoundary, outerBoundaryRect );
        }
    }
    // Fit the graph
    graphControl.fitGraph();
};

/**
 * Process graph object double click event
 * @param {Object} graphModel graph model
 * @param {Object} graphItem double clicked graph item
 * @param {Object} pageState page state
 */
export let graphObjectDoubleClicked = function( graphModel, graphItem, pageState ) {
    if( graphItem && pageState ) {
        let doubleClickedObj;
        if( graphItem.getItemType() === 'Node' && graphItem.model.modelObject ) {
            doubleClickedObj = graphItem.model.modelObject;
        } else if( graphItem.getItemType() === 'Label' ) {
            var node = graphItem.getOwner();
            if( node && node.model.modelObject ) {
                doubleClickedObj = node.model.modelObject;
            }
        }

        if( doubleClickedObj ) {
            clearGraphSelection( graphModel );

            const pageStateValue = { ...pageState.value };
            pageStateValue.doubleClickedObject = doubleClickedObj;

            pageState.update( pageStateValue );
        }
    }
};

/**
 * Setting selection fro Interfaces tab
 * @param {Object} selected Selected graph items
 * @param {Object} unselected De selected graph items
 * @param {Object} graphModel Graph Model
 * @param {Object} activeLegendView Active Legend View
 * @param {Object} interfacesCtx Model Data
 * @param {Object} selectionData Selection Data
 */
export let setDiagramSelection = function( selected, unselected, graphModel, activeLegendView, interfacesCtx, selectionData ) {
    var label = null;
    var soiLabelStyleClass = SOI_NODE_LABEL_SELECTED_STYLE_CLASS + NODE_SELECTED_STYLE_CLASS;
    var resetSoiLabelStyleClass = SOI_NODE_LABEL_STYLE_CLASS + NODE_STYLE_CLASS;
    var boundarySelectedStyle = {
        styleClass: NODE_SELECTED_STYLE_CLASS
    };
    var resetBoundaryStyle = {
        styleClass: 'aw-systemmodeler-boundaryStyle'
    };
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    if( interfacesCtx && interfacesCtx.systemOfInterest ) {
        var graphControl = graphModel.graphControl;
        var systemOfInterest = interfacesCtx.systemOfInterest;

        if( unselected && unselected.length > 0 ) {
            _.forEach( unselected, function( element ) {
                if( element.getItemType() === 'Node' ) {
                    setNodeHoverProperty( element, NODE_STYLE_CLASS );
                    if( element.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                        label = element.getLabel();
                        label.setStyle( null, resetSoiLabelStyleClass );
                    }
                } else if( element.getItemType() === 'Label' ) {
                    var node = element.getOwner();
                    if( node.model.modelObject ) {
                        setNodeHoverProperty( node, NODE_STYLE_CLASS );
                        if( node.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                            element.setStyle( null, resetSoiLabelStyleClass );
                        }
                    } else {
                        setNodeHoverProperty( node, resetBoundaryStyle );
                    }
                } else if( element.getItemType() === 'Edge' ) {
                    resetEdgeStyle( element, graphModel, activeLegendView );
                    var srcNode = element.getSourceNode();
                    var tarNode = element.getTargetNode();
                    if( srcNode && tarNode ) {
                        setNodeHoverProperty( srcNode, NODE_STYLE_CLASS );
                        setNodeHoverProperty( tarNode, NODE_STYLE_CLASS );
                        if( srcNode.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                            label = srcNode.getLabel();
                            label.setStyle( null, resetSoiLabelStyleClass );
                        } else if( tarNode.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                            label = tarNode.getLabel();
                            label.setStyle( null, resetSoiLabelStyleClass );
                        }
                    }
                } else if( element.getItemType() === 'Boundary' ) {
                    graphControl.graph.setBoundaryStyle( element, resetBoundaryStyle );
                }
            } );
        }

        if( selected && selected.length > 0 ) {
            _.forEach( selected, function( element ) {
                if( element.getItemType() === 'Node' ) {
                    setNodeHoverProperty( element, NODE_SELECTED_STYLE_CLASS );
                    if( element.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                        var label = element.getLabel();
                        label.setStyle( null, soiLabelStyleClass );
                    }
                } else if( element.getItemType() === 'Edge' ) {
                    setHoverEdgeStyle( element, graphModel, systemOfInterest, activeLegendView );
                } else if( element.getItemType() === 'Label' ) {
                    var node = element.getOwner();
                    setNodeHoverProperty( node, NODE_SELECTED_STYLE_CLASS );
                    if( node.model.modelObject ) {
                        if( node.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                            element.setStyle( null, soiLabelStyleClass );
                        }
                    }
                } else if( element.getItemType() === 'Boundary' ) {
                    graphControl.graph.setBoundaryStyle( element, boundarySelectedStyle );
                }
            } );
        }
        // get ALL the selected Graph Elements and publish the selectionChanged event.
        const allSelectedGraphModelObjects = [];
        const allSelectedGraphElements = graphModel.graphControl.getSelected();
        let systemType = '';
        let localInternalSystemsUids = [];
        _.forEach( allSelectedGraphElements, function( element ) {
            let modelObject;
            if( element.getItemType() === 'Node' || element.getItemType() === 'Edge' ) {
                modelObject = element.model.modelObject;
            } else if( element.getItemType() === 'Label' ) {
                if( element.getOwner().model.modelObject ) {
                    modelObject = element.getOwner().model.modelObject;
                    const boundary = element.getOwner();
                    if( boundary.modelObject ) {
                        if( boundary.modelObject.uid === interfacesCtx.systemInView.nodeObject.uid ) {
                            modelObject = interfacesCtx.systemInView.nodeObject;
                        } else if( boundary.modelObject.uid === interfacesCtx.systemOfInterest.nodeObject.uid ) {
                            modelObject = interfacesCtx.systemOfInterest.nodeObject;
                        }
                    }
                }
            } else if( element.getItemType() === 'Boundary' ) {
                if( element.modelObject ) {
                    if( element.modelObject.uid === interfacesCtx.systemInView.nodeObject.uid ) {
                        modelObject = interfacesCtx.systemInView.nodeObject;
                    } else if( element.modelObject.uid === interfacesCtx.systemOfInterest.nodeObject.uid ) {
                        modelObject = interfacesCtx.systemOfInterest.nodeObject;
                    }
                }
            }

            if( modelObject ) {
                allSelectedGraphModelObjects.push( modelObject );
                systemType = interfacesUtilService.getSystemType( modelObject, interfacesCtx );

                // Add the Internal systems uid only when internal systems exist and the selected node is
                // the system in view
                if( interfacesCtx.internalSystemsExists === true && modelObject.uid === interfacesCtx.systemInView.nodeObject.uid ) {
                    localInternalSystemsUids = _.map( interfacesCtx.internalSystems, 'nodeObject.uid' );
                }
            }
        } );

        selectionData.update( {
            selected: allSelectedGraphModelObjects,
            systemType: systemType,
            internalSystemsUids: localInternalSystemsUids.join( '|' )
        } );
    }
};

/**
 * Function to set hover styling of elements in diagram
 *
 * @param {Object} hoveredItem Hovered Graph Item
 * @param {Object} unHoveredItem Unhovered Graph Item
 * @param {Object} graphModel Graph Model
 * @param {Object} activeLegendView Active Legend View
 * @param {Object} interfacesCtx Model Data
 */
export let setDiagramHover = function( hoveredItem, unHoveredItem, graphModel, activeLegendView, interfacesCtx ) {
    if( _timeoutPromise ) {
        AwTimeoutService.instance.cancel( _timeoutPromise );
        _timeoutPromise = null;
    }
    var nodesToCheck = [];
    var labelsToCheck = [];
    var resetSoiLabelStyleClass = SOI_NODE_LABEL_STYLE_CLASS + NODE_STYLE_CLASS;
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    if( interfacesCtx && interfacesCtx.systemOfInterest ) {
        var systemOfInterest = interfacesCtx.systemOfInterest;
        var graphControl = graphModel.graphControl;
        var graph = graphModel.graphControl.graph;

        const edgesSelected = graphModel.graphControl.getSelected( 'Edge' );
        if( unHoveredItem ) {
            if( unHoveredItem.getItemType() === 'Edge' ) {
                if( !edgesSelected || edgesSelected.indexOf( unHoveredItem ) < 0 ) {
                    resetEdgeStyle( unHoveredItem, graphModel, activeLegendView );
                    var srcNode = unHoveredItem.getSourceNode();
                    var tarNode = unHoveredItem.getTargetNode();
                    nodesToCheck.push( srcNode );
                    nodesToCheck.push( tarNode );
                }
            } else if( unHoveredItem.getItemType() === 'Node' ) {
                nodesToCheck.push( unHoveredItem );
            } else if( unHoveredItem.getItemType() === 'Label' ) {
                labelsToCheck.push( unHoveredItem );
            }
            for( const node of nodesToCheck ) {
                var nodeEdgeSelected = false;
                if( edgesSelected && edgesSelected.length > 0 ) {
                    for( const selEdge of edgesSelected ) {
                        srcNode = selEdge.getSourceNode();
                        tarNode = selEdge.getTargetNode();
                        if(  srcNode.model.modelObject.uid === node.model.modelObject.uid  ||
                             tarNode.model.modelObject.uid === node.model.modelObject.uid  ) {
                            nodeEdgeSelected = true;
                            break;
                        }
                    }
                }
                if( !nodeEdgeSelected ) {
                    if( !graphControl.isSelected( node ) ) {
                        var nodeLabel = node.getLabel();
                        if( !graphControl.isSelected( nodeLabel ) ) {
                            setNodeHoverProperty( node, NODE_STYLE_CLASS );
                            if( node.model.modelObject && node.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                                if( node.getLabel() ) {
                                    graph.update( function() {
                                        node.getLabel().setStyle( null, resetSoiLabelStyleClass );
                                    } );
                                }
                            }
                        }
                    }
                }
            }
            for( const selectedLabel of labelsToCheck ) {
                var labelEdgeSelected = false;
                var selectedNode = selectedLabel.getOwner();
                if( edgesSelected && edgesSelected.length > 0 ) {
                    for( const selEdge  of edgesSelected ) {
                        srcNode = selEdge.getSourceNode();
                        tarNode = selEdge.getTargetNode();
                        if(  srcNode && srcNode.model.modelObject.uid === selectedNode.model.modelObject.uid  ||
                             tarNode && tarNode.model.modelObject.uid === selectedNode.model.modelObject.uid  ) {
                            labelEdgeSelected = true;
                            break;
                        } else if( graphControl.isSelected( selectedLabel ) ) {
                            labelEdgeSelected = false;
                            break;
                        }
                    }
                }
                if( !labelEdgeSelected ) {
                    if( !graphControl.isSelected( selectedLabel ) ) {
                        var selNode = selectedLabel.getOwner();
                        if( selNode.model.modelObject && selNode.getItemType() === 'Node' ) {
                            if( !graphControl.isSelected( selNode ) ) {
                                setNodeHoverProperty( selNode, NODE_STYLE_CLASS );
                                if( selNode.model.modelObject &&  selNode.model.modelObject.uid === systemOfInterest.nodeObject.uid  ) {
                                    graph.update( function() {
                                        selectedLabel.setStyle( null, resetSoiLabelStyleClass );
                                    } );
                                }
                            }
                        }
                    }
                }
            }
        }
        if( hoveredItem ) {
            setHoverStyle( hoveredItem, graphModel, systemOfInterest, activeLegendView );
        }
    }
};

/**
 * Function to set style in diagram on hover
 *
 * @param {Object} hoveredItem - Hovered Graph Item
 * @param {Object} graphModel - Graph Model
 * @param {Object} systemOfInterest - System of Interest
 * @param {Object} activeLegendView - Legend View
 */
var setHoverStyle = function( hoveredItem, graphModel, systemOfInterest, activeLegendView ) {
    _hoveredItem = hoveredItem;
    var graph = graphModel.graphControl.graph;
    var soiLabelStyleClass = SOI_NODE_LABEL_SELECTED_STYLE_CLASS + NODE_SELECTED_STYLE_CLASS;

    _timeoutPromise = AwTimeoutService.instance( function() {
        _timeoutPromise = null;
        if( _hoveredItem.getItemType() === 'Label' ) {
            var node = _hoveredItem.getOwner();
            if( node.modelObject ) {
                _hoveredItem = node;
            }
        }

        if( _hoveredItem.getItemType() === 'Edge' ) {
            setHoverEdgeStyle( _hoveredItem, graphModel, systemOfInterest, activeLegendView );
        } else if( _hoveredItem.getItemType() === 'Node' ) {
            if( _hoveredItem.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                if( graph ) {
                    graph.update( function() {
                        var label = _hoveredItem.getLabel();
                        label.setStyle( null, soiLabelStyleClass );
                    } );
                }
            } else {
                setNodeHoverProperty( _hoveredItem, NODE_SELECTED_STYLE_CLASS );
            }
        }
        _hoveredItem = null;
    }, 325 );
};

/**
 * Function to set edge style in diagram on hover/selection
 *
 * @param {Object} hoveredItem - Hovered Graph Item
 * @param {Object} graphModel - Graph Model
 * @param {Object} systemOfInterest - System of Interest
 * @param {Object} activeLegendView - Legend View
 */
var setHoverEdgeStyle = function( hoveredItem, graphModel, systemOfInterest, activeLegendView ) {
    var soiLabelStyleClass = SOI_NODE_LABEL_SELECTED_STYLE_CLASS + NODE_SELECTED_STYLE_CLASS;
    var label = null;
    var graph = graphModel.graphControl.graph;
    if( graph ) {
        var edgeStyle;
        var edgeCategory = interfacesGraphLegendManager.getCategoryType( 'Connectivity', activeLegendView );
        //get edge style from graph legend
        edgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory,
            activeLegendView );
        var hoveredEdgeStyle = hoveredItem.style;
        var edgeThicknessOnHover =  edgeStyle.thickness  *  edgeStyle.thicknessMultiplier;
        if( hoveredEdgeStyle ) {
            hoveredEdgeStyle = _.clone( hoveredEdgeStyle );
            var edgeThickness = hoveredEdgeStyle.thickness;
            if( edgeThickness !== edgeThicknessOnHover ) {
                hoveredEdgeStyle.thickness = edgeThicknessOnHover;
            }
            graph.setEdgeStyle( hoveredItem, hoveredEdgeStyle );
        }
        var srcNode = hoveredItem.getSourceNode();
        var tarNode = hoveredItem.getTargetNode();
        if( srcNode && tarNode ) {
            setNodeHoverProperty( srcNode, NODE_SELECTED_STYLE_CLASS );
            setNodeHoverProperty( tarNode, NODE_SELECTED_STYLE_CLASS );
            if( srcNode.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                label = srcNode.getLabel();
                label.setStyle( null, soiLabelStyleClass );
            } else if( tarNode.model.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                label = tarNode.getLabel();
                label.setStyle( null, soiLabelStyleClass );
            }
        }
    }
};

/*
 * Function to apply the css to source and target nodes on selection of edge in diagram
 */
var setNodeHoverProperty = function( node, hoveredClass ) {
    if( node ) {
        var bindData = node.getAppObj();
        if( hoveredClass ) {
            bindData[ exports.NODE_HOVERED_CLASS ] = hoveredClass;
        } else {
            bindData[ exports.NODE_HOVERED_CLASS ] = NODE_STYLE_CLASS;
        }
        if( node.getSVG() ) {
            node.getSVG().bindNewValues( exports.NODE_HOVERED_CLASS );
        }
    }
};

/**
 * Function to reset style of edge in diagram on unhover/deselection
 *
 * @param {Object} unHoveredItem - Unhovered Graph Item
 * @param {Object} graphModel - Graph Model
 * @param {Object} activeLegendView - Legend View
 */
var resetEdgeStyle = function( unHoveredItem, graphModel, activeLegendView ) {
    var graph = graphModel.graphControl.graph;
    if( graph ) {
        var edgeStyle;
        var edgeCategory = interfacesGraphLegendManager.getCategoryType( 'Connectivity', activeLegendView );
        //get edge style from graph legend
        edgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory,
            activeLegendView );
        var unHoveredEdgeStyle = unHoveredItem.style;
        if( unHoveredEdgeStyle ) {
            unHoveredEdgeStyle = edgeStyle;
            graph.setEdgeStyle( unHoveredItem, unHoveredEdgeStyle );
        }
    }
};

/**
 * clears the graph
 * @param {Object} graphModel Graph Model
 */
export let clearGraphView = function( graphModel ) {
    if( graphModel ) {
        graphModel.clearGraph();
        // graph.update( function() {
        //     graph.clear();
        // } );
    }
};

/**
 * Updating Boundary annotation for internal systems if required
 * @param {Object} graphModel Graph Model
 * @param {Object} activeLegendView Active Legend View
 * @param {Object} interfacesCtx Model Data
 */
const updateBoundary = function( graphModel, activeLegendView, interfacesCtx ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var boundaries = graph.getBoundaries();
    if( boundaries ) {
        graph.removeBoundaries( boundaries );
    }
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    if( interfacesCtx && interfacesCtx.systemInView ) {
        drawBoundary( interfacesCtx.systemInView, graphModel, activeLegendView, interfacesCtx );
        if( interfacesCtx.systemInView.nodeObject.uid !== interfacesCtx.systemOfInterest.nodeObject.uid ) {
            drawBoundary( interfacesCtx.systemOfInterest, graphModel, activeLegendView, interfacesCtx );
        }
    }
    adjustBoundarySize( graphModel, interfacesCtx );
};

/**
 * Function to update the label name in Graph after updating the revision name in infopanel
 * @param {Object} eventData Event Data
 * @param {Object} graphModel Graph Model
 * @param {Object} activeLegendView Acive Legend View
 * @param {Object} interfacesCtx Model Data
 */
export let updateFromInfoPanel = function( eventData, graphModel, activeLegendView, interfacesCtx ) {
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    if( interfacesCtx && interfacesCtx.systemInView ) {
        var systemInView = interfacesCtx.systemInView;
    }
    if( interfacesCtx && interfacesCtx.systemOfInterest ) {
        var systemOfInterest = interfacesCtx.systemOfInterest;
    }
    var context = appCtxSvc.getCtx( 'interfacesLabelCtx' );
    var labelProp = context.selectedLabelProperty.name;
    var labelNames = labelProp.split( '.' );
    var label = labelNames[ 1 ];
    var displayName = '';
    var nodes = [];
    var labelConfiguration = {
        margin: [ 10, 10, 2, 2 ],
        style: 'aw-widgets-cellListCellTitle',
        textAlignment: graphConstants.TextAlignment.LEFT
    };
    _.forEach( eventData.updatedObjects, function( modelObj ) {
        const nodeModel = graphModel.dataModel.nodeModels[ modelObj.uid ];
        if( nodeModel && nodeModel.modelObject.props[ label ] ) {
            displayName = nodeModel.modelObject.props[ label ].uiValues[ 0 ];
            if( graphModel.graphControl ) {
                var graph = graphModel.graphControl.graph;
                if( graph ) {
                    const node = nodeModel.graphItem;
                    var originHeight = node.getHeightValue();
                    graph.setLabel( node, displayName );
                    var changedHeight = node.getHeightValue();
                    if( interfacesCtx && interfacesCtx.internalSystems && interfacesCtx.internalSystems.length > 0 ) {
                        var internalSystems = interfacesCtx.internalSystems;
                        _.forEach( internalSystems, function( intSys ) {
                            var graphNodeModel = graphModel.dataModel.nodeModels[ intSys.nodeObject.uid ];
                            if( graphNodeModel && graphNodeModel.modelObject.uid === nodeModel.modelObject.uid && originHeight !== changedHeight ) {
                                nodes.push( node );
                            }
                        } );
                    }
                }
            }
        }
    } );
    if( nodes.length > 0 ) {
        updateBoundary( graphModel, activeLegendView, interfacesCtx );
    } else {
        var intGraph = graphModel.graphControl.graph;
        if( intGraph ) {
            var boundaries = intGraph.getBoundaries();
            if( boundaries && boundaries.length > 0 ) {
                if( systemInView ) {
                    _.forEach( eventData.updatedObjects, function( modelObj ) {
                        if( modelObj.uid === systemInView.nodeObject.uid ) {
                            _.forEach( boundaries, function( boundary ) {
                                var text = boundary.getLabel().getText();
                                if( modelObj.props[ label ] ) {
                                    displayName = modelObj.props[ label ].uiValues[ 0 ];
                                    if( boundary.modelObject.uid === systemInView.nodeObject.uid ) {
                                        if( text !== displayName ) {
                                            var originalHeight = boundary.getLabel().getHeightValue();
                                            intGraph.setLabel( boundary, displayName, labelConfiguration );
                                            var changedHeight = boundary.getLabel().getHeightValue();
                                            if( originalHeight !== changedHeight ) {
                                                adjustBoundarySize( graphModel, interfacesCtx );
                                            }
                                        }
                                    }
                                }
                            } );
                        } else if( modelObj.uid === systemOfInterest.nodeObject.uid ) {
                            _.forEach( boundaries, function( boundary ) {
                                var text = boundary.getLabel().getText();
                                if( modelObj.props[ label ] ) {
                                    displayName = modelObj.props[ label ].uiValues[ 0 ];
                                    if( boundary.modelObject.uid === systemOfInterest.nodeObject.uid ) {
                                        if( text !== displayName ) {
                                            var originalHeight = boundary.getLabel().getHeightValue();
                                            intGraph.setLabel( boundary, displayName, labelConfiguration );
                                            var changedHeight = boundary.getLabel().getHeightValue();
                                            if( originalHeight !== changedHeight ) {
                                                adjustBoundarySize( graphModel, interfacesCtx );
                                            }
                                        }
                                    }
                                }
                            } );
                        }
                    } );
                }
            }
        }
    }
};

export default exports = {
    NODE_HOVERED_CLASS,
    clearGraphSelection,
    updateGraphView,
    graphObjectDoubleClicked,
    setDiagramSelection,
    setDiagramHover,
    clearGraphView,
    updateFromInfoPanel
};
