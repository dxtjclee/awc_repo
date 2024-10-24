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
 * Ase0ArchitectureSetUnsetAnchorService command handler
 *
 * @module js/Ase0ArchitectureSetUnsetAnchorService
 */
import utilSvc from 'js/Ase0ArchitectureUtilService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

/*
 * Set anchor nodes
 */
export let setAnchorNodes = function( nodeModels, graphModel ) {
    _.forEach( nodeModels, function( selectedNode ) {
        var nodeUid = selectedNode.modelObject.uid;
        selectedNode.isRoot( true );
        //To keep root node list updated with current changes, add node to root node list
        var rootNodeList = graphModel.rootNodeList;
        if( rootNodeList.indexOf( nodeUid ) < 0 ) {
            rootNodeList.push( nodeUid );
        }
        selectedNode.getSVG().bindNewValues( 'isRoot' );
    } );
};

/*
 * Set anchor nodes
 */
export let setAnchor = function( graphModel, graphState ) {
    const newGraphState = { ...graphState.value };
    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        let selectedNodes = graphControl.getSelected( 'Node' );
        //Need to maintain return anchor state to avoid execution of setAnchor and unsetAnchor in one flow
        var returnAnchorState = newGraphState.anchorState;
        if( !newGraphState.anchorState ) {
            exports.setAnchorNodes( selectedNodes, graphModel );
            newGraphState.anchorState = true;
        }
    }
    graphState.update && graphState.update( newGraphState );
    return {
        previousAnchorState : returnAnchorState,
        actionState : {}
    };
};

/*
 * Unset anchor nodes
 */
export let unsetAnchorNodes = function( nodeModels, graphModel ) {
    var elementsToRemove = [];
    _.forEach( nodeModels, function( selectedNode ) {
        var nodeUid = selectedNode.modelObject.uid;
        selectedNode.isRoot( false );
        //To keep root node list updated with current changes, remove node from root node list
        var rootNodeList = graphModel.rootNodeList;
        var index = rootNodeList.indexOf( nodeUid );
        if( index > -1 ) {
            rootNodeList.splice( index, 1 );
        }

        selectedNode.getSVG().bindNewValues( 'isRoot' );
        var unconnectedItems = [];
        if( rootNodeList.length === 0 ) {
            unconnectedItems = graphModel.graphControl.graph.getVisibleNodes();
        } else {
            unconnectedItems = utilSvc.getUnconnectedItems( graphModel );
        }
        var elementsToRemove = getModelObjects( unconnectedItems );
        if( elementsToRemove.length > 0 ) {
            var eventData = {
                elementsToRemove: elementsToRemove
            };
            eventBus.publish( 'AM.toggleOffEvent', eventData );
        }
    } );
    return elementsToRemove;
};

/*
 * Unset anchor nodes
 */
export let unsetAnchor = function( graphModel, graphState ) {
    const newGraphState = { ...graphState.value };
    if( newGraphState.anchorState && graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        let selectedNodes = graphControl.getSelected( 'Node' );
        exports.unsetAnchorNodes( selectedNodes, graphModel );
        newGraphState.anchorState = false;
    }
    graphState.update && graphState.update( newGraphState );
    return {
        actionState : {}
    };
};

var getModelObjects = function( nodeItems ) {
    var removeElements = [];
    _.forEach( nodeItems, function( item ) {
        removeElements.push( item.modelObject );
    } );
    return removeElements;
};

const exports = {
    setAnchorNodes,
    setAnchor,
    unsetAnchorNodes,
    unsetAnchor
};
export default exports;
