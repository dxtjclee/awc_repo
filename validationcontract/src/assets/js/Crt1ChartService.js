// Copyright (c) 2022 Siemens

/**
 * This file populates data related to Reports Page
 *
 * @module js/Crt1ChartService
 */
import eventBus from 'js/eventBus';
import selectionService from 'js/selection.service';
import _cdm from 'soa/kernel/clientDataModel';
import getResultAndChartDataService from 'js/getResultAndChartDataService';

var exports = {};

var flagForFilter;

export let createPieChart = function( data ) {
    var isCreatePieChart = false;
    if( data.eventData.response.searchResultsJSON ) {
        var searchResults = JSON.parse( data.eventData.response.searchResultsJSON );
        if( searchResults ) {
            for( var x = 0; x < searchResults.objects.length; ++x ) {
                var uid = searchResults.objects[ x ].uid;
                var obj = _cdm.getObject( uid );
                if( obj.props.att1AttrInOut && obj.props.att1AttrInOut.dbValues[0] === 'output' ) {
                    isCreatePieChart = true;
                }
            }
        }
    }
    clearProviderSelection( data );
    var paraPassCount = 0;
    var paraFailCount = 0;
    var paraUnprocessCount = 0;
    var chartDataFromSOA = [];
    var displayLabels = [];
    var parameterChartData = [];
    if( data && data.eventData && data.eventData.response && data.eventData.response.additionalSearchInfoMap &&
        data.eventData.response.additionalSearchInfoMap.searchTermsToHighlight ) {
        parameterChartData = data.eventData.response.additionalSearchInfoMap.searchTermsToHighlight;
    }else{
        parameterChartData = data.eventMap['uniformParamTable.processResponse'].response.additionalSearchInfoMap.searchTermsToHighlight;
    }

    if( data.i18n ) {
        displayLabels = [ data.i18n.NoResult, data.i18n.Fail, data.i18n.Pass ];
    }
    if( parameterChartData !== undefined && isCreatePieChart ) {
        chartDataFromSOA = parameterChartData;
        if( chartDataFromSOA.length > 0 ) {
            var value1 = chartDataFromSOA[ 0 ];
            var value2 = chartDataFromSOA[ 1 ];
            var value3 = chartDataFromSOA[ 2 ];

            const ndx1 = value1.indexOf( ':' );
            paraUnprocessCount = parseInt( value1.substring( ndx1 + 1 ) );

            const ndx2 = value2.indexOf( ':' );
            paraPassCount = parseInt( value2.substring( ndx2 + 1 ) );

            const ndx3 = value3.indexOf( ':' );
            paraFailCount = parseInt( value3.substring( ndx3 + 1 ) );
        }
        var arrayOfSeriesDataForChart = [];
        var dummyValuesForFirstSeries = [];
        dummyValuesForFirstSeries = [ paraUnprocessCount, paraFailCount, paraPassCount ]; // values of pie chart
        var keyValueDataForChart = [];

        for( var j = 0; j < dummyValuesForFirstSeries.length; j++ ) {
            keyValueDataForChart.push( {
                label: displayLabels[ j ],
                value: dummyValuesForFirstSeries[ j ],
                name: displayLabels[ j ],
                y: dummyValuesForFirstSeries[ j ]
            } );
        }
        arrayOfSeriesDataForChart.push( {
            seriesName: data.i18n.Parameters,
            colorByPoint: true,
            keyValueDataForChart: keyValueDataForChart
        } );
        return arrayOfSeriesDataForChart;
    }
};

export let reloadTable = function( vrSublocationState, scopeSel, subPanelContext ) {
    eventBus.publish( 'uniformParamTable.reloadTable' );
    exports.getResultSOAInputForComplexParameter( subPanelContext.context.vrSublocationState.allRows, scopeSel, subPanelContext );
};

export let getResultSOAInputForComplexParameter = function( visibleProxies, scopeSel, subPanleCtx ) {
    var inputProxyData = [];
    let scopeObjects = [];
    scopeSel = subPanleCtx.context.vrSublocationState.mselected[ 0 ];
    let scopeTreeObjects = subPanleCtx.context.vrSublocationState.mselected;
    //Current selection in scope tree should be sent at first position
    scopeObjects.push( scopeSel );
    //Skip the currently selected object from scope tree objects as its already there at first position
    if( scopeTreeObjects.length > 1 ) {
        for( let j = 0; j < scopeTreeObjects.length; j++ ) {
            if( scopeSel.uid !== scopeTreeObjects[ j ].uid ) {
                scopeObjects.push( scopeTreeObjects[ j ] );
            }
        }
    }
    if( visibleProxies && visibleProxies.length > 0 ) {
        for( var i = 0; i < visibleProxies.length; i++ ) {
            var inputProxyDataObj = {};
            inputProxyDataObj.contentObject = {
                type: visibleProxies[ i ].type,
                uid: visibleProxies[ i ].uid
            };
            inputProxyDataObj.result = '';
            inputProxyDataObj.resultInfo = '';
            inputProxyData.push( inputProxyDataObj );
        }
    }

    var additionalInfo = {
        key: []
    };

    let scopeSelectionInfo = {
        contentObject: {
            type: subPanleCtx.selection[ 0 ].type,
            uid: subPanleCtx.selection[ 0 ].uid
        },
        result: '',
        resultInfo: ''
    };
    getResultAndChartDataService.callGetResultAndChartDataSOA( scopeSelectionInfo, inputProxyData, additionalInfo, subPanleCtx );
};
export let clearProviderSelection = function( data ) {
    if( data && data.dataProviders && data.dataProviders.uniformParamDataProvider ) {
        var dataProvider = data.dataProviders.uniformParamDataProvider;
        if( dataProvider ) {
            dataProvider.selectNone();
        }
    }
};

/**
 * this function is used to filter the Parameters Table when a particular section of the pie chart is selected
 * @param {object} data data
 */
export let filterTable = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.Parameters ) {
        var selectedLabel = data.eventMap[ 'undefined.selected' ].label;
        if( chartProp && chartProp.value && chartProp.pieChartData && chartProp.update ) {
            const vrSubState = { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables.parameterPieClicked = true;
            chartProp.update && chartProp.update( vrSubState );
        }

        if( data.eventData.label !== selectedLabel ) {
            flagForFilter = true;
        } else {
            flagForFilter = false;
        }

        data.eventData.label = selectedLabel;
        if( data.eventData.label === data.i18n.Pass || data.eventData.label === data.i18n.Fail ) {
            var paramTableColumnFilters =  [ {

                columnName: 'att1Result',
                operation: 'equals',
                values: [ data.eventData.label ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            paramTableColumnFilters =  [ {

                columnName: 'att1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            }, {

                columnName: 'att1AttrInOut',
                operation: 'equals',
                values: [ data.i18n.Output ]

            } ];
        }

        var inputData = {
            columnFilters : paramTableColumnFilters,
            searchCriteria:{}
        };
        return {
            inputData : inputData
        };
    }
};

/**
 * this function is used to filter the Parameters Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAll = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.Parameters ) {
        if( chartProp && chartProp.value && chartProp.pieChartData && chartProp.update ) {
            const vrSubState =  { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables.parameterPieClicked = false;
            chartProp.update && chartProp.update( vrSubState );
        }

        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            var inputData = {
                columnFilters: [],
                searchCriteria:{}
            };
            return {
                inputData: inputData
            };
        }
    }
};

export let changeSelectionToAttribute = function( selectedObjects, scopeSelection, vrSublocationState ) {
    var correctedSelection = [];
    var parentSelection;
    var newSelection = null;
    var isSetUsageInput = false;
    var isSetUsageOutput = false;
    var isSetUsageUnused = false;
    if( selectedObjects.length === 0 ) {
        var selection = selectionService.getSelection();
        if( selection.parent ) {
            parentSelection = selection.parent;
        }
        if( scopeSelection ) {
            newSelection = scopeSelection;
        }
        correctedSelection.push( newSelection );
        if( correctedSelection.length > 0 ) {
            selectionService.updateSelection( correctedSelection, parentSelection );
        }
    } else {
        selection = selectionService.getSelection();
        if( selection.parent ) {
            parentSelection = selection.parent;
        }
        for( var j = 0; j < selectedObjects.length; ++j ) {
            correctedSelection.push( selectedObjects[ j ] );
            if( selectedObjects[ j ].props.att1AttrInOut.dbValues[ 0 ] !== 'input' && selectedObjects[ j ].props.is_modifiable.dbValues[ 0 ] === '1' ) {
                isSetUsageInput = true;
            }
            if( selectedObjects[ j ].props.att1AttrInOut.dbValues[ 0 ] !== 'output' && selectedObjects[ j ].props.is_modifiable.dbValues[ 0 ] === '1' ) {
                isSetUsageOutput = true;
            }
            if( selectedObjects[ j ].props.att1AttrInOut.dbValues[ 0 ] !== 'unused' && selectedObjects[ j ].props.is_modifiable.dbValues[ 0 ] === '1' ) {
                isSetUsageUnused = true;
            }
        }
        if( correctedSelection.length > 0 ) {
            selectionService.updateSelection( correctedSelection, parentSelection );
        }
        const newObjVRState = { ...vrSublocationState.value };
        newObjVRState.parameterTableSelection = selectedObjects;
        newObjVRState.isSetUsageInput = isSetUsageInput;
        newObjVRState.isSetUsageOutput = isSetUsageOutput;
        newObjVRState.isSetUsageUnused = isSetUsageUnused;
        vrSublocationState.update && vrSublocationState.update( newObjVRState );
    }
    if( vrSublocationState && vrSublocationState.refreshPreviewPanel ) {
        eventBus.publish( 'refreshPreviewPanel' );
    }
};

export let reloadTableForParameterProject = function( data, subPanelContext ) {
    if( data && data.eventData && data.eventData.state && data.eventData.state === 'saved' && subPanelContext && subPanelContext.openedObject && subPanelContext.openedObject.props && subPanelContext
        .openedObject.props.crt0VerificationType &&
            subPanelContext.openedObject.props.crt0VerificationType.dbValues && subPanelContext.openedObject.props.crt0VerificationType.dbValues[ 0 ] &&
            subPanelContext.openedObject.props.crt0VerificationType.dbValues[ 0 ] === 'Project' ) {
        eventBus.publish( 'uniformParamTable.reloadTable' );
    }
};

export default exports = {
    createPieChart,
    reloadTable,
    filterTable,
    displayAll,
    changeSelectionToAttribute,
    clearProviderSelection,
    reloadTableForParameterProject,
    getResultSOAInputForComplexParameter

};
