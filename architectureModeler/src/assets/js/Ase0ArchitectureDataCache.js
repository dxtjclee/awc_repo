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
 *This service is created for maintaining the diagram data cache
 *
 * @module js/Ase0ArchitectureDataCache
 */
import tansformSvc from 'js/Ase0ArchitectureTransformationService';
import _ from 'lodash';

/** Applied layout string that needs to be set */
var _layoutString;

/** Auto-layout state */
var _autoLayoutState = true;

/** Zoom level */
var _zoomLevel = 1;

/** Viewpoint position */
var _viewPoint;

/** View mode: NetWorkView or NestingView */
var _viewMode;

/** Flag to set page size in graph */
var _pagesize = 0;

/** Flag to enable/disable connection jumper */
var _jumpers = false;

var _gridOptions;

/** String array that will contain filter object types */
var _filteredObjectTypes = [];

/** String array that will contain filter relation types */
var _filteredRelationTypes = [];

/** String array that will contain filter label types */
var _filteredLabelTypes = [];

/** String array that will contain filter port types */
var _filteredPortTypes = [];

/** The flag for configuration changed state*/
var _configChangedState = false;

var _nodesData = {};
var _edgesData = {};
var _portData = {};
var _annotations = [];

export let setDiagramInfo = function( outputData ) {
    if( outputData && outputData.length > 0 ) {
        _.forEach( outputData, function( o ) { //eslint-disable-line complexity
            if( o.diagramInfo ) {
                if( o.diagramInfo.layout && o.diagramInfo.layout.length > 0 ) {
                    _layoutString = o.diagramInfo.layout[ 0 ];
                }
                if( o.diagramInfo.autoLayoutState && o.diagramInfo.autoLayoutState.length > 0 ) {
                    _autoLayoutState = o.diagramInfo.autoLayoutState[ 0 ];
                }
                if( o.diagramInfo.zoomLevel && o.diagramInfo.zoomLevel.length > 0 ) {
                    _zoomLevel = o.diagramInfo.zoomLevel[ 0 ];
                }
                if( o.diagramInfo.viewPoint && o.diagramInfo.viewPoint.length > 0 ) {
                    _viewPoint = o.diagramInfo.viewPoint[ 0 ];
                }
                if( o.diagramInfo.viewMode && o.diagramInfo.viewMode.length > 0 ) {
                    _viewMode = o.diagramInfo.viewMode[ 0 ];
                }
                if( o.diagramInfo.pageSize && o.diagramInfo.pageSize.length > 0 ) {
                    _pagesize = o.diagramInfo.pageSize[ 0 ];
                }
                if( o.diagramInfo.enableJumper && o.diagramInfo.enableJumper.length > 0 ) {
                    _jumpers = o.diagramInfo.enableJumper[ 0 ];
                }
                if( o.diagramInfo.objectFilters && o.diagramInfo.objectFilters.length > 0 ) {
                    _filteredObjectTypes = o.diagramInfo.objectFilters;
                }
                if( o.diagramInfo.relationFilters && o.diagramInfo.relationFilters.length > 0 ) {
                    _filteredRelationTypes = o.diagramInfo.relationFilters;
                }
                if( o.diagramInfo.portFilters && o.diagramInfo.portFilters.length > 0 ) {
                    _filteredPortTypes = o.diagramInfo.portFilters;
                }
                if( o.diagramInfo.gridOptions && o.diagramInfo.gridOptions.length > 0 ) {
                    _gridOptions = o.diagramInfo.gridOptions;
                }
                if( o.diagramInfo.labelFilters && o.diagramInfo.labelFilters.length > 0 ) {
                    _filteredLabelTypes = o.diagramInfo.labelFilters;
                }
                if( o.diagramInfo.annotationCategories && o.diagramInfo.annotationCategories.length > 0 ) {
                    addAnnotation( o.diagramInfo );
                }
            }
        } );
    }
};

/**
 * Process the annotation data
 *
 * @param {Object} diagramInfo diagram information
 */
var addAnnotation = function( diagramInfo ) {
    var annotationCategories = diagramInfo.annotationCategories;
    var annotationPositions = diagramInfo.annotationPositions;
    var annotationLabels = diagramInfo.annotationLabels;
    var annotationLabelPositions = diagramInfo.annotationLabelPositions;

    if( annotationPositions && annotationLabels && annotationLabelPositions &&
        annotationCategories.length === annotationPositions.length &&
        annotationPositions.length === annotationLabels.length &&
        annotationLabels.length === annotationLabelPositions.length ) {
        _.forEach( annotationCategories, function( annotation, idx ) {
            var annotationData = {};
            annotationData.annotationPositions = annotationPositions[ idx ];
            annotationData.annotationLabels = annotationLabels[ idx ];
            annotationData.annotationLabelPositions = annotationLabelPositions[ idx ];
            _annotations.push( annotationData );
        } );
    }
};

/**
 * Process and store the node data in uid vs node data map
 *
 * @param {object} outputData - SOA response
 */
export let addNodeCache = function( outputData ) {
    _nodesData = tansformSvc.nodeDataCacheTransform( outputData, _nodesData );
};

/**
 * Remove the node data from node data map
 *
 * @param {array} nodeIds - uids of nodes object
 */
export let removeNodeCache = function( nodeIds ) {
    if( nodeIds && nodeIds.length > 0 && _nodesData ) {
        _nodesData = _.omit( _nodesData, nodeIds );
    }
};

/**
 * Process and store the port data in uid vs port data map
 * @param {Object} outputData SOA Response
 */
export let addPortCache = function( outputData ) {
    _portData = tansformSvc.portDataCacheTransform( outputData, _portData );
};

/**
 * Remove port data in from port data map
 * @param {array} portIds uids of port object
 */
export let removePortCache = function( portIds ) {
    if( portIds && portIds.length > 0 && _portData ) {
        _portData = _.omit( _portData, portIds );
    }
};

/**
 * Process and store the  edge data in uid vs edge data map
 * @param {Object} outputData SOA Response
 */
export let addEdgeCache = function( outputData ) {
    _edgesData = tansformSvc.edgeDataCacheTransform( outputData, _edgesData );
};

/**
 * Remove  edge from edge data map
 * @param {array} edgeIds uids of the edge
 */
export let removeEdgeCache = function( edgeIds ) {
    if( edgeIds && edgeIds.length > 0 && _edgesData ) {
        _edgesData = _.omit( _edgesData, edgeIds );
    }
};

/**clear the cache Data */
export let clearDataCache = function() {
    _nodesData = {};
    _portData = {};
    _edgesData = {};
    _annotations = [];
};

/**
 * Get node data from the node data map
 *
 * @param {String} uid selected object uid
 *
 * @returns {Object} Node data info
 */
export let getNodeDataInfoMap = function( uid ) {
    return _nodesData[ uid ];
};

/**
 * Get edge data from the node data map
 *
 * @param {String} uid selected object uid
 *
 * @returns {Object} edge data info
 */
export let getEdgeDataInfoMap = function( uid ) {
    return _edgesData[ uid ];
};

/**
 * Get port data from the node data map
 *
 * @param {String} uid selected object uid
 *
 * @returns {Object} port data info
 */
export let getPortDataInfoMap = function( uid ) {
    return _portData[ uid ];
};

/**
 * Get the annotation data from on diagram
 */

export let getAnnotationsList = function() {
    return _annotations;
};

/**
 * Get layout of the diagram
 *
 * @returns {String} layout info
 */
export let getLayout = function() {
    return _layoutString;
};

/**
 * Get the auto layout state of diagram is on or off. True if on
 *
 * @returns {boolean} autolayout state
 */
export let getAutoLayout = function() {
    return _autoLayoutState;
};

/**
 * Get zoom level of diagram
 *
 * @returns {int} zoom level
 */
export let getZoomLevel = function() {
    return _zoomLevel;
};

/**
 * Get view point of diagram
 *
 * @returns {String} view point
 */
export let getViewPoint = function() {
    return _viewPoint;
};

/**
 * Get view mode of diagram
 *
 * @returns {String} view mode
 */
export let getViewMode = function() {
    return _viewMode;
};

/**
 * Get page size of diagram
 *
 * @returns {int} page size
 */
export let getPageSize = function() {
    return _pagesize;
};

/**
 * Get boolean true if jumper is enabled in diagram
 *
 * @returns {boolean} is jumper enabled
 */
export let getEnableJumper = function() {
    return _jumpers;
};

/**
 * Get filtered object types from legend
 *
 * @returns {Array} filtered Object Types
 */
export let getObjectFilters = function() {
    return _filteredObjectTypes;
};

/**
 * Get filtered relation types from legend
 *
 * @returns {Array} filtered relation Types
 */
export let getRelationFilters = function() {
    return _filteredRelationTypes;
};

/**
 * Get filtered interface types from legend
 *
 * @returns {Array} filtered interface Types
 */
export let getPortFilters = function() {
    return _filteredPortTypes;
};

/**
 * Get grid options for the diagram
 *
 * @returns {Object} grid options
 */
export let getGridOptions = function() {
    return _gridOptions;
};

/**
 * Get filtered label types of diagram
 *
 * @returns {Array} filtered label Types
 */
export let getFilteredLabelTypes = function() {
    return _filteredLabelTypes;
};

/**
 * Get boolean true if configuration changed for diagram
 *
 * @param {boolean} configChangedState - true if configuration changed
 */
export let setConfigChangedState = function( configChangedState ) {
    _configChangedState = configChangedState;
};

/**
 * Get boolean true if configuration changed for diagram
 *
 * @returns {boolean} is configuration changed
 */
export let getConfigChangedState = function() {
    return _configChangedState;
};

/**
 * Update node data from the node data map
 *
 * @param {String} uid selected object uid
 * @param {Object} updatedNodetInfoMap updated node info
 */
export let updateNodeDataInfoMap = function( uid, updatedNodetInfoMap ) {
    if( _nodesData[ uid ] && updatedNodetInfoMap ) {
        _.assign( _nodesData[ uid ], updatedNodetInfoMap );
    }
};

/**
 * Update edge data from the edge data map
 *
 * @param {String} uid selected object uid
 * @param {Object} updatedEdgeInfoMap updated edge info
 */
export let updateEdgeDataInfoMap = function( uid, updatedEdgeInfoMap ) {
    if( _edgesData[ uid ] && updatedEdgeInfoMap ) {
        _.assign( _edgesData[ uid ], updatedEdgeInfoMap );
    }
};

/**
 * Update port data from the port data map
 *
 * @param {String} uid selected object uid
 * @param {Object} updatedPortInfoMap updated port info
 */
export let updatePortDataInfoMap = function( uid, updatedPortInfoMap ) {
    if( _portData[ uid ] && updatedPortInfoMap ) {
        _.assign( _portData[ uid ], updatedPortInfoMap );
    }
};

const exports = {
    setDiagramInfo,
    addNodeCache,
    removeNodeCache,
    addPortCache,
    removePortCache,
    addEdgeCache,
    removeEdgeCache,
    clearDataCache,
    getNodeDataInfoMap,
    getEdgeDataInfoMap,
    getPortDataInfoMap,
    getAnnotationsList,
    getLayout,
    getAutoLayout,
    getZoomLevel,
    getViewPoint,
    getViewMode,
    getPageSize,
    getEnableJumper,
    getObjectFilters,
    getRelationFilters,
    getPortFilters,
    getGridOptions,
    getFilteredLabelTypes,
    setConfigChangedState,
    getConfigChangedState,
    updateNodeDataInfoMap,
    updateEdgeDataInfoMap,
    updatePortDataInfoMap
};
export default exports;
