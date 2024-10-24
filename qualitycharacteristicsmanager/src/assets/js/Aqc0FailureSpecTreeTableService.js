// Copyright (c) 2022 Siemens

/**
 * @module js/Aqc0FailureSpecTreeTableService
 */
import appCtxService from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import AwPromiseService from 'js/awPromiseService';
import awTableStateService from 'js/awTableStateService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import cdm from 'soa/kernel/clientDataModel';
import tableSvc from 'js/published/splmTablePublishedService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import treeTableDataService from 'js/treeTableDataService';
import viewModelObjectService from 'js/viewModelObjectService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

/**
 * Cached static default AwTableColumnInfo.
 */
var _firstColumnConfigColumnPropertyName = 'object_name';
var _debug_delayEnabled = true;

var _debug_pageDelay = 1000;

var _deferExpandTreeNodeArray = [];

/**
 * Cached static default AwTableColumnInfo.
 */
var _treeTableColumnInfos = null;

/**
 */
var _maxTreeLevel = 3;

/**
 * Map of nodeId of a 'parent' TableModelObject to an array of its 'child' TableModelObjects.
 */
var _mapNodeId2ChildArray = {};

/**
 *  * @param {data} declviewModel
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getTreeTableColumnInfos( i18n, sortCriteria ) {
    if( !_treeTableColumnInfos ) {
        _treeTableColumnInfos = _buildTreeTableColumnInfos( i18n, sortCriteria );
    }

    return _treeTableColumnInfos;
}

/**
 *  * @param {data} declviewModel
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
function _buildTreeTableColumnInfos( i18n, sortCriteria ) {
    var awColumnInfos = [];
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_name',
        displayName: i18n.Aqc0ElementName,
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );
    var tcSessionData = appCtxService.getCtx( 'tcSessionData' );
    if( tcSessionData.tcMajorVersion > 12 ) {
        awColumnInfos.push( awColumnSvc.createColumnInfo( {
            name: 'release_status_list',
            propertyName: 'release_status_list',
            displayName: i18n.ReleaseStatus,
            width: 250,
            minWidth: 150,
            typeName: 'String',
            enableColumnResizing: true,
            enableColumnMoving: false,
            isTreeNavigation: false
        } ) );
    }
    for( var index = 0; index < awColumnInfos.length; index++ ) {
        var column = awColumnInfos[ index ];
        column.cellRenderers = [];
        column.cellRenderers.push( _treeCmdCellRender() );
    }
    if( !_.isEmpty( sortCriteria ) ) {
        if( sortCriteria[ 0 ].fieldName && _.eq( awColumnInfos[ 0 ].name, sortCriteria[ 0 ].fieldName ) ) {
            awColumnInfos[ 0 ].sort = {};
            awColumnInfos[ 0 ].sort.direction = sortCriteria[ 0 ].sortDirection.toLowerCase();
            awColumnInfos[ 0 ].sort.priority = 0;
        }
    }
    return awColumnInfos;
}

/**
 * Table Command Cell Renderer for PL Table
 */
var _treeCmdCellRender = function() {
    return {
        action: function( column, vmo, tableElem ) {
            var cellContent = tableSvc.createTreeCellCommandElement( column, vmo, tableElem );

            // add event for cell image visibility
            var gridCellImageElement = cellContent.getElementsByClassName( tableSvc.CLASS_GRID_CELL_IMAGE )[ 0 ];
            if( gridCellImageElement ) {
                togglePartialVisibility( gridCellImageElement, vmo.visible );
            }

            return cellContent;
        },
        condition: function( column, vmo, tableElem ) {
            return column.isTreeNavigation === true;
        }
    };
};

/**
 * Adds/removes partialVisibility class to element.
 *
 * @param {DOMElement} element DOM element for classes
 * @param {Boolean} isVisible for adding/removing class
 */
var togglePartialVisibility = function( element, isVisible ) {
    if( !isVisible ) {
        element.classList.add( 'aw-widgets-partialVisibility' );
    } else {
        element.classList.remove( 'aw-widgets-partialVisibility' );
    }
};

/**
 * @param {Array} sortCriterias - Array of fieldName and sortCriteria.
 * @param {TreeLoadInput} loadInput - TreeLoadInput
 */
var _populateSortCriteriaParameters = function( sortCriterias, loadInput ) {
    var sortCriteria = {};
    if( !_.isEmpty( loadInput.sortCriteria ) ) {
        sortCriteria = loadInput.sortCriteria[ 0 ];
    }
    sortCriterias.push( sortCriteria );
};

/**
 * @param {AwTableColumnInfoArray} columnInfos - Array of column information objects to use when building the
 *            table rows.
 * @param {ViewModelTreeNode} parentNode - A node that acts 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {Number} nChildren - The # of child nodes to add to the given 'parent'.
 * @param {Boolean} isLoadAllEnabled - TRUE if all properties should be included.
 */
function _buildTreeTableStructure( columnInfos, parentNode, nChildren, isLoadAllEnabled ) {
    var children = [];

    _mapNodeId2ChildArray[ parentNode.id ] = children;

    var levelNdx = parentNode.levelNdx + 1;

    for( var childNdx = 1; childNdx <= nChildren.length; childNdx++ ) {
        /**
         * Create a new node for this level. and Create props for it
         */
        var vmNode = exports.createVmNodeUsingNewObjectInfo( nChildren[ childNdx - 1 ], levelNdx, childNdx, isLoadAllEnabled, null, columnInfos );
        /**
         * Add it to the 'parent' based on its ID
         */
        children.push( vmNode );
    }
}

/**
 * @param deferred
 * @param propertyLoadRequests
 */
function _loadProperties( deferred, propertyLoadInput ) {
    var allChildNodes = [];

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            _populateColumns( propertyLoadRequest.columnInfos, true, childNode, childNode.childNdx + 1 );

            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    var resolutionObj = {
        propertyLoadResult: propertyLoadResult
    };

    deferred.resolve( resolutionObj );
}

/**
 * function to evaluate if an object contains children
 * @param {objectType} objectType object type
 * @return {boolean} if node contains child
 */
function containChildren( props, vmNode, searchState ) {
    var deferred = AwPromiseService.instance.defer();
    var containChild = false;
    if( props.qc0FailureList !== undefined && props.qc0FailureList.dbValues.length > 0 ) {
        if( searchState && ( searchState.showInactive === false || searchState.showInactive === undefined ) ) {
            if( props && props.aqc0ContainActiveChild && props.aqc0ContainActiveChild.dbValues && props.aqc0ContainActiveChild.dbValues[ 0 ] === '1' ) {
                vmNode.isLeaf = containChild;
            } else {
                vmNode.isLeaf = !containChild;
            }
        } else {
            vmNode.isLeaf = containChild;
        }
    } else {
        vmNode.isLeaf = !containChild;
    }

    if( !vmNode.isLeaf && searchState && searchState.parentElement && vmNode.uid === searchState.parentElement.uid ) {
        _deferExpandTreeNodeArray.push( vmNode );
    }
}

/**
 * @returns {String} the opened object UID
 */
function getOpenedObjectUid() {
    var openedObjectUid = '';
    var stateSvc = AwStateService.instance;
    if( stateSvc && stateSvc.params ) {
        var params = stateSvc.params;
        openedObjectUid = params.uid;
    }
    return openedObjectUid;
}

/**
 * Resolve the row data for the 'next' page of 'children' nodes of the given 'parent'.
 * <P>
 * Note: The paging status is maintained in the 'parent' node.
 *
 * @param {DeferredResolution} deferred -
 * @param {TreeLoadInput} treeLoadInput -
 * @return {Promise} Revolved with a TreeLoadResult object containing result/status information.
 */
function _loadTreeTableRows( deferred, treeLoadInput, searchData, i18n, sortCriteria, showInactive ) {
    /**
     * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
     */
    var parentNode = treeLoadInput.parentNode;
    let sublocationCtx = appCtxService.getCtx( 'sublocation' );

    if( sublocationCtx.nameToken === 'qualityfailuremanager' ) {
        var targetNode;
        // this context value comes true only when breadcrumb is updated from chevron
        if( !parentNode.isExpanded ) {
            targetNode = getOpenedObjectUid();
        } else {
            targetNode = parentNode.uid;
        }
    } else {
        targetNode = parentNode.uid;
    }

    if( !parentNode.isLeaf ) {
        var policyJson = {
            types: [ {
                name: 'Qc0Failure',
                properties: [ {
                        name: 'qc0FailureList'
                    },
                    {
                        name: 'qc0FailurePath'
                    },
                    {
                        name: 'aqc0ContainActiveChild'
                    },
                    {
                        name: 'release_status_list',
                        modifiers: [ {
                            name: 'withProperties',
                            Value: 'true'
                        } ]
                    }
                ]
            } ]
        };

        // get props with intial tree for now. In future, should set this to false and populate
        // the props seperately.
        var soaInput = {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: ''
            },
            searchInput: {
                maxToLoad: 110,
                maxToReturn: 110,
                providerName: 'Aqc0QualityBaseProvider',
                searchFilterMap6: {
                    'WorkspaceObject.object_type': [ {
                        searchFilterType: 'StringFilter',
                        stringValue: 'Qc0Failure'
                    } ]
                },
                searchCriteria: {
                    parentGUID: '',
                    searchStatus: ( !showInactive ).toString(),
                    catalogueObjectType: ''
                },
                startIndex: treeLoadInput.startChildNdx,
                searchSortCriteria: []
            }
        };
        if( searchData && searchData.criteria ) {
            soaInput.searchInput.searchCriteria.searchString = searchData.criteria.searchString;
        }

        _populateSortCriteriaParameters( soaInput.searchInput.searchSortCriteria, treeLoadInput );
        if( parentNode.levelNdx < 0 ) {
            if( sublocationCtx.nameToken === 'qualityfailuremanager' ) {
                soaInput.searchInput.searchCriteria.parentGUID = targetNode;
            } else {
                soaInput.searchInput.searchCriteria.catalogueObjectType = 'Qc0Failure';
            }
            var isLoadAllEnabled = true;
            var children = [];

            var policyId = propertyPolicySvc.register( policyJson );

            return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
                function( response ) {
                    if( policyId ) {
                        propertyPolicySvc.unregister( policyId );
                    }
                    if( response.searchResultsJSON ) {
                        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                        if( searchResults ) {
                            for( var x = 0; x < searchResults.objects.length; ++x ) {
                                var uid = searchResults.objects[ x ].uid;
                                var obj = response.ServiceData.modelObjects[ uid ];
                                if( obj ) {
                                    children.push( obj );
                                }
                            }
                        }
                    }
                    const colDefs = loadTreeTableColumns( i18n, sortCriteria );
                    if( response.totalFound === 0 ) {
                        parentNode.isLeaf = true;
                        var endReached = true;
                        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, true,
                            endReached, null );
                        deferred.resolve( {
                            treeLoadResult: treeLoadResult,
                            colDefs
                        } );
                    } else {
                        var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput );
                        deferred.resolve( {
                            treeLoadResult: treeLoadResult,
                            colDefs
                        } );
                    }

                    if( searchData ) {
                        const newSearchData = { ...searchData.value };
                        newSearchData.totalFound = response.searchFilterMap.Qc0Failure[ 0 ].count;
                        newSearchData.searchFilterMap = response.searchFilterMap;
                        newSearchData.filterMap = response.searchFilterMap;
                        searchData.update( newSearchData );
                    }
                } );
        }
        if( parentNode.levelNdx < _maxTreeLevel ) {
            var isLoadAllEnabled = true;
            var children = [];
            soaInput.searchInput.searchCriteria.parentGUID = targetNode;
            var policyId = propertyPolicySvc.register( policyJson );
            return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
                function( response ) {
                    if( policyId ) {
                        propertyPolicySvc.unregister( policyId );
                    }
                    if( response.searchResultsJSON ) {
                        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                        if( searchResults ) {
                            for( var x = 0; x < searchResults.objects.length; ++x ) {
                                var uid = searchResults.objects[ x ].uid;
                                var obj = response.ServiceData.modelObjects[ uid ];
                                if( obj ) {
                                    children.push( obj );
                                }
                            }
                        }
                    }
                    const colDefs = loadTreeTableColumns( i18n, sortCriteria );
                    if( response.totalFound === 0 ) {
                        parentNode.isLeaf = true;
                        var endReached = true;
                        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, true,
                            endReached, null );
                        deferred.resolve( {
                            treeLoadResult: treeLoadResult,
                            colDefs
                        } );
                    } else {
                        var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput );
                        deferred.resolve( {
                            treeLoadResult: treeLoadResult,
                            colDefs
                        } );
                    }

                    if( searchData ) {
                        const newSearchData = { ...searchData.value };
                        newSearchData.totalFound = response.searchFilterMap.Qc0Failure[ 0 ].count;
                        newSearchData.searchFilterMap = response.searchFilterMap;
                        newSearchData.filterMap = response.searchFilterMap;
                        searchData.update( newSearchData );
                    }
                } );
        }
        const colDefs = loadTreeTableColumns( i18n, sortCriteria );
        parentNode.isLeaf = true;
        var mockChildNodes = _mapNodeId2ChildArray[ parentNode.id ];
        var mockChildNodesLen = mockChildNodes ? mockChildNodes.length : 0;
        var endReached = parentNode.startChildNdx + treeLoadInput.pageSize > mockChildNodesLen;
        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, false, true,
            endReached, null );
        deferred.resolve( {
            treeLoadResult: treeLoadResult,
            colDefs
        } );
    }
}

/**
 *
 * @param {parentNode} parentNode -
 * @param {children} children -
 * @param {isLoadAllEnabled} isLoadAllEnabled -
 * @param {actionObjects} actionObjects -
 * @param {treeLoadInput} treeLoadInput -
 * @return {awTableSvc.buildTreeLoadResult} awTableSvc.buildTreeLoadResult -
 *
 **/
function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, colDefs ) {
    _buildTreeTableStructure( colDefs, parentNode, children, isLoadAllEnabled );
    if( parentNode.children !== undefined && parentNode.children !== null ) {
        var mockChildNodes = parentNode.children.concat( _mapNodeId2ChildArray[ parentNode.id ] );
    } else {
        var mockChildNodes = _mapNodeId2ChildArray[ parentNode.id ];
    }
    var mockChildNodesLen = mockChildNodes ? mockChildNodes.length : 0;
    var endReached = parentNode.startChildNdx + treeLoadInput.pageSize > mockChildNodesLen;
    var tempCursorObject = {
        endReached: endReached,
        startReached: true
    };

    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, false, true,
        endReached, null );
    treeLoadResult.parentNode.cursorObject = tempCursorObject;
    if( _deferExpandTreeNodeArray.length > 0 ) {
        _.defer( function() {
            // send event that will be handled in this file to check
            // if there are nodes to be expanded. This defer is needed
            // to make sure tree nodes are actually loaded before we attempt
            // to expand them. Fixes a timing issue if not deferred.
            eventBus.publish( 'failureSpecExpandTreeNodeEvent' );
        } );
    }
    return treeLoadResult;
}

/**
 * @param {ObjectArray} columnInfos -
 * @param {Boolean} isLoadAllEnabled -
 * @param {ViewModelTreeNode} vmNode -
 * @param {Number} childNdx -
 */
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, props ) {
    if( isLoadAllEnabled ) {
        if( !vmNode.props ) {
            vmNode.props = {};
        }

        var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
            .getObject( vmNode.uid ), 'EDIT' );

        tcViewModelObjectService.mergeObjects( vmNode, vmo );
    }
}

var exports = {};

export let createVmNodeUsingNewObjectInfo = function( modelObject, levelNdx, childNdx, isLoadAllEnabled, searchState, columnInfos ) {
    var nodeId = modelObject.uid;
    var type = modelObject.type;
    var displayName = modelObject.props.object_name.uiValues[ 0 ];

    var iconURL = iconSvc.getTypeIconURL( type );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, levelNdx, childNdx, iconURL );
    vmNode.modelType = modelObject.modelType;

    if( modelObject.props.qc0Status.dbValues[ 0 ] === '0' ) {
        vmNode.visible = false;
    }

    !containChildren( modelObject.props, vmNode, searchState );

    vmNode.selected = true;

    _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, modelObject.props );
    return vmNode;
};

/**
 * * @param {data} declviewModel
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 * <pre>
 * {
 *     columns : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = function( i18n, sortCriteria ) {
    var awColumnInfos = _getTreeTableColumnInfos( i18n, sortCriteria );
    return {
        columns: awColumnInfos
    };
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     delayTimeTree: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function() { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     */
    var treeLoadInput = arguments[ 0 ];

    if( arguments[ 4 ] ) {
        appCtxService.updatePartialCtx( 'failureManagerContext.sortCriteria', arguments[ 4 ] );
        if( treeLoadInput ) {
            treeLoadInput.retainTreeExpansionStates = true;
        }
    }

    treeLoadInput.sortCriteria = appCtxService.getCtx( 'failureManagerContext' ).sortCriteria;

    /**
     * Extract action parameters from the arguments to this function.
     * <P>
     * Note: The order or existence of parameters can varey when more-than-one property is specified in the
     * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
     */
    var delayTimeTree = 0;

    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];
        if( arg ) {
            if( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeTree' ) {
                delayTimeTree = arg.dbValue;
            } else if( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'maxTreeLevel' ) {
                _maxTreeLevel = arg.dbValue;
            }
        }
    }

    /**
     * Check the validity of the parameters
     */
    var deferred = AwPromiseService.instance.defer();

    var searchData;
    if( arguments[ 5 ] ) {
        searchData = arguments[ 5 ];
    } else if( arguments[ 6 ] ) {
        searchData = arguments[ 6 ];
    }
    if( searchData ) {
        var showInactive = searchData.showInactive;
    }
    let sortCriteria = arguments[ 4 ];
    let i18n = arguments[ 7 ];

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    if( delayTimeTree > 0 ) {
        _.delay( _loadTreeTableRows, delayTimeTree, deferred, treeLoadInput, searchData, i18n, sortCriteria, showInactive );
    } else {
        _loadTreeTableRows( deferred, treeLoadInput, searchData, i18n, sortCriteria, showInactive );
    }

    return deferred.promise;
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 */
export let loadTreeTableProperties = function() { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     * <P>
     * Note: The order or existence of parameters can varey when more-than-one property is specified in the
     * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
     */
    var propertyLoadInput;

    var delayTimeProperty = 0;

    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];

        if( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        } else if( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeProperty' ) {
            delayTimeProperty = arg.dbValue;
        }
    }

    var deferred = AwPromiseService.instance.defer();

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    if( delayTimeProperty > 0 ) {
        _.delay( _loadProperties, delayTimeProperty, deferred, propertyLoadInput );
    } else {
        if( propertyLoadInput ) {
            _loadProperties( deferred, propertyLoadInput );
        }
    }

    return deferred.promise;
};

/**
 * This makes sure, edited object is selected
 * @param {data} data
 * @param {ArrayList} selectionModel selection model of pwa
 */
export let processPWASelection = function( data, selectionModel, subPanelContext ) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    var selectedModelObject = [];
    if( searchState && searchState.selectedNodes ) {
        selectedModelObject = searchState.selectedNodes;
    }
    var viewModelCollection = data.dataProviders.failureSpecDataProvider.viewModelCollection;
    if( selectedModelObject && selectedModelObject.length > 0 ) {
        _.forEach( selectedModelObject, function( selectedObject ) {
            if( selectedObject.props.qc0Status.dbValues[ 0 ] === '1' || searchState && searchState.showInactive === true && viewModelCollection.loadedVMObjects.length > 0 ) {
                selectionModel.setSelection( selectedObject );
                var parentIdx = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
                    return vmo.uid === selectedObject.props.qc0ParentFailure.dbValues[ 0 ];
                } );
                if( parentIdx > -1 ) {
                    var parentVMO = viewModelCollection.getViewModelObject( parentIdx );
                    addNodeToExpansionState( parentVMO, data );
                }
            } else if( selectedObject.props.qc0Status.dbValues[ 0 ] === '0' ) {
                selectionModel.setSelection( [] );
            }
        } );
    } else if( !selectedModelObject || selectedModelObject && selectedModelObject.length === 0 ) {
        selectionModel.setSelection( [] );
    }
};

/**
 * Add local storage entry corresponding to the information sent in.
 *
 * @param node This parameter can either be the node that is to be added to local storage or it can be just the id
 *            of the node
 * @param declViewModel The declarative view model backing this tree
 */
export let addNodeToExpansionState = function( node, declViewModel ) {
    // For now we will use id of the grid that is first in the list of grids in the view model.
    // Once we get this value in treeLoadInput we will shift to using it.
    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    awTableStateService.saveRowExpanded( declViewModel, gridId, node );
};

export let failureSpecExpandTreeNode = function() {
    _.defer( function() {
        // _deferExpandTreeNodeArray contains nodes we want to expand. We
        // had to make these deferred calls to allow the tree to draw before
        // we asked it to expand a node.
        for( var x = 0; x < _deferExpandTreeNodeArray.length; x++ ) {
            eventBus.publish( 'failureSpecDataProvider.expandTreeNode', {
                // ask tree to expand a node
                parentNode: _deferExpandTreeNodeArray[ x ]
            } );
        }
        _deferExpandTreeNodeArray = []; // clear out the global array
    } );
};

/**
 * Update selected nodes in context based on pin value
 * selected node set as new object if panelPinned is true
 * selected node set as current selection if panelPinned is false
 * @param {DeclViewModel} data
 */
export let selectNewlyAddedElement = function( data, subPanelContext ) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    if( searchState ) {
        let searchData = { ...searchState.value };
        searchData.newlyCreatedElement = data.createdObject;
        searchData.selectedNodes = [];
        if( subPanelContext && !subPanelContext.panelPinned ) {
            searchData.selectedNodes = data.selectedNodes;
        } else {
            searchData.selectedNodes.push( appCtxService.getCtx( 'selected' ) );
            if( data && data.subPanelContext ) {
                if( data.subPanelContext.data.activeView && data.subPanelContext.data.activeView === 'Aqc0AddChildFailureSpec' ) {
                    var parentElement = {};
                    parentElement = viewModelObjectService.createViewModelObject( appCtxService.getCtx( 'selected' ).uid );
                    searchData.parentElement = parentElement;
                } else if( data.subPanelContext.data.activeView && data.subPanelContext.data.activeView === 'Aqc0AddSiblingFailureSpec' ) {
                    var parentElement = {};
                    parentElement = viewModelObjectService.createViewModelObject( cdm.getObject( appCtxService.getCtx( 'selected' ).uid ).props.qc0ParentFailure.dbValues[ 0 ] );
                    searchData.parentElement = parentElement;
                } else if( data.subPanelContext.data.activeView && data.subPanelContext.data.activeView === 'Aqc0AddRootFailureSpec' ) {
                    searchData.parentElement = null;
                }
            }
        }
        searchState.update( { ...searchData } );
    }
};
// eslint-disable-next-line valid-jsdoc
/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column 0 ViewModelProperty
 * eventData : {Object} containing viewModelObjects and totalObjectsFound
 */
export let updateDisplayNames = function( eventData ) {
    //update the display name for all ViewModelObjects which should be viewModelTreeNodes
    if( eventData && eventData.viewModelObjects ) {
        _.forEach( eventData.viewModelObjects, function( updatedVMO ) {
            treeTableDataService.updateVMODisplayName( updatedVMO, _firstColumnConfigColumnPropertyName );
        } );
    }

    if( eventData && eventData.modifiedObjects && eventData.vmc ) {
        var loadedVMObjects = eventData.vmc.loadedVMObjects;
        _.forEach( eventData.modifiedObjects, function( modifiedObject ) {
            var modifiedVMOs = loadedVMObjects.filter( function( vmo ) { return vmo.id === modifiedObject.uid; } );
            _.forEach( modifiedVMOs, function( modifiedVMO ) {
                treeTableDataService.updateVMODisplayName( modifiedVMO, _firstColumnConfigColumnPropertyName );
            } );
        } );
    }
};

export let replaceVersionNode = function( subPanelContext, dataProviders, selectionModel ) {
    let oldVersionSelected = appCtxService.getCtx( 'selected' );
    var viewModelCollection = dataProviders.failureSpecDataProvider.viewModelCollection;
    var ndx = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
        return vmo.uid === oldVersionSelected.uid;
    } );
    let oldTreeSelection = viewModelCollection.loadedVMObjects[ ndx ];
    var newObjVersionVMO = exports.createVmNodeUsingNewObjectInfo( subPanelContext.searchState.selectedNodes[ 0 ], oldTreeSelection.levelNdx, oldTreeSelection.childNdx, true, subPanelContext
        .searchState );

    if( newObjVersionVMO.props.qc0BasedOnId !== undefined && oldTreeSelection.props.qc0BasedOnId !== undefined ) {
        if( newObjVersionVMO.props.qc0BasedOnId.dbValue > oldTreeSelection.props.qc0BasedOnId.dbValue ) {
            newObjVersionVMO.isLeaf = oldTreeSelection.isLeaf;
            viewModelCollection.loadedVMObjects[ ndx ] = newObjVersionVMO;
            if( oldTreeSelection.isExpanded ) {
                newObjVersionVMO.isExpanded = true;
            }
            dataProviders.failureSpecDataProvider.update( viewModelCollection.loadedVMObjects );
        }
    }
    selectionModel.setSelection( subPanelContext.searchState.selectedNodes );
};

export default exports = {
    updateDisplayNames,
    createVmNodeUsingNewObjectInfo,
    loadTreeTableColumns,
    loadTreeTableData,
    loadTreeTableProperties,
    processPWASelection,
    failureSpecExpandTreeNode,
    selectNewlyAddedElement,
    addNodeToExpansionState,
    replaceVersionNode
};
