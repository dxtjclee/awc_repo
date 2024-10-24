// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpNxTcXmlSvc from 'js/services/ngpNxTcXmlService';
import ngpSoaSvc from 'js/services/ngpSoaService';

import hostConfigValues from 'js/hosting/hostConst_ConfigValues';
import hostConfigKeys from 'js/hosting/hostConst_ConfigKeys';
import dms from 'soa/dataManagementService';
import hostConfigSvc from 'js/hosting/hostConfigService';
import hostOpenService from 'js/hosting/hostOpenService';

/**
 * NGP Model Views Service
 *
 * @module js/services/ngpModelViewsService
 */
'use strict';

/**
 * @param {modelObject} modelObject - a given modelObject
 * @return {promise} a promise
 */
export function getSendToNxStatus( modelObject ) {
    if( ngpTypeUtils.isProcessElement( modelObject ) ) {
        const propertiesPromise = dms.getProperties( [ modelObject.uid ],
            [ ngpPropConstants.NUMBER_OF_ASSIGNED_PARTS, ngpPropConstants.NUMBER_OF_ASSIGNED_FEATURES, ngpPropConstants.PREDECESSORS ] );
        const backgroundElementsPromise = hasBackgroundElements( modelObject );
        return Promise.all( [ propertiesPromise, backgroundElementsPromise ] ).then(
            ( responses ) => responses[ 1 ]
        );
    }
    return new Promise( ( resolve ) => {
        resolve( false );
    } );
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 */
export function sendToViewMaker( modelObject ) {
    if( modelObject ) {
        const isInUIConfigMode = hostConfigSvc.isEnabled();
        const currentHostIsNX = hostConfigValues.HOST_TYPE_NX === hostConfigSvc.getOption( hostConfigKeys.HOST_TYPE );
        createOrUpdateDisclosure( modelObject ).then(
            ( workset ) => {
                if( isInUIConfigMode && currentHostIsNX ) {
                    hostOpenService.openInHost( [ workset ] );
                }
                else
                {
                    ngpNxTcXmlSvc.openNxTcXml( [ workset ] );
                }
            }
        );
    }
}

/**
 *
 * @param {modelObject} contextObject - a given modelObject
 * @return {promise<boolean>} a promise which returns a boolean
 */
function hasBackgroundElements( contextObject ) {
    return getBackgoundElements( contextObject ).then(
        ( response ) => Boolean( response && Array.isArray( response.backgroundelements ) && response.backgroundelements.length > 0 )
    );
}

/**
 *
 * @param { modelObject } contextObject - the context modelObject
 * @return {promise} a promise object
 */
function getBackgoundElements( contextObject ) {
    return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-ManufacturingDisclosure', 'getBackgroundElements', { context: contextObject } );
}

/**
 *
 * @param {modelObject} disclosureOwningObject - a given modelObject
 * @return {promise} reutrns a promise object
 */
function createOrUpdateDisclosure( disclosureOwningObject ) {
    return ngpSoaSvc.executeSoa( 'Process-2017-11-ManufacturingDisclosure', 'createOrUpdateMfgDisclosure', { disclosureOwningObject } ).then(
        ( response ) => {
            if( response ) {
                return response.output;
            }
        }
    );
}

let exports = {};
export default exports = {
    sendToViewMaker,
    getSendToNxStatus
};
