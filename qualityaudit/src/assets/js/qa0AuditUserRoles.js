// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/qa0AuditUserRoles
 */
import app from 'app';
import AwPromiseService from 'js/awPromiseService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};

/**
  * Perform the user search
  *
  * @param {data} data - The view model for the audit team panel
  * @param {Object} ctx - The context object
  * @returns {Object} Promise for the SOA result
  */
export let performQPUserSearch = function( data, ctx ) {
    var deferred = AwPromiseService.instance.defer();

    if( !data.dataProviders.performUserSearch ) {
        return;
    }
    var normProp = ctx.xrtSummaryContextObject.props.qa0AuditNorms.dbValues[0];

    // Get the policy from data provider and register it
    var policy = data.dataProviders.performUserSearch.action.policy;

    policySvc.register( policy );

    var filterText = data.searchBox.dbValue;

    // Create the search criteria to be used
    var searchCriteria = {
        filterText: filterText,
        industryStandard: normProp
    };

    // Check if additional search criteria exist on the scope then use that as well
    // so merge it with existing search criteria and then pass it to server
    var additionalSearchCriteria = data.additionalSearchCriteria;

    if( additionalSearchCriteria ) {
        // Iterate for all entries in additional search criteria and add to main search criteria
        for( var searchCriteriaKey in additionalSearchCriteria ) {
            if( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                searchCriteria[ searchCriteriaKey ] = additionalSearchCriteria[ searchCriteriaKey ];
            }
        }
    }

    // By default resource provider will be Qa0QPUserProvider
    var resourceProvider = 'Qa0QPUserProvider';

    var inputData = {
        searchInput: {
            maxToLoad: 100,
            maxToReturn: 25,
            providerName: resourceProvider,
            searchCriteria: searchCriteria,
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap: {},
            searchSortCriteria: [],
            startIndex: data.dataProviders.performUserSearch.startIndex
        }
    };

    // Call SOA service to retrieve the result of the user search
    soaService.post( 'Query-2014-11-Finder', 'performSearch', inputData ).then( function( response ) {
        if( policy ) {
            policySvc.unregister( policy );
        }

        // Parse the SOA data to content the correct user or resource pool data
        var outputData = parseUserSearchResult( response );

        deferred.resolve( outputData );
    }, function( reason ) {
        if( policy ) {
            policySvc.unregister( policy );
        }
        deferred.reject( reason );
    } );

    return deferred.promise;
};

/**
  * Parse user search result
  *
  * @param {data} data - The qualified data of the viewModel
  * @param {Object} response - The response of performSearch SOA call
  * @return {Object} - outputData object that holds the correct values .
  */
var parseUserSearchResult = function( response ) {
    var outputData = null;
    // Check if response is not null and it has some search results then iterate for each result to formulate the
    // correct response
    if( response && response.searchResults ) {
        _.forEach( response.searchResults, function( result ) {
            // Get the model object for search result object UID present in response
            var resultObject = cdm.getObject( result.uid );

            if( resultObject ) {
                var props = null;

                // Set cell properties for user object
                if( resultObject.type ) {
                    props = getUserProps( resultObject );
                }
                if( props ) {
                    resultObject.props.awp0CellProperties.dbValues = props;
                    resultObject.props.awp0CellProperties.uiValues = props;
                }
            }
        } );
    }

    // Construct the output data that will contain the results
    outputData = {
        searchResults: response.searchResults,
        totalFound: response.totalFound,
        totalLoaded: response.totalLoaded
    };

    return outputData;
};

/**
  * Get the user properties to be shown in UI
  *
  * @param {Object} resultObject - The model object for property needs to be populated
  * @return {Array} Property array that will be visible on UI
  */
var getUserProps = function( resultObject ) {
    var userCellProps = [];
    var userName = null;
    userName = resultObject.props.user_name.uiValues[ 0 ];
    if( userName ) {
        userCellProps.push( ' User Name \\:' + userName );
    }
    return userCellProps;
};

 
/**
  * This factory creates a service and returns exports
  *
  * @member qa0AuditUserRoles
  */
export default exports = {
    performQPUserSearch
};
app.factory( 'qa0AuditUserRoles', () => exports );

