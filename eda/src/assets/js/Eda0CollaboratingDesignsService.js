// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Eda0CollaboratingDesignsService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import awColumnSvc from 'js/awColumnService';
import eventBus from 'js/eventBus';
import awTableSvc from 'js/awTableService';
import soaSvc from 'soa/kernel/soaService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import iconSvc from 'js/iconService';
import propSvc from 'soa/kernel/propertyPolicyService';
import dmSvc from 'soa/dataManagementService';
import appCtxSvc from 'js/appCtxService';
import parsingUtils from 'js/parsingUtils';
import _ from 'lodash';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

var exports = {};
var _treeColumnInfos = [];
var _promiseColumnConfig = null;
var _columnConfigData = null;
var _deferExpandTreeNodeArray = [];

/**
 * Get a page of row data for a 'tree' table.
 * @param {Object} dataProvider Data provider for fetching the rows.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let loadTreeTableColumns = function( dataProvider, data ) { // Get the column config
    _promiseColumnConfig = AwPromiseService.instance.defer();

    let columnConfigUri = 'Eda0CollaboratingDesignsTable';

    data.columnConfigForDataProvider = columnConfigUri;

    queryColumnConfig( columnConfigUri );

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: _columnConfigData.columnInfos
        };

        return _columnConfigData;
    } );
}; // loadTreeTableColumns

/**
 * promiseColumnConfig
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

function queryColumnConfig( columnConfigUri ) {
    // Get Column data

    var getOrResetUiConfigsIn = {
        scope: 'LoginUser',
        scopeName: '',
        clientName: 'AWClient',
        resetColumnConfig: false,
        columnConfigQueryInfos: [ {
            clientScopeURI: 'Eda0CollaboratingDesignsTable',
            operationType: 'configured',
            typeNames: [ 'ItemRevision' ],
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

/**
 * _processUiConfigColumns
 *
 * @param {response} columns
 * @return {Columns} List of columns
 */
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

function _isArrayPopulated( object ) {
    var isPopulated = false;
    if( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
}

export let loadTreeTableData = function( treeLoadInput ) {
    /**
     * Check the validity of the parameters
     */
    var deferred = AwPromiseService.instance.defer();

    /**
     * Get the 'child' nodes async
     */
    _buildTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput );

    return deferred.promise;
};

/**
 * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 *
 */
function _buildTreeTableStructure( parentNode, deferred, treeLoadInput ) {
    var levelIndex = parentNode.levelNdx.toString();

    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Eda0CollaboratingDesignsTable'
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Eda1CollabTreeDataProvider',
            searchCriteria: {
                collabUid:parentNode.uid,
                revisionRule: 'Latest Working',
                pcbContext: 'true',
                nodeIndex: levelIndex
            }
        }
    };

    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.uid;
    treeLoadInput.displayMode = 'Tree';

    exports.getDataFromProvider( deferred, treeLoadInput, soaInput );
}

export let getDataFromProvider = function( deferred, treeLoadInput, soaInput ) {
    treeLoadInput.displayMode = 'Tree';

    //ensure the required objects are loaded
    var policyId = propSvc.register( {
        types: [ {
            name: 'ItemRevision',
            properties: [ {
                name: 'object_name'
            } ]
        },
        {
            name: 'EDACCABaseRevision',
            properties: [ {
                name: 'object_name'
            } ]
        }
        ]
    } );

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
            if( policyId ) {
                propSvc.unregister( policyId );
            }

            var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
            var startReachedVar = true;

            var tempCursorObject = {
                endReached: endReachedVar,
                startReached: true
            };

            var treeLoadResult = processProviderResponse( treeLoadInput, collabObjects, startReachedVar,
                endReachedVar );

            treeLoadResult.parentNode.cursorObject = tempCursorObject;

            if( _deferExpandTreeNodeArray.length > 0 ) {
                _.defer( function() {
                    // send event that will be handled in this file to check
                    // if there are nodes to be expanded. This defer is needed
                    // to make sure tree nodes are actually loaded before we attempt
                    // to expand them. Fixes a timing issue if not deferred.
                    eventBus.publish( 'edaExpandCollabObject' );
                } );
            }

            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 *
 */
export let loadTreeTableProperties = function() {
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

/**
 *
 * @param {Object} propertyLoadInput input
 * @returns{Object} propertyLoadResult property load result
 */
function _loadProperties( propertyLoadInput ) {
    var allChildNodes = [];
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Eda0CollaboratingDesignsTable'
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
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                    var propColumns = response.output.columnConfig.columns;
                } );
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
            }
            propertyLoadResult.columnConfig.columns[ 0 ].pixelWidth = 400;
            //update viewModelProperties
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} searchResults - SOA Response
 * @param {startReached} startReached - start Reached
 * @param {endReached} endReached - end Reached
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
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

/**
 * @param {Object} obj - object sent by server
 * @param {childNdx} childNdx Index
 * @param {levelNdx} levelNdx index
 * @return {ViewModelTreeNode} View Model Tree Node
 */
function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx, parentNode ) {
    var displayName = obj.props.object_name.dbValues[ 0 ];
    var objUid = obj.uid;
    var objType = obj.type;
    var hasChildren = containChildren( objType );
    var iconURL;

    // get Icon for node
    if( objType ) {
        iconURL = iconSvc.getTypeIconURL( objType );
    }

    var vmNode = awTableTreeSvc
        .createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    vmNode.isLeaf = !hasChildren;

    return vmNode;
}

export let expandTreeNode = function() {
    _.defer( function() {
        // _deferExpandTreeNodeArray contains nodes we want to expand. We
        // had to make these deferred calls to allow the tree to draw before
        // we asked it to expand a node.
        for( var x = 0; x < _deferExpandTreeNodeArray.length; x++ ) {
            eventBus.publish( 'gridDataProvider.expandTreeNode', {
                // ask tree to expand a node
                parentNode: _deferExpandTreeNodeArray[ x ]
            } );
        }
        _deferExpandTreeNodeArray = []; // clear out the global array
    } );
};

/**
 * function to evaluate if an object contains children
 * @param {objectType} object object
 * @return {boolean} if node contains child
 */
function containChildren( objectType ) {
    if( objectType === 'Eda0EDMDCollaboration' ) {
        return true;
    }
    return false;
}

export default exports = {
    loadTreeTableColumns,
    loadTreeTableData,
    getDataFromProvider,
    loadTreeTableProperties,
    expandTreeNode
};
