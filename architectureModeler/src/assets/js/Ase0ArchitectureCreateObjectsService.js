// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitectureCreateObjectsService
 */
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import archDataCache from 'js/Ase0ArchitectureDataCache';
import utilSvc from 'js/Ase0ArchitectureUtilService';
import addObjectUtils from 'js/addObjectUtils';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import reconnectConnectionService from 'js/Ase0ReconnectConnectionService';
import nodeCommandService from 'js/Ase0ArchitectureNodeCommandService';
import labelService from 'js/Ase0ArchitectureLabelService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';
import { svgString as InputPort } from 'image/miscInputPort16.svg';
import { svgString as OutputPort } from 'image/miscOutputPort16.svg';
import { svgString as BiDirectionalPort } from 'image/miscBiDirectionalPort16.svg';
import 'soa/dataManagementService';
import occmgmtUtils from 'js/occmgmtUtils';

var _createElementQueue = [];
var _createPortQueue = [];
let _moveConnectionQueue = [];

/**
 * quick create the item from relation legend panel
 *
 * @param {object} data - data for the element created on graph
 * @param {object} eventData - event data for the element created on graph
 */
export let quickEdgeCreateAction = function( data, eventData ) {
    var requiredPropNames = [ 'item_id', 'item_revision_id', 'object_name' ];

    var sourceObject;
    var targetObject;

    if( eventData.sourcePort && eventData.sourcePort.modelObject ) {
        sourceObject = eventData.sourcePort.modelObject;
    } else {
        if( eventData.sourceNode && eventData.sourceNode.modelObject ) {
            sourceObject = eventData.sourceNode.modelObject;
        }
    }

    if( eventData.targetPort && eventData.targetPort.modelObject ) {
        targetObject = eventData.targetPort.modelObject;
    } else {
        if( eventData.targetNode && eventData.targetNode.modelObject ) {
            targetObject = eventData.targetNode.modelObject;
        }
    }

    if( data && data.reconnect && data.reconnect.isGraphInRelationCreationMode ) {
        var selectedConnection = data.reconnect.selectedConnection;

        // Get all nodes on graph and send them to server, so that server can use them to build paths
        var graphModel = data.graphModel;
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;
        var visibleObjects = [];

        var allNodeModels = graph.getVisibleNodes();
        _.forEach( allNodeModels, function( nodeModel ) {
            if( nodeModel.modelObject ) {
                visibleObjects.push( nodeModel.modelObject );
            }
        } );

        var allPortModels = graph.getVisiblePorts();
        _.forEach( allPortModels, function( portModel ) {
            if( portModel.modelObject ) {
                visibleObjects.push( portModel.modelObject );
            }
        } );

        _createElementQueue.push( eventData );
        reconnectConnectionService.reconnectRelation( data, selectedConnection, sourceObject, targetObject, visibleObjects );
    } else {
        var objectTypeToCreate = eventData.objectTypeToCreate;

        if( !objectTypeToCreate || !sourceObject || !targetObject || !eventData.edge ) {
            logger.error( 'edge creation failed due to missing edge data' );
            return;
        }

        try {
            if( !_.isEqual( sourceObject, targetObject ) ) {
                utilSvc.canObjectQuickCreated( objectTypeToCreate, requiredPropNames ).then(
                    function( response ) {
                        var isQuickCreate = response;
                        var modelType = cmm.getType( objectTypeToCreate );
                        if( modelType ) {
                            if( cmm.isInstanceOf( 'PSConnection', modelType ) ) {
                                createConnection( isQuickCreate, eventData, sourceObject, targetObject, modelType );
                            } else {
                                var scope = getScopeForCategoryTypeFromLegendGivenCategoryTypeName( data.legend, eventData.categoryType );
                                createTraceLink( isQuickCreate, eventData, sourceObject, targetObject, modelType, scope );
                            }
                        }
                    },
                    function( error ) {
                        logger.error( 'Error:' + error );
                    }
                );
            }
        } catch ( ex ) {
            logger.error( 'Error:' + ex.message );
        }
    }
};

/**
 * Gets scope for the categoryType with the given  name
 *
 * @param {object} legend - the legend data
 * @param {string} categoryTypeName - the name of the category
 * @return {string} scope - the scope value for the found category
 */
var getScopeForCategoryTypeFromLegendGivenCategoryTypeName = function( legend, categoryTypeName ) {
    var categoryTypes = legend.legendViews[ 0 ].categoryTypes;
    for( var i = 0; i < categoryTypes.length; i++ ) {
        if( categoryTypes[ i ].internalName === 'relations' ) {
            var categoryType = getCategoryWithGivenInternalNameFromCategories( categoryTypeName, categoryTypes[ i ].categories );
            if( categoryType ) {
                return categoryType.scope;
            }
        }
    }
    return null;
};

/**
 * Gets category with the given display name from category types
 *
 * @param {string} name - the display name of the category to be found
 * @param {object} categoryTypes - the set of category types
 * @return {object} category - the found category
 */
var getCategoryWithGivenInternalNameFromCategories = function( name, categoryTypes ) {
    for( var i = 0; i < categoryTypes.length; i++ ) {
        if( categoryTypes[ i ].internalName === name ) {
            return categoryTypes[ i ];
        }
    }
    return null;
};

/**
 *creates "CreateConnection" input
 *
 * @param {boolean} isQuickCreate - true if default creation mode without required properties
 * @param {object} dummyEdgeData - dummy edge graph item from GC
 * @param {object} sourceObject - source object for edge creation
 * @param {object} targetObject - target object for edge creation
 * @param {object} modelType - model type of the edge being created
 */
var createConnection = function( isQuickCreate, dummyEdgeData, sourceObject, targetObject, modelType ) {
    _createElementQueue.push( dummyEdgeData );

    if( isQuickCreate ) {
        var createInput = utilSvc.getCreateInput( modelType.name, modelType.displayName );
        executeCreateConnection( sourceObject, targetObject, createInput );
    } else {
        var context = {
            modelType: modelType.name,
            modelDisplayName: modelType.displayName,
            sourceObj: sourceObject,
            targetObj: targetObject,
            categoryType: 'Edge',
            recreatePanel: true,
            isolateMode: true
        };
        utilSvc.openRequiredCommandPanel( 'Ase0ArchitectureRequiredProperty', 'aw_toolsAndInfo', context );
    }
};

/**
 *create connection
 *
 * @param {object} sourceObject start object
 * @param {object} targetObject target object
 * @param {object} createInput create input
 */
var executeCreateConnection = function( sourceObject, targetObject, createInput ) {
    eventBus.publish( 'AMManageDiagramEvent', {
        primaryObjects: [ sourceObject ],
        secondaryObjects: [ targetObject ],
        userAction: 'CreateConnection',
        createInput: createInput,
        eventName: 'AMGraphEvent.createEdgeCompleted'
    } );
};

/**
 * Create "CreateTraceLink" input
 *
 * @param {boolean} isQuickCreate true for default TraceLink creation
 * @param {object} dummyEdgeData event data from GC contains dummy edge and ends information
 * @param {object} sourceObject source object for edge creation
 * @param {object} targetObject target object for edge creation
 * @param {object} modelType model type of the edge being created
 * @param {string} scope the scope value for the action
 */
var createTraceLink = function( isQuickCreate, dummyEdgeData, sourceObject, targetObject, modelType, scope ) {
    _createElementQueue.push( dummyEdgeData );

    if( isQuickCreate ) {
        var createInput = utilSvc.getCreateInput( modelType.name );
        executeCreateTraceLink( sourceObject, [ targetObject ], createInput, 'AMGraphEvent.createEdgeCompleted', scope );
    } else {
        var context = {
            modelType: modelType.name,
            modelDisplayName: modelType.displayName,
            recreatePanel: true,
            isolateMode: true,
            categoryType: 'Edge',
            sourceObj: sourceObject,
            targetObj: targetObject
        };
        utilSvc.openRequiredCommandPanel( 'Ase0ArchitectureRequiredProperty', 'aw_toolsAndInfo', context );
    }
};

/**
 *create traceLink
 *
 * @param {object} sourceObject start object
 * @param {object} targetObjects target objects
 * @param {object} createInput create input
 * @param {object} eventName event name
 * @param {string} scope the scope value for the action
 */
var executeCreateTraceLink = function( sourceObject, targetObjects, createInput, eventName, scope ) {
    var action = 'CreateTraceLink';

    if( scope === 'Context' ) {
        action = 'CreateOccTraceLink';
    }

    var eventData = [];
    _.forEach( targetObjects, function( target ) {
        var input = {
            primaryObjects: [ sourceObject, target ],
            userAction: action,
            createInput: createInput,
            eventName: eventName
        };
        eventData.push( input );
    } );
    if( eventData.length > 0 ) {
        eventBus.publish( 'AMManageDiagramEvent', eventData );
    }
};

/**
 *
 * @param {object} data declarative view model
 * @param {Object} panelContext panel context
 */
export let createObject = function( data, panelContext, editHandler ) {
    var createInput = addObjectUtils.getCreateInput( data, null, panelContext.modelType, editHandler );
    if( panelContext ) {
        if( panelContext.categoryType === 'Edge' ) {
            var modelType = cmm.getType( createInput.boName );

            var sourceObj = panelContext.sourceObj;
            var targetObj = panelContext.targetObj;
            if( createInput && sourceObj && targetObj ) {
                if( cmm.isInstanceOf( 'PSConnection', modelType ) ) {
                    executeCreateConnection( sourceObj, targetObj, createInput[ 0 ].createData );
                } else {
                    executeCreateTraceLink( sourceObj, [ targetObj ], createInput[ 0 ].createData, 'AMGraphEvent.createEdgeCompleted' );
                }
            } else {
                _createElementQueue.shift();
            }
        } else if( panelContext.categoryType === 'Port' ) {
            var ownerObj = panelContext.ownerObject;
            if( createInput && ownerObj ) {
                executeCreatePort( ownerObj, createInput[ 0 ].createData );
            } else {
                _createPortQueue.shift();
            }
        } else if( panelContext.categoryType === 'Node' ) {
            if( createInput ) {
                utilSvc.executeCreateObject( createInput );
            } else {
                data.createNodeQueue.shift();
            }
        }
    }
};

/**
 * Handle failure for object creation
 */
export let handleFailureFromCreateObjectWithReqProp = function() {
    if( _createElementQueue.length > 0 ) {
        _createElementQueue.shift();
    }
};

/**
 * removes the dummy edge in case error occurred
 *
 * @param {object} graphModel architecture graph model
 * @param {object} edge edge item
 */
var removeDummyEdgeOnError = function( graphModel, edge ) {
    if( graphModel.graphControl && graphModel.graphControl.graph ) {
        var graph = graphModel.graphControl.graph;
        graph.removeEdges( [ edge ] );
    }
};

/**
 * check if port object is already set and not getting changed
 * @param {*} port port graph item
 * @param {*} newPortObject new port object
 * @return {Boolean} true if port object is not getting changed
 */
var checkPortObjectNotChanged = function( port, newPortObject ) {
    if( port && port.modelObject && port.modelObject.uid && newPortObject && newPortObject.port.uid && port.modelObject.uid !== newPortObject.port.uid ) {
        return false;
    }
    return true;
};

/**
 * Check and update ports for new connection
 * @param {*} sourcePortObjectInfo sourcePortObjectInfo
 * @param {*} targetPortObjectInfo targetPortObjectInfo
 * @param {*} graphModel graphModel
 * @param {*} legendState legendState
 * @param {Object} graphState Architecture graph state
 */
var updatePortsForNewConnection = function( sourcePortObjectInfo, targetPortObjectInfo, graphModel, legendState, graphState ) {
    if( sourcePortObjectInfo && targetPortObjectInfo && graphModel && legendState ) {
        var sourcePort = _createElementQueue[ 0 ].sourcePort;
        var sourceNode = _createElementQueue[ 0 ].sourceNode;

        var targetPort = _createElementQueue[ 0 ].targetPort;
        var targetNode = _createElementQueue[ 0 ].targetNode;

        var sourcePortParentValid = false;
        if( sourcePort ) {
            sourcePortParentValid = checkPortObjectNotChanged( sourcePort, sourcePortObjectInfo );
        }

        var targetPortParentValid = false;
        if( targetPort ) {
            targetPortParentValid = checkPortObjectNotChanged( targetPort, targetPortObjectInfo );
        }

        if( sourcePort && targetPort && ( !sourcePortParentValid || !targetPortParentValid ) ) {
            // trying swapping ports from output
            var tempPort = sourcePort;
            sourcePort = targetPort;
            targetPort = tempPort;

            sourcePortParentValid = checkPortObjectNotChanged( sourcePort, sourcePortObjectInfo );
            targetPortParentValid = checkPortObjectNotChanged( targetPort, targetPortObjectInfo );
        }

        if( sourcePortParentValid && targetPortParentValid ) {
            if( sourcePort ) {
                updatePortWithNewObject( graphModel, sourcePort, legendState, sourcePortObjectInfo, sourceNode, graphState );
                architectureLayoutService.addPortToBeAddedWithPosition( sourcePort );
            }

            if( targetPort ) {
                updatePortWithNewObject( graphModel, targetPort, legendState, targetPortObjectInfo, targetNode, graphState );
                architectureLayoutService.addPortToBeAddedWithPosition( targetPort );
            }
        }
    }
};

/**
 * Handle completion of quick create item on graph.
 *
 * @param {object} graphDataResponse -  SOA execution response
 * @param {object} eventData - event data for the element created on graph
 * @param {object} data data
 * @param {Object} legendState legend state
 * @param {object} occContext occmgmt Context
 * @param {Object} graphState Architecture graph state
 */
export let edgeCreatedCompletionAction = function( graphDataResponse, eventData, data, legendState, occContext, graphState ) {
    const newGraphState = { ...graphState.value };
    var graphModel = data.graphModel;

    if( !graphDataResponse || !graphModel || !legendState ) {
        logger.error( 'Graph information for  edge creation is missing' );
        return;
    }

    var edge = _createElementQueue[ 0 ].edge;

    try {
        architectureLayoutService.clearGraphItemLists();

        if( graphDataResponse.ServiceData.partialErrors && graphDataResponse.output.length === 0 ) {
            removeDummyEdgeOnError( graphModel, edge );
            return;
        }
        var edgeObjectInfo;
        var sourcePortObjectInfo;
        var targetPortObjectInfo;

        var edgeOutputData = graphDataResponse.output[ 0 ];
        if( edgeOutputData && edgeOutputData.edgeData && edgeOutputData.edgeData.length > 0 ) {
            edgeObjectInfo = edgeOutputData.edgeData[ 0 ];
        }
        if( edgeOutputData.portData && edgeOutputData.portData.length > 0 ) {
            sourcePortObjectInfo = edgeOutputData.portData[ 0 ];
            targetPortObjectInfo = edgeOutputData.portData[ 1 ];
        }

        if( edgeObjectInfo && cmm.isInstanceOf( 'Awb0Element', edgeObjectInfo.edge.modelType ) ) {
            updatePortsForNewConnection( sourcePortObjectInfo, targetPortObjectInfo, graphModel, legendState, newGraphState );

            utilSvc.checkWhetherToSelectObjectInAce( edgeObjectInfo.edge.props.awb0Parent.dbValues[ 0 ],
                edgeObjectInfo.edge.uid, true, occContext );
        }

        if( edge && edgeObjectInfo ) {
            var edgeCategory = eventData.categoryType;

            var affectedNodeList = updateEdgeWithNewObject( graphModel, edge, legendState, edgeObjectInfo, edgeCategory, newGraphState );
            if( affectedNodeList.length > 0 ) {
                nodeCommandService.updateGraphInfoOnNodes( affectedNodeList, graphModel, data, legendState.activeView );
            }
            architectureLayoutService.addEdgeToBeAdded( edge );
        }

        architectureLayoutService.applyGraphLayout( graphModel, true, false, false );
    } catch ( ex ) {
        removeDummyEdgeOnError( graphModel, edge );
        logger.error( 'Error:' + ex.message );
    } finally {
        _createElementQueue.shift();
        resetAcePwa( graphDataResponse, occContext );
    }
    graphState.update && graphState.update( newGraphState );
};

var resetAcePwa = function( graphDataResponse, occContext ) {
    var doSkipReset = false;
    var clientId = '';

    if( graphDataResponse.ServiceData.partialErrors && graphDataResponse.output.length === 0 ) {
        // If the SOA operation is not successful, you can skip acePwa.reset
        return;
    } else if( graphDataResponse.output && graphDataResponse.output.length > 0 && graphDataResponse.output[ 0 ].clientId ) {
        clientId = graphDataResponse.output[ 0 ].clientId;
    }

    var clientIdStr = clientId.replace( /\d/g, '' );

    if( clientIdStr === 'CreateTraceLink' ) {
        // skip acePwa.reset if operation is createTracelink.
        doSkipReset = true;
    }

    // this code is for CreatePort action
    if( clientIdStr === 'CreatePort' ) {
        // skip acePwa.reset if operation is CreatePort and show port is off.

        let includeInterfaces = occContext.persistentRequestPref && occContext.persistentRequestPref.includeInterfaces ? occContext.persistentRequestPref.includeInterfaces : false;
        doSkipReset = !includeInterfaces;
    }

    // this code is for CreateConnection action
    if( clientIdStr === 'CreateConnection' ) {
        // skip acePwa.reset if operation is CreatePort and show connection is off.

        let includeConnections = occContext.persistentRequestPref && occContext.persistentRequestPref.includeConnections ? occContext.persistentRequestPref.includeConnections : false;
        doSkipReset = !includeConnections;
    }

    if( !doSkipReset ) {
        occmgmtUtils.updateValueOnCtxOrState( 'pwaReset', true, occContext );
    }
};

/**
 * update the awb0direction on port
 *
 * @param {object} portModelObject port model object
 * @param {object} portInfo port information
 */
var updatePortDirectionProp = function( portModelObject, portInfo ) {
    if( !portModelObject.props.awb0Direction ) {
        var direction = {
            dbValues: []
        };
        portModelObject.props.awb0Direction = direction;
        if( portInfo.displayProperties.length > 1 ) {
            portModelObject.props.awb0Direction.dbValues[ 0 ] = portInfo.displayProperties[ 1 ];
        }
    }
};

export let reconnectCompletionAction = function( data, graphData, legendState, graphState ) {
    const newGraphState = { ...graphState.value };
    var graphModel = data.graphModel;

    let reconnect = {
        selectedConnection : null,
        isGraphInRelationCreationMode : false,
        previousInputMode : null,
        existingNodeEndObjects : [],
        existingPortEndObjects : []
    };

    // clear Reconnect Active State
    if( newGraphState.isReconnectCmdActive ) {
        newGraphState.isReconnectCmdActive = false;
        graphState.update && graphState.update( newGraphState );
    }

    if( !graphData || !graphModel || !legendState ) {
        logger.error( 'Graph information for  edge creation is missing' );
        return reconnect;
    }

    try {
        var graph = graphModel.graphControl.graph;
        var edge = null;
        if( _createElementQueue && _createElementQueue.length > 0 ) {
            edge = _createElementQueue[ 0 ].edge;
        }

        // if any error
        if( graphData.ServiceData.partialErrors && graphData.output.length === 0 ) {
            removeDummyEdgeOnError( graphModel, edge );
            return reconnect;
        }

        _.forEach( graphData.output, function( output ) {
            _.forEach( output.nodeData, function( nodeInformation ) {
                var nodeUid = nodeInformation.node.uid;
                var nodeInfo = nodeInformation.nodeInfo;
                if( nodeInfo ) {
                    const nodeModel = graphModel.dataModel.nodeModels[ nodeUid ];
                    if( nodeModel ) {
                        const node = nodeModel.graphItem;
                        const connectionTypes = nodeInfo.danglingConnectionTypes;
                        if( connectionTypes && connectionTypes.length > 0 ) {
                            node.hasDanglingConnection = true;
                            node.connectionType = connectionTypes[ 0 ];
                        } else {
                            node.hasDanglingConnection = false;
                            node.connectionType = null;
                        }
                    }
                }
            } );

            _.forEach( output.portData, function( portInformation ) {
                var portUid = portInformation.port.uid;
                var portInfo = portInformation.portInfo;
                if( portInfo ) {
                    const portModel = graphModel.dataModel.portModels[ portUid ];
                    const port = portModel?.graphItem;
                    if( port ) {
                        var connectionTypes = portInfo.danglingConnectionTypes;
                        var portStyle = port.style;
                        if( connectionTypes && connectionTypes.length > 0 ) {
                            // set Style for port
                            if( portStyle ) {
                                portStyle.borderColor = '(255,0,0)';
                                portStyle.thickness = 2;
                                graphModel.graphControl.graph.setPortStyle( port, portStyle );
                            }
                            port.hasDanglingConnection = true;
                            port.connectionType = connectionTypes[ 0 ];
                        } else {
                            // get defult style from legend
                            var activeLegendView = null;
                            if( legendState ) {
                                activeLegendView = legendState.activeView;
                            }
                            var portModelObject = portInformation.port;
                            var scopeFilter;
                            var underlyingObjUid = portModelObject.props.awb0UnderlyingObject.dbValues[ 0 ];
                            var portCategory = archGraphLegendManager.getCategoryTypeFromObjectUid( underlyingObjUid,
                                scopeFilter, activeLegendView );

                            //get edge style from graph legend
                            if( portCategory && portCategory.localeCompare( '' ) !== 0 ) {
                                portStyle = _.clone( graphLegendSvc.getStyleFromLegend( 'ports', portCategory, activeLegendView ) );
                            }

                            updatePortDirectionProp( portModelObject, portInformation.portInfo );

                            var portSVG;
                            if( portModelObject.props.awb0Direction.dbValues.length > 0 ) {
                                var portDirection = portModelObject.props.awb0Direction.dbValues[ 0 ];

                                if( portDirection === 'fnd0Input' ) {
                                    portSVG = InputPort;
                                } else if( portDirection === 'fnd0Output' ) {
                                    portSVG = OutputPort;
                                } else if( portDirection === 'fnd0Bidirectional' ) {
                                    portSVG = BiDirectionalPort;
                                }
                            }

                            if( portStyle && portSVG ) {
                                portStyle.imageSVGString = portSVG;
                                graphModel.graphControl.graph.setPortStyle( port, portStyle );
                            }
                            port.hasDanglingConnection = false;
                            port.connectionType = null;
                        }
                    }
                }
            } );

            _.forEach( output.edgeData, function( edgeInformation ) {
                const srcNodeModel = graphModel.dataModel.nodeModels[ edgeInformation.end1Element.props.awb0Parent.dbValues[ 0 ] ];
                const tarNodeModel = graphModel.dataModel.nodeModels[ edgeInformation.end2Element.props.awb0Parent.dbValues[ 0 ] ];
                if( srcNodeModel && srcNodeModel.graphItem.isVisible() && tarNodeModel && tarNodeModel.graphItem.isVisible() ) {
                    let categoryToAdd = '';
                    const relationObjectType = edgeInformation.edgeInfo.edgeType[ 0 ];

                    const srcNodeType = srcNodeModel.graphItem.nodeType;
                    const tarNodeType = tarNodeModel.graphItem.nodeType;

                    if( relationObjectType && tarNodeType ) {
                        categoryToAdd = relationObjectType + ';' + tarNodeType;

                        // Add outgoing degree
                        srcNodeModel.graphItem.outgoingRelations.push( categoryToAdd );
                    }

                    if( relationObjectType && srcNodeType ) {
                        categoryToAdd = relationObjectType + ';' + srcNodeType;

                        // Add incoming degree
                        tarNodeModel.graphItem.incomingRelations.push( categoryToAdd );
                    }
                }
            } );
        } );

        // Remove dummy edge
        if( edge ) {
            graph.removeEdges( [ edge ] );
        }

        // fire DrawGraph
        var eventData = {
            graphData: graphData
        };
        eventBus.publish( 'AMGraphEvent.drawGraph', eventData );
    } catch ( ex ) {
        logger.error( 'Error:' + ex.message );
    } finally {
        _createElementQueue.shift();
    }

    return reconnect;
};

/**
 * update the edge style
 *
 * @param {object} graphModel graphModel object
 * @param {object} edge edge graph item
 * @param {object} legendState legendState information of selected object from legend panel
 * @param {object} newEdgeObject edge response from SOA
 * @param {object} edgeCategory category type of an edge
 * @param {object} graphState Architecture graph state
 * @returns {Array} list of affected nodes
 */
var updateEdgeWithNewObject = function( graphModel, edge, legendState, newEdgeObject, edgeCategory, graphState ) {
    var affectedNodeList = [];
    if( graphModel.graphControl && graphModel.graphControl.graph ) {
        var graph = graphModel.graphControl.graph;

        var edgeStyle;

        //get edge style from graph legend
        if( edgeCategory && edgeCategory.localeCompare( '' ) !== 0 ) {
            edgeStyle = _.clone( graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory,
                legendState.activeView ) );

            if( cmm.isInstanceOf( 'Awb0Interface', newEdgeObject.end1Element.modelType ) ) {
                if( newEdgeObject.end1Element.props.awb0Direction.dbValues[ 0 ] === 'fnd0Output' ) {
                    if( edgeStyle.sourceArrow ) {
                        delete edgeStyle.sourceArrow;
                    }
                }
            }
        }

        if( edgeStyle && newEdgeObject.edgeInfo ) {
            if( newEdgeObject.edgeInfo.showIndicator && newEdgeObject.edgeInfo.showIndicator.length > 0 ) {
                if( newEdgeObject.edgeInfo.showIndicator[ 0 ] === '1' ) {
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

        edge.modelObject = newEdgeObject.edge;
        edge.category = edgeCategory;

        isConnection = cmm.isInstanceOf( 'Awb0Connection', edge.modelObject.modelType );
        if( isConnection ) {
            var underlyingObjectUid = _.get( newEdgeObject.edge, 'props.awb0UnderlyingObject.dbValues[0]', undefined );
            var underlyingObject = cdm.getObject( underlyingObjectUid );
            if( underlyingObject ) {
                edge.edgeType = _.get( underlyingObject, 'type', undefined );
            }
        } else if( newEdgeObject.edge.type && newEdgeObject.edge.type.length > 0 ) {
            edge.edgeType = newEdgeObject.edge.type;
        }

        graph.setEdgeStyle( edge, edgeStyle );
        var edgeLabel = null;
        if( newEdgeObject.edge ) {
            var labelProp = labelService.getPropertyName( newEdgeObject.edge );
            edgeLabel = _.get( newEdgeObject, 'edge.props.' + labelProp + '.uiValues[0]' );
        }
        if( !edgeLabel ) {
            edgeLabel = _.get( newEdgeObject, 'edgeInfo.edgeLabel[0]', '' );
        }
        graph.setLabel( edge, edgeLabel );
        utilSvc.setLabelVisibilityOnGraphItem( edge, graphState );
        graphModel.graphControl.graph.updateOnItemsAdded( [ edge ] );

        var isConnection = false;
        if( edge.modelObject ) {
            isConnection = cmm.isInstanceOf( 'Awb0Connection', edge.modelObject.modelType );

            var srcNode = edge.getSourceNode();
            var tarNode = edge.getTargetNode();
            if( srcNode && srcNode.isVisible() && tarNode && tarNode.isVisible() ) {
                affectedNodeList.push( srcNode );
                affectedNodeList.push( tarNode );

                var categoryToAdd = '';

                var edgeType = edge.edgeType;
                if( !isConnection && newEdgeObject.edgeInfo.scopeFilter && newEdgeObject.edgeInfo.scopeFilter[ 0 ] && newEdgeObject.edgeInfo.scopeFilter[ 0 ] === 'Context' ) {
                    edgeType = edgeType + ':' + newEdgeObject.edgeInfo.scopeFilter[ 0 ];
                }
                var srcType = srcNode.nodeType;
                var tarType = tarNode.nodeType;
                if( edgeType && tarType ) {
                    categoryToAdd = edgeType + ';' + tarType;

                    // Add outgoing degree
                    srcNode.outgoingRelations.push( categoryToAdd );
                }
                if( edgeType && srcType ) {
                    categoryToAdd = edgeType + ';' + srcType;

                    // Add incoming degree
                    tarNode.incomingRelations.push( categoryToAdd );
                }
            }
            if( edgeStyle && tarNode ) {
                utilSvc.updateEdgeStyle( edge, edgeStyle, graph, tarNode );
            }
        }

        var responseEdgeData = [];
        var output = {};
        var uidToCheck;
        if( !isConnection ) {
            if( newEdgeObject.end1Element.uid && newEdgeObject.end2Element.uid ) {
                var end1ElementUid = newEdgeObject.end1Element.uid;
                var end2ElementUid = newEdgeObject.end2Element.uid;
                uidToCheck = newEdgeObject.edge.uid + '+' + end1ElementUid + '+' + end2ElementUid;
            }
        } else {
            uidToCheck = newEdgeObject.edge.uid;
        }
        let edgeModel = graphModel.dataModel.edgeModels[ uidToCheck ];
        if( !edgeModel ) {
            edge.appData = {
                edgeUid: uidToCheck
            };
            edgeModel = {
                id: uidToCheck,
                modelObject: edge.modelObject,
                category: edgeCategory
            };
            graphModel.addEdgeModel( edge, edgeModel );
            responseEdgeData = [];
            output = {};
            output.edgeData = [];
            output.edgeData.push( newEdgeObject );
            responseEdgeData.push( output );
            archDataCache.addEdgeCache( responseEdgeData );
        }
    }
    return affectedNodeList;
};


/**
 * update the port style
 *
 * @param {object} graphModel graphModel object
 * @param {object} port port graphItem
 * @param {object} legendState legendState information of selected object from legend panel
 * @param {object} newPortObject new port object
 * @param {object} node node information from graph
 * @param {Object} graphState Architecture graph state
 */
var updatePortWithNewObject = function( graphModel, port, legendState, newPortObject, node, graphState ) {
    if( graphModel.graphControl && graphModel.graphControl.graph ) {
        var graph = graphModel.graphControl.graph;
        var scopeFilter;
        var underlyingObjUid = newPortObject.port.props.awb0UnderlyingObject.dbValues[ 0 ];
        var portCategory = archGraphLegendManager.getCategoryTypeFromObjectUid( underlyingObjUid,
            scopeFilter, legendState.activeView );

        var portStyle;
        //get port style from graph legend
        if( portCategory && portCategory.localeCompare( '' ) !== 0 ) {
            portStyle = _.clone( graphLegendSvc.getStyleFromLegend( 'ports', portCategory, legendState.activeView ) );
        }

        port.modelObject = newPortObject.port;
        port.category = portCategory;
        var portModelObject = port.modelObject;

        updatePortDirectionProp( portModelObject, newPortObject.portInfo );

        var portSVG;
        var portDisplayInfo = portModelObject.props.awb0Direction.dbValues[ 0 ];
        if( portDisplayInfo ) {
            if( portDisplayInfo === 'fnd0Input' ) {
                portSVG = InputPort;
            } else if( portDisplayInfo === 'fnd0Output' ) {
                portSVG = OutputPort;
            } else if( portDisplayInfo === 'fnd0Bidirectional' ) {
                portSVG = BiDirectionalPort;
            }
        }

        if( portStyle ) {
            portStyle.borderColor = graphModel.config.defaults.portStyle.borderColor;
            if( portSVG ) {
                portStyle.imageSVGString = portSVG;
            }
        }

        graph.setPortStyle( port, portStyle );
        let labelProp = labelService.getPropertyName( newPortObject.port );
        let portLabel = _.get( newPortObject, 'port.props.' + labelProp + '.dbValues[0]' );
        if( !portLabel ) {
            portLabel = _.get( newPortObject, 'portInfo.displayProperties[0]', '' );
        }
        graph.setLabel( port, portLabel );
        utilSvc.setLabelVisibilityOnGraphItem( port, graphState );
        graphModel.graphControl.graph.updateOnItemsAdded( [ port ] );

        if( !graphModel.dataModel.portModels[ newPortObject.port.uid ] ) {
            let portModel = {
                id: newPortObject.port.uid,
                modelObject: newPortObject.port,
                category: portCategory
            };
            graphModel.addPortModel( port, portModel );

            var responsePortData = [];
            var output = {};
            output.portData = [];
            output.portData.push( newPortObject );
            responsePortData.push( output );
            archDataCache.addPortCache( responsePortData );
            if( node && node.portDegree ) {
                node.portDegree.push( portCategory );
            }
        }
    }
};

/**
 * quick create the port item from relation legend panel
 *
 * @param {object} eventData - event data about the element created on graph
 */
export let quickPortCreateAction = function( eventData ) {
    var categoryType = eventData.objectTypeToCreate;
    var requiredPropNames = [ 'object_name' ];

    var ownerObject;

    if( eventData.owner ) {
        ownerObject = eventData.owner.modelObject;
    }

    if( !categoryType || !ownerObject || !eventData.port ) {
        logger.error( 'port creation failed due to missing port data' );
        return;
    }

    try {
        utilSvc.canObjectQuickCreated( categoryType, requiredPropNames ).then(
            function( response ) {
                var isQuickCreate = response;
                var modelType = cmm.getType( categoryType );
                if( modelType ) {
                    createPort( isQuickCreate, eventData, ownerObject, modelType );
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
 *  Get parent object as input data
 *  @param {object} data declarative view model
 *
 * @returns {Object} parent elements
 */
export let getParentElementsToAdd = function( data ) {
    return data.createNodeQueue[ 0 ].parentNode.modelObject;
};

/**
 * returns objectsToBeAdded input as array
 *
 * @param {*} outputCreatedObject objects to be added
 *
 * @returns {object[]} outputCreatedObject as array
 */
export let getObjectsToBeAdd = function( outputCreatedObject ) {
    if( _.isArray( outputCreatedObject ) ) {
        return outputCreatedObject;
    }
    return [ outputCreatedObject ];
};

/**
 *  Get newly added object as input data
 *
 *  @param {object} data declarative view model
 *
 *  @returns {String} newly added element Uid
 */
export let getNewlyAddedChildElementUid = function( data ) {
    if( data.addElementResponse.selectedNewElementInfo.newElements ) {
        return data.addElementResponse.selectedNewElementInfo.newElements[ 0 ].uid;
    }
    return null;
};

/**
 *  Get newly added objects as input data
 *
 *  @param {object} data declarative view model
 *  @param {object} occContext occmgmt Context
 *  @returns {Array} newly added elements
 */
export let getNewlyAddedChildElements = function( data, occContext ) {
    // Collect the children for selected input parent.
    let newChildElements = [];

    if( data.addElementResponse.selectedNewElementInfo.newElements ) {
        for( var i = 0; i < data.addElementResponse.selectedNewElementInfo.newElements.length; ++i ) {
            newChildElements.push( data.addElementResponse.selectedNewElementInfo.newElements[ i ] );
        }
    }

    // if the element is already present in newChildElements don't add it.
    let selectednewInfosize = newChildElements.length;

    let vmc = occContext.vmc;
    if( vmc ) {
        // Collect the children for other reused parent instances
        for( let j = 0; j < data.addElementResponse.newElementInfos.length; j++ ) {
            let newElementInfo = data.addElementResponse.newElementInfos[j];
            let parentIdx = _.findLastIndex( vmc.loadedVMObjects, function( vmo ) {
                return vmo.uid === newElementInfo.parentElement.uid;
            } );

            let parentVMO = vmc.getViewModelObject( parentIdx );

            // If parent is expanded then only add the children
            if( parentVMO && parentVMO.isExpanded ) {
                _.forEach( newElementInfo.newElements, function( newElement ) {
                    let found = 0;
                    for( let k = 0; k < selectednewInfosize; k++ ) {
                        found = 0;
                        if( newChildElements[k].uid === newElement.occurrenceId ) {
                            found = 1;
                            break;
                        }
                    }
                    if ( found === 0 ) {
                        newChildElements.push( newElement );
                    }
                } );
            }
        }
    }

    return newChildElements;
};

/**
 *creates "CreatePort" input
 *
 * @param {boolean} isQuickCreate - true if default creation mode without required properties
 * @param {object} dummyPort - dummy port graph item from GC
 * @param {object} ownerObject - owner object for port creation
 * @param {object} modelType - model type of the port being created
 */
var createPort = function( isQuickCreate, dummyPort, ownerObject, modelType ) {
    _createPortQueue.push( dummyPort );

    if( isQuickCreate ) {
        var createInput = utilSvc.getCreateInput( modelType.name, '' );
        executeCreatePort( ownerObject, createInput );
    } else {
        var context = {
            modelType: modelType.name,
            modelDisplayName: modelType.displayName,
            ownerObject: ownerObject,
            categoryType: 'Port',
            recreatePanel: true,
            isolateMode: true
        };
        utilSvc.openRequiredCommandPanel( 'Ase0ArchitectureRequiredProperty', 'aw_toolsAndInfo', context );
    }
};

/**
 *create port
 *
 * @param {object} ownerObject owner object
 * @param {object} createInput create input
 */
var executeCreatePort = function( ownerObject, createInput ) {
    eventBus.publish( 'AMManageDiagramEvent', {
        primaryObjects: [ ownerObject ],
        userAction: 'CreatePort',
        createInput: createInput
    } );
};

/**
 * Handle completion of quick create item on graph.
 *
 * @param {object} graphDataResponse -  SOA execution response
 * @param {object} graphModel graph Model
 * @param {object} legendState legend State
 * @param {object} occContext occmgmt Context
 * @param {Object} graphState Architecture graph state
 */
export let portCreatedCompletionAction = function( graphDataResponse, graphModel, legendState, occContext, graphState ) {
    const newGraphState = { ...graphState.value };

    if( !graphDataResponse || !graphModel || !legendState ) {
        logger.error( 'Graph information for  port creation is missing' );
        return;
    }

    try {
        var port = _createPortQueue[ 0 ].port;

        architectureLayoutService.clearGraphItemLists();
        if( graphDataResponse.ServiceData.partialErrors && graphDataResponse.output.length === 0 ) {
            if( graphModel.graphControl && graphModel.graphControl.graph ) {
                var graph = graphModel.graphControl.graph;
                graph.removePorts( [ port ] );
            }
            return;
        }

        var portObjectInfo;
        var portOutputData = graphDataResponse.output[ 0 ];
        if( portOutputData && portOutputData.portData && portOutputData.portData.length > 0 ) {
            portObjectInfo = portOutputData.portData[ 0 ];
        }
        if( port && portObjectInfo && portObjectInfo.portOwner ) {
            var ownerObject = _createPortQueue[ 0 ].owner;
            updatePortWithNewObject( graphModel, port, legendState, portObjectInfo, ownerObject, newGraphState );
            architectureLayoutService.addPortToBeAddedWithPosition( port );
        }
        architectureLayoutService.applyGraphLayout( graphModel, true, false, false );
    } catch ( ex ) {
        logger.error( 'Error:' + ex.message );
    } finally {
        _createPortQueue.shift();
        resetAcePwa( graphDataResponse, occContext );
    }
    graphState.update && graphState.update( newGraphState );
};

/**
 * quick create the item from relation legend panel
 *
 * @param {object} eventData - event data for the element created on graph
 */
export let dragAndDropEdgeCreateAction = function( eventData ) {
    if( eventData ) {
        if( !eventData.sourceObject || !eventData.targetObjects ) {
            logger.error( 'edge creation failed due to missing edge data' );
            return;
        }
        var createInput = utilSvc.getCreateInput( '' );
        executeCreateTraceLink( eventData.sourceObject, eventData.targetObjects, createInput, 'AMGraphEvent.drawGraph' );
    }
};

/**
 * create input and execute the object creation
 *
 * @param {object} data declaritive view model
 * @param {object} eventData node graph item
 */
export let createOccuranceOnDrop = function( data, eventData ) {
    if( eventData && ( !eventData.nodes || !eventData.nodes.length > 0 ) ) {
        logger.error( 'node creation failed due to missing node data' );
        return;
    }
    var objectsToBeAdded = [];
    _.forEach( eventData.nodes, function( node ) {
        if( node && node.modelObject ) {
            objectsToBeAdded.push( node.modelObject );
        }
    } );

    if( objectsToBeAdded.length > 0 ) {
        data.createNodeQueue.push( eventData );

        //create input for the event
        data.outputCreatedObject = objectsToBeAdded;
        eventBus.publish( 'AMAddObjectEvent' );
    }
};

export let moveConnectionAction = function( eventData ) {
    if( eventData && eventData.oldSourcePort && eventData.oldTargetPort && eventData.relationEdge && eventData.newSourcePort && eventData.newTargetPort ) {
        _moveConnectionQueue.push( eventData );

        eventBus.publish( 'AMManageDiagramEvent', {
            primaryObjects: [ eventData.newSourcePort.modelObject, eventData.relationEdge.modelObject ],
            secondaryObjects: [ eventData.newTargetPort.modelObject ],
            userAction: 'MoveConnection',
            eventName: 'AMGraphEvent.moveConnectionCompleted'
        } );
    }
};

export let moveConnectionCompleteAction = function( data, graphData, activeLegendView ) {
    let graphModel = null;

    if( data.graphModel ) {
        graphModel = data.graphModel;
    }

    if( !graphData || !graphModel ) {
        logger.error( 'Graph information for edge moving is missing' );
        return;
    }

    try {
        let edge = null;
        if( _moveConnectionQueue && _moveConnectionQueue.length > 0 ) {
            edge = _moveConnectionQueue[ 0 ].relationEdge;
        } else {
            return;
        }

        // if any error
        if( graphData.ServiceData.partialErrors && graphData.output.length === 0 ) {
            removeDummyEdgeOnError( graphModel, edge );
            return;
        }

        _.forEach( graphData.output, function( output ) {
            _.forEach( output.edgeData, function( edgeInformation ) {
                if( edge && edgeInformation ) {
                    let oldSourcePort = _moveConnectionQueue[0].oldSourcePort;
                    let oldTargetPort = _moveConnectionQueue[0].oldTargetPort;

                    var affectedNodeList = updateEdgeWithRelationChange( graphModel, edge, oldSourcePort, oldTargetPort );
                    if( affectedNodeList.length > 0 ) {
                        nodeCommandService.updateGraphInfoOnNodes( affectedNodeList, graphModel, data, activeLegendView );
                    }
                }
            } );
        } );
    } catch ( ex ) {
        logger.error( 'Error:' + ex.message );
    } finally {
        _moveConnectionQueue.shift();
    }
};

let updateEdgeWithRelationChange = function( graphModel, edge, oldSourcePort, oldTargetPort ) {
    let affectedNodeList = [];
    if( graphModel.graphControl && graphModel.graphControl.graph && edge.modelObject && edge.modelObject.modelType && cmm.isInstanceOf( 'Awb0Connection', edge.modelObject.modelType ) ) {
        let srcNode = edge.getSourceNode();
        let tarNode = edge.getTargetNode();
        let sourcePort = edge.getSourcePort();
        let targetPort = edge.getTargetPort();
        if( srcNode && srcNode.isVisible() && tarNode && tarNode.isVisible() && sourcePort && sourcePort.isVisible() && targetPort && targetPort.isVisible() ) {
            let categoryToAdd = '';
            let edgeType = edge.edgeType;
            let srcType = srcNode.nodeType;
            let tarType = tarNode.nodeType;
            let oldSrcNode = oldSourcePort.getOwner();
            if( edgeType && tarType && sourcePort.modelObject !== oldSourcePort.modelObject && oldSrcNode && oldSrcNode.modelObject !== srcNode.modelObject ) {
                categoryToAdd = edgeType + ';' + tarType;

                // Add outgoing degree
                srcNode.outgoingRelations.push( categoryToAdd );
                affectedNodeList.push( srcNode );

                let categoryToRemove = edgeType + ';' + oldSrcNode.nodeType;
                // remove outgoing degree
                oldSrcNode.outgoingRelations.splice( oldSrcNode.outgoingRelations.indexOf( categoryToRemove ), 1 );
                affectedNodeList.push( oldSrcNode );
            }
            let oldTarNode = oldTargetPort.getOwner();
            if( edgeType && srcType && targetPort.modelObject !== oldTargetPort.modelObject && oldTarNode && oldTarNode.modelObject !== srcNode.modelObject ) {
                categoryToAdd = edgeType + ';' + srcType;

                // Add incoming degree
                tarNode.incomingRelations.push( categoryToAdd );
                affectedNodeList.push( tarNode );
                affectedNodeList.push( oldTargetPort.getOwner() );

                let categoryToRemove = edgeType + ';' + oldTarNode.nodeType;
                // remove incoming degree
                oldTarNode.incomingRelations.splice( oldTarNode.incomingRelations.indexOf( categoryToRemove ), 1 );
                affectedNodeList.push( oldTarNode );
            }
        }
    }
    return affectedNodeList;
};

export let getExpandedValue = function( data, occContext ) {
    let parent = getParentElementsToAdd( data );
    if( parent && occContext && occContext.vmc ) {
        let vmc = occContext.vmc;
        let parentIdx = _.findLastIndex( vmc.loadedVMObjects, function( vmo ) {
            return vmo.uid === parent.uid;
        } );
        if( parentIdx > -1 ) {
            let parentVMO = vmc.getViewModelObject( parentIdx );
            if ( parentVMO.isExpanded ) {
                return 'true';
            }
        }
    }
    return 'false';
};

const exports = {
    quickEdgeCreateAction,
    createObject,
    handleFailureFromCreateObjectWithReqProp,
    edgeCreatedCompletionAction,
    reconnectCompletionAction,
    quickPortCreateAction,
    getParentElementsToAdd,
    getObjectsToBeAdd,
    getNewlyAddedChildElementUid,
    getNewlyAddedChildElements,
    portCreatedCompletionAction,
    dragAndDropEdgeCreateAction,
    createOccuranceOnDrop,
    moveConnectionCompleteAction,
    moveConnectionAction,
    getExpandedValue
};
export default exports;
