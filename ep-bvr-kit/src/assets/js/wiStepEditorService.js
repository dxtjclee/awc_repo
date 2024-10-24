// Copyright (c) 2021 Siemens

/**
 * Initialization service for WI step Editor.
 *
 * @module js/wiStepEditorService
 */
import wiEditorService from 'js/wiEditor.service';
import appCtxService from 'js/appCtxService';
import { constants as wiCtxConstants } from 'js/wiCtxConstants';
import wiCkeditor5Service from 'js/wiCkeditor5Service';
import browserUtils from 'js/browserUtils';

const TEXTAREA = 'Textarea';
let startOffset = 0;
let endOffset = 0;
let firstSelectedElementWiEditor = null;
let lastSelectedElementWiEditor = null;

/**
 *
 * @param {Object} editorData editorData
 * @param {Object} editorObject editorObject
 */
export function onInit( editorData, editorObject ) {
    if( editorData && editorObject ) {
        const objUID = editorObject.uid;
        const wiText = editorData.additionalPropertiesMap2.epw0body_text2[ 0 ];
        const isUpdateNeeded = editorData.additionalPropertiesMap2.isDirty[ 0 ];
        updateEditor( objUID, wiText, isUpdateNeeded );
    }
}

/**
 *
 * @param {String} objUID objectUID
 * @param {String} body_text body text property
 * @param {Boolean} isUpdateNeeded isUpdateNeeded
 */
function updateEditor( objUID, body_text, isUpdateNeeded ) {
    const textareaID = wiEditorService.getDivId( objUID ) + TEXTAREA;
    const editorDiv = document.querySelector( '#' + textareaID );
    //Adding onClick event handler on Editor element to override the selection onClick handlers from aw-list
    editorDiv.addEventListener( 'click', event => {
        event.stopPropagation();
    } );
    wiCkeditor5Service.createWiEditorInstance( textareaID ).then( editorInstance => {
        wiEditorService.addEditorInstance( textareaID, editorInstance );
        editorInstance.setData( body_text );
        disableDragEvents( editorInstance );
        editorInstance.on( 'change', () => {
            wiEditorService.editorOnChange( editorInstance, textareaID );
        } );
        editorInstance.on( 'focus', ( evt, name, isFocused ) => {
            isFocused && wiEditorService.editorOnFocused( editorInstance, textareaID );
        } );
        // defect id: TCM-417498 - [CKEditor] cursor vanishes when moved to another editor
        if( browserUtils.isFirefox ) {
            let textbox = document.getElementById( textareaID );
            textbox.addEventListener( 'mousedown', ( e ) => {
                startOffset = e.rangeOffset;
                firstSelectedElementWiEditor = e;
            } );
            textbox.addEventListener( 'mouseup', ( e ) => {
                endOffset = e.rangeOffset;
                lastSelectedElementWiEditor = e;
                wiEditorService.setCaretPosition( textbox, startOffset, endOffset, firstSelectedElementWiEditor, lastSelectedElementWiEditor );
            } );
        }
        if( isUpdateNeeded === 'true' ) {
            let dirtyEditors = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR );
            if( !dirtyEditors ) {
                dirtyEditors = {};
            }
            dirtyEditors[ textareaID ] = {
                data: {
                    editorId: textareaID,
                    isDirty: true,
                    newlyAddedStxElementsUID: []
                }
            };
            appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR, dirtyEditors );
            appCtxService.updatePartialCtx( wiCtxConstants.WI_IS_SAVE_INSTRUCTIONS_ENABLED, true );
        }
    } );
}

/**
 *
 * @param {Object} editorInstance - editor instance
 */
function disableDragEvents( editorInstance ) {
    editorInstance._instance.editing.view.document.on( 'dragenter', ( evt, data ) => {
        evt.stop();
        data.preventDefault();
    }, { priority: 'highest' } );
    editorInstance._instance.editing.view.document.on( 'drop', ( evt, data ) => {
        evt.stop();
        data.preventDefault();
    }, { priority: 'highest' } );
}

export default {
    onInit,
    disableDragEvents
};
