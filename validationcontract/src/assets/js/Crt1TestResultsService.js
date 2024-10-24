// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1TestResultsService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import selectionService from 'js/selection.service';
import dynamicTableUtils from 'js/dynamicTableUtils';
import pieChartService from 'js/Crt1PieChartsService';

var exports = {};
var flagForFilter;

/**
 * Update column filters to filter TestResult table
 */
export let getColumnFiltersForTestResult = function( data ) {
    var columnFilters = [];
    if( appCtxSvc.ctx.testResultColumnFilters ) {
        columnFilters = appCtxSvc.ctx.testResultColumnFilters;
    }
    return columnFilters;
};

export let resetPieChart = function( data, chartProp ) {
    const vrSubState =  { ...chartProp.value };
    const newChartProp = vrSubState.pieChartData;
    if( newChartProp.vrTables && newChartProp.vrTables.topPieChart && newChartProp.vrTables.topPieChart.testResultColumnFilters ) {
        newChartProp.vrTables.topPieChart.testResultColumnFilters = [];
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
    }
    var arrayOfSeriesDataForChart = [];
    var dummyValuesForFirstSeries = [];
    var keyValueDataForChart = [];
    var displayLabels = [];

    dummyValuesForFirstSeries = [ -1, -1, -1, -1, -1 ]; // values of pie chart
    if( data.i18n ) {
        displayLabels = [ data.i18n.NoResult, data.i18n.Fail, data.i18n.Pass, data.i18n.Blocked, data.i18n.Caution ];
    }
    for( var j = 0; j < dummyValuesForFirstSeries.length; j++ ) {
        keyValueDataForChart.push( {
            label: displayLabels[ j ],
            value: dummyValuesForFirstSeries[ j ],
            name: displayLabels[ j ],
            y: dummyValuesForFirstSeries[ j ]
        } );
    }

    arrayOfSeriesDataForChart.push( {
        seriesName: data.i18n.TestResult,
        colorByPoint: true,
        keyValueDataForChart: keyValueDataForChart
    } );

    return arrayOfSeriesDataForChart;
};

/*
 * Draw TestResult Pie chart
 */
export let createPieChartForTestResult = function( data, topPieChart, tpPieChart, vrSublocationState ) {
    if( !vrSublocationState.selectionChanged ) {
        if( topPieChart.redrawTestResultPieAsDoubleFilter ) {
            appCtxSvc.unRegisterCtx( 'testResultColumnFilters' );
            let value1 = topPieChart.chartData.unused;
            let value2 = topPieChart.chartData.pass;
            let value3 = topPieChart.chartData.fail;
            let value4 = topPieChart.chartData.blocked;
            let value5 = topPieChart.chartData.caution;
            return pieChartService.getPieChartData( value1, value2, value3, value4, value5, data, data.i18n.TestResult );
        } else if( topPieChart.chartData ) {
            let value1 = topPieChart.chartData.unused;
            let value2 = topPieChart.chartData.pass;
            let value3 = topPieChart.chartData.fail;
            let value4 = topPieChart.chartData.blocked;
            let value5 = topPieChart.chartData.caution;
            return pieChartService.getPieChartData( value1, value2, value3, value4, value5, data, data.i18n.TestResult );
        }
        appCtxSvc.unRegisterCtx( 'filteringTestResult' );
    }
    var newvrSublocationState = { ...vrSublocationState.value };
    newvrSublocationState.selectionChanged = false;
    vrSublocationState.update && vrSublocationState.update( newvrSublocationState );
};

/**
 * this function is used to filter the TestResult Table when a particular section of the pie chart is selected
 * @param {object} data data
 */
export let filterTestResultTable = function( data, chartProp ) {
    const vrSubState = { ...chartProp.value };
    const newChartProp = vrSubState.pieChartData;
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.TestResult ) {
        appCtxSvc.registerCtx( 'filteringTestResult', true );
        var selectedLabel = data.eventMap[ 'undefined.selected' ].label;
        //change selection to scope selection
        var currentSelectionObj = appCtxSvc.ctx.currentScopeTableSelection;
        if( currentSelectionObj ) {
            selectionService.updateSelection( currentSelectionObj );
        }
        if( data.eventData.label !== selectedLabel ) {
            flagForFilter = true;
        } else {
            flagForFilter = false;
        }

        data.eventData.label = selectedLabel;
        if( data.eventData.label === data.i18n.Pass || data.eventData.label === data.i18n.Fail || selectedLabel === data.i18n.Blocked || selectedLabel === data.i18n.Caution ) {
            var values = '';
            if( data.eventData.label === data.i18n.Pass ) {
                values = data.i18n.Pass;
            } else if( selectedLabel === data.i18n.Fail ) {
                values = data.i18n.Fail;
            } else if( selectedLabel === data.i18n.Blocked ) {
                values = data.i18n.Blocked;
            } else if( selectedLabel === data.i18n.Caution ) {
                values = data.i18n.Caution;
            }
            var testResultColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ values ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            testResultColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            } ];
        }
        newChartProp.vrTables.topPieChart.testResultColumnFilters = testResultColumnFilters;
        newChartProp.vrTables.topPieChart.testResultPieClicked = true;

        if( newChartProp.vrTables.requirementsTableProvider && newChartProp.vrTables.requirementsTableProvider.requirementPieClicked ) {
            newChartProp.vrTables.requirementsTableProvider.requirementPieClicked = false;
            newChartProp.vrTables.requirementsTableProvider.redrawRequirementPieAsDoubleFilter = true;
            newChartProp.vrTables.requirementsTableProvider.reqTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.functionsTableProvider && newChartProp.vrTables.functionsTableProvider.functionPieClicked ) {
            newChartProp.vrTables.functionsTableProvider.functionPieClicked = false;
            newChartProp.vrTables.functionsTableProvider.redrawFunctionPieAsDoubleFilter = true;
            newChartProp.vrTables.functionsTableProvider.functionTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.systemsTableProvider && newChartProp.vrTables.systemsTableProvider.systemPieClicked ) {
            newChartProp.vrTables.systemsTableProvider.systemPieClicked = false;
            newChartProp.vrTables.systemsTableProvider.redrawSystemPieAsDoubleFilter = true;
            newChartProp.vrTables.systemsTableProvider.sysTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.testCaseTableProvider && newChartProp.vrTables.testCaseTableProvider.testCasePieClicked ) {
            newChartProp.vrTables.testCaseTableProvider.testCasePieClicked = false;
            newChartProp.vrTables.testCaseTableProvider.redrawTestCasePieAsDoubleFilter = true;
            newChartProp.vrTables.testCaseTableProvider.testCaseTreeTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.simModelTableProvider && newChartProp.vrTables.simModelTableProvider.simModelPieClicked ) {
            newChartProp.vrTables.simModelTableProvider.simModelPieClicked = false;
            newChartProp.vrTables.simModelTableProvider.redrawSimModelPieAsDoubleFilter = true;
            newChartProp.vrTables.simModelTableProvider.simModelTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.simAnalysisTableProvider && newChartProp.vrTables.simAnalysisTableProvider.simAnalysisPieClicked ) {
            newChartProp.vrTables.simAnalysisTableProvider.simAnalysisPieClicked = false;
            newChartProp.vrTables.simAnalysisTableProvider.redrawSimAnalysisPieAsDoubleFilter = true;
            newChartProp.vrTables.simAnalysisTableProvider.simAnalysisTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.partsTableProvider && newChartProp.vrTables.partsTableProvider.partsPieClicked ) {
            newChartProp.vrTables.partsTableProvider.partsPieClicked = false;
            newChartProp.vrTables.partsTableProvider.redrawPartsPieAsDoubleFilter = true;
            newChartProp.vrTables.partsTableProvider.partsTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.othersTableProvider && newChartProp.vrTables.othersTableProvider.othersPieClicked ) {
            newChartProp.vrTables.othersTableProvider.othersPieClicked = false;
            newChartProp.vrTables.othersTableProvider.redrawOthersPieAsDoubleFilter = true;
            newChartProp.vrTables.othersTableProvider.othersTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.testProcedureTableProvider && newChartProp.vrTables.testProcedureTableProvider.testProcedurePieClicked ) {
            newChartProp.vrTables.testProcedureTableProvider.testProcedurePieClicked = false;
            newChartProp.vrTables.testProcedureTableProvider.redrawTestProcedurePieAsDoubleFilter = true;
            newChartProp.vrTables.testProcedureTableProvider.testProcedureTreeTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.testMethodTableProvider && newChartProp.vrTables.testMethodTableProvider.testMethodPieClicked ) {
            newChartProp.vrTables.testMethodTableProvider.testMethodPieClicked = false;
            newChartProp.vrTables.testMethodTableProvider.redrawTestMethodPieAsDoubleFilter = true;
            newChartProp.vrTables.testMethodTableProvider.testMethodTreeTableColumnFilters = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableOneProvider && newChartProp.vrTables.configTableOneProvider.configTableOnePieClicked ) {
            newChartProp.vrTables.configTableOneProvider.configTableOnePieClicked = false;
            newChartProp.vrTables.configTableOneProvider.redrawConfigTableOnePieAsDoubleFilter = true;
            newChartProp.vrTables.configTableOneProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableTwoProvider && newChartProp.vrTables.configTableTwoProvider.configTableTwoPieClicked ) {
            newChartProp.vrTables.configTableTwoProvider.configTableTwoPieClicked = false;
            newChartProp.vrTables.configTableTwoProvider.redrawConfigTableTwoPieAsDoubleFilter = true;
            newChartProp.vrTables.configTableTwoProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableThreeProvider && newChartProp.vrTables.configTableThreeProvider.configTableThreePieClicked ) {
            newChartProp.vrTables.configTableThreeProvider.configTableThreePieClicked = false;
            newChartProp.vrTables.configTableThreeProvider.redrawConfigTableThreePieAsDoubleFilter = true;
            newChartProp.vrTables.configTableThreeProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableFourProvider && newChartProp.vrTables.configTableFourProvider.configTableFourPieClicked ) {
            newChartProp.vrTables.configTableFourProvider.configTableFourPieClicked = false;
            newChartProp.vrTables.configTableFourProvider.redrawConfigTableFourPieAsDoubleFilter = true;
            newChartProp.vrTables.configTableFourProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableFiveProvider && newChartProp.vrTables.configTableFiveProvider.configTableFivePieClicked ) {
            newChartProp.vrTables.configTableFiveProvider.configTableFivePieClicked = false;
            newChartProp.vrTables.configTableFiveProvider.redrawConfigTableFivePieAsDoubleFilter = true;
            newChartProp.vrTables.configTableFiveProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableSixProvider && newChartProp.vrTables.configTableSixProvider.configTableSixPieClicked ) {
            newChartProp.vrTables.configTableSixProvider.configTableSixPieClicked = false;
            newChartProp.vrTables.configTableSixProvider.redrawConfigTableSixPieAsDoubleFilter = true;
            newChartProp.vrTables.configTableSixProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableSevenProvider && newChartProp.vrTables.configTableSevenProvider.configTableSevenPieClicked ) {
            newChartProp.vrTables.configTableSevenProvider.configTableSevenPieClicked = false;
            newChartProp.vrTables.configTableSevenProvider.redrawConfigTableSevenPieAsDoubleFilter = true;
            newChartProp.vrTables.configTableSevenProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableEightProvider && newChartProp.vrTables.configTableEightProvider.configTableEightPieClicked ) {
            newChartProp.vrTables.configTableEightProvider.configTableEightPieClicked = false;
            newChartProp.vrTables.configTableEightProvider.redrawConfigTableEightPieAsDoubleFilter = true;
            newChartProp.vrTables.configTableEightProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableNineProvider && newChartProp.vrTables.configTableNineProvider.configTableNinePieClicked ) {
            newChartProp.vrTables.configTableNineProvider.configTableNinePieClicked = false;
            newChartProp.vrTables.configTableNineProvider.redrawConfigTableNinePieAsDoubleFilter = true;
            newChartProp.vrTables.configTableNineProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.configTableTenProvider && newChartProp.vrTables.configTableTenProvider.configTableTenPieClicked ) {
            newChartProp.vrTables.configTableTenProvider.configTableTenPieClicked = false;
            newChartProp.vrTables.configTableTenProvider.redrawConfigTableTenPieAsDoubleFilter = true;
            newChartProp.vrTables.configTableTenProvider.configTableColumnFilter = testResultColumnFilters;
        }
        if( newChartProp.vrTables.softwareTableProvider && newChartProp.vrTables.softwareTableProvider.softwarePieClicked ) {
            newChartProp.vrTables.softwareTableProvider.softwarePieClicked = false;
            newChartProp.vrTables.softwareTableProvider.redrawSoftwarePieAsDoubleFilter = true;
            newChartProp.vrTables.softwareTableProvider.softwareTableColumnFilter = testResultColumnFilters;
        }
        vrSubState.CountTablesLoaded = dynamicTableUtils.registerCheckBoxCount( chartProp.checkBoxesInfo, chartProp ) - 1;
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
        _refreshTablesAfterFilter();
    } else {
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
    }
};

/**
 * this function is used to filter the TestResult Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAllTestResult = function( data, chartProp ) {
    if ( data.eventMap['undefined.unselected'].seriesName === data.i18n.TestResult ) {
        const vrSubState = { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        if ( newChartProp.vrTables.topPieChart.testResultPieClicked ) {
            newChartProp.vrTables.topPieChart.testResultPieClicked = false;
            newChartProp.vrTables.topPieChart.testResultPieUnClicked = true;
            vrSubState.CountTablesLoaded = dynamicTableUtils.registerCheckBoxCount( chartProp.checkBoxesInfo, chartProp ) - 1;
        }
        appCtxSvc.registerCtx( 'filteringTestResult', true );
        if ( flagForFilter ) {
            flagForFilter = false;
        } else {
            newChartProp.vrTables.topPieChart.testResultColumnFilters = [];
            vrSubState.pieChartData = newChartProp;
            chartProp.update && chartProp.update( vrSubState );
            _refreshTablesAfterFilter();
        }
    }
};

/*
 * After changing context, unregister variables
 */
export let resetColumnFiltersForTestResult = function( data ) {
    appCtxSvc.unRegisterCtx( 'testResultColumnFilters' );
    appCtxSvc.unRegisterCtx( 'filteringTestResult' );
    appCtxSvc.unRegisterCtx( 'testResultPassCount' );
    appCtxSvc.unRegisterCtx( 'testResultFailCount' );
    appCtxSvc.unRegisterCtx( 'testResultUnprocessCount' );
    appCtxSvc.unRegisterCtx( 'testResultBlockedCount' );
    appCtxSvc.unRegisterCtx( 'testResultCautionCount' );
};

export let resetSWCTable = function( vrSublocationState ) {
    const subPanelContext = { ...vrSublocationState.value };
    const newChartProp = subPanelContext.pieChartData;
    if( newChartProp.vrTables.topPieChart.redrawTestResultPieAsDoubleFilter ) {
        subPanelContext.pieChartData.vrTables.topPieChart.redrawTestResultPieAsDoubleFilter = false;
        if( newChartProp.vrTables.requirementsTableProvider && ( newChartProp.vrTables.requirementsTableProvider.requirementPieClicked === undefined || newChartProp.vrTables.requirementsTableProvider
            .requirementPieClicked === false ) ) {
            eventBus.publish( 'requirementsTable.plTable.reload' );
        }
        if( newChartProp.vrTables.functionsTableProvider && ( newChartProp.vrTables.functionsTableProvider.functionPieClicked === undefined || newChartProp.vrTables.functionsTableProvider
            .functionPieClicked === false ) ) {
            eventBus.publish( 'functionsTable.plTable.reload' );
        }
        if( newChartProp.vrTables.systemsTableProvider && ( newChartProp.vrTables.systemsTableProvider.systemPieClicked === undefined || newChartProp.vrTables.systemsTableProvider.systemPieClicked ===
                false ) ) {
            eventBus.publish( 'systemsTable.plTable.reload' );
        }
        if( newChartProp.vrTables.testCaseTableProvider && ( newChartProp.vrTables.testCaseTableProvider.testCasePieClicked === undefined || newChartProp.vrTables.testCaseTableProvider
            .testCasePieClicked === false ) ) {
            eventBus.publish( 'testCaseTable.plTable.reload' );
        }
        if( newChartProp.vrTables.simModelTableProvider && ( newChartProp.vrTables.simModelTableProvider.simModelPieClicked === undefined || newChartProp.vrTables.simModelTableProvider
            .simModelPieClicked === false ) ) {
            eventBus.publish( 'simModelTable.plTable.reload' );
        }
        if( newChartProp.vrTables.simAnalysisTableProvider && ( newChartProp.vrTables.simAnalysisTableProvider.simAnalysisPieClicked === undefined || newChartProp.vrTables.simAnalysisTableProvider
            .simAnalysisPieClicked === false ) ) {
            eventBus.publish( 'simAnalysisTable.plTable.reload' );
        }
        if( newChartProp.vrTables.partsTableProvider && ( newChartProp.vrTables.partsTableProvider.partsPieClicked === undefined || newChartProp.vrTables.partsTableProvider.partsPieClicked ===
            false ) ) {
            eventBus.publish( 'partsTable.plTable.reload' );
        }
        if( newChartProp.vrTables.othersTableProvider && ( newChartProp.vrTables.othersTableProvider.othersPieClicked === undefined || newChartProp.vrTables.othersTableProvider.othersPieClicked ===
                false ) ) {
            eventBus.publish( 'othersTable.plTable.reload' );
        }
        if( newChartProp.vrTables.testProcedureTableProvider && ( newChartProp.vrTables.testProcedureTableProvider.testProcedurePieClicked === undefined || newChartProp.vrTables
            .testProcedureTableProvider.testProcedurePieClicked === false ) ) {
            eventBus.publish( 'testProcedureTable.plTable.reload' );
        }
        if( newChartProp.vrTables.testMethodTableProvider && ( newChartProp.vrTables.testMethodTableProvider.testMethodPieClicked === undefined || newChartProp.vrTables.testMethodTableProvider
            .testMethodPieClicked === false ) ) {
            eventBus.publish( 'testMethodTable.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableOneProvider && ( newChartProp.vrTables.configTableOneProvider.configTableOnePieClicked === undefined || newChartProp.vrTables.configTableOneProvider
            .configTableOnePieClicked === false ) ) {
            eventBus.publish( 'configTableOne.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableTwoProvider && ( newChartProp.vrTables.configTableTwoProvider.configTableTwoPieClicked === undefined || newChartProp.vrTables.configTableTwoProvider
            .configTableTwoPieClicked === false ) ) {
            eventBus.publish( 'configTableTwo.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableThreeProvider && ( newChartProp.vrTables.configTableThreeProvider.configTableThreePieClicked === undefined || newChartProp.vrTables.configTableThreeProvider
            .configTableThreePieClicked === false ) ) {
            eventBus.publish( 'configTableThree.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableFourProvider && ( newChartProp.vrTables.configTableFourProvider.configTableFourPieClicked === undefined || newChartProp.vrTables.configTableFourProvider
            .configTableFourPieClicked === false ) ) {
            eventBus.publish( 'configTableFour.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableFiveProvider && ( newChartProp.vrTables.configTableFiveProvider.configTableFivePieClicked === undefined || newChartProp.vrTables.configTableFiveProvider
            .configTableFivePieClicked === false ) ) {
            eventBus.publish( 'configTableFive.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableSixProvider && ( newChartProp.vrTables.configTableSixProvider.configTableSixPieClicked === undefined || newChartProp.vrTables.configTableSixProvider
            .configTableSixPieClicked === false ) ) {
            eventBus.publish( 'configTableSix.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableSevenProvider && ( newChartProp.vrTables.configTableSevenProvider.configTableSevenPieClicked === undefined || newChartProp.vrTables.configTableSevenProvider
            .configTableSevenPieClicked === false ) ) {
            eventBus.publish( 'configTableSeven.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableEightProvider && ( newChartProp.vrTables.configTableEightProvider.configTableEightPieClicked === undefined || newChartProp.vrTables.configTableEightProvider
            .configTableEightPieClicked === false ) ) {
            eventBus.publish( 'configTableEight.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableNineProvider && ( newChartProp.vrTables.configTableNineProvider.configTableNinePieClicked === undefined || newChartProp.vrTables.configTableNineProvider
            .configTableNinePieClicked === false ) ) {
            eventBus.publish( 'configTableNine.plTable.reload' );
        }
        if( newChartProp.vrTables.configTableTenProvider && ( newChartProp.vrTables.configTableTenProvider.configTableTenPieClicked === undefined || newChartProp.vrTables.configTableTenProvider
            .configTableTenPieClicked === false ) ) {
            eventBus.publish( 'configTableTen.plTable.reload' );
        }
        if( newChartProp.vrTables.softwareTableProvider && ( newChartProp.vrTables.softwareTableProvider.softwarePieClicked === undefined || newChartProp.vrTables.softwareTableProvider
            .softwarePieClicked === false ) ) {
            eventBus.publish( 'softwareTable.plTable.reload' );
        }
        vrSublocationState.update && vrSublocationState.update( subPanelContext );
    }
};

/**
 *
 * _registerTableFlags
 *
 * @param {Object} checkBox checkbox
 */
function _refreshTablesAfterFilter() {
    eventBus.publish( 'requirementsTable.plTable.reload' );
    eventBus.publish( 'functionsTable.plTable.reload' );
    eventBus.publish( 'systemsTable.plTable.reload' );
    eventBus.publish( 'testCaseTable.plTable.reload' );
    eventBus.publish( 'simModelTable.plTable.reload' );
    eventBus.publish( 'simAnalysisTable.plTable.reload' );
    eventBus.publish( 'partsTable.plTable.reload' );
    eventBus.publish( 'othersTable.plTable.reload' );
    eventBus.publish( 'testProcedureTable.plTable.reload' );
    eventBus.publish( 'testMethodTable.plTable.reload' );
    eventBus.publish( 'configTableOne.plTable.reload' );
    eventBus.publish( 'configTableTwo.plTable.reload' );
    eventBus.publish( 'configTableThree.plTable.reload' );
    eventBus.publish( 'configTableFour.plTable.reload' );
    eventBus.publish( 'configTableFive.plTable.reload' );
    eventBus.publish( 'configTableSix.plTable.reload' );
    eventBus.publish( 'configTableSeven.plTable.reload' );
    eventBus.publish( 'configTableEight.plTable.reload' );
    eventBus.publish( 'configTableNine.plTable.reload' );
    eventBus.publish( 'configTableTen.plTable.reload' );
    eventBus.publish( 'softwareTable.plTable.reload' );
}

export default exports = {
    getColumnFiltersForTestResult,
    createPieChartForTestResult,
    filterTestResultTable,
    displayAllTestResult,
    resetColumnFiltersForTestResult,
    resetSWCTable,
    resetPieChart
};
