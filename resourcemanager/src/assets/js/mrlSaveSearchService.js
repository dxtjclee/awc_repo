// Copyright (c) 2022 Siemens

/**
 * @module js/mrlSaveSearchService
 */
import AwStateService from 'js/awStateService';
import saveSearchUtils from 'js/Awp0SaveSearchUtils';
import searchFilterSvc from 'js/aw.searchFilter.service';

var exports = {};
var SEARCH_NAME_TOKEN = 'manageResources';

/**
 * mrlExecuteFullTextSavedSearch
 * @function mrlExecuteFullTextSavedSearch
 * @param {Object}vmo - the view model object
 */
export let mrlExecuteFullTextSavedSearch = function( vmo ) {
    var criteria = vmo.props.awp0search_string.dbValue;
    let filterMap = saveSearchUtils.getFilterMap( vmo );
    const categoryToChartOn = vmo.props.awp0ChartOn.dbValues[ 0 ];

    AwStateService.instance.go( SEARCH_NAME_TOKEN, {
        filter: searchFilterSvc.buildFilterString( filterMap ),
        searchCriteria: criteria,
        secondaryCriteria: '*',
        chartBy: categoryToChartOn,
        savedSearchUid: vmo.uid
    } );
};

export let mrlExecuteImportVendorFullTextSavedSearch = function( importVendorDataModelObjects, importVendorDataSavedSearch ) {
    var savedSearchObject;

    for ( var key in importVendorDataModelObjects ) {
        var object = importVendorDataModelObjects[key];
        if ( object.type === 'Awp0FullTextSavedSearch' && object.uid === importVendorDataSavedSearch.uid ) {
            savedSearchObject = object;
        }
    }

    if ( savedSearchObject ) {
        var criteria = savedSearchObject.props.awp0search_string.dbValues[0];
        let filterMap = saveSearchUtils.getFilterMap( savedSearchObject );
        const categoryToChartOn = savedSearchObject.props.awp0ChartOn.dbValues[0];

        AwStateService.instance.go( SEARCH_NAME_TOKEN, {
            filter: searchFilterSvc.buildFilterString( filterMap ),
            searchCriteria: criteria,
            secondaryCriteria: '*',
            chartBy: categoryToChartOn,
            savedSearchUid: savedSearchObject.uid
        } );
    }
};

export default exports = {
    mrlExecuteFullTextSavedSearch,
    mrlExecuteImportVendorFullTextSavedSearch
};
