// Copyright (c) 2020 Siemens


/**
 * Plugin to allow object selection in editor and Allow cross selection from Tree to Editor & Editor to Tree
 */
import eventBus from 'js/eventBus';
import _appCtxService from 'js/appCtxService';
import _cdm from 'soa/kernel/clientDataModel';
import $ from 'jquery';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

let eventToHandleSelectionChangeInPWA;
let postLoadSubscription;
let eventToHandleHeaderClick;
let eventToHandleHeaderTitleClick;
let eventToHandleObjContentClick;
// Map of uid vs headerViewElement
let selectedReqHeaderViewElement = [];
let scrollTop;

export default class RMCrossSelection extends ckeditor5ServiceInstance.Plugin {
    init() {
        selectedReqHeaderViewElement = [];
        const editor = this.editor;
        const conversion = this.editor.conversion;
        this._defineCrossRefImageConversion( conversion );

        postLoadSubscription = eventBus.subscribe( 'ckeditor.postLoadSubscription', function() {
            //Listen to mouse event to handle selection change in SWA
            if( !eventToHandleHeaderClick ) {
                subscribeEventToHandleHeaderClick( editor );
            }

            //Subscribe to an event to handle selection change on click of header title
            if( !eventToHandleHeaderTitleClick ) {
                subscribeEventToHandleHeaderTitleClick( editor );
            }

            //Subscribe to an event to handle selection change on click of object content
            if( !eventToHandleObjContentClick ) {
                subscribeEventToHandleObjectContentClick( editor );
            }

            //Subscribe to an event to handle selection change in PWA
            if( !eventToHandleSelectionChangeInPWA ) {
                subscribeEventToHandleSelectionChangeInPWA( editor );
            }

            // Add scroll event to handle popup close close issue for firefox
            addEventListenerOnScroll( editor );
        } );

        subscribeEventToHandleHeaderClick( editor );
    }

    destroy() {
        super.destroy();
        if( eventToHandleSelectionChangeInPWA ) {
            eventBus.unsubscribe( eventToHandleSelectionChangeInPWA );
            eventToHandleSelectionChangeInPWA = null;
        }
        if( postLoadSubscription ) {
            eventBus.unsubscribe( postLoadSubscription );
            postLoadSubscription = null;
        }
        if( eventToHandleHeaderClick ) {
            eventBus.unsubscribe( eventToHandleHeaderClick );
            eventToHandleHeaderClick = null;
        }
        if( eventToHandleHeaderTitleClick ) {
            eventBus.unsubscribe( eventToHandleHeaderTitleClick );
            eventToHandleHeaderTitleClick = null;
        }
        if( eventToHandleObjContentClick ) {
            eventBus.unsubscribe( eventToHandleObjContentClick );
            eventToHandleObjContentClick = null;
        }
    }

    _defineCrossRefImageConversion( conversion ) {
        // cross reference image
        conversion.for( 'downcast' ).elementToElement( {
            model: 'crossRefimage',
            view: ( modelElement, conversionApi ) =>  {
                const viewWriter = conversionApi.writer;
                return renderForCrossRefImage( viewWriter, this.editor, modelElement );
            },
            converterPriority: 'high'

        } );
        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: 'img',
                attributes:{ crossrefimg:true }
            },
            model: ( viewElement, conversionApi ) => {
                const modelWriter = conversionApi.writer;
                return modelWriter.createElement( 'crossRefimage', viewElement.getAttributes() );
            },
            converterPriority: 'high'
        } );
    }
}

/**
 *
 * @param {*} viewWriter
 * @param {*} editor
 * @param {*} modelElement
 */
function renderForCrossRefImage( viewWriter, editor, modelElement ) {
    return viewWriter.createUIElement( 'img', modelElement.getAttributes(), function( domDocument, modelElement ) {
        return this.toDomElement( domDocument );
    } );
}
/**
* Method to add event listener on editor scroll
*/
function addEventListenerOnScroll( editor ) {
    let element = document.getElementsByClassName( 'ck-content' );
    if( element && element.length > 0 ) {
        element[0].onscroll = function( e ) {
            if ( navigator.userAgent.indexOf( 'Firefox' ) === -1 || scrollTop !== e.target.scrollTop ) {
                //  editor.eventBus.publish( 'showActionPopup.close' );
                scrollTop = e.target.scrollTop;
            }
        };
    }
}

/**
* Method to set the selected attribute value
*
* @param {*} editor - contains the editor instance
* @param {*} writer - contains the view writer instance
* @param {*} uid - contains the object uid
*/
export function setSelectedAttributeForView( editor, writer, uids, isAceSelection ) {
    var isDerivedSpecOpened = _appCtxService.getCtx( 'isDerivedSpecOpened' );
    var isViewElementReplaced = _appCtxService.getCtx( 'isViewElementReplaced' );
    var isHtmlSpecTemplate = false;
    if( _appCtxService.ctx.AWRequirementsEditor.editor && _appCtxService.ctx.AWRequirementsEditor.editor.isHtmlSpecTemplate ) {
        isHtmlSpecTemplate = true;
    }
    //recreating map as view element is replaced after freeze/unfreeze/overwrite operation
    if( isDerivedSpecOpened === 'true' && isViewElementReplaced ) {
        for ( var uid in selectedReqHeaderViewElement ) {
            let reqDomElement = document.getElementById( uid );
            let headerDomEle = reqDomElement.getElementsByClassName( 'aw-requirement-header' )[0];
            let headerViewElement = editor.editing.view.domConverter.domToView( headerDomEle );
            selectedReqHeaderViewElement[uid] = headerViewElement;
            _appCtxService.unRegisterCtx( 'isViewElementReplaced' );
        }
    }
    var tempSelectedReqHeaderViewElement = selectedReqHeaderViewElement;
    selectedReqHeaderViewElement = [];

    if( !editor.selectedRequirement ) {
        editor.selectedRequirement = [];
    }

    // Unselect previous selection
    for ( var uid in tempSelectedReqHeaderViewElement ) {
        if( uids.indexOf( uid ) === -1  ) { // un-select
            writer.setAttribute( 'selected', 'false', tempSelectedReqHeaderViewElement[uid] );
            for ( let index = 0; index < editor.selectedRequirement.length; index++ ) {
                const selectedRequirement = editor.selectedRequirement[index];
                if( selectedRequirement.getAttribute( 'id' ) === uid ) {
                    editor.selectedRequirement.splice( index, 1 );
                    break;
                }
            }
        } else if( !isHtmlSpecTemplate ) {
            uids.splice( uids.indexOf( uid ), 1 );
            selectedReqHeaderViewElement[uid] = tempSelectedReqHeaderViewElement[uid];
        }
    }

    uids.forEach( function( uid ) {
        let reqDomElement = document.getElementById( uid );
        if( reqDomElement && reqDomElement.tagName === 'LOADING' ) {
            reqDomElement.scrollIntoView();    // If obj not loaded yet, scroll to that so it will get loaded
        } else if( reqDomElement ) {
            let reqViewElement = editor.editing.view.domConverter.domToView( reqDomElement );
            if( reqViewElement && reqViewElement.parent ) {
                let headerDomEle = reqDomElement.getElementsByClassName( 'aw-requirement-header' )[0];
                let headerViewElement = editor.editing.view.domConverter.domToView( headerDomEle );
                writer.setAttribute( 'selected', 'true', headerViewElement );
                selectedReqHeaderViewElement[uid] = headerViewElement;

                var view = editor.editing.view;
                //clear selectedRequirement as we do not support multiselection in html spec template
                if( isHtmlSpecTemplate ) {
                    editor.selectedRequirement = [];
                }
                // if not already added
                if( !editor.selectedRequirement.includes( reqViewElement ) ) {
                    editor.selectedRequirement.push( reqViewElement );
                }

                var isCrossProbingFromCkeditor = _appCtxService.getCtx( 'isCrossProbingFromCkeditor' );
                if( !isCrossProbingFromCkeditor ) {
                    var newselection = view.createSelection( reqViewElement, 0, { fake: true } );
                    view.document.selection._setTo( newselection );
                }
                view.scrollToTheSelection();
                _appCtxService.unRegisterCtx( 'isCrossProbingFromCkeditor' );

                var domroot = editor.editing.view.getDomRoot();
                if( domroot ) {
                    scrollTop = domroot.scrollTop;
                }

                var eventData =  {
                    requirementElement:headerDomEle,
                    isAceSelectionEvent :isAceSelection

                };

                var headerDivElement = eventData.requirementElement;
                var reqElement = headerDivElement && headerDivElement.parentElement;

                if( uids.length === 1 ) { // Crossprob to Doc tab in case of single selection only
                    performCrossProbing( editor, reqElement, eventData );
                }
            }
        }
    } );

    var rmSelectedModelObjects = [];
    editor.selectedRequirement.forEach( requirementViewElement => {
        var uid = requirementViewElement.getAttribute( 'id' );
        var modelObject = _cdm.getObject( uid );
        rmSelectedModelObjects.push( modelObject );
    } );
    _appCtxService.registerCtx( 'rmselected', rmSelectedModelObjects );
}

/**
 * Handles selection changes done in PWA
 *
 * @param {eventdata} eventdata - contains the uid of the selected object
 * @param{*} editor - contains the editor instance
 */
function handleSelectionChangeFromPWA( eventdata, editor ) {
    var uid = eventdata.objectUid;
    var position = editor.model.document.selection.getFirstPosition();


    editor.editing.view.change( writer => {
        setSelectedAttributeForView( editor, writer, uid, true );
    } );
    eventBus.publish( 'requirements.registerCtxForDerivedCommands' );
    // Event to handle and manage focus on requirement body text
    editor.fire( 'ckeditor.handleCkeditorFocusOnBodyText' );
}

/**
 * Method to subscribe event to handle selection change in PWA.
 *
 * @param{*} editor - contains the editor instance
 */
function subscribeEventToHandleSelectionChangeInPWA( editor ) {
    eventToHandleSelectionChangeInPWA = eventBus.subscribe( 'ckeditor.handleSelectionChange', function( eventData ) {
        handleSelectionChangeFromPWA( eventData, editor );
    } );
}
/**
 * Method to fire event to update element selection in PWA
 *
 * @param{*} allObjects - array of objects
 */
export function updateAceSelectiononClickOfHeader( allObjects ) {
    var eventData = {
        objectsToSelect: allObjects
    };
    eventBus.publish( 'requirementDocumentation.updateACESelection', eventData );
}

/**
 * Method to subscribe event to handle selection change when click in header title
 * @param {Object} editor -
 */
function subscribeEventToHandleHeaderTitleClick( editor ) {
    eventToHandleHeaderTitleClick = eventBus.subscribe( 'ckeditor.clickedInsideProperty', function( eventData ) {
        // No multi-select on click inside body_text
        var reqElement = getRequirementElement( eventData.targetElement );
        var objUid = reqElement.getAttribute( 'id' );
        if( isCrossProbingRequired( reqElement, editor, eventData ) ) {
            updateAceSelectiononClickOfHeader( [ { uid : objUid } ] );
        }
    } );
}

function subscribeEventToHandleObjectContentClick( editor ) {
    eventToHandleObjContentClick = eventBus.subscribe( 'ckeditor.clickedInsideBodyText', function( eventData ) {
        // No multi-select on click inside body_text
        _appCtxService.registerCtx( 'isCrossProbingFromCkeditor', true );
        var reqElement = getRequirementElement( eventData.targetElement );
        var objUid = reqElement.getAttribute( 'id' );
        if( isCrossProbingRequired( reqElement, editor, eventData ) ) {
            updateAceSelectiononClickOfHeader( [ { uid : objUid } ] );
        }
    } );
}
/**
 * Method to perform cross probing
 * @param {Object} editor -
 * @param {Object} reqElement -
 * @param {Object} eventData -
 */
function performCrossProbing( editor, reqElement, eventData ) {
    var currentSelected = editor.selectedRequirement && editor.selectedRequirement.length > 0 ? editor.selectedRequirement[0] : null;
    var currentSelectedRevID = currentSelected ? currentSelected.getAttribute( 'revisionid' ) : '';
    let reqViewElement = editor.editing.view.domConverter.domToView( reqElement );

    var idAttr = reqElement.getAttribute( 'id' );
    var revidAttr = reqElement.getAttribute( 'revisionId' );
    if ( revidAttr !== currentSelectedRevID  || eventData.isAceSelectionEvent ) { // If non clicked on selected header
        if ( idAttr && idAttr.indexOf( 'RM::NEW::' ) !== 0 && idAttr.indexOf( 'header' ) !== 0 && idAttr.indexOf( 'footer' ) !== 0 ) {
            editor.newSelectedRequirement = undefined;
            editor.isNewrequirementSelected = false;
            editor.editing.view.change( writer => {
                editor.fire( 'updateQualityMatrix', reqViewElement, eventData.requirementElement, false );
            } );
        } else if ( idAttr && idAttr.indexOf( 'RM::NEW::' ) === 0 ) {
            var isIdMismatch = editor.newSelectedRequirement && editor.newSelectedRequirement.getAttribute( 'id' ) !== idAttr;
            if( isIdMismatch ||  !editor.isNewrequirementSelected ) {
                editor.fire( 'updateQualityMatrix', reqViewElement, eventData.requirementElement, true, eventData.targetElement );
            }
            editor.newSelectedRequirement = reqViewElement;
            editor.isNewrequirementSelected = true;
        }
    }
}

/**
 * Method to subscribe event to handle selection change when click on header
 * @param {Object} editor -
 */
function subscribeEventToHandleHeaderClick( editor ) {
    eventToHandleHeaderClick = eventBus.subscribe( 'ckeditor.clickedInsideHeader', function( eventData ) {
        var reqElement = getRequirementElement( eventData.targetElement );
        var objUid = reqElement.getAttribute( 'id' );
        // var reqElement = headerDivElement && headerDivElement.parentElement;
        // performCrossProbing( editor, reqElement, eventData );
        var allObjects = [];
        var unselect = false;
        var allObjectsUids = [];

        if( eventData.clickedWithShiftKey ) {  // Multi-Select with Shift
            for ( var uid in selectedReqHeaderViewElement ) {
                if( objUid !== uid ) {
                    allObjects.push( { uid : uid } );
                    allObjectsUids.push( uid );
                } else {
                    unselect = true;
                }
            }
            if( !unselect ) {
                var lastSelection = allObjects[allObjects.length - 1];
                lastSelection = document.getElementById( lastSelection.uid );
                lastSelection = $( lastSelection );
                var currentSelection = $( reqElement );

                var intermidiateNodes = [];

                if( lastSelection.index() !== currentSelection.index() ) {    // If not same object
                    if( lastSelection.index() < currentSelection.index() ) {
                        intermidiateNodes = lastSelection.nextUntil( currentSelection );
                    } else {
                        intermidiateNodes = currentSelection.nextUntil( lastSelection );
                    }
                }
                for ( let index = 0; index < intermidiateNodes.length; index++ ) {
                    const node = intermidiateNodes[index];
                    if( allObjectsUids.indexOf( node.id ) === -1 ) {
                        allObjects.push( { uid : node.id } );
                    }
                }
            }
        } else if( eventData.clickedWithCtrlKey ) {  // Multi-Select with ctrl
            for ( var uid in selectedReqHeaderViewElement ) {
                if( objUid !== uid ) {
                    allObjects.push( { uid : uid } );
                } else {
                    unselect = true;
                }
            }
        }

        if( !unselect ) {
            allObjects.push( { uid : objUid } );
        }

        if( allObjects.length > 0 && isCrossProbingRequired( reqElement, editor, eventData ) ) {
            updateAceSelectiononClickOfHeader( allObjects );
        }
    } );
}

/**
 *
 * @param {*} reqElement
 * @param {*} editor
 * @param {*} eventData
 */
function isCrossProbingRequired( reqElement, editor, eventData ) {
    var idAttr = reqElement.getAttribute( 'id' );
    let reqViewElement = editor.editing.view.domConverter.domToView( reqElement );
    if ( idAttr && idAttr.indexOf( 'RM::NEW::' ) !== 0 && idAttr.indexOf( 'header' ) !== 0 && idAttr.indexOf( 'footer' ) !== 0 ) {
        return true;
    }
    if ( idAttr && idAttr.indexOf( 'RM::NEW::' ) === 0 ) {
        var isIdMismatch = editor.newSelectedRequirement && editor.newSelectedRequirement.getAttribute( 'id' ) !== idAttr;
        if( isIdMismatch ||  !editor.isNewrequirementSelected ) {
            editor.fire( 'updateQualityMatrix', reqViewElement, eventData.requirementElement, true, eventData.targetElement );
        }
        editor.newSelectedRequirement = reqViewElement;
        editor.isNewrequirementSelected = true;
    }
    return false;
}

/**
 *
 * @param {*} element
 */
function getRequirementElement( element ) {
    if( !element ) {
        return null;
    }
    if ( element.classList.contains( 'requirement' ) ) {
        return element;
    }
    return getRequirementElement( element.parentNode );
}
