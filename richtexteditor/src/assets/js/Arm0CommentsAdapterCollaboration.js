//@<COPYRIGHT>@
//==================================================
//Copyright 2023.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@


/**
 * This Plugin is the adapter between ckeditor's comments plugin and AW.
 *
 * @module js/Arm0CommentsAdapterCollaboration
 */

import markupViewModel from 'js/Arm0MarkupViewModel';
import appCtxSvc from 'js/appCtxService';
import ckEditor5Utils from 'js/ckEditor5Utils';
import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import markupRequirement from 'js/MarkupRequirement';
import { destroyCkeditor } from './Arm0RequirementCkeditor5Service';
import ckeditorOperations from 'js/ckeditorOperations';
import logger from 'js/logger';
import rmCkeditorService from 'js/Arm0CkeditorService';

var isTooltipRendered = false;
var threadId;
var commentsMap;
var ck5CommentId;
var loginuserId;
var flag;


export default class CommentsAdapter extends ckeditor5ServiceInstance.Plugin {
    constructor( editor ) {
        super( editor );
    }

    async init() {
        const commentsRepositoryPlugin = this.editor.plugins.get( 'CommentsRepository' );
        const editor = this.editor;
        const usersPlugin = editor.plugins.get( 'Users' );
        const trackChangesPlugin = this.editor.plugins.get( 'TrackChanges' );
        // Set the adapter to the `Comments#adapter` property.

        const view = editor.editing.view;
        const viewDocument = view.document;

        view.addObserver( MouseOverObserver );
        view.addObserver( MouseLeaveObserver );

        _subscribeDOMMouseEvents( editor, viewDocument );
        const channelId = editor.config.get( 'collaboration.channelId' );


        commentsRepositoryPlugin.on( `addComment:${channelId}`, ( evt, data ) => {
            console.log( evt, data );
            loginuserId = editor.plugins.get( 'Users' )._myId;

            threadId = data.threadId;
            var currentStatusOfThread;
            var statusOfThread = editor.plugins.get( 'CommentsRepository' )._threadToController;

            commentsMap = ckeditorOperations.getCommentsMap();
            if( data.ck5CommentId ) {
                ck5CommentId = data.ck5CommentId;
            }else if( data.commentId ) {
                ck5CommentId = data.commentId;
            }


            var savedCommentsFromServer = rmCkeditorService.getInitialCommentsData();
            if( savedCommentsFromServer && savedCommentsFromServer.length > 0 ) {
                //  for( let [ key, value ] of trackChangesMap.entries() ) {
                //var value1= value;
                for( var i = 0; i < savedCommentsFromServer.length; i++ ) {
                    if( savedCommentsFromServer[i].ck5CommentId && ck5CommentId && ck5CommentId !== null && savedCommentsFromServer[i].ck5CommentId === ck5CommentId ) {
                        flag = true;
                        ck5CommentId = null;
                        break;
                    }
                }
                //     }
            }

            if( flag ) {
                flag = false;
                var isSaved = true;
                if( data && data.attributes && data.attributes.length > 0 ) {
                    data.attributes.push( isSaved );
                }
                return Promise.resolve( {

                } );
            }
            for( let [ key, value ] of statusOfThread.entries() ) {
                if( key.id === threadId ) {
                    if( key.comments._items &&  key.comments._items.attributes ) {
                        currentStatusOfThread = key.comments._items.attributes;
                    }else if( key.comments._items &&  key.comments._items.length > 0 && key.comments._items[0].attributes &&  key.comments._items[0].attributes.length > 0 ) {
                        if( key.comments._items[0].attributes[0] === 'open' ) {
                            currentStatusOfThread = 'Replied';
                        }else{
                            currentStatusOfThread = key.comments._items[0].attributes[0];
                        }
                    }else{
                        currentStatusOfThread = 'open';
                    }
                }
            }

            if( data && data.attributes && data.attributes.length > 0 ) {
                var status = data.attributes[0];
                if( status ) {
                    var eventData = {
                        threadId: threadId,
                        status: status
                    };
                    editor.fire( 'chnageStatusList', eventData );
                }
            }else{
                if( data  || currentStatusOfThread ) {
                    data.attributes = [ currentStatusOfThread ];
                }
            }


            if ( data.authorId === loginuserId ) {
                if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                    appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                } else {
                    appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                }
            }


            return Promise.resolve( {
                createdAt: new Date()
            } );
        } );


        commentsRepositoryPlugin.on( `updateComment:${channelId}`, ( evt, data ) => {
            console.log( evt, data );
            threadId = data.threadId;
            if( !data.authorId && !data.attributes ) {
                var  commentsThreads = commentsRepositoryPlugin.getCommentThread( threadId ).comments._items[0];
                if( commentsThreads && commentsThreads.attributes  ) {
                    if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                        appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                    } else {
                        appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                    }
                }
            }
            if ( data.authorId === loginuserId ) {
                if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                    appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                } else {
                    appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                }
            }


            return Promise.resolve();
        } );

        commentsRepositoryPlugin.on( `removeComment:${channelId}`, ( evt, data ) => {
            console.log( evt, data );
            var threadId = data.threadId;
            ck5CommentId = data.commentId;

            if( !data.authorId && !data.attributes ) {
                var  commentsThreads = commentsRepositoryPlugin.getCommentThread( threadId ).comments._items[0];
                if( commentsThreads && commentsThreads.attributes  ) {
                    if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                        appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                    } else {
                        appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                    }
                }
            }
            if ( data.authorId && data.authorId === loginuserId ) {
                if ( appCtxSvc.ctx.requirementEditorContentChanged ) {
                    appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );
                } else {
                    appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                }
            }

            return Promise.resolve();
        } );

        commentsRepositoryPlugin.on( `removeCommentThread:${channelId}`, ( evt, data ) => {
            console.log( evt, data );
            return Promise.resolve();
        } );

        commentsRepositoryPlugin.on( `addCommentThread:${channelId}`, ( evt, data ) => {
            console.log( evt, data );
            return Promise.resolve();
        } );
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

            if ( data.domTarget.classList.contains( 'ck-suggestion-marker' ) && data.domTarget.parentNode
                 && data.domTarget.parentNode.classList.contains( 'ck-comment-marker' )
                 && data.domTarget.parentNode.dataset && data.domTarget.parentNode.dataset.comment ) {
                threadId = data.domTarget.parentNode.dataset.comment;
            } else if ( data.domTarget.classList.contains( 'ck-comment-marker' ) && data.domTarget.dataset && data.domTarget.dataset.comment ) {
                threadId = data.domTarget.dataset.comment;
            }

            if ( threadId ) {
                var commentSpan = document.querySelector( `span[data-comment='${threadId}']` );
                if ( commentSpan ) {
                    var _markupTextInstance = ckEditor5Utils.getMarkupTextInstance();
                    var inMarkup = [];
                    var values;
                    values = ckeditorOperations.setTooltipInColloboration( threadId )[0];

                    inMarkup.push( values );
                    inMarkup.push( threadId );
                    _markupTextInstance.showCommentTooltip( inMarkup, commentSpan.getBoundingClientRect() );
                    isTooltipRendered = true;
                    // }
                }
            }
        }
    } );

    // Event to clear rendered tooltip
    editor.listenTo( viewDocument, 'mouseout', ( evt, data ) => {
        if ( isTooltipRendered ) {
            var _markupTextInstance = ckEditor5Utils.getMarkupTextInstance();
            _markupTextInstance.clearTooltip( 'text' );
            isTooltipRendered = false;
        }
    } );
}


/**Check whether comment is already present in commentmap. */

function _isCommentAlreadyAddedInMap( commentMap, commentId, threadId ) {
    for( let [ key, value ] of commentMap.entries() ) {
        for( var i = 0; i < value.length; i++ ) {
            if( commentId === value[i].ck5CommentId || threadId === key ) {
                return true;
            }
        }
    }
}


