// Copyright (c) 2022 Siemens

/**
 * @module js/Aqc0ChecklistSpecTreeTableService
 */
import appCtxService from 'js/appCtxService';
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
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import treeTableDataService from 'js/treeTableDataService';
import awIconService from 'js/awIconService';
import dms from 'soa/dataManagementService';
import declpopupService from 'js/declpopupService';
import eventBus from 'js/eventBus';
import navigationSvc from 'js/navigationService';
import browserUtils from 'js/browserUtils';
import AwStateService from 'js/awStateService';

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
 var _firstColumnConfigColumnPropertyName = 'object_name';

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
        displayName: data.elementName.uiValue,
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_desc',
        propertyName: 'object_desc',
        displayName: data.description.uiValue,
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
    var sortCriteria = appCtxService.ctx.checklistSpecManagerContext.sortCriteria;
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
/*var _populateSortCriteriaParameters = function( sortCriterias, loadInput ) {
    var sortCriteria = {};
    if ( !_.isEmpty( loadInput.sortCriteria ) ) {
        sortCriteria = loadInput.sortCriteria[0];
    }
    sortCriterias.push( sortCriteria );
};*/

/**
 * @param {AwTableColumnInfoArray} columnInfos - Array of column information objects to use when building the
 *            table rows.
 * @param {ViewModelTreeNode} parentNode - A node that acts 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {Number} nChildren - The # of child nodes to add to the given 'parent'.
 * @param {Boolean} isLoadAllEnabled - TRUE if all properties should be included.
 */
/*function _buildTreeTableStructure( columnInfos, parentNode, nChildren, isLoadAllEnabled ) {
    var children = [];

    _mapNodeId2ChildArray[parentNode.id] = children;

    var levelNdx = parentNode.levelNdx + 1;

    for ( var childNdx = 1; childNdx <= nChildren.length; childNdx++ ) {
        
        var vmNode = exports.createVmNodeUsingNewObjectInfo( nChildren[childNdx - 1], levelNdx, childNdx, isLoadAllEnabled, columnInfos );
        
        children.push( vmNode );
    }
}*/

/**
 * @param deferred
 * @param propertyLoadRequests
 */
/*function _loadProperties( deferred, propertyLoadInput ) {
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
 * function to evaluate if an object contains children
 * @param {objectType} objectType object type
 * @return {boolean} if node contains child
 */
function containChildren( props, vmNode ) {
    var containChild = false;
    if ( props.qc0ChecklistSpecList.dbValues.length > 0 ) {
        vmNode.isLeaf = containChild;
    } else {
        vmNode.isLeaf = !containChild;
    }
}

export let createVmNodeUsingNewObjectInfoFromSOAResponse = function( modelObject, levelNdx,childNdx,parentUid,data,dataProvider,flag ) {
    var nodeDisplayName = modelObject.propertyInfos[0].displayValues[0];
    var nodeId = modelObject.qualityObject.uid;
    var type = modelObject.qualityObject.type;   

    var iconURL = iconSvc.getTypeIconURL( type );

    var vmNode = awTableSvc.createViewModelTreeNode( nodeId, type, nodeDisplayName, levelNdx, childNdx, iconURL );
    if(flag){
        let viewModelCollection = dataProvider.viewModelCollection;
        viewModelCollection.loadedVMObjects.push( vmNode);
    }
    
    if (modelObject.numberOfChildren > 0) {
        vmNode.isLeaf = false;
    } else {
        vmNode.isLeaf = true;
    }

    if( parentUid !== null ) {
        
        vmNode.parentUid = parentUid;
    }
    return vmNode;
};
function getParentChildInfo( child, parentChildInfos ) {
    let index = parentChildInfos.findIndex( function( parChildInfo ) {
        return parChildInfo.parentInfo.qualityObject.uid === child.qualityObject.uid;
    } );
    let parentChildInfoForChild;
    if ( index > -1 ) {
        parentChildInfoForChild = parentChildInfos[index];
    }
    return parentChildInfoForChild;
}
function getAllChildInfo (parentNode, childrenInfo, parentChildInfos, data, treeLoadOutput,dataProvider,flag)
{
    if (parentNode) {
        var childLevelNdx = parentNode.levelNdx + 1;

        for (var chIndex = 0; chIndex < childrenInfo.length; chIndex++) {
            var chVmNode = null;
            var childLevelNdx = parentNode.levelNdx + 1;
            chVmNode = createVmNodeUsingNewObjectInfoFromSOAResponse(childrenInfo[chIndex], childLevelNdx, chIndex, parentNode.uid, data, dataProvider, flag);
            treeLoadOutput.children.push(chVmNode);

            if (parentNode && parentNode.children) {
                parentNode.children.push(chVmNode);
                parentNode.isLeaf = false;
                parentNode.totalChildCount = parentNode.children.length;
            } else if (parentNode && !parentNode.children) {
                parentNode.children = [];
                parentNode.children.push(chVmNode);
                parentNode.isLeaf = false;
            }
            if (!parentNode.isExpanded) {
                parentNode.isExpanded = true;
                addNodeToExpansionState(parentNode, data);
            }

            var parentChildInfoForChild = getParentChildInfo(childrenInfo[chIndex], parentChildInfos);
            if (parentChildInfoForChild !== null && parentChildInfoForChild !== undefined) {
                chVmNode.isExpanded = true;
                chVmNode._expandRequested = false;
                getAllChildInfo(chVmNode, parentChildInfoForChild.childrenInfo, parentChildInfos, data, treeLoadOutput, dataProvider, flag);
            } else {
                chVmNode.isExpanded = false;
            }
        }
    } 
}
function getNodeFromVMC( modelObject , data, index) {
    var viewModelCollection = data.dataProviders.checklistSpecDataProvider.viewModelCollection;
    index = viewModelCollection.loadedVMObjects.findIndex( function( vmNode ) {
       return modelObject.qualityObject.uid === vmNode.uid;
    } );
    let node = null;
    if ( index > -1 ) {
        node = viewModelCollection.loadedVMObjects[index];
    }
    return node;
}

function checkForRootNode(parent, parentChildInfos, isRootNode){
    var isRootNode = true;
    _.forEach( parentChildInfos, function( parentChildInfo ) {
        _.forEach( parentChildInfo.childrenInfo, function( childInfo ) {
            if(parent.qualityObject.uid === childInfo.qualityObject.uid) {
                isRootNode = false;
            }       
        } );
    } );
    return isRootNode;
}

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
function checkForFilterData(parent, searchData) {
    var isContain = false;
    if (searchData && searchData.criteria && searchData.criteria.searchString) {
        var pattern = searchData.criteria.searchString.split("*").join("");
        var str = parent.propertyInfos[0].displayValues[0];
        if (str.includes(pattern)) {
            isContain = true;
        }
    }
    return isContain;
}
function getParentAndChildHierarchy(  parentChildInfos, treeLoadInput, treeLoadOutput, data,dataProvider,searchData) {
    var parentNode = treeLoadInput.parentNode; 
    var modelObjectsForExpansion = treeLoadInput.modelObjectsForExpansion;
    treeLoadOutput.children = [];
    var parentChildInfoForParent;
    var isRootNode = true;
    var parentLevelNdx = treeLoadInput.parentNode.levelNdx + 1; 
    var parIndex;  
    var vmNode = {};
    var parentCount = 0;
    
    if (treeLoadInput.parentNode.levelNdx > -1) {

        let index = parentChildInfos.findIndex(function (parChildInfo) {
            return parChildInfo.parentInfo.qualityObject.uid === parentNode.uid;
        });
        if (index > -1) {
            parentChildInfoForParent = parentChildInfos[index];
        } else {
            parentChildInfoForParent = parentChildInfos[0];
        }
        if (parentNode.levelNdx === -1 ) {
            vmNode.levelNdx = -1;
        }
        vmNode = getNodeFromVMC(parentChildInfoForParent.parentInfo, data, parIndex);
        
        getAllChildInfo(vmNode, parentChildInfoForParent.childrenInfo, parentChildInfos, data, treeLoadOutput,dataProvider,false);
    }
    else {
        for (var parentIndx = 0; parentIndx < parentChildInfos.length; parentIndx++) {
            if( !checkForRootNode(parentChildInfos[parentIndx].parentInfo, parentChildInfos) ){
                continue;
            }
            if (searchData.criteria.searchString && !checkForFilterData(parentChildInfos[parentIndx].parentInfo, searchData)) {
                continue;
            }
            vmNode = getNodeFromVMC(parentChildInfos[parentIndx].parentInfo, data, parIndex);
            if (vmNode === null || vmNode === undefined || vmNode === '') {
                var localModelObject = {};
                var uiValueName = {
                    object_name: {
                        uiValues: []
                    }
                };
                vmNode = createVmNodeUsingNewObjectInfoFromSOAResponse(parentChildInfos[parentIndx].parentInfo, parentLevelNdx, 0,null,data,dataProvider,true);
                parentCount = parentCount + 1;
                //dataProvider.update(dataProvider.viewModelCollection.loadedVMObjects);
                treeLoadOutput.children.push(vmNode);
                let isParentNodeExpanded = -1;
                let parentNodeUid = parentChildInfos[parentIndx].parentInfo.qualityObject.uid;
                if (modelObjectsForExpansion && modelObjectsForExpansion.length > 0) {
                    isParentNodeExpanded = modelObjectsForExpansion.findIndex(function (node) {
                        return parentNodeUid === node.uid;
                    });
                }
                if (isParentNodeExpanded > -1 && parentChildInfos[parentIndx].childrenInfo.length > 0) {
                    getAllChildInfo(vmNode, parentChildInfos[parentIndx].childrenInfo, parentChildInfos, data, treeLoadOutput,dataProvider,true);
                } else {
                    vmNode.isExpanded = false;
                    vmNode._expandRequested = false;
                }
            }
        }
        dataProvider.update(dataProvider.viewModelCollection.loadedVMObjects);
        if (searchData &&  parentCount > 0 ) {
            const newSearchData = { ...searchData.value };
            newSearchData.totalFound = parentCount;
            searchData.update(newSearchData);
        }
    }   
    var children = [];
    children = treeLoadOutput.children;
    return children;
}
export let processGetParentChildInfoResponse = function( treeLoadInput, response, declViewModel,dataProvider,searchData ) {
     
    var parentNode = treeLoadInput.parentNode;
    var isTopNode = parentNode.levelNdx === -1;
    
    var treeLoadOutput = {};
    var treeLoadResult;    
    var vmNodes = getParentAndChildHierarchy( response.parentChildInfos,treeLoadInput,treeLoadOutput,declViewModel,dataProvider,searchData);

    treeLoadResult = awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, true,null ); 
    return treeLoadResult;
};
/**
 * Resolve the row data for the 'next' page of 'children' nodes of the given 'parent'.
 * <P>
 * Note: The paging status is maintained in the 'parent' node.
 *
 * @param {DeferredResolution} deferred -
 * @param {TreeLoadInput} treeLoadInput -
 * @return {Promise} Revolved with a TreeLoadResult object containing result/status information.
 */
function _loadTreeTableRows(deferred, treeLoadInput, searchData, declViewModel,dataProvider) {
    /**
     * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
     */
    var parentNode = treeLoadInput.parentNode;
    var treeView = null;
    var _propertyName = 'object_name';
    var filterVal="*";

    if (searchData && searchData.criteria && searchData.criteria.searchString){
        filterVal = searchData.criteria.searchString;
    }
    var filterCriteriaInp = {
        fieldName : 'object_name',
        filterValues : [filterVal],
        operation : "filter"
    };

        // get props with intial tree for now. In future, should set this to false and populate
        // the props seperately.
    var sortCriteriaInput = [{
        fieldName: 'object_name',
        sortDirection: 'ASC'
    }];
    /*if(treeLoadInput.sortCriteria.length > 0){
        sortCriteriaInput = treeLoadInput.sortCriteria
    }*/
    if(treeLoadInput.sortCriteria.length >= 1){
        _propertyName = treeLoadInput.sortCriteria[0].fieldName;
        sortCriteriaInput = treeLoadInput.sortCriteria;
    }
    var modelObjectsForExpansion = [];
    if (treeLoadInput && treeLoadInput.modelObjectsForExpansion && treeLoadInput.modelObjectsForExpansion.length > 0) {
        modelObjectsForExpansion = treeLoadInput.modelObjectsForExpansion;
            }

    if (parentNode.uid === 'top') {
        treeView = 'GenViewType';
        dataProvider.viewModelCollection.loadedVMObjects = [];
        dataProvider.update(dataProvider.viewModelCollection.loadedVMObjects);
        }
    else {
        treeView = 'Qc0ChecklistSpecification';
                }
    var soaInput = {
        input: {
            treeViewType: treeView,
            propertyName: 'object_name',
            sortCriteria: sortCriteriaInput,
            filterCriteria: [filterCriteriaInp],
            expansionCriteria: {},
            requestPref: {},
            startIndex: 0,
            maxToReturn: 100
        }
    };
    soaInput.input.parentElement = {
        uid: parentNode.uid,
        type: 'Qc0ChecklistSpecification'
    };
    soaInput.input.expansionCriteria = {
        expandBelow: false,
        expandObjectList: modelObjectsForExpansion,
        numLevelsToExpand: 0
    };
    soaInput.input.restoreSavedState = false;
    return soaSvc.postUnchecked('Internal-QualityManager-2023-06-QualityDataManagement', 'getQualityObjectTreeData2', soaInput).then(
        function (response) {
            if (!declViewModel.isDestroyed() && response.parentChildInfos && response.parentChildInfos.length > 0) {
                var treeLoadResult = processGetParentChildInfoResponse(treeLoadInput, response, declViewModel, dataProvider, searchData);
                return {
                    treeLoadResult: treeLoadResult
                };
            } else {
                if (searchData) {
                    const newSearchData = { ...searchData.value };
                    newSearchData.totalFound = 0;
                    searchData.update(newSearchData);
                }
                var treeLoadResult = {};
                return {
                    treeLoadResult: treeLoadResult
                };
            }

        });
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
/*function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput ) {
    _buildTreeTableStructure( _getTreeTableColumnInfos(), parentNode, children, isLoadAllEnabled );
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
}*/

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

    var iconURL = iconSvc.getTypeIconURL( type );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, displayName, levelNdx, childNdx, iconURL );
    vmNode.modelType = modelObject.modelType;

    !containChildren( modelObject.props, vmNode );

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

    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );

    return deferred.promise;
};
var setNodeStateToCollapsed = function( nodeToBeCollapsed ) {
    nodeToBeCollapsed.children = null;
    nodeToBeCollapsed.startChildNdx = 0;
    nodeToBeCollapsed.totalChildCount = null;
    delete nodeToBeCollapsed.isExpanded;
};
export let purgeExpandedNode = function( nodeToBePurged, loadedVMOs, dataProvider, data ) {

    if( loadedVMOs ) {
        var begNdx = -1;
        var nDelete = 0;
        for( var ndx = 0; ndx < loadedVMOs.length; ndx++ ) {
            var currentVMO = loadedVMOs[ ndx ];
            if( currentVMO.id === nodeToBePurged.id ) {
                begNdx = ndx + 1;
                nDelete = 0;
            } else if( begNdx >= 0 ) {
                if( currentVMO.levelNdx > nodeToBePurged.levelNdx ) {
                    if( currentVMO.isExpanded === true ) {
                        var gridId = Object.keys( data.grids )[ 0 ];
                        awTableStateService.saveRowCollapsed( data, gridId, currentVMO );
                    }
                    nDelete++;
                } else {
                    break;
                }
            }
        }
        if( nDelete > 0 ) {
            loadedVMOs.splice( begNdx, nDelete );
            dataProvider.update( loadedVMOs );
        }
    }
};
function getParentChildInfoObject( parentChildInfos, addedObj, index ) {
    let parentChildInfoForChild = {};
    for (var i=0;i<parentChildInfos.length;i++){
        index = parentChildInfos[i].childrenInfo.findIndex( function( parChildInfo ) {
            return parChildInfo.qualityObject.uid === addedObj;
        } );        
        if ( index > -1 ) {
            parentChildInfoForChild = {
                parentInfo:parentChildInfos[i].parentInfo,
                childInfo:parentChildInfos[i].childrenInfo[index],
                index:index
            };
            break;
        }
    }    
    return parentChildInfoForChild;
}
function addOrRemoveVMOsInViewModelCollection(viewModelCollection, elementsAddedInReponse, elementsDeletedInReponse, parentChildInfos, data) {
    if (elementsAddedInReponse.length > 0) {
        _.forEach(elementsAddedInReponse, function (addedObj) {
            var parentChildInfoForChild = {};
            var index;
            var parentChildInfoForChild = getParentChildInfoObject(parentChildInfos, addedObj, index);
            if (parentChildInfoForChild && parentChildInfoForChild.parentInfo !== undefined) {
                var parentNodeNdx = viewModelCollection.findViewModelObjectById(parentChildInfoForChild.parentInfo.qualityObject.uid);
                if (parentNodeNdx !== -1) {
                    var parentNode = viewModelCollection.getViewModelObject(parentNodeNdx);
                    var chVmNode;
                    var childLevelNdx = parentNode.levelNdx + 1;
                    chVmNode = createVmNodeUsingNewObjectInfoFromSOAResponse(parentChildInfoForChild.childInfo, childLevelNdx, parentChildInfoForChild.index, parentNode.uid);
                    if (parentNode && parentNode.children) {
                        parentNode.children.push(chVmNode);
                        parentNode.isLeaf = false;
                        parentNode.totalChildCount = parentNode.children.length;
                        parentNode.isExpanded = true;
                    } else if (parentNode && !parentNode.children) {
                        parentNode.children = [];
                        parentNode.children.push(chVmNode);
                        parentNode.isExpanded = true;
                        parentNode.isLeaf = false;
                        addNodeToExpansionState(parentNode, data);
                    }
                    var numFirstLevelChildren = 0;
                    for (var i = parentNodeNdx + 1; i < viewModelCollection.loadedVMObjects.length; i++) {
                        if (numFirstLevelChildren === parentChildInfoForChild.index && viewModelCollection.loadedVMObjects[i].levelNdx <= childLevelNdx) {
                            break;
                        }
                        if (viewModelCollection.loadedVMObjects[i].levelNdx === childLevelNdx) {
                            numFirstLevelChildren++;
                        }
                        if (viewModelCollection.loadedVMObjects[i].levelNdx < childLevelNdx) {
                            break;
                        }
                    }
                    var newIndex = i;
                    viewModelCollection.loadedVMObjects.splice(newIndex, 0, chVmNode);
                }
            }
        });
    }
    if ( elementsDeletedInReponse && elementsDeletedInReponse.length > 0) {
        for (var i = elementsDeletedInReponse.length - 1; i >= 0; i--) {
            var deleteObj = elementsDeletedInReponse[i];
            var parentNodeNdx = viewModelCollection.findViewModelObjectById(deleteObj);
            if (parentNodeNdx !== -1) {
                var deletedNode = viewModelCollection.getViewModelObject(parentNodeNdx);
                if (deletedNode && deletedNode.isExpanded === true) {
                    var gridId = Object.keys(data.grids)[0];
                    awTableStateService.saveRowCollapsed(data, gridId, deletedNode);
                }
                viewModelCollection.loadedVMObjects.splice(parentNodeNdx, 1);
            }
        }
    }
}
function getElementsAddedInReponse(loadedViewModelObjects, objectsUidsInResponse){
    var addedUids = [];
    if(objectsUidsInResponse.length > 0){
        _.forEach( objectsUidsInResponse, function( objectUid ) {
            let index = loadedViewModelObjects.findIndex( function( loadedVmo ) {
                return loadedVmo.uid === objectUid;
            } );
            if(index < 0){
                addedUids.push(objectUid);
            }            
        } );
    }
    return addedUids;
}
 function _createParentNodeHavingNoChild( parentVMO, vmCollection ) {
    let newParentVMO = createVmNodeUsingNewObjectInfo( parentVMO, parentVMO.levelNdx, parentVMO.childNdx, true );
    let index = vmCollection.loadedVMObjects.findIndex( function( treeNode ) {
        return treeNode.uid === parentVMO.uid;
    } );
    newParentVMO.isLeaf = true;
    newParentVMO.isExpanded = false;
    newParentVMO.expanded = false;
    vmCollection.loadedVMObjects.splice( index, 1, newParentVMO );
    return vmCollection;
}
function getElementsDeletedInReponse(loadedViewModelObjects, objectsUidsInResponse){
    var deletedUids = [];   
    if(loadedViewModelObjects.length > 0){
        _.forEach( loadedViewModelObjects, function( loadedVMO ) {
            let index = objectsUidsInResponse.findIndex( function( objectUid ) {
                return loadedVMO.uid === objectUid;
            } );
            if(index < 0){
                deletedUids.push(loadedVMO.uid);
            }            
        } );
    }
    return deletedUids;
}
function getParentAndChildObjectUidsFromResponse (childrenInfo, parentChildInfos,  noChildVmos,objectsUidsInResponse )
 { 
    for ( var chIndex = 0; chIndex < childrenInfo.length; chIndex++ ) {
        if(childrenInfo[chIndex].numberOfChildren === 0){
            noChildVmos.push(childrenInfo[chIndex].qualityObject.uid);
        }
        objectsUidsInResponse.add(childrenInfo[chIndex].qualityObject.uid);
        var parentChildInfoForChild = getParentChildInfo(childrenInfo[chIndex], parentChildInfos);
        if(parentChildInfoForChild !== null && parentChildInfoForChild !== undefined ){            
            getParentAndChildObjectUidsFromResponse( parentChildInfoForChild.childrenInfo, parentChildInfos,  noChildVmos, objectsUidsInResponse);
        }
    }
 }
function getObjectUidsFromResponse(parentChildInfos, targetNode, noChildVmos,objectsUidsInResponse){
    if(targetNode && targetNode.uid && targetNode.type){
        let index = parentChildInfos.findIndex( function( parChildInfo ) {
            return parChildInfo.parentInfo.qualityObject.uid === targetNode.uid;
        } );
        var parentChildInfoForParent = {};
        if ( index > -1 ) {
            parentChildInfoForParent = parentChildInfos[index];
        }else{
           parentChildInfoForParent = parentChildInfos[0];
        }
        objectsUidsInResponse.add(parentChildInfoForParent.parentInfo.qualityObject.uid);
        if(parentChildInfoForParent.parentInfo.numberOfChildren === 0){
            noChildVmos.push(parentChildInfoForParent.parentInfo.qualityObject.uid);
        }
        getParentAndChildObjectUidsFromResponse(parentChildInfoForParent.childrenInfo,parentChildInfos,noChildVmos, objectsUidsInResponse);
    } else {
        for (var parentIndx = 0; parentIndx < parentChildInfos.length; parentIndx++) {
            objectsUidsInResponse.add(parentChildInfos[parentIndx].parentInfo.qualityObject.uid);
            if (parentChildInfos[parentIndx].parentInfo.numberOfChildren === 0) {
                noChildVmos.push(parentChildInfos[parentIndx].parentInfo.qualityObject.uid);
            }
            getParentAndChildObjectUidsFromResponse(parentChildInfos[parentIndx].childrenInfo, parentChildInfos, noChildVmos, objectsUidsInResponse);
        }
    }
 }
export let getDeltaResultFromParentChildResponse = function( response, viewModelCollection, data, targetNode ) {
    var loadedViewModelObjects = viewModelCollection.loadedVMObjects;
     var noChildVmos = [];
     var objectsUidsInResponse = new Set();
     getObjectUidsFromResponse(response.parentChildInfos, targetNode, noChildVmos, objectsUidsInResponse);
     var objectsUidsInResponse = [...objectsUidsInResponse];
     var elementsAddedInReponse = getElementsAddedInReponse(loadedViewModelObjects,objectsUidsInResponse);
     if(!(targetNode && targetNode.uid && targetNode.type)){
        var elementsDeletedInReponse = getElementsDeletedInReponse(loadedViewModelObjects,objectsUidsInResponse);
     }
     if(elementsAddedInReponse.length > 0 || (elementsDeletedInReponse && elementsDeletedInReponse.length > 0 ) ){
         addOrRemoveVMOsInViewModelCollection(viewModelCollection,elementsAddedInReponse,elementsDeletedInReponse,response.parentChildInfos,data);
     }
     if(noChildVmos.length > 0){
        _.forEach( noChildVmos, function( child ) {            
            var NodeNdx = viewModelCollection.findViewModelObjectById( child );
            if( NodeNdx !== -1 ) {
                var Node = viewModelCollection.getViewModelObject( NodeNdx );
                if(Node.isLeaf === false){
                    viewModelCollection = _createParentNodeHavingNoChild( Node, viewModelCollection );
                    var gridId = Object.keys( data.grids )[ 0 ];
                    awTableStateService.saveRowCollapsed( data, gridId, Node );
                }
            }
        } );
     }    
};
export let performExpandBelow = function( dataProvider, selected, levelsToExpand, expandBelow, subPanelContext, data ) {
    var sortCriteriaInput = {
        fieldName: 'object_name',
        sortDirection: 'ASC'
    };
    var nLevelExpand = Number( levelsToExpand );
    if( nLevelExpand > 0 ) {
        if(selected && selected.uid){
            var vmoId = dataProvider.viewModelCollection.findViewModelObjectById( selected.uid );
        }
        if( vmoId !== -1 ) {
            var vmo = dataProvider.viewModelCollection.loadedVMObjects[ vmoId ];
        }
        let loadedVMOs = dataProvider.viewModelCollection.loadedVMObjects;
        let nodesToMarkCollapsed = [];
        let nodeToBeCollapsed = [];
        var levelsApplicableForExpansion;
        if(vmo && vmo.$$treeLevel){
            levelsApplicableForExpansion = vmo.$$treeLevel + nLevelExpand;
        } else {
            levelsApplicableForExpansion =  nLevelExpand;
        }
        var newIndex = 1;
        if(vmoId){
            newIndex = newIndex + vmoId;
        }
        for( var indx = newIndex; indx < loadedVMOs.length; indx++ ) {
            if( vmo && vmo.levelNdx && (loadedVMOs[ indx ].levelNdx === vmo.levelNdx) ) {
                break;
            }
            if( loadedVMOs[ indx ].isExpanded === true && loadedVMOs[ indx ].levelNdx === levelsApplicableForExpansion ) {
                purgeExpandedNode( loadedVMOs[ indx ], loadedVMOs, dataProvider, data );
                nodeToBeCollapsed.push( loadedVMOs[ indx ] );
            }
        }
        _.forEach(nodeToBeCollapsed, function(node) {
            setNodeStateToCollapsed( node );
            nodesToMarkCollapsed.push(node);
        });
        if( nodesToMarkCollapsed.length > 0 ) {
            var gridId = Object.keys( data.grids )[ 0 ];
            _.forEach( nodesToMarkCollapsed, function( node ) {
                awTableStateService.saveRowCollapsed( data, gridId, node );
            } );
        }
    }
    var modelObjectsForExpansion = getModelObjectForExpansion( data );
    var SoaInput = {
        input: {
            treeViewType: 'GenViewType',
            propertyName: 'object_name',
            sortCriteria: [sortCriteriaInput],
            filterCriteria: [],
            expansionCriteria: {},
            requestPref: {},
            startIndex: 0,
            maxToReturn: 100
        }
    };
    if(selected && selected.uid && selected.type){
        var targetNode = {
            uid: selected.uid,
            type: selected.type
        };
        SoaInput.input.parentElement = targetNode;
        SoaInput.input.treeViewType = targetNode.type;
    }
    else {
        modelObjectsForExpansion = [];
    }
    SoaInput.input.expansionCriteria = {
        expandBelow: expandBelow,
        expandObjectList: modelObjectsForExpansion,
        numLevelsToExpand: nLevelExpand
    };
    return soaSvc.postUnchecked('Internal-QualityManager-2023-06-QualityDataManagement', 'getQualityObjectTreeData2', SoaInput).then(
        function (response) {
            if (!data.isDestroyed()) {
                getDeltaResultFromParentChildResponse( response, dataProvider.viewModelCollection, data, targetNode );
                appCtxService.getCtx( 'treeVMO' ).update( dataProvider.viewModelCollection.loadedVMObjects );
                declpopupService.close();
            } 
        });
};
export let getExpandedObjects = function(structure, nodeStates, nodes){
    delete structure.childNdx;
    if(_.isEmpty(structure)){
        return;
    }
    for( var subNode in structure ){
        if(subNode in nodeStates) {
            nodes.push(subNode);
        }
        else{
            return;
        }
        getExpandedObjects(structure[subNode], nodeStates, nodes);
    }
};
export let getExpandedNode = function(structure, nodeStates, nodes){
    delete structure.childNdx;
    if(_.isEmpty(structure)){
        return;
    }
    for( var subNode in structure ){
        if(subNode in nodeStates) {
            nodes.push(subNode);
        }
        else{
            continue;
        }
        getExpandedObjects(structure[subNode], nodeStates, nodes);
    }
};
export let getModelObjectForExpansion = function(declViewModel){
    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    var ttState = awTableStateService.getTreeTableState( declViewModel, gridId );
    if( !_.isEmpty( ttState.nodeStates ) && !_.isEmpty( ttState.structure ) ) {
        var nodeStates = [];
        getExpandedNode(ttState.structure,ttState.nodeStates,nodeStates);
    }
    var expandedModelObjects = [];
    _.forEach( nodeStates, function( node ) {
        var cdmobj = cdm.getObject( node );
        var modelObject = {
            uid:node,
            type: cdmobj !== undefined && cdmobj !== '' && cdmobj !== null ? cdmobj.type : ''
        };
        expandedModelObjects.push( modelObject );
    } );    
    return expandedModelObjects;
};
export let performCollapseBelow = function( data,selectedNode,dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = dataProvider.viewModelCollection.loadedVMObjects;
    var gridId = data.grids.checklistSpecTree.gridid;
    const findIndex = function( vmoToFind ) {
        let vmoToRemove = vmc.getViewModelObject( vmc.findViewModelObjectById( vmoToFind.uid ) );
        return _.findLastIndex( loadedVMOs, function( vmo ) {
            if(vmoToRemove){
                return vmo.uid === vmoToRemove.uid;
            }
        } );
    };

    const collapseChildren = function( parentNodeToCollapse ) {
        let collapsedChildren = parentNodeToCollapse.children;
        delete parentNodeToCollapse.isExpanded;
        awTableStateService.saveRowCollapsed( data, gridId, parentNodeToCollapse );
        let index = findIndex( parentNodeToCollapse );
        if(index > -1){
            loadedVMOs[ index ].children = null;
        }
        _.forEach( collapsedChildren, function( childNode ) {
            if( childNode.isLeaf === false ) {
                delete childNode.isExpanded;
                awTableStateService.saveRowCollapsed( data, gridId, childNode );
                collapseChildren( childNode );
            }
            let ndx = findIndex( childNode );
            if( ndx > -1 ) {
                loadedVMOs.splice( ndx, 1 );
            }
        } );
    };
    if( selectedNode && selectedNode.isExpanded ) {
        delete selectedNode.isExpanded;
        collapseChildren( selectedNode );
        let ndx = findIndex( selectedNode );
        if(ndx > -1){
            delete loadedVMOs[ndx].children;
        }
    }
    dataProvider.update( loadedVMOs );
    declpopupService.close();
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
    if(treeLoadInput)
    {
        if( arguments[ 4 ]) {
            treeLoadInput.retainTreeExpansionStates = true;
        }
        var dataProvider = arguments[ 3 ];
        var declViewModel = arguments[ 5 ];
        var subPanelContext = arguments[ 6 ];

        treeLoadInput.sortCriteria = arguments[ 4 ];
    
        appCtxService.ctx.treeVMO = arguments[ 3 ];
        var sortCriteria = appCtxService.getCtx( 'checklistSpecManagerContext' ).sortCriteria;

        if ( arguments[4]) {
            if ( !_.eq( arguments[4], sortCriteria ) ) {
                appCtxService.updatePartialCtx( 'checklistSpecManagerContext.sortCriteria', arguments[4] );
                treeLoadInput.retainTreeExpansionStates = true;
            }
        }

        treeLoadInput.sortCriteria = appCtxService.getCtx( 'checklistSpecManagerContext' ).sortCriteria;
   
        var delayTimeTree = 0;

        for ( var ndx = 0; ndx < arguments.length; ndx++ ) {
            var arg = arguments[ndx];

            if ( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeTree' ) {
                delayTimeTree = arg.dbValue;
            } else if ( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'maxTreeLevel' ) {
                _maxTreeLevel = arg.dbValue;
            }
        }

        /**
         * Check the validity of the parameters
         */
        var deferred = AwPromiseService.instance.defer();


        var modelObjectsForExpansion = getModelObjectForExpansion( declViewModel );
        treeLoadInput.modelObjectsForExpansion = modelObjectsForExpansion;
        if( subPanelContext && subPanelContext.baseSelection ) {
            treeLoadInput.openedObject = {
                uid: subPanelContext.baseSelection.uid,
                type: subPanelContext.baseSelection.type
            };
        }
        return _loadTreeTableRows( deferred, treeLoadInput, arguments[ 7 ], declViewModel,dataProvider );
    }
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 */
/*export let loadTreeTableProperties = function() { // eslint-disable-line no-unused-vars
    
    var propertyLoadInput;

    var delayTimeProperty = 0;

    for ( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ndx];

        if ( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        } else if ( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeProperty' ) {
            delayTimeProperty = arg.dbValue;
        }
    }

    var deferred = AwPromiseService.instance.defer();

  
    if ( delayTimeProperty > 0 ) {
        _.delay( _loadProperties, delayTimeProperty, deferred, propertyLoadInput );
    } else {
        if ( propertyLoadInput ) {
            _loadProperties( deferred, propertyLoadInput );
        }
    }

    return deferred.promise;
};*/
var _getEmptyVmosBasedOnPosition = function( vmNodes, startPos, lastPos, maxPageSize, bufferPageWidth ) {
    var totalNoOfPages = parseInt( vmNodes.length / maxPageSize ) + 1;
    var pageOfStartIndex = parseInt( startPos / maxPageSize ) - bufferPageWidth > 0 ? parseInt( startPos / maxPageSize ) - bufferPageWidth : 0;
    var pageOfEndIndex = parseInt( lastPos / maxPageSize ) + bufferPageWidth < totalNoOfPages ? parseInt( lastPos / maxPageSize ) + bufferPageWidth : totalNoOfPages;
    var page = {
        startIndex: -1,
        endIndex: -1,
        emptyVmos: []
    };
    page.startIndex = pageOfStartIndex * maxPageSize;
    page.endIndex = ( pageOfEndIndex + 1 ) * maxPageSize;
    for( var inx = page.startIndex; inx < page.endIndex; ++inx ) {
        var vmo = vmNodes[ inx ];
        if( !_.isUndefined( vmo ) && _.isUndefined( vmo.props ) && page.emptyVmos.length < maxPageSize ) {
            page.emptyVmos.push( vmo );
        }
    }
    return page;
};
var _isScrolledPagePropertyLoadIsInProgress = function( vmc, scrollPosition ) {
    for( var inx = scrollPosition.firstIndex; inx <= scrollPosition.lastIndex; ++inx ) {
        var vmo = vmc.getViewModelObject( inx );
        if( !_.isUndefined( vmo ) && ( _.isUndefined( vmo.props ) || vmo.props.length === 0 ) ) {
            return true;
        }
    }
    return false;
};
var _bufferProperties = function( contextKey, declViewModel, uwDataProvider, uwPropertyProvider, emptyVmos ) {
    if( _.isUndefined( declViewModel ) || _.isUndefined( uwDataProvider ) || _.isUndefined( uwPropertyProvider ) ) {
        return;
    }
    if( _.isUndefined( emptyVmos ) || !_.isUndefined( emptyVmos.length ) && emptyVmos.length <= 0 ) {
        return;
    }
    var columnInfos = [];

    _.forEach( uwDataProvider.cols, function( columnInfo ) {
        if( !columnInfo.isTreeNavigation ) {
            columnInfos.push( columnInfo );
        }
    } );
    var propertyLoadRequest = {
        parentNode: null,
        childNodes: emptyVmos,
        columnInfos: columnInfos
    };
    var dataCtxNode = {
        data: declViewModel,
        ctx: appCtxService.ctx,
        $parent: {
            contextKey: contextKey
        }
    };
    var propertyLoadInput = awTableSvc.createPropertyLoadInput( [ propertyLoadRequest ] );
    return uwPropertyProvider.getProperties( dataCtxNode, propertyLoadInput );
};
var _getBufferPageSize = function() {
    return 400;
};
export let bufferExtraPages = function( declViewModel, uwDataProvider, uwPropertyProvider, scrollEventData ) {
    var maxPageSize = _getBufferPageSize();
    if( maxPageSize <= 0 ) { // property load buffering is disabled.
        return AwPromiseService.instance.resolve( null );
    }

    if( !_.isUndefined( uwDataProvider ) && !_.isUndefined( uwDataProvider.bufferExtraPagesInProgress ) && uwDataProvider.bufferExtraPagesInProgress === true ) {
        return AwPromiseService.instance.resolve( null );
    }
    
    if( _.isUndefined( declViewModel ) || _.isUndefined( uwDataProvider ) || _.isUndefined( uwPropertyProvider ) ||
        _.isUndefined( scrollEventData ) || _.isUndefined( scrollEventData.firstRenderedItem ) || _.isUndefined( scrollEventData.lastRenderedItem ) ) {
        return AwPromiseService.instance.resolve( null );
    }

    // if scroll position has not changed then no action to be done
    if( !_.isUndefined( uwDataProvider ) && !_.isUndefined( uwDataProvider.scrollPosition ) &&
        ( uwDataProvider.scrollPosition.firstIndex === scrollEventData.firstRenderedItem.index ||
            uwDataProvider.scrollPosition.lastIndex === scrollEventData.lastRenderedItem.index ) ) {
        return AwPromiseService.instance.resolve( null );
    }
     
    uwDataProvider.scrollPosition = {
        firstIndex: scrollEventData.firstRenderedItem.index,
        lastIndex: scrollEventData.lastRenderedItem.index
    };
    var vmc = uwDataProvider.viewModelCollection;
    if( _.isUndefined( vmc ) || _.isUndefined( vmc.loadedVMObjects ) || vmc.loadedVMObjects.length <= 0 ) {
        return AwPromiseService.instance.resolve( null );
    }
    if( _isScrolledPagePropertyLoadIsInProgress( vmc, uwDataProvider.scrollPosition ) ) {
        return AwPromiseService.instance.resolve( null );
    }
    var empyVmoPage;
    var bufferPageWidth = 1;
    do {
        empyVmoPage = _getEmptyVmosBasedOnPosition( vmc.loadedVMObjects, uwDataProvider.scrollPosition.firstIndex, uwDataProvider.scrollPosition.lastIndex, maxPageSize, bufferPageWidth );
        bufferPageWidth++; // increase buffer page width to attempt bufferring of broader data around scroll
    } while( empyVmoPage.emptyVmos.length < maxPageSize && ( empyVmoPage.endIndex < vmc.loadedVMObjects.length || 0 !== empyVmoPage.startIndex ) );
    var emptyVmos = empyVmoPage.emptyVmos;
    if(uwDataProvider.columnConfig === undefined && vmc.loadedVMObjects.length === 1){
        emptyVmos = vmc.loadedVMObjects;
    }
    if( emptyVmos.length > 0 ) {
        var promise = _bufferProperties( 'search', declViewModel, uwDataProvider, uwPropertyProvider, emptyVmos );
        if( !_.isUndefined( promise ) && promise !== null ) {
            uwDataProvider.bufferExtraPagesInProgress = true;
            promise.then( function() {
                uwDataProvider.bufferExtraPagesInProgress = false;
            }, function() {
                uwDataProvider.bufferExtraPagesInProgress = false;
            } ).catch( function() {
                uwDataProvider.bufferExtraPagesInProgress = false;
            } );
            return promise;
        }
    } 
    return AwPromiseService.instance.resolve( null );
};
var _getInitialPropertyLoadPageSize = function() {
    var initialPropLoadPageSize = 100; // default page size    
    return initialPropLoadPageSize;
};
var addExtraBufferToPage = function( input, uwDataProvider, allVMNodes ) {
    var firstPageSize = _getInitialPropertyLoadPageSize();
    if( firstPageSize <= 0 ) { // initial property load buffering is disabled.
        return;
    }
    if( _.isUndefined( input ) || _.isUndefined( uwDataProvider ) ) {
        return;
    }
    var vmNodes = {};

    if (!_.isUndefined(input.propertyLoadInput) && !_.isUndefined(input.propertyLoadInput.propertyLoadRequests) &&
        !_.isEmpty(input.propertyLoadInput.propertyLoadRequests)) {
        vmNodes = input.propertyLoadInput.propertyLoadRequests[0].childNodes;
    } else if (!_.isUndefined(input.vmNodes)) {
        vmNodes = input.vmNodes;
    }
    if(vmNodes) {
        var topNodeindex = vmNodes.findIndex(function (node) {
            return node.displayName === 'top';
        });
    }
    if (_.isUndefined(vmNodes) || _.isEmpty(vmNodes) || vmNodes === null || firstPageSize <= vmNodes.length) {
        return;
    }
    if (_.isUndefined(allVMNodes)) {
        var vmc = uwDataProvider.viewModelCollection;
        if (_.isUndefined(vmc)) {
            return;
        }
        allVMNodes = vmc.loadedVMObjects;
    }

    var vmoStartIndex = allVMNodes.indexOf(vmNodes[0]);
    var vmoLastIndex = allVMNodes.indexOf(vmNodes[vmNodes.length - 1]);
    var bufferPageWidth = 1;
    var empyVmoPage = _getEmptyVmosBasedOnPosition(allVMNodes, vmoStartIndex, vmoLastIndex, firstPageSize, bufferPageWidth);
    _.forEach(empyVmoPage.emptyVmos, function (vmo) {
        var nodeFoundInInput = _.find(vmNodes, function (inputVmo) {
            return inputVmo.uid === vmo.uid;
        });
        if (_.isUndefined(nodeFoundInInput)) {
            vmNodes.push(vmo);
        }
    });
};
export let updateColumnPropsAndNodeIconURLs = function (propColumns, childNodes) {
    _.forEach(propColumns, function (col) {
        if (!col.typeName && col.associatedTypeName) {
            col.typeName = col.associatedTypeName;
        }
    });
    propColumns[0].enableColumnMoving = false;
    _firstColumnConfigColumnPropertyName = propColumns[0].propertyName;
    _.forEach(childNodes, function (childNode) {
        childNode.iconURL = awIconService.getTypeIconFileUrl(childNode);
        treeTableDataService.updateVMODisplayName(childNode, _firstColumnConfigColumnPropertyName);
    });
};
 function getDataForUpdateColumnPropsAndNodeIconURLs() {
    var updateColumnPropsCallback = {};
    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response ) {
        updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes );
        return response.output.columnConfig;
};

    return updateColumnPropsCallback;
}
 export let loadTreeTableProperties = function() {
    appCtxService.registerCtx( 'search.context.columnsToExclude', [] ); 
    arguments[ 0 ].updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs();
    if( _.isUndefined( arguments[ 0 ].skipExtraBuffer ) || arguments[ 0 ].skipExtraBuffer === false ) {
        addExtraBufferToPage( { propertyLoadInput: arguments[ 0 ].propertyLoadInput }, arguments[ 0 ].uwDataProvider );
    }
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) );
};
/**
 * This wll close any tools and info panel if any open
 * @param {object} data data of viewmodel
 */
export let selectionChanged = function( data,subPanelContext,selectionModel ) {
    /*appCtxService.updateCtx( 'createdObjectForTreeFromAddAction', undefined );
    appCtxService.updateCtx( 'AddSpecificationFlagForTree', false );
    appCtxService.updateCtx( 'versionCreatedFlag', false );*/

    var selectedNodes = data.eventData.selectedObjects;
    appCtxService.updateCtx( 'currentSelectedNodesForPinUnpin', selectedNodes );

    if ( selectedNodes.length > 0 ) {
        if ( appCtxService.ctx.checklistSpecManagerContext === undefined ||
            appCtxService.ctx.checklistSpecManagerContext === '' ) {
            appCtxService.ctx.checklistSpecManagerContext = {};
        }
    }
    appCtxService.updateCtx( 'checklistSpecManagerContext.selectedNodes', selectedNodes );
   
    var navigationParam = {};
    if ( appCtxService.ctx.currentTypeSelection ) {
        navigationParam.selectedType = appCtxService.ctx.currentTypeSelection.dbValue;
    }
    var selectedObj = selectedNodes[0];
    if ( selectedObj && selectedObj.hasOwnProperty( 'uid' ) ) {
        navigationParam.s_uid = selectedObj.uid;
    }
    if ( navigationParam.hasOwnProperty( 's_uid' ) ) {
        var action = {
            actionType: 'Navigate',
            navigateTo: '#/showChecklistsSpecs'
        };
        navigationSvc.navigate( action, navigationParam );
    }
};
/**
  * @param {string} - name - name of queryparameter like - uid
  * @returns {string} - returns query parameter value
  **/
export let getQueryParamValue = function( name ) {
    var browserUrl = window.location.href;
    name = name.replace( /[\[]/, '\\\[' ).replace( /[\]]/, '\\\]' );
    var regexS = '[\\?&]' + name + '=([^&#]*)';
    var regex = new RegExp( regexS );
    var results = regex.exec( browserUrl );
    return results === null ? null : results[1];
};
/**
 * This makes sure, edited object is selected
 * @param {data} data
 * @param {ArrayList} selectionModel selection model of pwa
 */
export let processPWASelection = function( searchState, selectionModel, pinUnpinnedFlag, data ) {

    let searchData = {};
    if(searchState){
        searchData = { ...searchState.value };
    }
    var pwaSelectionUid = [];
    var viewModelCollection = data.dataProviders.checklistSpecDataProvider.viewModelCollection;
    var url = window.location.href;
    if ( url.indexOf( 's_uid' ) > -1 && !(searchData && searchData.newlyCreatedObjectFromCharLib) ){
        var s_uid = getQueryParamValue( 's_uid' );
        pwaSelectionUid.push( s_uid );
    }

    if ( !pinUnpinnedFlag && searchData && searchData.newlyCreatedObjectFromCharLib ) {
        selectionModel.setSelection( searchData.newlyCreatedObjectFromCharLib );
        if( searchState ) {
            let searchData = { ...searchState.value };
            searchData.newlyCreatedObjectFromCharLib = "";
            searchState.update( { ...searchData } );
        }
    }else if( !pinUnpinnedFlag && !searchData.newlyCreatedObjectFromCharLib && pwaSelectionUid ) {
        var selectedObject = cdm.getObject( pwaSelectionUid[0] );
        if(selectedObject){
            selectionModel.setSelection( selectedObject );
        } else {
            selectionModel.setSelection( pwaSelectionUid );
        }
        
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

/**
 * Update selected nodes in context based on pin value
 * selected node set as new object if panelPinned is true
 * selected node set as current selection if panelPinned is false
 * @param {DeclViewModel} data
 */
export let selectNewlyAddedElement = function( data, subPanelContext ) {
    appCtxService.ctx.checklistSpecManagerContext = {};
    appCtxService.ctx.checklistSpecManagerContext.selectedNodes = [];
    if ( subPanelContext && !subPanelContext.panelPinned ) {
        appCtxService.ctx.checklistSpecManagerContext.selectedNodes = data.selectedNodes;
    } else {
        if ( appCtxService.ctx.selected ) {
            appCtxService.ctx.checklistSpecManagerContext.selectedNodes.push( appCtxService.ctx.selected );
        }
    }
};

export default exports = {
    createVmNodeUsingNewObjectInfo,
    loadTreeTableColumns,
    loadTreeTableData,
    loadTreeTableProperties,
    processPWASelection,
    selectNewlyAddedElement,
    addNodeToExpansionState,
    bufferExtraPages,
    getModelObjectForExpansion,
    createVmNodeUsingNewObjectInfoFromSOAResponse,
    performCollapseBelow,
    performExpandBelow,
    getDeltaResultFromParentChildResponse,
    updateColumnPropsAndNodeIconURLs,
    updateDisplayNames,
    selectionChanged
};
