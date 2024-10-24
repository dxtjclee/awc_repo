// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1FunctionsTableService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';

var exports = {};
var flagForFilter;


/*
 * After editing , redraw chart
 */
export let checkAndReloadFunctionsChart = function( data, chartProp ) {
    if( data.eventData !== undefined ) {
        var state = data.eventData.state;
        if( state === 'saved' && chartProp && chartProp.pieChartData && chartProp.pieChartData.vrTables && chartProp.pieChartData.vrTables.callSoaOnEdit === true ) {
            eventBus.publish( 'functionsTableProvider.modelObjectsEdited' );
            const newPieChartData = { ...chartProp.value };
            newPieChartData.pieChartData.vrTables.callSoaOnEdit = false;
            chartProp.update && chartProp.update( newPieChartData );
        }
    }
};

/**
 * this function is used to filter the Functions Table when a particular section of the pie chart is selected
 * @param {object} data data
 */
export let filterFunctionsTable = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.Functions ) {
        const vrSubState =  { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        newChartProp.vrTables.functionsTableProvider.functionPieClicked = true;
        if( newChartProp.vrTables.topPieChart.testResultPieClicked ) {
            newChartProp.vrTables.topPieChart.testResultPieClicked = false;
            newChartProp.vrTables.topPieChart.redrawTestResultPieAsDoubleFilter = true;
        }
        var selectedLabel = data.eventMap[ 'undefined.selected' ].label;

        if( data.eventData.label !== selectedLabel ) {
            flagForFilter = true;
        } else {
            flagForFilter = false;
        }

        data.eventData.label = selectedLabel;
        if( data.eventData.label === data.i18n.Pass || data.eventData.label === data.i18n.Fail || data.eventData.label === data.i18n.Blocked || data.eventData.label === data.i18n.Caution ) {
            var functionTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ data.eventData.label ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            functionTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            } ];
        }
        newChartProp.vrTables.functionsTableProvider.functionTableColumnFilters = functionTableColumnFilters;
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
        eventBus.publish( 'functionsTable.plTable.reload' );
    }
};

/**
 * this function is used to filter the Functions Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAllFunctions = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.Functions ) {
        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            const vrSubState =  { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables.functionsTableProvider.functionPieClicked = false;
            var functionTableColumnFilters = [];
            newChartProp.vrTables.functionsTableProvider.functionTableColumnFilters = functionTableColumnFilters;
            vrSubState.pieChartData = newChartProp;
            chartProp.update && chartProp.update( vrSubState );
            eventBus.publish( 'functionsTable.plTable.reload' );
        }
    }
};

export default exports = {
    checkAndReloadFunctionsChart,
    filterFunctionsTable,
    displayAllFunctions
};
