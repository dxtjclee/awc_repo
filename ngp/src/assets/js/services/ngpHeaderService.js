// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPinSvc from 'js/services/ngpPinService';
import ngpFavoritesSvc from 'js/services/ngpFavoritesService';
import ngpCloneSvc from 'js/services/ngpCloneService';
import ngpModelViewsSvc from 'js/services/ngpModelViewsService';
import ngpWorkflowSvc from 'js/services/ngpWorkflowService';
import ngpHeaderPolicy from 'js/services/ngpHeaderPolicy';
import mfePolicySvc from 'js/mfePolicyService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';

/**
 * NGP header service
 *
 * @module js/services/ngpHeaderService
 */
'use strict';

const NGP_HEADER_POLICY_NAME = 'ngpHeaderPolicyName';
const NGP_STATUS_CTX_PATH = 'ngp.scopeObject.status';

/**
 * @param {modelObject} modelObject - a given modelObject
 * @returns {promise<object>} a promise object
 *
 */
export function updateHeader( modelObject ) {
    if( modelObject ) {
        const promiseArray = [];
        promiseArray.push( ngpFavoritesSvc.isInFavorites( modelObject ) );
        promiseArray.push( ngpPinSvc.isPinnedToHome( modelObject ) );
        promiseArray.push( ngpCloneSvc.getCloneStatus( modelObject, false ) );
        promiseArray.push( ngpModelViewsSvc.getSendToNxStatus( modelObject ) );
        promiseArray.push( ngpWorkflowSvc.getDiscontinuedAndNotReleasedProcessesUids( modelObject ) );
        return Promise.all( promiseArray ).then(
            ( [ isInFavorites, isPinnedToHome, cloneStatus, hasBackgroundElements, discontinuedUids ] ) => ( {
                isInFavorites,
                isPinnedToHome,
                cloneStatus,
                hasBackgroundElements,
                amountOfDiscontinuedSubElements: discontinuedUids.length
            } )
        );
    }
    return new Promise( ( res ) => res( {} ) );
}

/**
 * Registers the property policy of the header
 */
export function init() {
    mfePolicySvc.register( NGP_HEADER_POLICY_NAME, ngpHeaderPolicy );
}

/**
 * Unregisters the header policy
 */
export function destroy() {
    mfePolicySvc.unregister( NGP_HEADER_POLICY_NAME );
}

/**
 *
 * @param {modelObject[]} updatedObjects - updated uids
 */
export function updateDiscontinuedElementsIndication( updatedObjects ) {
    const contextObj = appCtxSvc.getCtx( 'ngp.scopeObject' );
    if( ngpTypeUtils.isActivity( contextObj ) && Array.isArray( updatedObjects ) && updatedObjects.length > 0 ) {
        const contextUpdated = _.find( updatedObjects, ( obj ) => obj.uid === contextObj.uid );
        if( contextUpdated ) {
            ngpWorkflowSvc.getDiscontinuedAndNotReleasedProcessesUids( contextObj ).then(
                ( discontinuedUids ) => {
                    appCtxSvc.updatePartialCtx( `${NGP_STATUS_CTX_PATH}.amountOfDiscontinuedSubElements`, discontinuedUids.length );
                }
            );
        }
    }
}

let exports = {};
export default exports = {
    updateHeader,
    updateDiscontinuedElementsIndication,
    init,
    destroy
};
