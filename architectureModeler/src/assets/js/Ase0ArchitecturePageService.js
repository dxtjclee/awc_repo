// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitecturePageService
 */
import appCtxSvc from 'js/appCtxService';
import diagramSaveService from 'js/Ase0ArchitectureDiagramSaveService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import cmm from 'soa/kernel/clientMetaModel';
import nodeCommandService from 'js/Ase0ArchitectureNodeCommandService';

let _architectureEditHandlerStateChangeListeners = [];
let _productRestoreLister = null;

export const updatePageState = function( key, newValue, pageState = {} )  {
    const archPageState = { ...pageState };
    archPageState[key] = newValue;
    pageState.update && pageState.update( archPageState );
};

/**
 * Unregister context on Architecture view load.
 * @param {Object} pageState Architecture page state
 * @returns {Object} updated page state
 */
export let handleNativeArchitectureLoad = function( pageState ) {
    let newPageState = { ...pageState };
    updateHiddenCommandContextForArchitecture( true );

    if ( _architectureEditHandlerStateChangeListeners.length <= 0 ) {
        let editHandlerStateChangeSubDef = eventBus.subscribe( 'editHandlerStateChange', function( eventData ) {
            if ( eventData.state === 'saved' ) {
                eventBus.publish( 'AM.owningNodeRefresh', eventData );
            }
        } );
        _architectureEditHandlerStateChangeListeners.push( editHandlerStateChangeSubDef );
    }
    return newPageState;
};

export let aceElementAdded = function( eventData, pageState ) {
    if( !pageState || !pageState.hasSystemModelerLicense ) {
        return;
    }
    let actionStateValue = {};
    let uidsToSelect = eventData.objectsToSelect.map( function( object ) {
        return object.uid;
    } );
    let localEventData = {
        objectToSelect: uidsToSelect,
        deletedObjects: []
    };

    // the drag & drop also deletes the original elements; which need to be removed
    // from the diagram
    let _deletedUids = _.get( eventData, 'addElementResponse.ServiceData.deleted' );
    _.forEach( _deletedUids, function( deletedUid ) {
        localEventData.deletedObjects.push( { uid: deletedUid } );
    } );

    // the intent is captured to ensure that deleted objects are for the
    // correct use case of drag & drop
    localEventData.intent = _.get( eventData, 'addElementInput.addObjectIntent' );

    actionStateValue.AMElementAdded = localEventData;
    return actionStateValue;
};

export let aceElementRemoved = function( eventData, graphModel, data, activeLegendView ) {
    let actionStateValue = {};
    let itemsRemovedFromACEEventData = [];
    let removedObjects = eventData.removedObjects;
    let objFromGraphModel;
    let affectedNodes = [];
    removedObjects.forEach( object => {
        let parentKey = object.props.awb0Parent.dbValues[0];

        if( graphModel.dataModel.nodeModels[parentKey]  ) {
            if( graphModel.dataModel.nodeModels[parentKey].graphItem.numChildren > 0 ) {
                graphModel.dataModel.nodeModels[parentKey].graphItem.numChildren -= 1;
                affectedNodes.push( graphModel.dataModel.nodeModels[parentKey].graphItem );
            }
        }


        if( graphModel.dataModel.nodeModels[object.uid] ) {
            objFromGraphModel = graphModel.dataModel.nodeModels[object.uid];
            itemsRemovedFromACEEventData.push( objFromGraphModel.modelObject );
            itemsRemovedFromACEEventData = _.union( itemsRemovedFromACEEventData, objFromGraphModel.graphItem.getEdges().map( ( edge )=>{ return edge.modelObject; } ) );
            itemsRemovedFromACEEventData = _.union( itemsRemovedFromACEEventData, objFromGraphModel.graphItem.getPorts().map( ( port )=>{ return port.modelObject; } ) );
        }
        if( graphModel.dataModel.portModels[object.uid] ) {
            objFromGraphModel = graphModel.dataModel.portModels[object.uid];
            itemsRemovedFromACEEventData.push( objFromGraphModel.modelObject );
            itemsRemovedFromACEEventData = _.union( itemsRemovedFromACEEventData, objFromGraphModel.graphItem.getEdges().map( ( edge )=>{ return edge.modelObject; } ) );
        }
        if( graphModel.dataModel.edgeModels[ object.uid ] ) {
            objFromGraphModel = graphModel.dataModel.edgeModels[ object.uid ];
            itemsRemovedFromACEEventData.push( objFromGraphModel.modelObject );
            itemsRemovedFromACEEventData = _.union( itemsRemovedFromACEEventData, objFromGraphModel.graphItem );
        }
    } );

    if( affectedNodes.length > 0 ) {
        nodeCommandService.updateGraphInfoOnNodes( affectedNodes, graphModel, data, activeLegendView );
    }

    actionStateValue.AMItemsRemovedFromACE = itemsRemovedFromACEEventData;
    return actionStateValue;
};

/**
 *  Update Context for Supported/Un-supported commands in Architecture.
 * @param {Object} value -false to support,true if Not supported.
 */
let updateHiddenCommandContextForArchitecture = function( value ) {
    let hiddenCommandCtx = appCtxSvc.getCtx( 'hiddenCommands' );
    if ( !hiddenCommandCtx ) {
        hiddenCommandCtx = {};
    }
    if ( value ) {
        hiddenCommandCtx.isSaveWorkingContextNotSupported = value;
    } else {
        delete hiddenCommandCtx.isSaveWorkingContextNotSupported;
    }
    appCtxSvc.updatePartialCtx( 'hiddenCommands', hiddenCommandCtx );
};

/**
 * Unregister context on Architecture view load.
 */
export let handleNativeArchitectureUnloaded = function() {
    // unsubscribe _architectureEditHandlerStateChangeListeners
    _.forEach( _architectureEditHandlerStateChangeListeners, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
    _architectureEditHandlerStateChangeListeners = [];
    updateHiddenCommandContextForArchitecture( false );
    //unregister Architecture DiagramEditHandler if Active
    if ( diagramSaveService.diagramEditHandlerIsActive() ) {
        diagramSaveService.removeEditAndLeaveHandler();
    }
};

/**
 * Updating occmgmt context includeConnections or includeInterfaces
 *
 * @param {Sting} viewKey command context viewkey
 * @param {object} occContext occmgmt Context
 */
export let updateCtxWithShowConnectionValue = function( viewKey, occContext ) {
    if( viewKey && occContext && occContext.persistentRequestPref ) {
        let currentModeInAce = _.get( occContext, 'persistentRequestPref.' + viewKey );
        let newValue = !currentModeInAce;

        let value = {
            persistentRequestPref: {},
            pwaReset: true
        };

        _.set( value, 'persistentRequestPref.' + viewKey, newValue );
        occmgmtUtils.updateValueOnCtxOrState( '', value, occContext, true );
    }
};

/**
 * Function to process restore action from ACE tree
 */
export let restoreProductInArchitecture = function() {
    if ( !_productRestoreLister ) {
        _productRestoreLister = eventBus.subscribe( 'productContextChangedEvent', function() {
            eventBus.unsubscribe( _productRestoreLister );
            _productRestoreLister = null;
            let eventData = {
                userAction: 'OpenDiagram'
            };
            eventBus.publish( 'AMGraphEvent.clearDiagram', eventData );
        } );
    }
};

let getValidACESelection = function( selection, occContext ) {
    let validACESelections = [];
    let aceShowConnectionMode = false;
    let aceShowPortMode = false;
    if( occContext && occContext.persistentRequestPref ) {
        aceShowConnectionMode = occContext.persistentRequestPref.includeConnections;
        aceShowPortMode = occContext.persistentRequestPref.includeInterfaces;
    }
    for( const sel of selection ) {
        if( cmm.isInstanceOf( 'FND_TraceLink', sel.modelType ) ) {
            continue;
        } else if( !aceShowConnectionMode && cmm.isInstanceOf( 'Awb0Connection', sel.modelType ) ||
            !aceShowPortMode && cmm.isInstanceOf( 'Awb0Interface', sel.modelType ) ) {
            continue;
        } else if( cmm.isInstanceOf( 'Awb0Element', sel.modelType ) ) {
            validACESelections.push( sel );
        }
    }
    return validACESelections;
};

let updateSelectionData = _.debounce( function( selectionData, secondarySelectionData ) {
    selectionData.update( secondarySelectionData );
}, 500 );

/**
 * Process selection change in Graph or Grid view
 * @param {Object} primarySelectionData Selection from graph view
 * @param {Object} secondarySelectionData Selection from contributing table
 * @param {Object} selectionData Selection Data from parent component
 * @param {Object} occContext occ context
 * @return {Array} Architecture tab selections
 */
export let processSelectionChange = function( primarySelectionData, secondarySelectionData, selectionData, occContext ) {
    if( !primarySelectionData || _.isEmpty( primarySelectionData ) ) {
        return;
    }
    const newSecondarySelection = { ...secondarySelectionData.value };
    if( secondarySelectionData.clearSelection ) {
        newSecondarySelection.clearSelection = false;
        secondarySelectionData.update && secondarySelectionData.update( newSecondarySelection );
        // If non diagram selection happens from ACE then do not proceed to update ACE selection
        // else proceed to update primary diagram selection
        if( _.isEmpty( primarySelectionData.selected ) && !_.isEmpty( primarySelectionData.amSelection ) ) {
            return {};
        }
    }

    let selectionToUpdate = newSecondarySelection.selected && newSecondarySelection.selected.length > 0 ? newSecondarySelection : primarySelectionData;

    // if selection is secondary i.e. bottom/right panel in Architecture tab then update selectionData
    // else consider selection from primary i.e. Architecture tab graph then do sync in ACE pwa tree and then update selectionData
    if( !_.isEmpty( newSecondarySelection ) && !_.isEmpty( newSecondarySelection.selected ) ) {
        selectionData.update( selectionToUpdate );
        selectionToUpdate = {};
    } else {
        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', {
            elementsToSelect:getValidACESelection( selectionToUpdate.selected, occContext ),
            overwriteSelections : true
        }, occContext );
    }

    return selectionToUpdate;
};

export let updateSecondarySelections = function( secondarySelectionData, selectionData, occContext ) {
    if( _.isEmpty( occContext.selectionsToModify ) ) {
        updateSelectionData( selectionData, secondarySelectionData );
    }
};

const exports = {
    handleNativeArchitectureLoad,
    updateCtxWithShowConnectionValue,
    restoreProductInArchitecture,
    handleNativeArchitectureUnloaded,
    updatePageState,
    aceElementAdded,
    aceElementRemoved,
    processSelectionChange,
    updateSecondarySelections
};
export default exports;
