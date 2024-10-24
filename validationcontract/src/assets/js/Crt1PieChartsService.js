// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1PieChartsService
 */
import tcSessionData from 'js/TcSessionData';
import eventBus from 'js/eventBus';
import Crt1VROverviewTablesService from 'js/Crt1VROverviewTablesService';
var exports = {};

/*
 * Draw Pie chart for Dynamic Tables
 */
export let createPieChartForDynamicTables = function( data, tableColumnFilters, redrawFlag, mainChartData, seriesName, chartProp, table ) {
    var chartDataFromSOA = [];
    if( mainChartData && mainChartData[ redrawFlag ] ) {
        const vrSubState = { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        const newTableChartProp = newChartProp.vrTables[ table ];
        newTableChartProp[ redrawFlag ] = false;
        newTableChartProp[ tableColumnFilters ] = [];
        chartDataFromSOA = mainChartData;
        if( chartDataFromSOA.length > 0 ) {
            let value1 = chartDataFromSOA[ 0 ];
            let value2 = chartDataFromSOA[ 1 ];
            let value3 = chartDataFromSOA[ 2 ];
            let value4 = chartDataFromSOA[ 3 ];
            let value5 = chartDataFromSOA[ 4 ];
            return getPieChartData( value1, value2, value3, value4, value5, data, seriesName );
        }
    } else if( mainChartData ) {
        var value1 = mainChartData.chartData.unused;
        var value2 = mainChartData.chartData.pass;
        var value3 = mainChartData.chartData.fail;
        var value4 = mainChartData.chartData.blocked;
        var value5 = mainChartData.chartData.caution;
        return getPieChartData( value1, value2, value3, value4, value5, data, seriesName );
    }
};

/**
 * this function is processd result count from server data and
 * return the series of data to draw the chart
 * @param {object} unUsedCnt unused count
 * @param {String} passCnt pass count
 * @param {String} failCnt fail count
 * @param {String} blockedCnt blocked count
 * @param {String} cautionCnt caution count
 * @param {object} data data
 * @param {string} seriesName series name
 * @returns {Array} array of series data for chart
 */
export let getPieChartData = function( unUsedCnt, passCnt, failCnt, blockedCnt, cautionCnt, data, seriesName ) {
    let unprocessCount = '0';
    let passCount = '0';
    let failCount = '0';
    let blockedCount = '0';
    let cautionCount = '0';
    let displayLabels = [];
    let dummyValuesForFirstSeries = [];
    let keyValueDataForChart = [];
    let arrayOfSeriesDataForChart = [];

    const ndx1 = unUsedCnt.indexOf( ':' );
    unprocessCount = parseInt( unUsedCnt.substring( ndx1 + 1 ) );

    const ndx2 = passCnt.indexOf( ':' );
    passCount = parseInt( passCnt.substring( ndx2 + 1 ) );

    const ndx3 = failCnt.indexOf( ':' );
    failCount = parseInt( failCnt.substring( ndx3 + 1 ) );

    let tcMajor = tcSessionData.getTCMajorVersion();
    let tcMinor = tcSessionData.getTCMinorVersion();
    if( tcMajor === 14 && tcMinor >= 3 || tcMajor > 14 ) {
        const ndx4 = blockedCnt.indexOf( ':' );
        blockedCount = parseInt( blockedCnt.substring( ndx4 + 1 ) );

        const ndx5 = cautionCnt.indexOf( ':' );
        cautionCount = parseInt( cautionCnt.substring( ndx5 + 1 ) );

        dummyValuesForFirstSeries = [ unprocessCount, failCount, passCount, blockedCount, cautionCount ];
        if( data.i18n ) {
            displayLabels = [ data.i18n.NoResult, data.i18n.Fail, data.i18n.Pass, data.i18n.Blocked, data.i18n.Caution ];
        }
    } else {
        dummyValuesForFirstSeries = [ unprocessCount, failCount, passCount ];
        if( data.i18n ) {
            displayLabels = [ data.i18n.NoResult, data.i18n.Fail, data.i18n.Pass ];
        }
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
        seriesName: seriesName,
        colorByPoint: true,
        keyValueDataForChart: keyValueDataForChart
    } );
    return arrayOfSeriesDataForChart;
};

export let ShowHideCharts = function( commandContext ) {
    if( commandContext && commandContext.context && commandContext.context.vrSublocationState && commandContext.context.vrSublocationState.value ) {
        const vrSublocationState = { ...commandContext.context.vrSublocationState.value };
        var showChart = vrSublocationState.showChart;
        if( showChart || showChart === undefined ) {
            vrSublocationState.showChart = false;
            Crt1VROverviewTablesService.refreshTablesWhereChartClicked(commandContext);
            eventBus.publish( 'isParameterChartClicked' );
        } else {
            vrSublocationState.showChart = true;
            eventBus.publish( 'isParameterChartClicked' );
            Crt1VROverviewTablesService.refreshTablesWhereChartClicked(commandContext);
            eventBus.publish( 'uniformParamTable.reloadTable' );
        }
        commandContext.context.vrSublocationState.update( vrSublocationState );
    }
};

export let isParameterChartClicked = function(subPanelContext){
    var inputDataIfChartClicked = {};
    if( subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState &&
        subPanelContext.context.vrSublocationState.pieChartData && subPanelContext.context.vrSublocationState.pieChartData.vrTables &&
        subPanelContext.context.vrSublocationState.pieChartData.vrTables.parameterPieClicked ){
        const vrSubState =  { ...subPanelContext.context.vrSublocationState.value };
        const newChartProp = vrSubState.pieChartData;
        newChartProp.vrTables.parameterPieClicked = false;
        subPanelContext.context.vrSublocationState.update && subPanelContext.context.vrSublocationState.update( vrSubState );
        inputDataIfChartClicked = {
            columnFilters: [],
            searchCriteria:{}
        };
    }
    return {
        inputDataIfChartClicked: inputDataIfChartClicked
    };
};

export default exports = {
    createPieChartForDynamicTables,
    getPieChartData,
    ShowHideCharts,
    isParameterChartClicked
};
