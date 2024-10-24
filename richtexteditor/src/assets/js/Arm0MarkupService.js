/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens
/* global CKEDITOR */

/**
 * AW Markup service
 *
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Arm0MarkupService
 */
import { getBaseUrlPath } from 'app';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';
import notyService from 'js/NotyModule';
import awIconService from 'js/awIconService';
import commandPanelSvc from 'js/commandPanel.service';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import _ from 'lodash';
import markupViewModel from 'js/Arm0MarkupViewModel';
import markupData from 'js/MarkupData';
import markupThread from 'js/MarkupThread';
import markupRequirement from 'js/MarkupRequirement';
import markupCanvas from 'js/MarkupCanvas';
import awEditorService from 'js/awRichTextEditorService';
import ckeditorOperations from 'js/ckeditorOperations';
import { convertToHtml } from 'js/reactHelper';

//=============== cached AW directives, services, and objects =================

var _defaultNonTcUser = { typeIconURL: getBaseUrlPath() + '/image/typePersonGray48.svg' };
var _i18n = {};
let ckeEditor;
let lastSelectedCommentId = '';
const AW_REQ_SIDEBAR = '.aw-richtexteditor-editorSidebar';

//======================= exported vars and functions =========================
let exports;
export let i18n = _i18n;

/**
 * Set context for markup module
 */
export let setContext = function( data ) {
    var markupCtx = exports.getMarkupContext();
    var reqMarkupCtx = exports.getContext( 'reqMarkupCtx' );
    if ( reqMarkupCtx && reqMarkupCtx.viewerType === 'aw-requirement-ckeditor' ) {
        markupCtx.viewerType = reqMarkupCtx.viewerType;
        markupCtx.baseObject = null;
        markupCtx.version = '';
        markupCtx.count = 0;
        markupCtx.currentSelection = null;

        var reqMarkupResponse;
        if ( markupCtx.showMarkups ) {
            reqMarkupResponse = { markups: '[]', version: '', properties: { message: 'author up_to_date' } };
        } else {
            var defaultResponse = { markups: '[]', version: '', properties: { message: 'author' } };
            reqMarkupResponse = reqMarkupCtx.response ? reqMarkupCtx.response : defaultResponse;
        }
        exports.processMarkups( reqMarkupResponse, data );
    }
    var tabId = isSummaryTable( data );
    if(  tabId  !== 'tc_xrt_summary_table' ) {
        eventBus.publish( 'requirementDocumentation.selectionChangedinCkEditor', { isSelected: false } );
    }
};

/**
 * Get the context
 *
 * @param {String} name - the context name
 * @return {Object} the context
 */
export let getContext = function( name ) {
    return appCtxSvc.getCtx( name );
};

/**
 * Get the markup context, if not found, register a new one
 */
export let getMarkupContext = function() {
    var markupCtx = exports.getContext( 'markup' );
    if ( !markupCtx ) {
        appCtxSvc.registerCtx( 'markup', {} );
    }
    return exports.getContext( 'markup' );
};

/**
 * Show the Markup panel
 */
export let _setShowMarkupsValue = function( visible ) {
    var markupCtx = exports.getMarkupContext();
    markupCtx.showMarkups = visible;
};

/**
 * Show the Markup panel
 */
export let showPanel = function( data ) {
    var markupCtx = exports.getMarkupContext();
    _setShowMarkupsValue( false );
    markupCtx.showPanel = true;
    _setShowMarkupsValue( true );
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( data.subPanelContext.pageContext.secondaryActiveTabId === 'tc_xrt_summary_table' && !widePanelCtx ) {
        exports.setContext( data );
    } else {
        ckeditorOperations.showPanelforComments( markupCtx );
    }
};

/**
 * Hide the Markup panel
 */
export let hidePanel = function() {
    var markupCtx = exports.getMarkupContext();
    markupCtx.showPanel = false;
    ckeditorOperations.endCommentEdit();
    eventBus.publish( 'requirementDocumentation.selectionChangedinCkEditor', { isSelected: false } );
};

/**
 * Show Markups even without the Markup panel, toggle true and false
 */
export let showMarkups = function() {
    _setShowMarkupsValue( true );
};

/**
 * Process Markups
 *
 * @param {Object} response - The soa response
 * @return {Object} the markup data
 */
export let processMarkups = function( response, data ) {
    exports.setLoginUser();
    var isCk5;
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    var tabId = isSummaryTable( data );
    if( tabId  !== 'tc_xrt_summary_table' ) {
        initOperation();
    }
    var markupCtx = exports.getMarkupContext();
    var message = '';
    if ( response.properties && response.properties.message ) {
        message = response.properties.message;
    }
    markupCtx.version = response.version;
    markupViewModel.processMarkups( response.version, message, response.markups );
    markupViewModel.updateMarkupList( isCk5, data );
    markupCtx.userNames = markupViewModel.findUsersToLoad();
    markupViewModel.setUserObj( '', _defaultNonTcUser );
    if ( !markupCtx.supportedTools ) {
        markupCtx.supportedTools = {};
    } else {
        markupCtx.supportedTools.highlight = false;
    }
    var viewerType = markupCtx.viewerType;
    if ( markupViewModel.canMarkup() ) {
        markupCtx.supportedTools.highlight = viewerType === 'aw-requirement-ckeditor';
    }

    if ( markupViewModel.getRole() === 'reader' ) {
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: _i18n.cancel,
            onClick: function( $noty ) {
                $noty.close();
            }
        } ];
        notyService.showWarning( _i18n.noMarkupPrivilege, buttons );
    }
    if( tabId  !== 'tc_xrt_summary_table' ) {
        markupRequirement.setRevealed( true );
        markupRequirement.showCurrentPage();
    }

    if ( markupCtx.showPanel ) {
        eventBus.publish( 'Arm0Markup.callDataProvider' );

        if ( markupCtx.userNames.length > 0 ) {
            eventBus.publish( 'Arm0Markup.loadUsers' );
        }

        // the markup is currently selected before showPanel
        if ( markupCtx.currentSelection && markupCtx.currentSelection.visible ) {
            listEvalAsync( function() {
                selectInDataProvider( markupCtx.currentSelection, true );
                scrollIntoView( markupCtx.currentSelection, data );
            } );
        }
    }
    return markupViewModel.getMarkupList();
};

/**
 * Process Users
 *
 * @param {Object} response - The soa response
 */
export let processUsers = function( response ) {
    if ( response && response.result ) {
        response.result.forEach( function( mo ) {
            var userObj = cdm.getObject( mo.uid );
            if ( userObj ) {
                setUserIcon( userObj );
                markupViewModel.setUserObj( userObj.props.user_id.dbValues[0], userObj );
            }
        } );
    }
};

/**
 * Select the markup if it is in the markupList
 *
 * @param {object} markup - the markup to be selected
 * @param {boolean} toScroll - true to scroll into view
 */
export let selectMarkup = function( markup, toScroll, data ) {
    var markupCtx = exports.getMarkupContext();
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( markup.visible && markup !== markupCtx.currentSelection ) {
        if ( markupCtx.showPanel ) {
            selectInDataProvider( markup, true, data );
            if ( toScroll && data.subPanelContext.activeTab.pageId !== 'tc_xrt_summary_table' || widePanelCtx ) {
                scrollIntoView( markup, data );
            }
        } else if ( data.subPanelContext.activeTab.pageId === 'tc_xrt_summary_table' && !widePanelCtx ) {
            exports.markupSelected( { selectedObjects: [ markup ] } );
        } else {
            ckeditorOperations.markupSelected( { selectedObjects: [ markup ] } );
        }
    }
};

/**
 * Unselect the current selection
 */
export let unselectCurrent = function( data ) {
    var markupCtx = exports.getMarkupContext();
    if ( markupCtx.currentSelection && markupCtx.currentSelection.visible ) {
        markupCtx.previousSelection = markupCtx.currentSelection;
        if ( markupCtx.showPanel ) {
            selectInDataProvider( markupCtx.currentSelection, false, data );
        } else {
            ckeditorOperations.markupSelected( { selectedObjects: [] } );
        }
    } else {
        markupCtx.previousSelection = null;
    }
};

/**
 * Select the previous selection
 *
 */
export let selectPrevious = function() {
    var markupCtx = exports.getMarkupContext();
    if ( markupCtx.previousSelection && markupCtx.previousSelection.visible ) {
        exports.selectMarkup( markupCtx.previousSelection, true );
    } else {
        markupCtx.previousSelection = null;
    }
};

/**
 * Markup in tool panel is selected or unselected
 *
 * @param {EventData} eventData - the eventData
 */
export let markupSelected = function( data ) {
    if ( data.eventData ) {
        var markupCtx = exports.getMarkupContext();
        var selected = data.eventData.selectedObjects.length > 0 ? data.eventData.selectedObjects[0] : null;
        var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
        if ( selected !== markupCtx.currentSelection ) {
            if ( markupCtx.currentSelection && markupCtx.currentSelection.visible ) {
                if ( data.subPanelContext.pageContext.secondaryActiveTabId !== 'tc_xrt_summary_table' || widePanelCtx ) {
                    markupRequirement.showAsSelected( markupCtx.currentSelection, 1 );
                }
                markupCtx.currentSelection = null;
            }

            if ( selected && selected.date ) {
                if ( data.subPanelContext.pageContext.secondaryActiveTabId !== 'tc_xrt_summary_table' || widePanelCtx  ) {
                    markupRequirement.showAsSelected( selected, 0 );
                    markupRequirement.ensureVisible( selected );
                }
                markupCtx.currentSelection = selected;
            }
        }
        if ( selected ) {
            var reqMarkupCtx = exports.getContext( 'reqMarkupCtx' );
            reqMarkupCtx.markupCellCommands = {};
            reqMarkupCtx.markupCellCommands.isEditable = markupViewModel.isEditable( selected );
            reqMarkupCtx.markupCellCommands.isDeletable = markupViewModel.isDeletable( selected );
            if ( !selected.groupName ) {
                reqMarkupCtx.markupCellCommands.isReplyable = markupViewModel.isReplyable( selected );
                if ( data.subPanelContext.pageContext.secondaryActiveTabId !== 'tc_xrt_summary_table' || widePanelCtx ) {
                    scrollIntoViewForComment( selected, data );
                }
            } else {
                reqMarkupCtx.markupCellCommands.isReplyable = false;
            }
            var commentNameString = selected.comment;
            if ( commentNameString !== '' ) {
                var divEle = document.createElement( 'DIV' );
                divEle.innerHTML = commentNameString;
                var commentName = divEle.firstChild.textContent;
                reqMarkupCtx.commentName = commentName;
                appCtxSvc.updateCtx( 'reqMarkupCtx', reqMarkupCtx );
            }
        }
    }
};

/**
 * Update the markup list
 */
export let updateMarkupList = function( isCk5, data ) {
    exports.unselectCurrent( data );
    var markupList = markupViewModel.updateMarkupList( isCk5, data );
    listUpdate( markupList, data );
    listEvalAsync( function() {
        exports.selectPrevious();
    } );
};

/**
 * Toggle group between expanded and collapsed
 *
 * @param {Group} group - The group to be toggled
 * @param {data} data - The view model data
 */
export let toggleGroup = function( group, data ) {
    var eventData = data.eventMap['Arm0Markup.handleToggle'];
    eventData = eventData.groupData;
    if ( group && group.groupName && eventData && eventData.groupName &&
        eventData.groupName.toLowerCase() === group.groupName.toLowerCase() ) {
        exports.unselectCurrent( data );
        var markupList = markupViewModel.toggleGroup( group, data );
        listUpdate( markupList, data );
    }
};

/**
 * Select a tool, if it is the current tool, unselect it. If null, unselect all.
 *
 * @param {String} tool - the tool to be selected
 */
export let selectTool = function( tool ) {
    var markupCtx = exports.getMarkupContext();
    var newTool = tool === markupCtx.selectedTool ? null : tool;
    markupRequirement.setTool( newTool );
    markupCtx.selectedTool = newTool;

    if ( newTool === 'highlight' ) {
        // For preselected text, add a new markup
        selectionEndCallback( 'highlight' );
    }
};

/**
 * Reply a markup
 */
export let replyMarkup = function() {
    var markupCtx = exports.getMarkupContext();
    var replyMarkup = markupViewModel.addReplyMarkup( markupCtx.currentSelection );
    if ( replyMarkup ) {
        var swaCtx = appCtxSvc.getCtx( 'xrtPageContext' );
        var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
        if ( swaCtx.secondaryXrtPageID !== 'tc_xrt_summary_table' || widePanelCtx  ) {
            exports.selectTool( null );
        }

        var markupList = markupViewModel.getMarkupList();
        listUpdate( markupList );
        listEvalAsync( function() {
            exports.selectMarkup( replyMarkup, true );
        } );

        markupCtx.currentEdit = replyMarkup;
        eventBus.publish( 'awPanel.navigate', {
            destPanelId: 'Arm0MarkupEdit',
            title: _i18n.reply,
            supportGoBack: true,
            recreatePanel: true
        } );
    }
};

/**
 * Event handler on tab selected: 'all', 'user', 'date', or 'status'
 *
 * @param {Data} data - the input data
 */
export let onTabSelected = function( data ) {
    var key;
    for( let i = 0; i < 4; i++ ) {
        if( data.tabsModel.dbValue[i].selectedTab === true ) {
            key = data.tabsModel.dbValue[i].tabKey;
        }
    }
    if ( data._internal.panelId === 'Arm0Markup' && data.selectedTab ) {
        //var key = data.selectedTab.tabKey;
        if ( key === 'all' || key === 'user' || key === 'date' || key === 'status' ) {
            sortMarkupList( key, data );
            data.markupList = markupViewModel.getMarkupList();
            data.markupList.forEach( function( m ) {
                initMarkupCell( m, _i18n );
            } );
        }
    }
};

/**
 * Get the current sortBy
 *
 * @return {String} the current sortBy: 'all', 'user', 'date', or 'status'
 */
export let getSortBy = function() {
    return markupViewModel.getSortBy();
};

/**
 * Filter markups
 *
 * @param {Data} data - the input data
 * @returns {MarkupList} the markup list
 */
export let filterMarkups = function( data ) {
    var isCk5;
    if ( markupViewModel.setFilter( data.filterBox.dbValue ) ) {
        exports.updateMarkupList( isCk5, data );
    }

    data.markupList = markupViewModel.getMarkupList();

    data.markupList.forEach( m => {
        initMarkupCell( m );
    } );
    return data.markupList;
};

/**
 * Set login user
 *
 * @param {String} userid - the user id
 * @param {String} username - the user name
 */
export let setLoginUser = function( isck5, userid, username ) {
    if ( userid && username ) {
        markupViewModel.setLoginUser( userid, username );
    } else {
        var session = exports.getContext( 'userSession' );
        if ( session ) {
            var userId = session.props.user_id.dbValues[0];
            var userName = session.props.user.uiValues[0].replace( /\s*\(.+\)$/, '' );
            markupViewModel.setLoginUser( userId, userName );
            if ( isck5 ) {
                var found = markupData.findUser( userId );
                if ( !found ) {
                    markupData.addUser( userId, userName, userId );
                }
            }
        }
    }
};

/**
 * Delete the current markup
 */
export let deleteMarkup = function( data ) {
    var markupCtx = exports.getMarkupContext();
    var isCk5;
    if ( markupCtx.currentSelection ) {
        markupViewModel.deleteMarkup( markupCtx.currentSelection );
        exports.updateMarkupList( isCk5, data );
        saveMarkups( markupCtx.currentSelection );
    }
};

/**
 * Edit the current markup
 */
export let editMarkup = function( data ) {
    var markupCtx = exports.getMarkupContext();
    if ( markupCtx.currentSelection ) {
        markupCtx.currentEdit = markupCtx.currentSelection;
        markupCtx.currentEdit.editMode = 'edit';

        eventBus.publish( 'awPanel.navigate', {
            destPanelId: 'Arm0MarkupEdit',
            title: _i18n.edit,
            supportGoBack: true,
            recreatePanel: true,
            subPanelContext:data.subPanelContext
        } );
    }
};

/**
 * Start Edit the current markup
 *
 * @param {Data} data - the input data
 */
export let startMarkupEdit = function( data ) {
    var markupCtx = exports.getMarkupContext();
    if ( markupCtx.currentEdit ) {
        markupCtx.needUpdateHtml = false;
        markupCtx.needUpdateGeom = false;

        data.markup = markupCtx.currentEdit;
        data.saveButtonText = data.markup.editMode === 'new' ? data.i18n.create :
            data.markup.editMode === 'reply' ? data.i18n.reply : data.i18n.save;
        awEditorService.create( 'mrkeditor', {
            toolbar: [
                'Bold', 'Italic', '|',
                'FontFamily', 'FontSize', '|',

                'FontColor', 'FontBackgroundColor', '|',
                'Alignment', 'ImageUpload'
            ],


            linkShowTargetTab: false,
            toolbarCanCollapse: false,
            skin: 'moono_cus',
            height: 250,
            language: _i18n._locale,
            extraPlugins: [ 'clientImage' ],
            removePlugins: [ 'resize', 'flash', 'save', 'iframe', 'pagebreak', 'horizontalrule', 'elementspath', 'div', 'scayt', 'wsc' ],
            allowedContent: 'p img div span br strong em table tr td[*]{*}(*)'
        } ).then( cke => {
            if ( 'CKEDITOR' in window ) {
                // Add override CSS styles for inside editable contents area for iPad.
                CKEDITOR.addCss( '@media only screen and (min-device-width : 768px) and (max-device-width : 1024px) { html { background-color: #eeeeee; }}' );
            }
            ckeEditor = cke;
            cke.setData( data.markup.comment );
        } );

        if ( data.markup.status !== 'open' ) {
            data.status.dbValue = data.markup.status;
        }

        data.showOnPageVisible = data.markup.status === 'open' && data.markup.type === '2d';
        data.showOnPage.dbValue = data.markup.showOnPage ? data.markup.showOnPage : 'none';

        if ( data.shareAs && data.shareAsValues ) {
            var shareWords = data.markup.share.split( ' ' );
            data.shareAs.dbValue = shareWords[0];

            if ( markupViewModel.getRole() !== 'author' ) {
                data.shareAsValues.dbValue.splice( 3, 1 );
                data.shareAsValues.dbValue.splice( 1, 1 );
            }

            var users = markupViewModel.getUsers();
            for ( var i = 0; i < users.length; i++ ) {
                var usr = $.extend( {}, data.shareWith );
                usr.propertyDisplayName = users[i].displayname;
                usr.userId = users[i].userid;
                usr.dbValue = i === 0 || shareWords.indexOf( users[i].userid ) > 0;
                usr.isEnabled = i > 0;

                data.shareWithValues.push( usr );
            }
        }
        markupCtx.origMarkup = _.cloneDeep( markupCtx.currentEdit );
        return {
            markup : data.markup,
            saveButtonText :data.saveButtonText
        };
    }
};

/**
 * Save the edited current markup
 *
 * @param {Data} data - the input data
 */
export let saveMarkupEdit = function( data, isCk5 ) {
    if ( data.markup ) {
        var markupCtx = exports.getMarkupContext();
        var dirty = markupCtx.currentEdit.editMode !== 'edit';
        if ( ckeEditor ) {
            var newComment = ckeEditor.getData();
            newComment = newComment.replace( /<em>/g, '<em style="font-style: italic;">' );
            if ( newComment !== data.markup.comment ) {
                data.markup.comment = newComment;
                dirty = true;
                appCtxSvc.registerCtx( 'requirementEditorContentChanged', true );
            }
        }

        if ( data.markup.status !== 'open' && data.markup.status !== data.status.dbValue ) {
            data.markup.status = data.status.dbValue;
            dirty = true;
        }

        if ( data.shareAs ) {
            var newShare = data.shareAs.dbValue;
            if ( newShare === 'users' ) {
                for ( var i = 0; i < data.shareWithValues.length; i++ ) {
                    if ( data.shareWithValues[i].dbValue ) {
                        newShare += ' ' + data.shareWithValues[i].userId;
                    }
                }
            }

            if ( newShare !== data.markup.share ) {
                data.markup.share = newShare;
                dirty = true;
            }
        }
        if ( dirty ) {
            data.markup.date = new Date();
            saveMarkups( data.markup );
        }
        var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
        if ( !isCk5 && data.markup.editMode !== 'reply' && data.subPanelContext.pageContext.secondaryActiveTabId !== 'tc_xrt_summary_table' || widePanelCtx ) {
            var markupText = ckeditorOperations.getMarkupTextInstance();
            if ( markupText ) {
                markupText.recalcAllMarkupPositions();
            }
        }
        data.markup.editMode = 'saved';

        var reqMarkupCtx = exports.getContext( 'reqMarkupCtx' );
        if ( reqMarkupCtx ) {
            var divEle = document.createElement( 'DIV' );
            divEle.innerHTML = data.markup.comment;
            var commentName = divEle.firstChild.textContent;
            reqMarkupCtx.commentName = commentName;
            appCtxSvc.updateCtx( 'reqMarkupCtx', reqMarkupCtx );
        }

        var markupCtx = exports.getMarkupContext();
        if ( markupCtx.showPanel ) {
            eventBus.publish( 'awPanel.navigate', { destPanelId: 'Arm0Markup' } );
            eventBus.publish( 'Arm0Markup.callDataProvider' );
        } else {
            eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
            if ( !isCk5 ) {
                clearMarkups();
            }
        }
        if ( isCk5 ) {
            var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
            var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
            var commentMarker = editor.model.markers._markers.get( data.markup.reqData.commentid );
            if ( commentMarker ) {
                updateStyle( editor, commentMarker._liveRange, false );
            }
        }
    }
};

/**
 * Event handler for showOnPage option changed
 *
 * @param {Data} data - the data
 */
export let showOnPageChanged = function( data ) {
    var markupCtx = exports.getMarkupContext();
    var newValue = data.showOnPage.dbValue === 'none' ? undefined : data.showOnPage.dbValue;
    if ( newValue !== data.markup.showOnPage ) {
        if ( ckeEditor ) {
            data.markup.comment = ckeEditor.getData();
        }
        data.markup.showOnPage = newValue;
        markupCtx.needUpdateHtml = true;
    }
};

/**
 * End the current markup edit
 *
 * @param {Data} data - the data
 */
export let endMarkupEdit = function( data ) {
    var markupCtx = exports.getMarkupContext();
    var isCk5;
    if ( markupCtx.currentEdit ) {
        if ( markupCtx.currentEdit.editMode === 'new' || markupCtx.currentEdit.editMode === 'reply' ) {
            // if create/reply button is not clicked, delete it
            markupCtx.currentEdit.editMode = null;
            markupViewModel.deleteMarkup( markupCtx.currentEdit );
            exports.updateMarkupList( isCk5, data );
        }

        markupCtx.currentEdit.editMode = null;
        markupViewModel.updateMarkupList( isCk5, data );
        markupCtx.currentEdit = null;
        markupCtx.selectedTool = null;
        var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
        var tabId = isSummaryTable( data );
        if (   tabId   !== ( 'tc_xrt_summary_table' || widePanelCtx ) ) {
            scrollIntoView( markupCtx.currentEdit, data );
            markupRequirement.showCurrentPage();
            markupRequirement.setTool( null );
            markupCanvas.setPositionMarkup( null );
            eventBus.publish( 'requirementDocumentation.selectionChangedinCkEditor', { isSelected: false } );
        }
    }
};

/**
 * Handle ShareAs changed
 *
 * @param {Data} data - the input data
 * @returns {Promise} - the promise
 */
export let shareAsChanged = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    if ( data.shareAs.dbValue === 'official' ) {
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Handle Cancel Official
 * @param {Data} data - the data
 */
export let cancelOfficial = function( data ) {
    data.shareAs.dbValue = data.shareAs.dbOriginalValue;
    data.shareAs.uiValue = data.shareAs.uiOriginalValue;
};

/**
 * Get the list scope
 * @returns {Scope} the scope
 */
export let getListScope = function() {
    return $( 'aw-list-filter[dataprovider="data.dataProviders.visibleMarkups"] ul' ).scope();
};

/**
 * Get scope when list not visible
 * @returns {Scope} the scope
 */
export let getScopeWhenListNotVisible = function() {
    return $( 'img[src="assets/image/cmdHighlight24.svg"][class="aw-base-icon"]' ).scope();
};

/************************************************************************************************************************
* This section contains methods related to comments in ckeditor 5
************************************************************************************************************************/

/**
*
*/
export let showPanelforComments = function() {
    var markupCtx = exports.getMarkupContext();
    var userNames = [];
    markupData.users.forEach(
        function( user ) {
            userNames.push( user.username );
        }
    );
    markupCtx.userNames = userNames;
    markupViewModel.setUserObj( '', _defaultNonTcUser );
    if ( markupCtx.showPanel ) {
        eventBus.publish( 'Arm0Markup.callDataProvider' );
        if ( markupCtx.userNames.length > 0 ) {
            eventBus.publish( 'Arm0Markup.loadUsers' );
        }
        //markupViewModel.sortMarkupList();
        var markupList = markupViewModel.getMarkupList();
        var reqMarkupCtx = appCtxSvc.getCtx( 'reqMarkupCtx' );
        if ( reqMarkupCtx && reqMarkupCtx.viewerType === 'aw-requirement-ckeditor' ) {
            var flagForComments;
            flagForComments = markupList.length <= 0;
            reqMarkupCtx.flagForComments = flagForComments;
            appCtxSvc.updateCtx( 'reqMarkupCtx', reqMarkupCtx );
        }
        // the markup is currently selected before showPanel
        if ( markupCtx.currentSelection && markupCtx.currentSelection.visible ) {
            listEvalAsync( function() {
                selectInDataProvider( markupCtx.currentSelection, true );
                scrollIntoView( markupCtx.currentSelection );
            } );
        }
    }
};

/**
 * Save the edited current markup
 *
 * @param {Data} data - the input data
 */
export let endCommentEdit = function( data ) {
    var markupCtx = exports.getMarkupContext();
    if ( markupCtx.currentEdit ) {
        if ( markupCtx.currentEdit.editMode === 'new' || markupCtx.currentEdit.editMode === 'reply' ) {
            // if create/reply button is not clicked, delete it
            markupCtx.currentEdit.editMode = null;
            markupViewModel.deleteMarkup( markupCtx.currentEdit, true );
            if ( markupCtx.currentEdit.editMode !== 'reply' ) {
                deleteMarkupForCKeditor5( markupCtx.currentEdit );
            }
            exports.updateMarkupList( true, data );
        }
        markupCtx.currentEdit.editMode = null;
        scrollIntoView( markupCtx.currentEdit, data );
        ensureCommentEditSuccessful( markupCtx.currentEdit );
        markupViewModel.updateMarkupList( true, data );
        markupCtx.currentEdit = null;
        markupCtx.selectedTool = null;
        eventBus.publish( 'requirementDocumentation.selectionChangedinCkEditor', { isSelected: false } );
    }
};


/**
 * ensureCommentEditSuccessful
 *
 * @param {Data} markup - the input markup
 */
function ensureCommentEditSuccessful( markup ) {
    markupViewModel.ensureCommentEditSuccessful( markup );
}

/**
 * Save the edited current markup
 *
 * @param {Data} eventData - the input data
 */
export let commentSelected = function( eventData ) {
    if ( eventData ) {
        var markupCtx = exports.getMarkupContext();
        var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        var selected = eventData.selectedObjects.length > 0 ? eventData.selectedObjects[0] : null;
        if ( selected !== markupCtx.currentSelection ) {
            if ( markupCtx.currentSelection && markupCtx.currentSelection.visible ) {
                markupCtx.currentSelection = null;
            }
            if ( selected && selected.date ) {
                markupCtx.currentSelection = selected;
            }
        }
        if ( selected ) {
            if ( selected.reqData && selected.reqData.commentid ) {
                var selectedid = selected.reqData.commentid;
            }
            var reqMarkupCtx = exports.getContext( 'reqMarkupCtx' );
            reqMarkupCtx.markupCellCommands = {};
            if ( selected.reqData && selected.reqData.parentCommentid ) {
                var commentMarker = editor.model.markers._markers.get( selected.reqData.parentCommentid );
                if ( commentMarker ) {
                    updateStyle( editor, commentMarker._liveRange, true, selectedid );
                }
                reqMarkupCtx.markupCellCommands.isEditable = markupViewModel.isCommentEditable( selected );
                reqMarkupCtx.markupCellCommands.isDeletable = markupViewModel.isCommentDeletable( selected );
                reqMarkupCtx.markupCellCommands.isReplyable = markupViewModel.isCommentReplyable( selected );
            } else {
                reqMarkupCtx.markupCellCommands.isEditable = markupViewModel.isCommentEditable( selected );
                reqMarkupCtx.markupCellCommands.isDeletable = markupViewModel.isCommentDeletable( selected );
                if ( !selected.groupName ) {
                    var commentMarker = editor.model.markers._markers.get( selected.reqData.commentid );
                    var lastSelectedComment = editor.model.markers._markers.get( lastSelectedCommentId );
                    if ( lastSelectedCommentId && lastSelectedComment && lastSelectedCommentId !== selectedid ) {
                        updateStyle( editor, lastSelectedComment._liveRange, false, lastSelectedCommentId );
                    }
                    if ( commentMarker ) {
                        updateStyle( editor, commentMarker._liveRange, true, selectedid );
                    }
                    lastSelectedCommentId = selectedid;
                    reqMarkupCtx.markupCellCommands.isReplyable = markupViewModel.isCommentReplyable( selected );
                    scrollIntoViewForComment( selected, eventData );
                } else {
                    reqMarkupCtx.markupCellCommands.isReplyable = false;
                }
            }
            var commentNameString = selected.comment;
            if ( commentNameString !== '' ) {
                var divEle = document.createElement( 'DIV' );
                divEle.innerHTML = commentNameString;
                var commentName = divEle.firstChild.textContent;
                reqMarkupCtx.commentName = commentName;
                appCtxSvc.updateCtx( 'reqMarkupCtx', reqMarkupCtx );
            }
        } else {
            var lastSelectedCommentMarker = editor.model.markers._markers.get( lastSelectedCommentId );
            if ( lastSelectedCommentMarker ) {
                updateStyle( editor, lastSelectedCommentMarker._liveRange, false, lastSelectedCommentId );
            }
        }
    }
};

/**
 * Delete the current markup
 */
export let deleteComment = function() {
    var markupCtx = exports.getMarkupContext();
    if ( markupCtx.currentSelection ) {
        deleteMarkupForCKeditor5( markupCtx.currentSelection );
        markupViewModel.deleteMarkup( markupCtx.currentSelection, true );
        exports.updateMarkupList( true );
        saveMarkups( markupCtx.currentSelection );
    }
};

/**
 * shows the current selected markup
 */
export let markupSelectedInPanel = function( data ) {
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( data.subPanelContext.pageContext.secondaryActiveTabId === 'tc_xrt_summary_table' && !widePanelCtx ) {
        exports.markupSelected( data );
    } else {
        ckeditorOperations.markupSelected( data );
    }
};

/**
 * saves the comment
 */
export let saveCommentEditInPanel = function( data ) {
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( data.subPanelContext.pageContext.secondaryActiveTabId === 'tc_xrt_summary_table' && !widePanelCtx ) {
        exports.saveMarkupEdit( data );
    } else {
        ckeditorOperations.saveCommentEdit( data );
    }
};

/**
 * exits the editing panel
 */
export let endCommentEditInPanel = function( data ) {
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( data.subPanelContext.pageContext.secondaryActiveTabId === 'tc_xrt_summary_table' && !widePanelCtx ) {
        exports.endMarkupEdit( data );
    } else {
        ckeditorOperations.endCommentEdit( data );
    }
};


/**
 * deletes the comment
 */
export let deleteCommentEditInPanel = function() {
    var swaCtx = appCtxSvc.getCtx( 'xrtPageContext' );
    var widePanelCtx = appCtxSvc.getCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    if ( swaCtx.secondaryXrtPageID === 'tc_xrt_summary_table' && !widePanelCtx ) {
        exports.deleteMarkup();
    } else {
        ckeditorOperations.deleteComment();
    }
};

/**
 * Delete the comment marker  deleteMarkupForCKeditor5
 */
function deleteMarkupForCKeditor5( markup ) {
    if ( markup && markup.reqData && !markup.reqData.parentCommentid && !markup.reqData.parentCommentid !== '' ) {
        var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        var commentMarker = editor.model.markers._markers.get( markup.reqData.commentid );
        var markupSpan = document.getElementById( markup.reqData.commentid );
        var markupText = ckeditorOperations.getMarkupTextInstance();
        if ( markupText && markupSpan ) {
            markupText.setMarkupEventListeners( markupSpan, true );
        }
        if ( commentMarker && commentMarker._liveRange ) {
            editor.model.change( writer => {
                try {
                    writer.removeAttribute( 'spanId', commentMarker._liveRange );
                    writer.removeAttribute( 'spanStyle', commentMarker._liveRange );
                    var ranges = [ ...commentMarker._liveRange.getItems() ];
                    for ( const item of ranges ) {
                        var textNode = item.textNode;
                        if ( textNode ) {
                            var itemData = item.data;
                            var textNodeData = textNode._data;
                            if ( itemData === textNodeData ) {
                                writer.removeAttribute( 'spanStyle', textNode );
                            }
                        }
                    }
                    writer.removeMarker( commentMarker );
                } catch ( error ) {
                    // Nothing to do. Failed to remove the marker.
                }
            } );
        }
    }
}

/**
 * Get status of comments
 * @param {markup} - markup
 */
export let getStatusComments = function( markup, _markupTextInstance ) {
    var list = [];
    if ( _markupTextInstance ) {
        list = _markupTextInstance.getKey( markup );
    }
    return list && list.length > 1 ? list[list.length - 1].status : 'open';
};

/**
 * Method to find whether Ranges are overlapping
 * @param {Range} newCommentRange the olde range
 * @param {Range} oldCommentRange the new range
 * @returns {Boolean} the boolean
 */
function isNestedOrOverlappedComment( newCommentRange, oldCommentRange ) {
    if ( newCommentRange && oldCommentRange ) {
        return newCommentRange.containsRange( oldCommentRange, { loose: true } );
    }
}


/**
 *
 * @param {CKEDITOR} editor the ckeditor instance
 * @param {Range} range the eckedotr range to update
 */
function updateStyle( editor, range, isHighlight, commentId ) {
    var foundItems = [];
    var markup = markupViewModel.getComment( commentId );
    var user = markupViewModel.getUser( markup );
    var faintColor = 'background-color:' + user.color;
    var darkcolor = 'background-color:' + user.darkColor;
    for ( const item of range.getItems() ) {
        foundItems.push( item );
    }
    for ( var i = 0; i < foundItems.length; i++ ) {
        var foundItem = foundItems[i];
        editor.model.change( writer => {
            var textNode = foundItem.textNode;
            if ( textNode ) {
                var rangeData = foundItem.data;
                var textData = foundItem.textNode.data;
                if ( rangeData === textData ) {
                    if ( textNode ) {
                        var style = textNode._attrs.get( 'spanStyle' );
                        if ( !style ) {
                            style = '';
                        }
                        var colorIndex = -1;
                        if ( isHighlight ) {
                            colorIndex = style.indexOf( faintColor );
                            if ( colorIndex !== -1 ) {
                                style = style.replace( faintColor, darkcolor );
                            } else {
                                colorIndex = style.indexOf( darkcolor );
                                if ( colorIndex === -1 ) {
                                    if ( style !== '' && !style.endsWith( ';' ) ) {
                                        style += ';';
                                    }
                                    style += darkcolor;
                                }
                            }
                            //style = updateBorder( style, true, i, total );
                        } else {
                            colorIndex = style.indexOf( darkcolor );
                            if ( colorIndex !== -1 ) {
                                style = style.replace( darkcolor, faintColor );
                            } else {
                                colorIndex = style.indexOf( faintColor );
                                if ( colorIndex === -1 ) {
                                    if ( style !== '' && !style.endsWith( ';' ) ) {
                                        style += ';';
                                    }
                                    style += darkcolor;
                                }
                            }
                            //style = updateBorder( style, false, i, total );
                        }
                        writer.setAttribute( 'spanStyle', style, textNode );
                    }
                } else {
                    const doc = editor.model.document;
                    const root = doc.getRoot();
                    var path = foundItem.getPath();
                    var endPath = _.clone( path );
                    endPath[endPath.length - 1] = foundItem.endOffset;
                    const startPos = writer.createPositionFromPath( root, foundItem.getPath(), 'toNext' );
                    const endPos = writer.createPositionFromPath( root, endPath, 'toPrevious' );
                    const currentRange = writer.createRange( startPos, endPos );

                    writer.setAttribute( 'spanStyle', darkcolor, currentRange );
                }
            }
        } );
    }
}

/****************** Comment Plugin Related Code *************************************/

/**
 * Create comment using comment plugin
 */
export let executeNewCommentPlugin = function() {
    var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
    if ( editorId ) {
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        if ( editor ) {
            const sidebarElement = document.querySelector( AW_REQ_SIDEBAR );
            if ( sidebarElement && sidebarElement.style && sidebarElement.style.display
                && sidebarElement.style.display === 'none' || sidebarElement.style.display === '' ) {
                sidebarElement.style.display = 'block';
                appCtxSvc.registerCtx( 'ckeditorSidebar', { isOpen: true }  );
                refreshCommentsSidebar( editor );
            }
            editor.execute( 'addCommentThread' );
            eventBus.publish( 'ckeditor.enableNewCommentCommand', false );
        }
    }
};

/**
 * Invoke the ckeditor's sidebar
 */
export let invokeCkeditorSidebar = function() {
    const sidebarElement = document.querySelector( AW_REQ_SIDEBAR );
    if ( sidebarElement ) {
        var value = sidebarElement.style.display;
        if ( value === 'block' ) {
            sidebarElement.style.display = 'none';
            appCtxSvc.updateCtx( 'ckeditorSidebar', { isOpen: false } );
        } else {
            sidebarElement.style.display = 'block';
            appCtxSvc.updateCtx( 'ckeditorSidebar', { isOpen: true } );
        }
    }
};

/**
 * Function to add scroll event on editor content area, to update sidebar
 * @param {Object} editor - Editor instance
 */
function refreshCommentsSidebar( editor ) {
    if( editor ) {
        const annotationsUIs = editor.plugins.get( 'AnnotationsUIs' );
        if( annotationsUIs.isActive( 'wideSidebar' ) ) {
            annotationsUIs.switchTo( 'wideSidebar' );
        } else if( annotationsUIs.isActive( 'narrowSidebar' ) ) {
            annotationsUIs.switchTo( 'narrowSidebar' );
        }
    }
}

/**
 * Hide the toolbar
 */
export let hideCkeditorSidebar = function() {
    const sidebarElement = document.querySelector( AW_REQ_SIDEBAR );
    if ( sidebarElement ) {
        sidebarElement.style.display = 'none';
    }
};

/**
 * Enable the sidebar and mark command as selected
 */
export let enableCkeditorSidebar = function() {
    const sidebarElement = document.querySelector( AW_REQ_SIDEBAR );
    if ( sidebarElement ) {
        sidebarElement.style.display = 'block';
        appCtxSvc.registerCtx( 'ckeditorSidebar', { isOpen: true } );
    }
};

/**
 * Activate/Deactivate Track changes
 */
export let executeTrackChangeAction = function() {
    var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
    if ( editorId ) {
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        if ( editor ) {
            if ( editor.plugins._availablePlugins.has( 'TrackChanges' ) ) {
                var trackChanges = appCtxSvc.getCtx( 'trackChanges' );
                if ( trackChanges && trackChanges.isOn ) {
                    trackChanges = { isOn: false };
                    appCtxSvc.updateCtx( 'trackChanges', trackChanges );
                } else if ( trackChanges && !trackChanges.isOn ) {
                    trackChanges = { isOn: true };
                    appCtxSvc.updateCtx( 'trackChanges', trackChanges );
                }
                _toggleCommandEnablement( editor, 'insertTable', !trackChanges.isOn );
                editor.execute( 'trackChanges' );
                // editor.execute( 'acceptSuggestion', 'suggestion-1' );
                // editor.execute( 'discardSuggestion', 'suggestion-1' );
            }
        }
    }
};

/**
 * disable to enable given editor command
 *
 * @param {*} editor editor
 * @param {*} cmdId command id
 * @param {*} enable enable or disable
 */
function _toggleCommandEnablement( editor, cmdId, enable ) {
    if( editor ) {
        let cmd = editor.commands.get( cmdId );
        if( cmd ) {
            if( enable ) {
                cmd.off( 'set:isEnabled', forceDisable );
            } else {
                cmd.on( 'set:isEnabled', forceDisable, { priority: 'highest' } );
            }
            cmd.isEnabled = enable;
        }
    }
}

/** Function to force disable event */
function forceDisable( evt ) {
    evt.return = false;
    evt.stop();
}

/**
 * Perform review action on track changes
 * @param {String} type - Type of the action of review
 */
export let executeTrackChangesReviewAction = function( type ) {
    var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
    if ( editorId ) {
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        if ( editor ) {
            switch ( type ) {
                case 'ACCEPTALL':
                    editor.execute( 'acceptAllSuggestions' );
                    break;
                case 'ACCEPTSELECTED':
                    editor.execute( 'acceptSelectedSuggestions' );
                    break;
                case 'REJECTALL':
                    editor.execute( 'discardAllSuggestions' );
                    break;
                case 'REJECTSELECTED':
                    editor.execute( 'discardSelectedSuggestions' );
                    break;
                default:
                // No action to perform
            }
        }
    }
};

/**************************************** Upto Here ********************************************************* */

//======================= private functions =========================

/**
 * Initialize MarkupRequirement
 */
function initOperation() {
    markupRequirement.init( markupData.markups, markupData.users, markupThread );
    markupRequirement.setSelectCallback( selectCallback );
    markupRequirement.setSelectionEndCallback( selectionEndCallback );
}

/**
 * Select callback
 *
 * @param {Markup} markup - the markup being selected in the left panel
 */
function selectCallback( markup ) {
    var markupCtx = exports.getMarkupContext();
    if ( !markupCtx.currentEdit && ( markupCtx.showPanel || markupCtx.showMarkups ) ) {
        if ( markupCtx.currentSelection === markup && markupCtx.viewerType !== 'aw-requirement-ckeditor' ) {
            exports.unselectCurrent();
        } else {
            exports.selectMarkup( markup, true );
        }
    }
}

/**
 * Select markup in the data provider
 *
 * @param {Markup} markup - the markup to be selected
 * @param {boolean} selected - true to select it, false to unselected it
 */
function selectInDataProvider( markup, selected, data ) {
    var index = findIndexInDataProvider( markup, data );
    if ( index >= 0 ) {
        listChangeSelection( index, selected );
    }
}

/**
 * Scroll markup into View
 *
 * @param {Markup} markup - the markup to be seen
 */
function scrollIntoView( markup, data ) {
    var index = findIndexInDataProvider( markup, data );
    if ( index >= 0 ) {
        listEvalAsync( function() {
            var el = $( 'aw-list-filter[dataprovider="data.dataProviders.visibleMarkups"] li' ).get( index );
            if ( el ) {
                el.scrollIntoView();
            }
        } );
    }
}

/**
 * Scroll comment into View
 *
 * @param {Markup} markup - the markup to be seen
 */
function scrollIntoViewForComment( markup, data ) {
    var id = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
    var index = findIndexInDataProvider( markup, data );
    if ( index >= 0 && id ) {
        var ele = ckeditorOperations.getElementById( id, markup.reqData.commentid );
        if ( ele ) {
            ele.scrollIntoView();
        }
    }
}

/**
 * List update
 * @param {MarkupList} markupList - the markup list
 */
function listUpdate( markupList, data ) {
    if( data && data.dataProviders ) {
        var dataProvider = data.dataProviders.visibleMarkups;
        dataProvider.update( markupList, markupList.length );
    }
}

/**
 * List change selection
 * @param {Number} index - the index of the item in the list
 * @param {Boolean} selected - true for selected, false for unselected
 */
function listChangeSelection( index, selected ) {
    //var scope = exports.getListScope();
    var scope;
    if ( scope && scope.dataprovider ) {
        scope.dataprovider.changeObjectsSelection( index, index, selected );
    }
}

/**
 * List evaluate async
 * @param { Function } func - the function to be evaluated
 */
function listEvalAsync( func ) {
    //var scope = exports.getListScope();
    var scope;
    if ( scope ) {
        scope.$evalAsync( func );
    } else {
        window.setTimeout( func, 10 );
    }
}

/**
 * Find the index of the markup in the data provider
 *
 * @param {Markup} markup - the markup
 * @return {Number} the index, or -1 if not found
 */
function findIndexInDataProvider( markup, data ) {
    if ( markup ) {
        //var scope = exports.getListScope();
        var list = data.visibleMarkupList;
        for ( var i = 0; i < list.length; i++ ) {
            if ( !list[i].groupName && markup.reqData.commentid === list[i].reqData.commentid ) {
                return i;
            }
        }
    }

    return -1;
}

/**
 * SelectionEndCallback, create a new markup
 *
 * @param {String} tool - the tool caused the selection end
 */
function selectionEndCallback( tool ) {
    var markupCtx = exports.getMarkupContext();
    if ( tool && tool === markupCtx.selectedTool ) {
        if ( tool === 'highlight' ) {
            var editor = appCtxSvc.getCtx( 'Arm0Requirements' );
            var newMarkup = markupViewModel.addNewMarkup();
            if ( newMarkup ) {
                markupCtx.currentEdit = newMarkup;
                var markupList = markupViewModel.getMarkupList();
                listUpdate( markupList );
                listEvalAsync( function() {
                    exports.selectMarkup( newMarkup, true );
                } );

                if ( markupCtx.showPanel ) {
                    eventBus.publish( 'awPanel.navigate', {
                        destPanelId: 'Arm0MarkupEdit',
                        title: _i18n.add,
                        supportGoBack: true,
                        recreatePanel: true
                    } );
                } else {
                    commandPanelSvc.activateCommandPanel(
                        'Arm0MarkupEditMain', 'aw_toolsAndInfo', null, false );
                }
            }
        }
    }
}

/**
 * Sort the markup list
 *
 * @param {String} sortBy - the sort by order 'all', 'user', 'date', or 'status'
 */
function sortMarkupList( sortBy, data ) {
    markupViewModel.setSortBy( sortBy );
    var markupList = markupViewModel.sortMarkupList();
    var markupCtx = exports.getMarkupContext();

    listUpdate( markupList, data );
    scrollIntoView( markupCtx.currentSelection, data );
}

/**
 * Clear markups in the left panel
 */
function clearMarkups() {
    exports.selectTool( null );
    var markupCtx = exports.getMarkupContext();
    if ( !markupCtx.supportedTools ) {
        markupCtx.supportedTools = {};
    } else {
        markupCtx.supportedTools.highlight = false;
    }
    exports.unselectCurrent();
    markupRequirement.setRevealed( false );
    markupViewModel.clearMarkupList();
    eventBus.publish( 'Arm0Markup.callDataProvider' );
}

/**
 * Save the markups
 *
 * @param {Markup} markup - the markup to be saved, or undefined for single_user
 */
function saveMarkups( markup ) {
    var json = !markup ? markupViewModel.stringifyMarkups( false ) :
        '[' + markupViewModel.stringifyMarkup( markup ) + ']';
    var msg = !markup ? 'single_user' : markup.deleted ? 'delete' :
        markup.date.toISOString() === markup.created ? 'add' : 'modify';
    eventBus.publish( 'arm0Markup.save', { json, msg } );
}
/**
 * Check if summaryTable is active
 *  @param {data} data - The view model data
 *  @return {Name} - tabId name
 */
export let isSummaryTable = function( data ) {
    return data.subPanelContext.activeTab && data.subPanelContext.activeTab.pageId  || data.subPanelContext.pageContext && data.subPanelContext.pageContext.secondaryActiveTabId;
};

/**
 * Initialize the markup cell
 *
 * @param {Markup} markup - the markup
 * @param {I18N} i18n - the i18n
 */
export let initMarkupCell = function( markup ) {
    if( markup && markup.groupName ) {
        markup.groupInfo = toI18n( markup.groupName );
    } else if( markup ) {
        var userObj = markup.userObj;
        if( userObj ) {
            markup.userImage = userObj.hasThumbnail ? userObj.thumbnailURL : userObj.typeIconURL;
        }
        markup.dateInfo = markup.date.toLocaleString();
        markup.shareInfo = toShareInfo( markup );
        markup.statusInfo = toStatusInfo( markup  );
        markup.toOneLine = convertToHtml( markup.comment );
    }
};

/**
 * Set the thumbnail and type icon for a specific user
 *
 * @param {User} user - the user object
 */
function setUserIcon( user ) {
    var thumbnailUrl = awIconService.getThumbnailFileUrl( user );
    var typeIconURL = awIconService.getTypeIconFileUrl( user );

    if ( thumbnailUrl ) {
        user.hasThumbnail = true;
    }
    user.thumbnailURL = thumbnailUrl;
    user.typeIconURL = typeIconURL;
}


let loadConfiguration = function() {
    localeSvc.getTextPromise( 'MarkupMessages', true ).then( function( textBundle ) {
        $.extend( _i18n, textBundle );
    } );

    localeSvc.getTextPromise( 'dateTimeServiceMessages', true ).then(
        function( textBundle ) {
            $.extend( _i18n, textBundle );
        } );

    _i18n._locale = localeSvc.getLocale().replace( /_/g, '-' );
};

loadConfiguration();

//======================= app factory and filters =========================

export default exports = {
    i18n,
    setContext,
    getContext,
    getMarkupContext,
    showPanel,
    hidePanel,
    showMarkups,
    processMarkups,
    processUsers,
    selectMarkup,
    unselectCurrent,
    selectPrevious,
    markupSelected,
    updateMarkupList,
    toggleGroup,
    selectTool,
    replyMarkup,
    onTabSelected,
    getSortBy,
    filterMarkups,
    setLoginUser,
    deleteMarkup,
    editMarkup,
    startMarkupEdit,
    saveMarkupEdit,
    endMarkupEdit,
    shareAsChanged,
    cancelOfficial,
    getListScope,
    showOnPageChanged,
    getScopeWhenListNotVisible,
    showPanelforComments,
    endCommentEdit,
    commentSelected,
    deleteComment,
    getStatusComments,
    markupSelectedInPanel,
    saveCommentEditInPanel,
    endCommentEditInPanel,
    deleteCommentEditInPanel,
    executeNewCommentPlugin,
    invokeCkeditorSidebar,
    hideCkeditorSidebar,
    enableCkeditorSidebar,
    executeTrackChangeAction,
    executeTrackChangesReviewAction
};

let toOneLine = ( text ) => {
    return function( text ) {
        return $( text ).text();
    };
};

let toI18n = function( text ) {
    var array = text.split( ' ' );
    var replaced = false;

    array.forEach( function( word, i ) {
        if ( _i18n[word] ) {
            array[i] = _i18n[word];
            replaced = true;
        }
    } );

    return replaced ? array.join( ' ' ) : text;
};

let toStatusInfo = function( markup ) {
    var status = ckeditorOperations.getStatusComments( markup );
    return _i18n[status];
};

let toShareInfo = function( markup ) {
    var info = '';
    if ( markup.share ) {
        var share = markup.share.split( ' ' )[0];
        info += markupViewModel.isEditable( markup ) ? _i18n.markupIsEditable : _i18n.markupIsReadonly;
        info += '\n' + _i18n.sharedAs + ' ' + _i18n[share] + ': ' + _i18n[share + 'Tip'];

        if ( share === 'users' ) {
            var userids = markup.share.split( ' ' );
            for ( var i = 1; i < userids.length; i++ ) {
                var user = markupViewModel.findUser( userids[i] );
                if ( user ) {
                    info += '\n\t' + user.displayname;
                }
            }
        }
    }

    return info;
};
