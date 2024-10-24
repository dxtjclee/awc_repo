// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * Defines the markup functions for showing markups on the Requirement viewer or CKEditor
 *
 * Note: This is currently a placeholder copied from MarkupHtml.js, to be modified by the Req team
 *
 * @module js/MarkupRequirement
 */
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';
import appCtxSvc from 'js/appCtxService';
import ckeditorOperations from 'js/ckeditorOperations';
import Arm0DocumentationUtil from 'js/Arm0DocumentationUtil';

'use strict';
//==================================================
// private variables
//==================================================
/** The frame window */
var frameWindow = null;
/** The current tool */
var tool = null;
/** The markup panel is currently revealed */
var revealed = false;
/** The viewer container */
var viewerContainer = null;

/** The text root */
var textRoot = null;

/* Map to store commentId with markups */
var commentIdWithMarkupsMap = {};
/** The last text node with space */
var lastTextNodeWithSpace = null;
/** The first text node with space */
var firstTextNodeWithSpace = null;

var _markupTextInstance = '';
//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param {Markup} inMarkups The list of markups
 * @param {User} inUsers The list of users
 * @param {MarkupThread} inThread The MarkupThread object
 * @return {boolean} true if text viewer is found
 */
export function init( inMarkups, inUsers, inThread ) {
    frameWindow = getFrameWindow();
    if( !frameWindow ) {
        return false;
    }

    if( !setViewerContainer() ) {
        return false;
    }

    _markupTextInstance = ckeditorOperations.getMarkupTextInstance();
    _markupTextInstance.init( frameWindow, inMarkups, inThread );
    markupColor.init( inUsers, inThread );
    markupTooltip.init( inThread );
    _markupTextInstance.setFindObjIdCallback( findObjIdCallback );
    _markupTextInstance.setIsBodyContentCallback( isBodyContentCallBack );
    _markupTextInstance.setMarkupSpanChangedCallback( markupSpanChangedCallback );
    _markupTextInstance.setGetUserSelectionFromSingleClickCallback( getUserSelectionFromSingleClickCallback );

    return true;
}

/**
 * Set the current tool
 *
 * @param {string} inTool the tool
 */
export function setTool( inTool ) {
    if( inTool !== 'highlight' ) {
        _markupTextInstance.clearUserSelection();
    }

    tool = inTool;
}

/**
 * Get the user selection of text
 *
 * @return {UserSelection} the user selection
 */
export function getUserSelection() {
    _markupTextInstance = ckeditorOperations.getMarkupTextInstance();
    return  _markupTextInstance.getUserSelection();
}

/**
 * InitializeCallbakcforCk5
 *
 * @return {UserSelection} the user selection
 */
export function initializeCallbacksforCk5() {
    _markupTextInstance = ckeditorOperations.getMarkupTextInstance();
    if( _markupTextInstance ) {
        _markupTextInstance.setFindObjIdCallback( findObjIdCallback );
        _markupTextInstance.setIsBodyContentCallback( isBodyContentCallBack );
        _markupTextInstance.setMarkupSpanChangedCallback( markupSpanChangedCallback );
        _markupTextInstance.setGetUserSelectionFromSingleClickCallback( getUserSelectionFromSingleClickCallback );
    }
}


/**
 * Gets the CKEDITOR.dom.element closest to the 'node'
 *
 * @param {CKEDITOR.dom.node}
 *            node Start the search from this node.
 * @returns {CKEDITOR.dom.element/null} Element or
 *          `null` if not found.
 */
function getTopRequirementElement( node ) {
    if( !node ) {
        return null;
    }
    if( isTopRequirmentElement( node ) ) {
        return node;
    }

    return getTopRequirementElement( node.parentNode );
}

/**
 * Checks whether the `node` is a
 * CKEDITOR.plugins.widget#editables
 *
 * @param {CKEDITOR.dom.node} node node
 *
 * @returns {Boolean} element present or not
 */
function isTopRequirmentElement( node ) {
    if ( node.classList ) {
        return node.classList.contains( 'requirement' );
    }
}

/**
 * Checks whether the `node` is a
 * CKEDITOR.plugins.widget#editables
 *
 * @param {CKEDITOR.dom.node} node node
 *
 * @returns {Boolean} element present or not
 */
function isBodyContentCallBack( node ) {
    if( !node ) {
        return null;
    }
    if( isBodyContenElement( node ) ) {
        return true;
    }
    return isBodyContentCallBack( node.parentNode );
}

/**
 * call back for markup span created.
 * @param {Node} node The node to add markup
 * @param {Markup} markup The markup to be added
 * @param {int} option The option SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
function markupSpanChangedCallback( span, markup, option ) {
    span.setAttribute( 'id', markup.reqData.commentid );
    commentIdWithMarkupsMap[ markup.reqData.commentid ] = span.markups;
    appCtxSvc.ctx.reqMarkupDataMap = commentIdWithMarkupsMap;
}

/**
 * Checks whether the `node` is a
 * CKEDITOR.plugins.widget#editables
 *
 * @param {CKEDITOR.dom.node} node node
 *
 * @returns {Boolean} element present or not
 */
function isBodyContenElement( node ) {
    if ( node.className ) {
        return node.className.indexOf( 'aw-requirement-bodytext' ) === 0;
    }
}

/**
 * Get user selection from range
 *
 * @param {Range} range The range selected by the user
 *
 * @return {UserSelection} the user selection
 */
function getUserSelectionFromSingleClickCallback( range ) {
    var startContainer;
    var endContainer;
    var startOffset;
    var endOffset;

    var rangee = checkSelectionForCkeditor5( range );
    range = rangee;

    var requirementNode = getTopRequirementElement( range.commonAncestorContainer.parentNode );
    if( requirementNode ) {
        var markupHeader = requirementNode.getElementsByClassName( 'aw-requirement-header' );
        if( markupHeader && markupHeader.length > 0 ) {
            var markupHeaderText = markupHeader[0].innerText;
        }
    }
    var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if( reqMarkupCtx ) {
        reqMarkupCtx.markupHeader = markupHeaderText;
        appCtxSvc.updateCtx( 'reqMarkupCtx', reqMarkupCtx );
    } else {
        var reqMarkupCtx = {};
        reqMarkupCtx.markupHeader = markupHeaderText;
        appCtxSvc.registerCtx( 'reqMarkupCtx', reqMarkupCtx );
    }

    if( !range.collapsed ) {
        return range;
    } else if ( !range.startContainer.nodeValue && !range.endContainer.nodeValue ) {
        return null;
    }

    // if node on which clicked does not contanin any space
    if ( range.startContainer.nodeValue.indexOf( ' ' ) === -1 ) {
        var startTextNode = range.startContainer;
        startContainer = getLastTextNodeWithSpace( startTextNode );

        //if entire text body does not contain any space
        if ( lastTextNodeWithSpace === null ) {
            startContainer = range.startContainer;
            startOffset = findStartOffSetUsingRange( range );
        } else {
            startOffset = findStartOffSetUsingNode( startContainer );
            lastTextNodeWithSpace = null;
        }
    } else {
        // This checks allowed to create range if end container having a space before range startOffset
        if ( isSpaceBeforeRangeSelection( range ) ) {
            startContainer = range.startContainer;
            startOffset = findStartOffSetUsingRange( range );
        } else {
            startTextNode = range.startContainer;
            startContainer = getLastTextNodeWithSpace( startTextNode, true );
            // this checks allow to create the range for first node without space
            if ( lastTextNodeWithSpace === null ) {
                startContainer = range.startContainer;
                startOffset = findStartOffSetUsingRange( range );
            } else {
                startOffset = findStartOffSetUsingNode( startContainer );
                lastTextNodeWithSpace = null;
            }
        }
    }

    // if node on which clicked does not contanin any space
    if ( range.endContainer.nodeValue.indexOf( ' ' ) === -1 ) {
        var endTextNode = range.endContainer;
        endContainer = getFirstTextNodeWithSpace( endTextNode );

        // if entire text body does not contain any space
        if ( firstTextNodeWithSpace === null ) {
            endContainer = range.endContainer;
            endOffset = findEndOffSetUsingRange( range );
        } else {
            endOffset = findEndOffSetUsingNode( endContainer );
            firstTextNodeWithSpace = null;
        }
    } else {
        // This checks allowed to create range if end container having a space after range endoffset
        if ( isSpaceAfterRangeSelection( range ) ) {
            endContainer = range.endContainer;
            endOffset = findEndOffSetUsingRange( range );
        } else {
            endTextNode = range.endContainer;
            endContainer = getFirstTextNodeWithSpace( endTextNode, true );
            // this checks allow to create the range for last node without space
            if ( firstTextNodeWithSpace === null ) {
                endContainer = range.endContainer;
                endOffset = findEndOffSetUsingRange( range );
            } else {
                endOffset = findEndOffSetUsingNode( endContainer );
                firstTextNodeWithSpace = null;
            }
        }
    }
    var sel = window.getSelection();
    sel.removeAllRanges();
    var doc = frameWindow.document || frameWindow.contentDocument;
    if ( startContainer && endContainer ) {
        range = doc.createRange();
        range.setStart( startContainer, startOffset );
        range.setEnd( endContainer, endOffset );
        return range;
    }
    return null;
 }

/**
* Get accurate range in case of ckeditor 5 when New Comment command is hidden inside 'More Commands'
*
* @param {Range} range The range selected by the user
*
* @return {Range} the accurate range selected by the user
**/
function checkSelectionForCkeditor5( range ) {
    if( range && range.startContainer && range.startContainer.parentElement && range.startContainer.parentElement.classList
        && range.startContainer.parentElement.classList.length > 0 && range.startContainer.parentElement.classList[0] === 'aw-popup-cellContentContainer' ) {
        var isCk5 = appCtxSvc.getCtx( 'Arm0Requirements' ).Editor === 'CKEDITOR_5';
        if( isCk5 ) {
            var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
            var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
            if( editor ) {
                var modelRange = editor.model.document.selection.getFirstRange();
                var viewRange = editor.editing.mapper.toViewRange( modelRange );
                var domRange = editor.editing.view.domConverter.viewRangeToDom( viewRange );
                range = domRange;
            }
        }
    }
    return range;
}

/**
* Check if space exist after selected range offset
*
* @param {range} range The range selected by the user
*
* @return {Boolean} isSpace return the true or false
*/
function isSpaceAfterRangeSelection( range ) {
   var isSpace = false;
   var text = range.endContainer.nodeValue;
   var index = 0;
   for ( var i = range.endOffset; i < text.length; i++ ) {
       if ( text.charAt( i ) === ' ' ) {
           index = i;
           break;
       }
   }
   if ( index > 0 ) {
       isSpace = true;
   }

   return isSpace;
}

/**
* Get the end offset of selection from endContainer
*
* @param {Node} endContainer The end node of selected text
* @return {int} offset return the offset
*/
function findEndOffSetUsingNode( endContainer ) {
   var offset = 0;
   var text;
   if ( endContainer && endContainer.nodeValue ) {
       text = endContainer.nodeValue;
       for ( var k = 0; k < text.length; k++ ) {
           if ( text.charCodeAt( k ) === 32 || text.charCodeAt( k ) === 160 ) {
               offset = k;
               break;
           }
       }
   }
   return offset;
}

/**
* Get the end offset of selection from range
*
* @param {Range} range The range selected by the user
*
* @return {int} offset return the offset
*/
function findEndOffSetUsingRange( range ) {
   var offset = 0;
   var text;
   if ( range && range.endContainer && range.endContainer.nodeValue ) {
       text = range.endContainer.nodeValue;
       for ( var i = range.endOffset; i <= text.length; i++ ) {
           if ( text.charCodeAt( i ) === 32 || text.charCodeAt( i ) === 160 ) {
               offset = i;
               break;
           }
           if ( i === text.length ) {
               for ( var j = i; j >= range.endOffset; j-- ) {
                   if ( text.charCodeAt( j ) !== 32 && text.charCodeAt( j ) !== 160 ) {
                       offset = j;
                       return offset;
                   }
               }
           }
       }
   }
   return offset;
}
/**
* Get the previous node with space from the selected node
*
* @param {Node} node The range selected by the user
* @param {Boolean} isNotSpace is space exist in text node
*
* @return {node} node return the index
*/
function getLastTextNodeWithSpace( node, isNotSpace ) {
   while ( node ) {
       if ( !isNotSpace ) {
           if ( isText( node ) && node.nodeValue.indexOf( ' ' ) > -1 ) {
               lastTextNodeWithSpace = node;
               return node;
           }
       }
       isNotSpace = false;
       if ( node.previousSibling === null ) {
           node = node.parentNode.previousSibling;
           node = getLastChildrenNodesWithSpace( node );
       } else {
           node = node.previousSibling;
           node = getLastChildrenNodesWithSpace( node );
       }
   }
   return node;
}

/**
 * Is object a text node?
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isText( obj ) {
    return  obj.nodeType === 3;
}

/**
* Get the first children nodes with space from the selected node
*
* @param  {Node} node - the node
*
* @return {node} node return the node
*
*/
function getFirstChildrenNodesWithSpace( node ) {
   if ( node && node.childNodes && node.childNodes.length > 0 ) {
       for ( var i = 0; i < node.childNodes.length; i++ ) {
           var isTextNode = isText( node.childNodes[i] );
           if ( isTextNode && node.childNodes[i].nodeValue.indexOf( ' ' ) > -1 ) {
               firstTextNodeWithSpace = node.childNodes[i];
               break;
           }
           if ( !firstTextNodeWithSpace ) {
               getFirstChildrenNodesWithSpace( node.childNodes[i] );
           }
       }
       if ( firstTextNodeWithSpace ) {
           return firstTextNodeWithSpace;
       }
   }
   return node;
}

/**
* Get the last children nodes with space from the selected node
*
* @param  {Node} node - the node
*
* @return {node} node return the node
*
*/
function getLastChildrenNodesWithSpace( node ) {
   if ( node && node.childNodes && node.childNodes.length > 0 ) {
       for ( var i = node.childNodes.length - 1; i >= 0; i-- ) {
           var isTextNode = isText( node.childNodes[i] );
           if ( isTextNode && node.childNodes[i].nodeValue.indexOf( ' ' ) > -1 ) {
               lastTextNodeWithSpace = node.childNodes[i];
               break;
           }
           if ( !lastTextNodeWithSpace ) {
               getLastChildrenNodesWithSpace( node.childNodes[i] );
           }
       }
       if ( lastTextNodeWithSpace ) {
           return lastTextNodeWithSpace;
       }
   }
   return node;
}

/**
* Get the start offset of selection from startContainer
*
* @param {Node} startContainer The start node of selected text
*
* @return {int} offset return the offset
*/
function findStartOffSetUsingNode( startContainer ) {
   var offset = 0;
   var text;
   if ( startContainer && startContainer.nodeValue ) {
       text = startContainer.nodeValue;
       for ( var j = 0; j < text.length; j++ ) {
           if ( text.charCodeAt( j ) === 32 || text.charCodeAt( j ) === 160 ) {
               offset = j;
           }
       }
       offset += 1;
   }
   return offset;
}

/**
* Get the next node with space from the selected node
*
* @param {Node} node The range selected by the user
* @param {Boolean} isNotSpace is space exist in text node
*
* @return {node} node return the node
*/
function getFirstTextNodeWithSpace( node, isNotSpace ) {
   while ( node ) {
       if ( !isNotSpace ) {
           if ( isText( node ) && node.nodeValue.indexOf( ' ' ) > -1 ) {
               firstTextNodeWithSpace = node;
               return node;
           }
       }
       isNotSpace = false;

       if ( node.nextSibling === null ) {
           node = node.parentNode.nextSibling;
           node = getFirstChildrenNodesWithSpace( node );
       } else {
           node = node.nextSibling;
           node = getFirstChildrenNodesWithSpace( node );
       }
   }
   return node;
}

/**
* Get the start offset of selection from range
*
* @param {Range} range The range selected by the user
*
* @return {int} index return the offset
*/
function findStartOffSetUsingRange( range ) {
   var offset = 0;
   var text;
   if ( range && range.startContainer && range.startContainer.nodeValue ) {
       text = range.startContainer.nodeValue;
       for ( var i = 0; i < range.startOffset; i++ ) {
           if ( text.charCodeAt( i ) === 32 || text.charCodeAt( i ) === 160 ) {
               offset = i;
           }
       }
       if ( offset > 0 ) {
           offset += 1;
       }
   }
   return offset;
}

/**
* Check if space exist before selected range offset
*
* @param {range} range The range selected by the user
*
* @return {Boolean} isSpace return the true or false
*/
function isSpaceBeforeRangeSelection( range ) {
   var isSpace = false;
   var text = range.startContainer.nodeValue;
   var index = range.startOffset + 1;
   for ( var i = range.startOffset; i >= 0; i-- ) {
       if ( text.charAt( i ) === ' ' ) {
           index = i;
           break;
       }
   }
   if ( index !== range.startOffset + 1 ) {
       isSpace = true;
   }
   return isSpace;
}


/**
 * Show one markup
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function show( markup, option ) {
    if( markup.start !== markup.end ) {
        if( option === undefined && markup.visible !== undefined ) {
            option =  markup.visible ? 0 : 1;
        }

        if( markup.type === 'text' ) {
            _markupTextInstance.show( markup, option );
        }
    }
}

/**
 * Show all markups
 *
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAll( option ) {
    var markupTextInstance = ckeditorOperations.getMarkupTextInstance();
    if( markupTextInstance ) {
        markupTextInstance.showAll( option );
    }
}

/**
 * Show markup as selected
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAsSelected( markup, option ) {
    if( markup.start !== markup.end ) {
        if( markup.type === 'text' ) {
            _markupTextInstance.showAsSelected( markup, option );
        }
    }
}

/**
 * Ensure markup is visible
 *
 * @param {Markup} markup The markup to be ensured as visible
 */
export function ensureVisible( markup ) {
    if( markup.start === markup.end || markup.type !== 'text' ) {
        return;
    }

    var page = getPageElement();
    var container = viewerContainer;
    var info = _markupTextInstance.findStartEndInfo( markup.start, markup.end );

    if( page && container && info && info.start && info.start.node ) {
        var span = info.start.node.parentNode;
        if( span ) {
            var boundingRect = span.getBoundingClientRect();
            var clientH = container.clientHeight;
            var clientW = container.clientWidth;

            if( boundingRect.left >= 0 && boundingRect.left <= clientW &&
                boundingRect.top >= 0 && boundingRect.top <= clientH ) {
                return;
            }

            var markupT = 0;
            var markupL = 0;
            var markupH = span.offsetHeight;
            var markupW = span.offsetWidth;
            for( var el = span; el && el.tagName && el.tagName !== 'BODY'; el = el.offsetParent ) {
                markupT += el.offsetTop;
                markupL += el.offsetLeft;
            }

            var bestT = markupT + markupH / 2 - clientH / 2;
            var bestL = markupL + markupW / 2 - clientW / 2;
            container.contentWindow.scrollTo( bestL, bestT );
        }
    }
}

/**
 * Show the current page
 */
export function showCurrentPage() {
    textRoot = getPageElement();
    if( textRoot && textRoot.firstChild ) {
        _markupTextInstance.setPageTextRoot( textRoot );
        _markupTextInstance.showCurrentPage();
    } else {
        frameWindow.setTimeout( showCurrentPage, 200 );
    }
}

/**
 * Set select callback
 *
 * @param {function} callback The callback
 */
export function setSelectCallback( callback ) {
    function mySelectCallback( markup ) {
        if( revealed ) {
            callback( markup );
        }
    }

    _markupTextInstance.setSelectCallback( mySelectCallback );
}

/**
 * Set selection end callback
 *
 * @param {function} callback The callback
 */
export function setSelectionEndCallback( callback ) {
    function mySelectionEndCallback( t ) {
        if( revealed && tool === t ) {
            callback( t );
        }
    }

    _markupTextInstance.setSelectionEndCallback( mySelectionEndCallback );
}

/**
 * Select callback
 *
 * @param {Node} node - the markup being selected in the left panel
 * @return {String} object ID
 */
function findObjIdCallback( node ) {
    var reqObjectUID;
    var parentNode = getTopRequirementElement( node );
    if( parentNode && parentNode.attributes && !parentNode.attributes.revisionid && parentNode.attributes.id && parentNode.attributes.id.value
        && parentNode.attributes.id.value.indexOf( 'RM::NEW::' ) >= 0 ) {
            reqObjectUID = parentNode.attributes.id.value;
    } else if( parentNode && parentNode.attributes && parentNode.attributes.revisionid && parentNode.attributes.revisionid.value ) {
        reqObjectUID = parentNode.attributes.revisionid.value;
    }
    return reqObjectUID;
}


/**
 * Get the page info
 *
 * @param {int} pageIndex The page index
 *
 * @return {PageInfo} the page info
 */
export function getPageInfo( pageIndex ) {
    var info = { width: 0.0, height: 0.0, scale: 1.0 };
    var elm = getPageElement();

    if( elm ) {
        info.width = elm.width;
        info.height = elm.height;
    }

    return info;
}

/**
 * Get the page element
 *
 * @return {Element} the page element
 */
export function getPageElement() {
    var reqText = [];
    if( appCtxSvc.ctx && appCtxSvc.ctx.occmgmtContext ) {
        reqText = document.getElementsByClassName( 'aw-requirements-xrtRichText' );
    }
    var doc = frameWindow.document || frameWindow.contentDocument;
    return reqText.length > 0 ? reqText[ 0 ] : doc.body;
}

/**
 * Set revealed
 *
 * @param {boolean} reveal - true to reveal or false to hide
 */
export function setRevealed( reveal ) {
    revealed = reveal;
    markupTooltip.clearTooltip();
    setTool( null );
}

//==================================================
// private functions
//==================================================
/**
 * Get the frame window
 *
 * @return {iFrame} the frame window
 */
function getFrameWindow() {
    var frames = window.frames;
    for( var i = 0; i < frames.length; i++ ) {
        var frameElement = frames[ i ].frameElement;
        if( frameElement && frameElement.className.indexOf( 'cke_wysiwyg_frame' ) >= 0 ) {
            return frames[ i ];
        }
    }

    return window;
}
/**
 * Set the viewer container to show tooltip
 *
 * @return {boolean} true if successful
 */
function setViewerContainer() {
    viewerContainer = frameWindow.frameElement;
    if( viewerContainer ) {
        ckeditorOperations.setViewerContainer( viewerContainer );
        return true;
    }
    return false;
}
/**
 * Restore all markups, in case of Undo event
 */
export function attachCachedMarkupsToNode() {
    if( textRoot ) {
        var nodes = textRoot.getElementsByTagName( 'span' );
        var L = nodes.length;
        var allMarkupSpans = [];
        var str = 'RM::Markup::';
        while( L ) {
            var temp_node = nodes[ --L ];
            var temp_id = temp_node.id || '';
            if( temp_id.indexOf( str ) === 0 ) {
                allMarkupSpans.push( temp_node );
            }
        }
        for( var i = 0; i < allMarkupSpans.length; i++ ) {
            var spanNode = allMarkupSpans[ i ];
            var commentid = spanNode.id;
            var node_markups = commentIdWithMarkupsMap[ commentid ];
            if( node_markups ) {
                spanNode.markups = node_markups;
            }
            _markupTextInstance.setMarkupEventListeners( spanNode );
        }
    }
}

//==================================================
// exported functions
//==================================================
let exports;
export let clearUserSelection = function() {
    _markupTextInstance.clearUserSelection();
};
export let setViewParam = function() {};
export let getViewParam = function() {
    return { scale: 1, x: 0, y: 0 };
};
export let getPageCount = function() {
    return 1;
};
export let setViewParamChangeCallback = function() {};
export let setPageChangeCallback = function() {};
export let setUnloadCallback = function() {};
export let addResource = function() {};

export default exports = {
    init,
    setTool,
    show,
    showAll,
    showAsSelected,
    ensureVisible,
    showCurrentPage,
    getUserSelection,
    clearUserSelection,
    setViewParam,
    getViewParam,
    getPageCount,
    getPageInfo,
    getPageElement,
    setViewParamChangeCallback,
    setPageChangeCallback,
    setSelectCallback,
    setSelectionEndCallback,
    setUnloadCallback,
    addResource,
    setRevealed,
    attachCachedMarkupsToNode,
    initializeCallbacksforCk5
};
