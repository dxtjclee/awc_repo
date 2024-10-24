// Copyright (c) 2022 Siemens

/**
 * @module js/Att1VariantInfoConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import paramgmtUtilSvc from 'js/Att1ParameterMgmtUtilService';
import popupService from 'js/popupService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

var _noVariantRule = null;
/**
 *resets the HasVariantConfigContext
 */
export let resetHasVariantConfigContext = function( subPanelContext, parameterState = {} ) {
    var newParameterState = { ...parameterState.value };
    var hasVariantConfigContext = paramgmtUtilSvc.isVariantConfigurationContextAttached( subPanelContext.selected );
    if( hasVariantConfigContext ) {
        //appCtxSvc.updatePartialCtx( 'parammgmtctx.hasVariantConfigContext', hasVariantConfigContext );
        var locationContextObject = subPanelContext.selected;
        if( locationContextObject && !locationContextObject.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 ) {
            newParameterState.showFSC = true;
            parameterState.update && parameterState.update( newParameterState );
        }
    }
};


/**
 *
 * @param {*} data data
 */
export let changeConfiguration = function( activeVariantRuleUID, subPanelContext = {} ) {
    let subPanelContextClone = { ...subPanelContext.context.subPanelHeaderData.value };
    subPanelContextClone.activeVariantRule = activeVariantRuleUID;
    subPanelContext.context.subPanelHeaderData.update( subPanelContextClone );
};

export let applySelectedVariantRuleOnFSC = function( data ) {
    var appliedVariantRules = paramgmtUtilSvc.getRequiredPropValueFromConfigurationContext( 'variant_rule', data.subPanelContext.context.baseSelection );
    ///set  saved variant rule to fsc context
    if( appliedVariantRules ) {
        paramgmtUtilSvc.setContext( 'fscContext.currentAppliedVRs', [ appliedVariantRules.dbValues[ 0 ] ] );
        paramgmtUtilSvc.setContext( 'fscContext.initialVariantRule', [ appliedVariantRules.dbValues[ 0 ] ] );
    }
};
export let initializeFSCForOtherObjThanProject = function( openedObject ) {
    exports.resetHasVariantConfigContext();
    if( openedObject ) {
        appCtxSvc.updateCtx( 'selected', cdm.getObject( openedObject.props.crt0Domain.dbValues[ 0 ] ) );
    }
};

/**
 * Variant Info Configuration service utility
 */

export default exports = {
    resetHasVariantConfigContext,
    initializeFSCForOtherObjThanProject,
    applySelectedVariantRuleOnFSC,
    changeConfiguration
};
