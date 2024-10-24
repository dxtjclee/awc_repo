

import { createListItems, ConvertHtmlToModel } from 'js/rmCkeRMContentTable/rmCreateContentTable';
import { setSelectedAttributeForView, updateAceSelectiononClickOfHeader } from 'js/rmCkeCrossSelection/rmCkeCrossSelection';
import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

export default class RMContentTable extends ckeditor5ServiceInstance.Plugin {
    init() {
        subscribeEventToGenerateTableofContent( this.editor );
        subscribeEventToHandleTOCLinkedClicked( this.editor );
        subscribeEventToEnableTOCCommand(  );
        subscribeEventToDisableTOCCommand(  );
        // Disable command on load
        eventBus.publish( TOC_CMD_EVENT, { enableTOC: false } );
    }

    destroy() {
        super.destroy();
        eventBus.unsubscribe( eventToHandleGenerateTableofContent );
        eventBus.unsubscribe( eventToEnableTOCCommand );
        eventBus.unsubscribe( eventToDisableTOCCommandOnOutsideClick );
        eventBus.unsubscribe( eventToDisableTOCCommandOnHeaderClick );
        eventBus.unsubscribe( eventToDisableTOCCommandOnPropertyClick );
        eventBus.unsubscribe( eventToHandleTOCLinkClick );
    }
}

var eventToHandleTOCLinkClick;
let eventToEnableTOCCommand;
let eventToDisableTOCCommandOnOutsideClick;
let eventToDisableTOCCommandOnHeaderClick;
let eventToDisableTOCCommandOnPropertyClick;
var eventToHandleGenerateTableofContent;
let TOC_CMD_EVENT = 'requirementDocumentation.enableTableContentCmd';

/**
 * Event ot enable command when clicked inside body text and there is a selection
 * @param{Object} editor - contains the editor instance
 */
function subscribeEventToEnableTOCCommand(  ) {
    eventToEnableTOCCommand =  eventBus.subscribe( 'ckeditor.clickedInsideBodyText', function( eventData ) {
        var bodyTextElement = eventData.selectedObject.getElementsByClassName( 'aw-requirement-bodytext' )[0];
        var eventData = {
            enableTOC: true
        };
        var isContentNonEditable = false;
        if( bodyTextElement && ( bodyTextElement.getAttribute( 'contenttype' ) === 'READONLY' || bodyTextElement.getAttribute( 'contenteditable' ) === false || bodyTextElement.getAttribute( 'contenteditable' ) === 'false' ) ) {
            isContentNonEditable = true;
        }

        var isTOC = document.getElementById( 'TOC' );
        if( isTOC  || isContentNonEditable ) {
            eventData.enableTOC = false;    //Disable if TOC already present in Spec
        }
        eventBus.publish( TOC_CMD_EVENT, eventData );
    } );
}

/**
 * Event to disable the split command when clicked outside the bodyText
 * @param{Object} editor - contains the editor instance
 */
function subscribeEventToDisableTOCCommand( ) {
    eventToDisableTOCCommandOnOutsideClick =  eventBus.subscribe( 'ckeditor.clickedInsideNonRequirementElement', function(  ) {
        eventBus.publish( TOC_CMD_EVENT, { enableTOC: false } );
    } );
    eventToDisableTOCCommandOnPropertyClick =  eventBus.subscribe( 'ckeditor.clickedInsideProperty', function(  ) {
        eventBus.publish( TOC_CMD_EVENT, { enableTOC: false } );
    } );
    eventToDisableTOCCommandOnHeaderClick =  eventBus.subscribe( 'ckeditor.clickedInsideHeader', function(  ) {
        eventBus.publish( TOC_CMD_EVENT, { enableTOC: false } );
    } );
}

/**
 * Method to subscribe event to handle TOC link clicked
 * @param {Object} editor -
 */
function subscribeEventToHandleTOCLinkedClicked( editor ) {
    eventToHandleTOCLinkClick =  eventBus.subscribe( 'ckeditor.clickedOnTOCLink', function( eventData ) {
        navigateToObject( eventData.requirementElement.getAttribute( 'id' ), editor );
    } );
}

/**
 * Function to navigate to table of content linked object
 * @param {String} uid -
 *  @param {String} editor -
 */
function navigateToObject( uid, editor ) {
    var widgets = document.getElementsByClassName( 'requirement' );

    var id = uid.substr( 4 );

    //If element present in document then scroll to it and select else open it in new tab
    for ( var i = 0; i < widgets.length; i++ ) {
        var widget = widgets[ i ];
        var openInNewTab = true;
        if( widget.getAttribute( 'revisionid' ) === id ) {
            var objectUid = widget.getAttribute( 'id' );
            editor.newSelectedRequirement = undefined;
            editor.editing.view.change( writer => {
                // setSelectedAttributeForView( editor, writer, [ objectUid ] );
                updateAceSelectiononClickOfHeader( [ { uid:objectUid } ] );
            } );
            openInNewTab = false;
            break;
        }
    }
    if( openInNewTab ) {
        var eveventDataForuid = {
            uid: id
        };
        eventBus.publish( 'requirementDocumentation.openReqInNewTab', eveventDataForuid );
    }
}

/**
 * Method to Subscribe an event to handle the generate TOC command
 *  @param {Object} editor -
 */
function subscribeEventToGenerateTableofContent( editor ) {
    eventToHandleGenerateTableofContent = eventBus.subscribe( 'requirementDocumentation.executeGenerateTableContentCmd', function( eventData ) {
        var element = document.createElement( 'div' );
        element.setAttribute( 'id', 'TOC' );
        element.setAttribute( 'class', 'aw-requirement-toconHover' );
        element.setAttribute( 'contenteditable', 'false' );
        element.classList.add( 'aw-requirement-tocFont' );

        var para = document.createElement( 'p' );
        var elementData =  element.outerHTML + para.outerHTML;
        const modeldivFragment = ConvertHtmlToModel( elementData );
        const divElementChild = modeldivFragment.getChild( 0 );

        var Container = document.createElement( 'ol' );
        Container.setAttribute( 'class', 'aw-requirement-tocOl' );
        Container.setAttribute( 'id', 'TOCOL' );
        createListItems( Container, editor );

        const modellistFragment = ConvertHtmlToModel( Container.outerHTML );
        var settingElement = '<settingsicon class="aw-requirement-tocsettings aw-ckeditor-linkAction" title="Table of Contents"></settingsicon>';
        const modelsettingFragment = ConvertHtmlToModel( settingElement );

        editor.model.change( writer => {
            writer.insert( modelsettingFragment, writer.createPositionAt( divElementChild, 0 ) );
            writer.insert( modellistFragment, writer.createPositionAt( divElementChild, 1 ) );
            editor.model.insertContent( modeldivFragment );
        } );

        // Disable command
        eventBus.publish( TOC_CMD_EVENT, { enableTOC: false } );
    } );
}
