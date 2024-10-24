// Copyright (c) 2022 Siemens

/*
 * @module js/Crt1ConfigTableService
*/
import eventBus from 'js/eventBus';

var exports = {};
var flagForFilter;

/*
 * After editing , redraw chart
*/
export let checkAndReloadConfigTableChart = function( data, chartProp ) {
    if( data.eventData !== undefined ) {
        var state = data.eventData.state;
        if( state === 'saved' && chartProp.pieChartData.vrTables.callSoaOnEdit === true ) {
            const newPieChartData = { ...chartProp.value };
            newPieChartData.pieChartData.vrTables.callSoaOnEdit = false;
            chartProp.update && chartProp.update( newPieChartData );
        }
    }
};

/*
    * this function is used to filter the Config Table when a particular section of the pie chart is selected
   * @param {object} data data
*/
export let filterConfigTable = function( data, chartProp, provider, pieClicked, configTableColumnFilter, seriesName ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === seriesName ) {
        const vrSubState =  { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        newChartProp.vrTables[provider][pieClicked] = true;
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
        if( data.eventData.label === data.i18n.Pass || data.eventData.label === data.i18n.Fail  || data.eventData.label === data.i18n.Blocked || data.eventData.label === data.i18n.Caution ) {
            configTableColumnFilter = [ {

                columnName: 'crt1Result',
                operation: 'contains',
                values: [ data.eventData.label ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            configTableColumnFilter = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            } ];
        }
        newChartProp.vrTables[provider].configTableColumnFilter = configTableColumnFilter;
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
    }
};

/*
   * this function is used to filter the Config Table when a particular section of the pie chart is un-selected
   * @param {object} data data
*/
export let displayAllConfigTable = function( data, chartProp, provider, pieClicked, configTableColumnFilter, seriesName ) {
    if( data.eventMap[ 'undefined.unselected' ].seriesName === seriesName ) {
        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            const vrSubState =  { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables[provider][pieClicked] = false;
            configTableColumnFilter = [];
            newChartProp.vrTables[provider].configTableColumnFilter = configTableColumnFilter;
            vrSubState.pieChartData = newChartProp;
            chartProp.update && chartProp.update( vrSubState );
        }
    }
};

export default exports = {
    checkAndReloadConfigTableChart,
    filterConfigTable,
    displayAllConfigTable
};

