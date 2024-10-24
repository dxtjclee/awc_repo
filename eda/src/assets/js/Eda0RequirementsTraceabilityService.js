// Copyright (c) 2022 Siemens

/**
 * @module js/Eda0RequirementsTraceabilityService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import tcVmoService from 'js/tcViewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import selectionService from 'js/selection.service';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

var exports = {};

var _treeColumnInfos = [];
var _searchFilterMap = {};

var _columnConfigData = null;
var _promiseColumnConfig = null;

var _reqElementType = 'Requirement';
var _defaultIconURL = '';
var _defaultGroupIconURL = '';

var _propMap = {};
var _propDisplayMap = {};
var _emptyProp = null;
var occurrenceVsContextUidMap = [];

// Subscribe to the Global Revision rule change event, and reload tree accordingly.
eventBus.subscribe( 'aw.revisionRuleChangeEvent',
    function() {
        eventBus.publish( 'reloadTreeTableEvent' );
    }, 'Eda0RequirementsTraceabilityService' );

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
 * Method to show documentation when a row of Requirement is selected in the tree.
 *
 * @param{Object} data Data
 */
export let rowSelected = function( data ) {
    var selection = selectionService.getSelection();
    var selectedObjs = data.eventData.selectedObjects;

    if( selectedObjs && selectedObjs.length > 0 ) {
        var obj = selectedObjs[ 0 ];
        var objUid = obj.uid;

        if( objUid ) {
            // Update selection for various commands like Info
            var contextObject = cdm.getObject( objUid );
            if( contextObject ) {
                var currentSelection = [];
                currentSelection.push( contextObject );
                selectionService.updateSelection( currentSelection, selection.parent );
            } else {
                // unselect row
                data.eventData.selectedObjects[ 0 ].selected = false;

                // select parent
                selectionService.updateSelection( selection.parent, null );
            }

            if( obj.props.awb0UnderlyingObject && obj.props.awb0UnderlyingObject.dbValues && obj.props.awb0UnderlyingObject.dbValues[ 0 ] !== null ) {
                // Trigger Rich Text Viewer to Refresh
                eventBus.publish( 'requirementDocumentation.reveal' );
            }
        }
    }
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
     * <P>
     * Note: The order or existence of parameters can varey when more-than-one property is specified in the
     * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
     */
    var propertyLoadInput = '';

    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];

        if( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        }
    }

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    return _loadTreeProperties( propertyLoadInput );
};

/**
 * Get a page of row data for a 'tree' table.
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

    // Initialize Editing Context
    appCtxSvc.updateCtx( 'isSystemRequirementsTreeEditing', false );

    var sortCriteria = [];

    if( sort && sort.sortCriteria && sort.sortCriteria.length > 0 && sort.sortCriteria[ 0 ].fieldName.length > 0 ) {
        sortCriteria = sort.sortCriteria;
    }

    if( sortCriteria.length === 0 && sort && sort.default && sort.default.length > 0 ) {
        sortCriteria = sort.default;
    }

    var groupIds = Object.keys( _propMap );

    if( treeLoadInput.parentNode.levelNdx === -1 ) {
        _propMap = {};
        _propDisplayMap = {};

        /**
         * Get the 'child' nodes async
         */

        promiseColumnConfig().then( function() {
            _queryRelatedObjects( treeLoadInput.parentNode, deferred, treeLoadInput, elementUids, rootElementUids,
                productContextUids, sortCriteria, groupingProperty, 'TL' );
        } );
    } else if( groupIds.length > 0 && treeLoadInput.parentNode.levelNdx === 0 ) {
        var vmNodes = _propMap[ treeLoadInput.parentNode.uid.substring( 3 ) ];

        // fix the index level and expansion
        var levelNdx = treeLoadInput.parentNode.levelNdx + 1;
        _.forEach( vmNodes, function( node ) {
            node.$$treeLevel = levelNdx;
            node.levelNdx = levelNdx;
            node.isExpanded = false;
            node.children = null;
        } );

        var tempCursorObject = {
            startReached: true,
            endReached: true
        };

        // setting cursorObject fixes bug in dataProviderFactory
        treeLoadInput.parentNode.cursorObject = tempCursorObject;

        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult(
            treeLoadInput, vmNodes, true, true, tempCursorObject.endReached, null );

        // If there are no nodes then prevent abort in dataProviderFactory where it looks for a cursor object
        // on the parentNode thats not there
        if( vmNodes.length === 0 ) {
            treeLoadResult.parentNode.levelNdx = 0;
        }

        deferred.resolve( {
            treeLoadResult: treeLoadResult
        } );
    } else {
        var selectedUid = null;
        var parentProxyObject = cdm.getObject( treeLoadInput.parentNode.uid );

        if( parentProxyObject && parentProxyObject.type === 'Awb0ConditionalElement' ) {
            selectedUid = parentProxyObject.props.awb0ArchetypeId;
        }
        _queryRelatedObjects( treeLoadInput.parentNode, deferred, treeLoadInput, selectedUid, rootElementUids,
            productContextUids, sortCriteria, null, 'CHILD' );
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

            allChildNodes.push( childNode );
        } );
    } );
    // the TreeViewModelNode with uid 'top' is a pseudo node. As a hack, send an empty result.
    if( allChildNodes.length === 1 && allChildNodes[ 0 ].uid === 'top' ) {
        var _deferred = AwPromiseService.instance.defer();
        var _propEmptyResult = {
            propertyLoadResult: {
                updatedNodes: []
            }
        };
        _deferred.resolve( _propEmptyResult );
        return _deferred.promise;
    }
    return _getPropertyModelObjects( allChildNodes );
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
        clientScopeURI: 'Eda0RequirementsTraceabilityTable'
    };
    var policy = {
        types: [ {
            name: 'Awb0ConditionalElement',
            properties: [
                { name: 'awb0ArchetypeRevName' },
                { name: 'awb0ArchetypeId' },
                { name: 'awb0ArchetypeRevId' },
                { name: 'awb0ArchetypeRevRelStatus' },
                { name: 'awb0ArchetypeRevOwningUser' },
                { name: 'awb0ArchetypeRevReleaseDate' },
                { name: 'awb0DisplayedName' }
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
                var nodeUid = node.uid;
                var mo = response.ServiceData.modelObjects[ nodeUid ];
                var reqElementUid = mo.uid;
                var reqElement = response.ServiceData.modelObjects[ reqElementUid ];

                var _nodeIconURL = null;
                var thumbnailProp = reqElement.props.awp0ThumbnailImageTicket;
                if( thumbnailProp && thumbnailProp.dbValues && thumbnailProp.dbValues.length > 0 ) {
                    var ticket = thumbnailProp.dbValues[ 0 ];

                    if( ticket && ticket.length > 0 ) {
                        _nodeIconURL = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
                            fmsUtils.getFilenameFromTicket( ticket ) + '?ticket=' + ticket;
                    }
                }

                if( reqElement.props.awb0UnderlyingObject && reqElement.props.awb0UnderlyingObject.dbValues && reqElement.props.awb0UnderlyingObject.dbValues.length > 0 ) {
                    var underlyingType = response.ServiceData.modelObjects[ reqElement.props.awb0UnderlyingObject.dbValues[ 0 ] ];

                    if( _nodeIconURL === null && underlyingType !== null && underlyingType.type !== _reqElementType ) {
                        // if there are custom sub-types with custom icons, set the correct sub type icon
                        _nodeIconURL = iconSvc.getTypeIconURL( underlyingType.type );
                    }
                }

                if( _nodeIconURL === null && reqElement.type !== _reqElementType ) {
                    // if there are custom sub-types with custom icons, set the correct sub type icon
                    _nodeIconURL = iconSvc.getTypeIconURL( reqElement.type );
                }

                if( _nodeIconURL ) {
                    node.iconURL = _nodeIconURL;
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
 * _queryRelatedObjects calls the Eda1RequirementsObjProvider to get tracelinked requirements or
 * their children
 *
 * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {String} elementUids - UIDs of selected elements.
 * @param {String} rootElementUids - UIDs of root elements.
 * @param {String} productContextUids - UID of product context.
 * @param {Any} sortCriteria - sort criteria.
 * @param {Any} groupingProperty - group Property name
 * @param {String} relationType - type of relation, 'TL' or 'CHILD'.
 * @return {Object} treeLoadResult
 */
function _queryRelatedObjects( parentNode, deferred, treeLoadInput, elementUids, rootElementUids,
    productContextUids, sortCriteria, groupingProperty, relationType ) {
    if( parentNode.isExpanded ) {
        elementUids = parentNode.uid;
        if( occurrenceVsContextUidMap[ parentNode.uid ] !== null ) {
            productContextUids += occurrenceVsContextUidMap[ parentNode.uid ];
        }
    } else {
        occurrenceVsContextUidMap = [];
    }

    var soaInput = {
        inflateProperties: true,
        noServiceData: false,

        searchInput: {
            maxToLoad: -1,
            maxToReturn: 0,
            attributesToInflate: [ 'awb0ArchetypeRevName', 'awb0ArchetypeId', 'awb0ArchetypeRevId', 'awb0ArchetypeRevRelStatus', 'awb0ArchetypeRevOwningUser', 'awb0ArchetypeRevReleaseDate',
                'awb0NumberOfChildren', 'awb0DisplayedName'
            ],

            searchCriteria: {
                dcpSortByDataProvider: 'false',
                type: 'Requirement Revision',
                processRelation: relationType,
                elementUids: elementUids,
                rootElementUids: rootElementUids,
                productContextUids: productContextUids,
                processConnections: 'false',
                processTracelinks: 'true'
            },

            searchSortCriteria: sortCriteria,
            providerName: 'Eda1RequirementsObjProvider'
        }
    };

    // check if filter map has a value
    var filter = false;
    for( var name in _searchFilterMap ) {
        filter = true;
        break;
    }

    // Add filter if its set
    if( filter && relationType === 'TL' ) {
        soaInput.searchInput.searchFilterMap6 = _searchFilterMap;
    }

    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.id;
    treeLoadInput.displayMode = 'Tree';

    // get the first column as per the column config
    var _columnOneProp = 'awb0DisplayedName';

    soaInput.searchInput.attributesToInflate.push( _columnOneProp );

    // add grouping property to attributesToInflate
    if( parentNode.levelNdx === -1 && groupingProperty && groupingProperty.length > 0 &&
        !_.contains( soaInput.searchInput.attributesToInflate, groupingProperty ) ) {
        soaInput.searchInput.attributesToInflate.push( groupingProperty );
    }

    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            var searchResults = {};

            if( response.searchResultsJSON ) {
                searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            }

            // This is the "root" node of the tree or the node that was selected for expansion
            var parentNode = treeLoadInput.parentNode;
            var levelNdx = parentNode.levelNdx + 1;
            var vmNodes = [];
            var searchObjects = [];

            for( var indx = 0; searchResults.objects && indx < searchResults.objects.length; indx += 2 ) {
                searchObjects.push( searchResults.objects[ indx + 1 ] );
                occurrenceVsContextUidMap[ searchResults.objects[ indx + 1 ].uid ] = searchResults.objects[ indx ].uid;
            }

            for( var childNdx = 0; searchObjects && childNdx < searchObjects.length; childNdx++ ) {
                var pobject = searchObjects[ childNdx ];
                var displayName = '';
                var propsForModelObject = response.ServiceData.modelObjects[ pobject.uid ].props;
                var columnOneProp = propsForModelObject[ _columnOneProp ];

                if( columnOneProp && columnOneProp.dbValues && columnOneProp.dbValues.length > 0 ) {
                    displayName = columnOneProp.dbValues[ 0 ];
                }

                // Note: The icon will be updated later when properties of the objects are returned
                var vmNode = awTableTreeSvc.createViewModelTreeNode( pobject.uid, _reqElementType, displayName, levelNdx, childNdx, _defaultIconURL );

                if( vmNode ) {
                    var childrenProp = propsForModelObject.awb0NumberOfChildren;
                    if( childrenProp && childrenProp.dbValues && childrenProp.dbValues.length > 0 && childrenProp.dbValues[ 0 ] !== '0' ) {
                        vmNode.isLeaf = false;
                    } else {
                        vmNode.isLeaf = true;
                    }

                    vmNodes.push( vmNode );

                    var groupProp = pobject.props[ groupingProperty ];
                    if( groupProp && groupProp.dbValues && groupProp.dbValues.length > 0 ) {
                        var groupId = groupProp.dbValues[ 0 ];

                        _propMap[ groupId ] = _propMap[ groupId ] || [];
                        _propMap[ groupId ].push( vmNode );

                        if( groupProp.uiValues && groupProp.uiValues.length > 0 ) {
                            _propDisplayMap[ groupId ] = groupProp.uiValues[ 0 ];
                        }
                    }
                }
            }

            var tempCursorObject = {
                startReached: true,
                endReached: true
            };

            // Create group branches
            var groupNodes = [];
            if( groupingProperty && relationType === 'TL' && parentNode.levelNdx === -1 ) {
                var groupIds = Object.keys( _propMap );
                for( var idx = 0; idx < groupIds.length; ++idx ) {
                    var iconURL = null;

                    // try getting icon by group prop value
                    if( !iconURL ) {
                        iconURL = iconSvc.getTypeIconURL( groupIds[ idx ] );
                    }

                    if( !iconURL ) {
                        iconURL = _defaultGroupIconURL;
                    }

                    var display = _propDisplayMap[ groupIds[ idx ] ];
                    if( !display ) {
                        display = groupIds[ idx ];
                    }

                    var groupNode = awTableTreeSvc.createViewModelTreeNode( 'id_' + groupIds[ idx ], _reqElementType, display, parentNode.levelNdx + 1, idx, iconURL );

                    groupNode.isLeaf = false;
                    groupNode.props = [ _emptyProp ];
                    groupNodes.push( groupNode );
                }

                // Getting the properties for some of the nodes now prevents the table
                // columns from loosing their display name when arranged before expanding.
                // No need to wait for the response.
                if( groupIds.length > 0 ) {
                    _getPropertyModelObjects( _propMap[ groupIds[ 0 ] ] );
                }
            }

            var populateNodes = groupNodes.length > 0 ? groupNodes : vmNodes;

            // setting cursorObject fixes bug in dataProviderFactory
            treeLoadInput.parentNode.cursorObject = tempCursorObject;

            var treeLoadResult = awTableTreeSvc.buildTreeLoadResult(
                treeLoadInput, populateNodes, true, true, tempCursorObject.endReached, null );

            // If there are no nodes then prevent abort in dataProviderFactory where it looks for a cursor object
            // on the parentNode thats not there
            if( populateNodes.length === 0 ) {
                treeLoadResult.parentNode.levelNdx = 0;
            }

            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
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
            clientScopeURI: 'Eda0RequirementsTraceabilityTable',
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
 * Eda0RequirementsTraceabilityService factory
 * @param{Object} $q Service
 * @param{Object} soaSvc SOA Service
 * @param{Object} cdm Data Management Service
 * @param{Object} appCtxSvc Application Context Service
 * @param{Object} awColumnSvc AW Column Service
 * @param{Object} awTableSvc AW Table Service
 * @param{Object} iconSvc Icon Service
 * @param{Object} viewModelObjectSvc View Model Object Service
 * @param{Object} policySvc Policy service
 * @param{Object} selectionService Selection Service
 * @param{Object} uwPropertyService UW Property Service
 * @return{Object} EDA module
 */

_defaultIconURL = iconSvc.getTypeIconURL( _reqElementType );
_defaultGroupIconURL = iconSvc.getTypeIconURL( 'Folder' );

_emptyProp = uwPropertyService.createViewModelProperty( 'dummy', 'dummy', 'STRING', '', [ '' ] );
_emptyProp.editable = false;
_emptyProp.isEnabled = false;

export default exports = {
    getElementUid,
    getRootElementUids,
    getProductContextUids,
    rowSelected,
    reloadTreeTableColumns,
    loadTreeTableColumns,
    loadTreeTableProperties,
    loadTreeTableData
};
