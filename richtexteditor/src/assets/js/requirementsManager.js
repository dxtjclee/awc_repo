/* eslint-disable require-jsdoc */
//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * @module js/requirementsManager
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import tcVmoService from 'js/tcViewModelObjectService';

var chartData = [];
var chartMap = {};
var loadedVMObjects = [];
var HIDE_CSS = 'aw-viewerjs-hideContent';

/**
 * Set subType in listbox
 *
 * @function getSearchId
 * @param {Object} data - The panel's view model object
 * @return {Object} - updated data elements
 */
export let setSubType = function( data ) {
    loadedVMObjects = [];
    data.filterChips = [];
    data.filterBox.dbValue = '';
    return {
        lastEndIndex: '',
        totalFound: '',
        filterBox: data.filterBox
    };
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Initialize strings for chartMap
 *
 * @param {Object} data - The view model data
 */
var _initializeChartMap = function( data ) {
    chartMap.assigned = data.i18n.assigned;
    chartMap.unassigned = data.i18n.notAssigned;
    chartMap.open = data.i18n.open;
    chartMap.replied = data.i18n.replied;
    chartMap.resolved = data.i18n.resolved;
    chartMap.reopened = data.i18n.reopened;
};


/**
 * Get all object types from preference
 *
 * @param {Object} data - The view model data
 * @return {Object} objectTypeList - object types list
 */
export let updateObjectTypeList = function( data ) {
    _initializeChartMap( data );
    var pref = appCtxSvc.getCtx( 'preferences' );
    var searchTypes = pref.REQ_DashboardSearchTypes;
    var objectTypeList = {
        type: 'STRING',
        dbValue: []
    };
    var listModel = {};

    if ( searchTypes && searchTypes.length > 0 ) {
        for ( var j = 0; j < searchTypes.length; j++ ) {
            listModel = _getEmptyListModel();
            listModel.propDisplayValue = searchTypes[j];
            listModel.propInternalValue = searchTypes[j];
            objectTypeList.dbValue.push( listModel );
        }
        listModel = _getEmptyListModel();
        listModel.propDisplayValue = data.i18n.all;
        listModel.propInternalValue = data.i18n.all;
        objectTypeList.dbValue.push( listModel );
    }
    return objectTypeList;
};


/**
 * Get all subtypes
 *
 * @return {Object} objectTypes - object types string
 */
var _getAllSubTypes = function() {
    var pref = appCtxSvc.getCtx( 'preferences' );
    var searchTypes = pref.REQ_DashboardSearchTypes;
    var objectTypes = '';

    for ( var j = 0; j < searchTypes.length; j++ ) {
        objectTypes = objectTypes + searchTypes[j] + '; ';
    }

    return objectTypes.substring( 0, objectTypes.length - 2 );
};

/**
 * Get the Search criteria
 *
 * @function getSearchId
 * @param {Object} data - The panel's view model object
 * @return {String} advanced search Id
 */
export let getSearchCriteria = function( data ) {
    var subType = data.subTypes.dbValue;
    if ( subType === data.i18n.all ) {
        subType = _getAllSubTypes();
    }
    var queryUID;
    var searchID;

    if ( data.lovValues && data.lovValues.length > 0 ) {
        queryUID = data.lovValues[0].uid;
        searchID = exports.getSearchId( queryUID );
    }
    return {
        queryUID: queryUID,
        searchID: searchID,
        totalObjectsFoundReportedToClient: data.totalFound.toString(),
        typeOfSearch: 'ADVANCED_SEARCH',
        utcOffset: '330',
        lastEndIndex: data.lastEndIndex.toString(),
        Type: subType
    };
};

/**
 *  Creates the search ID for query
 *
 * @param {String}queryUID - queryUID
 * @return {String} advanced search Id
 */
export let getSearchId = function( queryUID ) {
    //Unique Search ID: search_object_UID + logged_in_user_UID + current_time
    var userCtx = appCtxSvc.getCtx( 'user' );
    var loggedInUserUid = userCtx.uid;
    var timeSinceEpoch = new Date().getTime();
    return queryUID + loggedInUserUid + timeSinceEpoch;
};

/**
 *  Creates the search ID for query
 *
 * @param {Object} data - The panel's view model object
 */
export let filterRecentList = function( data ) {
    if ( data.filterBox ) {
        var filteredText = data.filterBox.dbValue;
        var oldValue = data.eventData.oldValue;
        if ( oldValue === undefined ) {
            return;
        }
        if ( !filteredText ) {
            data.dataProviders.recentDataProvider.selectionModel.selectNone();
            data.dataProviders.recentDataProvider.update( loadedVMObjects, loadedVMObjects.length );
        }else {
            var vmos = [];
            for ( var i = 0; i < loadedVMObjects.length; i++ ) {
                var propInfo = loadedVMObjects[i];
                var propertyName = propInfo.cellHeader1.toLocaleLowerCase().replace( /\\|\s/g, '' );
                var filterValue = data.filterBox.dbValue.toLocaleLowerCase().replace( /\\|\s/g, '' );
                if ( propertyName.indexOf( filterValue ) !== -1 ||  compare( filterValue, propertyName ) ) {
                    vmos.push( propInfo );
                }
            }
            data.dataProviders.recentDataProvider.update( vmos, vmos.length );
        }
    }
};

//function to compare both string
function compare( first, second ) {
    // If we reach at the end of both strings
    if( first.length === 0 && second.length === 0 ) { return true; }

    if( first.length > 1 && first[ 0 ] === '*' && second.length === 0 ) {
        return false;
    }
    // If the first string contains '?' or current characters of both strings match
    if( first.length > 1 && first[ 0 ] === '?' || first.length !== 0 && second.length !== 0 && first[ 0 ] === second[ 0 ] ) {
        return compare( first.substring( 1 ), second.substring( 1 ) );
    }
    if( first.length > 0 && first[ 0 ] === '*' ) {
        return compare( first.substring( 1 ), second ) || compare( first, second.substring( 1 ) );
    }
    if( first.length === 1 && first[ 0 ] === '?' ) {
        return true;
    }
    return false;
}

var _resetSelection = function( data, selected, vmo ) {
    var obj = cdm.getObject( vmo.uid );
    appCtxSvc.registerCtx( 'selected', obj );
    var selectionTitle = obj.props.object_name.dbValues[0];
    if ( selected && selected.uid !== vmo.uid ) {
        data.filterChips = [];
        appCtxSvc.unRegisterCtx( 'reqDashboardTable' );
        appCtxSvc.unRegisterCtx( 'reqDashboardTableColumnFilters' );
        eventBus.publish( 'showReqDashboardTable.refreshTable' );
        eventBus.publish( 'filtersDataProvider.reset' );
    }
    return selectionTitle;
};

/**
 * Sets the first item in the list as selected
 *
 * @param {Object} data - The panel's view model object
 * @return {String} selected object name
 */
export let setSelection = function( data ) {
    var selected = appCtxSvc.getCtx( 'selected' );
    var selectionTitle = selected && selected.props.object_name.dbValues[0];
    var dataProvider = data.dataProviders.recentDataProvider;
    if ( dataProvider ) {
        var vmo = dataProvider.viewModelCollection.getViewModelObject( 0 );
        if ( vmo && data.conditions.setSelectionCondition ) {
            dataProvider.selectionModel.setSelection( vmo );
            selectionTitle = _resetSelection( data, selected, vmo );
            if( data.filterBox.dbValue === '' ) {
                loadedVMObjects = dataProvider.getViewModelCollection().loadedVMObjects;
            }
        }
    }
    return selectionTitle;
};


/**
 * Updates ctx selection to match list selection
 *
 * @param {Object} data - The panel's view model object
 * @return {String} selected object name
 */
export let updateCtxSelection = function( data ) {
    var selected = appCtxSvc.getCtx( 'selected' );
    var selectionTitle = selected && selected.props.object_name.dbValues[0];
    var dataProvider = data.dataProviders.recentDataProvider;
    if ( dataProvider ) {
        let vmoUid = dataProvider.selectionModel.getSelection()[0];
        if ( !vmoUid ) {
            let vmo = dataProvider.viewModelCollection.getViewModelObject( 0 );
            dataProvider.selectionModel.setSelection( vmo );
            vmoUid = vmo.uid;
        }
        if ( vmoUid && ( !selected || selected && selected.uid !== vmoUid ) ) {
            let vmo = cdm.getObject( vmoUid );
            selectionTitle = _resetSelection( data, selected, vmo );
        }
        var currentlyLoaded = dataProvider.getViewModelCollection().loadedVMObjects;
        if ( currentlyLoaded.length > loadedVMObjects.length ) {
            loadedVMObjects = currentlyLoaded;
        }
    }
    return selectionTitle;
};

/**
 * Retrieves the Workflow pie chart data
 *
 * @param {Object} data - The panel's view model object
 * @returns {*} chart series data
 */
export let createWorkflowPieChart = function( data ) {
    var reqDashboardTable = appCtxSvc.getCtx( 'reqDashboardTable' );
    chartData = reqDashboardTable.additionalSearchInfoMap.searchTermsToHighlight;

    var totalCountString = chartData[0];
    data.totalObjectsFound = parseInt( totalCountString.substring( totalCountString.indexOf( '=' ) + 1 ) );

    _.set( data, 'chartProviders.pieChartWorkflowProvider.noDataMessage', data.i18n.noDataToDisplay );

    var statusCount = chartData.indexOf( 'ReqChart2' ) - chartData.indexOf( 'ReqChart1' ) - 1;
    var startIndex = chartData.indexOf( 'ReqChart1' ) + 1;
    var arrayOfSeriesDataForChart = [];
    var keyValueDataForChart = [];
    var allNull = true;
    for ( var i = startIndex; i < startIndex + statusCount; i++ ) {
        var vec_data = chartData[i];
        var prop = vec_data.substring( 0, vec_data.indexOf( ',' ) );
        var count = parseInt( vec_data.substring( vec_data.indexOf( ',' ) + 1 ) );
        if( data.filterChips.length === 0 ) {
            chartMap[prop] = prop;
        }
        keyValueDataForChart.push( {
            label: prop,
            value: count,
            name: prop
        } );
        if( count !== 0 && allNull === true ) {
            allNull = false;
        }
    }
    if( allNull === true ) {
        keyValueDataForChart = [];
    }
    arrayOfSeriesDataForChart.push( {
        name: data.i18n.workflowStatus,
        keyValueDataForChart: keyValueDataForChart,
        seriesName: data.i18n.workflowStatus
    } );
    return {
        arrayOfSeriesDataForChart: arrayOfSeriesDataForChart,
        totalObjectsFound: data.totalObjectsFound
    };
};
/**
 * Retrieves the TestCases pie chart data
 *
 * @param {Object} data - The panel's view model object
 * @returns {*} chart series data
 */
export let createTestCasesPieChart = function( data ) {
    _.set( data, 'chartProviders.pieChartTestCasesProvider.noDataMessage', data.i18n.noDataToDisplay );

    var statusCount = chartData.indexOf( 'ReqChart3' ) - chartData.indexOf( 'ReqChart2' ) - 1;
    var startIndex = chartData.indexOf( 'ReqChart2' ) + 1;
    var arrayOfSeriesDataForChart = [];
    var keyValueDataForChart = [];
    var allNull = true;
    for ( var i = startIndex, j = 0; i < startIndex + 2 && i < startIndex + statusCount; i++, j++ ) {
        var vec_data = chartData[i];
        var prop = vec_data.substring( 0, vec_data.indexOf( ',' ) );
        var count = parseInt( vec_data.substring( vec_data.indexOf( ',' ) + 1 ) );
        keyValueDataForChart.push( {
            label: prop,
            value: count,
            name: chartMap[prop]
        } );
        if( count !== 0 && allNull === true ) {
            allNull = false;
        }
    }
    if( allNull === true ) {
        keyValueDataForChart = [];
    }
    arrayOfSeriesDataForChart.push( {
        name: data.i18n.testCoverage,
        keyValueDataForChart: keyValueDataForChart,
        seriesName: data.i18n.testCoverage
    } );
    return arrayOfSeriesDataForChart;
};
/**
 * Retrieves the Comments pie chart data
 *
 * @param {Object} data - The panel's view model object
 * @returns {*} chart series data
 */
export let createCommentsPieChart = function( data ) {
    _.set( data, 'chartProviders.pieChartCommentsProvider.noDataMessage', data.i18n.noDataToDisplay );

    var startIndex = chartData.indexOf( 'ReqChart3' ) + 1;
    var arrayOfSeriesDataForChart = [];
    var keyValueDataForChart = [];
    var allNull = true;
    for ( var i = startIndex, j = 0; i < startIndex + 5 && i < chartData.length; i++, j++ ) {
        var vec_data = chartData[i];
        var prop = vec_data.substring( 0, vec_data.indexOf( ',' ) );
        var count = parseInt( vec_data.substring( vec_data.indexOf( ',' ) + 1 ) );
        keyValueDataForChart.push( {
            label: prop,
            value: count,
            name: chartMap[prop]
        } );
        if( count !== 0 && allNull === true ) {
            allNull = false;
        }
    }
    if( allNull === true ) {
        keyValueDataForChart = [];
    }
    arrayOfSeriesDataForChart.push( {
        name: data.i18n.comments,
        keyValueDataForChart: keyValueDataForChart,
        seriesName: data.i18n.comments
    } );
    return arrayOfSeriesDataForChart;
};

var _resetContext = function( dashboardTableColumnFilters ) {
    appCtxSvc.registerCtx( 'reqDashboardTableColumnFilters', dashboardTableColumnFilters );
    appCtxSvc.unRegisterCtx( 'reqDashboardTable' );
    eventBus.publish( 'showReqDashboardTable.refreshTable' );
};

/**
 * This function is used to filter the Dasboard Table when a section of any pie chart is selected
 *
 * @param {Object} filterChips Filter Chips
 * @param {Object} selectedChartEntity selected Chart Entity
 * @returns {Object} filter chips
 */
export let filterTable = function( filterChips, selectedChartEntity ) {
    const newFilterChips = [ ...filterChips ];
    var selectedLabel = selectedChartEntity.label;
    var internalLabel = Object.keys( chartMap ).find( key => chartMap[key] === selectedLabel );
    var selected = appCtxSvc.getCtx( 'reqDashboardTableColumnFilters' );
    const filterChip = {
        uiIconId: 'miscRemoveBreadcrumb', chipType: 'BUTTON',
        labelDisplayName: selectedChartEntity.seriesName + ': ' + selectedLabel,
        labelInternalName: internalLabel
    };
    var colValues = [];
    if ( selected && selected.length > 0 ) {
        colValues = selected[0].values;
    }
    if ( colValues.indexOf( internalLabel ) === -1 ) {
        newFilterChips.push( filterChip );
        colValues.push( internalLabel );
        var dashboardTableColumnFilters = [ {
            columnName: 'ChartFilter',
            operation: 'contains',
            values: colValues

        } ];
        _resetContext( dashboardTableColumnFilters );
    }

    return newFilterChips;
};

/**
 * This function is used to filter/reset the Dasboard Table when a fliter chip is removed
 *
 * @param {Array} filterChips Filter chips
 * @param {Object} chipToRemove Chip to remove
 * @returns {Object} new Filter Chips
 */
export let removeTableFilter = function( filterChips, chipToRemove ) {
    const newFilterChips = [ ...filterChips ];
    newFilterChips.splice( newFilterChips.indexOf( chipToRemove ), 1 );

    var dashboardTableColumnFilters = appCtxSvc.getCtx( 'reqDashboardTableColumnFilters' );
    var colValues = [];
    if ( dashboardTableColumnFilters && dashboardTableColumnFilters.length > 0 ) {
        colValues = dashboardTableColumnFilters[0].values;
        colValues.splice( colValues.indexOf( chipToRemove.labelInternalName ), 1 );
    }
    if ( !dashboardTableColumnFilters || colValues.length === 0 ) {
        dashboardTableColumnFilters = [];
    }
    _resetContext( dashboardTableColumnFilters );

    return newFilterChips;
};

/**
 * Process and remove unwanted tiles
 *
 * @param {response} response from getCurrentUserGateway3
 * @return {tileGroups} Tiles Groups
 */
export let filterTiles = function( response ) {
    for ( let index = 0; index < response.tileGroups.length; index++ ) {
        if( response.tileGroups[index].groupName === 'rm2' ) {
            response.tileGroups.splice( index, 1 );
        }
    }
    return response.tileGroups;
};

const getReviewSuspectWorkflowTask = async function( vmo ) {
    if( vmo.props.arm0UnderlyingObject ) {
        var obj = cdm.getObject( vmo.props.arm0UnderlyingObject.dbValues[0] );
        if( obj ) {
            await tcVmoService.getViewModelProperties( [ obj ], [ 'fnd0MyWorkflowTasks' ] );
            return _.get( obj, 'props.fnd0MyWorkflowTasks.dbValues[0]' );
        }
    }
};

/**
 * Service for requirementsManager.
 *
 * @member requirementsManager
 */

const exports = {
    createWorkflowPieChart,
    createCommentsPieChart,
    createTestCasesPieChart,
    updateCtxSelection,
    setSelection,
    getSearchId,
    getSearchCriteria,
    filterTiles,
    filterTable,
    removeTableFilter,
    setSubType,
    filterRecentList,
    updateObjectTypeList,
    getReviewSuspectWorkflowTask
};
export default exports;
