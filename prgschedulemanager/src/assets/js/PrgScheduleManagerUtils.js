// Copyright (c) 2022 Siemens

/**
 * @module js/PrgScheduleManagerUtils
 */
import _selectionService from 'js/selection.service';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import parsingUtils from 'js/parsingUtils';
import eventBus from 'js/eventBus';
import listBoxService from 'js/listBoxService';

var exports = {};
var getInitialLOVValueDeferred;

/**
 * Method for getting the selected object.
 *
 * @return {Object} _selectionService.getSelection().selected - The selected object
 */
export let getSelectedObjects = function() {
    return _selectionService.getSelection().selected;
};

/**
 * This operation is invoked to query the data for a property having an LOV attachment. The results returned
 * from the server also take into consideration any filter string that is in the input. This method calls
 * 'getInitialLOVValues' and returns initial set of lov values.
 *
 * @param {filterString} filterString - The filter text for lov's
 * @param {deferred} deferred - $q object to resolve the 'promise' with a an array of LOVEntry objects.
 * @param {ViewModelProperty} prop - Property to aceess LOV values for.
 * @param {Object} prop Property object
 * @param {String} filterContent Filter content string
 * @param {String} defaultString To be populate on group or role LOV
 * @param {String} filterStr Filter string
 */
var getInitialLOVValues = function( data, deferred, prop, filterContent, defaultString, filterStr ) {
    if( !getInitialLOVValueDeferred ) {
        getInitialLOVValueDeferred = deferred;

        var lovValues = [];
        exports.performRoleSearchByGroup( prop, 0, filterContent, filterStr ).then( function( validObjects ) {
            if( validObjects ) {
                lovValues = listBoxService.createListModelObjectsFromStrings( [ defaultString ] );
                // Create the list model object that will be displayed
                Array.prototype.push.apply( lovValues, validObjects );
            }
            deferred.resolve( lovValues );
            getInitialLOVValueDeferred = null;
        }, function( reason ) {
            deferred.reject( reason );
            getInitialLOVValueDeferred = null;
        } );
    }
};

/**
 * Generate the next LOV values when user is doing pagination in LOV.
 * @param {deferred} deferred - $q object to resolve the 'promise' with a an array of LOVEntry objects.
 * @param {Object} prop Property object
 * @param {String} filterContent Filter content string
 */
var getNextLOVValues = function( deferred, prop, filterContent ) {
    var lovEntries = [];

    // Check if more values exist then only call SOA.
    if( prop.moreValuesExist ) {
        var startIdx = prop.endIndex;
        exports.performRoleSearchByGroup( prop, startIdx, filterContent, null ).then( function( validObjects ) {
            lovEntries = validObjects;
            deferred.resolve( lovEntries );
        } );
    } else {
        deferred.resolve( lovEntries );
    }
    return deferred.promise;
};

/**
 * Populate the role LOV values.
 *
 * @param {Object} data Data view model object
 * @param {Object} prop Property object
 */
export let populateRoleLOV = function( data, prop ) {
    var parentData = data;
    prop.contentType = 'Role';
    prop.lovApi = {};

    // Check if searchSubGroup present on data that means we need
    // to search role inside sub group
    if( data.searchSubGroup ) {
        prop.searchSubGroup = true;
    }

    // This is needed to remove the first empty entry fromn LOV values
    prop.emptyLOVEntry = false;
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        getInitialLOVValues( data, deferred, prop, data.groupName, data.i18n.allRoles, filterStr );
    };

    prop.lovApi.getNextValues = function( deferred ) {
        getNextLOVValues( deferred, prop, data.groupName, null );
    };

    prop.lovApi.validateLOVValueSelections = function( lovEntries ) {
        parentData.roleName = null;
        if( lovEntries[ 0 ].propInternalValue.uid ) {
            parentData.roleName = lovEntries[ 0 ].propInternalValue.props.role_name.dbValues[ 0 ];
        } else if( lovEntries[ 0 ].propInternalValue !== data.i18n.allRoles ) {
            // This is needed when user entered some wrong value which is not present
            // then set to default all roles
            prop.dbValue = data.i18n.allRoles;
            prop.uiValue = data.i18n.allRoles;
        }
        parentData.additionalSearchCriteria.role = parentData.roleName;
        eventBus.publish( 'awPopupWidget.close' );
    };
};

/**
 * Get the group or role content based on input values and created LOV entries and return.
 *
 * @param {Object} prop Property obejct whose properties needs to be populated
 * @param {int} startIndex Start index value
 * @param {Object} filterContent Filter content object that can be filter group or role
 * @param {Object} filterStr Filter string to filter group or role. This is when user is tryong on LOV
 */
export let performRoleSearchByGroup = function( prop, startIndex, filterContent, filterStr ) {
    var deferred = AwPromiseService.instance.defer();
    var contentType = prop.contentType;
    var searchCriteria = {
        resourceProviderContentType: contentType
    };

    if( contentType === 'Group' && filterContent ) {
        searchCriteria.role = filterContent;
    } else if( contentType === 'Role' && filterContent ) {
        searchCriteria.group = filterContent;
    }

    if( filterStr ) {
        searchCriteria.searchString = filterStr;
    }

    // Check if sub group need to be search. Pass that value to server
    if( prop.searchSubGroup ) {
        searchCriteria.searchSubGroup = 'true';
    }

    // By default resource provider will be Awp0ResourceProvider
    var resourceProvider = 'Awp0ResourceProvider';

    var inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        inflateProperties: false,
        saveColumnConfigData: {},
        searchInput: {
            maxToLoad: 50,
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

    // SOA call made to get the content
    soaService.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData ).then( function( response ) {
        var lovEntries = [];
        var modelObjects = [];

        if( response.searchResultsJSON ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            if( searchResults ) {
                for( var i = 0; i < searchResults.objects.length; i++ ) {
                    var uid = searchResults.objects[ i ].uid;
                    var obj = response.ServiceData.modelObjects[ uid ];
                    modelObjects.push( obj );
                }
            }
            if( modelObjects ) {
                // Create the list model object that will be displayed
                var groups = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
                Array.prototype.push.apply( lovEntries, groups );
            }
        }

        // Populate the end index and more values present or not
        var endIndex = response.cursor.endIndex;
        var moreValuesExist = !response.cursor.endReached;
        if( endIndex > 0 && moreValuesExist ) {
            endIndex += 1;
        }
        prop.endIndex = endIndex;
        prop.moreValuesExist = moreValuesExist;
        deferred.resolve( lovEntries );
    } );

    return deferred.promise;
};

/**
 * Populate the group LOV values.
 *
 * @param {Object} data Data view model object
 * @param {Object} prop Property object
 */
export let populateGroupLOV = function( data, prop ) {
    var parentData = data;
    prop.lovApi = {};

    prop.contentType = 'Group';

    // This is needed to remove the first empty entry fromn LOV values
    prop.emptyLOVEntry = false;
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        getInitialLOVValues( data, deferred, prop, data.roleName, data.i18n.allGroups, filterStr );
    };

    prop.lovApi.getNextValues = function( deferred ) {
        getNextLOVValues( deferred, prop, data.roleName, null );
    };

    prop.lovApi.validateLOVValueSelections = function( lovEntries ) {
        parentData.groupName = null;
        if( lovEntries[ 0 ].propInternalValue.uid ) {
            parentData.groupName = lovEntries[ 0 ].propInternalValue.props.object_full_name.dbValues[ 0 ];
        } else if( lovEntries[ 0 ].propInternalValue !== data.i18n.allGroups ) {
            // This is needed when user entered some wrong value which is not present
            // then set to default all groups
            prop.dbValue = data.i18n.allGroups;
            prop.uiValue = data.i18n.allGroups;
        }
        parentData.additionalSearchCriteria.group = parentData.groupName;
        eventBus.publish( 'awPopupWidget.close' );
    };
};

export default exports = {
    getSelectedObjects,
    populateRoleLOV,
    populateGroupLOV,
    performRoleSearchByGroup

};
