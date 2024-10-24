// Copyright (c) 2022 Siemens

/**
 * @module js/Eda0CadBaselineService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import awColumnSvc from 'js/awColumnService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import tcVmoService from 'js/tcViewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import selectionService from 'js/selection.service';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';

var exports = {};

var _treeColumnInfos = [];
var _searchFilterMap = {};
var _columnConfigData = null;
var _promiseColumnConfig = null;
/**
 * Method to return the UID of the selected object.
 *
 * @returns{Object} elementUID UID of the selected element.
 */
export let getElementUid = function() {
    var elementUID = '';
    var selection = selectionService.getSelection();
    var selectedObjs = selection.selected;
    elementUID = selectedObjs[ '0' ].uid;
    return elementUID;
};

/**
 * @returns{Object} rootElement Uid.
 */
export let getRootElementUids = function() {
    return '';
};

/**
 * @returns{Object} productContext UID of the selected element.
 */
export let getProductContextUids = function() {
    return '';
};

/**
 * Get a page of row data for a 'tree' table.
 * @param {Object} dataProvider Data provider for fetching the rows.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let reloadTreeTableColumns = function( dataProvider ) {
    // Get the column config
    _promiseColumnConfig = AwPromiseService.instance.defer();
    queryColumnConfig();

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: _columnConfigData.columnInfos
        };
        return _columnConfigData;
    } );
}; // reloadTreeTableColumns

/**
 * Get a page of row data for a 'tree' table.
 * @param {Object} dataProvider Data provider for fetching the rows.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let loadTreeTableColumns = function( dataProvider ) {
    // Get the column config
    _promiseColumnConfig = AwPromiseService.instance.defer();
    queryColumnConfig();

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: _columnConfigData.columnInfos
        };

        return _columnConfigData;
    } );
}; // loadTreeTableColumns

/**
 * Get a page of row data for a  table.
 *
 * @returns {Promise} promise
 *
 */
export let loadTreeTableProperties = function() {
    var propertyLoadInput;
    return new Promise( function( resolve, reject ) {
        resolve( _loadTreeProperties( propertyLoadInput ) );
    } );
};

/**
 * Get a page of row data for a  table.
 *
 * @param{Object} treeLoadInput object
 * @param{Object} uwDataProvider object
 * @param{Object} elementUids Uid of selected object
 * @param{Object} rootElementUids Root element UID
 * @param{Object} productContextUids UID of the Product Context.
 * @param{Object} ctx Application context
 * @param{Object} sort Sorting information ascending or descending
 * @param{Object} groupingProperty Grouping information
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function( treeLoadInput, uwDataProvider, elementUids, rootElementUids,
    productContextUids, ctx, sort, groupingProperty ) {
    // Check the validity of the parameters
    var deferred = AwPromiseService.instance.defer();

    var sortCriteria = [];

    if( sort && sort.sortCriteria && sort.sortCriteria.length > 0 && sort.sortCriteria[ 0 ].fieldName.length > 0 ) {
        sortCriteria = sort.sortCriteria;
    }

    if( sortCriteria.length === 0 && sort && sort.default && sort.default.length > 0 ) {
        sortCriteria = sort.default;
    }

    if( treeLoadInput.parentNode.levelNdx === -1 ) {
        promiseColumnConfig().then( function() {
            _queryRelatedObjects( treeLoadInput.parentNode, deferred, treeLoadInput, elementUids, rootElementUids,
                productContextUids, sortCriteria );
        } );
    }
    deferred.promise.then( function( treeLoadResults ) {
        return treeLoadResults;
    } );

    return deferred.promise;
};

/**
 * _processUiConfigColumns
 *
 * @param {Object} columns Columns for the tree.
 * @return {Columns} List of columns
 */
function _processUiConfigColumns( columns ) {
    for( var idx = 0; idx < columns.length; ++idx ) {
        var enableSortingValue = false;
        if( columns[ idx ].propertyName === 'eda0BaselineDate' ) {
            enableSortingValue = true;
        }

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
            enableCellEdit: false,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableSorting: enableSortingValue,
            enableColumnMoving: true,
            isTextWrapped: columns[ idx ].isTextWrapped
        } );

        _treeColumnInfos.push( columnInfo );
    }
    return _treeColumnInfos;
}

/**
 * _isArrayPopulated
 *
 * @param{Object} object Input for which array is to be checked.
 * @return{boolean} true if the array is populated
 */
function _isArrayPopulated( object ) {
    var isPopulated = false;
    if( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {Object} propertyLoadInput Property Load Input
 * @returns {Promise} promise
 *
 */
function _loadTreeProperties( propertyLoadInput ) {
    var allChildNodes = [];

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            _populateColumns( propertyLoadRequest.columnInfos, true, childNode, null ); // null should be props of childNode

            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult; //= _awTableService.createPropertyLoadResult(allChildNodes);

    return {
        propertyLoadResult: propertyLoadResult
    };
}

/**
 * @param {ObjectArray} columnInfos -
 * @param {Boolean} isLoadAllEnabled -
 * @param {ViewModelTreeNode} vmNode -
 * @param {Object} props -
 */
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode, props ) {
    if( isLoadAllEnabled ) {
        if( !vmNode.props ) {
            vmNode.props = {};
        }

        _.forEach( columnInfos, function( columnInfo, columnNdx ) {
            /**
             * Do not put any properties in the 'isTreeNavigation' column.
             */
            if( !columnInfo.isTreeNavigation ) {
                vmNode.props[ columnInfo.name ] = _createViewModelProperty( columnInfo, '', vmNode.id, props[ columnNdx ] );
            }
        } );
    }
}

/**
 * Gets the properties based on column config for the tree view model objects
 *
 * @param {ViewModelTreeNode} nodes - tree nodes to get the properties for
 * @return{Object} propertyLoadResult
 */
function _getPropertyModelObjects( nodes ) {
    var _nodes = nodes;

    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Eda0CadBaselineTable'
    };
    var policy = {
        types: [ {
            name: 'Eda0CadBaselineInfo',
            properties: [
                { name: 'eda0BaselineDate' },
                { name: 'eda0BaselineName' }
            ]
        } ]
    };

    var policyId = policySvc.register( policy );
    var _propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( _nodes );

    return tcVmoService.getTableViewModelProperties( _nodes, propertyLoadContext ).then(
        function( response ) { // eslint-disable-line no-unused-vars
            _.forEach( _nodes, function( node ) {
                if( node.uid === 'top' ) {
                    return;
                }
            } );
            if( policyId ) {
                policySvc.unregister( policyId );
            }
            return {
                propertyLoadResult: _propertyLoadResult
            };
        },
        function( error ) {
            return error;
        }
    );
}

/**
 * _queryRelatedObjects calls the Eda1CadBaseLineProviderImpl  to get Cad Baselines for the desgn
 *
 * @param {ViewModelTreeNode} parentNode - Represents a CAD Baseline
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {String} elementUids - UIDs of selected elements.
 * @param {String} rootElementUids - UIDs of root elements.
 * @param {String} productContextUids - UID of product context.
 * @param {Any} sortCriteria - sort criteria.
 * @param {Any} groupingProperty - group Property name
 * @return {Object} treeLoadResult
 */
function _queryRelatedObjects( parentNode, deferred, treeLoadInput, elementUids, rootElementUids,
    productContextUids, sortCriteria ) {
    var soaInput = {
        inflateProperties: true,
        noServiceData: false,

        searchInput: {
            maxToLoad: -1,
            maxToReturn: 0,
            attributesToInflate: [ 'eda0BaselineDate', 'eda0BaselineName' ],

            searchCriteria: {
                dcpSortByDataProvider: 'false',
                type: 'Eda0CadBaselineInfo',
                elementUids: elementUids,
                rootElementUids: rootElementUids,
                productContextUids: productContextUids,
                processConnections: 'false',
                processTracelinks: 'true'
            },

            searchSortCriteria: sortCriteria,
            providerName: 'Eda1CadBaseLineProvider'
        }
    };

    // check if filter map has a value
    var filter = false;
    for( var name in _searchFilterMap ) {
        filter = true;
        break;
    }

    soaInput.searchInput.searchFilterMap6 = _searchFilterMap;
    treeLoadInput.parentElement = parentNode.id;
    treeLoadInput.displayMode = 'List';

    // get the first column as per the column config
    var _columnOneProp = 'eda0BaselineDate';

    soaInput.searchInput.attributesToInflate.push( _columnOneProp );
    soaInput.searchInput.attributesToInflate.push( 'eda0BaselineName' );

    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            var searchResults = {};

            if( response.searchResultsJSON ) {
                searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            }

            var vmNodes = [];
            var searchObjects = [];

            for( var indx = 0; searchResults.objects && indx < searchResults.objects.length; indx++ ) {
                searchObjects.push( searchResults.objects[ indx ] );
            }

            for( var childNdx = searchObjects.length - 1; searchObjects && childNdx >= 0; childNdx-- ) {
                var pobject = searchObjects[ childNdx ];
                var displayName = '';
                var propsForModelObject = response.ServiceData.modelObjects[ pobject.uid ].props;
                var columnOneProp = propsForModelObject[ _columnOneProp ];

                if( columnOneProp && columnOneProp.dbValues && columnOneProp.dbValues.length > 0 ) {
                    displayName = columnOneProp.dbValues[ 0 ];
                }

                var _cadBaselineElementType = 'Cad Baselines';
                var vmNode = awTableTreeSvc.createViewModelTreeNode( pobject.uid, _cadBaselineElementType, displayName, 0, childNdx, '' );
                vmNode.isLeaf = true;

                if( !vmNode.props ) {
                    vmNode.props = {};
                }
                var columnInfo;
                var baselineName = propsForModelObject.eda0BaselineName.dbValues[ 0 ];
                vmNode.props[ _columnOneProp ] = _createViewModelProperty( columnInfo, 'eda0BaselineDate', vmNode.id, propsForModelObject[ _columnOneProp ] );
                vmNode.props.eda0BaselineName = _createViewModelProperty( columnInfo, 'eda0BaselineName', vmNode.id, baselineName );
                vmNodes.push( vmNode );
            }

            var tempCursorObject = {
                startReached: true,
                endReached: true
            };

            var populateNodes = vmNodes;

            // setting cursorObject fixes bug in dataProviderFactory
            treeLoadInput.parentNode.cursorObject = tempCursorObject;

            var treeLoadResult = awTableTreeSvc.buildTreeLoadResult(
                treeLoadInput, populateNodes, true, true, tempCursorObject.endReached, null );

            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
}

/**
 * @param {AwTableColumnInfo} columnInfo -
 * @param {String} nodeId -
 * @param {Object} prop -
 * @return {ViewModelProperty} vmprop
 */
function _createViewModelProperty( columnInfo, propName, nodeId, propValue ) {
    var displayLabelArr = [ propValue ];
    var vmProp = uwPropertyService.createViewModelProperty( propName, propName,
        'String', propValue, displayLabelArr );

    vmProp.propertyDescriptor = {
        displayName: ''
    };

    uwPropertyService.setIsPropertyModifiable( vmProp, true );

    return vmProp;
}

/**
 * queryColumnConfig
 */
function queryColumnConfig() {
    // Get Column data

    var getOrResetUiConfigsIn = {
        scope: 'LoginUser',
        scopeName: '',
        clientName: 'AWClient',
        resetColumnConfig: false,
        columnConfigQueryInfos: [ {
            clientScopeURI: 'Eda0CadBaselineTable',
            operationType: 'configured',
            typeNames: [ 'WorkspaceObject' ],
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
} // queryColumnConfig

/**
 * promiseColumnConfig
 *
 * @returns {Promise} promise
 */
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

/**
 * Eda0CadBaselineService factory
 * @param{Object} $q Service
 * @param{Object} soaSvc SOA Service
 * @param{Object} cdm Data Management Service
 * @param{Object} appCtxSvc Application Context Service
 * @param{Object} awColumnSvc AW Column Service
 * @param{Object} awTableSvc AW Table Service
 * @param{Object} viewModelObjectSvc View Model Object Service
 * @param{Object} policySvc Policy service
 * @param{Object} selectionService Selection Service
 * @param{Object} uwPropertyService UW Property Service
 * @return{Object} EDA module
 */

export default exports = {
    getElementUid,
    getRootElementUids,
    getProductContextUids,
    reloadTreeTableColumns,
    loadTreeTableColumns,
    loadTreeTableProperties,
    loadTreeTableData
};
