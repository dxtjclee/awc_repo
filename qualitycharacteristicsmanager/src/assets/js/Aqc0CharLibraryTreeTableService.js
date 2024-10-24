// Copyright (c) 2022 Siemens

/**
 * @module js/Aqc0CharLibraryTreeTableService
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import _aqc0CharManagerUtils from 'js/Aqc0CharManagerUtils';
import Aqc0CharManagerUtils2 from 'js/Aqc0CharManagerUtils2';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import awTableStateService from 'js/awTableStateService';

// Adding currentSelectedNodesForPinUnpin into ctx because it required for close closeSpecCreationPanel.
// We are not getting selected objects into closeSpecCreationPanel therefore we are regestering it here and updating it into selectionChanged.
appCtxService.registerCtx( 'currentSelectedNodesForPinUnpin', undefined );

var _deferExpandTreeNodeArray = [];
var _prev_location_context = '';
var _mapOfCharGroupAndSpecification = new Map();
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
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getTreeTableColumnInfos( i18n ) {
    if ( !appCtxService.ctx.currentTypeSelection ) {
        _aqc0CharManagerUtils.getCurrentType();
    }
    var cur_location_context = appCtxService.ctx.currentTypeSelection.dbValue;
    if ( !_treeTableColumnInfos || cur_location_context !== _prev_location_context ) {
        _treeTableColumnInfos = _buildTreeTableColumnInfos( i18n );
        _prev_location_context = cur_location_context;
    }

    return _treeTableColumnInfos;
}
/**
 * @return {displayName} Object Name for column header of table
 */

function findDisplayName( i18n ) {
    var displayName = appCtxService.ctx.currentTypeSelection.dbValue;
    if ( displayName === 'Qc0CharacteristicsGroup' ) { return i18n.Name; }
    if ( displayName === 'Acp0Rule' ) { return i18n.Aqc0RuleTitle; }
    if ( displayName === 'Acp0NamingConvention' ) { return i18n.Aqc0NamingConventionTitle; }
}

/**

/**
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
function _buildTreeTableColumnInfos( i18n ) {
    var columnInfos = [];

    /**
     * Set 1st column to special 'name' column to support tree-table.
     */

    var awColumnInfos = [];
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_name',
        propertyName: 'object_name',
        displayName: findDisplayName( i18n ),
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );
    if ( appCtxService.ctx.currentTypeSelection.dbValue === 'Qc0CharacteristicsGroup' ) {
        awColumnInfos.push( awColumnSvc.createColumnInfo( {
            name: 'qc0CharacteristicsType',
            propertyName: 'qc0CharacteristicsType',
            displayName: i18n.CharacteristicType,
            width: 250,
            minWidth: 150,
            typeName: 'String',
            enableColumnResizing: true,
            enableColumnMoving: false,
            isTreeNavigation: false
        } ) );
        awColumnInfos.push( awColumnSvc.createColumnInfo( {
            name: 'object_desc',
            propertyName: 'object_desc',
            displayName: i18n.Description,
            width: 250,
            minWidth: 150,
            typeName: 'String',
            enableColumnResizing: true,
            enableColumnMoving: false,
            isTreeNavigation: false
        } ) );
        if ( appCtxService.ctx.isTC13_2OnwardsSupported ) {
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
    }
    for ( var index = 0; index < awColumnInfos.length; index++ ) {
        var column = awColumnInfos[index];
        column.cellRenderers = [];
    }

    var charLibmangercontext = appCtxService.getCtx( 'charLibmanagercontext' );
    var sortCriteria = charLibmangercontext.sortCriteria;
    if ( !_.isEmpty( sortCriteria ) ) {
        if ( sortCriteria[0].fieldName && _.eq( awColumnInfos[0].name, sortCriteria[0].fieldName ) ) {
            awColumnInfos[0].sort = {};
            awColumnInfos[0].sort.direction = sortCriteria[0].sortDirection.toLowerCase();
            awColumnInfos[0].sort.priority = 0;
        }
    }
    return awColumnInfos;
}

/**
 * @param {Array} sortCriterias - Array of fieldName and sortCriteria.
 * @param {TreeLoadInput} loadInput - TreeLoadInput
 */
var _populateSortCriteriaParameters = function( sortCriterias, loadInput ) {
    var sortCriteria = {};
    if ( !_.isEmpty( loadInput.sortCriteria ) ) {
        sortCriteria = loadInput.sortCriteria[0];
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

    _mapNodeId2ChildArray[parentNode.id] = children;

    var levelNdx = parentNode.levelNdx + 1;

    for ( var childNdx = 1; childNdx <= nChildren.length; childNdx++ ) {
        /**
         * Create a new node for this level. and Create props for it
         */
        var vmNode = exports.createVmNodeUsingNewObjectInfo( nChildren[childNdx - 1], levelNdx, childNdx, isLoadAllEnabled, columnInfos );
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
            if ( !childNode.props ) {
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
function containChildren( props, vmNode ) {
    var deferred = AwPromiseService.instance.defer();
    var containChild = false;
    if ( vmNode.type === 'Qc0CharacteristicsGroup' ) {
        if ( props.qc0SpecificationList.dbValues && props.qc0SpecificationList.dbValues.length > 0 ) {
            vmNode.isLeaf = containChild;
        } else {
            vmNode.isLeaf = !containChild;
        }
    } else {
        vmNode.isLeaf = !containChild;
    }
    let ctx = appCtxService.getCtx( 'charLibmanagercontext' );
    if ( !vmNode.isLeaf && ctx.parentElement && vmNode.uid === ctx.parentElement.dbValues[0] ) {
        _deferExpandTreeNodeArray.push( vmNode );
    }
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
function _loadTreeTableRows( deferred, treeLoadInput, searchData, i18n ) {
    /**
     * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
     */
    if( !treeLoadInput ) {
        return;
    }
    var parentNode = treeLoadInput.parentNode;
    var targetNode;
    // this context value comes true only when breadcrumb is updated from chevron
    if ( !parentNode.isExpanded ) {
        var locationCtx = appCtxService.getCtx( 'locationContext' );
        targetNode = locationCtx.modelObject;
    } else {
        targetNode = parentNode;
    }

    if ( !parentNode.isLeaf ) {
        // get props with intial tree for now. In future, should set this to false and populate
        // the props seperately.
        if ( parentNode.levelNdx < 0 ) {
            var searchStringData = '';
            if( searchData !== undefined ) {
                searchStringData = searchData.criteria ? searchData.criteria.searchString : '';
            }
            var inputData = {
                searchInput: {
                    maxToLoad: 50,
                    maxToReturn: 50,
                    providerName: 'Acp0CharsRulesAndNCProvider',
                    searchCriteria: {
                        type: appCtxService.ctx.currentTypeSelection.dbValue,
                        searchString: searchStringData
                    },
                    searchSortCriteria: [
                        {
                            fieldName: 'creation_date',
                            sortDirection: 'DESC'
                        }
                    ],
                    startIndex: treeLoadInput.startChildNdx
                }
            };
            _populateSortCriteriaParameters( inputData.searchInput.searchSortCriteria, treeLoadInput );

            //if (parentNode.levelNdx < 0) {
            var isLoadAllEnabled = true;
            var children = [];
            var policyIdLibObj = propertyPolicySvc.register( _aqc0CharManagerUtils.getPopertyPolicyInCharLib() );
            var responseOut = {};
            return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData ).then( function( response ) {
                if ( policyIdLibObj ) {
                    propertyPolicySvc.unregister( policyIdLibObj );
                }
                responseOut = response;

                if ( response.searchResultsJSON ) {
                    var loadChxObjectInputArr = [];
                    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                    response.searchResults = searchResults;
                    if ( searchResults ) {
                        for ( var x = 0; x < searchResults.objects.length; ++x ) {
                            var uid = searchResults.objects[ x ].uid;
                            var obj = response.ServiceData.modelObjects[ uid ];
                            if ( obj ) {
                                children.push( obj );
                                loadChxObjectInputArr.push( obj );
                            }
                        }

                        _renderTreeRows( response, parentNode, treeLoadInput, children, isLoadAllEnabled, searchData, deferred, i18n );
                    }
                } else{
                    // LCS-851352 - User switch from naming convention to rule in characteristic library get failed to load the page
                    // If there is no Rule/Naming Convention/Char Groups are present then response.searchResults will be empty
                    // In that case, respective area is not showing properly.
                    // Ex.Rule not present. User select "Tree with Summary" => User select "Characteristics and Rule Engine" =>
                    // User select "Characteristics" => all Characteristics groups will be shown => USer select "Rule" then still "Characteristics" will be shown
                    _renderTreeRows( response, parentNode, treeLoadInput, children, isLoadAllEnabled, searchData, deferred, i18n );
                }
            } );
        }
        if ( parentNode.levelNdx < _maxTreeLevel ) {
            var isLoadAllEnabled = true;
            var children = [];
            //soaInput.searchInput.searchCriteria.parentGUID = targetNode.uid;
            const colDefs = loadTreeTableColumns( i18n );
            if ( parentNode.type === 'Qc0CharacteristicsGroup' ) {
                loadObjects( deferred, parentNode, isLoadAllEnabled, treeLoadInput, colDefs );
            } else {
                parentNode.isLeaf = true;

                var endReached = true;
                var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, true, true,
                    endReached, null );
                if( responseOut ) {
                    treeLoadResult.totalFound = responseOut.totalFound;
                    treeLoadResult.totalLoaded = responseOut.totalLoaded;
                }
                deferred.resolve( {
                    treeLoadResult: treeLoadResult,
                    colDefs
                } );
            }
        }
    }
}


function _renderTreeRows( response, parentNode, treeLoadInput, children, isLoadAllEnabled, searchData, deferred, i18n ) {
    const colDefs = loadTreeTableColumns( i18n );
    if ( response.totalFound === 0 ) {
        parentNode.isLeaf = true;
        var endReached = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, true, true,
            endReached, null );
        treeLoadResult.totalFound = response.totalFound;
        treeLoadResult.totalLoaded = response.totalLoaded;
        deferred.resolve( {
            treeLoadResult: treeLoadResult,
            colDefs
        } );
    } else {
        var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, colDefs, response );
        treeLoadResult.totalFound = response.totalFound;
        treeLoadResult.totalLoaded = response.totalLoaded;
        deferred.resolve( {
            treeLoadResult: treeLoadResult,
            colDefs
        } );
    }
    if ( searchData ) {
        const newSearchData = { ...searchData.value };
        newSearchData.totalFound = response.totalFound;
        newSearchData.filterMap = response.totalLoaded;
        searchData.update( newSearchData );
    }
}


/**
 * This method first gets the qc0SpecificationList for characteristics group and loads the object
 *@returns {Object} promise
 */
export let loadObjects = function( deferred, parentNode, isLoadAllEnabled, treeLoadInput, colDefs  ) {
    var charGroup = {
        type: parentNode.type,
        uid: parentNode.uid
    };
    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Aqc0QualityBaseProvider',
            searchFilterMap6: {
                'WorkspaceObject.object_type': [ {
                    searchFilterType: 'StringFilter',
                    stringValue: 'Qc0MasterCharSpec'
                } ]
            },
            searchCriteria: {
                parentGUID: charGroup.uid,
                searchStatus: 'true',
                catalogueObjectType: '',
                objectType: 'Qc0MasterCharSpec',
                isReleased: 'false'
            },
            searchSortCriteria: [
                {
                    fieldName: 'creation_date',
                    sortDirection: 'DESC'
                }
            ],
            startIndex: treeLoadInput.startChildNdx
        }
    };
    soaSvc.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData ).then( function( response ) {
        if ( response.ServiceData.plain ) {
            var values = response.ServiceData.plain.map( function( Objuid ) {
                return response.ServiceData.modelObjects[Objuid];
            } );

            var children = [];
            if( values && values.length > 0 ) {
                for(  let childIndex = 0; childIndex < values.length; childIndex++ ) {
                    children.push( cdm.getObject( values[ childIndex ].uid ) );
                }

                var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, colDefs, response );

                treeLoadResult.totalFound = response.totalFound;
                treeLoadResult.totalLoaded = response.totalLoaded;

                deferred.resolve( {
                    treeLoadResult: treeLoadResult,
                    colDefs
                } );
            }
        }
    } );
};

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
function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, colDefs, response ) {
    _buildTreeTableStructure( colDefs, parentNode, children, isLoadAllEnabled );

    var mockChildNodes = _mapNodeId2ChildArray[parentNode.id];

    var mockChildNodesLen = mockChildNodes ? mockChildNodes.length : 0;

    var tempCursorObject = {
        endReached: endReached,
        startReached: true
    };

    if( response ) {
        var endReached = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
        if( response.cursor ) {
            tempCursorObject = response.cursor;
        }
    }

    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, true, true,
        tempCursorObject.endReached, null );
    treeLoadResult.parentNode.cursorObject = tempCursorObject;

    if( response ) {
        treeLoadResult.searchResults = response.searchResults;
        treeLoadResult.totalLoaded = response.totalLoaded;
    }

    if ( _deferExpandTreeNodeArray.length > 0 ) {
        _.defer( function() {
            // send event that will be handled in this file to check
            // if there are nodes to be expanded. This defer is needed
            // to make sure tree nodes are actually loaded before we attempt
            // to expand them. Fixes a timing issue if not deferred.
            eventBus.publish( 'charLibraryExpandTreeNodeEvent' );
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
    if ( isLoadAllEnabled ) {
        if ( !vmNode.props ) {
            vmNode.props = {};
        }

        var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( vmNode.uid ), 'EDIT' );

        tcViewModelObjectService.mergeObjects( vmNode, vmo );
    }
}

var exports = {};

export let createVmNodeUsingNewObjectInfo = function( modelObject, levelNdx, childNdx, isLoadAllEnabled, columnInfos ) {
    var nodeId = modelObject.uid;
    var type = modelObject.type;
    var displayName = modelObject.props.object_name.dbValues[0];

    var iconURL = iconSvc.getTypeIconURL( type );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, levelNdx, childNdx, iconURL );
    vmNode.modelType = modelObject.modelType;

    !containChildren( modelObject.props, vmNode );

    // commented this code to make selection happen in collapse mode
    //LCS-743713 - Issue with selecting Char Group in 'Tree With Summary' mode in Char Library
    //vmNode.selected = true;

    _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, modelObject.props );
    return vmNode;
};

/**
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = function( i18n, uwDataProvider ) {
    appCtxService.registerCtx( 'treeVMO', uwDataProvider );
    var awColumnInfos = _getTreeTableColumnInfos( i18n );

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
    var treeLoadInput = arguments[0];
    var charLibmangercontext = appCtxService.getCtx( 'charLibmanagercontext' );
    var sortCriteria = charLibmangercontext.sortCriteria;
    let i18n = arguments[6] || {};

    if ( arguments[4] ) {
        if ( !_.eq( arguments[4], sortCriteria ) ) {
            appCtxService.updatePartialCtx( 'charLibmanagercontext.sortCriteria', arguments[4] );
            if ( treeLoadInput ) {
                treeLoadInput.retainTreeExpansionStates = true;
            }
        }
    }

    if ( treeLoadInput ) {
        treeLoadInput.sortCriteria = sortCriteria;
    }

    for ( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ndx];
        if ( arg !== undefined && uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'maxTreeLevel' ) {
            _maxTreeLevel = arg.dbValue;
        }
    }

    /**
     * Check the validity of the parameters
     */
    var deferred = AwPromiseService.instance.defer();


    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    _loadTreeTableRows( deferred, treeLoadInput, arguments[5], i18n );
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

    for ( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ndx];

        if ( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        }
    }

    var deferred = AwPromiseService.instance.defer();

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    if ( propertyLoadInput ) {
        _loadProperties( deferred, propertyLoadInput );
    }

    return deferred.promise;
};

/**
 * This makes sure, edited object is selected
 * @param {data} data
 * @param {ArrayList} selectionModel selection model of pwa
 */
export let processPWASelection = function( data, selectionModel ) {
    var ctx = appCtxService.getCtx();
    var selectedModelObject = ctx.charLibmanagercontext.selectedNodes;
    //get s_uid from browser url to set/maintain the selection ,only when object is not newly created, used specially at browser refresh
    if ( !ctx.createdObjUid ) {
        Aqc0CharManagerUtils2.setQueryParams( selectionModel );
    }

    //scenario -create version / save as
    if ( ctx.createdObjectForTreeFromAddAction ) {
        selectionModel.setSelection( ctx.createdObjectForTreeFromAddAction );
    }

    //scenario -create version using save/discard popup (selection change)
    if ( !ctx.createdObjectForTreeFromAddAction && selectedModelObject && selectedModelObject.length > 0 ) {
        selectionModel.setSelection( selectedModelObject );
    }

    //scenario - collapse/expand should remove the selection
    if ( !ctx.versionCreatedFlag && !ctx.AddSpecificationFlagForTree && data.treeLoadInput && data.treeLoadInput.parentNode && data.treeLoadInput.parentNode.isExpanded === true &&
        selectedModelObject && selectedModelObject.length > 0 && selectedModelObject[0].modelType.typeHierarchyArray.indexOf( 'Qc0MasterCharSpec' ) > -1 &&
        data.treeLoadInput.parentNode.uid === selectedModelObject[0].props.qc0GroupReference.dbValues[0] ) {
        //scenario - to remove the selection when user collapse/expand the group
        if ( ctx.selected && ctx.createdObjectForTreeFromAddAction &&
            ctx.selected.uid !== ctx.createdObjectForTreeFromAddAction.uid ) {
            selectionModel.setSelection( [] );
        }
        selectionModel.setSelection( [] );
    }

    //scenario - SAVE AS specification in a group which is not expanded (group should be selected)
    if ( ctx.createdObjectForTreeFromAddAction &&
        ( ctx.createdObjectForTreeFromAddAction.props.qc0GroupReference &&
            ctx.createdObjectForTreeFromAddAction.props.qc0GroupReference.dbValues[0] !== data.treeLoadInput.parentNode.uid && ctx.AddSpecificationFlagForTree ) ) {
        let vmo = appCtxService.getCtx( 'treeVMO' );
        _.forEach( vmo.viewModelCollection.loadedVMObjects, function( object ) {
            if ( object.uid === ctx.createdObjectForTreeFromAddAction.props.qc0GroupReference.dbValues[0] ) {
                object.isExpanded = true;
                _deferExpandTreeNodeArray.push( object );
                charLibraryExpandTreeNode();
                selectionModel.setSelection( ctx.createdObjectForTreeFromAddAction );
            }
        } );
    }
};

/**
 * This wll close any tools and info panel if any open
 * @param {object} data data of viewmodel
 */
export let selectionChanged = function( data, selectionModel ) {
    appCtxService.updateCtx( 'createdObjectForTreeFromAddAction', undefined );
    appCtxService.updateCtx( 'AddSpecificationFlagForTree', false );
    appCtxService.updateCtx( 'versionCreatedFlag', false );

    if( data.eventData ) {
        var selectedNodes = data.eventData.selectedObjects;
        appCtxService.updateCtx( 'currentSelectedNodesForPinUnpin', selectedNodes );

        if ( selectedNodes && selectedNodes.length > 0 ) {
            if ( appCtxService.ctx.charLibmanagercontext === undefined ||
            appCtxService.ctx.charLibmanagercontext === '' ) {
                appCtxService.ctx.charLibmanagercontext = {};
            }
            selectionModel.setSelection( selectedNodes );
        }
        appCtxService.updateCtx( 'charLibmanagercontext.selectedNodes', selectedNodes );
    }
};

// This function will call in case of list with summary
export let selectionChangedForListWithSummary = function( data ) {
    var selectedNodes = data.eventData.selectedObjects;
    appCtxService.updateCtx( 'currentSelectedNodesForPinUnpin', selectedNodes );
};


export let charLibraryExpandTreeNode = function() {
    _.defer( function() {
        // _deferExpandTreeNodeArray contains nodes we want to expand. We
        // had to make these deferred calls to allow the tree to draw before
        // we asked it to expand a node.
        for ( var x = 0; x < _deferExpandTreeNodeArray.length; x++ ) {
            eventBus.publish( 'charLibraryDataProvider.expandTreeNode', {
                // ask tree to expand a node
                parentNode: _deferExpandTreeNodeArray[x]
            } );
        }
        _deferExpandTreeNodeArray = []; // clear out the global array
    } );
};

/**
 * Update selected nodes in context based on pin value
 * selected node set as new object if panel pinned is true
 * selected node set as current selection if panel pinned is false
 * @param {DeclViewModel} data
 */
export let selectNewlyAddedElement = function( data, subPanelContext ) {
    if( subPanelContext.searchState.newlyCreatedObjectFromCharLib ) {
        var dataprovider = data.dataProviders.charLibraryDataProvider;
        appCtxService.ctx.charLibmanagercontext = {};
        appCtxService.ctx.charLibmanagercontext.selectedNodes = [];

        appCtxService.updateCtx( 'charLibmanagercontext.selectedNodes', subPanelContext.searchState.newlyCreatedObjectFromCharLib );
        appCtxService.updateCtx( 'currentSelectedNodesForPinUnpin', subPanelContext.searchState.newlyCreatedObjectFromCharLib );
        appCtxService.updateCtx( 'selected',  subPanelContext.searchState.newlyCreatedObjectFromCharLib  );

        let newSelectionData = { ...subPanelContext.selectionModel.selectionData.getValue() };
        newSelectionData.selected = subPanelContext.searchState.newlyCreatedObjectFromCharLib;
        subPanelContext.selectionModel.selectionData.update( newSelectionData );
        let mSelectedNodes = [];
        mSelectedNodes.push( subPanelContext.searchState.newlyCreatedObjectFromCharLib );

        if( subPanelContext.searchState.newlyCreatedObjectFromCharLib.length > 0 ) {
            // in case of drag/drop select element after drop.
            // in case of multiple objects drop then find startIndex and endIndex to select.
            let objectTobeSelected = [];
            subPanelContext.searchState.newlyCreatedObjectFromCharLib.forEach( function( value ) {
                dataprovider.viewModelCollection.loadedVMObjects.findIndex( function( treeNode ) {
                    if( treeNode.uid === value.uid ) {
                        objectTobeSelected.push( treeNode );
                    }
                } );
            } );

            dataprovider.selectionModel.addToSelection( objectTobeSelected );
        } else {
            let  index = dataprovider.viewModelCollection.loadedVMObjects.findIndex( function( treeNode ) {
                return treeNode.uid === subPanelContext.searchState.newlyCreatedObjectFromCharLib.uid;
            } );

            dataprovider.changeObjectsSelection( index, index, true );
        }

        subPanelContext.selectionModel.setSelection( mSelectedNodes );


        if ( subPanelContext && !subPanelContext.panelPinned ) {
            appCtxService.ctx.charLibmanagercontext.selectedNodes = data.selectedNodes;
        } else {
            if ( appCtxService.ctx.selected ) {
                appCtxService.ctx.charLibmanagercontext.selectedNodes.push( appCtxService.ctx.selected );
            }
        }
        subPanelContext.searchState.newlyCreatedObjectFromCharLib = undefined;

        let searchData = { ...subPanelContext.searchState.value };
        searchData.newlyCreatedObjectFromCharLib = undefined;
        subPanelContext.searchState.update( { ...searchData } );
    }
};

/**
 * Returns the search criteria with vaild inputs for characteristics library sublocation.
 * It also populates the search filter information.
 */
export let getSearchCriteriaInputForCharLib = function( searchData ) {
    var searchCriteriaInput = {};

    if ( searchData && searchData.criteria ) {
        var criteria = searchData.criteria;
        // Populate the search criteria input
        searchCriteriaInput = {
            queryName: criteria.queryName,
            searchID: criteria.searchID,
            lastEndIndex: criteria.lastEndIndex,
            totalObjectsFoundReportedToClient: criteria.totalObjectsFoundReportedToClient,
            typeOfSearch: criteria.typeOfSearch,
            utcOffset: criteria.utcOffset,
            Type: appCtxService.ctx.currentTypeSelection.dbValue
        };
        // Add the 'name' key to the search createria only if a vaild search filter is present.
        if ( criteria.searchString && criteria.searchString.trim().length > 0 ) {
            searchCriteriaInput.Name = exports.getSearchFailureFilterBoxValue( criteria.searchString );
        }
    }
    return searchCriteriaInput;
};
/**
 *Returns the search filter string .wild character is returned if an empty string is passed.
 *
 * @param {Sting} filterString filter string
 * @returns {Sting}  filter string or wild character
 */
export let getSearchFailureFilterBoxValue = function( filterString ) {
    if ( filterString && filterString.trim() !== '' ) {
        return '*' + filterString + '*';
    }
    return '*';
};

/**
 * This method is clear the content of Map used to store the Char Groups and Its specifications
 */
export let clearMapOfCharGroupAndSpecification = function() {
    _mapOfCharGroupAndSpecification.clear();
};

// If user select group -> Add spec panel is open -> again deselect the same group
// then panel should be close. Here ctx.selectedNodes.length will be zero
let conditionToVerifyDeselectCurrentSelection = function() {
    let ctx = appCtxService.getCtx();
    return ctx.currentSelectedNodesForPinUnpin.length === 0;
};

// If user select group -> Add spec panel is open -> again select the another group using ctrl button
// Now two groups are selected then panel should be close. Here ctx.selectedNodes.length will be > 1
let conditionToVerifyMultipleObjectsSelection = function() {
    let ctx = appCtxService.getCtx();
    return ctx.currentSelectedNodesForPinUnpin.length > 1;
};

// Here charGroupUid is set when we open Add char spec panel
let isPrevSelectionSameAsCurrent = function( ) {
    let ctx = appCtxService.getCtx();
    return ctx.currentSelectedNodesForPinUnpin.length > 0 && ctx.charGroupUid !== ctx.currentSelectedNodesForPinUnpin[0].uid;
};

// To check selected type is of same or different type in case of SaveAs panel
let conditionToVerifyDifferentTypeOfSelection = function( ) {
    let ctx = appCtxService.getCtx();

    // Use case : Group is open -> Select any spec -> Open SaveAs panel
    // In this case ctx.currentSelectedNodesForPinUnpin[0].type is Qc0CharacteristicsGroup and commandId is the SaveAs panel id
    // In this panel should not be close.
    // If group is open then AWlocation is qualitycharacteristicsmanager

    if( ctx.currentSelectedNodesForPinUnpin[0].modelType.typeHierarchyArray.indexOf( 'Qc0CharacteristicsGroup' ) > -1 && isSaveAsPanel() &&
        ctx.locationContext['ActiveWorkspace:SubLocation'] !== 'qualitycharacteristicsmanager' ) {
        return true;
    }
    return  ctx.currentSelectedNodesForPinUnpin.length !== 1 || ctx.charSpecType !== ctx.currentSelectedNodesForPinUnpin[0].type;
};

let isSaveAsPanel = function( ) {
    let ctx = appCtxService.getCtx();
    if( ctx.activeToolsAndInfoCommand && ( ctx.activeToolsAndInfoCommand.commandId === 'Aqc0SaveAsAttributiveCharSpec' ||
            ctx.activeToolsAndInfoCommand.commandId === 'Aqc0SaveAsVariableCharSpec' ||
            ctx.activeToolsAndInfoCommand.commandId === 'Aqc0SaveAsVisualCharSpec' ) ) {
        return true;
    }
    return  false;
};

// Close the panel
export let closeSpecCreationPanel = function() {
    // Check cond for closing panel
    if( isPrevSelectionSameAsCurrent() || conditionToVerifyDeselectCurrentSelection() || conditionToVerifyMultipleObjectsSelection() ) {
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
    }
};

let closeSavaAsPaneWhenGroupIsOpen = function( subPanelContext ) {
    // Use case : Group is open -> Select any spec -> Open SaveAs panel -> Select deselect spec OR select multiple specs
    // then panel should be close
    let ctx = appCtxService.getCtx();
    return ctx.locationContext['ActiveWorkspace:SubLocation'] === 'qualitycharacteristicsmanager' && isSaveAsPanel() && subPanelContext.selectionData.selected.length !== 1;
};

let closeSavaAsPaneInTreeView = function(  ) {
    let ctx = appCtxService.getCtx();
    return ctx.locationContext['ActiveWorkspace:SubLocation'] === 'CharacteristicsLibrarySubLocation' && ctx.currentSelectedNodesForPinUnpin !== undefined && ( conditionToVerifyDeselectCurrentSelection()  || conditionToVerifyDifferentTypeOfSelection()  );
};


// Close the SavaAs panel
export let closeSaveAsPanel = function( subPanelContext ) {
    // Use case : SavaAs panel is open -> If user select any group then panel should be close.
    // SavaAs panel is open -> If user select different type of spec then panel should be close.
    if( closeSavaAsPaneWhenGroupIsOpen( subPanelContext ) ||  closeSavaAsPaneInTreeView() ) {
        // If group is open
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
    }
};


// Close the panel in list view
export let closePanelInListView = function( subPanelContext ) {
    let ctx = appCtxService.getCtx();

    // This condition for Add spec when group is open.
    if(  ctx.activeToolsAndInfoCommand !== undefined && ( ctx.activeToolsAndInfoCommand.commandId === 'Aqc0AddAttributiveCharSpec' || ctx.activeToolsAndInfoCommand.commandId === 'Aqc0AddVariableCharSpec' || ctx.activeToolsAndInfoCommand.commandId === 'Aqc0AddVisualCharSpec' ) ) {
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
    }

    // Use case : Group is open -> Select any spec -> Open SaveAs panel -> Select deselect spec OR Select multiple specs
    // then panel should be close
    if( closeSavaAsPaneWhenGroupIsOpen( subPanelContext ) )  {
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
    }
};


/**
 * Function to add newly created element in tree
 * @param {*} dataProvider
 * @param {*} treeLoadResult
 * @param {*} selectionModel
 * @param {*} pageContextNewlyCreatedObjectFromCharLib
 * @param {*} searchStateNewlyCreatedObjectFromCharLib
 * @param {*} declViewModel
 */
export let addNewlyCreatedElement = function( dataProvider, treeLoadResult, subPanelContext,  declViewModel ) {
    let ctx = appCtxService.getCtx();
    let selectionModel = subPanelContext.selectionModel;
    let revisedTargetObjectUID = ctx.revisedTargetObjectUID;
    let pageContextNewlyCreatedObjectFromCharLib;

    if( subPanelContext.pageContext && subPanelContext.pageContext.sublocationState && subPanelContext.pageContext.sublocationState.newlyCreatedObjectFromCharLib ) {
        pageContextNewlyCreatedObjectFromCharLib = subPanelContext.pageContext.sublocationState.newlyCreatedObjectFromCharLib;
    }

    let searchStateNewlyCreatedObjectFromCharLib = subPanelContext.searchState.newlyCreatedObjectFromCharLib;

    let newlyCreatedObjectFromCharLib = pageContextNewlyCreatedObjectFromCharLib !== undefined ? pageContextNewlyCreatedObjectFromCharLib : searchStateNewlyCreatedObjectFromCharLib;
    let loadedVMOs;
    if( treeLoadResult && treeLoadResult.parentNode && newlyCreatedObjectFromCharLib  ) {
        var modelObj;
        var vmNode;
        var nodeId;
        var type;
        var displayName;
        var iconURL;
        let selectedParentUid;
        let vmc = dataProvider.viewModelCollection;
        if( vmc ) {
            loadedVMOs = vmc.getLoadedViewModelObjects();
        }

        if( newlyCreatedObjectFromCharLib.length > 0 ) {
            newlyCreatedObjectFromCharLib.forEach( function( value ) {
                nodeId = value.uid;
                type = value.type;
                displayName = value.props.object_name.dbValues[ 0 ];
                iconURL = iconSvc.getTypeIconURL( type );
            } );

            let pageContextTargetObject;
            let searchStateTargetObject;
            if( subPanelContext.pageContext && subPanelContext.pageContext.sublocationState && subPanelContext.pageContext.sublocationState.targetObject ) {
                pageContextTargetObject = subPanelContext.pageContext.sublocationState.targetObject;
            }

            searchStateTargetObject = subPanelContext.searchState.targetObject;

            let newlyCreatedTargetObject = searchStateTargetObject !== undefined ? searchStateTargetObject : pageContextTargetObject;

            selectedParentUid = newlyCreatedTargetObject.uid;
        } else {
            nodeId = newlyCreatedObjectFromCharLib.uid;
            type = newlyCreatedObjectFromCharLib.type;
            displayName = newlyCreatedObjectFromCharLib.props.object_name.dbValues[ 0 ];
            iconURL = iconSvc.getTypeIconURL( type );
        }


        if( selectionModel.selectionData.selected && selectionModel.selectionData.selected.length > 0 ) {
            if( selectedParentUid === undefined ) {
                selectedParentUid = ctx.charLibmanagercontext.parentElement.dbValues[0];
            }

            if( newlyCreatedObjectFromCharLib.type === 'Qc0VariableCharSpec' || newlyCreatedObjectFromCharLib.type ===  'Qc0AttributiveCharSpec' || newlyCreatedObjectFromCharLib.type ===  'Qc0VisualCharSpec' ) {
                selectedParentUid = newlyCreatedObjectFromCharLib.props.qc0GroupReference.dbValues[0];
            }


            let vmoId = vmc.findViewModelObjectById( selectedParentUid );
            let parentVMO = dataProvider.topTreeNode;
            if( vmoId > -1 ) {
                parentVMO = loadedVMOs[ vmoId ];
            }

            parentVMO.isLeaf = false;

            let parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
                return vmo.uid === selectedParentUid;
            } );


            if( parentVMO.isExpanded ) {
                vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, parentVMO.levelNdx + 1, 0, iconURL );
                modelObj =  cdm.getObject( vmNode.uid );
                vmNode.isLeaf = true;
                vmNode.modelType = modelObj.modelType;
                vmNode.props = {};

                let object_name = uwPropertySvc.createViewModelProperty( 'object_name', 'object_name', 'STRING', 'object_name' );
                vmNode.props.object_name = object_name;
                vmNode.props.object_name.parentUid = nodeId;

                var idx = parentIdx;

                // in case of revised, replace target object with reviseded Object
                if( revisedTargetObjectUID ) {
                    appCtxService.updateCtx( 'revisedTargetObjectUID', undefined );
                    var reviedObjectIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
                        return vmo.uid === revisedTargetObjectUID;
                    } );

                    loadedVMOs[reviedObjectIdx] = vmNode;
                } else {
                    // Add newly created object.
                    loadedVMOs.splice( ++idx, 0, vmNode );
                }

                dataProvider.update( loadedVMOs );
            }
        } else if( newlyCreatedObjectFromCharLib.type === 'Qc0CharacteristicsGroup' ) {
            vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, 0, 0, iconURL );
            modelObj =  cdm.getObject( vmNode.uid );
            vmNode.isLeaf = true;
            vmNode.modelType = modelObj.modelType;
            vmNode.props = {};

            let object_name = uwPropertySvc.createViewModelProperty( 'object_name', 'object_name', 'STRING', 'object_name' );
            vmNode.props.object_name = object_name;
            vmNode.props.object_name.parentUid = nodeId;

            let vmc = dataProvider.viewModelCollection;

            if( vmc ) {
                loadedVMOs = vmc.getLoadedViewModelObjects();
            }

            loadedVMOs.splice( 0, 0, vmNode );
            dataProvider.update( loadedVMOs );
        }
    }
};

/**
 * Update tree node state in case of adding element in tree.
 * @param {*} vmNodes
 * @param {*} declViewModel
 * @param {*} subPanelContext
 * @param {*} i18n
 * @param {*} dataProvider
 */
export let updateTreeNodeStates = function( vmNodes, declViewModel, subPanelContext ) {
    // For now we will use id of the grid that is first in the list of grids in the view model.
    // Once we get this value in treeLoadInput we will shift to using it.
    var gridId = Object.keys( declViewModel.grids )[ 0 ];

    var pageContextNewlyCreatedObjectFromCharLib;
    var searchStateNewlyCreatedObjectFromCharLib;

    if ( subPanelContext.pageContext && subPanelContext.pageContext.sublocationState ) {
        pageContextNewlyCreatedObjectFromCharLib = subPanelContext.pageContext.sublocationState.newlyCreatedObjectFromCharLib;
    }
    if ( subPanelContext.searchState ) {
        searchStateNewlyCreatedObjectFromCharLib = subPanelContext.searchState.newlyCreatedObjectFromCharLib;
    }


    var newlyCreatedObjectFromCharLib = pageContextNewlyCreatedObjectFromCharLib !== undefined ? pageContextNewlyCreatedObjectFromCharLib : searchStateNewlyCreatedObjectFromCharLib;

    var parentNodeUid;

    // In case of drag/drop , user can drag/drop multiple specs
    if( newlyCreatedObjectFromCharLib.length > 0 && newlyCreatedObjectFromCharLib[0].type !== 'Qc0CharacteristicsGroup' && newlyCreatedObjectFromCharLib[0].modelType.typeHierarchyArray.indexOf( 'Qc0MasterCharSpec' ) > -1 ) {
        parentNodeUid = newlyCreatedObjectFromCharLib[0].props.qc0GroupReference.dbValues[0];
    } else if ( newlyCreatedObjectFromCharLib.type !== 'Qc0CharacteristicsGroup' && newlyCreatedObjectFromCharLib.modelType.typeHierarchyArray.indexOf( 'Qc0MasterCharSpec' ) > -1 ) {
        parentNodeUid  = newlyCreatedObjectFromCharLib.props.qc0GroupReference.dbValues[0];
    }
    if( parentNodeUid ) {
        _.findLastIndex( vmNodes, function( vmo ) {
            if( vmo.uid === parentNodeUid ) {
                var isExpanded = vmo.isExpanded;
                vmo.isExpanded = true;

                if( isExpanded ) {
                    awTableStateService.saveRowCollapsed( declViewModel, gridId, vmo );
                    awTableStateService.saveRowExpanded( declViewModel, gridId, vmo );
                } else{
                    eventBus.publish( 'cdm.relatedModified', {
                        relatedModified: [
                            viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( vmo.uid ), 'EDIT' )
                        ]
                    } );

                    vmo.isInExpandBelowMode = false;
                    if( !vmo.cursorObject ) {
                        vmo.cursorObject = {};
                        vmo.cursorObject.endIndex = 0;
                        vmo.cursorObject.endReached = true;
                        vmo.cursorObject.startIndex = 0;
                        vmo.cursorObject.startReached = true;
                    }
                    eventBus.publish( gridId + '.plTable.toggleTreeNode', vmo );
                    if( vmo.isLeaf &&  !subPanelContext.searchState.pinUnpinnedFlag ) {
                        eventBus.publish( 'aqc0.loadData' );
                    }
                }
            }
        } );
    } else{
        if( !subPanelContext.searchState.pinUnpinnedFlag ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }else {
            var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( newlyCreatedObjectFromCharLib.uid ), 'EDIT' );
            eventBus.publish( gridId + '.plTable.clientRefresh', vmo );
        }
    }
};

/**
 * Update tree node state in case of drag/drop element in tree.
 * @param {*} vmNodes
 * @param {*} declViewModel
 * @param {*} subPanelContext
 * @param {*} i18n
 * @param {*} dataProvider
 */
export let updateDraDropNodes = function( sourceObjects, selectedParentUids, targetObject,  charLibraryDataProvider, subPanelContext ) {
    var loadedVMOs = charLibraryDataProvider.viewModelCollection.getLoadedViewModelObjects();
    var sourceObjectVMOs = [];

    sourceObjects.forEach( function( value ) {
        let sourceObjectIndex = charLibraryDataProvider.viewModelCollection.loadedVMObjects.findIndex( function( treeNode ) {
            return treeNode.uid === value.uid;
        } );
        if( sourceObjectIndex > -1 ) {
            sourceObjectVMOs.push( loadedVMOs[sourceObjectIndex] );
        }
    } );


    // Remove drag elements from loadedVMs
    sourceObjectVMOs.forEach( function( value ) {
        let sourceObjectIndex = charLibraryDataProvider.viewModelCollection.loadedVMObjects.findIndex( function( treeNode ) {
            return treeNode.uid === value.uid;
        } );

        if( sourceObjectIndex > -1 ) {
            loadedVMOs.splice( sourceObjectIndex, 1 );
            charLibraryDataProvider.update( loadedVMOs );
        }
    } );

    // Remove drag specs from groups
    selectedParentUids.forEach( function( selectedParentUid ) {
        let selectedParentIndex = charLibraryDataProvider.viewModelCollection.loadedVMObjects.findIndex( function( treeNode ) {
            return treeNode.uid === selectedParentUid;
        } );

        // If all specs form group are draged then group will be empty
        // Setting isLeaf as true
        if(  selectedParentIndex > -1 && loadedVMOs[selectedParentIndex].children ) {
            sourceObjects.forEach( function( value ) {
                let specificationIndex = loadedVMOs[selectedParentIndex].children.findIndex( function( specifications ) {
                    return specifications.uid === value.uid;
                } );

                if( specificationIndex > -1 ) {
                    loadedVMOs[selectedParentIndex].children.splice( specificationIndex, 1 );

                    // After removing all childs then set isLeaf as true
                    if( loadedVMOs[selectedParentIndex].children.length === 0 ) {
                        loadedVMOs[selectedParentIndex].isLeaf = true;
                    }
                }
            } );
        }
        charLibraryDataProvider.update( loadedVMOs );
    } );


    let targetObjectIndex = charLibraryDataProvider.viewModelCollection.loadedVMObjects.findIndex( function( treeNode ) {
        return treeNode.uid === targetObject.uid;
    } );

    var index = targetObjectIndex;
    targetObject.isLeaf = false;
    if( targetObject.isExpanded  ) {
        sourceObjectVMOs.forEach( function( value ) {
            // Add dropped specifications into group created object.
            if( !loadedVMOs[targetObjectIndex].children ) {
                loadedVMOs[targetObjectIndex].children = [];
            }
            loadedVMOs[targetObjectIndex].children.push( value );
            loadedVMOs.splice( ++index, 0, value );
        } );

        charLibraryDataProvider.update( loadedVMOs );
    } else{
        sourceObjects.forEach( function( value ) {
            let sourceObjectIndex = charLibraryDataProvider.viewModelCollection.loadedVMObjects.findIndex( function( treeNode ) {
                if( treeNode.uid === value.uid ) {
                    sourceObjectVMOs.push( treeNode );
                }
                return treeNode.uid === value.uid;
            } );
        } );

        let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
        if( searchState ) {
            let searchData = { ...searchState.value };
            searchData.newlyCreatedObjectFromCharLib = sourceObjectVMOs;
            searchData.targetObject = targetObject;
            searchState.update( { ...searchData } );
        }
    }
};


export default exports = {
    addNewlyCreatedElement,
    charLibraryExpandTreeNode,
    clearMapOfCharGroupAndSpecification,
    closeSaveAsPanel,
    closeSpecCreationPanel,
    closePanelInListView,
    createVmNodeUsingNewObjectInfo,
    getSearchCriteriaInputForCharLib,
    getSearchFailureFilterBoxValue,
    loadTreeTableColumns,
    loadObjects,
    loadTreeTableData,
    loadTreeTableProperties,
    processPWASelection,
    selectionChanged,
    selectionChangedForListWithSummary,
    selectNewlyAddedElement,
    updateDraDropNodes,
    updateTreeNodeStates
};
