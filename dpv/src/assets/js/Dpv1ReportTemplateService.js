import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import awIconSvc from 'js/awIconService';
import awSearchService from 'js/awSearchService';
import awTableSvc from 'js/awTableService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import browserUtils from 'js/browserUtils';
import cdm from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import policySvc from 'soa/kernel/propertyPolicyService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

var exports = {};

var _templateColConfigData;
var _promiseColumnConfig = null;

export let loadTemplatesData = function( searchInput, columnConfigInput, initialLoad, treeLoadInput ) {
    var deferred = AwPromiseService.instance.defer();


    _buildTemplateStructure( searchInput, columnConfigInput, initialLoad, treeLoadInput, deferred );
    return deferred.promise;
};

function _buildTemplateStructure( searchInput, columnConfigInput, initialLoad, treeLoadInput, deferred ) {
    var soaSearchInput = searchInput;
    var parentNode = treeLoadInput.parentNode;
    var targetNode = parentNode.isExpanded ? parentNode.uid : undefined;

    var policyID = policySvc.register( {
        types: [ {
            name: 'Folder',
            properties: [ {
                name: 'awp0HasChildren'
            } ]
        },
        {
            name: 'WorkspaceObject',
            properties: [ {
                name: 'object_name'
            } ]
        }
        ]
    } );

    var homeFolderUid = appCtxSvc.ctx.user.props.home_folder.dbValues[ 0 ];

    soaSearchInput.searchCriteria.parentUid = initialLoad || !parentNode.isExpanded ? homeFolderUid : treeLoadInput.parentNode.uid;

    var soaInput = {
        inflateProperties: false,
        columnConfigInput: columnConfigInput,
        searchInput: soaSearchInput
    };

    treeLoadInput.parentElement = targetNode && targetNode.levelNdx > -1 ? targetNode.id : 'AAAAAAAAAAAAAA';
    treeLoadInput.displayMode = 'Tree';

    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            if( response.searchResultsJSON ) {
                response.searchResults = JSON.parse( response.searchResultsJSON );
                delete response.searchResultsJSON;
            }

            var _proxyObjects = [];

            if( response && response.searchResults && response.searchResults.objects ) {
                var len = response.searchResults.objects.length;

                for( var idx = 0; idx < len; idx++ ) {
                    _proxyObjects.push( viewModelObjectSvc.createViewModelObject( response.searchResults.objects[ idx ] ) );
                }
            }

            response.searchResults = _proxyObjects;

            response.totalLoaded = _proxyObjects.length;

            if( !parentNode.isExpanded && response.ServiceData && response.ServiceData.plain ) {
                var plen = response.ServiceData.plain.length;
                if( plen > 0 ) {
                    var newparentNode = createVMNodeUsingObjectInfo( cdm.getObject( homeFolderUid ), 0, -1 );
                    treeLoadInput.parentNode = newparentNode;
                    treeLoadInput.startChildNdx = 0;
                }
            } else {
                targetNode = parentNode.uid;
                treeLoadInput.startChildNdx = 0;
            }

            var treeLoadResult = processProviderResponse( treeLoadInput, response.searchResults, homeFolderUid );
            if( response.columnConfig.columns[ 0 ] ) {
                response.columnConfig.columns[ 0 ].isTreeNavigation = true;
            }

            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                columnConfig: response.columnConfig
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
}

function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var hasChildren = containChildren( obj.props );

    var iconURL = null;

    if ( obj.props ) {
        if ( obj.props.object_name ) {
            displayName = obj.props.object_name.uiValues[0];
        }
    }

    if ( !iconURL && obj ) {
        iconURL = awIconSvc.getTypeIconFileUrl( obj );
    }

    var vmNode = awTableTreeSvc
        .createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    vmNode.isLeaf = !hasChildren;

    return vmNode;
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} response - SOA Response
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
function processProviderResponse( treeLoadInput, searchResults, homeFolderUid ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];

    for ( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[childNdx];
        var vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx );
        if ( vmNode ) {
            vmNodes.push( vmNode );
        }
    }
    var newTopNode = null;
    var treeLoadResult = {};
    if ( !treeLoadInput.parentNode.isExpanded ) {
        newTopNode = createVMNodeUsingObjectInfo( cdm.getObject( homeFolderUid ), 0, treeLoadInput.parentNode.levelNdx );
        // Third Paramter is for a simple vs ??? tree
        treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, false, true, true, newTopNode );

        updateTreeLoadResult( treeLoadInput, treeLoadResult, homeFolderUid );
    } else {
        treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, false, true, true, null );
    }

    return treeLoadResult;
}

function updateTreeLoadResult( treeLoadInput, treeLoadResult, homeFolderUid ) {
    treeLoadResult.showTopNode = true;

    var rootPathNodes = [];

    rootPathNodes.push( treeLoadResult.newTopNode );
    var parentNode = createVMNodeUsingObjectInfo( cdm.getObject( homeFolderUid ), 0, 0 );
    parentNode.isExpanded = true;
    rootPathNodes.push( parentNode );
    
    treeLoadResult.rootPathNodes = rootPathNodes;

    treeLoadResult.topModelObject = cdm.getObject( homeFolderUid );
    treeLoadResult.baseModelObject = cdm.getObject( homeFolderUid );
}

/**
 * @param {Object} props - object for getting contain children value.
 * @return {Boolean} Returns boolean.
 */
function containChildren( props ) {
    if( props && props.awp0HasChildren && props.awp0HasChildren.dbValues[ 0 ] === '1' ) {
        return true;
    }
    return false;
}

export let loadTreeTableProperties = function( subPanelContext ) { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if ( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput, subPanelContext );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

function _loadProperties( propertyLoadInput, subPanelContext ) {
    var allChildNodes = [];
    var columnPropNames = [];
    var allChildUids = [];

    columnPropNames.push( 'awp0ThumbnailImageTicket' );

    /**
     * Note: Assume each propertyLoadRequest has the same columns
     */
    if ( !_.isEmpty( propertyLoadInput.propertyLoadRequests ) ) {
        _.forEach( propertyLoadInput.propertyLoadRequests[0].columnInfos, function( columnInfo ) {
            columnPropNames.push( columnInfo.name );
        } );
    }

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if ( !childNode.props ) {
                childNode.props = {};
            }

            if ( cdm.isValidObjectUid( childNode.uid ) && childNode.uid !== 'top' ) {
                allChildNodes.push( childNode );
                allChildUids.push( childNode.uid );
            }
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    var selectedMO = subPanelContext.provider.baseSelection;

    if ( selectedMO && cdm.isValidObjectUid( selectedMO.uid ) ) {
        allChildUids.push( selectedMO.uid );
    }

    if ( _.isEmpty( allChildUids ) ) {
        return AwPromiseService.instance.resolve( {
            propertyLoadResult: propertyLoadResult
        } );
    }

    columnPropNames = _.uniq( columnPropNames );
    allChildUids = _.uniq( allChildUids );

    return dataManagementSvc.loadObjects( allChildUids ).then(
        function() { // eslint-disable-line no-unused-vars
            var vmoObjs = [];
            /**
             * Create a ViewModelObject for each of the returned 'child' nodes
             */
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.uid ), 'EDIT' );

                vmoObjs.push( vmo );
            } );
            return tcVmoService.getViewModelProperties( vmoObjs, columnPropNames ).then(
                function() {
                    /**
                     * Create a ViewModelObject for each of the returned 'child' nodes
                     */
                    _.forEach( vmoObjs, function( vmo ) {
                        if ( vmo.props ) {
                            _.forEach( allChildNodes, function( childNode ) {
                                if ( childNode.uid === vmo.uid ) {
                                    if ( !childNode.props ) {
                                        childNode.props = {};
                                    }
                                    _.forEach( vmo.props, function( vmProp ) {
                                        childNode.props[vmProp.propertyName] = vmProp;
                                    } );
                                }
                            } );
                        }
                    } );

                    return {
                        propertyLoadResult: propertyLoadResult
                    };
                } );
        } );
}

export const loadTreeTableColumns = ( dataProvider ) => {
    _promiseColumnConfig = AwPromiseService.instance.defer();

    var soaInput = {
        getOrResetUiConfigsIn: [ {
            scope: 'LoginUser',
            clientName: 'AWClient',
            resetColumnConfig: false,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Awp0ObjectNavigation',
                operationType: 'configured'
            } ],
            businessObjects: ''
        } ]
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
            _templateColConfigData = { columnInfos: columns };

            _promiseColumnConfig.resolve();
        },
        function( error ) {
            _promiseColumnConfig.reject( error );
        } );

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: _templateColConfigData.columnInfos
        };

        return _templateColConfigData;
    } );
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

function _isArrayPopulated( object ) {
    var isPopulated = false;
    if ( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
}

function _processUiConfigColumns( columns ) {
    var _treeColumnInfos = [];
    var colInfoParams = {};
    for ( var idx = 0; idx < columns.length; ++idx ) {
        colInfoParams = {
            name: columns[idx].propertyName,
            propertyName: columns[idx].propertyName,
            displayName: columns[idx].displayName,
            typeName: columns[idx].associatedTypeName,
            maxWidth: 400,
            minWidth: 60,
            hiddenFlag: columns[idx].hiddenFlag,
            pixelWidth: columns[idx].pixelWidth,
            width: columns[idx].pixelWidth,
            enableCellEdit: false,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableColumnMoving: true,
            isTextWrapped: columns[idx].isTextWrapped
        };

        var columnInfo = awColumnSvc.createColumnInfo( colInfoParams );

        _treeColumnInfos.push( columnInfo );
    }
    return _treeColumnInfos;
}

export let downloadReport = function( repTemplateUid ) {
    var deferred = AwPromiseService.instance.defer();

    var reportURL = browserUtils.getBaseURL() + 'tc/micro/dpvservice/gra/execute/' + repTemplateUid;

    window.open( reportURL, '_blank' );

    deferred.resolve( null );

    return deferred.promise;
};

/**
 * Returns the Report Template search criteria .
 *
 * @function getDpvTemplateSearchCriteria
 * @returns {Object} The search criteria
 */
export let getDpvTemplateSearchCriteria = function( datasetQryUID, filterStr ) {
    let dsSearchId = datasetQryUID ? getSearchId( datasetQryUID ) : '';
    let dsNameStr = filterStr !== undefined && filterStr !== null && filterStr.length > 0 ? filterStr : '*';
    return {
        DatasetType : 'Dpv0MBQXml',
        queryName : 'Dataset...',
        queryUID : datasetQryUID,
        searchID : dsSearchId,
        typeOfSearch : 'ADVANCED_SEARCH',
        lastEndIndex : '0',
        Name : dsNameStr,
        OwningUser : '*',
        OwningGroup : '*',
        totalObjectsFoundReportedToClient: '0'
    };
};

/**
 *  Creates the search ID for query
 *
 * @param {String}queryUID - queryUID
 * @return {String} advanced search Id
 */
function getSearchId( queryUID ) {
    //Unique Search ID: search_object_UID + logged_in_user_UID + current_time
    var userCtx = appCtxSvc.getCtx( 'user' );
    var loggedInUserUid = userCtx.uid;
    var timeSinceEpoch = new Date().getTime();
    return queryUID + loggedInUserUid + timeSinceEpoch;
}

export let processOutput = function( data, dataCtxNode, searchData ) {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};

export default exports = {
    loadTemplatesData,
    loadTreeTableProperties,
    loadTreeTableColumns,
    downloadReport,
    getDpvTemplateSearchCriteria,
    processOutput
};
