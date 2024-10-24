// Copyright (c) 2022 Siemens

import ngpCloneTableCellSvc from 'js/services/ngpCloneStatusTableCellService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpModelConstants from 'js/constants/ngpModelConstants';
import mfeTableSvc from 'js/mfeTableService';
import mfeFilterAndSortSvc from 'js/mfeFilterAndSortService';
import preferenceService from 'soa/preferenceService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import localeService from 'js/localeService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';

/**
 * NGP header service
 *
 * @module js/services/ngpTableService
 */

export const TABLE_COLUMNS = {
    MASTER_STATUS_COLUMN_NAME: 'MasterStatus',
    CLONE_STATUS_COLUMN_NAME: 'CloneStatus',
    DEPENDENCY_TYPE: 'hasDependency',
    PREDECESSOR_DEPENDENCY: 'predecessorDependency',
    SUCCESSOR_DEPENDENCY: 'successorDependency',
    MISMATCH_OR_MISSING: 'mismatchOrMissing',
    ASSIGNMENT_TYPE: 'AssignmentType',
    IN_CONTEXT_AGS: 'AssignmentInContextAttributeGroups',
    ASSIGNED_TO_PROCESS: 'AssignedToProcess',
    ASSIGNED_TO_OPERATION: 'AssignedToOperation',
    USED_IN_ACTIVITY: 'UsedInActivity'
};

const ICON_COLUMN_WIDTH = 55;
const localizedMsgs = localeService.getLoadedText( 'NgpTableMessages' );

const CLIENT_COLUMN_SETTINGS = {
    [TABLE_COLUMNS.MASTER_STATUS_COLUMN_NAME]:{
        internalName: TABLE_COLUMNS.MASTER_STATUS_COLUMN_NAME,
        displayName: localizedMsgs.master,
        width: ICON_COLUMN_WIDTH,
        enableColumnResizing: false
    },
    [TABLE_COLUMNS.CLONE_STATUS_COLUMN_NAME]:{
        internalName: TABLE_COLUMNS.CLONE_STATUS_COLUMN_NAME,
        displayName: localizedMsgs.clone,
        width: ICON_COLUMN_WIDTH,
        enableColumnResizing: false
    },
    [TABLE_COLUMNS.DEPENDENCY_TYPE]:{
        internalName: TABLE_COLUMNS.DEPENDENCY_TYPE,
        displayName: localizedMsgs.dependencyType,
        width: ICON_COLUMN_WIDTH,
        enableColumnResizing: false
    },
    [TABLE_COLUMNS.PREDECESSOR_DEPENDENCY]:{
        internalName: TABLE_COLUMNS.DEPENDENCY_TYPE,
        displayName: localizedMsgs.externalPredecessors,
        width: ICON_COLUMN_WIDTH,
        enableColumnResizing: false
    },
    [TABLE_COLUMNS.SUCCESSOR_DEPENDENCY]:{
        internalName: TABLE_COLUMNS.SUCCESSOR_DEPENDENCY,
        displayName: localizedMsgs.externalSuccessors,
        width: ICON_COLUMN_WIDTH,
        enableColumnResizing: false
    },
    [TABLE_COLUMNS.MISMATCH_OR_MISSING]:{
        internalName: TABLE_COLUMNS.MISMATCH_OR_MISSING,
        displayName: localizedMsgs.mismatchOrMissing,
        width: ICON_COLUMN_WIDTH,
        enableColumnResizing: false
    },
    [TABLE_COLUMNS.ASSIGNMENT_TYPE]:{
        internalName: TABLE_COLUMNS.ASSIGNMENT_TYPE,
        displayName: localizedMsgs.assignmentType
    },
    [TABLE_COLUMNS.IN_CONTEXT_AGS]:{
        internalName: TABLE_COLUMNS.IN_CONTEXT_AGS,
        displayName: localizedMsgs.assignmentInContextAttributeGroups,
        width: ICON_COLUMN_WIDTH,
        enableColumnResizing: false
    },
    [TABLE_COLUMNS.ASSIGNED_TO_PROCESS]:{
        internalName: TABLE_COLUMNS.ASSIGNED_TO_PROCESS,
        displayName: localizedMsgs.assignedToProcess
    },
    [TABLE_COLUMNS.ASSIGNED_TO_OPERATION]:{
        internalName: TABLE_COLUMNS.ASSIGNED_TO_OPERATION,
        displayName: localizedMsgs.assignedToOperation
    },
    [TABLE_COLUMNS.USED_IN_ACTIVITY]:{
        internalName: TABLE_COLUMNS.USED_IN_ACTIVITY,
        displayName: localizedMsgs.usedInActivity
    }

};

/**
 * @param {modelObject[]} rowObjects - an array of row objects
 * @param {object[]} sortCriteria - the sort criteria array
 * @return {modelObject[]} a sorted array of modelObjects
 */
export function sortTable( rowObjects, sortCriteria ) {
    let sortedRows = rowObjects;
    if( Array.isArray( sortCriteria ) && sortCriteria.length > 0 ) {
        const { fieldName, sortDirection } = sortCriteria[ 0 ];
        if( fieldName === TABLE_COLUMNS.MASTER_STATUS_COLUMN_NAME || fieldName === TABLE_COLUMNS.CLONE_STATUS_COLUMN_NAME ) {
            sortedRows === ngpCloneTableCellSvc.sortObjectsByCloneStatus( rowObjects, sortDirection === 'ASC', fieldName === TABLE_COLUMNS.MASTER_STATUS_COLUMN_NAME );
        } else {
            sortedRows = mfeFilterAndSortSvc.sortModelObjects( rowObjects, sortCriteria );
        }
    }
    return sortedRows;
}

/**
 *
 * @param {object[]} columns - the columns of some table
 * @param {string[]} columnNames - the names of the columns we want t
 */
function setColumnSettings( columns, columnNames = [] ) {
    columnNames.forEach( ( colName ) => {
        const column = _.find( columns, ( column ) => column.name === CLIENT_COLUMN_SETTINGS[colName].internalName );
        if( column ) {
            Object.assign( column, CLIENT_COLUMN_SETTINGS[colName] );
        }
    } );
}

/**
 *
 * @param {object[]} columns - a set of column objects
 * @param {object} columnProvider - the column provider settings
 */
export function ensureObjectStringColumnInTable( columns, columnProvider ) {
    const hasObjStringCol = hasColumn( columns, ngpPropConstants.OBJECT_STRING );
    if( !hasObjStringCol ) {
        let columnSetting = {
            name: ngpPropConstants.OBJECT_STRING,
            propertyName: ngpPropConstants.OBJECT_STRING,
            typeName: ngpModelConstants.BOP_ELEMENT,
            minWidth: 25,
            width: 200,
            isTreeNavigation: true,
            enableFiltering: false,
            enableColumnResizing: true,
            enablePinning: false,
            enableSorting: false,
            enableCellEdit: false,
            enableColumnHiding: false
        };
        columnSetting = Object.assign( columnSetting, columnProvider );
        const objectStringCol = awColumnSvc.createColumnInfo( columnSetting );
        columns.unshift( objectStringCol );
    }
}

/**
 * Save the resized columns width
 *
 * @param {Object} tableSettings - the table settings object
 * @param {Object} columns - the table columns with their width
 * @returns {Promise} promise
 */
export function saveResizedColumnsWidth( tableSettings, columns ) {
    const newPrefValue = [];
    columns.forEach( ( column ) => {
        //to avoid adding hard coded client columns which aren't mentioned in the preference
        if( !column.hardCodedClientColumn ) {
            newPrefValue.push( [ column.typeName, column.propertyName, column.drawnWidth ].join( '.' ) );
        }
    } );

    if( tableSettings.fixedColumns ) {
        const currentColumnNames = columns.map( ( column ) => column.propertyName );
        const missingFixedColumns = tableSettings.fixedColumns.filter( ( columnName ) => !currentColumnNames.includes( columnName ) );
        if( missingFixedColumns.length > 0 ) {
            preferenceService.getStringValues( tableSettings.columnConfigPreference ).then( ( preferenceValues ) => {
                preferenceValues.forEach( ( column, index ) => {
                    const [ objType, propertyName, columnWidth ] = column.split( '.' );
                    if( missingFixedColumns.includes( propertyName ) ) {
                        newPrefValue.splice( index, 0, column );
                    }
                } );
            } );
        }
    }
    return preferenceService.setStringValue( tableSettings.columnConfigPreference, newPrefValue );
}

/**
 *
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @return {Boolean} - true if the given dataprovider has the clone status column
 */
export function hasCloneStatusColumn( dataProvider ) {
    return hasColumns( dataProvider.columnConfig.columns, [ TABLE_COLUMNS.MASTER_STATUS_COLUMN_NAME, TABLE_COLUMNS.CLONE_STATUS_COLUMN_NAME ], 'or' );
}

/**
 *
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @returns {boolean} true if has mismath or missing column in the dataprovider columns object
 */
export function hasMismatchOrMissingColumn( dataProvider ) {
    return hasColumn( dataProvider.columnConfig.columns, TABLE_COLUMNS.MISMATCH_OR_MISSING );
}

/**
 *
 * @param {object[]} columns - the columns object array
 * @param {string[]} columnNames - the column names we want to find
 * @param {string} logicalOperator - 'or' or 'and'
 * @returns {boolean} true if the givne columns contain the column names, depending on the operator
 */
function hasColumns( columns, columnNames, logicalOperator ) {
    switch( logicalOperator.toLowerCase() ) {
        case 'and':
            return columnNames.every( ( colName ) => hasColumn( columns, colName ) );
        case 'or':
            return columnNames.some( ( colName ) => hasColumn( columns, colName ) );
        default:
            return false;
    }
}

/**
 *
 * @param {object[]} columns - a set of column objects
 * @param {string} columnName - the column name
 * @returns {boolean} true if the given columns have the give column name
 */
function hasColumn( columns, columnName ) {
    if( Array.isArray( columns ) && columns.length > 0 ) {
        return _.findIndex( columns, ( column ) => column.name === columnName ) > -1;
    }
    return false;
}

/**
 *
 * @param {object[]} columns - the table column objects
 */
export function setTableClientColumnSettings( columns ) {
    setColumnSettings( columns, Object.keys( CLIENT_COLUMN_SETTINGS ) );
}

/**
 *
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table
 * @param {Object} dataProvider - the table data provider
 * @param {object} columnProvider - the table column provider
 * @param {object} additionalPolicyObjects - object with more policy data
 * @param {string} tableCmdColumnPropName - the property name column we want to have the command icons
 * @param {string} tableTreeNavColumnPropName - the property name column we want to have the expand icon
 * @returns {promise<undefined>} a promise object
 */
export function createTableColumns( preferenceName, dataProvider, columnProvider, additionalPolicyObjects, tableCmdColumnPropName, tableTreeNavColumnPropName = '' ) {
    return mfeTableSvc.createColumns( preferenceName, dataProvider, columnProvider, additionalPolicyObjects, tableCmdColumnPropName, tableTreeNavColumnPropName ).then(
        () => {
            ensureObjectStringColumnInTable( dataProvider.columnConfig.columns, columnProvider );
            setTableClientColumnSettings( dataProvider.columnConfig.columns );
        }
    );
}

/**
 *
 * @returns {Object} effective property policy according to the AWB_ShowTypeIcon preference
 */
export function getEffectiveOverriddenPolicy() {
    let overriddenPropertyPolicy = propertyPolicySvc.getEffectivePolicy();
    let propertiesToRemove = [ 'fnd0InProcess', 'fnd0MyWorkflowTasks', 'export_sites', 'publication_sites', 'has_trace_link' ];
    // read preference NGP_ShowTypeIcon
    const ctxPreferences = appCtxSvc.getCtx( 'preferences' );
    if( ctxPreferences.NGP_ShowTypeIcon && ctxPreferences.NGP_ShowTypeIcon.length > 0 && ctxPreferences.NGP_ShowTypeIcon[ 0 ].toUpperCase() === 'TRUE' ) {
        propertiesToRemove.push( 'awp0ThumbnailImageTicket' );
    }
    overriddenPropertyPolicy.types.forEach( ( type ) => {
        type.properties = type.properties.filter( ( property ) => !propertiesToRemove.includes( property.name ) );
    } );
    return overriddenPropertyPolicy;
}

let exports = {};
export default exports = {
    sortTable,
    hasCloneStatusColumn,
    hasMismatchOrMissingColumn,
    ensureObjectStringColumnInTable,
    saveResizedColumnsWidth,
    setTableClientColumnSettings,
    createTableColumns,
    getEffectiveOverriddenPolicy
};
