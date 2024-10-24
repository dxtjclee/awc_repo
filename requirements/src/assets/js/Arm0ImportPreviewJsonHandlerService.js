// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0ImportPreviewJsonHandlerService
 */
import { getBaseUrlPath } from 'app';
import appCtxService from 'js/appCtxService';
import iconSvc from 'js/iconService';
import addElementTypeHandler from 'js/addElementTypeHandler';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';


var _allowedTypesInfo = null;
var _treeData = null;
var _updatePreview = false;
var idToChildrenMap = {};
var idToObjectMap = {};
var _allowedChildTypeMap = {};
var exports = {};
var _importPreviewData = null;
var vmNodeArray = [];
var specificationSummaryMap = new Map();

var ADD_CLASS = 'diff-html-added';
var REMOVED_CLASS = 'diff-html-removed';

let _previewInitiator = '';

/**
  * for crating Map from the JSON data
  * @param {*} previewData - JSON data from Server
  */
export let createMapFromJSONData = ( previewData ) => {
    if( !previewData ) {
        previewData = _treeData;
    }

    if( previewData.displayType ) {
        _addTypeToSpecificationSummary( previewData.displayType );
    }

    var children = previewData.children;


    idToChildrenMap[ previewData.uniqueId ] = children;
    idToObjectMap[ previewData.uniqueId ] = previewData;
    for( var i = 0; i < children.length; i++ ) {
        if( children[i].propertyNameValues && children[i].propertyNameValues.length > 0 ) {
            for( var j = 0; j < children[i].propertyNameValues.length; j++ ) {
                if( children[i].propertyNameValues[j].propertyName === 'object_name' ) {
                    children[i].name = children[i].propertyNameValues[j].propertyValue;
                }
            }
        }

        var innerChildren = children[ i ];

        idToObjectMap[ innerChildren.uniqueId ] = innerChildren;
        idToObjectMap[ innerChildren.uniqueId ].parent = previewData.uniqueId;

        if( innerChildren.children && innerChildren.children.length > 0 ) {
            createMapFromJSONData( innerChildren );
        }else {
            _addTypeToSpecificationSummary( innerChildren.displayType );
        }
    }
};

function _addTypeToSpecificationSummary( objectType ) {
    if( objectType === 'RequirementSpec' ) {
        objectType = 'Requirement Specification';
    }
    if( !specificationSummaryMap.has( objectType ) ) {
        specificationSummaryMap.set( objectType, 1 );
    } else{
        var count = specificationSummaryMap.get( objectType );
        specificationSummaryMap.set( objectType, count + 1 );
    }
}

/**
  * to save the list of allowedType to populate in balloon popup
  * @param {Array} allowedTypesInfo - list to populate in balloon popup
  */
export let setAllowedTypesInfo = function( allowedTypesInfo ) {
    _allowedTypesInfo = allowedTypesInfo;
};

/**
  * to return the list of allowedType to populate in balloon popup
  * @return {Array} allowedTypesInfo - list to populate in balloon popup
  */
export let getAllowedTypesInfo = function() {
    return _allowedTypesInfo;
};

/**
  * to return the Map of the all elements
  * @param {Object} uid - UID of the Element
  * @returns {Array} Object of the UID element
  */
export let getObjectFromId = function( uid ) {
    return idToObjectMap[ uid ];
};

/**
  * to return the Map of the all elements
  * @return {Array} idToObjectMap - Map of the all elements
  */
export let getIdToObjectMapData = function() {
    return idToObjectMap;
};

/**
  * to return the Map of summary  all elements
  * @return {Map} idToObjectMap - Map of the all elements
  */
export let getSpecificationSummaryMapData = function() {
    return specificationSummaryMap;
};

/**
  * to reset the Both the Maps
  */
export let reSetMapData = function() {
    idToChildrenMap = {};
    idToObjectMap = {};
    specificationSummaryMap = new Map();
    vmNodeArray = [];
};

/**
  * to return the list of Children from the given UID
  * @param {Object} uid - UID of the Element
  * @returns {Array} children List of the UID element
  */
export let getIdToChildrenMapData = function( uid ) {
    return idToChildrenMap[ uid ];
};

/**
  * to Set the server response JSON data in the Service
  * @param {Object} treeData - JSON data from Server
  */
export let setJSONData = function( treeData ) {
    _treeData = treeData;
    _previewInitiator = '';
};

/**
  * to get the JSON data for Import SOA
  * @return  {_treeData} treeData - JSON data from Server
  */
export let getJSONData = function() {
    _removeExtraInfo( _treeData );
    return _treeData;
};

export let setPreviewInitiator = function( previewInitiator ) {
    _previewInitiator = previewInitiator;
};

export let getPreviewInitiator = function() {
    return _previewInitiator;
};

/**
  * to remove extra info from JSON data
  * @param {Object} treeData - JSON data from Server
  */
function _removeExtraInfo( treeData ) {
    var children = treeData.children;
    for( var i = 0; i < children.length; i++ ) {
        var innerChildren = children[ i ];
        innerChildren.parent && delete innerChildren.parent;
        if( innerChildren.orignalContents ) {
            innerChildren.contents = innerChildren.orignalContents;
            delete innerChildren.orignalContents;
        }
        if( innerChildren.children && innerChildren.children.length > 0 ) {
            _removeExtraInfo( innerChildren );
        }
    }
}

/**
  * to reset the Both the Maps
  * @returns {String} rootID of the Preview Doc
  */
export let getRootID = function() {
    return _treeData.uniqueId;
};

/**
  * to set the Update Preview flag
  * @param {Boolean} updatePreview - Update Preview flag
  */
export let setUpdatePreview = function( updatePreview ) {
    _updatePreview = updatePreview;
};

/**
  * to get the Update Preview flag
  * @returns {Boolean} updatePreview - Update Preview flag
  */
export let getUpdatePreview = function() {
    return _updatePreview;
};

/**
  * to set the Update Preview flag
  * @param {Boolean} importPreviewData - import Preview Data to persist
  */
export let setImportPreviewData = function( importPreviewData ) {
    _importPreviewData = importPreviewData;
};

/**
  * to get the Update Preview flag
  * @returns {Boolean} updatePreview - Update Preview flag
  */
export let getImportPreviewData = function() {
    return _importPreviewData;
};

/**
  * @param {Array} selectedElement - List of
  * @returns {Array} _allowedChildTypeMap - list of AllowedType for the selectedElement
  */
export let getAllowedChildType = function( selectedElement ) {
    return _allowedChildTypeMap[ selectedElement ];
};

/**
  * to refresh 'tree' table data.
  */
function refreshTreeData() {
    exports.setVmNodes();
    eventBus.publish( 'importPreview.refreshTreeDataProvider' );
}

/**
  * to Check whether Changing of the Selected Element is required/permitted
  *
  * @param {Object} eventData - the eventData
  *
  */
export let checkTypeChange = function( data, eventData ) {
    /**
      * If Selected type is already present in the local list
      */
    if( _allowedChildTypeMap[ eventData.sourceObject.displayName ] ) {
        changeTypeOfElement( data, eventData );
    } else {
        addElementTypeHandler._getDisplayableTypes( { type: eventData.sourceObject.displayName } ).then( function( allowedTypesInfo ) {
            exports.createAllowedChildTypeMap( eventData.sourceObject.displayName, allowedTypesInfo.objectTypesWithIcon );
            changeTypeOfElement( data, eventData );
        } );
    }
};

function checkSelection( selectedObjectFromTreeProvider, selectedObjIdCtx ) {
    for( var index = 0; index < selectedObjectFromTreeProvider.length; index++ ) {
        if( selectedObjectFromTreeProvider[index].id === selectedObjIdCtx ) {
            return true;
        }
    }
}

/**
  * to Check whether Changing of the Selected Element is required/permitted
  *
  * @param {Object} eventData - the eventData
  *
  */
function changeTypeOfElement( data, eventData ) {
    var selectedSpecID = [];
    var selectedSpecObj;
    var selectedObjIdCtx = appCtxService.getCtx( 'selectedRequirementObjectUID' );
    var loadedobjects = data.dataProviders.importPreviewTreeProvider.viewModelCollection.getLoadedViewModelObjects();
    var selectedObjectFromTreeProvider =  data.dataProviders.importPreviewTreeProvider.selectedObjects;
    for( var i = 0; i < loadedobjects.length; i++ ) {
        if( loadedobjects[i].id === selectedObjIdCtx ) {
            selectedSpecObj = loadedobjects[i];
        }
    }
    if(  selectedObjectFromTreeProvider.length <= 1 &&   selectedObjIdCtx !== '' ) {
        if( selectedObjectFromTreeProvider.length === 0 ) {
            selectedSpecID.push( selectedSpecObj );
        }else if( selectedObjectFromTreeProvider.length === 1 &&  selectedObjectFromTreeProvider[0].id  !==  selectedObjIdCtx  ) {
            selectedSpecID.push( selectedSpecObj );
        }else if( selectedObjectFromTreeProvider.length === 1 &&  selectedObjectFromTreeProvider[0].id  ===  selectedObjIdCtx  ) {
            selectedSpecID = selectedObjectFromTreeProvider;
        }else{
            //
        }
    }else if( !selectedObjIdCtx || selectedObjIdCtx === '' ) {
        selectedSpecID = selectedObjectFromTreeProvider;
    }else{
        if( checkSelection( selectedObjectFromTreeProvider, selectedObjIdCtx ) ) {
            selectedSpecID = selectedObjectFromTreeProvider;
        }else{
            selectedSpecID.push( selectedSpecObj );
        }
    }

    for( var index = 0; index < selectedSpecID.length; index++ ) {
        var childrenOfSelectedItem;
        if( selectedSpecID[index].children ) {
            childrenOfSelectedItem = selectedSpecID[index].children;
        }else{
            childrenOfSelectedItem = idToObjectMap[ selectedSpecID[index].id ].children;
        }
        var element;
        var isTypeChangeAllowed = true;
        // case if the Selected element is having no child
        if( childrenOfSelectedItem && childrenOfSelectedItem.length > 0 ) {
            for( var i = 0; i < childrenOfSelectedItem.length; i++ ) {
                element = childrenOfSelectedItem[ i ];
                // case if the Child types are allowed under the selected type of Object
                if( _allowedChildTypeMap[ eventData.sourceObject.displayName ].allowedTypeList.indexOf( element.internalType ) === -1 ) {
                    isTypeChangeAllowed = false;
                    break;
                }
            }
            if( isTypeChangeAllowed ) {
                exports.updateDataMap( selectedSpecID[index].id, eventData.sourceObject.displayName, eventData.sourceObject.internalName );
            } else {
                // 'error' handling
            }
        } else {
            exports.updateDataMap( selectedSpecID[index].id, eventData.sourceObject.displayName, eventData.sourceObject.internalName );
        }
    }
}

/**
  * to add/update/delete/revise the object
  * @param {Object} selectedRow - the eventData
  *
  */
export let changeSettingOfElement = function( selectedRow ) {
    var selectedSpecID = appCtxService.getCtx( 'selectedRequirementObjectUID' );
    var selectedTargetElement = appCtxService.getCtx( 'rmselectedTargetElement' );
    if( selectedTargetElement ) {
        if( selectedRow.sourceObject.internalName === 'NoChange' ) {
            selectedTargetElement.classList.add( 'aw-requirements-discardUpdate' );
            // Use this while reading json for save
            idToObjectMap[ selectedSpecID ].isMerged = 'true';
        } else {
            selectedTargetElement.classList.remove( 'aw-requirements-discardUpdate' );
        }
        eventBus.publish( 'importPreview.closeSettingChangePopupWindow' );
    } else {
        exports.updateDataMapSettings( selectedSpecID, selectedRow.sourceObject.displayName, selectedRow.sourceObject.internalName );
    }
};

/**
  * to Update the MAP(indirectly JSON data as well)
  * @param {Object} selectedSpecID - selected ID of the Element
  * @param {Object} typeOfSpecElement - display name of the selected type
  * @param {Object} internalNameOfSpecElement - intername of the selected type
  */
export let updateDataMap = function( selectedSpecID, typeOfSpecElement, internalNameOfSpecElement ) {
    updateSpecificationSummaryInfo( idToObjectMap[ selectedSpecID ].displayType, typeOfSpecElement );
    idToObjectMap[ selectedSpecID ].internalType = internalNameOfSpecElement;
    idToObjectMap[ selectedSpecID ].displayType = typeOfSpecElement;
    if( idToObjectMap[ selectedSpecID ].type ) {
        idToObjectMap[ selectedSpecID ].type = internalNameOfSpecElement;
    }
    updateSecondoryArea( selectedSpecID, typeOfSpecElement, internalNameOfSpecElement );
    refreshTreeData();
    eventBus.publish( 'specificationSummaryDataProvider.reset' );
};

function updateSpecificationSummaryInfo( oldOjectType, newObjectType ) {
    if( specificationSummaryMap.has( oldOjectType ) ) {
        var oldCount = specificationSummaryMap.get( oldOjectType );
        if( oldCount === 1 ) {
            specificationSummaryMap.delete( oldOjectType );
        }else {
            specificationSummaryMap.set( oldOjectType, oldCount - 1 );
        }
    }

    if( !specificationSummaryMap.has( newObjectType ) ) {
        specificationSummaryMap.set( newObjectType, 1 );
    } else {
        var newCount = specificationSummaryMap.get( newObjectType );
        specificationSummaryMap.set( newObjectType, newCount + 1 );
    }
}

/**
  * to Update the MAP(indirectly JSON data as well)
  * For Doc Compare
  * @param {Object} selectedSpecID - selected ID of the Element
  * @param {Object} settingOfSpecElement - display name of the selected setting
  * @param {Object} internalNameOfSpecElement - internalname of the selected setting
  */
export let updateDataMapSettings = function( selectedSpecID, settingOfSpecElement, internalNameOfSpecElement ) {
    idToObjectMap[ selectedSpecID ].action = internalNameOfSpecElement;
    updateSecondoryAreaSettings( selectedSpecID, settingOfSpecElement, internalNameOfSpecElement );
    refreshTreeData();
};

/**
  * to publish the setting list of the selected object
  * For Doc Compare
  * @param {*} data - the View Model data
  * @param {*} ctx - the context
  * @returns {Array} -
  */
// eslint-disable-next-line complexity
export let getSetting = function( data, ctx ) {
    var publishList = [];
    var settingList = {
        Revise: {
            iconURL: getBaseUrlPath() + '/image/cmdUpdateAssignedRevision24.svg',
            displayName: data.i18n.revise,
            internalName: 'Revise'
        },
        Update: {
            iconURL: getBaseUrlPath() + '/image/cmdUpToDate24.svg',
            displayName: data.i18n.update,
            internalName: 'Update'
        },
        Delete: {
            iconURL: getBaseUrlPath() + '/image/cmdDelete24.svg',
            displayName: data.i18n.delete,
            internalName: 'Delete'
        },
        Add: {
            iconURL: getBaseUrlPath() + '/image/cmdAdd24.svg',
            displayName: data.i18n.Add,
            internalName: 'Add'
        },
        NoChange: {
            iconURL: getBaseUrlPath() + '/image/cmdDiscardUpdate16.svg',
            displayName: data.i18n.NoChange,
            internalName: 'NoChange'
        },
        AcceptUpdate: {
            iconURL: getBaseUrlPath() + '/image/cmdUpToDate24.svg',
            displayName: data.i18n.AcceptUpdate,
            internalName: 'AcceptUpdate'
        }
    };
    var reqobject = appCtxService.getCtx( 'selectedObjSet' );
    var selectedTargetElement = appCtxService.getCtx( 'selectedTargetElement' );
    let isRoundTripPreview = appCtxService.ctx.sublocation.clientScopeURI === 'RequirementRoundTripPreviewURI';

    if( selectedTargetElement && ( selectedTargetElement.classList.contains( REMOVED_CLASS )
        || selectedTargetElement.classList.contains( ADD_CLASS ) || selectedTargetElement.classList.contains( 'diff-html-changed' ) ) ) {
        publishList = [];
        if( selectedTargetElement.classList.contains( 'aw-requirements-discardUpdate' ) ) {
            publishList.push( settingList.AcceptUpdate );
        } else {
            publishList.push( settingList.NoChange );
        }
    } else if( reqobject.isTC === 'Yes' ) {
        publishList = [];
        var isReleasedObject = Boolean( reqobject.releaseStatusValue && reqobject.releaseStatusValue.length > 0 );
        switch ( reqobject.status ) {
            case 'Update':
                if( reqobject.parent && !isRoundTripPreview ) {  // if not top line
                    publishList.push( settingList.Revise );
                    publishList.push( settingList.Delete );
                }
                publishList.push( settingList.NoChange );

                break;
            case 'NoChange':
                if( reqobject.parent && !isRoundTripPreview ) {  // if not top line
                    publishList.push( settingList.Revise );
                }
                if( reqobject.isNoChangeSelected &&  !isReleasedObject  ) {
                    publishList.push( settingList.Update );
                }
                break;
            case 'Delete':
                if( reqobject.contentChange === 'Yes' && !isRoundTripPreview ) {
                    publishList.push( settingList.Revise );
                    if( !isReleasedObject ) {
                        publishList.push( settingList.Update );
                    }
                } else {
                    publishList.push( settingList.Add );
                }
                break;
            case 'Revise':
                if( !isReleasedObject ) {
                    publishList.push( settingList.Update );
                }
                publishList.push( settingList.Delete );
                publishList.push( settingList.NoChange );
                break;
            case 'Add':
                if( !isRoundTripPreview ) {
                    publishList.push( settingList.Revise );
                    publishList.push( settingList.Update );
                }
                publishList.push( settingList.Delete );
                break;
        }
    } else {
        publishList = [];
        switch ( reqobject.status ) {
            case 'Add':
                publishList.push( settingList.Delete );
                break;
            case 'Delete':
                publishList.push( settingList.Add );
                break;
        }
    }
    return publishList;
};

/**
  * to Update the secondary area
  * @param {String} selectedSpecID - selected ID of the Element
  * @param {String} typeOfSpecElement - display name of the selected type
  * @param {String} internalNameOfSpecElement - intername of the selected type
  *
  */
function updateSecondoryArea( selectedSpecID, typeOfSpecElement, internalNameOfSpecElement ) {
    var selectedItem = $( '*[id="' + selectedSpecID + '"]' );
    var typeIconElementStrUrl = iconSvc.getTypeIconURL( internalNameOfSpecElement );
    selectedItem.find( 'typeicon' ).attr( 'title', typeOfSpecElement );
    selectedItem.find( 'img.aw-base-icon' ).attr( 'src', typeIconElementStrUrl );
    eventBus.publish( 'importPreview.closeExistingBalloonPopup' );
}

/**
  * to delete children of selected object
  * For Doc Compare
  * @param {Object} reqobject - object
  */
function deleteChildren( reqobject ) {
    for( var i = 0; i < reqobject.children.length; i++ ) {
        deleteChildren( reqobject.children[ i ] );
    }
    var childrenId = reqobject.uniqueId;
    var selectedItem = document.getElementById( childrenId );
    reqobject.selectedItemSet = selectedItem;
    appCtxService.updatePartialCtx( 'selectedObjSet', reqobject );
    reqobject.selectedItemSet.classList.remove( REMOVED_CLASS );
    reqobject.selectedItemSet.classList.add( REMOVED_CLASS );
    reqobject.status = 'Delete';
    reqobject.action = 'Delete';
}
/**
  * to add parent of selected object
  * For Doc Compare
  * @param {Object} reqobject - object
  */
function addParent( reqobject ) {
    reqobject.status = 'Add';
    reqobject.action = 'Add';
    reqobject.selectedItemSet.classList.remove( REMOVED_CLASS );
    while( reqobject.level > 1 ) {
        reqobject = idToObjectMap[ reqobject.parent ];
        var selectedItem = document.getElementById( reqobject.uniqueId );
        if( reqobject.action === 'Delete' && selectedItem !== null ) {
            addParent( reqobject );
        } else {
            return;
        }
    }
}
/**
  * to Update the secondary area after setting change
  * For Doc Compare
  * @param {String} selectedSpecID - selected ID of the Element
  * @param {String} settingOfSpecElement - display name of the selected setting
  * @param {String} internalNameOfSpecElement - intername of the selected setting
  *
  */
function updateSecondoryAreaSettings( selectedSpecID, settingOfSpecElement, internalNameOfSpecElement ) {
    var selectedItem = document.getElementById( selectedSpecID );
    var reqobject = appCtxService.getCtx( 'selectedObjSet' );
    reqobject.selectedItemSet = selectedItem;
    appCtxService.updatePartialCtx( 'selectedObjSet', reqobject );
    reqobject.selectedItemSet.classList.remove( REMOVED_CLASS );
    reqobject.status = internalNameOfSpecElement;
    reqobject.action = internalNameOfSpecElement;
    reqobject.isNoChangeSelected = false;
    var publishEventForContentUpdate = false;
    if( internalNameOfSpecElement === 'Delete' ) {
        reqobject.selectedItemSet.classList.add( REMOVED_CLASS );
        deleteChildren( reqobject );
        refreshTreeData();
    } else if( internalNameOfSpecElement === 'Add' ) {
        // Derived Merge Case - if object already available in master, Add flag to skip it while saving
        if( appCtxService.getCtx( 'deriveAndMergeClick' ) && reqobject.masterUId === '' && reqobject.objectFromMaster ) {
            // Check if object is available in master json
            reqobject.objectAlreadyAvailable = true;
        }
        reqobject = idToObjectMap[ reqobject.parent ];
        selectedItem = document.getElementById( reqobject.uniqueId );
        if( reqobject.action === 'Delete' && selectedItem !== null ) {
            addParent( reqobject );
        }
        refreshTreeData();
    } else if( internalNameOfSpecElement === 'NoChange' ) {
        reqobject.selectedItemSet.getElementsByClassName( 'aw-requirement-bodytext' )[0].innerHTML = reqobject.existingDocumentData || '';
        reqobject.isNoChangeSelected = true;
        refreshTreeData();
        publishEventForContentUpdate = true;
    } else {
        if( selectedItem ) {
            reqobject.selectedItemSet.getElementsByClassName( 'aw-requirement-bodytext' )[0].innerHTML = reqobject.contents;
            reqobject.isNoChangeSelected = false;
            publishEventForContentUpdate = true;
        }
    }
    if( publishEventForContentUpdate && appCtxService.getCtx( 'deriveAndMergeClick' ) ) {
        eventBus.publish( 'importPreview.previewContentUpdatedForObject', {
            reqDomElement: reqobject.selectedItemSet
        } );
    }
    eventBus.publish( 'importPreview.closeSettingChangePopupWindow' );
}

/**
  * for creating Local copy of the Displayable Types to avoid duplicate SOA calls
  * @param {String} selectedObjeType - Parent of Selected Object
  * @param {Array} arrayOfAllowedType - array Of allowedType
  * @param {String} typeToIgnore - selected Object Name
  *
  */
export let createAllowedChildTypeMap = function( selectedObjeType, arrayOfAllowedType, typeToIgnore ) {
    var allowedTypeList = [];
    var allowedChildTypeList = [];
    for( var index = 0; index < arrayOfAllowedType.length; index++ ) {
        var objectElements = arrayOfAllowedType[ index ];
        allowedChildTypeList.push( objectElements );
        allowedTypeList.push( objectElements.typeName );
    }
    _allowedChildTypeMap[ selectedObjeType ] = { allowedTypeList: allowedTypeList, allowedChildTypeList: allowedChildTypeList };
};

export let clearvmNodeArray = function( ) {
    vmNodeArray = [];
};
/**
  *
  * @param {Object} vmNode -
  */
export let setVmNodes = function( vmNode ) {
    if( vmNode ) {
        var oldObject = false;
        var lengthOfLoop = vmNodeArray.length;
        for( var i = 0; i < lengthOfLoop; i++ ) {
            var node = vmNodeArray[ i ];
            if( node.uid === vmNode.uid ) {
                oldObject = true;
                break;
            }
        }
        if( !oldObject ) {
            vmNodeArray.push( vmNode );
        }
    } else {
        vmNodeArray = [];
    }
};

/**
  *
  * @returns {vmNodeArray} -
  */
export let getVmNodes = function() {
    return vmNodeArray;
};

export let setDisplayType = function( node, specElementList ) {
    for( var j = 0; j < specElementList.length; j++ ) {
        var typeWithIcon = specElementList[ j ];
        if( node && node.displayType === typeWithIcon.realTypeName ) {
            node.type = node.internalType;
            node.displayType = typeWithIcon.displayTypeName;
            node.internalType = typeWithIcon.realTypeName;
            break;
        }
        if( node && node.internalType === typeWithIcon.realTypeName ) {
            node.type = node.internalType;
            node.displayType = typeWithIcon.displayTypeName;
            break;
        }
    }
};
export let updateDisplayTypes = function( parent, specElementList ) {
    var childs = parent.children;
    for ( var i = 0; i < childs.length; i++ ) {
        exports.setDisplayType( childs[i], specElementList );
        exports.updateDisplayTypes( childs[i], specElementList );
    }
};
export default exports = {
    createMapFromJSONData,
    setAllowedTypesInfo,
    getAllowedTypesInfo,
    getObjectFromId,
    getIdToObjectMapData,
    reSetMapData,
    getIdToChildrenMapData,
    setJSONData,
    getJSONData,
    setPreviewInitiator,
    getPreviewInitiator,
    getRootID,
    setUpdatePreview,
    getUpdatePreview,
    setImportPreviewData,
    getImportPreviewData,
    getAllowedChildType,
    checkTypeChange,
    changeSettingOfElement,
    updateDataMap,
    updateDataMapSettings,
    getSetting,
    createAllowedChildTypeMap,
    setVmNodes,
    getVmNodes,
    getSpecificationSummaryMapData,
    setDisplayType,
    updateDisplayTypes,
    clearvmNodeArray
};

