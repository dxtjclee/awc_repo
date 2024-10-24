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
 *
 *
 * @module js/Ase0ArchitecturePortService
 */
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import archDataCache from 'js/Ase0ArchitectureDataCache';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import _ from 'lodash';
import graphLegendSvc from 'js/graphLegendService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import labelService from 'js/Ase0ArchitectureLabelService';
import amGraphService from 'js/Ase0ArchitectureGraphService';
import { svgString as InputPort } from 'image/miscInputPort16.svg';
import { svgString as OutputPort } from 'image/miscOutputPort16.svg';
import { svgString as BiDirectionalPort } from 'image/miscBiDirectionalPort16.svg';

/*
 * method to process portData from manageDiagram2 SOA response and draw the ports in graph
 */
export let processPortData = function( activeLegendView, graphModel, graphData, isRecallCase, graphState ) {
    var returnData = {};
    var ports = [];
    var isKeepPosition = true;
    if( graphData && graphData.output ) {
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;

        _.forEach( graphData.output, function( output ) {
            _.forEach( output.portData, function( portInformation ) {
                const portObject = cdm.getObject( portInformation.port.uid );
                let portModel = graphModel.dataModel.portModels[ portObject.uid ];
                let port = portModel?.graphItem;

                if( !port ) {
                    var hasDanglingConnection = false;
                    var connectionType = null;
                    var portStyle;
                    var scopeFilter;
                    var underlyingObjUid = portObject.props.awb0UnderlyingObject.dbValues[ 0 ];
                    var portCategory = archGraphLegendManager.getCategoryTypeFromObjectUid( underlyingObjUid,
                        scopeFilter, activeLegendView );

                    const portOwnerModel = graphModel.dataModel.nodeModels[ portInformation.portOwner.uid ];

                    //get edge style from graph legend
                    if( portCategory && portCategory.localeCompare( '' ) !== 0 ) {
                        portStyle = _.clone( graphLegendSvc.getStyleFromLegend( 'ports', portCategory, activeLegendView ) );
                    }

                    if( portInformation.portInfo.displayProperties.length > 0 && portObject && portObject.modelType && !portObject.props.awb0Direction ) {
                        var portDirectionPropertyDescriptor = portObject.modelType.propertyDescriptorsMap.awb0Direction;
                        portObject.props.awb0Direction = {
                            dbValues: [],
                            propertyDescriptor: portDirectionPropertyDescriptor
                        };
                        portObject.props.awb0Direction.dbValues[ 0 ] = portInformation.portInfo.displayProperties[ 1 ];
                    }

                    var portSVG = getPortDirectionType( portInformation, portObject );
                    if( portInformation.portInfo.danglingConnectionTypes && portInformation.portInfo.danglingConnectionTypes.length > 0 ) {
                        if( portStyle ) {
                            portStyle.borderColor = '(255,0,0)';
                            portStyle.thickness = 2;
                        }
                        hasDanglingConnection = true;
                        connectionType = portInformation.portInfo.danglingConnectionTypes[ 0 ];
                    }
                    if( portStyle ) {
                        portStyle.borderColor = graphModel.config.defaults.portStyle.borderColor;
                        if( portSVG ) {
                            portStyle.imageSVGString = portSVG;
                        }
                    }

                    var portPosition = null;
                    if( portInformation.portInfo.positionalInfo.length > 0 ) {
                        var positions = portInformation.portInfo.positionalInfo[ 0 ].split( ':' );
                        if( positions.length === 2 ) {
                            portPosition = {};
                            portPosition.x = Number( positions[ 0 ] );
                            portPosition.y = Number( positions[ 1 ] );
                        }
                    }

                    if( !portPosition ) {
                        isKeepPosition = false;
                    }

                    if( portObject && portStyle && portOwnerModel ) {
                        port = graph.addPortAtLocationWithStyle( portOwnerModel.graphItem, portPosition, portStyle );
                    }

                    if( port ) {
                        port.hasDanglingConnection = hasDanglingConnection;
                        port.connectionType = connectionType;
                        port.category = portCategory;
                        port.modelObject = portObject;
                        setPortLabel( graph, portInformation.portInfo, portCategory, port, graphState );
                        portModel = {
                            id: portObject.uid,
                            modelObject: portObject,
                            category: portCategory
                        };
                        // add to graphModel dataModel
                        graphModel.addPortModel( port, portModel );
                        ports.push( port );
                        if( !isRecallCase ) {
                            if( portPosition ) {
                                architectureLayoutService.addPortToBeAddedWithPosition( port );
                            } else {
                                architectureLayoutService.addPortToBeAdded( port );
                            }
                        }
                    }
                } else {
                    if( !port.isVisible() ) {
                        graph.setVisible( [ port ], true );
                        // We will not have this situation for open diagram case
                        architectureLayoutService.addPortToBeAddedWithPosition( port );
                    }
                }
            } );
        } );
        archDataCache.addPortCache( graphData.output );
    }
    returnData.addedPorts = ports;
    returnData.isKeepPosition = isKeepPosition;
    return returnData;
};

/**
 * Get port Direction type
 *
 * @param {Object} portInformation the port information object
 * @param {Object} portObject the port object from graph
 * @return {object} portDirectionType
 */
var getPortDirectionType = function( portInformation, portObject ) {
    var portSVG;
    if( portInformation.portInfo.displayProperties.length > 1 ) {
        if( portObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Input' ) {
            portSVG = InputPort;
        } else if( portObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Output' ) {
            portSVG = OutputPort;
        } else if( portObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Bidirectional' ) {
            portSVG = BiDirectionalPort;
        }
    }
    return portSVG;
};

/**
 * Set label with position for port in graph
 *
 * @param {Object} graph the graph object
 * @param {Object} portInfo the port information object containing label text and position
 * @param {Object} portCategory the internal name of the category of port
 * @param {Object} port the port object from graph
 * @param {Object} graphState Architecture graph state
 */
var setPortLabel = function( graph, portInfo, portCategory, port, graphState ) {
    if( !graph || !portInfo || !port || !graphState ) {
        return;
    }
    var labelPosition = null;
    if( portInfo.labelPositionalInfo && portInfo.labelPositionalInfo.length > 0 ) {
        var positions = portInfo.labelPositionalInfo[ 0 ].split( ':' );
        if( positions.length === 2 ) {
            labelPosition = {
                x: Number( positions[ 0 ] ),
                y: Number( positions[ 1 ] )
            };
        }
    }
    var isLabelVisibile = false;
    var labelCategories = graphState.labelCategories;
    if( portInfo.labelVisible && portInfo.labelVisible.length > 0 && portInfo.labelVisible[ 0 ] === '1' ) {
        isLabelVisibile = true;
    } else if( labelCategories && labelCategories.length > 0 ) {
        _.forEach( labelCategories, function( labelCategory ) {
            if( labelCategory.internalName === portCategory && labelCategory.categoryState ) {
                isLabelVisibile = true;
                return false;
            }
        } );
    }
    if( isLabelVisibile ) {
        var label = _.get( portInfo, 'displayProperties[0]' );
        if( ( !label || label.length === 0 ) && port.modelObject ) {
            var propPath = 'modelObject.props.' +
                labelService.getPropertyName( port.modelObject ) + '.uiValues[0]';
            label = _.get( port, propPath );
        }
        graph.setLabel( port, label );
        var portLabel = port.getLabel();
        portLabel.setVisible( true );
        if( labelPosition ) {
            portLabel.setPosition( labelPosition );
        }
    } else {
        var modelObject = port.modelObject;
        if( cmm.isInstanceOf( 'Awb0Interface', modelObject.modelType ) && !modelObject.props.awb0DisplayedName ) {
            var portDisplayedPropertyDescriptor = modelObject.modelType.propertyDescriptorsMap.awb0DisplayedName;
            modelObject.props.awb0DisplayedName = {
                uiValues: portInfo.displayProperties,
                propertyDescriptor: portDisplayedPropertyDescriptor
            };
            if( labelPosition ) {
                port.labelPosition = labelPosition;
            }
        }
    }
};

// To Enable/Disable ShowAllPorts Command
export let evaluateShowPortsCondition = function( graphModel, graphState ) {
    const graphStateValue = graphState.update ? { ...graphState.value } : graphState;

    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        let selectedNodes = graphControl.getSelected( 'Node' );
        if( selectedNodes ) {
            var doShowAllPortsCmd = false;
            var doShowConnectedPortsCmd = false;
            for( var i = 0; i < selectedNodes.length; i++ ) {
                var node = selectedNodes[ i ];
                if( node ) {
                    var portDegree = node.portDegree;
                    var portModels = node.getPorts();

                    var visiblePorts = [];
                    var hiddenPorts = [];
                    var filteredPorts = [];
                    var visibleConnectedPorts = [];

                    if( portModels ) {
                        for( var j = 0; j < portModels.length; j++ ) {
                            if( portModels[ j ].modelObject ) {
                                if( portModels[ j ].isVisible() ) {
                                    visiblePorts.push( portModels[ j ] );
                                    if( portModels[ j ].getConnections().length > 0 ) {
                                        visibleConnectedPorts.push( portModels[ j ] );
                                    }
                                } else if( portModels[ j ].isFiltered() ) {
                                    filteredPorts.push( portModels[ j ] );
                                } else {
                                    hiddenPorts.push( portModels[ j ] );
                                }
                            }
                        }
                    }

                    var portDegreeCount = portDegree.length - filteredPorts.length;
                    var portCount = visiblePorts.length - hiddenPorts.length;
                    var numOfUnloadedPorts = portDegreeCount - portCount;
                    var numOfVisibleUnconnectedPorts = visiblePorts.length - visibleConnectedPorts.length;

                    graphStateValue.doShowAllPortsCmd = false;
                    graphStateValue.doShowConnectedPortsCmd = false;

                    if( numOfUnloadedPorts > 0 ) {
                        doShowAllPortsCmd = true;
                    }

                    if( numOfVisibleUnconnectedPorts > 0 ) {
                        doShowConnectedPortsCmd = true;
                    }
                }
            }
            graphStateValue.doShowAllPortsCmd = doShowAllPortsCmd;
            graphStateValue.doShowConnectedPortsCmd = doShowConnectedPortsCmd;
        }
    }
    if( graphState.update ) {
        graphState.update( graphStateValue );
    } else {
        graphState = graphStateValue;
    }
};

// show only connected Ports for selected Node
export let showConnectedPorts = function( graphModel, graphState ) {
    const newGraphState = { ...graphState.value };
    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        let graph = graphControl.graph;
        let selectedNodes = graphControl.getSelected( 'Node' );
        for( var i = 0; i < selectedNodes.length; i++ ) {
            var node = selectedNodes[ i ];
            if( node ) {
                var visibleUnConnectedPorts = [];
                var portModels = node.getPorts();
                if( portModels ) {
                    for( var j = 0; j < portModels.length; j++ ) {
                        if( portModels[ j ].modelObject && portModels[ j ].isVisible() ) {
                            if( portModels[ j ].getConnections().length > 0 ) {
                                // do nothing
                            } else {
                                visibleUnConnectedPorts.push( portModels[ j ] );
                            }
                        }
                    }
                }

                if( visibleUnConnectedPorts.length > 0 ) {
                    const removedItems = graph.removePorts( visibleUnConnectedPorts );

                    architectureLayoutService.clearGraphItemLists();

                    if( removedItems ) {
                        if( removedItems.edges ) {
                            architectureLayoutService.addEdgeToBeRemoved( removedItems.edges );
                        }
                        if( removedItems.ports ) {
                            architectureLayoutService.addPortToBeRemoved( removedItems.ports );
                        }
                    }
                    architectureLayoutService.applyGraphLayout( graphModel, true /* Not used if later 2 are false */, false, false );

                    amGraphService.modelChanged( [], visibleUnConnectedPorts, graphModel, newGraphState );
                }
            }
        }
    }
    graphState.update && graphState.update( newGraphState );
    return {
        actionState: {}
    };
};

/**
 * Update the port direction on the graph
 * @param {Object} portsToUpdate ports for updating direction
 * @param {Object} graphModel graph model
 */
export let updatePortDirection = function( portsToUpdate, graphModel ) {
    //Update the port direction in the graph if its changed.
    _.forEach( portsToUpdate, function( port ) {
        if( port && port.isVisible() ) {
            var portSVG;
            var portObject = port.modelObject;
            var propertyObject = portObject.props.awb0Direction.dbValues;
            if( propertyObject ) {
                if( propertyObject[ 0 ] === 'fnd0Input' ) {
                    portSVG = InputPort;
                } else if( propertyObject[ 0 ] === 'fnd0Output' ) {
                    portSVG = OutputPort;
                } else if( propertyObject[ 0 ] === 'fnd0Bidirectional' ) {
                    portSVG = BiDirectionalPort;
                }
            }
            var portStyle = port.style;
            if( portStyle ) {
                if( portSVG && portStyle && portStyle.imageSVGString !== portSVG ) {
                    //It means direction is changed hence update the direction
                    portStyle.imageSVGString = portSVG;
                    graphModel.graphControl.graph.setPortStyle( port, portStyle );
                }
            }
        }
    } );
};

const exports = {
    processPortData,
    evaluateShowPortsCondition,
    showConnectedPorts,
    updatePortDirection
};
export default exports;
