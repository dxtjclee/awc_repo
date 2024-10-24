// Copyright (c) 2022 Siemens

/**
 * This file populates data related to Reports Page
 *
 * @module js/Crt1BarChartService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import selectionService from 'js/selection.service';
import adapterSvc from 'js/adapterService';


var exports = {};
var flagForFilter;
var barChartColumnFilters;
var trendPageFirstTimeLoad = false;


export let cleanUpBarChartData = function( ) {
    trendPageFirstTimeLoad = false;
    barChartColumnFilters = '';
};
export let loadStudyObjects = function( arUID, data ) {
    var arObj = cdm.getObject( arUID );
    var studyNames = [];
    var noRequests = false;
    var ARtotalStudies = false;
    var studies = arObj.props.crt0ChildrenStudies.dbValues;
    if( studies && studies.length === 0 ) {
        noRequests = true;
    }
    for( var i = 0; i < studies.length; i++ ) {
        var studyObject = cdm.getObject( studies[ i ] );
        if( studyObject ) {
            var studyName = studyObject.props.object_name.dbValues[ 0 ];
            studyNames.push( studyName );
        }
    }

    if( studies.length === 1 || studies.length > 1 ) {
        var parentUids = studies[ 0 ];
        for( var j = 1; j < studies.length; j++ ) {
            parentUids = parentUids.concat( '#', studies[ j ] );
        }
    }
    //When trends page is loading 1st time
    if ( trendPageFirstTimeLoad === false && data && data.data && !data.data.ARStudyUids ) {
        trendPageFirstTimeLoad = true;
        ARtotalStudies = true;
    }
    //For Add and Delete VR children.
    else if ( data && data.data && data.data.ARStudyUids && studies.length !== data.data.ARStudyUids.length ) {
        ARtotalStudies = true;
    }

    return {
        ARStudyNames : studyNames,
        ARStudyUids: studies,
        ARStudies : parentUids,
        noRequests:noRequests,
        ARtotalStudies:ARtotalStudies
    };
};

export let createBarChart = function( data ) {
    var arrayOfSeriesDataForChart = [];
    var StudyUids = data.ARStudyUids;
    var StudyNames = data.ARStudyNames;
    var studytObjectUid = null;
    var pass = [];
    var fail = [];
    var unprocess = [];
    var noOutputParameter = false;
    var countZero = true;

    for( var j = 0; j < StudyUids.length; j++ ) {
        var paraPassCount = 0;
        var paraFailCount = 0;
        var paraUnprocessCount = 0;

        pass[ j ] = 0;
        fail[ j ] = 0;
        unprocess[ j ] = 0;

        if( data.selectedAttrProxyObjects2 && data.selectedAttrProxyObjects2.ServiceData.plain ) {
            for( var i = 0; i < data.selectedAttrProxyObjects2.ServiceData.plain.length; i++ ) {
                var proxyObject = cdm.getObject( data.selectedAttrProxyObjects2.ServiceData.plain[ i ] );
                if( proxyObject.props && proxyObject.props.att1ContextObject ) {
                    var studytObject = cdm.getObject( proxyObject.props.att1ContextObject.dbValues[ 0 ] );
                    studytObjectUid = studytObject.uid;
                }

                if( studytObjectUid && StudyUids[ j ] === studytObjectUid ) {
                    if( proxyObject.type === 'Att1AttributeAlignmentProxy' ) {
                        if( proxyObject.props.att1AttrInOut.dbValues[ 0 ] === 'output' ) {
                            if( proxyObject.props.att1Result.dbValues[ 0 ] === '200' ) {
                                pass[ j ] = paraPassCount++;
                            } else if( proxyObject.props.att1Result.dbValues[ 0 ] === '100' ) {
                                fail[ j ] = paraFailCount++;
                            } else if( proxyObject.props.att1Result.dbValues[ 0 ] === '' ) {
                                unprocess[ j ] = paraUnprocessCount++;
                            }
                        }
                    }
                }
            }
        }
        pass[ j ] = paraPassCount;
        fail[ j ] = paraFailCount;
        unprocess[ j ] = paraUnprocessCount;
    }
    for( var i = 0; i < pass.length; i++ ) {
        if( pass[ i ] > 0 || fail[ i ] > 0 || unprocess[ i ] > 0 ) {
            countZero = false;
        }
    }
    if( countZero === false ) {
        var keyValueDataForChart1 = [];
        var keyValueDataForChart2 = [];
        var keyValueDataForChart3 = [];

        for( var n = 0; n < unprocess.length; n++ ) {
            keyValueDataForChart1.push( {
                label: StudyNames[ n ],
                value: unprocess[ n ],
                y: unprocess[ n ]
            } );
        }

        arrayOfSeriesDataForChart.push( {
            seriesName: data.i18n.NoResult,
            colorByPoint: true,
            keyValueDataForChart: keyValueDataForChart1
        } );

        for( var k = 0; k < fail.length; k++ ) {
            keyValueDataForChart2.push( {
                label: StudyNames[ k ],
                value: fail[ k ],
                y: fail[ k ]
            } );
        }

        arrayOfSeriesDataForChart.push( {
            seriesName: data.i18n.Fail,
            colorByPoint: true,
            keyValueDataForChart: keyValueDataForChart2
        } );

        for( var m = 0; m < pass.length; m++ ) {
            keyValueDataForChart3.push( {
                label: StudyNames[ m ],
                value: pass[ m ],
                y: pass[ m ]
            } );
        }

        arrayOfSeriesDataForChart.push( {
            seriesName: data.i18n.Pass,
            colorByPoint: true,
            keyValueDataForChart: keyValueDataForChart3
        } );

        return arrayOfSeriesDataForChart;
    }
};

/**
 * this function is used to filter the Study Parameters Table when a particular section of the bar chart is selected
 * @param {object} data data
 */
export let filterStudyTable = function( data ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.Pass ||
        data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.Fail ||
        data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.NoResult ) {
        var selectedSeriesName = data.eventMap[ 'undefined.selected' ].seriesName;
        var selectedLabel = data.eventMap[ 'undefined.selected' ].label;
        if( data.eventData.seriesName !== selectedSeriesName || data.eventData.label !== selectedLabel ) {
            flagForFilter = true;
        } else {
            flagForFilter = false;
        }
        data.eventData.seriesName = selectedSeriesName;
        data.eventData.label = selectedLabel;
        if( data.eventData.seriesName === data.i18n.Pass || data.eventData.seriesName === data.i18n.Fail ) {
            var studyTableColumnFilters = [ {
                columnName: 'att1Result',
                operation: 'equals',
                values: [ data.eventData.seriesName ]
            } ];
        } else if( data.eventData.seriesName === data.i18n.NoResult ) {
            studyTableColumnFilters = [ {
                columnName: 'att1Result',
                operation: 'equals',
                values: [ '', '<>' ]
            }, {
                columnName: 'att1AttrInOut',
                operation: 'equals',
                values: [ data.i18n.Output ]
            } ];
        }
        var studies1 = [];
        for( var i = 0; i < data.ARStudyNames.length; i++ ) {
            if( data.ARStudyNames[ i ] === data.eventData.label ) {
                let testIterationObj = cdm.getObject( data.ARStudyUids[ i ] );
                studies1.push( testIterationObj );
            }
        }
        var inputData = {
            columnFilters : studyTableColumnFilters,
            selectedParents: studies1

        };
        barChartColumnFilters = inputData;
        return {
            inputData : inputData
        };
    }
};

/**
 * this function is used to filter the Study Parameters Table when a particular section of the bar chart is un-selected
 * @param {object} data data
 */
export let displayAll = function( data ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.Pass ||
        data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.Fail ||
        data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.Pass ||
        data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.Fail ||
        data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.NoResult ) {
        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            var studyTableColumnFilters = [];
            barChartColumnFilters = '';
            var StudyUids = [];
            if(  data.data.eventMap && data.data.eventMap['ObjectSet_1_Provider.selectionChangeEvent'] && data.data.eventMap['ObjectSet_1_Provider.selectionChangeEvent'].selectedUids.length >= 1 &&
            data.subPanelContext && data.subPanelContext.context.openedObject && data.data.eventMap['ObjectSet_1_Provider.selectionChangeEvent'].selectedUids[ 0 ] !== data.subPanelContext.context.openedObject.uid  ) {
                let selectedUids1  = data.data.eventMap['ObjectSet_1_Provider.selectionChangeEvent'].selectedUids;
                for( var i = 0; i < selectedUids1.length; i++ ) {
                    let testIterationObj = cdm.getObject( selectedUids1[ i ] );
                    StudyUids.push( testIterationObj );
                }
            }
            var inputData = {
                columnFilters : studyTableColumnFilters,
                selectedParents: StudyUids
            };
            return {
                inputData : inputData
            };
        }
    }
};

export let checkAndReloadBarChart = function( data ) {
    if( data.eventData !== undefined ) {
        var state = data.eventData.state;
        if( state === 'saved' && data.chartProviders.pieChartProvider2 ) {
            eventBus.publish( 'getParamOfStudies' );
            eventBus.publish( 'cdm.relatedModified', {
                refreshLocationFlag: true,
                relatedModified: [ data.ctx.xrtSummaryContextObject ]
            } );
        }
    }
};

export let checkIfStudyORARSelected = function( data ) {
    var inputData = {};
    //When single/multiple objects are selected from Study table
    if( data && data.eventData && data.eventData.selectedUids.length > 0 && data.eventData.dataProvider.selectedObjects.length > 0 ) {
        var selectedParents = adapterSvc.getAdaptedObjectsSync( data.eventData.selected );
        inputData = {
            selectedParents: selectedParents
        };
    }
    //when study is de-selected from test iterations table, and if bar chart is in filter state, then show parameters for clicked bar
    else if( data && data.eventData && data.eventData.dataProvider && data.eventData.dataProvider.selectedObjects && data.eventData.dataProvider.selectedObjects.length === 0 &&
        barChartColumnFilters && barChartColumnFilters.columnFilters ) {
        inputData = barChartColumnFilters;
    }
    //When element is de-selected from Test Iteration table.
    else {
        inputData = {
            selectedParents: []
        };
    }

    return {
        inputData: inputData
    };
};

export let handleSelectionChange = function( tableProvider, subPanelContext ) {
    var array = [];
    if( tableProvider && tableProvider.selectedObjects && tableProvider.selectedObjects.length > 0 ) {
        for( var i = 0; i < tableProvider.selectedObjects.length; i++ ) {
            var providerSelection = cdm.getObject( tableProvider.selectedObjects[ i ].props.awp0Secondary.dbValue );
            array.push( providerSelection );
        }
    }
    //updating ctx.selected as Info panel reads data from ctx.selected
    var parentSelection;
    var selection = selectionService.getSelection();
    if( selection.parent ) {
        parentSelection = selection.parent;
    }
    if( array.length > 0 ) {
        selectionService.updateSelection( array, parentSelection );
    }
};

export default exports = {
    loadStudyObjects,
    createBarChart,
    filterStudyTable,
    displayAll,
    checkAndReloadBarChart,
    checkIfStudyORARSelected,
    handleSelectionChange,
    cleanUpBarChartData
};
