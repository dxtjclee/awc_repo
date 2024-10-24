//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@


/**
 * This Plugin is the adapter between track changes plugin and AW.
 *
 * @module js/Arm0TrackChangeAdapter
 */

import markupViewModel from 'js/Arm0MarkupViewModel';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';


export default class TrackChangesAdapter extends ckeditor5ServiceInstance.Plugin {
    constructor( editor ) {
        super( editor );
    }

    init() {
        const usersPlugin = this.editor.plugins.get( 'Users' );
        const trackChangesPlugin = this.editor.plugins.get( 'TrackChanges' );
        const editor = this.editor;
        // Set the adapter to the `TrackChanges#adapter` property.
        trackChangesPlugin.adapter = {
            getSuggestion: suggestionId => {
                console.log( 'Getting suggestion', suggestionId );
                var trackChangesMap = markupViewModel.getTrackChangesMap();
                if( trackChangesMap.has( suggestionId ) ) {
                    var suggestion = trackChangesMap.get( suggestionId );
                    return Promise.resolve( suggestion[0] );
                }
            },

            addSuggestion: suggestionData => {
                console.log( 'Suggestion added', suggestionData );
                var trackChangesMap = markupViewModel.getTrackChangesMap();
                var threadId = suggestionData.id;

                let definedUser = usersPlugin.me;
                var authorId = definedUser.id;
                let objId = null;
                var usersMap = markupViewModel.getUsersMap();
                var usersArray = markupViewModel.getUsers();
                if( authorId ) {
                    if( usersMap.has( authorId ) ) {
                        var user = usersMap.get( authorId );
                        if( user ) {
                            suggestionData.authorId = user.userid;
                            suggestionData.displayname = user.displayname;
                            suggestionData.username = user.username;
                            suggestionData.initial = user.initial;
                        }
                    }else if( usersArray ) {
                        usersArray.forEach( element => {
                            if( element.userid === authorId ) {
                                suggestionData.authorId = element.userid;
                                suggestionData.displayname = element.displayname;
                                suggestionData.username = element.username;
                                suggestionData.initial = element.initial;
                                if( !usersMap.has( element.initial ) ) {
                                    usersMap.set( element.initial, element );
                                }
                            }
                        } );
                    }
                }
                //Find Requirement Node from the dom range for getting the Revision Id on the requirement
                objId = _getSelectedNodeUid( editor );
                if( objId ) {
                    suggestionData.objId = objId;
                }
                if( !trackChangesMap.has( threadId ) ) {
                    suggestionData.isTrackChange = true;
                    suggestionData.createdAt = new Date();
                    trackChangesMap.set( threadId, [ suggestionData ] );
                }

                return Promise.resolve( {
                    createdAt: new Date()
                } );
            },

            updateSuggestion: ( id, suggestionData ) => {
                console.log( 'Suggestion updated', id, suggestionData );
                var trackChangesMap = markupViewModel.getTrackChangesMap();

                // when track change accepted/rejected mark requirementBodyText isDirty attribute as true
                if( suggestionData && suggestionData.state
                    && ( suggestionData.state === 'rejected' || suggestionData.state === 'accepted' )
                    && trackChangesMap.has( id ) ) {
                    let reqNode = _getBodyTextElement( editor, trackChangesMap.get( id ) );
                    if( reqNode ) {
                        editor.model.change( writer => {
                            try {
                                var  definedUser = usersPlugin.me.id;
                                writer.setAttribute( 'isDirty', definedUser, reqNode );
                            } catch ( error ) {
                                console.log( error );
                            }
                        } );
                    }
                }

                if( suggestionData && suggestionData.state && ( suggestionData.state === 'rejected' || suggestionData.state === 'accepted' )
                 && trackChangesMap.has( id ) ) {
                    trackChangesMap.delete( id );
                }
                if( suggestionData && suggestionData.hasComments && suggestionData.hasComments === true
                    && trackChangesMap.has( id ) ) {
                    var trackChanges = trackChangesMap.get( id );
                    trackChanges[0].hasComments = suggestionData.hasComments;
                }

                return Promise.resolve();
            }
        };
    }
}

let _getSelectedNodeUid = function( editor ) {
    let revisionid;
    let reqModelEle;
    if( editor.model.document.selection && editor.model.document.selection.getFirstRange() && editor.model.document.selection.getFirstRange().start ) {
        reqModelEle = getRequirementModelElement( editor.model.document.selection.getFirstRange().start );
    }

    if( reqModelEle ) {
        revisionid = reqModelEle.getAttribute( 'revisionid' );
    } else if( editor.selectedRequirement && editor.selectedRequirement.length === 1 ) {
        revisionid = editor.selectedRequirement[0].getAttribute( 'revisionid' );
    }else if( editor.model.document.selection.getFirstRange().start.textNode ) {
        var textnode = editor.model.document.selection.getFirstRange().start.textNode;
        var node = getRequirementModelElement( textnode );
        if( node ) {
            revisionid = node.getAttribute( 'revisionid' );
        }
    }

    return revisionid;
};


function getRequirementModelElement( node ) {
    if( node.name === 'requirement' ) {
        return node;
    }
    if( node === null ) {
        return null;
    }
    return getRequirementModelElement( node.parent );
}


let _getBodyTextElement = function( editor, trackChnages ) {
    let node;

    if( trackChnages && trackChnages.length > 0 && trackChnages[0].objId ) {
        let reqElement = _getCKEditorModelElementByUID( editor, trackChnages[0].objId );
        if( reqElement ) {
            const range = editor.model.createRangeIn( reqElement );
            for ( const modelElement of range.getItems( { ignoreElementEnd: true } ) ) {
                if ( modelElement.name === 'requirementBodyText' ) {
                    return modelElement;
                }
            }
        }
    }

    return node;
};

let _getCKEditorModelElementByUID = function( editor, uid ) {
    let root = editor.model.document.getRoot();
    return Array.from( root._children._nodes ).find( node => node.getAttribute( 'revisionid' ) === uid );
};
