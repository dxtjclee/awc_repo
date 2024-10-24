// Copyright (c) 2020 Siemens


/**
 * Plugin for split requirement command execution
 */
import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

let SPLIT_REQ_COMMAND_EVENT = 'requirementDocumentation.enableSplitReqCmd';
let executeSplitReqCmdEvent;
let eventToEnableSplitCommand;
let eventToDisableSplitCommandOnOutsideClick;
let eventToDisableSplitCommandOnHeaderClick;
let eventToDisableSplitCommandOnPropertyClick;
var textContent = '';


export default class RMSplitRequirement extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        editor.ui.componentFactory.add( 'rmSplitRequirement', new RMSplitRequirement( editor ) );

        /**
         * Handles selection Execute Split Reqirement done in PWA
         *
         * @param {Object} eventData - contains the the child information
         * @param{*} editor - contains the editor instance
         */
        function handleExecuteSplitReqCmd( eventData ) {
            editor.SPLITREQ = true;
            var options = { after: '', addOption: 'SIBLING' };
            const view = editor.editing.view;
            const viewDocument = view.document;
            const editableElement = viewDocument.selection.editableElement;
            var t1 = getRequirementElement( editableElement );
            var t2 = editor.editing.mapper.toModelElement( t1 );
            options.after = t2;
            if ( eventData.child ) {
                options.addOption = 'CHILD';
            }
            editor.execute( 'insertRequirement', options );

            // Disable command on load
            eventBus.publish( SPLIT_REQ_COMMAND_EVENT, { enable: false } );
        }

        /**
         * Method to subscribe event to handle Execute Split Reqirement done in PWA
         */
        function subscribeEventToHandleSplitReqCmd(  ) {
            executeSplitReqCmdEvent =  eventBus.subscribe( 'requirementDocumentation.executeSplitReqCmd', function( eventData ) {
                handleExecuteSplitReqCmd( eventData );
            } );
        }

        subscribeEventToHandleSplitReqCmd(  );
        subscribeEventToEnableSplitCommand( editor );
        subscribeEventToDisableSplitCommand(  );

        // Disable command on load
        eventBus.publish( SPLIT_REQ_COMMAND_EVENT, { enable: false } );
    }

    destroy() {
        super.destroy();
        eventBus.unsubscribe( executeSplitReqCmdEvent );
        eventBus.unsubscribe( eventToEnableSplitCommand );
        eventBus.unsubscribe( eventToDisableSplitCommandOnOutsideClick );
        eventBus.unsubscribe( eventToDisableSplitCommandOnHeaderClick );
        eventBus.unsubscribe( eventToDisableSplitCommandOnPropertyClick );
    }
}

/**
 *
 * @param {Object} selectedWidget - contains the selected content widget
 */
function getTextContent( selectedWidget ) {
    if ( selectedWidget._children && selectedWidget._children._nodes.length > 0 ) {
        for ( let index = 0; index < selectedWidget._children._nodes.length; index++ ) {
            const node = selectedWidget._children._nodes[index];
            if( getTextContent( node ) === 'SKIP' ) {
                break;
            }
        }
    } else {
        if( selectedWidget.name === 'imageInline' || selectedWidget.name === 'imageBlock' || selectedWidget.name === 'oleimage' ) {
            textContent = undefined;
            return 'SKIP';     // content with image is not yet supported for Split requirement.
        }
        if ( textContent !== undefined && selectedWidget._data ) {
            textContent += selectedWidget._data;
        }
    }
}

/**
 * Event ot enable command when clicked inside body text and there is a selection
 * @param{Object} editor - contains the editor instance
 */
function subscribeEventToEnableSplitCommand( editor ) {
    eventToEnableSplitCommand =  eventBus.subscribe( 'ckeditor.clickedInsideBodyText', function( eventData ) {
        let selectedWidget = editor.editing.model.getSelectedContent( editor.model.document.selection );
        var bodyTextElement = eventData.selectedObject.getElementsByClassName( 'aw-requirement-bodytext' )[0];
        var eventData = {};
        textContent = '';
        getTextContent( selectedWidget );
        if( textContent && textContent !== '' && bodyTextElement && bodyTextElement.getAttribute( 'contenteditable' ) === 'true' ) {
            eventData.enable = true;
        }else{
            eventData.enable = false;
        }
        eventBus.publish( SPLIT_REQ_COMMAND_EVENT, eventData );
    } );
}

/**
 * Event to disable the split command when clicked outside the bodyText
 * @param{Object} editor - contains the editor instance
 */
function subscribeEventToDisableSplitCommand( ) {
    eventToDisableSplitCommandOnOutsideClick =  eventBus.subscribe( 'ckeditor.clickedInsideNonRequirementElement', function(  ) {
        eventBus.publish( SPLIT_REQ_COMMAND_EVENT, { enable: false } );
    } );
    eventToDisableSplitCommandOnPropertyClick =  eventBus.subscribe( 'ckeditor.clickedInsideProperty', function(  ) {
        eventBus.publish( SPLIT_REQ_COMMAND_EVENT, { enable: false } );
    } );
    eventToDisableSplitCommandOnHeaderClick =  eventBus.subscribe( 'ckeditor.clickedInsideHeader', function(  ) {
        eventBus.publish( SPLIT_REQ_COMMAND_EVENT, { enable: false } );
    } );
}

/**
* @param {*} node - contains the target node clicked
* @returns {*} node - contains the requirement node
*/
function getRequirementElement( node ) {
    if ( !node ) {
        return null;
    }
    var classesList = node._classes;
    if ( classesList && classesList.entries() ) {
        var value = classesList.entries().next().value;
        if ( value && value.includes( 'requirement' ) ) {
            return node;
        }
    }
    return getRequirementElement( node.parent );
}
