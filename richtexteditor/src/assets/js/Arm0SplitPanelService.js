// Copyright (c) 2022 Siemens

/**
 * Module for the Parameter in Requirement Documentation Page
 *
 * @module js/Arm0SplitPanelService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};

export let changePanelLocation = function( panelLocation, commandContext, data, selectedObj ) {
    appCtxSvc.ctx.showRequirementQualityData = undefined;
    var secondaryXrt = _.get( appCtxSvc, 'ctx.xrtPageContext.secondaryXrtPageID', undefined );
    if( data && data.eventData && data.eventData.paramid ) {
        data.selectParam = data.eventData.paramid;
    }

    var requirementCtx = commandContext.requirementCtx;
    var newRequirementCtx = { ...commandContext.requirementCtx.getValue() };
    if( !appCtxSvc.ctx.attributesCtx ) {
        appCtxSvc.ctx.attributesCtx = {};
    }

    //FOr PWA Selection
    if( commandContext.selection.length !== 0 ) {
        var pwaSelected = commandContext.selection;
        var firstSelected = pwaSelected[0];
        if( secondaryXrt === 'tc_xrt_summary_table' ) {
            firstSelected = appCtxSvc.getCtx( 'selected' );
            if( selectedObj ) {
                firstSelected = selectedObj;
            }
        }
        if( firstSelected ) {
            var cdmObject = cdm.getObject( firstSelected.uid );
            appCtxSvc.ctx.attributesCtx.objectToFetchParams = [ cdmObject ];
            _.set( appCtxSvc, 'ctx.requirements.selectedObjects', [ cdmObject ] );
        }
    }

    if( newRequirementCtx.splitPanelLocation === 'undefined' ) {
        newRequirementCtx.splitPanelLocation = panelLocation;
        if( data ) {
            newRequirementCtx.objectsToSelect = data.eventData.objectsToSelect;
        }
    } else if( newRequirementCtx && newRequirementCtx.splitPanelLocation && newRequirementCtx.splitPanelLocation === 'bottom' ) {
        newRequirementCtx.splitPanelLocation = 'off';
    } else {
        newRequirementCtx.splitPanelLocation = panelLocation;
    }
    if( secondaryXrt !== 'tc_xrt_summary_table' ) {
        // Event to resize Ckeditor
        eventBus.publish( 'requirementsEditor.resizeEditor' );
    }
    requirementCtx.update( newRequirementCtx );
};

export default exports = {
    changePanelLocation
};
