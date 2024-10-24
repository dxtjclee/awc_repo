// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


import cdm from 'soa/kernel/clientDataModel';
import localStorage from 'js/localStorage';

/**
 * Mfe Local Storage service
 *
 * @module js/mfeLocalStorageService
 */
'use strict';

/**
 *
 * @param {String} key on local storage
 * @return {String} value object
 */
function getTabKeyFromLocalStorage( key ) {
    return JSON.parse( localStorage.get( key ) );
}

/**
 *
 * @param {String} key on local storage
 * @param {String} tabKey - object to store
 */
function setTabKeyOnLocalStorage( key, tabKey ) {
    if ( key ) {
        localStorage.publish( key, JSON.stringify( tabKey ) );
    }
}

/**
 *
 * @param {String} key on local storage
 * @return {Object} value object
 */
function getObjectFromLocalStorage( key ) {
    let uid = JSON.parse( localStorage.get( key ) );
    if ( cdm.isValidObjectUid( uid ) ) {
        return cdm.getObject( uid );
    }
}

/**
 *
 * @param {String} key on local storage
 * @param {String} vmo - object to store
 */
function setObjectOnLocalStorage( key, vmo ) {
    if ( key && cdm.isValidObjectUid( vmo.uid ) ) {
        localStorage.publish( key, JSON.stringify( vmo.props.mci0pmiMetaData.dbValues[0] ) );
    }
}

/**
 *
 * @param {String} key on local storage to delete
 */
function removeFromLocalStorage( key ) {
    localStorage.removeItem( key );
}

/**
 *
 * @param {String} key on local storage to find
 * @returns { Boolean } value true or false
 */
function hasKeyOnLocalStorage( key ) {
    if ( key ) {
        return Boolean( localStorage.get( key ) );
    }
}

export default {
    getTabKeyFromLocalStorage,
    setTabKeyOnLocalStorage,
    getObjectFromLocalStorage,
    setObjectOnLocalStorage,
    removeFromLocalStorage,
    hasKeyOnLocalStorage
};

