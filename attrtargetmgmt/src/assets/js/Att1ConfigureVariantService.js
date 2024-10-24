// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ConfigureVariantService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import paramMgmtSvc from 'js/Att1ParameterMgmtUtilService';
import attrTableUtils from 'js/attrTableUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};
export let initializeConsumerAppsData = function( openedObject, parameterState ) {
    var hasVariantConfigContext = paramMgmtSvc.isVariantConfigurationContextAttached( openedObject );
    if( hasVariantConfigContext ) {
        parameterState.hasVariantConfigContext = true;
        appCtxSvc.updateCtx( 'variantConditionContext.consumerAppsLoadDataInProgress', true );
    }
};

export let loadParameterVariants = function( hasVariantConfigContext, subPanelContext, isSelectionChange ) {
    if( hasVariantConfigContext ) {
        var openedObject = subPanelContext.context.baseSelection;
        var locationContextTypeHierarchyArray = [];
        if( openedObject && openedObject.modelType && openedObject.modelType.typeHierarchyArray ) {
            locationContextTypeHierarchyArray = openedObject.modelType.typeHierarchyArray;
        }

        if( locationContextTypeHierarchyArray && locationContextTypeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1 || locationContextTypeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 ) {
            var selectedProxies = appCtxSvc.getCtx( 'mselected' );
            var selected = appCtxSvc.getCtx( 'selected' );
            if( !selected.modelType || selected.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) <= -1 ) {
                selectedProxies = subPanelContext.selection;
            }

            var selectedObjects = [];
            for( var x = 0; x < selectedProxies.length; ++x ) {
                var selectedProxy = cdm.getObject( selectedProxies[ x ].uid );

                if( selectedProxy && selectedProxy.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
                    var sourceObject = cdm.getObject( selectedProxy.props.att1SourceAttribute.dbValues[ 0 ] );

                    if( sourceObject.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
                        selectedObjects.push( selectedProxies[ x ] );
                    }
                }
            }
            if( selectedObjects.length > 0 ) {
                paramMgmtSvc.setContext( 'variantConditionContext.allowConsumerAppsToLoadData', true );
                paramMgmtSvc.setContext( 'variantConditionContext.selectedObjectsFromConsumerApps', selectedObjects );
                if( _.get( appCtxSvc, 'ctx.variantConditionContext.consumerAppsLoadDataInProgress', false ) ) {
                    delete appCtxSvc.ctx.variantConditionContext.consumerAppsLoadDataInProgress;
                }
            }
            //handle SelectionChangeWhen We are in ParameterVariants Tab
            if( isSelectionChange && !appCtxSvc.ctx.isVariantTableEditing ) {
                eventBus.publish( 'configuratorVcaTable.reload' );
            }
        }
    }
};

export let resetConsumerAppsData = function() {
    delete appCtxSvc.ctx.variantConditionContext.allowConsumerAppsToLoadData;
    delete appCtxSvc.ctx.variantConditionContext.selectedObjectsFromConsumerApps;
};
export let setVariantConfigContext = function() {
    var variantConfigContext = {};
    variantConfigContext.guidedMode = true;
    variantConfigContext.customVariantPanelInitializing = true;
    var hasVariantConfigContext = paramMgmtSvc.isVariantConfigurationContextAttached();
    appCtxSvc.registerCtx( 'variantConfigContext', variantConfigContext );
    //also check if configuratorContext Object is Attached or Not
    if( hasVariantConfigContext ) {
        paramMgmtSvc.setContext( 'parammgmtctx.hasVariantConfigContext', true );
    } else {
        paramMgmtSvc.setContext( 'parammgmtctx.hasVariantConfigContext', false );
    }
};

/**
 * Clear PWA selection
 */
export let clearPWASelection = function() {
    var parammgmtctx = appCtxSvc.getCtx( 'parammgmtctx', parammgmtctx );
    if( parammgmtctx ) {
        var openedObject = appCtxSvc.getCtx( 'locationContext' ).modelObject;
        appCtxSvc.updatePartialCtx( 'parammgmtctx.selected', openedObject );
        appCtxSvc.updatePartialCtx( 'parammgmtctx.mselected', [ openedObject ] );
    }
};

export let getSelectionForVariantContext = function() {
    var selectionContext;
    var openedObjectUid = attrTableUtils.getOpenedObjectUid();
    var openedObject = cdm.getObject( openedObjectUid );
    if( openedObject.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1 ) {
        selectionContext = openedObject;
    } else {
        selectionContext = appCtxSvc.ctx.parammgmtctx.paramProject;
        appCtxSvc.updateCtx( 'selected', selectionContext );
    }
    return selectionContext;
};
/**
 * Returns created variant rule from SOA response
 *
 * @param {Object} response the response from the variant configuration view SOA
 *
 * @returns {Object} Created variant rule.
 */
export let getCreatedVariantRule = function( response ) {
    if( response.ServiceData.created ) {
        var variantRuleUID = response.ServiceData.created[ 0 ];
        return response.ServiceData.modelObjects[ variantRuleUID ];
    }
};
export let cacheConfigPerspective = function( response ) {
    if( response.configPerspective ) {
        return response.configPerspective;
    }
};
/**
 * This API returns current variant mode i.e. Guide/Manual
 *
 * @returns {String} variantMode - Returns the current variant mode i.e. Guide/Manual
 */
export let getConfigurationMode = function() {
    var variantMode = 'guided';
    var context = appCtxSvc.getCtx( 'variantConfigContext' );
    if( !context ) {
        variantMode = 'manual';
    }
    return variantMode;
};

/**
 * Returns the Att1ConfigureVariantService instance
 *
 * @member Att1ConfigureVariantService
 */

export default exports = {
    initializeConsumerAppsData,
    loadParameterVariants,
    resetConsumerAppsData,
    setVariantConfigContext,
    clearPWASelection,
    getSelectionForVariantContext,
    getCreatedVariantRule,
    cacheConfigPerspective,
    getConfigurationMode
};
