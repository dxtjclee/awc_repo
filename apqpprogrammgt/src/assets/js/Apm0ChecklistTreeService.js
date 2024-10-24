// Copyright (c) 2022 Siemens

/**
 * @module js/Apm0ChecklistTreeService
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import awTableStateService from 'js/awTableStateService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import awIconService from 'js/awIconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import cdm from 'soa/kernel/clientDataModel';
import tableSvc from 'js/published/splmTablePublishedService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import dms from 'soa/dataManagementService';
import Apm0QualityChecklistService from 'js/Apm0QualityChecklistService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

/**
 * Cached static default AwTableColumnInfo.
 */
var _treeTableColumnInfos = null;

var nonModifiablePropCols = [ 'psi0ResponsibleUser' ];

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
        displayName: data.objectName.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'WorkspaceObject',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_desc',
        propertyName: 'object_desc',
        displayName: data.Description.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );
    for ( var index = 0; index < awColumnInfos.length; index++ ) {
        var column = awColumnInfos[index];
        column.cellRenderers = [];
        column.cellRenderers.push( _treeCmdCellRender() );
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
            var gridCellImageElement = cellContent.getElementsByClassName( tableSvc.CLASS_GRID_CELL_IMAGE )[0];
            if ( gridCellImageElement ) {
                togglePartialVisibility( gridCellImageElement, vmo.visible );
            }

            return cellContent;
        },
        condition: function( column ) {
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
    if ( !isVisible ) {
        element.classList.add( 'aw-widgets-partialVisibility' );
    } else {
        element.classList.remove( 'aw-widgets-partialVisibility' );
    }
};

/**
 * @param {Array} sortCriterias - Array of fieldName and sortCriteria.
 * @param {TreeLoadInput} loadInput - TreeLoadInput
 */

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
    Apm0QualityChecklistService.setDecoratorStyles( children, false );
}

/**
 * @param deferred
 * @param propertyLoadRequests
 */








/**
 * Method to set properties on function higher and lower level Business Object modifiable
 * @param {Object} columnConfig - columnConfig to set the properties non-modifiable
 * @returns {Object}
 */
function setNonModifiablePropForAbsFunctionAnalysis( response ) {
    if ( response && response.columnConfig && response.columnConfig.columns ) {
        for ( var index = 0; index < response.columnConfig.columns.length; index++ ) {
            if ( nonModifiablePropCols.indexOf( response.columnConfig.columns[index].propertyName ) !== -1 ) {
                response.columnConfig.columns[index].modifiable = false;
            }
        }
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
function _loadTreeTableRows( treeLoadInput, sortCriteria, panelContext ) {
    /**
     * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
     */
    var deferred = AwPromiseService.instance.defer();
    var parentNode = treeLoadInput.parentNode;

    if ( !parentNode.isLeaf ) {
        var policyJson = {
            types: [
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
                        },
                        {
                            name: 'release_status_list'
                        },
                        {
                            name: 'apm0AssessmentRequired'
                        },
                        {
                            name: 'apm0Number'
                        }
                    ]
                },
                {
                    name: 'Psi0AbsChecklist',
                    properties: [
                        {
                            name: 'object_desc'
                        },
                        {
                            name: 'psi0ID'
                        },
                        {
                            name: 'psi0DueDate'
                        },
                        {
                            name: 'psi0ClosedDate'
                        },
                        {
                            name: 'psi0ResponsibleUser'
                        },
                        {
                            name: 'psi0Comment'
                        },
                        {
                            name: 'psi0RYG'
                        },
                        {
                            name: 'psi0State'
                        },
                        {
                            name: 'apm0OrderID'
                        },
                        {
                            name: 'release_status_list'
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

        // get props with intial tree for now. In future, should set this to false and populate
        // the props seperately.
        var soaInput = {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: 'Psi0AbsChecklistURI'
            },
            saveColumnConfigData: {
                clientScopeURI: '',
                columnConfigId: '',
                scope: '',
                scopeName: ''
            },
            searchInput: {
                maxToLoad: 1000,
                maxToReturn: 1000,
                providerName: 'Awp0ObjectSetRowProvider',
                searchCriteria: {
                    parentUid: '',
                    objectSet: 'Psi0EventChecklistRelation.Psi0Checklist,Psi0EventChecklistRelation.Apm0QualityChecklist'
                },
                startIndex: treeLoadInput.startChildNdx,
                searchSortCriteria: sortCriteria
            }
        };

            var isLoadAllEnabled = true;
            var children = [];

        if ( parentNode.levelNdx < 0 ) {
            soaInput.searchInput.searchCriteria.parentUid = panelContext.openedObject.uid;
            soaInput.searchInput.searchCriteria.objectSet = 'Psi0EventChecklistRelation.Psi0Checklist,Psi0EventChecklistRelation.Apm0QualityChecklist';
            var policyId = propertyPolicySvc.register( policyJson );
            soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
                function( response ) {
                    if ( policyId ) {
                        propertyPolicySvc.unregister( policyId );
                    }
                    setNonModifiablePropForAbsFunctionAnalysis( response );
                    if ( response.totalFound === 0 ) {
                        parentNode.isLeaf = true;
                        var endReached = true;
                        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, true,
                            endReached, null );
                        deferred.resolve( {
                            treeLoadResult: treeLoadResult
                        } );
                    } else {
                    if ( response.searchResultsJSON ) {
                        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                        if ( searchResults ) {
                            for ( var x = 0; x < searchResults.objects.length; ++x ) {
                                var uid = searchResults.objects[x].uid;
                                var obj = response.ServiceData.modelObjects[uid];
                                var underlyingObject = cdm.getObject( obj.props.awp0Target.dbValues[0] );
                                if ( underlyingObject ) {
                                    children.push( underlyingObject );
                                }
                            }
                        }
                    }
                        var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, response.columnConfig.columns );
                        treeLoadResult.columnConfig = response.columnConfig;
                        deferred.resolve( {
                            treeLoadResult: treeLoadResult
                        } );
                    }
                } );

        } else {

            //only QualityChecklist type will be considered from second level. Psi0Checklist object type does not have second level.
                        if ( parentNode.props.apm0QualityChecklistList.dbValues.length === 0 ) {
                            parentNode.isLeaf = true;
                            var endReached = true;
                            var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, true,
                                endReached, null );
                            deferred.resolve( {
                                treeLoadResult: treeLoadResult
                            } );
            }
            else
            {
                soaInput.searchInput.searchCriteria.parentUid = parentNode.uid;
                soaInput.searchInput.searchCriteria.objectSet = 'apm0QualityChecklistList.Apm0QualityChecklist';

                var policyId = propertyPolicySvc.register( policyJson );
                soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
                    function( response ) {
                        if ( policyId ) {
                            propertyPolicySvc.unregister( policyId );
                        }
                        if ( response.searchResultsJSON ) {
                            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                            if ( searchResults ) {
                                for ( var x = 0; x < searchResults.objects.length; ++x ) {
                                    var uid = searchResults.objects[x].uid;
                                    var obj = response.ServiceData.modelObjects[uid];
                                    var underlyingObject = cdm.getObject( obj.props.awp0Target.dbValues[0] );                               
                                    if(underlyingObject){
                                        children.push( underlyingObject );
                        }
                    }
                            }
                        } 
                        var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, response.columnConfig.columns );
                        treeLoadResult.columnConfig = response.columnConfig;
            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
                    } );
            }
        }
    }
    return deferred.promise;
}

/**
 *
 * @param {parentNode} parentNode -
 * @param {children} children -
 * @param {isLoadAllEnabled} isLoadAllEnabled -
 * @param {actionObjects} actionObjects -
 * @param {treeLoadInput} treeLoadInput -
 * @return {awTableTreeSvc.buildTreeLoadResult} awTableTreeSvc.buildTreeLoadResult -
 *
 **/
export let getTreeLoadResult = function (parentNode, children, isLoadAllEnabled, treeLoadInput, newColumns) {
    return _getTreeLoadResult(parentNode, children, isLoadAllEnabled, treeLoadInput, newColumns);
};
function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, newColumns ) {
    _buildTreeTableStructure( newColumns, parentNode, children, isLoadAllEnabled );
    if ( parentNode.children !== undefined && parentNode.children !== null ) {
        var mockChildNodes = parentNode.children.concat( _mapNodeId2ChildArray[parentNode.id] );
    } else {
        var mockChildNodes = _mapNodeId2ChildArray[parentNode.id];
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

var exports = {};

export let createVmNodeUsingNewObjectInfo = function( modelObject, levelNdx, childNdx, isLoadAllEnabled ) {
    var nodeId = modelObject.uid;
    var type = modelObject.type;
    var displayName = modelObject.props.object_name.uiValues[0];

    var iconURL = awIconService.getTypeIconFileUrl( modelObject );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, levelNdx, childNdx, iconURL );
    vmNode.modelType = modelObject.modelType;

    vmNode.isLeaf = !(vmNode.modelType.typeHierarchyArray.indexOf( 'Apm0QualityChecklist' ) > -1 && modelObject.props.apm0QualityChecklistList.dbValues.length > 0);

    vmNode.selected = true;

    _populateColumns( isLoadAllEnabled, vmNode );
    return vmNode;
};

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 *
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = function( uwDataProvider, data ) {
    var deferred = AwPromiseService.instance.defer();
    appCtxService.ctx.treeVMO = uwDataProvider;
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
export let loadTreeTableData = function(treeLoadInput, searchSortCriteria, subPanelContext) {
    /**
     * Extract action parameters from the arguments to this function.
     */


  if( treeLoadInput ) {


    /**
     * Extract action parameters from the arguments to this function.
     * <P>
     * Note: The order or existence of parameters can varey when more-than-one property is specified in the
     * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
     */



    /**
     * Check the validity of the parameters
     */


    /**
     * Load the 'child' nodes for the 'parent' node.
     */

    treeLoadInput.displayMode = 'Tree';
    return _loadTreeTableRows( treeLoadInput,  searchSortCriteria, subPanelContext );
    }

};



/**
 * This makes sure, edited object is selected
 * @param {data} data
 * @param {ArrayList} selectionModel selection model of pwa
 */
export let processPWASelection = function( context, dataProvider, selectionModel, objectsToSelect, pinUnpinFlag) {
    if ( objectsToSelect && objectsToSelect.length > 0 && pinUnpinFlag === false ) {
        var selectedModelObject =  objectsToSelect;       
        var viewModelCollection = dataProvider.viewModelCollection;       
        _.forEach( selectedModelObject, function( selectedObject ) {
            if ( viewModelCollection.loadedVMObjects.length > 0 ) {
                selectionModel.setSelection( selectedObject );
                var parentIdx = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
                    return vmo.uid === selectedObject.props.apm0ParentChecklist.dbValues[0];
                } );
                if ( parentIdx > -1 ) {
                    var parentVMO = viewModelCollection.getViewModelObject( parentIdx );                                        
                    //add node to expansion state
                    var gridId = Object.keys( context.grids )[0];
                    awTableStateService.saveRowExpanded( context, gridId, parentVMO );
                }
            }
        } );        
    }    
};


/**
 * Function to update tree table columns
 * @param {Object} data Contains data
 * @param {Object} dataProvider Contains data provider for the tree table
 */
export let updateChecklistTreeTableColumns = function( data, dataProvider ) {
    let output = {};
    if( dataProvider && data.newColumnConfig ) {
        var propColumns = data.newColumnConfig.columns;
        updateColumnPropsAndNodeIconURLs( propColumns, dataProvider.getViewModelCollection().getLoadedViewModelObjects() );
        data.newColumnConfig.columns = propColumns;
        dataProvider.columnConfig = data.newColumnConfig;
    }
    output.newColumnConfig = data.newColumnConfig;
    output.columnConfig = dataProvider.columnConfig;
    return output;
};
/**
 * Function to update tree table columns props and icon urls
 * @param {Object} propColumns Contains prop columns
 * @param {Object} childNodes Contains tree nodes
 */
function updateColumnPropsAndNodeIconURLs( propColumns, childNodes ) {
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
        }
    } );
    propColumns[ 0 ].enableColumnMoving = false;
    var _firstColumnPropertyName = propColumns[ 0 ].propertyName;

    _.forEach( childNodes, function( childNode ) {
        childNode.iconURL = awIconService.getTypeIconFileUrl( childNode );
        if( _firstColumnPropertyName && childNode.props && childNode.props && childNode.props[ _firstColumnPropertyName ] ) {
            var displayValue = childNode.props[ _firstColumnPropertyName ].displayValues[ 0 ];
    
            if( !_.isUndefined( childNode.props[ _firstColumnPropertyName ].oldValues ) ) {
                displayValue = childNode.props[ _firstColumnPropertyName ].oldValues[ 0 ];
            }
    
            childNode.displayName = displayValue;
        }
    } );
}


export default exports = {
    createVmNodeUsingNewObjectInfo,
    loadTreeTableColumns,
    loadTreeTableData,
    getTreeLoadResult,
    processPWASelection,
    updateChecklistTreeTableColumns
};
