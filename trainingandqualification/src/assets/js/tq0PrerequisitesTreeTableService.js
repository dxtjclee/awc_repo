// Copyright (c) 2022 Siemens

/**
 * @module js/tq0PrerequisitesTreeTableService
 */
import _ from 'lodash';
import app from 'app';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import uwPropertySvc from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import iconSvc from 'js/iconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';

var _treeTableColumnInfos = null;
var exports = {};
var _maxTreeLevel = 100;
var _mapNodeId2ChildArray = {};

/**
 * Function to load the prerequisite tree
 *@return {Object}  paginated tree data
 */
export let loadPrerequisites = function() {
    var treeLoadInput = arguments[ 0 ];
    if( treeLoadInput === undefined ) {
        var parentNode = {
            treeLevel: -1,
            childNdx: 0,
            displayName: 'top',
            iconURL: null,
            id: 'top',
            levelNdx: 0,
            type: 'rootType',
            uid: 'top',
            visible: true
        };
        parentNode.selected = false;
        var startChildNdx = -1;
        var startChildId = 0;
        var cursorNodeId = 0;
        var pageSize = 50;
        treeLoadInput = awTableTreeSvc.createTreeLoadInput( parentNode, startChildNdx, startChildId, cursorNodeId,
            pageSize );
    }
    treeLoadInput.retainTreeExpansionStates = true;

    var delayTimeTree = 20;

    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];

        if( arg !== undefined && uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeTree' ) {
            delayTimeTree = arg.dbValue;
        } else if( arg !== undefined && uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'maxTreeLevel' ) {
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
    var i18nStrings = arguments[ 5 ];
    if( delayTimeTree > 0 ) {
        _.delay( _loadTreeTableRows, delayTimeTree, deferred, treeLoadInput, i18nStrings );
    } else {
        _loadTreeTableRows( deferred, treeLoadInput, i18nStrings );
    }
    return deferred.promise;
};

/**
 * Resolve the row data for the 'next' page of 'children' nodes of the given 'parent'.
 * <P>
 * Note: The paging status is maintained in the 'parent' node.
 *
 * @param {DeferredResolution} deferred - deferred object
 * @param {TreeLoadInput} treeLoadInput - treeloadInput
 * @param {JSON} i18nStrings - strings
 */
function _loadTreeTableRows( deferred, treeLoadInput, i18nStrings ) {
    var ctx = appCtxService.getCtx();
    var parentNode = treeLoadInput.parentNode;
    var propsToLoad = [];
    propsToLoad = [ 'tq0Prerequisites', 'tq0QualificationId', 'fnd0RevisionId', 'object_string', 'object_desc', 'tq0IsActive', 'tq0Cost', 'tq0ExpectedDuration', 'tq0RenewalPeriod' ];

    var uids = [];
    if( !parentNode.isLeaf ) {
        if( parentNode.levelNdx < 0 ) {
            var isLoadAllEnabled = true;
            var children = [];
            var selectedQU = ctx.selected.props.tq0Prerequisites.value;
            selectedQU.forEach( element => {
                children.push( cdm.getObject( element ) );
                uids.push( element );
            } );
            dms.getProperties( uids, propsToLoad ).then( function() {
                var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, i18nStrings );
                deferred.resolve( {
                    treeLoadResult: treeLoadResult
                } );
            } );
        } else {
            if( parentNode.levelNdx < _maxTreeLevel ) {
                var expandedNodeIsLoadAllEnabled = true;
                var childrenForExpandedNode = [];
                var expandedNode = parentNode.props.tq0Prerequisites.dbValue;
                expandedNode.forEach( element => {
                    childrenForExpandedNode.push( cdm.getObject( element ) );
                    uids.push( element );
                } );
                dms.getProperties( uids, propsToLoad ).then( function() {
                    var expandedTreeLoadResult = _getTreeLoadResult( parentNode, childrenForExpandedNode, expandedNodeIsLoadAllEnabled, treeLoadInput, i18nStrings );
                    deferred.resolve( {
                        treeLoadResult: expandedTreeLoadResult
                    } );
                } );
            }
        }
    }
}

/**
 *
 * @param {parentNode} parentNode - ParentNode/Root of tree
 * @param {children} children - Childrens of he parent node
 * @param {isLoadAllEnabled} isLoadAllEnabled - boolean flag
 * @param {treeLoadInput} treeLoadInput -treeloadInput
 * @param {i18nStrings} i18nStrings - localization Strings
 * @return {awTableSvc.buildTreeLoadResult} awTableSvc.buildTreeLoadResult -
 *
 **/
function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, i18nStrings ) {
    _buildTreeTableStructure( _getTreeTableColumnInfos(), parentNode, children, isLoadAllEnabled );
    if( parentNode.children !== undefined && parentNode.children !== null ) {
        var mockChildNodes = parentNode.children.concat( _mapNodeId2ChildArray[ parentNode.id ] );
    } else {
        var mockChildNodes = _mapNodeId2ChildArray[ parentNode.id ];
    }
    var mockChildNodesLen = mockChildNodes ? mockChildNodes.length : 0;
    var endReached = parentNode.startChildNdx + treeLoadInput.pageSize > mockChildNodesLen;
    var cursorObj = {
        endReached: endReached,
        startReached: true
    };
    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, false, true, endReached, null );
    treeLoadResult.parentNode.cursorObject = cursorObj;
    return treeLoadResult;
}

/**
 * @param {AwTableColumnInfoArray} columnInfos - Array of column information objects to use when building the table rows.
 * @param {ViewModelTreeNode} parentNode - A node that acts 'parent' of a hierarchy of 'child' ViewModelTreeNodes.
 * @param {Number} nChildren - Number of of child nodes to add to the given 'parent'.
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
        var vmNode = exports.createVmNodeUsingNewObjectInfo( nChildren[ childNdx - 1 ], levelNdx, childNdx, isLoadAllEnabled, columnInfos, parentNode );
        /**
         * Add it to the 'parent' based on its ID
         */
        children.push( vmNode );
    }
}

/**
 *  This method loads required properties.
    @{Object} selectedQualificationUnit - selected Qualification Unit from PWA
 */
export let loadRequiredProperties = function( selectedQualificationUnit ) {
    var propsToLoad = [];
    var uids = [ selectedQualificationUnit[ 0 ].uid ];
    uids.push( selectedQualificationUnit[ 0 ].uid );
    propsToLoad = [ 'tq0Prerequisites' ];
    dms.getProperties( uids, propsToLoad );
};

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this action function is invoked from.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let loadTreeTableColumns = function( uwDataProvider ) {
    var deferred = AwPromiseService.instance.defer();
    appCtxService.ctx.treeVMO = uwDataProvider;
    var awColumnInfos = _getTreeTableColumnInfos();
    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };
    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};

/**
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getTreeTableColumnInfos() {
    if( !_treeTableColumnInfos ) {
        _treeTableColumnInfos = _buildTreeTableColumns();
    }
    return _treeTableColumnInfos;
}
/**
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
function _buildTreeTableColumns() {
    var awColumnInfos = [];
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'tq0Prerequisites',
        displayName: 'Name',
        width: 250,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'tq0QualificationId',
        displayName: 'Qualification ID',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'fnd0RevisionId',
        displayName: 'Revision Id',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_desc',
        displayName: 'Description',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'tq0IsActive',
        displayName: 'Status',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'owning_user',
        displayName: 'Owner',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'tq0Cost',
        displayName: 'Cost',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'tq0RenewalPeriod',
        displayName: 'Renewal Period',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'tq0ExpectedDuration',
        displayName: 'Expected Duration',
        width: 200,
        minWidth: 200,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: true,
        isTreeNavigation: false
    } ) );

    for( var index = 0; index < awColumnInfos.length; index++ ) {
        var column = awColumnInfos[ index ];
        column.cellRenderers = [];
    }
    var sortCriteria = [];
    if( !_.isEmpty( sortCriteria ) ) {
        if( sortCriteria[ 0 ].fieldName && _.eq( awColumnInfos[ 0 ].name, sortCriteria[ 0 ].fieldName ) ) {
            awColumnInfos[ 0 ].sort = {};
            awColumnInfos[ 0 ].sort.direction = sortCriteria[ 0 ].sortDirection.toLowerCase();
            awColumnInfos[ 0 ].sort.priority = 0;
        }
    }
    return awColumnInfos;
}

export let createVmNodeUsingNewObjectInfo = function( modelObject, levelNdx, childNdx, isLoadAllEnabled, columnInfos ) {
    let propsToLoad = [ 'tq0Prerequisites', 'tq0QualificationId', 'fnd0RevisionId', 'object_string', 'object_desc', 'tq0IsActive', 'tq0Cost', 'tq0ExpectedDuration', 'tq0RenewalPeriod' ];
    dms.getProperties( [ modelObject.uid ], propsToLoad );
    var nodeDisplayName = modelObject.props.object_name.dbValues[ 0 ];
    var nodeId = modelObject.uid;
    var type = modelObject.type;

    var iconURL = iconSvc.getTypeIconURL( type );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, nodeDisplayName, levelNdx, childNdx, iconURL );

    vmNode.isLeaf = true;
    if( modelObject.props.tq0Prerequisites.dbValues.length > 0 ) {
        vmNode.isLeaf = false;
    }
    vmNode.selected = false;
    vmNode.props = {};
    _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, modelObject.props );
    return vmNode;
};
/**
 * @param {ObjectArray} columnInfos - column info
 * @param {Boolean} isLoadAllEnabled - load all
 * @param {ViewModelTreeNode} vmNode - view model object
 * @param {Number} childNdx - Child Index
 */
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, props ) {
    if( isLoadAllEnabled ) {
        if( !vmNode.props ) {
            vmNode.props = {};
        }
        var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( vmNode.uid ), 'EDIT' );
        tcViewModelObjectService.mergeObjects( vmNode, vmo );
    }
}

export default exports = {
    loadPrerequisites,
    loadTreeTableColumns,
    createVmNodeUsingNewObjectInfo,
    loadRequiredProperties
};
app.factory( 'tq0PrerequisitesTreeTableService', () => exports );
