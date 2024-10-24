// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/**
 * Service for mfe table views
 *
 * @module js/mfeColumnService
 */
import _ from 'lodash';
import localeService from 'js/localeService';
import preferenceService from 'soa/preferenceService';
import messagingService from 'js/messagingService';
import conditionService from 'js/conditionService';
import tcPropConstants from 'js/constants/tcPropertyConstants';
import awColumnSvc from 'js/awColumnService';
import awPromiseService from 'js/awPromiseService';

/**
 * @param {object} columnProvider - the table column provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @param {String} nameColumn -  Column name
 * @param {String} objPropertyName - Column Property name
 * @param {object} objType - Type
 * @param {String[]} typeNames - Array of types
 * @param {Object} columnWidth - column with of table
 * @param {String}  minWidth -  column minWidth
 * @param {string} tableCmdColumnPropName - the table column property name we want to display our commands icons
 * @param {string} tableTreeNavColumnPropName - the table column property name we want to display our expand icon
 * @param {Number}  columnOrder -  Column sequence number
 * @return {AwTableColumnInfo} Newly created AwTableColumnInfo object.
 */
function getColumnInfo( columnProvider, viewModelData, nameColumn, objPropertyName, objType, typeNames, columnWidth, minWidth, tableCmdColumnPropName, tableTreeNavColumnPropName, columnOrder ) {
    let columnOptions = getDefaultColumn();

    if( columnProvider ) {
        Object.entries( columnProvider ).forEach( ( [ key, value ] ) => {
            if( key !== 'clientColumns' && key !== 'specific_columns' && key !== 'alwaysVisibleColumns' && !key.includes( 'Action' ) && value ) {
                columnOptions[ key ] = value;
            }
        } );
    }
    if( columnProvider.columnInfos ) {
        const columnInfo = columnProvider.columnInfos.find( ( column ) => column.name === objPropertyName );
        if( columnInfo ) {
            if( columnInfo.visibleWhen && !conditionService.evaluateConditionExpression( columnInfo.visibleWhen, viewModelData ) ) {
                return;
            }
            Object.entries( columnInfo ).forEach( ( [ key, value ] ) => {
                columnOptions[ key ] = value;
            } );
        }
    }
    if( isNaN( columnWidth ) || columnWidth === '' ) {
        if( nameColumn ) {
            columnOptions.width =  200;
        }
    }else{
        columnOptions.width =  parseInt( columnWidth );
    }
    columnOptions.name = objPropertyName;
    columnOptions.propertyName = objPropertyName;
    columnOptions.typeName = objType;
    columnOptions.typeNames = typeNames;
    columnOptions.minWidth = minWidth;
    columnOptions.isTableCommand = tableCmdColumnPropName === objPropertyName;
    columnOptions.isTreeNavigation = tableTreeNavColumnPropName === objPropertyName;
    columnOptions.columnOrder = columnOrder;
    return awColumnSvc.createColumnInfo( columnOptions );
}

/**
 * Create column info
 *
 * @param {Object} column - the column data
 *
 * @return {AwTableColumnInfo} Newly created AwTableColumnInfo object.
 */
function createHardCodedClientColumnInfo( column = {} ) {
    let columnOptions = getDefaultColumn();
    columnOptions.name = column.name;
    columnOptions.propertyDisplayName = column.propertyDisplayName;
    columnOptions.propertyName = '';
    columnOptions.minWidth = 30;
    columnOptions.width = 30;
    columnOptions.enableColumnResizing =  column.name !== 'icon';
    columnOptions.displayName = column.displayName || column.propertyDisplayName;
    columnOptions.enableColumnHiding = false;
    columnOptions.hardCodedClientColumn = true;
    columnOptions.enableColumnMoving = false;
    return awColumnSvc.createColumnInfo( columnOptions );
}

/**
 * Set default column values
 * @returns {Object} return default columns
 */
function getDefaultColumn() {
    return {
        enableFiltering: false,
        enableColumnResizing: true,
        enablePinning: false,
        enableSorting: false,
        enableCellEdit: false,
        enableColumnHiding: true,
        enableColumnMoving: true,
        columnWidth: 100,
        name: undefined,
        propertyDisplayName: undefined,
        displayName: undefined,
        propertyName:undefined
    };
}

/**
 * Build table columns and the columns property policy from the passed in object properties
 *
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table
 * @param {Object} dataProvider - the table data provider
 * @param {object} columnProvider - the table column provider
 * @param {Object} additionalPolicyObjects - additional objects to add to policy
 * @param {string} tableCmdColumnPropName - the table column property name we want to display our commands icons
 * @param {string} tableTreeNavColumnPropName - the table column property name we want to display our expand icon
 * @param {int} treeNavigationColumnIndex - the expandable column index
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @return {promise<null>} returns a promise which is resolved once we finished to create the columns
 */
function createColumns( preferenceName, dataProvider, columnProvider = {}, additionalPolicyObjects = {}, tableCmdColumnPropName = '', tableTreeNavColumnPropName = '', treeNavigationColumnIndex =
'', viewModelData ) {
    if( typeof preferenceName !== 'string' || preferenceName === '' || !dataProvider ) {
        return awPromiseService.instance.reject( null );
    }
    const resource = localeService.getLoadedText( 'mfeUtilsMessages' );
    const propPolicy = {};
    propPolicy.types = additionalPolicyObjects && additionalPolicyObjects.types ? additionalPolicyObjects.types : [];

    let [ shouldBeAddedAtEnd, shouldNotBeAddedAtEnd ] = _.partition( columnProvider.clientColumns, function( cc ) { return cc.shouldBeAddedAtEnd; } );
    let tableColumns = [];
    if( shouldNotBeAddedAtEnd.length > 0 ) {
        // Pushes client columns at the starting of the tableColumns
        tableColumns = mappingClientColumnAndColumnInfo( shouldNotBeAddedAtEnd );
    }

    return preferenceService.getStringValues( preferenceName ).then( ( preferenceValues ) => {
        if( Array.isArray( preferenceValues ) && preferenceValues.length > 0 ) {
            let nameColumn = null;
            _.uniq( preferenceValues ).forEach( ( column ) => {
                let [ objType, objPropertyName, columnWidth, hiddenFlag, columnOrder ] = column.split( '.' );

                //if hidden flag is not defined then show it in available column list in column config popup
                hiddenFlag = hiddenFlag !== '' && hiddenFlag !== undefined && ( hiddenFlag === 'false' || hiddenFlag === 'true' )  ? JSON.parse( hiddenFlag ) : true;
                if( !nameColumn && ( objPropertyName === tcPropConstants.OBJECT_STRING || objPropertyName === tcPropConstants.BL_REV_OBJECT_NAME ) ) {
                    nameColumn = objPropertyName;
                }
                if( !objType || !objPropertyName ) {
                    return;
                }
                const typeNames = objType.split( ',' );
                objType = typeNames[ 0 ];
                updatePolicy( propPolicy, typeNames, objPropertyName );
                let createdCol = getColumnInfo( columnProvider, viewModelData, nameColumn, objPropertyName, objType, typeNames, columnWidth, 25,
                    tableCmdColumnPropName, tableTreeNavColumnPropName, columnOrder );
                if( createdCol ) {
                    //Column config is only supported for assembly table for now
                    let alwaysVisibleColumns = columnProvider.alwaysVisibleColumns;
                    updateVisibleColumn( createdCol, alwaysVisibleColumns, hiddenFlag );
                    tableColumns.push( createdCol );
                }
            } );

            if( shouldBeAddedAtEnd.length > 0 ) {
                // Pushes client columns at the end of the tableColumns
                tableColumns = [ ...tableColumns, ...mappingClientColumnAndColumnInfo( shouldBeAddedAtEnd ) ];
            }
            if( tableTreeNavColumnPropName === '' && treeNavigationColumnIndex !== '' ) {
                tableColumns[ treeNavigationColumnIndex ].isTreeNavigation = true;
            }
            dataProvider.columnConfig = { columns: tableColumns };
            dataProvider.policy = propPolicy;
            return {
                columnConfig: {
                    columns: tableColumns
                },
                policy: propPolicy
            };
        }
        const noPrefValueError = resource.noPreferenceValueError.format( preferenceName );
        messagingService.showError( noPrefValueError );
        return awPromiseService.instance.reject( noPrefValueError );
    } );
}

/**
 * Update Policy
 *
 * @param {Object} propPolicy - policy object
 * @param {String[]} typeNames - Array of types
 * @param {String} objPropertyName - property name
 *
 */
function updatePolicy( propPolicy, typeNames, objPropertyName ) {
    // when the property is defined on multiple types, update the policy for all types
    typeNames.forEach( ( type ) => {
        const policyEntry = _.find( propPolicy.types, ( { name } ) => name === type );
        if( policyEntry ) {
            policyEntry.properties.push( { name: objPropertyName } );
        } else {
            propPolicy.types.push( {
                name: type,
                properties: [ { name: objPropertyName } ]
            } );
        }
    } );
}

/**
 * Update Policy
 *
 * @param {Object} columnInfo - Column Object
 * @param {Array} alwaysVisibleColumns - Always visible column in table
 * @param {boolean} hiddenFlag - to hide column
 */
function updateVisibleColumn( columnInfo, alwaysVisibleColumns, hiddenFlag ) {
    //Object string will always be visible for table and should not be shown in the column config popup
    if( alwaysVisibleColumns && Array.isArray( alwaysVisibleColumns ) ) {
        if( alwaysVisibleColumns && Array.isArray( alwaysVisibleColumns ) && alwaysVisibleColumns.includes( columnInfo.propertyName ) ) {
            columnInfo.enableColumnHiding = false;
            hiddenFlag = false;
            columnInfo.enableColumnMoving = false;
        }
        columnInfo.hiddenFlag = hiddenFlag;
    }
}

/**
 *
 * @param {Array} allColumns - All columns including hidden client columns
 * @param {Array} updatedcolumns - Table columns with their modified values
 * @return {Array} return new column config array
 */
function getModifiedColumnConfigValues( allColumns, updatedcolumns ) {
    let updatedColumnConfigValues = [];
    let propNameToColumns = getPropertyNameToColumnConfig( allColumns );
    let clientIndex = 10; let index = 100;
    let alwaysVisibleColumns = allColumns.filter( ( val )=> !val.enableColumnHiding );

    alwaysVisibleColumns.forEach( ( col )=>{
        let column = col;
        if ( col.hardCodedClientColumn ) {
            column = col;
            column.columnOrder = clientIndex;
            clientIndex += 10;
        }else{
            column = col;
            column.columnOrder = index;
            index += 100;
        }

        updatedColumnConfigValues.push( column );
    } );

    updatedcolumns.forEach( ( col )=>{
        let column = propNameToColumns[col.propertyName];
        column.hiddenFlag = col.hiddenFlag;
        column.columnOrder = index;
        index += 100;
        updatedColumnConfigValues.push( column );
    } );
    updatedColumnConfigValues = _.sortBy( updatedColumnConfigValues, function( column ) { return column.columnOrder; } );
    return updatedColumnConfigValues;
}


/**
 * Save the resized columns width
 *
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table with each column width
 * @param {Object} updatedcolumns - the table columns with their width
 * @param {Object} dataProvider - dataProvider
 * @returns {Promise} promise
 *
 */
export function saveModifiedColumns( preferenceName, updatedcolumns, dataProvider ) {
    const newPrefValue = [];
    let newColumnConfig = [];
    if( updatedcolumns && updatedcolumns.length > 0 ) {
        let allColumns = dataProvider && dataProvider.columnConfig.columns;
        if(  allColumns && allColumns !== null && allColumns.length !== updatedcolumns.length ) {
            newColumnConfig = getModifiedColumnConfigValues( allColumns, updatedcolumns );
            dataProvider.columnConfig.columns = newColumnConfig;
        }else{
        // Push all columns to save resized columns width
            newColumnConfig.push( ...updatedcolumns );
        }
        newColumnConfig.forEach( ( column ) => {
        //to avoid adding hard coded client columns which aren't mentioned in the preference
            if( !column.hardCodedClientColumn ) {
                let defaultColumnWidth = column.drawnWidth ? column.drawnWidth : column.width;
                newPrefValue.push( [ column.typeNames, column.propertyName, defaultColumnWidth, column.hiddenFlag, column.columnOrder ].join( '.' ) );
            }
        } );
        return preferenceService.setStringValue( preferenceName, newPrefValue ).then( ()=>{
            if( dataProvider ) {
                postProcessSaveAndLoadFunction( dataProvider );
            }
            return newColumnConfig;
        } );
    }
}

/**
 * This method created mapping with client column & hard coded client info
 * @param {Array} clientColumnArray - clientColumnArray
 * @return {Array} - return an array of column objects
 */
function mappingClientColumnAndColumnInfo( clientColumnArray ) {
    return _.compact( _.flatMap( clientColumnArray, ( column ) => {
        if( column.clientColumn ) { return createHardCodedClientColumnInfo( column ); }
    } ) );
}

/**
 *  build a map of columnconfig as value and  propertyName as key
 * @param {Array} columns columns
 * @returns{Object} object
 */
function getPropertyNameToColumnConfig( columns ) {
    let propNameToColumns = {};
    _.forEach( columns, function( column ) {
        if( column.propertyName ) {
            propNameToColumns[ column.propertyName ] = column;
        } else if( column.name ) {
            propNameToColumns[ column.name ] = column;
        }
    } );

    return propNameToColumns;
}

/**
 * @param {Object} dataProvider dataProvider
 */
function postProcessSaveAndLoadFunction( dataProvider ) {
    dataProvider.newColumns = null;
    dataProvider.gridContextDispatcher( {
        type: 'COLUMN_CONFIG_UPDATE',
        columnConfig: dataProvider.columnConfig
    } );
}

/**
 *
 * @param {String} preferenceName preference name
 * @param {Array} defaultColumn defaultColumn
 * @returns {columnsToDisplay}
 */
async function mfeGetColumnNamesToDisplay( preferenceName, defaultColumn ) {
    let preferenceValues = [];
    preferenceValues = await preferenceService.getStringValues( preferenceName );
    if( preferenceValues && defaultColumn ) {
        const columns = defaultColumn.concat( preferenceValues );
        let columnsToDisplay = columns.filter( ( item, index ) => columns.indexOf( item ) === index );
        await preferenceService.setStringValue( preferenceName,  columnsToDisplay  );
        return columnsToDisplay.map( ( item )=> {
            return { name : item.substring( 13 ) };
        } );
    }
    await preferenceService.setStringValue( preferenceName,  defaultColumn  );
    return defaultColumn.map( ( item )=> {
        return { name : item.substring( 13 ) };
    } );
}
/**
 * update Column grid command visibility
 * @param {Array} data subPanelContext
 * @param {Array} columns column config
 * @returns column with edited grid command visibility
 */
function updateColumnCommandVisibility( data, columns ) {
    if( data && data.ebomRevisions && data.ebomRevisions.length > 0 ) {
        columns.columnConfig.columns.forEach( column => {
            column.enableColumnHiding = false;
            column.enablePinning = false;
            return column;
        } );
    }
    return columns;
}
export default {
    createColumns,
    saveModifiedColumns,
    createHardCodedClientColumnInfo,
    mfeGetColumnNamesToDisplay,
    updateColumnCommandVisibility
};
