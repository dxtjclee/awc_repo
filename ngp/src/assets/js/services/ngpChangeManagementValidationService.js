// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpLoadSvc from 'js/services/ngpLoadService';
import mfgNotyUtils from 'js/mfgNotificationUtils';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import msgSvc from 'js/messagingService';
import preferenceSvc from 'soa/preferenceService';
import localeSvc from 'js/localeService';

const localizedMsgs = localeSvc.getLoadedText( 'NgpChangeMgmtMessages' );


/**
 * button used in message info
 */
const closeBtn = mfgNotyUtils.createButton( localizedMsgs.close, ( noty ) => noty.close() );

/**
 * The ngp change management validation service
 *
 * @module js/services/ngpChangeManagementValidationService
 */
'use strict';

const mcnValidStateValues = {
    [ngpPropConstants.CM_MATURITY]: 'Executing',
    [ngpPropConstants.CM_DISPOSITION]: 'Approved',
    [ngpPropConstants.CM_CLOSURE]: 'Open'
};

/**
 *
 * @param {modelObject} modelObject - the parent object that we want to create object in
 * @returns {Promise<boolean>} - a promise resolved to true or false
 */
  export function validateUserCanCreateObjects( modelObject ) {
      return validateUserCanPerformChange( [ modelObject ], true );
  }

/**
 *
 * @param {modelObjects[]} modelObjects - the objects we want to author
 * @param {Boolean} isCreate - true when called for creating objects
 * @returns {Promise<boolean>} - a promise resolved to true or false
 */
  export function validateUserCanPerformChange( modelObjects, isCreate ) {
    const promiseArray = [ ];
    if( !ngpTypeUtils.isNGPObject( modelObjects[0] ) ) {
        return new Promise( ( resolve ) => resolve( true ) );
    }
    modelObjects.forEach( ( modelObject ) => {
        if( isCreate && !ngpTypeUtils.isBuildElement( modelObject ) || ngpTypeUtils.isPlanElement( modelObject ) ) {
            const promise = isObjectTrackedUnderValidMcnForAuthoringOrAllowedAuthoringWithoutMcn( modelObject );
            promiseArray.push( promise );
        }
    } );

    if( promiseArray.length > 0 ) {
        return Promise.all( promiseArray ).then(
            ( isValidStates ) => {
                let msg = null;
                const retValue = isValidStates.every( state => {
                    if ( !state.valid ) {
                        msg = state.warningMsg;
                    }
                    return state.valid;
                } );
                if( msg ) {
                    msgSvc.showWarning( msg, [ closeBtn ] );
                }
                return retValue;
            }
        );
    }

     return new Promise( ( resolve ) => resolve( true ) );
}

/**
  *
 * @param {modelObject} modelObject - the object we want to author
 * @returns {Promise<boolean>} - a promise resolved to true or false
 */
function isObjectTrackedUnderValidMcnForAuthoringOrAllowedAuthoringWithoutMcn( modelObject ) {
    return getActiveMcnOfObject( modelObject ).then(
        ( mcnObj ) => {
            if ( !mcnObj ) {
                return authoringAllowedWithoutMcn();
            }
            return mcnValidForAuthoring( mcnObj );
        }
    );
}

/**
 *
 * @param {modelObject} mcnObj - the mcn object
 * @returns {Promise<boolean>} - a promise resolved to true or false
 */
function mcnValidForAuthoring( mcnObj ) {
    const promiseArray = [ getMcnAnalystUserObj( mcnObj ), isMcnInValidState( mcnObj ) ];
    return Promise.all( promiseArray ).then(
        ( [ analystUser, isValidState ] ) => {
            const _localizedMsgs = localeSvc.getLoadedText( 'NgpChangeMgmtMessages' );

            let warningMsg;
            let valid = false;
            if ( analystUser && isAnalystCurrentUser( analystUser ) ) {
                if ( isValidState ) {
                    return {
                        valid: true,
                        warningMsg
                    };
                }
                warningMsg = _localizedMsgs.mcnInInvalidStateForAuthoring.format( mcnObj.props[ngpPropConstants.OBJECT_STRING].dbValues[0] );
            } else {
                warningMsg = _localizedMsgs.userCannotAuthorUnderMcn;
            }
            return {
                valid,
                warningMsg
            };
        }
    );
}

/**
 *
 * @returns {Promise<boolean>} - a promise resolved to a boolean
 */
function authoringAllowedWithoutMcn() {
    return preferenceSvc.getStringValue( 'NGPDisableAuthoringWithoutMCN' ).then(
        ( prefValue ) => {
            const allowed = prefValue && prefValue.toLowerCase() === 'false';
            return {
                valid: allowed,
                warningMsg: allowed ? null : localizedMsgs.mustCreateMcnBeforeAuthoring
            };
        }
    );
}

/**
 *
 * @param {modelObject} mcnObj - the mcn object
 * @returns {Promise<boolean>} - true if
 */
function isMcnInValidState( mcnObj ) {
    return dms.getProperties( [ mcnObj.uid ], [ ngpPropConstants.CM_MATURITY, ngpPropConstants.CM_DISPOSITION, ngpPropConstants.CM_CLOSURE ] )
        .then(
            () => Object.keys( mcnValidStateValues ).every( ( key ) => mcnValidStateValues[key] === mcnObj.props[key].dbValues[0] )
        );
}
/**
 *
 * @param {modelObject} analystUser - the analyst user modelObject
 * @returns {boolean} true if the given analyst user is the current user
 */
function isAnalystCurrentUser( analystUser ) {
    const user = appCtxSvc.getCtx( 'user' );
    return analystUser.uid === user.uid;
}

/**
 *
 * @param {modelObject} mcnObj - the mcn modelObject
 * @returns {Promise<modelObject>} - the analyst user object
 */
function getMcnAnalystUserObj( mcnObj ) {
    return dms.getProperties( [ mcnObj.uid ], [ ngpPropConstants.CM_ANALYST ] )
        .then( () => mcnObj.props[ngpPropConstants.CM_ANALYST].dbValues[0] )
        .then( ( analystUid ) => dms.getProperties( [ analystUid ], [ ngpPropConstants.USER ] ).then( () => analystUid ) )
        .then( ( analystUid ) => {
            const analystObj = cdm.getObject( analystUid );
            if( analystObj ) {
                const analystUserUid = analystObj.props[ngpPropConstants.USER].dbValues[0];
                return cdm.getObject( analystUserUid );
            }
        }
        );
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @returns {string} the active mcn object
 */
function getActiveMcnOfObject( modelObject ) {
    let obj = modelObject;
    if ( ngpTypeUtils.isOperation( obj ) ) {
        const parentProcessUid = obj.props[ngpPropConstants.PARENT_OF_OPERATION].dbValues[0];
        obj = cdm.getObject( parentProcessUid );
    }
    if ( ngpTypeUtils.isProcessElement( obj ) ) {
        const parentActivityUid = obj.props[ngpPropConstants.PARENT_OF_PROCESS_OR_ME].dbValues[0];
        obj = cdm.getObject( parentActivityUid );
    }

    const mcnUid = obj.props[ngpPropConstants.ACTIVE_MCN].dbValues[0];
    if ( mcnUid ) {
        return ngpLoadSvc.ensureObjectsLoaded( [ mcnUid ] ).then( () => cdm.getObject( mcnUid ) );
    }
    return new Promise( ( resolve ) => resolve( null ) );
}

let exports;
export default exports = {
    validateUserCanPerformChange,
    validateUserCanCreateObjects
};
