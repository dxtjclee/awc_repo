// Copyright (c) 2021 Siemens

/**
 * @module js/Crt1TestProcedureTreeTableService
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
import uwPropertySvc from 'js/uwPropertyService';
import lovService from 'js/lovService';
import dynamicTableUtils from 'js/dynamicTableUtils';
import messageService from 'js/messagingService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

var _promiseColumnConfig = null;
var _columnConfigData = null;
var exports = {};
var _deferExpandTreeNodeArray = [];
var _treeColumnInfos = [];
var flagForFilter;
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
        } ]
    }, {
        name: 'Awb0Element',
        properties: [ {
            name: 'object_string'
        }, {
            name: 'awb0NumberOfChildren'
        }, {
            name: 'crt1AddedToAnalysisRequest'
        }, {
            name: 'awb0Parent'
        }, {
            name: 'awb0UnderlyingObject'
        } ]
    } ]
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

function _buildTreeTableStructure( parentNode, deferred, treeLoadInput, columnProviders, parentUid, testProcedureTreeTableColumnFilters, testResultColumnFilters, scopeURI ) {
    var selectedobj;
    var type = 'IAV0TestProcedurRevision';
    var filterOnForTpTree = [];
    if( testProcedureTreeTableColumnFilters && testProcedureTreeTableColumnFilters.length > 0 ) {
        filterOnForTpTree = testProcedureTreeTableColumnFilters;
    } else if( testResultColumnFilters && testResultColumnFilters.length > 0 ) {
        filterOnForTpTree = testResultColumnFilters;
    }
    if( columnProviders !== undefined ) {
        var isTableColumnFiltering = true;
    }

    if( parentNode.type === 'rootType' ) {
        selectedobj = null;
        parentNode.isExpanded = false;
        columnProviders = filterOnForTpTree;
    } else {
        selectedobj = parentNode.uid;
        type = null;
        parentNode.isExpanded = true;
    }
    var searchCriteria = {
        parentUid: parentUid,
        requestedObjectUid: selectedobj,
        requestedTypeFilter: type,
        isTreeTable: 'true',
        tableUID: 'IAV0TestProcedur'
    };
    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: scopeURI
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Crt1AnalysisRequestInProvider',
            searchCriteria: searchCriteria,
            columnFilters: columnProviders
        },
        inflateProperties: false
    };

    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.uid;
    treeLoadInput.displayMode = 'Tree';

    exports.getDataFromProvider( deferred, treeLoadInput, soaInput, isTableColumnFiltering );
}

export let getDataFromProvider = function( deferred, treeLoadInput, soaInput, isTableColumnFiltering ) {
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

            var tempCursorObject = {
                endReached: endReachedVar,
                startReached: true
            };

            var treeLoadResult = processProviderResponse( treeLoadInput, collabObjects, startReachedVar,
                endReachedVar );
            if( treeLoadResult.childNodes.length === 0 ) {
                eventBus.publish( 'TPTable.modelObjectsLoaded' );
            }
            treeLoadResult.parentNode.cursorObject = tempCursorObject;
            deferred.resolve( {
                treeLoadResult: treeLoadResult
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
    var noOfChildren;
    var sourceObj = _cdm.getObject( obj.props.crt1SourceObject.dbValues[ 0 ] );
    var displayName = sourceObj.props.object_string.dbValues[ 0 ];

    if( sourceObj.props && sourceObj.props.awb0NumberOfChildren && sourceObj.props.awb0NumberOfChildren.dbValues ) {
        noOfChildren = sourceObj.props.awb0NumberOfChildren.dbValues[ 0 ];
    }
    var hasChildren = containChildren( noOfChildren );
    var iconURL;

    // get Icon for node
    var underlyingObj = _cdm.getObject( obj.props.crt1UnderlyingObject.dbValues[ 0 ] );
    if( underlyingObj && underlyingObj.type ) {
        iconURL = iconSvc.getTypeIconURL( underlyingObj.type );
    } else {
        if( sourceObj.type === 'Arm0ParagraphElement' ) {
            iconURL = iconSvc.getTypeIconURL( 'IAV0TestStepRevision' );
        }
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

export let loadTestProcedureTreeData = function( treeLoadInput, columnProviders, parentUid, testProcedureTreeTableColumnFilters, testResultColumnFilters, scope ) {
    /**
     * Check the validity of the parameters
     */

    var scopeURI = scope.context.vrSublocationState.scopeURI.get( 'IAV0TestProcedur' );
    var deferred = AwPromiseService.instance.defer();


    /**
     * Get the 'child' nodes async
     */
    _buildTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput, columnProviders, parentUid, testProcedureTreeTableColumnFilters, testResultColumnFilters, scopeURI );

    return deferred.promise;
};

export let loadTreeTableProperties = function( propertyLoadInput, data, scope ) {
    var scopeURI = scope.context.vrSublocationState.scopeURI.get( 'IAV0TestProcedur' );
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if( propertyLoadInput ) {
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
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            if( response ) {
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
                if( childNode.modelType ) {
                    prop.propertyDescriptor = childNode.modelType.propertyDescriptorsMap.crt1Result;
                }
                lovService.initNativeCellLovApi( prop, null, 'EDIT', childNode );
                childNode.props.crt1Result = prop;
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                    var propColumns = propertyLoadResult.columnConfig.columns;
                    _.forEach( propColumns, function( col ) {
                        if( !col.typeName && col.associatedTypeName ) {
                            col.typeName = col.associatedTypeName;
                        }
                    } );
                } );
            } );
            eventBus.publish( 'TPTable.modelObjectsLoaded' );
            if( data.data.panelPinned === true ) {
                eventBus.publish( 'TPTable.setSelection' );
            }
            //update viewModelProperties
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
}

function queryColumnConfig( columnConfigUri, scopeURI ) {
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

            if( _isArrayPopulated( response.columnConfigurations ) ) {
                var columnConfigurations = response.columnConfigurations[ 0 ];

                if( _isArrayPopulated( columnConfigurations.columnConfigurations ) ) {
                    columnConfigurations = columnConfigurations.columnConfigurations;

                    if( _isArrayPopulated( columnConfigurations ) ) {
                        columns = _processUiConfigColumns( columnConfigurations[ 0 ].columns );
                    }
                }
            }
            if( response.ServiceData && response.ServiceData.partialErrors ) {
                messageService.showError( response.ServiceData.partialErrors[0].errorValues[0].message );
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
            enableSorting: false,
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
export let loadTreeTableColumns = function( dataProvider, data, scope ) { // Get the column config
    var scopeURI = scope.context.vrSublocationState.scopeURI.get( 'IAV0TestProcedur' );
    _promiseColumnConfig = AwPromiseService.instance.defer();

    let columnConfigUri = scope.context.vrSublocationState.columnConfig.get( 'IAV0TestProcedur' );

    data.columnConfigForDataProvider = columnConfigUri;

    queryColumnConfig( columnConfigUri, scopeURI );


    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: dynamicTableUtils.addExtraColumn( _columnConfigData.columnInfos )
        };

        return _columnConfigData;
    } );
};

export let checkAndReloadTestProcedureChart = function( data, chartProp ) {
    if( data.eventData !== undefined ) {
        var state = data.eventData.state;
        if( state === 'saved' && chartProp && chartProp.pieChartData && chartProp.pieChartData.vrTables && chartProp.pieChartData.vrTables.callSoaOnEdit === true ) {
            eventBus.publish( 'TPTable.modelObjectsEdited' );
            const newPieChartData = { ...chartProp.value };
            newPieChartData.pieChartData.vrTables.callSoaOnEdit = false;
            chartProp.update && chartProp.update( newPieChartData );
        }
    }
};

/**
 * this function is used to filter the Functions Table when a particular section of the pie chart is selected
 * @param {object} data data
 */
export let filterTestProcedureTable = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.TestProcedure ) {
        var selectedLabel = data.eventMap[ 'undefined.selected' ].label;
        const vrSubState =  { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        newChartProp.vrTables.testProcedureTableProvider.testProcedurePieClicked = true;
        if( newChartProp.vrTables.topPieChart.testResultPieClicked ) {
            newChartProp.vrTables.topPieChart.testResultPieClicked = false;
            newChartProp.vrTables.topPieChart.redrawTestResultPieAsDoubleFilter = true;
        }
        if( data.eventData.label !== selectedLabel ) {
            flagForFilter = true;
        } else {
            flagForFilter = false;
        }

        data.eventData.label = selectedLabel;
        if( data.eventData.label === data.i18n.Pass || data.eventData.label === data.i18n.Fail || data.eventData.label === data.i18n.Blocked || data.eventData.label === data.i18n.Caution ) {
            var testProcedureTreeTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ data.eventData.label ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            testProcedureTreeTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            } ];
        }
        newChartProp.vrTables.testProcedureTableProvider.testProcedureTreeTableColumnFilters = testProcedureTreeTableColumnFilters;
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
        eventBus.publish( 'testProcedureTable.plTable.reload' );
    }
};

/**
 * this function is used to filter the Functions Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAllTestProcedure = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.TestProcedure ) {
        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            const vrSubState =  { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables.testProcedureTableProvider.testProcedurePieClicked = false;
            newChartProp.vrTables.testProcedureTableProvider.testProcedureTreeTableColumnFilters = [];
            vrSubState.pieChartData = newChartProp;
            chartProp.update && chartProp.update( vrSubState );
            eventBus.publish( 'testProcedureTable.plTable.reload' );
        }
    }
};

export let setSelection = function( data ) {
    var dataProvider = data.dataProviders.testProcedureTableProvider;
    var selModel = dataProvider.selectionModel;
    var TPTableSelection = data.data.selectedObjects[0];
    selModel.setSelection( TPTableSelection );
};

export let getParentUid = function( subPanelContext ) {
    var parentUid;
    if( subPanelContext && subPanelContext.selection && subPanelContext.selection[0] ) {
        parentUid = subPanelContext.selection[0].uid;
    }
    return parentUid;
};

export default exports = {
    getDataFromProvider,
    loadTestProcedureTreeData,
    loadTreeTableProperties,
    loadTreeTableColumns,
    checkAndReloadTestProcedureChart,
    filterTestProcedureTable,
    displayAllTestProcedure,
    setSelection,
    getParentUid
};
