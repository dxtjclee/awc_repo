// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';

import appCtxSvc from 'js/appCtxService';
import browserUtils from 'js/browserUtils';
import dms from 'soa/dataManagementService';
import tcSessionData from 'js/TcSessionData';

/**
 * NGP Model Views Service
 *
 * @module js/services/ngpNxTcXmlService
 */
'use strict';

const OPEN_NX_END_POINT = 'launcher/openinnx';
const CLIENT_SOA_ROOT_RELATIVE_PATH = 'tc';

/**
 *
 * @param {modelObject[]} worksets - an array of given worksets
 * @return {string} the string of selected worksets
 */
function getWorksetString( worksets ) {
    let selectionString = 'SelectedObject=';
    worksets.forEach( ( workset ) => {
        selectionString = selectionString.concat( `${workset.uid} ` );
    } );
    //remove the unneeded space (' ') at the end of the string
    selectionString = selectionString.substring( 0, selectionString.length - 1 );
    return selectionString;
}

/**
 * @return {string} the user name string
 */
function getUserString() {
    const userSessionObj = appCtxSvc.getCtx( 'userSession' );
    const userName = userSessionObj.props.user_id.dbValue;
    return `UserName=${userName}`;
}

/**
 *
 * @param {string} securityToken - the security token
 * @return {string} the encoded securtiy token
 */
function getSecuredTokenString( securityToken ) {
    const encodedString = encodeURIComponent( securityToken );
    return `SessionInfo=${encodedString}`;
}

/**
 *  @param {string} ssoHostPath - the sso host path string
 * @return {string} the server information string
 */
function getServerInfoString() {
    const protocolVal = tcSessionData.getProtocol();
    const protocolStr = `Protocol=${protocolVal}`;
    const hostPath = `${browserUtils.getBaseURL()}${CLIENT_SOA_ROOT_RELATIVE_PATH}`;
    const hostPathStr = `HostPath=${hostPath}`;
    const SSOHostPathValue = `SSOHostPathValue=${hostPath}`;
    const serverVersionStr = `Server_Version=${tcSessionData.getTCMajorVersion()}`;
    return `${protocolStr}&${hostPathStr}&${SSOHostPathValue}&${serverVersionStr}`;
}

/**
 *
 * @param {number} duration - a given duration
 * @return {promise} a promise object
 */
function getSecurityToken( duration ) {
    return ngpSoaSvc.executeSoa( 'Internal-Core-2014-11-Session', 'getSecurityToken', { duration } ).then(
        ( response ) => {
            if( response ) {
                return response.out;
            }
        }
    );
}

/**
 *
 * @param {string} securityToken - the security token string
 * @param { modelObject[] } worksets - array of workset objects
 */
function openWindow( securityToken, worksets ) {
    const baseUrl = browserUtils.getBaseURL();
    const selectionStr = getWorksetString( worksets );
    const serverInfoStr = getServerInfoString();
    const userStr = getUserString();
    const securityTokenStr = getSecuredTokenString( securityToken );

    const url = `${baseUrl}${OPEN_NX_END_POINT}?${selectionStr}&${serverInfoStr}&${userStr}&${securityTokenStr}`;
    window.open( url, '_self', 'enabled' );
}

/**
 *
 * @param {modelObject[]} worksets - array of workset objects
 */
export function openNxTcXml( worksets ) {
    if( Array.isArray( worksets ) && worksets.length > 0 ) {
        const userObj = appCtxSvc.getCtx( 'user' );
        dms.getProperties( [ userObj.uid ], [ 'userid' ] ).then(
            () => {
                getSecurityToken( 300 ).then(
                    ( securityToken ) => {
                        openWindow( securityToken, worksets );
                    }
                );
            }
        );
    }
}

let exports = {};
export default exports = {
    openNxTcXml
};
