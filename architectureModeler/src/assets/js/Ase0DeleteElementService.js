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
 * Ase0DeleteElementService Deletes nodes/ports/edges from diagram
 *
 * @module js/Ase0DeleteElementService
 */
import ClipboardService from 'js/clipboardService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import toolTipHandler from 'js/Ase0ArchitectureGraphTooltipHandler';
import architectureLayoutService from 'js/Ase0ArchitectureLayoutService';
import utilSvc from 'js/Ase0ArchitectureUtilService';
import dataCacheSvc from 'js/Ase0ArchitectureDataCache';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import templateService from 'js/Ase0ArchitectureGraphTemplateService';
import occmgmtUtils from 'js/occmgmtUtils';

/**
 * Deletes nodes/ports/edges
 *
 * @param {Object} data required to get primary object excluded list.
 * @param {Array} selObjects selected objects
 * @param {object} occContext occmgmt Context
 * @return {Object} delete data
 */
export let deleteElement = function( data, selObjects, occContext ) {
    var elementsToBeProcessedForRemoval = [];
    var newListOfElementsToBeProcessedForRemoval = [];
    var elementsToBeDeleted = [];

    if( selObjects && selObjects.length > 0 ) {
        elementsToBeProcessedForRemoval.push.apply( elementsToBeProcessedForRemoval, selObjects );
        if( elementsToBeProcessedForRemoval && elementsToBeProcessedForRemoval.length > 0 ) {
            if( hasUserMadeSelectionsAcrossLevelsInStructure( elementsToBeProcessedForRemoval ) ) {
                newListOfElementsToBeProcessedForRemoval = filterOutElementsIfParentIsAlreadyPresentInSelectionsList(
                    elementsToBeProcessedForRemoval );
            }
        }
    }

    if( newListOfElementsToBeProcessedForRemoval && newListOfElementsToBeProcessedForRemoval.length > 0 ) {
        elementsToBeDeleted.push.apply( elementsToBeDeleted, newListOfElementsToBeProcessedForRemoval );
    } else {
        elementsToBeDeleted.push.apply( elementsToBeDeleted, selObjects );
    }

    let deleteData = cacheDataBeforeDelete( data, elementsToBeDeleted );

    // Get all visible elements on Graph
    var visibleObjects = getAllNodesOnGraph( data.graphModel );

    var m_addRootNode = false;

    // check if diagram becomes empty after remove
    if( visibleObjects && visibleObjects.length > 0 && elementsToBeDeleted.length > 0 ) {
        _.forEach( elementsToBeDeleted, function( element ) {
            if( _.indexOf( visibleObjects, element ) !== -1 ) {
                m_addRootNode = isDiagramBecomeEmptyAfterRemove( elementsToBeDeleted, data.graphModel );
                return false;
            }
        } );
    }

    var m_rootNode;
    if( m_addRootNode ) {
        let openedObject = occContext.openedElement;
        m_rootNode = getRootElement( openedObject );
    }

    // Call SOA TO Delete Element
    callAddAndDeleteElementSOA( visibleObjects, elementsToBeDeleted, m_rootNode );
    return deleteData;
};

/**
 * Get display Properties for delete traceLink
 *
 * @param {Object} graphModel graph model
 * @return {Object} root element
 */
export let populateRemoveTraceLinkInformation = function(  graphModel ) {
    var selectedTracelinks = [];
    let selectedEdges = null;
    if( graphModel && graphModel.graphControl ) {
        const graphControl = graphModel.graphControl;
        selectedEdges = graphControl.getSelected( 'Edge' );
    }
    if( selectedEdges && selectedEdges.length > 0 ) {
        _.forEach( selectedEdges, function( edge ) {
            if( edge && edge.modelObject ) {
                let element = edge.modelObject;
                if( element.modelType && cmm.isInstanceOf( 'FND_TraceLink', element.modelType ) ) {
                    selectedTracelinks.push( edge );
                }
            }
        } );
    }

    var label = '';
    if( selectedTracelinks.length === 1 ) {
        var selectedTracelink = selectedTracelinks[ 0 ];
        label = toolTipHandler.getTooltip( selectedTracelink, graphModel );
    }

    return {
        selectedTraceLinks: selectedTracelinks,
        label: label
    };
};

/**
 * Get root object of the product using opened element
 *
 * @param {Object} openedObject open object
 * @return {Object} root element
 */
var getRootElement = function( openedObject ) {
    var parent = openedObject;
    var root;
    while( parent ) {
        root = parent;
        parent = getParentOccurrence( parent );
    }
    return root;
};

/**
 * It checks whether diagram going to become empty after removing elements.Return true if diagram become empty else
 * return false
 *
 * @param {Array} elementsToBeDeleted objects to be deleted
 * @param {Object} graphModel graph model
 * @return {boolean} true/false
 */
var isDiagramBecomeEmptyAfterRemove = function( elementsToBeDeleted, graphModel ) {
    var isDiagEmpty = false;
    var listAnchorUids = graphModel.rootNodeList;

    if( elementsToBeDeleted.length > 0 ) {
        _.forEach( elementsToBeDeleted, function( element ) {
            var index = _.indexOf( listAnchorUids, element.uid );
            if( index !== -1 ) {
                _.pullAt( listAnchorUids, index );
            }
        } );
    }

    var anchorUids = listAnchorUids;
    _.forEach( anchorUids, function( uid ) {
        const nodeModel = graphModel.dataModel.nodeModels[ uid ];
        var iModelObject = null;
        if( nodeModel ) {
            iModelObject = nodeModel.modelObject;
        }
        var objectsListInHeirachy = [];
        if( iModelObject && iModelObject !== null ) {
            objectsListInHeirachy = getObjectHierarchy( iModelObject );
        }

        _.forEach( elementsToBeDeleted, function( element ) {
            var index = _.indexOf( objectsListInHeirachy, element );
            if( index !== -1 ) {
                _.pullAt( listAnchorUids, index );
                return false;
            }
        } );
    } );

    if( listAnchorUids && listAnchorUids.length === 0 ) {
        isDiagEmpty = true;
    }

    return isDiagEmpty;
};

/**
 * It return the list of visible objects present in graph.
 *
 * @param {Object} graphModel graph model
 * @return {Array} list of visible Objects on graph
 */
var getAllNodesOnGraph = function( graphModel ) {
    if( !graphModel ) { return []; }

    // Get all nodes on graph and send them to server, so that server can use them to build paths
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var visibleObjects = [];

    var allNodeModels = graph.getVisibleNodes();
    _.forEach( allNodeModels, function( nodeModel ) {
        visibleObjects.push( nodeModel.modelObject );
    } );

    var allPortModels = graph.getVisiblePorts();
    _.forEach( allPortModels, function( portModel ) {
        visibleObjects.push( portModel.modelObject );
    } );

    var allEdgeModels = graph.getVisibleEdges();
    _.forEach( allEdgeModels, function( edgeModel ) {
        visibleObjects.push( edgeModel.modelObject );
    } );

    return visibleObjects;
};

/**
 * Maintains a cache of objects to be deleted.
 * @param {Object} data data object.
 * @param {Array} elementsToBeDeleted objects to be deleted
 * @returns {Object} delete information
 */
var cacheDataBeforeDelete = function( data, elementsToBeDeleted ) {
    var graphModel = data.graphModel;
    var removeElementUids = [];
    var deletedPortUids = [];
    var deletedTracelinkUids = [];

    _.forEach( elementsToBeDeleted, function( element ) {
        removeElementUids.push( element.uid );

        const portModel = graphModel.dataModel.portModels[ element.uid ];
        if( portModel && portModel.graphItem.getItemType() === 'Port' ) {
            deletedPortUids.push( element.uid );
        }
        if( cmm.isInstanceOf( 'FND_TraceLink', element.modelType ) ) {
            deletedTracelinkUids.push( element.uid );
        }
    } );

    return {
        removeElementUids : removeElementUids,
        deletedPortUids : deletedPortUids,
        deletedTracelinkUids : deletedTracelinkUids
    };
};

var processForEdgesRemoval = function( edges, nodesToRemove ) {
    var affectedNodeList = [];
    if( edges && edges.length > 0 ) {
        _.forEach( edges, function( edge ) {
            if( edge.modelObject && edge.category && edge.category.localeCompare( 'Structure' ) !== 0 ) {
                var edgeType = edge.edgeType;
                var srcNode = edge.getSourceNode();
                var tarNode = edge.getTargetNode();
                var srcPort = edge.getSourcePort();
                var tarPort = edge.getTargetPort();
                var srcCategoryToRemove = '';
                var tarCategoryToRemove = '';
                var srcNodeType = null;
                var tarNodeType = null;
                var isSourcePortDirectionOutput = false;
                var isTargetPortDirectionInput = false;
                var isValidSrcPort = false;
                var isValidTarPort = false;

                if( srcNode ) {
                    if( _.indexOf( nodesToRemove, srcNode ) === -1 ) {
                        affectedNodeList.push( srcNode );
                    }
                    srcNodeType = srcNode.nodeType;
                }
                if( tarNode ) {
                    if( _.indexOf( nodesToRemove, tarNode ) === -1 ) {
                        affectedNodeList.push( tarNode );
                    }
                    tarNodeType = tarNode.nodeType;
                }

                if( edgeType && srcNodeType ) {
                    srcCategoryToRemove = edgeType + ';' + srcNodeType;
                }
                if( edgeType && tarNodeType ) {
                    tarCategoryToRemove = edgeType + ';' + tarNodeType;
                }

                if( srcPort && srcPort.modelObject ) {
                    isValidSrcPort = true;
                }

                if( tarPort && tarPort.modelObject ) {
                    isValidTarPort = true;
                }

                if( isValidSrcPort ) {
                    isSourcePortDirectionOutput = srcPort.modelObject.props.awb0Direction && srcPort.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Output';
                }
                if( isValidTarPort ) {
                    isTargetPortDirectionInput = tarPort.modelObject.props.awb0Direction && tarPort.modelObject.props.awb0Direction.dbValues[ 0 ] === 'fnd0Input';
                }

                if( !isValidSrcPort && !isValidTarPort ) {
                    if( srcNode ) {
                        srcNode.outgoingRelations.splice( srcNode.outgoingRelations.indexOf( srcCategoryToRemove ), 1 );
                    }
                    if( tarNode ) {
                        tarNode.incomingRelations.splice( tarNode.incomingRelations.indexOf( tarCategoryToRemove ), 1 );
                    }
                } else {
                    if( !isSourcePortDirectionOutput ) {
                        if( srcNode ) {
                            srcNode.incomingRelations.splice( srcNode.incomingRelations.indexOf( srcCategoryToRemove ), 1 );
                        }
                        if( tarNode ) {
                            tarNode.incomingRelations.splice( tarNode.incomingRelations.indexOf( tarCategoryToRemove ), 1 );
                        }
                    } else if( !isTargetPortDirectionInput ) {
                        if( tarNode ) {
                            tarNode.outgoingRelations.splice( tarNode.outgoingRelations.indexOf( tarCategoryToRemove ), 1 );
                        }
                        if( srcNode ) {
                            srcNode.outgoingRelations.splice( srcNode.outgoingRelations.indexOf( srcCategoryToRemove ), 1 );
                        }
                    } else {
                        if( srcNode ) {
                            srcNode.outgoingRelations.splice( srcNode.outgoingRelations.indexOf( srcCategoryToRemove ), 1 );
                        }
                        if( tarNode ) {
                            tarNode.incomingRelations.splice( tarNode.incomingRelations.indexOf( tarCategoryToRemove ), 1 );
                        }
                    }
                }
            }
        } );
    }
    return affectedNodeList;
};

/**
 * Once objects are deleted from server , it removes objects from graph.
 * @param {Object} graphData Graph Data
 * @param {Object} data data object.
 * @param {Object} selObjects selected Objects
 * @param {object} occContext occmgmt Context
 */
export let performDeleteOperationCompleted = function( graphData, data, selObjects, occContext ) {
    var graphModel = data.graphModel;
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var doUpdateAceList = false;

    var removeElementUids = data.removeElementUids;
    var deletedTracelinkUids = data.deletedTracelinkUids;

    if( graphData.output.length === 0 || !selObjects || selObjects.length === 0 ) {
        return;
    }

    var isConnectionDeleted =  removeElementUids.length !== deletedTracelinkUids.length && removeElementUids.length - graphData.output[ 0 ].edgeData.length  > 0;

    var removedObjects = [];

    _.forEach( removeElementUids, function( removedElementUID ) {
        var removedObject = selObjects.filter( function( selected ) {
            return selected.uid === removedElementUID;
        } );
        removedObjects.push.apply( removedObjects, removedObject );
    } );

    //Get underlying object and store them in clipboard
    if( removedObjects.length > 0 ) {
        var contextObjs = [];
        _.forEach( removedObjects, function( obj ) {
            if( obj.props.awb0UnderlyingObject && cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] ) !== null ) {
                contextObjs.push( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
            }
        } );
        if( contextObjs.length > 0 ) {
            ClipboardService.instance.setContents( contextObjs );
        }
    }

    // clear data cache
    data.removeElementUids = [];
    data.deletedTracelinkUids = [];

    // if any error
    if( graphData.ServiceData.partialErrors && graphData.output.length === 0 ) {
        return;
    }

    var tracelinkUidsToDelete = [];

    if( graphData ) {
        _.forEach( graphData.output, function( output ) {
            _.forEach( output.nodeData, function( nodeInformation ) {
                var nodeUid = nodeInformation.node.uid;
                var nodeInfo = nodeInformation.nodeInfo;
                if( nodeInfo ) {
                    const nodeModel = graphModel.dataModel.nodeModels[ nodeUid ];
                    const node = nodeModel?.graphItem;
                    if( node ) {
                        var connectionTypes = nodeInfo.danglingConnectionTypes;
                        var updatedNodeInfoMap = {
                            danglingConnectionTypes: connectionTypes
                        };
                        if( connectionTypes && connectionTypes.length > 0 ) {
                            node.hasDanglingConnection = true;
                            node.connectionType = connectionTypes[ 0 ];
                        } else {
                            node.hasDanglingConnection = false;
                            node.connectionType = null;
                        }
                        // update node Data cache
                        dataCacheSvc.updateNodeDataInfoMap( nodeUid, updatedNodeInfoMap );
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
                        var updatedPortInfoMap = {
                            danglingConnectionTypes: connectionTypes
                        };
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
                            if( portStyle ) { // set to default
                                portStyle.borderColor = '(0,0,0)';
                                portStyle.thickness = 1;
                                graphModel.graphControl.graph.setPortStyle( port, portStyle );
                            }
                            port.hasDanglingConnection = false;
                            port.connectionType = null;
                        }
                        // update port Data cache
                        dataCacheSvc.updatePortDataInfoMap( portUid, updatedPortInfoMap );
                    }
                }
            } );
        } );

        if( graphData.ServiceData && graphData.ServiceData.deleted ) {
            _.forEach( graphData.ServiceData.deleted, function( deletedUid ) {
                var index;
                if( deletedTracelinkUids && deletedTracelinkUids.length > 0 ) {
                    index = _.indexOf( deletedTracelinkUids, deletedUid );
                    if( index !== -1 ) {
                        _.pullAt( removeElementUids, index );
                        tracelinkUidsToDelete.push( deletedUid );
                    }
                }
            } );
        }
    }

    var elementsToRemoveFromAce = [];
    var itemsToRemove = [];
    var portsToRemove = [];
    var nodesToCheckForNormal = [];
    var nodesToRemove = [];
    var edgesToRemove = [];
    var affectedNodeList = [];

    architectureLayoutService.clearGraphItemLists();

    var aceShowConnectionMode = false;
    let aceShowPortMode = false;
    if( occContext.persistentRequestPref ) {
        aceShowConnectionMode = occContext.persistentRequestPref.includeConnections;
        aceShowPortMode = occContext.persistentRequestPref.includeInterfaces;
    }

    // Remove From Graph
    if( removeElementUids && removeElementUids.length > 0 ) {
        _.forEach( removeElementUids, function( uid ) {
            // For node
            const nodeModel = graphModel.dataModel.nodeModels[ uid ];
            if( nodeModel ) {
                itemsToRemove.push( nodeModel.graphItem );
                nodesToRemove.push( nodeModel.graphItem );
                elementsToRemoveFromAce.push( nodeModel.modelObject );
                var parent = graphControl.groupGraph.getParent( nodeModel.graphItem );
                if( parent ) {
                    architectureLayoutService.addNodeToFitAncestors( parent );
                    nodesToCheckForNormal.push( parent );
                }
            }

            // For Connection
            const edgeModel = graphModel.dataModel.edgeModels[ uid ];
            if( edgeModel ) {
                itemsToRemove.push( edgeModel.graphItem );
                edgesToRemove.push( edgeModel.graphItem );
                if( aceShowConnectionMode && isConnectionDeleted ) {
                    elementsToRemoveFromAce.push( edgeModel.modelObject );
                }
            } else {
                // check if it is connection.
                var object = cdm.getObject( uid );
                var isConnection = object && object.modelType ? cmm.isInstanceOf( 'Awb0Connection', object.modelType ) : false;
                if( isConnection && isConnectionDeleted ) {
                    elementsToRemoveFromAce.push( object );
                    doUpdateAceList = true;
                }
            }

            // For Port
            const portModel = graphModel.dataModel.portModels[ uid ];
            if( portModel ) {
                itemsToRemove.push( portModel.graphItem );
                portsToRemove.push( portModel.graphItem );
                architectureLayoutService.addPortToBeRemoved( [ portModel.graphItem ] );
                if( aceShowPortMode ) {
                    elementsToRemoveFromAce.push( portModel.modelObject );
                }
            }
        } );
    }

    if( tracelinkUidsToDelete && tracelinkUidsToDelete.length > 0 ) {
        var keys = Object.keys( graphModel.dataModel.edgeModels );
        _.forEach( tracelinkUidsToDelete, function( uid ) {
            _.forEach( keys, function( key ) {
                if( key.indexOf( uid ) !== -1 ) {
                    var edgeModel = graphModel.dataModel.edgeModels[ key ];
                    if( edgeModel ) {
                        itemsToRemove.push( edgeModel.graphItem );
                        edgesToRemove.push( edgeModel.graphItem );
                    }
                }
            } );
        } );
    }

    var edgesToBeRemoved = [];

    if( nodesToRemove.length > 0 ) {
        // update node degree as well
        _.forEach( nodesToRemove, function( node ) {
            var parent = graphControl.groupGraph.getParent( node );
            if( parent && _.indexOf( itemsToRemove, parent ) === -1 ) {
                // Decrease child degree for parent node
                --parent.numChildren;
                affectedNodeList.push( parent );
            }
            var edges = node.getEdges();
            edgesToBeRemoved = edgesToBeRemoved.concat( edges );
        } );
    }

    if( edgesToRemove.length > 0 ) {
        // update node degree as well
        _.forEach( edgesToRemove, function( edge ) {
            if( edge.modelObject && edge.category && edge.category.localeCompare( 'Structure' ) !== 0 ) {
                var isConn = cmm.isInstanceOf( 'Awb0Connection', edge.modelObject.modelType );
                if( isConn ) {
                    var parentNode = graphControl.groupGraph.getParent( edge );
                    var parentUid = edge.modelObject.props.awb0Parent.dbValues[ 0 ];
                    if( parentNode && _.indexOf( itemsToRemove, parentNode ) === -1 && parentUid !== parentNode.modelObject.uid ) {
                        // Decrease child degree of parent node and add it in affected node list to update
                        --parentNode.numChildren;
                        affectedNodeList.push( parentNode );
                    }
                }
                edgesToBeRemoved.push( edge );
            }
        } );
    }

    if( portsToRemove.length > 0 ) {
        // update node degree as well
        _.forEach( portsToRemove, function( port ) {
            var portObj = port.modelObject;
            if( portObj ) {
                var nodeUid = portObj.props.awb0Parent.dbValues[ 0 ];
                if( nodeUid ) {
                    // find in node map
                    const nodeModel = graphModel.dataModel.nodeModels[ nodeUid ];
                    if( nodeModel ) {
                        var portDegree = nodeModel.graphItem.portDegree;
                        if( portDegree && portDegree.length > 0 ) {
                            portDegree.shift();
                            nodeModel.graphItem.portDegree = portDegree;
                        }
                    }
                }

                var portEdges = port.getEdges();
                edgesToBeRemoved = edgesToBeRemoved.concat( portEdges );
            }
        } );
    }

    // Calculate affected nodes on removal of edges from diagram
    affectedNodeList = affectedNodeList.concat( processForEdgesRemoval( edgesToBeRemoved, nodesToRemove, graphControl ) );

    if( itemsToRemove.length > 0 ) {
        var unConnectedItems = utilSvc.getUnconnectedItems( graphModel, nodesToRemove, edgesToRemove );
        if( unConnectedItems && unConnectedItems.length > 0 ) {
            _.forEach( unConnectedItems, function( unConnectedItem ) {
                itemsToRemove.push( unConnectedItem );
            } );
        }

        var removedItems = graph.removeItems( itemsToRemove );

        doUpdateAceList =  removedItems.nodes.length > 0 || isConnectionDeleted;
        // Remove nodesToRemove from nodesToCheckForNormal
        nodesToCheckForNormal = _.difference( nodesToCheckForNormal, removedItems.nodes );
        // Remove nodesToRemove from NodesToFitAncestors
        _.forEach( removedItems.nodes, function( node ) {
            architectureLayoutService.removeNodeToFitAncestors( node );
            architectureLayoutService.addNodeToBeRemoved( node );
        } );

        architectureLayoutService.addEdgeToBeRemoved( removedItems.edges );
        architectureLayoutService.addPortToBeRemoved( removedItems.ports );

        _.forEach( nodesToCheckForNormal, function( node ) {
            // Check if it has no children and add nodes to convert to normal node.
            var children = groupGraph.getChildNodes( node );
            if( !children || children.length === 0 ) {
                var nodeObject = node.modelObject;
                if( graphModel && nodeObject ) {
                    //update group node to normal node
                    var props = templateService.getBindPropertyNames( nodeObject );
                    var nodeStyle = templateService.getNodeTemplate( graphModel.nodeTemplates,
                        props, false );
                    var bindData = {
                        HEADER_HEIGHT: 0
                    };
                    graph.setNodeStyle( node, nodeStyle, bindData );
                    groupGraph.setExpanded( node, false );
                    groupGraph.setAsLeaf( node );
                    graph.setBounds( node, node.getResizeMinimumSize() );
                    architectureLayoutService.addNodeToBecomeNormal( node );
                }
            }
        } );
    }

    if( affectedNodeList && affectedNodeList.length > 0 ) {
        affectedNodeList = _.uniq( affectedNodeList );
        //fire graph node degree change event
        eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
            affectedNodeList: affectedNodeList
        } );
    }

    architectureLayoutService.applyGraphLayout( graphModel, true /* Not used if later 2 are false */, false, false );

    // for updating Ace List
    if( doUpdateAceList ) {
        updateAceList( elementsToRemoveFromAce, occContext );
    }
};

/**
 * Update Ace List
 *
 * @param {Object} elementToDeselect elementToDeselect
 * @param {object} occContext occmgmt Context
 */
var updateAceList = function( elementToDeselect, occContext ) {
    if( elementToDeselect.length > 0 ) {
        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', {
            elementsToDeselect: elementToDeselect
        }, occContext );
    }

    // Reset Ace List
    eventBus.publish( 'acePwa.reset' );
};

/**
 * Check if user has made any selections across levels in structures.
 *
 * @param {Array} selectedElements selectedElements
 * @return {boolean} hasUserMadeSelectionsAcrossLevelsInStructure
 */
var hasUserMadeSelectionsAcrossLevelsInStructure = function( selectedElements ) {
    var parentsOfSelectedElements = [];
    _.forEach( selectedElements, function( selectedElement ) {
        var parentOcc = getParentOccurrence( selectedElement );
        if( parentOcc ) {
            parentsOfSelectedElements.push( parentOcc );
        }
    } );

    return parentsOfSelectedElements.length > 1;
};

/**
 * It filters out elements if parent ss already present in selections List.
 *
 * @param {Array} elementsToBeProcessedForRemoval elementsToBeProcessedForRemoval
 */
var filterOutElementsIfParentIsAlreadyPresentInSelectionsList = function( elementsToBeProcessedForRemoval ) {
    var newListOfElementsToBeProcessedForRemoval = [];
    _.forEach( elementsToBeProcessedForRemoval, function( elementToProcessForRemoval ) {
        newListOfElementsToBeProcessedForRemoval.push( elementToProcessForRemoval );
        var hierarchy = getObjectHierarchy( elementToProcessForRemoval );
        _.forEach( hierarchy, function( modelObj ) {
            if( newListOfElementsToBeProcessedForRemoval.indexOf( modelObj ) !== -1 ) {
                var index = newListOfElementsToBeProcessedForRemoval.indexOf( elementToProcessForRemoval );
                newListOfElementsToBeProcessedForRemoval.splice( index, 1 );
                return false;
            }
        } );
    } );
};

/**
 * Get parent Occurrence.
 *
 * @param {Object} occurrence occurrence
 * @returns {Object} parent object
 */
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

/**
 * Get Object hierarchy.
 *
 * @param {Object} modelObject modelObject
 * @returns {Object} parent object
 */
var getObjectHierarchy = function( modelObject ) {
    var occStack = [];
    var parent = modelObject;
    while( parent ) {
        // Push current parent on stack
        occStack.push( parent );
        parent = getParentOccurrence( parent );
    }
    return parent;
};

/**
 * Fires AMManageDiagramEvent event to call manageDiagram2 SOA for deleting  objects.
 *
 * @param {Array} visibleObjects objects which are visible in graph
 * @param {Array} elementsToBeDeleted elements To Be Deleted
 * @param {Object} m_rootNode root node
 */
var callAddAndDeleteElementSOA = function( visibleObjects, elementsToBeDeleted, m_rootNode ) {
    if( elementsToBeDeleted && elementsToBeDeleted.length > 0 ) {
        var eventData = [];

        var deleteData = {
            userAction: 'DeleteElement',
            visibleObjects: visibleObjects,
            elementsToDelete: elementsToBeDeleted
        };

        eventData.push( deleteData );

        if( m_rootNode ) {
            // Fire add to diagram if diagram becomes empty after remove
            var elementsToAdd = [];
            var anchorElements = [];
            anchorElements.push( m_rootNode.uid );
            elementsToAdd.push( m_rootNode );
            var addData = {
                userAction: 'AddToDiagram',
                elementsToAdd: elementsToAdd,
                anchorElements: anchorElements,
                skipVisibleObjects: true
            };

            eventData.push( addData );
        }

        eventBus.publish( 'AMManageDiagramEvent', eventData );
    }
};

export let populateMsgRelatedConditions = function( data, selObjects ) {
    var selectedElements = selObjects;
    let isNodeHasVisibleRelation = isNodeHasVisibleRelations( selectedElements, data.graphModel );
    let isNodeExpanded = isNodeExpandedFn( selectedElements, data.graphModel );
    let selectedAnchorNodes = selectedAnchors( selectedElements, data.graphModel );
    let isHeterogeneousSelection = isHeterogeneousSelections( data.graphModel );
    let isOnlySinglePortSelected = isOnlySinglePortSelections( selectedElements );
    let isOnlyConnectionSelected = isOnlyConnectionSelections( selectedElements );
    let isConnectionsValidToDisconnect = isConnectionsValidToDisconnectFn( selectedElements );

    return {
        selectedElements : selectedElements,
        isNodeHasVisibleRelation : isNodeHasVisibleRelation,
        isNodeExpanded : isNodeExpanded,
        selectedAnchorNodes : selectedAnchorNodes,
        isHeterogeneousSelection : isHeterogeneousSelection,
        isOnlySinglePortSelected : isOnlySinglePortSelected,
        isOnlyConnectionSelected : isOnlyConnectionSelected,
        isConnectionsValidToDisconnect : isConnectionsValidToDisconnect
    };
};

const isHeterogeneousSelections = function( graphModel ) {
    var objectTypes = [];
    let graphControl = graphModel.graphControl;
    let selectedNodes = graphControl.getSelected( 'Node' );
    if( selectedNodes && selectedNodes.length > 0 ) {
        _.forEach( selectedNodes, function( selectedNode ) {
            if( !_.includes( objectTypes, selectedNode.getItemType() )  ) {
                objectTypes.push( selectedNode.getItemType() );
            }
        } );
    }
    let selectedEdges = graphModel.graphControl.getSelected( 'Edge' );
    if( selectedEdges && selectedEdges.length > 0 ) {
        _.forEach( selectedEdges, function( edgeItem ) {
            if( !_.includes( objectTypes, edgeItem.getItemType() )  ) {
                objectTypes.push( edgeItem.getItemType() );
            }
        } );
    }
    let selectedPorts = graphModel.graphControl.getSelected( 'Port' );
    if( selectedPorts && selectedPorts.length > 0 ) {
        _.forEach( selectedPorts, function( selectedPort ) {
            if( !_.includes( objectTypes, selectedPort.getItemType() )  ) {
                objectTypes.push( selectedPort.getItemType() );
            }
        } );
    }
    return objectTypes.length > 1;
};

const isNodeHasVisibleRelations = function( selectedNodes, graphModel ) {
    var anyNodeHasVisibleEdges = false;
    _.forEach( selectedNodes, function( selectedNode ) {
        var nodeUid = selectedNode.uid;
        const nodeModel = graphModel.dataModel.nodeModels[ nodeUid ];
        if( nodeModel ) {
            var edges = nodeModel.graphItem.getEdges();
            var visibleEdges = _.find( edges, function( edge ) {
                return edge.isVisible();
            } );
            if( visibleEdges ) {
                anyNodeHasVisibleEdges = true;
                return false;
            }
        }
    } );
    return anyNodeHasVisibleEdges;
};
const isNodeExpandedFn = function( selectedNodes, graphModel ) {
    var groupGraph = graphModel.graphControl.groupGraph;
    var expanded = false;
    _.forEach( selectedNodes, function( selectedNode ) {
        var nodeModel = graphModel.dataModel.nodeModels[ selectedNode.uid ];
        if( nodeModel ) {
            if( groupGraph.isGroup( nodeModel.graphItem ) && groupGraph.isExpanded( nodeModel.graphItem ) ) {
                expanded = true;
                return false;
            }
        }
    } );
    return expanded;
};
const selectedAnchors = function( selectedNodes, graphModel ) {
    var selectedAnchors = [];
    _.forEach( selectedNodes, function( selectedNode ) {
        const nodeModel = graphModel.dataModel.nodeModels[ selectedNode.uid ];
        if( nodeModel && nodeModel.graphItem.isRoot() ) {
            selectedAnchors.push( selectedNode );
        }
    } );
    return selectedAnchors;
};
const isOnlySinglePortSelections = function( selectedElements ) {
    var isOnlySinglePortSelected = false;
    if( selectedElements && selectedElements.length === 1
        && cmm.isInstanceOf( 'Awb0Interface', selectedElements[ 0 ].modelType ) ) {
        isOnlySinglePortSelected = true;
    }
    return isOnlySinglePortSelected;
};
const isOnlyConnectionSelections = function( selectedElements ) {
    var isOnlyConnectionSelected = false;
    var nonConnectionObjectSelected = false;
    _.forEach( selectedElements, function( element ) {
        var isConnection = cmm.isInstanceOf( 'Awb0Connection', element.modelType );
        if( !isConnection ) {
            nonConnectionObjectSelected = true;
            return false;
        }
    } );

    if( !nonConnectionObjectSelected ) {
        isOnlyConnectionSelected = true;
    }

    return isOnlyConnectionSelected;
};

const isConnectionsValidToDisconnectFn = function( selectedElements ) {
    var isValidConnectionToDisconnect = false;
    _.forEach( selectedElements, function( element ) {
        var isConnection = cmm.isInstanceOf( 'Awb0Connection', element.modelType );
        if( isConnection ) {
            var connectedState = element.props.ase0ConnectedState.dbValues[ 0 ];
            if( connectedState === 'ase0Connected' ) {
                isValidConnectionToDisconnect = true;
            }
        }
    } );
    return isValidConnectionToDisconnect;
};

const exports = {
    deleteElement,
    populateRemoveTraceLinkInformation,
    performDeleteOperationCompleted,
    populateMsgRelatedConditions
};
export default exports;
