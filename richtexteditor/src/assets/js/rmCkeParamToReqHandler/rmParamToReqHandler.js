//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/**
 * Plugin for Add/Map Parameters to Selected requirement text
 */


import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
const BODYTEXT_CLASS = 'aw-requirement-bodytext';
const REQ_CLASS = 'requirement';
let parameterCreatedEvent;
let eventToHandleParameterLinkClick;

export default class RMParamToReqHandler extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        const viewDocument = editor.editing.view.document;

        // Extent parameter link schema
        _extendLinkSchema( editor );

        /**
        * Method to Add/Map parameter to the selected text on right mouse click
        *
        * @param {*} evt - event Object with window event details
        * @param {*} data - selected data object
        */
        editor.listenTo( viewDocument, 'mousedown', ( evt, data ) => {
            if ( data.domEvent.which === 3 ) { //to trigger only on right click
                setTimeout( () => {
                    let selectedWidget = editor.editing.model.getSelectedContent( editor.model.document.selection );
                    var newReqTextContent;
                    selectedWidget._children._nodes.forEach( function( node ) {
                        newReqTextContent = node._data;
                    } );
                    if ( newReqTextContent && newReqTextContent !== '' ) {
                        var requirementBodyTextNode = getRequirementElement( data.domTarget, BODYTEXT_CLASS );
                        if( requirementBodyTextNode ) {
                            var requirementNode = getRequirementElement( data.domTarget, REQ_CLASS );
                            if( requirementNode && requirementNode.id && requirementNode.id.indexOf( 'RM::NEW::' ) !== 0 ) { // Not a new object
                                var eventData = {
                                    objectsToSelect: [ { uid: requirementNode.id } ]
                                };
                                eventBus.publish( 'requirementDocumentation.updateACESelection', eventData );
                                executeBalloonPopupHandler( editor, data );
                            }
                        }
                    }
                }, 1000 );
            }
        } );

        subscribeParameterCreatedEvent( editor );
        subscribeEventToHandleParamterinkedClicked(  );
    }

    destroy() {
        super.destroy();
        eventBus.unsubscribe( parameterCreatedEvent );
        eventBus.unsubscribe( eventToHandleParameterLinkClick );
    }
}

/**
 * Method to subscribe event to handle parameter link clicked
 * @param {Object} editor -
 */
function subscribeEventToHandleParamterinkedClicked(  ) {
    eventToHandleParameterLinkClick =  eventBus.subscribe( 'ckeditor.clickedOnParameterLink', function( eventData ) {
        var paramId = eventData.requirementElement.getAttribute( 'paramid' );
        var requirementNode = getRequirementElement( eventData.requirementElement, REQ_CLASS );
        if ( requirementNode && requirementNode.id && paramId ) {
            eventBus.publish( 'requirementDocumentation.showParametersTable', {
                paramid: paramId,
                objectsToSelect: requirementNode.id
            } );
        }
    } );
}

/**
 * Method to subscribe Parameter Created Event
 *
 * @param{Object} editor - contains the editor instance
 */
function subscribeParameterCreatedEvent( editor ) {
    parameterCreatedEvent =  eventBus.subscribe( 'requirementDocumentation.parameterCreated', function( eventData ) {
        handleParameterCreatedEvent( eventData, editor );
    } );
}

/**
* Method to check cmd selection value
*
* @param {*} editor - selected editor object
* @param {*} data - selected data object
*/
function executeBalloonPopupHandler( editor, data ) {
    var resource = 'RichTextEditorCommandPanelsMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    var posx = 0;
    var posy = 0;

    if ( data.domEvent.pageX && data.domEvent.pageY ) {
        posx = data.domEvent.pageX;
        posy = data.domEvent.pageY;
    } else if ( data.domEvent.clientX || data.domEvent.clientY ) {
        posx = data.domEvent.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        posy = data.domEvent.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    var iconDimension = {
        offsetHeight: 20,
        offsetLeft: posx,
        offsetTop: posy,
        offsetWidth: 100
    };

    var actionList = [ {
        displayName: localTextBundle.addParameter,
        internalName: localTextBundle.addParameter
    } ];
    var eventData = {
        commandDimension: iconDimension,
        actionItemList: actionList,
        callback: function( response ) {
            if ( response === localTextBundle.addParameter ) {
                eventBus.publish( 'requirementDocumentation.openAddParameterPanel' );
            }
            eventBus.publish( 'showActionPopup.close' );
        },
        targetElement:data.domTarget
    };
    eventBus.publish( 'requirementDocEditor.registerCxtForPopup', eventData );
}

/**
* Method to Create link for Selected text
*
* @param {String} textContent - selected text
* @param {String} paramValue - parameter ID
* @param {Object} editor - editor
*/
function createAsLink(textContent, paramValue, editor) {
    const model = editor.model;
    const selection = model.document.selection;
    if (textContent) {
        model.change(writer => {
            const ranges = model.schema.getValidRanges(selection.getRanges(), 'linkHref');
            var combinedParam = paramValue;
            for (const range of ranges) {
                var items = [...range.getItems()];
                for (var i = 0; i < items.length; i++) {
                    if (items[i].textNode && items[i].textNode.getAttribute('paramid')) {
                        var paramid = items[i].getAttribute('paramid');
                        if (paramid) {
                            combinedParam = combinedParam + ',' + paramid;
                        }
                    }
                }
                writer.setAttribute('paramid', combinedParam, range);
            }
        });
    }
}

/**
 * Handles Parameter Created Event done in PWA
 *
 * @param {Object} eventData - contains the the child information
 * @param{*} editor - contains the editor instance
 */
function handleParameterCreatedEvent( eventData, editor ) {
    const model = editor.model;
    const selection = model.document.selection;
    let selectedWidget = editor.editing.model.getSelectedContent( selection );
    var textContent;
    selectedWidget._children._nodes.forEach( function( node ) {
        textContent = node._data;
    } );
    createAsLink( textContent, eventData.createdParameterd, editor );
    var selectedRequirement = editor.selectedRequirement[0];
    var eventData1 = {
        paramid: eventData.createdParameterd,
        objectsToSelect: selectedRequirement ? selectedRequirement.getAttribute( 'id' ) : ''
    };
    eventBus.publish( 'requirementDocumentation.showParametersTable', eventData1 );
}

/**
 * Gets the dom requirement element closest to the 'node'
 *
 * @param {Object} node - dom element object
 * @param {String} className class Name
 * @returns {Object} Element 'undefined' if not found.
 */
function getRequirementElement( node, className ) {
    if ( !node || node.classList.contains( 'ck-content' ) ) {    // is node undefined or ckeditor content div
        return;
    }
    if ( isRequirmentElement( node, className ) ) {
        return node;
    }

    return getRequirementElement( node.parentNode, className );
}

/**
 * Checks whether the `node` is a requirement div or not
 *
 * @param {CKEDITOR.dom.node} node node
 * @param {String} className class Name
 * @returns {Boolean} element present or not
 */
function isRequirmentElement( node, className ) {
    return node.classList && node.classList.contains( className );
}

/**
 * Gets the dom requirement element closest to the 'node'
 *
 * @param {Object} node - dom element object
 * @returns {Object} Element 'undefined' if not found.
 */
function getParameterElement( node ) {
    if ( !node ) {
        return undefined;
    }
    if ( isParameterElement( node ) ) {
        return node.getAttribute && node.getAttribute( 'paramid' );
    }

    return getParameterElement( node.parentNode );
}

/**
 * Checks whether the `node` is a having ParameterId or not
 *
 * @param {CKEDITOR.dom.node} node node         *
 * @returns {Boolean} element present or not
 */
function isParameterElement( node ) {
    return node.getAttribute && node.getAttribute( 'paramid' );
}

/**
 * Method to subscribe Parameter Created Event
 *
 * @param {*} editor - contains the editor instance
 */
function _extendLinkSchema( editor ) {
    editor.model.schema.extend( '$text', { allowAttributes: 'paramid' } );

    editor.conversion.for( 'downcast' ).attributeToElement( {
        model: 'paramid',
        view: ( attributeValue, conversionApi ) => {
            const writer = conversionApi.writer;
            return writer.createAttributeElement( 'a', { paramid: attributeValue }, { priority: 5 } );//{ class: 'aw-requirement-paramToReqUnderline' },
        },
        converterPriority: 'low'
    } );
    editor.conversion.for( 'upcast' ).elementToAttribute( {
        view: {
            name: 'a',
            key: 'paramid'
        },
        model: {
            key: 'paramid',
            value: viewElement => viewElement.getAttribute( 'paramid' )
        },
        converterPriority: 'high'
    } );
}
