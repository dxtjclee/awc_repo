// Copyright (c) 2022 Siemens

/**
 * This service helps delete the graph data to be displayed and also saves it.
 *
 * @module js/ssp0PertEditService
 */

import _ from 'lodash';
import actTreeSvc from 'js/ssp0ActivitiesTreeService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import awMessageService from 'js/messagingService';
import soaService from 'soa/kernel/soaService';


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
 * Shows error message for Edge Creation if edge already exists
 * @param {Object} msg - Error message to be shown
 */
export function showEdgeCreationMsg( msg ) {
    awMessageService.showError( msg );
}

/**
 * Check if it has provided predecessors in pred_list
 *
 * @param {Object} curr_pred_list - Predessors List
 * @param {Object} predId - pred ID
 * @return {boolean} flag whether it has Predessors or not
 */
function hasPredecessor( curr_pred_list, predId ) {
    return curr_pred_list.includes( predId );
}

/**
 * Function to check if adding a predecessor creates a cycle
 *
 * @param {Object} nodeId - current node id
 * @param {Object} visited - array of visited nodes
 * @return {boolean} flag whether cyclic or not
 */
function doesCreateCycle( nodeId, visited ) {
    const curr_pred_list = actTreeSvc.getPredListFromPuid( nodeId );

    for ( const predId of curr_pred_list ) {
        if ( visited.has( predId ) ) {
            return true; // Cycle detected
        }

        visited.add( predId );
        if ( doesCreateCycle( predId, visited ) ) {
            return true;
        }
        visited.delete( predId );
    }

    return false;
}

/**
 * Function to update predecessor values while maintaining acyclicity
 *
 * @param {Object} puidOfSuccessor - persistent uid of the Successor
 * @param {Object} puidOfPredecessor - persistent uid of the Predecessor
 * @return {boolean} flag whether cyclic or not
 */
function isCreatingCyclicStructure( puidOfSuccessor, puidOfPredecessor ) {
    const curr_pred_list = actTreeSvc.getPredListFromPuid( puidOfSuccessor );

    // Check if adding each new predecessor creates a cycle or if it already exists
    if ( hasPredecessor( curr_pred_list, puidOfPredecessor ) ) {
        return true;
    }

    // Check if adding the new predecessor creates a cycle
    const visited = new Set();
    visited.add( puidOfSuccessor );
    if ( doesCreateCycle( puidOfPredecessor, visited ) ) {
        return true;
    }
    return false;
}

/**
 * Function to create edge.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} previewEdge - the preview edge.
 */
export async function createEdge( graphModel, previewEdge ) {
    let edgeObject = edgeOperations( previewEdge.getSourceNode().model.modelObject,
        previewEdge.getTargetNode().model.modelObject, 'Add' );

    let puidOfSuccessor = actTreeSvc.getPuidFromRuntimeId( edgeObject.successorSRId );
    let puidOfPredecessor = actTreeSvc.getPuidFromRuntimeId( edgeObject.predecessorSRId );
    let exisitingPredListOfSuccessor = actTreeSvc.getPredListFromPuid( puidOfSuccessor );

    if( exisitingPredListOfSuccessor.includes( puidOfPredecessor ) ) {
        graphModel.graphControl.graph.removeEdges( [ previewEdge ] );
        eventBus.publish( 'Ssp0ActivityPERT.showEdgeError' );
        return;
    }

    if( isCreatingCyclicStructure( puidOfSuccessor,  puidOfPredecessor ) ) {
        graphModel.graphControl.graph.removeEdges( [ previewEdge ] );
        eventBus.publish( 'Ssp0ActivityPERT.showCyclicError' );
        return;
    }


    let updatedPredListOfSuccessor = [ puidOfPredecessor, ...exisitingPredListOfSuccessor ];
    actTreeSvc.updatePuidToPredListMap( puidOfSuccessor, updatedPredListOfSuccessor );
    let input = {
        info: [],
        options: []
    };

    let inputInfoCreator = {
        object: cdm.getObject( puidOfSuccessor )
    };
    inputInfoCreator.vecNameVal = [];

    inputInfoCreator.vecNameVal.push( {
        name: 'pred_list',
        values: updatedPredListOfSuccessor
    } );
    input.info.push( inputInfoCreator );

    await soaService.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', input ).then( function( response ) {
        eventBus.publish( 'reloadActivitiesTree' );
        resetLayout( graphModel );
    } );
}

/**
 * Function to get Edge Object
 *
 * @param {Object} predModelObj - MO of the Successor
 * @param {Object} succModelObject - MO of the Predecessor
 * @param {Object} operationType - operationType Add or Delete
 * @return {boolean} flag whether cyclic or not
 */
function edgeOperations( predModelObj, succModelObject, operationType ) {
    // Need to keep in mind that we have to fetch original pred list and add new node into that list and then call SOA setProps
    let edgeObject = {};
    if( operationType === 'Add' ) {
        edgeObject.successorSRId = succModelObject.uid;
        edgeObject.predecessorSRId = predModelObj.uid;
    }
    return edgeObject;
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
    if( !appCtxService.getCtx( 'commandContextForActPERT' ) ) {
        appCtxService.registerCtx( 'commandContextForActPERT', commandContextForSRPERT  );
    } else {
        appCtxService.updatePartialCtx( 'commandContextForActPERT', commandContextForSRPERT );
    }
}

function removeElement( arr, element ) {
    return arr.filter( item => item !== element );
}

/**
 * Delete the Edge  between PERT nodes
 * @param {Object} graphModel - graphModel
 */
export async function deleteEdge( graphModel ) {
    let selectedEdges = graphModel.graphControl.getSelected( 'Edge' );
    selectedEdges = selectedEdges[0];

    let edgeObject = edgeOperations( selectedEdges.getSourceNode().model.modelObject,
        selectedEdges.getTargetNode().model.modelObject, 'Add' );

    let puidOfSuccessor = actTreeSvc.getPuidFromRuntimeId( edgeObject.successorSRId );
    let puidOfPredecessor = actTreeSvc.getPuidFromRuntimeId( edgeObject.predecessorSRId );
    let exisitingPredListOfSuccessor = actTreeSvc.getPredListFromPuid( puidOfSuccessor );

    let updatedPredListOfSuccessor = removeElement( exisitingPredListOfSuccessor, puidOfPredecessor );
    actTreeSvc.updatePuidToPredListMap( puidOfSuccessor, updatedPredListOfSuccessor );
    let input = {
        info: [],
        options: []
    };

    let inputInfoCreator = {
        object: cdm.getObject( puidOfSuccessor )
    };
    inputInfoCreator.vecNameVal = [];

    inputInfoCreator.vecNameVal.push( {
        name: 'pred_list',
        values: updatedPredListOfSuccessor
    } );
    input.info.push( inputInfoCreator );

    await soaService.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', input ).then( function( response ) {
        eventBus.publish( 'reloadActivitiesTree' );
        graphModel.graphControl.graph.removeEdges( [ selectedEdges ] );
        resetLayout( graphModel );
        setPertNodesSelection( graphModel );
    } );
}

let exports = {};
export default exports = {
    canCreateEdgeFrom,
    canCreateEdgeTo,
    moveGraphItems,
    resetLayout,
    createEdge,
    doesEdgeAlreadyExistBetweenNodes,
    showEdgeCreationMsg,
    deleteEdge,
    setPertNodesSelection
};
