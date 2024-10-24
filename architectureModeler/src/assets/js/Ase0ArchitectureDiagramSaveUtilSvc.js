// Copyright (c) 2022 Siemens

/**
 * @module js/Ase0ArchitectureDiagramSaveUtilSvc
 */
import _ from 'lodash';

var exports = {};

/**
 * gives the complete diagram info which is required for saving a diagram.
 * @param {Object} graphState graph state
 * @param {Object} graphModel graphModel
 * @param {Object} legendState legendState
 * @return {Object} diagramInfoMap
 */
export let getOpenedDiagramInfo = function( graphState, graphModel, legendState ) {
    var diagramInfoMap = {};
    var diagramInfo = {};
    //get available diagramInfo parameters from diagramData
    if( graphModel ) {
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;
        var layout = graphControl.layout;
        var layoutDirection = layout.getLayoutDirection();
        diagramInfo.layout = [ layoutDirection ];
        //set Grid Options
        var gridOptions = getGridOptions( graphState );
        if( gridOptions && gridOptions.length > 0 ) {
            diagramInfo.gridOptions = gridOptions;
        }
        //set autoLayout State
        let autoLayoutState = false;
        if( graphState && graphState.isAutoLayoutOn ) {
            autoLayoutState = graphState.isAutoLayoutOn;
        }
        diagramInfo.autoLayoutState = [ autoLayoutState.toString() ];

        //set LabelFilters
        var labelFilters = getLabelFilters( graphState );
        if( labelFilters.length > 0 ) {
            diagramInfo.labelFilters = labelFilters;
        }
        //Zoom Level
        var zoomLevel = graphControl.getZoom();
        diagramInfo.zoomLevel = [ zoomLevel.toString() ];
        //set ViewPoint
        diagramInfo.viewPoint = [ getViewPoint( graphControl ) ];
        //viewMode
        diagramInfo.viewMode = [ getViewMode( graph ) ];

        // process Filter Data
        var filterData = getFilterInfo( legendState );
        updateDiagramInfo( diagramInfo, 'objectFilters', filterData );
        updateDiagramInfo( diagramInfo, 'relationFilters', filterData );
        updateDiagramInfo( diagramInfo, 'portFilters', filterData );
        updateDiagramInfo( diagramInfo, 'annotationFilters', filterData );

        var graphInfo = processDiagramInfo( graph );
        //update anchor Elements,Positions and labelVisibility
        diagramInfo = updateDiagramInfo( diagramInfo, 'anchorElements', graphInfo.diagramInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'expandedStateInfo', graphInfo.diagramInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'hiddenStateInfo', graphInfo.diagramInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'labelPositionalInfo', graphInfo.diagramInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'hiddenStateInfo', graphInfo.diagramInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'labelVisibilityInfo', graphInfo.diagramInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'positionalInfo', graphInfo.diagramInfo );

        //process Annotation Data
        var annotationInfo = getAnnotationInfo( graph );
        diagramInfo = updateDiagramInfo( diagramInfo, 'annotationCategories', annotationInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'annotationLabelPositions', annotationInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'annotationLabels', annotationInfo );
        diagramInfo = updateDiagramInfo( diagramInfo, 'annotationPositions', annotationInfo );
        //finally set complete diagram info to outputData
        diagramInfoMap = {
            objectsToSave: graphInfo.objectsToSave,
            objectsToHide: graphInfo.objectsToHide,
            diagramInfo: diagramInfo
        };
    }
    return diagramInfoMap;
};
/**
 *
 * @param {Object} diagramInfo object
 * @param {String} propertyKey key to be set
 * @param {Array} updateValue  value to be set
 * @returns {Array} diagramInfo
 */
var updateDiagramInfo = function( diagramInfo, propertyKey, updateValue ) {
    var valueArray = updateValue[ propertyKey ];
    if( valueArray && valueArray.length > 0 ) {
        diagramInfo[ propertyKey ] = valueArray;
    }
    return diagramInfo;
};
/**
 * get All LabelFilters
 * @param {Object} graphState graph state
 * @returns {Array} labelFilters
 */
var getLabelFilters = function( graphState ) {
    var labelFilters = [];
    if( graphState ) {
        var labelCategories = graphState.labelCategories;
        if( labelCategories && labelCategories.length > 0 ) {
            _.forEach( labelCategories, function( lCtr ) {
                if( lCtr.categoryState && lCtr.internalName ) {
                    labelFilters.push( lCtr.internalName );
                }
            } );
        }
    }

    return labelFilters;
};
/**
 *gives the ViewMode
 * @param {Object} graph graph
 * @returns {String} viewMode
 */
var getViewMode = function( graph ) {
    var viewMode = null;
    var isNetworkView = graph.isNetworkMode();
    if( isNetworkView ) {
        viewMode = 'NetworkView';
    } else {
        viewMode = 'NestingView';
    }

    return viewMode;
};
/**
 *
 * @param {Object} graphControl graphControl
 * @returns {String} viewPointStr
 */
var getViewPoint = function( graphControl ) {
    if( graphControl ) {
        var viewPoint = graphControl.getViewPoint();
        return viewPoint.x + ':' + viewPoint.y;
    }
};
/**
 * get Grid Options
 * @param {Object} graphState graph state
 * @returns {String} gridOptions current applied grid Options
 *
 */
var getGridOptions = function( graphState ) {
    var gridOptions = [];
    if( graphState && graphState.gridOptions ) {
        if( graphState.Ase0MajorLines ) {
            gridOptions.push( 'Ase0MajorLines' );
        }
        if( graphState.Ase0MinorLines ) {
            gridOptions.push( 'Ase0MinorLines' );
        }
        if( graphState.Ase0SnapToGrid ) {
            gridOptions.push( 'Ase0SnapToGrid' );
        }
    }
    return gridOptions;
};

/**
 *process complete Diagram
 * @param {Object} graph graph Object to call graph api functions
 * @returns {Object} graphData
 */
var processDiagramInfo = function( graph ) {
    var objectsToSave = [];
    var objectsToHide = [];
    var anchorElements = [];
    var diagramInfo = {};
    // for now, we save position of all nodes, edges, ports in the diagram
    var positionalInfo = [];
    // for now, we save position of all labels in the diagram
    var labelVisibilityInfo = [];
    // for now, we save hidden state of all nodes, edges, ports in the diagram
    var hiddenStateInfo = [];
    // for now, we save the expanded state of all nodes in the diagram
    var expandedStateInfo = [];
    //List holding label position
    var labelPositionalInfo = [];
    //process node Data
    var totalNodesInGraph = graph.getNodes();
    _.forEach( totalNodesInGraph, function( node ) {
        if( !node.modelObject ) {
            // node does not have model object (dummy node), so return true to continue with next node
            return true;
        }

        //process Anchored Node
        var isAnchored = node.isRoot();
        if( isAnchored ) {
            anchorElements.push( node.modelObject.uid );
        }
        //processPosition
        var position = graph.getBounds( node );
        var positionStr = position.x + ':' + position.y + ':' + position.width + ':' + position.height;
        //set hiddenStateInfo False for VisibleNodes;
        hiddenStateInfo.push( ( !node.isVisible() ).toString() );
        expandedStateInfo.push( node.isExpanded().toString() );
        objectsToSave.push( node.modelObject );
        positionalInfo.push( positionStr );
        //put empty label position for visible nodes
        labelVisibilityInfo.push(  false.toString() );
        labelPositionalInfo.push( '' );
    } );

    // process Edge Data
    // this  is for considering ports of dangling  edges also
    var realPorts = _.filter( graph.getPorts(), function( port ) {
        return port.modelObject;
    } );
    var partitionedPortsByVisibility = _.partition( realPorts, function( port ) { return port.isVisible(); } );
    var visiblePorts = [];
    if( partitionedPortsByVisibility.length > 0 ) { visiblePorts = partitionedPortsByVisibility[ 0 ]; }
    var totalEdges = graph.getEdges();
    _.forEach( totalEdges, function( edge ) {
        if( !edge.modelObject ) {
            // edge does not have model object (dummy edge), so return true to continue with next edge
            return true;
        }

        if( edge.isVisible() ) {
            var edgePositionPoints = graph.getEdgePosition( edge );
            var edgeStr = '';
            if( edgePositionPoints && edgePositionPoints.length > 0 ) {
                _.forEach( edgePositionPoints, function( point ) {
                    edgeStr += point.x + ':' + point.y + ':';
                } );
            }
            edgeStr = edgeStr.slice( 0, edgeStr.length - 1 );
            objectsToSave.push( edge.modelObject );
            positionalInfo.push( edgeStr );
            //getLabelPosition
            var edgeLabel = edge.getLabel();
            if( edgeLabel ) {
                labelVisibilityInfo.push( edgeLabel.isVisible().toString() );
                var edgeLabelPosition = edgeLabel.getPosition();
                var labelPositionStr = edgeLabelPosition.x + ':' + edgeLabelPosition.y;
                labelPositionalInfo.push( labelPositionStr );
            } else {
                labelVisibilityInfo.push( 'false' );
                labelPositionalInfo.push( '' );
            }
            hiddenStateInfo.push(  false.toString() );
            // Add all the ports with visible edges on diagram to visible port list.
            //We need to add ports with visible edges in (even ports are filtered) to provide server information about edge ends.
            var sourcePort = edge.getSourcePort();
            var targetPort = edge.getTargetPort();

            if( sourcePort && sourcePort.modelObject ) {
                if( !_.includes( visiblePorts, sourcePort ) ) {
                    visiblePorts.push( sourcePort );
                }
            }
            if( targetPort && targetPort.modelObject ) {
                if( !_.includes( visiblePorts, targetPort ) ) {
                    visiblePorts.push( targetPort );
                }
            }
        } else {
            //add Hidden edges  Here
            objectsToHide.push( edge.modelObject );
        }
    } );
    //process ports Data
    var hiddenPorts = [];
    if( partitionedPortsByVisibility.length >= 2 ) {
        hiddenPorts = partitionedPortsByVisibility[ 1 ];

        // Exclude visible ports from hidden ports list
        if( hiddenPorts && hiddenPorts.length > 0 ) {
            _.pullAll( hiddenPorts, visiblePorts );
        }
    }

    _.forEach( visiblePorts, function( port ) {
        var portPosition = graph.getPortPosition( port );
        var portPositionStr = portPosition.x + ':' + portPosition.y;
        var portLabel = port.getLabel();
        if( portLabel ) {
            labelVisibilityInfo.push(  portLabel.isVisible().toString() );
            var labelPosition = portLabel.getPosition();
            var portLabelPositionStr = labelPosition.x + ':' + labelPosition.y;
            labelPositionalInfo.push( portLabelPositionStr );
        } else {
            labelVisibilityInfo.push( 'false' );
            labelPositionalInfo.push( '' );
        }
        hiddenStateInfo.push( ( !port.isVisible() ).toString() );
        objectsToSave.push( port.modelObject );
        positionalInfo.push( portPositionStr );
    } );

    //add hidden ports to objects to Hide only if port is not filtered
    if( hiddenPorts && hiddenPorts.length > 0 ) {
        _.forEach( hiddenPorts, function( port ) {
            if( !port.isFiltered() && port.modelObject ) {
                objectsToHide.push( port.modelObject );
            }
        } );
    }

    //set value to diagram Info
    if( objectsToSave.length > 0 && positionalInfo.length > 0 && hiddenStateInfo.length > 0 &&
        expandedStateInfo.length > 0 && labelVisibilityInfo.length ) {
        diagramInfo.anchorElements = anchorElements;
        diagramInfo.expandedStateInfo = expandedStateInfo;
        diagramInfo.hiddenStateInfo = hiddenStateInfo;
        diagramInfo.labelPositionalInfo = labelPositionalInfo;
        diagramInfo.labelVisibilityInfo = labelVisibilityInfo;
        diagramInfo.positionalInfo = positionalInfo;
    }
    return {
        diagramInfo: diagramInfo,
        objectsToSave: objectsToSave,
        objectsToHide: objectsToHide
    };
};
/**
 * this function set the graph filtered categories in diagram Info.
 * @param {Object} legendState legendState
 * @returns {Object} filterInfo
 */
var getFilterInfo = function( legendState ) {
    var objectFilter = [];
    var relationFilter = [];
    var portFilter = [];
    var annotationFilter = [];
    if( legendState && legendState.activeView && legendState.activeView.filteredCategories && legendState.activeView.filteredCategories.length > 0 ) {
        var filteredCategories = legendState.activeView.filteredCategories;
        _.forEach( filteredCategories, function( category ) {
            if( category.isFiltered && category.categoryType === 'objects' ) {
                objectFilter.push( category.internalName );
            }
            if( category.isFiltered && category.categoryType === 'relations' ) {
                relationFilter.push( category.internalName );
            }
            if( category.isFiltered && category.categoryType === 'ports' ) {
                portFilter.push( category.internalName );
            }
            if( category.isFiltered && category.categoryType === 'annotations' ) {
                annotationFilter.push( category.internalName );
            }
        } );
    }

    //assign filter category to filterInfo

    return {
        objectFilters: objectFilter,
        relationFilters: relationFilter,
        portFilters: portFilter,
        annotationFilters: annotationFilter
    };
};
/**
 * process Annotation Data
 * @param {Object} graph graphObject
 * @returns {Object} annotationInfo
 */
var getAnnotationInfo = function( graph ) {
    var annotationInfo = {};
    var visibleAnnotations = graph.getVisibleBoundaries();
    if( visibleAnnotations && visibleAnnotations.length > 0 ) {
        //get annotations from archContext or gc
        var annotationCategories = [];
        var annotationPositions = [];
        var annotationLabels = [];
        var annotationLabelPositions = [];
        _.forEach( visibleAnnotations, function( annotation ) {
            if( annotation.category ) {
                annotationCategories.push( annotation.category );
            }
            var anchorPosition = annotation.getAnchorPosition();
            if( anchorPosition && annotation.getHeightValue() && annotation.getWidthValue() ) {
                var annotationPosStr = anchorPosition.x + ':' + anchorPosition.y + ':' + annotation.getWidthValue() + ':' + annotation.getHeightValue();
                annotationPositions.push( annotationPosStr );
            }
            var boundaryLbl = annotation.getLabel();
            if( boundaryLbl ) {
                annotationLabels.push( boundaryLbl.getText() );
            }
            var boundaryPosPoints = boundaryLbl.getPosition();
            if( boundaryPosPoints ) {
                var bLabelPosStr = boundaryPosPoints.x + ':' + boundaryPosPoints.y;
                annotationLabelPositions.push( bLabelPosStr );
            }
        } );
    }
    annotationInfo.annotationCategories = annotationCategories;
    annotationInfo.annotationPositions = annotationPositions;
    annotationInfo.annotationLabels = annotationLabels;
    annotationInfo.annotationLabelPositions = annotationLabelPositions;
    return annotationInfo;
};

export default exports = {
    getOpenedDiagramInfo
};
