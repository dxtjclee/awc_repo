// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement wide panel page
 *
 * @module js/Arm0SingleRequirementWidePanelEditor
 */
import reqUtils from 'js/requirementsUtils';
import reqACEUtils from 'js/requirementsACEUtils';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import ckeditorOperations from 'js/ckeditorOperations';
import _ from 'lodash';
import messagingService from 'js/messagingService';
import markupUtil from 'js/Arm0MarkupUtil';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import Arm0DocumentationUtil from 'js/Arm0DocumentationUtil';
import { popupService } from 'js/popupService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import $ from 'jquery';
import popupUtils from 'js/popupUtils';
import requirementsUtils from 'js/requirementsUtils';


var exports = {};
var _documentationUnloadedEventListener;
var eventInsertOle = null;
var eventInsertImage = null;
var updatedObjetsInput = null;
var SR_UID_PREFIX = 'SR::N::';
var largePopupRef;
var _loadingWidePopup = false;
var _data = null;
var _popupAction;

let subscriptions = [];

/**
 * * @param {Object} reqWidePanelCTX - Atomic data which have CTX content for widePanel
 * Hide the opened popup panel and remove all event subscriptions as well.
 */
export let hidePopupPanel = function( reqWidePanelCTX ) {
    if( largePopupRef && largePopupRef.options ) {
        largePopupRef.options.disableClose = false;
        popupService.hide( largePopupRef );
        for( const s of subscriptions ) {
            eventBus.unsubscribe( s );
        }
        subscriptions = [];
        largePopupRef = null;
        ckeditorOperations.setCkeditorDirtyFlag( 'id', appCtxService.ctx, 'close', reqWidePanelCTX );
        _data = null;
    }
};

export let updatePopupPosition = function() {
    var ref = '#aw_toolsAndInfo';
    var referenceEl = popupUtils.getElement( popupUtils.extendSelector( ref ) );
    if ( !referenceEl ) {
        return;
    }
    if ( referenceEl.offsetHeight <= 0 ) {
        ref = '.aw-layout-infoCommandbar';
        referenceEl = popupUtils.getElement( popupUtils.extendSelector( '.aw-layout-infoCommandbar' ) );
    }
    if ( referenceEl ) {
        var options = largePopupRef.options;
        options.userOptions.reference = ref;
        options.reference = referenceEl;
        popupService.update( largePopupRef );
    }
};


/**
 * resize popup after window resize
 *
 * @returns {Object} popup height & width value
 */
function reCalcPanelHeightWidth() {
    var popupHeight = 800;
    var popupWidth = 800;
    // Get the popup panel hright based on aw_toolsAndInfo div present in DOM as normal
    // commands panel will also have the similar height.
    var toolInfoElement = $( '#aw_toolsAndInfo' );
    if( toolInfoElement && toolInfoElement.parent() && toolInfoElement.parent().height() ) {
        popupHeight = toolInfoElement.parent().height();
        popupWidth = toolInfoElement.parent().width();
    }

    // If height is not valid then use hard coded height.
    if( !popupHeight || popupHeight <= 0 ) {
        popupHeight = 800;
    }
    // If width is not valid then use hard coded width.
    if( !popupWidth || popupWidth <= 0 ) {
        popupWidth = 800;
    }else{
        popupWidth -= 0.5 * popupWidth;
    }
    popupHeight += 'px';
    popupWidth += 'px';
    return { popupHeight: popupHeight, popupWidth: popupWidth };
}

/**
 * Show popup
 * @param {Object} popupData - data to open popup panel
 * @param {Boolean} calcHeight - Boolean for cheking if height calculation required or not
 */
export let showWidePanelEditorPopup = function( calcHeight, options ) {
    if ( _loadingWidePopup && largePopupRef && largePopupRef.panelEl ) {
        // Don't process the call if panel loading is in process Or panel is initiated but context is not yet updated
        return;
    }
    if ( !appCtxService.ctx.Arm0SingleRequirementWidePanelEditorActive && ( !largePopupRef || !largePopupRef.panelEl ) ) {
        _loadingWidePopup = true;

        // Calculate the popup panel height & width based on browser size.
        if( calcHeight ) {
            var scaleObj = reCalcPanelHeightWidth();
            options.height = scaleObj.popupHeight;
            options.width = scaleObj.popupWidth;
        }
        popupService.show( options ).then( popupRef => {
            largePopupRef = popupRef;
            _loadingWidePopup = false;
            subscriptions.push( eventBus.subscribe( 'LOCATION_CHANGE_COMPLETE', hidePopupPanel ) );
            var sideNavEventSub = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
                if ( eventData && eventData.id === 'aw_toolsAndInfo' ) {
                    setTimeout( function() {
                        exports.updatePopupPosition();
                    }, 300 );
                }
            } );
            eventBus.publish( 'Arm0SingleRequirementWidePanelEditor.reveal' );
            subscriptions.push( sideNavEventSub );
        } );
    } else {
        exports.unRegisterCtxclosePopup();
    }
};

/**
 *
 */
export let unRegisterCtxclosePopup = function( reqWidePanelCTX ) {
    _.defer( function() {
        appCtxService.unRegisterCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
        appCtxService.unRegisterCtx( 'summaryTableSelectedObjUid' );
        appCtxService.unRegisterCtx( 'AWRequirementsEditor.dirtyFlagforCkEditor' );
        exports.hidePopupPanel( reqWidePanelCTX );
    } );
};

/**
  * Set OLE details(which will be inserted to CKEDITOR) to data(The panel's view model object)
  *
  * @param {Object} data - The panel's view model object
  *
  */
var setOLEDetailsToData = function( data ) {
    let eventMap = data.eventMap;
    let eventData = eventMap['requirementDocumentation.InsertOLEInCKEditor'];
    data.eventData = eventData;
    data.form = eventData.form;
    let fileName = eventData.file.name;
    data.fileExtensions = fileName.split( '.' ).pop();

    return { eventData : data.eventData, form : data.form, fileExtensions: data.fileExtensions };
};

/**
  * Set Image details(which will be inserted to CKEDITOR) to data(The panel's view model object)
  *
  * @param {Object} data - The panel's view model object
  *
  */
var setImageDetailsToData = function( data ) {
    let eventMap = data.eventMap;
    let eventData = eventMap['requirementDocumentation.InsertImageInCKEditor'];
    var fileName = 'fakepath\\' + eventData.file.name;
    if( reqUtils.stringEndsWith( fileName.toUpperCase(), '.gif'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.png'.toUpperCase() ) ||
               reqUtils.stringEndsWith( fileName.toUpperCase(), '.jpg'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.jpeg'.toUpperCase() ) ||
               reqUtils.stringEndsWith( fileName.toUpperCase(), '.bmp'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.wmf'.toUpperCase() ) ) {
        data.form = eventData.form;

        var datasetInfo = {
            clientId: eventData.clientid,
            namedReferenceName: 'Image',
            fileName: fileName,
            name: eventData.clientid,
            type: 'Image'
        };

        data.datasetInfo = datasetInfo;

        return { datasetInfo : datasetInfo, form : eventData.form };
    }
    messagingService.reportNotyMessage( data, data._internal.messages,
        'notificationForImageErrorWrongFile' );
};


/**
  * Initialize HTML content
  *
  * @param {Object} data - The panel's view model object
  * @param {Object} ctx - The Context service Object
  *
  */
export let initWidePanelContent = function( data, ctx, reqWidePanelCTX ) {
    // initialise ckeditor utils based on browser
    appCtxService.registerCtx( 'Arm0SingleRequirementWidePanelEditorActive', true );
    appCtxService.unRegisterCtx( 'reqMarkupCtx' );

    if ( !_documentationUnloadedEventListener ) {
        _documentationUnloadedEventListener = eventBus.subscribe( 'Arm0SingleRequirementWidePanelEditor.contentUnloaded',
            function() {
                handleWideDocumentationUnloaded();
            }, 'Arm0SingleRequirementWidePanelEditor' );
    }
    data.selected = ctx.selected;
    if ( data.content ) {
        if ( data.content.htmlContents && data.content.htmlContents.length ) {
            data.htmlString = data.content.htmlContents[0];
            if( data.ckeditorReady ) {
                // If ckeditor is ready, set contents
                _preprocessContentsAndSetToEditor( data, reqWidePanelCTX );
            }
            _data = data;
            Arm0DocumentationUtil.setFullTextObject( data );
            data.editMode = true;
        }
    }
    /**
     * Unregister context on Documentation page unloaded.
     */
    function handleWideDocumentationUnloaded() {
        eventBus.unsubscribe( _documentationUnloadedEventListener );
        _documentationUnloadedEventListener = null;
        appCtxService.unRegisterCtx( 'Arm0SingleRequirementWidePanelEditorActive' );
    }

    return { selected : data.selected, editMode : data.editMode, htmlString : data.htmlString   };
};

/**
 * Set CKEditor Content.
 *
 * @param {String} id - CKEditor ID
 * @param {String} content - content to set in CK Editor
 * @param {Object} data - view model data object
 */
var _setCKEditorContent = function( id, content, data, reqWidePanelCTX ) {
    setTimeout( function() {
        appCtxService.registerCtx( 'requirementEditorContentChanged', false );
        ckeditorOperations.initializationMarkupContext( data );
        ckeditorOperations.setCKEditorContentAsync( id, content, appCtxService.ctx ).then( function() {
            ckeditorOperations.setCkeditorDirtyFlag( id, appCtxService.ctx, undefined, reqWidePanelCTX );
            appCtxService.registerPartialCtx( 'AWRequirementsEditor.dirtyFlagforCkEditor', false );
            var Arm0Requirements = appCtxService.getCtx( 'Arm0Requirements' );
            if( Arm0Requirements && Arm0Requirements.Editor && Arm0Requirements.Editor === 'CKEDITOR_5' ) {
                var editorId = appCtxService.getCtx( 'AWRequirementsEditor' ).id;
                var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxService.ctx );
                if( editor ) {
                    // Start Highlighting the comments
                    editor.fire( 'highlightComments' );
                }
            }
        } );
    }, 0 );
};

/**
 * Pre-process the contetns and set it to editor
 * @param {Object} data - view model object data
 *
 */
var _preprocessContentsAndSetToEditor = function( data, reqWidePanelCTX ) {
    data.showCKEditor = true;
    data.htmlString = reqUtils.correctImageTags( data.htmlString );
    data.htmlString = reqUtils.correctSpanTags( data.htmlString );
    data.htmlString = reqUtils.correctAnchorTags( data.htmlString );
    data.htmlString = reqUtils.convertToSuggestionTags( data.htmlString );
    var nodeList = document.createElement( 'div' );
    nodeList.innerHTML = data.htmlString;
    requirementsUtils.prepareAndUpdateListStyleType( nodeList );
    var divElement = nodeList.getElementsByClassName( 'aw-requirement-content' );
    var contentDiv;
    contentDiv = document.createElement( 'div' );
    contentDiv.setAttribute( 'revisionid', data.selectedRefObj.revID );
    contentDiv.setAttribute( 'class', 'requirement' );
    if ( divElement ) {
        var outerDiv = document.createElement( 'div' );
        // add empty P tag, if bodyText div is empty, //LCS-354189
        var bodyTextEle = divElement[0].getElementsByClassName( 'aw-requirement-bodytext' );
        if ( bodyTextEle && bodyTextEle.length > 0 ) {
            reqACEUtils.setReadOnlyForBodyText( data, contentDiv, bodyTextEle[0] );
            if ( bodyTextEle[0].innerHTML && bodyTextEle[0].innerHTML.trim() === '' ) {
                bodyTextEle[0].innerHTML = '<p></p>';
            }
        }

        outerDiv.setAttribute( 'style', 'outline:none;' );
        outerDiv.setAttribute( 'class', 'aw-requirement-content' );
        if ( divElement[0].innerHTML === '{%body_text}' ) {
            divElement[0].innerHTML = '<p>' + divElement[0].innerHTML + '</p>';
        }
        outerDiv.innerHTML = divElement[0].innerHTML;
        contentDiv.appendChild( outerDiv );
    }
    reqUtils.insertTypeIconToOleObjects( contentDiv );
    Arm0DocumentationUtil.getAllBrokenImageIDs( data, contentDiv );
    _setCKEditorContent( data.editorProps.id, contentDiv.outerHTML, data, reqWidePanelCTX );
};

/**
 * Check if ckeditor instance created before setting contents
 * @param {Object} data - view model data
 *
 */
export let isCkeditorInstanceReady = function( data, reqWidePanelCTX ) {
    let requirementsEditor = reqWidePanelCTX.AWRequirementsEditor;
    if ( requirementsEditor && requirementsEditor.ready ) {
        data.ckeditorReady = true;
        _preprocessContentsAndSetToEditor( data, reqWidePanelCTX );
    }
    return { ckeditorReady : data.ckeditorReady, showCKEditor : data.showCKEditor, htmlString : data.htmlString };
};

/**
 * to get selected item Object details
 * @param {Object} data - view model data
 *
 */
export let getSelectedRefObj = function( data ) {
    let selectedRefObj = data.selectedRefObj;
    let newSelectedRefObj = _.clone( selectedRefObj );
    newSelectedRefObj = appCtxService.getCtx( 'summaryTableSelectedObjUid' );
    return newSelectedRefObj;
};

/**
 * Get Input data for getSpecificationSegment.
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Application context
 * @returns {Object} - Json object
 */
export let getSpecificationSegmentInput = function( data ) {
    var inputCtxt = reqACEUtils.getInputContext();
    data.selectedRefObj = appCtxService.getCtx( 'summaryTableSelectedObjUid' );
    return {
        inputCtxt: inputCtxt,
        inputObjects: [ data.selectedRefObj.modelRevObject ],
        options: [ 'ExportContent' ]
    };
};

/**
 * process HTML BodyText before save.
 *
 * @param {String} content - content with title, properties, body text
 * @return {String} content with updated bodyText
 */
var _preProcessBeforeSave = function( content ) {
    content = reqUtils.correctEndingTagsInHtml( content );
    return content;
};

/**
 * @param {String} inputs IJsArray
 * @param {String} objectToProcess objectToProcess
 * @param {String} lsd last saved date
 * @param {String} bodyText bodyText
 * @param {String} contentType contentType
 * @return {String} IJsArray for input
 */
var _getSetRichContentInput = function( inputs, objectToProcess, lsd, bodyText, contentType ) {
    inputs.push( {
        objectToProcess: objectToProcess,
        bodyText: bodyText,
        lastSavedDate: lsd,
        contentType: contentType,
        isPessimisticLock: true
    } );

    return inputs;
};
/**
 * Get Input for save
 *
 * @param{Object} widgetsToSave - widget to be save
 * @param {Object} data - view model data
 * @return {String} IJSO for input
 */
var _getWidgetSaveData = function( widgetsToSave, data ) {
    var setContentInputJSO = [];
    var setContentInput = widgetsToSave.setContentInput;
    var createInputJSO = widgetsToSave.createInput;

    if( setContentInput !== null && setContentInput.length > 0 ) {
        for( var i = 0; i < setContentInput.length; i++ ) {
            var updatedRequirement = setContentInput[ i ];
            var uid = updatedRequirement.uid;
            var contents = updatedRequirement.contents;
            var ele = document.createElement( 'div' );
            ele.innerHTML = contents;
            contents = _preProcessBeforeSave( contents );

            if( uid !== null && _.includes( uid, SR_UID_PREFIX ) ) {
                var obj = appCtxService.getCtx( 'selected' );
                var specSegmentContent = data.selectedRefObj.modelRevObject;
                var lastSavedDate = Arm0DocumentationUtil.getRevisionObjectLsd( obj );
                if( specSegmentContent !== null ) {
                    updatedObjetsInput.setContentInput[i].objectToProcess = specSegmentContent;
                    setContentInputJSO = _getSetRichContentInput( setContentInputJSO, specSegmentContent,
                        lastSavedDate, contents, 'REQ_HTML' );
                }
            }
        }
    }
    if( createInputJSO === null ) {
        createInputJSO = [];
    }
    return {
        createInput: createInputJSO,
        setContentInput: setContentInputJSO
    };
};

var _getCreateMarkupInput = function( data ) {
    return markupUtil.getCreateMarkupInput( data.content );
};


/**
 * getInputValues for SOA call
 * @param {Object} data - data Object
 * @return {Object} created input for SOA call
 */
export let getInputValues = function( data, reqWidePanelCTX ) {
    var setContentInputJSO = [];
    var input = [];
    var markUpInput = [];
    var prodCtxt = occMgmtStateHandler.getProductContextInfo();
    var requestPref = {};
    var reqmarkupCtx = null;
    var markupText = ckeditorOperations.getMarkupTextInstance();

    if ( appCtxService.ctx.Arm0Requirements.Editor === 'CKEDITOR_5' ) {
        reqmarkupCtx = markupUtil.updateMarkupContext();
        if ( reqmarkupCtx && reqmarkupCtx.reqMarkupsData && markupText ) {
            markupText.recalcAllMarkupPositions();
            markupText.doPostProcessing();
        }
    }

    var widgetsToSave = ckeditorOperations.getWidePanelWidgetData( data.editorProps.id, appCtxService.ctx );
    var setContentData = widgetsToSave.setContentInput;
    updatedObjetsInput = _.cloneDeep( widgetsToSave );
    if(  setContentData.length > 0 ) {
        input = _getWidgetSaveData( widgetsToSave, data );
        setContentInputJSO = input.setContentInput;
        markUpInput = _getCreateMarkupInput( _data );
    }
    var baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();

    requestPref.base_url = baseURL;

    var occConfigInfo = reqACEUtils.prepareOccConfigInfo( prodCtxt, false );

    var inputContext = reqACEUtils.prepareInputContext( occConfigInfo, 1, null, prodCtxt, requestPref );
    ckeditorOperations.setCkeditorDirtyFlag( 'id', appCtxService.ctx, 'close', reqWidePanelCTX );
    return {
        inputCtxt: inputContext,
        createInput: [],
        setContentInput: setContentInputJSO,
        markUpInput: markUpInput,
        selectedElement: { uid: data.selectedRefObj.uid, type: data.selectedRefObj.type }
    };
};

/**
 * Check CKEditor content changed / Dirty.
 *
 * @param {String} id - CKEditor ID
 * @return {Boolean} isDirty
 *
 */
var _checkCKEditorDirty = function( id ) {
    return ckeditorOperations.checkCKEditorDirty( id, appCtxService.ctx );
};

/**
 * Show leave warning message in Preview Screen
 *
 */
export let checkAndCloseWidePanel = function(  ) {
    if( _checkCKEditorDirty( _data.editorProps.id ) ) {
        var msg = _data.i18n.navigationConfirmationSingle.replace( '{0}', _data.selectedRefObj.name );
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: _data.i18n.discard,
            onClick: function( $noty ) {
                $noty.close();
                eventBus.publish( 'requirementDocumentation.closeWidePanel' );
            }
        }, {
            addClass: 'btn btn-notify',
            text: _data.i18n.save,
            onClick: function( $noty ) {
                $noty.close();
                eventBus.publish( 'Arm0SingleRequirementWidePanelEditor.saveAndCloseWidePanelContent' );
            }
        } ];

        messagingService.showWarning( msg, buttons );
    }else{
        eventBus.publish( 'requirementDocumentation.closeWidePanel' );
    }
};


export default exports = {
    initWidePanelContent,
    isCkeditorInstanceReady,
    getSelectedRefObj,
    getSpecificationSegmentInput,
    getInputValues,
    showWidePanelEditorPopup,
    unRegisterCtxclosePopup,
    hidePopupPanel,
    checkAndCloseWidePanel,
    setOLEDetailsToData,
    setImageDetailsToData,
    updatePopupPosition
};
