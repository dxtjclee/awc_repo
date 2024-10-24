// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1SimulationModelTableService
 */
import eventBus from 'js/eventBus';

var exports = {};
var flagForFilter;

/*
 * After editing , redraw chart
 */
export let checkAndReloadSimModelChart = function( data, chartProp ) {
    if( data.eventData !== undefined ) {
        var state = data.eventData.state;
        if( state === 'saved' && chartProp && chartProp.pieChartData && chartProp.pieChartData.vrTables && chartProp.pieChartData.vrTables.callSoaOnEdit === true ) {
            eventBus.publish( 'simModelTableProvider.modelObjectsEdited' );
            const newPieChartData = { ...chartProp.value };
            newPieChartData.pieChartData.vrTables.callSoaOnEdit = false;
            chartProp.update && chartProp.update( newPieChartData );
        }
    }
};

/**
 * this function is used to filter the SimModel Table when a particular section of the pie chart is selected
 * @param {object} data data
 */
export let filterSimModelTable = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.SimulationModel ) {
        const vrSubState =  { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        newChartProp.vrTables.simModelTableProvider.simModelPieClicked = true;
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
            var simModelTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ data.eventData.label ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            simModelTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            } ];
        }
        newChartProp.vrTables.simModelTableProvider.simModelTableColumnFilters = simModelTableColumnFilters;
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
        eventBus.publish( 'simModelTable.plTable.reload' );
    }
};

/**
 * this function is used to filter the SimModel Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAllSimModel = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.SimulationModel ) {
        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            const vrSubState =  { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables.simModelTableProvider.simModelPieClicked = false;
            var simModelTableColumnFilters = [];
            newChartProp.vrTables.simModelTableProvider.simModelTableColumnFilters = simModelTableColumnFilters;
            vrSubState.pieChartData = newChartProp;
            chartProp.update && chartProp.update( vrSubState );
            eventBus.publish( 'simModelTable.plTable.reload' );
        }
    }
};

export default exports = {
    checkAndReloadSimModelChart,
    filterSimModelTable,
    displayAllSimModel
};
