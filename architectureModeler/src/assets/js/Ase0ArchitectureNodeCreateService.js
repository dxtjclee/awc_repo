// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitectureNodeCreateService
 */
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import archDataCache from 'js/Ase0ArchitectureDataCache';
import utilSvc from 'js/Ase0ArchitectureUtilService';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import nodeCommandService from 'js/Ase0ArchitectureNodeCommandService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';
import templateService from 'js/Ase0ArchitectureGraphTemplateService';
import 'soa/dataManagementService';

/**
 * update the node style
 *
 * @param {object} graphModel graphModel object
 * @param {object} nodes dummy nodes
 * @param {object} legendState - legendState information of selected object from legend panel
 * @param {object} newNodeObjects node information from graph
 * @param {object} data data declarative view model
 * @param {object} categoryType category type of a node
 * @returns {Object} affected node list
 */
var updateNodeWithNewObject = function( graphModel, nodes, legendState, newNodeObjects, data, categoryType ) {
    var affectedNodeList = [];
    if( graphModel.graphControl && graphModel.graphControl.graph ) {
        var nodeObject = null;
        var nodeUid = null;
        _.forEach( nodes, function( node, idx ) {
            affectedNodeList.push( node );

            var groupGraph = graphModel.graphControl.groupGraph;
            var parentNode = groupGraph.getParent( node );
            if( parentNode ) {
                affectedNodeList.push( parentNode );
            }

            nodeUid = newNodeObjects[ idx ].node.uid;
            var isAnchor = newNodeObjects[ idx ].nodeInfo.isAnchor[ 0 ] === '1';
            nodeObject = cdm.getObject( nodeUid );

            if( !graphModel.dataModel.nodeModels[ nodeUid ] ) {
                var nodeCategory = null;
                if( node.categoryType ) {
                    nodeCategory = node.categoryType;
                } else {
                    nodeCategory = categoryType;
                }
                if( newNodeObjects[ idx ].nodeInfo.nodeType && newNodeObjects[ idx ].nodeInfo.nodeType.length > 0 ) {
                    node.nodeType = newNodeObjects[ idx ].nodeInfo.nodeType[ 0 ];
                } else if( newNodeObjects[ idx ].node ) {
                    var underlyingObjectUid = _.get( newNodeObjects[ idx ].node, 'props.awb0UnderlyingObject.dbValues[0]', undefined );
                    var underlyingObject = cdm.getObject( underlyingObjectUid );
                    if( underlyingObject ) {
                        node.nodeType = _.get( underlyingObject, 'type', undefined );
                    }
                }
                node.hasParent = newNodeObjects[ idx ].nodeInfo.hasParent && newNodeObjects[ idx ].nodeInfo.hasParent[ 0 ] === '1';
                node.numChildren = 0;
                node.incomingRelations = newNodeObjects[ idx ].nodeInfo.incomingConnectionTypes.concat( newNodeObjects[ idx ].nodeInfo.definingTraceLinkTypes );
                node.outgoingRelations = newNodeObjects[ idx ].nodeInfo.outgoingConnectionTypes.concat( newNodeObjects[ idx ].nodeInfo.complyingTraceLinkTypes );

                var props = templateService.getBindPropertyNames( nodeObject );
                var template = templateService.getNodeTemplate( graphModel.nodeTemplates, props, false );
                if( !template ) {
                    logger
                        .error( 'Failed to get SVG template for node object. Skip drawing the node. Object UID: ' +
                            nodeObject.uid );
                    return;
                }

                var bindData = templateService.getBindProperties( nodeObject, props, data );

                //get node style from graph legend
                var nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, legendState.activeView );
                if( nodeStyle ) {
                    bindData.node_fill_color = nodeStyle.borderColor;
                }
                if( bindData.Name ) {
                    bindData.Name_editable = true;
                }

                node.portDegree = [];
                node.isRoot( isAnchor );
                graphModel.graphControl.graph.setNodeStyle( node, template, bindData );
                graphModel.graphControl.graph.updateOnItemsAdded( [ node ] );

                node.appData = {
                    category: nodeCategory
                };

                node.modelObject = nodeObject;

                const nodeModel = {
                    id: nodeUid,
                    modelObject: nodeObject,
                    category: nodeCategory
                };

                //build node map to help create nodes
                graphModel.addNodeModel( node, nodeModel );

                var responseNodeData = [];
                var output = {};
                output.nodeData = [];
                output.nodeData.push( newNodeObjects[ idx ] );
                responseNodeData.push( output );
                archDataCache.addNodeCache( responseNodeData );

                architectureLayoutService.addNodeToBeAddedWithPosition( node );
            }
        } );
    }
    return affectedNodeList;
};

/**
 * quick create the node item from relation legend panel
 *
 * @param {object} data declarative view model
 * @param {object} eventData - event data about the element created on graph
 */
export let quickNodeCreateAction = function( data, eventData ) {
    var objectType = eventData.objectTypeToCreate;
    var requiredPropNames = [ 'item_id', 'item_revision_id', 'object_name' ];
    data.createNodeQueue.push( eventData );

    var graphModel = null;
    if( data.graphModel ) {
        graphModel = data.graphModel;
    }

    if( !objectType || !eventData.nodes || !eventData.parentNode ) {
        logger.error( 'node creation failed due to missing node data' );
        return;
    }

    try {
        utilSvc.canObjectQuickCreated( objectType, requiredPropNames ).then(
            function( response ) {
                var isQuickCreate = response;
                if( isQuickCreate ) {
                    _.defer( function() {
                        utilSvc.showTextEditor( graphModel, eventData.nodes[ 0 ] ).then(
                            //enter
                            function( editData ) {
                                editData.objectType = objectType;
                                eventBus.publish( 'AM.nodeEditCommitted', editData );
                            },
                            //cancel
                            function() {
                                eventBus.publish( 'AM.nodeEditCancelled', eventData.nodes[ 0 ] );
                            }
                        );
                    } );
                } else {
                    var modelType = cmm.getType( objectType );
                    var context = {
                        modelType: modelType.name,
                        modelDisplayName: modelType.displayName,
                        categoryType: 'Node',
                        recreatePanel: true,
                        isolateMode: true
                    };
                    utilSvc.openRequiredCommandPanel( 'Ase0ArchitectureRequiredProperty', 'aw_toolsAndInfo', context );
                }
            },
            function( error ) {
                logger.error( 'Error:' + error );
            }
        );
    } catch ( ex ) {
        logger.error( 'Error:' + ex.message );
    }
};

/**
 * Hook to event awGraph.nodeEditCommitted
 *
 * @param {object} eventData - event data about the element created on graph
 */
export let onNodeEditCommitted = function( eventData ) {
    if( !eventData ) {
        return;
    }
    var node = eventData.editNode;
    var objectName = eventData.newValue;
    var templateId = node.style.templateId;

    var isDummy = templateId === 'Ase0ArchitectureDummyNodeTemplate';
    // for dummy node, add newly created modelobject from server side to dummy node
    if( isDummy ) {
        var objectType = eventData.objectType;
        if( !objectType || !eventData.editNode ) {
            logger.error( 'node creation failed due to missing node data' );
            return;
        }

        var modelType = cmm.getType( objectType );
        var createData = utilSvc.getCreateInput( modelType.name, objectName );
        var createInput = [ {
            clientId: 'CreateObject_' + new Date().getTime(),
            createData: createData
        } ];
        utilSvc.executeCreateObject( createInput );
    }
};

/**
 * remove the dummy node
 *
 * @param {object} graphModel graphModel object
 * @param {object} eventData - event data with dummy node
 * @param {object} data - declarative view model
 */
export let onNodeEditCancelled = function( graphModel, eventData, data ) {
    if( !graphModel || !eventData || !eventData.nodes.length > 0 ) {
        return;
    }
    var templateId;
    var node = eventData.nodes[ 0 ];
    if( node && node.style && node.style.templateId ) {
        templateId = node.style.templateId;
    }
    // remove dummy node
    if( templateId === 'Ase0ArchitectureDummyNodeTemplate' ) {
        graphModel.graphControl.graph.removeNodes( [ node ] );
        data.createNodeQueue.pop();
    }
};

/**
 * Handle completion of quick create item on graph.
 *
 * @param {object} data data declarative view model
 * @param {object} graphDataResponse -  SOA execution response
 * @param {object} eventData - event data about the element created on graph
 * @param {Object} legendState legend state
 *  @param {object} occContext occmgmt Context
 */
export let nodeCreatedCompletionAction = function( data, graphDataResponse, eventData, legendState, occContext ) {
    var graphModel = data.graphModel;

    if( !graphDataResponse || !graphModel || !legendState ) {
        logger.error( 'Graph information for node creation is missing' );
        return;
    }

    try {
        var nodes = data.createNodeQueue[ 0 ].nodes;

        architectureLayoutService.clearGraphItemLists();
        if( graphDataResponse.ServiceData.partialErrors && graphDataResponse.output.length === 0 ) {
            if( graphModel.graphControl && graphModel.graphControl.graph ) {
                var graph = graphModel.graphControl.graph;
                graph.removeNodes( nodes );
            }
            return;
        }

        var nodesObjectInfo;
        var nodeOutputData = graphDataResponse.output[ 0 ];
        if( nodeOutputData && nodeOutputData.nodeData && nodeOutputData.nodeData.length > 0 ) {
            nodesObjectInfo = nodeOutputData.nodeData;
        }
        if( nodesObjectInfo ) {
            if( nodes && nodes.length > 0 ) {
                var nodeCategory;
                if( eventData && eventData.nodeCategory ) {
                    nodeCategory = eventData.nodeCategory;
                }

                var affectedNodeList = updateNodeWithNewObject( graphModel, nodes, legendState, nodesObjectInfo, data, nodeCategory );
                if( affectedNodeList.length > 0 ) {
                    nodeCommandService.updateGraphInfoOnNodes( affectedNodeList, graphModel, data, legendState.activeView );
                }
            }
            utilSvc.checkWhetherToSelectObjectInAce( nodesObjectInfo[ 0 ].node.props.awb0Parent.dbValues[ 0 ],
                nodesObjectInfo[ 0 ].node.uid, false, occContext );
        }
        architectureLayoutService.applyGraphLayout( graphModel, true, false, false );
    } catch ( ex ) {
        logger.error( 'Error:' + ex.message );
    } finally {
        data.createNodeQueue.shift();
    }
};

const exports = {
    quickNodeCreateAction,
    onNodeEditCommitted,
    onNodeEditCancelled,
    nodeCreatedCompletionAction
};
export default exports;
