// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1ReportsService
 */
import appCtxSvc from 'js/appCtxService';
import selectionService from 'js/selection.service';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';

var exports = {};

export let changeSelectionForReportTable = function( data, currentScopeSel, subPanelContext ) {
    var dataProvider = null;
    var selectedObjects = [];
    var parentSelection;

    if( data && data.dataProviders && data.dataProviders.reportTableProvider ) {
        dataProvider = data.dataProviders.reportTableProvider;
        selectedObjects = dataProvider.selectedObjects;

        //selectedObjects are xrtRow objects. set those in objectToRemove variable.
        //objectsToRemove will be used for removing reports.
        appCtxSvc.registerCtx( 'reportObjectsToRemove', selectedObjects );
    }

    var selection = selectionService.getSelection();

    if( selectedObjects.length > 0 ) {
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
            var objUid = selectedObjects[ j ].props.awp0Secondary.dbValue;
            var attribute = cdm.getObject( objUid );
            correctedSelection.push( attribute );
        }
        // change the current selection
        if( correctedSelection.length > 0 ) {
            selectionService.updateSelection( correctedSelection, parentSelection );
        }
    }else {
        if( currentScopeSel ) {
            selectionService.updateSelection( currentScopeSel );
        }
    }

    if( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.value ) {
        const tmpSelectionData = { ...subPanelContext.selectionData.value };
        tmpSelectionData.selected = correctedSelection;
        subPanelContext.selectionData.update( tmpSelectionData );
    }
    if( subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState &&
        subPanelContext.context.vrSublocationState.refreshPreviewPanel ) {
        eventBus.publish( 'refreshPreviewPanel' );
    }
};

export let initAddReportPanelTypes = function( data, ctx ) {
    var relationMap = {};


    var currentScopeTableSelection = ctx;
    if( !currentScopeTableSelection ) {
        currentScopeTableSelection = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
    }

    var targetObj = cdm.getObject( currentScopeTableSelection.uid );
    var relations = [];
    var includeTypes;
    var typeFilter;

    if( currentScopeTableSelection &&
        currentScopeTableSelection.modelType.typeHierarchyArray.indexOf( 'IAV0TestRunRevision' ) > -1 ) {
        relationMap.Dataset = [
            'IAV0ReportTL',
            'IAV0DataTL',
            'IMAN_specification',
            'IMAN_reference',
            'IMAN_manifestation',
            'IMAN_Rendering',
            'TC_Attaches'
        ];

        relationMap.DocumentRevision = [ 'IMAN_specification', 'IAV0ReportTL' ];
        relationMap.WorkspaceObject = [ 'IAV0DataTL' ];


        relations = 'IAV0ReportTL,IAV0DataTL,IMAN_specification,IMAN_reference,IMAN_manifestation,IMAN_Rendering,TC_Attaches';


        includeTypes = 'Dataset,Document,WorkspaceObject';
        typeFilter = 'Dataset,DocumentRevision,WorkspaceObject';


        data.report = {
            relationMap: relationMap,
            target: targetObj,
            relations: relations,
            includeTypes: includeTypes,
            typeFilter: typeFilter
        };

        var reportContext = {
            target :targetObj,
            relations:relations,
            includeTypes:includeTypes,
            typeFilter:typeFilter
        };
    } else{
    //If VR/SR/TR/Run is selected from scope table then use below relation and filter types
        relationMap.Dataset = [
            'IMAN_specification',
            'IMAN_reference',
            'IMAN_manifestation',
            'IMAN_Rendering',
            'TC_Attaches'
        ];

        relationMap.DocumentRevision = [ 'IMAN_specification' ];

        relations = 'IMAN_specification,IMAN_reference,IMAN_manifestation,IMAN_Rendering,TC_Attaches';

        includeTypes = 'Dataset,Document';
        typeFilter = 'Dataset,DocumentRevision';

        data.report = {
            relationMap: relationMap,
            target: targetObj,
            relations: relations,
            includeTypes: includeTypes,
            typeFilter: typeFilter
        };


        var reportContext = {
            target :targetObj,
            relations:relations,
            includeTypes:includeTypes,
            typeFilter:typeFilter
        };
    }
    //Register reportContext in ctx, this will be used in Crt1AddReportView.html
    appCtxSvc.registerCtx( 'reportContext', reportContext );
};


export let refreshReoprtTable = function( data ) {
    eventBus.publish( 'reportTable.plTable.reload' );
};

export let getInputForRemoveReport = function( ctx ) {
    var relationInputs = [];
    var reportObjectsToRemove = ctx.reportObjectsToRemove;

    if( reportObjectsToRemove && reportObjectsToRemove.length ) {
        for( var index = 0; index < reportObjectsToRemove.length; index++ ) {
            var primaryObj = cdm.getObject( reportObjectsToRemove[index].props.awp0Primary.dbValue );
            var secondaryObj = cdm.getObject( reportObjectsToRemove[ index ].props.awp0Secondary.dbValue );

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
                relationType: reportObjectsToRemove[index].props.awp0RelationTypeName.dbValue
            } );
        }
    }
    //Input for remove report is ready. Now we can clear ctx variable
    appCtxSvc.unRegisterCtx( 'reportObjectsToRemove' );
    return relationInputs;
};

export let unregisterReportCtx = function() {
    if( appCtxSvc.ctx.reportObjectsToRemove ) {
        appCtxSvc.unRegisterCtx( 'reportObjectsToRemove' );
    }

    updateSelection();
};

function updateSelection( ) {
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

export let getObjectStringForReportTable = function( selObj ) {
    if( selObj && selObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestRunRevision' ) > -1 ) {
        return 'IAV0DataTL.WorkspaceObject,IAV0ReportTL.WorkspaceObject,IMAN_specification.DocumentRevision,IMAN_specification.Dataset,IMAN_reference.Dataset,IMAN_manifestation.Dataset,IMAN_Rendering.Dataset,TC_Attaches.Dataset';
    }

    return 'IMAN_specification.DocumentRevision,IMAN_specification.Dataset,IMAN_reference.Dataset,IMAN_manifestation.Dataset,IMAN_Rendering.Dataset,TC_Attaches.Dataset';
};

export default exports = {
    changeSelectionForReportTable,
    initAddReportPanelTypes,
    refreshReoprtTable,
    getInputForRemoveReport,
    unregisterReportCtx,
    getObjectStringForReportTable

};
