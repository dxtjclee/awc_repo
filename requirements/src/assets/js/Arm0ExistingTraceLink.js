// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Arm0ExistingTraceLink
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import _ from 'lodash';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import iconSvc from 'js/iconService';
import { popupService } from 'js/popupService';
import popupUtils from 'js/popupUtils';
import localeSvc from 'js/localeService';
import notyService from 'js/NotyModule';
import reqTracelinkService from 'js/requirementsTracelinkService';
import parsingUtils from 'js/parsingUtils';
import viewModelObjectSvc from 'js/viewModelObjectService';
import tcVmoService from 'js/tcViewModelObjectService';
import editHandlerSvc from 'js/editHandlerService';
import adapterService from 'js/adapterService';
import commandsMapService from 'js/commandsMapService';

var exports = {};

var idToObjectMap = {};
var _data;
var reloadTable;
var _popupRef;
var _sideNavEventSub;
var nameProperty = 'REF(awp0RelatedObject,WorkspaceObject).object_string';

/**
 * Get search Input for loading existing Tracelink
 *
 * @param {Object} ctx - context
 * @param {Object} selection - selected object
 * @return {Any} search Input
 */
export let getSearchInputExistingTracelink = function( ctx, selection ) {
    selection = _getTracelinkEligbleObj( selection );
    var selectedUid = selection.uid;
    var inputSearch = {
        objectUids: selectedUid
    };
    var sublocation = appCtxService.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
    if ( sublocation === 'com.siemens.splm.client.vrtarget.vrSubLocation' ) {
        inputSearch = {
            openedObjectUid: ctx.pselected.uid,
            objectUids: selectedUid
        };
    }else if ( appCtxService.getCtx( 'aceActiveContext' ) ) {
        var openedObject = ctx.pselected.uid;
        if ( ctx.pselected.props.awb0UnderlyingObject ) {
            openedObject = ctx.pselected.props.awb0UnderlyingObject.dbValues[0];
        } else {
            selectedUid = selection.uid;
        }
        inputSearch = {
            openedObjectUid: openedObject,
            objectUids: selectedUid,
            rootElementUids: reqTracelinkService.getRootElementUids(),
            productContextUids: _getProductContextUids()
        };
    }
    inputSearch.dcpSortByDataProvider = 'true';


    return inputSearch;
};

/**
 * The method joins the UIDs array (values of elementToPCIMap) into a space-separated string/list.
 *
 * @return {String} Space seperated uids of all product context in context
 */
var _getProductContextUids = function() {
    var uidProductContexts;
    var aceActiveContext = appCtxService.getCtx( 'aceActiveContext' );
    if ( aceActiveContext ) {
        if ( aceActiveContext.context.elementToPCIMap ) {
            uidProductContexts = _.values( aceActiveContext.context.elementToPCIMap ).join( ' ' );
        } else if ( aceActiveContext.context.productContextInfo ) {
            uidProductContexts = aceActiveContext.context.productContextInfo.uid;
        }
    }

    return uidProductContexts;
};

/**
 * Calls the soa to get the tree data
 * @param {Object} data - The view model object
 * @returns {object}  soa response
 */
export let callSoaService = async function( data ) {
    var policy =
    {
        types: [ {
            name: 'Awp0TraceLinkProxyObject',
            properties: [ {
                name: 'awp0RelatedObject',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awp0SelectedObject',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awp0RelationObject'
            },
            {
                name: 'awp0Direction'
            },
            {
                name: 'awp0LinkedItemType'
            }
            ]
        } ]
    };

    var selected = data.selectedObj;
    if ( data.treeLoadInput.parentNode.uid !== 'top' ) {
        selected = cdm.getObject( data.treeLoadInput.parentNode.uid );
    }
    if( reloadTable &&  data.treeData && data.treeData.primaryObjectUid && idToObjectMap[selected.uid] !== undefined ) {
        selected = cdm.getObject( data.treeData.primaryObjectUid );
        reloadTable = false;
    }

    var selectedObjUidCtx = appCtxService.getCtx( 'ExistingTraceLinkPopupSelectedObjUid' );
    if( selectedObjUidCtx ) {
        selected = selectedObjUidCtx;
        data.selectedObj = selected;
    }

    var inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'ExistingTraceLinkTable'
        },
        inflateProperties: true,
        searchInput: {
            maxToLoad: 25,
            maxToReturn: 25,
            providerName: 'Awp0TraceLinkProvider',
            searchCriteria: getSearchInputExistingTracelink( data.ctx, selected ),
            attributesToInflate: [
                'awp0HasChildren',
                'awp0Parent'
            ],
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap6: {},
            searchSortCriteria: data.columnProviders.existingTlColumnProvider.sortCriteria,
            startIndex: data.treeLoadInput.startChildNdx
        }
    };
    return await soaSvc.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData, policy );
};

/**
 * Builds the tree table structure
 *
 * @param {ViewModelTreeInput} treeLoadInput - A node that acts 'parent' of a hierarchy of 'child' ViewModelTreeNodes.
 * @param {ModelObject[]} children - objects to load
 * @return {ViewModelTreeNode[]} - Tree node for children
 */
function _buildTreeTableStructure( treeLoadInput, children ) {
    var vmNodes = [];
    var levelNdx = treeLoadInput.levelNdx + 1;
    treeLoadInput.typeIconURL = null;
    for ( var i = 0; i < children.length; i++ ) {
        var node = children[i];
        var childNdx = i;
        var link = cdm.getObject( node.uid );
        var related = cdm.getObject( link.props.awp0RelatedObject.dbValues[0] );
        var name = node.props[nameProperty].uiValues[0];
        var icon = iconSvc.getTypeIconURL( related.type );
        var vmNode = awTableTreeSvc.createViewModelTreeNode( node.uid, node.type, name, levelNdx, childNdx, icon );
        var hasChildren = link.props.awp0HasChildren.dbValues[0];
        vmNode.isLeaf = hasChildren === '0';
        vmNodes[i] = vmNode;
    }
    return vmNodes;
}

/**
 * Resolve the row data for the 'next' page of 'children' nodes of the given 'parent'.
 * Note: The paging status is maintained in the 'parent' node.
 *
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ModelObject[]} children - trace links to load
 * @return {TreeLoadResult} Tree with children added
 */
function _loadTreeTableRows( treeLoadInput, children, totalFound ) {
    //Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
    var parentNode = treeLoadInput.parentNode;
    var childNodes = [];
    if ( !parentNode.isLeaf ) {
        var nChild = parentNode.children ? parentNode.children.length : 0;


        // get props with intial tree for now. In future, should set this to false and populate the props seperately.
        childNodes = _buildTreeTableStructure( parentNode, children );
    }
    var endReachedVar = childNodes.length === 0 || childNodes.length + treeLoadInput.startChildNdx === totalFound;
    treeLoadInput.pageSize = 25;
    var tempCursorObject = {
        endReached: endReachedVar,
        startReached: true
    };
    treeLoadInput.parentNode.cursorObject = tempCursorObject;
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childNodes, true, true, endReachedVar, null );
}

/**
 * @param {Object} newColumnConfig New conlumn config returned by the SOA getTableViewModelProperties
 * @param {Object} uwDataProvider The Data Provider object
 */
export let updateExistingTreeColumns = function( newColumnConfig, uwDataProvider ) {
    if ( uwDataProvider && newColumnConfig ) {
        var vmObjects = uwDataProvider.viewModelCollection.loadedVMObjects;
        if ( vmObjects && vmObjects.length > 0 ) {
            for ( var i = 0; i < vmObjects.length; i++ ) {
                vmObjects[i].typeIconURL = null;
            }
        }
    }
};

/**
 *
 * @param {Object} propertyLoadInput input
 * @returns{Object} propertyLoadResult property load result
 */
export let loadExistingTlTreeProperties = async function( propertyLoadInput ) {
    var allChildNodes = [];
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI:  'ExistingTraceLinkTable'
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }
            if ( childNode.type === 'rootType' ) {
                return;
            }
            allChildNodes.push( childNode );

            if( childNode.childVmNodes ) {
                _.forEach( childNode.childVmNodes, function( theChild ) {
                    if( !theChild.props ) {
                        theChild.props = {};
                    }
                    allChildNodes.push( theChild );
                } );
            }
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                } );
                childNode.typeIconURL = null;
            } );
            var propColumns = response.output.columnConfig.columns;
            _.forEach( propColumns, function( col ) {
                if( !col.typeName && col.associatedTypeName ) {
                    col.typeName = col.associatedTypeName;
                }
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
            }
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
};


/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {Object} data - The page's view model object
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let getAllExistingTraceLinks = async function( treeLoadInput, data ) {
    if( !_data ) {
        _data = data;
    }
    data.selectedObj = data.ctx.mselected[0];
    data.parentUid = treeLoadInput.parentNode.uid;

    if ( data.parentUid === 'top' ) {
        data.parentUid = data.selectedObj.uid;
    }
    if( data.data.eventMap && ( Object.keys( data.data.eventMap ).indexOf( 'Arm0ExistingTracelinkTree.reloadTable' ) !== -1 || Object.keys( data.data.eventMap ).indexOf( 'primaryWorkArea.selectionChangeEvent' ) !== -1 || Object.keys( data.data.eventMap ).indexOf( 'Arm0Traceability.showTracelinksPopup' ) !== -1 ) ) {
        reloadTable = true;
        if ( data.data.eventMap[ 'primaryWorkArea.selectionChangeEvent' ] ) {
            data.selectedObj = data.data.eventMap[ 'primaryWorkArea.selectionChangeEvent' ].selectedObjects[0];
        }
        data.data.eventMap = [];
    }
    var treeData = await exports.callSoaService( data );

    if ( treeData ) {
        treeData.searchResults = parsingUtils.parseJsonString( treeData.searchResultsJSON ).objects;
        data.treeData = treeData;
        appCtxService.unRegisterCtx( 'ExistingTraceLinkPopupSelectedObjUid' );
    }

    //Check the validity of the parameters
    var deferred = AwPromiseService.instance.defer();


    var columnConfig = treeData.columnConfig;
    if ( treeData ) {
        //Load the 'child' nodes for the 'parent' node.
        if ( columnConfig && columnConfig.columns ) {
            nameProperty = columnConfig.columns[0].propertyName;
        }
        var treeLoadResult = _loadTreeTableRows( treeLoadInput, treeData.searchResults, treeData.totalFound );
    }
    var result = { treeLoadResult: treeLoadResult };
    if ( treeLoadInput.parentNode.uid === 'top' ) {
        result.columnConfig = data.treeData.columnConfig;
    }
    deferred.resolve( result );
    if( data.dispatch ) {
        var selectedObjectName = data.selectedObj.props.object_string.uiValues[0];
        if ( data.selectedObj.props.awb0UnderlyingObject ) {
            selectedObjectName = data.selectedObj.props.awb0UnderlyingObject.uiValues[0];
        }
        data.dispatch( { path: 'data.selectedObj',   value: selectedObjectName } );
    }
    return deferred.promise;
};

/**
    }
 * Get input data for trace link Deletion
 *
 * @param {Object} data - The panel's view model object
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @return {Any} input data for trace link deletion
 */
export let getInputDeleteTraceLinkInTree = function( data, vmo ) {
    var selectedObjects = vmo.getSelectedObjects();
    var elementsToRemove = [];
    if ( selectedObjects ) {
        data.refreshObjects = [];
        data.elementsInDeleteTracelink = [];
        var irList = [];
        for( var i in selectedObjects ) {
            irList.push( selectedObjects[i].props.awp0RelatedObject.dbValue );
            irList.push( selectedObjects[i].props.awp0SelectedObject.dbValue );
            elementsToRemove.push( {
                uid: selectedObjects[i].props.awp0RelationObject.dbValue
            } );
            data.elementsInDeleteTracelink.push( {
                relation: selectedObjects[i].props.awp0RelationObject.dbValue,
                relatedObjectUid : selectedObjects[i].props.awp0RelatedObject.dbValue,
                primaryObjectUid : selectedObjects[i].props.awp0SelectedObject.dbValue
            } );
        }
        let uniqueIrList = Array.from( new Set( irList ) );

        for( var j in uniqueIrList ) {
            data.refreshObjects.push( {
                uid: uniqueIrList[j]
            } );
        }
        data.dispatch( { path: 'data.refreshObjects',   value: data.refreshObjects } );

        if( data.dispatch ) {
            data.dispatch( { path: 'data.elementsInDeleteTracelink',   value: data.elementsInDeleteTracelink } );
        }
    }
    return elementsToRemove;
};

/**
 * Update Popup position
 */
export let updatePopupPosition = function() {
    var ref = '#aw_toolsAndInfo';
    var referenceEl = popupUtils.getElement( popupUtils.extendSelector( ref ) );
    if ( !referenceEl ) {
        return;
    }
    if ( referenceEl.offsetHeight <= 0 ) {
        ref = '.aw-layout-infoCommandbar';
        referenceEl = popupUtils.getElement( popupUtils.extendSelector( '.aw-layout-infoCommandbar' ) );
    }
    if ( referenceEl ) {
        if( _popupRef ) {
            var options = _popupRef.options;
            options.userOptions.reference = ref;
            options.reference = referenceEl;
            popupService.update( _popupRef );
        }
    }
};

/**
 * resize popup after window resize
 *
 * @returns {Object} popup height & width value
 */
var _reCalcPanelHeightWidth = function() {
    var popupHeight = 800;
    var popupWidth = 800;
    // Get the popup panel hright based on aw_toolsAndInfo div present in DOM as normal
    // commands panel will also have the similar height.
    var toolInfoElement = $( '#aw_toolsAndInfo' );
    if( toolInfoElement && toolInfoElement.parent() && toolInfoElement.parent().height() ) {
        popupHeight = toolInfoElement.parent().height();
        popupWidth = toolInfoElement.parent().width();
    }

    // If height is not valid then use hard coded height.
    if( !popupHeight || popupHeight <= 0 ) {
        popupHeight = 800;
    }
    // If width is not valid then use hard coded width.
    if( !popupWidth || popupWidth <= 0 ) {
        popupWidth = 600;
    }else{
        popupWidth -= 0.6 * popupWidth;
    }
    popupHeight += 'px';
    popupWidth += 'px';
    return { popupHeight: popupHeight, popupWidth: popupWidth };
};

const showTracelinksPopup = _.debounce( function( popupData, calcHeight ) {
    const resource = 'RequirementsCommandPanelsMessages';
    const localTextBundle = localeSvc.getLoadedText( resource );
    if( calcHeight ) {
        var scaleObj = _reCalcPanelHeightWidth();
        popupData.height = scaleObj.popupHeight;
        popupData.width = scaleObj.popupWidth;
    }
    popupData.caption = localTextBundle.existingTraceLinkLabel;

    popupService.show( popupData ).then( function( popupRef ) {
        _popupRef = popupRef;
        _sideNavEventSub = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
            if ( eventData && eventData.id === 'aw_toolsAndInfo' ) {
                setTimeout( function() {
                    exports.updatePopupPosition();
                }, 300 );
            }
        } );
    } );
}, 250 );

/**
 * To activate existing trace link popup
 *
 * @param {Object} popupData - the popup data
 * @param {Boolean} calcHeight - if true, calulate height
 */
export let activateExistingTraceLinkPanel = function( popupData, calcHeight ) {
    if( !_popupRef ) {
        showTracelinksPopup( popupData, calcHeight );
    } else{
        exports.closeExistingTraceLinkPopup();
    }
};

/**
 * To activate existing trace link popup
 * @param {Object} inPopupRef popup reference
 */
export let closeExistingTraceLinkPopup = function() {
    _.defer( function( popupRef ) {
        if ( _sideNavEventSub ) {
            eventBus.unsubscribe( _sideNavEventSub );
        }
        if ( popupRef ) {
            popupRef.options.disableClose = false;
            popupService.hide( popupRef );
        }
    }, _popupRef );
    _popupRef = null;
};

/**
 * Unset data
 */
export let unsetData = function() {
    _data = null;
    _.defer( function( ) {
        _popupRef = null;
    } );
};
/**
 * Show delete trace link warning message
 *
 * @param {Object} data - The view model data
 * @param {Object} vmo - vmo
 */
export let showDeleteTracelinkWarning = function( data, vmo ) {
    var selectedObjects = vmo.getSelectedObjects()[ 0 ];
    var msg = vmo.getSelectedObjects().length === 1 ? data.i18n.deleteTracelinkConfirmation.replace( '{0}', selectedObjects.displayName ) : data.i18n.deleteMultipleTracelinkConfirmation;
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.delete,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Arm0ExistingTracelinkTree.deleteExistingTracelinkInTree' );
        }
    } ];

    notyService.showWarning( msg, buttons );
};

/**
 * Start edit on TL table
 */
export let startTLTableEdit = function( subPanelContext ) {
    var editContext = 'TLTABLE_EDIT_HANDLER';
    var editHandler = editHandlerSvc.getEditHandler( editContext );
    editHandlerSvc.setActiveEditHandlerContext( editContext );
    editHandler.startEdit();
};

var _isOccurence = function( obj ) {
    if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        return true;
    }
    return false;
};

var _isWorkspceObject = function( obj ) {
    if( commandsMapService.isInstanceOf( 'WorkspaceObject', obj.modelType ) ) {
        return true;
    }
    return false;
};

var _isRunTimeObject = function( obj ) {
    if( commandsMapService.isInstanceOf( 'RuntimeBusinessObject', obj.modelType ) ) {
        return true;
    }
    return false;
};

/**
 * Get object, tracelink can be created on
 *
 * @param {Object} sourceObj - Teamcenter Object
 * @return {Object} Eligible object for trace link
 */
var _getTracelinkEligbleObj = function( sourceObj ) {
    if( !_isWorkspceObject( sourceObj ) && !_isOccurence( sourceObj ) &&
        _isRunTimeObject( sourceObj ) ) {
        var srcObjs = adapterService.getAdaptedObjectsSync( [ sourceObj ] );
        if( srcObjs !== null && srcObjs.length > 0 ) {
            return srcObjs[ 0 ];
        }
        return null;
    }
    return sourceObj;
};

export default exports = {
    getAllExistingTraceLinks,
    callSoaService,
    getInputDeleteTraceLinkInTree,
    activateExistingTraceLinkPanel,
    closeExistingTraceLinkPopup,
    updatePopupPosition,
    unsetData,
    showDeleteTracelinkWarning,
    loadExistingTlTreeProperties,
    getSearchInputExistingTracelink,
    updateExistingTreeColumns,
    startTLTableEdit
};
