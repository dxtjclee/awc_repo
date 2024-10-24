// Copyright (c) 2022 Siemens

/**
 * This Service implements the chart functionality for Array Parameter
 * @module js/Att1ChartService
 */
import eventBus from 'js/eventBus';
import awChartInstance from 'js/awHighcharts';
import localeService from 'js/localeService';
var exports = {};


/**
 * Method to create the input required by aw-chart to render series data
 * @param {JSON} engrTable the Array table context
 * @returns {JSON} the chart points to be shown in chart
 */
export let getChartData = function( engrTable ) {
    var chartSeriesData = engrTable.chartSeriesData;
    var seriesDataForChart = [];
    for ( let [ key, value ] of chartSeriesData ) {
        var seriesName = value.seriesName;
        seriesDataForChart.push( {
            seriesName: getSeriesName( engrTable, 'Measurement', seriesName ),
            keyValueDataForChart: value.Measurement,
            chartPointsConfig: 'colorOverrides'
        } );
        if( engrTable.valueTable.showGoal ) {
            seriesDataForChart.push( {
                seriesName: getSeriesName( engrTable, 'Goal', seriesName ),
                keyValueDataForChart: value.Goal,
                chartPointsConfig: 'colorOverrides'
            } );
        }
        if( engrTable.valueTable.showRange ) {
            seriesDataForChart.push( {
                seriesName: getSeriesName( engrTable, 'Min', seriesName ),
                keyValueDataForChart: value.Min,
                chartPointsConfig: 'colorOverrides'
            } );
            seriesDataForChart.push( {
                seriesName: getSeriesName( engrTable, 'Max', seriesName ),
                keyValueDataForChart: value.Max,
                chartPointsConfig: 'colorOverrides'
            } );
        }
    }
    addChartEvents( engrTable, chartSeriesData );
    return [ ...seriesDataForChart ];
};

/**
 * Function to get the series name
 * @param {*} engrTable the Complex table context
 * @param {*} propName the columns name
 * @param {*} seriesName the series title
 * @returns {String} tjhe series name
 */
function getSeriesName( engrTable, propName, seriesName ) {
    if( engrTable?.network_data?.headers ) {
        return engrTable.network_data.headers[propName] + ' ' + seriesName;
    }
    return getLocalizedText( propName ) + ' ' + seriesName;
}

/**
 * Gets the required text once
 * @param {Object} key - i18n key
 * @return {Object} - i18n text
 */
let getLocalizedText = function( key ) {
    const localeTextBundle = localeService.getLoadedText( 'Att1Messages' );
    return localeTextBundle[ key ];
};

/**
 *
 * @param {Object} chartSeriesData
 */
function addChartEvents( engrTable, chartSeriesData ) {
    awChartInstance.getHighchartsInstance().removeEvent( awChartInstance.getHighchartsInstance().Series, 'legendItemClick' );
    awChartInstance.getHighchartsInstance().addEvent( awChartInstance.getHighchartsInstance().Series, 'legendItemClick', function( eventData ) {
        var index = eventData.target.index;
        var name = eventData.target.name;
        var visible = eventData.target.visible;
        var mapIndex = parseInt( getMapKeyInChartSeriesData( index, engrTable.valueTable.showGoal, engrTable.valueTable.showRange ) );
        let engrTableCtx = { ...engrTable.value };
        if( chartSeriesData.has( mapIndex ) ) {
            var chartSeriesDataByIndex = chartSeriesData.get( mapIndex );
            if( name.split( ' ' )[ 0 ] === engrTable.propertyDisplayNames ? engrTable.propertyDisplayNames.Measurement : getLocalizedText( 'Measurement' ) ) {
                if( visible ) {
                    chartSeriesDataByIndex.isSeriesHidden = true;
                } else {
                    delete chartSeriesDataByIndex.isSeriesHidden;
                }
            }
            engrTableCtx.chartSeriesData = chartSeriesData;
            engrTable.update( engrTableCtx );
        }
    } );
}

/**
 *
 * @param {*} selectedLegendIndex
 * @param {*} isShowGoal
 * @param {*} isShowRange
 * @returns
 */
function getMapKeyInChartSeriesData( selectedLegendIndex, isShowGoal, isShowRange ) {
    if( isShowGoal && isShowRange ) {
        return selectedLegendIndex / 4;
    } else if( isShowRange ) {
        return selectedLegendIndex / 3;
    } else if( isShowGoal ) {
        return selectedLegendIndex / 2;
    }
    return  selectedLegendIndex;
}

export let handleGoalRangeToggleInOnlyChartView = function( engrTable, isShowGoal, isShowRange ) {
    var chartSeriesData = engrTable.chartSeriesData;
    var paramChartInstance = getParameterChartInstance();
    var allSeries = paramChartInstance.series;
    for( var j = 0; j < allSeries.length; j++ ) {
        allSeries[j].setVisible( true, false );
    }
    for ( let [ key, value ] of chartSeriesData ) {
        var hiddenSeries = value.isSeriesHidden;
        if( hiddenSeries ) {
            setVisibleStatus( paramChartInstance, key, allSeries, isShowGoal, isShowRange );
        }
    }
    paramChartInstance.redraw();
};

/**
 *
 * @param {*} index
 * @param {*} allSeries
 * @param {*} status
 * @param {*} isShowGoal
 * @param {*} isShowRange
 * @returns
 */
function setVisibleStatus( paramChartInstance, key, allSeries, isShowGoal, isShowRange ) {
    if( paramChartInstance ) {
        if( isShowGoal && isShowRange ) {
            var index = key * 4;
            allSeries[ index ].setVisible( false, false );
            allSeries[ index + 1 ].setVisible( false, false );
            allSeries[ index + 2 ].setVisible( false, false );
            allSeries[ index + 3 ].setVisible( false, false );
        } else if( isShowGoal ) {
            var index = key * 2;
            allSeries[ index ].setVisible( false, false );
            allSeries[ index + 1 ].setVisible( false, false );
        } else if( isShowRange ) {
            var index = key * 3;
            allSeries[ index ].setVisible( false, false );
            allSeries[ index + 1 ].setVisible( false, false );
            allSeries[ index + 2 ].setVisible( false, false );
        } else {
            var index = key;
            allSeries[ index ].setVisible( false, true );
        }
    }
}

function setVisible( alllSeries ) {

}

/**
 * Method to udpate the chart with new user modifcations and refresh it
 * @param {Object} cellInfo the cell selected by user
 * @param {Object} engrTable the Array table context
 * @param {Boolean} isUpdate the flag to decide whether to update chart or not
 * @returns {Object} the updated chart data
 */
export let updateChartData = function( cellInfos, engrTable, isUpdate ) {
    var chartSeriesData = engrTable.chartSeriesData;
    if( chartSeriesData ) {
        for( var i = 0; i < cellInfos.length; i++ ) {
            var cellInfo = cellInfos[i];
            var source =  cellInfo.source;
            var target = cellInfo.target;
            var property = cellInfo.index;
            if( source !== undefined && target !== undefined ) {
                var chartData = chartSeriesData.get( target );
                if( cellInfo.text.trim() === '' || getDataForPoint( cellInfo.text.trim() ) === null  ) {
                    chartData[property][source].value = null;
                } else {
                    chartData[property][source].value = parseFloat( cellInfo.text );
                }
            }
        }
        if( isUpdate && engrTable.update ) {
            engrTable.chartSeriesData = chartSeriesData;
            engrTable.update( engrTable );
            eventBus.publish( 'Att1MeasurementsView.updateLineChart' );
        }
        return chartSeriesData;
    }
};


/**
 * This method is to get the correct value to be shown in chart.
 * @param {String} value the string to be tested
 * @returns
 */
export let getDataForPoint = function( value ) {
    if( /^[\d]+$/.test( value ) || /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test( value ) ) {
        return parseFloat( value );
    }
    return null;
};

/**
 * Method to select the point on chart based on cell selected by user
 * This also supports multi select. User can select multiple cells in table
 * @param {Object} cellInfo the cell selected by user
 */
export let selectChartPoint = function( cellInfo, isShowGoal, isShowRange, isCrossProbing ) {
    if ( !isCrossProbing ) {
        var paramChartInstance = getParameterChartInstance();
        if ( cellInfo && cellInfo.length > 0 ) {
            if ( cellInfo.length > 1 ) {
                clearSelection( paramChartInstance );
                if ( cellInfo[0].cellType === 'column' ) {
                    updateChartWithSelectedColumns( cellInfo, paramChartInstance, isShowGoal, isShowRange );
                } else if ( cellInfo[0].cellType === 'table' ) {
                    updateChartWithSelectedColumns();
                } else {
                    for ( let index = 0; index < cellInfo.length; index++ ) {
                        var source = cellInfo[index].source;
                        var target = cellInfo[index].target;
                        target = getTargetSeriesNumber( cellInfo[index], isShowGoal, isShowRange );
                        selectDataPointOnChart( paramChartInstance, target, source, true );
                    }
                }
            } else {
                if ( cellInfo[0].cellType === 'column' ) {
                    updateChartWithSelectedColumns( cellInfo, paramChartInstance, isShowGoal, isShowRange );
                } else if ( cellInfo[0].cellType === 'table' ) {
                    updateChartWithSelectedColumns( undefined, paramChartInstance );
                } else {
                    source = cellInfo[0].source;
                    target = cellInfo[0].target;
                    target = getTargetSeriesNumber( cellInfo[0], isShowGoal, isShowRange );
                    selectDataPointOnChart( paramChartInstance, target, source, false );
                }
            }
            paramChartInstance.redraw();
        }
    }
};

/**
 * Method to clear the existing any selected points on chart before making new selection
 * @param {Object} paramChartInstance the highchart chart instance rendered by library
 */
function clearSelection( paramChartInstance ) {
    var selectedPoints = paramChartInstance.getSelectedPoints();
    for( var i = 0; i < selectedPoints.length; i++ )     {
        selectedPoints[i].select( false );
    }
}

/**
 * Method to select the point on chart based on cell selected by user
 * This also supports multi select. User can select multiple cells in table
 * @param {Object} paramChartInstance the highchart chart instance rendered by library
 * @param {Integer} target the target index of the point to be selected
 * @param {Integer} source the source index of the point to be slected
 * @param {Boolean} isMerge the flag to decide whether to add to current selection
 */
function selectDataPointOnChart( paramChartInstance, target, source, isMerge ) {
    if ( paramChartInstance && target !== undefined && source !== undefined && paramChartInstance.series[target] && paramChartInstance.series[target].data[source] ) {
        paramChartInstance.series[target].data[source].select( true, isMerge );
    }
}

/**
 * Method to calculate target series number when show range/show Goal command is selected
 * @param {*} cellInfo
 * @param {*} isShowGoal
 * @param {*} isShowRange
 * @returns {Number} the target series number
 */
function getTargetSeriesNumber( cellInfo, isShowGoal, isShowRange ) {
    var cell = cellInfo;
    if( cell.index === 'Measurement' ) {
        return getCellTarget( cell, isShowGoal, isShowRange, 0 );
    } else if( cell.index === 'Goal' ) {
        return getCellTarget( cell, isShowGoal, isShowRange, 1 );
    } else if( cell.index === 'Min' ) {
        return getCellTarget( cell, isShowGoal, isShowRange, 2 );
    } else if( cell.index === 'Max' ) {
        return getCellTarget( cell, isShowGoal, isShowRange, 3 );
    }
}

/**
 *
 * @param {*} cellInfo
 * @param {*} isShowGoal
 * @param {*} isShowRange
 * @returns
 */
function getCellTarget( cellInfo, isShowGoal, isShowRange, columnNo ) {
    var target = 0;
    if( isShowGoal && isShowRange ) {
        target = cellInfo.target * 4 + columnNo;
    } else if( isShowRange ) {
        target = cellInfo.target * 3 + columnNo;
    } else if( isShowGoal ) {
        target = cellInfo.target * 2 + columnNo;
    } else{
        target = cellInfo.target + columnNo;
    }
    return target;
}

/**
 * Method to perform cross probiing form chart to array parameter table
 * @param {Object} selectionData the point slected on chart by user
 * @param {Object} engrTable the Array table context
 */
export let handleChartPointSelection = function( selectionData ) {
    var paramChartInstance = getParameterChartInstance();
    if ( paramChartInstance ) {
        var allSeries = paramChartInstance.series;
        for ( let index = 0; index < allSeries.length; index++ ) {
            const series = allSeries[index];
            if( series.selected || series.state === 'hover' ) {
                var xValue = selectionData.xValue;
                var yValue = index;
                eventBus.publish( 'Att1MeasurementsView.selectCell', { row:xValue, col:yValue, isDataSelection:true, isCrossProbing:true } );
                break;
            }
        }
    }
};

/**
 * Method to show series for selected columns passed in input and hide rest of the series
 * @param {Array} selectedColumns the array if seletcted columns
 * @param {Object} paramChartInstance the highchart chart instance rendered by library
 */
export let updateChartWithSelectedColumns = function( selectedColumns, paramChartInstance, isShowGoal, isShowRange ) {
    if ( paramChartInstance ) {
        var allSeries = paramChartInstance.series;
        if( selectedColumns ) {
            for ( let index = 0; index < allSeries.length; index++ ) {
                const series = allSeries[index];
                series.setVisible( false, false );
                for ( let selectedIndex = 0; selectedIndex < selectedColumns.length; selectedIndex++ ) {
                    var columnNoToShow = selectedColumns[selectedIndex].index;
                    if( isShowGoal && isShowRange ) {
                        columnNoToShow = columnNoToShow * 4 - 3;
                    } else if( isShowRange ) {
                        columnNoToShow = columnNoToShow * 3 - 2;
                    } else if( isShowGoal ) {
                        columnNoToShow = columnNoToShow * 2 - 1;
                    }

                    if( index === columnNoToShow - 1 ) {
                        series.setVisible( true, false );
                        if( isShowGoal && isShowRange ) {
                            allSeries[index + 1].setVisible( true, false );
                            allSeries[index + 2].setVisible( true, false );
                            allSeries[index + 3].setVisible( true, false );
                            index += 3;
                        } else if( isShowGoal ) {
                            allSeries[index + 1].setVisible( true, false );
                            index += 1;
                        } else if( isShowRange ) {
                            allSeries[index + 1].setVisible( true, false );
                            allSeries[index + 2].setVisible( true, false );
                            index += 2;
                        }
                    }
                }
            }
        } else{
            for ( let index = 0; index < allSeries.length; index++ ) {
                const series = allSeries[index];
                series.setVisible( true, false );
            }
        }
    }
};

/**
 * Method to get the highchart instance for parameter table
 * @returns {Object} paramChartInstance the highchart chart instance rendered by library
 */
function getParameterChartInstance() {
    var chartInstance = awChartInstance.getHighchartsInstance();
    for ( var i = 0; i < chartInstance.charts.length; i++ ) {
        if ( chartInstance.charts[i] ) {
            var container = chartInstance.charts[i].container;
            if( container ) {
                while( container !== undefined && container !== null ) {
                    if( container?.getAttribute( 'id' ) !== null && container?.getAttribute( 'id' ) === 'complexParameterChart' ) {
                        return chartInstance.charts[i];
                    }
                    container = container?.parentElement;
                }
            }
        }
    }
    return null;
}

export let showLogarithmicScale = function() {
    var chart = getParameterChartInstance();
    var isLogarithmic = false;
    if( chart ) {
        if( chart.axes[1].userOptions.type === 'logarithmic' ) {
            chart.axes[1].update( { type:'linear' } );
        } else{
            chart.axes[1].update( { type:'logarithmic' } );
            isLogarithmic = true;
        }
    }
    return{
        isLogarithmicScale:isLogarithmic
    };
};

/**
 * Method to update the chart title
 * @param {String} newTitle the new title to be set
 */
export let setChartTitle = function( newTitle, xAxisLable ) {
    var chart = getParameterChartInstance();
    chart.setTitle( { text: newTitle } );
    chart.axes[0].setTitle( { text:xAxisLable } );
};

export default exports = {
    getChartData,
    updateChartData,
    selectChartPoint,
    handleChartPointSelection,
    setChartTitle,
    showLogarithmicScale,
    getDataForPoint,
    handleGoalRangeToggleInOnlyChartView
};
