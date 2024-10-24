// Copyright (c) 2021 Siemens

/**
 * @module js/Crt1TestResultTreeTableService
 */
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import parsingUtils from 'js/parsingUtils';
import iconSvc from 'js/iconService';
import awColumnSvc from 'js/awColumnService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _cdm from 'soa/kernel/clientDataModel';
import uwPropertySvc from 'js/uwPropertyService';
import lovService from 'js/lovService';
import dynamicTableUtils from 'js/dynamicTableUtils';
import getResultAndChartDataService from 'js/getResultAndChartDataService';
import eventBus from 'js/eventBus';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import cssUtils from 'js/cssUtils.service';

var _promiseColumnConfig = null;
var _columnConfigData = null;
var exports = {};
var _deferExpandTreeNodeArray = [];
var _treeColumnInfos = [];
var flagForFilter;
let prevSelection = null;
var policyIOverride = {
    types: [ {
        name: 'Crt1VRContentProxy',
        properties: [ {
            name: 'crt1UnderlyingObject'
        }, {
            name: 'crt1SourceObject',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }, {
            name: 'crt1HasChildren'
        } ]
    } ]
};

function promiseColumnConfig() {
    var deferred = AwPromiseService.instance.defer();

    if ( _promiseColumnConfig.promise ) {
        _promiseColumnConfig.promise.then(

            function() {
                deferred.resolve();
            },
            function() {
                deferred.reject();
            } );
    } else {
        deferred.reject();
    }

    return deferred.promise;
}

function _buildTreeTableStructure( parentNode, deferred, treeLoadInput, columnProviders, parentUid, scopeURI, data ) {
    var parentUids = '';
    if ( parentNode.type === 'rootType' ) {
        parentUids = parentUid.selection[0].uid;
        for ( var i = 1; i < parentUid.selection.length; i++ ) {
            parentUids = parentUids.concat( '#', parentUid.selection[i].uid );
        }
    } else {
        parentUids = parentNode.uid;
    }
    var columnFilters = [];
    if ( data.data.columnFilter && data.data.columnFilter.length > 0 ) {
        columnFilters = data.data.columnFilter;
    }

    var productContextUids = '';
    if ( parentUid.context && parentUid.context.occContext && parentUid.context.occContext.productContextInfo ) {
        productContextUids = parentUid.context.occContext.productContextInfo.uid;
    }
    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: scopeURI
        },
        searchInput: {
            maxToLoad: 30,
            maxToReturn: 30,
            providerName: 'Crt1AnalysisRequestOutProvider',
            searchCriteria: {
                dcpSortByDataProvider: 'true',
                parentUids: parentUids,
                productContextInfo: productContextUids
            },
            startIndex: treeLoadInput.startChildNdx,
            columnFilters: columnFilters,
            searchFilterFieldSortType: 'Alphabetical',
            searchSortCriteria: columnProviders.sortCriteria
        },
        inflateProperties: false
    };

    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.uid;
    treeLoadInput.displayMode = 'Tree';

    exports.getDataFromProvider( deferred, treeLoadInput, soaInput, columnFilters, data );
}


export let getDataFromProvider = function( deferred, treeLoadInput, soaInput, columnFilters, data ) {
    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput, policyIOverride ).then(
        function( response ) {
            var collabObjects = [];

            if ( response.searchResultsJSON ) {
                var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                if ( searchResults ) {
                    for ( var x = 0; x < searchResults.objects.length; ++x ) {
                        var uid = searchResults.objects[x].uid;
                        var obj = response.ServiceData.modelObjects[uid];
                        if ( obj ) {
                            dmSvc.getProperties( [ obj ], [ 'object_name' ] );
                            collabObjects.push( obj );
                        }
                    }
                }
            }

            var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
            var startReachedVar = true;
            var treeLoadResult = processProviderResponse( treeLoadInput, collabObjects, startReachedVar,
                endReachedVar );
            treeLoadResult.parentNode.cursorObject = response.cursor;
            var testResultColumnFilters = columnFilters;
            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                columnFilter: testResultColumnFilters
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
};

function processProviderResponse( treeLoadInput, searchResults, startReached, endReached ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var vmNodes = [];

    var parentNode = treeLoadInput.parentNode;
    var levelNdx = parentNode.levelNdx + 1;

    for ( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[childNdx];

        var vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx );
        if ( vmNode ) {
            vmNodes.push( vmNode );
            if ( !vmNode.isLeaf ) {
                _deferExpandTreeNodeArray.push( vmNode );
            }
        }
    }

    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
        endReached, null );
}

function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx ) {
    var noOfChildren;
    if ( obj.props && obj.props.crt1UnderlyingObject && obj.props.crt1UnderlyingObject.uiValues ) {
        var displayName = obj.props.crt1UnderlyingObject.uiValues[0];
    }
    if ( obj.props && obj.props.crt1HasChildren && obj.props.crt1HasChildren.dbValues ) {
        noOfChildren = obj.props.crt1HasChildren.dbValues[0];
    }
    var hasChildren = containChildren( noOfChildren );
    var iconURL;

    // get Icon for node
    var underlyingObj = _cdm.getObject( obj.props.crt1UnderlyingObject.dbValues[0] );
    if ( underlyingObj && underlyingObj.type ) {
        iconURL = iconSvc.getTypeIconURL( underlyingObj.type );
    }
    var vmNode = awTableTreeSvc
        .createViewModelTreeNode( obj.uid, obj.type, displayName, levelNdx, childNdx, iconURL );

    vmNode.isLeaf = !hasChildren;
    return vmNode;
}

function containChildren( noOfChildren ) {
    if ( noOfChildren && noOfChildren !== '0' ) {
        return true;
    }
    return false;
}

export let loadTestResultTreeData = function( treeLoadInput, columnProviders, parentUid, data ) {
    /**
     * Check the validity of the parameters
     */
    var scopeURI = 'AnalysisRequestPlanTable';
    var deferred = AwPromiseService.instance.defer();

    /**
     * Get the 'child' nodes async
     */
    if( treeLoadInput ) {
        _buildTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput, columnProviders, parentUid, scopeURI, data );
    } else {
        deferred.resolve();
    }

    return deferred.promise;
};

export let loadTestResultTreeTableProperties = function( propertyLoadInput, data ) {
    var scopeURI = 'AnalysisRequestPlanTable';
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if ( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput, data, scopeURI );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

function _loadProperties( propertyLoadInput, data, scopeURI ) {
    var allChildNodes = [];
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: scopeURI
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if ( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            if ( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
                dynamicTableUtils.addExtraColumn( propertyLoadResult.columnConfig.columns );
            }
            _.forEach( allChildNodes, function( childNode ) {
                var prop = uwPropertySvc.createViewModelProperty();
                prop.propertyName = 'crt1Result';
                prop.parentUid = childNode.uid;
                prop.hasLov = true;
                prop.uwAnchor = '';
                prop.type = 'STRING';
                prop.propApi = {};
                prop.maxLength = 32;
                prop.isDCP = false;
                prop.initialize = false;
                uwPropertySvc.setArrayLength( prop, 1 );
                if ( childNode.modelType ) {
                    prop.propertyDescriptor = childNode.modelType.propertyDescriptorsMap.crt1Result;
                }
                lovService.initNativeCellLovApi( prop, null, 'EDIT', childNode );
                childNode.props.crt1Result = prop;
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[vmProp.propertyName] = vmProp;
                    var propColumns = propertyLoadResult.columnConfig.columns;
                    _.forEach( propColumns, function( col ) {
                        if ( !col.typeName && col.associatedTypeName ) {
                            col.typeName = col.associatedTypeName;
                        }
                    } );
                } );
            } );
            //update viewModelProperties
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
}

function queryColumnConfig( scopeURI ) {
    // Get Column data

    var getOrResetUiConfigsIn = {
        scope: 'LoginUser',
        scopeName: '',
        clientName: 'AWClient',
        resetColumnConfig: false,
        columnConfigQueryInfos: [ {
            clientScopeURI: scopeURI,
            operationType: 'as_configured',
            typeNames: [ 'Awb0Element' ],
            columnsToExclude: []
        } ],

        businessObjects: [ {} ]
    };

    var soaInput = {
        getOrResetUiConfigsIn: [ getOrResetUiConfigsIn ]
    };

    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', soaInput ).then(
        function( response ) {
            // Process returned column data

            var columns;

            if ( _isArrayPopulated( response.columnConfigurations ) ) {
                var columnConfigurations = response.columnConfigurations[0];

                if ( _isArrayPopulated( columnConfigurations.columnConfigurations ) ) {
                    columnConfigurations = columnConfigurations.columnConfigurations;

                    if ( _isArrayPopulated( columnConfigurations ) ) {
                        columns = _processUiConfigColumns( columnConfigurations[0].columns );
                    }
                }
            }

            _columnConfigData = { columnInfos: columns };

            _promiseColumnConfig.resolve();
        },
        function( error ) {
            _promiseColumnConfig.reject( error );
        } );
}

function _isArrayPopulated( object ) {
    var isPopulated = false;
    if ( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
}

function _processUiConfigColumns( columns ) {
    // Save Column data for later arrange
    _treeColumnInfos = [];

    for ( var idx = 0; idx < columns.length; ++idx ) {
        var columnInfo = awColumnSvc.createColumnInfo( {
            name: columns[idx].propertyName,
            propertyName: columns[idx].propertyName,
            displayName: columns[idx].displayName,
            typeName: columns[idx].associatedTypeName || columns[idx].typeName,
            maxWidth: 400,
            minWidth: 60,
            hiddenFlag: columns[idx].hiddenFlag,
            pixelWidth: columns[idx].pixelWidth,
            width: columns[idx].pixelWidth,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableSorting: false,
            enableColumnMoving: true,
            isTextWrapped: columns[idx].isTextWrapped
        } );
        _treeColumnInfos.push( columnInfo );
    }

    if ( _treeColumnInfos.length > 0 ) {
        _treeColumnInfos[0].isTreeNavigation = true;
        _treeColumnInfos[0].enableColumnMoving = false;
        _treeColumnInfos[0].pinnedLeft = true;
    }

    return _treeColumnInfos;
}

export let loadTestResultTreeTableColumns = function( data ) { // Get the column config
    var scopeURI = 'AnalysisRequestPlanTable';
    _promiseColumnConfig = AwPromiseService.instance.defer();

    let columnConfigUri = 'AnalysisRequestPlanTable';

    data.columnConfigForDataProvider = columnConfigUri;

    queryColumnConfig( scopeURI );


    return promiseColumnConfig().then( function() {
        return _columnConfigData;
    } );
};

export let updateSelectionData = function( subPanelContext, localSelData ) {
    var array = [];
    var parentUids = '';
    var openedObjectUid = '';
    var inputData = {};
    if ( localSelData && localSelData.selected && localSelData.selected.length > 0 ) {
        var selectionUid = localSelData.selected[0].props.crt1UnderlyingObject.dbValue;
        var selection = _cdm.getObject( selectionUid );
        parentUids = selection.uid;
        openedObjectUid = parentUids;
        array.push( selection );
        if ( subPanelContext.selectionData.value ) {
            const tmpSelectionData = { ...subPanelContext.selectionData.value };
            tmpSelectionData.selected = array;
            subPanelContext.selectionData.update( tmpSelectionData );
        }
        if ( selection && selection.modelType && selection.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) === -1 ) {
            parentUids = '';
            openedObjectUid = '';
        }
    }
    inputData = {
        searchCriteria: {
            parentUids: parentUids,
            openedObjectUid: openedObjectUid
        }
    };
    return {
        inputData: inputData
    };
};

export let showHideParaTable = function( commandContext ) {
    if ( !commandContext.vrTestResultsTabState.showHideParaCommand ) {
        let newVrTestResultsTabState = { ...commandContext.vrTestResultsTabState.value };
        newVrTestResultsTabState.showHideParaCommand = true;
        commandContext.vrTestResultsTabState && commandContext.vrTestResultsTabState.update( newVrTestResultsTabState );
    } else {
        let newVrTestResultsTabState = { ...commandContext.vrTestResultsTabState.value };
        newVrTestResultsTabState.showHideParaCommand = false;
        commandContext.vrTestResultsTabState && commandContext.vrTestResultsTabState.update( newVrTestResultsTabState );
    }
};
/*
 * Preparing Inputs for getResultsAndCharts SOA
 */
export let getResultAndExecutionSOAInputForPageLoad = function( subPanleCtx ) {
    var additionalInfo = {
        'Test Results' :  [ subPanleCtx.context.occContext.productContextInfo.uid ]
    };

    let scopeSelectionInfo = [];
    for( let i = 0; i < subPanleCtx.selection.length; ++i ) {
        let obj = {
            contentObject: {
                type: subPanleCtx.selection[i].type,
                uid: subPanleCtx.selection[i].uid
            },
            result: '',
            resultInfo: ''
        };
        scopeSelectionInfo.push( obj );
    }
    getResultAndChartDataService.callGetResultAndChartDataSOAForResultAndExecution( scopeSelectionInfo, additionalInfo, subPanleCtx );
};

/*
 * Draw Result Pie chart
 */
export let createPieChartForResult = function( data, resultPieChart, sublocationState ) {
    if( data && data.chartProviders ) {
        let chartProviders = _.clone( data.chartProviders );
        var chartColorOverrideClass = 'aw-verificationManagement-chartStatusColor';
        var resultChartColor = cssUtils.getColumnChartColors( chartColorOverrideClass );
        chartProviders.pieChartForResult.chartConfig.plotOptions = {
            pie: {
                allowPointSelect: true,
                colorByPoint: true,
                colors: resultChartColor,
                dataLabels: {
                    format: '{point.y} {point.name}'
                },
                showInLegend: false
            }
        };

        var resultPassCount = 0;
        var resultFailCount = 0;
        var resultUnprocessCount = 0;
        var resultBlockedCount = 0;
        var resultCautionCount = 0;
        var displayLabels = [];
        var arrayOfSeriesDataForResultPieChart = [];
        var dummyValuesForFirstSeries = [];
        var keyValueDataForChart = [];
        var redrawResult = data.redrawResult;

        if( resultPieChart !== undefined && resultPieChart.chartData ) {
            let value1 = resultPieChart.chartData.unused;
            let value2 = resultPieChart.chartData.pass;
            let value3 = resultPieChart.chartData.fail;
            let value4 = resultPieChart.chartData.blocked;
            let value5 = resultPieChart.chartData.caution;

            const ndx1 = value1.indexOf( ':' );
            resultUnprocessCount = parseInt( value1.substring( ndx1 + 1 ) );

            const ndx2 = value2.indexOf( ':' );
            resultPassCount = parseInt( value2.substring( ndx2 + 1 ) );

            const ndx3 = value3.indexOf( ':' );
            resultFailCount = parseInt( value3.substring( ndx3 + 1 ) );

            const ndx4 = value4.indexOf( ':' );
            resultBlockedCount = parseInt( value4.substring( ndx4 + 1 ) );

            const ndx5 = value5.indexOf( ':' );
            resultCautionCount = parseInt( value5.substring( ndx5 + 1 ) );

            dummyValuesForFirstSeries = [ resultUnprocessCount, resultFailCount, resultPassCount, resultBlockedCount, resultCautionCount ]; // values of pie chart
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

            arrayOfSeriesDataForResultPieChart.push( {
                seriesName: data.i18n.Result,
                colorByPoint: true,
                keyValueDataForChart: keyValueDataForChart
            } );
            return {
                arrayOfSeriesDataForResultPieChart: arrayOfSeriesDataForResultPieChart,
                redrawResult: redrawResult,
                chartProviders: chartProviders
            };
        }
    }
};


/*
 * Draw Execution Pie chart
 */
export let createPieChartForExecution = function( data, executionPieChart ) {
    if( data && data.chartProviders ) {
        let chartProviders = _.clone( data.chartProviders );
        var chartColorOverrideClass = 'aw-verificationManagement-executionChartColor';
        var executionChartColor = cssUtils.getColumnChartColors( chartColorOverrideClass );
        chartProviders.pieChartForExecution.chartConfig.plotOptions = {
            pie: {
                allowPointSelect: true,
                colorByPoint: true,
                colors: executionChartColor,
                dataLabels: {
                    format: '{point.y} {point.name}'
                },
                showInLegend: false
            }
        };

        var executionNotStartedCount = 0;
        var executionPlannedCount = 0;
        var executionNotPlannedCount = 0;
        var executionDuplicateCount = 0;
        var executionInProgressCount = 0;
        var executionBlockedCount = 0;
        var executionWarningCount = 0;
        var executionCompletedCount = 0;
        var executionFailedCount = 0;
        var executionPreparationCount = 0;
        var executionReadyCount = 0;
        var executionPausedCount = 0;
        var displayLabels = [];
        var arrayOfSeriesDataForExecutionPieChart = [];
        var dummyValuesForFirstSeries = [];
        var keyValueDataForChart = [];
        var redrawExecution = data.redrawExecution;

        if( executionPieChart !== undefined && executionPieChart.chartData ) {
            let value1 = executionPieChart.chartData.notStarted;
            let value2 = executionPieChart.chartData.planned;
            let value3 = executionPieChart.chartData.notPlanned;
            let value4 = executionPieChart.chartData.duplicate;
            let value5 = executionPieChart.chartData.inProgress;
            let value6 = executionPieChart.chartData.blocked;
            let value7 = executionPieChart.chartData.warning;
            let value8 = executionPieChart.chartData.completed;
            let value9 = executionPieChart.chartData.failed;
            let value10 = executionPieChart.chartData.paused;
            let value11 = executionPieChart.chartData.ready;
            let value12 = executionPieChart.chartData.inPreparation;

            const ndx1 = value1.indexOf( ':' );
            executionNotStartedCount = parseInt( value1.substring( ndx1 + 1 ) );

            const ndx2 = value2.indexOf( ':' );
            executionPlannedCount = parseInt( value2.substring( ndx2 + 1 ) );

            const ndx3 = value3.indexOf( ':' );
            executionNotPlannedCount = parseInt( value3.substring( ndx3 + 1 ) );

            const ndx4 = value4.indexOf( ':' );
            executionDuplicateCount = parseInt( value4.substring( ndx4 + 1 ) );

            const ndx5 = value5.indexOf( ':' );
            executionInProgressCount = parseInt( value5.substring( ndx5 + 1 ) );

            const ndx6 = value6.indexOf( ':' );
            executionBlockedCount = parseInt( value6.substring( ndx6 + 1 ) );

            const ndx7 = value7.indexOf( ':' );
            executionWarningCount = parseInt( value7.substring( ndx7 + 1 ) );

            const ndx8 = value8.indexOf( ':' );
            executionCompletedCount = parseInt( value8.substring( ndx8 + 1 ) );

            const ndx9 = value9.indexOf( ':' );
            executionFailedCount = parseInt( value9.substring( ndx9 + 1 ) );

            const ndx10 = value10.indexOf( ':' );
            executionPausedCount = parseInt( value10.substring( ndx10 + 1 ) );

            const ndx11 = value11.indexOf( ':' );
            executionReadyCount = parseInt( value11.substring( ndx11 + 1 ) );

            const ndx12 = value12.indexOf( ':' );
            executionPreparationCount = parseInt( value12.substring( ndx12 + 1 ) );

            dummyValuesForFirstSeries = [ executionNotStartedCount, executionPlannedCount, executionNotPlannedCount, executionDuplicateCount,
                executionInProgressCount, executionBlockedCount, executionWarningCount, executionCompletedCount, executionFailedCount, executionPausedCount, executionReadyCount,
                executionPreparationCount
            ]; // values of pie chart
            if( data.i18n ) {
                displayLabels = [ data.i18n.NotStarted, data.i18n.Planned, data.i18n.NotPlanned, data.i18n.Duplicate,
                    data.i18n.InProgress, data.i18n.Blocked, data.i18n.Warning, data.i18n.Completed, data.i18n.Failed, data.i18n.Paused, data.i18n.Ready, data.i18n.Preparation
                ];
            }
            for( var j = 0; j < dummyValuesForFirstSeries.length; j++ ) {
                keyValueDataForChart.push( {
                    label: displayLabels[ j ],
                    value: dummyValuesForFirstSeries[ j ],
                    name: displayLabels[ j ],
                    y: dummyValuesForFirstSeries[ j ]
                } );
            }

            arrayOfSeriesDataForExecutionPieChart.push( {
                seriesName: data.i18n.Execution,
                colorByPoint: true,
                keyValueDataForChart: keyValueDataForChart
            } );
            return {
                arrayOfSeriesDataForExecutionPieChart: arrayOfSeriesDataForExecutionPieChart,
                redrawExecution: redrawExecution,
                chartProviders: chartProviders
            };
        }
    }
};

/**
 * this function is used to filter the Test Results Table when a particular section of the  pie chart is selected
 * @param {object} data data
 */
export let filterResultAndExecutionChart = function( data ) {
    var testResultColumnFilters = [];
    var redrawExecution = false;
    var redrawResult = false;
    var variable = data.unSelectedChart;
    var series = data.eventMap['undefined.selected'].seriesName;
    var unSelectedChart = data.eventMap['undefined.selected'].seriesName;
    if ( variable && variable !== series && variable === data.i18n.executionPieChartTitle ) {
        redrawExecution = true;
        eventBus.publish( 'drawExecutionPieChart' );
    }
    if ( variable && variable !== series && series === data.i18n.executionPieChartTitle && variable === data.i18n.resultPieChartTitle ) {
        redrawResult = true;
        eventBus.publish( 'drawResultPieChart' );
    }


    if ( data.eventMap['undefined.selected'].seriesName === data.i18n.resultPieChartTitle ) {
        var selectedLabel = data.eventMap['undefined.selected'].label;
        if ( data.eventData.label !== selectedLabel ) {
            flagForFilter = true;
        } else {
            flagForFilter = false;
        }
        if ( selectedLabel === data.i18n.Pass || selectedLabel === data.i18n.Fail || selectedLabel === data.i18n.Blocked || selectedLabel === data.i18n.Caution ) {
            var values = '';
            if ( selectedLabel === data.i18n.Pass ) {
                values = data.i18n.Pass;
            } else if ( selectedLabel === data.i18n.Fail ) {
                values = data.i18n.Fail;
            } else if ( selectedLabel === data.i18n.Blocked ) {
                values = data.i18n.Blocked;
            } else if ( selectedLabel === data.i18n.Caution ) {
                values = data.i18n.Caution;
            }
            var testResultColumnFilters1 = {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ values ]

            };
            testResultColumnFilters.push( testResultColumnFilters1 );
        } else if ( selectedLabel === data.i18n.NoResult ) {
            var testResultColumnFilters1 = {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            };
            testResultColumnFilters.push( testResultColumnFilters1 );
        }
    }
    if ( data.eventMap['undefined.selected'].seriesName === data.i18n.executionPieChartTitle ) {
        var selectedLabel = data.eventMap['undefined.selected'].label;
        if ( data.eventData.label !== selectedLabel ) {
            flagForFilter = true;
        } else {
            flagForFilter = false;
        }
        var values = '';
        if ( selectedLabel === data.i18n.NotStarted ) {
            values = data.i18n.NotStarted;
        } else if ( selectedLabel === data.i18n.Planned ) {
            values = data.i18n.Planned;
        } else if ( selectedLabel === data.i18n.NotPlanned ) {
            values = data.i18n.NotPlanned;
        } else if ( selectedLabel === data.i18n.Duplicate ) {
            values = data.i18n.Duplicate;
        } else if ( selectedLabel === data.i18n.InProgress ) {
            values = data.i18n.InProgress;
        } else if ( selectedLabel === data.i18n.Blocked ) {
            values = data.i18n.Blocked;
        } else if ( selectedLabel === data.i18n.Warning ) {
            values = data.i18n.Warning;
        } else if ( selectedLabel === data.i18n.Completed ) {
            values = data.i18n.Completed;
        } else if ( selectedLabel === data.i18n.Failed ) {
            values = data.i18n.Failed;
        } else if ( selectedLabel === data.i18n.Paused ) {
            values = data.i18n.Paused;
        } else if ( selectedLabel === data.i18n.Ready ) {
            values = data.i18n.Ready;
        } else if ( selectedLabel === data.i18n.Preparation ) {
            values = data.i18n.Preparation;
        }


        var testResultColumnFilters1 = {

            columnName: 'crt0ValStatus',
            operation: 'equals',
            values: [ values ]

        };
        testResultColumnFilters.push( testResultColumnFilters1 );
    }

    return {
        columnFilter: testResultColumnFilters,
        clickedOnChart: true,
        redrawExecution: redrawExecution,
        unSelectedChart: unSelectedChart,
        redrawResult: redrawResult
    };
};

/**
 * this function is used to show the Test Results Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAllResultAndExecution = function( data ) {
    var unSelectedChart = _.clone( data.unSelectedChart );
    if ( data.eventMap['undefined.selected'].seriesName === data.i18n.resultPieChartTitle || data.eventMap['undefined.selected'].seriesName === data.i18n.executionPieChartTitle ) {
        if ( flagForFilter ) {
            flagForFilter = false;
        } else {
            unSelectedChart = '';
            return {
                testResultColumnFilters: [],
                clickedOnChart: true,
                unSelectedChart: unSelectedChart
            };
        }
    }
};

/*
 * Redraw Results Pie chart when Execution Pie chart is clicked
 */
export let drawResultPieChart = function() {
    var arrayOfSeriesDataForResultPieChart = [];
    return {
        arrayOfSeriesDataForResultPieChart: arrayOfSeriesDataForResultPieChart,
        redrawResult: false
    };
};

/*
 * Redraw Execution Pie chart when Results Pie chart is clicked
 */
export let drawExecutionPieChart = function() {
    var arrayOfSeriesDataForExecutionPieChart = [];
    return {
        arrayOfSeriesDataForExecutionPieChart: arrayOfSeriesDataForExecutionPieChart,
        redrawExecution: false
    };
};

/*
 * Refresh Test Results Table and pie charts on SWA after selection is changed on PWA
 Pie charts will redraw only when any of the pie charts is filtered and selection is changed on PWA
 */

export let refreshSWATreeTable = function( data, selectedObjects, occContext ) {
    var clickedOnChart = data.clickedOnChart;
    if ( clickedOnChart === true ) {
        eventBus.publish( 'refreshTestResultTreeTable' );
        eventBus.publish( 'drawResultPieChart' );
        eventBus.publish( 'drawExecutionPieChart' );
        clickedOnChart = false;
    } else {
        eventBus.publish( 'refreshTestResultTreeTable' );
    }
    return {
        columnFilter: [],
        redrawExecution: true,
        redrawResult: true,
        clickedOnChart: clickedOnChart
    };
};

export default exports = {
    getDataFromProvider,
    loadTestResultTreeData,
    loadTestResultTreeTableProperties,
    loadTestResultTreeTableColumns,
    updateSelectionData,
    showHideParaTable,
    getResultAndExecutionSOAInputForPageLoad,
    createPieChartForResult,
    createPieChartForExecution,
    filterResultAndExecutionChart,
    displayAllResultAndExecution,
    drawResultPieChart,
    drawExecutionPieChart,
    refreshSWATreeTable
};
