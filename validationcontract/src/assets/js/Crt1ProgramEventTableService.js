// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1ProgramEventTableService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import selectionService from 'js/selection.service';
import _cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';

var exports = {};
export let getInputForRemoveProgramEvent = function( programEventObjectsToRemove ) {
    var relationInputs = [];
    if( programEventObjectsToRemove && programEventObjectsToRemove.length ) {
        for( var index = 0; index < programEventObjectsToRemove.length; index++ ) {
            var primaryObj = cdm.getObject( programEventObjectsToRemove[ index ].props.awp0Primary.dbValue );
            var secondaryObj = cdm.getObject( programEventObjectsToRemove[ index ].props.awp0Secondary.dbValue );

            var primary = {
                uid: primaryObj.uid,
                type: primaryObj.type
            };
            var secondary = {
                uid: secondaryObj.uid,
                type: secondaryObj.type
            };

            relationInputs.push( {
                primaryObject: primary,
                secondaryObject: secondary,
                relationType: programEventObjectsToRemove[ index ].props.awp0RelationTypeName.dbValue
            } );
        }
    }
    //Input for remove report is ready. Now we can clear ctx variable
    return relationInputs;
};

export let getCreateRelationInputForPlanLevelEvents = function( selObj, sourceObjects, selectedVR ) {
    var input = [];
    var secondaryObject_type = null;
    var secondaryObject_uid = null;
    var primaryObject_type = null;
    var primaryObject_uid = null;

    if( selObj ) {
        secondaryObject_type = selObj.type;
        secondaryObject_uid = selObj.uid;
    } else if( selectedVR ) {
        secondaryObject_type = selectedVR.type;
        secondaryObject_uid = selectedVR.uid;
    }
    for( var i = 0; i < sourceObjects.length; i++ ) {
        primaryObject_type = sourceObjects[ i ].type;
        primaryObject_uid = sourceObjects[ i ].uid;

        var jsoObj = {
            clientId: '',
            primaryObject: {
                type: primaryObject_type,
                uid: primaryObject_uid
            },
            relationType: 'Psi0EventPrgDel',
            secondaryObject: {
                type: secondaryObject_type,
                uid: secondaryObject_uid
            }
        };
        input.push( jsoObj );
    }
    return input;
};

export let updateSelectionAfterProgramRemove = function() {
    updateSelection();
};

function updateSelection() {
    var newSelection = null;
    var correctedSelection = [];
    var currentScopeTableSelection = appCtxSvc.ctx.currentScopeTableSelection;
    if( !currentScopeTableSelection ) {
        // AR inputs/overview view, set the selection to the AR
        newSelection = cdm.getObject( appCtxSvc.ctx.locationContext.modelObject.uid );
    } else {
        newSelection = currentScopeTableSelection;
    }
    if( newSelection !== null ) {
        correctedSelection.push( newSelection );
    }
    if( appCtxSvc.ctx.xrtSummaryContextObject ) {
        var parentSelection = appCtxSvc.ctx.xrtSummaryContextObject;
        selectionService.updateSelection( parentSelection );
    }
    if( correctedSelection.length > 0 ) {
        selectionService.updateSelection( correctedSelection, parentSelection );
    }
}

export let handleSelectionChange = function( tableProvider, subPanelContext ) {
    var objectToOpen;
    if( tableProvider && tableProvider.selectedObjects && tableProvider.selectedObjects.length > 0 ) {
        var selectionUid = tableProvider.selectedObjects[ 0 ].props.awp0Primary.dbValue;
        var selection = _cdm.getObject( selectionUid );
    } else if( subPanelContext && subPanelContext.selected && subPanelContext.selected.uid ) {
        selectionUid = subPanelContext.selected.uid;
        selection = _cdm.getObject( selectionUid );
    } else if( subPanelContext && subPanelContext.context && subPanelContext.context.baseSelection && subPanelContext.context.baseSelection.uid ) {
        selectionUid = subPanelContext.context.baseSelection.uid;
        selection = _cdm.getObject( selectionUid );
    }

    if( selection && selection.props && selection.props.awb0UnderlyingObject && selection.props.awb0UnderlyingObject.dbValues ) {
        objectToOpen = selection.props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        objectToOpen = selectionUid;
    }
    selection.objectToOpen = objectToOpen;
    var array = [];
    array.push( selection );
    //updating ctx.selected as Info panel reads data from ctx.selected
    var parentSelection;
    var selection = selectionService.getSelection();
    if( selection.parent ) {
        parentSelection = selection.parent;
    }
    if( array.length > 0 ) {
        selectionService.updateSelection( array, parentSelection );
    }
    if( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.value ) {
        const tmpSelectionData = { ...subPanelContext.selectionData.value };
        tmpSelectionData.selected = array;
        subPanelContext.selectionData.update( tmpSelectionData );
    }
    if( subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState &&
        subPanelContext.context.vrSublocationState.refreshPreviewPanel ) {
        eventBus.publish( 'refreshPreviewPanel' );
    }
};
// getting parentuid for searchlocation and showobjectlocation
export let getProgramEventParentUid = function( subPanelContext ) {
    var parentUid;
    // getting parentuid for showobjectlocation
    if( subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState && subPanelContext.context.vrSublocationState.mselected[ 0 ] ) {
        parentUid = subPanelContext.context.vrSublocationState.mselected[ 0 ].uid;
    }
    // getting parentuid for searchlocation
    else if( subPanelContext && subPanelContext.selection && subPanelContext.selection[ 0 ] ) {
        parentUid = subPanelContext.selection[ 0 ].uid;
    }
    return parentUid;
};

export default exports = {
    getInputForRemoveProgramEvent,
    getCreateRelationInputForPlanLevelEvents,
    updateSelectionAfterProgramRemove,
    handleSelectionChange,
    getProgramEventParentUid
};
