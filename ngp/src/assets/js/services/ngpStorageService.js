// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpStorageConstants from 'js/constants/ngpStorageConstants';
import ngpLoadSvc from 'js/services/ngpLoadService';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import dms from 'soa/dataManagementService';

const SPECIAL_SUFFIX = ':/ngp/';

/**
 * The ngp relation service
 *
 * @module js/services/ngpStorageService
 */
'use strict';

/**
 * Clears the storage upon signing out
 */
function clearStorageUponSignOut() {
    const topicsObj = getFromStorage( ngpStorageConstants.STORAGE_TOPICS_LIST, true );
    if( topicsObj && Array.isArray( topicsObj.topics ) ) {
        topicsObj.topics.forEach( ( topicName ) => {
            removeItemFromLocalStorage( topicName );
        } );
    }
    removeItemFromLocalStorage( ngpStorageConstants.STORAGE_TOPICS_LIST );
    removeItemFromLocalStorage( ngpStorageConstants.STORAGE );
}

/**
 *
 * @param {object} deleteEvent - the delete event object
 */
function removeDeletedItemsFromStorage( deleteEvent ) {
    if( deleteEvent && Array.isArray( deleteEvent.deletedObjectUids ) ) {
        const topicsObj = getFromStorage( ngpStorageConstants.STORAGE_TOPICS_LIST, true );
        if( topicsObj && Array.isArray( topicsObj.topics ) ) {
            const deletedUids = deleteEvent.deletedObjectUids;
            const deletedFoundationUids = deletedUids.map( ( uid ) => ngpDataUtils.getFoundationIdFromUid( uid ) );
            topicsObj.topics.forEach( ( topicName ) => {
                const currentValue = getFromStorage( topicName, true );
                if( currentValue ) {
                    const updatedUidsArray = currentValue.uids.filter( ( uid ) => !deletedUids.includes( uid ) && !deletedFoundationUids.includes( uid ) );
                    if( updatedUidsArray.length > 0 ) {
                        setItemInLocalStorage( topicName, updatedUidsArray, currentValue.props );
                    } else {
                        removeItemFromLocalStorage( topicName );
                        removeTopic( topicName );
                    }
                }
            } );
            publishStorageUpdateEvent();
        }
    }
}

/**
 *
 * @param {string[]} keys - array of local storage keys
 * @return {promise} a promise object
 */
function ensureCachedObjectsAreLoaded( keys ) {
    const promiseArray = [];
    const uidsAndPropsArray = [];
    const uidsToLoad = [];
    const options = {
        errorsToIgnore: [ {
            description: 'The given tag () does not exist in the database or is not a persistent object tag.',
            errorNum: 515024,
            printError: false
        },
        {
            description: 'One or more business objects could not be loaded.',
            errorNum: 214137,
            printError: false
        }
        ]
    };
    keys.forEach( ( key ) => {
        const value = getFromStorage( key, true );
        if( value ) {
            const { uids, props } = value;
            uidsToLoad.push( ...uids );
            if( Array.isArray( props ) && props.length > 0 ) {
                uidsAndPropsArray.push( { uids, props } );
            }
        }
    } );
    if( uidsToLoad.length > 0 ) {
        return ngpLoadSvc.ensureObjectsLoaded( uidsToLoad, options ).then(
            ()=> {
                uidsAndPropsArray.forEach( ( { uids, props } ) => promiseArray.push( dms.getProperties( uids, props ) ) );
                return Promise.all( promiseArray );
            }
        );
    }
    return new Promise( ( res )=> res( null ) );
}

/**
 *
 * @param {object} storageEvent - the storage event object
 */
function onStorageChange( storageEvent ) {
    let topicsObj = getFromStorage( ngpStorageConstants.STORAGE_TOPICS_LIST, true );
    if( topicsObj && topicsObj.topics && topicsObj.topics.length > 0 ) {
        const key = storageEvent.key.replace( SPECIAL_SUFFIX, '' );
        if( topicsObj.topics.indexOf( key ) > -1 ) {
            ensureCachedObjectsAreLoaded( [ key ] ).then( publishStorageUpdateEvent );
        }
    }
}

/**
 *
 * @param {string} storageKey - the key to use in the storage
 */
export function removeItemFromLocalStorage( storageKey ) {
    localStorage.removeItem( `${storageKey}${SPECIAL_SUFFIX}` );
}

/**
 *
 * @param {string} storageKey - the key to use in the storage
 * @param {string[]} uids - the array of uids to store
 * @param {string[]} props - array of props to be added
 */
function setItemInLocalStorage( storageKey, uids, props ) {
    const newValue = {
        uids,
        props
    };
    localStorage.setItem( `${storageKey}${SPECIAL_SUFFIX}`, JSON.stringify( newValue ) );
}

/**
 * Publishes a storage update event when some change in the local storage occurred.
 */
function publishStorageUpdateEvent() {
    eventBus.publish( 'ngp.storageUpdateEvent' );
}

/**
 *
 * @param {string} storageKey - the key which points to the saved value in the local storage
 * @param {boolean} parsed - true if you want the saved item parsed
 * @return {string} the value stored in the local storage
 *
 * consider to change the method to be "getModelObjects" which returns the modelObjects
 * from the localStorage value. We'll fix in the next cp
 */
export function getFromStorage( storageKey, parsed ) {
    const storageValue = localStorage.getItem( `${storageKey}${SPECIAL_SUFFIX}` );
    return parsed ? JSON.parse( storageValue ) : storageValue;
}

/**
 * Adds the given topic to the saved topic array in the local storage
 * @param {string} potentialNewTopic - potential new topic
 */
function updateTopicsArray( potentialNewTopic ) {
    let topicsObj = getFromStorage( ngpStorageConstants.STORAGE_TOPICS_LIST, true );
    if( !topicsObj || !topicsObj.topics ) {
        topicsObj = {
            topics: [ potentialNewTopic ]
        };
    } else if( topicsObj.topics.indexOf( potentialNewTopic ) === -1 ) {
        topicsObj.topics.push( potentialNewTopic );
    }
    localStorage.setItem( `${ngpStorageConstants.STORAGE_TOPICS_LIST}${SPECIAL_SUFFIX}`, JSON.stringify( topicsObj ) );
}

/**
 * Removes the given topic from the saved topic array in the local storage
 * @param {string} topicName - the topic to remove
 */
function removeTopic( topicName ) {
    const topicsObj = getFromStorage( ngpStorageConstants.STORAGE_TOPICS_LIST, true );
    const index = topicsObj.topics.indexOf( topicName );
    if( index > -1 ) {
        topicsObj.topics.splice( index, 1 );
        localStorage.setItem( `${ngpStorageConstants.STORAGE_TOPICS_LIST}${SPECIAL_SUFFIX}`, JSON.stringify( topicsObj ) );
    }
}

/**
 * Initialize the storage service
 */
export function init() {
    if( !window.ngpStorageEventSubscriptions ) {
        window.ngpStorageEventSubscriptions = true;
        eventBus.subscribe( 'session.signOut', clearStorageUponSignOut );
        eventBus.subscribe( 'cdm.deleted', removeDeletedItemsFromStorage );
        window.addEventListener( 'storage', onStorageChange );
    }
    const topicsObj = getFromStorage( ngpStorageConstants.STORAGE_TOPICS_LIST, true );
    if( topicsObj && topicsObj.topics && topicsObj.topics.length > 0 ) {
        ensureCachedObjectsAreLoaded( topicsObj.topics );
    }
}

/**
 *
 * @param {string} storageKey - the key to use in the storage
 * @param {string[]} uids - the array of uids to store
 * @param {string[]} props - array of props to be added
 */
export function saveUidsAndPropNamesInStorage( storageKey, uids, props = [] ) {
    updateTopicsArray( storageKey );
    setItemInLocalStorage( storageKey, uids, props );
    publishStorageUpdateEvent();
}

/**
 *
 * @param {string} storageKey - the key to use in the storage
 * @param {modelObject[]} modelObjects - a given array of modelObjects
 * @param {string[]} props - array of props to be added
 */
export function saveModelObjectsAndPropNamesInStorage( storageKey, modelObjects, props = [] ) {
    const uids = modelObjects.map( ( modelObj ) => modelObj.uid ).filter( ( uid ) => Boolean( uid ) );
    saveUidsAndPropNamesInStorage( storageKey, uids, props );
}

/**
 *
 * @param {string} storageKey - the key to use in the storage
 * @return {modelObject[]} the set of modelObjects whos uids are saved in the local storage under the given key
 */
export function getModelObjectsFromStorage( storageKey ) {
    let modelObjects = [];
    const value = getFromStorage( storageKey, true );
    if( value && value.uids ) {
        modelObjects = value.uids.map( ( uid ) => cdm.getObject( uid ) ).filter( ( modelObj ) => Boolean( modelObj ) );
    }
    return modelObjects;
}

export default {
    init,
    saveUidsAndPropNamesInStorage,
    saveModelObjectsAndPropNamesInStorage,
    getFromStorage,
    getModelObjectsFromStorage,
    removeItemFromLocalStorage
};
