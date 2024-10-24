// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for sync strategy converter methods
 *
 * @module js/services/ngpSyncStrategyConverterService
 */
'use strict';

/**
 *
 * @param {modelObjects[]} objects - a given set array of modelObjects
 * @returns {modelObject} the first index of the array if the array is of size one, otherwise null
 */
export function getSingleObject( objects ) {
    if( Array.isArray( objects ) && objects.length === 1 ) {
        return objects[0];
    }
    //framework doesn't allow to return null or undefined when using this method in the sync strategy converter
    //therefore we return an empty string
    return '';
}


export default {
    getSingleObject
};
