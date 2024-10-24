// Copyright (c) 2021 Siemens

/**
 * @module js/Crt1TestCaseTreeTableService
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

function _buildTreeTableStructure( parentNode, deferred, treeLoadInput, columnProviders, parentUid, testCaseTreeTableColumnFilters, testResultColumnFilters, scopeURI ) {
    var selectedobj;
    var type = 'IAV0TestCaseRevision';
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
        columnProviders = filterOnForTcTree;
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
        tableUID: 'IAV0TestCase'
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
            startIndex: treeLoadInput.startChildNdx,
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
                eventBus.publish( 'TCTable.modelObjectsLoaded' );
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
    var displayName = obj.props.crt1SourceObject.uiValues[0];

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

export let loadTestCaseTreeData = function( treeLoadInput, columnProviders, parentUid, testCaseTreeTableColumnFilters, testResultColumnFilters, scope ) {
    /**
     * Check the validity of the parameters
     */

    var scopeURI = scope.context.vrSublocationState.scopeURI.get( 'IAV0TestCase' );
    var deferred = AwPromiseService.instance.defer();

    /**
     * Get the 'child' nodes async
     */
    _buildTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput, columnProviders, parentUid, testCaseTreeTableColumnFilters, testResultColumnFilters, scopeURI );

    return deferred.promise;
};

export let loadTreeTableProperties = function( propertyLoadInput, data, scope ) {
    var scopeURI = scope.context.vrSublocationState.scopeURI.get( 'IAV0TestCase' );
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
            eventBus.publish( 'TCTable.modelObjectsLoaded' );
            if( data.data.panelPinned === true ) {
                eventBus.publish( 'TestCaseTable.setSelection' );
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
export let loadTreeTableColumns = function( dataProvider, data ) { // Get the column config
    _promiseColumnConfig = AwPromiseService.instance.defer();

    let columnConfigUri = 'Crt1TestCaseTable';

    data.columnConfigForDataProvider = columnConfigUri;

    var scope = 'Crt1TestCaseTable';
    queryColumnConfig( columnConfigUri, scope );

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: dynamicTableUtils.addExtraColumn( _columnConfigData.columnInfos )
        };

        return _columnConfigData;
    } );
};

export let checkAndReloadTestCaseChart = function( data, chartProp ) {
    if( data.eventData !== undefined ) {
        var state = data.eventData.state;
        if( state === 'saved' && chartProp && chartProp.pieChartData && chartProp.pieChartData.vrTables && chartProp.pieChartData.vrTables.callSoaOnEdit === true ) {
            eventBus.publish( 'TCTable.modelObjectsEdited' );
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
export let filterTestCaseTable = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.selected' ].seriesName === data.i18n.TestCase ) {
        const vrSubState =  { ...chartProp.value };
        const newChartProp = vrSubState.pieChartData;
        newChartProp.vrTables.testCaseTableProvider.testCasePieClicked = true;
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
            var testCaseTreeTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ data.eventData.label ]

            } ];
        } else if( data.eventData.label === data.i18n.NoResult ) {
            testCaseTreeTableColumnFilters = [ {

                columnName: 'crt1Result',
                operation: 'equals',
                values: [ '', '<>' ]

            } ];
        }
        newChartProp.vrTables.testCaseTableProvider.testCaseTreeTableColumnFilters = testCaseTreeTableColumnFilters;
        vrSubState.pieChartData = newChartProp;
        chartProp.update && chartProp.update( vrSubState );
        eventBus.publish( 'testCaseTable.plTable.reload' );
    }
};

/**
 * this function is used to filter the Functions Table when a particular section of the pie chart is un-selected
 * @param {object} data data
 */
export let displayAllTestCase = function( data, chartProp ) {
    if( data.eventMap[ 'undefined.unselected' ].seriesName === data.i18n.TestCase ) {
        if( flagForFilter ) {
            flagForFilter = false;
        } else {
            const vrSubState =  { ...chartProp.value };
            const newChartProp = vrSubState.pieChartData;
            newChartProp.vrTables.testCaseTableProvider.testCasePieClicked = false;
            newChartProp.vrTables.testCaseTableProvider.testCaseTreeTableColumnFilters = [];
            vrSubState.pieChartData = newChartProp;
            chartProp.update && chartProp.update( vrSubState );
            eventBus.publish( 'testCaseTable.plTable.reload' );
        }
    }
};

export let setSelection = function( data ) {
    var dataProvider = data.dataProviders.testCaseTableProvider;
    var selModel = dataProvider.selectionModel;
    var TestCaseTableSelection = data.data.selectedObjects[ 0 ];
    selModel.setSelection( TestCaseTableSelection );
};

export let expandNode = function( selectedObjects, dataProviders ) {
    var ObjToCompare = selectedObjects;
    var dataProvider = dataProviders.testCaseTableProvider;
    if( dataProvider ) {
        var list = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        for( var i = 0; i < list.length; i++ ) {
            if( ObjToCompare && ObjToCompare[ 0 ] && ObjToCompare[ 0 ].props &&
                ObjToCompare[ 0 ].props.crt1SourceObject && ObjToCompare[ 0 ].props.crt1SourceObject.dbValues[ 0 ] &&
                list[ i ].props && list[ i ].props.crt1SourceObject && list[ i ].props.crt1SourceObject.dbValues[ 0 ] === ObjToCompare[ 0 ].props.crt1SourceObject.dbValues[ 0 ] ) {
                eventBus.publish( 'testCaseTableProvider.expandTreeNode', {
                    parentNode: list[ i ]
                } );
            }
        }
    }
};

export let getParentUid = function( subPanelContext ) {
    var parentUid;
    if( subPanelContext && subPanelContext.selection && subPanelContext.selection[0] ) {
        parentUid = subPanelContext.selection[0].uid;
    }
    return parentUid;
};

export let setResultRollup = async function( commandContext ) {
    var parentNode = '';
    var parentUid = '';
    if ( commandContext.dataProvider ) { //check if commandContext.DataProvider exists
        
        parentNode = commandContext.vrSublocationState.mselected[0];
        parentUid = getParentUid(commandContext.subPanelContext);
        var parentInfo = {
            parentUid : parentNode.uid,
            parentName : parentNode.props.object_name.dbValues[0],
            parentType : parentNode.type,
            parentChildrens : parentNode.props.crt0ChildrenStudies
        }
        if(parentInfo.parentType == "Crt0StudyRevision"){ // study에서 실행
            // Study 하위 Run 정보 찾기
            var childrenDbvalues = parentInfo.parentChildrens.dbValues;
            var childrenDisplayvalues = parentInfo.parentChildrens.displayValues;
            var childrenInfos = new Array(); 
            for(let i=0; i<childrenDbvalues.length; i++){
                var chilrenInfo = {
                    childrenUid : childrenDbvalues[i],
                    childrenName : childrenDisplayvalues[i]
                }
                childrenInfos.push(chilrenInfo);
            }

            // Run Testcase 정보 찾기
            for(let i=0; i<childrenInfos.length; i++){
                var testcaseInfo = await searchTestCaseRevision( childrenInfos[i] );
                for(let j=0; j<testcaseInfo.length; j++){
                    var crt0ActualResult = await getTestCaseActualResult( testcaseInfo[j].crt1ValidationLinkUid );
                    testcaseInfo[j].crt0ActualResult = crt0ActualResult;
                }
                childrenInfos[i].testcaseInfos = testcaseInfo;
            }
            // 우선 순위에 맞게 Overall
            let priority = ['200', '500', '400', '100', '300']; // Pass(200) < Caution(500) < Blocked(400) < Fail(100) < 빈값(300)
            let allElements = commandContext.dataProvider.getViewModelCollection().loadedVMObjects;
            for(let i=0; i<allElements.length; i++){
                var result = '';
                var tcUid = allElements[i].props.crt1SourceObject.dbValues[0];
                if(tcUid.search('SR::N')  >= 0){
                    tcUid = allElements[i].props.crt1UnderlyingObject.dbValues[0];
                }
                var actualResult = '';
                for(let j=0; j<childrenInfos.length; j++){
                    var testcases = childrenInfos[j].testcaseInfos;
                    for(let k=0; k<testcases.length; k++){
                        let cTcUid = testcases[k].testCaseUid;
                        let cResult = testcases[k].crt1result;
                        let cActualResult = testcases[k].crt0ActualResult;
                        if(tcUid == cTcUid){
                            if( priority.indexOf(result) < priority.indexOf(cResult) ){
                                result = cResult;
                            }
                            if(cActualResult == ''){
                                cActualResult = ' ';
                            }
                            if(actualResult == ''){
                                actualResult = cActualResult;
                            } else{
                                actualResult = actualResult + " [/] " + cActualResult;
                            }
                        }
                    }
                }
                // set Result
                var validationLink = allElements[i].props.crt1ValidationLink.dbValue;
                var object = cdm.getObject( validationLink );
                await setTestCaseRevision(object, result, actualResult);
            }
          
        }else if(parentInfo.parentType == "Crt0TestRevision"){ // test에서 실행
            // 하위 Study 정보 찾기
            var childrenInfos = await searchStudyRevision( parentUid );

            // Study Testcase 정보 찾기
            for(let i=0; i<childrenInfos.length; i++){
                var testcaseInfo = await searchTestCaseRevision( childrenInfos[i] );
                for(let j=0; j<testcaseInfo.length; j++){
                    var crt0ActualResult = await getTestCaseActualResult( testcaseInfo[j].crt1ValidationLinkUid );
                    testcaseInfo[j].crt0ActualResult = crt0ActualResult;
                }
                childrenInfos[i].testcaseInfos = testcaseInfo;
            }
            
            // 최신 Study부터 Result 찾기 Lastest
            let allElements = commandContext.dataProvider.getViewModelCollection().loadedVMObjects;
            for(let i=0; i<allElements.length; i++){
                var result = '';
                var actualResult = '';
                var tcUid = allElements[i].props.crt1SourceObject.dbValues[0];
                if(tcUid.search('SR::N') >= 0){
                    tcUid = allElements[i].props.crt1UnderlyingObject.dbValues[0];
                }

                for(let j=childrenInfos.length-1; j>=0; j--){
                    var testcases = childrenInfos[j].testcaseInfos;
                    for(let k=0; k<testcases.length; k++){
                        let cTcUid = testcases[k].testCaseUid;
                        let cResult = testcases[k].crt1result;
                        let cActualResult = testcases[k].crt0ActualResult;
                        if(tcUid == cTcUid){
                            result = cResult;
                            actualResult = cActualResult;
                            break;
                        }
                    }
                    if(!isEmpty(result)){
                        break;
                    }
                }
                // 값이 없는 경우 <> 빈값 설정
                if(isEmpty(result)){
                    result = "300";
                    actualResult = '';
                }
                // set Result
                var validationLink = allElements[i].props.crt1ValidationLink.dbValue;
                var object = cdm.getObject( validationLink );
                await setTestCaseRevision(object, result, actualResult);
            }
        }
        // reload
        eventBus.publish( 'testCaseTable.plTable.reload' );
        eventBus.publish( 'requirementsTable.plTable.reload' );
    }
};

export let searchTestCaseRevision = function( childrenInfo ) {
    var policyIOverride = {
        types: [ {
            name: 'Crt1VRContentProxy',
            properties: [ {
                name: 'crt1UnderlyingObject',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }, 
            {
                name: 'crt1Result'
            }, 
            {
                name: 'crt1SourceObject',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'crt1ValidationLink',
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

    
    var searchCriteria = {
        parentUid: childrenInfo.childrenUid,
        requestedObjectUid: "",
        requestedTypeFilter: "IAV0TestCaseRevision",
        isTreeTable: 'true',
        tableUID: 'IAV0TestCase'
    };
    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: "Crt1TestCaseTable"
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Crt1AnalysisRequestInProvider',
            searchCriteria: searchCriteria,
            startIndex: 0,
            columnFilters: []
        },
        inflateProperties: false
    };

    const result = soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput, policyIOverride )
    .then(
        function( response ) {
            if( response && response.partialErrors ) {
                _.forEach( response.partialErrors, function( partErr ) {
                    if( partErr.errorValues ) {
                        // TO avoid display of duplicate messages returned in server response
                        var errMessage = '';
                        var messages = _.uniqBy( partErr.errorValues, 'code' );
                        _.forEach( messages, function( errVal ) {
                            if( errMessage.length === 0 ) {
                                errMessage += '</br>' + errVal.message;
                            } else {
                                errMessage += ' ' + errVal.message + '</br>';
                            }
                        } );
                        messageService.showError( errMessage );
                    }
                } );
            } else {

                var arrResults = new Array(); 
                if( response.searchResultsJSON ) {
                   
                    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                    if( searchResults ) {

                        for( var x = 0; x < searchResults.objects.length; ++x ) {
                            var uid = searchResults.objects[ x ].uid;
                            var obj = response.ServiceData.modelObjects[ uid ];
                            if( obj ) {
                                dmSvc.getProperties( [ obj ], [ 'object_name' ] );
                                var crt1ValidationLinkUid = obj.props.crt1ValidationLink.dbValues[0];
                                var tmpTestcaseUid = obj.props.crt1SourceObject.dbValues[0];
                                if(tmpTestcaseUid.search('SR::N') >= 0){
                                    if(obj.props.crt1UnderlyingObject == undefined){
                                        tmpTestcaseUid = "";
                                    }else{
                                        tmpTestcaseUid = obj.props.crt1UnderlyingObject.dbValues[0];
                                    } 
                                }
                                
                                var result = {
                                    testCaseUid : tmpTestcaseUid,
                                    testCaseName : obj.props.crt1SourceObject.uiValues[0],
                                    crt1result : obj.props.crt1Result.dbValues[0],
                                    crt1ValidationLinkUid : crt1ValidationLinkUid
                                }
                                arrResults.push(result);
                            }
                        }
                    }
                }
                 
                return arrResults;
            }
        }, function( error ) {
            if( error ) {
                messageService.showError( error.message );
            }
            error = null;
        }
    );
    const resolve = AwPromiseService.instance.resolve( result );
    
    return resolve;
    
};

export let searchStudyRevision = function( testUid ) {
    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Crt1ScopeTable'
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0ObjectSetRowProvider',
            searchCriteria: {
                parentUid: testUid,
                objectSet: 'crt0ChildrenStudies.Crt0StudyRevision',
                returnTargetObjs: 'true',
                showConfiguredRev: 'true',
                dcpSortByDataProvider: 'true'
            },
            columnFilters: [],
            searchFilterFieldSortType: 'Alphabetical',
            searchSortCriteria: [ {
                fieldName: '',
                sortDirection: ''
            } ]
        },
        inflateProperties: true
    };

    var policyIOverride = {
        types: [ {
            name: 'WorkspaceObject',
            properties: [ {
                name: 'object_string'
            } ]
        },
        {
            name: 'Crt0VldnContractRevision',
            properties: [ {
                name: 'crt0ChildrenStudies'
            } ]
        }
        ]
    };

    const result = soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput, policyIOverride )
    .then(
        function( response ) {
            if( response && response.partialErrors ) {
                _.forEach( response.partialErrors, function( partErr ) {
                    if( partErr.errorValues ) {
                        // TO avoid display of duplicate messages returned in server response
                        var errMessage = '';
                        var messages = _.uniqBy( partErr.errorValues, 'code' );
                        _.forEach( messages, function( errVal ) {
                            if( errMessage.length === 0 ) {
                                errMessage += '</br>' + errVal.message;
                            } else {
                                errMessage += ' ' + errVal.message + '</br>';
                            }
                        } );
                        messageService.showError( errMessage );
                    }
                } );
            } else {
                var arrResults = new Array(); 
                if( response.searchResultsJSON ) {
                    
                    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                    if( searchResults ) {
                        
                        for( var x = 0; x < searchResults.objects.length; ++x ) {
                            var uid = searchResults.objects[ x ].uid;
                            var obj = response.ServiceData.modelObjects[ uid ];
                            if( obj ) {
                                if( obj.type == "Crt0StudyRevision" ){
                                    dmSvc.getProperties( [ obj ], [ 'object_name' ] );
                                  
                                    var result = {
                                        childrenUid : obj.uid,
                                        childrenName : obj.props.object_name.dbValues[0]
                                    }
                                    arrResults.push(result);
                                }
                            }
                        }
                    }

                    
                }
                 
                return arrResults;
            }
        }, function( error ) {
            if( error ) {
                messageService.showError( error.message );
            }
            error = null;
        }
    );
    const resolve = AwPromiseService.instance.resolve( result );
    
    return resolve;
    
};

export let getTestCaseActualResult = function( testcaseRevisionUid ) {
    
    var arrObjects = new Array(); 
    var object = {
        uid: testcaseRevisionUid,
        type: "IAV0TestCaseRevision"
    }
    arrObjects.push(object);

    var request = {
        objects: arrObjects,
        attributes: ['Crt0ValidationLink', 'crt0Result', 'crt0ActualResult']
    };

    const result = soaSvc.postUnchecked( 'Core-2006-03-DataManagement', 'getProperties', request)
    .then(
        function( response ) {
            if( response && response.partialErrors ) {
                _.forEach( response.partialErrors, function( partErr ) {
                    if( partErr.errorValues ) {
                        // TO avoid display of duplicate messages returned in server response
                        var errMessage = '';
                        var messages = _.uniqBy( partErr.errorValues, 'code' );
                        _.forEach( messages, function( errVal ) {
                            if( errMessage.length === 0 ) {
                                errMessage += '</br>' + errVal.message;
                            } else {
                                errMessage += ' ' + errVal.message + '</br>';
                            }
                        } );
                        messageService.showError( errMessage );
                    }
                } );
            } else {
                
                if (response.plain) {
                    var actualResult = ''; 
                    const testcaseRev = response.modelObjects[response.plain[0]];
                    if (testcaseRev && testcaseRev.props.crt0ActualResult && testcaseRev.props.crt0ActualResult.dbValues[0] != null) {
                        actualResult = testcaseRev.props.crt0ActualResult.dbValues[0];
                    }
                } 
                return actualResult;
            }
        }, function( error ) {
            if( error ) {
                messageService.showError( error.message );
            }
            error = null;
        }
    );
    const resolve = AwPromiseService.instance.resolve( result );
    
    return resolve;
    
};

let setTestCaseRevision = (testCaseRevision, testcaseResult, actualResult) => {
    if (testCaseRevision) {
        var request = {
            info: [
                {
                    object: testCaseRevision,
                    timestamp: "",
                    vecNameVal: [
                        {
                            name: "crt0Result",
                            values: [
                                testcaseResult
                            ]
                        },
                        {
                            name: "crt0ActualResult",
                            values: [
                                actualResult
                            ]
                        }
                    ]
                }
            ]
        };
        const result = soaSvc.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', request)
        .then(
            function( response ) {
                if( response && response.partialErrors ) {
                    _.forEach( response.partialErrors, function( partErr ) {
                        if( partErr.errorValues ) {
                            // TO avoid display of duplicate messages returned in server response
                            var errMessage = '';
                            var messages = _.uniqBy( partErr.errorValues, 'code' );
                            _.forEach( messages, function( errVal ) {
                                if( errMessage.length === 0 ) {
                                    errMessage += '</br>' + errVal.message;
                                } else {
                                    errMessage += ' ' + errVal.message + '</br>';
                                }
                            } );
                            messageService.showError( errMessage );
                        }
                    } );
                } else {
                    //logger.debug('setRecordRevisionCurrentPhaseProperty, response', response);
                }
            }, function( error ) {
                if( error ) {
                    messageService.showError( error.message );
                }
                error = null;
            }
        );
        const resolve = AwPromiseService.instance.resolve( result );
        
        return resolve;
    }
};

function isEmpty(value){
    if( value == "" || value == null || value == undefined || ( value != null && typeof value == "object" && !Object.keys(value).length ) ){
       return true
     }else{
       return false
     }
};

export default exports = {
    getDataFromProvider,
    loadTestCaseTreeData,
    loadTreeTableProperties,
    loadTreeTableColumns,
    checkAndReloadTestCaseChart,
    filterTestCaseTable,
    displayAllTestCase,
    setSelection,
    expandNode,
    getParentUid,
	setResultRollup
};
