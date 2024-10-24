// Copyright (c) 2022 Siemens

/**
 * @module js/responsibleUserPanelService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import parsingUtils from 'js/parsingUtils';
import listBoxService from 'js/listBoxService';
import _ from 'lodash';

/**
 * Define public API
*/
var exports = {};

/**
  * Get the group or role content based on input values and created LOV entries and return.
  *
  * @param {String} contentType Object type for which properties needs to be populated
  * @param {data} data Viewmodel data
  * @param {int} startIndex Start index value
  * @param {Object} filter Filter string to filter
  * @returns {Object} The promise for the LOV search result
  */
var performLOVSearch = function( contentType, data, startIndex, filter ) {
    var deferred = AwPromiseService.instance.defer();

    var searchCriteria = { resourceProviderContentType: contentType };
    var filterContent;
    if ( contentType === 'Group' ) {
        filterContent = data.allRoles.uiValue;
        if ( filterContent ) {
            searchCriteria.role = filterContent;
        }
    } else if ( contentType === 'Role' ) {
        filterContent = data.allGroups.uiValue;
        if ( filterContent ) {
            searchCriteria.group = filterContent;
        }
    }
    // By default resource provider will be Awp0ResourceProvider
    var resourceProvider = 'Awp0ResourceProvider';

    if ( filter ) {
        searchCriteria.searchString = filter;
    }

    var inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        inflateProperties: false,
        saveColumnConfigData: {},
        searchInput: {
            maxToLoad: 100,
            maxToReturn: 50,
            providerName: resourceProvider,
            searchCriteria: searchCriteria,
            cursor: {
                startIndex: startIndex,
                endReached: false,
                startReached: false,
                endIndex: 0
            },
            searchSortCriteria: [],
            searchFilterFieldSortType: 'Alphabetical'
        }
    };

    // Execute soa call to search for LOV values
    soaService.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData ).then( function( response ) {
        var lovEntries = [];
        var modelObjects = [];
        let objectValue = {};

        if ( response.searchResultsJSON ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );

            if ( searchResults ) {
                for ( var i = 0; i < searchResults.objects.length; i++ ) {
                    var uid = searchResults.objects[i].uid;
                    var obj = response.ServiceData.modelObjects[uid];
                    modelObjects.push( obj );
                }
            }
            if ( modelObjects ) {
                // Create the list model object that will be displayed
                var groups = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
                Array.prototype.push.apply( lovEntries, groups );
            }
        }

        objectValue.pageList = lovEntries;
        objectValue.totalFound = lovEntries.length;
        objectValue.moreValuesExist = !response.cursor.endReached;

        deferred.resolve( objectValue );
    } );

    return deferred.promise;
};


/**
  * Validate selection for group or role LOV and if it is valid, use the selection to filter user data
  *
  * @param {String} contentType Object type for which properties needs to be populated
  * @param {data} data Viewmodel data
  * @param {Object} selected selected object if any, else null.
  * @param {String} suggestion Filter string value if filter string does not match any object.
  * @returns {Object} The object contains selection validity result.
  */
export let validateSelection = function( contentType, data, selected, suggestion ) {
    var valid = true;
    if ( suggestion || selected.length > 0 && selected[0].propInternalValue === '' ) {
        valid = false;
    } else {
        if ( contentType === 'Group' ) {
            data.additionalSearchCriteria.group = data.allGroups.uiValue;
        } else {
            data.additionalSearchCriteria.role = data.allRoles.uiValue;
        }
    }
    return {
        valid: valid
    };
};


/**
  * Perform the user search
  *
  * @param {data} data - The view model for the audit team panel
  * @param {Object} dataProvider - The data provider that will be used to get the correct content
  * @param {Object} deferred - The deferred object
  * @returns {Object} Promise for the SOA result
  */
export let performSearch = function( data, dataProvider ) {
    var deferred = AwPromiseService.instance.defer();

    if ( !dataProvider ) {
        return;
    }

    // Get the policy from data provider and register it
    var policy = dataProvider.action.policy;

    policySvc.register( policy );

    var resourceProviderContentType = 'Users';

    var searchString = data.filterBox.dbValue;
    var group;
    var role;

    // Create the search criteria to be used
    var searchCriteria = {
        parentUid: '',
        searchString: searchString,
        resourceProviderContentType: resourceProviderContentType,
        group: group,
        role: role,
        searchSubGroup: 'true',
        projectId: ''
    };

    // Check if additional search criteria exist on the scope then use that as well
    // so merge it with existing search criteria and then pass it to server
    var additionalSearchCriteria = data.additionalSearchCriteria;

    if ( additionalSearchCriteria ) {
        // Iterate for all entries in additional search criteria and add to main search criteria
        for ( var searchCriteriaKey in additionalSearchCriteria ) {
            if ( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                searchCriteria[searchCriteriaKey] = additionalSearchCriteria[searchCriteriaKey];
            }
        }
    }

    // By default resource provider will be Awp0ResourceProvider
    var resourceProvider = 'Awp0ResourceProvider';

    var inputData = {
        searchInput: {
            maxToLoad: 100,
            maxToReturn: 25,
            providerName: resourceProvider,
            searchCriteria: searchCriteria,
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap: {},
            searchSortCriteria: [],
            startIndex: dataProvider.startIndex
        }
    };

    // Call SOA service to retrieve the result of the user search
    soaService.post( 'Query-2014-11-Finder', 'performSearch', inputData ).then( function( response ) {
        if ( policy ) {
            policySvc.unregister( policy );
        }

        // Parse the SOA data to content the correct user or resource pool data
        var outputData = parseUserSearchResult( data, response );

        return deferred.resolve( outputData );
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
var parseUserSearchResult = function( data, response ) {
    var outputData = null;
    // Check if response is not null and it has some search results then iterate for each result to formulate the
    // correct response
    if ( response && response.searchResults ) {
        _.forEach( response.searchResults, function( result ) {
            // Get the model object for search result object UID present in response
            var resultObject = cdm.getObject( result.uid );

            if ( resultObject ) {
                var props = null;

                // Set cell properties for user object
                if ( resultObject.type ) {
                    props = getUserProps( resultObject );
                }
                if ( props ) {
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
    var userObject = null;
    var userName = null;
    var groupRoleName = null;

    // Check if user property is loaded for group member object then get the user
    // object first and then populate the user name for that
    if ( resultObject.props.user && resultObject.props.user.dbValues ) {
        userObject = cdm.getObject( resultObject.props.user.dbValues[0] );
        userName = resultObject.props.user.uiValues[0];

        if ( userObject && userObject.props.user_name && userObject.props.user_name.uiValues ) {
            userName = userObject.props.user_name.uiValues[0];
        }
    }

    // Check if group and role properties are not null and loaded then populate the group and role string to be shown on UI
    if ( resultObject.props.group && resultObject.props.group.uiValues && resultObject.props.role &&
         resultObject.props.role.uiValues ) {
        groupRoleName = resultObject.props.group.uiValues[0] + '/' + resultObject.props.role.uiValues[0];
    }

    if ( userName && groupRoleName ) {
        userCellProps.push( ' User Name \\:' + userName );
        userCellProps.push( ' Group Role Name \\:' + groupRoleName );
    }

    return userCellProps;
};

/**
  * prepare the input for set properties SOA call to add the responsible User
  *
  * @param {data} data - The qualified data of the viewModel
  * @param {ctx}  ctx - The data provider that will be used to get the correct content
  * @returns {String} Resource provider content type
  */
export let addResponsibleUser = function( data, ctx ) {
    var inputData = [];
    var selected = ctx.mselected;
    var tableVals = ctx.mselected[0].props.tq0ResponsibleUsers.dbValues;
    selected.forEach( function( selectedTask ) {
        var infoObj = {};

        infoObj.object = cdm.getObject( selectedTask.uid );
        infoObj.timestamp = '';

        var temp = {};
        temp.name = 'tq0ResponsibleUsers';
        data.dataProviders.userPerformSearch.selectedObjects.forEach( function( vals ) {
            if( tableVals.indexOf( vals.props.user.dbValue ) === -1 ) {
                tableVals.push( vals.props.user.dbValue );
            }
        } );
        temp.values = tableVals;

        var vecNameVal = [];
        vecNameVal.push( temp );

        infoObj.vecNameVal = vecNameVal;

        inputData.push( infoObj );
    } );

    return inputData;
};

export default exports = {
    performLOVSearch,
    validateSelection,
    performSearch,
    parseUserSearchResult,
    getUserProps,
    addResponsibleUser
};
