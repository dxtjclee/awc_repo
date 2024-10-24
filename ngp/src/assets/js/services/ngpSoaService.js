// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPartialErrorSvc from 'js/services/ngpPartialErrorService';
import soaSvc from 'soa/kernel/soaService';

/**
 * The ngp relation service
 *
 * @module js/services/ngpSoaService
 */
'use strict';

/**
 *
 * @param {string} serviceName - the service name
 * @param {string} operationName - the operation name
 * @param {object} body - the soa input
 * @param {object} options
 *            {boolean} returnErrors - true if you want the list of error numbers returned when resolving the promise
 *            {boolean} aggregateErrors - true if you want to show errors in one message dialog, or each error in diffrent message dialog
 *            {boolean} ignoreReject - true if you want to return resolve always, don't want to reject in case of errors
 *            {object[]} errorsToIgnore - array of error objects to ignore
 *            {Object|String} propertyPolicyOverride - SOA property policy override
 * @return {promise} a promise object. The promise will be resolved with the response
 *                   and the list of ignorable partial errors, or rejected with a list of partial errors
 */
export function executeSoa( serviceName, operationName, body, options = {} ) {
    const { returnErrors = false, aggregateErrors = false, ignoreReject = false, errorsToIgnore = [], propertyPolicyOverride = null } = options;
    return soaSvc.postUnchecked( serviceName, operationName, body, propertyPolicyOverride ).then(
        ( response ) => {
            if( ignoreReject ) {
                return response;
            }
            const categorizedErrors = ngpPartialErrorSvc.handlePartialErrors( getServiceData( response ), aggregateErrors, errorsToIgnore );
            if( categorizedErrors.notToIgnore.length > 0 ) {
                throw categorizedErrors.notToIgnore;
            } else if( returnErrors ) {
                return {
                    response,
                    errors: categorizedErrors.ignore.concat( categorizedErrors.ignoreButDisplay )
                };
            }
            return response;
        }
    );
}

/**
 * @param {Object} response - response
 * @return {Object|null} service data
 */
function getServiceData( response ) {
    if( response.hasOwnProperty( '.QName' ) && /\.ServiceData$/.test( response[ '.QName' ] ) ) {
        return response;
    } else if( response.ServiceData ) {
        // If the service data is a member field, update the service data reference
        return response.ServiceData;
    }
}

/**
 * create model object represintation for soa input
 * @param {modelObject} modelObject a given modelObject
 * @return {object} object containing the uid and type of the give modelObject
 */
export function extractTypeAndUID( modelObject ) {
    if( modelObject && typeof modelObject === 'object' ) {
        return {
            uid: modelObject.uid,
            type: modelObject.type
        };
    }
}
export default {
    executeSoa,
    extractTypeAndUID
};
