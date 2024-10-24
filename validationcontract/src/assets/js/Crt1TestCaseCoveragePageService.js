// Copyright (c) 2021 Siemens

/**
 * @module js/Crt1TestCaseCoveragePageService
 */
import appCtxSvc from 'js/appCtxService';
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
import eventBus from 'js/eventBus';
import adapterSvc from 'js/adapterService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import cssUtils from 'js/cssUtils.service';

var _promiseColumnConfig = null;
var _columnConfigData = null;
var exports = {};
var _deferExpandTreeNodeArray = [];
var _treeColumnInfos = [];
var reqWithTC = 'REQ_TC';
var reqWithoutTC = 'REQ_NO_TC';
var released = 'RELEASED_TC';
var notReleased = 'NOT_RELEASED_TC';
var flagForTestCaseFilter;
var expandFlag = false;
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
        },
        {
            name: 'crt1HasChildren'
        }
        ]
    }, {
        name: 'Awb0Element',
        properties: [ {
            name: 'object_string'
        } ]
    } ]
};

export let resetColumnFilter = function() {
    var isCollapsedObj = true;
    var isExpandedobj = true;
    var testCaseTableColumnFilters = [];
    var redrawPIE = true;
    var redrawBAR = true;
    var unSelectedChart = '';
    return {
        isCollapsedObj: isCollapsedObj,
        isExpandedobj: isExpandedobj,
        columnFilter: testCaseTableColumnFilters,
        redrawPIE: redrawPIE,
        unSelectedChart: unSelectedChart,
        redrawBAR: redrawBAR
    };
};
export let loadTestCaseTreeData = function( treeLoadInput, data, selectedObjects, occContext ) {
    var drawTestCasePieChart = false;
    var deferred = AwPromiseService.instance.defer();


    /**
     * Get the 'child' nodes async
     */
    _buildTestCaseTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput, data, selectedObjects, occContext, drawTestCasePieChart );

    return deferred.promise;
};

function _buildTestCaseTreeTableStructure( parentNode, deferred, treeLoadInput, data, selectedObjects, occContext ) {
    var parentUid;
    var selectedUids = '';
    var columnFilters = [];
    var filterOn = _.clone( data.data.columnFilter );
    var workflowInitiated = _.clone( data.workflowInitiated );
    if( filterOn[ 0 ] ) {
        columnFilters = filterOn;
    }

    parentNode.isExpanded = true;
    // if table is loading initially
    if( parentNode.type === 'rootType' ) {
        parentUid = null;
        var selections = selectedObjects;
        for( var i = 0; i < selections.length; i++ ) {
            selectedUids = selectedUids.concat( selections[ i ].uid, '#' );
        }
        if( selectedUids.endsWith( '#' ) ) {
            selectedUids = selectedUids.slice( 0, selectedUids.length - 1 );
        }
    } // if expand operation is in progress
    else {
        selectedUids = null;
        parentUid = parentNode.uid;
    }

    // prepare SOA input
    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Crt1TestCaseCoverageTable'
        },
        searchInput: {
            maxToLoad: 45,
            maxToReturn: 45,
            providerName: 'Crt1CoverageProvider',
            searchCriteria: {
                dcpSortByDataProvider: 'true',
                parentUid: parentUid,
                selectedObjects: selectedUids,
                productContext: occContext.context.occContext.productContextInfo.uid,
                clearCache: false
            },
            startIndex: treeLoadInput.startChildNdx,
            columnFilters: columnFilters,
            searchFilterFieldSortType: 'Alphabetical',
            searchSortCriteria: data.columnProviders.testCaseCoverageColumnProvider.sortCriteria
        },
        inflateProperties: false
    };

    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.uid;
    treeLoadInput.displayMode = 'Tree';

    exports.getDataFromProvider( deferred, treeLoadInput, soaInput, workflowInitiated, columnFilters, data );
}

export let getDataFromProvider = function( deferred, treeLoadInput, soaInput, workflowInitiated, columnFilters, data ) {
    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput, policyIOverride ).then(
        function( response ) {
            var collabObjects = [];

            if( response.searchResultsJSON ) {
                var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                if( searchResults ) {
                    for( var x = 0; x < searchResults.objects.length; ++x ) {
                        var uid = searchResults.objects[ x ].uid;
                        var obj = response.ServiceData.modelObjects[ uid ];
                        if( obj ) {
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
            var testCaseChartData = response.additionalSearchInfoMap.searchTermsToHighlight;
            var testCaseTableColumnFilters;
            if( workflowInitiated ) {
                testCaseTableColumnFilters = [];
            } else {
                testCaseTableColumnFilters = columnFilters;
            }
            var testCaseChartDataForRedraw = _.clone( data.data.testCaseChartDataForRedraw );
            if( response && response.additionalSearchInfoMap && response.additionalSearchInfoMap.searchTermsToHighlight &&
                response.additionalSearchInfoMap.searchTermsToHighlight.length > 0 ) {
                testCaseChartDataForRedraw = response.additionalSearchInfoMap.searchTermsToHighlight;
            }
            var drawTestCasePieChart;
            var isClickedOnChart = data.clickedOnChart;
            if( isClickedOnChart.dbValue ) {
                drawTestCasePieChart = false;
                isClickedOnChart = false;
            } else if( treeLoadInput && treeLoadInput.parentNode && treeLoadInput.rootNode && treeLoadInput.rootNode.type &&
                treeLoadInput.parentNode.type && treeLoadInput.rootNode.type === treeLoadInput.parentNode.type ) {
                drawTestCasePieChart = true;
            }
            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                testCaseChartData: testCaseChartData,
                drawTestCasePieChart: drawTestCasePieChart,
                columnFilter: testCaseTableColumnFilters,
                isClickedOnChart: isClickedOnChart,
                testCaseChartDataForRedraw: testCaseChartDataForRedraw
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
};

function promiseColumnConfig() {
    var deferred = AwPromiseService.instance.defer();

    if( _promiseColumnConfig.promise ) {
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

function processProviderResponse( treeLoadInput, searchResults, startReached, endReached ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var vmNodes = [];

    var parentNode = treeLoadInput.parentNode;
    var levelNdx = parentNode.levelNdx + 1;

    for( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[ childNdx ];

        var vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx, parentNode );
        if( vmNode ) {
            vmNodes.push( vmNode );
            if( !vmNode.isLeaf ) {
                _deferExpandTreeNodeArray.push( vmNode );
            }
        }
    }

    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
        endReached, null );
}

function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx, parentNode ) {
    var sourceObj = _cdm.getObject( obj.props.crt1SourceObject.dbValues[0] );
    var displayName = obj.props.crt1SourceObject.uiValues[0];
    var noOfChildren;

    if ( obj && obj.props && obj.props.crt1HasChildren && obj.props.crt1HasChildren.dbValues ) {
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
    if( noOfChildren && noOfChildren !== '0' ) {
        return true;
    }
    return false;
}

export let loadTestCaseTreeTableProperties = function( propertyLoadInput, isExpandedobj, panelPinned, selObject, data ) {
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput, isExpandedobj, panelPinned, selObject, data );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

function _loadProperties( propertyLoadInput, isExpandedobj, panelPinned, selObject, data ) {
    var allChildNodes = [];
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Crt1TestCaseCoverageTable'
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );
    if( expandFlag || isExpandedobj ) {
        for( var i = 0; i < allChildNodes.length; i++ ) {
            if( allChildNodes[ i ].isLeaf === false ) {
                eventBus.publish( 'testCaseCoverageTableProvider.expandTreeNode', {
                    parentNode: allChildNodes[ i ]
                } );
            }
        }
        var isParentNode = true;
        for( var i = 0; i < allChildNodes.length; i++ ) {
            if( allChildNodes[ i ].isLeaf === false ) {
                isParentNode = false;
            }
        }
        if( isParentNode ) {
            expandFlag = false;
        }
    }

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                    var propColumns = response.output.columnConfig.columns;
                    _.forEach( propColumns, function( col ) {
                        if( !col.typeName && col.associatedTypeName ) {
                            col.typeName = col.associatedTypeName;
                        }
                    } );
                } );
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
            }

            if( panelPinned === true && selObject.selectedObjects[ 0 ] ) {
                eventBus.publish( 'testCaseTable.setSelection' );
            }
            if( appCtxSvc.ctx.expandNode ) {
                eventBus.publish( 'testCaseTable.expandNode' );
            }
            //update viewModelProperties
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
}

function queryColumnConfig( columnConfigUri ) {
    // Get Column data

    var getOrResetUiConfigsIn = {
        scope: 'LoginUser',
        scopeName: '',
        clientName: 'AWClient',
        resetColumnConfig: false,
        columnConfigQueryInfos: [ {
            clientScopeURI: 'Crt1TestCaseCoverageTable',
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

            if( _isArrayPopulated( response.columnConfigurations ) ) {
                var columnConfigurations = response.columnConfigurations[ 0 ];

                if( _isArrayPopulated( columnConfigurations.columnConfigurations ) ) {
                    columnConfigurations = columnConfigurations.columnConfigurations;

                    if( _isArrayPopulated( columnConfigurations ) ) {
                        columns = _processUiConfigColumns( columnConfigurations[ 0 ].columns );
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
    if( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
}

function _processUiConfigColumns( columns ) {
    // Save Column data for later arrange
    _treeColumnInfos = [];

    for( var idx = 0; idx < columns.length; ++idx ) {
        var columnInfo = awColumnSvc.createColumnInfo( {
            name: columns[ idx ].propertyName,
            propertyName: columns[ idx ].propertyName,
            displayName: columns[ idx ].displayName,
            typeName: columns[ idx ].associatedTypeName || columns[ idx ].typeName,
            maxWidth: 400,
            minWidth: 60,
            hiddenFlag: columns[ idx ].hiddenFlag,
            pixelWidth: columns[ idx ].pixelWidth,
            width: columns[ idx ].pixelWidth,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableSorting: true,
            enableColumnMoving: true,
            isTextWrapped: columns[ idx ].isTextWrapped
        } );

        _treeColumnInfos.push( columnInfo );
    }

    if( _treeColumnInfos.length > 0 ) {
        _treeColumnInfos[ 0 ].isTreeNavigation = true;
        _treeColumnInfos[ 0 ].enableColumnMoving = false;
        _treeColumnInfos[ 0 ].pinnedLeft = true;
    }

    return _treeColumnInfos;
}
export let loadTreeTableColumns = function( dataProvider, data ) { // Get the column config
    _promiseColumnConfig = AwPromiseService.instance.defer();

    let columnConfigUri = 'Crt1TestCaseCoverageTable';

    queryColumnConfig( columnConfigUri );

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: _columnConfigData.columnInfos
        };

        return _columnConfigData;
    } );
};

/*
 * Corrects selection to be elements from all dynamic tables
 */
export let storeTestCaseTableSelection = function( dataProvider ) {
    var testCoverageSelection = [];
    if( dataProvider && dataProvider.selectedObjects && dataProvider.selectedObjects.length > 0 ) {
        testCoverageSelection = dataProvider.selectedObjects;
        return {
            testCoverageSelection: testCoverageSelection
        };
    }
};

export let changeSelectionForTcTreeTable = function( data ) {
    var dataProvider = null;
    var selectedObjects = [];
    var isCollapsedObj = false;
    var isExpandedobj = false;
    var vrTestCaseTableSelection = [];
    var registerTestCaseSelection = [];
    if( data && data.dataProviders && data.dataProviders.testCaseCoverageTableProvider ) {
        dataProvider = data.dataProviders.testCaseCoverageTableProvider;
        selectedObjects = dataProvider.selectedObjects;
        for( var i = 0; i < selectedObjects.length; i++ ) {
            //  Expand-Collapse button command visibility based on selection of object.
            if( ( data.dataProviders.testCaseCoverageTableProvider.selectedObjects[ i ].isExpanded === false ||
                    data.dataProviders.testCaseCoverageTableProvider.selectedObjects[ i ].isExpanded === undefined ) && dataProvider.selectedObjects[ i ].isLeaf !== true ) {
                isExpandedobj = true;
            } else if( data.dataProviders.testCaseCoverageTableProvider.selectedObjects[ i ].isExpanded === true && dataProvider.selectedObjects[ i ].isLeaf !== true ) {
                isCollapsedObj = true;
            }
        }
        if( selectedObjects.length === 0 ) {
            isExpandedobj = true;
            isCollapsedObj = true;
        }
        if( selectedObjects && selectedObjects.length && selectedObjects.length > 0 ) {
            for( var j = 0; j < selectedObjects.length; ++j ) {
                if( selectedObjects[ j ].props && selectedObjects[ j ].props.crt1SourceObject && selectedObjects[ j ].props.crt1SourceObject.dbValues[ 0 ] ) {
                    var objUid = selectedObjects[ j ].props.crt1SourceObject.dbValues[ 0 ];
                    var attribute = cdm.getObject( objUid );
                    registerTestCaseSelection.push( attribute );
                }
            }
        }
        // Register Model Object
        if( registerTestCaseSelection && registerTestCaseSelection.length > 0 ) {
            vrTestCaseTableSelection = registerTestCaseSelection;
        }
    }
    if( data.panelPinned && data.panelPinned.PanelPinned ) {
        vrTestCaseTableSelection = data.vrTestCaseTableSelection.selectedObjects;
    }
    return {
        isCollapsedObj: isCollapsedObj,
        isExpandedobj: isExpandedobj,
        vrTestCaseTableSelection: vrTestCaseTableSelection
    };
};

export let createTestCasePieChart = function( data ) {
    if( data && data.chartProviders ) {
        let chartProviders = _.clone( data.chartProviders );
        var chartColorOverrideClass = 'aw-verificationManagement-testCasePieChartColor';
        var testCasePieChartColor = cssUtils.getColumnChartColors( chartColorOverrideClass );
        chartProviders.testCasePieChartProvider.chartConfig.plotOptions = {
            pie: {
                allowPointSelect: true,
                colorByPoint: true,
                colors: testCasePieChartColor,
                dataLabels: {
                    format: '{point.y} {point.name}'
                },
                showInLegend: false
            }
        };

        var noTestCasesCount = 0;
        var reqWithTestCases = 0;
        var chartDataFromSOA = [];
        var displayLabels = [];
        var redrawPIE = data.redrawPIE;
        if( data.i18n && data.i18n.noTestCases && data.i18n.reqWithTestCases ) {
            displayLabels = [ data.i18n.reqWithTestCases, data.i18n.noTestCases ];
        }
        if( redrawPIE ) {
            redrawPIE = false;
            eventBus.publish( 'drawPieChartAsDoubleFilter' );
        } else if( data && data.testCaseChartData !== undefined ) {
            chartDataFromSOA = data.testCaseChartData;
            if( chartDataFromSOA.length === 0 ) {
                chartDataFromSOA = data.testCaseChartDataForRedraw;
            }
            if( chartDataFromSOA.length > 0 ) {
                var value1 = chartDataFromSOA[ 0 ];
                var value2 = chartDataFromSOA[ 1 ];

                const ndx1 = value1.indexOf( ':' );
                noTestCasesCount = parseInt( value1.substring( ndx1 + 1 ) );

                const ndx2 = value2.indexOf( ':' );
                reqWithTestCases = parseInt( value2.substring( ndx2 + 1 ) );

                var arrayOfSeriesDataForPieChart = [];
                var dummyValuesForFirstSeries = [];
                dummyValuesForFirstSeries = [ reqWithTestCases, noTestCasesCount ]; // values of pie chart
                var keyValueDataForChart = [];
                for( var j = 0; j < dummyValuesForFirstSeries.length; j++ ) {
                    keyValueDataForChart.push( {
                        label: displayLabels[ j ],
                        value: dummyValuesForFirstSeries[ j ],
                        name: displayLabels[ j ],
                        y: dummyValuesForFirstSeries[ j ]
                    } );
                }
                arrayOfSeriesDataForPieChart.push( {
                    seriesName: data.i18n.testCasePieChartTitle,
                    colorByPoint: true,
                    keyValueDataForChart: keyValueDataForChart
                } );
                return {
                    arrayOfSeriesDataForPieChart: arrayOfSeriesDataForPieChart,
                    redrawPIE: redrawPIE,
                    chartProviders: chartProviders
                };
            }
        }
    }
};

export let resetChartCounts = function( data ) {
    appCtxSvc.unRegisterCtx( 'piePass' );
    appCtxSvc.unRegisterCtx( 'pieFail' );
    appCtxSvc.unRegisterCtx( 'pieUnprocessed' );
};

export let refreshSWATreeTable = function( selectedObjects, occContext ) {
    if( prevSelection === null || prevSelection && selectedObjects && selectedObjects.length > 0 ) {
        if( prevSelection !== null ) {
            var refreshTable = true;
            if( prevSelection.length !== selectedObjects.length ) {
                for( var i = 0; i < prevSelection.length; i++ ) {
                    for( var j = 0; j < selectedObjects.length; j++ ) {
                        if( prevSelection.length !== selectedObjects.length ||
                            prevSelection[ i ].uid !== selectedObjects[ j ].uid ) {
                            refreshTable = false;
                        }
                    }
                }
            } else if( prevSelection.length === selectedObjects.length ) {
                for( var i = 0; i < prevSelection.length; i++ ) {
                    if( prevSelection[ i ].uid !== selectedObjects[ i ].uid ) {
                        refreshTable = false;
                    }
                }
            }
            prevSelection = selectedObjects;
            if( refreshTable === false ) {
                eventBus.publish( 'refreshTestCaseTreeTable' );
            }
        } else {
            prevSelection = selectedObjects;
            eventBus.publish( 'refreshTestCaseTreeTable' );
        }
    } else if( selectedObjects && selectedObjects.length === 0 ) {
        prevSelection[ 0 ] = occContext.context.baseSelection;
        eventBus.publish( 'refreshTestCaseTreeTable' );
    }
    return {
        columnFilter: [],
        redrawPIE: true,
        redrawBAR: true
    };
};
export let drawBarChartAsDoubleFilter = function() {
    var arrayOfSeriesDataForBarChart = [];
    return {
        arrayOfSeriesDataForBarChart: arrayOfSeriesDataForBarChart,
        redrawBAR: false
    };
};
export let drawPieChartAsDoubleFilter = function() {
    var arrayOfSeriesDataForBarChart = [];
    return {
        arrayOfSeriesDataForBarChart: arrayOfSeriesDataForBarChart,
        redrawPIE: false
    };
};

export let createTestCaseBarChart = function( data ) {
    var arrayOfSeriesDataForBarChart = [];
    var labels = [];
    var chartDataFromSOA = [];
    var pass = [];
    var releasedCount = 0;
    var notReleasedCount = 0;
    var redrawBAR = data.redrawBAR;
    var workflowInitiated = data.workflowInitiated;

    var isCollapsedObj = true;
    var isExpandedobj = true;
    if( redrawBAR || workflowInitiated ) {
        redrawBAR = false;
        workflowInitiated = false;
        eventBus.publish( 'drawBarChartAsDoubleFilter' );
        return {
            redrawBAR: redrawBAR,
            workflowInitiated: workflowInitiated
        };
    } else if( data && data.testCaseChartData !== undefined ) {
        chartDataFromSOA = data.testCaseChartData;
        if( chartDataFromSOA.length === 0 ) {
            chartDataFromSOA = data.testCaseChartDataForRedraw;
        }
        if( chartDataFromSOA.length > 0 ) {
            var value1 = chartDataFromSOA[ 2 ];
            var value2 = chartDataFromSOA[ 3 ];

            const ndx1 = value1.indexOf( ':' );
            releasedCount = parseInt( value1.substring( ndx1 + 1 ) );

            const ndx2 = value2.indexOf( ':' );
            notReleasedCount = parseInt( value2.substring( ndx2 + 1 ) );

            pass = [ releasedCount, notReleasedCount ];
            labels = [ data.i18n.released, data.i18n.notReleased ];
            var keyValueDataForChart2 = [];
            var keyValueDataForChart3 = [];

            keyValueDataForChart2.push( {
                label: labels[ 0 ],
                value: pass[ 0 ],
                y: pass[ 0 ]
            } );

            keyValueDataForChart3.push( {
                label: labels[ 1 ],
                value: pass[ 1 ],
                y: pass[ 1 ]
            } );

            arrayOfSeriesDataForBarChart.push( {
                seriesName: labels[ 0 ],
                colorByPoint: true,
                keyValueDataForChart: keyValueDataForChart2
            } );

            arrayOfSeriesDataForBarChart.push( {
                seriesName: labels[ 1 ],
                colorByPoint: true,
                keyValueDataForChart: keyValueDataForChart3
            } );

            return {
                arrayOfSeriesDataForBarChart: arrayOfSeriesDataForBarChart,
                isCollapsedObj: isCollapsedObj,
                isExpandedobj: isExpandedobj,
                redrawBAR: redrawBAR,
                workflowInitiated: workflowInitiated
            };
        }
    }
};

export let filterTestCaseChart = function( data ) {
    var isCollapsedObj = true;
    var isExpandedobj = true;
    var redrawPIE = false;
    var redrawBAR = false;
    var testCaseTableColumnFilters = [];
    var variable = data.unSelectedChart;
    var series = data.eventMap[ 'undefined.selected' ].seriesName;
    var unSelectedChart = data.eventMap[ 'undefined.selected' ].seriesName;
    if( variable && variable !== series && variable === data.i18n.testCasePieChartTitle ) {
        redrawPIE = true;
        eventBus.publish( 'drawPieChartAsDoubleFilter' );
    }
    if( variable && variable !== series && series === data.i18n.testCasePieChartTitle && ( variable === data.i18n.released || variable === data.i18n.notReleased ) ) {
        redrawBAR = true;
        eventBus.publish( 'drawBarChartAsDoubleFilter' );
    }

    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.testCasePieChartTitle ) {
        var selectedLabel = data.eventMap[ 'undefined.selected' ].label;

        if( data.eventData.label !== selectedLabel ) {
            flagForTestCaseFilter = true;
        } else {
            flagForTestCaseFilter = false;
        }
        if( selectedLabel === data.i18n.noTestCases ) {
            var testCaseTableColumnFilters1 = {

                columnName: '',
                operation: 'equals',
                values: [ reqWithoutTC ]

            };
            testCaseTableColumnFilters.push( testCaseTableColumnFilters1 );
        } else if( selectedLabel === data.i18n.reqWithTestCases ) {
            testCaseTableColumnFilters1 = {

                columnName: '',
                operation: 'equals',
                values: [ reqWithTC ]

            };
            testCaseTableColumnFilters.push( testCaseTableColumnFilters1 );
        }
    }
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.released ||
        data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.notReleased ) {
        selectedLabel = data.eventMap[ 'undefined.selected' ].label;
        if( data.eventData.label !== selectedLabel ) {
            flagForTestCaseFilter = true;
        } else {
            flagForTestCaseFilter = false;
        }
        if( selectedLabel === data.i18n.released ) {
            testCaseTableColumnFilters1 = {

                columnName: '',
                operation: 'equals',
                values: [ released ]

            };
            testCaseTableColumnFilters.push( testCaseTableColumnFilters1 );
        } else if( selectedLabel === data.i18n.notReleased ) {
            testCaseTableColumnFilters1 = {

                columnName: '',
                operation: 'equals',
                values: [ notReleased ]

            };
            testCaseTableColumnFilters.push( testCaseTableColumnFilters1 );
        }
    }
    return {
        isCollapsedObj: isCollapsedObj,
        isExpandedobj: isExpandedobj,
        workflowInitiated: false,
        columnFilter: testCaseTableColumnFilters,
        clickedOnChart: true,
        redrawPIE: redrawPIE,
        unSelectedChart: unSelectedChart,
        redrawBAR: redrawBAR
    };
};

export let displayAllTestCases = function( data ) {
    var isCollapsedObj = true;
    var isExpandedobj = true;
    var unSelectedChart = _.clone( data.unSelectedChart );
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.testCasePieChartTitle ) {
        if( flagForTestCaseFilter ) {
            flagForTestCaseFilter = false;
        } else {
            unSelectedChart = '';
            return {
                isCollapsedObj: isCollapsedObj,
                isExpandedobj: isExpandedobj,
                testCaseTableColumnFilters: [],
                clickedOnChart: true,
                unSelectedChart: unSelectedChart
            };
        }
    }
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.released ||
        data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.notReleased ) {
        if( flagForTestCaseFilter ) {
            flagForTestCaseFilter = false;
        } else {
            unSelectedChart = '';
            return {
                isCollapsedObj: isCollapsedObj,
                isExpandedobj: isExpandedobj,
                testCaseTableColumnFilters: [],
                clickedOnChart: true,
                unSelectedChart: unSelectedChart
            };
        }
    }
};

export let refreshTableOnWorkflow = function( data ) {
    if( data && data.eventData && data.eventData.scope &&
        data.eventData.scope.props.name === 'Crt1TestCaseCoveragePage' &&
        ( data.eventData.scope.subPanelContext.selectionData.selected[ 0 ].modelType.typeHierarchyArray.indexOf( 'IAV0TestCaseRevision' ) > -1 ||
            data.eventData.scope.subPanelContext.selectionData.selected[ 0 ].modelType.typeHierarchyArray.indexOf( 'IAV0TestCase' ) > -1 ) ) {
        var isCollapsedObj = true;
        var isExpandedobj = true;
        var testCaseTableColumnFilters = [];
        var redrawPIE = true;
        var redrawBAR = true;
        var unSelectedChart = '';
        return {
            isCollapsedObj: isCollapsedObj,
            isExpandedobj: isExpandedobj,
            columnFilter: testCaseTableColumnFilters,
            redrawPIE: redrawPIE,
            unSelectedChart: unSelectedChart,
            redrawBAR: redrawBAR
        };
    }
};

export let setSelection = function( data ) {
    var dataProvider = data.dataProviders.testCaseCoverageTableProvider;
    var selModel = dataProvider.selectionModel;
    var vmObjects = dataProvider.viewModelCollection.loadedVMObjects;
    var objToSelect = [];
    var isVrTestCaseCoverageTreeNode = data.testCoverageSelection.selectedObjects[ 0 ];
    if( vmObjects && vmObjects !== undefined ) {
        for( var object in vmObjects ) {
            var tableObj = cdm.getObject( vmObjects[ object ].uid );
            var ObjToCompare = cdm.getObject( isVrTestCaseCoverageTreeNode.uid );
            if( ObjToCompare.props.crt1UnderlyingObject.dbValues[ 0 ] &&
                tableObj.props.crt1UnderlyingObject.dbValues[ 0 ] === ObjToCompare.props.crt1UnderlyingObject.dbValues[ 0 ] ) {
                objToSelect.push( vmObjects[ object ] );
            }
        }
        if( objToSelect.length !== 0 ) {
            selModel.setSelection( objToSelect );
        }
    }
};
/* clear filter
 *@param {object} data data
 */
export let clearFilter = function( data ) {
    var filter = _.clone( data.filterBox );
    filter.dbValue = '';
    return filter;
};
export const navigateToSpecPanel = ( commandContext ) => {
    let sharedData = commandContext.sharedData;
    let newsharedData = { ...sharedData.value };
    newsharedData.activeView = 'Crt1AddTestSpec';
    sharedData.update( { ...newsharedData } );
    eventBus.publish( 'Crt1.navigateToSpecPanel' );
};
export const navigateToTestCasePanel = ( sharedData ) => {
    let newSharedData = _.clone( sharedData );
    newSharedData.activeView = 'Crt1AddTestCase';
    return newSharedData;
};
export const addTestSpec = ( commandContext, data ) => {
    let sharedData = commandContext.sharedData;
    let newsharedData = { ...sharedData.value };
    newsharedData.activeView = 'Crt1AddTestCase';
    newsharedData.selObj = data.dataProviders.performSearch.selectedObjects;
    sharedData.update( { ...newsharedData } );
};
export const removeSpec = ( commandContext ) => {
    var selObjs = commandContext.itemOptions.dataProvider.viewModelCollection.getLoadedViewModelObjects();
    if( selObjs && selObjs.length > 0 ) {
        for( let i = 0; i < selObjs.length; i++ ) {
            if( selObjs[ i ].uid === commandContext.vmo.uid ) {
                selObjs.splice( i );
            }
        }

        commandContext.itemOptions.dataProvider.update( selObjs, selObjs.length );
    }
};

export let expandNode = function( data ) {
    var ObjToCompare = data.testCoverageSelection.selectedObjects;
    var dataProvider = data.dataProviders.testCaseCoverageTableProvider;
    if( dataProvider ) {
        var list = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        for( var i = 0; i < list.length; i++ ) {
            var tableObj = cdm.getObject( list[ i ].uid );
            if( ObjToCompare && ObjToCompare[ 0 ] && ObjToCompare[ 0 ].props.crt1UnderlyingObject.dbValues[ 0 ] &&
                tableObj.props && tableObj.props.crt1UnderlyingObject && tableObj.props.crt1UnderlyingObject.dbValues[ 0 ] === ObjToCompare[ 0 ].props.crt1UnderlyingObject.dbValues[ 0 ] ) {
                appCtxSvc.unRegisterCtx( 'expandNode' );
                eventBus.publish( 'testCaseCoverageTableProvider.expandTreeNode', {
                    parentNode: list[ i ]
                } );
            }
        }
    }
};

/**
 * Expand-Collapse button command visibility when clicked on Expand-Collapse icon
 */
export let collapseNode = function( data ) {
    var isCollapsedObj = false;
    var isExpandedobj = true;
    var selectedObjects = data.dataProviders.testCaseCoverageTableProvider.selectedObjects;
    if( selectedObjects && selectedObjects[ 0 ] && ( selectedObjects[ 0 ].isExpanded === false || selectedObjects[ 0 ].isExpanded === undefined ) ) {
        var isCollapsedObj = false;
        var isExpandedobj = true;
        return {
            isCollapsedObj: isCollapsedObj,
            isExpandedobj: isExpandedobj
        };
    }
    if( selectedObjects && selectedObjects[ 0 ] && selectedObjects[ 0 ].isExpanded && selectedObjects[ 0 ].isExpanded === true ) {
        var isCollapsedObj = true;
        var isExpandedobj = false;
        return {
            isCollapsedObj: isCollapsedObj,
            isExpandedobj: isExpandedobj
        };
    }
};

/**

* Expand node by single-multiple selection
*/
export let expandNodeBtn = function( cmdctx ) {
    var dataProvider = cmdctx.data.dataProviders.testCaseCoverageTableProvider;
    var ObjectCompare = dataProvider.selectedObjects;
    var isCollapse = false;
    expandFlag = true;
    if( dataProvider ) {
        var list = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        // Perform expand action for selected objects.
        if( ObjectCompare !== undefined && ObjectCompare.length > 0 ) {
            for( var i = 0; i < list.length; i++ ) {
                for( var j = 0; j < ObjectCompare.length; j++ ) {
                    if( list[ i ] === ObjectCompare[ j ] ) {
                        eventBus.publish( 'testCaseCoverageTableProvider.expandTreeNode', {
                            parentNode: list[ i ]
                        } );
                    }
                    if( ObjectCompare[ j ].isExpanded === true || ObjectCompare[ j ].isExpanded === undefined ) {
                        isCollapse = true;
                    }
                }
            }
        } else {
            for( var i = 0; i < list.length; i++ ) {
                eventBus.publish( 'testCaseCoverageTableProvider.expandTreeNode', {
                    parentNode: list[ i ]
                } );
            }
        }
        if( isCollapse === true ) {
            const newcrt1ExpandCollapse = { ...cmdctx.crt1ExpandCollapse.value };
            newcrt1ExpandCollapse.isCollapsedObj = true;
            newcrt1ExpandCollapse.isExpandedobj = false;
            cmdctx.crt1ExpandCollapse.update && cmdctx.crt1ExpandCollapse.update( newcrt1ExpandCollapse );
        }
    }
};

/**

* Collapse node by single-multiple selection
*/
export let collapseNodeBtn = function( cmdctx ) {
    appCtxSvc.registerCtx( 'isCollapseAllCmdClicked', true );
    var dataProvider = cmdctx.data.dataProviders.testCaseCoverageTableProvider;
    var ObjectCompare = dataProvider.selectedObjects;
    var isExpand = false;
    if( dataProvider ) {
        var list = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        const dataObj = {
            data: cmdctx.data,
            ctx: appCtxSvc.ctx
        };
        if( ObjectCompare !== undefined && ObjectCompare.length > 0 ) {
            for( var i = 0; i < list.length; i++ ) {
                for( var j = 0; j < ObjectCompare.length; j++ ) {
                    if( list[ i ] === ObjectCompare[ j ] ) {
                        if( list[ i ].isExpanded === undefined || list[ i ].isExpanded ) {
                            list[ i ].isExpanded = false;
                            eventBus.publish( 'testCaseCoverageTable.plTable.toggleTreeNode', list[ i ] );
                        }
                    }
                    if( ObjectCompare[ j ].isExpanded === false || ObjectCompare[ j ].isExpanded === undefined ) {
                        isExpand = true;
                    }
                }
            }
        } else {
            for( var i = 0; i < list.length; i++ ) {
                if( list[ i ].isExpanded === undefined || list[ i ].isExpanded ) {
                    list[ i ].isExpanded = false;
                    eventBus.publish( 'testCaseCoverageTable.plTable.toggleTreeNode', list[ i ] );
                }
            }
        }
        if( isExpand === true ) {
            const newcrt1ExpandCollapse = { ...cmdctx.crt1ExpandCollapse.value };
            newcrt1ExpandCollapse.isCollapsedObj = false;
            newcrt1ExpandCollapse.isExpandedobj = true;
            cmdctx.crt1ExpandCollapse.update && cmdctx.crt1ExpandCollapse.update( newcrt1ExpandCollapse );
        }
    }
};
export let setPanelPinnedState = function( panelPinned ) {
    return panelPinned;
};
export let updateSelectionData = function( subPanelContext, localSelData ) {
    if( localSelData.selected ) {
        var adaptedObj = adapterSvc.getAdaptedObjects( localSelData.selected );
        adaptedObj.then( function( adaptedObjs ) {
            subPanelContext.selectionData.update( { selected: adaptedObjs } );
        } );
    }
};

export default exports = {
    getDataFromProvider,
    loadTestCaseTreeData,
    loadTestCaseTreeTableProperties,
    loadTreeTableColumns,
    storeTestCaseTableSelection,
    changeSelectionForTcTreeTable,
    createTestCasePieChart,
    createTestCaseBarChart,
    resetChartCounts,
    refreshSWATreeTable,
    filterTestCaseChart,
    displayAllTestCases,
    refreshTableOnWorkflow,
    setSelection,
    expandNode,
    collapseNode,
    expandNodeBtn,
    collapseNodeBtn,
    navigateToSpecPanel,
    navigateToTestCasePanel,
    addTestSpec,
    removeSpec,
    setPanelPinnedState,
    drawBarChartAsDoubleFilter,
    drawPieChartAsDoubleFilter,
    updateSelectionData,
    clearFilter,
    resetColumnFilter
};
