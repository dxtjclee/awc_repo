// Copyright (c) 2022 Siemens

/**
 * @module js/qa0AuditPlanTreeService
 */
import AwStateService from 'js/awStateService';
import AwPromiseService from 'js/awPromiseService';
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
        displayName: data.qa0TreeColumnName.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_desc',
        displayName: data.qa0TreeColumnDescription.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'qa0PlannedStartDate',
        displayName: data.qa0TreeColumnPlannedStartDate.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'Date',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'qa0PlannedEndDate',
        displayName: data.qa0TreeColumnPlannedEndDate.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'Date',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'qa0ActualStartDate',
        displayName: data.qa0TreeColumnActualStartDate.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'Date',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'qa0ActualEndDate',
        displayName: data.qa0TreeColumnActualEndDate.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'Date',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
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
        var vmNode = exports.createVmNodeUsingNewObjectInfo( nChildren[childNdx - 1], levelNdx, childNdx, isLoadAllEnabled, hasRelation );
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
    if ( stateSvc && stateSvc.params ) {
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
function _loadTreeTableRows( deferred, treeLoadInput ) {
    /**
       * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
       */
    var parentNode = treeLoadInput.parentNode;
    var isLoadAllEnabled = true;

    if ( !parentNode.isLeaf ) {
        var policyJson = {
            types: [ {
                name: 'Qa0QualityAuditPlan'
            },
            {
                name: 'Qa0QualityAudit',
                properties: [ {
                    name: 'object_desc'
                },
                {
                    name: 'qa0PlannedStartDate'
                }
                ]
            },
            {
                name: 'Awp0XRTObjectSetRow',
                properties: [ {
                    name: 'awp0Target'
                } ]
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
                    objectSet: 'Qa0QualityAuditPlanRel.Qa0QualityAudit',
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

        var children = [];
        var policyId;
        var treeLoadResult;

        if ( parentNode.levelNdx < 0 ) {
            var rootNode = cdm.getObject( selectedUID );
            children.push( rootNode );

            policyId = propertyPolicySvc.register( policyJson );

            return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
                function( response ) {
                    if( policyId ) {
                        propertyPolicySvc.unregister( policyId );
                    }

                    treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, response.totalFound > 0 );

                    deferred.resolve( {
                        treeLoadResult: treeLoadResult
                    } );
                } );
        } else if ( parentNode.levelNdx === 0 ) {
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
                                var uid = searchResults.objects[x].uid;
                                var obj = cdm.getObject( uid );
                                if ( obj ) {
                                    children.push( obj );
                                }
                            }
                        }
                    }

                    if( response.totalFound === 0 ) {
                        parentNode.isLeaf = true;
                        var endReached = true;

                        treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, true, endReached, null );

                        deferred.resolve( {
                            treeLoadResult: treeLoadResult
                        } );
                    } else {
                        treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput );

                        deferred.resolve( {
                            treeLoadResult: treeLoadResult
                        } );
                    }
                } );
        } else if ( parentNode.levelNdx < _maxTreeLevel ) {
            if( parentNode.props.Qa0QualityAuditPlanRel ) {
                for( var x = 0; x < parentNode.props.Qa0QualityAuditPlanRel.dbValues.length; ++x ) {
                    var uid = parentNode.props.Qa0QualityAuditPlanRel.dbValues[ x ];
                    var obj = cdm.getObject( uid );

                    if( obj ) {
                        children.push( obj );
                    }
                }
            }
        } else {
            parentNode.isLeaf = true;

            var mockChildNodes = _mapNodeId2ChildArray[ parentNode.id ];
            var mockChildNodesLen = mockChildNodes ? mockChildNodes.length : 0;
            var endReached = parentNode.startChildNdx + treeLoadInput.pageSize > mockChildNodesLen;

            treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, false, true, endReached, null );

            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
        }
    }
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
function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, hasRelation ) {
    _buildTreeTableStructure( _getTreeTableColumnInfos(), parentNode, children, isLoadAllEnabled, hasRelation );
    var mockChildNodes;
    if ( parentNode.children !== undefined && parentNode.children !== null ) {
        mockChildNodes  = parentNode.children.concat( _mapNodeId2ChildArray[parentNode.id] );
    } else {
        mockChildNodes = _mapNodeId2ChildArray[parentNode.id];
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
 * Evaluate, if the specified node contains children.
 * @param {boolean} hasRelation True, if node has relations.
 * @param {object} vmNode Node to evaluate.
 */
function _evaluteNodeIsLeaf( hasRelation, vmNode ) {
    if( vmNode.modelType.typeHierarchyArray.indexOf( 'Qa0QualityAudit' ) > -1 ) {
        vmNode.isLeaf = true;
    } else if( vmNode.modelType.typeHierarchyArray.indexOf( 'Qa0QualityAuditPlan' ) > -1 && hasRelation ) {
        vmNode.isLeaf = false;
    } else {
        vmNode.isLeaf = true;
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

    _evaluteNodeIsLeaf( hasRelation, vmNode );

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
 * This function will create the SOA input for removeChildren for removing audits from the audit plan.
 * @param {Object} auditPlanObject Audit plan object, that contains the audit relation.
 * @param {String} relation name of the audit relation
 * @param {Array} selectedAudits Array of selected audits to be removed
 * @return {Array} Returns inputData array for removeChildren service
 */
export let createRemoveAuditFromAuditPlanInput = function( auditPlanObject, relation, selectedAudits ) {
    var inputData = {};
    var soaInput = [];

    inputData = {
        clientId: 'AWClient',
        parentObj: auditPlanObject,
        childrenObj: [],
        propertyName: relation
    };

    if( auditPlanObject && selectedAudits && selectedAudits.length > 0 ) {
        selectedAudits.forEach( function( selectedObj ) {
            inputData.childrenObj.push( selectedObj );
        } );
    }
    soaInput.push( inputData );

    return soaInput;
};

export default exports = {
    createVmNodeUsingNewObjectInfo,
    loadTreeTableColumns,
    loadTreeTableData,
    loadTreeTableProperties,
    createRemoveAuditFromAuditPlanInput
};

