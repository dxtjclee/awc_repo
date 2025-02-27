// Copyright (c) 2022 Siemens

/**
 * @module js/wiEditor.service
 */

import _ from 'lodash';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import appCtxService from 'js/appCtxService';
import _localeService from 'js/localeService';
import { constants as wiCtxConstants } from 'js/wiCtxConstants';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import leavePlaceService from 'js/leavePlace.service';
import AwPromiseService from 'js/awPromiseService';
import popupSvc from 'js/popupService';
import eventBus from 'js/eventBus';

let _wiRemoveStepService = null;
let _popupRef = null;
let editorInstances = [];
let wiEditorSelectedObjectData = {};

const instrMessagePath = '/i18n/InstructionsEditorMessages';
const NOT_FOUND = -1;
const TEXTAREA = 'Textarea';
const TOOLBAR_CONTAINER_ELEMENT_ID = '#wiEditorToolbarContainer';

export let ckeditor5ServiceInstance = null;

/**
 * Function to load correct RichText Editor based on browser compatibility
 * Ckeditor5 supported on all modern browsers except Internet Explorer
 *
 */
function loadRichTextEditor() {
    import( '@swf/ckeditor5' ).then( v => v.default ).then(
        function( response ) {
            ckeditor5ServiceInstance = response;
        } );
}

/**
 * @param {String} saveInputWriter - saveInputWriter.
 * @param {String} relatedObjects - relatedObjects.
 */
export let saveObject = function( saveInputWriter, relatedObjects ) {
    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        let dirtyEditors = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR );
        //clear dirty editors
        resetDirtyEditors();
    } );
};

/**
 * editorHasChanges
 *
 * @return {Boolean} editorHasChanges
 */
export const editorHasChanges = function() {
    let isEnabled = false;
    let dirtyEditors = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR );
    if( !_.isEmpty( dirtyEditors ) ) {
        isEnabled = true;
    }
    return isEnabled;
};

/**
 * @param {object} data :result
 * @returns {object} message
 */
function displayConfirmationMessage( callback ) {
    const resource = _localeService.getLoadedText( instrMessagePath );

    return mfgNotificationUtils.displayConfirmationMessage( resource.leaveConfirmation, resource.save, resource.discard ).then(
        () => {
            //on save
            saveWorkInstructions();
            clearEditorData();
        },
        () => {
            clearEditorData();
        }
    );
}

/**
 * @param {object} editorSelectedObject :the object of selected editor
 * @returns {object} message
 */
function displayRemoveStepConfirmationMessage( editorSelectedObject ) {
    let resource = _localeService.getLoadedText( instrMessagePath );

    let buttonsName = {
        confirm: resource.cancel,
        cancel: resource.remove
    };

    let removeStepConfirmationMessage = resource.removeStepConfirmation + editorSelectedObject.props.object_string.dbValues[ 0 ];

    return mfgNotificationUtils.displayConfirmationMessage( removeStepConfirmationMessage, buttonsName ).then(
        function( response ) {
            //On cancel do nothing
        },
        function() {
            //On remove case call SOA
            _wiRemoveStepService.removeStep( editorSelectedObject );
        } );
}

/**
 * editor On Focus
 * @param {Object} instance instance
 * @param {String} editorId editor id
 */
function editorOnFocused( instance, editorId ) {
    if( instance ) {
        eventBus.publish( 'wi.closeAutoPredictListPopup' );
        let wiEditorCtx = appCtxService.getCtx( wiCtxConstants.WI_EDITOR );
        let selectedObj = wiEditorCtx.EditorIdToObjUid[ editorId ].data.object;

        if( selectedObj && selectedObj.uid &&
            ( !getSelectedEditorObjectData().selectedObject || selectedObj.uid !== getSelectedEditorObjectData().selectedObject.uid ) ) {
            let selectedObjectData = {
                selectedObject: selectedObj,
                selectedObjectInstanceID: editorId
            };
            const selectedObjects = [];
            selectedObjects.push( selectedObj );
            eventBus.publish( 'stepEditor.clicked', { selectedObjects } );
            appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_SELECTED_OBJECT_DATA, selectedObjectData );
        }
    }
}

/**
 * editor On Change
 * @param {Object} instance instance
 * @param {String} editorId editor id
 */
function editorOnChange( instance, editorId ) {
    if( instance ) {
        let dirtyEditors = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR );
        let newlyAddedStxElementsUID = [];
        let newlyAddedPartsToolsUID = [];
        let newlyAddedVisualsUID = [];
        if( !dirtyEditors ) {
            dirtyEditors = {};
        }
        if( dirtyEditors[ editorId ] && dirtyEditors[ editorId ].data.newlyAddedStxElementsUID ) {
            newlyAddedStxElementsUID = dirtyEditors[ editorId ].data.newlyAddedStxElementsUID;
        }
        if( dirtyEditors[ editorId ] && dirtyEditors[ editorId ].data.newlyAddedPartsToolsUID ) {
            newlyAddedPartsToolsUID = dirtyEditors[ editorId ].data.newlyAddedPartsToolsUID;
        }
        if( dirtyEditors[ editorId ] && dirtyEditors[ editorId ].data.newlyAddedVisualsUID ) {
            newlyAddedVisualsUID = dirtyEditors[ editorId ].data.newlyAddedVisualsUID;
        }
        dirtyEditors[ editorId ] = {
            data: {
                editorId: editorId,
                isDirty: true,
                newlyAddedStxElementsUID: newlyAddedStxElementsUID,
                newlyAddedPartsToolsUID: newlyAddedPartsToolsUID,
                newlyAddedVisualsUID: newlyAddedVisualsUID
            }
        };
        let wiEditorContent = instance.getData();
        if( wiEditorContent === '' ) {
            dirtyEditors[ editorId ].data.isDirty = false;
        }
        appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR, dirtyEditors );
        appCtxService.updatePartialCtx( wiCtxConstants.WI_IS_SAVE_INSTRUCTIONS_ENABLED, true );
    }
}
/** */
export const registerEditorLeaveHandler = function() {
    window.addEventListener( 'beforeunload', onBeforeUnload );
    leavePlaceService.registerLeaveHandler( {
        okToLeave: function() {
            if( editorHasChanges() ) {
                return displayConfirmationMessage( function() {
                    // Nothing to implement
                } );
            }
            return AwPromiseService.instance.resolve();
        }
    } );
};

/**
 * The function to execute before reload page
 *
 * @param {Object} eventData the event
 */
export const onBeforeUnload = function( eventData ) {
    if( editorHasChanges() ) {
        // Cancel the event
        eventData.preventDefault();
        eventData.returnValue = '';
    }
};

/**
 * get Editor Div Id from Object Uid
 * @param {String} objID objID
 * @return {String} divID
 */
export const getDivId = function( objID ) {
    let replaceBy = '';

    //Remove following characters (':', '/','.','$','_') from object ID
    let divID = _.replace( objID, new RegExp( ':', 'g' ), replaceBy );
    divID = _.replace( divID, new RegExp( '/', 'g' ), replaceBy );
    divID = _.replace( divID, /\./g, replaceBy );
    divID = _.replace( divID, /\$/g, replaceBy );
    divID = _.replace( divID, /_/g, replaceBy );
    return divID;
};

export const handleUnsavedInstructions = function( callback ) {
    if( editorHasChanges() ) {
        displayConfirmationMessage( callback );
    } else {
        //gwtExporter.runMethod( 'wiHandleUnsavedInstructions', callback );
    }
};

/**
 * Clear Editor Data and destroy all instances
 */
function clearEditorData() {
    Object.keys( editorInstances ).forEach( editorId => {
        editorInstances[ editorId ] && editorInstances[ editorId ].destroy();
    } );
    editorInstances = [];
    appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR, {} );

    //Clears selection to make sure that while loading again, selected data is empty
    wiEditorSelectedObjectData = {};
}

export const resetDirtyEditors = function() {
    //clear dirty map
    appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR, {} );
    appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_OBJECT_ID_TO_DATASET_MAP, {} );
    appCtxService.updatePartialCtx( wiCtxConstants.WI_IS_SAVE_INSTRUCTIONS_ENABLED, false );
};

/**
 * Save WorkInstructions.
 */
export const saveWorkInstructions = function() {
    let saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];

    //get all dirty editors
    let dirtyEditors = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR );
    if( dirtyEditors ) {
        //for each dirty editor, create save input
        _.forEach( dirtyEditors, function( editor ) {
            let newlyAddedStxElements = editor.data.newlyAddedStxElementsUID;
            let editorId = editor.data.editorId;
            //get object uid
            let editorToObjUidMap = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_EDITOR_ID_TO_OBJ_UID );
            if( editorToObjUidMap[ editorId ] ) {
                let obj = editorToObjUidMap[ editorId ].data.object;
                relatedObjects.push( obj );
                //get data from editor
                let wiEditorContent = getEditorInstance( editorId ).getData();
                if( !editor.data.isDirty ) {
                    wiEditorContent = '';
                }
                if( wiEditorContent || wiEditorContent === '' ) {
                    let epwBodyTextContent = formatContentFromEditor( wiEditorContent );
                    let bodyTextContent = formatContentForView( epwBodyTextContent );
                    let idToDatasetsMap = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_OBJECT_ID_TO_DATASET_MAP );
                    let imageDatasets;
                    if( idToDatasetsMap && idToDatasetsMap[ obj.uid ] ) {
                        imageDatasets = idToDatasetsMap[ obj.uid ];
                    }
                    //add it to save input
                    saveInputWriter.addUpdateWorkInstructions( obj.uid, bodyTextContent, epwBodyTextContent, imageDatasets, newlyAddedStxElements );
                }
            }
        } );
    }
    //call save
    saveObject( saveInputWriter, relatedObjects );
};

/**
 * Formats content required to save
 *
 * @param {String} content - Editor content
 * @returns {String} content
 */
export let formatContentFromEditor = function( content ) {
    content = content.endsWith( '</p>' ) ? content : content + '<p>&nbsp;</p>';
    content = '<span style=\'font-family:Segoe UI\'>' + content + '</span>';

    //Convert to xhtml
    let doc = new DOMParser().parseFromString( content, 'text/html' );
    content = new XMLSerializer().serializeToString( doc.body.childNodes[ 0 ] );

    //convert latin and special characters as html entities in order to work with different encodings
    content = content.replace( /[\u00A0-\u2666]/g, function( c ) {
        return '&#' + c.charCodeAt( 0 ) + ';';
    } );
    content = content.replace( new RegExp( '\\\u000A', 'g' ), '' );
    return content;
};

/**
 * This method checks if data obtained is body text or placeholder
 *
 * @param {String} editorData - editorData
 * @return {String} bodyText
 */
export const getBodyTextFromEditorId = function( editorId ) {
    let editorData = getEditorInstance( editorId ).getData();
    let stringWithoutDiv = editorData.substring( 5, editorData.length - 7 );
    stringWithoutDiv = stringWithoutDiv.replace( new RegExp( '\\\u000A', 'g' ), '' );
    stringWithoutDiv = stringWithoutDiv.replace( '&amp;', '&' );
    let resource = _localeService.getLoadedText( instrMessagePath );
    if( stringWithoutDiv === resource.ckeditorPlaceholder ) {
        return '';
    }
    return editorData;
};

/**
 * Format Content for viewing html with style
 *
 * @param {String} finalContent - finalContent
 * @return {String} bodyText
 */
const formatContentForView = function( finalContent ) {
    let bodyText = finalContent;
    bodyText = replaceAll( bodyText, '&#91;&#91;', '<a style=\'color:#009898;\'>' );
    bodyText = replaceAll( bodyText, '&#93;&#93;', '</a>' );
    bodyText = replaceAll( bodyText, '{{', 'as seen in: <a style=\'color:#009898;\'>' );
    bodyText = replaceAll( bodyText, '}}', '</a>' );
    bodyText = replaceAll( bodyText, '<table>', '<table style=\'border: 1px double #b3b3b3; border-collapse: collapse;\'>' );
    bodyText = replaceAll( bodyText, '<td>', '<td style=\'border: 1px double #b3b3b3; padding: 0.4em; min-width: 2em;\'>' );
    return bodyText;
};

/**
 * Replace all instances of a given string within a larger string.
 *
 * @param {String} input - input string to replace content
 * @param {String} toFind - string to locate
 * @param {String} toReplace - string to replace
 * @return {String} modified string
 */
export function replaceAll( input, toFind, toReplace ) {
    let output = input;
    if( output.indexOf( toFind ) > NOT_FOUND ) {
        output = output.split( toFind ).join( toReplace );
    }
    return output;
}

/**
 * This method will check whether user is switching from Editor tab to different tab.
 * Also check if unsaved changes are there.
 * If yes then give confirmation message, so that user can decide whether to save unsaved changes or not.
 * @param { Object } tabsData: data to check valid switch
 */
export function handleUnsavedInstructionsOnTabSwitch( tabsData ) {
    let isSwitchOnEditorTabArea = false;
    // Make Sure its a Switch where Editor tab is present
    tabsData.forEach( ( tab ) => {
        if( tab.tabKey === 'WiEditor' && tab.selectedTab === false ) {
            isSwitchOnEditorTabArea = true;
        }
    } );

    if( isSwitchOnEditorTabArea && editorHasChanges() ) {
        displayConfirmationMessage();
    }
}

/**
 *
 */
export function showHideTipsPopup() {
    if( !_popupRef || !_popupRef.isAttached ) {
        popupSvc.show( {
            declView: 'ShowTipsPopup',
            options: {
                reference: 'button[button-id=\'WIShowTipsCommand\'] div.aw-commandIcon',
                width: 150,
                height: 100,
                placement: [
                    'right',
                    'top',
                    'bottom',
                    'left'
                ],
                flipBehavior: 'clockwise',
                clickOutsideToClose: true
            }
        } ).then( ( popupRef ) => _popupRef = popupRef );
    } else {
        popupSvc.hide( _popupRef );
        _popupRef = null;
    }
}

/**
 *
 * @param {String} editorId editor id
 * @param {Object} instance editor instance
 */
function addEditorInstance( editorId, instance ) {
    editorInstances[ editorId ] = instance;
}

/**
 *
 * @param {String} editorId editor id
 * @returns {Object} editor instance
 */
function getEditorInstance( editorId ) {
    return editorInstances[ editorId ];
}

/**
 *
 * @returns {Object} selected object and editor instance id
 */
function getSelectedEditorObjectData() {
    return wiEditorSelectedObjectData;
}

/**
 *
 * @param {Object} selectedObject selected object
 */
function setWiEditorSelectedObjectData( selectedObject ) {
    let object = null;
    let editorInstanceId = '';

    if( selectedObject.length > 0 ) {
        object = selectedObject[ 0 ];
        editorInstanceId = getDivId( selectedObject[ 0 ].uid ) + TEXTAREA;
    }
    appendToolbarForSelectedEditorInstance( editorInstanceId );
    wiEditorSelectedObjectData = {
        selectedObject: object,
        editorInstanceId: editorInstanceId
    };
    getEditorInstance( editorInstanceId )._instance.editing.view.focus();
}

/**
 * required only for Firefox browser
 * @param {String} textbox wieditor textbox element
 * @param {String} startOffset caret mousedown offset
 * @param {String} endOffset caret mouseup offset
 * @param {String} firstSelectedElementWiEditor caret mousedown element
 * @param {String} lastSelectedElementWiEditor caret mouseup element
 *
 */
function setCaretPosition( textbox, startOffset, endOffset, firstSelectedElementWiEditor, lastSelectedElementWiEditor )  {
    try {
        document.getSelection().removeAllRanges();
        let range = document.createRange();
        if( startOffset > endOffset ) {
            let newStartOffset = startOffset;
            let newFirstSelectedElementWiEditor = firstSelectedElementWiEditor;
            startOffset = endOffset;
            endOffset = newStartOffset;
            firstSelectedElementWiEditor = lastSelectedElementWiEditor;
            lastSelectedElementWiEditor = newFirstSelectedElementWiEditor;
        }
        range.setStart( firstSelectedElementWiEditor.srcElement.childNodes[0], startOffset );
        range.setEnd( lastSelectedElementWiEditor.srcElement.childNodes[0], endOffset );
        document.getSelection().addRange( range );

        //remove the events for mousedown and mouseup
        textbox.removeEventListener( 'mousedown', setCaretPosition );
        textbox.removeEventListener( 'mouseup', setCaretPosition );
    } catch ( error ) {
        // IndexSizeError
        // Error occurs if Index or size of caret selection is negative or greater than the allowed amount [selection outside any text]
        // remove mouse down and mouse up events on this error
        textbox.removeEventListener( 'mousedown', setCaretPosition );
        textbox.removeEventListener( 'mouseup', setCaretPosition );
    }
}

/**
 *
 * @param {String} editorInstanceId editor id
 */
function appendToolbarForSelectedEditorInstance( editorInstanceId ) {
    const toolbarContainer = document.querySelector( TOOLBAR_CONTAINER_ELEMENT_ID );
    while( toolbarContainer.hasChildNodes() ) {
        toolbarContainer.removeChild( toolbarContainer.lastChild );
    }
    if( editorInstanceId && editorInstanceId !== '' ) {
        toolbarContainer.appendChild( getEditorInstance( editorInstanceId )._instance.ui.view.toolbar.element );
    }
}

export default {
    ckeditor5ServiceInstance,
    loadRichTextEditor,
    saveObject,
    editorHasChanges,
    editorOnFocused,
    editorOnChange,
    registerEditorLeaveHandler,
    onBeforeUnload,
    getDivId,
    handleUnsavedInstructions,
    clearEditorData,
    resetDirtyEditors,
    saveWorkInstructions,
    getBodyTextFromEditorId,
    replaceAll,
    handleUnsavedInstructionsOnTabSwitch,
    showHideTipsPopup,
    addEditorInstance,
    getEditorInstance,
    getSelectedEditorObjectData,
    setWiEditorSelectedObjectData,
    setCaretPosition
};
