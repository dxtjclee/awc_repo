// Copyright (c) 2022 Siemens

/**
 * Requirement Markup Util
 *
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Arm0MarkupUtil
 */
import markupData from 'js/MarkupData';
import markupReq from 'js/MarkupRequirement';
import markupService from 'js/Arm0MarkupService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import ckeditorOperations from 'js/ckeditorOperations';
import _ from 'lodash';
import markupViewModel from 'js/Arm0MarkupViewModel';
import rmCkeditorService from 'js/Arm0CkeditorService';

var _i18n = {};

/** The valid keys to save, including top level key "" */
var validKeys = [ '', 'comment', 'created', 'date', 'initial', 'reference', 'share', 'status',
    'type', 'userid', 'username', 'start', 'end', 'objId', 'viewParam', 'textParam', 'showOnPage',
    'scale', 'page', 'ch', 'rch', 'x', 'y', 'threadId', 'ck5CommentId', 'authorId', 'createdAt', 'content',
    // track changes keys
    'attributes', 'data', 'startPath', 'endPath', 'hasComments', 'id', 'originalSuggestionId'
];

//======================= exported vars and functions =========================
let exports;
export let i18n = _i18n;
/**
 * Get markup input to
 *  @return {Object} markupInput return markup input data
 */
export let getCreateMarkupInput = function( content, doOverWriteContent ) {
    var reqMarkupsInputData = [];
    var reqMarkupsData = [];

    // To save only updated or newly created markups
    reqMarkupsData = _getOnlyUpdatedMarkups();
    if ( reqMarkupsData && reqMarkupsData.length > 0 ) {
        _.forEach( reqMarkupsData, function( reqMarkup ) {
            // Remove markup before saving if page is -1
            var markupsToSave = [];
            _.forEach( reqMarkup.markups, function( markup ) {
                if ( markup ) {
                    markupsToSave.push( markup );
                }
            } );
            reqMarkup.markups = markupsToSave;
            var specContentData = content.specContents;
            for ( var i = 0; i < specContentData.length; i++ ) {
                var specContent = specContentData[i];
                if ( reqMarkup.baseObject.uid === specContent.specElemRevision.uid ) {
                    if ( !reqMarkup.properties ) {
                        reqMarkup.properties = {};
                    }
                    reqMarkup.properties.lastSavedDate = specContent.lastSavedDate;
                    if( doOverWriteContent && doOverWriteContent === true ) {
                        const obj = cdm.getObject( specContent.specElemRevision.uid );
                        if( obj && obj.props && obj.props.last_mod_date ) {
                            reqMarkup.properties.lastSavedDate = obj.props.last_mod_date.dbValues[0];
                        }
                    }
                    break;
                }
            }

            var reqParseMarkup = _stringifyRequirementsMarkups( reqMarkup );
            if ( reqParseMarkup ) {
                reqMarkupsInputData.push( reqParseMarkup );
            }
        } );
    }
    return reqMarkupsInputData;
};


/**
 * Get markup input to
 *  @return {Object} markupInput return markup input data In collaboration Mode
 */
export let getCreateMarkupInputColloboration = function( content, allCommentThreadMap ) {
    var reqMarkupsInputData = [];
    var reqMarkupsData = [];
    var lastSaveDate;
    // To save only updated or newly created markups
    reqMarkupsData = _getOnlyUpdatedMarkupsInCollaboration( allCommentThreadMap );
    if ( reqMarkupsData && reqMarkupsData.length > 0 ) {
        _.forEach( reqMarkupsData, function( reqMarkup ) {
            // Remove markup before saving if page is -1
            var markupsToSave = [];
            _.forEach( reqMarkup.markups, function( markup ) {
                if ( markup ) {
                    markupsToSave.push( markup );
                }
            } );
            reqMarkup.markups = markupsToSave;
            var specContentData = content.specContents;
            var currReqWidget = ckeditorOperations.getCKEditorModelElementByRevID( reqMarkup.baseObject.uid )._attrs;

            for ( var i = 0; i < specContentData.length; i++ ) {
                var specContent = specContentData[i];
                if ( reqMarkup.baseObject.uid === specContent.specElemRevision.uid ) {
                    if( currReqWidget.get( 'lmd' ) === '' ) {
                        lastSaveDate = specContent.lastSavedDate;
                    }else{
                        lastSaveDate = currReqWidget.get( 'lmd' );
                    }

                    if ( !reqMarkup.properties ) {
                        reqMarkup.properties = {};
                    }
                    reqMarkup.properties.lastSavedDate = lastSaveDate;
                    break;
                }
            }

            var reqParseMarkup = _stringifyRequirementsMarkups( reqMarkup );
            if ( reqParseMarkup ) {
                reqMarkupsInputData.push( reqParseMarkup );
            }
        } );
    }
    return reqMarkupsInputData;
};
/**
 * Get only updated markups
 *
 *  @return {Object} reqMarkupsData returns only updated markups
 */
var _filterRequirementMarkups = function( arrMarkups, baseReqUid ) {
    var reqMarkups = [];

    // check if there is new markup
    for ( var i = 0; i < arrMarkups.length; i++ ) {
        if ( arrMarkups[i].objId === baseReqUid ) {
            reqMarkups.push( arrMarkups[i] );
        }
    }
    return reqMarkups;
};

/**
 * Check the markup is newly created one
 *  @param {Array} arrMarkups - array of markups
 *  @param {Object} markup - markup
 */
var _CreateMarkupDataForNewObject = function( arrReqMarkups, markup ) {
    var isReqMarkupDataExist = false;
    _.forEach( arrReqMarkups, function( tmpReqMarkup ) {
        if ( tmpReqMarkup.baseObject.uid === markup.objId ) {
            isReqMarkupDataExist = true;
        }
    } );
    if ( !isReqMarkupDataExist ) {
        var revObject = cdm.getObject( markup.objId );
        if ( revObject ) {
            var markupData = {
                baseObject: {
                    type: revObject.type,
                    uid: revObject.uid
                },
                markups: [],
                properties: {
                    message: 'author'
                },
                version: ''
            };
            arrReqMarkups.push( markupData );
        }else {
            markupData = {
                baseObject: {
                    type: 'Requirement',
                    uid: markup.objId  //RM::NEW::1aew23s906
                },
                markups: [],
                properties: {
                    message: 'author'
                },
                version: ''
            };
            arrReqMarkups.push( markupData );
        }
    }
};

/**
 * Check the markup is newly created one
 *  @param {Array} arrMarkups - array of markups
 *  @param {Object} markup - markup
 *  @return {boolean} return true if markup is already exist
 */
var _isMarkupExist = function( arrMarkups, markup ) {
    var isExist = false;
    _.forEach( arrMarkups, function( tmpMarkup ) {
        if ( markup.attributes && markup.id === tmpMarkup.id || tmpMarkup && tmpMarkup.reqData &&
            tmpMarkup.reqData.commentid && markup && markup.reqData && markup.reqData.commentid
            && tmpMarkup.reqData.commentid === markup.reqData.commentid ) {
            isExist = true;
        }
    } );
    return isExist;
};

/**
 * Get only updated markups
 *  @param {Array} arrMarkups - array of markups on all objects
 *  @param {Object} reqMarkups - one requirement object with markups array
 *  @return {boolean} return true if markup data is updated.
 */
var _updateRequirementMarkups = function( arrMarkups, reqMarkups ) {
    var isUpdated = false;
    var markups = reqMarkups.markups;
    var markupCount = markups.length;

    // check if there's need to update the current comment obj
    for ( var j = markupCount - 1; j >= 0; j-- ) {
        var isExist = false;

        _.forEach( arrMarkups, function( tmpMarkup ) {
            if ( tmpMarkup && tmpMarkup.attributes && markups[j].id === tmpMarkup.id ) {
                isExist = true;
                if ( markups[j].hasComments !== tmpMarkup.hasComments ) {
                    markups[j] = tmpMarkup;
                    isUpdated = true;
                }
            } else if ( markups[j] && markups[j].reqData && markups[j].reqData.commentid
                && tmpMarkup.reqData && tmpMarkup.reqData.commentid && markups[j].reqData.commentid === tmpMarkup.reqData.commentid ) {
                isExist = true;

                if ( markups[j].comment !== tmpMarkup.comment ||
                    markups[j].status !== tmpMarkup.status ||
                    markups[j].start.rch !== tmpMarkup.start.rch ||
                    markups[j].end.rch !== tmpMarkup.end.rch || !markups[j].threadId && tmpMarkup.threadId ) {
                    markups[j] = tmpMarkup;
                    isUpdated = true;
                }
            }
        } );
        if ( !isExist && markups[j] ) {
            markups.splice( j, 1 );
            isUpdated = true;
        }
    }

    // check if there is new markup
    for ( var i = 0; i < arrMarkups.length; i++ ) {
        var tmpMarkup = arrMarkups[i];
        if ( !_isMarkupExist( markups, tmpMarkup ) ) { // new markup
            isUpdated = true;
            markups.push( tmpMarkup );
        }
    }
    return isUpdated;
};

/**
 * Get only updated markups
 *
 *  @return {Object} reqMarkupsData returns only updated markups
 */
var _getOnlyUpdatedMarkups = function() {
    var markupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    var allMarkupsCurrent = [];
    if( markupCtx ) {
        allMarkupsCurrent =  markupCtx.reqMarkupsData;
    }
    // get track changes cached data to save
    var finalTrackChangesMap = markupViewModel.getFinalTrackChangesMap();
    for ( let [ key, value ] of finalTrackChangesMap.entries() ) {
        allMarkupsCurrent.push( ...value );
    }

    var serverReqMarkupsData = [];
    var updatedReqMarkupsData = [];


    if( markupCtx ) {
        serverReqMarkupsData = markupCtx.serverReqMarkupsData;
    }


    if( serverReqMarkupsData ) {
        for ( var i = 0; i < allMarkupsCurrent.length; i++ ) {
            var tmpMarkup = allMarkupsCurrent[i];
            _CreateMarkupDataForNewObject( serverReqMarkupsData, tmpMarkup );
        }

        _.forEach( serverReqMarkupsData, function( reqOrigMarkups ) {
            var reqMarkups = _.cloneDeep( reqOrigMarkups );
            var baseReqUid = reqMarkups.baseObject.uid;
            var arrMarkups = _filterRequirementMarkups( allMarkupsCurrent, baseReqUid );

            if ( _updateRequirementMarkups( arrMarkups, reqMarkups ) ) {
                updatedReqMarkupsData.push( reqMarkups );
            }
        } );
    }


    return updatedReqMarkupsData;
};

var _getOnlyUpdatedMarkupsInCollaboration = function( allCommentThreadMap ) {
    var markupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    var ckEditor = ckeditorOperations.getCKEditorInstance();
    var dirtyRequirements = ckeditorOperations.getDirtyReqCkeModelElements( ckEditor );


    var allMarkupsCurrent = [];

    if( allCommentThreadMap && allCommentThreadMap.length > 0 ) {
        for ( var i = 0; i < allCommentThreadMap.length; i++ ) {
            allMarkupsCurrent.push( allCommentThreadMap[i] );
        }
    }

    // get track changes cached data to save
    var allCommentThreadMap1 = ckeditorOperations.getAllTrackChangeInEditor( true );
    rmCkeditorService.setSavedTrackchnagesData( allCommentThreadMap1 );
    //for ( let [ key, value ] of allCommentThreadMap1.entries() ) {
    if( allCommentThreadMap1 && allCommentThreadMap1.size > 0 ) {
        for ( let [ key, value ] of allCommentThreadMap1.entries() ) {
            //  for ( var i = 0; i < allCommentThreadMap1.length; i++ ) {
            allMarkupsCurrent.push( value[0] );
        }
    }


    var serverReqMarkupsData = [];
    var updatedReqMarkupsData = [];
    var updatedReqMarkupsData2 = [];

    if( markupCtx && markupCtx.serverReqMarkupsData ) {
        serverReqMarkupsData = markupCtx.serverReqMarkupsData;
        for ( var i = 0; i < allMarkupsCurrent.length; i++ ) {
            var tmpMarkup = allMarkupsCurrent[i];
            _CreateMarkupDataForNewObject( serverReqMarkupsData, tmpMarkup );
        }

        _.forEach( serverReqMarkupsData, function( reqOrigMarkups ) {
            var reqMarkups = _.cloneDeep( reqOrigMarkups );
            var baseReqUid = reqMarkups.baseObject.uid;
            var arrMarkups = _filterRequirementMarkups( allMarkupsCurrent, baseReqUid );

            if ( arrMarkups && arrMarkups.length > 0 ) {
                _addmarkupsinupdatedmarkups( arrMarkups, reqMarkups );
                updatedReqMarkupsData.push( reqMarkups );
            }
        } );
    }


    if( dirtyRequirements && dirtyRequirements.length > 0 ) {
        for( let index = 0; index < dirtyRequirements.length; index++ ) {
            var dirtyRequirement = dirtyRequirements[ index ];
            var elementId = dirtyRequirement.getAttribute( 'id' );
            var revId = dirtyRequirement.getAttribute( 'revisionid' );

            _.forEach( updatedReqMarkupsData, function( updatedReqMarkups ) {
                if( updatedReqMarkups.baseObject.uid === revId ) {
                    updatedReqMarkupsData2.push( updatedReqMarkups );
                }
            } );
        }
    }

    return updatedReqMarkupsData2;
};

function _addmarkupsinupdatedmarkups( arrMarkups, reqMarkups ) {
    reqMarkups.markups = [];
    var markups = reqMarkups.markups;
    for( let index = 0; index < arrMarkups.length; index++ ) {
        markups.push( arrMarkups[index] );
    }
}


/**
 * Stringify the markups
 *
 * @param {boolean} reqMarkups -  get all markups from string json
 * @return {Object} return requirement markups
 */
var parseRequirementMarkup = function( reqMarkups ) {
    var escaped = reqMarkups.replace( /[\u007f-\uffff]/g, function( c ) {
        return '\\u' + ( '0000' + c.charCodeAt( 0 ).toString( 16 ) ).slice( -4 );
    } );
    var objs = JSON.parse( escaped );
    var reqParseMarkups = [];
    for ( var i = 0; i < objs.length; i++ ) {
        var markup = objs[i];
        reqParseMarkups.push( markup );
    }
    return reqParseMarkups;
};
/**
 * parse the requirement markups
 *
 * @param {Array} reqMarkups the json representation of the markups
 * @return {Array} reqMarkups return requirement markups with parsing data ;
 */
var _parseRequirementsMarkups = function( reqMarkups ) {
    if ( reqMarkups && reqMarkups.markups ) {
        var reqParseMarkups = reqMarkups.markups;
        if( typeof reqParseMarkups === 'string' ) {
            reqParseMarkups = parseRequirementMarkup( reqMarkups.markups );
        }
        reqMarkups.markups = [];
        for ( var i = 0; i < reqParseMarkups.length; i++ ) {
            var markup = reqParseMarkups[i];
            if ( !markup.reqData ) {
                markup.reqData = {};
            }
            if ( markup.commentid ) {
                markup.reqData.commentid = markup.commentid;
                delete markup.commentid;
            }

            if ( markup.parentCommentid ) {
                markup.reqData.parentCommentid = markup.parentCommentid;
                delete markup.parentCommentid;
            }

            if ( markup.isCommentOnTitle ) {
                markup.reqData.isCommentOnTitle = markup.isCommentOnTitle;
                delete markup.isCommentOnTitle;
            }

            reqMarkups.markups.push( markup );
        }
        return reqMarkups;
    }
    return [];
};

/**
 * Stringify one markup
 *
 * @param {Markup} markup - the markup to be stringified
 * @returns {String} the json string
 */
var _stringifyMarkup = function( markup ) {
    var json = null;
    if( markup.attributes ) {
        json = JSON.stringify( markup );
    }else {
        json = JSON.stringify( markup, checkValidKey );
        if ( markup.reqData ) {
            var reqData = ',"reqData":' + JSON.stringify( markup.reqData ) + '}';
            json = json.replace( /[}]$/, reqData );
        }
        if( markup.additionalProps ) {
            var additionalProps = ',"additionalProps":' + JSON.stringify( markup.additionalProps ) + '}';
            json = json.replace( /[}]$/, additionalProps );
        }
    }
    return json;
};

/**
 * check valid key for stringifyMarkup
 *
 * @param {String} key - the key
 * @param {Object} value - the value
 *
 * @return {Object} the value if valid or undefined otherwise
 */
function checkValidKey( key, value ) {
    return validKeys.indexOf( key ) >= 0 || !isNaN( key ) ? value : undefined;
}

/**
 * Stringify the requirement markups
 *
 * @param {Array} reqMarkups the json representation of the markups
 * @return {Array} reqMarkups reqMarkups return requirement markups;
 */
export let _stringifyRequirementsMarkups = function( reqMarkups ) {
    var json = _stringifyRequirementMarkup( reqMarkups.markups );
    reqMarkups.markups = '';
    if ( json !== '[]' ) {
        reqMarkups.markups = json;
    }
    return reqMarkups;
};

/**
 * Stringify the markups
 *
 * @param {boolean} markups -  get all markups
 *
 * @return {String} the json representation of the markups
 */
export let _stringifyRequirementMarkup = function( markups ) {
    var json = '[';
    for ( var i = 0; i < markups.length; i++ ) {
        var markup = markups[i];
        json += ( json === '[' ? '' : ',\n' ) + _stringifyMarkup( markup );
    }

    json += ']';
    return json.replace( /[\u007f-\uffff]/g, function( c ) {
        return '\\u' + ( '0000' + c.charCodeAt( 0 ).toString( 16 ) ).slice( -4 );
    } );
};

/**
 * Function to return active tab key
 * @param {Object} subPanelContext
 * @returns {String} - active tab key
 */
function _getActiveTabKey( subPanelContext ) {
    let activeTab = subPanelContext.activeTab && subPanelContext.activeTab.pageId ? subPanelContext.activeTab.pageId : undefined;
    if( !activeTab ) {
        activeTab = subPanelContext.showObjectContext && subPanelContext.showObjectContext.activeTab
                    && subPanelContext.showObjectContext.activeTab.tabKey ? subPanelContext.showObjectContext.activeTab.tabKey : undefined;
    }
    return activeTab;
}

/**
 * Update markup context
 *
 */
export let updateMarkupContext = function( data ) {
    var markupsJson = null;
    //var swaCtx = appCtxSvc.getCtx( 'xrtPageContext' );
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( data && data.subPanelContext && _getActiveTabKey( data.subPanelContext ) === 'tc_xrt_summary_table' && !widePanelCtx ) {
        markupsJson = markupData.stringifyMarkups( true );
    } else {
        markupsJson = ckeditorOperations.stringifyMarkups();
    }
    var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if( reqMarkupCtx ) {
        reqMarkupCtx.response = {
            version: '',
            baseObject: undefined,
            markups: markupsJson,
            properties: {
                message: 'author'
            }
        };
        reqMarkupCtx.reqMarkupsData = parseRequirementMarkup( markupsJson );
    }

    return reqMarkupCtx;
};

/**
 * Internal function to set markup up context to Markup service
 *
 * @param {object} reqMarkupCtx -  Requirement markup Context
 *
 * @return {String} the json representation of the markups
 */
var _setMarkupContext = function( serverReqMarkupsData, allMarkups, data ) {
    var AWRequirementsEditor = appCtxSvc.getCtx( 'AWRequirementsEditor' );
    var Arm0Requirements = appCtxSvc.getCtx( 'Arm0Requirements' );
    if ( AWRequirementsEditor && Arm0Requirements ) {
        var editorId = AWRequirementsEditor.id;
        var version = Arm0Requirements.Editor;
        if ( editorId && version ) {
            var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
            if ( editor ) {
                if ( version === 'CKEDITOR_5' ) {
                    const commentsRepositoryPlugin = editor.plugins.get( 'CommentsRepository' );
                    if ( commentsRepositoryPlugin ) {
                        appCtxSvc.registerCtx( 'commentContext', true );
                        var ckeditorSidebarCtx = appCtxSvc.getCtx( 'ckeditorSidebar' );
                        if( ckeditorSidebarCtx && ckeditorSidebarCtx.isOpen === true ) {
                            markupService.enableCkeditorSidebar();
                        }
                    }
                    if ( editor.plugins._availablePlugins.has( 'TrackChanges' ) ) {
                        var trackChangesCtx = appCtxSvc.getCtx( 'trackChanges' );
                        if ( trackChangesCtx && trackChangesCtx.isOn && trackChangesCtx.isOn === true ) {
                            editor.execute( 'trackChanges' );
                            var trackChanges = { isOn: false };
                            appCtxSvc.updateCtx( 'trackChanges', trackChanges );
                        } else {
                            var trackChanges = { isOn: false };
                            appCtxSvc.registerCtx( 'trackChanges', trackChanges );
                        }
                    }
                }
            }
        }
    }
    var markupOutput = {
        version: '',
        baseObject: undefined,
        markups: allMarkups,
        properties: {
            message: 'author'
        }
    };
    var reqMarkupsData = _stringifyRequirementsMarkups( markupOutput );

    var reqMarkupCtx = {
        serverReqMarkupsData: serverReqMarkupsData,
        viewerType: 'aw-requirement-ckeditor',
        supportedTools: { highlight: true },
        response: allMarkups.length > 0 ? reqMarkupsData : undefined
    };

    appCtxSvc.registerCtx( 'reqMarkupCtx', reqMarkupCtx );

    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( _getActiveTabKey( data.subPanelContext ) === 'tc_xrt_summary_table' && !widePanelCtx ) {
        var markupCtx = appCtxSvc.getCtx( 'markup' );
        if ( markupCtx && markupCtx.showMarkups ) {
            markupCtx.showMarkups = false;
            appCtxSvc.updateCtx( 'markup', markupCtx );
        }
        markupService.setContext( data );
    } else {
        ckeditorOperations.initializationForComments();
        ckeditorOperations.initialiseMarkupInput( reqMarkupCtx );
    }
    var activeCommand = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
    if ( activeCommand && activeCommand.commandId === 'Arm0MarkupMain' ) {
        ckeditorOperations.loadUsersOnComments();
    }
};
/**
 * Set markup context
 *
 * @param {Object} data - view model data
 */
export let setMarkupContext = function( data ) {
    var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
    if ( reqMarkupCtx && reqMarkupCtx.reqMarkupsData ) {
        _setMarkupContext( reqMarkupCtx.serverReqMarkupsData, reqMarkupCtx.reqMarkupsData, data );
    }
    var serverReqMarkupsData = [];

    var allMarkups = [];
    if ( data && data.content && data.content.markUpData ) {
        var markUpData = data.content.markUpData;
        _.forEach( markUpData, function( reqMarkup ) {
            var reqParseMarkup = _parseRequirementsMarkups( reqMarkup );
            if ( reqParseMarkup && reqParseMarkup.markups && reqParseMarkup.markups.length > 0 ) {
                allMarkups = allMarkups.concat( reqParseMarkup.markups );
            }
            serverReqMarkupsData.push( reqParseMarkup );
        } );
        _setMarkupContext( serverReqMarkupsData, allMarkups, data );
    }
};

/**
 * Update markup context for loaded objects
 *
 */
export let updateMarkupContextForLoadedObjects = function( additionalMarkupData, deleteMarkupsForUids ) {
    var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );

    var allServerReqMarkupsData = [];
    var allMarkups = [];

    var ServerReqMarkupsData = [];
    var markups = [];

    if( reqMarkupCtx && reqMarkupCtx.response ) {
        allMarkups = parseRequirementMarkup( reqMarkupCtx.response.markups );
    }
    if( deleteMarkupsForUids && deleteMarkupsForUids.length > 0 ) {
        _.forEach( deleteMarkupsForUids, function( uid ) {
            for ( var i = allMarkups.length - 1; i >= 0; i-- ) {
                if ( allMarkups[i].objId === uid ) {
                    allMarkups.splice( i, 1 );
                }
            }
            if( reqMarkupCtx && reqMarkupCtx.reqMarkupsData ) {
                for ( var i = reqMarkupCtx.reqMarkupsData.length - 1; i >= 0; i-- ) {
                    if ( reqMarkupCtx.reqMarkupsData[i].objId === uid ) {
                        reqMarkupCtx.reqMarkupsData.splice( i, 1 );
                    }
                }
            }
            if( reqMarkupCtx && reqMarkupCtx.serverReqMarkupsData ) {
                for ( var i = reqMarkupCtx.serverReqMarkupsData.length - 1; i >= 0; i-- ) {
                    if ( reqMarkupCtx.serverReqMarkupsData[i].baseObject.uid === uid ) {
                        reqMarkupCtx.serverReqMarkupsData.splice( i, 1 );
                    }
                }
            }
        } );
    }
    if( reqMarkupCtx && reqMarkupCtx.serverReqMarkupsData ) {
        allServerReqMarkupsData = reqMarkupCtx.serverReqMarkupsData;
    }

    if( additionalMarkupData && additionalMarkupData.length > 0 ) {
        _.forEach( additionalMarkupData, function( reqMarkup ) {
            var reqParseMarkup = _parseRequirementsMarkups( reqMarkup );
            if( reqParseMarkup && reqParseMarkup.markups && reqParseMarkup.markups.length > 0 ) {
                allMarkups = allMarkups.concat( reqParseMarkup.markups );
                markups = markups.concat( reqParseMarkup.markups );
            }
            allServerReqMarkupsData.push( reqParseMarkup );
            ServerReqMarkupsData.push( reqParseMarkup );
        } );

        var markupOutput = {
            version: '',
            baseObject: undefined,
            markups: allMarkups,
            properties: {
                message: 'author'
            }
        };

        var reqMarkupsData = _stringifyRequirementsMarkups( markupOutput );
        reqMarkupCtx.serverReqMarkupsData = allServerReqMarkupsData;
        reqMarkupCtx.response = allMarkups.length > 0 ? reqMarkupsData : undefined;
        // Merge new markup data in existing
        appCtxSvc.updateCtx( 'reqMarkupCtx', reqMarkupCtx );


        var additionalReqMarkupData = {
            response: markups.length > 0 ? _stringifyRequirementsMarkups( { markups: markups } ) : undefined,
            serverReqMarkupsData: ServerReqMarkupsData
        };
        ckeditorOperations.initialiseAdditionalMarkupInput( additionalReqMarkupData );
    }
};
/**
 * Restore all markups, in case of Undo event
 */
export let attachCachedMarkupsToNode = function() {
    markupReq.attachCachedMarkupsToNode();
};

/**
 * Unselect the current selection
 */
export let clearMarkupSelection = function() {
    setTimeout( function() {
        markupService.unselectCurrent();
    }, 100 );
};

export default exports = {
    i18n,
    setMarkupContext,
    updateMarkupContextForLoadedObjects,
    updateMarkupContext,
    getCreateMarkupInput,
    attachCachedMarkupsToNode,
    clearMarkupSelection,
    _stringifyRequirementMarkup,
    _stringifyRequirementsMarkups,
    getCreateMarkupInputColloboration
};
