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
 * @module js/Ase0ManageDiagramSoaService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import soaSvc from 'soa/kernel/soaService';
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import archUtilService from 'js/Ase0ArchitectureUtilService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';

/*
 * method to set label filter categories
 */
var getOpenDiagramInput = function( inputData, manageDiagramCompleteEvent, eventData, graphModel, occContext ) {
    var selectedObjs = [];
    if( occContext.pwaSelection && occContext.pwaSelection.length > 0 ) {
        selectedObjs = occContext.pwaSelection;
    }
    inputData.secondaryObjects = selectedObjs;
    if( eventData.userAction === 'OpenFloatDiagram' ) {
        inputData.userAction = 'OpenDiagram';
        manageDiagramCompleteEvent.eventName = 'FGGraphEvent.drawGraph';
    }

    if( graphModel && graphModel.graphControl ) {
        var viewPoint = graphModel.graphControl.getViewPoint();

        if( viewPoint && viewPoint.width && viewPoint.height ) {
            inputData.diagramInfo.viewPortSize = [ viewPoint.width + ':' + viewPoint.height ];
            manageDiagramCompleteEvent.eventData.isOpenDiagram = true;
            manageDiagramCompleteEvent.eventData.isApplyGlobalLayout = eventData.isApplyGlobalLayout;
        }
    }

    // For the product interacted during the session pass the restore flag as true else false
    if ( occContext && occContext.currentState &&
        aceRestoreBWCStateService.isProductInteracted( occContext.currentState.uid ) ) {
        inputData.diagramInfo.isRestoreOptionApplicableForProduct = [ 'true' ];
    } else {
        inputData.diagramInfo.isRestoreOptionApplicableForProduct = [ 'false' ];
    }
};

/**
 * create input for manageDiagram2 SOA
 *
 * @param {Object} eventData the eventData containing additional information required to create manageDiagram2 SOA input
 * @param {Object} manageDiagramQueue the queue to hold which event to fire on completion of manageDiagram2 SOA
 * @param {Object} graphModel graph model
 * @param {Object} occContext occ mgmt context
 * @param {Object} activeLegendView active legend view
 * @returns {Object} the manageDiagram2 SOA input object .
 */
export let getManageDiagram2Input = function( eventData, manageDiagramQueue, graphModel, occContext, activeLegendView ) {
    var input = [];
    // Modify manageDiagramCompleteEventName in switch case if userAction specific event needs to be fired
    // on manageDiagram2 SOA operation completion.
    var timestamp = new Date().getTime();
    var openedObjectUid = _.get( appCtxSvc, 'ctx.state.params.uid', null );
    var manageDiagramCompleteEventDetails = {
        clientIds: [],
        eventsToFire: []
    };
    var eventDatas = [];
    if( eventData ) {
        if( eventData.length > 0 ) {
            eventDatas = eventData;
        } else {
            eventDatas.push( eventData );
        }
    }

    var productContexts = [];
    var rootElements = [];
    if( occContext.elementToPCIMap ) {
        _.forOwn( occContext.elementToPCIMap, function( value, key ) {
            var productContext = cdm.getObject( value );
            var rootElement = cdm.getObject( key );

            if( productContext && rootElement ) {
                productContexts.push( productContext );
                rootElements.push( rootElement );
            }
        } );
    } else if( occContext.topElement ) {
        productContexts.push( occContext.productContextInfo );
        rootElements.push( occContext.topElement );
    }

    _.forEach( eventDatas, function( eventData ) {
        var userAction = eventData.userAction;
        var inputData = {
            clientId: userAction + timestamp,
            userAction: userAction,
            inputCtxt: {
                productContext: occContext.productContextInfo,
                productContextElementInfo: [
                    productContexts,
                    rootElements
                ]
            },
            diagramInfo: {
                openedObjectUid: [ openedObjectUid ]
            }
        };

        manageDiagramCompleteEventDetails.clientIds.push( inputData.clientId );

        var manageDiagramCompleteEvent = {
            eventName: 'AMGraphEvent.drawGraph',
            eventData: {}
        };
        if( eventData.eventName ) {
            manageDiagramCompleteEvent.eventName = eventData.eventName;
        }
        if( eventData.eventData ) {
            manageDiagramCompleteEvent.eventData = eventData.eventData;
        }

        switch ( userAction ) {
            case 'OpenFloatDiagram':
            case 'OpenDiagram':
                getOpenDiagramInput( inputData, manageDiagramCompleteEvent, eventData, graphModel, occContext );
                break;

            case 'AddToDiagram':
                inputData.primaryObjects = eventData.elementsToAdd;
                if( !eventData.skipVisibleObjects ) {
                    inputData.visibleObjects = archUtilService.getVisibleNodes( graphModel );
                    if( eventData.deletedObjects ) {
                        _.pullAllBy( inputData.visibleObjects, eventData.deletedObjects, 'uid' );
                    }
                }
                //set Anchored Objects
                if( eventData.anchorElements ) {
                    inputData.diagramInfo.anchorElements = eventData.anchorElements;
                }
                if( eventData.positionInfo ) {
                    inputData.diagramInfo.positionalInfo = eventData.positionInfo;
                }
                break;
            case 'RemoveFromDiagram':
                inputData.primaryObjects = eventData.elementsToRemove;
                // Need to fire 2 events
                var syncGraphSelectionsEvent = {
                    eventName: 'AMGraphEvent.syncGraphSelections',
                    eventData: {}
                };
                manageDiagramCompleteEventDetails.eventsToFire.push( syncGraphSelectionsEvent );
                manageDiagramCompleteEvent.eventName = 'occMgmt.visibilityStateChanged';
                break;
            case 'UpdateDiagram':
                inputData.primaryObjects = eventData.elementsToUpdate;
                break;

            case 'DeleteElement':
                inputData.primaryObjects = eventData.elementsToDelete;
                inputData.visibleObjects = eventData.visibleObjects;
                manageDiagramCompleteEvent.eventName = 'AMGraphEvent.deleteElement';
                break;

            case 'ClearDiagram':
                manageDiagramCompleteEvent.eventName = 'AMGraphEvent.clearDiagram';
                break;

            case 'GetAllInterfaces':

                if( graphModel && graphModel.graphControl ) {
                    const graphControl = graphModel.graphControl;
                    var tasksObjs = graphControl.getSelected( 'Node' );
                    var primaryObjs = [];
                    _.forEach( tasksObjs, function( taskObj ) {
                        var primaryObject = {
                            uid: taskObj.modelObject.uid,
                            type: taskObj.modelObject.type
                        };
                        primaryObjs.push( primaryObject );
                    } );
                    inputData.primaryObjects = primaryObjs;
                }
                break;
            case 'CreateConnection':
                inputData.primaryObjects = eventData.primaryObjects;
                inputData.secondaryObjects = eventData.secondaryObjects;
                inputData.createInput = eventData.createInput;
                break;
            case 'CreateTraceLink':
            case 'CreateOccTraceLink':
                inputData.primaryObjects = eventData.primaryObjects;
                inputData.createInput = eventData.createInput;
                inputData.visibleObjects = archUtilService.getVisibleNodes( graphModel );
                break;
            case 'CreatePort':
                inputData.primaryObjects = eventData.primaryObjects;
                inputData.createInput = eventData.createInput;
                manageDiagramCompleteEvent.eventName = 'AMGraphEvent.createPortCompleted';
                break;
            case 'Expand.Parent':
                inputData.primaryObjects = eventData.primaryObjects;
                inputData.visibleObjects = archUtilService.getVisibleNodes( graphModel );
                break;
            case 'SaveDiagram':
                inputData.primaryObjects = eventData.primaryObjects;
                inputData.secondaryObjects = eventData.secondaryObjects;
                inputData.diagramInfo = eventData.diagramInfo;
                inputData.diagramInfo.openedObjectUid = [ openedObjectUid ];
                manageDiagramCompleteEvent.eventName = 'AMGraph.AutoSaveDiagramCompleted';
                break;
            case 'Connection.GetEndElements':
                inputData.primaryObjects = eventData.primaryObjects;
                manageDiagramCompleteEvent.eventName = 'AMGraphEvent.GetEndElements';
                break;
            case 'Connection.Reconnect':
                inputData.primaryObjects = eventData.primaryObjects;
                inputData.visibleObjects = eventData.visibleObjects;
                break;
            case 'MoveConnection':
                inputData.primaryObjects = eventData.primaryObjects;
                inputData.secondaryObjects = eventData.secondaryObjects;
                break;
            case 'Expand.Group':
            case 'Expand.OutRelations':
            case 'Expand.InRelations':
            case 'Expand.All':
                inputData.primaryObjects = eventData.primaryObjects;

                var activeRelationTypes = archGraphLegendManager.getUnfilteredTypes( 'relations', activeLegendView );
                inputData.diagramInfo = {
                    activeRelationTypes: activeRelationTypes
                };
                var inactiveRelationTypes = archGraphLegendManager.getFilteredTypes( 'relations', activeLegendView );
                if( inactiveRelationTypes && inactiveRelationTypes.length > 0 ) {
                    inputData.diagramInfo.inactiveRelationTypes = inactiveRelationTypes;
                }
                inputData.visibleObjects = archUtilService.getVisibleNodes( graphModel );
                break;
            case 'AssociateIDsToIOI':
                var selectedItemOfInterest = appCtxSvc.ctx.selected;
                var graphControl = graphModel.graphControl;
                var graph = graphControl.graph;
                var allEdgeModels = graph.getVisibleEdges();
                var visibleObjects = [];
                var secondaryObjects = [];
                if( allEdgeModels && allEdgeModels.length > 0 ) {
                    _.forEach( allEdgeModels, function( edgeModel ) {
                        if( edgeModel.modelObject ) {
                            if( edgeModel.modelObject.modelType ) {
                                if( cmm.isInstanceOf( 'FND_TraceLink', edgeModel.modelObject.modelType ) ) {
                                    var srcNode = edgeModel.getSourceNode();
                                    var tarNode = edgeModel.getTargetNode();
                                    if( srcNode && srcNode.modelObject && srcNode.modelObject.uid === selectedItemOfInterest.uid ) {
                                        if( tarNode && tarNode.modelObject ) {
                                            secondaryObjects.push( tarNode.modelObject );
                                        }
                                    } else if( tarNode && tarNode.modelObject && tarNode.modelObject.uid === selectedItemOfInterest.uid ) {
                                        if( srcNode && srcNode.modelObject ) {
                                            secondaryObjects.push( srcNode.modelObject );
                                        }
                                    }
                                }
                            }
                            visibleObjects.push( edgeModel.modelObject );
                        }
                    } );
                }
                inputData.primaryObjects = [ selectedItemOfInterest ];
                inputData.secondaryObjects = secondaryObjects;
                inputData.visibleObjects = visibleObjects;
                break;
            default:
                break;
        }

        if( !eventData.skipEvent ) {
            manageDiagramCompleteEventDetails.eventsToFire.push( manageDiagramCompleteEvent );
        }
        input.push( inputData );
    } );
    manageDiagramQueue.push( manageDiagramCompleteEventDetails );
    return input;
};

/**
 * Toggle on element from ace
 *
 * @param {Object} eventData the eventData containing additional information required to create manageDiagram2 SOA input
 * @param {Object} manageDiagramQueue the queue to hold which event to fire on completion of manageDiagram2 SOA
 * @param {Object} graphModel graph model
 * @param {Object} occmgmtContext occ mgmt context
 * @param {Object} activeLegendView active legend view
 * @param {Boolean} loadFullPolicy Full Property Policy preference check
 * @param {Object} policy Property Policy
 * @returns {Object} Promise
 */
export let manageDiagramSoa = function( eventData, manageDiagramQueue, graphModel, occmgmtContext, activeLegendView, loadFullPolicy, policy ) {
    var soaInput = this.getManageDiagram2Input( eventData, manageDiagramQueue, graphModel, occmgmtContext, activeLegendView );
    let policyOverride;
    let policyId;
    if( loadFullPolicy  === 'true' ) {
        policyId = propertyPolicySvc.register( policy, 'manageDiagramSoaPolicy' );
    }else{
        policyOverride = policy;
    }
    return soaSvc.postUnchecked(
        'Internal-ActiveWorkspaceSysEng-2017-06-DiagramManagement',
        'manageDiagram2', {
            input: soaInput
        }, policyOverride ).then( ( response ) => {
        if( policyId ) {
            propertyPolicySvc.unregister( policyId );
        }
        return response;
    } );
};

/*
 * method to get manageDiagram2 SOA response and pass it to AMManageDiagramComplete event for further processing.
 */
export let getManageDiagram2Response = function( response ) {
    var graphData = _.clone( response );
    var eventData = {
        graphData: graphData
    };
    eventBus.publish( 'AMManageDiagramComplete', eventData );
    return graphData;
};

const exports = {
    getManageDiagram2Input,
    manageDiagramSoa,
    getManageDiagram2Response
};
export default exports;
