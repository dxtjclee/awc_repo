// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Utilities to show notification (confirmation) messages
 *
 * @module js/epSecurityMarkingService
 */

import viewerSecurityMarkingService from 'js/viewerSecurityMarkingService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import localeService from 'js/localeService';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';


function clearLocalStorage() {
    localStorage.removeItem( 'ackSecurityMarkings' );
    unRegisterSessionSignout();
}


function registerSessionSignout() {
    let eventSub = appCtxService.getCtx( 'registerSessionSignoutCtx' );
    if ( !eventSub ) {
        let registerSession = eventBus.subscribe( 'session.signOut', clearLocalStorage );
        appCtxService.updatePartialCtx( 'registerSessionSignoutCtx', registerSession );
    }
}

function unRegisterSessionSignout() {
    let eventUnSub = appCtxService.getCtx( 'unRegisterSessionSignoutCtx' );

    if ( eventUnSub ) {
        eventBus.unsubscribe( eventUnSub );
        appCtxService.updatePartialCtx( 'unRegisterSessionSignoutCtx', null );
    }
}

/**
 * saves ack security markings
 * @param {String} marking marking to represent to user
 */

function saveAckSecurityMarking( marking ) {
    let securityMarkings = localStorage.getItem( 'ackSecurityMarkings' );
    //get CC ID
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    let cc_uid = epPageContext ? epPageContext.collaborationContext.uid : appCtxService.getCtx( 'locationContext.modelObject.uid' );
    //remove spaces from marking
    marking = marking.replace( /\s/g, '' );

    if ( securityMarkings ) {
        securityMarkings = JSON.parse( securityMarkings );
        if ( securityMarkings[cc_uid] ) {
            securityMarkings[cc_uid].push( marking );
        } else {
            securityMarkings[cc_uid] = [ marking ];
        }
    } else {
        securityMarkings = {};
        securityMarkings[cc_uid] = [ marking ];
    }
    localStorage.setItem( 'ackSecurityMarkings', JSON.stringify( securityMarkings ) );
}

/**
 * shows unAck security markings
 * @param {Array} markings markings to represent to user
 * @param {String} markInFront current marking
 * @param {function} callback callback function returned by MFEVisWeb
 * @returns {Promise} promise
 */
function showUnAckSecurityMarking( markings, markInFront, callback ) {
    let ackMarkings = localStorage.getItem( 'ackSecurityMarkings' );
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    let cc_uid = epPageContext ? epPageContext.collaborationContext.uid : appCtxService.getCtx( 'locationContext.modelObject.uid' );

    if ( ackMarkings ) {
        ackMarkings = JSON.parse( ackMarkings );
    }
    markInFront = markInFront.replace( /(\r\n|\n|\r)/gm, '' );
    if ( checkIfMarkingHasPreviouslyAcknowledged( ackMarkings, markInFront, cc_uid ) ) {
        return localeService
            .getTextPromise( 'mfeMessages' )
            .then( ( messages ) => {
                return mfgNotificationUtils
                    .displayConfirmationMessage(
                        markInFront,
                        messages.securityMarkingAcknowledgement
                    )
                    .then( () => {
                        saveAckSecurityMarking( markInFront );
                        return securityMarkingCallBackFunc( markings, callback );
                    } );
            } );
    }

    return securityMarkingCallBackFunc( markings, callback );
}

/**
 *
 * @param {*} ackMarkings
 * @param {*} markInFront
 * @param {*} cc_uid
 * @returns
 */
function checkIfMarkingHasPreviouslyAcknowledged( ackMarkings, markInFront, cc_uid ) {
    const markingWithoutSpace = markInFront.replace( /\s/g, '' );
    return !ackMarkings || !ackMarkings[ cc_uid ] || ackMarkings[ cc_uid ].indexOf( markingWithoutSpace ) <= -1;
}

/**
 * Posts user messages for security marking
 * @param {Array} markings markings to represent to user
 * @param {function} callback callback function returned by MFEVisWeb
  * @returns {Promise} promise
 */
export function securityMarkingCallBackFunc( markings, callback ) {
    registerSessionSignout();
    if ( _.size( markings ) ) {
        let markInFront = _.pullAt( markings, [ 0 ] );
        if ( Array.isArray( markInFront ) ) {
            return showUnAckSecurityMarking( markings, markInFront[0], callback );
        }
    }
    //MFEVisWeb: callback function which need to be called for loading the data
    if ( callback ) {
        return callback();
    }
}

/**
 * Registers security marking handler
 * @param {String} securityMarkingFunName name of securityMarking Function
 */
export function registerSecurityMarkingHandler( securityMarkingFunName ) {
    viewerSecurityMarkingService.registerSecurityMarkingHandlerFn(
        securityMarkingFunName,
        securityMarkingCallBackFunc
    );
}

export default {
    securityMarkingCallBackFunc,
    registerSecurityMarkingHandler
};

