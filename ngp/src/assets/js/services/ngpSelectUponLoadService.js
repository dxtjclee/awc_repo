// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * NGP Select Upon Load service
 *
 * @module js/services/ngpSelectUponLoadService
 */
'use strict';

/** session storage constant key */
const UIDS_TO_SELECT_UPON_LOAD_STORAGE_KEY = 'elementsToHighlightUponLoad';
const UIDS_ASSIGNED_TABLE_TO_SELECT_UPON_LOAD_STORAGE_KEY = 'elementsToHighlightInAssignmentsTableUponLoad';

/** separator constant */
const SEPARATOR = '&_SEPERATOR_&';

/**
 * Saves to the session storage the
 * @param {string[]} uids - an array of uids
 * @param {boolean} assignedTable - true if the value is saved for the Assignments Table. false - if for Build Strategy Table
 */
export function setUidsToSelectUponLoad( uids, assignedTable = false ) {
    if( Array.isArray( uids ) && uids.length > 0 ) {
        let value = '';
        uids.forEach( ( uid ) => {
            value = value.concat( uid ).concat( SEPARATOR );
        } );
        const keyStorage = assignedTable ? UIDS_ASSIGNED_TABLE_TO_SELECT_UPON_LOAD_STORAGE_KEY : UIDS_TO_SELECT_UPON_LOAD_STORAGE_KEY;
        sessionStorage.setItem( keyStorage, value );
    }
}

/**
 * @param {boolean} assignedTable - true if the value is saved for the Assignments Table. false - if for Build Strategy Table
 * @return {string[]} the uids to select upon load
 */
export function getUidsToSelectUponLoad( assignedTable = false ) {
    let uids = [];
    const keyStorage = assignedTable ? UIDS_ASSIGNED_TABLE_TO_SELECT_UPON_LOAD_STORAGE_KEY : UIDS_TO_SELECT_UPON_LOAD_STORAGE_KEY;
    const value = sessionStorage.getItem( keyStorage );
    if( value ) {
        uids = value.split( SEPARATOR );
        uids.pop();
    }
    sessionStorage.removeItem( keyStorage );
    return uids;
}

let exports = {};
export default exports = {
    setUidsToSelectUponLoad,
    getUidsToSelectUponLoad
};
