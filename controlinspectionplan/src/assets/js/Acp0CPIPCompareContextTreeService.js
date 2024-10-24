// @<COPYRIGHT>@
// ==================================================
// Copyright 2022
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Acp0CPIPCompareContextTreeService
 */
import app from 'app';
import appCtxService from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import iconSvc from 'js/iconService';
import messagingService from 'js/messagingService';
import uwPropertySvc from 'js/uwPropertyService';
import soaSvc from 'soa/kernel/soaService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';
import _localeSvc from 'js/localeService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

const MESSAGE_File = '/i18n/ControlInspectionPlanMessages';

var _maxTreeLevel = 3;
var _mapNodeId2ChildArray = {};
var exports = {};

/**
 * Load and get the children nodes of tree table structure.
 *
 * @param {parentNode} parentNode -
 * @param {children} children -
 * @param {isLoadAllEnabled} isLoadAllEnabled -
 * @param {treeLoadInput} treeLoadInput -
 * @param {startReached} startReached -
 * @param {endReached} endReached -
 * @param {newColumns} newColumns -
 * @return {awTableSvc.buildTreeLoadResult} awTableSvc.buildTreeLoadResult -
 **/
function _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, startReached, endReached, newColumns ) {
    /**
     * Build tree table structure with children nodes.
     **/
    _buildTreeTableStructure( newColumns, parentNode, children, isLoadAllEnabled );

    var mockChildNodes = _mapNodeId2ChildArray[parentNode.id];
    var tempCursorObject = {
        endReached: endReached,
        startReached: startReached
    };

    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, true, startReached, endReached, null );

    treeLoadResult.parentNode.cursorObject = tempCursorObject;

    return treeLoadResult;
}

/**
 * Load the data into tree table structure.
 *
 * @param {AwTableColumnInfoArray} columnInfos - Array of column information objects to use when building the
 *            table rows.
 * @param {ViewModelTreeNode} parentNode - A node that acts 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {Number} nChildren - The # of child nodes to add to the given 'parent'.
 * @param {Boolean} isLoadAllEnabled - TRUE if all properties should be included.
 * @param {response} response
 **/
var _buildTreeTableStructure = function( columnInfos, parentNode, response, isLoadAllEnabled ) {
    var children = [];
    var modelObjects = response;
    _mapNodeId2ChildArray[parentNode.id] = children;
    if ( modelObjects ) {
        var levelNdx = parentNode.levelNdx + 1;
        for ( var childNdx = 1; childNdx <= modelObjects.length; childNdx++ ) {
            var vmNode = exports.createVmNodeUsingNewObjectInfo( modelObjects[childNdx - 1], levelNdx, childNdx, isLoadAllEnabled, columnInfos );
            children.push( vmNode );
        }
    }
    return children;
};

/**
 * This function is required to set the unique alteranate id to each tree node which is used
 * if we add same ocurrance of object multiple times at different/same places in tree
 **/
let getAlternateId = function( vmNode, modelObject ) {
    var alternateID = vmNode.uid;
    if( modelObject.targetOccUid ) {
        alternateID += '_' + modelObject.targetOccUid;
    } else if( modelObject.sourceElement ) {
        alternateID += '_' + modelObject.sourceElement.uid;
    }
    if( modelObject.targetParentOccUid ) {
        alternateID += '_' + modelObject.targetParentOccUid;
    } else if( modelObject.sourceParentElement ) {
        alternateID += '_' + modelObject.sourceParentElement.uid;
    }
    alternateID += '_' + modelObject.objIndex;
    return alternateID;
};

/**
 * Create tree table structure node using object information.
 **/
export let createVmNodeUsingNewObjectInfo = function( modelObject, levelNdx, childNdx, isLoadAllEnabled, columnInfos ) {
    /**
     * Take data to create node.
     **/
    var nodeDisplayName = modelObject.elementId;
    if ( modelObject.props.object_string ) {
        nodeDisplayName = modelObject.props.object_string.uiValues[0];
    }
    var nodeId = modelObject.uid;
    var type = modelObject.type;
    var iconURL = iconSvc.getTypeIconURL( type );

    /**
     * Define node.
     **/
    var vmNode = awTableTreeSvc.createViewModelTreeNode( nodeId, type, nodeDisplayName, levelNdx, childNdx, iconURL );
    if ( modelObject.hasNonAlignedChild ) {
        vmNode.isLeaf = false;
    } else {
        vmNode.isLeaf = true;
    }

    vmNode.alternateID = getAlternateId( vmNode, modelObject );
    vmNode.selected = false;
    vmNode.props = {};

    /**
     * Add node into tree table structure.
     **/
    _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, modelObject );

    return vmNode;
};

/**
 * Show message in case of CPIP and FMEA structures are identical.
 */
var showNoDiffNotification = function() {
    let resource = app.getBaseUrlPath() + MESSAGE_File;
    let localTextBundle = _localeSvc.getLoadedText( resource );
    let cpipFmeaIdenticalNotifyMsg = localTextBundle.Acp0CpipFmeaIdenticalNotify;
    messagingService.showInfo( cpipFmeaIdenticalNotifyMsg );
};

/**
 * Load tree table columns with localized columns title.
 *
 * @param {object}  i18n - i18n Values
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
let loadTreeTableColumns = function( i18n ) {
    var awColumnInfos = [];
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'differenceType',
        displayName: i18n.Acp0DifferenceType,
        width: 250,
        minWidth: 150,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_name',
        displayName: i18n.Acp0ObjectName,
        width: 375,
        minWidth: 215,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_desc',
        displayName: i18n.Acp0ObjectDesc,
        width: 375,
        minWidth: 215,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'elementId',
        displayName: i18n.Acp0ItemId,
        width: 150,
        minWidth: 100,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: false
    } ) );
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
export let loadTreeTableData = async function() {
    appCtxService.updatePartialCtx( 'enableAlignCmd', true );
    /**
     * Extract action parameters from the arguments to this function.
     */
    var treeLoadInput = arguments[0];
    if ( arguments[3] ) {
        treeLoadInput.retainTreeExpansionStates = true;
    }
    appCtxService.ctx.treeVMO = arguments[1];

    /**
      * Check the validity of the parameters.
      */
    var deferred = AwPromiseService.instance.defer();

    let dataProvider = arguments[1];
    let i18n = arguments[2];

    var newTreeLoadResult = await loadData( treeLoadInput, i18n, dataProvider );

    return { treeLoadResult:newTreeLoadResult };
};

/**
 * Load the 'next' page of 'children' nodes of the given 'parent' in tree table structure.
 * Note: The paging status is maintained in the 'parent' node.
 * @param {treeLoadInput} treeLoadInput
 * @param {i18n} i18n
 * @param {dataProvider} dataProvider
 * @returns {treeLoadResult}treeLoadResult
 */
async function loadData( treeLoadInput, i18n, dataProvider ) {
    /**
     * Take 'children' nodes of the given 'parent' if it is not a leaf node i.e. it has children.
     */
    var parentNode = treeLoadInput.parentNode;

    if ( !parentNode.isLeaf ) {
        /**
         * Take source and target objects.
         */
        var children = [];
        var isLoadAllEnabled = true;
        let targetOccUid = '';
        let sourceObject = parentNode;
        let targetObject = parentNode;
        let sourceElement = parentNode;
        let targetElement = parentNode;
        let topObjectsSelected = parentNode.levelNdx < 0;
        if ( topObjectsSelected ) {
            var contextObject = cdm.getObject( parentNode.uid );
            sourceObject = cdm.getObject( contextObject.props.aqc0SourceContext.dbValues[0] );
            targetObject = cdm.getObject( contextObject.props.aqc0TargetContext.dbValues[0] );
            sourceElement = sourceObject;
            targetElement = targetObject;
        } else {
            sourceObject = parentNode.props.sourceObject.dbValues[0];
            targetObject = parentNode.props.targetObject.dbValues[0];
            sourceElement = parentNode.props.sourceElement.dbValues[0];
            targetElement = parentNode.props.targetElement.dbValues[0];
            targetOccUid = parentNode.props.targetOccUid.dbValues[0];
        }

        /**
         * Build the SOA input to take compare results.
         */
        var soaInput2 =
        {
            input: {
                sourceFMEAObject: {
                    uid: sourceObject.uid,
                    type: sourceObject.type
                },
                targetControlPlanRev: {
                    uid: targetObject.uid,
                    type: targetObject.type
                },
                focusSourceElement: {
                    uid: sourceElement.uid,
                    type: sourceElement.type
                },
                focusTargetElement: {
                    uid: targetElement.uid,
                    type: targetElement.type
                },
                focusTargetOccUid: targetOccUid,
                useSourceObjectRevision: 'USE_SELECTED_REV',
                searchInput:
                {
                    searchCriteria: {},
                    cursor:
                    {
                        startIndex: treeLoadInput.startChildNdx
                    },
                    maxToReturn: 100,
                    maxToLoad: 100,
                    searchSortCriteria: []
                }
            }
        };

        /**
         * Load tree table columns with localized columns title.
         */
        const colDefs = loadTreeTableColumns( i18n );
        dataProvider.columnConfig = { columns: colDefs.columns };

        /**
         * Take children of selected object.
         */
        if ( parentNode.levelNdx < _maxTreeLevel ) {
            /**
             * Execute SOA to process and get compare results.
             */
            const response =  await soaSvc.postUnchecked( 'Internal-ControlPlan-2022-12-ControlPlanManagement', 'processCompareResultOfCPIPWithFMEA', soaInput2 );

            if ( response.compareResults.length > 0 ) {
                let compareResults = response.compareResults;
                for ( var objIndex = 0; objIndex < compareResults.length; ++objIndex ) {
                    /**
                     * Take localized difference type.
                     */
                    let resource = app.getBaseUrlPath() + MESSAGE_File;
                    let localTextBundle = _localeSvc.getLoadedText( resource );
                    let differenceType = '';
                    let compareVerdict = compareResults[objIndex].differenceType;
                    if ( compareVerdict === 'OnlyInTarget' ) {
                        differenceType = localTextBundle.Acp0OnlyInTarget;
                    } else if ( compareVerdict === 'MissingInTarget' ) {
                        differenceType = localTextBundle.Acp0MissingInTarget;
                    } else if ( compareVerdict === 'MetaModified' ) {
                        differenceType = localTextBundle.Acp0MetaModified;
                    } else if ( compareVerdict === 'StructureModified' ) {
                        differenceType = localTextBundle.Acp0StructureModified;
                    } else if ( compareVerdict === 'MetaAndStructureModified' ) {
                        differenceType = localTextBundle.Acp0MetaAndStructureModified;
                    } else if ( compareVerdict === 'RefObjModified' ) {
                        differenceType = localTextBundle.Acp0RefObjModified;
                    } else if ( compareVerdict === 'PropAndRefObjModified' ) {
                        differenceType = localTextBundle.Acp0PropAndRefObjModified;
                    } else if ( compareVerdict === 'RefObjAndStructureModified' ) {
                        differenceType = localTextBundle.Acp0RefObjAndStructureModified;
                    } else if ( compareVerdict === 'PropRefObjAndStructureModified' ) {
                        differenceType = localTextBundle.Acp0PropRefObjAndStructureModified;
                    }

                    /**
                     * Build child object.
                     */
                    let focusObject = compareResults[objIndex].targetElement;
                    if ( focusObject.type === 'unknownType' || compareVerdict === 'MissingInTarget' ) {
                        focusObject = compareResults[objIndex].sourceElement;
                    }
                    let tempobj = cdm.getObject( focusObject.uid );
                    let obj = {};
                    let props = tempobj.props;
                    obj.objIndex = objIndex;
                    obj.sourceParentElement = soaInput2.input.focusSourceElement;
                    obj.targetParentElement = soaInput2.input.focusTargetElement;
                    obj.targetParentOccUid = soaInput2.input.focusTargetOccUid;
                    obj.sourceObject = sourceObject;
                    obj.targetObject = targetObject;
                    obj.sourceElement = compareResults[objIndex].sourceElement;
                    obj.targetElement = compareResults[objIndex].targetElement;
                    obj.targetOccUid = compareResults[objIndex].targetOccUid;
                    obj.elementId = compareResults[objIndex].elementId;
                    obj.differenceType = differenceType;
                    obj.hasNonAlignedChild = compareResults[objIndex].hasNonAlignedChild;
                    obj.props = props;
                    obj.uid = tempobj.uid;
                    children.push( obj );
                }
            }

            /**
             * Load data into difference summary view.
             */
            var endReached = response.cursor.endReached;
            var startReached = response.cursor.startReached;
            if ( response.totalFound === 0 ) {
                /**
                 * Show message if both structures are identical.
                 */
                if ( topObjectsSelected ) {
                    showNoDiffNotification();
                }

                /**
                 * Build the tree table structure with children nodes with its compare verdict.
                 */
                parentNode.isLeaf = true;
                var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, startReached,
                    endReached, null );
                return {
                    parentNode : treeLoadResult.parentNode,
                    childNodes : treeLoadResult.childNodes,
                    totalChildCount: treeLoadResult.totalChildCount,
                    startChildNdx : treeLoadResult.startChildNdx
                };
            }

            var treeLoadResult = _getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, startReached, endReached, colDefs.columns );
            return {
                parentNode : treeLoadResult.parentNode,
                childNodes : treeLoadResult.childNodes,
                totalChildCount: treeLoadResult.totalChildCount,
                startChildNdx : treeLoadResult.startChildNdx
            };
        }

        /**
         * Build the tree table structure with children nodes with its compare verdict.
         */
        parentNode.isLeaf = true;
        var mockChildNodes = _mapNodeId2ChildArray[parentNode.id];
        var endReached = parentNode.endReached;
        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, mockChildNodes, true, true,
            endReached, null );
        return {
            parentNode : treeLoadResult.parentNode,
            childNodes : treeLoadResult.childNodes,
            totalChildCount: treeLoadResult.totalChildCount,
            startChildNdx : treeLoadResult.startChildNdx
        };
    }
}

/**
 * Create view model property.
 *
 * @param {propName} propName -
 * @param {value} value -
 * @param {displayName} displayName -
 * @return {type} type
 */
function _createViewModelProperty( propName, value, displayName, type ) {
    /**
     * Create view model property.
     */
    var vmProp = uwPropertySvc.createViewModelProperty( propName, displayName, type, value, value );

    /**
     * Set properties into view model.
     */
    vmProp.dbValues = [ value ];
    vmProp.uiValues = [ value ];
    vmProp.uiValue = value;

    vmProp.propertyDescriptor = {
        displayName: displayName
    };
    uwPropertyService.setIsPropertyModifiable( vmProp, false );

    return vmProp;
}

/**
 * Populate table columns.
 *
 * @param {Boolean} isLoadAllEnabled -
 * @param {ViewModelTreeNode} vmNode -
 * @param {Number} childNdx -
 * @param {modelObject} modelObject -
 **/
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode, childNdx, modelObject ) {
    if ( isLoadAllEnabled ) {
        if ( !vmNode.props ) {
            vmNode.props = {};
        }

        if ( modelObject ) {
            vmNode.props.objIndex = _createViewModelProperty( 'objIndex', modelObject.objIndex, '', 'WorkspaceObject' );
            vmNode.props.sourceObject = _createViewModelProperty( 'sourceObject', modelObject.sourceObject, '', 'WorkspaceObject' );
            vmNode.props.targetObject = _createViewModelProperty( 'targetObject', modelObject.targetObject, '', 'WorkspaceObject' );
            vmNode.props.sourceElement = _createViewModelProperty( 'sourceElement', modelObject.sourceElement, '', 'WorkspaceObject' );
            vmNode.props.targetElement = _createViewModelProperty( 'targetElement', modelObject.targetElement, '', 'WorkspaceObject' );
            vmNode.props.targetParentOccUid = _createViewModelProperty( 'targetParentOccUid', modelObject.targetParentOccUid, '', 'String' );
            vmNode.props.sourceParentElement = _createViewModelProperty( 'sourceParentElement', modelObject.sourceParentElement, '', 'WorkspaceObject' );
            vmNode.props.targetParentElement = _createViewModelProperty( 'targetParentElement', modelObject.targetParentElement, '', 'WorkspaceObject' );
            vmNode.props.targetOccUid = _createViewModelProperty( 'targetOccUid', modelObject.targetOccUid, '', 'String' );
            vmNode.props.differenceType = _createViewModelProperty( 'differenceType', modelObject.differenceType, '', 'String' );
            vmNode.props.elementId = _createViewModelProperty( 'elementId', modelObject.elementId, '', 'String' );
            vmNode.props.hasNonAlignedChild = _createViewModelProperty( 'hasNonAlignedChild', modelObject.hasNonAlignedChild, '', 'BOOLEAN' );
        }

        var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( vmNode.uid ), 'EDIT' );
        tcViewModelObjectService.mergeObjects( vmNode, vmo );
    }
}

/**
 * Load table properties.
 *
 * @param {deferred} deferred -
 * @param {propertyLoadInput} propertyLoadInput -
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
 *  Load tree table properties.
 *
 * @returns {Promise} AwPromise -
 */
export let loadTreeTableProperties = function() {
    var propertyLoadInput;
    var delayTimeProperty = 0;

    for ( var ndx = 0; ndx < arguments.length; ndx++ ) {
        if ( arguments[ndx] && arguments[ndx].propertyLoadRequests && arguments[ndx].propertyLoadRequests[0] && arguments[ndx].propertyLoadRequests[0].childNodes &&
            arguments[ndx].propertyLoadRequests[0].childNodes.length > 0 ) {
            var updatedChildNodes = [];
            for ( var i = 0; i < arguments[ndx].propertyLoadRequests[0].childNodes.length; i++ ) {
                updatedChildNodes.push( arguments[ndx].propertyLoadRequests[0].childNodes[i] );
            }
            arguments[ndx].propertyLoadRequests[0].childNodes = updatedChildNodes;
        }

        var arg = arguments[ndx];

        if ( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        } else if ( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeProperty' ) {
            delayTimeProperty = arg.dbValue;
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

export default exports = {
    createVmNodeUsingNewObjectInfo,
    loadTreeTableProperties,
    loadTreeTableData
};

/**
 * @memberof NgServices
 * @member Acp0CPIPCompareContextTreeService
 */
app.factory( 'Acp0CPIPCompareContextTreeService', () => exports );

