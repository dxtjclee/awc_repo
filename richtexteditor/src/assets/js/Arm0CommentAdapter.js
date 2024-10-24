//-------------------------------------old code  ---------------------------------------------------------------
//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@


/**
 * This Plugin is the adapter between ckeditor's comments plugin and AW.
 *
 * @module js/Arm0CommentAdapter
 */

import markupViewModel from 'js/Arm0MarkupViewModel';
import appCtxSvc from 'js/appCtxService';
import ckEditor5Utils from 'js/ckEditor5Utils';
import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

var isTooltipRendered = false;

export default class CommentsAdapter extends ckeditor5ServiceInstance.Plugin {
    constructor( editor ) {
        super( editor );
    }

    async init() {
        const commentsRepositoryPlugin = this.editor.plugins.get( 'CommentsRepository' );
        const editor = this.editor;
        const usersPlugin = editor.plugins.get( 'Users' );
        // Set the adapter to the `Comments#adapter` property.

        const view = editor.editing.view;
        const viewDocument = view.document;

        view.addObserver( MouseOverObserver );
        view.addObserver( MouseLeaveObserver );

        _subscribeDOMMouseEvents( editor, viewDocument );

        commentsRepositoryPlugin.adapter = {
            addComment: data => {
                console.log( 'Comment added', data );
                var threadId = data.threadId;
                var commentsMap = ckEditor5Utils.getCommentsMap();
                var trackChangesMap = markupViewModel.getTrackChangesMap();
                var currentComment;
                var hasThread = false;
                var markers  = editor.model.markers._markers;
                var markerName = null;
                var isTrackChangeComment = false;
                var parentComment = null;
                for( let [ key, value ] of markers.entries() ) {
                    if( key.indexOf( threadId ) >= 0 ) {
                        markerName = key;
                    }
                }
                if ( commentsMap.has( threadId ) ) {
                    hasThread = true;
                    var allComments = commentsMap.get( threadId );
                    allComments.forEach( element => {
                        if( element.status === 'open' ) {
                            element.status = 'replied';
                        }
                        if ( element.reqData.commentid && !element.reqData.parentCommentid ) {
                            parentComment = element;
                        }
                    } );
                    currentComment = markupViewModel.addReplyMarkup( parentComment );
                } else if( trackChangesMap.has( threadId ) ) {
                    var trackChange = trackChangesMap.get( threadId );
                    var replyCommentOnTrackChange = {};
                    let definedUser = usersPlugin.me;
                    if( definedUser ) {
                        replyCommentOnTrackChange.authorId = definedUser.id;
                    }
                    replyCommentOnTrackChange.objId = trackChange[0].objId;
                    replyCommentOnTrackChange.createdAt = new Date();
                    replyCommentOnTrackChange.id = data.commentId;
                    replyCommentOnTrackChange.commentId = data.commentId;
                    replyCommentOnTrackChange.threadId = threadId;
                    replyCommentOnTrackChange.content = data.content;
                    replyCommentOnTrackChange.isTrackChangeComment = true;
                    replyCommentOnTrackChange.isTrackChange = true;
                    replyCommentOnTrackChange.attributes = {};
                    trackChange.push( replyCommentOnTrackChange );
                    isTrackChangeComment = true;
                } else {
                    currentComment = markupViewModel.addNewMarkup( true );
                }
                if ( currentComment && !isTrackChangeComment ) {
                    currentComment.editMode = 'save';
                    currentComment.comment = data.content;
                    currentComment.content = data.content;
                    currentComment.threadId = data.threadId;
                    currentComment.ck5CommentId = data.commentId;
                    currentComment.authorId = currentComment.userid;
                    currentComment.createdAt = currentComment.date;
                    currentComment.markerName = markerName;

                    if( parentComment ) {
                        currentComment.status = parentComment.status;
                    }

                    if ( hasThread ) {
                        allComments.push( currentComment );
                    } else {
                        commentsMap.set( data.threadId, [ currentComment ] );
                    }

                    if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                        appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                    }else{
                        appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                    }
                } else if( isTrackChangeComment && replyCommentOnTrackChange ) {
                    if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                        appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                    }else{
                        appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                    }
                }
                eventBus.publish( 'ckeditor.enableNewCommentCommand', false );
                return Promise.resolve( {
                    createdAt: new Date()
                } );
            },

            updateComment: data => {
                console.log( 'Comment updated', data );
                var threadId = data.threadId;
                var ck5CommentId = data.commentId;
                var commentsMap = ckEditor5Utils.getCommentsMap();
                let trackChangesMap = markupViewModel.getTrackChangesMap();
                if ( commentsMap.has( threadId ) ) {
                    var allComments = commentsMap.get( threadId );
                    allComments.forEach( element => {
                        if ( element && element.threadId && element.threadId === threadId
                             && element.ck5CommentId === ck5CommentId ) {
                            element.comment = data.content;
                            element.content = data.content;
                        }
                    } );
                } else if( trackChangesMap.has( threadId ) ) {
                    let allComments = trackChangesMap.get( threadId );
                    allComments.forEach( element => {
                        if ( element && element.threadId && element.threadId === threadId
                             && element.commentId === ck5CommentId ) {
                            element.content = data.content;
                        }
                    } );
                }
                if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                    appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                }else{
                    appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                }

                return Promise.resolve();
            },

            removeComment: data => {
                console.log( 'Comment removed', data );
                var threadId = data.threadId;
                var ck5CommentId = data.commentId;
                var commentsMap = ckEditor5Utils.getCommentsMap();
                let trackChangesMap = markupViewModel.getTrackChangesMap();
                if ( commentsMap.has( threadId ) ) {
                    var allComments = commentsMap.get( threadId );
                    for ( var i = 0; i < allComments.length; i++ ) {
                        var element = allComments[i];
                        if( element && element.threadId && element.ck5CommentId && element.ck5CommentId === ck5CommentId ) {
                            allComments.splice( i, 1 );
                            var cmtId = element.reqData.commentid;
                            var cmtMap = markupViewModel.getCommentsMap();
                            if( cmtMap.has( cmtId ) ) {
                                cmtMap.delete( cmtId );
                            }
                            if( allComments.length === 1 ) {
                                allComments[0].status = 'open';
                            }
                            var deletedCmt = markupViewModel.getMarkupFromId( cmtId );
                            deletedCmt.deleted = true;
                            var parentCmtId = element.reqData.parentCommentid;
                            var cmtRpyMap = markupViewModel.getReplyCommentsMap();
                            if( cmtRpyMap.has( parentCmtId ) ) {
                                var currentComments = cmtRpyMap.get( parentCmtId );
                                if( currentComments && currentComments.length && currentComments.length === 1 ) {
                                    cmtRpyMap.delete( parentCmtId );
                                }else{
                                    for ( var j = 0; j < currentComments.length; j++ ) {
                                        var curEle = currentComments[j];
                                        if( curEle && curEle.ck5CommentId === ck5CommentId ) {
                                            currentComments.splice( j, 1 );
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if( trackChangesMap.has( threadId ) ) {
                    let allComments = trackChangesMap.get( threadId );
                    for ( let i = 0; i < allComments.length; i++ ) {
                        let element = allComments[i];
                        if ( element && element.threadId && element.threadId === threadId
                             && element.commentId === ck5CommentId ) {
                            allComments.splice( i, 1 );
                        }
                    }
                }
                if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                    appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                }else{
                    appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                }
                return Promise.resolve();
            },

            removeCommentThread: data => {
                console.log( 'Comment removed thread', data );
                return Promise.resolve();
            },

            addCommentThread: ( commentThreadData ) => {
                console.log( 'comment thread added', commentThreadData );
                return Promise.resolve();
            },

            getCommentThread: ( { threadId } ) => {
                console.log( 'Get comment thread', threadId );
                var trackChangesMap = markupViewModel.getTrackChangesMap();
                if ( trackChangesMap.has( threadId ) ) {
                    var suggestionThread = trackChangesMap.get( threadId );
                    var tempArray = [ ...suggestionThread ];
                    tempArray.splice( 0, 1 );
                    return Promise.resolve( {
                        threadId: threadId,
                        comments: tempArray
                    } );
                }
            }
        };
    }
}

class MouseOverObserver extends ckeditor5ServiceInstance.DomEventObserver {
    constructor( view ) {
        super( view );
        this.domEventType = 'mouseover';
    }

    onDomEvent( domEvent ) {
        this.fire( domEvent.type, domEvent );
    }
}

class MouseLeaveObserver extends ckeditor5ServiceInstance.DomEventObserver {
    constructor( view ) {
        super( view );
        this.domEventType = 'mouseout';
    }

    onDomEvent( domEvent ) {
        this.fire( domEvent.type, domEvent );
    }
}

/**
  * subscribe the mouse dom events over the view document
  *
  * @param {object} editor - the editor instance
  * @param {boolean} viewDocument - view document
  */
function _subscribeDOMMouseEvents( editor, viewDocument ) {
    // Event to display tooltip on mouse hover on a comment
    editor.listenTo( viewDocument, 'mouseover', ( evt, data ) => {
        if ( data.domTarget && data.domTarget.classList ) {
            let threadId = null;

            if( data.domTarget.classList.contains( 'ck-suggestion-marker' ) && data.domTarget.parentNode
             && data.domTarget.parentNode.classList.contains( 'ck-comment-marker' )
             && data.domTarget.parentNode.dataset && data.domTarget.parentNode.dataset.comment ) {
                threadId = data.domTarget.parentNode.dataset.comment;
            } else if( data.domTarget.classList.contains( 'ck-comment-marker' ) && data.domTarget.dataset && data.domTarget.dataset.comment ) {
                threadId = data.domTarget.dataset.comment;
            }

            if( threadId ) {
                var commentSpan = document.querySelector( `span[data-comment='${threadId}']` );
                if( commentSpan ) {
                    var _markupTextInstance = ckEditor5Utils.getMarkupTextInstance();
                    var inMarkup = [];
                    var commentsMap = ckEditor5Utils.getCommentsMap();
                    if( commentsMap.has( threadId ) ) {
                        var values = commentsMap.get( threadId )[0];
                        inMarkup.push( values );
                        _markupTextInstance.showCommentTooltip(  inMarkup, commentSpan.getBoundingClientRect() );
                        isTooltipRendered = true;
                    }
                }
            }
        }
    } );

    // Event to clear rendered tooltip
    editor.listenTo( viewDocument, 'mouseout', ( evt, data ) => {
        if( isTooltipRendered ) {
            var _markupTextInstance = ckEditor5Utils.getMarkupTextInstance();
            _markupTextInstance.clearTooltip( 'text' );
            isTooltipRendered = false;
        }
    } );
}
