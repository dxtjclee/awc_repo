// Copyright (c) 2023 Siemens

/**
 * This service helps delete the graph data to be displayed and also saves it.
 *
 * @module js/ssp0SRPertEditHandler
 */

import _ from 'lodash';
import SaveInput from 'js/ssp0SaveInputService';
import appCtxService from 'js/appCtxService';
import messagingService from 'js/messagingService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import graphModelService from 'js/graphModelService';
import mfeViewModelObjectLifeCycleService from 'js/services/mfeViewModelObjectLifeCycleService';

const ignorableErrorIds = [ 38015, 214019, 26003 ];


/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} source - the source whether the edge can be created from
 * @return {boolean} flag whether the edge can be reconnected
 */
export function canCreateEdgeFrom( graphModel, source ) {
    if( !source || !graphModel ) {
        return false;
    }
    if( !_.isEmpty( source.getItemType() ) && ( source.getItemType() === 'Port' || source.getItemType() === 'Node' ) ) {
        return true;
    }
    return false;
}

/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} target - the target whether the edge can be created to
 * @return {boolean} flag whether the edge can be reconnected
 */
export function canCreateEdgeTo( graphModel, target ) {
    if( !target || !graphModel ) {
        return false;
    }
    if( !_.isEmpty( target.getItemType() ) && ( target.getItemType() === 'Port' || target.getItemType() === 'Node' ) ) {
        return true;
    }
    return false;
}

/**
 * Function to be called to check if edge already exists between the node
 *
 * @param {Object} edges - the edge model object
 * @param {Object} firstNodeUid - the uid of the first(starting) node
 * @param {Object} secondNodeUid - the uid of the second(ending) node
 * @return {boolean} flag whether the edge can be reconnected
 */
export function doesEdgeAlreadyExistBetweenNodes( edges, firstNodeUid, secondNodeUid ) {
    let edgeExists = false;
    for( const edge in edges ) {
        if( edges[ edge ].edgeObject.puid === firstNodeUid && edges[ edge ].edgeObject.suid === secondNodeUid ||
            edges[ edge ].edgeObject.suid === firstNodeUid && edges[ edge ].edgeObject.puid === secondNodeUid ) {
            edgeExists = true;
        }
    }
    return edgeExists;
}

/**
 * Move graph items and update layout
 * @param {Array} items - moved graph items
 * @param {*} graphModel - graphModel
 */
export function moveGraphItems( items, graphModel ) {
    if( items.length > 0 ) {
        const movedNodes = items.filter( ( item ) => item.getItemType() === 'Node' );
        const layout = graphModel.graphControl.layout;
        moveElements( movedNodes, layout );
    }
}

/**
 * Move elements with incremental / sorted layout update
 * @param {*} movedNodes - movedNodes
 * @param {*} layout - layout
 */
function moveElements( movedNodes, layout ) {
    if( layout !== undefined && layout.isActive() && !_.isEmpty( movedNodes ) ) {
        layout.applyUpdate( () => {
            movedNodes.forEach( ( node ) => {
                layout.moveNode( node );
            } );
        } );
    }
}

/**
 * Reset the PERT nodes to default layout.
 * @param {Object} graphModel - graphModel
 */
export function resetLayout( graphModel ) {
    const graphControl = graphModel.graphControl;
    graphControl.layout.applyLayout();
    graphControl.layout.activate();
    graphControl.fitGraph();
}


/**
 * Function to create edge.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} previewEdge - the preview edge.
 */
export function createEdge( graphModel, previewEdge ) {
    let saveInputWriter = new SaveInput();
    edgeOperations( previewEdge.getSourceNode().model.modelObject,
        previewEdge.getTargetNode().model.modelObject, 'Add', saveInputWriter );
    saveChanges( saveInputWriter ).then( function( response ) {
        let errorCodes = getErrorCodes( response.ServiceData );
        if( shouldIssuePartialError( errorCodes ) ) {
            // Removed Revise Error Scenario
            graphModel.graphControl.graph.removeEdges( [ previewEdge ] );
            let err = messagingService.getSOAErrorMessage( response.ServiceData );
            messagingService.showError( err );
            return err;
        }
        if( !response.saveResults ) {
            graphModel.graphControl.graph.removeEdges( [ previewEdge ] );
        }
        const loadedMOs = response.saveResults.map( obj => response.ServiceData.modelObjects[ obj.saveResultObject.uid ] );
        updateGraphModelWithLoadedModelObjects( graphModel, loadedMOs );
        updateGraphModelWithCreatedEdge( graphModel, previewEdge );
        resetLayout( graphModel );
    } );
}

/**
 * graphModel needs to updated when any modelObject for an object present in datamodel is changed
 * @param {*} graphModel graphModel object
 * @param {*} loadedMOs loadedViewModelObjects
 */
function updateGraphModelWithLoadedModelObjects( graphModel, loadedMOs ) {
    loadedMOs.forEach( modelObj => {
        const vmo = mfeViewModelObjectLifeCycleService.createViewModelObjectFromModelObject( modelObj );
        let vindicators = graphModel.dataModel.nodeModels[ modelObj.uid ].nodeObject.indicators;
        vmo.indicators = vindicators;
        const nodeModel = new graphModelService.NodeModel( vmo.uid, vmo );
        const graphItem = graphModel.dataModel.nodeModels[ vmo.uid ].graphItem;
        graphModel.addNodeModel( graphItem, nodeModel );
    } );
}

/**
 * Update graphModel with newly created edge
 * @param {*} graphModel graphModel
 * @param {*} previewEdge previewEdge
 */
function updateGraphModelWithCreatedEdge( graphModel, previewEdge ) {
    const sourceNodeModel = previewEdge.getSourceNode();
    const targetNodeModel = previewEdge.getTargetNode();
    const edgeObject = {
        id: `edge_id${Math.random().toString()}`,
        puid: sourceNodeModel.model.id,
        suid: targetNodeModel.model.id,
        props: {}
    };
    const edgeModel = new graphModelService.EdgeModel( edgeObject.id, edgeObject, edgeObject.category, sourceNodeModel.model, targetNodeModel.model, edgeObject.edgeLabelText );
    graphModel.addEdgeModel( previewEdge, edgeModel );
}

/**
 * Create Edge
 * @param {*} predModelObj - Predecessor Model Object
 * @param {*} succModelObject - Sucessor Model Object
 * @param {*} operationType - Operaion Type
 * @param {*} saveInputWriter - saveInputWriter
 * @return {*} saveInputWriter - saveInputWriter
 */
function edgeOperations( predModelObj, succModelObject, operationType, saveInputWriter ) {
    let relatedObjects = [];

    let edgeObject = {};
    if( operationType === 'Add' ) {
        edgeObject.objectId = succModelObject.uid;
        edgeObject.predecessorId = predModelObj.uid;
        saveInputWriter.addPredecessor( edgeObject, 'true' );
    } else {
        edgeObject.fromId = predModelObj.uid;
        edgeObject.toId = succModelObject.uid;
        saveInputWriter.deleteFlow( edgeObject, 'true' );
    }
    relatedObjects.push( succModelObject );
    relatedObjects.push( predModelObj );
    saveInputWriter.addRelatedObjects( relatedObjects );
    return saveInputWriter;
}


/**
 * saveChanges
 *
 * @param {Object} saveInputWriter the save input
 * @param {String} resourceBundle the messages file name
 *
 * @returns {Promise} save promise
 */
export function saveChanges( saveInputWriter ) {
    let saveInput = convertToSaveInput( saveInputWriter );
    const policy = {
        types: [
            {
                name: 'SSP0BvrWorkCard',
                properties: [
                    {
                        name: 'Mfg0predecessors'
                    },
                    {
                        name: 'bl_rev_fnd0objectId'
                    },
                    {
                        name: 'bl_child_lines'
                    }
                ]
            } ]
    };
    policySvc.register( policy );

    return soaService.postUnchecked( 'Internal-MfgBvrCore-2022-12-DataManagement', 'saveData4',
        saveInput ).then( function( result ) {
        //Process response.relatedObjectsMap
        // Removed Processing of Tree if any changes in relatedObjects response
        return result;
    }, function( error ) {
        let err = messagingService.getSOAErrorMessage( error );
        messagingService.showError( err );
        return err;
    } );
}

/**
 * @param { Object } saveInput save input
 * @param {Boolean} asyncMode boolean value true or false for calling savedata3 in background mode
 * @returns { Object } saveInput
 */
function convertToSaveInput( saveInput, asyncMode ) {
    let saveInputData = {
        saveInput: {
            sections: _.values( saveInput.sections ),
            relatedObjects: saveInput.relatedObjects
        }
    };
    if( asyncMode ) {
        saveInputData.saveInput.parameters = saveInput.parameters;
    }
    return saveInputData;
}

/**
 * getErrorCodes
 *
 * @param {Object} serviceData response
 * @returns {Array} error codes
 */
function getErrorCodes( serviceData ) {
    let errorCodes = [];
    if( serviceData && serviceData.partialErrors ) {
        let partialErrors = serviceData.partialErrors;
        for( let i in partialErrors ) {
            let errors = partialErrors[ i ].errorValues;
            for( let j in errors ) {
                errorCodes.push( errors[ j ].code );
            }
        }
    }
    return errorCodes;
}

/**
 * shouldIssuePartialError
 *
 * @param {Array} errorCodes errors from server
 * @returns {boolean} if should issue partial errors
 */
function shouldIssuePartialError( errorCodes ) {
    for( let index in errorCodes ) {
        if( !_.includes( ignorableErrorIds, errorCodes[ index ] ) ) {
            return true;
        }
    }
    return false;
}

/**
 * Delete the Edge  between PERT nodes
 * @param {Object} graphModel - graphModel
 */
export function deleteEdge( graphModel ) {
    let selectedEdges = graphModel.graphControl.getSelected( 'Edge' );
    selectedEdges = selectedEdges[0];

    let saveInputWriter = new SaveInput();
    edgeOperations( selectedEdges.getSourceNode().model.modelObject,
        selectedEdges.getTargetNode().model.modelObject, 'Remove', saveInputWriter );
    saveChanges( saveInputWriter ).then( function( response ) {
        let errorCodes = getErrorCodes( response.ServiceData );
        if( shouldIssuePartialError( errorCodes ) ) {
            // Removed Revise Error Scenario
            graphModel.graphControl.graph.removeEdges( [ selectedEdges ] );
            let err = messagingService.getSOAErrorMessage( response.ServiceData );
            messagingService.showError( err );
            return err;
        }
        if( response.saveResults ) {
            graphModel.graphControl.graph.removeEdges( [ selectedEdges ] );
            resetLayout( graphModel );
            setPertNodesSelection( graphModel );
        }
    } );
}

/**
 * This function sets selected nodes in ctx
 * @param {Object} graphModel graphModel
 */
export function setPertNodesSelection( graphModel ) {
    let selectedPertNodes = graphModel.graphControl.getSelected( 'Node' );
    let selectedPertEdges = graphModel.graphControl.getSelected( 'Edge' );
    let nodeObjectIds = [];
    if( selectedPertNodes && selectedPertNodes.length > 0 ) {
        selectedPertNodes.forEach( node => {
            nodeObjectIds.push( node.model.nodeObject );
        } );
    }
    let commandContextForSRPERT =  {
        selection: nodeObjectIds,
        edgeSelections : selectedPertEdges,
        graphModel : graphModel
    };

    // Register exportContext
    if( !appCtxService.getCtx( 'commandContextForSRPERT' ) ) {
        appCtxService.registerCtx( 'commandContextForSRPERT', commandContextForSRPERT  );
    } else {
        appCtxService.updatePartialCtx( 'commandContextForSRPERT', commandContextForSRPERT );
    }
}


let exports = {};
export default exports = {
    createEdge,
    updateGraphModelWithLoadedModelObjects,
    updateGraphModelWithCreatedEdge,
    edgeOperations,
    canCreateEdgeFrom,
    canCreateEdgeTo,
    moveGraphItems,
    doesEdgeAlreadyExistBetweenNodes,
    resetLayout,
    deleteEdge,
    setPertNodesSelection
};
