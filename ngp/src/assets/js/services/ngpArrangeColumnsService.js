
// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';
import _ from 'lodash';
import cmm from 'soa/kernel/clientMetaModel';
import soaSvc from 'soa/kernel/soaService';
import mfeSyncUtils from 'js/mfeSyncUtils';

const baseTypeToSubTypes = {};

/**
 * The ngp arrange columns configuration service
 *
 * @module js/services/ngpArrangeColumnsService
 */
'use strict';

/**
 * This method returns the available type based on object type
 * @param { String[] } tableObjectsBaseTypes - Object base type
 * @param { StringArray } subTypeExclusionList - Exclusion list
 * @param {Object} columnConfig - The column configuration data saved in data provider
 * @param {Object} tableSettings - the table settings object
 * @return { StringArray } - List of type value strings
 */
export function getAvailableAndCurrentColumns( tableObjectsBaseTypes, subTypeExclusionList, columnConfig, { clientColumns = [], fixedColumns = [] } ) {
    return ensureSubTypesLoaded( tableObjectsBaseTypes, subTypeExclusionList )
        .then(
            () => {
                const typesList = [];
                tableObjectsBaseTypes.forEach( ( typeName ) => typesList.push( ...baseTypeToSubTypes[typeName] ) );
                return getAvailablePropertiesForObjectTypes( typesList, clientColumns );
            }
        )
        .then(
            ( allAvailableColumns ) => {
                const currentColumns = [];
                columnConfig.forEach( ( column ) => {
                    const index = _.findIndex( allAvailableColumns, ( availableColumn ) => column.propertyName === availableColumn.propertyName );
                    if( index > -1 ) {
                        const currentColumn = allAvailableColumns[index];
                        currentColumn.drawnWidth = column.width;
                        currentColumn.isFixed =  fixedColumns.indexOf( column.propertyName ) > -1;
                        currentColumns.push( currentColumn );
                        allAvailableColumns.splice( index, 1 );
                    }
                } );
                return {
                    availableColumns: sortPropertyListByDisplayName( allAvailableColumns ),
                    currentColumns
                };
            }
        );
}

/**
 *
 * @param {String[]} typeNames - Object base type
 * @param {StringArray} subTypeExclusionList - Exclusion list
 * @returns { StringArray } - List of type value strings
 */
function ensureSubTypesLoaded( typeNames, subTypeExclusionList ) {
    const notCachedTypeNames = typeNames.filter( ( typeName ) => !baseTypeToSubTypes[typeName] );
    if( notCachedTypeNames.length === 0 ) {
        return new Promise( ( res ) => res( null ) );
    }
    const input = notCachedTypeNames.map( ( type ) => ( {
        boTypeName: type,
        exclusionBOTypeNames: subTypeExclusionList
    }
    ) );
    return ngpSoaSvc.executeSoa( 'Core-2010-04-DataManagement', 'findDisplayableSubBusinessObjectsWithDisplayNames', { input } )
        .then(
            ( result ) => {
                if( result.output ) {
                    result.output.forEach( ( objectWithSubTypes ) => {
                        const typesList = new Set();
                        typesList.add( objectWithSubTypes.boTypeName );
                        const subTypesInfo = objectWithSubTypes.displayableBOTypeNames;
                        if( subTypesInfo ) {
                            subTypesInfo.forEach( ( subType ) => {
                                typesList.add( subType.boName );
                                // add missing parents since abstract and hidden types are not returned from findDisplayableSubBusinessObjectsWithDisplayNames
                                subType.boParents.forEach( ( parent ) => typesList.add( parent ) );
                            } );
                        }
                        baseTypeToSubTypes[objectWithSubTypes.boTypeName] = typesList;
                    } );
                }
            }
        );
}

/**
 * Given an array of modelObjects, this method sorts them by a type hierarchy
 *
 * @param {ModelObject[]} modelTypes - a given set of modelObjects
 * @return {ModelObject[]} - a sorted array based on a given property value
 */
function sortModelTypesByHierarchy( modelTypes ) {
    if( Array.isArray( modelTypes ) && modelTypes.length > 1  ) {
        return modelTypes.sort( ( type1, type2 ) => type1.typeHierarchyArray.length - type2.typeHierarchyArray.length );
    }
    return modelTypes;
}
/**
 * This method returns the available type based on preference values
 * @param { StringArray } listOfTypes - list of possible types,
 * @param {StringArray} clientColumns - array of client columns for the table (like clone and master in build strategy)
 * @return {VMO[]} - List of VMO for types value
 */
function getAvailablePropertiesForObjectTypes( listOfTypes, clientColumns ) {
    return soaSvc.ensureModelTypesLoaded( listOfTypes ).then(
        () => {
            let modelTypes = listOfTypes.map( ( typeName ) =>  cmm.getType( typeName ) );
            const propList = [];
            modelTypes = sortModelTypesByHierarchy( modelTypes );
            const displayNameCount = {};
            modelTypes.forEach( ( type ) => {
                const typeProperties = type.propertyDescriptorsMap;
                if( typeProperties ) {
                    _.forEach( typeProperties, ( prop ) => {
                        if( prop.constantsMap.displayable === '1' ) {
                            const found = _.find( propList, ( obj ) => obj.propertyName === prop.name  );
                            if( !found ) {
                                const propObj =  {
                                    propertyName: prop.name,
                                    displayName: prop.displayName,
                                    typeName: type.name,
                                    typeDisplayName: type.displayName,
                                    drawnWidth: 100,
                                    alternateID: `${type.name}.${prop.name}`
                                };
                                if( !displayNameCount[prop.displayName] ) {
                                    displayNameCount[prop.displayName] = propObj;
                                } else {
                                    propObj.displayName = `${prop.displayName} (${type.displayName})`;
                                    displayNameCount[prop.displayName].displayName = `${prop.displayName} (${displayNameCount[prop.displayName].typeDisplayName})`;
                                }
                                propList.push( propObj );
                            } else {
                                const typeNames = found.typeName.split( ',' );
                                if( typeNames.every( ( typeName ) => !cmm.isInstanceOf( typeName, type ) ) ) {
                                    found.typeName = `${found.typeName},${type.name}`;
                                }
                            }
                        }
                    } );
                }
            } );
            //add clent columns
            propList.push( ...clientColumns );
            return propList;
        }
    );
}

/**
 * Given an array of modelObjects, this method sorts them by a display value in ascending order
 *
 * @param {Object[]} objects - a given set of modelObjects
 * @return {Object[]} - a sorted array based on a given property value
 */
function sortPropertyListByDisplayName( objects ) {
    if( Array.isArray( objects ) && objects.length > 1  ) {
        return objects.sort( ( obj1, obj2 ) => {
            return obj1.displayName >= obj2.displayName ? 1 : -1;
        } );
    }
    return objects;
}

/**
 * Adds selected columns from the Avavilable Columns list to Table Columns list.
 *
 * @param {object} currentTableColumnsDataProvider - data providers
 * @param {object} availableColumnsDataProvider - data providers
 * @param {Object[]} availableColumns - list of available columns
 * @param {Object[]} filteredAvailableColumns - list of filtered available columns
 * @param {Object[]} currentColumns - list of table columns
 */
function addColumns( currentTableColumnsDataProvider, availableColumnsDataProvider, availableColumns, filteredAvailableColumns, currentColumns ) {
    let selectedAvailableColumns = availableColumnsDataProvider.getSelectedObjects();
    if ( selectedAvailableColumns ) {
        selectedAvailableColumns = sortPropertyListByDisplayName( selectedAvailableColumns );
        selectedAvailableColumns.forEach( ( selectedColumn ) => {
            let index = _.findIndex( availableColumns, ( availableCol ) => availableCol === selectedColumn );
            if( index > -1 ) {
                availableColumns.splice( index, 1 );
            }
            index = _.findIndex( filteredAvailableColumns, ( availableCol ) => availableCol === selectedColumn );
            if( index > -1 ) {
                filteredAvailableColumns.splice( index, 1 );
            }
        } );

        //remove from available columns data provider
        availableColumnsDataProvider.update( filteredAvailableColumns, filteredAvailableColumns.length );
        availableColumnsDataProvider.selectNone();

        let indexToPushAt = currentColumns.length;
        currentColumns.forEach( ( column, index ) => {
            if( column.selected ) {
                indexToPushAt = index + 1;
            }
        } );
        currentColumns.splice( indexToPushAt, 0, ...selectedAvailableColumns );
        currentTableColumnsDataProvider.update( currentColumns, currentColumns.length );
        mfeSyncUtils.setSelectionInSelectionModel( currentTableColumnsDataProvider.selectionModel, selectedAvailableColumns );
    }
}

/**
 * Removes selected columns from the Table Columns list and adds them to Avavilable Columns list.
 *
 * @param {object} currentTableColumnsDataProvider - data providers
 * @param {object} availableColumnsDataProvider - data providers
 * @param {Object[]} availableColumns - list of available columns
 * @param {Object[]} filteredAvailableColumns - list of filtered available columns
 * @param {Object[]} currentColumns - list of table columns
 * @param {String} filterValue - filter value
 */
function removeColumns( currentTableColumnsDataProvider, availableColumnsDataProvider, availableColumns, filteredAvailableColumns, currentColumns, filterValue ) {
    let selectedColumns = currentTableColumnsDataProvider.getSelectedObjects();
    selectedColumns = selectedColumns.filter( ( col ) => !col.isFixed );
    if( selectedColumns.length > 0 ) {
        //remove from current columns
        _.remove( currentColumns, ( column ) => selectedColumns.indexOf( column ) > -1 );
        selectedColumns.forEach( ( col )=> col.selected = false );
        insertObjectsBasedOnDisplayName( availableColumns, selectedColumns );
        const selectedAndFiltered = filterAvailableColumns( filterValue, selectedColumns );
        if( selectedAndFiltered.length > 0 ) {
            insertObjectsBasedOnDisplayName( filteredAvailableColumns, selectedAndFiltered );
        }

        //update dataproviders
        availableColumnsDataProvider.update( filteredAvailableColumns, filteredAvailableColumns.length );
        availableColumnsDataProvider.selectNone();

        currentTableColumnsDataProvider.update( currentColumns, currentColumns.length );
        currentTableColumnsDataProvider.selectNone();
    }
}

/**
 *
 * @param {object[]} targetArray - an array of objects we add objects to
 * @param {object[]} sourceArray - an array of objects we add objects from
 */
function insertObjectsBasedOnDisplayName( targetArray, sourceArray ) {
    sourceArray.forEach( ( sourceObj ) => {
        const index = _.findIndex( targetArray, ( targetObj ) => sourceObj.displayName < targetObj.displayName );
        if( index > -1 ) {
            targetArray.splice( index, 0, sourceObj );
        } else {
            targetArray.push( sourceObj );
        }
    } );
}


/**
 * Filter and return list of column configs.
 *
 * @param {String} filterValue - filter string
 * @param {Object[]} availableColumns - list of available columns to filter
 * @return { StringArray } - List of type value strings
 */
function filterAvailableColumns( filterValue, availableColumns ) {
    if( filterValue === '' || filterValue === '*' ) {
        return availableColumns.slice();
    }
    return setFilteredColumns( filterValue, availableColumns );
}
/**
 *
 * @param {String} filter - filter string
 * @param {Object[]} columnDefs - list of columns to apply filter on them
 * @returns {Object[]} - list of filtered columns
 */
function setFilteredColumns( filter, columnDefs ) {
    const modifiedFilterVal = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );
    const filterValues = modifiedFilterVal.split( '*' ).filter( ( str ) => str && str !== '' );
    return columnDefs.filter( ( col ) => {
        const displayName = col.displayName.toLocaleLowerCase().replace( /\\|\s/g, '' );
        let match = 0;
        let index = 0;
        filterValues.forEach( ( filterVal ) => {
            if( ( index = displayName.indexOf( filterVal, index ) ) !== -1 ) {
                match++;
            }
        } );
        return match === filterValues.length;
    } );
}

/**
 *
 * @param {object[]} currentColumns - the list of current columns
 * @param {object} currentTableColumnsDataProvider - the current columns dataprovider
 */
export function moveSelectedColumnsUp( currentColumns, currentTableColumnsDataProvider ) {
    currentColumns.forEach( ( col, index, array ) => {
        if( col.selected ) {
            const prevColumn = array[index - 1];
            array[index - 1] = col;
            array[index] = prevColumn;
        }
    } );
    currentTableColumnsDataProvider.update( currentColumns, currentColumns.length );
}

/**
 * @param {object[]} currentColumns - the list of current columns
 * @param {object} currentTableColumnsDataProvider - the current columns dataprovider
 */
export function moveSelectedColumnsDown( currentColumns, currentTableColumnsDataProvider ) {
    currentColumns.forEach( ( col, index, array ) => {
        if( col.selected && array[index + 1] && !array[index + 1].selected ) {
            const nextColumn = array[index + 1];
            array[index + 1] = col;
            array[index] = nextColumn;
        }
    } );
    currentTableColumnsDataProvider.update( currentColumns, currentColumns.length );
}

let exports = {};
export default exports = {
    getAvailableAndCurrentColumns,
    removeColumns,
    addColumns,
    filterAvailableColumns,
    moveSelectedColumnsUp,
    moveSelectedColumnsDown
};
