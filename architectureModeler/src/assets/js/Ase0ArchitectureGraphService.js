// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitectureGraphService
 */
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import nodeService from 'js/Ase0ArchitectureNodeService';
import portService from 'js/Ase0ArchitecturePortService';
import edgeService from 'js/Ase0ArchitectureEdgeService';
import archDataCache from 'js/Ase0ArchitectureDataCache';
import labelService from 'js/Ase0ArchitectureLabelService';
import annotationService from 'js/Ase0AnnotationService';
import autoLayoutHandler from 'js/Ase0ArchitectureAutoLayoutHandler';
import dmSvc from 'soa/dataManagementService';
import nodeCommandService from 'js/Ase0ArchitectureNodeCommandService';
import notyService from 'js/NotyModule';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import graphLegendSvc from 'js/graphLegendService';
import graphViewModeService from 'js/graphViewModeService';
import graphUtils from 'js/graphUtils';
import logger from 'js/logger';
import cdm from 'soa/kernel/clientDataModel';
import diagramSaveService from 'js/Ase0ArchitectureDiagramSaveService';

let _productContextChanged = null;

/*
 * method to fire event based on event details in queue after manageDiagram2 SOA completion.
 */
export let handleManageDiagram2Complete = function( manageDiagramQueue, graphData ) {
    var completeEventsFromQueue = null;
    if( !graphData ) {
        return;
    }
    _.forEach( manageDiagramQueue, function( manageDiagramCompleteEventDetails, eventDetailsIdx ) {
        _.forEach( manageDiagramCompleteEventDetails.clientIds, function( clientId ) {
            var graphDataClientId = null;
            if( graphData.output && graphData.output.length > 0 &&
                graphData.output[ 0 ].clientId ) {
                graphDataClientId = graphData.output[ 0 ].clientId;
            } else if( graphData.ServiceData && graphData.ServiceData.partialErrors &&
                graphData.ServiceData.partialErrors.length > 0 && graphData.ServiceData.partialErrors[ 0 ].clientId ) {
                graphDataClientId = graphData.ServiceData.partialErrors[ 0 ].clientId;
            }
            if( graphDataClientId && graphDataClientId === clientId ) {
                completeEventsFromQueue = manageDiagramCompleteEventDetails.eventsToFire;
                _.pullAt( manageDiagramQueue, eventDetailsIdx );
                return false;
            }
        } );
        if( completeEventsFromQueue ) {
            return false;
        }
    } );

    if( completeEventsFromQueue ) {
        _.forEach( completeEventsFromQueue, function( manageDiagramCompleteEvent ) {
            var clonedGraphData = _.clone( graphData );
            _.set( manageDiagramCompleteEvent, 'eventData.graphData', clonedGraphData );
            eventBus.publish( manageDiagramCompleteEvent.eventName, manageDiagramCompleteEvent.eventData );
        } );
        if( graphData.output && graphData.output.length > 0 && graphData.output[ 0 ].diagramInfo &&
            graphData.output[ 0 ].diagramInfo.associateIDNotification &&
            graphData.output[ 0 ].diagramInfo.associateIDNotification.length > 0 ) {
            notyService.showInfo( graphData.output[ 0 ].diagramInfo.associateIDNotification[ 0 ] );
        }
    }
};

/*
 * method to set label filter categories
 */
var setLabelFilters = function( labelFilters, graphState ) {
    if( graphState && graphState.labelCategories && !_.isEmpty( graphState.labelCategories ) ) {
        var labelCategories = graphState.labelCategories;

        _.forEach( labelFilters, function( labelFilter ) {
            var labelCategory = _.find( labelCategories, {
                internalName: labelFilter
            } );

            if( labelCategory ) {
                labelCategory.categoryState = true;
                graphState.showLabels = false;
            }
        } );
    }
};

/*
 * method to set view mode in graph and context
 */
var setViewMode = function( diagramInfo, graph, graphState ) {
    if( diagramInfo.viewMode && diagramInfo.viewMode.length > 0 ) {
        if( graphState.viewMode ) {
            if( graphState.viewMode !== 'Ase0NetworkView' ) {
                graph.setNetworkMode( false );
            } else {
                graph.setNetworkMode( true );
            }
        } else {
            graph.setNetworkMode( diagramInfo.viewMode[ 0 ] === 'NetworkView' );
            if( graph.isNetworkMode() ) {
                graphState.viewMode = 'Ase0NetworkView';
            } else {
                graphState.viewMode = 'Ase0NestedView';
            }
        }
    } else {
        graphState.viewMode = 'Ase0NestedView';
    }
};

/*
 * method to set license state in context also
 * disable start authoring and graph items positioning if license not present
 */
var processLicenseState = function( hasSystemModelerLicense, graphModel ) {
    let prefValue = appCtxSvc.getCtx( 'preferences.MBSE_AM_EnableEditing' );
    if ( ( typeof prefValue === 'undefined' || prefValue[0] === 'False' || prefValue[0] === 'false' || !hasSystemModelerLicense ) && graphModel ) {
        // Disable start authoring
        graphModel.update( 'config.enableEdit', false );
        // Disable graph items positioning
        graphModel.update( 'config.movableItems', [] );
    }
};

/*
 * method to process diagramInfo from manageDiagram2 SOA response and update graph
 */
var processDiagramInfo = function( diagramInfo, graphModel, graphContext, data, isOpenDiagram, pageState, graphState, occContext ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    let newLegendState = { ...graphContext.legendState };

    //clear old filters and add recalled filter into legendState
    if( isOpenDiagram ) {
        graphLegendSvc.clearFilter( graphModel, newLegendState );
        graphLegendSvc.clearLegend( graphModel, newLegendState, graphContext.legendData.legendViews );
        newLegendState.activeView.expand = true;
        newLegendState.activeView.showEnabled = true;
        newLegendState.activeView.filteredCategories = [];
        graphContext.legendState.update && graphContext.legendState.update( null, newLegendState );

        //Disable drag and drop in context of project model
        if( occContext && occContext.topElement
            && cmm.isInstanceOf( 'Uml1ModelElement', occContext.topElement.modelType ) ) {
            disableDragInProjectModelContext( graphModel );
        } else if( occContext.productContextInfo && occContext.productContextInfo.uid ) {
            if( _.invert( occContext.elementToPCIMap )[ occContext.productContextInfo.uid ] ) {
                var modelObj = cdm.getObject( _.invert( occContext.elementToPCIMap )[ occContext.productContextInfo.uid ] );
                if( modelObj && modelObj.modelType && cmm.isInstanceOf( 'Uml1ModelElement', modelObj.modelType ) ) {
                    disableDragInProjectModelContext( graphModel );
                }
            }
        }
    }

    if( diagramInfo.hasSystemModelerLicense && diagramInfo.hasSystemModelerLicense.length > 0 ) {
        var hasSystemModelerLicense = diagramInfo.hasSystemModelerLicense[ 0 ] === 'true';
        pageState.hasSystemModelerLicense = hasSystemModelerLicense;
        processLicenseState( hasSystemModelerLicense, graphModel );
    }

    if( diagramInfo.nodeOpacityPropertyName && diagramInfo.nodeOpacityPropertyName.length > 0 ) {
        data.nodeOpacityPropName = diagramInfo.nodeOpacityPropertyName[ 0 ];
    }

    if( diagramInfo.autoLayoutState && diagramInfo.autoLayoutState.length > 0 ) {
        var autoLayoutState = diagramInfo.autoLayoutState[ 0 ] === 'true';
        graphState.isAutoLayoutOn = autoLayoutState;
        if( diagramInfo.autoLayoutState[ 0 ] === 'false' ) {
            autoLayoutHandler.disableAutoLayout( graphModel, graphState );
        }
    }

    if( diagramInfo.layout && diagramInfo.layout.length > 0 ) {
        graphModel.config.layout.defaultOption = architectureLayoutService.LayoutDirections[ diagramInfo.layout[ 0 ] ];
    }

    if( diagramInfo.zoomLevel && diagramInfo.zoomLevel.length > 0 ) {
        graphControl.setZoom( Number( diagramInfo.zoomLevel[ 0 ] ) );
    }

    if( diagramInfo.viewPoint && diagramInfo.viewPoint.length > 0 ) {
        var positions = diagramInfo.viewPoint[ 0 ].split( ':' );

        if( positions.length === 2 ) {
            var viewPoint = _.clone( graphControl.getViewPoint() );

            viewPoint.x = Number( positions[ 0 ] );
            viewPoint.y = Number( positions[ 1 ] );
            graphControl.setViewPoint( viewPoint );
        }
    }

    setViewMode( diagramInfo, graph, graphState );

    if( diagramInfo.objectFilters && diagramInfo.objectFilters.length > 0 ) {
        archGraphLegendManager.setCategoryFilters( 'objects', diagramInfo.objectFilters, newLegendState.activeView );
    }

    if( diagramInfo.relationFilters && diagramInfo.relationFilters.length > 0 ) {
        archGraphLegendManager.setCategoryFilters( 'relations', diagramInfo.relationFilters, newLegendState.activeView );
    }

    if( diagramInfo.portFilters && diagramInfo.portFilters.length > 0 ) {
        archGraphLegendManager.setCategoryFilters( 'ports', diagramInfo.portFilters, newLegendState.activeView );
    }
    graphState.showLabels = true;
    if( diagramInfo.labelFilters && diagramInfo.labelFilters.length > 0 ) {
        setLabelFilters( diagramInfo.labelFilters, graphState );
    }

    // Process Annotations
    annotationService.processAnnotationData( newLegendState.activeView, graphModel, diagramInfo );

    if( isOpenDiagram ) {
        graphLegendSvc.registerFilter( graphModel, newLegendState );
    }
    setGridOptions( graphModel, diagramInfo.gridOptions, graphState );
};

const disableDragInProjectModelContext = function( graphModel ) {
    if( graphModel ) {
        // Disable start authoring
        graphModel.update( 'config.enableEdit', false );
        // Disable graph items drag and drop
        graphModel.update( 'config.dragAndDropModifierKey', {} );
    }
};

var setGridOptions = function( graphModel, gridOptions, graphState ) {
    var graph = graphModel.graphControl.graph;
    var preferences = graphModel.graphControl.grid.preferences;
    if( gridOptions ) {
        graph.update( function() {
            preferences.enabled = true;
            //when grid is on it makes minor and major line on by default, so making it off initially
            preferences.showMajorLines = false;
            preferences.showMinorLines = false;
            if( _.includes( gridOptions, 'Ase0MajorLines' ) ) {
                preferences.showMajorLines = true;
            }
            if( _.includes( gridOptions, 'Ase0MinorLines' ) ) {
                preferences.showMinorLines = true;
            }
            if( _.includes( gridOptions, 'Ase0SnapToGrid' ) ) {
                preferences.enableSnapping = true;
            }
        } );
    }

    // Don't update the architecture graph state values from the floating graph
    if( !graphModel.config.aName ) {
        if( graphState ) {
            graphState.gridOptions = preferences.enabled;
            graphState.Ase0MajorLines = preferences.showMajorLines;
            graphState.Ase0MinorLines = preferences.showMinorLines;
            graphState.Ase0SnapToGrid = preferences.enableSnapping;
        } else {
            graphState = {
                gridOptions: preferences.enabled,
                Ase0MajorLines: preferences.showMajorLines,
                Ase0MinorLines: preferences.showMinorLines,
                Ase0SnapToGrid: preferences.enableSnapping
            };
        }
    }
};

var getChildNodes = function( graphModel, node ) {
    var childNodes = [];
    var children = nodeService.getVisibleChildNodes( node, graphModel );
    if( children && children.length > 0 ) {
        childNodes = childNodes.concat( children );
        _.forEach( children, function( child ) {
            var children1 = nodeService.getVisibleChildNodes( child, graphModel );
            if( children1 && children1.length > 0 ) {
                childNodes = childNodes.concat( children1 );
            }
        } );
    }
    return childNodes;
};

var getAffectedNodeList = function( addedEdges, addedNodes, graphModel ) {
    var affectedNodeList = [];
    var groupedGraph = graphModel.graphControl.groupGraph;
    if( addedNodes && addedNodes.length > 0 ) {
        affectedNodeList = affectedNodeList.concat( addedNodes );
        _.forEach( addedNodes, function( node ) {
            var parentNode = groupedGraph.getParent( node );
            if( parentNode && parentNode.isVisible() ) {
                affectedNodeList.push( parentNode );
            }
            var childNodes = getChildNodes( graphModel, node );
            if( childNodes && childNodes.length > 0 ) {
                affectedNodeList = affectedNodeList.concat( childNodes );
            }
        } );
    }

    if( addedEdges && addedEdges.length > 0 ) {
        _.forEach( addedEdges, function( edge ) {
            if( edge.modelObject ) {
                var isConnection = cmm.isInstanceOf( 'Awb0Connection', edge.modelObject.modelType );
                if( isConnection ) {
                    var parentNode = groupedGraph.getParent( edge );
                    if( parentNode && parentNode.isVisible() ) {
                        //affectedNodeList.push( parentNode );
                    }
                }
            }

            var srcNode = edge.getSourceNode();
            if( srcNode && srcNode.isVisible() ) {
                affectedNodeList.push( srcNode );
            }
            var tarNode = edge.getTargetNode();
            if( tarNode && tarNode.isVisible() ) {
                affectedNodeList.push( tarNode );
            }
        } );
    }

    if( affectedNodeList && affectedNodeList.length > 0 ) {
        affectedNodeList = _.uniq( affectedNodeList );
    }
    return affectedNodeList;
};

var _drawGraph = function( graphData, data, isOpenDiagram, graphContext, pageState, graphState, occContext ) {
    var activeLegendView = null;
    var graphModel = data.graphModel;
    if( graphContext && graphContext.legendState && graphContext.legendState.activeView ) {
        activeLegendView = graphContext.legendState.activeView;
    }

    if( graphData && graphData.output && graphData.output.length > 0 ) {
        if( graphData.output[ 0 ].diagramInfo && graphContext.legendState ) {
            processDiagramInfo( graphData.output[ 0 ].diagramInfo, graphModel, graphContext, data, isOpenDiagram, pageState, graphState, occContext );
        }

        if( !graphModel.rootNodeList ) {
            graphModel.rootNodeList = [];
        }
        _.forEach( graphData.output, function( ouput ) {
            _.forEach( ouput.nodeData, function( nodeInformation ) {
                var nodeInfo = nodeInformation.nodeInfo;
                var isAnchor = false;
                if( nodeInfo.isAnchor[ 0 ] === '1' ) {
                    isAnchor = true;
                }
                if( isAnchor && data.graphModel.rootNodeList.indexOf( nodeInformation.node.uid ) < 0  ) {
                    data.graphModel.rootNodeList.push( nodeInformation.node.uid );
                }
            } );
        } );
    }

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    architectureLayoutService.clearGraphItemLists();

    if( graphData && graphData.output && graphData.output.length > 0 ) {
        archDataCache.setDiagramInfo( graphData.output );
    }
    var returnData = nodeService.processNodeData( activeLegendView, graphModel, graphData, data, isOpenDiagram );
    var addedNodes = returnData.addedNodes;
    var isKeepPosition = returnData.isKeepPosition;

    returnData = portService.processPortData( activeLegendView, graphModel, graphData, isOpenDiagram, graphState );

    var addedPorts = returnData.addedPorts;

    isKeepPosition = isKeepPosition && returnData.isKeepPosition;
    returnData = edgeService.processEdgeData( activeLegendView, graphModel, graphData, isOpenDiagram, graphState );
    isKeepPosition = isKeepPosition && returnData.isKeepPosition;

    var addedEdges = returnData.addedEdges;

    handleCollapsedNodes( graphModel, graphData, isOpenDiagram, addedNodes );

    if( !graphModel.categoryApi ) {
        archGraphLegendManager.initGraphCategoryApi( graphModel );
    }

    //apply graph filters and notify item added event
    graph.updateOnItemsAdded( [].concat( addedNodes, addedEdges, addedPorts ) );

    //update the edge style as per filtered data
    edgeService.updateEdgeStyle( graphModel, activeLegendView );

    if( addedNodes.length > 0 || addedEdges.length > 0 ) {
        var affectedNodeList = getAffectedNodeList( addedEdges, addedNodes, graphModel );
        if( affectedNodeList.length > 0 ) {
            nodeCommandService.updateGraphInfoOnNodes( affectedNodeList, graphModel, data, graphContext.legendState.activeView );
        }
    }

    var itemsRemoved = [];
    var itemsAdded = [];
    if( addedNodes.length > 0 ) {
        itemsAdded.push.apply( itemsAdded, addedNodes );
    }
    if( addedPorts.length > 0 ) {
        itemsAdded.push.apply( itemsAdded, addedPorts );
    }
    if( addedEdges.length > 0 ) {
        itemsAdded.push.apply( itemsAdded, addedEdges );
    }

    modelChanged( itemsAdded, itemsRemoved, graphModel, graphState );

    return isKeepPosition;
};

/*
 * method to process manageDiagram2 SOA response and draw graph items(nodes, edges, ports, annotations) in graph
 */
export let drawGraph = function( graphData, data, isOpenDiagram, isApplyGlobalLayout, graphContext, pageState, graphState, occContext ) {
    const newPageState = { ...pageState };
    const graphStateValue = { ...graphState.value };
    var graphModel = data.graphModel;
    var graphControl = graphModel.graphControl;
    data.isRecall = isOpenDiagram;

    var isKeepPosition = false;
    if( data.isInitialGraph || data.isRecall ) {
        //suppress graph change for performance
        graphControl.suppressGraphChanged( function() {
            isKeepPosition = _drawGraph( graphData, data, isOpenDiagram, graphContext, newPageState, graphStateValue, occContext );
        } );
        appCtxSvc.updatePartialCtx( 'graph.appActionObj', data.atomicDataRef.actionState );
    } else {
        isKeepPosition = _drawGraph( graphData, data, isOpenDiagram, graphContext, newPageState, graphStateValue, occContext );
    }

    applyGraphLayout( data, isKeepPosition, isOpenDiagram, isApplyGlobalLayout, graphStateValue );

    if ( isOpenDiagram ) {
        // set isModelChangeDueToOpenDiagram flag
        graphStateValue.isModelChangeDueToOpenDiagram = isOpenDiagram;
    }

    pageState.update( newPageState );
    graphState.update && graphState.update( graphStateValue );
};

var applyGraphLayout = function( data, isKeepPosition, isOpenDiagram, isApplyGlobalLayout, graphState ) {
    if( data && data.graphModel ) {
        architectureLayoutService.applyGraphLayout( data.graphModel, isKeepPosition, isOpenDiagram, isApplyGlobalLayout, graphState.isAutoLayoutOn );
        var graphControl = data.graphModel.graphControl;

        if( isApplyGlobalLayout ) {
            data.archGraphModel.isGraphFitted = true;
        } else if( !isKeepPosition && !data.archGraphModel.isGraphFitted ) {
            graphControl.fitGraph();
            data.archGraphModel.isGraphFitted = true;
        }
    }
};

/*
 * method to set group nodes in graph to collapsed based isExpand flag from manageDiagram2 SOA response
 */
var handleCollapsedNodes = function( graphModel, graphData, isOpenDiagram, addedNodes ) {
    var graphControl = graphModel.graphControl;
    var groupGraph = graphControl.groupGraph;

    if( graphData && graphData.output ) {
        _.forEach( graphData.output, function( output ) {
            _.forEach( output.nodeData, function( nodeInformation ) {
                const nodeModel = graphModel.dataModel.nodeModels[ nodeInformation.node.uid ];
                const node = nodeModel?.graphItem;
                if( node && groupGraph.isGroup( node ) && _.indexOf( addedNodes, node ) !== -1 ) {
                    if( nodeInformation.nodeInfo.isExpand.length > 0 && nodeInformation.nodeInfo.isExpand[ 0 ] === '0' ) {
                        if( !isOpenDiagram ) {
                            groupGraph.setExpanded( node, false );
                            architectureLayoutService.removeGroupNodeToExpand( node );
                        } else {
                            node.setExpanded( false );
                        }
                    } else if( !groupGraph.isExpanded( node ) ) {
                        groupGraph.setExpanded( node, true );
                        if( !isOpenDiagram ) {
                            architectureLayoutService.addGroupNodeToExpand( node );
                        }
                    }
                }
            } );
        } );
    }
};

export let updateModelOnObjectChanged = function( modifiedObjects, graphModel, data ) {
    var nodeToUpdate = [];
    var edgeToUpdate = [];
    var portToUpdate = [];

    if( modifiedObjects && modifiedObjects.length > 0 && graphModel && graphModel.dataModel ) {
        _.forEach( modifiedObjects, function( modelObject ) {
            const nodeModel = graphModel.dataModel.nodeModels[ modelObject.uid ];
            if( nodeModel ) {
                nodeToUpdate.push( nodeModel.graphItem );
                return true;
            }

            var isConnection = false;
            isConnection = cmm.isInstanceOf( 'Awb0Connection', modelObject.modelType );
            if( !isConnection ) {
                var keys = Object.keys( graphModel.dataModel.edgeModels );
                _.forEach( keys, function( key ) {
                    if( key.indexOf( modelObject.uid ) !== -1 ) {
                        const edgeModel = graphModel.dataModel.edgeModels[ key ];
                        if( edgeModel ) {
                            edgeToUpdate.push( edgeModel.graphItem );
                        }
                    }
                } );
                if( edgeToUpdate.length > 0 ) {
                    return true;
                }
            } else {
                const edgeModel = graphModel.dataModel.edgeModels[ modelObject.uid ];
                if( edgeModel ) {
                    edgeToUpdate.push( edgeModel.graphItem );
                    return true;
                }
            }

            const portModel = graphModel.dataModel.portModels[ modelObject.uid ];
            if( portModel ) {
                portToUpdate.push( portModel.graphItem );
            }
        } );

        if( nodeToUpdate.length > 0 ) {
            nodeService.updateNodeProperties( nodeToUpdate, graphModel, data );
        }
        if( edgeToUpdate.length > 0 ) {
            labelService.updateEdgeLabel( edgeToUpdate, graphModel );
        }
        if( portToUpdate.length > 0 ) {
            labelService.updatePortLabel( portToUpdate, graphModel );
            portService.updatePortDirection( portToUpdate, graphModel );
        }
    }
};

// Invoke modelChanged when new nodes, edges, ports are drawn
export let modelChanged = function( itemsAdded, itemsRemoved, graphModel, graphState ) {
    var isPortAddedOrRemoved = false;
    if( itemsAdded ) {
        isPortAddedOrRemoved = isAnyPortPresent( itemsAdded );
    }

    if( itemsRemoved && !isPortAddedOrRemoved ) {
        isPortAddedOrRemoved = isAnyPortPresent( itemsRemoved );
    }

    if( isPortAddedOrRemoved ) {
        portService.evaluateShowPortsCondition( graphModel, graphState );
    }
};

// Check if items contains any Port
var isAnyPortPresent = function( items ) {
    var isAnyPort = false;
    _.forEach( items, function( item ) {
        // Check if Item is of type Port
        var graphItemType = item.getItemType();
        if( graphItemType && graphItemType === 'Port' ) {
            isAnyPort = true;
            return false;
        }
    } );

    return isAnyPort;
};

//Toggle from network view to nested view and vice versa
export let changeDiagramView = function( graphModel, activeLegendView, graphState ) {
    const newGraphState = { ...graphState.value };
    let viewMode = 'Ase0NestedView';
    if( graphModel ) {
        //means user is switching to network or nested view
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;
        var isNetworkMode = graph.isNetworkMode();
        var layout = graphControl.layout;
        var wasActive = false;
        if( layout && layout.isActive() ) {
            wasActive = true;
            layout.deactivate();
        }
        graphControl.suppressGraphChanged( function() {
            if( isNetworkMode ) {
                //convert to nested view
                let edgesToRemove = graphViewModeService.convertToNestedMode( graphModel );

                if( !_.isEmpty( edgesToRemove ) ) {
                    graphModel.removeEdgeModels( edgesToRemove );
                }
            } else {
                //Convert it to network view
                var groupRelationCategoryName = 'Structure';
                graphViewModeService.convertToNetworkMode( graphModel, function( source, target ) {
                    var addedEdgeData = [];
                    var edgeData = {};
                    edgeData.end1Element = source.modelObject;
                    edgeData.end2Element = target.modelObject;
                    var edgeTypes = [ '' ];
                    edgeData.edgeInfo = { edgeType: edgeTypes };

                    edgeData.relationType = groupRelationCategoryName;
                    addedEdgeData.push( edgeData );
                    var outputData = [];
                    var edeInfo = {
                        edgeData: addedEdgeData
                    };
                    outputData.push( edeInfo );
                    var graphData = {
                        output: outputData
                    };

                    var returnData = edgeService.processEdgeData( activeLegendView, graphModel, graphData, false, newGraphState );
                    viewMode = 'Ase0NetworkView';
                    return returnData.structureEdges[ 0 ];
                } );
            }
        } );
        if( layout ) {
            layout.applyLayout();

            if( wasActive ) {
                layout.activate();
            }
        }
        graphControl.fitGraph();
    }
    newGraphState.viewMode = viewMode;
    graphState.update && graphState.update( newGraphState );
    return {
        actionState: {}
    };
};

//Show the context menu on port
export let showContextMenuOnPort = function( graphModel, item ) {
    if( !graphModel || !item ) {
        return;
    }
    if( item.getItemType() === 'Port' && item.getConnections().length === 0 ) {
        dmSvc.getProperties( [ item.modelObject.uid ], [ 'is_modifiable' ] ).then( function() {
            graphUtils.showPopupMenu( graphModel, 'Ase0PortDirectionGroupCmd', item );
        } );
    }
};

export let buildInputForLoadEditing = function( eventData ) {
    var inputs = [];
    var properties = [];

    properties.push( eventData.property );
    var input = {
        objs: [ eventData.modelObject ],
        propertyNames: properties,
        isPessimisticLock: false
    };

    inputs.push( input );
    return inputs;
};

export let buildInputForSaveEditing = function( eventData ) {
    var inputs = [];
    var lsdData = null;
    var modelObjects = [];
    if( eventData.viewModelObjectsJsonStrings && eventData.viewModelObjectsJsonStrings.length > 0 ) {
        modelObjects = JSON.parse( eventData.viewModelObjectsJsonStrings[0] ).objects;
        if ( modelObjects.length > 0 ) {
            lsdData = modelObjects[0].props[Object.keys( modelObjects[0].props )[0]].srcObjLsd;
        }
    }
    var input = {
        isPessimisticLock: false,
        obj: eventData.modelObject,
        workflowData: {},
        viewModelProperties: [
            {
                dbValues: [ eventData.propertyValue ],
                uiValues: [ eventData.propertyValue ],
                intermediateObjectUids: [],
                isModifiable: true,
                propertyName: eventData.propertyName,
                srcObjLsd: lsdData
            }
        ]
    };
    inputs.push( input );
    return inputs;
};

/**
 * update the port direction
 *
 * @param {object} modelObject model object to be updated
 * @param {string} property property name of object to be updated
 * @param {string} updatePropertyValue property value of object to be updated
 */
export let updatePortDirection = function( modelObject, property, updatePropertyValue ) {
    dmSvc.setProperties( [ {
        object: modelObject,
        vecNameVal: [ {
            name: property,
            values: [ updatePropertyValue ]
        } ]
    } ] ).then( function( response ) {
        if( response && response.ServiceData && response.ServiceData.updated && response.ServiceData.updated.length === 0 ) {
            logger.error( 'error occured while updating port direction' );
        }
    } );
};

export let handleFilterStatusChangedAction = function( categoryType ) {
    var doUpdateAceVisibilityState = false;
    if( categoryType && ( categoryType.data === 'objects' || categoryType.data === 'relations' ) ) {
        doUpdateAceVisibilityState = true;
    }
    return doUpdateAceVisibilityState;
};

export let resetRecallState = function( data ) {
    data.isRecall = false;
};

/**
 * reset creation category in legend state
 *
 * @param {Object} data view model
 */
export let resetCreationCategoryLegendState = function( data ) {
    const graphModel = data.graphModel;
    if( data.eventData.panelId !== 'graphLegendSub' && graphModel && graphModel.config && graphModel.config.inputMode && graphModel.config.inputMode !== 'viewInputMode' ) {
        graphModel.config.inputMode = 'editInputMode';
    }
};

/**
 * refresh the owning node
 *
 * @param {Object} data view model
 */
export let refreshOwningNode = function( data ) {
    // the updated object's uid
    var updatedObject = _.get( data, 'dataSource.vmo', null );
    const graphModel = data.graphModel;

    if( updatedObject !== null ) {
        var elementsToUpdate = [];

        elementsToUpdate.push( updatedObject );
        var curPortModel = graphModel.dataModel.portModels[ updatedObject.uid ];
        if( curPortModel ) {
            const curPortOwner = curPortModel.graphItem.getOwner();

            if( curPortOwner ) {
                elementsToUpdate.push( curPortOwner.modelObject );
            }
        }

        // make a manageDiagram2 call
        var eventDataRefresh = {
            userAction: 'UpdateDiagram',
            elementsToUpdate: elementsToUpdate,
            diagramElements: [],
            eventName: 'AMUpdateDiagramEvent'
        };

        eventBus.publish( 'AMManageDiagramEvent', eventDataRefresh );
    }
};

/**
 * updates the given diagram elements
 *
 * @param {Object} data view model
 * @param {Object} activeLegendView active legend view
 */
export let updateDiagramElements = function( data, activeLegendView ) {
    var graphModel = data.graphModel;
    var eventData = data.eventData;
    var nodeDataToUpdate = eventData.graphData.output[ 0 ].nodeData;
    var nodesToUpdate = [];
    _.forEach( nodeDataToUpdate, function( nodeData ) {
        var uid = nodeData.node.uid;
        const curNodeModel = graphModel.dataModel.nodeModels[ uid ];
        if( curNodeModel ) {
            nodesToUpdate.push( curNodeModel.graphItem );
        }
        nodeService.updateNodeDegreesFromNodeInformation( curNodeModel.graphItem, nodeData, activeLegendView );
    } );

    var portsToUpdate = [];
    _.forEach( eventData.graphData.output[ 0 ].portData, function( portData ) {
        var uid = portData.port.uid;
        const curPortModel = graphModel.dataModel.portModels[ uid ];
        if( curPortModel ) {
            portsToUpdate.push( curPortModel.graphItem );
        }
    } );
    if( portsToUpdate.length > 0 ) {
        labelService.updatePortLabel( portsToUpdate, graphModel );
        portService.updatePortDirection( portsToUpdate, graphModel );
    }
    nodeService.updateNodeProperties( nodesToUpdate, graphModel, data );
    nodeCommandService.updateGraphInfoOnNodes( nodesToUpdate, graphModel, data );
};

/**
 * updates the given diagram elements and then adds new elements
 *
 * @param {Object} data view model
 */
export let updateDiagramElementsAndTriggerAddDiagram = function( data ) {
    exports.updateDiagramElements( data );
    var eventData = data.eventData;

    eventData = {
        elementsToAdd: data.eventData.elementsToAdd
    };

    eventBus.publish( 'DepAddObjectsToDiagramEvent', eventData );
};

/**
 * Function to subscribe to product context change event on configuration changed
 *
 * @param {Object} value value object
 */
export let configurationChanged = function( value ) {
    if ( value && Object.keys( value.aceActiveContext.context.configContext ).length > 0 && !_productContextChanged ) {
        _productContextChanged = eventBus.subscribe( 'productContextChangedEvent', function() {
            productContextChanged( true );
        } );
    }
};

/**
 * Function to clear and open diagram
 *
 * @param {boolean} isApplyGlobalLayout the flag to apply global layout or not.
 */
let productContextChanged = function( isApplyGlobalLayout ) {
    if ( _productContextChanged ) {
        eventBus.unsubscribe( _productContextChanged );
        _productContextChanged = null;
    }
    clearOpenDiagram( isApplyGlobalLayout );
};

/**
 * Function to clear and open diagram
 *
 * @param {boolean} isApplyGlobalLayout the flag to apply global layout or not.
 */
let clearOpenDiagram = function( isApplyGlobalLayout ) {
    let eventData = {
        userAction: 'OpenDiagram',
        isApplyGlobalLayout: isApplyGlobalLayout
    };
    //Publish clear diagram event, which will trigger action handleClearDiagram. Which will clear the node,edge,port map and then clears graph
    eventBus.publish( 'AMGraphEvent.clearDiagram', eventData );
};

export let refreshDiagram = function() {
    productContextChanged( false );
};

/**
 * Function to clear diagram if effectivity added
 */
export let resetContentOnEffectivityAdded = function() {
    clearOpenDiagram( false );
};

/**
 * Function to subscribe to product context change event on reset command execution
 * @param {Object} graphState graph state
 */
export let resetContent = function( graphState, occContext ) {
    let graphStateValue = { ...graphState.value };
    if ( !_productContextChanged ) {
        _productContextChanged = eventBus.subscribe( 'productContextChangedEvent', function() {
            productContextChanged( false );
            // if in diagramming context
            // then after Reset, Save Diagram Icon should be hidden and  set diagramOpeningComplete to false
            if ( diagramSaveService.isWorkingContextTypeDiagram( occContext ) ) {
                graphStateValue.diagramOpeningComplete = false;
                graphStateValue = diagramSaveService.setHasPendingChange( false, graphStateValue );
                graphStateValue = diagramSaveService.setHasPendingChangeInDiagram( false, graphStateValue );
                graphState.update( graphStateValue );
            }
        } );
    }
};

const exports = {
    handleManageDiagram2Complete,
    drawGraph,
    updateModelOnObjectChanged,
    modelChanged,
    changeDiagramView,
    showContextMenuOnPort,
    buildInputForLoadEditing,
    buildInputForSaveEditing,
    updatePortDirection,
    handleFilterStatusChangedAction,
    resetRecallState,
    resetCreationCategoryLegendState,
    refreshOwningNode,
    updateDiagramElements,
    updateDiagramElementsAndTriggerAddDiagram,
    configurationChanged,
    refreshDiagram,
    resetContentOnEffectivityAdded,
    resetContent
};
export default exports;
