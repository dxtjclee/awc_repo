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
 * This implements the graph drag and drop handler interface APIs defined by aw-graph widget to provide graph drag and
 * drop functionalities.
 *
 * @module js/Ase0ArchitectureGraphDragAndDropHandler
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var BCN_NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';

var BCN_TEXT_HOVERED_CLASS = 'relation_TEXT_hovered_style_svg';

/**
 * Set the node CSS class for high light / normal status
 *
 * @param {Object} graph - graph interface to update the binding
 * @param {Object} graphItem - graph item needs to highlight or not
 * @param {String} className - CSS name for highlight or not
 */
var setNodeHoveredClass = function( graph, graphItem, className ) {
    if( graphItem && graphItem.getItemType() === 'Node' ) {
        var bindingData = {};
        if( className && className.length > 0 ) {
            bindingData[ BCN_NODE_HOVERED_CLASS ] = className;
            bindingData[ BCN_TEXT_HOVERED_CLASS ] = className;
        } else {
            bindingData[ BCN_NODE_HOVERED_CLASS ] = 'aw-relations-noeditable-area';
            bindingData[ BCN_TEXT_HOVERED_CLASS ] = '';
        }

        graph.updateNodeBinding( graphItem, bindingData );
    }
};

/**
 * Check whether the graph item could be a target of current DnD operation.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingGraphItems - array of the graph items been dragging
 * @param {Object} hoveredGraphItem - the graph item under the dragging cursor, null for empty area of the graph
 * @param {Object} dragEffect - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @return {Boolean} true - the graph item could be the target, otherwise false.
 */
var isDroppable = function( graphModel, draggingGraphItems, hoveredGraphItem, dragEffect ) {
    // Just the check the hovered item and dragging items relations
    if( !hoveredGraphItem ) {
        return true;
    }
    if( hoveredGraphItem.getItemType() !== 'Node' || draggingGraphItems.length <= 0 ) {
        return false;
    }
    if( typeof draggingGraphItems[ 0 ] === 'string' ) {
        // Dragging from outside, such as ACE list
        if( dragEffect === 'COPY' ) {
            if( hoveredGraphItem && !graphModel.graphControl.groupGraph.isGroup( hoveredGraphItem ) ) {
                return false;
            }
            return true;
        }
        return false;
    } else if( draggingGraphItems[ 0 ].getItemType() === 'Node' && graphModel.graphControl.groupGraph.isGroup( hoveredGraphItem ) ) {
        return true;
    }
    return false;
};

/**
 * Check whether the graph item can be dragged
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} graphItems - array of the graph items may be dragged
 * @return {Boolean} - true if the graph item is draggable, otherwise false
 */
var isDraggable = function( graphModel, graphItems ) {
    // In most cases, only the node is draggable
    if( graphItems && graphItems.length > 0 ) {
        for( var i = 0; i < graphItems.length; i++ ) {
            if( graphItems[ i ].getItemType() !== 'Node' && graphItems[ i ].getItemType() !== 'Edge' ) {
                return false;
            }
        }
        return true;
    }
    return false;
};

/**
 * Check whether the graph item can be copied
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} graphItems - array of the graph items may be copied
 * @return {Boolean} - true if the graph item is copyable, otherwise false
 */
var isCopyable = function( graphModel, graphItems ) {
    var isCopyable = true;
    _.forEach( graphItems, function( graphItem ) {
        if( graphItem.getItemType() === 'Node' ) {
            isCopyable = !graphModel.graphControl.groupGraph.isGroup( graphItem );
        } else {
            isCopyable = false;
        }
        if( !isCopyable ) {
            return false;
        }
    } );
    return isCopyable;
};

/**
 * Check whether the graph item can be dragged. It will be called when a DnD gesture maybe starts, and the return
 * value of this API will determine whether DnD can be continued.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} graphItems - array of the graph items may be dragged
 * @param {String} dragEffect - "MOVE"/"COPY"
 * @return {Boolean} - true if the graph item is draggable, otherwise false
 */
export let onGraphDragStart = function( graphModel, graphItems, dragEffect ) {
    if( dragEffect === 'MOVE' ) {
        return isDraggable( graphModel, graphItems );
    } else if( dragEffect === 'COPY' ) {
        return isCopyable( graphModel, graphItems );
    }
    return false;
};

/**
 * API to check whether the graph item can be the target item of the DnD operation
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingGraphItems - array of the graph items been dragging
 * @param {Object} hoveredGraphItem - the graph item under the dragging cursor, null for empty area of the graph
 * @param {String} dragEffect - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @param {Object[]} outItems - the dragging graph items just out of graph items, the app can update the status when
 *            the DnD out of some graph items.
 * @param {PointD} cursorLocation - the cursor location
 * @return {Boolean} - true if the hoveredGraphItem is a valid droppable graph item, otherwise false
 */
export let onGraphDragOver = function( graphModel, draggingGraphItems, hoveredGraphItem, dragEffect, outItems,
    cursorLocation ) {
    if( !cursorLocation ) {
        return false;
    }

    // High light the graph item under the cursor
    var graph = graphModel.graphControl.graph;
    var droppable = isDroppable( graphModel, draggingGraphItems, hoveredGraphItem, dragEffect );
    if( hoveredGraphItem && droppable ) {
        setNodeHoveredClass( graph, hoveredGraphItem, 'aw-relationshipbrowser-nodeHovered' );
    }

    // Turn off the high light effect.
    if( outItems && outItems.length > 0 ) {
        for( var index = 0; index < outItems.length; index++ ) {
            setNodeHoveredClass( graph, outItems[ index ], null );
        }
    }
    return droppable;
};

/**
 * Set parent of a node
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} dummyNode - array of the graph items been dragging
 * @param {Object} targetGraphItem - the target graph item, opened Element object for empty area of the graph
 */
var setParent = function( graphModel, dummyNode, targetGraphItem ) {
    if( dummyNode && dummyNode.getItemType() === 'Node' && targetGraphItem ) {
        var groupGraph = graphModel.graphControl.groupGraph;

        if( typeof targetGraphItem.getItemType === 'function' && targetGraphItem.getItemType() === 'Node' ) {
            if( groupGraph.getParent( dummyNode ) ) {
                groupGraph.setParent( null, dummyNode );
            }
            // The target is an expanded group node
            if( groupGraph.isGroup( targetGraphItem ) && groupGraph.isExpanded( targetGraphItem ) ) {
                groupGraph.setParent( targetGraphItem, [ dummyNode ] );
            }
        } else {
            //if the node is dropped in empty area and the opened element is where the node is getting added
            //And the opened element is on diagram
            const parentGraphNodeModel = graphModel.dataModel.nodeModels[ targetGraphItem.modelObject.uid ];
            if( parentGraphNodeModel ) {
                const parentGraphNode = parentGraphNodeModel.graphItem;
                if( groupGraph.isGroup( parentGraphNode ) && groupGraph.isExpanded( parentGraphNode ) ) {
                    groupGraph.setParent( parentGraphNode, [ dummyNode ] );
                }
            }
        }
    }
};

/**
 * Create an new node based on the dragging node
 * @param {Object} graphModel - the graph model object
 * @param {Object} draggingGraphItem - dragged graph item
 * @param {Object} targetGraphItem - the target graph item, opened Element object for empty area of the graph
 * @param {PointD} dragDelta - the cursor location
 * @return {object} dummy node- created from dragged node.
 */
var createNewNode = function( graphModel, draggingGraphItem, targetGraphItem, dragDelta ) {
    var graph = graphModel.graphControl.graph;
    var rectNode = graph.getBounds( draggingGraphItem );
    var xPointD = rectNode.x + dragDelta.x;
    var yPointD = rectNode.x + dragDelta.x;
    rectNode.x = xPointD;
    rectNode.y = yPointD;
    var nodeStyle = _.clone( draggingGraphItem.style, true );
    var nodeBindingData = _.clone( draggingGraphItem.getAppObj(), true );
    return graph.createNodeWithBoundsStyleAndTag( rectNode, nodeStyle, nodeBindingData );
};

/**
 * API to be called when the graph item being dropped on the targetGraphModel
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingGraphItems - array of the graph items been dragging
 * @param {Object} targetGraphItem - the target graph item, null for empty area of the graph
 * @param {String} dragEffect - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @param {PointD} cursorLocation - the cursor location
 * @param {PointD} dragDelta - the cursor location
 *
 * @return {Boolean} - true if the app handle the gesture normally, otherwise false to let the GC handle it.
 */
export let onGraphDrop = function( graphModel, draggingGraphItems, targetGraphItem, dragEffect, cursorLocation,
    dragDelta ) {
    if( !isDroppable( graphModel, draggingGraphItems, targetGraphItem, dragEffect ) ) {
        return false;
    }

    if( draggingGraphItems && draggingGraphItems.length <= 0 ) {
        return false;
    }

    var graph = graphModel.graphControl.graph;
    var isDragWithinDiagram = true;

    //if dragging item is type of string that means its being dragged from outside graph
    if( typeof draggingGraphItems[ 0 ] === 'string' ) {
        isDragWithinDiagram = false;
    }

    var location = [ cursorLocation.x + ':' + cursorLocation.y ];
    if( !targetGraphItem ) {
        if( isDragWithinDiagram ) {
            var eventData = {
                draggingGraphItems: draggingGraphItems,
                dragDelta: dragDelta,
                anchor: true,
                graphModel
            };
            eventBus.publish( 'AMGraphEvent.dropNodeOnOpenedElement', eventData );
        } else {
            toggleVisibilityOnDrop( graphModel, draggingGraphItems, location );
        }
    } else {
        if( graphModel.graphControl.groupGraph.isGroup( targetGraphItem ) ) {
            var nodeRect = graph.getBounds( targetGraphItem );
            var nodeHeaderHeight = targetGraphItem.getAppObj().HEADER_HEIGHT;
            if(  cursorLocation.y - nodeRect.y  > nodeHeaderHeight ) {
                if( isDragWithinDiagram ) {
                    createOccurrance( graphModel, draggingGraphItems, targetGraphItem, dragDelta, false );
                } else {
                    toggleVisibilityOnDrop( graphModel, draggingGraphItems, location );
                }
            } else {
                var targets = [];
                _.forEach( draggingGraphItems, function( dragItem ) {
                    var object = cdm.getObject( dragItem );
                    if( object ) {
                        targets.push( object );
                    }
                } );
                var eventData = {
                    sourceObject: targetGraphItem.modelObject,
                    targetObjects: targets
                };
                eventBus.publish( 'AMGraphEvent.createTracelinkOnDnd', eventData );
            }
        }
    }

    // Turn off the highlight effect
    setNodeHoveredClass( graph, targetGraphItem, null );
    return true;
};

var newdropNodeOnOpenedElement = function( data, occContext ) {
    var targetItem = {
        modelObject: occContext.openedElement
    };

    createOccurrance( data.graphModel, data.draggingGraphItems, targetItem, data.dragDelta, true );
};

//create occurance if drag and drop withing diagram
var createOccurrance = function( graphModel, draggingGraphItems, targetGraphItem, dragDelta, anchor ) {
    if( dragDelta && draggingGraphItems.length > 0 ) {
        var dummyNodes = [];
        _.forEach( draggingGraphItems, function( draggingGraphItem ) {
            var dummyNode = createNewNode( graphModel, draggingGraphItem, targetGraphItem, dragDelta );
            dummyNode.modelObject = draggingGraphItem.modelObject;
            dummyNode.categoryType = draggingGraphItem.appData.category;
            dummyNodes.push( dummyNode );
            if( targetGraphItem && dummyNodes.length > 0 ) {
                setParent( graphModel, dummyNode, targetGraphItem );
            }
        } );
        if( dummyNodes.length > 0 ) {
            var eventData = {
                nodes: dummyNodes,
                parentNode: targetGraphItem,
                isDragCreate: true,
                isAnchor: anchor
            };
            eventBus.publish( 'AMGraphEvent.createOccuranceOnDnd', eventData );
        }
    }
};

//toggle visibility of the dragged element if not in diagram from outside graph
var toggleVisibilityOnDrop = function( graphModel, draggingGraphItems, location ) {
    var dragItemList = [];
    _.forEach( draggingGraphItems, function( dragItem ) {
        var addedObject = cdm.getObject( dragItem );
        //check if the element is not in graph then add it to addObjectList
        if( !graphModel.dataModel.nodeModels[ addedObject.uid ] && !graphModel.dataModel.edgeModels[ addedObject.uid ] ) {
            dragItemList.push( addedObject );
        }
    } );
    if( dragItemList.length > 0 ) {
        var eventData = {
            elementsToAdd: dragItemList,
            positionInfo: location
        };
        eventBus.publish( 'AM.toggleOnVisibilityEvent', eventData );
    }
};

const exports = {
    onGraphDragStart,
    onGraphDragOver,
    onGraphDrop,
    newdropNodeOnOpenedElement
};
export default exports;
