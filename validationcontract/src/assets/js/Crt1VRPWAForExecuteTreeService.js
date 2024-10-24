// Copyright (c) 2023 Siemens

/**
 * @module js/Crt1VRPWAForExecuteTreeService
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
import selectionService from 'js/selection.service';
import AwStateService from 'js/awStateService';
import _dms from 'soa/dataManagementService';
import getResultAndChartDataService from 'js/getResultAndChartDataService';

var _promiseColumnConfig = null;
var _columnConfigData = null;
var exports = {};
var _deferExpandTreeNodeArray = [];
var _treeColumnInfos = [];
var flagForFilter;
let ss = 0;
let mm = 0;
let hh = 0;
// rename this with setTime
var timeTime;

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

function _buildTreeTableStructure( parentNode, deferred, treeLoadInput, columnProviders, parentUid, testCaseTreeTableColumnFilters, testResultColumnFilters, scopeURI ) {
    let params = AwStateService.instance.params;
    var parentUid = params.uid;
    var selectedobj;
    var type = 'IAV0TestProcedureRevision';
    var filterOnForTcTree = [];
    if( testCaseTreeTableColumnFilters && testCaseTreeTableColumnFilters.length > 0 ) {
        filterOnForTcTree = testCaseTreeTableColumnFilters;
    } else if( testResultColumnFilters && testResultColumnFilters.length > 0 ) {
        filterOnForTcTree = testResultColumnFilters;
    }
    if( columnProviders !== undefined ) {
        var isTableColumnFiltering = true;
    }

    if( parentNode.type === 'rootType' ) {
        selectedobj = null;
        parentNode.isExpanded = false;
    } else {
        selectedobj = parentNode.uid;
        type = null;
        parentNode.isExpanded = true;
    }
    if( filterOnForTcTree ) {
        columnProviders = filterOnForTcTree;
        var searchCriteria = {
            parentUid: parentUid,
            requestedObjectUid: selectedobj,
            requestedTypeFilter: type,
            isTreeTable: 'true',
            tableUID: 'executeTest'
        };
    } else {
        searchCriteria = {
            parentUid: parentUid,
            requestedObjectUid: selectedobj,
            requestedTypeFilter: type,
            tableUID: 'executeTest'
        };
    }
    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Crt1ExecuteTestPWATable'
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Crt1AnalysisRequestInProvider',
            attributesToInflate: [ 'crt1SourceObject' ],
            searchCriteria: searchCriteria,
            startIndex: treeLoadInput.startChildNdx,
            columnFilters: columnProviders
        },
        inflateProperties: true
    };

    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.uid;
    treeLoadInput.displayMode = 'Tree';

    exports.getDataFromProvider( deferred, treeLoadInput, soaInput, isTableColumnFiltering );
}

export let getDataFromProvider = function( deferred, treeLoadInput, soaInput, isTableColumnFiltering ) {
    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
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
                eventBus.publish( 'ExecuteTable.modelObjectsLoadedForExecute' );
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

    return awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
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

    var vmNode = awTableSvc
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

export let loadTreeDataForExecute = function( treeLoadInput, columnProviders, parentUid, testCaseTreeTableColumnFilters, testResultColumnFilters, scope ) {
    /**
     * Check the validity of the parameters
     */

    var scopeURI = 'Crt1ExecuteTestPWATable';
    var deferred = AwPromiseService.instance.defer();

    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if( failureReason ) {
        deferred.reject( failureReason );

        return deferred.promise;
    }

    /**
     * Get the 'child' nodes async
     */
    _buildTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput, columnProviders, parentUid, testCaseTreeTableColumnFilters, testResultColumnFilters, scopeURI );

    return deferred.promise;
};

export let loadTreeTablePropertiesForExecute = function( propertyLoadInput, data, scope ) {
    var scopeURI = 'Crt1ExecuteTestPWATable';
    var dataProvider = data.dataProviders.treeTableExecuteProvider;
    var selModel = dataProvider.selectionModel;
    var TestCaseTableSelection;
    if( data && data.subPanelContext && data.subPanelContext.pwaSelectionModel && data.subPanelContext.pwaSelectionModel.selectionData && data.subPanelContext.pwaSelectionModel.selectionData.selected &&
        data.subPanelContext.pwaSelectionModel.selectionData.selected.length > 0 ) {
        TestCaseTableSelection = data.subPanelContext.pwaSelectionModel.selectionData.selected[ 0 ];
    } else if( dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        TestCaseTableSelection = dataProvider.viewModelCollection.loadedVMObjects[ 0 ];
    }
    selModel.setSelection( TestCaseTableSelection );
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
        clientScopeURI: 'Crt1ExecuteTestPWATable'
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );

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
            //Default width for single time.
            var widthValue = appCtxSvc.ctx.firstTimeTableLoadTestCase;
            if( widthValue === undefined ) {
                propertyLoadResult.columnConfig.columns[ 0 ].pixelWidth = 210;
                appCtxSvc.registerCtx( 'firstTimeTableLoadTestCase', true );
            }
            eventBus.publish( 'ExecuteTable.modelObjectsLoadedForExecute' );
            if( data.data.panelPinned === true ) {
                eventBus.publish( 'TestCaseTable.setSelection1' );
            }
            eventBus.publish( 'testCaseTreeTable.expandNode' );
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
            clientScopeURI: 'Crt1ExecuteTestPWATable',
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
                messageService.showError( response.ServiceData.partialErrors[ 0 ].errorValues[ 0 ].message );
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
            typeName: columns[ idx ].typeName,
            maxWidth: 400,
            minWidth: 60,
            hiddenFlag: columns[ idx ].hiddenFlag,
            pixelWidth: columns[ idx ].pixelWidth,
            width: columns[ idx ].pixelWidth,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableSorting: false,
            enableColumnMoving: true
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
// get type & uid for execute
function _getParentInfo( data ) {
    var type;
    if( data && data.dataProviders && data.dataProviders.treeTableExecuteProvider && data.dataProviders.treeTableExecuteProvider.selectedObjects[ 0 ] && data.dataProviders.treeTableExecuteProvider
        .selectedObjects[ 0 ].type ) {
        type = data.dataProviders.treeTableExecuteProvider.selectedObjects[ 0 ].type;
    }
    var uid;
    if( data && data.dataProviders && data.dataProviders.treeTableExecuteProvider && data.dataProviders.treeTableExecuteProvider.selectedObjects[ 0 ] && data.dataProviders.treeTableExecuteProvider
        .selectedObjects[ 0 ].uid ) {
        uid = data.dataProviders.treeTableExecuteProvider.selectedObjects[ 0 ].uid;
    }
    return {
        type: type,
        uid: uid
    };
}
export let loadTreeTableColumnsForExecute = function( dataProvider, data ) { // Get the column config
    _promiseColumnConfig = AwPromiseService.instance.defer();

    let columnConfigUri = 'Crt1ExecuteTestPWATable';

    data.columnConfigForDataProvider = columnConfigUri;

    var scope = 'Crt1ExecuteTestPWATable';
    queryColumnConfig( columnConfigUri, scope );

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: dynamicTableUtils.addExtraColumn( _columnConfigData.columnInfos )
        };

        return _columnConfigData;
    } );
};

export let nextAction = function( data ) {
    var PWASelection;
    var dataProvider = data.dataProviders.treeTableExecuteProvider;
    var selModel = dataProvider.selectionModel;
    // loaded pwa object
    var loadedVMObjects = dataProvider.viewModelCollection.loadedVMObjects;
    // selected pwa object
    var selectedObjects = data.dataProviders.treeTableExecuteProvider.selectedObjects;
    for( var i = 0; i < loadedVMObjects.length; i++ ) {
        if( selectedObjects[ 0 ].uid === loadedVMObjects[ i ].uid ) {
            if( i === loadedVMObjects.length - 1 ) {
                PWASelection = loadedVMObjects[ 0 ];
            } else {
                PWASelection = loadedVMObjects[ i + 1 ];
            }
            selModel.setSelection( PWASelection );
            break;
        }
    }
};

export let previousAction = function( data ) {
    var PWASelection;
    var dataProvider = data.dataProviders.treeTableExecuteProvider;
    var selModel = dataProvider.selectionModel;
    // loaded pwa object
    var loadedVMObjects = dataProvider.viewModelCollection.loadedVMObjects;
    // selected pwa object
    var selectedObjects = data.dataProviders.treeTableExecuteProvider.selectedObjects;
    for( var i = 0; i < loadedVMObjects.length; i++ ) {
        if( selectedObjects[ 0 ].uid === loadedVMObjects[ i ].uid ) {
            if( selectedObjects[ i ] === loadedVMObjects[ 0 ] ) {
                PWASelection = loadedVMObjects[ loadedVMObjects.length - 1 ];
            } else {
                PWASelection = loadedVMObjects[ i - 1 ];
            }
            selModel.setSelection( PWASelection );
            break;
        }
    }
};

export let expandNode = function( selectedObjects, dataProviders ) {
    var ObjToCompare = selectedObjects;
    var dataProvider = dataProviders.treeTableExecuteProvider;
    if( dataProvider ) {
        var list = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        for( var i = 0; i < list.length; i++ ) {
            if( ObjToCompare && ObjToCompare[ 0 ] && ObjToCompare[ 0 ].props &&
                ObjToCompare[ 0 ].props.crt1SourceObject && ObjToCompare[ 0 ].props.crt1SourceObject.dbValues[ 0 ] &&
                list[ i ].props && list[ i ].props.crt1SourceObject && list[ i ].props.crt1SourceObject.dbValues[ 0 ] === ObjToCompare[ 0 ].props.crt1SourceObject.dbValues[ 0 ] ) {
                eventBus.publish( 'treeTableExecuteProvider.expandTreeNode', {
                    parentNode: list[ i ]
                } );
            }
        }
    }
};

export let getParentUid = function( subPanelContext ) {
    var parentUid;
    if( subPanelContext && subPanelContext.selection && subPanelContext.selection[ 0 ] ) {
        parentUid = subPanelContext.selection[ 0 ].uid;
    }
    return parentUid;
};

// To change the selection from treetable on execute
export let changeSelectionForExecute = function( data, subPanelContext ) {
    var dataProvider = null;
    var selectedObjects = [];
    if( data && data.dataProviders && data.dataProviders.treeTableExecuteProvider ) {
        dataProvider = data.dataProviders.treeTableExecuteProvider;
        selectedObjects = dataProvider.selectedObjects;
        appCtxSvc.registerCtx( 'vrContentTableSelection', selectedObjects );
    }
    var selection = selectionService.getSelection();
    if( selectedObjects ) {
        var correctedSelection1 = [];
        var parentSelection;
        var selectedElementsInPWA = _.get( appCtxSvc, 'ctx.occmgmtContext.selectedModelObjects', [] );
        if( selectedObjects.length > 0 && selectedElementsInPWA.length === 1 ) {
            parentSelection = selectedElementsInPWA[ 0 ];
        } else {
            if( !selection.parent ) {
                var parent = appCtxSvc.ctx.parentSelection;
                parentSelection = parent;
                appCtxSvc.registerCtx( 'pselected', parentSelection );
            } else {
                parentSelection = selection.parent;
                appCtxSvc.registerCtx( 'parentSelection', parentSelection );
            }
        }
        // get the selected attributes
        for( var j = 0; j < selectedObjects.length; ++j ) {
            var proxyUid = selectedObjects[ j ].uid;
            var proxyObj = cdm.getObject( proxyUid );
            var objUid = proxyObj.props.crt1SourceObject.dbValues[ 0 ];
            var attribute = cdm.getObject( objUid );
            correctedSelection1.push( attribute );
        }
    }

    const newVrSublocationState = { ...subPanelContext.vrSublocationState };
    newVrSublocationState.executeLocation = correctedSelection1;
    subPanelContext && subPanelContext && subPanelContext.vrSublocationState &&
        subPanelContext.vrSublocationState.update && subPanelContext.vrSublocationState.update( newVrSublocationState );
};

export let handleSelectionChange = function( tableProvider, subPanelContext ) {
    var objectToOpen;
    if( tableProvider && tableProvider.selectedObjects && tableProvider.selectedObjects.length > 0 ) {
        var selectionUid = tableProvider.selectedObjects[ 0 ].uid;
        var selection = _cdm.getObject( selectionUid );
        var underlyingObjUid = selection.props.crt1SourceObject.dbValues[ 0 ];
        var underlyingObj = _cdm.getObject( underlyingObjUid );
    } else if( subPanelContext && subPanelContext.selected && subPanelContext.selected.uid ) {
        selectionUid = subPanelContext.selected.uid;
        selection = _cdm.getObject( selectionUid );
    } else if( subPanelContext && subPanelContext.context && subPanelContext.context.baseSelection && subPanelContext.context.baseSelection.uid ) {
        selectionUid = subPanelContext.context.baseSelection.uid;
        selection = _cdm.getObject( selectionUid );
    }

    if( selection && selection.props && selection.props.awb0UnderlyingObject && selection.props.awb0UnderlyingObject.dbValues ) {
        objectToOpen = selection.props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        objectToOpen = selectionUid;
    }
    selection.objectToOpen = objectToOpen;
    var array = [];
    array.push( selection );
    var parentSelection;
    var selection = selectionService.getSelection();
    if( selection.parent ) {
        parentSelection = selection.parent;
    }
    if( array.length > 0 ) {
        selectionService.updateSelection( underlyingObj, parentSelection );
    }
    if( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.value ) {
        const tmpSelectionData = { ...subPanelContext.selectionData.value };
        tmpSelectionData.selected = array;
        subPanelContext.selectionData.update( tmpSelectionData );
    }
    if( subPanelContext && subPanelContext.context && subPanelContext.context.vrSublocationState &&
        subPanelContext.context.vrSublocationState.refreshPreviewPanel ) {
        eventBus.publish( 'refreshPreviewPanel' );
    }
};

// taskbar for execute
export let loadContentTaskBarForExecute = function() {
    let defer = AwPromiseService.instance.defer();
    var vrTaskBarContext12 = {};

    let params = AwStateService.instance.params;
    var openedObjectUid = params.uid;
    var openedObject = cdm.getObject( openedObjectUid );
    vrTaskBarContext12.openedObject = openedObject;

    defer.resolve( vrTaskBarContext12 );

    return defer.promise;
};

// set the result status for pass action.
export let passAction = function( subPanelContext, scopeSel, data ) {
    var passButtonClicked = false;
    var input = {
        object: {
            type: _getParentInfo( data ).type,
            uid: _getParentInfo( data ).uid
        },
        vecNameVal: [ {
            name: 'crt1Result',
            values: [ '200' ]
        } ]
    };
    _dms.setProperties( [ input ] );
    exports.getResultSOAInputForExecute( subPanelContext.context.vrSublocationState, scopeSel, subPanelContext, data );
    return passButtonClicked;
};

// set the fail status for fail action
export let failAction = function( subPanelContext, scopeSel, data ) {
    var failButtonClicked = false;
    var input = {
        object: {
            type: _getParentInfo( data ).type,
            uid: _getParentInfo( data ).uid
        },
        vecNameVal: [ {
            name: 'crt1Result',
            values: [ '100' ]
        } ]
    };
    _dms.setProperties( [ input ] );
    exports.getResultSOAInputForExecute( subPanelContext.context.vrSublocationState, scopeSel, subPanelContext, data );
    return failButtonClicked;
};
// set the block status for blocked action
export let blockedAction = function( subPanelContext, scopeSel, data ) {
    var blockedButtonClicked = false;
    var input = {
        object: {
            type: _getParentInfo( data ).type,
            uid: _getParentInfo( data ).uid
        },
        vecNameVal: [ {
            name: 'crt1Result',
            values: [ '400' ]
        } ]
    };
    _dms.setProperties( [ input ] );
    exports.getResultSOAInputForExecute( subPanelContext.context.vrSublocationState, scopeSel, subPanelContext, data );
    return blockedButtonClicked;
};
// set the warn status for warning action
export let cautionAction = function( subPanelContext, scopeSel, data ) {
    var cautionButtonClicked = false;
    var input = {
        object: {
            type: _getParentInfo( data ).type,
            uid: _getParentInfo( data ).uid
        },
        vecNameVal: [ {
            name: 'crt1Result',
            values: [ '500' ]
        } ]
    };
    _dms.setProperties( [ input ] );
    exports.getResultSOAInputForExecute( subPanelContext.context.vrSublocationState, scopeSel, subPanelContext, data );
    return cautionButtonClicked;
};

//  update result column for execute
export let isAttrItemUpdatedForExecute = function( eventMap, scopeSel, subPanelContext, data ) {
    if( eventMap ) {
        var isItemRevisionObj;
        var isItemObj;
        var updated = eventMap[ 'cdm.updated' ];
        var updatedObjects = updated.updatedObjects;
        if( updatedObjects ) {
            for( var i = 0; i < updatedObjects.length; ++i ) {
                if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                    isItemRevisionObj = true;
                } else if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Item' ) > -1 ) {
                    isItemObj = true;
                }
            }
            if( isItemRevisionObj && isItemObj ) {
                eventBus.publish( 'pwaTableForExecute.plTable.reload' );
            }
        }
        if( updatedObjects ) {
            for( var i = 0; i < updatedObjects.length; ++i ) {
                if( updatedObjects[ i ].type === 'Att0MeasurableAttribute' || updatedObjects[ i ].type === 'Att0MeasureValue' || updatedObjects[ i ].type === 'Att1AttributeAlignmentProxy' ||
                    updatedObjects[ i ].type === 'Crt0AttributeElement' ) {
                    exports.getResultSOAInputForExecute( subPanelContext.context.vrSublocationState, scopeSel, subPanelContext, data );
                    break;
                }
            }
        }
    }
};

export let getResultSOAInputForExecute = function( visibleProxies, scopeSel, subPanleCtx, data ) {
    var inputProxyData = [];
    let vrContext = appCtxSvc.getCtx( 'vrContext' );
    let scopeObjects = [];
    let params = AwStateService.instance.params;
    var selectedObjUids = params.uid;
    var selectedObject = cdm.getObject( selectedObjUids );
    if( selectedObject && selectedObject.props && selectedObject.props.object_name && selectedObject.props.object_name.dbValues[ 0 ] ) {
        scopeSel = selectedObject.props.object_name.dbValues[ 0 ];
    } else if( params && params.uid2 ) {
        // when user refreshes the sublocation selected object is undefined take values from params.
        scopeSel = params.uid2;
    }
    let scopeTreeObjects;
    if( selectedObject && selectedObject.props && selectedObject.props.object_name && selectedObject.props.object_name.dbValues ) {
        scopeTreeObjects = selectedObject.props.object_name.dbValues;
    } else if( params && params.uid2 ) {
        // when user refreshes the sublocation selected object is undefined take values from params.
        scopeTreeObjects = params.uid2;
    }
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
    var dataProvider = data.dataProviders.treeTableExecuteProvider;
    visibleProxies = dataProvider.viewModelCollection.loadedVMObjects;
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
    var type;
    if( selectedObject && selectedObject.type ) {
        type = selectedObject.type;
    } else if( params && params.pci_uid ) {
        type = params.pci_uid;
    }
    var uid;
    if( selectedObject && selectedObject.uid ) {
        uid = selectedObject.uid;
    } else if( params && params.uid ) {
        uid = params.uid;
    }
    let scopeSelectionInfo = {
        contentObject: {
            type: type,
            uid: uid
        },
        result: '',
        resultInfo: ''
    };
    getResultAndChartDataService.callGetResultAndChartDataSOA( scopeSelectionInfo, inputProxyData, additionalInfo, subPanleCtx, data );
};

export let modelObjectsLoadedForExecute = function( dataProvider, selectionForExecute, subPanleCtx, data ) {
    let params = AwStateService.instance.params;
    var selectedObjUids = params.uid;
    var selectedObject = cdm.getObject( selectedObjUids );
    if( selectedObject && selectedObject.props && selectedObject.props.object_name && selectedObject.props.object_name.dbValues[ 0 ] ) {
        selectionForExecute = selectedObject.props.object_name.dbValues[ 0 ];
    } else if( params && params.uid2 ) {
        // when user refreshes the sublocation selected object is undefined take values from params.
        selectionForExecute = params.uid2;
    }
    var visibleProxies;
    if( dataProvider && dataProvider.viewModelCollection && dataProvider.viewModelCollection.loadedVMObjects ) {
        visibleProxies = dataProvider.viewModelCollection.loadedVMObjects;
    }
    exports.getResultSOAInputForExecute( visibleProxies, selectionForExecute, subPanleCtx, data );
};

export let finishExecution = function( data ) {
    var type;
    if( data && data.ctx && data.ctx.vr_previousSelectionForExecute && data.ctx.vr_previousSelectionForExecute.type ) {
        type = data.ctx.vr_previousSelectionForExecute.type;
    } else if( data && data.ctx && data.ctx.state && data.ctx.state.params && data.ctx.state.params.pci_uid ) {
        // when user refreshes the sublocation take values from params.
        type = data.ctx.state.params.pci_uid;
    }
    var uid;
    if( data && data.ctx && data.ctx.vr_previousSelectionForExecute && data.ctx.vr_previousSelectionForExecute.uid ) {
        uid = data.ctx.vr_previousSelectionForExecute.uid;
    } else if( data && data.ctx && data.ctx.state && data.ctx.state.params && data.ctx.state.params.uid ) {
        // when user refreshes the sublocation take values from params.
        uid = data.ctx.state.params.uid;
    }
    var input = {
        object: { type, uid },
        vecNameVal: [ {
            name: 'crt0ValStatus',
            values: [ 'Completed' ]
        } ]
    };
    dmSvc.setProperties( [ input ] ).then( function( response ) {} );
};
export let onMountForExecute = function( data ) {
    var uid;
    if( data && data.ctx && data.ctx.vr_previousSelectionForExecute && data.ctx.vr_previousSelectionForExecute.uid ) {
        uid = data.ctx.vr_previousSelectionForExecute.uid;
    }
    var type;
    if( data && data.ctx && data.ctx.vr_previousSelectionForExecute && data.ctx.vr_previousSelectionForExecute.type ) {
        type = data.ctx.vr_previousSelectionForExecute.type;
    }
    var input = {
        object: { type, uid },
        vecNameVal: [ {
            name: 'crt0ValStatus',
            values: [ 'In Progress' ]
        } ]
    };
    dmSvc.setProperties( [ input ] ).then( function( response ) {} );
};
// Cell edit of pwaTreeTable in execute UI
export let modelObjectEditedInExecute = function( eventMap ) {
    if( eventMap ) {
        var isValidationLinkObj;
        var isVRContentProxyObj;
        var updated = eventMap[ 'cdm.updated' ];
        var updatedObjects = updated.updatedObjects;
        if( updatedObjects ) {
            for( var i = 0; i < updatedObjects.length; ++i ) {
                if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Crt0ValidationLink' ) > -1 ) {
                    isValidationLinkObj = true;
                } else if( updatedObjects[ i ] && updatedObjects[ i ].modelType && updatedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Crt1VRContentProxy' ) > -1 ) {
                    isVRContentProxyObj = true;
                }
            }
            if( isValidationLinkObj && isVRContentProxyObj ) {
                eventBus.publish( 'ExecuteTable.modelObjectsLoadedForExecute' );
            }
        }
    }
};
export let passButtonClicked = function( data ) {
    return true;
};
export let failButtonClicked = function( data ) {
    return true;
};
export let blockedButtonClicked = function( data ) {
    return true;
};
export let cautionButtonClicked = function( data ) {
    return true;
};
export default exports = {
    getDataFromProvider,
    loadTreeDataForExecute,
    loadTreeTablePropertiesForExecute,
    loadTreeTableColumnsForExecute,
    nextAction,
    previousAction,
    expandNode,
    getParentUid,
    changeSelectionForExecute,
    handleSelectionChange,
    loadContentTaskBarForExecute,
    passAction,
    failAction,
    blockedAction,
    cautionAction,
    isAttrItemUpdatedForExecute,
    getResultSOAInputForExecute,
    modelObjectsLoadedForExecute,
    finishExecution,
    onMountForExecute,
    modelObjectEditedInExecute,
    passButtonClicked,
    failButtonClicked,
    blockedButtonClicked,
    cautionButtonClicked

};
