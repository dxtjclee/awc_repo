// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';

import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import _ from 'lodash';


/**
 * The ngp page load service
 *
 * @module js/services/ngpLoadService
 */
'use strict';

/**
 *
 * @param {string} uid - a given uid
 * @return {promise} a promise object
 */
export function getConfiguredObject( uid ) {
    const modelObj = cdm.getObject( uid );
    if( modelObj && modelObj.uid && modelObj.type ) {
        return loadConfiguredObject( modelObj );
    }
    return loadObjects( [ uid ] ).then(
        ( response ) =>  loadConfiguredObject( response.modelObjects[ uid ] )
    );
}

/**
 *
 * @param {string[]} uids - array of uids
 * @param {Object} options - options for execute soa
 * @return {promise} the soa promise
 */
export function loadObjects( uids, options ) {
    return ngpSoaSvc.executeSoa( 'Core-2007-09-DataManagement', 'loadObjects', { uids }, options );
}

/**
 *
 * @param {modelObject[]} modelObjects - array of modelObjects
 * @return {promise} the soa promise
 */
export function refreshObjects( modelObjects ) {
    return ngpSoaSvc.executeSoa( 'Core-2007-01-DataManagement', 'refreshObjects', { objects: modelObjects } );
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {promise} the soa promise
 */
function loadConfiguredObject( modelObject ) {
    const soaInput = {
        inputs: [ {
            clientID: 'tc-mfg-web',
            object: modelObject
        } ]
    };
    return ngpSoaSvc.executeSoa( 'Internal-ManufacturingCore-2017-05-DataManagement', 'getConfiguredObjects', soaInput ).then(
        ( response ) => cdm.getObject( response.output[ 0 ].configuredObject.uid )
    );
}

/**
 * This method ensures that the properties are loaded and then loads the uid values of these properties.
 * The given properties must have "uid" values only
 *
 * @param {string[]} uids - array of uids
 * @param { string[] } propertiesWithUidValues - the properties to load
 * @return {promise} a promise object
 */
export function getPropertiesAndLoad( uids, propertiesWithUidValues ) {
    return dms.getProperties( uids, propertiesWithUidValues ).then(
        () => {
            let uidsToLoad = [];
            uids.forEach( ( uid ) => {
                let modelObj = cdm.getObject( uid );
                propertiesWithUidValues.forEach( ( prop ) => {
                    if( modelObj.props[ prop ] ) {
                        uidsToLoad = uidsToLoad.concat( modelObj.props[ prop ].dbValues );
                    }
                } );
            } );
            return ensureObjectsLoaded( uidsToLoad );
        }
    );
}

/**
 *
 * @param {string[]} uids - a given array of uids
 * @param {Object} options - loadObject options
 * @return {promise} a promise object
 */
export function ensureObjectsLoaded( uids, options ) {
    const validUids = uids.filter( ( uid ) => typeof uid === 'string' && uid !== '' )
        .filter( ( uid, index, array ) => array.indexOf( uid ) === index );
    const notLoaded = validUids.filter( ( uid ) => {
        const object = cdm.getObject( uid );
        return !object || !object.props || _.isEmpty( object.props );
    } );

    if( notLoaded.length > 0 ) {
        return loadObjects( notLoaded, options );
    }
    return new Promise( ( resolve ) => {
        resolve( null );
    } );
}


let exports;
export default exports = {
    getConfiguredObject,
    loadObjects,
    refreshObjects,
    ensureObjectsLoaded,
    getPropertiesAndLoad
};
