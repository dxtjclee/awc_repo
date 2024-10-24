// Copyright (c) 2022 Siemens

/**
 * @module js/qa0AuditChecklistTreeService
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
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import dms from 'soa/dataManagementService';
import colorDecoratorService from 'js/colorDecoratorService';
import prgScheduleMgrConstants from 'js/ProgramScheduleManagerConstants';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

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

var _dummyFindingNodeType = 'DummyFindingsNode';

var exports = {};

/**
  * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
  */
function _getTreeTableColumnInfos( data ) {
    if ( !_treeTableColumnInfos ) {
        _treeTableColumnInfos = _buildTreeTableColumnInfos( data );
    }

    return _treeTableColumnInfos;
}

/**
  * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
  */
function _buildTreeTableColumnInfos( data ) {
    /**
      * Set 1st column to special 'name' column to support tree-table.
      */

    var awColumnInfos = [];
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_name',
        propertyName: 'object_name',
        displayName: data.qa0TreeColumnName.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );
    return awColumnInfos;
}

/**
  * @param {AwTableColumnInfoArray} columnInfos - Array of column information objects to use when building the
  *            table rows.
  * @param {ViewModelTreeNode} parentNode - A node that acts 'parent' of a hierarchy of 'child'
  *            ViewModelTreeNodes.
  * @param {Number} nChildren - The # of child nodes to add to the given 'parent'.
  * @param {Boolean} isLoadAllEnabled - TRUE if all properties should be included.
  */
function _buildTreeTableStructure( columnInfos, parentNode, nChildren, isLoadAllEnabled, hasRelation ) {
    var children = [];

    _mapNodeId2ChildArray[parentNode.id] = children;

    var levelNdx = parentNode.levelNdx + 1;

    for ( var childNdx = 1; childNdx <= nChildren.length; childNdx++ ) {
        /**
          * Create a new node for this level. and Create props for it
          */
        var vmNode = exports.createVmNodeUsingNewObjectInfo( nChildren[childNdx - 1], levelNdx, childNdx, isLoadAllEnabled, hasRelation );
        /**
          * Add it to the 'parent' based on its ID
          */
        children.push( vmNode );
    }

    var filteredChildren = _.filter( children, function( vmNode ) { return vmNode.type !== 'DummyFindingsNode' && vmNode.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1; } );
    if( filteredChildren && filteredChildren.length > 0 ) {
        exports.setDecoratorStyles( filteredChildren );
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

            _populateColumns( true, childNode );

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
 * @returns {String} the opened object UID
 */
function _getOpenedObjectUid() {
    var openedObjectUid = '';
    var stateSvc = AwStateService.instance;
    if( stateSvc && stateSvc.params ) {
        var params = stateSvc.params;
        openedObjectUid = params.uid;
    }
    return openedObjectUid;
}


function _sortChildren( children, sortCriteria ) {
    var sortedChildren = children;
    if( sortCriteria && sortCriteria.length > 0 && children && children.length > 0 ) {
        var criteria = sortCriteria[0];
        if( criteria.fieldName && criteria.sortDirection ) {
            if( criteria.sortDirection === 'ASC' ) {
                sortedChildren = children.sort( ( a, b ) =>  a.props.object_name.uiValues[0] > b.props.object_name.uiValues[0] ? 1 : -1  );
            } else if( criteria.sortDirection === 'DESC' ) {
                sortedChildren = children.sort( ( a, b ) =>  a.props.object_name.uiValues[0] > b.props.object_name.uiValues[0] ? -1 : 1  );
            }
        }
    }

    return sortedChildren;
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
function _loadTreeTableRows( deferred, treeLoadInput ) {
    /**
      * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
      */
    var parentNode = treeLoadInput.parentNode;
    var targetNode = parentNode;

    if ( !parentNode.isLeaf ) {
        var policyJson = {
            types: [
                {
                    name: 'Qa0QualityAudit'
                },
                {
                    name: 'Apm0QualityChecklist',
                    properties: [
                        {
                            name: 'apm0QualityChecklistList'
                        },
                        {
                            name: 'apm0ParentChecklist'
                        },
                        {
                            name: 'object_desc'
                        }
                    ]
                },
                {
                    name: 'Awp0XRTObjectSetRow',
                    properties: [
                        {
                            name: 'awp0Target'
                        }
                    ]
                }
            ]
        };
        var selectedUID = _getOpenedObjectUid();
        var soaInput = {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: ''
            },
            searchInput: {
                attributesToInflate: [],
                maxToLoad: 110,
                maxToReturn: 110,
                providerName: 'Awp0ObjectSetRowProvider',
                searchCriteria: {
                    objectSet: 'Qa0QualityAuditChecklists.Apm0QualityChecklist',
                    parentUid: selectedUID,
                    returnTargetObjs: 'true'
                },
                searchFilterFieldSortType: 'Alphabetical',
                searchFilterMap6: {},
                searchSortCriteria: treeLoadInput.sortCriteria,
                startIndex: treeLoadInput.startChildNdx
            },
            inflateProperties: false,
            noServiceData: false
        };
        var soaInput2 = {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: ''
            },
            searchInput: {
                attributesToInflate: [],
                maxToLoad: 110,
                maxToReturn: 110,
                providerName: 'Awp0ReferencesProvider',
                searchCriteria: {
                    parentUid: selectedUID
                },
                searchFilterFieldSortType: 'Alphabetical',
                searchFilterMap6: {},
                searchSortCriteria: treeLoadInput.sortCriteria,
                startIndex: treeLoadInput.startChildNdx
            },
            inflateProperties: false,
            noServiceData: false
        };

        if ( parentNode.levelNdx < 0 ) {
            var isLoadAllEnabled = true;
            var children = [];


            // Add Quality Audit object in the root
            var rootNode = cdm.getObject( selectedUID );
            //children.push( viewModelObjForExternalEleNode );
            children.push( rootNode );

            var isLoadAllEnabled = true;
            var policyId = propertyPolicySvc.register( policyJson );

            // Load all checklists and findings
            loadAuditTreeData( soaInput, soaInput2, policyId )
                .then( results => {
                    var checklistData = results[0];
                    var checklists = checklistData.checklists;
                    var findings = results[1].findings;
                    var endReached = checklistData.endReached;
                    var startReached = checklistData.startReached;
                    var hasRelation = Boolean( findings.length > 0 || checklists.length > 0 );
                    var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, startReached, endReached, hasRelation );
                    deferred.resolve( {
                        treeLoadResult: treeLoadResult
                    } );
                } );
        } else if ( parentNode.levelNdx === 0 ) {
            var isLoadAllEnabled = true;
            var children = [];
            var policyId = propertyPolicySvc.register( policyJson );
            // Load all checklists and findings
            loadAuditTreeData( soaInput, soaInput2, policyId )
                .then( results => {
                    var checklistData = results[0];
                    var checklists = checklistData.checklists;
                    var findings = results[1].findings;
                    if ( findings.length > 0 ) {
                        children.push( getFindingsNode() );
                    }
                    children.push( ...checklists );
                    var endReached = checklistData.endReached;
                    var startReached = checklistData.startReached;
                    var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, startReached, endReached, findings.length > 0 );
                    deferred.resolve( {
                        treeLoadResult: treeLoadResult
                    } );
                } );
        } else if ( parentNode.levelNdx < _maxTreeLevel ) {
            var isLoadAllEnabled = true;
            var children = [];

            if( parentNode.uid !== 'extFindingsAudit' ) {
                dms.getProperties( parentNode.props.apm0QualityChecklistList.dbValues, [ 'apm0QualityChecklistList', 'apm0ParentChecklist' ] )
                    .then(
                        function() {
                            if ( parentNode.props.apm0QualityChecklistList ) {
                                for ( var x = 0; x < parentNode.props.apm0QualityChecklistList.dbValues.length; ++x ) {
                                    var uid = parentNode.props.apm0QualityChecklistList.dbValues[x];
                                    var obj = cdm.getObject( uid );
                                    if ( obj ) {
                                        children.push( obj );
                                    }
                                }
                            }

                            //sort children based on sort criteria
                            children = _sortChildren( children, treeLoadInput.sortCriteria );

                            if ( parentNode.props.apm0QualityChecklistList.dbValues.length === 0 ) {
                                parentNode.isLeaf = true;
                                var endReached = true;
                                var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, true,
                                    endReached, null );
                                deferred.resolve( {
                                    treeLoadResult: treeLoadResult
                                } );
                            } else {
                                var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, false, false );
                                deferred.resolve( {
                                    treeLoadResult: treeLoadResult
                                } );
                            }
                        }
                    );
            } else {
                loadFindings( soaInput2 ).then( findingData =>{
                    var findings = findingData.findings;
                    var endReached = findingData.endReached;
                    var startReached = findingData.startReached;
                    children.push( ...findings );
                    var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, startReached, endReached, findings.length > 0 );
                    deferred.resolve( {
                        treeLoadResult: treeLoadResult
                    } );
                } );
            }
        } else {
            parentNode.isLeaf = true;
            var mockChildNodes = _mapNodeId2ChildArray[parentNode.id];
            var mockChildNodesLen = mockChildNodes ? mockChildNodes.length : 0;
            var endReached = parentNode.startChildNdx + treeLoadInput.pageSize > mockChildNodesLen;
            var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, false, true,
                endReached, null );
            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
        }
    }
}

/**
 *
 * @param {soaInput} soaInput input for checklists
 * @param {soaInput2} soaInput2 input for findings
 * @param {policyId} policyId policyId for checklists
 */
async function loadAuditTreeData( soaInput, soaInput2, policyId ) {
    // Start 2 "jobs" in parallel and wait for both of them to complete
    return await Promise.all( [
        ( async()=>await loadChecklists( soaInput, policyId ) )(),
        ( async()=>await loadFindings( soaInput2 ) )()
    ] );
}

/**
 * Loads checklists and returns a promise
 * @param {soaInput} soaInput input for checklists
 * @param {policyId} policyId policyId for checklists
 * @returns {Promise}
 */
function loadChecklists( soaInput, policyId ) {
    var checklists = [];
    return new Promise( resolve => {
        // Load all checklists
        return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
            function( response ) {
                if ( policyId ) {
                    propertyPolicySvc.unregister( policyId );
                }
                if ( response.searchResultsJSON ) {
                    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                    if ( searchResults ) {
                        for ( var x = 0; x < searchResults.objects.length; ++x ) {
                            var uid = searchResults.objects[x].uid;
                            var obj = cdm.getObject( uid );
                            if ( obj ) {
                                checklists.push( obj );
                            }
                        }
                    }
                }
                resolve( {
                    checklists: checklists,
                    startReached: response.cursor.startReached,
                    endReached: response.cursor.endReached
                } );
            } );
    } );
}

/**
 *
 * @param {soaInput2} soaInput2 input for Findings
 * @param {policyId} policyId policyId for findings
 * @returns Promise
 */
function loadFindings( soaInput2 ) {
    var findings = [];
    return new Promise( resolve => {
        return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput2 ).then(
            function( response ) {
                if ( response.searchResultsJSON ) {
                    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                    if ( searchResults ) {
                        for ( var x = 0; x < searchResults.objects.length; ++x ) {
                            var uid = searchResults.objects[x].uid;
                            var object = response.ServiceData.modelObjects[uid];
                            if ( object ) {
                                // filter findings..
                                if( object.type === 'C2IssueRevision' ) {
                                    findings.push( object );
                                }
                            }
                        }
                        if( findings.length > 0 ) {
                            findings.sort( ( a, b ) => {
                                var date1 = new Date( a.props.creation_date.dbValues[0] ).getTime();
                                var date2 = new Date( b.props.creation_date.dbValues[0] ).getTime();
                                if( date1 < date2 ) { return -1; }
                                if( date1 > date2 ) { return 1; }
                                return 0;
                            } );
                        }
                    }
                }

                resolve( {
                    findings: findings,
                    startReached: response.cursor.startReached,
                    endReached: response.cursor.endReached
                } );
            } );
    } );
}

/**
 * Creates a static node
 * @returns static node for showing findings in the tree
 */
function getFindingsNode( ) {
    // Add new node for External Function and External Failure if required
    var nodeName = 'Findings';
    return {
        uid: 'extFindingsAudit',
        type: _dummyFindingNodeType,
        props:{
            object_name: {
                dbValues:[ nodeName ],
                uiValues:[ nodeName ]
            }
        }
    };
}

/**
  *
  * @param {parentNode} parentNode -
  * @param {children} children -
  * @param {isLoadAllEnabled} isLoadAllEnabled -
  * @param {treeLoadInput} treeLoadInput -
  * @return {awTableSvc.buildTreeLoadResult} awTableSvc.buildTreeLoadResult -
  *
  **/
function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, startReached, endReached, hasRelation ) {
    _buildTreeTableStructure( _getTreeTableColumnInfos(), parentNode, children, isLoadAllEnabled, hasRelation );
    if ( parentNode.children !== undefined && parentNode.children !== null ) {
        var mockChildNodes = parentNode.children.concat( _mapNodeId2ChildArray[parentNode.id] );
    } else {
        var mockChildNodes = _mapNodeId2ChildArray[parentNode.id];
    }
    var mockChildNodesLen = mockChildNodes ? mockChildNodes.length : 0;
    var endReached = parentNode.startChildNdx + treeLoadInput.pageSize > mockChildNodesLen;
    var tempCursorObject = {
        endReached: endReached,
        startReached: startReached
    };

    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, false, startReached,
        endReached );
    treeLoadResult.parentNode.cursorObject = tempCursorObject;
    return treeLoadResult;
}

/**
  * @param {ObjectArray} columnInfos -
  * @param {Boolean} isLoadAllEnabled -
  * @param {ViewModelTreeNode} vmNode -
  * @param {Number} childNdx -
  */
function _populateColumns( isLoadAllEnabled, vmNode ) {
    if ( isLoadAllEnabled ) {
        if ( !vmNode.props ) {
            vmNode.props = {};
        }

        var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
            .getObject( vmNode.uid ), 'EDIT' );

        tcViewModelObjectService.mergeObjects( vmNode, vmo );
    }
}

/**
  * function to evaluate if an object contains children
  * @param {objectType} objectType object type
  * @return {boolean} if node contains child
  */
function _containChildren( props, hasRelation, vmNode ) {
    var containChild = false;
    if( vmNode ) {
        if ( vmNode.modelType && vmNode.modelType.typeHierarchyArray && vmNode.modelType.typeHierarchyArray.indexOf( 'Apm0QualityChecklist' ) > -1 && props.apm0QualityChecklistList.dbValues.length > 0  ) {
            vmNode.isLeaf = containChild;
        } else if ( vmNode.modelType && vmNode.modelType.typeHierarchyArray && vmNode.modelType.typeHierarchyArray.indexOf( 'Qa0QualityAudit' ) > -1 && hasRelation ) {
            vmNode.isLeaf = false;
        } else if ( vmNode.id === 'extFindingsAudit' && hasRelation ) {
            vmNode.isLeaf = false;
        } else {
            vmNode.isLeaf = !containChild;
        }
    }
}

export let createVmNodeUsingNewObjectInfo = function( modelObject, levelNdx, childNdx, isLoadAllEnabled, hasRelation ) {
    var nodeId = modelObject.uid;
    var type = modelObject.type;
    var displayName = modelObject.props.object_name.uiValues[0];
    var iconURL;
    iconURL = iconSvc.getTypeIconURL( type );
    if( nodeId === 'extFindingsAudit' ) {
        iconURL = iconSvc.getTypeIconURL( 'Folder' );
    }

    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, levelNdx, childNdx, iconURL );
    vmNode.modelType = modelObject.modelType;

    !_containChildren( modelObject.props, hasRelation, vmNode );

    vmNode.selected = true;

    _populateColumns( isLoadAllEnabled, vmNode );
    return vmNode;
};

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @return {columns} An object that contain array of column objects.
 *
 */
export let loadTreeTableColumns = function( uwDataProvider, data ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = _getTreeTableColumnInfos( data );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );
    return deferred.promise;
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
    treeLoadInput.sortCriteria = arguments[4];
    appCtxService.updateCtx( 'treeVMO', arguments[3] );

    /**
      * Extract action parameters from the arguments to this function.
      * <P>
      * Note: The order or existence of parameters can varey when more-than-one property is specified in the
      * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
      */
    var delayTimeTree = 0;

    for ( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ndx];

        if( arg ) {
            if ( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeTree' ) {
                delayTimeTree = arg.dbValue;
            } else if ( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'maxTreeLevel' ) {
                _maxTreeLevel = arg.dbValue;
            }
        }
    }

    /**
      * Check the validity of the parameters
      */
    var deferred = AwPromiseService.instance.defer();


    /**
      * Load the 'child' nodes for the 'parent' node.
      */
    if ( delayTimeTree > 0 ) {
        _.delay( _loadTreeTableRows, delayTimeTree, deferred, treeLoadInput );
    } else {
        _loadTreeTableRows( deferred, treeLoadInput );
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

    for ( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ndx];

        if( arg ) {
            if ( awTableSvc.isPropertyLoadInput( arg ) ) {
                propertyLoadInput = arg;
            } else if ( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeProperty' ) {
                delayTimeProperty = arg.dbValue;
            }
        }
    }

    var deferred = AwPromiseService.instance.defer();

    /**
      * Load the 'child' nodes for the 'parent' node.
      */
    if ( delayTimeProperty > 0 ) {
        _.delay( _loadProperties, delayTimeProperty, deferred, propertyLoadInput );
    } else {
        if ( propertyLoadInput ) {
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
export let processPWASelection = function( data, selectionModel ) {
    var selectedModelObject = appCtxService.ctx.qualityAuditContext.selectedNodes;
    var viewModelCollection = data.dataProviders.auditTreeDataProvider.viewModelCollection;
    if ( selectedModelObject && selectedModelObject.length > 0 ) {
        _.forEach( selectedModelObject, function( selectedObject ) {
            if ( viewModelCollection.loadedVMObjects.length > 0 ) {
                selectionModel.setSelection( selectedObject );
                var parentIdx = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
                    return vmo.uid === selectedObject.props.qc0ParentChecklistSpec.dbValues[0];
                } );
                if ( parentIdx > -1 ) {
                    var parentVMO = viewModelCollection.getViewModelObject( parentIdx );
                    addNodeToExpansionState( parentVMO, data );
                }
            }
        } );
    } else if ( !selectedModelObject || selectedModelObject && selectedModelObject.length === 0 ) {
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
    var gridId = Object.keys( declViewModel.grids )[0];
    awTableStateService.saveRowExpanded( declViewModel, gridId, node );
};

export let updateFindings = function( eventData, auditTreeDataProvider ) {
    if( eventData && eventData.createChangeData ) {
        var changeObject = eventData.createChangeData;
        // insert the new treeNode in the viewModelCollection at the correct location
        var viewModelCollection = auditTreeDataProvider.viewModelCollection;
        var findings = viewModelCollection.loadedVMObjects.filter( item => item.type === 'C2IssueRevision' );
        if( findings.length === 0 ) {
            var auditVMO = viewModelCollection.loadedVMObjects[0];
            auditVMO.isLeaf = false;
            auditVMO.isExpanded = true;
            let findingsFolderNode = exports.createVmNodeUsingNewObjectInfo( getFindingsNode(), 1, 0, true, true );
            findingsFolderNode.isExpanded = true;
            viewModelCollection.loadedVMObjects.splice( 1, 0, findingsFolderNode );
        }
        let findingNode = exports.createVmNodeUsingNewObjectInfo( changeObject, 2, 1, true, true );
        // insert newly created node at the end (sortby creation date)
        viewModelCollection.loadedVMObjects.splice( 2 + findings.length, 0, findingNode );
        auditTreeDataProvider.update( viewModelCollection.loadedVMObjects );
    }
};

export let removeFindingsFromTree = function( eventData, auditTreeDataProvider ) {
    if( eventData && eventData.removedFindings && eventData.removedFindings.length > 0 ) {
        var removedFindings = eventData.removedFindings;
        var modelObjects = auditTreeDataProvider.viewModelCollection.loadedVMObjects;
        if( modelObjects && !_.isEmpty( modelObjects ) ) {
            // filterout all removed findings from the viewmodel collection
            var totalFindings = modelObjects.filter( item => item.type === 'C2IssueRevision' ).length;

            var remainingObjects = modelObjects.filter( function( node ) { return !removedFindings.some( finding => finding.uid === node.uid && finding.type === node.type ); } );
            if( totalFindings === removedFindings.length ) {
                remainingObjects = remainingObjects.filter( obj => obj.type !== _dummyFindingNodeType );
            }
            auditTreeDataProvider.viewModelCollection.loadedVMObjects = remainingObjects;
            auditTreeDataProvider.update( remainingObjects, remainingObjects.length );
        }
    }
};

var setRYGDecorators = function( objectsToDecorate ) {
    _.forEach( objectsToDecorate, function( objInArr ) {
        var rygValue = objInArr.rygObject.props.apm0Rating.dbValues[ 0 ];
        if( rygValue ) {
            var rygDecoratorMap = prgScheduleMgrConstants.RYG_DECORATOR_STYLE;
            if( rygDecoratorMap && rygDecoratorMap[ rygValue ].cellDecoratorStyle ) {
                objInArr.viewModelTreeNode.cellDecoratorStyle = rygDecoratorMap[ rygValue ].cellDecoratorStyle;
            }
            if( rygDecoratorMap && rygDecoratorMap[ rygValue ].gridDecoratorStyle ) {
                objInArr.viewModelTreeNode.gridDecoratorStyle = rygDecoratorMap[ rygValue ].gridDecoratorStyle;
            }
        } else {
            objInArr.viewModelTreeNode.cellDecoratorStyle = '';
            objInArr.viewModelTreeNode.gridDecoratorStyle = '';
        }
    } );
};

var rygObjectFilter = function( obj ) {
    return obj.modelType.typeHierarchyArray.indexOf( 'Apm0RYG' ) > -1 && !( obj.props && obj.props.hasOwnProperty( 'apm0RatedObject' ) && obj.props.hasOwnProperty( 'apm0Rating' ) );
};

var setDecoratorStylesInner = function( vmos, rygObjects ) {
    var objectsToDecorate = [];
    _.forEach( vmos, function( mod ) {
        var rygObject;
        var vmto;
        if( mod.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 ) {
            let rygtag = mod.props.apm0RatedReference.dbValues[0];
            rygObject = rygObjects.find( obj=> obj.uid === rygtag );
            vmto = mod;
        }
        if( rygObject && vmto ) {
            objectsToDecorate.push( {
                rygObject: rygObject,
                viewModelTreeNode: vmto
            } );
        }
    } );
    if( objectsToDecorate && objectsToDecorate.length > 0 ) {
        setRYGDecorators( objectsToDecorate );
        colorDecoratorService.setDecoratorStyles( objectsToDecorate.map( obj => obj.viewModelTreeNode ) );
    }
};

/**
 * Method to set Grid and Cell Decorator style to vmo
 * @param {ViewModelObject} vmos - Array of tree nodes of quality audit tree
 */
export let setDecoratorStyles = function( vmos ) {
    if( vmos && vmos.length > 0 ) {
        var rygObjectTags = vmos.map( obj => obj.props.apm0RatedReference.dbValues[0] );
        var rygObjects = cdm.getObjects( rygObjectTags );
        var rygObjectsWOProps = rygObjects.filter( rygObjectFilter );

        if( rygObjectsWOProps && rygObjectsWOProps.length > 0 ) {
            dms.getProperties( rygObjectsWOProps.map( obj=> obj.uid ), [ 'apm0RatedObject', 'apm0Rating' ] ).then( () => setDecoratorStylesInner( vmos, rygObjects ) );
        } else {
            setDecoratorStylesInner( vmos, rygObjects );
        }
    }
};

var setDecoratorStylesOnModifiedObjectsInner = function( filteredVmos, modifiedObjects ) {
    var objectsToDecorate = [];
    _.forEach( modifiedObjects, function( mod ) {
        var rygObject;
        var vmto;
        if( mod.modelType.typeHierarchyArray.indexOf( 'Apm0RYG' ) > -1 ) {
            rygObject = mod;
            vmto = filteredVmos.find( obj => obj.uid === mod.props.apm0RatedObject.dbValues[0] );
        } else if( mod.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 ) {
            rygObject = cdm.getObject( mod.props.apm0RatedReference.dbValues[0] );
            vmto = filteredVmos.find( vmo => vmo.uid === mod.uid );
        }
        if( rygObject && vmto ) {
            objectsToDecorate.push( {
                rygObject: rygObject,
                viewModelTreeNode: vmto
            } );
        }
    } );

    if( objectsToDecorate && objectsToDecorate.length > 0 ) {
        setRYGDecorators( objectsToDecorate );
        colorDecoratorService.setDecoratorStyles( objectsToDecorate.map( obj => obj.viewModelTreeNode ) );
    }
};

/**
 * Method to set Grid and Cell Decorator style to vmo which are modified
 * @param {ViewModelObject} vmos - Array of tree nodes of quality audit tree
 * @param {ViewModelObject} clearStyles - Array of tree nodes which are modified and need to update the style
 */
export let setDecoratorStylesOnModifiedObjects = function( vmos, modifiedObjects ) {
    vmos = vmos.filter( vmo => vmo.modelType.typeHierarchyArray.indexOf( 'Awp0XRTObjectSetRow' ) === -1 );
    var rygObjects = modifiedObjects ? modifiedObjects.filter( rygObjectFilter ) : null;

    if( rygObjects && rygObjects.length > 0 ) {
        dms.getProperties( rygObjects.map( obj=> obj.uid ), [ 'apm0RatedObject', 'apm0Rating' ] ).then( () => setDecoratorStylesOnModifiedObjectsInner( vmos, modifiedObjects ) );
    } else if( modifiedObjects && Array.isArray( modifiedObjects ) && modifiedObjects.length > 0 ) {
        setDecoratorStylesOnModifiedObjectsInner( vmos, modifiedObjects );
    }
};

export default exports = {
    createVmNodeUsingNewObjectInfo,
    loadTreeTableColumns,
    loadTreeTableData,
    loadTreeTableProperties,
    processPWASelection,
    addNodeToExpansionState,
    updateFindings,
    removeFindingsFromTree,
    setDecoratorStyles,
    setDecoratorStylesOnModifiedObjects
};
