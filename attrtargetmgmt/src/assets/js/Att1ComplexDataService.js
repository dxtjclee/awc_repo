// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Att1ComplexDataService
 */
import parsingUtils from 'js/parsingUtils';
import eventBus from 'js/eventBus';
import editHandlerSvc from 'js/editHandlerService';
import Att1EngrTableService from './Att1EngrTableService';
import _ from 'lodash';
import Att1ChartService from './Att1ChartService';
import cdm from 'soa/kernel/clientDataModel';
var exports = {};
var seletedMeasurement;

/**
 * Gets the complex data tables for the opened xrt summary object and sets the tables in the context
 * @param {String} parameter the parameter
 * @param {String} measureValue the measure value
 * @param {Array} response soa response
 * @param engrTable engrTable
 * @param engrTable parametersTable
 * @returns engrTable the updated engrTable object
 */
export let processGetAttributeComplexDataResponse = function( parameter, measureValue, response, engrTable, subPanelContext, gmmLocales ) {
    const engrTableCtx = engrTable;
    var measurement;
    engrTableCtx.parametersTable = subPanelContext.parametersTable;

    if( response && response.attributeComplexDataOutput[ 0 ].attrPropNamesToAttrComplexDataMap ) {
        var attrPropNamesToAttrComplexDataMap = response.attributeComplexDataOutput[ 0 ].attrPropNamesToAttrComplexDataMap;
        if( attrPropNamesToAttrComplexDataMap.att0GoalTable &&
            attrPropNamesToAttrComplexDataMap.att0GoalTable.length > 0 ) {
            engrTableCtx.goalTable = attrPropNamesToAttrComplexDataMap.att0GoalTable[ 0 ];
        }
        if( response && response.attributeComplexDataOutput[ 0 ].objectToRetrieve ) {
            engrTableCtx.selectedParameter = response.attributeComplexDataOutput[ 0 ].objectToRetrieve;
        }
        if( response && response.attributeComplexDataOutput.length > 1 && response.attributeComplexDataOutput[ 1 ].measurePropNamesToMeasurementComplexDataMap ) {
            var measurePropNamesToMeasurementComplexDataMap = response.attributeComplexDataOutput[ 1 ].measurePropNamesToMeasurementComplexDataMap;
            if( measurePropNamesToMeasurementComplexDataMap.att0ValueTable &&
                measurePropNamesToMeasurementComplexDataMap.att0ValueTable.length > 0 ) {
                engrTableCtx.valueTable = measurePropNamesToMeasurementComplexDataMap.att0ValueTable[ 0 ];
                measurement = getSelectedMeasurement();
                engrTableCtx.measurementTable = { selectedMeasurement: measurement, isSelectedMeasurementContainsComlexData: true };
            }
        } else {
            measurement = getSelectedMeasurement();
            engrTableCtx.measurementTable = { selectedMeasurement: measurement, isSelectedMeasurementContainsComlexData: undefined };
            engrTableCtx.tableModel = undefined;
            engrTableCtx.valueTable = undefined;
        }
    } else {
        measurement = getSelectedMeasurement();
        engrTableCtx.measurementTable = { selectedMeasurement: measurement, isSelectedMeasurementContainsComlexData: undefined };
        engrTableCtx.tableModel = undefined;
        engrTableCtx.valueTable = undefined;
        engrTableCtx.goalTable = undefined;
        if( subPanelContext.parametersTable ) {
            engrTableCtx.selectedParameter = subPanelContext.parametersTable.selectedUnderlyingObjects[ 0 ];
        } else {
            engrTableCtx.selectedParameter = subPanelContext.openedObject;
        }
    }


    if( measureValue !== null ) {
        var valueTableData = checkSizeMismatch( engrTableCtx );
        if ( valueTableData ) {
            engrTableCtx.chartSeriesData = valueTableData.chartSeriesData;
            engrTableCtx.network_data = valueTableData.tableData;
        }
    } else if( parameter !== null ) {
        var dataEngr = getDataForEngrTable( engrTableCtx, 'goalTable' );
        eventBus.publish( 'engrTable.refresh', dataEngr );
    }

    if( gmmLocales && engrTableCtx.tableModel ) {
        var tempData = {};
        tempData.subPanelContext = subPanelContext;
        tempData.engrTable = engrTableCtx;
        tempData.i18n = gmmLocales;
        Att1EngrTableService.localizeHeaders( engrTableCtx.tableModel.tableData, tempData );
    }
    return {
        engrTable: engrTableCtx
    };
};

export let getAttributeComplexDataInput = function( data, isParameterSelected, subPanelContext, isMeasureValueSelected, selectedMeasureValues ) {
    var inputs = [];
    if( isParameterSelected !== null ) {
        var selectedParameter;
        if( data && data.eventData && data.eventData.selectedObject && data.eventData.selectedObject.length > 0 ) {
            selectedParameter = data.eventData.selectedObject[ 0 ];
        } else if( subPanelContext.parametersTable && subPanelContext.parametersTable.selectedUnderlyingObjects ) {
            var parametersTable = subPanelContext.parametersTable.getValue();
            selectedParameter = parametersTable.selectedUnderlyingObjects[ 0 ];
        } else if( subPanelContext.openedObject.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
            selectedParameter = subPanelContext.openedObject;
        }
        var input = {
            clientId: 'AWClient',
            objectToRetrieve: selectedParameter,
            attrPropNames: [],
            measurePropNames: []
        };
        inputs.push( input );
    }
    if( isMeasureValueSelected ) {
        var selected = setSelectedMeasuredValue( selectedMeasureValues );
        if( selected ) {
            input = {
                clientId: 'AWClient',
                objectToRetrieve: selected,
                attrPropNames: [],
                measurePropNames: []
            };
            inputs.push( input );
        }
    }
    return inputs;
};

/**
 * Function to check the size mismatch between measurements and goal table.
 */
let checkSizeMismatch = function( engrTableCtx ) {
    var valueTable;
    var goalData = engrTableCtx.goalTable;
    var valueData = engrTableCtx.valueTable;

    if( goalData ) {
        // json is passed in tableName property
        var jsonString = goalData.tableName;
        var goalTable = parsingUtils.parseJsonString( jsonString );
        if( valueData ) {
            jsonString = valueData.tableName;
            valueTable = parsingUtils.parseJsonString( jsonString );
        } else {
            return;
        }
        if( valueTable.cellInfo.length !== goalTable.cellInfo.length || valueTable.cellInfo[ 0 ].length !== goalTable.cellInfo[ 0 ].length ) {
            eventBus.publish( 'valueTable.sizeMismatch' );
        } else {
            const readOnly = isEngrTableReadOnly( engrTableCtx );
            var valuesTableData = getDataForValuesTable( engrTableCtx, readOnly );
            eventBus.publish( 'engrTable.refresh', valuesTableData );
        }
        return valuesTableData;
    }
};

/**
 * Function to set the selected measured value in measurement table context
 * @param {Array} selectedMeasureValues the selected measured values
 * @return {*} Selected measurement
 */
function setSelectedMeasuredValue( selectedMeasureValues ) {
    var selected;
    if( selectedMeasureValues !== null && selectedMeasureValues && selectedMeasureValues.length > 0 ) {
        selected = selectedMeasureValues[ 0 ];
        seletedMeasurement = selectedMeasureValues[ 0 ];
    }
    return selected;
}

/**
 * Retrieve and format table data for display in the engineering table
 * @return {Object} Engineering table data
 */
export let getDataForEngrTable = function( engrTableCtx, tableName ) {
    var matrixData;
    if( tableName === 'valueTable' ) {
        const isReadOnly = isEngrTableReadOnly( engrTableCtx );
        matrixData = getDataForValuesTable( engrTableCtx, isReadOnly );
    } else if( tableName === 'goalTable' ) {
        matrixData = getDataForGoalTable( engrTableCtx );
    }
    return matrixData;
};

let getDataForGoalTable = function( engrTableCtx ) {
    engrTableCtx.goalTable.undo = undefined;
    if( engrTableCtx.valueTable ) {
        engrTableCtx.valueTable.showRange = false;
    }

    var matrixData = {};
    var numValues = 1;
    var subHeaders = [ 'Goal', 'Min', 'Max' ];
    var tableName = 'goalTable';
    var goalData = engrTableCtx.goalTable;
    if( goalData && goalData.tableName ) {
        // json is passed in tableName property
        var jsonString = goalData.tableName;
        var goalTable = parsingUtils.parseJsonString( jsonString );
        var cells = [];

        matrixData.titleRowColumn = tableName;
        var chartSeriesData = undefined;
        var series = {
            Goal:[],
            Min:[],
            Max:[]
        };
        if( !matrixData.chartSeriesData ) {
            chartSeriesData = new Map();
        }
        for( var j = 0; j < goalTable.cellInfo.length; j++ ) {
            cells[ j ] = [];
            for( var i = 0; i < goalTable.cellInfo[ j ].length; i++ ) {
                var cell = {
                    source: j,
                    target: i
                };
                if( chartSeriesData !== null && chartSeriesData !== undefined && !chartSeriesData?.has( i ) ) {
                    chartSeriesData.set( i, _.cloneDeep( series ) );
                }
                cell.Goal = goalTable.cellInfo[ j ][ i ].Goal;
                cell.Min = goalTable.cellInfo[ j ][ i ].Min;
                cell.Max = goalTable.cellInfo[ j ][ i ].Max;

                if( chartSeriesData !== null && chartSeriesData !== undefined && chartSeriesData.get( i ) !== null && chartSeriesData.get( i ) !== undefined ) {
                    chartSeriesData?.get( i ).Goal.push( { label:`${j}`, value:Att1ChartService.getDataForPoint( goalTable.cellInfo[ j ][ i ].Goal ) } );
                    chartSeriesData?.get( i ).Min.push( { label:`${j}`, value:Att1ChartService.getDataForPoint( goalTable.cellInfo[ j ][ i ].Min ) } );
                    chartSeriesData?.get( i ).Max.push( { label:`${j}`, value:Att1ChartService.getDataForPoint( goalTable.cellInfo[ j ][ i ].Max ) } );
                }
                cell.cellType = 'cell';
                cells[ j ][ i ] = cell;
            }
        }
        var table = {};
        processData( engrTableCtx, goalTable, table, undefined, chartSeriesData );
        table.units = goalTable.units;
        table.hasColumnSeries = table.columnSeries.length > 0;
        table.showSubHeaders = false;
        table.numValues = numValues;
        table.subHeaders = subHeaders;
        table.cells = cells;
        table.tableName = tableName;
        table.table = goalTable;
        matrixData.tableData = table;
        matrixData.chartSeriesData = chartSeriesData;
        matrixData.tableName = tableName;
        matrixData.readOnly = isEngrTableReadOnly( engrTableCtx );
        setRange( table, goalData );
        engrTableCtx.tableModel = matrixData;
    }

    return matrixData;
};

let getDataForValuesTable = function( engrTableCtx, readOnly ) {
    var tableName = 'valueTable';
    var goalData = engrTableCtx.goalTable;
    var valueData = engrTableCtx.valueTable;
    var matrixData = {};
    engrTableCtx.valueTable.undo = undefined;

    if( goalData ) {
        // json is passed in tableName property
        var jsonString = goalData.tableName;
        var goalTable = parsingUtils.parseJsonString( jsonString );
        if( valueData ) {
            jsonString = valueData.tableName;
            var valueTable = parsingUtils.parseJsonString( jsonString );
        } else {
            return;
        }

        var numValues = 1;
        var subHeaders = [ 'Measurement', 'Goal', 'Min', 'Max' ];
        var cells = [];
        var newTable;
        if( readOnly ) {
            // get headers and data from valueTable
            newTable = valueTable;
        } else {
            // get headers from goalTable
            newTable = goalTable;
        }
        matrixData.titleRowColumn = tableName;
        var chartSeriesData = undefined;
        if( !matrixData.chartSeriesData ) {
            chartSeriesData = new Map();
        }
        var series = {
            Goal:[],
            Min:[],
            Max:[],
            Measurement : []
        };
        for( var j = 0; j < newTable.cellInfo.length; j++ ) {
            cells[ j ] = [];

            for( var i = 0; i < newTable.cellInfo[ j ].length; i++ ) {
                var cell = {
                    source: j,
                    target: i
                };
                if( !chartSeriesData?.has( i ) ) {
                    chartSeriesData?.set( i, _.cloneDeep( series ) );
                }

                if( !readOnly ) {
                    // Restructure if needed: if readonly is undefined, pad empty values
                    cell.Goal = goalTable.cellInfo[ j ][ i ].Goal;
                    cell.Min = goalTable.cellInfo[ j ][ i ].Min;
                    cell.Max = goalTable.cellInfo[ j ][ i ].Max;
                    cell.Measurement = valueTable.cellInfo[ j ] && valueTable.cellInfo[ j ][ i ] ? valueTable.cellInfo[ j ][ i ].Value : '';
                    var chartLabel = getRowHeaderForChart( goalTable, valueTable, j );
                    chartSeriesData?.get( i ).Goal.push( { label:chartLabel, value:Att1ChartService.getDataForPoint( goalTable.cellInfo[ j ][ i ].Goal ) } );
                    chartSeriesData?.get( i ).Min.push( { label:chartLabel, value:Att1ChartService.getDataForPoint( goalTable.cellInfo[ j ][ i ].Min ) } );
                    chartSeriesData?.get( i ).Max.push( { label:chartLabel, value:Att1ChartService.getDataForPoint( goalTable.cellInfo[ j ][ i ].Max ) } );
                    chartSeriesData?.get( i ).Measurement.push( { label:chartLabel, value:Att1ChartService.getDataForPoint( valueTable.cellInfo[ j ] && valueTable.cellInfo[ j ][ i ] ? valueTable.cellInfo[ j ][ i ].Value : '' ) } );
                    cell.chartData = chartSeriesData.get( i );
                } else if( readOnly === true ) {
                    // ReadOnly: if readonly is true, process only measurement values
                    cell.Measurement = valueTable.cellInfo[ j ][ i ].Value;
                }

                cell.cellType = 'cell';
                cells[ j ][ i ] = cell;
            }
        }
        var table = {};
        processData( engrTableCtx, newTable, table, readOnly, chartSeriesData );
        table.units = newTable.units;
        table.hasColumnSeries = table.columnSeries.length > 0;
        table.showSubHeaders = false;
        table.numValues = numValues;
        table.subHeaders = subHeaders;
        table.cells = cells;
        table.tableName = tableName;
        table.table = goalTable;
        matrixData.tableData = table;
        matrixData.tableName = tableName;
        matrixData.chartSeriesData = chartSeriesData;
        matrixData.readOnly = readOnly;
        setRange( table, valueData );
        engrTableCtx.tableModel = matrixData;
    }

    return matrixData;
};

/**
 *
 * @param {*} valueTable
 * @param {*} index
 * @returns
 */
function getRowHeaderForChart( goalTable, valueTable, index ) {
    if( goalTable && goalTable.rowHeaders && goalTable.rowHeaders[index] && goalTable.rowHeaders[index].title !== '' ) {
        return goalTable.rowHeaders[index].title;
    }
    return `${index}`;
}

/**
 *
 * @param {*} valueTable
 * @param {*} index
 * @returns
 */
function getColumnHeaderForChart( valueTable, index ) {
    if( valueTable && valueTable.rowHeaders && valueTable.rowHeaders[index] ) {
        return valueTable.rowHeaders[index].title;
    }
    return `${index}`;
}

/**
 * Method to process the data received from server
 * @param {Object} newTable the table object
 * @param {Object} engrTable the processed object
 * @param {Boolean} readOnly the read only flag
 */
function processData( engrTableCtx, newTable, engrTable, readOnly, chartSeriesData ) {
    var columnIdx = 0;
    var seriesIdx = 0;
    engrTable.rowHeaderTitle = { text: '' };
    if( newTable.rowHeaderTitle ) {
        engrTable.rowHeaderTitle.text = newTable.rowHeaderTitle[ 0 ].title;
    }

    engrTable.columnHeaderTitle = { text: '' };
    if( newTable.columnHeaderTitle ) {
        engrTable.columnHeaderTitle.text = newTable.columnHeaderTitle[ 0 ].title;
    }

    engrTable.hasRowHeaders = true;
    engrTable.rowHeaders = [];
    if( newTable.rowHeaders.length > 0 ) {
        for( var i = 0; i < newTable.rowHeaders.length; i++ ) {
            engrTable.rowHeaders[ i ] = { text: newTable.rowHeaders[ i ].title, displayText: newTable.rowHeaders[ i ].title };
        }
        if( newTable.columnHeaders[ 0 ].children && newTable.columnHeaders[ 0 ].children.length > 0 ) {
            newTable.columnHeaders[ 0 ] = newTable.columnHeaders[ 0 ].children[ 0 ];
        }
    } else {
        engrTable.hasRowHeaders = false;
        for( var i = 0; i < newTable.cellInfo.length; i++ ) {
            engrTable.rowHeaders[ i ] = { text: '', displayText: '' };
        }
        newTable.columnHeaders.splice( 0, 0, { title: '', units: '', displayText: '' } );
    }

    engrTable.columnSeries = [];
    for( var i = 0; i < newTable.columnHeaders.length; i++ ) {
        var unitIndex = newTable.columnHeaders[ i ].units;
        var unitSymbol;

        if( unitIndex === undefined || unitIndex === '' || unitIndex === -1 ) {
            newTable.columnHeaders[ i ].units = '';
            newTable.columnHeaders[ i ].displayText = newTable.columnHeaders[ i ].title;
        } else {
            unitSymbol = newTable.units[ unitIndex ].symbol;
            newTable.columnHeaders[ i ].displayText = newTable.columnHeaders[ i ].title + ' (' + unitSymbol + ')';
        }
        if( newTable.columnHeaders[ i ].children && newTable.columnHeaders[ i ].children.length > 0 ) {
            unitIndex = newTable.columnHeaders[ i ].units;
            engrTable.columnSeries[ seriesIdx ] = {
                text: newTable.columnHeaders[ i ].title,
                displayText: newTable.columnHeaders[ i ].displayText,
                count: newTable.columnHeaders[ i ].children.length,
                units: unitIndex,
                start: columnIdx
            };
            for( var j = 0; j < newTable.columnHeaders[ i ].children.length; j++ ) {
                var header = newTable.columnHeaders[ i ].children[ j ];
                if( chartSeriesData && chartSeriesData.has( columnIdx - 1 ) ) {
                    chartSeriesData.get( columnIdx - 1 ).seriesName = header.title;
                }
                if( header.units === undefined || header.units === '' || header.units === -1 ) {
                    header.units = '';
                    header.displayText = header.title;
                    engrTable.columnHeaders[ columnIdx++ ] = { text: header.title, series: seriesIdx, displayText: header.displayText, units: header.units, width: header.width };
                } else {
                    unitIndex = header.units;
                    unitSymbol = newTable.units[ unitIndex ].symbol;
                    header.displayText = header.title + ' (' + unitSymbol + ')';
                    engrTable.columnHeaders[ columnIdx++ ] = { text: header.title, series: seriesIdx, displayText: header.displayText, units: unitIndex, width: header.width };
                }
            }
            seriesIdx++;
        } else {
            if( !engrTable.columnHeaders ) {
                engrTable.columnHeaders = [];
            }
            if( chartSeriesData ) {
                if( i === 0 && engrTable.hasRowHeaders ) {
                    chartSeriesData.xAxisLabel = newTable.columnHeaders[ i ].title;
                } else if( chartSeriesData.has( columnIdx - 1 ) ) {
                    chartSeriesData.get( columnIdx - 1 ).seriesName =  newTable.columnHeaders[ i ].title;
                }
            }
            engrTable.columnHeaders[ columnIdx++ ] = {
                text: newTable.columnHeaders[ i ].title,
                units: unitIndex,
                displayText: newTable.columnHeaders[ i ].displayText,
                width: newTable.columnHeaders[ i ].width
            };
        }
    }

    // Overwrite readOnly flag in case of compare parameters
    var compareParameters;
    if( engrTableCtx.parametersTable && engrTableCtx.parametersTable.options && engrTableCtx.parametersTable.compareParameters ) {
        compareParameters = engrTableCtx.parametersTable.options.compareParameters;
    }
    if( compareParameters === true && ( !readOnly || readOnly === false ) ) {
        readOnly = isEngrTableReadOnly( engrTableCtx );
    }
}

export let cancelEdits = function( engrTable, tableName ) {
    let engrTableCtx = { ...engrTable.value };
    engrTableCtx[ tableName ].isDirty = undefined;
    engrTableCtx[ tableName ].isEditing = undefined;
    var dataEngrTable = getDataForEngrTable( engrTableCtx, tableName );
    engrTable.update( engrTableCtx );
    eventBus.publish( 'engrTable.refresh', dataEngrTable );
};

/**
 * Toggle the display of Min and Max columns in the table.
 * @param {*} engrTable Context for the table
 * @param {*} tableName Internal table name
 */
export let showRange = function( engrTable ) {
    let engrTableCtx = { ...engrTable.value };
    var tableName = engrTableCtx.tableModel.tableName;
    engrTableCtx[ tableName ].showRange = !engrTableCtx[ tableName ].showRange;
    engrTableCtx[ tableName ].tableName = Att1EngrTableService.createJson( tableName === 'valueTable' );
    var dataEngrTable = getDataForEngrTable( engrTableCtx, tableName );
    engrTable.update( engrTableCtx );
    eventBus.publish( 'Att1MeasurementsView.updateLineChart' );
    eventBus.publish( 'engrTable.refresh', dataEngrTable );
};

/**
 * Toggle the display of Goal column in the table.
 * @param {*} engrTable Context for the table
 */
export let showGoal = function( engrTable ) {
    let engrTableCtx = { ...engrTable.value };
    var tableName = engrTableCtx.tableModel.tableName;
    engrTableCtx[ tableName ].showGoal = !engrTableCtx[ tableName ].showGoal;
    engrTableCtx[ tableName ].tableName = Att1EngrTableService.createJson( true );
    var dataEngrTable = getDataForEngrTable( engrTableCtx, tableName );
    engrTable.update( engrTableCtx );
    eventBus.publish( 'Att1MeasurementsView.updateLineChart' );
    eventBus.publish( 'engrTable.refresh', dataEngrTable );
};

let setRange = function( tableData, table ) {
    tableData.displayHeaders = tableData.subHeaders.slice();
    tableData.numValues = 1;
    if( tableData.tableName === 'valueTable' ) {
        if( table.showGoal ) {
            tableData.numValues += 1;
        } else {
            tableData.displayHeaders.splice( 1, 1 );
        }
    }
    if( table.showRange ) {
        tableData.numValues += 2;
    }
    tableData.showSubHeaders = tableData.numValues > 1;
};

export let getSelectedParameterObject = function( subPanelContext ) {
    var selectedParameter;
    if( subPanelContext.parametersTable && subPanelContext.parametersTable.selectedUnderlyingObjects ) {
        var parameterTableContext = subPanelContext.parametersTable.getValue();
        selectedParameter = parameterTableContext.selectedUnderlyingObjects[ 0 ];
    } else if( subPanelContext.openedObject.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
        selectedParameter = subPanelContext.openedObject;
    }
    return selectedParameter;
};

/**
 * Start edit attribute table
 */
export let startMeasureValueEdit = function( subPanelContext ) {
    var editContext = 'MEASUREMENT_EDIT_HANDLER';
    var selectedObject = undefined;
    if( subPanelContext.parametersTable ) {
        selectedObject = subPanelContext.parametersTable.selectedObjects[ 0 ];
    } else {
        selectedObject = subPanelContext.openedObject;
    }
    if( selectedObject && selectedObject.props.is_modifiable ) {
        var isModifiable = selectedObject.props.is_modifiable.dbValue;
        if( isModifiable ) {
            var editHandler = editHandlerSvc.getEditHandler( editContext );
            editHandlerSvc.setActiveEditHandlerContext( editContext );
            editHandler.startEdit();
        }
    }
};

/**
 * Restructure measurement table according to goal table dimensions.
 * If the goalTable size is greater, measurement would be padded with empty cells, if size is smaller, the corresponding cells would be removed from measurement.
 */
export let restructureMeasurement = function( engrTableCtx ) {
    eventBus.publish( 'engrTable.restructureMeasurement', getDataForValuesTable( engrTableCtx, false ) );
};

/**
 * Display the measurement table in read only mode without modifying any data. In this mode, any modifications/authoring would be restricted to measurements table.
 */
export let processReadOnlyTable = function( engrTableCtx ) {
    eventBus.publish( 'engrTable.refresh', getDataForValuesTable( engrTableCtx, true ) );
};

export let getMeasurementsTableClientScopeUri = function( subPanelContext ) {
    var selected = getSelectedParameterObject( subPanelContext );
    var clientScopeUri = 'Att1MeasurementsTableStr';
    if( selected && selected.modelType ) {
        var typeHierarchyArray = selected.modelType.typeHierarchyArray;
        if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributePnt' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTablePnt';
        } else if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributeDbl' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTableDbl';
        } else if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributeInt' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTableInt';
        } else if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributeBool' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTableBool';
        }
    }
    return clientScopeUri;
};

var isEngrTableReadOnly = function( engrTableCtx ) {
    var readOnly = false;
    var selectedParam;
    var isCompareModeOn;
    // Set readOnly flag true in case of child parameters in compare parameters
    if( engrTableCtx.parametersTable && engrTableCtx.parametersTable.selectedObjects ) {
        selectedParam = engrTableCtx.parametersTable.selectedObjects;
    }
    if( engrTableCtx.parametersTable && engrTableCtx.parametersTable.options && engrTableCtx.parametersTable.compareParameters ) {
        isCompareModeOn = engrTableCtx.parametersTable.options.compareParameters;
    }
    if( isCompareModeOn === true && selectedParam && selectedParam.length > 0 && selectedParam[ 0 ].props.att1Parent && selectedParam[ 0 ].props.att1Parent.dbValues[ 0 ] !== '' ) {
        readOnly = true;
    }
    return readOnly;
};

export let getSelectedMeasurement = function() {
    return seletedMeasurement;
};

export default exports = {
    cancelEdits,
    showRange,
    showGoal,
    getDataForEngrTable,
    getSelectedParameterObject,
    startMeasureValueEdit,
    restructureMeasurement,
    processReadOnlyTable,
    getMeasurementsTableClientScopeUri,
    getAttributeComplexDataInput,
    processGetAttributeComplexDataResponse,
    getSelectedMeasurement,
    setRange
};
