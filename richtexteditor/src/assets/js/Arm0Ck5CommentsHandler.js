// Copyright 2020 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/Arm0Ck5CommentsHandler
 */
import markupViewModel from 'js/Arm0MarkupViewModel';
import appCtxSvc from 'js/appCtxService';
import ckeditorOperations from 'js/ckeditorOperations';
import markupService from 'js/Arm0MarkupService';
import _ from 'lodash';

'use strict';
//==================================================
// private variables
//==================================================
/** The frame window */
var frameWindow = window;
/** The list of all markups */
var markups = [];
/** The text roots */
var textRoots = [];
/** The viewer container */
var viewerContainer = null;
/** Need adjust bounding rect for tooltip */
var adjustBoundingRect = false;
/** The current container index */
var currentIndex = 0;
/** The currently selected markup */
var selectedMarkup = null;
/** The selected range */
var selectedRange = null;
/** The select timeout */
var selectTimeout = null;
/** The select callback */
var selectCallback = null;
/** The findObjId callback */
var findObjId = null;
/** The isBodyContent callback */
var isBodyContent = null;
/** The markup span callback */
var markupSpanChanged = null;
/** The markupThread */
var thread = null;
/** The getUserSelectionFromSingleClick callback */
var getUserSelectionFromSingleClick = null;

var total = 0;
/** The container to show tooltip */
var container = null;
/** The markup currently shown tooltip */
var currentMarkup = null;
/** The tooltip color */
var color = 'rgb(0, 0, 0)';
/** The tooltip background color */
var bgColor = 'rgb(255, 255, 222)';
/** The tooltip border color */
var borderColor = 'rgb(32, 32, 32)';
/** The tooltip width */
var width = 350;
/** The tooltip max height */
var maxHeight = 300;

//==================================================
// public functions
//==================================================

/**
 * Set the page text root element
 *
 * @param {Element} textRoot The text root
 * @param {int} index The page index, default 0
 */
export function setPageTextRoot( textRoot, index ) {
    index = index || 0;
    textRoots[ index ] = textRoot;
    currentIndex = index;
    textRoot.rootIndex = index;
}

/**
 * Get the user selection of text
 *
 * @return {UserSelection} the user selection
 */
export function getUserSelection() {
    var range = null;
    var selection = frameWindow.getSelection();
    var commentContext = appCtxSvc.getCtx( 'commentContext' );
    if ( commentContext ) {
        var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        if ( editor ) {
            var modelRange = editor.model.document.selection.getFirstRange();
            var viewRange = editor.editing.mapper.toViewRange( modelRange );
            var domRange = editor.editing.view.domConverter.viewRangeToDom( viewRange );
            range = domRange;
        }
    } else if( selection && selection.rangeCount > 0 ) {
        range = selection.getRangeAt( 0 );
    } else {
        var doc = frameWindow.document || frameWindow.contentDocument;
        selection = doc.getSelection();
        if( selection && selection.rangeCount > 0 ) {
            range = selection.getRangeAt( 0 );
        } else if( selectedRange ) {
            range = selectedRange;
        } else {
            return null;
        }
    }

    return getUserSelectionFromRange( range );
}

/**
 * Clear the user selection
 */
export function clearUserSelection() {
    if( frameWindow ) {
        try {
            var selection = frameWindow.getSelection();
            if( selection && selection.rangeCount > 0 ) {
                selection.removeAllRanges();
            }

            var doc = frameWindow.document || frameWindow.contentDocument;
            selection = doc.getSelection();
            if( selection && selection.rangeCount > 0 ) {
                selection.removeAllRanges();
            }
        } catch ( err ) {
            // ignore errors during removeAllRanges
        }
    }

    selectedRange = null;

    if( selectTimeout ) {
        clearTimeout( selectTimeout );
        selectTimeout = null;
    }
}

/**
 * Recalculate all the markup positions
 */
export function recalcAllMarkupPositions() {
    var allMarkups = markupViewModel.getMarkups();
    var markupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if( markupCtx ) {
        appCtxSvc.ctx.reqMarkupCtx.reqMarkupsData = allMarkups;
    }
    var commentContext = appCtxSvc.getCtx( 'commentContext' );
    if ( commentContext ) {
        var commentsMap = markupViewModel.getCommentsMap();
        var finalCommentList = [];
        for ( let [ key, value ] of commentsMap.entries() ) {
            var length = allMarkups.length;
            for ( var i = 0; i < length; i++ ) {
                if ( allMarkups[i] && allMarkups[i].reqData && allMarkups[i].reqData.commentid
                    && allMarkups[i].reqData.commentid === key ) {
                    finalCommentList.push( value );
                }
            }
        }
        allMarkups = finalCommentList;
    }
    allMarkups.sort( function( a, b ) {
        var revId1 = a.objId;
        var revId2 = b.objId;
        if( revId1 === revId2 ) {
            return 0;
        } else if( revId1 > revId2 ) {
            return 1;
        }
        return -1;
    } );
    var updatedMarkups = [];
    var bodyTextMap = {};
    var editor = ckeditorOperations.getCKEditorInstance( '', appCtxSvc.ctx );
    for( var i = 0; i < allMarkups.length; i++ ) {
        var rev = allMarkups[i].objId;
        var element = null;
        if( rev && rev.indexOf( 'RM::NEW::' ) >= 0 ) {
            element = document.querySelector( 'div[id="' + rev + '"]' );
        }else{
            element = document.querySelector( 'div[revisionId="' + rev + '"]' );
        }
        var bodyTextDiv;
        if( element ) {
            if( bodyTextMap[ rev ] ) {
                bodyTextDiv = bodyTextMap[ rev ];
            } else {
                bodyTextDiv = element.getElementsByClassName( 'aw-requirement-bodytext' );
                if( bodyTextDiv && bodyTextDiv.length > 0 ) {
                    bodyTextDiv = bodyTextDiv[ 0 ];
                    bodyTextMap[ rev ] = bodyTextDiv;
                }
            }
            if ( bodyTextDiv ) {
                total = 0;
                if ( commentContext ) {
                    updatePositionForComment( bodyTextDiv, allMarkups[i], editor, updatedMarkups );
                } else {
                    updatePositionForMarkup( bodyTextDiv, allMarkups[i], editor, updatedMarkups );
                }
            }
        }
    }
    var finalMarkupsList = [];
    for( var j = 0; j < allMarkups.length; j++ ) {
        if( updatedMarkups[allMarkups[j].reqData.commentid] === '' ) {
            finalMarkupsList.push( allMarkups[j] );
            markupViewModel.getReplyComments( allMarkups[j], finalMarkupsList );
        }
    }
    var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if( reqMarkupCtx ) {
        appCtxSvc.ctx.reqMarkupCtx.reqMarkupsData = finalMarkupsList;
    }

    // Create data for track changes
    createDataForTrackChanges( editor );
}

/**
 * Create data for track changes
 *
 * @param {*} editor
 */
function createDataForTrackChanges( editor ) {
    const finalTrackChangesMap = markupViewModel.getFinalTrackChangesMap();
    const markers = editor.model.markers._markers;
    const trackChangesMap = markupViewModel.getTrackChangesMap();
    for( let [ key, value ] of markers.entries() ) {
        for( let [ mKey, mValue ] of trackChangesMap.entries() ) {
            if( key.indexOf( mKey ) >= 0 ) {
                finalTrackChangesMap.set( mKey, mValue );
            }
        }
    }
}

/**
 *
 * @param {*} bodyTextDiv
 * @param {*} markup
 * @param {*} editor
 * @param {*} total
 */
function updatePositionForComment( bodyTextDiv, markup, editor, updatedMarkups ) {
    var children = bodyTextDiv.childNodes;
    for ( var i = 0; i < children.length; i++ ) {
        var childNode = children[i];
        if ( isText( childNode ) ) {
            var isMarkupSpan = isCommentSpan( childNode.parentElement, markup.threadId );
            if ( isMarkupSpan.isCommentSpan && updatedMarkups[markup.reqData.commentid] !== '' ) {
                var isCurrentCmtsParentCovered = false;
                if ( markup.reqData.parentCommentid && updatedMarkups[markup.reqData.parentCommentid] === '' ) {
                    isCurrentCmtsParentCovered = true;
                }
                if ( !isCurrentCmtsParentCovered ) {
                    var markupsToUpdate = [];
                    markupsToUpdate.push( markup );
                    for ( i = 0; i < markupsToUpdate.length; i++ ) {
                        markupsToUpdate[i].isMarkupPositionRecalculated = true;
                        markupsToUpdate[i].start.rch = total;
                        markupsToUpdate[i].end.rch = total;
                        var marker = null;
                        if ( !markup.markerName ) {
                            var markerString = 'comment:' + isMarkupSpan.element.getAttribute( 'data-comment' ) + ':' + markup.reqData.commentid;
                            marker = editor.model.markers._markers.get( markerString );
                        } else {
                            marker = editor.model.markers._markers.get( markup.markerName );
                        }
                        if ( marker && marker._liveRange ) {
                            updatedMarkups[markup.reqData.commentid] = '';
                            for ( const item of marker._liveRange.getItems() ) {
                                var textNode = item.textNode;
                                if ( textNode ) {
                                    var commentText = item.data;
                                    markupsToUpdate[i].end.rch += commentText.length;
                                }
                            }
                        }
                    }
                    return -1;
                }
            }
            var childnodeText = childNode.textContent;
            // removing the &NoBreak; from node textContent.
            var childNodeTextLength = childnodeText.replaceAll( '\u2060', '' ).length;
            total += childNodeTextLength;
        }
        if ( childNode.childNodes.length > 0 ) {
            var val = updatePositionForComment( childNode, markup, editor, updatedMarkups );
            if ( val === -1 ) {
                return;
            }
        }
    }
}

/**
 *
 * @param {*} obj - Dom Node
 * @param {*} threadId - Current Comment Thread id
 * @return {*} Object - Contains the dom node
 */
function isCommentSpan( obj, threadId ) {
    if( obj.nodeName === 'STRONG' ) {
        obj = obj.parentElement;
    }
    var isCommentSpanValue = obj.nodeName === 'SPAN' && obj.getAttribute( 'data-comment' )
        && obj.getAttribute( 'data-comment' ).indexOf( threadId ) >= 0;
    if( !isCommentSpanValue ) {
        var result = _checkParentNodes( obj.parentNode, threadId );
        if( result.isCommentSpan ) {
            return { isCommentSpan: result.isCommentSpan, element: result.element };
        }
    }
    return { isCommentSpan: isCommentSpanValue, element: obj };
}


function getMarkupFromId( commentId ) {
    var markupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if( markupCtx ) {
        for( var j = 0; j < markupCtx.reqMarkupsData.length; j++ ) {
            if( markupCtx.reqMarkupsData[j].reqData.commentid === commentId ) {
                return markupCtx.reqMarkupsData[j];
            }
        }
    }
}

/**
 *
 * @param {*} obj - Dom Node
 * @param {*} threadId - Current Comment Thread id
 * @return {*} Boolean - Contains the dom node
 */
function _checkParentNodes( obj, threadId ) {
    if( obj && obj.nodeName === 'P' ) {
        return { isCommentSpan:false };
    }else if( obj && obj.nodeName !== 'SPAN' ) {
        return _checkParentNodes( obj.parentNode, threadId );
    }else if( obj && obj.nodeName === 'SPAN' && obj.getAttribute( 'data-comment' )
    && obj.getAttribute( 'data-comment' ).indexOf( threadId ) >= 0 ) {
        return { isCommentSpan:true, element:obj };
    }
    return { isCommentSpan:false };
}

/**
 *
 * @param {*} bodyTextDiv
 * @param {*} markup
 * @param {*} editor
 * @param {*} total
 */
function updatePositionForMarkup( bodyTextDiv, markup, editor, updatedMarkups ) {
    var children = bodyTextDiv.childNodes;
    for( var i = 0; i < children.length; i++ ) {
        var childNode = children[ i ];
        if( isText( childNode ) ) {
            var isMarkupSpan = isMarkupSpanWithId( childNode.parentElement, markup.reqData.commentid );
            if( isMarkupSpan.isMarkupSpan && updatedMarkups[ markup.reqData.commentid ] !== '' ) {
                var id = isMarkupSpan.element.getAttribute( 'id' );
                var values = id.split( ',' );
                var markupsToUpdate = [];
                if( values.length > 1 ) {
                    for( var i = 0; i < values.length; i++ ) {
                        var markupToUpdate = getMarkupFromId( values[ i ] );
                        if( markupToUpdate ) {
                            markupsToUpdate.push( markupToUpdate );
                        }
                    }
                } else {
                    markupsToUpdate.push( markup );
                }
                for( i = 0; i < markupsToUpdate.length; i++ ) {
                    markupsToUpdate[i].isMarkupPositionRecalculated = true;
                    markupsToUpdate[i].start.rch = total;
                    markupsToUpdate[i].end.rch = total;
                    var marker = editor.model.markers._markers.get( markupsToUpdate[i].reqData.commentid );
                    if( marker && marker._liveRange ) {
                        updatedMarkups[ markup.reqData.commentid ] = '';
                        for( const item of marker._liveRange.getItems() ) {
                            var textNode = item.textNode;
                            if( textNode ) {
                                var commentText = item.data;
                                markupsToUpdate[i].end.rch += commentText.length;
                            }
                        }
                    }
                }
                return -1;
            }
            total += childNode.length;
        }
        if( childNode.childNodes.length > 0 ) {
            var val = updatePositionForMarkup( childNode, markup, editor, updatedMarkups );
            if( val === -1 ) {
                return;
            }
        }
    }
}

/**
 *Method to remove all live range from editor instance before save
 */
export function doPostProcessing() {
    var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
    var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
    var markers  = editor.model.markers._markers;
    var commentContext = appCtxSvc.getCtx( 'commentContext' );
    if ( commentContext ) {
        //removeCkeditor5Markers( editor, markers );
    } else {
        for( let [ key, value ] of markers.entries() ) {
            editor.model.change( ( writer ) => {
                try {
                    var liveRange = markers.get( key )._liveRange;

                    writer.removeAttribute( 'spanId', liveRange );
                    writer.removeAttribute( 'spanStyle', liveRange );


                    var ranges =  [ ...liveRange.getItems() ];
                    for( const item of ranges ) {
                        var textNode = item.textNode;
                        if( textNode ) {
                            var itemData = item.data;
                            var textNodeData = textNode._data;
                            if( itemData === textNodeData ) {
                                writer.removeAttribute( 'spanStyle', textNode );
                            }
                        }
                    }

                    writer.removeMarker( markers.get( key ) );
                } catch ( error ) {
                    //do nothihing. marker not present
                }
            } );
        }
    }
    appCtxSvc.ctx.ckeditor5Markers = [];
}

/**
 * Method to remove ckeditor markers
 *
 * @param {editor} editor - The editor instance
 * @param {Map} markers - The marker map
 *
 */
function removeCkeditor5Markers( editor, markers ) {
    for ( let [ key, value ] of markers.entries() ) {
        if( key.indexOf( 'suggestion:' ) < 0 ) {
            editor.model.change( ( writer ) => {
                try {
                    writer.removeMarker( markers.get( key ) );
                } catch ( error ) {
                    //do nothihing. marker not present
                }
            } );
        }
    }
}

/**
 * Remove all spans with markups
 */
export function removeAllMarkupSpans() {
    for( var i = 0; i < textRoots.length; i++ ) {
        if( textRoots[ i ] ) {
            for( var node = getFirstNode( textRoots[ i ] ); node; node = getNextNode( node ) ) {
                if( !isBodyContent || isBodyContent( node ) ) {
                    removeMarkupSpan( node );
                }
            }
        }
    }
}

/**
 * Get user selection from range
 *
 * @param {Range} range The range selected by the user
 *
 * @return {UserSelection} the user selection
 */
export function getUserSelectionFromRange( range, isLoginUserNotPresent ) {
    if( !isLoginUserNotPresent ) {
        if ( getUserSelectionFromSingleClick ) {
            range = getUserSelectionFromSingleClick( range );
        }
        if( !range ) {
            return null;
        }
    }

    var startNode = getFirstNode( range.startContainer );
    var endNode = getFirstNode( range.endContainer );
    var startOffset = range.startOffset;
    var endOffset = range.endOffset;
    var startCh = -1;
    var endCh = -1;
    var startRch = -1;
    var endRch = -1;
    var currentObjId;

    for( var p = 0; p < 2; p++ ) {
        if( p === 0 ) {
            var textRoot = textRoots[ 0 ];
        }
        if( !isLoginUserNotPresent ) {
            if( !textRoot || !textRoot.childNodes ) {
                return null;
            }
        }
        var sumLength = 0;
        var relLength = 0;
        for( var node = getFirstNode( textRoot ); node; node = getNextNode( node ) ) {
            if( !isBodyContent || isBodyContent( node ) ) {
                var thisObjId = findObjId ? findObjId( node ) : undefined;
                if( thisObjId !== currentObjId ) {
                    if( currentObjId && startCh >= 0 ) {
                        endCh = sumLength;
                        endRch = relLength;
                        break;
                    }
                    currentObjId = thisObjId;
                    relLength = 0;
                }

                if( node === startNode ) {
                    startCh = sumLength + startOffset;
                    startRch = relLength + startOffset;
                }

                if( node === endNode ) {
                    endCh = sumLength + endOffset;
                    endRch = relLength + endOffset;
                }

                if( startCh >= 0 && endCh >= 0 ) {
                    break;
                }

                sumLength += node.length;
                relLength += node.length;
            }
        }

        if( startCh >= 0 && endCh >= 0 ) {
            break;
        }
    }

    if( startCh >= 0 && endCh >= 0 ) {
        return {
            start: {
                page: 0,
                ch: startCh,
                rch:  currentObjId ? startRch : undefined
            },
            end: {
                page: 0,
                ch: endCh,
                rch:  currentObjId ? endRch : undefined
            },
            reference: range.toString(),
            objId: currentObjId
        };
    }

    return null;
}

export let showAll = function(  ) {
};

/**
 * Is object a root?
 *
 * @param {Node} obj The object to be tested
 * @param {boolean} ture if it is
 */
function isRoot( obj ) {
    return  !isNaN( obj.rootIndex );
}

/**
 * Is object a span node with markups?
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isMarkupSpan( obj ) {
    return  obj.nodeName === 'SPAN' && obj.getAttribute( 'id' ) && obj.getAttribute( 'id' ).startsWith( 'RM::Markup::' );
}

function isMarkupSpanWithId( obj, id ) {
    if( obj.nodeName === 'STRONG' ) {
        obj = obj.parentElement;
    }
    var isMarkupSpanValue = obj.nodeName === 'SPAN' && obj.getAttribute( 'id' ) && obj.getAttribute( 'id' ).indexOf( id ) !== -1;
    return { isMarkupSpan : isMarkupSpanValue, element : obj };
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
 * Is object a selectable text node? Ignore the inter-element white space
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isSelectableText( obj ) {
    return  obj.nodeType === 3 && obj.parentNode.nodeType === 1 &&
        ( isMarkupSpan( obj.parentNode ) || obj.nodeValue.match( /\S+/ ) || !isInterElement( obj ) );
}

/**
 * Is object inter-element? Given that it is a white space text node
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isInterElement( obj ) {
    var prev = obj.previousSibling;
    var next = obj.nextSibling;
    var pElem =  prev && !isText( prev ) && !isMarkupSpan( prev );
    var nElem =  next && !isText( next ) && !isMarkupSpan( next );
    return  pElem && nElem || pElem && !next || nElem && !prev;
}

/**
 * Get the first node under the current node
 *
 * @param {Node} node - the current node
 *
 * @return {Node} the first node
 */
function getFirstNode( node ) {
    if( !node ) {
        return null;
    }
    var first = node;

    while( first.firstChild ) {
        first = first.firstChild;
    }

    return  isSelectableText( first ) ? first : getNextNode( first );
}

/**
 * Get the next node following the current node
 *
 * @param {Node} node - the current node
 *
 * @return {Node} the next node
 */
function getNextNode( node ) {
    var next = node;
    while( next ) {
        if( isRoot( next ) ) {
            return null;
        } else if( next.nextSibling ) {
            return getFirstNode( next.nextSibling );
        }
        next = next.parentNode;
    }

    return null;
}

/**
 * Remove markup span above a node
 *
 * @param {Node} node - the node to remove markup spans
 */
export let removeMarkupSpan = function( node ) {
    var parent = node.parentNode;
    if( isMarkupSpan( parent ) ) {
        var grandParent = parent.parentNode;
        var prev = parent.previousSibling;
        var next = parent.nextSibling;
        var first = parent.firstChild;
        var last = parent.lastChild;

        if( prev && isText( prev ) && first && isText( first ) ) {
            first.nodeValue = prev.nodeValue + first.nodeValue;
            grandParent.removeChild( prev );
        }

        if( next && isText( next ) && last && isText( last ) ) {
            last.nodeValue += next.nodeValue;
            grandParent.removeChild( next );
        }
        removeEventListeners( parent );
        var child = parent.firstChild;
        while( child ) {
            grandParent.insertBefore( child, parent );
            child = parent.firstChild;
        }
        grandParent.removeChild( parent );
    }
};

/**
 * Add event listeners to a node
 *
 * @param {Node} node The node to add listeners
 */
function addEventListeners( node ) {
    node.addEventListener( 'click', selectListener, false );
    node.addEventListener( 'mouseover', showTooltipListener, false );
    node.addEventListener( 'mouseout', hideTooltipListener, false );
    node.addEventListener( 'touchend', selectListener, false );
}

/**
 * Remove event listeners from a node
 *
 * @param {Node} node The node to remove listeners
 */
function removeEventListeners( node ) {
    node.removeEventListener( 'click', selectListener, false );
    node.removeEventListener( 'mouseover', showTooltipListener, false );
    node.removeEventListener( 'mouseout', hideTooltipListener, false );
    node.removeEventListener( 'touchend', selectListener, false );
}
/**
 * Add/Remove event listeners from a node
 *
 * @param {Node} node The node to add/remove listeners
 */
export function setMarkupEventListeners( node, option ) {
    if( !option ) {
        addEventListeners( node );
    } else {
        removeEventListeners( node );
    }
}

/**
 * Select listener
 *
 * @param {Event} event The event
 */
function selectListener( event ) {
    var span = event.target;
    var inMarkup = markupViewModel.getMarkupFromId( span.id );
    if( inMarkup ) {
        var eventData = {
            selectedObjects : [ inMarkup ],
            selectedUids : [ inMarkup ]
        };
        event.preventDefault();
        markupService.selectMarkup( inMarkup, true );
        ckeditorOperations.markupSelected( eventData );
    }
}

/**
 * Show tooltip listener
 *
 * @param {Event} event The event
 */
function showTooltipListener( event ) {
    var span = event.target;
    var values = span.id.split( ',' );
    var inMarkup = [];
    for( var i = 0; i < values.length; i++ ) {
        var value = values[i];
        var markup = markupViewModel.getMarkupFromId( value );
        if( markup ) {
            inMarkup.push( markup );
        }
    }
    exports.showTooltip( viewerContainer, inMarkup, span.getBoundingClientRect(), adjustBoundingRect );
}

/**
 * Get the markup key for the thread
 *
 * @param {Markup} markup
 * @return {String} the key
 */
export function getKey( markup ) {
    if( markup ) {
        var array = [];
        var markups = markupViewModel.getMarkups();
        markups.forEach( comment => {
            if( comment.deleted !== true && JSON.stringify( comment.start ) === JSON.stringify( markup.start ) &&
                JSON.stringify( comment.end ) === JSON.stringify( markup.end ) ) {
                array.push( comment );
            }
        } );
        return array;
    }
    return [];
}

/**
 * Show tool tip
 *
 * @param {Element} inContainer The container to be shown with markup tooltip
 * @param {Markup} inMarkup The markup to be shown with its tooltip
 * @param {Rectangle} boundingRect The bounding rectangle in screen coordinates
 * @param {Boolean} adjust if true adjust the boundingRect
 */
export function showTooltip( inContainer, inMarkup, boundingRect, adjust ) {
    container = inContainer;
    currentMarkup = inMarkup[0];
    var ownerDoc = container.ownerDocument;
    var divMarkups = ownerDoc.getElementById( 'markupTooltip' );
    var divArrowFace = ownerDoc.getElementById( 'markupArrowFace' );
    var divArrowBorder = ownerDoc.getElementById( 'markupArrowBorder' );

    if( !divMarkups || !divArrowFace || !divArrowBorder ) {
        divMarkups = ownerDoc.createElement( 'div' );
        divMarkups.id = 'markupTooltip';
        divMarkups.style.borderStyle = 'solid';
        divMarkups.style.borderColor = borderColor;
        divMarkups.style.borderWidth = '1px';
        divMarkups.style.borderRadius = '6px';
        divMarkups.style.padding = '6px';
        divMarkups.style.width = width + 'px';
        divMarkups.style.maxHeight = maxHeight + 'px';
        divMarkups.style.color = color;
        divMarkups.style.backgroundColor = bgColor;
        divMarkups.style.position = 'absolute';
        divMarkups.style.font = '9pt verdana,arial,sans-serif';
        divMarkups.style.overflow = 'hidden';
        divMarkups.style.zIndex = '1001001';
        divMarkups.style.pointerEvents = 'none';
        ownerDoc.body.appendChild( divMarkups );

        divArrowFace = ownerDoc.createElement( 'div' );
        divArrowFace.id = 'markupArrowFace';
        divArrowFace.style.borderStyle = 'solid';
        divArrowFace.style.borderColor = 'transparent';
        divArrowFace.style.borderWidth = '10px';
        divArrowFace.style.width = '0px';
        divArrowFace.style.height = '0px';
        divArrowFace.style.position = 'absolute';
        divArrowFace.style.zIndex = '1001002';
        divArrowFace.style.pointerEvents = 'none';
        ownerDoc.body.appendChild( divArrowFace );

        divArrowBorder = divArrowFace.cloneNode( true );
        divArrowBorder.id = 'markupArrowBorder';
        divArrowBorder.style.zIndex = '1001000';
        divArrowBorder.style.pointerEvents = 'none';
        ownerDoc.body.appendChild( divArrowBorder );

        var ulSheet = ownerDoc.createElement( 'style' );
        ulSheet.innerHTML = 'div#markupTooltip ul { list-style: disc outside; }';
        ownerDoc.body.appendChild( ulSheet );

        var olSheet = ownerDoc.createElement( 'style' );
        olSheet.innerHTML = 'div#markupTooltip ol { list-style: decimal outside; }';
        ownerDoc.body.appendChild( olSheet );
    }

    var html = '';
    for( var k = 0; k < inMarkup.length; k++ ) {
        var markups = exports.getKey( inMarkup[ k ] );
        if( markups &&  markups.length > 0 ) {
            for( var i = 0; i < markups.length; i++ ) {
                var markup = markups[ i ];
                html += '<p style=\'margin: 4px 0px 4px 0px;\'><strong>' + markup.displayname + '</strong> ' +
                    markup.date.toLocaleString() + '</p>' + markup.comment;
            }
        }else{
            var  markupsColl = ckeditorOperations.setTooltipInColloboration( inMarkup[1] );
            for( var i = 0; i < markupsColl.length; i++ ) {
                var markup = markupsColl[ i ];
                html += '<p style=\'margin: 4px 0px 4px 0px;\'><strong>' + markup.displayname + '</strong> ' +
                    markup.date.toLocaleString() + '</p>' + markup.comment;
            }
            break;
        }
    }
    divMarkups.innerHTML = html;

    var containerRect = container.getBoundingClientRect();
    var adjustLeft = adjust ? containerRect.left : 0;
    var adjustTop = adjust ? containerRect.top : 0;
    var center = ( boundingRect.left + boundingRect.right ) / 2 + adjustLeft;
    var left = center - width / 2;

    if( left < containerRect.left ) {
        left = containerRect.left;
    }

    if( left + width > containerRect.left + container.clientWidth ) {
        left = containerRect.left + container.clientWidth - width;
    }

    var top = boundingRect.bottom + 10 + adjustTop;
    var arrowTop = boundingRect.bottom - 10 + adjustTop;

    divMarkups.style.top = top + 'px';
    divMarkups.style.left = left + 'px';
    divMarkups.style.display = 'block';

    var height = divMarkups.clientHeight;
    var arrowUp =  top + height <= containerRect.top + container.clientHeight;

    if( arrowUp ) {
        divArrowFace.style.borderColor = 'transparent transparent ' + bgColor + ' transparent';
        divArrowBorder.style.borderColor = 'transparent transparent ' + borderColor + ' transparent';
    } else {
        top = boundingRect.top - 10 - height + adjustTop;
        arrowTop = boundingRect.top - 10 + adjustTop;
        divMarkups.style.top = top + 'px';

        divArrowFace.style.borderColor = bgColor + ' transparent transparent transparent';
        divArrowBorder.style.borderColor = borderColor + ' transparent transparent transparent';
    }

    divArrowFace.style.top =  arrowTop + ( arrowUp ? 1 : -1 )  + 'px';
    divArrowFace.style.left =  center - 10  + 'px';
    divArrowFace.style.display = 'block';

    divArrowBorder.style.top = arrowTop + 'px';
    divArrowBorder.style.left =  center - 10  + 'px';
    divArrowBorder.style.display = 'block';
}

/**
 * Show tool tip
 *
 * @param {Markup} inMarkup The markup to be shown with its tooltip
 * @param {Rectangle} boundingRect The bounding rectangle in screen coordinates
 */
export function showCommentTooltip( inMarkup, boundingRect ) {
    exports.showTooltip( viewerContainer, inMarkup, boundingRect, adjustBoundingRect );
}

/**
 * Clear the currently shown tooltip
 *
 * @param {string} type The type of tooltip to be cleared
 *
 */
export function clearTooltip( type ) {
    if( container && currentMarkup && ( !type || !currentMarkup.type  || type === currentMarkup.type ) ) {
        var ownerDoc = container.ownerDocument;
        var divMarkups = ownerDoc.getElementById( 'markupTooltip' );
        var divArrowFace = ownerDoc.getElementById( 'markupArrowFace' );
        var divArrowBorder = ownerDoc.getElementById( 'markupArrowBorder' );

        if( divMarkups && divArrowFace && divArrowBorder ) {
            divMarkups.style.display = 'none';
            divArrowFace.style.display = 'none';
            divArrowBorder.style.display = 'none';
        }
        currentMarkup = null;
    }
}

/**
 * Clear the currently shown tooltip
 * @param {string} type The type of tooltip to be cleared
 *
 */
export function setTextRoot(  ) {
    var reqText = document.getElementsByClassName( 'aw-requirements-xrtRichText' );
    var doc = frameWindow.document || frameWindow.contentDocument;
    textRoots[0] =  reqText.length > 0 ? reqText[ 0 ] : doc.body;
}


/**
 * Hide tooltip listener
 */
function hideTooltipListener() {
    exports.clearTooltip( 'text' );
}

//==================================================
// exported functions
//==================================================
let exports;
export let setViewerContainer = function( container, adjust ) {
    viewerContainer = container;
    adjustBoundingRect = adjust;
};
export let setSelectCallback = function( callback ) {
    selectCallback = callback;
};
export let setFindObjIdCallback = function( callback ) {
    findObjId = callback;
};

export let setIsBodyContentCallback = function( callback ) {
    isBodyContent = callback;
};

export let setMarkupSpanChangedCallback = function( callback ) {
    markupSpanChanged = callback;
};

export let setGetUserSelectionFromSingleClickCallback = function( callback ) {
    getUserSelectionFromSingleClick = callback;
};

export let resetFilterAnnotationsBackupMap = function( data ) {
    var allAnnotationFilterBackup = markupViewModel.getAllAnnotationFilterBackup();
    if( allAnnotationFilterBackup && allAnnotationFilterBackup.length > 0 && ( data.selectedTab.tabKey !== 'all' || data.sidebarFilterText.dbValue ) ) {
        setTimeout( function() {
            exports.filterCommentsTrackchanges( data, data.selectedTab.tabKey );    // Apply filters
        }, 500 );
    } else {
        markupViewModel.setAllAnnotationFilterBackup( [] ); // Clear map if filters not applied before
    }
};

export let filterCommentsTrackchangesOnTab = function( data ) {
    let previousSelectedTab = data.previousSelectedTab;
    if( data.selectedTab.tabKey === 'all' || data.selectedTab.tabKey === 'comments' || data.selectedTab.tabKey === 'trackchanges' ) {
        if( previousSelectedTab && previousSelectedTab !== data.selectedTab.tabKey ) {
            previousSelectedTab = data.selectedTab.tabKey;
            exports.filterCommentsTrackchanges( data, data.selectedTab.tabKey );
        } else {
            previousSelectedTab = data.selectedTab.tabKey;
        }
    }
    return previousSelectedTab;
};

export let filterCommentsTrackchanges = function( data, selectedTab ) {
    var inputFilterText = data.sidebarFilterText.dbValue;
    if( inputFilterText !== null || selectedTab ) {
        let filterText = inputFilterText;
        var editor = appCtxSvc.ctx.AWRequirementsEditor.editor;
        var annotationPlugin = editor.plugins.get( 'Annotations' );
        var annotationCollection = annotationPlugin.collection;
        var allAnnotations = annotationPlugin.collection._items;
        var allTrackChangesMap = markupViewModel.getTrackChangesMap();
        var allAnnotationFilterBackup = markupViewModel.getAllAnnotationFilterBackup();
        var allMakers = editor.model.markers._markers;

        if( !allAnnotationFilterBackup || allAnnotationFilterBackup.length === 0 ) {
            allAnnotationFilterBackup = _.clone( allAnnotations );
        } else {
            var newlyAddedAfterFilter = allAnnotations.filter( x => allAnnotationFilterBackup.indexOf( x ) === -1 );
            // Check if annotation created while Undo
            var undoAnnotations = [];
            for ( let i = 0; i < newlyAddedAfterFilter.length; i++ ) {
                var newAnnotation = newlyAddedAfterFilter[i];
                var newThreadElement = newAnnotation.view.element.querySelectorAll( '[data-thread-id]' );
                if( newThreadElement && newThreadElement.length > 0 ) {
                    for ( let j = 0; j < allAnnotationFilterBackup.length; j++ ) {
                        var backupAnnotation = allAnnotationFilterBackup[j];
                        var backupThreadElement = backupAnnotation.view.element.querySelectorAll( '[data-thread-id]' );
                        if( backupThreadElement && backupThreadElement.length > 0 && backupThreadElement[0].getAttribute( 'data-thread-id' ) === newThreadElement[0].getAttribute( 'data-thread-id' ) ) {
                            undoAnnotations.push( backupAnnotation );
                        }
                    }
                }
            }
            // Remove undo annotations from backup
            allAnnotationFilterBackup = allAnnotationFilterBackup.filter( x => undoAnnotations.indexOf( x ) === -1 );

            allAnnotationFilterBackup = allAnnotationFilterBackup.concat( newlyAddedAfterFilter );
        }

        editor.model.change( writer => {
            var deletedMarkups = [];

            for ( let index = 0; index < allAnnotationFilterBackup.length; index++ ) {
                var annotationItem = allAnnotationFilterBackup[index];
                var thread_id = annotationItem.view.element.querySelectorAll( '[data-thread-id]' );
                thread_id = thread_id.length > 0 ? thread_id[0].getAttribute( 'data-thread-id' ) : null;
                if( !thread_id ) {
                    continue;
                }
                // Check if marker for the same thread is exist, (if not exist, means Annotation/Marker got deleted)
                var isMarkerPresent = false;
                for ( let [ mId, mData ] of allMakers.entries() ) {
                    if( mId.indexOf( thread_id ) > -1 ) {
                        isMarkerPresent = true;
                        break;
                    }
                }
                if( !isMarkerPresent ) {
                    deletedMarkups.push( annotationItem );
                    continue;  // do not process if marker/annotation is deleted
                }

                if( selectedTab || data.selectedTab.tabKey !== 'all' ) {
                    if( data.selectedTab.tabKey === 'comments' && annotationItem.type !== 'comment' ) {
                        // Remove markers
                        if( allAnnotations.indexOf( annotationItem ) > -1 ) {
                            annotationCollection.remove( annotationItem );
                        }
                        continue;
                    }
                    if( data.selectedTab.tabKey === 'trackchanges' && annotationItem.type.indexOf( 'suggestion' ) < 0 ) {
                        // Remove markers
                        if( allAnnotations.indexOf( annotationItem ) > -1 ) {
                            annotationCollection.remove( annotationItem );
                        }
                        continue;
                    }
                }

                var threadAnnotations;
                if( annotationItem.type === 'comment' ) {
                    // If Comment
                    threadAnnotations = getMarkupFromThreadId( thread_id );
                } else if ( annotationItem.type.indexOf( 'suggestion' === 0 ) ) {
                    // If Track Change
                    threadAnnotations = allTrackChangesMap.get( thread_id );
                }

                if( threadAnnotations && ( filterText && !isShowMarker( threadAnnotations, filterText ) ) ) {
                    // Remove markers
                    if( allAnnotations.indexOf( annotationItem ) > -1 ) {
                        annotationCollection.remove( annotationItem );
                    }
                } else {
                    if( allAnnotations.indexOf( annotationItem ) < 0 ) {
                        annotationCollection.add( annotationItem );
                    }
                }
            }

            if( deletedMarkups.length > 0 ) {
                allAnnotationFilterBackup = allAnnotationFilterBackup.filter( x => !deletedMarkups.filter( y => y === x ).length );
            }
            markupViewModel.setAllAnnotationFilterBackup( allAnnotationFilterBackup );
        } );
    }

    if( annotationCollection && annotationCollection._itemMap.size === 0 ) {
        data.noResultFound = true;
    }else{
        data.noResultFound = false;
    }
};

/**
 *
 * @param {String} threadId - Thread id
 * @returns {Array} array of markus
 */
function getMarkupFromThreadId( threadId ) {
    var commentsMap = markupViewModel.getCommentsMap();
    var threaMmarkups = [];
    for ( let [ markupId, markup ] of commentsMap.entries() ) {
        if( markup.threadId === threadId ) {
            threaMmarkups.push( markup );
        }
    }
    return threaMmarkups;
}

/**
 *
 * @param {*} markerArray
 * @param {*} filterText
 */
function isShowMarker( markerArray, filterText ) {
    if( filterText === '' ) {
        return true;
    }
    if( !Array.isArray( markerArray ) ) {
        markerArray = [ markerArray ];
    }
    for ( let index = 0; index < markerArray.length; index++ ) {
        const marker = markerArray[index];
        // Check User
        if( marker.username && marker.username.indexOf( filterText ) > -1 ) {
            return true;
        }
        if( marker.authorId && marker.authorId.indexOf( filterText ) > -1 ) {
            return true;    // Replace authorId with username, add username in track changes
        }
        // Check Status
        if( marker.status && marker.status.indexOf( filterText ) > -1 ) {
            return true;
        } // No Status check for track changes
        // Check Date
        if( marker.createdAt && marker.createdAt.indexOf && marker.createdAt.indexOf( filterText ) > -1 || marker.created && marker.created.indexOf && marker.created.indexOf( filterText ) > -1 ) {
            return true;
        }
    }
}

export default exports = {
    setPageTextRoot,
    setViewerContainer,
    getUserSelection,
    clearUserSelection,
    recalcAllMarkupPositions,
    removeAllMarkupSpans,
    setSelectCallback,
    setFindObjIdCallback,
    setIsBodyContentCallback,
    setMarkupSpanChangedCallback,
    setMarkupEventListeners,
    setGetUserSelectionFromSingleClickCallback,
    showTooltip,
    clearTooltip,
    setTextRoot,
    getKey,
    doPostProcessing,
    removeMarkupSpan,
    showAll,
    resetFilterAnnotationsBackupMap,
    filterCommentsTrackchanges,
    filterCommentsTrackchangesOnTab,
    showCommentTooltip,
    getUserSelectionFromRange
};
