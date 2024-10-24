// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0TreeDataService
 */
import AwPromiseService from 'js/awPromiseService';
import uwPropertySvc from 'js/uwPropertyService';
import awColumnSvc from 'js/awColumnService';
import addElementTypeHandler from 'js/addElementTypeHandler';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import rmTreeDataService from 'js/Arm0ImportPreviewJsonHandlerService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import importPreviewService from 'js/ImportPreview';
import cmm from 'soa/kernel/clientMetaModel';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';


var _updatePreview = false;

var exports = {};
var REQUIREMENT = 'Requirement';

/**
  * Cached static default AwTableColumnInfo.
  */
var _treeTableColumnInfos = null;

/**
  */
var _maxTreeLevel = 3;
var rootID = null;
var compareClick;
var deriveAndMergeClick;

/**
  * @param {data} data - data Object
  * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
  */
function _getTreeTableColumnInfos( data ) {
    if( !_treeTableColumnInfos || compareClick !== appCtxSvc.getCtx( 'compareClick' ) || deriveAndMergeClick !== appCtxSvc.getCtx( 'deriveAndMergeClick' ) ) {
        _treeTableColumnInfos = _buildTreeTableColumnInfos( data );
    }

    return {
        columns: _treeTableColumnInfos
    };
}

/**
  *  @param {data} data - data Object
  * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
  */
function _buildTreeTableColumnInfos( data ) {
    var columnInfos = [];
    /**
      * Set 1st column to special 'name' column to support tree-table.
      */
    var propName;
    var propDisplayName;
    var isTreeNavigation;
    var width;
    var minWidth;
    compareClick = appCtxSvc.getCtx( 'compareClick' );
    deriveAndMergeClick = appCtxSvc.getCtx( 'deriveAndMergeClick' );
    let isRoundTripPreview = appCtxSvc.ctx.sublocation.clientScopeURI === 'RequirementRoundTripPreviewURI';
    var colNdxLength = deriveAndMergeClick || isRoundTripPreview ? 3 : 2;
    if( compareClick ) {
        colNdxLength = 4;
    }
    var  type = cmm.getType( 'ItemRevision' );
    var propTypeDisplayName = type && type.propertyDescriptorsMap && type.propertyDescriptorsMap.release_status_list ? type.propertyDescriptorsMap.release_status_list.displayName : 'object_release_status';

    for( var colNdx = 0; colNdx < colNdxLength; colNdx++ ) {
        /**
          * @property {Number|String} width - Number of pixels
          * @memberOf module:js/awColumnService~AwTableColumnInfo
          */
        if( colNdx === 0 ) {
            propName = 'object_name';
            propDisplayName = data.i18n.nameLabel;
            isTreeNavigation = true;
            width = 250;
            minWidth = 150;
        } else if( colNdx === 1 ) {
            propName = 'object_type';
            propDisplayName = data.i18n.specType;
            isTreeNavigation = false;
            minWidth = 120;
            width = 120;
        } else if( colNdx === 2 ) {
            //For Doc Compare
            propName = 'object_action';
            propDisplayName = data.i18n.actionLabel;
            isTreeNavigation = false;
            minWidth = 120;
            width = 120;
        } else if( colNdx === 3 ) {
            propName = 'object_release_status';
            propDisplayName = propTypeDisplayName;
            isTreeNavigation = false;
            minWidth = 120;
            width = 120;
        }

        var columnInfo = awColumnSvc.createColumnInfo();

        /**
          * Set values for common properties
          */
        columnInfo.name = propName;
        columnInfo.displayName = propDisplayName;
        columnInfo.enableFiltering = true;
        columnInfo.isTreeNavigation = isTreeNavigation;
        columnInfo.width = width;
        columnInfo.minWidth = minWidth;

        /**
          * Set values for un-common properties
          */
        columnInfo.typeName = 'String';
        columnInfo.enablePinning = true;
        columnInfo.enableSorting = true;
        columnInfo.enableCellEdit = true;
        columnInfo.enableColumnHiding = false;
        var enableColumnResizing = true;
        if( colNdxLength - 1 === colNdx ) {
            enableColumnResizing = false;   // No resize for last column
        }
        columnInfo.enableColumnResizing = enableColumnResizing;

        columnInfos.push( columnInfo );
    }

    return columnInfos;
}

/**
  * @param {AwTableColumnInfoArray} columnInfos - Array of column information objects to use when building the
  *            table rows.
  * @param {ViewModelTreeNode} parentNode - A node that acts 'parent' of a hierarchy of 'child'
  *            ViewModelTreeNodes.
  * @param {Boolean} isLoadAllEnabled - TRUE if all properties should be included.
  * @param {data} data -  View Model data
  */
function _buildTreeTableStructure( columnInfos, parentNode, isLoadAllEnabled, data ) {
    var children;
    var key;
    var vmNodes = [];
    var newChildren;
    if( parentNode.id === 'top' ) {
        key = rootID;
    } else {
        key = parentNode.id;
    }
    var sortCriteria =  data.grids.importPreviewTreeTable.columnProviderInstance.sortCriteria;
    children = rmTreeDataService.getIdToChildrenMapData( key );
    newChildren = _.cloneDeep( children );

    for( var i = 0; i < newChildren.length; i++ ) {
        var name = newChildren[i].hierarchyNumber + ' ' + newChildren[i].name;
        newChildren[i].name = name;
    }
    if( sortCriteria && sortCriteria.length > 0 && sortCriteria[0].sortDirection && ( sortCriteria[0].sortDirection  === 'ASC' || sortCriteria[0].sortDirection  === 'DESC' ) ) {
        newChildren = filterRowsWithSort( newChildren, data );
    }

    var levelNdx = parentNode.levelNdx + 1;
    for( var i = 0; i < newChildren.length; i++ ) {
        /**
          * Create a new node for this level. and Create props for it
          */
        var node = newChildren[ i ];
        var childNumber = i + 1;
        var name = node.name;
        var type = node.type ? node.type : node.internalType;
        var iconURL = iconSvc.getTypeIconURL( type );
        if( !iconURL ) {
            iconURL = iconSvc.getTypeIconURL( REQUIREMENT );
        }
        var vmNode = awTableTreeSvc.createViewModelTreeNode( node.uniqueId, node.displayType, name, levelNdx, childNumber, iconURL );
        vmNode.action = node.action;
        var releaseStatusProp = '';
        if( node.releaseStatusValue && node.releaseStatusValue.length > 0 ) {
            releaseStatusProp = node.releaseStatusValue;
        }
        _populateColumns( columnInfos, isLoadAllEnabled, vmNode, data, releaseStatusProp );
        vmNodes[ i ] = vmNode;
        if( node.children && node.children.length === 0 ) {
            vmNode.isLeaf = true;
            rmTreeDataService.setVmNodes( vmNode );
        } else {
            vmNode.isExpanded = true;
            rmTreeDataService.setVmNodes( vmNode );
            _buildTreeTableStructure( columnInfos, vmNode, isLoadAllEnabled, data );
        }
        var status = node.action;
        if( status === 'Add' ) {
            //Blue -- item was added
            vmNode.colorTitle = 'Unique';
            vmNode.cellDecoratorStyle = 'aw-border-chartColor3';
            vmNode.gridDecoratorStyle = 'aw-charts-chartColor3';
        } else if( status === 'Delete' ) {
            //Red -- item was deleted.
            vmNode.colorTitle = 'Unique';
            vmNode.cellDecoratorStyle = 'aw-border-chartColor6';
            vmNode.gridDecoratorStyle = 'aw-charts-chartColor6';
        }
    }


    rmTreeDataService.getIdToChildrenMapData( key ).vmnodes = vmNodes;

    if( parentNode.id === 'top' && !appCtxSvc.getCtx( 'deriveAndMergeClick' ) && data.dataProviders.importPreviewTreeProvider.selectedObjects[0] === undefined ) {
        var provider = data.dataProviders.importPreviewTreeProvider;
        provider.selectionModel.setSelection( vmNodes[ 0 ] );
    }
}

/**
  * @param {AwTableColumnInfo} columnInfo -
  * @param {String} name - Column Name
  * @param {String} type - Object type
  * @param {String} action - Add/Update/Delete
  * @return {ViewModelProperty} vmProp
  */
function _createViewModelProperty( columnInfo, name, displayName, type, displayType, action, data, releaseStatusProp ) {
    var dbValues;
    var uiValues;

    if( columnInfo.isTableCommand || columnInfo.isTreeNavigation ) {
        dbValues = [ name ];
        uiValues = [ name ];
    }  else if( columnInfo.name === 'object_name' ) {
        dbValues = [ name ];
        if( displayName ) {
            uiValues = [ displayName ];
        } else{
            uiValues = [ name ];
        }
    }else if( columnInfo.name === 'object_type' ) {
        dbValues = [ type ];
        if( displayType ) {
            uiValues = [ displayType ];
        } else{
            uiValues = [ type ];
        }
    } else if( columnInfo.name === 'object_release_status' ) {
        dbValues = [ releaseStatusProp ];
        if( releaseStatusProp !== '' ) {
            uiValues = [ releaseStatusProp ];
        } else{
            uiValues = [];
        }
    } else if( columnInfo.name === 'object_action' ) {
        switch ( action ) {
            case 'Update':
                uiValues = [ data.i18n.update ];
                break;
            case 'Delete':
                uiValues = [ data.i18n.delete ];
                break;
            case 'NoChange':
                uiValues = [ ' ' ];
                break;
            case 'Revise':
                uiValues = [ data.i18n.revise ];
                break;
            case 'Add':
                uiValues = [ data.i18n.Add ];
                break;
            default:
                uiValues = [ action ];
                break;
        }
        dbValues = [ action ];
    }

    var vmProp = uwPropertySvc.createViewModelProperty( columnInfo.name, columnInfo.displayName,
        columnInfo.typeName, dbValues, uiValues );

    vmProp.propertyDescriptor = {
        displayName: columnInfo.displayName
    };

    if( columnInfo.isTableCommand || columnInfo.isTreeNavigation ) {
        vmProp.typeIconURL = iconSvc.getTypeIconURL( type );
        if( !vmProp.typeIconURL ) {
            vmProp.typeIconURL = iconSvc.getTypeIconURL( REQUIREMENT );
        }
    }

    return vmProp;
}

/**
  * @param {*} deferred //
  * @param {*} propertyLoadInput //
  */
function _loadProperties( deferred, propertyLoadInput ) {
    var allChildNodes = [];

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            _populateColumns( propertyLoadRequest.columnInfos, true, childNode );

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
  * Resolve the row data for the 'next' page of 'children' nodes of the given 'parent'.
  * <P>
  * Note: The paging status is maintained in the 'parent' node.
  *
  * @param {DeferredResolution} deferred -
  * @param {TreeLoadInput} treeLoadInput -
  * @param {data} data - data Object
  */
function _loadTreeTableRows( deferred, treeLoadInput, data ) {
    /**
      * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
      */
    var parentNode = treeLoadInput.parentNode;
    var columnInfos;
    var sortCriteria = data.grids.importPreviewTreeTable.columnProviderInstance.sortCriteria;
    if( !parentNode.isLeaf ) {
        var nChild = parentNode.children ? parentNode.children.length : 0;

        if( nChild === 0 ) {
            // get props with intial tree for now. In future, should set this to false and populate
            // the props seperately.
            var isLoadAllEnabled = true;
            if( !parentNode._expandRequested ) {
                if( parentNode.levelNdx < 0 ) {
                    columnInfos = _getTreeTableColumnInfos( data );
                    if( sortCriteria && sortCriteria.length === 0 ) {
                        rmTreeDataService.clearvmNodeArray();
                    }
                    _buildTreeTableStructure( columnInfos.columns, parentNode, isLoadAllEnabled, data );
                } else {
                    if( parentNode.levelNdx < _maxTreeLevel ) {
                        columnInfos = _getTreeTableColumnInfos( data );
                        if( sortCriteria && sortCriteria.length === 0 ) {
                            rmTreeDataService.clearvmNodeArray();
                        }
                        _buildTreeTableStructure( columnInfos.columns, parentNode, isLoadAllEnabled, data );
                    } else {
                        parentNode.isLeaf = true;
                    }
                }
            }
        }
    }

    //Added to prevent loosing current selection after performing context menu actions.
    if( data.dataProviders.importPreviewTreeProvider.selectedObjects !== undefined ) {
        var provider = data.dataProviders.importPreviewTreeProvider;
        if( provider.selectedObjects.length === 0 ) {
            var vm = rmTreeDataService.getVmNodes();


            provider.selectionModel.setSelection( vm[0] );
            data.contextMenuActionPerformed = true;
        }else{
            provider.selectionModel.setSelection( provider.selectedObjects );
            data.contextMenuActionPerformed = true;
        }
    }
    var childNodes;
    var key;
    if( parentNode.id === 'top' ) {
        key = rootID;
    } else {
        key = parentNode.id;
    }
    if( parentNode._expandRequested ) {
        childNodes = rmTreeDataService.getIdToChildrenMapData( key ).vmnodes;
        _.forEach( childNodes, function( node ) {
            node.isExpanded = false;
        } );
    } else {
        childNodes = rmTreeDataService.getVmNodes();
    }

    // var endReached = parentNode.startChildNdx + treeLoadInput.pageSize > mockChildNodes.length;
    treeLoadInput.pageSize = childNodes.length;
    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childNodes, false, true, true, null );

    deferred.resolve( {
        treeLoadResult: treeLoadResult,
        columnInfos
    } );
}

/**
  * @param {ObjectArray} columnInfos -
  * @param {Boolean} isLoadAllEnabled -
  * @param {ViewModelTreeNode} vmNode -
  * @param {Number} childNdx -
  */
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode, data, releaseStatusProp ) {
    if( isLoadAllEnabled ) {
        if( !vmNode.props ) {
            vmNode.props = [];
        }

        _.forEach( columnInfos, function( columnInfo ) {
            /**
              * Do not put any properties in the 'isTreeNavigation' column.
              */
            if( !columnInfos.isTreeNavigation ) {
                vmNode.props[ columnInfo.name ] = _createViewModelProperty( columnInfo, vmNode.displayName, vmNode.displayName, vmNode.type, vmNode.displayType, vmNode.action, data, releaseStatusProp );
            }
        } );
    }
}

/**
  * Get a page of row data for a 'tree' table.
  *
  *  treeLoadInput - An Object this action function is invoked from. The object is usually
  *            the result of processing the 'inputData' property of a DeclAction based on data from the current
  *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
  *
  * <pre>
  * {
  * Extra 'debug' Properties
  *     delayTimeTree: {Number}
  * }
  * </pre>
  * @param {data} data - data Object
  *  @param {ctx} ctx - ctx instance Object
  * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
  *         available.
  */
export let loadTreeTableData = async function( data, ctx ) {
    await addElementTypeHandler._getDisplayableTypes();
    _updatePreview = rmTreeDataService.getUpdatePreview();
    var sortCriteria =  data.grids.importPreviewTreeTable.columnProviderInstance.sortCriteria;
    if( !data.isTreeLoaded || _updatePreview  ) {
        populateTreeTableData( data );
    }
    rmTreeDataService.setUpdatePreview();
    /**
      * Extract action parameters from the arguments to this function.
      */
    var treeLoadInput = awTableSvc.findTreeLoadInput( arguments );

    /**
      * Extract action parameters from the arguments to this function.
      * <P>
      * Note: The order or existence of parameters can varey when more-than-one property is specified in the
      * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
      */
    var delayTimeTree = 0;

    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];

        if( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'delayTimeTree' ) {
            delayTimeTree = arg.dbValue;
        } else if( uwPropertySvc.isViewModelProperty( arg ) && arg.propertyName === 'maxTreeLevel' ) {
            _maxTreeLevel = arg.dbValue;
        }
    }

    /**
      * Check the validity of the parameters
      */
    var deferred = AwPromiseService.instance.defer();


    if( sortCriteria && sortCriteria.length > 0 ) {
        rmTreeDataService.clearvmNodeArray();
    }


    /**
      * Load the 'child' nodes for the 'parent' node.
      */
    if( delayTimeTree > 0 ) {
        _.delay( _loadTreeTableRows, delayTimeTree, deferred, treeLoadInput, data );
    } else {
        _loadTreeTableRows( deferred, treeLoadInput, data );
    }
    setTimeout( function() {
        if( !data.isTreeLoaded || _updatePreview ) {
            !_updatePreview && !appCtxSvc.getCtx( 'deriveAndMergeClick' ) && rmTreeDataService.getPreviewInitiator() !== 'RoundTripPreview' && eventBus.publish( 'Arm0ImportFromOffice.activateImportPreviewPanel' );
            eventBus.publish( 'importPreview.populateSecArea' );
            data.isTreeLoaded = true;
            _updatePreview = false;
            if( data.dispatch ) {
                data.dispatch( { path: 'data.isTreeLoaded',   value: data.isTreeLoaded } );
            }
        }
    }, 2000 );
    return deferred.promise;
};

/**
  *
  * @param {Object} data - the tree data object
  * to popolate tree and Secondary area
  */
function populateTreeTableData( data ) {
    rmTreeDataService.reSetMapData();
    rootID = rmTreeDataService.getRootID();
    rmTreeDataService.createMapFromJSONData();
}

/**
  * Get a page of row data for a 'tree' table.
  * propertyLoadRequests - An array of PropertyLoadRequest objects this action
  *            function is invoked from. The object is usually the result of processing the 'inputData' property
  *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
  *            properties on this object is used (if defined).
  * @return {promise} promise - the promise which will laod tree
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
    } else if( propertyLoadInput ) {
        _loadProperties( deferred, propertyLoadInput );
    }

    return deferred.promise;
};

/**
  * @param {Object} data - the eventData
  * @param {Object} eventData - the eventData
  * to Change the Type of Selected Element
  */
export let changeTypeOfSpecElement = function( data, eventData ) {
    rmTreeDataService.checkTypeChange( data, eventData );
};

/**
  * Initialize
  *
  * @param {Object} selectedObject - Object selected in the tree
  * @param {Object} data - The panel's view model object
  * @param {Object} ctx - The panel's view model object
  */
export let selectionChanged = function( dataProvider, ctx, data  ) {
    setTimeout( function() {
        data.selectedObjectUid = [];
        if( dataProvider.selectedObjects &&  dataProvider.selectedObjects.length > 0 ) {
            for( var i = 0; i < dataProvider.selectedObjects.length; i++ ) {
                data.selectedObjectUid.push( dataProvider.selectedObjects[i].uid );
            }
        }else if( dataProvider.viewModelCollection.loadedVMObjects && dataProvider.viewModelCollection.loadedVMObjects.length ) {
            for( var i = 0; i < dataProvider.selectedObjects.length; i++ ) {
                data.selectedObjectUid.push( dataProvider.viewModelCollection.loadedVMObjects[i].uid );
            }
        } else if( ctx.selected ) {
            data.selectedObjectUid.push( ctx.selected.uid );
        }

        if ( data.selectedObjectUid ) {
            if( data.dispatch ) {
                data.dispatch( { path: 'data.selectedObjectUid',   value: data.selectedObjectUid } );
            }
            _scrollCKEditorToGivenObject( data, data.selectedObjectUid );
        }
    }, 1000 );
};

/**
  * Scroll CKEditor Content to the given element.
  *
  * @param {String} selectedObjectUid - CKEditor ID
  */
var _scrollCKEditorToGivenObject = function( data, selectedObjectUid ) {
    setTimeout( function() {
        scrollCKEditorToGivenObject( data, selectedObjectUid );
    }, 1000 );
};

/**
  * Scroll ckeditor content to given object element.
  *
  * @param {String} objectUid - object uid
  */
var scrollCKEditorToGivenObject = function( data, objectUid ) {
    if( objectUid ) {
        let reqDivSec = document.querySelectorAll(  '.aw-richtexteditor-importPreviewPanel div.aw-widgets-cellListItemSelected' );
        if( reqDivSec ) {
            for( var index = 0; index < reqDivSec.length; index++ ) {
                reqDivSec[index].classList.remove( 'aw-widgets-cellListItemSelected' );
            }
        }

        for( var index = 0; index < objectUid.length; index++ ) {
            var element = document.getElementById( objectUid[index] );
            if( !data.contextMenuActionPerformed ) {
                element && element.scrollIntoView();
            }
            let reqHeader = document.querySelector( '.aw-richtexteditor-importPreviewPanel div.aw-requirement-header' );
            reqHeader.classList.add( 'aw-widgets-cellListItem' );
            let reqDiv = document.querySelector(  '.aw-richtexteditor-importPreviewPanel div.aw-widgets-cellListItemSelected' );
            if( reqDiv ) {
                reqDiv.classList.add( 'aw-widgets-cellListItemSelected' );
            }
            let header = element.getElementsByClassName( 'aw-requirement-header' )[0];
            header.classList.add( 'aw-widgets-cellListItemSelected' );
        }
    }
    data.contextMenuActionPerformed = false;
};

/**
  * Select the default Logical Object
  *
  * @param {Object} data - the data
  * @param {Object} eventData - the eventData
  */
export let selectTreeObjForCrossProb = function( data, eventData ) {
    var provider = data.dataProviders.importPreviewTreeProvider;
    if( provider ) {
        var list = provider.viewModelCollection.getLoadedViewModelObjects();
        for( var i = 0; i < list.length; i++ ) {
            if( list[ i ].uid === eventData.objectsToSelect.uid ) {
                provider.selectionModel.setSelection( list[ i ] );
            }
        }
    }
};

/**
  * Update Paragraph number/level after move up,Move down, Promote and Demote operation
  * @param {object} jsonContent json object for preview
  */
var _updateLevel = function( jsonContent ) {
    var parentLevel = jsonContent.hierarchyNumber;
    var arrElements = jsonContent.children;

    for( var i = 0; i < arrElements.length; i++ ) {
        var hierarchyNumber = parentLevel !== '0' ? parentLevel + '.' + ( i + 1 ) : ( i + 1 ).toString();

        arrElements[ i ].hierarchyNumber = hierarchyNumber;
        _updateLevel( arrElements[ i ] );
    }
};

/**
  * Swap position of two element within Array. In case of Move up and Move down element
  * position is changed within array.
  * @param {Array} arrElements array of objects
  * @param {number} selElementIndex index of selected element
  * @param {number} otherElementIndex index of second element
  */
var _swap = function( arrElements, selElementIndex, otherElementIndex ) {
    //Swap element within array
    var tmpElement = arrElements[ otherElementIndex ];
    arrElements[ otherElementIndex ] = arrElements[ selElementIndex ];
    arrElements[ selElementIndex ] = tmpElement;

    var tmpLevel = JSON.parse( JSON.stringify( arrElements[ otherElementIndex ].hierarchyNumber ) );
    arrElements[ otherElementIndex ].hierarchyNumber = arrElements[ selElementIndex ].hierarchyNumber;
    arrElements[ selElementIndex ].hierarchyNumber = tmpLevel;

    // Update paragraph number post swap
    _updateLevel( arrElements[ otherElementIndex ] );
    _updateLevel( arrElements[ selElementIndex ] );
};

/**
  * Internal function to perform move up
  * @param {object} jsonContent json object for preview
  * @param {string} uidElement uid of object to be moved
  * @returns {boolean} true if move operation completed else false if it can not be moved
  */

var _moveUp = function( jsonContent, uidElement, data ) {
    var arrElements = jsonContent.children;
    var otherElementIndex = -1;
    var selElementIndex = -1;
    var moved = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueId;
        if( uniqueID === uidElement && i > 0 ) {
            otherElementIndex = i - 1;
            selElementIndex = i;
            break;
        }
        if( _moveUp( arrElements[ i ], uidElement, data ) ) {
            moved = true;
            break;
        }
    }

    if( otherElementIndex >= 0 && selElementIndex > 0 ) {
        var uniqueidSplit = arrElements[otherElementIndex].uniqueId.split( '-' ).length;
        if( uniqueidSplit <= 1 ) {
            data.moveRestricted = true;
        }
        if( !data.moveRestricted ) {
            _swap( arrElements, selElementIndex, otherElementIndex );
            moved = true;
        }
    }
    return moved;
};

/**
  * Move up operation move selected element one position up in same level of hierarchy
  * @param {object} data view model data
  */
export let moveUp = function( data, moveAction ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    data.moveRestricted = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = rmTreeDataService.getJSONData();
    if( _moveUp( jsonContent, selectedObjUid, data ) ) {
        data.movedSuccessfully = true;
        _postMoveOperation( data, jsonContent, selectedObjUid );
    }
    data.dispatch( { path: 'data', value: data } );
};

/**
  * Internal function to perform post opearation post move up, move down ,promote, demote
  * @param {object} data view model data
  * @param {object} jsonContent json object for preview
  * @param {object} selectedObject  selected object on which moved operation is performed
  * @param {object} newParentElement  new parent element of moved object. It will have value in case of "Demote" only
  */
var _postMoveOperation = function( data, jsonContent, selectedObject, newParentElement ) {
    rmTreeDataService.setUpdatePreview( true );
    importPreviewService.setSecondaryArea();
    rmTreeDataService.setVmNodes();
    eventBus.publish( 'importPreview.closeExistingBalloonPopup' );
    rmTreeDataService.setJSONData( jsonContent );
    eventBus.publish( 'importPreview.refreshTreeDataProvider' );

    //Ensure new parent node is expanded in case of demote
    if( newParentElement && newParentElement.uid ) {
        setTimeout( function() {
            var eventData = {
                parentObjectUid: newParentElement.uid
            };
            eventBus.publish( 'importPreviewTree.expandNode', eventData );
        }, 100 );
    }

    setTimeout( function() {
        if( selectedObject ) {
            var eventData = {
                objectsToSelect: { uid: selectedObject }
            };

            eventBus.publish( 'importPreview.secAreaHeaderSelectForCrossProb', eventData );
        }
    }, 1500 );
};

/**
  * Internal function to perform move down
  * @param {object} jsonContent json object for preview
  * @param {string} uidElement uid of object to be moved
  * @returns {boolean} true if move operation completed else false if it can not be moved
  */
var _moveDown = function( jsonContent, uidElement, data ) {
    var arrElements = jsonContent.children;
    var otherElementIndex = -1;
    var selElementIndex = -1;
    var moved = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueId;
        if( uniqueID === uidElement && i < arrElements.length - 1 ) {
            otherElementIndex = i + 1;
            selElementIndex = i;
            break;
        }
        if( _moveDown( arrElements[ i ], uidElement, data ) ) {
            moved = true;
            break;
        }
    }

    if( otherElementIndex > 0 && selElementIndex >= 0 ) {
        var uniqueidSplit = arrElements[otherElementIndex].uniqueId.split( '-' ).length;
        if( uniqueidSplit <= 1 ) {
            data.moveRestricted = true;
        }
        if( !data.moveRestricted ) {
            _swap( arrElements, selElementIndex, otherElementIndex );
            moved = true;
        }
    }
    return moved;
};

/**
  * Internal function to perform promote
  * @param {object} element elements children to be searched for element to be promoted
  * @param {object} parentElement parent of parent of element
  * @param {string} uidElement uid of object to be moved
  * @returns {boolean} true if move operation completed else false if it can not be moved
  */
var _promote2 = function( element, parentElement, uidElement, index, data ) {
    var arrElements = element.children;
    var promoted = false;
    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueId;
        var parentIDSplitlength = 0;
        if( parentElement ) {
            parentIDSplitlength = parentElement.uniqueId.split( '-' ).length;
        }

        if( uniqueID === uidElement ) {
            if( parentIDSplitlength <= 1 ) {
                data.moveRestricted = true;
                return false;
            }
            var deletedElement = arrElements.splice( i, 1 );
            deletedElement[ 0 ].level = deletedElement[ 0 ].level + 1;
            parentElement.children.splice( index + 1, 0, deletedElement[ 0 ] );
            _updateLevel( parentElement );
            return true;
        }


        if( _promote2( arrElements[ i ], element, uidElement, i, data ) ) {
            promoted = true;
            break;
        }
    }
    return promoted;
};
/**
  * Internal function to perform promote
  * @param {object} jsonContent json object for preview
  * @param {string} uidElement uid of object to be moved
  * @returns {boolean} true if move operation completed else false if it can not be moved
  */
var _promote = function( jsonContent, uidElement, data ) {
    var arrElements = jsonContent.children;
    var promoted = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        if( _promote2( arrElements[ i ], jsonContent, uidElement, i, data  ) ) {
            promoted = true;
            break;
        }
    }
    return promoted;
};
/**
  * Internal function to perform demote
  * @param {object} jsonContent json object for preview
  * @param {string} uidElement uid of object to be moved
  * @param {object} newParentElement New parent object
  * @returns {boolean} true if move operation completed else false if it can not be moved
  */

var _demote = function( jsonContent, uidElement, newParentElement, data ) {
    var arrElements = jsonContent.children;
    var demoted = false;

    for( var i = 0; i < arrElements.length; i++ ) {
        var uniqueID = arrElements[ i ].uniqueId;
        var parentIDSplitlength = 0;
        if( i > 0 ) {
            parentIDSplitlength = arrElements[ i - 1 ].uniqueId.split( '-' ).length;
        }

        if( uniqueID === uidElement ) {
            if( parentIDSplitlength <= 1 ) {
                data.moveRestricted = true;
                return false;
            }
            var deletedElement = arrElements.splice( i, 1 );
            deletedElement[ 0 ].level = deletedElement[ 0 ].level - 1;
            arrElements[ i - 1 ].children.push( deletedElement[ 0 ] );
            _updateLevel( jsonContent );
            newParentElement.uid = arrElements[ i - 1 ].uniqueId;
            return true;
        }


        if( _demote( arrElements[ i ], uidElement, newParentElement, data ) ) {
            demoted = true;
            break;
        }
    }

    return demoted;
};


/**
  * Move down operation move selected element one position below in same level of hierarchy
  * @param {object} data view model data
  */
export let moveDown = function( data, moveAction ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    data.moveRestricted = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = rmTreeDataService.getJSONData();
    if( _moveDown( jsonContent, selectedObjUid, data ) ) {
        data.movedSuccessfully = true;
        _postMoveOperation( data, jsonContent, selectedObjUid );
    }
    data.dispatch( { path: 'data', value: data } );
};

/**
  * Promote operation move selected element to parent level of hierarchy
  * @param {object} data view model data
  */
export let promote = function( data, moveAction ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    data.moveRestricted = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = rmTreeDataService.getJSONData();
    if( _promote( jsonContent, selectedObjUid, data ) ) {
        data.movedSuccessfully = true;
        _postMoveOperation( data, jsonContent, selectedObjUid );
    }
    data.dispatch( { path: 'data', value: data } );
};
/**
  * Demote operation move selected element to its sibling's children  hierarchy
  * @param {object} data view model data
  */
export let demote = function( data, moveAction ) {
    data.moveAction = moveAction;
    data.movedSuccessfully = false;
    data.moveRestricted = false;
    var selectedObjUid = data.selectedObjectUid[0];
    var jsonContent = rmTreeDataService.getJSONData();
    var newParentElement = {
        uid: null
    };
    if( _demote( jsonContent, selectedObjUid, newParentElement, data ) ) {
        data.movedSuccessfully = true;
        _postMoveOperation( data, jsonContent, selectedObjUid, newParentElement );
    }
    data.dispatch( { path: 'data', value: data } );
};

export const setShowCheckBoxValue = ( eventData ) => {
    return eventData.multiSelect;
};

export const multiSelectHtmlSpectemplate = ( eventData ) => {
    var selectionModel = eventData.commandContext.selectionModel;
    if( selectionModel ) {
        selectionModel.setMultiSelectionEnabled( eventData.multiSelect );
        return eventData.multiSelect;
    }
    return false;
};

export const selectActionForHtmlSpec = ( data, selectAll ) => {
    const dp = data.dataProviders.importPreviewTreeProvider;
    if( dp ) {
        if( selectAll ) {
            dp.selectAll();
        } else {
            dp.selectNone();
        }
    }
};

export const handleSelectionMode = ( commandContext, selectAll ) => {
    if( selectAll ) {
        eventBus.publish( 'primaryWorkarea.selectAllEnableModeAction' );
        commandContext.selectionModel.setSelectionState( 'all' );
    }else{
        eventBus.publish( 'primaryWorkarea.selectAllDisableModeAction' );
        commandContext.selectionModel.setSelectionState( 'none' );
    }
};

export const filterRowsWithSort = function( vmNodes, data ) {
    let importPreviewTreeProvider = vmNodes;
    var startIndex = 0;
    let endIndex = vmNodes.length;
    var sortCriteria = data.grids.importPreviewTreeTable.columnProviderInstance.sortCriteria;
    if( sortCriteria && sortCriteria.length > 0  && importPreviewTreeProvider.length > 1 ) {
        let criteria = sortCriteria[ 0 ];
        let sortDirection = criteria.sortDirection;
        let sortColName = criteria.fieldName;
        if( sortColName === 'object_name' ) {
            if( sortDirection === 'ASC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( a.name <= b.name ) {
                        return -1;
                    }
                    return 1;
                } );
            } else if( sortDirection === 'DESC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( a.name >= b.name ) {
                        return -1;
                    }
                    return 1;
                } );
            }
        }else if( sortColName === 'object_type' ) {
            if( sortDirection === 'ASC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( a.displayType <= b.displayType ) {
                        return -1;
                    }
                    return 1;
                } );
            } else if( sortDirection === 'DESC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( a.displayType >= b.displayType ) {
                        return -1;
                    }
                    return 1;
                } );
            }
        }else if( sortColName === 'object_action' ) {
            if( sortDirection === 'ASC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( a.action <= b.action ) {
                        return -1;
                    }
                    return 1;
                } );
            } else if( sortDirection === 'DESC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( a.action >= b.action ) {
                        return -1;
                    }
                    return 1;
                } );
            }
        }else if( sortColName === 'object_release_status' ) {
            if( sortDirection === 'ASC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( !a.releaseStatusValue ) {
                        a.releaseStatusValue = '';
                    }
                    if( !b.releaseStatusValue ) {
                        b.releaseStatusValue = '';
                    }
                    if( a.releaseStatusValue <= b.releaseStatusValue ) {
                        return -1;
                    }
                    return 1;
                } );
            } else if( sortDirection === 'DESC' ) {
                importPreviewTreeProvider.sort( function( a, b ) {
                    if( !a.releaseStatusValue ) {
                        a.releaseStatusValue = '';
                    }
                    if( !b.releaseStatusValue ) {
                        b.releaseStatusValue = '';
                    }
                    if( a.releaseStatusValue >= b.releaseStatusValue ) {
                        return -1;
                    }
                    return 1;
                } );
            }
        }
    }

    importPreviewTreeProvider.slice( startIndex, endIndex );
    return importPreviewTreeProvider;
};

export const showChangeTypeOptions = ( commandContext ) => {
    if( commandContext ) {
        eventBus.publish( 'primaryWorkarea.displayTypeForMultiObjSelection' );
    }
};


export default exports = {
    loadTreeTableData,
    loadTreeTableProperties,
    changeTypeOfSpecElement,
    selectionChanged,
    selectTreeObjForCrossProb,
    moveUp,
    moveDown,
    promote,
    demote,
    multiSelectHtmlSpectemplate,
    setShowCheckBoxValue,
    selectActionForHtmlSpec,
    handleSelectionMode,
    filterRowsWithSort,
    showChangeTypeOptions

};

