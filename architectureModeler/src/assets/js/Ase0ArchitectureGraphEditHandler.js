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
 * This implements the graph edit handler interface APIs defined by aw-graph widget to provide graph authoring
 * functionalities for Architecture tab
 *
 * @module js/Ase0ArchitectureGraphEditHandler
 */
import appCtxSvc from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import policySvc from 'soa/kernel/propertyPolicyService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import graphLegendSvc from 'js/graphLegendService';
import cmm from 'soa/kernel/clientMetaModel';

var TITLE = 'Title';

/**
 * Function to be called to determine whether can create node at given location.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} contextGroupNode - the clicked group node during node creation.
 * @return {boolean} return true to create node, return false to cancel the node creation
 */
export let canCreateNode = function( graphModel, contextGroupNode ) {
    if( contextGroupNode ) {
        return true;
    }
    return false;
};

/**
 * Function to be called to get port candidate provider type for edge creation
 *
 * @return {String} portCandidateProviderType return portCandidateProviderType
 */
export let getPortCandidateProviderType = function() {
    return 'NODE_AND_PORT';
};

/**
 * Function to be called to tell if the edge was permitted to reconnect
 *
 * @return {boolean} flag whether the edge can be reconnected
 */
export let canReconnectEdge = function() {
    return true;
};

/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} source - the source whether the edge can be created from
 * @return {boolean} flag whether the edge can be reconnected
 */
export let canCreateEdgeFrom = function( graphModel, source ) {
    if( !source || !graphModel ) {
        return false;
    }
    if( !_.isEmpty( source.getItemType() ) && ( source.getItemType() === 'Port' || source.getItemType() === 'Node' ) ) {
        return true;
    }
};

/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} target - the target whether the edge can be created to
 * @return {boolean} flag whether the edge can be reconnected
 */
export let canCreateEdgeTo = function( graphModel, target ) {
    if( !target || !graphModel ) {
        return false;
    }
    if( !_.isEmpty( target.getItemType() ) && ( target.getItemType() === 'Port' || target.getItemType() === 'Node' ) ) {
        return true;
    }
};

/**
 * Function to be called to tell if the object was permitted to connect to
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} endPoint - the connection end type, could be "source" or "target"
 * @param {Object} target - the target object to connect to
 * @param {Object} edge - the edge to reconnect
 * @return {boolean} flag whether the object can be connected to
 */
export let canReconnectEdgeTo = function( graphModel, endPoint, target, edge ) {
    if( cmm.isInstanceOf(
        'Awb0Connection', edge.modelObject.modelType ) && target.getItemType() === 'Port' ) {
        return true;
    }
    if( cmm.isInstanceOf(
        'FND_TraceLink', edge.modelObject.modelType ) && target.getItemType() === 'Node' ) {
        return true;
    }

    return false;
};

/**
 * Function to create node at given location.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} contextGroupNode - the clicked group node during node creation.
 * @param {PointD} location - the location to create node on the sheet coordinate
 */
export let createNode = function( graphModel, contextGroupNode, location ) {
    var parentObject;
    var propNames = [];
    var uids = [];
    propNames.push( 'awb0IsStructModifiable' );
    if( contextGroupNode && contextGroupNode.modelObject ) {
        parentObject = contextGroupNode.modelObject;
        uids.push( parentObject.uid );
    }

    var graphContext = appCtxSvc.getCtx( 'graph' );
    var legendState = null;
    if( graphContext && graphContext.legendState ) {
        legendState = graphContext.legendState;
    }

    var nodeCategory = '';
    var nodeSubCategoryDisplayName = '';
    var nodeSubCategoryInternalName = '';
    if( legendState ) {
        nodeCategory = legendState.creatingCategory.internalName;
        nodeSubCategoryDisplayName = legendState.creatingSubCategory.displayName;
        nodeSubCategoryInternalName = legendState.creatingSubCategory.internalName;
    }

    dms.getProperties( uids, propNames ).then( function() {
        if( parentObject.props.awb0IsStructModifiable && parentObject.props.awb0IsStructModifiable.dbValues[ 0 ] === '1' ) {
            var defaultNodeStyle = graphModel.config.defaults.nodeStyle;
            var defaultNodeSize = graphModel.config.defaults.nodeSize;
            var rect = {
                x: location.x,
                y: location.y,
                width: defaultNodeSize.width,
                height: defaultNodeSize.height
            };
            var graph = graphModel.graphControl.graph;
            var nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, legendState.activeView );

            if( defaultNodeStyle && defaultNodeStyle.templateId ) {
                var templateId = defaultNodeStyle.templateId;
                var registeredTemplate = graphModel.nodeTemplates[ templateId ];
            }
            if( registeredTemplate ) {
                var bindData = registeredTemplate.initialBindData;
                if( nodeStyle ) {
                    bindData.node_fill_color = nodeStyle.borderColor;
                }
                bindData.Name = nodeSubCategoryDisplayName;
                var node = graph.createNodeWithBoundsStyleAndTag( rect, registeredTemplate, bindData );
                var nodeData = {};
                nodeData.nodes = [ node ];
                nodeData.parentNode = contextGroupNode;

                nodeData.objectTypeToCreate = nodeSubCategoryInternalName;
                nodeData.nodeCategory = nodeCategory;

                //create node inside group
                if( contextGroupNode ) {
                    graph.update( function() {
                        contextGroupNode.addGroupMember( node );
                    } );
                    eventBus.publish( 'AM.nodeCreated', nodeData );
                }
            }
        } else {
            if( parentObject && nodeSubCategoryDisplayName ) {
                var eventData = {
                    nonModifiableObject: parentObject,
                    objectType: nodeSubCategoryDisplayName
                };
                eventBus.publish( 'AM.parentObjectNotModifiable', eventData );
            }
        }
    } );
};

/**
 * Function to create edge.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} previewEdge - the preview edge.
 */
export let createEdge = function( graphModel, previewEdge ) {
    var edgeData = {};
    edgeData = getEdgedata( previewEdge );
    eventBus.publish( 'AM.edgeCreated', edgeData );
};

/**
 * Function to create port.
 *
 * @param {Object} graphModel - the graph model object
 * @param {String} port - the preview port
 * @param {Object} owner - the owner of port
 */
export let createPort = function( graphModel, port, owner ) {
    var parentObject;
    var propNames = [];
    var uids = [];
    propNames.push( 'awb0IsStructModifiable' );
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var categoryType = graphContext.legendState.creatingSubCategory.internalName;
    if( port && port.getOwner().modelObject ) {
        parentObject = port.getOwner().modelObject;
        uids.push( parentObject.uid );
    }
    dms.getProperties( uids, propNames ).then( function() {
        if( parentObject.props.awb0IsStructModifiable && parentObject.props.awb0IsStructModifiable.dbValues[ 0 ] === '1' ) {
            var portData = {};
            portData.port = port;
            portData.owner = owner;
            portData.objectTypeToCreate = categoryType;
            eventBus.publish( 'AM.portCreated', portData );
        } else {
            if( parentObject ) {
                var eventData = {
                    nonModifiableObject: parentObject
                };
                // Clean up port from the graph and throw error message.
                var graph = graphModel.graphControl.graph;
                graph.removePorts( [ port ] );
                eventBus.publish( 'AM.portNotCreatedParentObjectNotModifiable', eventData );
            }
        }
    } );
};

/**
 * Function to create Annotation.
 *
 * @param {Object} graphModel - the graph model object
 * @param {String} boundary - the preview boundary
 * @param {Object} position - the created position on the sheet coordinate
 */
export let createBoundary = function( graphModel, boundary ) {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var legendState = null;
    if( graphContext && graphContext.legendState ) {
        legendState = graphContext.legendState;
    }
    if( legendState ) {
        boundary.category = legendState.creatingCategory.internalName;
    }
    if( boundary.category === 'Rectangle' ) {
        boundary.configuration = {
            labelStyle: {
                contentStyleClass: 'aw-widgets-cellListCellTitle',
                backgroundStyle: 'aw-graph-labelBackground',
                textAlignment: 'MIDDLE',
                allowWrapping: 'true'
            }
        };
        graphModel.graphControl.graph.setLabel( boundary, TITLE, boundary.configuration.labelStyle );
    }
    graphModel.graphControl.graph.updateOnItemsAdded( [ boundary ] );
};

/**
 * Function to get the all inforamtion related to dummy edge
 *
 * @param {object} previewEdge - dummy edge
 * @returns {Object} edge data
 */
var getEdgedata = function( previewEdge ) {
    var edgedata = {};
    edgedata.edge = previewEdge;
    var sourceNode = previewEdge.getSourceNode();
    var sourcePort = previewEdge.getSourcePort();
    var targetNode = previewEdge.getTargetNode();
    var targetPort = previewEdge.getTargetPort();
    if( sourceNode ) {
        edgedata.sourceNode = sourceNode;
    }
    if( sourcePort ) {
        edgedata.sourcePort = sourcePort;
    }
    if( targetNode ) {
        edgedata.targetNode = targetNode;
    }
    if( targetPort ) {
        edgedata.targetPort = targetPort;
    }

    var graphContext = appCtxSvc.getCtx( 'graph' );
    if( graphContext.legendState.creatingSubCategory ) {
        var subCategoryType = graphContext.legendState.creatingSubCategory.internalName;
        var categoryType = graphContext.legendState.creatingCategory.internalName;
        edgedata.objectTypeToCreate = subCategoryType;
        edgedata.categoryType = categoryType;
    }

    return edgedata;
};

export let preNodeEdit = function( graphModel, node, propertyName ) {
    var properties = [];
    var deferred = AwPromiseService.instance.defer();

    if( graphModel === null || node === null || propertyName === null ) {
        return deferred.resolve( null );
    }

    var policy = {
        types: [ {
            name: node.modelObject.type,
            properties: [ {
                name: 'awb0DisplayedName',
                modifiers: [ {
                    name: 'includeIsModifiable',
                    Value: 'true'
                } ]
            } ]
        } ]
    };

    var policyId = policySvc.register( policy );

    properties.push( 'awb0DisplayedName' );

    var promise = soaSvc.postUnchecked( 'Internal-AWS2-2017-12-DataManagement', 'loadViewModelForEditing2', {
        inputs: [ {
            objs: [ node.modelObject ],
            propertyNames: properties,
            isPessimisticLock: false
        } ]
    } );

    promise.then( function( response ) {
        if( policyId ) {
            policySvc.unregister( policyId );
        }

        if( response && response.viewModelObjectsJsonStrings && response.viewModelObjectsJsonStrings.length > 0 ) {
            var modelObject = JSON.parse( response.viewModelObjectsJsonStrings[0] ).objects[0];
            if( modelObject.props[Object.keys( modelObject.props )[0]].isModifiable ) {
                deferred.resolve();
            } else {
                deferred.reject();
            }
        }
    } );

    return deferred.promise;
};

/**
 * Change the connection edge from one port to another
 * @param {*} graphModel graph model
 * @param {*} relationEdge relation edge
 * @param {*} oldPort old port
 * @param {*} path path
 * @param {*} end end 'source' or 'target'
 * @param {*} targetElement target element
 */
export let reconnectEdge = function( graphModel, relationEdge, oldPort, path, end, targetElement ) {
    if( relationEdge && targetElement ) {
        let sourcePort = null;
        let targetPort = null;
        let oldSourcePort = null;
        let oldTargetPort = null;

        if( end === 'source' && relationEdge.getTargetPort() ) {
            sourcePort = targetElement;
            targetPort = relationEdge.getTargetPort();
            oldSourcePort = oldPort;
            oldTargetPort = targetPort;
        }
        if( end === 'target' && relationEdge.getSourcePort() ) {
            sourcePort = relationEdge.getSourcePort();
            targetPort = targetElement;
            oldSourcePort = sourcePort;
            oldTargetPort = oldPort;
        }

        var edgeData = {};
        edgeData.oldSourcePort = oldSourcePort;
        edgeData.oldTargetPort = oldTargetPort;
        edgeData.relationEdge = relationEdge;
        edgeData.newSourcePort = sourcePort;
        edgeData.newTargetPort = targetPort;
        eventBus.publish( 'AM.edgeMoved', edgeData );
    }
};

const exports = {
    canCreateNode,
    getPortCandidateProviderType,
    canReconnectEdge,
    canCreateEdgeFrom,
    canCreateEdgeTo,
    canReconnectEdgeTo,
    createNode,
    createEdge,
    createPort,
    createBoundary,
    preNodeEdit,
    reconnectEdge
};
export default exports;
