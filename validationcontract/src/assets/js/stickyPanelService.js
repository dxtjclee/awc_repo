// Copyright (c) 2022 Siemens

/**
 * @module js/stickyPanelService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awDragAndDropUtils from 'js/awDragAndDropUtils';
import commandsMapService from 'js/commandsMapService';
import popupUtils from 'js/popupUtils';
import AwPromiseService from 'js/awPromiseService';
import tcVmoService from 'js/tcViewModelObjectService';
import { DOMAPIs as dom } from 'js/domUtils';
import createAnalysisRequest from 'js/createAnalysisRequest';
import manageVerificationService from 'js/manageVerificationService';
import { popupService } from 'js/popupService';
import crt1VRContentService from 'js/Crt1VRContentService';


var exports = {};
var _sideNavEventSub1;
var _locationCompleteEventSub;
var ITEM_LIST = 'stickyPanelList';
var RefreshStickyPanel = 'Refresh.stickyPanel';
var _loadingStickyPopup = false;
var _vmPopupRef;
var parentData = {};
var modelObjectsList = [];

export const dragOverCustomHighlight = ( dragAndDropParams ) => {
    let sourceObjects = awDragAndDropUtils.getCachedDragData();
    var draggedObjects = [];
    sourceObjects.uidList.forEach( uid => {
        draggedObjects.push( cdm.getObject( uid ) );
    } );
    var isValidSourceType = false;
    for( let i = 0; i < draggedObjects.length; i++ ) {
        isValidSourceType = _isOccurence( draggedObjects[ i ] ) || _isWorkspceObject( draggedObjects[ i ] );
        if( !isValidSourceType ) {
            break;
        }
    }
    var isListItem = dragAndDropParams.targetElement.classList.contains( 'aw-widgets-cellListItem' );
    var dropTarget;
    if( isListItem ) {
        dropTarget = dragAndDropParams.targetElement.parentElement.parentElement.parentElement.parentElement;
    } else {
        dropTarget = dragAndDropParams.targetElement;
    }
    if( isValidSourceType ) {
        dragAndDropParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dropTarget
        } );
        return {
            preventDefault: true,
            dropEffect: 'copy'
        };
    }
    return {
        dropEffect: 'none'
    };
};

export const dropCustomHighlight = ( dragAndDropParams ) => {
    let sourceObjects = awDragAndDropUtils.getCachedDragData();
    var targetObject = {
        targetObjectViewId: dragAndDropParams.declViewModel.getViewId()
    };
    if( targetObject.targetObjectViewId === 'Crt1ObjectListToAddInVR' ) {
        targetObject.uid = 'stickyPanelList';
    } else {
        clearCachedDragDropData();
        return {
            preventDefault: false
        };
    }
    var draggedObjects = [];
    sourceObjects.uidList.forEach( uid => {
        draggedObjects.push( cdm.getObject( uid ) );
    } );
    pasteObjectsInList( targetObject, draggedObjects );

    clearCachedDragDropData();
    return {
        preventDefault: true
    };
};
const clearCachedDragDropData = () => {
    awDragAndDropUtils._clearCachedData();
};

/**
 * Check Is Occurence.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {boolean} true/false
 */
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

export let vr_ClosePopup = function( endItems1 ) {
    _.defer( function() {
        appCtxSvc.unRegisterCtx( 'CreateStickyPanelPopupCtx' );
        eventBus.unsubscribe( _sideNavEventSub1 );
        eventBus.unsubscribe( _locationCompleteEventSub );

        // TODO - need to pass data from commandsViewModel
        if( endItems1 ) {
            var objects = [];
            if( endItems1.dbValue.length > 0 ) {
                objects = objects.concat( endItems1.dbValue );
            }
            exports.removeObjectReferences( objects );
        }

        _vmPopupRef.options.disableClose = false;
        popupService.hide( _vmPopupRef );

       // if( appCtxSvc.ctx.aceActiveContext.context.currentState.pageId === 'tc_xrt_Content' ) {
        eventBus.publish( 'CreateStickyPanelPopup.MoveToOriginalPage' );
      //  } else {
       //     eventBus.publish( 'Crt1ContentsTable.refreshTable' );
       // }
    } );
};


export let vr_ClosePopup1 = function( endItems1 ) {
    _.defer( function() {
        appCtxSvc.unRegisterCtx( 'CreateStickyPanelPopupCtx' );
        var isVROpened = false;
        var closePanel = true;
        var page = appCtxSvc.ctx.state.params.pageId;
        var uid = appCtxSvc.ctx.state.processed.uid;
        if( uid !== undefined ) {
            var obj = cdm.getObject( uid );
            if( obj && obj.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 ) {
                isVROpened = true;
            }
        }
        //if( isVROpened === true && page === 'tc_xrt_Content' ) {
        if( isVROpened === true){
            closePanel = false;
        }
        if( closePanel ) {
            // TODO - need to pass data from commandsViewModel
            if( endItems1 ) {
                var objects = [];
                if( endItems1.dbValue.length > 0 ) {
                    objects = objects.concat( endItems1.dbValue );
                }
                exports.removeObjectReferences( objects );
            }
            _vmPopupRef.options.disableClose = false;
            popupService.hide( _vmPopupRef );
        }
    } );
};

/**
 * Remove reference from objects, so that those objects will be free to remove from cache on page change
 * @param {Array} objects - start and end objects
 */
export let removeObjectReferences = function( objects ) {
    objects.forEach( function( obj ) {
        if( _.isFunction( obj.removeReference ) ) {
            obj.removeReference();
        }
    } );
};

/**
 * Update Popup position
 */
export let updatePopupPosition1 = function() {
    let ref = '#aw_toolsAndInfo';
    if ( !checkElement( ref ) ) {
        ref = '.aw-layout-infoCommandbar';
    }
    let referenceEl = dom.get( ref );
    if ( referenceEl ) {
        var options = _vmPopupRef.options;
        options.userOptions.reference = ref;
        options.reference = referenceEl;
        options.disableUpdate = false;
        popupService.update( _vmPopupRef );
    }
};

/**
 * Check element in dom
 *
 * @param {Object} selector - the dom seletor to be checked
 * @return {Boolean} - true if present and vice versa
 */
const checkElement = ( selector )=> {
    let el = dom.get( selector );
    if ( el && el.offsetHeight > 0 && el.offsetWidth > 0 ) {
        return true;
    }
    return false;
};

/**
 * Remove given object from End Item List.
 *
 * @param {Object} subPanelContext - The view model data
 * @param {Object} vmo - Object to be removed
 */
export let removeFromEndItems = function( subPanelContext, vmo ) {
    if( vmo ) {
        _removeFromDataProvider( subPanelContext.endItems1, vmo );
        updateLocalStorageData( subPanelContext );
    }
    setTimeout( () => {
        eventBus.publish( RefreshStickyPanel );
    }, 50 );
};

/**
 * Remove given object from End Item List.
 * @param {Object} endItems1 - The view model data
 * @param {Object} sourceObject - Object to be removed
 */
export let addToVR = function( endItems1, sourceObject ) {
    var _manageAction = 'addObject';
    var createdAR = sourceObject;
    var elementsToAdd = endItems1.dbValue;
    var recipeId = '';
    var seedObjects = [];
    var manageARInputForCreateVR = createAnalysisRequest.getManageARInputForCreateVR( createdAR, _manageAction, elementsToAdd, recipeId, seedObjects );
    manageVerificationService.callManageVerificationSOA( manageARInputForCreateVR );
    setTimeout( () => {
        eventBus.publish( RefreshStickyPanel );
    }, 50 );
};

/**
 * Remove given object from provider list.
 *
 * @param {Object} dataProvider - The view model dataProvider
 * @param {Object} obj - The object to be removed
 * @returns {Boolean} is object removed from data provider list
 */
var _removeFromDataProvider = function( dataProvider, obj ) {
    if( obj ) {
        for( var i = dataProvider.dbValue.length - 1; i >= 0; i-- ) {
            if( _hasSameUnderlyingRevision( dataProvider.dbValue[ i ], obj ) ) {
                dataProvider.dbValue.splice( i, 1 );
                return true;
            }
        }
    }
    return true;
};

/**
 * @param {Object} targetObject - drop target object
 * @param {Array} sourceObjects - dragged sources objects
 * @returns {Promise} Resolved when all processing is complete.
 */
export let pasteObjectsInList = function( targetObject, sourceObjects ) {
    var deferred = AwPromiseService.instance.defer();
    if( targetObject && targetObject.uid === ITEM_LIST ) {
        _addInObjectList( parentData, sourceObjects );
    }
    eventBus.publish( RefreshStickyPanel );
    deferred.resolve();
    return deferred.promise;
};

/**
 * Add in Object List.
 *
 * @param {Object} destObjectList - The view model data
 * @param {Object} newObjs - objects to be added in End Item list
 * @returns {Boolean} is object added in data provider list
 */
var _addInObjectList = function( destObjectList, newObjs ) {
    var objectsToLoad = [];
    for( var i = 0; i <= newObjs.length - 1; i++ ) {
        var newObj = _getRevisionObject( newObjs[ i ] );
        objectsToLoad.push( newObj );
        _addInDataProvider( destObjectList, newObjs[ i ] );
    }

    // refresh the objects where has_trace_link property value is different for occurrence & revision.
    if( objectsToLoad.length > 0 ) {
        soaSvc.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
            objects: objectsToLoad
        } );
    }
    var propertiesToLoad = [ 'awp0CellProperties', 'object_string' ];
    for( var ii = 0; ii <= newObjs.length - 1; ii++ ) {
        if( _isOccurence( newObjs[ ii ] ) ) {
            propertiesToLoad.push( 'awb0UnderlyingObject' );
            break;
        }
    }
    loadModelObjects( newObjs, propertiesToLoad ).then( function() {
        eventBus.publish( RefreshStickyPanel );
    } );

    return true;
};
/**
 * Add in Data provide List.
 *
 * @param {Object} dataProvider - The data provider
 * @param {Object} newObj - The new object to be added
 * @returns {Boolean} is object added in data provider list
 */
var _addInDataProvider = function( dataProvider, newObj ) {
    var flagAdd;
    if( dataProvider && dataProvider.dbValue ) {
        flagAdd = _isExistRevObjectInArray( dataProvider.dbValue, newObj );
    }
    var isElementSelectedFromContentPWA = isElementSelectedFromContentPWAAction( newObj );
    var isAddToVR = _isElementAddedToVR( newObj );

    if( !flagAdd && !isAddToVR && isElementSelectedFromContentPWA ) {
        var obj = cdm.getObject( newObj.uid );
        dataProvider.dbValue.push( obj );
        modelObjectsList.push( obj );
        return true;
    }
    return false;
};

/**
 * Is Object added to VR
 *
 * @param {Object} objToSearch - The object to search
 * @returns {Boolean} is object Exist in data provider list
 */
var isElementSelectedFromContentPWAAction = function( objToSearch ) {
    var isAddedToVR = false;
    var modelObj = cdm.getObject( objToSearch.uid );
    if( modelObj.props.crt1AddedToAnalysisRequest ) {
        isAddedToVR = true;
    }
    return isAddedToVR;
};

/**
 * Is Object added to VR
 *
 * @param {Object} objToSearch - The object to search
 * @returns {Boolean} is object Exist in data provider list
 */
var _isElementAddedToVR = function( objToSearch ) {
    var isAddedToVR = false;
    var modelObj = cdm.getObject( objToSearch.uid );
    if( modelObj.props.crt1AddedToAnalysisRequest && modelObj.props.crt1AddedToAnalysisRequest.dbValues[ 0 ] === '1' ) {
        isAddedToVR = true;
    }
    return isAddedToVR;
};
/**
 * Is Object Exist in Object Array
 *
 * @param {Object} arrObjects - array of objects
 * @param {Object} objToSearch - The object to search
 * @returns {Boolean} is object Exist in data provider list
 */
var _isExistRevObjectInArray = function( arrObjects, objToSearch ) {
    for( var i = 0; i < arrObjects.length; i++ ) {
        if( _hasSameUnderlyingRevision( arrObjects[ i ], objToSearch ) ) {
            return true;
        }
    }
    return false;
};
/**
 * Check if underlying revision object is same
 *
 * @param {Object} obj1 - firstObject
 * @param {Object} obj2 - second object
 * @returns {Boolean} return true if both are same revision objects
 */
var _hasSameUnderlyingRevision = function( obj1, obj2 ) {
    var obj1Rev = _getRevisionObject( obj1 );
    var obj2Rev = _getRevisionObject( obj2 );

    if( obj1Rev && obj2Rev && obj1Rev.uid === obj2Rev.uid || obj1 && obj2 && _isSameObjects( obj1, obj2 ) ) {
        //If object name and RevId are same but uid are different then add obj in the list.
        if( obj1.uid !== obj2.uid ) {
            return false;
        }
        return true;
    }
    return false;
};
/**
 * Check if given objects is same
 *
 * @param {Object} obj1 - firstObject
 * @param {Object} obj2 - second object
 * @returns {Boolean} return true if both are same objects
 */
var _isSameObjects = function( obj1, obj2 ) {
    if( obj1 && obj2 && obj1.uid === obj2.uid ) {
        return true;
    }
    return false;
};
/**
 * get Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevisionObject = function( obj ) {
    var revObject = null;

    if( _isOccurence( obj ) ) {
        if( obj.props.awb0UnderlyingObject && obj.props.awb0UnderlyingObject.dbValues.length > 0 ) {
            revObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }
    } else {
        revObject = cdm.getObject( obj.uid );
    }
    return revObject;
};

/**
 * Init Start Item List Types
 *
 * @param {Object} endItems1 - The panel's view model object
 * @param {Object} rootVRObject - Context
 * @return {Object} rootVRObject Object
 */
export let initStickyPanel = function( endItems1, rootVRObject ) {
    parentData = endItems1;
    modelObjectsList = [];
    var rootObject = rootVRObject;
    var obj = cdm.getObject( rootObject.uid );
    modelObjectsList.push( obj );

    var propertiesToLoad = [ 'awp0CellProperties', 'object_string' ];
    for( var ii = 0; ii <= modelObjectsList.length - 1; ii++ ) {
        if( _isOccurence( modelObjectsList[ ii ] ) ) {
            propertiesToLoad.push( 'awb0UnderlyingObject' );
            break;
        }
    }
    loadModelObjects( modelObjectsList, propertiesToLoad ).then( function() {
        setTimeout( function() {
            eventBus.publish( RefreshStickyPanel );
            updateHeight1();
        }, 500 );
    } );
    return {
        sourceObject: obj.uid
    };
};


/**
 * Update tracelink popup data in local storage
 * @param {Object} data - object which contains start and end objects
 */
export let updateLocalStorageData = function( data ) {
    // No need to update if popup is not opened
    if( !appCtxSvc.ctx.CreateStickyPanelPopupCtx ) {
        return;
    }
    if( data ) {
        var objects = [];
        if( data.endItems1 && data.endItems1.dbValue.length > 0 ) {
            objects = objects.concat( data.endItems1.dbValue );
        }

        // Add reference to the object so that it will not getting clean when new page is loaded
        objects.forEach( function( obj ) {
            if( _.isFunction( obj.removeReference ) ) {
                obj.removeReference();
            }
        } );

        // Add reference to the object so that it will not getting clean when new page is loaded
        objects.forEach( function( obj ) {
            if( _.isFunction( obj.addReference ) ) {
                obj.addReference();
            }
        } );
    }
    if( data && data.endItems1 ) {
        var ends = _.map( data.endItems1.dbValue, 'uid' );
        var obj = {
            endItems1: ends
        };

        //Update the height of the Create TraceLink PopUp
        exports.updateHeight1();
    }
};

export let updateHeight1 = function() {
    if( _vmPopupRef && _vmPopupRef.panelEl ) {
        var el = dom.get( 'div.sw-popup-contentContainer', _vmPopupRef.panelEl );
        el.style.maxHeight = document.children[0].clientHeight - 84 + 'px';
    }
};

/**
 * Load model objects common properties require to show on sticky panel
 * @param {Array} objsToLoad - Model object list
 * @param {Array} cellProp - cell props
 * @return {Object} returns the model objects from the given input
 */
export let loadModelObjects = function( objsToLoad, cellProp ) {
    var deferred = AwPromiseService.instance.defer();
    tcVmoService.getViewModelProperties( objsToLoad, cellProp ).then( function( response ) {
        deferred.resolve( response );
    } );
    return deferred.promise;
};


export let showStickyPanel = function( popupData ) {
    crt1VRContentService.launchContentViewFromAddFromContent(popupData.options.subPanelContext.context.vrSublocationState);
    if( _loadingStickyPopup && _vmPopupRef && _vmPopupRef.panelEl ) {
        // Don't process the call if panel loading is in process Or panel is initiated but context is not yet updated
        return;
    }
    if(  !_vmPopupRef || !_vmPopupRef.panelEl ) {
        _loadingStickyPopup = true;
        // check if aw_toolsAndInfo panel is already opened
        var ref = '#aw_toolsAndInfo';
        var referenceEl = popupUtils.getElement( popupUtils.extendSelector( ref ) );
        if( referenceEl && referenceEl.offsetHeight > 0 ) {
            popupData.options.reference = '#aw_toolsAndInfo';
        }
        popupService.show( popupData ).then( function( popupRef ) {
            _vmPopupRef = popupRef;
            _loadingStickyPopup = false;
            //eventBus.publish( 'CreateStickyPanelPopup.reveal' );
            _sideNavEventSub1 = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
                if( eventData && eventData.id === 'aw_toolsAndInfo' ) {
                    setTimeout( function() {
                        exports.updatePopupPosition1();
                    }, 300 );
                }
            } );
            _locationCompleteEventSub = eventBus.subscribe( 'LOCATION_CHANGE_COMPLETE', function() {
                setTimeout( function() {
                    exports.updatePopupPosition1();
                }, 300 );
            } );
        } );
    } else {
        exports.vr_ClosePopup();
    }
};

export default exports = {
    dragOverCustomHighlight,
    dropCustomHighlight,
    clearCachedDragDropData,
    _isOccurence,
    _isWorkspceObject,
    removeObjectReferences,
    showStickyPanel,
    removeFromEndItems,
    _removeFromDataProvider,
    pasteObjectsInList,
    _addInObjectList,
    _addInDataProvider,
    _isExistRevObjectInArray,
    _isElementAddedToVR,
    _hasSameUnderlyingRevision,
    _getRevisionObject,
    initStickyPanel,
    loadModelObjects,
    _isSameObjects,
    updatePopupPosition1,
    updateHeight1,
    updateLocalStorageData,
    addToVR,
    vr_ClosePopup,
    vr_ClosePopup1,
    isElementSelectedFromContentPWAAction
};
