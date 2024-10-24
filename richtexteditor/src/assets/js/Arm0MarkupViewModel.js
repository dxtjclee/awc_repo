// Copyright (c) 2022 Siemens

/**
 * Defines the markup view model for highlighting or drawing markups on the viewer panel
 *
 * @module js/Arm0MarkupViewModel
 */
import markupData from 'js/MarkupData';
import markupThread from 'js/MarkupThread';
import markupCanvas from 'js/MarkupCanvas';
import appCtxSvc from 'js/appCtxService';
import markupRequirement from 'js/MarkupRequirement';
import ckeditorOperations from 'js/ckeditorOperations';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import { getBaseUrlPath } from 'app';
import awIconService from 'js/awIconService';
import Arm0Ck5CommentsHandler from 'js/Arm0Ck5CommentsHandler';

//==================================================
// private variables
//==================================================
/** All markups */
var markups = markupData.markups;
/** All users */
var users = markupData.users;
/** The list of markups to be shown */
var markupList = [];
/** The list of stamps to be shown */
var stampList = [];
/** The version */
var version = '';
/** The message */
var message = '';
/** The role */
var role = '';
/** The sort by */
var sortBy = 'all';
/** The filter text */
var filter = '';
/** The list of filters */
var filterList = [];
/** The login user id */
var loginUserId = '';
/** The login user name */
var loginUserName = '';

var usersMap = new Map();

var commentsMap = new Map();

var replyCommentsMap = new Map();

var trackChangesMap = new Map();

var finalTrackChangesMap = new Map();

var allAnnotationFilterBackup = [];

export var statusList = [ 'open', 'replied', 'resolved', 'rejected', 'reopened' ];

//==================================================
// public functions
//==================================================
/**
  * Set the login user
  *
  * @param {String} id the login user id
  * @param {String} name the login user name
  */
export function setLoginUser( id, name ) {
    loginUserId = id;
    loginUserName = name;
}

/**
  * Clear the markup list
  */
export function clearMarkupList( isCk5, data ) {
    for( var i = 0; i < markups.length; i++ ) {
        markups[ i ].visible = false;
    }
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if( !isCk5 && ( data.subPanelContext.activeTab && data.subPanelContext.activeTab.pageId || data.subPanelContext.pageContext && data.subPanelContext.pageContext.secondaryActiveTabId ) !== (
        'tc_xrt_summary_table' || widePanelCtx ) ) {
        // remove all markups
        markupRequirement.showAll( 2 );
    }
    markupList.length = 0;
}

/**
  * Process the markups
  *
  * @param {String} ver the version
  * @param {String} mes the message
  * @param {String} json the markups in json
  */
export function processMarkups( ver, mes, json ) {
    version = ver;
    message = mes;
    role = mes ? mes.split( ' ' )[ 0 ] : '';

    var markupJson = [];
    var markups = JSON.parse( json );

    //Don't add track changes in markup json
    for ( let index = 0; index < markups.length; index++ ) {
        const element = markups[index];
        if( !element.isTrackChange ) {
            markupJson.push( element );
        }
    }
    var comments = JSON.stringify( markupJson );

    if( message.indexOf( 'up_to_date' ) < 0 ) {
        if( message.indexOf( 'append' ) < 0 ) {
            markupData.clearMarkups();
            markupData.clearUsers();
            markupThread.clear();
            markupData.addUser( loginUserId, loginUserName, loginUserId );
        }

        var start = markups.length;
        markupData.parseMarkups( comments );
        markupData.addUsersFromMarkups();

        var end = markups.length;
        markupThread.addToThreads( markups, start, end );
    }
    sortBy = 'all';
    filterList = [];
}

/**
  * Update the markup list
  *
  * @return {Markup} the updated markup list
  */
export function updateMarkupList( isCk5, data ) {
    clearMarkupList( isCk5, data );
    // Show all markups that are visible
    for( var i = 0; i < markups.length; i++ ) {
        var markup = markups[ i ];
        markup.visible = markup.editMode || !markup.deleted && filterMarkup( markup );
        if( markup.visible ) {
            markupList.push( markup );
        }
    }
    var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if( reqMarkupCtx && reqMarkupCtx.viewerType === 'aw-requirement-ckeditor' ) {
        var flagForComments;
        flagForComments = markupList.length <= 0;
        reqMarkupCtx.flagForComments = flagForComments;
        appCtxSvc.updateCtx( 'reqMarkupCtx', reqMarkupCtx );
    }
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if( !isCk5 && ( data.subPanelContext.activeTab && data.subPanelContext.activeTab.pageId || data.subPanelContext.pageContext && data.subPanelContext.pageContext.secondaryActiveTabId ) !== (
        'tc_xrt_summary_table' || widePanelCtx ) ) {
        // show all visible markups
        markupRequirement.showAll();
    }
    return sortMarkupList();
}

/**
  * Set the current sort by choice
  *
  * @param {String} inSortBy the sort by "all", "user", "date", or "status"
  *
  * @return {boolean} true if set to a different value
  */
export function setSortBy( inSortBy ) {
    if( inSortBy && inSortBy !== sortBy ) {
        sortBy = inSortBy;
        return true;
    }
    return false;
}

/**
  * Sort the markup list
  *
  * @return {Markup} the sorted markup list
  */
export function sortMarkupList() {
    clearGroups();
    markupList.sort( function( markup0, markup1 ) {
        if( markup0 === markup1 ) {
            return 0;
        }

        if( sortBy === 'status' ) {
            var statusOrder = ckeditorOperations.compareStatusComments( markup0, markup1 );
            if( statusOrder !== 0 ) {
                return statusOrder;
            }
        }

        if( sortBy === 'status' || sortBy === 'page' || sortBy === 'all' ) {
            var posOrder = markupThread.comparePosition( markup0, markup1 );
            if( posOrder !== 0 ) {
                return posOrder;
            }

            return markupThread.compareDate( markup0, markup1 );
        }

        if( sortBy === 'user' ) {
            var nameOrder = compareUser( markup0, markup1 );
            if( nameOrder !== 0 ) {
                return nameOrder;
            }
        }

        if( sortBy === 'user' || sortBy === 'date' ) {
            return markupThread.compareDate( markup1, markup0 );
        }

        return 0;
    } );

    insertGroups();
    return markupList;
}

/**
  * Toggle the group between expanded and collapsed
  *
  * @param {Markup} group to be toggled
  * @param {boolean} inStamps optional true for stamps, otherwise for markups
  * @return {Markup} the updated markup or stamp list
  */
export function toggleGroup( group, data, inStamps ) {
    var list = inStamps ? stampList : markupList;
    //var index = list.indexOf( group );
    var index = -1;
    for( var i = 0; i < list.length; i++ ) {
        if( list[ i ].groupName && list[ i ].groupName === group.groupName ) {
            index = i;
            break;
        }
    }

    group.expanded = !group.expanded;
    if( group.expanded ) {
        for( var i = 0; i < group.list.length; i++ ) {
            var markup = group.list[ i ];
            markup.visible = true;
            list.splice( index + i + 1, 0, markup );
        }
    } else {
        if( index >= 0 && index + group.list.length < list.length ) {
            var removed = list.splice( index + 1, group.list.length );
            for( var j = 0; j < removed.length; j++ ) {
                removed[ j ].visible = false;
            }
        }
    }
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if( !inStamps && data.subPanelContext.pageContext.secondaryActiveTabId !== 'tc_xrt_summary_table' || widePanelCtx ) {
        markupRequirement.showAll();
    }

    return list;
}

/**
  * Generate and return the random alphanumeric ID for the newly created markup
  */
export function getReqData( markup ) {
    var commentId = 'RM::Markup::' + Math.random().toString( 36 ).substr( 2, 10 );

    var reqData = {};
    reqData.commentid = commentId;

    var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if( reqMarkupCtx && reqMarkupCtx.viewerType === 'aw-requirement-ckeditor' ) {
        if( reqMarkupCtx.markupHeader ) {
            reqData.markupHeader = reqMarkupCtx.markupHeader;
        } else {
            reqData.markupHeader = markup.reqData.markupHeader;
        }
    }

    return reqData;
}


/**
  * Add new markup for the collaboration
  *
  * @return {Markup} the newly added markup
  */
export function addNewMarkup( ) {
    var userSelection = markupRequirement.getUserSelection();
    if( !userSelection || !userSelection.reference && !userSelection.geometry ) {
        return null;
    }
    var type = userSelection.geometry ? '2d' : 'text';
    var newMarkup = markupData.addMarkup( loginUserId, loginUserName, loginUserId, userSelection.start,
        userSelection.end, type );

    newMarkup.reference = userSelection.reference;
    newMarkup.geometry = userSelection.geometry;
    newMarkup.objId = userSelection.objId;
    newMarkup.viewParam = markupRequirement.getViewParam();
    if( users.length > 0 ) {
        newMarkup.userObj = users[ 0 ].userObj;
    }
    if( newMarkup.objId ) {
        newMarkup.reqData = getReqData();
    }
    newMarkup.editMode = 'new';
    putComment( newMarkup );
    ckeditorOperations.renderComment( newMarkup, markupList, markups );
    return newMarkup;
}
/**
  * Maintain comments data in memory
  *
  */
export function populateMarkupList( allMarkups, json, trackChanges, isAdditionalMarkups ) {
    markupList = _.cloneDeep( allMarkups );
    markupData.parseMarkups( json );
    markupData.addUsersFromMarkups();
    users = markupData.users;
    for( var i = 0; i < users.length; i++ ) {
        var faintColor = users[ i ].color;
        var darkColor = faintColor.replace( '0.125', '0.25' );
        users[ i ].darkColor = darkColor;
        if( !usersMap.has( users[ i ].initial ) ) {
            usersMap.set( users[ i ].initial, users[ i ] );
        }
    }
    addUsersFromTrackChanges( trackChanges );
    createCommentsMap( allMarkups );
    createReplyCommentsMap( allMarkups );
    if( isAdditionalMarkups && markups.length > 0 ) {
        // Merge with existing, if additional markups
        allMarkups.forEach( markup => {
            markups = _removeMarkupIfExist( markups, markup );
            markups.push( _.cloneDeep( markup ) );
        } );
    } else {
        markups = _.cloneDeep( allMarkups );
    }
    createTrackChangesMap( trackChanges );
    createTemporaryUserData( users );

    var commentContext = appCtxSvc.getCtx( 'commentContext' );
    if( commentContext ) {
        var result = _checkNewUsers( users );
        if( !result.userInfoUpdated ) {
            exports.getUserDetailsFromServer( result.newUsers );
        }
    }
}

/** */
function _removeMarkupIfExist( markups, markupToCheck ) {
    for( var i = markups.length - 1; i >= 0; i-- ) {
        if( markups[ i ].reqData.commentid === markupToCheck.reqData.commentid ) {
            markups.splice( i, 1 );
        }
    }
    return markups;
}

/**
  * Method to get User Details From Server
  * @param {Array} userNames the users array
  */
export async function getUserDetailsFromServer( userId ) {
    if( !userId ) {
        userId = [ users[ 0 ].username ];
    }
    var inputData = {
        className: 'User',
        clientId: 'AW_THIN_CLIENT',
        attrAndValues: [
            { attrName: 'user_id', values: userId }
        ]
    };
    var policy = {
        types: [ {
            name: 'User',
            properties: [
                { name: 'user_id' },
                { name: 'user_name' },
                { name: 'awp0ThumbnailImageTicket' }
            ]
        } ]
    };
    var deferred = AwPromiseService.instance.defer();
    soaSvc.post( 'Internal-Query-2008-06-Finder',
        'findObjectsByClassAndAttributes', {
            input: inputData
        }, policy ).then( function( response ) {
        exports.setUserObjOnUsers( response );
        deferred.resolve( response );
    } )
        .catch( function( error ) {
            deferred.reject( error );
        } );
}

/**
  * populate user object in the comment object
  *
  * @param {Markup} response - the user id of the user
  *
  */
export function setUserObjOnUsers( response ) {
    var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
    var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
    if( editor && response && response.result ) {
        const usersPlugin = editor.plugins.get( 'Users' );
        const appData = {};
        appData.users = [];
        appData.userId = '';
        response.result.forEach( function( mo ) {
            var userObj = cdm.getObject( mo.uid );
            var userId = userObj.props.user_id.dbValues[ 0 ];
            if( userObj && userId ) {
                users.forEach(
                    function( user ) {
                        var userObject = {};
                        if( user.userid === userId ) {
                            user.userObj = userObj;
                            //Create User data for user plugin
                            userObject.id = user.userid;
                            userObject.name = user.username;
                            var thumbnailUrl = awIconService.getThumbnailFileUrl( userObj );
                            var typeIconURL = awIconService.getTypeIconFileUrl( userObj );

                            user.typeIconURL = typeIconURL;
                            userObject.avatar = typeIconURL;
                            if( thumbnailUrl ) {
                                user.hasThumbnail = true;
                                user.thumbnailURL = thumbnailUrl;
                                userObject.avatar = thumbnailUrl;
                            }
                            appData.users.push( userObject );
                        }
                    }
                );
                markups.forEach(
                    function( markup ) {
                        if( markup.userid === userId ) {
                            markup.userObj = userObj;
                        }
                    }
                );
            }
        } );

        users.forEach( function( user ) {
            var userObject = {};
            if( !user.userObj ) {
                userObject.id = user.userid;
                userObject.name = user.username;
                userObject.avatar = getBaseUrlPath() + '/image/typePerson48.svg';
                user.userObj = userObject;
                appData.users.push( userObject );

                markups.forEach(
                    function( markup ) {
                        if( markup.userid === userObject.id ) {
                            markup.userObj = userObject;
                        }
                    }
                );
            }
        } );

        try {
            //Load the users data.
            for( const user of appData.users ) {
                let currentUser = usersPlugin.getUser( user.id );
                if( currentUser ) {
                    usersPlugin.users.remove( user.id );
                    usersPlugin.addUser( user );
                } else if( !currentUser ) {
                    usersPlugin.addUser( user );
                }
            }
            var session = appCtxSvc.getCtx( 'userSession' );
            if( session ) {
                appData.userId = session.props.user_id.dbValues[ 0 ];
                //Set the current user.
                if( appData.userId ) {
                    let definedUser = usersPlugin.me;
                    if( !definedUser ) {
                        usersPlugin.defineMe( appData.userId );
                    }
                }
            }
        } catch ( error ) {
            // Failure in updating the user infomation.
        }
    }
}

/**
  * Method to create map of comments
  * @param {Array} trackChanges the track changes array
  */
function addUsersFromTrackChanges( trackChanges ) {
    trackChanges.forEach(
        function( trackChange ) {
            if( !usersMap.has( trackChange.initial ) ) {
                var user = markupData.addUser( trackChange.authorId, trackChange.username, trackChange.initial );
                if( user ) {
                    usersMap.set( trackChange.initial, user );
                }
            }
        }
    );
}

/**
  * Method to create map of comments
  * @param {Array} allMarkups the markups array
  */
function createCommentsMap( allMarkups ) {
    for( var i = 0; i < allMarkups.length; i++ ) {
        var markup = allMarkups[ i ];
        commentsMap.set( markup.reqData.commentid, markup );
    }
}

/**
  * Method to create map of reply comments
  * @param {Array} allMarkups the markups array
  */
function createReplyCommentsMap( allMarkups ) {
    for( var i = 0; i < allMarkups.length; i++ ) {
        var markup = allMarkups[ i ];
        insertReplyComment( markup );
    }
}

/**
  * Method to create map of track changes
  * @param {Array} trackChanges the track changes
  */
function createTrackChangesMap( trackChanges ) {
    for( var i = 0; i < trackChanges.length; i++ ) {
        var sameThreadComments = [];
        var element = trackChanges[ i ];
        var threadId = element.id;
        if( element && element.hasComments ) {
            sameThreadComments.push( element );
            for( var j = 0; j < trackChanges.length; j++ ) {
                if( trackChanges[ j ].threadId === threadId ) {
                    sameThreadComments.push( trackChanges[ j ] );
                }
            }
            if( !trackChangesMap.has( threadId ) ) {
                trackChangesMap.set( threadId, [ ...sameThreadComments ] );
            }
        } else if( element && !element.hasComments && element.type && !element.threadId &&
             !trackChangesMap.has( threadId ) ) {
            trackChangesMap.set( threadId, [ element ] );
        }
    }
}

/**
  * Method to create map of track changes
  * @param {Array} users the users array
  */
function createTemporaryUserData( users ) {
    try {
        var editorCtx = appCtxSvc.getCtx( 'AWRequirementsEditor' );
        if( editorCtx && editorCtx.id ) {
            var editor = ckeditorOperations.getCKEditorInstance( editorCtx.id, appCtxSvc.ctx );
            const appData = {};
            appData.users = [];
            appData.userId = '';
            const usersPlugin = editor.plugins.get( 'Users' );

            users.forEach( user => {
                var userObj = {};
                userObj.id = user.userid;
                userObj.name = user.username;
                userObj.avatar = getBaseUrlPath() + '/image/typePerson48.svg';
                appData.users.push( userObj );
            } );
            for( const user of appData.users ) {
                let currentUser = usersPlugin.getUser( user.id );
                if( !currentUser ) {
                    usersPlugin.addUser( user );
                }
            }
            var session = appCtxSvc.getCtx( 'userSession' );
            if( session ) {
                appData.userId = session.props.user_id.dbValues[ 0 ];
                if( appData.userId ) {
                    let definedUser = usersPlugin.me;
                    if( !definedUser ) {
                        usersPlugin.defineMe( appData.userId );
                    }
                }
            }
        }
    } catch ( error ) {
        // Setting user information failed.
    }
}

/**
  * Method to create map of comments
  * @param {Array} users the markups array
  */
function _checkNewUsers( users ) {
    var userInfoUpdated = true;
    var newUsers = [];
    users.forEach( element => {
        if( element && !element.userObj ) {
            userInfoUpdated = false;
            newUsers.push( element.userid );
        } else if( element && element.userObj && element.userObj.uid && cdm.getObject( element.userObj.uid ) ) {
            var userObj = cdm.getObject( element.userObj.uid );
            if( !userObj ) {
                userInfoUpdated = false;
                newUsers.push( element.userid );
            }
        }
    } );
    return {
        userInfoUpdated: userInfoUpdated,
        newUsers: newUsers
    };
}

/**
  * Method to create map of comments
  * @param {Array} allMarkups the markups array
  */
export function getComment( id ) {
    if( commentsMap.has( id ) ) {
        return commentsMap.get( id );
    }
    return null;
}

/**
  * Method to create map of comments
  * @param {JSON} markup the markup to add in map
  */
export function putComment( markup ) {
    if( !commentsMap.has( markup.reqData.commentid ) ) {
        commentsMap.set( markup.reqData.commentid, markup );
    }
}

/**
  * Method to create map of reply comments
  * @param {JSON} markup the markup to add in map
  */
export function insertReplyComment( markup ) {
    if( markup && markup.reqData && markup.reqData.parentCommentid && markup.reqData.parentCommentid !== '' ) {
        if( replyCommentsMap.has( markup.reqData.parentCommentid ) ) {
            var currentCommentsList = replyCommentsMap.get( markup.reqData.parentCommentid );
            var value = isReplyExist( currentCommentsList, markup.reqData.commentid );
            if( !value ) {
                currentCommentsList.push( markup );
                replyCommentsMap.set( markup.reqData.parentCommentid, currentCommentsList );
            }
        } else {
            replyCommentsMap.set( markup.reqData.parentCommentid, [ markup ] );
        }
    }
}

/**
  * Method to get all reply comments against parentCommentid
  * @param {JSON} markup - parentCommentid
  * @param {Array} finalMarkupsList - finalMarkupsList
  */
export function getReplyComments( markup, finalMarkupsList ) {
    if( replyCommentsMap.has( markup.reqData.commentid ) ) {
        var allReplyComments = replyCommentsMap.get( markup.reqData.commentid );
        for( const comment of allReplyComments ) {
            comment.start = markup.start;
            comment.end = markup.end;
            finalMarkupsList.push( comment );
        }
    }
}

/**
  * Method to get the user object
  * @param {JSON} markup the markup for which user to find
  * @returns {JSON} the user object
  */
export function getUser( markup ) {
    if( markup ) {
        var commentsHandler = ckeditorOperations.getMarkupTextInstance();
        var parentMarkup = commentsHandler.getKey( markup );
        if( parentMarkup && parentMarkup.length > 0 ) {
            var user = usersMap.get( parentMarkup[ 0 ].initial );
            if( user ) {
                return user;
            }
        }
    }
    user = {};
    user.color = 'rgba(255, 0, 0, 0.125)';
    user.darkColor = 'rgba(255, 0, 0, 0.25)';
    return user;
}


/**
  * Add reply markup for
  *
  * @param {Markup} markup - the markup being replied
  *
  * @return {Markup} the replying markup
  */
export function addReplyMarkup( markup ) {
    var replyMarkup = markupData.addMarkup( loginUserId, loginUserName, loginUserId, markup.start, markup.end,
        markup.type );

    replyMarkup.reference = markup.reference;
    replyMarkup.geometry = markup.geometry;
    replyMarkup.viewParam = markup.viewParam;

    if( markup.objId && markup.reqData ) {
        replyMarkup.reqData = getReqData( markup );
        replyMarkup.objId = markup.objId;

        if( !replyMarkup.reqData.parentCommentid ) {
            if( !markup.reqData.parentCommentid ) {
                replyMarkup.reqData.parentCommentid = markup.reqData.commentid;
            } else {
                replyMarkup.reqData.parentCommentid = markup.reqData.parentCommentid;
            }
        }
    }
    replyMarkup.userObj = users[ 0 ].userObj;
    replyMarkup.editMode = 'reply';

    // Fix D-13968 where the client machines' clocks are significantly out-of-sync
    if( replyMarkup.date <= markup.date ) {
        replyMarkup.date.setTime( markup.date.getTime() + 1 );
    }


    var status = markupThread.getStatus( markup );
    replyMarkup.status = status === 'open' ? 'replied' : status;
    putComment( replyMarkup );
    insertReplyComment( replyMarkup );
    var swaCtx = appCtxSvc.getCtx( 'xrtPageContext' );
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if( swaCtx && swaCtx.secondaryXrtPageID !== 'tc_xrt_summary_table' || widePanelCtx ) {
        ckeditorOperations.renderComment( replyMarkup, markupList, markups );
    } else {
        markupList.push( markup );
        markupThread.add( markup );
        //markupRequirement.show( markup, 0 );
        exports.sortMarkupList();
    }
    return replyMarkup;
}
/**
  * delete markup
  *
  * @param {Markup} markup the markup to be deleted
  */
export function deleteMarkup( markup, isCk5 ) {
    markup.deleted = true;
    if( isCk5 ) {
        var selectedComment = exports.getMarkupFromId( markup.reqData.commentid );
        if( selectedComment.deleted !== true ) {
            selectedComment.deleted = true;
        }
        removeReplyComment( markup );
    }
    if( !isCk5 ) {
        markupThread.remove( markup );
    }
}

/**
  * method to remove deleted flag from markup object
  * @param {Markup} markup the markup to undo deleted
  */
export function undoDeleteMarkup( markup ) {
    delete markup.deleted;
}

/**
  * Find users to load
  *
  * @return {String} array of user names
  */
export function findUsersToLoad() {
    var userNames = [];
    markupData.users.forEach( function( user ) {
        if( user.userid && !user.userObj ) {
            userNames.push( user.username );
        }
    } );

    return userNames;
}

/**
  * Is markup editable?
  *
  * @param {Markup} markup - the markup being tested
  *
  * @return {boolean} true if editable
  */
export function isEditable( markup ) {
    return canMarkup() && markupData.isMyMarkup( markup ) && markup.share !== 'official' &&
         !markupThread.isInThread( markup, 'frozen' );
}

/**
  * Is markup replyable?
  *
  * @param {Markup} markup - the markup being tested
  *
  * @return {boolean} true if replyable
  */
export function isReplyable( markup ) {
    return canMarkup() && !markupData.isMyMarkup( markup );
}

/**
  * Is markup  deletable?
  *
  * @param {Markup} markup - the markup being tested
  *
  * @return {boolean} true if deletable
  */
export function isDeletable( markup ) {
    return !markup.stampName ? isEditable( markup ) :
        role === 'admin' ? markup.share === 'public' : markup.share === 'private';
}

/**
  * Is markup indented?
  *
  * @param {Markup} markup - the markup being tested
  *
  * @return {boolean} true if indented
  */
export function isIndented( markup ) {
    return ( sortBy === 'page' || sortBy === 'status' ) && filterList.length === 0 &&
         markupThread.isInThread( markup, 'rest' );
}

/**
  * Set filter text
  *
  * @param {String} text - the filter text
  * @return {boolean} true if set to a different value
  */
export function setFilter( text ) {
    if( text !== filter ) {
        filter = text;
        if( text === '' ) {
            filterList = [];
        } else {
            var str = text.trim().toLowerCase();
            filterList = str === '' ? [] : str.split( /\s+/ );
        }
        return true;
    }

    return false;
}

/**
  * Set filter text
  *
  * @param {String} id - the filter text
  * @return {Object} true if set to a different value
  */
export function getMarkupFromId( id ) {
    return markups.find( element => {
        if( element.reqData && element.reqData.commentid && element.reqData.commentid === id ) {
            return element;
        }
    } );
}

/**
  * Is markup editable?
  *
  * @param {Markup} markup - the markup being tested
  *
  * @return {boolean} true if editable @return {Object} true if set to a different value
  */
export function isCommentEditable( markup ) {
    return canMarkup() && markupData.isMyMarkup( markup ) && markup.share !== 'official';
}

/**
  * Save the edited current markup
  *
  * @param {Data} markup - the markup data
  */
export let ensureCommentEditSuccessful = function( markup ) {
    if( markup && markup.reqData && markup.reqData.commentid ) {
        var currentMarkup = exports.getMarkupFromId( markup.reqData.commentid );
        if( currentMarkup && currentMarkup.comment !== markup.comment || currentMarkup.status !== markup.status ) {
            currentMarkup.comment = markup.comment;
            currentMarkup.status = markup.status;

            if( markup.reqData.parentCommentid ) {
                var replyComments = replyCommentsMap.has( markup.reqData.parentCommentid );
                if( replyComments ) {
                    replyComments.forEach( element => {
                        if( element.reqData.commentid === markup.reqData.commentid &&
                             ( element.comment !== markup.comment || element.status !== markup.status ) ) {
                            element.comment = markup.comment;
                            element.status = markup.status;
                        }
                    } );
                }
            }
        }
    }
};

/**
  * Is markup replyable?
  *
  * @param {Markup} markup - the markup being tested
  *
  * @return {boolean} true if replyable
  */
export function isCommentReplyable( markup ) {
    return canMarkup() && !markupData.isMyMarkup( markup );
}

/**
  * Is markup  deletable?
  *
  * @param {Markup} markup - the markup being tested
  *
  * @return {boolean} true if deletable
  */
export function isCommentDeletable( markup ) {
    return isCommentEditable( markup );
}

/**
  * Clear all markup Html
  */
export function clearMarkupHtml() {
    markupCanvas.clearFillImages();
}

/**
  * compare status of comments
  *
  * @param {Markup} markup0 - the first markup being compared
  * @param {Markup} markup1 - the second markup being compared
  *
  * @return {Number} compare number
  */
export function compareStatusComments( markup0, markup1 ) {
    var status0 = statusList.indexOf( ckeditorOperations.getStatusComments( markup0 ) );
    var status1 = statusList.indexOf( ckeditorOperations.getStatusComments( markup1 ) );

    return status0 - status1;
}

/**
  * populate user object in the comment object
  *
  * @param {Markup} userId - the user id of the user
  * @param {Markup} obj - the user obj of the user
  *
  */
export function populateUserObjectInComment( userId, obj ) {
    users.forEach(
        function( user ) {
            if( user.userid === userId ) {
                user.userObj = obj;
            }
        }
    );
    markups.forEach(
        function( markup ) {
            if( markup.userid === userId ) {
                markup.userObj = obj;
            }
        }
    );
    exports.updateMarkupList( true );
}

//==================================================
// private functions
//==================================================
var htmlEntities = {
    nbsp: ' ',
    oslash: 'ø',
    cent: '¢',
    pound: '£',
    yen: '¥',
    euro: '€',
    copy: '©',
    reg: '®',
    quot: '"',
    apos: '\''
};

/**
  * Unescape the HTML string
  *
  * @param {String} str string to be unescaped
  * @returns {String} the unescaped string
  */
function unescapeHTML( str ) {
    return str.replace( /&([^;]+);/g, function( entity, entityCode ) {
        var match;

        if( entityCode in htmlEntities ) {
            return htmlEntities[ entityCode ];
            /*eslint no-cond-assign: 0*/
        } else if( match = entityCode.match( /^#x([\da-fA-F]+)$/ ) ) {
            return String.fromCharCode( parseInt( match[ 1 ], 16 ) );
            /*eslint no-cond-assign: 0*/
        } else if( match = entityCode.match( /^#(\d+)$/ ) ) {
            return String.fromCharCode( ~~match[ 1 ] );
        }
        return entity;
    } );
}

/**
  * Get the text to be shown on page
  *
  * @param {Markup} markup - the markup to get the text
  * @returns {String} the text to be shown on page
  */
function getTextToBeShown( markup ) {
    if( markup.showOnPage && markup.showOnPage !== 'none' ) {
        var html = markup.comment.replace( /<p/g, '<div' ).replace( /<\/p>/g, '</div>' );

        if( markup.showOnPage === 'first' ) {
            var index = html.indexOf( '<div', 1 );
            if( index > 0 ) {
                html = html.substring( 0, index );
            }
        }

        return unescapeHTML( html );
    }

    return '';
}

/**
  * Compare user of two markups, the login user is always first
  *
  * @param {Markup} markup0 the first markup
  * @param {Markup} markup1 the second markup
  * @return {number} markup0 < markup1? -1: markup0 > markup1? 1: 0;
  */
function compareUser( markup0, markup1 ) {
    var isMy0 = markupData.isMyMarkup( markup0 );
    var isMy1 = markupData.isMyMarkup( markup1 );

    if( isMy0 !== isMy1 ) {
        return isMy0 ? -1 : 1;
    }

    return markup0.displayname.localeCompare( markup1.displayname );
}

/**
  * Clear all markup groups before sorting
  */
function clearGroups() {
    for( var i = markupList.length - 1; i >= 0; i-- ) {
        if( markupList[ i ].groupName ) {
            var group = markupList.splice( i, 1 )[ 0 ];
            if( !group.expanded ) {
                for( var j = group.list.length - 1; j >= 0; j-- ) {
                    markupList.splice( i, 0, group.list[ j ] );
                }
            }
        }
    }
}

/**
  * Insert all groups after sorting
  */
function insertGroups() {
    var currentGroup = null;

    // Set today which is at 0:00am today
    var now = new Date();
    var today = new Date( now.getFullYear(), now.getMonth(), now.getDate() );

    for( var i = 0; i < markupList.length; i++ ) {
        var markup = markupList[ i ];
        if( !markup.groupName ) {
            var name = sortBy === 'user' ? markup.displayname : sortBy === 'page' ? 'page ' +
                 ( markup.start.page + 1 ) : 'unknown';

            // Split to fix SonarQube issue: conditional operators max allowed 3
            name = sortBy === 'status' ? ckeditorOperations.getStatusComments( markup ) : sortBy === 'date' ? getDateName(
                markup.date, today ) : name;

            if( markup.reqData && markup.reqData.markupHeader ) {
                name = sortBy === 'all' ? markup.reqData.markupHeader : name;
                if( currentGroup && currentGroup.groupName === name ) {
                    currentGroup.list.push( markup );
                } else {
                    currentGroup = {
                        groupName: name,
                        list: [ markup ],
                        expanded: true
                    };
                    markupList.splice( i, 0, currentGroup );
                    i++;
                }
            }
        }
    }
}

/**
  * Get the group name of the markup
  *
  * @param {Date} date the date of markup
  * @param {Date} today the date of today at 0:00am
  * @return {String} the date name
  */
function getDateName( date, today ) {
    var year = date.getFullYear();
    var month = date.getMonth();
    var daysDiff = Math.ceil( ( today.getTime() - date.getTime() ) / 86400000 );
    var monthName = month === today.getMonth() ? 'thisMonth' : month < 9 ? 'monthName_0' + ( month + 1 ) + ' ' +
         year : 'monthName_' + ( month + 1 ) + ' ' + year;

    return daysDiff <= 0 ? 'today' : daysDiff === 1 ? 'yesterday' : daysDiff <= 6 ? 'dayName_0' +
         ( date.getDay() + 1 ) : monthName;
}

/**
  * Remove a markup from the list
  *
  * @param {Markup} markup the markup to be added
  */
function removeReplyComment( markup ) {
    if( replyCommentsMap.has( markup.reqData.commentid ) ) {
        var replyComments = replyCommentsMap.get( markup.reqData.commentid );
        for( var i = replyComments.length - 1; i >= 0; i-- ) {
            if( replyComments[ i ].reqData.parentCommentid === markup.reqData.commentid ) {
                for( var j = markups.length - 1; j >= 0; j-- ) {
                    if( markups[ j ].reqData.commentid === markup.reqData.commentid ||
                         markups[ j ].reqData.parentCommentid === markup.reqData.commentid ) {
                        markups.splice( j, 1 );
                    }
                }
                replyComments.splice( i, 1 );
            }
        }
    } else if( markup.reqData.parentCommentid !== '' && replyCommentsMap.has( markup.reqData.parentCommentid ) ) {
        var replyComments = replyCommentsMap.get( markup.reqData.parentCommentid );
        for( var i = replyComments.length - 1; i >= 0; i-- ) {
            if( replyComments[ i ].reqData.commentid === markup.reqData.commentid ) {
                replyComments.splice( i, 1 );
            }
        }
    }
}

/**
  * Remove a markup from the list
  *
  * @param {Array} markups the markups to be added
  * @param {Markup} id the markups to be added
  */
function isReplyExist( replies, id ) {
    for( var i = replies.length - 1; i >= 0; i-- ) {
        if( replies[ i ].reqData.commentid === id ) {
            return true;
        }
    }
    return false;
}

/**
  * Filter the markup
  *
  * @param {Markup} markup the markup to be tested
  * @return {boolean} true if it is visible through the filter
  */
function filterMarkup( markup ) {
    for( var i = 0; i < filterList.length; i++ ) {
        if( markup.comment.toLowerCase().indexOf( filterList[ i ] ) < 0 ) {
            return false;
        }
    }

    return true;
}

//==================================================
// exported functions
//==================================================
let exports;
export let getVersion = function() {
    return version;
};
export let getMarkupList = function() {
    return markupList;
};
export let getUsers = function() {
    return markupData.users;
};
export let getStatus = function( markup ) {
    return markupThread.getStatus( markup );
};
export let setUserObj = function( userId, obj ) {
    markupData.setUserObj( userId, obj );
    ckeditorOperations.populateUserObjectInComment( userId, obj );
};
export let getCount = function() {
    return markupData.markups.reduce( function( count, markup ) {
        return count + ( markup.deleted ? 0 : 1 );
    }, 0 );
};
export let getSortBy = function() { return sortBy; };
export let getFilter = function() { return filter; };
export let clearAllEditMode = function() {
    markupData.clearAllEditMode();
};
export let stringifyMarkups = function( all ) {
    return markupData.stringifyMarkups( all );
};
export let stringifyMarkup = function( markup ) {
    return markupData.stringifyMarkup( markup );
};
export let findUser = function( id ) {
    return markupData.findUser( id );
};
export let isInThread = function( markup ) {
    return markupThread.isInThread( markup, 'any' );
};
export let getRole = function() {
    return role;
};
export let setRole = function( r ) {
    role = r;
};
export let canMarkup = function() {
    return role === 'admin' || role === 'author' || role === 'reviewer';
};
export let getStampShare = function() {
    return role === 'admin' ? 'public' : 'private';
};
export let isUpToDate = function() {
    return message.indexOf( 'up_to_date' ) >= 0;
};
export let isAppend = function() {
    return message.indexOf( 'append' ) >= 0;
};
export let hasMore = function() {
    return message.indexOf( 'more' ) >= 0;
};
export let getMarkups = function() {
    return markups;
};
export let getCommentsMap = function() {
    return commentsMap;
};
export let getReplyCommentsMap = function() {
    return replyCommentsMap;
};
export let getTrackChangesMap = function() {
    return trackChangesMap;
};
export let getFinalTrackChangesMap = function() {
    return finalTrackChangesMap;
};
export let getUsersMap = function() {
    return usersMap;
};

export let setMarkupsForSummaryTab = function( comments ) {
    markupData.parseMarkups( comments );
    markups = markupData.markups;
};

export let getAllAnnotationFilterBackup = function() {
    return allAnnotationFilterBackup;
};

export let setAllAnnotationFilterBackup = function( annotationsArray ) {
    allAnnotationFilterBackup = annotationsArray;
};

export default exports = {
    getVersion,
    getMarkupList,
    getUsers,
    getStatus,
    setUserObj,
    setLoginUser,
    getCount,
    setSortBy,
    getSortBy,
    setFilter,
    getFilter,
    processMarkups,
    clearMarkupList,
    updateMarkupList,
    clearMarkupHtml,
    sortMarkupList,
    toggleGroup,
    addNewMarkup,
    addReplyMarkup,
    deleteMarkup,
    clearAllEditMode,
    stringifyMarkups,
    stringifyMarkup,
    findUser,
    findUsersToLoad,
    isEditable,
    isReplyable,
    isDeletable,
    isIndented,
    isInThread,
    getRole,
    setRole,
    canMarkup,
    getStampShare,
    isUpToDate,
    isAppend,
    hasMore,
    getMarkupFromId,
    populateMarkupList,
    isCommentEditable,
    isCommentReplyable,
    isCommentDeletable,
    getMarkups,
    getUser,
    putComment,
    getComment,
    insertReplyComment,
    getReplyComments,
    undoDeleteMarkup,
    setMarkupsForSummaryTab,
    ensureCommentEditSuccessful,
    compareStatusComments,
    populateUserObjectInComment,
    setUserObjOnUsers,
    getUserDetailsFromServer,
    getCommentsMap,
    getReplyCommentsMap,
    getTrackChangesMap,
    getFinalTrackChangesMap,
    getAllAnnotationFilterBackup,
    setAllAnnotationFilterBackup,
    getUsersMap,
    getReqData
};

