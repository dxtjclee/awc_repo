// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0ShowActionsPanelView
 */
import appCtxService from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import cdm from 'soa/kernel/clientDataModel';
import requirementsUtils from 'js/requirementsUtils';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import notyService from 'js/NotyModule';
import arm0RemoveElementService from 'js/arm0RemoveElementService';
import soaSvc from 'soa/kernel/soaService';
import { resetPrimaryWorkArea } from 'js/Arm0RequirementDocumentationACEEditor';
import { popupService } from 'js/popupService';

var exports = {};
var _popupRef;


export let setPopupId = function( popupRef ) {
    _popupRef = popupRef;
};

/**
 * copy object to clipboard
 */
export let copyObjectToClipboard = function( data ) {
    var objects = exports.getSelectedObject();
    ClipboardService.instance.setContents( objects );
    if( objects.length === 1 ) {
        data.copiedObjectName = _getObjectName( objects[ 0 ] );
    }
    return objects;
};

/**
 * object_string property might not be loaded, so fetching name from awb0UnderlyingObject property
 * @param {Object} modelObject - object
 * @returns {String} object name
 */
var _getObjectName = function( modelObject ) {
    if( modelObject.props && modelObject.props.object_string && modelObject.props.object_string.uiValues[ 0 ] ) {
        return modelObject.props.object_string.uiValues[ 0 ];
    } else if( modelObject.props && modelObject.props.awb0UnderlyingObject && modelObject.props.awb0UnderlyingObject.uiValues[ 0 ] ) {
        var underlyingObject = modelObject.props.awb0UnderlyingObject.uiValues[ 0 ];
        var partialString = underlyingObject.substr( underlyingObject.indexOf( ';' ) + 1, underlyingObject.length );
        return partialString.substr( partialString.indexOf( '-' ) + 1, partialString.length );
    }
    return '';
};

/**
 * create input for move operations
 *
 * @param {Object} data - the data object of view model
 * @param {Object} selectedRow - the selected command
 */
export let createInputForMoveOperation = function( data, selectedRow ) {
    if( selectedRow.sourceObject.displayName === data.i18n.moveUpCommandTitle ) {
        data.operationType = 1;
    } else if( selectedRow.sourceObject.displayName === data.i18n.moveDownCommandTitle ) {
        data.operationType = 2;
    } else if( selectedRow.sourceObject.displayName === data.i18n.promoteCommandTitle ) {
        data.operationType = 3;
    } else if( selectedRow.sourceObject.displayName === data.i18n.demoteCommandTitle ) {
        data.operationType = 4;
    }
    data.dispatch( { path: 'data.operationType', value: data.operationType } );
    var newModelObject = exports.getSelectedObject();
    data.newSelectedObject = newModelObject[ 0 ];
    data.dispatch( { path: 'data.newSelectedObject', value: data.newSelectedObject } );
};

/**
 * Show leave warning message
 *
 * @param {Object} data - The view model data
 */
var _showUpdateRuleNotificationWarning = function( data ) {
    var msg = data.i18n.removeSingleReqConfirmation.replace( '{0}', _getObjectName( appCtxService.ctx.rmselected[ 0 ] ) );
    if( appCtxService.ctx.rmselected.length > 1 ) {
        msg = data.i18n.removeMultipleReqConfirmation.replace( '{0}', appCtxService.ctx.rmselected.length );
    }
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.removeTitle,
        onClick: function( $noty ) {
            $noty.close();
            exports.cutObjectFromClipboard( data );
        }
    } ];

    notyService.showWarning( msg, buttons );
};

export let cutObjectFromClipboard = function( data ) {
    var object = appCtxService.getCtx( 'rmselected' );
    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2018-05-OccurrenceManagement', 'removeElements', {
        elementsToRemove: object
    } ).then( function( response ) {
        data.deleted = response.deleted;
        arm0RemoveElementService.performPostRemoveAction( data );
        if( response.deleted ) {
            exports.closeExistingBalloonPopup();
        }
    } );
};

/**
 * Handle command action on typeicon
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedObject - selected row
 */
export let handleCommandSelection = function( data, selectedObject, ctx ) {
    var row = selectedObject.selectedRow;
    var eventData = {
        sourceObject: row
    };
    if( row.internalName === 'Copy' ) {
        eventBus.publish( 'requirementDocumentation.copyObjectCommand' );
    }
    if( row.internalName === 'Remove' ) {
        _showUpdateRuleNotificationWarning( data );
    }
    if( row.internalName === 'Paste As Child' || row.internalName === 'Paste As Sibling' ) {
        eventBus.publish( 'requirementDocumentation.pasteObjectCommand', eventData );
    }
    if( row.internalName === 'Promote' || row.internalName === 'Demote' || row.internalName === 'Move Up' || row.internalName === 'Move Down' ) {
        eventBus.publish( 'requirementDocumentation.moveCommand', eventData );
    }
    if( row.internalName === 'Freeze' ) {
        appCtxService.registerCtx( 'operationPerformedFromCkeditor', true );
        eventBus.publish( 'Arm0ShowActionsPanel.showFreeeUnfreezePopup', eventData );
    }
    if( row.internalName === 'Unfreeze' ) {
        appCtxService.registerCtx( 'operationPerformedFromCkeditor', true );
        eventBus.publish( 'Arm0ShowActionsPanel.unfreezeObject' );
    }
    if( row.internalName === 'Overwrite' ) {
        appCtxService.registerCtx( 'operationPerformedFromCkeditor', true );
        eventBus.publish( 'requirementDocumentation.overwriteCommand', eventData );
    }
    if( row.internalName === 'Cross Reference' ) {
        eventBus.publish( 'Arm0ShowActionsPanel.CopyCrossReferenceLink' );
    }
};

export let pasteObjectDataToLocalStorageForCRL = function( ctx ) {
    var object = exports.getSelectedObject();
    var modelObject;
    if( object !== undefined ) {
        modelObject = object[ 0 ];
    } else {
        modelObject = ctx.mselected[ 0 ];
    }
    var cellProp = [ 'arm1ParaNumber', 'awb0ArchetypeName', 'awb0ArchetypeId', 'awb0UnderlyingObject' ];
    var arrModelObjs = [ modelObject ];
    requirementsUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
        var crossRefLinkData = {
            paraNum: modelObject.props.arm1ParaNumber.dbValues[ 0 ],
            name: modelObject.props.awb0ArchetypeName.dbValues[ 0 ],
            id: modelObject.props.awb0ArchetypeId.dbValues[ 0 ],
            occID: modelObject.uid,
            revID: modelObject.props.awb0UnderlyingObject.dbValues[ 0 ],
            type: modelObject.type
        };
        ClipboardService.instance.setContents( arrModelObjs );
        localStorage.setItem( 'rmCrossRefLinkClipboard', JSON.stringify( crossRefLinkData ) );
        exports.closeExistingBalloonPopup();
        eventBus.publish( 'showActionPopup.close' );
    } );
};

export let updateHeight = function( data ) {
    var size = data.actionItems.dbValue.length;
    var actionsBalloonPopup = document.getElementsByClassName( 'aw-popup-balloon' );
    if( actionsBalloonPopup && actionsBalloonPopup.length > 0 ) {
        var popupLayoutEle = actionsBalloonPopup[ 0 ];
        var scrollPanel = popupLayoutEle.getElementsByClassName( 'aw-base-scrollPanel' );
        if( scrollPanel && scrollPanel.length > 0 ) {
            if( size === 1 ) {
                scrollPanel[ 0 ].style.height = 50 + 'px';
                popupLayoutEle.style.height = '100px';
            } else {
                scrollPanel[ 0 ].style.height = 35 * size + 'px';
                popupLayoutEle.style.height = 35 * size + 20 + 'px';
            }
        }
    }
};

/**
 * Returns the selected object
 *
 * @return {Object} selected object
 */
export let getSelectedObject = function() {
    return appCtxService.getCtx( 'rmselected' );
};

/**
 * Method to update the options. If nothing is copied thrn only show Cut and Copy else
 * show paste options as well
 * @param {Object} data - the data object of view model
 */
export let updateOptions = function( data ) {
    appCtxService.ctx.Arm0ShowActionPanelVisible = true;
    var selObjects = appCtxService.getCtx( 'rmselected' );
    var metadataObjects = appCtxService.getCtx( 'selectedRequirementObjectUID' );

    // Check Paste commands
    var clipboradObjects = ClipboardService.instance.getContents();
    if( clipboradObjects.length > 0 && selObjects.length === 1 ) { // Paste options disabled for multi-select
        if( !_isPasteOptionsPresent( data.actionItems.dbValue ) ) {
            if( selObjects[ 0 ].uid === appCtxService.ctx.occmgmtContext.topElement.uid ) {
                data.actionItems.dbValue = data.actionItems.dbValue.concat( data.pasteOptions.options[ 0 ] );
            } else {
                data.actionItems.dbValue = data.actionItems.dbValue.concat( data.pasteOptions.options );
            }
        }
    } else {
        data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
            return value.internalName !== 'Paste As Child' && value.internalName !== 'Paste As Sibling';
        } );
    }

    var isTopLineSelected = isTopNodeSelected( selObjects );

    //Move operations only for single select
    if( selObjects.length > 1 || isTopLineSelected ) {
        data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
            return !( value.internalName === 'Demote' || value.internalName === 'Promote' || value.internalName === 'Move Down' || value.internalName === 'Move Up' );
        } );
    }
    // Cross-Reference only for single select
    if( selObjects.length > 1 ) {
        data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
            return value.internalName !== 'Cross Reference';
        } );
    }

    // Remove not supported for top node
    if( isTopLineSelected ) {
        data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
            return value.internalName !== 'Remove';
        } );
    }

    var isReqSpecSelected = isObjectOfType( selObjects, 'Arm0RequirementSpecElement' );
    var derivedObjectMetadata = getDerivedObjectMetadata( metadataObjects );

    // Check for Derived objects
    if( !derivedObjectMetadata.isDerived ) {
        data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
            return value.internalName !== 'Freeze' && value.internalName !== 'Unfreeze' && value.internalName !== 'Overwrite';
        } );
    } else {
        if( ( derivedObjectMetadata.isFrozen || derivedObjectMetadata.isMasterChanged ) && !isReqSpecSelected ) {
            return;
        } else if( derivedObjectMetadata.isOverwrite && !isReqSpecSelected ) {
            data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
                return value.internalName !== 'Freeze' && value.internalName !== 'Unfreeze' &&
                    value.internalName !== 'Overwrite';
            } );
        } else if( isReqSpecSelected ) {
            data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
                return value.internalName !== 'Unfreeze' && value.internalName !== 'Freeze' && value.internalName !== 'Overwrite';
            } );
        } else {
            data.actionItems.dbValue = data.actionItems.dbValue.filter( function( value ) {
                return value.internalName !== 'Unfreeze';
            } );
        }
    }
    var requiredHeight = data.actionItems.dbValue.length * 35 + 32; //padding;
    var actionsBalloonPopup = document.getElementsByClassName( 'aw-requirement-actionsPanel' );

    if( actionsBalloonPopup && actionsBalloonPopup[ 0 ] && actionsBalloonPopup.length > 0 ) {
        var panelScrollBody = actionsBalloonPopup[ 0 ].parentElement;
        panelScrollBody.style.height = requiredHeight + 'px';
        panelScrollBody.style.width = '200px';
    }

    return {
        actionItemsList: data.actionItems,
        pasteOptions: data.pasteOptions
    };
};

/**
 *  Check if the actionItems objects have any of the paste options value.
 */
var _isPasteOptionsPresent = function( actionItemsObjects ) {
    for ( var i = 0; i < actionItemsObjects.length; i++ ) {
        if( actionItemsObjects[i].internalName === ( 'Paste As Child' || 'Paste As Sibling' ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Return true if any object from list matches the type
 * @param {Array} objects - list of objects
 * @param {String} type - type to find
 * @returns {Boolean} - true if any object is a type of given type
 */
export var isObjectOfType = function( objects, type ) {
    var isSpec = false;
    objects.forEach( object => {
        if( object.type === type ) {
            isSpec = true;
        }
    } );
    return isSpec;
};

var isTopNodeSelected = function( objects ) {
    var isTop = false;
    objects.forEach( object => {
        if( appCtxService.ctx.aceActiveContext && appCtxService.ctx.aceActiveContext.context &&
            appCtxService.ctx.aceActiveContext.context.topElement && appCtxService.ctx.aceActiveContext.context.topElement.uid === object.uid ) {
            isTop = true;
        }
    } );
    return isTop;
};

/**
 * Function to return derived objects metadata
 * isDerived will be true if all objects are derived. Same applicable for isFrozen, isOverwrite, isMasterChanged
 *
 * @param {Array} objects - list of objects
 * @returns {Object} derived object info
 */
export var getDerivedObjectMetadata = function( objects ) {
    var derivedObject = {
        isFrozen: true,
        isDerived: true,
        isOverwrite: false,
        isMasterChanged: true
    };
    objects.forEach( object => {
        if( !object.isDerived || object.isDerived !== 'true' ) {
            derivedObject.isDerived = false;
        }
        if( !object.isFrozen || object.isFrozen !== 'true' ) {
            if( !object.isMasterChanged || object.isMasterChanged !== 'true' ) {
                derivedObject.isFrozen = false;
            }
        }
        if( !derivedObject.isOverwrite && ( object.isOverwrite || object.isOverwrite === 'true' ) ) {
            derivedObject.isOverwrite = true;
        }
        if( !object.isMasterChanged || object.isMasterChanged !== 'true' ) {
            derivedObject.isMasterChanged = false;
        }
    } );

    return derivedObject;
};

/**
 * Method to do the paste opertion depending on selected option
 * @param {Object} data - the data object of view model
 * @param {Object} selectedRow - the clicked  action element
 */
export let pasteObject = function( data, selectedRow ) {
    var contextObject = appCtxService.getCtx( 'rmselected' )[ 0 ];
    if( selectedRow.sourceObject.displayName === data.i18n.pasteAsChildCommand ) {
        data.mselected = contextObject;
    } else {
        data.mselected = cdm.getObject( contextObject.props.awb0Parent.dbValues[ 0 ] );
    }
    var clipboradObjects = ClipboardService.instance.getContents();
    data.objectFromClipboard = clipboradObjects;
    return {
        objectFromClipboard: clipboradObjects,
        mselected: data.mselected
    };
};

/**
 * Reset the documentation tab after paste is clicked
 */
export let fireResetDocViewEvent = function() {
    eventBus.publish( 'requirementDocumentation.closeExistingBalloonPopup' );
    eventBus.publish( 'requirementDocumentation.refreshDocumentationTab' );
};

/**
 * Close instance of aw-balloon-popup created to show type actions
 */
export let closeExistingBalloonPopup = function() {
    appCtxService.ctx.Arm0ShowActionPanelVisible = false;
    if( _popupRef &&  _popupRef.options ) {
        _popupRef.options.disableClose = false;
        popupService.hide( _popupRef );
        _popupRef = undefined;
    }
};

/**
 * Register context for show type actions
 *
 *  @param {Object} data - The view model data
 */
export let registerCxtForActionsPanel = function( data ) {
    exports.closeExistingBalloonPopup();
    var popupHeight = 240;

    var selectedObjects = [];
    var selectedRequirementObjectMetadata = [];
    data.eventData.sourceObject.forEach( obj => {
        var placeholder = obj.uid;

        var modelObject = cdm.getObject( placeholder );
        selectedObjects.push( modelObject );
        selectedRequirementObjectMetadata.push( obj );
    } );

    appCtxService.registerCtx( 'selectedRequirementObjectUID', selectedRequirementObjectMetadata );
    appCtxService.registerCtx( 'rmselected', selectedObjects );
    var clipboradObjects = ClipboardService.instance.getContents();
    if( clipboradObjects.length > 0 ) {
        popupHeight += 70;
    }
    // if( _isDerived ) {
    //     popupHeight += 70;
    // }
    data.eventData.popupHeight = popupHeight + 'px';
    setTimeout( () => {
        eventBus.publish( 'requirementDocumentation.showActionsPanel', data.eventData );
        }, 500 );
};

export let resetPwa = function() {
    resetPrimaryWorkArea();
};

export default exports = {
    copyObjectToClipboard,
    createInputForMoveOperation,
    handleCommandSelection,
    pasteObjectDataToLocalStorageForCRL,
    getSelectedObject,
    updateOptions,
    pasteObject,
    fireResetDocViewEvent,
    closeExistingBalloonPopup,
    registerCxtForActionsPanel,
    updateHeight,
    isObjectOfType,
    getDerivedObjectMetadata,
    cutObjectFromClipboard,
    resetPwa,
    setPopupId
};
