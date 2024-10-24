

// Copyright (c) 2022 Siemens

/**
 * Module for the Ckeditor5 in Requirement Documentation Page
 *
 * @module js/Arm0RequirementCkeditor5Service
 */
import { getBaseUrlPath } from 'app';
import _appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import notyService from 'js/NotyModule';
import browserUtils from 'js/browserUtils';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';
import markupService from 'js/Arm0MarkupService';
import { ckeditor5ServiceInstance, setCkeditor5Instance } from 'js/Arm0CkeditorServiceInstance';
import Arm0CkeditorConfigProvider from 'js/Arm0CkeditorConfigProvider';
import RMInsertImage from 'js/rmCkeInsertImage/rmInsertImage';
import RMImageSchemaExtender from 'js/rmCkeInsertImage/rmImageSchemaExtender';
import RMInsertOLE from 'js/rmCkeInsertOLE/rmInsertOLE';
import pageDown, { addPageDownCommand } from 'js/rmPageDownHandler/pagedown';
import pageUp, { addPageUpCommand } from 'js/rmPageUpHandler/pageup';
import RequirementWidget from 'js/rmCkeRequirementWidget/requirementWidget';
import RMCrossSelection from 'js/rmCkeCrossSelection/rmCkeCrossSelection';
import RMSpan from 'js/rmCkeSpanHandler/span';
import RMContentTable from 'js/rmCkeRMContentTable/rmContentTable';
import RMSelectionHandler from 'js/rmCkeSelectionHandler/rmSelectionHandler';
// REQ BA TODO
import Mathematics from 'js/rmCkeInsertEquation/math';
import RMSplitRequirement from 'js/rmCkeSplitRequirement/rmCkeSplitRequirement';
import RMReuseIntegration from 'js/rmCkeReuseToolIntegration/rmReuseIntegration';
import RMCrossReferenceLink from 'js/rmCkeCrossReferenceLink/crossReferenceLink';
import { ConvertDivAttributes, ConvertParaAttributes } from 'js/rmCkeAttributeHandler/rmAttributeHandler';
// REQ BA TODO
import Mention from 'js/rmCkeReuseToolIntegration/rmCkeMentionPlugin/mention';
import RMParamToReqHandler from 'js/rmCkeParamToReqHandler/rmParamToReqHandler';
import CommentsAdapter from 'js/Arm0CommentAdapter';
import CommentsAdapterCollaboration from 'js/Arm0CommentsAdapterCollaboration';
import TrackChangeAdapter from 'js/Arm0TrackChangeAdapter';
import NewCommentBaseView from 'js/Arm0CommentBaseView';
import NewCommentView from 'js/Arm0CommentView';
import RMInternalLinks from 'js/rmCkeInternalLinks/rmCkeInternalLinks';
import RMLoadingWidget from 'js/rmCkeLoadingWidget/rmLoadingWidget';
import NewSuggestionThreadView from 'js/Arm0SuggestionView';
import rmCkeditorService from 'js/Arm0CkeditorService';
import reqACEUtils from 'js/requirementsACEUtils';
import soaSvc from 'soa/kernel/soaService';
// import TrackChangeAdapter1 from 'js/Arm0TrackChangeAdapterForCollaboration';

var exports = {};

var _data;
var _cke = null;
var resizePromise;

var initCKEditorListener;
var resizeReqViewerOnCmdResizeListener;
var resizeReqViewerOnSplitterUpdateListener;
var resizeReqViewerOnSidePanelOpenListener;
var registerEventListenerToResizeEditor;
var resizeReqViewerOnInitCkeEventListener;

/**
 * Generate unique Id for Ck Editor
 *
 * @return {String} random id
 */
function _generateID() {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return 'ckeditor-instance-' + Math.random().toString( 36 ).substr( 2, 9 );
}

export let getCkeditor = function() {
    return _cke;
};

/**
 * Sets the viewer height
 *
 * @return {Void}
 */
function setEditorHeight( subPanelContext ) {
    if( !_cke || !_cke.editing || !_cke.editing.view ) {
        return;
    }
    let height = 0;
    let summaryHeaderHeight = 0;
    let isSpecExportTemplate;
    let element = document.getElementsByClassName( 'aw-richtexteditor-editorPanel' )[ 0 ];
    let summaryHeader = document.getElementsByClassName( 'aw-selection-summary-header' )[0];
    // check if summary header is present or not.
    if( summaryHeader ) {
        var selectedObject = _appCtxSvc.getCtx( 'selected' );
        isSpecExportTemplate = selectedObject.type === 'Arm0HeaderFooterRevision';
        // Get summary header viewer height if it is specification export template
        if( isSpecExportTemplate ) {
            summaryHeaderHeight = summaryHeader.offsetHeight;
        }
    }
    if( element && element.getElementsByClassName( 'ck-editor__top' ).length > 0 && element.getElementsByClassName( 'ck-content' ).length > 0 ) {
        if( _appCtxSvc.ctx.Arm0SingleRequirementWidePanelEditorActive ) {
            height = element.offsetHeight - 40 - 2;
            _cke.editing.view.change( writer => {
                writer.setStyle( 'height', height + 'px', _cke.editing.view.document.getRoot() );
            } );
        } else {
            let ck_toolbar = element.getElementsByClassName( 'ck-editor__top' )[ 0 ];
            let ck_toolbar_height = ck_toolbar.offsetHeight;
            let content_ele = element.getElementsByClassName( 'ck-content' )[ 0 ];
            let commandBarEle = document.getElementsByClassName( 'aw-requirements-commandBarIcon' );
            let commandBarExpanded = true;
            if( commandBarEle && commandBarEle.length > 0 && commandBarEle[ 0 ].offsetHeight <= 5 ) {
                commandBarExpanded = false; // If commandBar not expanded yet, skip 40 px for commandbar
            }
            let mainLayoutElement = _getMainLayoutPanel( content_ele );

            let aw_toolbar_height = 0;
            if( mainLayoutElement ) {
                let aw_toolbar = mainLayoutElement.getElementsByClassName( 'aw-toolbar-layout' );
                aw_toolbar_height = aw_toolbar && aw_toolbar.length > 0 ? aw_toolbar[0].offsetHeight + 3 : 0;   // 3px - padding/margin
            }
            if( _getActiveTabKey( subPanelContext ) === 'tc_xrt_Overview' ) {
                height = 350;
            } else if( mainLayoutElement ) {
                height = mainLayoutElement.offsetHeight - aw_toolbar_height - ck_toolbar_height - summaryHeaderHeight;
                height = !commandBarExpanded ? height - 40 : height;
            } else if( window.innerHeight > element.offsetTop ) {
                height = window.innerHeight - element.offsetTop - ck_toolbar.offsetHeight - 12;
                height = !commandBarExpanded ? height - 40 : height;
                height = height > 300 ? height : 300;
            } else {
                // this means panel section of UV is drop downed and have to scroll to view it.
                height = window.innerHeight - 120; // 60px from header + 60px from footer
            }
            _cke.editing.view.change( writer => {
                let ck_content_ele = document.getElementsByClassName( 'ck-content' );
                if( ck_content_ele.length > 0 && !isSpecExportTemplate && mainLayoutElement ) {
                    ck_content_ele[0].style.height = height + 'px';
                    ck_content_ele[0].parentElement.style.height = height + 'px';
                    if( _appCtxSvc.ctx.ckeditorSidebar && _appCtxSvc.ctx.ckeditorSidebar.isOpen ) {
                        setHeightToCommentsSidebar();   // If sidebar is opened, set the height as per editor
                    }
                } else{
                    writer.setStyle( 'height', height + 'px', _cke.editing.view.document.getRoot() );
                }
            } );
        }
    } else if( !element ) {
        // Check if Header Footer template is opened
        element = document.getElementsByClassName( 'aw-requirement-a4SizePaper' )[ 0 ];
        if( element ) {
            let sublocationPadding = _getPaddingMarginHeight( element ) + 4;    // 4 - border
            element = _getSubLocationContentElement( element );
            let ck_toolbar = element.getElementsByClassName( 'ck-editor__top' )[ 0 ];
            let tabs = document.getElementsByClassName( 'aw-xrt-tabsContainer' );
            if( tabs && tabs.length > 0 ) {
                sublocationPadding = sublocationPadding + tabs[0].offsetHeight + _getPaddingMarginHeight( tabs[0] );    // object selected in folders
            } else {
                sublocationPadding += _getPaddingMarginHeight( element );   // object opened
            }
            height = element.offsetHeight - sublocationPadding - ck_toolbar.offsetHeight - summaryHeaderHeight;  // 43 - padding of a4Size page
            _cke.editing.view.change( writer => {
                writer.setStyle( 'height', height + 'px', _cke.editing.view.document.getRoot() );
            } );
        }
    }
}

/**
 * Function to return active tab key
 * @param {Object} subPanelContext
 * @returns {String} - active tab key
 */
function _getActiveTabKey( subPanelContext ) {
    let activeTab = undefined;
    if( subPanelContext ) {
        activeTab = subPanelContext.context && subPanelContext.context.pageContext ? subPanelContext.context.pageContext.secondaryActiveTabId : undefined;
        if( !activeTab ) {
            activeTab = subPanelContext.showObjectContext && subPanelContext.showObjectContext.activeTab ? subPanelContext.showObjectContext.activeTab.tabKey : undefined;
        }
    }
    return activeTab;
}

function _getPaddingMarginHeight( element ) {
    let styles = getComputedStyle( element );
    return parseFloat( styles.paddingTop ) + parseFloat( styles.paddingBottom ) + parseFloat( styles.marginTop ) + parseFloat( styles.marginBottom );
}

/**
 * Find if given element is added inside the main panel, if yes return main panel element
 *
 * @param {Object} element - html dom element
 * @returns {Object} html dom element or null
 */
function _getMainLayoutPanel( element ) {
    if( !element || element.classList.contains( 'aw-layout-sublocationContent' )  ) {
        return null;
    }
    if( element.classList.contains( 'aw-panel' ) || element.classList.contains( 'aw-widgets-multiSelectContainer' ) ) {
        // aw-panel - in case of ACE Doc tab. else 'aw-widgets-multiSelectContainer'
        return element;
    }
    return _getMainLayoutPanel( element.parentElement );
}

/**
 *
 * @param {*} element
 * @returns
 */
function _getSubLocationContentElement( element ) {
    if( !element  ) {
        return null;
    }
    if( element.classList.contains( 'aw-layout-sublocationContent' ) ) {
        return element;
    }
    return _getSubLocationContentElement( element.parentElement );
}

/**
 * Implements promise for window resize event
 *
 * @return {Void}
 */
function _resizeTimer( subPanelContext ) {
    resizePromise = setTimeout( function() {
        if( self && setEditorHeight ) {
            setEditorHeight( subPanelContext );
        }
    }, 0 );
}

/**
 * Implements handler for window resize event
 *
 * @return {Void}
 */
export let resizeEditor = function( subPanelContext ) {
    if( resizePromise ) {
        clearTimeout( resizePromise );
    }
    _resizeTimer( subPanelContext );
};
/**
 * Return true if need to exclude insert ole command
 * @returns {Boolean} -
 */
function _isExcludeInsertOLECommand( editorProp ) {
    if( editorProp.dbValue && editorProp.dbValue.excludeInsertOLECommand === true ) {
        return true;
    }
    return false;
}

/**
 * Page break will be required for Export Specification Template for cover page
 * @param {Object} editorProp  - Editor properties
 * @returns {Boolean} true/false
 */
function _isIncludePageBreakCommand( editorProp ) {
    if( editorProp.dbValue && editorProp.dbValue.includePageBreakCommand === true ) {
        return true;
    }
    return false;
}

/**
 *
 */
function _getAdvanceCKEditorConfig() {
    var config = new Arm0CkeditorConfigProvider( _data.prop );
    config = config.getCkeditor5Config();
    config.extraPlugins = [ RMInsertImage, RMSpan, RequirementWidget, RMCrossSelection, ConvertDivAttributes, ConvertParaAttributes,
        RMReuseIntegration,
        Mention,
        Mathematics,
        RMSelectionHandler, RMCrossReferenceLink, RMContentTable, RMParamToReqHandler, RMImageSchemaExtender, RMSplitRequirement,
        CommentsAdapterCollaboration, ckeditor5ServiceInstance.Comments, RMInternalLinks, RMLoadingWidget
    ];

    // enable Track changes command
    config.extraPlugins.push( ckeditor5ServiceInstance.TrackChanges );
    //config.extraPlugins.push( TrackChangeAdapter );
    if( !_isExcludeInsertOLECommand( _data.prop ) ) {
        config.extraPlugins.push( RMInsertOLE );
    }
    if( _isIncludePageBreakCommand( _data.prop ) ) {
        config.toolbar.push( 'pageBreak' );
    }
    var page_size = 0;
    if( _data.prop.preferences && _data.prop.preferences.AWC_req_viewer_page_size_deleted ) {
        page_size = parseInt( _data.prop.preferences.AWC_req_viewer_page_size_deleted[ 0 ] );
    }
    // if( page_size > 0 ) {
    config.extraPlugins.push( pageUp );
    config.toolbar.push( 'pageUp' );
    config.extraPlugins.push( pageDown );
    config.toolbar.push( 'pageDown' );
    // }
    var sidebar = {
        container: document.querySelector( '.aw-richtexteditor-editorSidebar .aw-richtexteditor-commentSidebar' )
    };
    config.sidebar = sidebar;
    // hide ckeditor sidebar
    markupService.hideCkeditorSidebar();

    config.comments = {
        CommentThreadView: NewCommentBaseView,
        CommentView: NewCommentView
    };

    config.trackChanges = {
        SuggestionThreadView : NewSuggestionThreadView
    };
    // Track Changes - Production license
    config.licenseKey = 'I30IN6Ap+n/mTBBEz/TZPfxa7s7UZysEV2u9/rhgX3M5yxdOAgXyfac=';
    // Track Changes - Developement license
    // config.licenseKey = '1sz8U3xhwntuE90IG+pq27gOc6CknIxXcOdmmilNOS1qRCP3lwWGh1o=';
    // config.trackChanges.disableComments = true;
    return config;
}

var cloudServicesConfig = {
    tokenUrl: () => {
        return new Promise( ( resolve, reject ) => {
            let initialData = rmCkeditorService.getInitialData();
            if( initialData && initialData.accessToken ) {
                // Use inital token
                const accessToken = initialData.accessToken;
                delete initialData.accessToken; // Delete initially generated access token. Will generate token on next calls.
                rmCkeditorService.setInitialData( initialData );
                return resolve( accessToken );
            }
            // Generate Token
            _generateAccessToken().then( function( accessToken ) {
                return resolve( accessToken );
            } ).catch( function() {
                return reject();
            } );
        } );
    }
};

/**
 * Function to Make soa call to generate token
 * @returns {Object} -
 */
function _generateAccessToken() {
    let deferred = AwPromiseService.instance.defer();
    const userIcon = _appCtxSvc.ctx.user && _appCtxSvc.ctx.user.typeIconURL ?  _appCtxSvc.ctx.user.typeIconURL : '';
    const requestPref = {
        generate_collab_token: userIcon
    };
    const input =  {
        inputCtxt: reqACEUtils.getInputContext( requestPref ),
        inputObjects: [ reqACEUtils.getTopSelectedObject( _appCtxSvc.ctx ) ]
    };

    soaSvc.post( 'Internal-AwReqMgmtSe-2019-06-SpecNavigation', 'getSpecificationSegment', { inputData: input } )
        .then( function( response ) {
            if( response && response.output && response.output.htmlContents[0] ) {
                let tokenResp = response.output.htmlContents[0];
                deferred.resolve( tokenResp.trim().substring( 'token='.length ) );
            } else {
                deferred.reject();
            }
        } ).catch( function( error ) {
            deferred.reject();
        } );
    return deferred.promise;
}

export let reInitializeCkeditorInstanceWithCollaboration = function( subPanelContext ) {
    if( _cke && _cke.state !== 'destroyed' ) {
        _cke.destroy();
    }
    _showCkEditor( subPanelContext, true );
};

export let reInitializeCkeditorInstanceWithoutCollaboration = function( subPanelContext ) {
    if( _cke && _cke.state !== 'destroyed' ) {
        _cke.destroy();
    }
    _showCkEditor( subPanelContext, false );
};


/**
 *
 */
function _showCkEditor( subPanelContext, InitializeWithCollaboration ) {
    var ckEditorId = _data.prop.id;
    const isHtmlSpecTemplate = _data.prop.isHtmlSpecTemplate;
    var _advanceNoDropConfig = _getAdvanceCKEditorConfig();
    var config = _advanceNoDropConfig;

    if( InitializeWithCollaboration ) { // Add Collaboration config
        //config.extraPlugins.push( CommentsAdapterCollaboration );
        config.extraPlugins.push( ckeditor5ServiceInstance.CloudServices );
        config.extraPlugins.push( ckeditor5ServiceInstance.RealTimeCollaborativeEditing );
        config.extraPlugins.push( ckeditor5ServiceInstance.PresenceList );
        const initialData = rmCkeditorService.getInitialData();
        config.extraPlugins.push( ckeditor5ServiceInstance.RealTimeCollaborativeComments );
        config.extraPlugins.push( ckeditor5ServiceInstance.RealTimeCollaborativeTrackChanges );
        if( initialData ) {
            config.initialData = initialData.htmlString;
            config.cloudServices =  {
                tokenUrl: cloudServicesConfig.tokenUrl,
                webSocketUrl: rmCkeditorService.getInitialData().collabBaseUrl
            };
            config.collaboration = {
                channelId: initialData.objectId
            };
            var presenceList = document.querySelector( '.aw-richtexteditor-presenceList' );
            if( !presenceList ) {
                var editorPanel = document.getElementsByClassName( 'aw-richtexteditor-editorPanel' )[0];
                presenceList = document.createElement( 'div' );
                presenceList.classList.add( 'aw-richtexteditor-presenceList' );
                presenceList.classList.add( 'hidden' );
                editorPanel.appendChild( presenceList );
            }
            config.presenceList = {
                container: presenceList,
                collapseAt: 5
            };
        }
    } else{
        var extraPlugins2 = config.extraPlugins;
        var newExtraPlugin = _arrayRemove( extraPlugins2, CommentsAdapterCollaboration );
        config.extraPlugins = newExtraPlugin;
        config.extraPlugins.push( CommentsAdapter );
        config.extraPlugins.push( TrackChangeAdapter );
    }

    _createInstance( ckEditorId, config ).then(
        function( response ) {
            _cke = response;
            _cke.iconSvc = iconSvc;
            _cke.eventBus = eventBus;
            _cke.getBaseURL = browserUtils.getBaseURL();
            _cke.getBaseUrlPath = getBaseUrlPath();
            _cke.isHtmlSpecTemplate = isHtmlSpecTemplate;
            setCkeditor5Instance( _cke );
            var resource = 'RichTextEditorCommandPanelsMessages';
            var localTextBundle = localeService.getLoadedText( resource );
            _cke.changeTypeTitle = localTextBundle.changeTypeTitle;
            _cke.requirementRevision = localTextBundle.requirementRevision;
            _cke.addTitle = localTextBundle.addTitle;
            _cke.removeTitle = localTextBundle.removeTitle;
            _cke.addSiblingKeyTitle = localTextBundle.addSiblingKeyTitle;
            _cke.addChildKeyTitle = localTextBundle.addChildKeyTitle;
            _cke.childTitle = localTextBundle.childTitle;
            _cke.siblingTitle = localTextBundle.siblingTitle;
            _cke.createTraceLinkTitle = localTextBundle.createTraceLinkTitle;
            _cke.tocSettingsCmdTitle = localTextBundle.tocSettingsCmdTitle;
            _cke.update = localTextBundle.update;
            _cke.delete = localTextBundle.delete;
            _cke.addParameter = localTextBundle.addParameter;
            var coSrc = getBaseUrlPath() + '/image/' + 'indicatorCheckedOut16.svg';
            _cke.checkoutIconImgElement = '<img class="aw-base-icon" src="' + coSrc + '" />';
            _cke.createTraceLinkTitle = localTextBundle.createTraceLinkTitle;
            _cke.createTraceLink = localTextBundle.createTraceLink;
            _cke.indicatorSuspectLink = localTextBundle.indicatorSuspectLink;
            _cke.indicatorTraceLink = localTextBundle.indicatorTraceLink;
            if( subPanelContext && subPanelContext.requirementCtx ) {
                _cke.requirementCtx = subPanelContext.requirementCtx;
                registerCkeditorInstanceIsReady( ckEditorId, response, subPanelContext.requirementCtx );
            } else {
                registerCkeditorInstanceIsReady( ckEditorId, response );
            }

            let eventDataForEditorReady;
            if( InitializeWithCollaboration !== undefined ) {
                eventDataForEditorReady = {
                    ckInitializeWithCollaboration: InitializeWithCollaboration
                };
                // Commenting this, as we are not doing explicit non-collab mode.
                // This non-collab mode will be only when there is error while connecting to collab server
                // if( !InitializeWithCollaboration ) {  // set Readonly if Collaboration mode turned OFF explicitely
                //     _cke.enableReadOnlyMode( 'uniqueId' );
                // }
            }
            eventBus.publish( 'requirementDocumentation.isCkeditorInstanceReady', eventDataForEditorReady );
            exports.resizeEditor( subPanelContext );


            // setTimeout( () => {
            //     exports.resizeEditor( subPanelContext );
            // }, 5000 );
            // ckeditor5ServiceInstance.CKEditorInspector.attach( _cke );
        } );
}


function _arrayRemove( arr, value ) {
    return arr.filter( function( removeplugin ) {
        return removeplugin !== value;
    } );
}


/**
 *
 * @param {String} ckeditorid - id
 * @param {Object} config - json object
 */
function _createInstance( ckeditorid, config ) {
    var deferred = AwPromiseService.instance.defer();
    var editorDiv = document.querySelector( '#' + ckeditorid );
    if( !editorDiv ) {
        editorDiv = document.querySelector( '.aw-ckeditor-panel.aw-requirements-mainPanel' );
        editorDiv = editorDiv.firstElementChild;
    }

    // let EditorWatchdog = new ckeditor5ServiceInstance.EditorWatchdog( ckeditor5ServiceInstance.ClassicEditor );
    // let watchdog = new ckeditor5ServiceInstance.EditorWatchdog();

    // watchdog.setCreator( ( editorDiv, config ) => {
    //     return

    ckeditor5ServiceInstance.ClassicEditor.create( editorDiv, config ).then( editor => {
        _addPresenceListToCKToolbar();

        editor.editing.view.change( writer => {
            writer.setAttribute( 'contenteditable', 'false', editor.editing.view.document.getRoot() );
        } );

        // Enable custom commands with Track Changes
        if( editor.plugins._availablePlugins.has( 'TrackChanges' ) ) {
            var trackChanges = editor.plugins.get( 'TrackChangesEditing' );
            trackChanges.enableCommand( 'insertRequirement' );
        }

        /**************************** Comment plugin related code *******************************/
        //Switch between inline, narrow sidebar and wide sidebar according to the window size.
        //const annotations = editor.plugins.get( 'Annotations' );
        const annotationsUIs = editor.plugins.get( 'AnnotationsUIs' );
        const sidebarElement = document.querySelector( '.aw-richtexteditor-editorSidebar' );

        /** */
        function refreshDisplayMode() {
            let docTabDomElement = _getParentElementByClassName( sidebarElement, 'aw-richtexteditor-editorPanel' );
            if( window.innerWidth < 1300 ) {
                sidebarElement.classList.remove( 'hidden' );
                if( docTabDomElement ) {
                    docTabDomElement.classList.add( 'narrow' );
                }
                annotationsUIs.switchTo( 'narrowSidebar' );
            } else {
                sidebarElement.classList.remove( 'hidden' );
                if( docTabDomElement ) {
                    docTabDomElement.classList.remove( 'narrow' );
                }
                annotationsUIs.switchTo( 'wideSidebar' );
            }
        }
        // Prevent closing the tab when any action is pending.
        editor.ui.view.listenTo( window, 'beforeunload', ( evt, domEvt ) => {
            if( editor.plugins.get( 'PendingActions' ).hasAny ) {
                domEvt.preventDefault();
                domEvt.returnValue = true;
            }
        } );
        editor.ui.view.listenTo( window, 'resize', refreshDisplayMode );
        refreshDisplayMode();
        handlePasteEventOnSidebar();
        handleScrollEventInContent( editor );

        if( editor.plugins._availablePlugins.has( 'RealTimeCollaborationClient' ) ) {
            const realTimeClient = editor.plugins.get( 'RealTimeCollaborationClient' );
            realTimeClient.on( 'change:_isConnected', ( evt, propertyName, newValue, oldValue ) => {
                if( oldValue === true && newValue === false ) {   // Collaboration service is disconnected/stopped
                    setTimeout( () => {
                        eventBus.publish( 'Arm0RequirementCkeditor5.collabSessionDisconnected' );
                    }, 100 );
                }
                console.log( newValue );
            } );
        }

        /***************************** Upto Here ********************************/

        deferred.resolve( editor );
    } ).catch( error => {
        console.error( error.stack );
        if ( error.message && ( error.message.match( /^cloudservices-init/ ) || error.message.match( /^realtimecollaborationclient-init-connection-failed/ ) || error.message.match( /^realtimecollaborationclient-init-session-connection-error/ ) ) ) {
            showMessageOnCollabSessionError( true );
        }
    } );
    // } );
    // watchdog.create( editorDiv, config )

    return deferred.promise;
}

export let collabSessionDisconnected = function( subPanelContext ) {
    // Make sure that Doc Tab is still active
    if( subPanelContext && subPanelContext.requirementCtx && subPanelContext.requirementCtx.isACEDocumentationTabActive === true ) {
        showMessageOnCollabSessionError( false, subPanelContext );
    }
};

/**
 *
 * @param {Boolean} reInitiateEditorWithAvailableData - IF true, get spec data from server and then re-initiaze editor. IF false, re-initialize editor with available spec data.
 * @param {Object} subPanelContext - sub panel context
 */
function showMessageOnCollabSessionError( reInitiateEditorWithAvailableData, subPanelContext ) {
    const messages = localeService.getLoadedText( 'RichTextEditorCommandPanelsMessages' );
    const connectionErrMessage = messages.collabServerConnectionError;

    let buttonArray = [];
    buttonArray.push( createButton( messages.save, function( $noty ) {
        if( reInitiateEditorWithAvailableData ) {
            eventBus.publish( 'Arm0RequirementCkeditor5.reInitializeCkeditorInstanceWithoutCollaboration' );
        } else {
            reInitializeCkeditorInstanceWithoutCollaboration( subPanelContext );
            eventBus.publish( 'requirementDocumentation.saveContentAndLaunchNonCollabMode' );
        }
        $noty.close();
    } ) );

    notyService.showWarning( connectionErrMessage, buttonArray );
}

function createButton( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
}

/**
 * Return Dom element with given class name by traversing parents
 * @param {Object} domElement -
 * @param {String} className -
 * @returns {Object} -
 */
function _getParentElementByClassName( domElement, className ) {
    if( domElement === undefined || domElement === null ) {
        return undefined;
    } else if( domElement && domElement.classList.contains( className ) ) {
        return domElement;
    }
    return _getParentElementByClassName( domElement.parentElement, className );
}

let _addPresenceListToCKToolbar = function() {
    const presenceListEle = document.getElementsByClassName( 'aw-richtexteditor-presenceList' )[0];
    if( presenceListEle && presenceListEle.childNodes.length > 0 ) {
        // In Collaboration mode
        let topToolbar = document.getElementsByClassName( 'ck-editor__top' )[0];
        if( topToolbar ) {
            _addCollaborationClassToEditorElement();    // Add class to resize editor
            topToolbar.append( presenceListEle );
            if( presenceListEle.classList.contains( 'hidden' ) ) {
                presenceListEle.classList.remove( 'hidden' );
            }
        }
    }
};

export let createInstanceWatermark = function( ckEditorIdWaterMark, data ) {
    var deferred = AwPromiseService.instance.defer();
    var editor1 = document.querySelector( '#' + ckEditorIdWaterMark );
    if( editor1 !== null && editor1 !== undefined ) {
        var config = new Arm0CkeditorConfigProvider( _data.prop );
        config = config.getCkeditor5ConfigForWatermark();
        var ckEditorInstance;
        ckeditor5ServiceInstance.InlineEditor.create( editor1, config ).then( editor => {
            ckEditorInstance = editor;
            // data.dispatch( { path: 'data.ckEditorInstance', value: ckEditorInstance } );
            deferred.resolve( editor );
        } )
            .catch( error => {
                console.error( error.stack );
            } );
        return deferred.promise;
    }
};
/**
 * Function to add scroll event on editor content area, to update sidebar
 * @param {Object} editor - Editor instance
 */
function handleScrollEventInContent( editor ) {
    var root = editor.editing.view.document.getRoot();
    var domRootElement = editor.editing.view.domConverter.mapViewToDom( root );
    domRootElement.addEventListener( 'scroll', function( eventData ) {
        if( _appCtxSvc.ctx.ckeditorSidebar && _appCtxSvc.ctx.ckeditorSidebar.isOpen ) {
            checkForCommandOnLastLine( eventData.target );
            const annotationsUIs = editor.plugins.get( 'AnnotationsUIs' );
            if( annotationsUIs.isActive( 'wideSidebar' ) ) {
                annotationsUIs.switchTo( 'wideSidebar' );
            } else if( annotationsUIs.isActive( 'narrowSidebar' ) ) {
                annotationsUIs.switchTo( 'narrowSidebar' );
            }
        }
    } );
}

/**
 *
 * @param {Object} scrollEventData - event data for scroll event
 */
function checkForCommandOnLastLine( target ) {
    let reqSidebar = document.getElementsByClassName( 'aw-richtexteditor-commentSidebar' );
    if( reqSidebar.length > 0 ) {
        if( target.scrollHeight - target.scrollTop - target.clientHeight < 50 ) {  // If scrollbar is about to reach to bottom 100px
            reqSidebar[0].style.overflow = 'auto';
        } else if( reqSidebar[0].style.overflow === 'auto' ) {
            reqSidebar[0].style.overflow = ''; // unset
        }
    }
}

/**
 * Function to handle Paste event on comment/trackchange input
 * Stop propagation of paste event to avoid paste event handling on document
 */
function handlePasteEventOnSidebar() {
    var commentSidebar = document.querySelector( '.aw-richtexteditor-editorSidebar .aw-richtexteditor-commentSidebar' );
    if( commentSidebar ) {
        [ 'keydown', 'keyup' ].forEach( eventName => {
            commentSidebar.addEventListener( eventName, function( event ) {
                // Target element is comment/track change input
                if( event && event.target && event.target.classList.contains( 'ck-editor__editable' ) ) {
                    var keyId = event.keyCode;
                    var ctrl = event.ctrlKey;
                    if( ctrl && keyId !== 17 && keyId === 86 ) { // KeyCode: Ctrl - 17, V - 86
                        event.stopPropagation(); // Stop propogation on Ctrl + V
                    }
                }
            } );
        } );
    }
}

/**
 * Cleanup all watchers and instance members when this is destroyed.
 *
 * @return {Void}
 */
export let destroyCkeditor = function() {
    if( initCKEditorListener ) {
        eventBus.unsubscribe( initCKEditorListener );
    }
    if( _cke ) {
        eventBus.unsubscribe( resizeReqViewerOnCmdResizeListener );
        eventBus.unsubscribe( resizeReqViewerOnSplitterUpdateListener );
        eventBus.unsubscribe( resizeReqViewerOnSidePanelOpenListener );
        eventBus.unsubscribe( registerEventListenerToResizeEditor );
        eventBus.unsubscribe( resizeReqViewerOnInitCkeEventListener );
        if( _cke.state !== 'destroyed' ) {
            _cke.destroy();
        }
        ckeditorInstanceDestroyed();
    }
};

/**
 * Controller Init.
 *
 * @return {Void}
 */
export let initCkeditor = function( data, subPanelContext ) {
    if( !subPanelContext ) {
        return;
    }
    // Register the context only when in ACE Viewer
    if( subPanelContext.editorProps.dbValue && subPanelContext.editorProps.dbValue.showEditorSidebar ) {
        var ckeditorSidebar = _appCtxSvc.getCtx( 'ckeditorSidebar' );
        if( !ckeditorSidebar ) {
            _appCtxSvc.registerCtx( 'ckeditorSidebar', { isOpen: false } );
        }
    }

    _data = data;
    data.prop = subPanelContext.editorProps;

    if( !data.prop.id ) {
        data.prop.id = _generateID();
    }

    registerCkeditorInstanceNotReady( _data.prop.id, subPanelContext );

    if( data.prop.showCKEditor ) {
        setTimeout( function() {
            _showCkEditor( subPanelContext );
        }, 100 );
    } else {
        // Register event for initCKEditorEvent
        initCKEditorListener = eventBus.subscribe( 'requirement.initCKEditorEvent', function() {
            eventBus.unsubscribe( initCKEditorListener );
            initCKEditorListener = undefined;
            _showCkEditor( subPanelContext );
        }, data );
    }

    resizeReqViewerOnCmdResizeListener = eventBus.subscribe( 'commandBarResized', function() {
        _resizeTimer( subPanelContext );
    } );

    resizeReqViewerOnSplitterUpdateListener = eventBus.subscribe( 'aw-splitter-update', function() {
        _resizeTimer( subPanelContext );
    } );

    resizeReqViewerOnSidePanelOpenListener = eventBus.subscribe( 'appCtx.register', function( eventData ) {
        // Resize if user opens/close command panel
        if( eventData && eventData.name === 'activeToolsAndInfoCommand' ) {
            _resizeTimer( subPanelContext );
        }
    } );

    registerEventListenerToResizeEditor = eventBus.subscribe( 'requirementsEditor.resizeEditor', function() {
        _resizeTimer( subPanelContext );
    } );

    resizeReqViewerOnInitCkeEventListener = eventBus.subscribe( 'requirement.initCKEditorEvent', function() {
        _resizeTimer( subPanelContext );
    } );
};

/**
 * Update ctx, ckeditor is getting instantiated and it is not yet ready
 *
 * @param {String} ckeditorId - ckeditor instance id
 */
function registerCkeditorInstanceNotReady( ckeditorId, subPanelContext ) {
    var clonedCtx = { ...subPanelContext.requirementCtx.getValue() };
    clonedCtx.AWRequirementsEditor = {};
    clonedCtx.AWRequirementsEditor.ready = false;
    clonedCtx.AWRequirementsEditor.id = ckeditorId;
    subPanelContext.requirementCtx.update( clonedCtx );
    eventBus.publish( 'requirementDocumentation.isCkeditorInstanceReady' );
    _appCtxSvc.registerCtx( 'AWRequirementsEditor', { ready: false, id: ckeditorId } );
}

/**
 * Update ctx, ckeditor is instantiated and it is ready
 *
 * @param {String} ckeditorId - ckeditor instance id
 * @param {Object} editorInstance - ckeditor instance
 */
function registerCkeditorInstanceIsReady( ckeditorId, editorInstance, requirementCtx ) {
    const AWRequirementsEditor = _appCtxSvc.getCtx( 'AWRequirementsEditor' );
    let newAWRequirementsEditor = { ...AWRequirementsEditor };
    newAWRequirementsEditor.id = ckeditorId;
    newAWRequirementsEditor.ready = true;
    newAWRequirementsEditor.editor = editorInstance;

    if( requirementCtx ) {
        let newRequirementCtx = requirementCtx.getValue();
        newRequirementCtx.AWRequirementsEditor = newAWRequirementsEditor;
        requirementCtx.update( newRequirementCtx );
    }
    _appCtxSvc.updateCtx( 'AWRequirementsEditor', newAWRequirementsEditor );
}

export let refreshPageUpDownButtonsVisibility = function( eventData ) {
    addPageUpCommand( _cke, eventData.pageUp );
    addPageDownCommand( _cke, eventData.pageDown );
};

/**
 * Update ctx, ckeditor is instance destroyed
 */
function ckeditorInstanceDestroyed() {
    _appCtxSvc.unRegisterCtx( 'AWRequirementsEditor' );
}

/**
 * Handle sidebar toggle
 */
export let toggleSidebarListener = function() {
    var editorElement = document.getElementsByClassName( 'aw-richtexteditor-editorPanel' )[ 0 ];
    if( _appCtxSvc.ctx.ckeditorSidebar && _appCtxSvc.ctx.ckeditorSidebar.isOpen ) {
        //Sidebar ON
        if( !editorElement.classList.contains( 'aw-richtexteditor-editorWithSidebar' ) ) {
            editorElement.classList.add( 'aw-richtexteditor-editorWithSidebar' );
        }
        setHeightToCommentsSidebar();
    } else {
        //Sidebar OFF
        if( editorElement.classList.contains( 'aw-richtexteditor-editorWithSidebar' ) ) {
            editorElement.classList.remove( 'aw-richtexteditor-editorWithSidebar' );
        }
    }
};

function setHeightToCommentsSidebar() {
    // Set Height to sidebar to show the scrollbar if comments reached to end
    if( _cke.plugins._availablePlugins.has( 'AnnotationsUIs' ) && _cke.plugins.get( 'AnnotationsUIs' ).isActive( 'wideSidebar' ) ) {
        // Wide sidebar is active
        let ck_content_ele = document.getElementsByClassName( 'aw-richtexteditor-aceEditorPanel' );
        const editorHeight = ck_content_ele[0].offsetHeight;
        let sidebarEle = document.getElementsByClassName( 'aw-richtexteditor-editorSidebar' );
        if( sidebarEle.length > 0 ) {
            sidebarEle[0].style.height = editorHeight + 'px';
            let reqSidebar = document.getElementsByClassName( 'aw-richtexteditor-commentSidebar' )[0];
            let reqSidebarHeader = document.getElementsByClassName( 'aw-richtexteditor-editorSidebarHeader' )[0];
            reqSidebar.style.height = editorHeight - reqSidebarHeader.offsetHeight - 5 + 'px'; // 5px for margin inside header portion

            // Check if no scrollbar in content
            const root = _cke.editing.view.document.getRoot();
            let domRootElement = _cke.editing.view.domConverter.mapViewToDom( root );
            checkForCommandOnLastLine( domRootElement );
        }
    }
}

let trackChangeNoMarkupsClass = 'aw-richtexteditor-trackChangeNoMarkups';
let trackChangeshowOriginalClass = 'aw-richtexteditor-trackChangeshowOriginal';

/**
 * Toggle to handle Show/hide track changes markups
 */
export let toggleShowTrackChangeMarkups = function( option ) {
    let trackChanges = _appCtxSvc.getCtx( 'trackChanges' );
    let editorElement = document.getElementsByClassName( 'aw-richtexteditor-editorPanel' )[ 0 ];
    if( trackChanges ) {
        if( option === 'SHOW_ALL_MARKUPS' ) {
            trackChanges.showOriginal = false;
            trackChanges.noMarkups = false;
            editorElement.classList.remove( trackChangeNoMarkupsClass );
            editorElement.classList.remove( trackChangeshowOriginalClass );
        } else if( option === 'SHOW_ORIGINAL' ) {
            trackChanges.noMarkups = false;
            trackChanges.showOriginal = true;
            if( !editorElement.classList.contains( trackChangeshowOriginalClass ) ) {
                editorElement.classList.remove( trackChangeNoMarkupsClass );
                editorElement.classList.add( trackChangeshowOriginalClass );
                trackChanges.showOriginal = true;
            } else if( editorElement.classList.contains( trackChangeshowOriginalClass ) ) {
                editorElement.classList.remove( trackChangeshowOriginalClass );
                trackChanges.showOriginal = false;
            }
        } else if( option === 'NO_MARKUPS' ) {
            trackChanges.showOriginal = false;
            trackChanges.noMarkups = true;
            if( !editorElement.classList.contains( trackChangeNoMarkupsClass ) ) {
                editorElement.classList.remove( trackChangeshowOriginalClass );
                editorElement.classList.add( trackChangeNoMarkupsClass );
                trackChanges.noMarkups = true;
            } else if( editorElement.classList.contains( trackChangeNoMarkupsClass ) ) {
                editorElement.classList.remove( trackChangeNoMarkupsClass );
                trackChanges.noMarkups = false;
            }
        }
        _appCtxSvc.registerCtx( 'trackChanges', trackChanges );
    }
};

export let toggleShowOriginalOnContentChange = function() {
    let trackChanges = _appCtxSvc.getCtx( 'trackChanges' );
    let editorElement = document.getElementsByClassName( 'aw-richtexteditor-editorPanel' )[ 0 ];
    trackChanges.showOriginal = false;
    _appCtxSvc.registerCtx( 'trackChanges', trackChanges );
    if( editorElement.classList.contains( trackChangeshowOriginalClass ) ) {
        editorElement.classList.remove( trackChangeshowOriginalClass );
    }
};


function _addCollaborationClassToEditorElement() {
    let editorElement = document.getElementsByClassName( 'aw-richtexteditor-editorPanel' );
    if( editorElement.length > 0 ) {
        editorElement[0].classList.add( 'aw-requirementsCkeditor-collaborationMode' );
    }
}

export default exports = {
    destroyCkeditor,
    initCkeditor,
    resizeEditor,
    getCkeditor,
    refreshPageUpDownButtonsVisibility,
    createInstanceWatermark,
    toggleSidebarListener,
    toggleShowTrackChangeMarkups,
    toggleShowOriginalOnContentChange,
    reInitializeCkeditorInstanceWithCollaboration,
    reInitializeCkeditorInstanceWithoutCollaboration,
    collabSessionDisconnected
};
