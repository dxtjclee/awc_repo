// Copyright (c) 2022 Siemens

/**
 * This provides functionality related to traceability matrix to replace the structure after matrix gets generated
 * @module js/Arm0PasteCrossReferenceLinkPopup
 */
import ckeditorOperations from 'js/ckeditorOperations';
import appCtxSvc from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import requirementsUtils from 'js/requirementsUtils';
import iconService from 'js/iconService';
import eventBus from 'js/eventBus';

var exports = {};

var _data = null;

/**
 * Method to initialize the view model properties of popup
 * @param {Object} data - the viewmodel data for this panel
 */
export let initPopup = function( data ) {
    _data = data;
    var canShowCustomTextBox = false;
    var crossRefLinkData = JSON.parse( localStorage.getItem( 'rmCrossRefLinkClipboard' ) );
    if( crossRefLinkData ) {
        data.pasteOptionsItems.dbValue[ 0 ].displayName = crossRefLinkData.paraNum + ' : ' + crossRefLinkData.name;
        data.pasteOptionsItems.dbValue[ 2 ].displayName = crossRefLinkData.paraNum + ' : ' + crossRefLinkData.name;
        data.pasteOptionsItems.dbValue[ 1 ].displayName = crossRefLinkData.paraNum + ' ' + crossRefLinkData.id + ' ' + crossRefLinkData.name;
        data.pasteOptionsItems.dbValue[ 3 ].displayName = crossRefLinkData.paraNum + ' ' + crossRefLinkData.id + ' ' + crossRefLinkData.name;
        data.pasteOptionsItems.dbValue[ 2 ].iconURL = iconService.getTypeIconURL( crossRefLinkData.type );
        data.pasteOptionsItems.dbValue[ 3 ].iconURL = iconService.getTypeIconURL( crossRefLinkData.type );
        data.pasteOptionsItems.dbValue[ 2 ].type = crossRefLinkData.type;
        data.pasteOptionsItems.dbValue[ 3 ].type = crossRefLinkData.type;
        eventBus.publish( 'pasteCrossReferenceLinkPopup.refreshPasteOptionsItems' );

        // Initialize selected data with first option
        var selectedObject = {
            displayName: crossRefLinkData.paraNum + ' : ' + crossRefLinkData.name
        };
    }

    return{
        pasteOptionsItems :data.pasteOptionsItems,
        selectedObject :selectedObject,
        canShowCustomTextBox:canShowCustomTextBox
    };
};
/**
 * Method to set default selection
 *  @param {Object} data The data object of view model
 */
export let defaultSelection = function( data ) {
    data.dataProviders.actionsList.selectionModel.setSelection( data.pasteOptionsItems.dbValue[ 0 ] );
    var radiobtn = document.getElementsByClassName( 'aw-requirement-crossRefDefaultSlected' );
    radiobtn[0].setAttribute( 'checked', 'true' );
};
/**
 * Method to set selected object
 * @param {Object} data The data object of view model
 */
export let selectAction = function( data ) {
    var canShowCustomTextBox = false;
    var selectedObject = data.eventData.selected[0];
    if( selectedObject && selectedObject.displayName === 'Custom' ) {
        canShowCustomTextBox = true;
    }
    if( !selectedObject ) {
        selectedObject = data.selectedObject;
        data.dataProviders.actionsList.selectionModel.setSelection( selectedObject );
    }
    var index = data.dataProviders && data.dataProviders.actionsList.getSelectedIndices()[0];
    var radioDefbtn = document.getElementsByClassName( 'aw-requirement-crossRefDefaultSlected' );
    var radiobtn = document.getElementsByClassName( 'aw-requirement-crossRefInput' );
    if( index === 0  && radioDefbtn[0].getAttribute( 'checked' ) !== true  ) {
        radioDefbtn[0].setAttribute( 'checked', 'true' );
        radioDefbtn[0].checked = true;
    }else {
        if( index > 0 && radiobtn[index - 1].getAttribute( 'checked' ) !== true ) {
            radiobtn[index - 1].setAttribute( 'checked', 'true' );
            radiobtn[index - 1].checked = true;
        }
    }
    return{
        selectedObject:selectedObject,
        canShowCustomTextBox:canShowCustomTextBox
    };
};

/**
 * Method to decide whether to show cross refeprece link popup or not.
 */
export let canShowPasteCrossRefLinkPopup = function() {
    var modelObjects = ClipboardService.instance.getContents();
    var crossRefLinkObject = JSON.parse( localStorage.getItem( 'rmCrossRefLinkClipboard' ) );
    for( var i = 0; i < modelObjects.length; i++ ) {
        if( modelObjects[ i ].props ) {
            if( !modelObjects[ i ].props.awb0UnderlyingObject ) {
                var cellProp = [ 'awb0UnderlyingObject' ];
                var arrModelObjs = [ modelObjects[ i ] ];
                requirementsUtils.loadModelObjects( arrModelObjs[ 0 ], cellProp ).then( function() {
                    self.showPopup( modelObjects[ i ], crossRefLinkObject.revID );
                } );
            } else {
                self.showPopup( modelObjects[ i ], crossRefLinkObject.revID );
                break;
            }
        }
    }
};

/**
 * Method to fire event to show cross reference link popup.
 * @param {Object} modelObject The model object copied for cross reference.
 * @param {String} revID The revision id of the object.
 */
self.showPopup = function( modelObject, revID ) {
    if( modelObject.props && modelObject.props.awb0UnderlyingObject.dbValues[ 0 ] === revID ) {
        eventBus.publish( 'requirementDocumentation.showPasteCrossReferenceLinkPopup' );
    }
};

/**
 * Method to fire event to show cross reference link popup.
 */
export let closePopupWindow = function() {
    eventBus.publish( 'awPopup.close' );
};

/**
 * Method to paste cross reference link in ckeditor
 * @param {Object} data The data object of view model
 */
export let pasteCrossRefLink = function( data ) {
    var linkDisplayValue = null;
    var iconURL = null;
    if( data.selectedObject.displayName === 'Custom' ) {
        linkDisplayValue = data.customTextBox.dbValue;
    } else {
        if( data.selectedObject.iconURL ) {
            iconURL = data.selectedObject.iconURL;
        }
        linkDisplayValue = data.selectedObject.displayName;
    }
    var crossRefLinkData = JSON.parse( localStorage.getItem( 'rmCrossRefLinkClipboard' ) );
    ckeditorOperations.insertCrossReferenceLink( appCtxSvc.ctx.AWRequirementsEditor.id, crossRefLinkData.occID, crossRefLinkData.revID, linkDisplayValue, iconURL, appCtxSvc.ctx );
    localStorage.removeItem( 'rmCrossRefLinkClipboard' );
};

/**
 * Method to fire event to initialize the view model properties of popup
 */
export let callInitPasteCrossRefLinkPopup = function() {
    eventBus.publish( 'pasteCrossReferenceLinkPopup.afterReveal' );
};

export default exports = {
    initPopup,
    defaultSelection,
    selectAction,
    canShowPasteCrossRefLinkPopup,
    closePopupWindow,
    pasteCrossRefLink,
    callInitPasteCrossRefLinkPopup
};
