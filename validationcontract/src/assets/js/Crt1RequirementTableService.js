// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1RequirementTableService
 */
import eventBus from 'js/eventBus';

var exports = {};
var flagForFilter;

/*
 * After editing , redraw chart
 */
export let checkAndReloadRequirementsChart = function( data, chartProp ) {
    if( data.eventData !== undefined ) {
        var state = data.eventData.state;
        if( state === 'saved' && chartProp && chartProp.pieChartData && chartProp.pieChartData.vrTables && chartProp.pieChartData.vrTables.callSoaOnEdit === true ) {
            eventBus.publish( 'requirementsTableProvider.modelObjectsEdited' );
            const newPieChartData = { ...chartProp.value };
            newPieChartData.pieChartData.vrTables.callSoaOnEdit = false;
            chartProp.update && chartProp.update( newPieChartData );
        }
    }
};

/**
 * this function is used to filter the Requirements Table when a particular section of the pie chart is selected
 * @param {object} data data
 */
export let filterReqTable = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.Requirements ) {
        const vrSubState =  { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        newChartProp.vrTables.requirementsTableProvider.requirementPieClicked = true;
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
            var reqTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ data.eventData.label ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            reqTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            } ];
        }
        newChartProp.vrTables.requirementsTableProvider.reqTableColumnFilters = reqTableColumnFilters;
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
        eventBus.publish( 'requirementsTable.plTable.reload' );
    }
};

/**
 * this function is used to filter the Requirements Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAllReq = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.Requirements ) {
        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            const vrSubState =  { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables.requirementsTableProvider.requirementPieClicked = false;
            var reqTableColumnFilters = [];
            newChartProp.vrTables.requirementsTableProvider.reqTableColumnFilters = reqTableColumnFilters;
            vrSubState.pieChartData = newChartProp;
            chartProp.update && chartProp.update( vrSubState );
            eventBus.publish( 'requirementsTable.plTable.reload' );
        }
    }
};

export default exports = {
    checkAndReloadRequirementsChart,
    filterReqTable,
    displayAllReq
};
