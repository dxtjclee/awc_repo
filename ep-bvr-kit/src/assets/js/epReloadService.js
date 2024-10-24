// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/epReloadService
 */

import epLoadInputHelper from 'js/epLoadInputHelper';

const loadInputsMap = new Map();
let reloadIdCount = 0;
const nameToReloadId = {};


/**
 * Has reload inputs
 *
 * @returns {Boolean} are there reload inputs
 */
export function hasReloadInputs() {
    return loadInputsMap.size > 0;
}

/**
 * Get reload input JSON
 *
 * @returns {Object} ReloadInputJSON
 */
export function getReloadInputJSON() {
    let loadInputs = [];
    loadInputsMap.forEach( ( loadInp ) => {
        if( !Array.isArray( loadInp ) ) {
            loadInp = [ loadInp ];
        }
        loadInp.forEach( ( loadInputObj ) => {
            let loadInput = epLoadInputHelper.getLoadTypeInputs( loadInputObj.type, loadInputObj.uid, loadInputObj.propertiesToLoad, '', loadInputObj.additionalLoadParams );
            loadInputs.push( loadInput[ 0 ] );
        } );
    } );
    return epLoadInputHelper.getReloadInputJSON( loadInputs );
}

/**
 * Register reload input
 *
 * @param {String} name a unique name to register
 * @param {String} reloadType the reload type
 * @param {Object} object the object to reload
 * @param {StringArray} propertiesToLoad the name of the properties to reload
 * @param {StringArray} additionalLoadParams additional load params to reload
 */
export function registerReloadInput( name, reloadType ) {
    if( reloadType && typeof name === 'string' && !nameToReloadId[ name ] ) {
        const reloadTypes = Array.isArray( reloadType ) ? reloadType : [ reloadType ];
        register( name, reloadTypes );
    }
}

/**
 * Register
 *
 * @param {String} name a unique name to register
 * @param {String} reloadTypes the reload types
 * @param {StringArray} propertiesToLoad the name of the properties to reload
 * @param {StringArray} additionalLoadParams additional load params to reload
 */
function register( name, reloadTypes ) {
    let loadInpArray = [];
    reloadTypes.forEach( ( reloadType ) => {
        const objects = Array.isArray( reloadType.object ) ? reloadType.object : [ reloadType.object ];
        objects.forEach( ( object ) => {
            let uid = object && object.uid ? object.uid : object;
            if( uid !== 'null' ) {
                let loadInput = {
                    uid: uid,
                    type: reloadType.type ? reloadType.type : reloadType.reloadTypeName,
                    propertiesToLoad: reloadType.propertiesToLoad,
                    additionalLoadParams: reloadType.additionalLoadParams
                };
                loadInpArray.push( loadInput );
            }
        } );
    } );

    if( loadInpArray.length > 0 ) {
        let key = ++reloadIdCount;
        loadInputsMap.set( key, loadInpArray );
        nameToReloadId[ name ] = key;
    }
}

/**
 * Unregister reload input
 *
 * @param {String} name the name of the reload to unregister
 * @returns {Array} Array of reload input objects
 */
export function unregisterReloadInput( name ) {
    let reloadInput;
    if( typeof name === 'string' && nameToReloadId[ name ] ) {
        reloadInput = loadInputsMap.get( nameToReloadId[ name ] );
        unregister( nameToReloadId[ name ] );
        delete nameToReloadId[ name ];
    }
    return reloadInput;
}

/**
 * Unregister reload key
 *
 * @param {String} key the key to unregister
 */
function unregister( key ) {
    loadInputsMap.delete( key );
}

export default {
    hasReloadInputs,
    getReloadInputJSON,
    registerReloadInput,
    unregisterReloadInput
};
