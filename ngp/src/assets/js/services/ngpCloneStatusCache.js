// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * NGP Favorites service
 *
 * @module js/services/ngpCloneStatusCache
 */
'use strict';

/**
 * Possible Statuses
 * MASTER, MASTER_AND_CLONE, MASTER_AND_CLONE_MASTER_DELETED, MASTER_AND_CLONE_OUT_OF_DATE
 * CLONE, CLONE_MASTER_DELETED, CLONE_OUT_OF_DATE
 * NO_STATUS
 */

let uidToCloneStatusObject = {};
const cloneStatusConstants = {
    MASTER: 'MASTER',
    MASTER_AND_CLONE: 'MASTER_AND_CLONE',
    MASTER_AND_CLONE_MASTER_DELETED: 'MASTER_AND_CLONE_MASTER_DELETED',
    MASTER_AND_CLONE_OUT_OF_DATE: 'MASTER_AND_CLONE_OUT_OF_DATE',
    CLONE: 'CLONE',
    CLONE_MASTER_DELETED: 'CLONE_MASTER_DELETED',
    CLONE_OUT_OF_DATE: 'CLONE_OUT_OF_DATE',
    NO_STATUS: 'NO_STATUS'
};

/**
 *
 * @param {object} uidToCloneStatusObj -  a map object of key "uid" and value which is an object with all of the needed information
 */
export function updateCache( uidToCloneStatusObj ) {
    uidToCloneStatusObject = Object.assign( uidToCloneStatusObject, uidToCloneStatusObj );
}

/**
 *
 * @param {string} uid - a given uid
 * @return {object} the clone status object
 */
export function getCloneStatusObject( uid ) {
    return uidToCloneStatusObject[ uid ];
}

/**
 *
 * @param {string} uid a given uid
 * @return {string} the status string, undefined if not cached
 */
export function getStatus( uid ) {
    const cloneStatusObj = uidToCloneStatusObject[ uid ];
    if( cloneStatusObj ) {
        return cloneStatusObj.status;
    }
}

/**
 *
 * @param {string} uid - a given uid
 * @return {modelObject} the configured master object
 */
export function getConfiguredMaster( uid ) {
    const statusObj = uidToCloneStatusObject[ uid ];
    if( statusObj ) {
        return statusObj.masterInfo.configuredMaster;
    }
}

/**
 * Turns the
 *
 * @param {object} cloneStatusObject - the clone status object
 */
function changeToNoStatus( cloneStatusObject ) {
    cloneStatusObject.status = cloneStatusConstants.NO_STATUS;
    cloneStatusObject.masterInfo = null;
    cloneStatusObject.clonesInfo = [];
}

/**
 *
 * @param {modelObject} clone - the clone modelObject
 */
function updateMasterAfterUnlink( clone ) {
    const configuredMaster = getConfiguredMaster( clone.uid );
    const masterStatusObj = getCloneStatusObject( configuredMaster.uid );
    if( masterStatusObj ) {
        masterStatusObj.clonesInfo = masterStatusObj.clonesInfo.filter( ( cloneInfo ) =>
            cloneInfo.clone.uid !== clone.uid
        );
        if( masterStatusObj.clonesInfo.length === 0 ) {
            switch ( masterStatusObj.status ) {
                case cloneStatusConstants.MASTER:
                    changeToNoStatus( masterStatusObj );
                    break;
                case cloneStatusConstants.MASTER_AND_CLONE:
                case cloneStatusConstants.MASTER_AND_CLONE_OUT_OF_DATE:
                case cloneStatusConstants.MASTER_AND_CLONE_MASTER_DELETED:
                    masterStatusObj.status = masterStatusObj.status.replace( 'MASTER_AND_', '' );
                    break;
            }
        }
    }
}

/**
 *
 * @param {modelObject[]} unlinkedClones - an array of clones that were unlinked
 */
export function updateStatusesAfterUnlink( unlinkedClones ) {
    unlinkedClones.forEach( ( clone ) => {
        const cloneStatusObject = uidToCloneStatusObject[ clone.uid ];
        if( cloneStatusObject ) {
            switch ( cloneStatusObject.status ) {
                case cloneStatusConstants.CLONE_MASTER_DELETED:
                    changeToNoStatus( cloneStatusObject );
                    break;
                case cloneStatusConstants.CLONE:
                case cloneStatusConstants.CLONE_OUT_OF_DATE:
                    updateMasterAfterUnlink( clone );
                    changeToNoStatus( cloneStatusObject );
                    break;
                case cloneStatusConstants.MASTER_AND_CLONE:
                case cloneStatusConstants.MASTER_AND_CLONE_OUT_OF_DATE:
                    updateMasterAfterUnlink( clone );
                    cloneStatusObject.status = cloneStatusConstants.MASTER;
                    break;
                case cloneStatusConstants.MASTER_AND_CLONE_MASTER_DELETED:
                    cloneStatusObject.status = cloneStatusConstants.MASTER;
                    break;
            }
        }
    } );
}

/**
 *
 * @param {modelObject} masterModelObj - a given master modelObject
 * @return {object[]} an array of cloneInfo objects
 */
function getClonesOfMaster( masterModelObj ) {
    const masterStatusObj = getCloneStatusObject( masterModelObj.uid );
    return masterStatusObj.clonesInfo;
}

/**
 *
 * @param {string[]} uids - array of uids to remove from the cache
 */
function removeFromCache( uids ) {
    uids.forEach( ( uid ) => delete uidToCloneStatusObject[ uid ] );
}

/**
 *
 * @param {string} uid - a given uid
 * @return {boolean} true if the given object is a master
 */
export function isMaster( uid ) {
    const status = getStatus( uid );
    return status === cloneStatusConstants.MASTER || status === cloneStatusConstants.MASTER_AND_CLONE
            || status === cloneStatusConstants.MASTER_AND_CLONE_MASTER_DELETED || status === cloneStatusConstants.MASTER_AND_CLONE_OUT_OF_DATE;
}

/**
 *
 * @param {string} uid - a given uid
 * @return {boolean} true if the given object is a clone
 */
export function isClone( uid ) {
    const status = getStatus( uid );
    return status && status !== cloneStatusConstants.MASTER && status !== cloneStatusConstants.NO_STATUS;
}

let exports;
export default exports = {
    updateCache,
    getCloneStatusObject,
    getStatus,
    getConfiguredMaster,
    updateStatusesAfterUnlink,
    getClonesOfMaster,
    cloneStatusConstants,
    removeFromCache,
    isMaster,
    isClone
};
