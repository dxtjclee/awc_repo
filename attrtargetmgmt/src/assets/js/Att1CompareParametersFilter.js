// Copyright (c) 2022 Siemens

/**
 * This module is used for Parameter custom filter service
 *
 * @module js/Att1CompareParametersFilter
 */
import localeService from 'js/localeService';
import appContextService from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import columnFilterUtility from 'js/awColumnFilterUtility';
import awColumnFilterService from 'js/awColumnFilterService';

var ATT1_COMPARE_FILTER_OP_HASVALUE = 'hasValue';
var ATT1_COMPARE_FILTER_OP_HASNOVALUE = 'hasNoValue';
var ATT1_COMPARE_FILTER_OP_SAMEVALUE = 'sameValue';
var ATT1_COMPARE_FILTER_OP_DIFFERENTVALUE = 'differentValue';
var ATT1_COMPARE_CUSTOM_FILTER_OPS = [ ATT1_COMPARE_FILTER_OP_HASVALUE, ATT1_COMPARE_FILTER_OP_HASNOVALUE,
    ATT1_COMPARE_FILTER_OP_SAMEVALUE, ATT1_COMPARE_FILTER_OP_DIFFERENTVALUE
];

var _localeTextBundle = {};

var exports = {};


/**
 * Check if filter is custom filter.
 *
 * @param {String} filterName filter Name
 * @return {Boolean} true if filter is custom filter
 */
var isCustomFilter = function( filterName ) {
    if( ATT1_COMPARE_CUSTOM_FILTER_OPS.includes( filterName ) ) {
        return true;
    }
    return false;
};
/**
 * Disable filtering in menu.
 *
 * @param {Object} isFilterDisabled - used to turn filter buttons on/off
 */
var disableFiltering = function( isFilterDisabled ) {
    if( isFilterDisabled.update ) {
        isFilterDisabled.update( { value: true } );
    } else {
        isFilterDisabled.value = true;
    }
};

/**
 * Enable filtering in menu.
 *
 * @param {Object} isFilterDisabled - used to turn filter buttons on/off
 */
var enableFiltering = function( isFilterDisabled ) {
    if( isFilterDisabled.update ) {
        isFilterDisabled.update( { value: false } );
    } else {
        isFilterDisabled.value = false;
    }
};
/**
 * Get applied filter.
 *
 * @param {Object} column - Column object that contains filters and values
 *
 * @returns {String} returns the Filter operation
 */
var getAppliedFilter = function( column, operation ) {
    var filterOperation = { ...operation };
    var isFilterApplied = false;
    var columnFilters = column.filter ? column.filter.columnFilters : [];
    _.forEach( columnFilters, function( columnFilter ) {
        filterOperation.dbValue = columnFilter.operation;
        switch ( columnFilter.operation ) {
            case ATT1_COMPARE_FILTER_OP_HASVALUE:
                filterOperation.uiValue = _localeTextBundle.CompareFilterHasValue;
                isFilterApplied = true;
                break;
            case ATT1_COMPARE_FILTER_OP_HASNOVALUE:
                filterOperation.uiValue = _localeTextBundle.CompareFilterHasNoValue;
                isFilterApplied = true;
                break;
            case ATT1_COMPARE_FILTER_OP_SAMEVALUE:
                filterOperation.uiValue = _localeTextBundle.CompareFilterSameValue;
                isFilterApplied = true;
                break;
            case ATT1_COMPARE_FILTER_OP_DIFFERENTVALUE:
                filterOperation.uiValue = _localeTextBundle.CompareFilterDiffValue;
                isFilterApplied = true;
                break;
            case columnFilterUtility.OPERATION_TYPE.CONTAINS:
                filterOperation.uiValue = _localeTextBundle.containsOperation;
                isFilterApplied = true;
                break;
            case columnFilterUtility.OPERATION_TYPE.NOT_CONTAINS:
                filterOperation.uiValue = _localeTextBundle.notContainsOperation;
                isFilterApplied = true;
                break;
            case columnFilterUtility.OPERATION_TYPE.STARTS_WITH:
                filterOperation.uiValue = _localeTextBundle.startsWithOperation;
                isFilterApplied = true;
                break;
            case columnFilterUtility.OPERATION_TYPE.ENDS_WITH:
                filterOperation.uiValue = _localeTextBundle.endsWithOperation;
                isFilterApplied = true;
                break;
            case columnFilterUtility.OPERATION_TYPE.EQUALS:
                filterOperation.uiValue = _localeTextBundle.equalsOperation;
                isFilterApplied = true;
                break;
            case columnFilterUtility.OPERATION_TYPE.NOT_EQUALS:
                filterOperation.uiValue = _localeTextBundle.notEqualsOperation;
                isFilterApplied = true;
                break;
        }
    } );

    return {
        operation: filterOperation,
        isFilterApplied: isFilterApplied
    };
};
/**
 * Initialize the column menu's default variables.
 *
 * @param {Object} column - column information
 * @param {Object} operation - column filtering operation
 */
export let initializeMenu = function( column, operation, columnFilterData, columnMenuData = {} ) {
    var filterInfo = getAppliedFilter( column, operation );
    let registerContext = false;
    let columnMenuContext = appContextService.getCtx( 'columnMenuContext' );
    if( !columnMenuContext ) {
        columnMenuContext = {};
        registerContext = true;
    }
    columnMenuContext.isFacetsInitialized = false;
    columnMenuContext.isFacetLoading = false;
    columnMenuContext.isSelectedFacetValues = false;
    columnMenuContext.isMenuIntialized = true;

    registerContext && appContextService.registerCtx( 'columnMenuContext', columnMenuContext );

    columnMenuData = { ...columnFilterData, ...columnMenuData };

    return {
        operation: filterInfo.operation,
        isFilterApplied: filterInfo.isFilterApplied,
        columnMenuData: columnMenuData
    };
};
/**
 * Add/remove the text filter information to the column provider.
 *
 * @param {Object} column - Column object
 * @param {Object} columnProvider - Column provider used to store the filters
 * @param {Object} dataProvider data provider for the data
 * @param {Object} eventData - The event data coming from the filter menu
 * @param {Object} viewModelData - The viewModel data used for validation
 */
export let doTextFiltering = function( column, viewModelData, facetDataProvider, gridContextDispatcher ) {
    // Do Custom Filtering
    if( isCustomFilter( viewModelData.operation.dbValue ) ) {
        var newFilters = [];
        const filterData = {
            columnName: column.field,
            operation: viewModelData.operation.dbValue,
            textValue: viewModelData.textValue.dbValue
        };
        var textColumnFilter = columnFilterUtility.createFilter( filterData.operation, filterData.columnName, [ filterData.textValue ] );
        newFilters.push( textColumnFilter );

        const columnMenuContext = appContextService.getCtx( 'columnMenuContext' );
        if( columnMenuContext.filterError !== true && gridContextDispatcher ) {
            awColumnFilterService.updateTableWithColumnFilters( gridContextDispatcher, column, newFilters );
        }

        return newFilters;
    }
    return awColumnFilterService.doTextFiltering( column, viewModelData, facetDataProvider, gridContextDispatcher );
};

/**
 * Check if property has a default value.
 *
 * @param {Object} property - property to check values
 * @returns {boolean} true is has blank value
 */
const isDefaultFilterValue = function( property ) {
    return property && ( _.isNil( property.dbValue ) || property.dbValue === '' );
};
/**
 * Check if text filter inputs are default values.
 *
 * @param {Object} column column definition object
 * @returns {Boolean} whether input values are all original values
 */
var isTextFilterInputDefault = function( column, viewModelData ) {
    var isInputDefault = false;
    if( !column.filter.isFilterApplied && isDefaultFilterValue( viewModelData.textValue ) ) {
        isInputDefault = true;
    }
    return isInputDefault;
};

/**
 * Validate filter enable/disable based on text filter.
 *
 * @param {Object} isFilterDisabled - used to turn filter buttons on/off
 * @param {Object} column - column definition object
 * @param {Object} viewModelData - column menu view model data
 */
export let textEnableFilterToggle = function( isFilterDisabled, column, viewModelData, isBulkEditing ) {
    if( !isCustomFilter( viewModelData.operation.dbValue ) && isTextFilterInputDefault( column, viewModelData ) || isBulkEditing ) {
        disableFiltering( isFilterDisabled );
    } else {
        enableFiltering( isFilterDisabled );
    }
};

/**
 * Save the information of type-based filter.
 *
 * @param {Object} gridContextDispatcher - Used to pass info to table
 * @param {Object} column - table column information
 * @param {Object} viewModelData - column menu view model data
 */
export let saveViewTypeMenuData = function( gridContextDispatcher, column, viewModelData ) {
    const columnMenuData = { columnName: column.field };
    columnMenuData.textValue = viewModelData.textValue;
    columnMenuData.operation = viewModelData.operation;

    if( columnMenuData.operation ) {
        columnMenuData.operation.dbValue = viewModelData.operation.dbValue;
    }
    columnMenuData.isStale = true;
    awColumnFilterService.updateColumnMenuData( gridContextDispatcher, columnMenuData );
};
/**
 * Text value changes, revalidate filtering state.
 *
 * @param {Object} gridContextDispatcher - Used to pass info to table
 * @param {Object} column - column definition object
 * @param {Object} viewModelData - column menu view model data
 * @param {Boolean} isBulkEditing - is table in bulk edit mode
 * @param {Object} isFilterDisabled - used to turn filter buttons on/off
 *
 * @returns {Object} isCompareFilter flag
 */
export let textFilterInputChanged = function( gridContextDispatcher, column, viewModelData, isBulkEditing, isFilterDisabled ) {
    let columnMenuContext = appContextService.getCtx( 'columnMenuContext' );
    if( column.filter && columnMenuContext && columnMenuContext.isMenuIntialized ) {
        exports.saveViewTypeMenuData( gridContextDispatcher, column, viewModelData );
        exports.textEnableFilterToggle( isFilterDisabled, column, viewModelData, isBulkEditing );
    }

    var isCompareFilter = false;
    if( isCustomFilter( viewModelData.operation.dbValue ) ) {
        isCompareFilter = true;
    }
    return { isCompareFilter: isCompareFilter };
};

/**
 * Check for filter disability state based on the filter view.
 *
 * @param {Object} column - column definition object
 * @param {Object} viewModelData - column menu view model data
 * @param {Object} isFilterDisabled - used to turn filter buttons on/off
 */
export let checkForFilterDisability = function( column, viewModelData, hasFilterFacetAction, facetDataProvider, isBulkEditing, isFilterDisabled ) {
    exports.textEnableFilterToggle( isFilterDisabled, column, viewModelData, isBulkEditing );
    var isCompareFilter = false;

    if( isCustomFilter( viewModelData.operation.dbValue ) ) {
        isCompareFilter = true;
    }
    return { isCompareFilter: isCompareFilter };
};

export let loadConfiguration = function() {
    localeService.getLocalizedTextFromKey( 'UIMessages.invalidNumberRange', true ).then( result => _localeTextBundle.invalidNumberRange = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.invalidDate', true ).then( result => _localeTextBundle.invalidDate = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.equalsOperation', true ).then( result => _localeTextBundle.equalsOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.containsOperation', true ).then( result => _localeTextBundle.containsOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.selectAll', true ).then( result => _localeTextBundle.selectAll = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.blanks', true ).then( result => _localeTextBundle.blanks = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.noMatchesFound', true ).then( result => _localeTextBundle.noMatchesFound = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.rangeOperation', true ).then( result => _localeTextBundle.rangeOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.greaterThanOperation', true ).then( result => _localeTextBundle.greaterThanOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.lessThanOperation', true ).then( result => _localeTextBundle.lessThanOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.notContainsOperation', true ).then( result => _localeTextBundle.notContainsOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.startsWithOperation', true ).then( result => _localeTextBundle.startsWithOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.endsWithOperation', true ).then( result => _localeTextBundle.endsWithOperation = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.notEqualsOperation', true ).then( result => _localeTextBundle.notEqualsOperation = result );

    localeService.getLocalizedTextFromKey( 'UIMessages.andFilterTooltip', true ).then( result => _localeTextBundle.andFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.greaterThanFilterTooltip', true ).then( result => _localeTextBundle.greaterThanFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.greaterThanEqualsFilterTooltip', true ).then( result => _localeTextBundle.greaterThanEqualsFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.lessThanFilterTooltip', true ).then( result => _localeTextBundle.lessThanFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.lessThanEqualsFilterTooltip', true ).then( result => _localeTextBundle.lessThanEqualsFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.equalsFilterTooltip', true ).then( result => _localeTextBundle.equalsFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.notEqualsFilterTooltip', true ).then( result => _localeTextBundle.notEqualsFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.containsFilterTooltip', true ).then( result => _localeTextBundle.containsFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.notContainsFilterTooltip', true ).then( result => _localeTextBundle.notContainsFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.startsWithFilterTooltip', true ).then( result => _localeTextBundle.startsWithFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'UIMessages.endWithFilterTooltip', true ).then( result => _localeTextBundle.endWithFilterTooltip = result );
    localeService.getLocalizedTextFromKey( 'Att1Messages.CompareFilterHasValue', true ).then( result => _localeTextBundle.CompareFilterHasValue = result );
    localeService.getLocalizedTextFromKey( 'Att1Messages.CompareFilterHasNoValue', true ).then( result => _localeTextBundle.CompareFilterHasNoValue = result );
    localeService.getLocalizedTextFromKey( 'Att1Messages.CompareFilterSameValue', true ).then( result => _localeTextBundle.CompareFilterSameValue = result );
    localeService.getLocalizedTextFromKey( 'Att1Messages.CompareFilterDiffValue', true ).then( result => _localeTextBundle.CompareFilterDiffValue = result );
};

/**
 * Setup to listen to changes in locale.
 *
 * @param {String} locale - String with the updated locale value.
 */
eventBus.subscribe( 'locale.changed', function() {
    loadConfiguration();
}, 'Att1CompareParametersFilter' );

exports = {
    loadConfiguration,
    doTextFiltering,
    textEnableFilterToggle,
    textFilterInputChanged,
    saveViewTypeMenuData,
    checkForFilterDisability,
    initializeMenu
};
export default exports;

loadConfiguration();
