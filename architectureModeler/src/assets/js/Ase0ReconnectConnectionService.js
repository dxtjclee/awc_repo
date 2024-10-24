//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*
 global
 */

/**
 * Ase0ReconnectConnectionService Reconnect Connection In diagram
 *
 * @module js/Ase0ReconnectConnectionService
 */
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import _ from 'lodash';
import eventBus from 'js/eventBus';

/**
 * Deletes nodes/ports/edges
 *
 * @param {Object} data data object.
 * @param {Array} selObjects selected objects
 * @param {Object} activeLegendView active legend view
 * @param {Object} graphState graph State
 */
export let reconnectConnection = function( data, selObjects, activeLegendView, graphState ) {
    const newGraphState = { ...graphState.value };
    let reconnectData = data.reconnect;

    // First Check if Reconnect Command is Avtive or not
    if( newGraphState.isReconnectCmdActive ) {
        newGraphState.isReconnectCmdActive = false;
        reconnectData = resetReconnectData( data );
        graphState.update && graphState.update( newGraphState );
        return reconnectData;
    }
    newGraphState.isReconnectCmdActive = true;

    let graphModel = data.graphModel;
    if( selObjects ) {
        // valid only for single selection.
        var selectedObj = selObjects[ 0 ];
        var primaryObjects = [];
        if( selectedObj && selObjects.length === 1 ) { // Single select
            // Check if it is of type Connection
            var isConnection = cmm.isInstanceOf( 'Awb0Connection', selectedObj.modelType );
            // getEndElements
            if( isConnection ) {
                primaryObjects.push( selectedObj );
                var eventData = {
                    userAction: 'Connection.GetEndElements',
                    primaryObjects: primaryObjects
                };
                eventBus.publish( 'AMManageDiagramEvent', eventData );
            }

            var isPort = cmm.isInstanceOf( 'Awb0Interface', selectedObj.modelType );
            var isNode = cmm.isInstanceOf( 'Ase0LogicalElement', selectedObj.modelType );
            if( isPort || isNode ) {
                reconnectData = preReconnectProcessing( data, selectedObj, isNode, activeLegendView );
            }
        } else { // Multiselect
            // Get all nodes on graph and send them to server, so that server can use them to build paths
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

            var eventData1 = {
                userAction: 'Connection.Reconnect',
                primaryObjects: selObjects,
                visibleObjects: visibleObjects,
                eventName: 'AMGraphEvent.reconnectCompleted'
            };
            eventBus.publish( 'AMManageDiagramEvent', eventData1 );
        }
    }
    graphState.update && graphState.update( newGraphState );
    return reconnectData;
};

export let reconnectRelation = function( data, selectedConnection, sourceObject, targetObject, visibleObjects ) {
    var graphModel = data.graphModel;

    var existingPortEndObjects = data.reconnect.existingPortEndObjects;
    var existingNodeEndObjects = data.reconnect.existingNodeEndObjects;

    var isSource = false;
    var isTarget = false;

    var sourceObj = sourceObject;
    var targetObj = targetObject;

    if( existingPortEndObjects ) {
        var index = _.indexOf( existingPortEndObjects, sourceObj );
        if( index !== -1 ) {
            isSource = true;
        }

        var indx = _.indexOf( existingPortEndObjects, targetObj );
        if( indx !== -1 ) {
            isTarget = true;
        }
    }

    if( existingNodeEndObjects ) {
        var index1 = _.indexOf( existingNodeEndObjects, sourceObj );
        if( index1 !== -1 ) {
            isSource = true;
        }

        var indx1 = _.indexOf( existingNodeEndObjects, targetObj );
        if( indx1 !== -1 ) {
            isTarget = true;
        }
    }

    if( cmm.isInstanceOf( 'Awb0Interface', sourceObject.modelType ) ) {
        var parentObject = getParentOccurrence( sourceObject );
        var idx = _.indexOf( existingNodeEndObjects, parentObject );
        if( idx !== -1 ) {
            isSource = true;
        }
    }

    if( cmm.isInstanceOf( 'Awb0Interface', targetObject.modelType ) ) {
        var parentObject1 = getParentOccurrence( targetObject );
        var idx1 = _.indexOf( existingNodeEndObjects, parentObject1 );
        if( idx1 !== -1 ) {
            isTarget = true;
        }
    }

    if( isSource && existingPortEndObjects && existingPortEndObjects.length > 0 ) {
        sourceObj = existingPortEndObjects[ 0 ];
    }

    if( isTarget && existingPortEndObjects && existingPortEndObjects.length > 0 ) {
        targetObj = existingPortEndObjects[ 0 ];
    }

    var primaryObjects = [];
    if( selectedConnection ) {
        primaryObjects.push( selectedConnection );
    }
    if( sourceObj ) {
        primaryObjects.push( sourceObj );
    }
    if( targetObj ) {
        primaryObjects.push( targetObj );
    }

    graphModel.update( 'config.inputMode', data.reconnect.previousInputMode );

    var eventData = {
        userAction: 'Connection.Reconnect',
        primaryObjects: primaryObjects,
        visibleObjects: visibleObjects,
        eventName: 'AMGraphEvent.reconnectCompleted'
    };
    eventBus.publish( 'AMManageDiagramEvent', eventData );
};

var getParentOccurrence = function( occurrence ) {
    var parent = null;
    if( occurrence ) {
        // check if awb0Parent property exists
        var parentProp = occurrence.props.awb0Parent;
        if( parentProp ) {
            var propVal = parentProp.dbValues[ 0 ];
            var nodeObject = cdm.getObject( propVal );
            if( nodeObject ) {
                parent = nodeObject;
            }
        }
    }
    return parent;
};

var preReconnectProcessing = function( data, selectedObj, isNode, activeLegendView ) {
    // clear Reconnect Data
    let reconnect = {
        selectedConnection : null,
        previousInputMode : null,
        isGraphInRelationCreationMode : false,
        existingPortEndObjects : [],
        existingNodeEndObjects : []
    };

    var graphModel = data.graphModel;
    if( selectedObj ) {
        let connectionTypeName = '';
        if( isNode ) {
            const nodeModel = graphModel.dataModel.nodeModels[ selectedObj.uid ];
            if( nodeModel ) {
                connectionTypeName = nodeModel.graphItem.connectionType;
            }
        } else {
            const portModel = graphModel.dataModel.portModels[ selectedObj.uid ];
            if( portModel ) {
                connectionTypeName = portModel.graphItem.connectionType;
            }
        }

        if( connectionTypeName ) {
            let scopeFilter;
            var selCategory = archGraphLegendManager.getCategoryType( connectionTypeName, scopeFilter, activeLegendView );
            if( !selCategory ||  selCategory && selCategory.localeCompare( '' ) === 0  ) {
                return;
            }

            if( isNode ) {
                reconnect.existingNodeEndObjects.push( selectedObj );
            } else {
                reconnect.existingPortEndObjects.push( selectedObj );
            }

            // set Graph in relation creation mode
            reconnect.selectedConnection = null;
            reconnect.isGraphInRelationCreationMode = true;
            reconnect.previousInputMode = graphModel.config.inputMode;
            graphModel.update( 'config.inputMode', 'edgeCreationMode' );
        }
    }
    return reconnect;
};

export let processEndElements = function( data, graphData, selObjects, activeLegendView ) {
    // clear Reconnect Data
    let reconnect = {
        selectedConnection : null,
        previousInputMode : null,
        isGraphInRelationCreationMode : false,
        existingPortEndObjects : [],
        existingNodeEndObjects : []
    };

    var graphModel = data.graphModel;
    var selectedObj = selObjects[ 0 ];
    if( selectedObj ) {
        var underlyingObjProp = selectedObj.props.awb0UnderlyingObject;
        var propVal = underlyingObjProp.dbValues[ 0 ];
        var underlyingObject = cdm.getObject( propVal );
        if( underlyingObject ) {
            const connectionTypeName = underlyingObject.type;
            let scopeFilter;
            const selCategory = archGraphLegendManager.getCategoryType( connectionTypeName, scopeFilter, activeLegendView );
            if( !selCategory ||  selCategory && selCategory.localeCompare( '' ) === 0  ) {
                return;
            }

            if( graphData && graphData.output && graphData.output.length > 0 ) {
                var nodeData = graphData.output[ 0 ].nodeData;
                if( nodeData && nodeData.length > 0 ) {
                    var nodeObject = nodeData[ 0 ].node;
                    if( nodeObject ) {
                        // add it to data
                        reconnect.existingNodeEndObjects.push( nodeObject );
                    }
                }
                var portData = graphData.output[ 0 ].portData;
                if( portData && portData.length > 0 ) {
                    var portObject = portData[ 0 ].port;
                    if( portObject ) {
                        // add it to data
                        reconnect.existingPortEndObjects.push( portObject );
                    }
                }
            }

            // set Graph in relation creation mode
            reconnect.selectedConnection = selectedObj;
            reconnect.isGraphInRelationCreationMode = true;
            reconnect.previousInputMode = graphModel.config.inputMode;
            graphModel.update( 'config.inputMode', 'edgeCreationMode' );
        }
    }
    return reconnect;
};

var resetReconnectData = function( data ) {
    var graphModel = data.graphModel;
    if( data.reconnect.previousInputMode ) {
        graphModel.update( 'config.inputMode', data.reconnect.previousInputMode );
    }

    return {
        selectedConnection : null,
        previousInputMode : null,
        isGraphInRelationCreationMode : false,
        existingPortEndObjects : [],
        existingNodeEndObjects : []
    };
};

const exports = {
    reconnectConnection,
    reconnectRelation,
    processEndElements
};
export default exports;
