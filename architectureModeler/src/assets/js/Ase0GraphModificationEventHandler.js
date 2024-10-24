// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0GraphModificationEventHandler
 */
import dataCacheSvc from 'js/Ase0ArchitectureDataCache';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import portService from 'js/Ase0ArchitecturePortService';

export let handleGraphItemsMoved = function( items, graphModel ) {
    var movedNodes = [];
    var movedPorts = [];
    var movedLabels = [];
    if( items ) {
        items.forEach( function( element ) {
            if( element.getItemType() === 'Node' ) {
                movedNodes.push( element );
            } else if( element.getItemType() === 'Port' ) {
                movedPorts.push( element );
            } else if( element.getItemType() === 'Label' ) {
                movedLabels.push( element );
            }
        } );
        var layout;
        if( graphModel.graphControl ) {
            layout = graphModel.graphControl.layout;
        }
        if( layout && layout.isActive() && ( movedNodes.length > 0 || movedPorts.length > 0 ) ) {
            layout.applyUpdate( function() {
                _.forEach( movedNodes, function( node ) {
                    layout.moveNode( node );
                } );

                if( layout.type === 'IncUpdateLayout' ) {
                    _.forEach( movedPorts, function( port ) {
                        layout.movePort( port );
                    } );
                }
            } );
        }
        if( movedNodes.length > 0 || movedPorts.length > 0 || movedLabels.length > 0 ) {
            logger.info( 'fire Diagram Modified Event' );
            eventBus.publish( 'AMDiagram.Modified', {} );
        }
    }
};

export let handleGraphItemsAdded = function( graphModel, addedBoundaries, graphState ) {
    var graph;
    var isDiagramEmpty = true;
    const graphStateValue = { ...graphState.value };
    if( graphModel && graphModel.graphControl ) {
        graph = graphModel.graphControl.graph;
    }
    if( graph ) {
        var allVisibleGraphItems = [];
        allVisibleGraphItems.push.apply( allVisibleGraphItems, graph.getVisibleNodes() );
        allVisibleGraphItems.push.apply( allVisibleGraphItems, graph.getVisibleEdges() );
        allVisibleGraphItems.push.apply( allVisibleGraphItems, graph.getVisiblePorts() );
        isDiagramEmpty = allVisibleGraphItems.length === 0;
    }
    graphStateValue.isEmpty = isDiagramEmpty;

    if( addedBoundaries && addedBoundaries.length > 0 ) {
        _.set( graphStateValue, 'hasPendingChanges', true );
        eventBus.publish( 'StartSaveAutoBookmarkEvent' );
    }
    graphState.update && graphState.update( graphStateValue );
};

export let handleGraphItemsRemoved = function( data, graphModel, removedNodes, removedEdges, removedPorts, graphState, primarySelection ) {
    var graph;
    var isDiagramEmpty = true;
    let newPrimarySelection = { ...primarySelection.value };
    const graphStateValue = { ...graphState.value };
    var elementsToBeRemoved = [];
    if( graphModel && graphModel.graphControl ) {
        // update cache
        var nodesToBeRemoved = [];
        if( removedNodes && removedNodes.length > 0 ) {
            _.forEach( removedNodes, function( node ) {
                var nodeObj = node.modelObject;
                if( nodeObj ) {
                    nodesToBeRemoved.push( nodeObj.uid );
                    if( node.isRoot() ) {
                        var nodeUid = nodeObj.uid;
                        //To keep root node list updated with current changes, remove node from root node list
                        var rootNodeList = graphModel.rootNodeList;
                        var index = rootNodeList.indexOf( nodeUid );
                        if( index > -1 ) {
                            rootNodeList.splice( index, 1 );
                        }
                    }
                    // update elements to be removed
                    elementsToBeRemoved.push( nodeObj );
                }
            } );

            dataCacheSvc.removeNodeCache( nodesToBeRemoved );
        }

        var edgesToBeRemoved = [];
        if( removedEdges && removedEdges.length > 0 ) {
            _.forEach( removedEdges, function( edge ) {
                var edgeObj = edge.modelObject;
                if( edgeObj ) {
                    edgesToBeRemoved.push( edgeObj.uid );
                    // update elements to be removed
                    elementsToBeRemoved.push( edgeObj );
                }
            } );
            dataCacheSvc.removeEdgeCache( edgesToBeRemoved );
        }

        var portsToBeRemoved = [];
        if( removedPorts && removedPorts.length > 0 ) {
            _.forEach( removedPorts, function( port ) {
                var portObj = port.modelObject;
                if( portObj ) {
                    portsToBeRemoved.push( portObj.uid );
                    // update elements to be removed
                    elementsToBeRemoved.push( portObj );
                }
            } );
            dataCacheSvc.removePortCache( portsToBeRemoved );
            portService.evaluateShowPortsCondition( graphModel, graphStateValue );
        }

        // Fires AMManageDiagramEvent event to call manageDiagram2 SOA for removing  objects from diagram.
        if( elementsToBeRemoved && elementsToBeRemoved.length > 0 && data.isItemRemovedFromDiagram ) {
            var eventData1 = {
                userAction: 'RemoveFromDiagram',
                elementsToRemove: elementsToBeRemoved
            };
            eventBus.publish( 'AMManageDiagramEvent', eventData1 );
        }

        graph = graphModel.graphControl.graph;
    }
    if( graph ) {
        var allVisibleGraphItems = [];
        allVisibleGraphItems.push.apply( allVisibleGraphItems, graph.getVisibleNodes() );
        allVisibleGraphItems.push.apply( allVisibleGraphItems, graph.getVisibleEdges() );
        allVisibleGraphItems.push.apply( allVisibleGraphItems, graph.getVisiblePorts() );
        isDiagramEmpty = allVisibleGraphItems.length === 0;
    }
    graphStateValue.isEmpty = isDiagramEmpty;

    if( !data.isItemRemovedFromDiagram ) {
        var graphSelections = _.filter( graphModel.graphControl.getSelected(), function( selectedItem ) {
            if( selectedItem.getItemType() !== 'Boundary' ) {
                return selectedItem.modelObject;
            }
        } );

        // Updating selections on some/all graph items removed
        if( graphSelections && graphSelections.length > 0 ) {
            var graphSelectionObjects = _.map( graphSelections, 'modelObject' );
            newPrimarySelection.selected = graphSelectionObjects;
        } else {
            newPrimarySelection = {
                nodeModels: [],
                edgeModels: [],
                portModels: [],
                annotations: [],
                selected: []
            };
            graphStateValue.selectedTracelinkCount = 0;
        }
        primarySelection.update( newPrimarySelection );
    } else {
        // Unset ItemRemovedFromDiagram Flag
        data.dispatch( { path: 'data.isItemRemovedFromDiagram',   value: false } );
    }
    graphState.update && graphState.update( graphStateValue );
};

const exports = {
    handleGraphItemsMoved,
    handleGraphItemsAdded,
    handleGraphItemsRemoved
};
export default exports;
