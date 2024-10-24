// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpLoadSvc from 'js/services/ngpLoadService';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import vmoSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import mfeHostingService from 'js/services/mfeHostingService';
import popupSvc from 'js/popupService';
import eventBus from 'js/eventBus';
import ngpNavigationService from 'js/services/ngpNavigationService';
import ngpHostingMessagingService from 'js/services/ngpHostingMessagingService';
import addObjectUtilsSvc from 'js/addObjectUtils';
import ngpRelationSvc from 'js/services/ngpRelationService';
import soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import dms from 'soa/dataManagementService';
import ngpConstants from 'js/constants/ngpModelConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';

const localizedMsgs = localeSvc.getLoadedText( 'NgpChangeMgmtMessages' );

/**
 * The ngp workflow service
 *
 * @module js/services/ngpChangeManagementService
 */

'use strict';

let navigateToObjectFromHostedContentListener;

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {promise<string>} activeMcnUid - a promise which is resolved to a string uid.
 */
export function getActiveMcnUid( modelObject ) {
    if( ngpTypeUtils.isActivity( modelObject ) ) {
        return dms.getProperties( [ modelObject.uid ], [ ngpPropConstants.ACTIVE_MCN ] ).then(
            () => {
                const modelObj = cdm.getObject( modelObject.uid );
                return modelObj.props[ ngpPropConstants.ACTIVE_MCN ].dbValues[ 0 ];
            }
        );
    }
    return new Promise( ( res ) => res( '' ) );
}

/**
 *
 * @param {string} activeMcnUid - mcn uid
 * @return {promise} a promise object
 */
export function loadActiveMcn( activeMcnUid ) {
    return ngpLoadSvc.ensureObjectsLoaded( [ activeMcnUid ] ).then(
        () => vmoSvc.constructViewModelObjectFromModelObject( cdm.getObject( activeMcnUid ) )
    );
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {string[]} mcnUids - a list of mcn uids
 */
export function getPreviousMcnUids( modelObject ) {
    let uids = [];
    if( modelObject ) {
        const activeMcn = modelObject.props[ ngpPropConstants.ACTIVE_MCN ].dbValues[ 0 ];
        const associatedMcns = modelObject.props[ ngpPropConstants.ASSOCIATED_MCNS ].dbValues;
        const mcnHistoryUids = associatedMcns.filter( ( uid ) => uid !== activeMcn );
        uids = mcnHistoryUids;
    }
    return uids;
}

/**
 *
 * @param {string[]} modelObject - a given modelObject
 * @return {promise} a promise object
 */
export function getPreviousMcns( modelObject ) {
    if( ngpTypeUtils.isActivity( modelObject ) ) {
        return ngpLoadSvc.getPropertiesAndLoad( [ modelObject.uid ], [ ngpPropConstants.ACTIVE_MCN, ngpPropConstants.ASSOCIATED_MCNS ] ).then(
            () => {
                const modelObj = cdm.getObject( modelObject.uid );
                const mcnUids = getPreviousMcnUids( modelObj );
                let previousMcns = mcnUids.map( ( uid ) => vmoSvc.constructViewModelObjectFromModelObject( cdm.getObject( uid ) ) );
                return ngpDataUtils.sortModelObjectsByProp( previousMcns, ngpPropConstants.CREATION_DATE, false );
            }
        );
    }
    return new Promise( ( res ) => res( [] ) );
}

/**
 *
 * @param {string} activeMcnUid - the active mcn uid
 * @return {promise} a promise object
 */
export function loadRelatedEcns( activeMcnUid ) {
    return ngpLoadSvc.getPropertiesAndLoad( [ activeMcnUid ], [ ngpPropConstants.ECNS_OF_MCN ] ).then(
        () => {
            const activeMcn = cdm.getObject( activeMcnUid );
            const ecnUids = activeMcn.props[ ngpPropConstants.ECNS_OF_MCN ].dbValues;
            const ecnVMOs = ecnUids.map( ( uid ) => vmoSvc.constructViewModelObjectFromModelObject( cdm.getObject( uid ) ) );
            return ngpDataUtils.sortModelObjectsByProp( ecnVMOs, ngpPropConstants.CREATION_DATE, false );
        }
    );
}

/**
 * set the hosting popup and relevant url to open
 * @param {Object} ctx - the ctx object
 * @param {object} contextModelObj - the context model object
 * @param {Object} data
 */
export function setHostingPopup( ctx, contextModelObj, data ) {
    ngpHostingMessagingService.init();
    const contextDefined = Boolean( contextModelObj && contextModelObj.uid );
    const uid = contextDefined ? contextModelObj.uid : ctx.selected.uid;


    mfeHostingService.initHosting( 'ngp', 'com.siemens.splm.client.mfg.ngp/ngpEcn',  'impactedAnalysisHostedIframe' );

    navigateToObjectFromHostedContentListener = eventBus.subscribe( 'navigateToObjectFromHostedContent', function( eventData ) {
        eventBus.unsubscribe( navigateToObjectFromHostedContentListener );
        navigateToObjectFromHostedContentListener = null;
        destroyHostingPopup( data._internal.panelId, contextDefined );
        ngpNavigationService.onNavigationFromHostedRequest( eventData );
    } );
}

/**
 * cauculate the src iframe
 * @param {Object} ctx - the ctx object
 * @param {Object} contextModelObj - the context modelObject
 * @return {string} the iframe src string
 */
export function getIframeSrc( ctx, contextModelObj ) {
    const contextDefined = Boolean( contextModelObj && contextModelObj.uid );
    const uid = contextDefined ? contextModelObj.uid : ctx.selected.uid;
    const params = {
        uid
    };

    //return mfeHostingService.initSrc( 'ngp', 'com.siemens.splm.client.mfg.ngp/ngpEcn', params );
}
/**
 * clear all resource of hosting when closing popup
 * @param { string } popupId - the popup id
 * @param { boolean } isUsingImpactAnalysisHostingSvc - boolean which hosting service is used
 *
 */
export function destroyHostingPopup( popupId, isUsingImpactAnalysisHostingSvc ) {
    if( !isUsingImpactAnalysisHostingSvc ) {
        ngpHostingMessagingService.destroy();
        //mfeHostingService.destroyHosting();
    }
    popupSvc.hide( popupId );
    if( navigateToObjectFromHostedContentListener ) {
        eventBus.unsubscribe( navigateToObjectFromHostedContentListener );
        navigateToObjectFromHostedContentListener = null;
    }
}

/**
 * cauculate the src iframe
 * @param { Object } ctx - the ctx object
 * @param {Object} contextModelObj - the context modelObject
 * @return {Object} object with the iframeId and boolean stating if we're using the secondary hosting service
 */
export function getPopupParams( ctx, contextModelObj ) {
    const shouldUseSecondaryHostingSvc = Boolean( contextModelObj && contextModelObj.uid );
    return {
        iframeId: 'impactedAnalysisHostedIframe',
        isUsingSecondaryHostingSvc: shouldUseSecondaryHostingSvc,
        ecnName: shouldUseSecondaryHostingSvc ? contextModelObj.props.object_name.uiValues[ 0 ] : ctx.selected.props.object_name.uiValues[ 0 ]
    };
}

/**
 * @param { Object } viewModelData - the viewModel data object
 * @param { Object } editHandler - edit handler
 * @return { promise } - a promise object
 */
export function createMcnAndSubmitToWorkflow( viewModelData, editHandler ) {
    const soaInput = addObjectUtilsSvc.getCreateInput( viewModelData, null, viewModelData.xrtState.xrtTypeLoaded.type, editHandler );
    return ngpRelationSvc.createRelateAndSubmitObjects( soaInput ).then(
        () => true,
        () => false
    );
}

/**
 * @param { string } mcnTypeName - the mcn type name
 * @return { boolean } - a boolean
 */
export function isMcnTypeToCreateValid( mcnTypeName ) {
    if( mcnTypeName ) {
        return soaSvc.ensureModelTypesLoaded( [ mcnTypeName ] ).then(
            () => {
                const mcnModelType = cmm.getType( mcnTypeName );
                const isValid = cmm.isInstanceOf( ngpConstants.MCN_OBJECT_BASE_TYPE, mcnModelType );
                if( !isValid ) {
                    msgSvc.showError( localizedMsgs.createMcnPreferenceNotValid );
                }
                return isValid;
            }
        );
    }
    return new Promise( ( resolve ) => resolve( false ) );
}

let exports;
export default exports = {
    isMcnTypeToCreateValid,
    createMcnAndSubmitToWorkflow,
    loadActiveMcn,
    getActiveMcnUid,
    getPreviousMcnUids,
    getPreviousMcns,
    loadRelatedEcns,
    setHostingPopup,
    destroyHostingPopup,
    getPopupParams,
    getIframeSrc
};
