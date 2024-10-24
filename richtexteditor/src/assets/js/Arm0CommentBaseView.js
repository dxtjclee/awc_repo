// Copyright (c) 2021 Siemens

/**
 * This Plugin is for enhancing the OOTB comment view to AW Standard.
 *
 * @module js/Arm0CommentBaseView
 */
import ckeditorOperations from 'js/ckeditorOperations';
import ckEditor5Utils from 'js/ckEditor5Utils';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import localeService from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import rmCkeditorService from 'js/Arm0CkeditorService';

export default class NewCommentBaseView extends ckeditor5ServiceInstance.CommentThreadView {
    constructor( ...args ) {
        super( ...args );
        this.getTemplate();
    }
    getTemplate() {
        const templateDefinition = super.getTemplate();

        templateDefinition.children.unshift(
            {
                tag: 'div',
                attributes: {
                    class: 'ck-thread-top-bar'
                },

                children: [
                    this._createCommentStatusListView()
                ]
            }
        );

        return templateDefinition;
    }
    _createCommentStatusListView() {
        const dropdownView = new ckeditor5ServiceInstance.createDropdown( this.locale );
        // Get locale specific file and properties
        var resource = 'RichTextEditorCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );
        var openStr = localTextBundle.open;
        var repliedStr = localTextBundle.replied;
        var resolvedStr = localTextBundle.resolved;
        var rejectedStr = localTextBundle.rejected;
        var reopenedStr = localTextBundle.reopened;

        const threadId = this.commentsListView._model.id;
        var ckEditor = ckeditorOperations.getCKEditorInstance( );
        var allCommentsInThread = ckEditor.plugins._plugins.get( 'CommentsRepository' ).getCommentThread( threadId ).comments._items;

        var parentComment = null;
        var status;
        // Bind Dropdown to comments list
        _bindDropdownWidget( dropdownView, this.commentsListView );
        var commentsMap = ckeditorOperations.getCommentsMap();
        if ( commentsMap.has( threadId ) ) {
            parentComment = commentsMap.get( threadId )[0];
            status = ckeditorOperations.getStatusComments( parentComment );
        }
        if( ckEditor.config.get( 'collaboration' ) ) {
            if( allCommentsInThread && allCommentsInThread.length > 0 ) {
                var length = allCommentsInThread.length - 1;
                status = allCommentsInThread[length].attributes[0];
            }
        }

        if ( status ) {
            switch ( status ) {
                case 'open':
                    status = openStr;
                    break;
                case 'replied':
                    status = repliedStr;
                    break;
                case 'resolved':
                    status = resolvedStr;
                    break;
                case 'rejected':
                    status = rejectedStr;
                    break;
                case 'reopened':
                    status = reopenedStr;
                    break;
                default:
                 // No action to perform
            }
            dropdownView.buttonView.set( {
                label: status,
                withText: true
            } );
        }else {
            dropdownView.buttonView.set( {
                label: openStr,
                withText: true
            } );
        }
        // Bind thread state to comments list
        _bindThreadState( dropdownView, this.commentsListView, openStr, repliedStr, threadId );

        const items = new ckeditor5ServiceInstance.Collection();
        items.add( {
            type: 'button',
            model: new ckeditor5ServiceInstance.Model( {
                id: 'replied',
                withText: true,
                label: repliedStr
            } )
        } );
        items.add( {
            type: 'button',
            model: new ckeditor5ServiceInstance.Model( {
                id: 'resolved',
                withText: true,
                label: resolvedStr
            } )
        } );
        items.add( {
            type: 'button',
            model: new ckeditor5ServiceInstance.Model( {
                id: 'rejected',
                withText: true,
                label: rejectedStr
            } )
        } );
        items.add( {
            type: 'button',
            model: new ckeditor5ServiceInstance.Model( {
                id: 'reopened',
                withText: true,
                label: reopenedStr
            } )
        } );

        ckeditor5ServiceInstance.addListToDropdown( dropdownView, items );

        dropdownView.on( 'execute', ( eventInfo ) => {
            const { id, label } = eventInfo.source;
            if( id && label ) {
                eventInfo.path[2].buttonView.set( 'id', id );
                eventInfo.path[2].buttonView.set( 'label', label );
                var clickedElement = eventInfo.source.element;
                var threadId = locateThreadId( clickedElement );

                //update the comments json in memory
                var commentsMap = ckEditor5Utils.getCommentsMap();
                _updateCommentStatusForThread( commentsMap, threadId, id );

                // Enable the Save Edits button if not already
                if( !appCtxSvc.ctx.requirementEditorContentChanged ) {
                    appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
                }
            }
        } );

        return dropdownView;
    }
}

/**
  * Gets the CKEDITOR.dom.element closest to the 'node'
  *
  * @param {CKEDITOR.dom.node}
  *            node Start the search from this node.
  * @returns {String} ThreadId or
  *          `null` if not found.
  */
function locateThreadId( node ) {
    if( !node ) {
        return null;
    }
    if( node.classList && node.classList.contains( 'ck-thread' ) ) {
        return node.getAttribute( 'data-thread-id' );
    }

    return locateThreadId( node.parentNode );
}

/**
  * Bind the button enable state with the comment list view
  *
  * @param {CKEDITOR.dom.node} dropdownView - dropdownButton node
  * @param {CKEDITOR.dom.node} commentsListView - comment list view node
  */
function _bindDropdownWidget( dropdownView, commentsListView ) {
    // Enable the dropdown's button when there is more than 1 comment in a comment thread
    dropdownView.bind( 'isEnabled' ).to( commentsListView, 'length', ( length ) => {
        if( length > 1 ) {
            return true;
        }
        return false;
    } );
}

/**
  * Changes thread state on the fly
  *
  * @param {CKEDITOR.dom.node} dropdownView - dropdownButton node
  * @param {CKEDITOR.dom.node} commentsListView - comment list view node
  * @param {String} openStr - open string
  * @param {String} repliedStr - reply string
  * @param {String} threadId - thread id
  */
function _bindThreadState( dropdownView, commentsListView, openStr, repliedStr, threadId ) {
    const curThreadId = threadId;
    var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
    var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
    var commentsMap = ckEditor5Utils.getCommentsMap();
    var s1;
    dropdownView.on( 'execute', evt => {
        const action = evt.source.id;

        var commentsThreads = editor.plugins._plugins.get( 'CommentsRepository' )._threadToController;
        for( let [ key, value ] of commentsThreads.entries() ) {
            if( key.id === curThreadId ) {
                s1 = key.comments._items;
                for( var i = 0; i < s1.length; i++ ) {
                    s1.attributes = action;
                }
            }
        }
    } );


    dropdownView.buttonView.bind( 'label' ).to( commentsListView, 'length', ( length ) => {
        editor.once( 'chnageStatusList', function( evt, status ) {
            //evt.stop();
            //evt.off();
            _updateCommentStatusForThreadForNewUser( dropdownView, commentsMap, status.threadId, status.status );
        } );
        if( length > 1 ) {
            if( length === 2 && dropdownView.buttonView.label === openStr ) {
                _updateCommentStatusForThread( commentsMap, curThreadId, repliedStr.toLowerCase() );
                return repliedStr;
            }else if( length >= 2 ) {
                _updateCommentStatusForThread( commentsMap, curThreadId, dropdownView.buttonView.label.toLowerCase() );
                return dropdownView.buttonView.label;
            }
        }else if( length === 1 && dropdownView.buttonView.label !== openStr ) {
            _updateCommentStatusForThread( commentsMap, curThreadId, openStr.toLowerCase() );
            return openStr;
        }
        return openStr;
    } );
}

/**
  * Update the comments json in commentsMap
  *
  * @param {CKEDITOR.dom.node} commentsMap - dropdownButton node
  * @param {CKEDITOR.dom.node} threadId - comment list view node
  * @param {CKEDITOR.dom.node} id - comment list view node
  */
function _updateCommentStatusForThread( commentsMap, threadId, id ) {
    if ( threadId && commentsMap.has( threadId ) ) {
        var allComments = commentsMap.get( threadId );
        allComments.forEach( element => {
            element.status = id;
        } );
    }
}
/**Update the list of status comments
  *
  */
function _updateCommentStatusForThreadForNewUser( dropdownView, commentsMap, threadId, status ) {
    dropdownView.buttonView.label = status.charAt( 0 ).toUpperCase() + status.slice( 1 );
    _updateCommentStatusForThread( commentsMap, threadId, status.toLowerCase() );
}


