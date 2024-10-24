// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitectureGraphSelectionService
 */
import appCtxSvc from 'js/appCtxService';
import AwTimeoutService from 'js/awTimeoutService';
import cmm from 'soa/kernel/clientMetaModel';
import dms from 'soa/dataManagementService';
import portService from 'js/Ase0ArchitecturePortService';
import _ from 'lodash';
import graphLegendSvc from 'js/graphLegendService';

var _timeoutPromise;
var _hoveredItem;

/**
 * Binding class name for node
 */
export let NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';

/**
 * Binding class name for text inside the tile
 */
export let TEXT_HOVERED_CLASS = 'relation_TEXT_hovered_style_svg';

/**
 * Node selected style class
 */
const NODE_HOVERED_STYLE_CLASS = 'aw-widgets-cellListItemNodeHovered';

/**
 * Node selected style class
 */
const NODE_SELECTED_STYLE_CLASS = 'aw-widgets-cellListItemNodeSelected';

/**
 * Function to set hover styling of elements in diagram
 *
 * @param {*} hoveredItem item hovered
 * @param {*} unHoveredItem unhovered item
 * @param {Object} graphModel graph model
 * @param {Object} activeLegendView active legend view
 */
export let setDiagramHover = function( hoveredItem, unHoveredItem, graphModel, activeLegendView ) {
    if ( _timeoutPromise ) {
        AwTimeoutService.instance.cancel( _timeoutPromise );
        _timeoutPromise = null;
    }
    var selectedEdges = [];
    var selectedPorts = [];
    var nodesToCheck = [];

    if ( graphModel && graphModel.graphControl ) {
        const graphControl = graphModel.graphControl;
        selectedEdges = graphControl.getSelected( 'Edge' );
        selectedPorts = graphControl.getSelected( 'Port' );
    }
    if ( unHoveredItem ) {
        if ( unHoveredItem.getItemType() === 'Edge' ) {
            if ( !selectedEdges || selectedEdges.indexOf( unHoveredItem ) < 0 ) {
                resetEdgeStyle( unHoveredItem, graphModel, activeLegendView );
                var srcNode = unHoveredItem.getSourceNode();
                var tarNode = unHoveredItem.getTargetNode();
                nodesToCheck.push( srcNode );
                nodesToCheck.push( tarNode );
            }
        } else if ( unHoveredItem.getItemType() === 'Node' ) {
            nodesToCheck.push( unHoveredItem );
        } else if ( unHoveredItem.getItemType() === 'Port' && ( !selectedPorts || selectedPorts.indexOf( unHoveredItem ) < 0 ) ) {
            resetPortStyle( unHoveredItem, graphModel, activeLegendView );
        }
        _.forEach( nodesToCheck, function( node ) {
            var nodeEdgeSelected = false;
            if ( selectedEdges && selectedEdges.length > 0 ) {
                _.forEach( selectedEdges, function( edge ) {
                    srcNode = edge.getSourceNode();
                    tarNode = edge.getTargetNode();
                    if ( node && node.modelObject && node.modelObject.uid ) {
                        if ( srcNode && srcNode.modelObject && srcNode.modelObject.uid === node.modelObject.uid ||
                            tarNode && tarNode.modelObject && tarNode.modelObject.uid === node.modelObject.uid ) {
                            nodeEdgeSelected = true;
                            return false;
                        }
                    }
                } );
            }
            if ( !nodeEdgeSelected ) {
                setNodeHoverProperty( node, null );
            }
        } );
    }
    if ( hoveredItem ) {
        setHoverStyle( hoveredItem, graphModel, activeLegendView );
    }
};

export let setDiagramSelection = function( selected, unselected, graphModel, occContext, primarySelection, activeLegendView, graphState ) {
    const newGraphState = { ...graphState.value };
    var selectedNodes = [];
    var selectedPorts = [];
    var selectedEdges = [];
    const selectedAnnotations = [];
    const selectedNodeModels = [];
    const selectedPortModels = [];
    const selectedEdgeModels = [];
    let pwaSelections = [];
    if( occContext && occContext.pwaSelection ) { pwaSelections = occContext.pwaSelection; }

    var graphControl = graphModel.graphControl;

    _.forEach( graphControl.getSelected( 'Node' ), function( selectedNode ) {
        selectedNodes.push( selectedNode.modelObject );
        selectedNodeModels.push( selectedNode.model );
    } );

    _.forEach( graphControl.getSelected( 'Port' ), function( selectedPort ) {
        selectedPorts.push( selectedPort.modelObject );
        selectedPortModels.push( selectedPort.model );
    } );

    _.forEach( graphControl.getSelected( 'Edge' ), function( selectedEdge ) {
        selectedEdges.push( selectedEdge.modelObject );
        selectedEdgeModels.push( selectedEdge.model );
    } );

    _.forEach( graphControl.getSelected( 'Boundary' ), function( selectedBoundary ) {
        selectedAnnotations.push( selectedBoundary );
    } );

    var multiselectMode = checkIfMultiselectMode( graphControl );

    var aceShowConnectionMode = false;
    var aceShowPortMode = false;
    if ( occContext.persistentRequestPref ) {
        aceShowConnectionMode = occContext.persistentRequestPref.includeConnections;
        aceShowPortMode = occContext.persistentRequestPref.includeInterfaces;
    }

    var elementToDeselect = updateGraphItemDeSelectionStyle( unselected, graphModel, activeLegendView, pwaSelections );
    var elementToFocus = updateGraphItemSelectionStyle( selected, graphModel, activeLegendView, pwaSelections, elementToDeselect, aceShowConnectionMode, aceShowPortMode );

    if ( multiselectMode ) {
        addElemntToArray( selectedNodes, elementToFocus );
        _.forEach( selectedEdges, function( element ) {
            if ( aceShowConnectionMode && cmm.isInstanceOf( 'Awb0ConditionalElement', element.modelType ) && elementToFocus.indexOf( element ) < 0 ) {
                elementToFocus.push( element );
            }
        } );
    }

    var graphSelections = [];

    graphSelections = graphSelections.concat( selectedNodes, selectedPorts, selectedEdges );
    var uids = _.map( graphSelections, 'uid' );

    // Ensure Properties Loaded
    var propsToLoad = [ 'awb0Parent', 'is_modifiable' ];
    if ( uids && uids.length > 0 ) {
        if ( uids.length === 1 && selectedEdges.length === 1 && cmm.isInstanceOf( 'FND_TraceLink', selectedEdges[0].modelType ) ) {
            // do nothing
        } else {
            dms.getProperties( uids, propsToLoad );
        }
    }

    const newSelectionData = {
        nodeModels: selectedNodeModels,
        edgeModels: selectedEdgeModels,
        portModels: selectedPortModels,
        annotations: selectedAnnotations,
        selected: graphSelections,
        amSelection : graphSelections
    };

    // evaluate show port condition
    portService.evaluateShowPortsCondition( graphModel, newGraphState );

    // Set Selected node Command Visibility
    updateCommandVisibilityConditions( graphModel, newGraphState );

    //if is in Diagramiing context and Diagram Is Dirty
    if( newGraphState.hasPendingChangesInDiagram ) {
        _.set( newGraphState, 'leaveConfirmBySelectionChange', true );
    }

    primarySelection.update( newSelectionData );
    graphState.update && graphState.update( newGraphState );
};

let updateGraphItemDeSelectionStyle = function( unselected, graphModel, activeLegendView, pwaSelections ) {
    let elementToDeselect = [];
    if ( unselected && unselected.length > 0 && graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        _.forEach( unselected, function( element ) {
            let modelObject = element.modelObject;
            if ( element.getItemType() === 'Port' ) {
                resetPortStyle( element, graphModel, activeLegendView );
            } else if ( element.getItemType() === 'Edge' ) {
                resetEdgeStyle( element, graphModel, activeLegendView );
                let srcNode = element.getSourceNode();
                let tarNode = element.getTargetNode();
                if ( srcNode && tarNode ) {
                    setNodeHoverProperty( srcNode, null );
                    setNodeHoverProperty( tarNode, null );
                }
            } else if ( element.getItemType() === 'Boundary' && element.style.styleClass.indexOf( NODE_SELECTED_STYLE_CLASS ) >= 0 ) {
                let style = _.clone( element.style, true );
                style.styleClass = style.styleClass.replace( ' ' + NODE_SELECTED_STYLE_CLASS, '' );
                graphControl.graph.setBoundaryStyle( element, style );
            }
            if ( modelObject && cmm.isInstanceOf( 'Awb0Element', modelObject.modelType ) && _.includes( pwaSelections, modelObject ) ) {
                elementToDeselect.push( modelObject );
            }
        } );
    }
    return elementToDeselect;
};

let updateGraphItemSelectionStyle = function( selected, graphModel, activeLegendView, pwaSelections, elementToDeselect, aceShowConnectionMode, aceShowPortMode ) {
    let elementToFocus = [];
    if ( selected && selected.length > 0 && graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        _.forEach( selected, function( element ) {
            let modelObject = element.modelObject;
            if ( element.getItemType() === 'Port' ) {
                setHoverPortStyle( element, graphModel );
            } else if ( element.getItemType() === 'Edge' ) {
                setHoverEdgeStyle( element, graphModel, activeLegendView );
            } else if ( element.getItemType() === 'Boundary' && element.style.styleClass.indexOf( NODE_SELECTED_STYLE_CLASS ) < 0 ) {
                let style = _.clone( element.style, true );
                style.styleClass += ' ' + NODE_SELECTED_STYLE_CLASS;
                graphControl.graph.setBoundaryStyle( element, style );
            }

            if ( modelObject && cmm.isInstanceOf( 'Awb0Element', modelObject.modelType ) && !_.includes( pwaSelections, modelObject ) ) {
                if ( ( aceShowConnectionMode || !cmm.isInstanceOf( 'Awb0Connection', modelObject.modelType ) ) && ( aceShowPortMode || !cmm.isInstanceOf( 'Awb0Interface', modelObject.modelType ) ) ) {
                    elementToFocus.push( modelObject );
                }
            }
        } );
    } else {
        if ( elementToDeselect.length > 0 && pwaSelections.length > 0 ) {
            _.forEach( pwaSelections, function( element ) {
                if ( !_.includes( elementToDeselect, element ) ) {
                    elementToFocus.push( element );
                }
            } );
        }
    }
    return elementToFocus;
};

let isNonACESelection = function( selection, occContext ) {
    let validNonACESelection = false;
    if( selection && selection.length === 1 ) {
        if( cmm.isInstanceOf( 'FND_TraceLink', selection[ 0 ].modelType ) ) {
            validNonACESelection = true;
        } else if( occContext && occContext.persistentRequestPref ) {
            let aceShowConnectionMode = occContext.persistentRequestPref.includeConnections;
            let aceShowPortMode = occContext.persistentRequestPref.includeInterfaces;
            if( !aceShowConnectionMode && cmm.isInstanceOf( 'Awb0Connection', selection[ 0 ].modelType ) ||
            !aceShowPortMode && cmm.isInstanceOf( 'Awb0Interface', selection[ 0 ].modelType ) ) {
                validNonACESelection = true;
            }
        }
    }
    return validNonACESelection;
};

export let syncSelectionsInGraph = function( graphModel, occContext, primarySelection, graphState ) {
    const newGraphState = { ...graphState.value };
    const newSelectionData = { ...primarySelection.value };
    var selectedNodes = [];
    const selectedNodeModels = [];
    var selectedEdges = [];
    const selectedEdgeModels = [];
    var currentSelections = [];
    var graphSelections = [];
    var selectedPorts = [];
    const selectedPortModels = [];
    let pwaSelections = [];
    var elementsToDeselect = [];

    var openedElement = occContext.openedElement;
    var currentView = _.get( appCtxSvc, 'ctx.ViewModeContext.ViewModeContext', undefined );

    // occContext.pwaSelection always has selection if ACE tree has selection or else base selection
    // we need to get if ACE tree has selection
    let pwaSelection = occContext.treeDataProvider ? occContext.treeDataProvider.getSelectedObjects() : [];

    // first check if
    //    1. Any selection in ACE tree i.e. pwaSelection
    //    2. in empty pwaSelection case check occContext.pwaSelection does not have rootElement selected
    //    in both above cases consider occContext.pwaSelection
    // else if Non ACE element selection like Trace link, ports or connection with mode off
    //    - here need to consider Architecture tab primarySelection
    if( !_.isEmpty( pwaSelection ) ||
    occContext.pwaSelection.length !== 0 && occContext.rootElement && occContext.pwaSelection[0].uid !== occContext.rootElement.uid  )  {
        pwaSelections = occContext.pwaSelection;
    } else if ( newSelectionData && !_.isEmpty( newSelectionData.selected ) && isNonACESelection( newSelectionData.selected, occContext ) ) {
        pwaSelections = newSelectionData.selected;
    }

    for( const selection of pwaSelections ) {
        if ( graphModel && graphModel.dataModel ) {
            const nodeModel = graphModel.dataModel.nodeModels[ selection.uid ];
            if ( nodeModel ) {
                addElemntToArray( selection, selectedNodes );
                selectedNodeModels.push( nodeModel );
            } else {
                const edgeModel = graphModel.dataModel.edgeModels[ selection.uid ];
                if ( edgeModel ) {
                    addElemntToArray( selection, selectedEdges );
                    selectedEdgeModels.push( edgeModel );
                } else {
                    const portModel = graphModel.dataModel.portModels[ selection.uid ];
                    if ( portModel ) {
                        addElemntToArray( selection, selectedPorts );
                        selectedPortModels.push( portModel );
                    }
                }
            }
        }
    }

    currentSelections = selectedNodes.concat( selectedEdges );
    currentSelections = currentSelections.concat( selectedPorts );

    if ( newSelectionData && !_.isEmpty( newSelectionData ) ) {
        var previousSelections = [];
        addElemntToArray( _.map( newSelectionData.nodeModels, 'modelObject' ), previousSelections );

        _.forEach( newSelectionData.edgeModels, function( edge ) {
            if ( cmm.isInstanceOf( 'Awb0ConditionalElement', edge.modelObject.modelType ) ) {
                previousSelections.push( edge.modelObject );
            } else {
                graphSelections.push( edge.modelObject );
            }
        } );

        graphSelections.push.apply( graphSelections, _.map( newSelectionData.portModels, 'modelObject' ) );

        if ( compareArrays( pwaSelections, previousSelections.concat( graphSelections ) ) ) {
            // Set Selected node Command Visibility
            updateCommandVisibilityConditions( graphModel, newGraphState );

            graphState.update && graphState.update( newGraphState );

            return;
        }
        if ( previousSelections.length === 0 && pwaSelections.length === 1 && pwaSelections[0] === openedElement && currentView !== 'TreeSummaryView' ) {
            // Set Selected node Command Visibility
            updateCommandVisibilityConditions( graphModel, newGraphState );

            graphState.update && graphState.update( newGraphState );
            return;
        }

        elementsToDeselect.push.apply( elementsToDeselect, previousSelections.concat( graphSelections ) );

        elementsToDeselect = elementsToDeselect.filter( function( element ) {
            return currentSelections.indexOf( element ) < 0;
        } );
    }

    newSelectionData.nodeModels = selectedNodeModels;
    newSelectionData.edgeModels = selectedEdgeModels;
    newSelectionData.portModels = selectedPortModels;
    if ( !compareArrays( newSelectionData.selected, currentSelections ) ) {
        newSelectionData.selected = currentSelections;
    }

    setGraphSelection( elementsToDeselect, currentSelections, graphModel );

    if ( selectedNodes.length > 0 ) {
        portService.evaluateShowPortsCondition( graphModel, newGraphState );
    }

    // Set Selected node Command Visibility
    updateCommandVisibilityConditions( graphModel, newGraphState );

    primarySelection.update( newSelectionData );
    graphState.update && graphState.update( newGraphState );
};

var setGraphSelection = function( elementsToDeselect, elementsToSelect, graphModel ) {
    var graphControl = graphModel.graphControl;
    var deSelectGraphItems = [];
    var selectGraphItems = [];

    if ( elementsToDeselect.length > 0 ) {
        _.forEach( elementsToDeselect, function( element ) {
            let itemModel;
            if ( graphModel.dataModel.nodeModels[element.uid] ) {
                itemModel = graphModel.dataModel.nodeModels[element.uid];
                if ( graphControl.isSelected( itemModel.graphItem ) ) {
                    deSelectGraphItems.push( itemModel.graphItem );
                }
            } else if ( graphModel.dataModel.portModels[element.uid] ) {
                itemModel = graphModel.dataModel.portModels[element.uid];
                if ( graphControl.isSelected( itemModel.graphItem ) ) {
                    deSelectGraphItems.push( itemModel.graphItem );
                }
            } else if ( graphModel.dataModel.edgeModels[element.uid] ) {
                itemModel = graphModel.dataModel.edgeModels[element.uid];
                if ( graphControl.isSelected( itemModel.graphItem ) ) {
                    deSelectGraphItems.push( itemModel.graphItem );
                }
            } // Additional code for deselection of Trace link as it has id in edgeModels in format 'uid+end1ElementUid+end2ElementUid'
            // instead of only uid
            else if ( !_.isEmpty( graphModel.dataModel.edgeModels ) && cmm.isInstanceOf( 'FND_TraceLink', element.modelType ) ) {
                _.map( graphModel.dataModel.edgeModels, function( edgeModel, id ) {
                    if ( edgeModel.modelObject.uid.equals( element.uid ) && graphControl.isSelected( edgeModel.graphItem ) ) {
                        deSelectGraphItems.push( edgeModel.graphItem );
                    }
                } );
            }
        } );
    }

    if ( elementsToSelect.length > 0 ) {
        _.forEach( elementsToSelect, function( element ) {
            let itemModel;
            if ( graphModel.dataModel.nodeModels[element.uid] ) {
                itemModel = graphModel.dataModel.nodeModels[element.uid];
                if ( !graphControl.isSelected( itemModel.graphItem ) ) {
                    selectGraphItems.push( itemModel.graphItem );
                }
            } else if ( graphModel.dataModel.edgeModels[element.uid] ) {
                itemModel = graphModel.dataModel.edgeModels[element.uid];
                if ( !graphControl.isSelected( itemModel.graphItem ) ) {
                    selectGraphItems.push( itemModel.graphItem );
                }
            } else if ( graphModel.dataModel.portModels[element.uid] ) {
                itemModel = graphModel.dataModel.portModels[element.uid];
                if ( !graphControl.isSelected( itemModel.graphItem ) ) {
                    selectGraphItems.push( itemModel.graphItem );
                }
            }
        } );
    }

    if ( deSelectGraphItems.length > 0 ) {
        graphControl.setSelected( deSelectGraphItems, false, 'syncPwaSelectionEvent' );
    }

    if ( selectGraphItems.length > 0 ) {
        graphControl.setSelected( selectGraphItems, true, 'syncPwaSelectionEvent' );
    }
};

var checkIfMultiselectMode = function( graphControl ) {
    var selections = graphControl.getSelected();
    if ( selections && selections.length > 1 ) {
        return true;
    }
    return false;
};

/**
 * Function to copmare two Arrays
 * @param {Array} arr1 first array for comparison
 * @param {Array} arr2 second array for comparison
 *
 * @returns {boolean} are arrays equal
 */
function compareArrays( arr1, arr2 ) {
    if ( !( arr1 && arr2 ) ) {
        return false;
    }
    if ( arr1.length !== arr2.length ) {
        return false;
    }
    for ( var i = arr1.length; i--; ) {
        if ( arr2.indexOf( arr1[i] ) === -1 ) {
            return false;
        }
    }

    return true;
}

/**
 * Function to set style in diagram on hover
 *
 * @param {*} hoveredItem item hovered
 * @param {Object} graphModel graph model
 * @param {Object} activeLegendView active legend view
 */
var setHoverStyle = function( hoveredItem, graphModel, activeLegendView ) {
    _hoveredItem = hoveredItem;
    _timeoutPromise = AwTimeoutService.instance( function() {
        _timeoutPromise = null;
        if ( _hoveredItem.getItemType() === 'Edge' ) {
            setHoverEdgeStyle( _hoveredItem, graphModel, activeLegendView );
        } else if ( _hoveredItem.getItemType() === 'Node' ) {
            setNodeHoverProperty( _hoveredItem, NODE_HOVERED_STYLE_CLASS );
        } else if ( _hoveredItem.getItemType() === 'Port' ) {
            setHoverPortStyle( _hoveredItem, graphModel );
        }
        _hoveredItem = null;
    }, 325 );
};

/**
 * Function to reset style of edge in diagram on unhover/deselection
 *
 * @param {*} unHoveredItem unhovered item
 * @param {*} graphModel graph model
 * @param {Object} activeLegendView active legend view
 */
var resetEdgeStyle = function( unHoveredItem, graphModel, activeLegendView ) {
    var edgeCategory = unHoveredItem.category;
    if ( !edgeCategory || edgeCategory.localeCompare( '' ) === 0 ) {
        return;
    }

    //get edge style from graph legend
    var edgeStyle = _.clone( graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory, activeLegendView ) );
    var unHoveredEdgeStyle = unHoveredItem.style;

    if ( edgeStyle && edgeStyle.sourceArrow && !unHoveredEdgeStyle.sourceArrow ) {
        delete edgeStyle.sourceArrow;
    }
    if ( edgeStyle && edgeStyle.targetArrow && !unHoveredEdgeStyle.targetArrow ) {
        delete edgeStyle.targetArrow;
    }

    if ( unHoveredEdgeStyle && edgeStyle ) {
        unHoveredEdgeStyle = edgeStyle;
        if ( graphModel ) {
            graphModel.graphControl.graph.setEdgeStyle( unHoveredItem, unHoveredEdgeStyle );
        }
    }
};

/**
 * Function to reset style of port in diagram on unhover/deselection
 *
 * @param {*} unHoveredItem unhovered item
 * @param {*} graphModel graph model
 * @param {Object} activeLegendView active legend view
 */
var resetPortStyle = function( unHoveredItem, graphModel, activeLegendView ) {
    var portCategory = unHoveredItem.category;
    if ( !portCategory || portCategory.localeCompare( '' ) === 0 ) {
        return;
    }
    //get edge style from graph legend
    var portStyle = graphLegendSvc.getStyleFromLegend( 'ports', portCategory, activeLegendView );
    var unHoveredPortStyle = unHoveredItem.style;
    if ( unHoveredPortStyle ) {
        if ( portStyle ) {
            unHoveredPortStyle.fillColor = portStyle.fillColor;
        }
        if ( graphModel ) {
            graphModel.graphControl.graph.setPortStyle( unHoveredItem, unHoveredPortStyle );
        }
    }
};

/**
 * Function to set edge style in diagram on hover/selection
 *
 * @param {*} hoveredItem hovered item
 * @param {*} graphModel graph model
 * @param {Object} activeLegendView active legend view
 */
var setHoverEdgeStyle = function( hoveredItem, graphModel, activeLegendView ) {
    var edgeStyle;
    var edgeThicknessOnHover;
    var edgeCategory = hoveredItem.category;
    //get edge style from graph legend
    if ( edgeCategory && edgeCategory.localeCompare( '' ) !== 0 ) {
        edgeStyle = _.clone( graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory, activeLegendView ) );

        if ( edgeStyle && edgeStyle.sourceArrow && !hoveredItem.style.sourceArrow ) {
            delete edgeStyle.sourceArrow;
        }
        if ( edgeStyle && edgeStyle.targetArrow && !hoveredItem.style.targetArrow ) {
            delete edgeStyle.targetArrow;
        }
    }
    if ( edgeStyle ) {
        edgeThicknessOnHover = edgeStyle.thickness * edgeStyle.thicknessMultiplier;
    }
    var hoveredEdgeStyle = hoveredItem.style;
    if ( hoveredEdgeStyle ) {
        hoveredEdgeStyle = _.clone( hoveredEdgeStyle );
        var edgeThickness = hoveredEdgeStyle.thickness;
        if ( edgeThickness !== edgeThicknessOnHover ) {
            hoveredEdgeStyle.thickness = edgeThicknessOnHover;
        }
        if ( graphModel ) {
            graphModel.graphControl.graph.setEdgeStyle( hoveredItem, hoveredEdgeStyle );
        }
    }
    var srcNode = hoveredItem.getSourceNode();
    var tarNode = hoveredItem.getTargetNode();
    if ( srcNode && tarNode ) {
        setNodeHoverProperty( srcNode, NODE_HOVERED_STYLE_CLASS );
        setNodeHoverProperty( tarNode, NODE_HOVERED_STYLE_CLASS );
    }
};

/**
 * Function to set port style in diagram on hover/selection
 *
 * @param {*} hoveredItem hovered item
 * @param {*} graphModel graph model
 */
var setHoverPortStyle = function( hoveredItem, graphModel ) {
    var hoveredPortStyle = hoveredItem.style;
    if ( hoveredPortStyle ) {
        hoveredPortStyle = _.clone( hoveredPortStyle );
        if ( graphModel ) {
            graphModel.graphControl.graph.setPortStyle( hoveredItem, hoveredPortStyle );
        }
    }
};

/*
 * Function to apply the css to source and target nodes on selection of edge in diagram
 */
var setNodeHoverProperty = function( node, hoveredClass ) {
    if ( node ) {
        var bindData = node.getAppObj();
        if ( hoveredClass ) {
            if ( bindData[exports.NODE_HOVERED_CLASS] !== hoveredClass &&
                bindData[exports.TEXT_HOVERED_CLASS] !== hoveredClass ) {
                bindData[exports.NODE_HOVERED_CLASS] = hoveredClass;
                bindData[exports.TEXT_HOVERED_CLASS] = hoveredClass;
            }
        } else {
            bindData[exports.NODE_HOVERED_CLASS] = 'aw-graph-noeditable-area';
            bindData[exports.TEXT_HOVERED_CLASS] = '';
        }
        if ( node.getSVG() ) {
            node.getSVG().bindNewValues( exports.NODE_HOVERED_CLASS );
            node.getSVG().bindNewValues( exports.TEXT_HOVERED_CLASS );
        }
    }
};

var addElemntToArray = function( elementToAdd, array ) {
    if ( elementToAdd && elementToAdd instanceof Array ) {
        if ( array.length > 0 ) {
            _.forEach( elementToAdd, function( element ) {
                var index = array.indexOf( element );

                if ( index < 0 ) {
                    array.push( element );
                }
            } );
        } else {
            array.push.apply( array, elementToAdd );
        }
    } else {
        if ( array && array.length > 0 ) {
            var index = array.indexOf( elementToAdd );

            if ( index < 0 ) {
                array.push( elementToAdd );
            }
        } else {
            array.push( elementToAdd );
        }
    }
};
/*******************************************************************************************************************
 * This function is helper in the visibility condition of selectedOnly and ConverToParent
 *
 * @param {*} graphModel graph model
 * @param {Object} graphState graph state
 */
function updateCommandVisibilityConditions( graphModel, graphState ) {
    var isVisibleSelectedOnlyCmd = false;
    let graphControl = graphModel.graphControl;
    if ( graphControl ) {
        var groupGraph = graphModel.graphControl.groupGraph;
        var selectedNodes = graphControl.getSelected( 'Node' );
        var isGroupSelectedNode = false;
        var parentVisibilityCommand = '';
        var showLabels = false;
        var selectedEdges = graphControl.getSelected( 'Edge' );
        var selectedPorts = graphControl.getSelected( 'Port' );
        var isRoot = true;

        if ( selectedNodes && selectedNodes.length > 0 ) {
            if ( selectedNodes.length === 1 ) {
                var parent = groupGraph.getParent( selectedNodes[0] );
                if ( parent ) {
                    var grandParent = groupGraph.getParent( parent );
                    if ( !grandParent ) {
                        parentVisibilityCommand = 'Hide';
                    }
                } else {
                    parentVisibilityCommand = 'Show';
                }
                if( graphState ) {
                    graphState.parentVisibilityCommand = parentVisibilityCommand;
                }
            }

            isVisibleSelectedOnlyCmd = true;
            // when there is only one node in graph then SelctedOnly Command should not be visible
            if ( graphControl && graphControl.graph.getNodes().length === 1 ) {
                isVisibleSelectedOnlyCmd = false;
            }
            // check if the single selected node is Group node
            if ( groupGraph && groupGraph.isGroup( selectedNodes[0] ) ) {
                isGroupSelectedNode = true;
            }
            _.forEach( selectedNodes, function( nodeItem ) {
                if ( !nodeItem.isRoot() ) {
                    isRoot = false;
                    return false;
                }
            } );

            if( graphState ) {
                graphState.anchorState = isRoot;
                graphState.isGroupSelectedNode = isGroupSelectedNode;
                graphState.isVisibleSelectedOnlyCmd = isVisibleSelectedOnlyCmd;
            }
        } else if( graphState ) {
            graphState.anchorState = false;
        }

        // Update the show/hide label command state
        var selectedTracelinks = [];
        if ( selectedEdges && selectedEdges.length > 0 ) {
            _.forEach( selectedEdges, function( edgeItem ) {
                var label = edgeItem.getLabel();
                if ( !label || !label.isVisible() ) {
                    showLabels = true;
                }

                if ( edgeItem.modelObject && cmm.isInstanceOf( 'FND_TraceLink', edgeItem.modelObject.modelType ) ) {
                    selectedTracelinks.push( edgeItem.modelObject );
                }
            } );
        }

        if ( selectedPorts && selectedPorts.length > 0 ) {
            _.forEach( selectedPorts, function( portItem ) {
                var label = portItem.getLabel();
                if ( !label || !label.isVisible() ) {
                    showLabels = true;
                    return false;
                }
            } );
        }

        graphState.selectedTracelinkCount = selectedTracelinks.length;
        if ( selectedEdges && selectedEdges.length > 0 || selectedPorts && selectedPorts.length > 0 ) {
            graphState.showLabels = showLabels;
        } else {
            graphState.showLabels = true;
            var labelCategories;
            if ( graphState.labelCategories ) {
                labelCategories = graphState.labelCategories;
            }
            _.forEach( labelCategories, function( labelCategory ) {
                if ( labelCategory.categoryState ) {
                    graphState.showLabels = false;
                }
            } );
        }
        updateReconnectCmdCondition( selectedNodes, selectedPorts, selectedEdges, graphModel, graphState );
    }
}

/*******************************************************************************************************************
 * this function will update reconnect connection flag
 *
 * @param {*} selectedNodes selectedNodes
 * @param {*} selectedPorts selectedPorts
 * @param {*} selectedEdges selectedEdges
 * @param {*} graphModel graph model
 * @param {Object} graphState graph state
 */
function updateReconnectCmdCondition( selectedNodes, selectedPorts, selectedEdges, graphModel, graphState ) {
    if ( graphState ) {
        var doShowReconnectCmd = false;
        var isDangledConnectionAlreadySelected = false;

        var selNodes = [];
        var selPorts = [];
        var selEdges = [];

        if ( selectedNodes ) {
            selNodes = selectedNodes;
        }
        if ( selectedPorts ) {
            selPorts = selectedPorts;
        }
        if ( selectedEdges ) {
            selEdges = selectedEdges;
        }
        // set flag doShowReconnectCmd
        if ( appCtxSvc.ctx.mselected.length > 0 ) {
            _.forEach( appCtxSvc.ctx.mselected, function( mselected ) {
                // Check if selection is of type connection.
                if ( cmm.isInstanceOf( 'Awb0Connection', mselected.modelType ) ) {
                    // check if connection is disconnected or dangling
                    var props = mselected.props;
                    if ( props && ( props.ase0ConnectedState.dbValues[0] === 'ase0Disconnected' || props.ase0ConnectedState.dbValues[0] === 'ase0Dangling' ) ) {
                        isDangledConnectionAlreadySelected = true;
                        return false;
                    }
                }
            } );

            if ( isDangledConnectionAlreadySelected ) {
                if ( appCtxSvc.ctx.mselected.length === 1 ) {
                    doShowReconnectCmd = true;
                }
                graphState.doShowReconnectCmd = doShowReconnectCmd;

                return;
            }
        }

        if ( selNodes.length > 0 && selPorts.length === 0 && selEdges.length === 0 ) { // Only Nodes selected
            _.forEach( selNodes, function( selectedNode ) {
                var modelObject = selectedNode.modelObject;
                if ( modelObject ) {
                    const nodeModel = graphModel.dataModel.nodeModels[modelObject.uid];
                    if ( nodeModel && nodeModel.graphItem.hasDanglingConnection ) {
                        doShowReconnectCmd = true;
                        return false;
                    }
                }
            } );
        }

        if ( selNodes.length === 0 && selPorts.length > 0 && selEdges.length === 0 ) { // Only Ports selected
            _.forEach( selPorts, function( selectedPort ) {
                var modelObject = selectedPort.modelObject;
                if ( modelObject ) {
                    var portData = graphModel.dataModel.portModels[modelObject.uid];
                    if ( portData && portData.graphItem.hasDanglingConnection ) {
                        doShowReconnectCmd = true;
                        return false;
                    }
                }
            } );
        }

        graphState.doShowReconnectCmd = doShowReconnectCmd;
    }
}

const exports = {
    NODE_HOVERED_CLASS,
    TEXT_HOVERED_CLASS,
    setDiagramHover,
    setDiagramSelection,
    syncSelectionsInGraph
};
export default exports;
