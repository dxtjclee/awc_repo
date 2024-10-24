// Copyright (c) 2022 Siemens

/**
 * @module js/AMBreakdownNavigationService
 */
import cdm from 'soa/kernel/clientDataModel';
import objNavSvc from 'js/objectNavigationService';

let exports = {};

export let sortResults = function( parentUid, searchResults ) {
    return objNavSvc.sortResults( parentUid, searchResults );
};

export let loadData = function( searchInput, columnConfigInput, saveColumnConfigData ) {
    if( cdm.getObject( searchInput.searchCriteria.parentUid ).type === 'Clr0ProductAppBreakdown' ) {
        searchInput.searchCriteria.objectSet = 'clr0ChildAppAreaBreakdown.Clr0AppearanceAreaBreakdown';
    } else if( cdm.getObject( searchInput.searchCriteria.parentUid ).type === 'Clr0AppearanceAreaBreakdown' ) {
        searchInput.searchCriteria.objectSet = 'clr0Children.WorkspaceObject';
    } else if( cdm.getObject( searchInput.searchCriteria.parentUid ).type === 'Clr0AppearanceArea' ) {
        searchInput.searchCriteria.objectSet = 'clr0ChildAppDesignators.Clr0AppearanceDesignator';
    }
    return objNavSvc.loadData( searchInput, columnConfigInput, saveColumnConfigData );
};

/**
 * Get the default page size used for max to load/return.
 *
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    return objNavSvc.getDefaultPageSize( defaultPageSizePreference );
};

/**
 * Sort Criteria is updated
 *
 * @param {Object} dataprovider - the data provider
 */
export let sortCriteriaUpdated = function( data ) {
    return objNavSvc.sortCriteriaUpdated( data );
};

export default exports = {
    sortResults,
    loadData,
    getDefaultPageSize,
    sortCriteriaUpdated
};
