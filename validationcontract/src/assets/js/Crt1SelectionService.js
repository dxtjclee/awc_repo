// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1SelectionService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import selectionService from 'js/selection.service';

var exports = {};

/*
 * Corrects selection to be elements from contents table of VR
 */
export let changeSelection = function( data ) {
    var dataProvider = null;
    var selectedObjects = [];
    if( data && data.dataProviders && data.dataProviders.contentsTableProvider ) {
        dataProvider = data.dataProviders.contentsTableProvider;
        selectedObjects = dataProvider.selectedObjects;
        appCtxSvc.registerCtx( 'vrContentTableSelection', selectedObjects );
    }
    var selection = selectionService.getSelection();
    if( selectedObjects ) {
        var correctedSelection = [];
        var parentSelection;
        var selectedElementsInPWA = _.get( appCtxSvc, 'ctx.occmgmtContext.selectedModelObjects', [] );
        if( selectedObjects.length > 0 && selectedElementsInPWA.length === 1 ) {
            parentSelection = selectedElementsInPWA[ 0 ];
        } else {
            if( !selection.parent ) {
                var parent = appCtxSvc.ctx.parentSelection;
                parentSelection = parent;
                appCtxSvc.registerCtx( 'pselected', parentSelection );
            } else {
                parentSelection = selection.parent;
                appCtxSvc.registerCtx( 'parentSelection', parentSelection );
            }
        }
        // get the selected attributes
        for( var j = 0; j < selectedObjects.length; ++j ) {
            var objUid = selectedObjects[ j ].props.crt1SourceObject.value;
            var attribute = cdm.getObject( objUid );

            correctedSelection.push( attribute );
        }
        // change the current selection
        if( correctedSelection.length > 0 ) {
            selectionService.updateSelection( correctedSelection, parentSelection );
        }
    }
    //register Uid for opening in new context
    appCtxSvc.unRegisterCtx( 'newContextUid' );
    if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.props.awb0UnderlyingObject ) {
        appCtxSvc.registerCtx( 'newContextUid', appCtxSvc.ctx.selected.props.awb0UnderlyingObject.dbValues[0] );
    }else{
        appCtxSvc.registerCtx( 'newContextUid', appCtxSvc.ctx.selected.uid );
    }
};

export let clearProviderSelection = function( data ) {
    if( data && data.dataProviders ) {
        var dataProvider = data.dataProviders.contentsTableProvider;
        if( dataProvider ) {
            dataProvider.selectNone();
        }
    }
};

export let updateSelectionForRemoveAndEditAction = function( ) {
    var newSelection = null;
    var correctedSelection = [];
    var currentScopeTableSelection = appCtxSvc.ctx.currentScopeTableSelection;
    if( !currentScopeTableSelection ) {
        // AR inputs/overview view, set the selection to the AR
        //newSelection = cdm.getObject( appCtxSvc.ctx.locationContext.modelObject.uid );
    } else {
        var pin = appCtxSvc.ctx.tpAddedWhenPanelPinned;
        if( !pin || pin === false ) {
            appCtxSvc.unRegisterCtx( 'TMTableSelection' );
            appCtxSvc.unRegisterCtx( 'TPTableSelection' );
            appCtxSvc.unRegisterCtx( 'TestCaseTableSelection' );
        }
        appCtxSvc.unRegisterCtx( 'testBOMTableSelection' );
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
};


/*
 * Corrects selection to be elements from all dynamic tables
 */
export let changeSelectionForDynamicTables = function( dataProvider ) {
    var prevSelection = [];
    if( dataProvider && dataProvider.selectedObjects && dataProvider.selectedObjects.length > 0 ) {
        prevSelection = { selectedObjects: dataProvider.selectedObjects };
        return prevSelection;
    }
};

/**
 * Gets space separated UIDs sting for PWA select elements for Test Results tab.
 *
 * @returns {String} the list of parent UIDs separated by " "
 */
export let getSelectedElementUids = function( data ) {
    var parentUids = '';
    if( data.eventData === undefined ) {
        parentUids = data.subPanelContext.selection[ 0 ].uid;
        for( var i = 1; i < data.subPanelContext.selection.length; i++ ) {
            parentUids = parentUids.concat( '#', data.subPanelContext.selection[ i ].uid );
        }
    } else{
        parentUids = data.eventData.selectedObjects[ 0 ].uid;
        for( var i = 1; i < data.eventData.selectedObjects.length; i++ ) {
            parentUids = parentUids.concat( '#', data.eventData.selectedObjects[ i ].uid );
        }
    }
    return parentUids;
};

export default exports = {
    changeSelection,
    clearProviderSelection,
    updateSelectionForRemoveAndEditAction,
    changeSelectionForDynamicTables,
    getSelectedElementUids
};
