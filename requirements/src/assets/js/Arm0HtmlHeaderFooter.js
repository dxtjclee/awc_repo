// Copyright (c) 2022 Siemens

/**
 * Module for the Header Footer Template object
 *
 * @module js/Arm0HtmlHeaderFooter
 */
import reqUtils from 'js/requirementsUtils';
import ckeditorOperations from 'js/ckeditorOperations';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import leavePlaceService from 'js/leavePlace.service';
import Arm0RequirementDocumentation from 'js/Arm0RequirementDocumentation';
import messagingService from 'js/messagingService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import $ from 'jquery';
import rmCkeditorService from 'js/Arm0CkeditorService';
import { getBaseUrlPath } from 'app';


var exports = {};
var _data = null;
var img = document.createElement( 'img' );
img.setAttribute( 'src', getBaseUrlPath() + '/image/indicatorContainsInnerMismatchesInOtherScope16.svg' );
img.setAttribute( 'style', 'width:300px' );
var saveHandler = {};

/**
 * Check CKEditor content changed / Dirty.
 *
 * @param {String} id - CKEditor ID
 * @return {Boolean} isDirty
 */
let _checkCKEditorDirty = function( id ) {
    return ckeditorOperations.checkCKEditorDirty( id, appCtxService.ctx );
};

/**
 * process HTML BodyText before save.
 *
 * @param {String} content - body text
 * @return {String} updated bodyText
 */
let _preProcessBeforeSave = function( content ) {
    let htmlElement = document.createElement( 'div' );
    htmlElement.innerHTML = content;

    addStyleToFigure( htmlElement );

    let headerFooterDiv = htmlElement.getElementsByClassName( 'aw-requirement-bodytext' );

    let coverPageContent = '<coverPage>' + headerFooterDiv[ 0 ].innerHTML + '</coverPage>';
    let headerContent = '<header>' + headerFooterDiv[ 1 ].innerHTML + '</header>';

    let specContentHtml = _preProcessSpecContent( headerFooterDiv[ 2 ].innerHTML );
    let specContent = '<specContent>' + specContentHtml + '</specContent>';
    let figuresContent = '<figures>' + headerFooterDiv[ 3 ].innerHTML + '</figures>';
    let tablesContent = '<tables>' + headerFooterDiv[ 4 ].innerHTML + '</tables>';
    let footerContent = '<footer>' + headerFooterDiv[ 5 ].innerHTML + '</footer>';

    let bodyText = '<div class="aw-requirement-bodytext">' + coverPageContent + headerContent + specContent + figuresContent + tablesContent + footerContent + '</div>';
    bodyText = reqUtils.processHTMLBodyText( bodyText );

    return bodyText;
};

let _preProcessSpecContent = function( html ) {
    let htmlElement = document.createElement( 'div' );
    htmlElement.innerHTML = html;

    let childNodes = htmlElement.children;
    if( childNodes && childNodes.length > 0 ) {
        for( let i = 0; i < childNodes.length; i++ ) {
            let node = childNodes[ i ];
            let nodeValue = node.innerText;
            if( node.children && node.children.length > 0 ) {
                for( let j = 0; j < node.children.length; j++ ) {
                    let n1 = node.children[j];
                    let n1Value = node.innerText;
                    if( n1 && n1.innerText !== node.innerText ) {
                        let index = node.innerHTML.indexOf( n1.outerHTML );
                        let text = node.innerHTML.substring( 0, index ) + n1.innerText + node.innerHTML.substring( index + n1.outerHTML.length );
                        n1.remove();
                        n1 = node.firstElementChild;
                        j--;
                        if( nodeValue !== node.innerText ) {
                            node.innerHTML = text;
                        }
                    }
                    if( n1 && n1.children && n1.children.length > 0 ) {
                        for( let k = 0; k < n1.children.length; k++ ) {
                            let n2 = n1.children[k];
                            if( n2 && n2.innerText !== n1.innerText ) {
                                let index = n1.innerHTML.indexOf( n2.outerHTML );
                                let text = n1.innerHTML.substring( 0, index ) + n2.innerText + n1.innerHTML.substring( index + n2.outerHTML.length );
                                n2.remove();
                                n2 = n1.firstElementChild;
                                k--;
                                if( n1Value !== n1.innerText ) {
                                    n1.innerHTML = text;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return htmlElement.innerHTML;
};
/**
 * Method to apply style to figure element in ckeditor 5
 * @param {Element} htmlElement the root of the specification template
 */
function addStyleToFigure( htmlElement ) {
    let figures = htmlElement.getElementsByTagName( 'figure' );
    if( figures.length > 0 ) {
        for( let i = 0; i < figures.length; i++ ) {
            let figElement = figures.item( i );
            figElement.style.margin = '1em auto';
            figElement.style.textAlign = 'center';
            if( figElement.classList.contains( 'table' ) ) {
                figElement.style.display = 'table';
                figElement.firstElementChild.style.borderCollapse = 'collapse';
                if( figElement.firstElementChild.style.border === '' ) {
                    figElement.firstElementChild.style.margin = '1em auto';
                    figElement.firstElementChild.style.border = '1px solid';
                    let rows = figElement.getElementsByTagName( 'tr' );
                    for( let k = 0; k < rows.length; k++ ) {
                        let row = rows[ k ];
                        updateTableStyle( row, 'th' );
                        updateTableStyle( row, 'td' );
                    }
                }
            }
        }
    }
}
/**
 *
 * @param {Element} element the dom element
 * @param {String} tagName the tag name
 */
function updateTableStyle( element, tagName ) {
    let datas = element.getElementsByTagName( tagName );
    for( let j = 0; j < datas.length; j++ ) {
        let data = datas[ j ];
        if ( data.style.border === '' ) {
            data.style.border = '1px solid';
        }
    }
}

/**
 * custom save handler save edits called by framework
 * @param {Object} dataSource the dataSource
 * @return {Object}promise
 */
saveHandler.saveEdits = function( dataSource ) {
    let deferred = AwPromiseService.instance.defer();

    if( _checkCKEditorDirty( _data.editorProps.id ) ) {
        let _modelObj = dataSource.getLoadedViewModelObjects() ? dataSource.getLoadedViewModelObjects()[0] : dataSource.getContextVMO();

        let content = ckeditorOperations.getCKEditorContent( _data.editorProps.id, appCtxService.ctx );
        let bodyText = _preProcessBeforeSave( content );

        let input = {
            inputs: [ {
                objectToProcess: Arm0RequirementDocumentation.getRevisionObject( _modelObj ),
                bodyText: bodyText,
                lastSavedDate: Arm0RequirementDocumentation.getRevisionObjectLsd( _modelObj ),
                contentType: Arm0RequirementDocumentation.getContentType( _data ),
                isPessimisticLock: true
            } ]
        };

        let promise = soaSvc.post( 'Internal-AWS2-2016-12-RequirementsManagement',
            'setRichContent2', input );

        promise.then( function( response ) {
            let relatedObjects = response.updated;
            deferred.resolve( relatedObjects );
        } )
            .catch( function( error ) {
                let errorCode = error.cause.partialErrors[ '0' ].errorValues[ '0' ].code;
                if( errorCode === 141023 ) {
                    let errorMsg = _data.i18n.multiUserEditError.replace( '{0}', _data.selected.cellHeader1 );
                    messagingService.showError( errorMsg );
                    error = null;
                }
                deferred.reject( error );
            } );
    } else {
        deferred.resolve( null );
    }
    return deferred.promise;
};

/**
 * Return true for ckeditor content modification
 *
 * @return {boolean} true if editor is dirty
 */
saveHandler.isDirty = function() {
    return _checkCKEditorDirty( _data.editorProps.id );
};

/**
 * Get save handler.
 *
 * @return {Object}Save Handler
 */
export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * Creates html for HeaderFooter widget
 *
 * @param {String} id - html element id
 * @param {String} objType - html element object type
 * @param {String} title - html element title
 * @param {Object} bodyText - html element bodyText
 * @param {boolean} viewOnly - flag that contains if it is in view/edit mode
 *
 * @return {String} htmlWidget - html widget
 */
let _getHeaderFooterWidgetHtml = function( id, objType, title, bodyText, viewOnly ) {
    let htmlWidget = '<div class="requirement" id="' + id + '" objecttype="' + objType + '" >';
    let arm0Requirements = appCtxService.getCtx( 'Arm0Requirements' );
    if( arm0Requirements.Editor === 'CKEDITOR_5' && !viewOnly ) {
        htmlWidget += '<div class="aw-requirement-header" contenttype="TITLE"  contenteditable="false">';
    } else {
        htmlWidget += '<div class="aw-requirement-header" contenttype="TITLE" style="outline:none;background-color:#f0f0f0;" contenteditable="false">';
    }
    htmlWidget += '<h3 contenteditable="false"><span contenteditable="false" style="outline:none;background-color:#f0f0f0;"></span> <label data-placeholder="Title">' + title + ' </label></h3></div>';
    htmlWidget += '<div class="aw-requirement-content" contenteditable="false" style="cursor:pointer;"><div class="aw-requirement-bodytext" contenteditable=';
    if( viewOnly ) {
        htmlWidget += '"false">';
    } else {
        htmlWidget += '"true">';
    }
    htmlWidget += bodyText;
    htmlWidget += '</div></div></div>';
    return htmlWidget;
};

/**
 * Creates widget for HeaderFooter revision
 *
 * @param {Object} elementHeaderFooter - html object
 * @param {Object} viewOnly - flag that contains if it is in view/edit mode
 */
let _updateHeaderFooterWidget = function( elementHeaderFooter, viewOnly ) {
    let headerDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'header' );
    let footerDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'footer' );
    let coverPageDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'coverPage' );
    let specContentDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'specContent' );
    let figuresDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'figures' );
    let tablesDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'tables' );

    let htmlHeaderWidget = _getHeaderFooterWidgetHtml( 'header', 'header', _data.i18n.headerLabel, headerDiv[ 0 ].innerHTML, viewOnly );
    let htmlFooterWidget = _getHeaderFooterWidgetHtml( 'footer', 'footer', _data.i18n.footerLabel, footerDiv[ 0 ].innerHTML, viewOnly );
    let coverPageTeamplate;
    if( coverPageDiv && coverPageDiv.length > 0 ) {
        if( viewOnly ) {
            _updatePageBreaksForView( coverPageDiv[0] );
        }
        coverPageTeamplate = _getHeaderFooterWidgetHtml( 'cover page', 'cover page', _data.i18n.coverPageLabel, coverPageDiv[ 0 ].innerHTML, viewOnly );
    } else {
        coverPageTeamplate = _getHeaderFooterWidgetHtml( 'cover page', 'cover page', _data.i18n.coverPageLabel, '<p></p>', viewOnly );
    }
    let specContentTemplate;
    if( specContentDiv && specContentDiv.length > 0 ) {
        specContentTemplate = _getHeaderFooterWidgetHtml( 'specContent', 'specContent', _data.i18n.specContentLabel, specContentDiv[0].innerHTML, viewOnly );
    } else{
        specContentTemplate = _getHeaderFooterWidgetHtml( 'specContent', 'specContent',  _data.i18n.specContentLabel, '<h1>Heading 1</h1><p>Content under heading 1</p><h2>1 Heading 2</h2><p>Content under heading 2</p><h3>1.1 Heading 3</h3><p>Content under heading 3</p><h4>1.1.1 Heading 4</h4><p>Content under heading 4</p><h5>1.1.1.1 Heading 5</h5><p>Content under heading 5</p><h6>1.1.1.1.1 Heading 6</h6><p>Content under heading 6</p>', viewOnly );
    }
    let figureTemplate;
    if( figuresDiv && figuresDiv.length > 0 && figuresDiv[0].innerHTML.indexOf( 'img' ) === -1 ) {
        figureTemplate = _getHeaderFooterWidgetHtml( 'figures', 'figures', _data.i18n.figuresLabel, img.outerHTML, viewOnly );
    } else if( figuresDiv && figuresDiv.length > 0 ) {
        figureTemplate = _getHeaderFooterWidgetHtml( 'figures', 'figures',  _data.i18n.figuresLabel, figuresDiv[0].innerHTML, viewOnly );
    }else{
        figureTemplate = _getHeaderFooterWidgetHtml( 'figures', 'figures',  _data.i18n.figuresLabel, '<p></p>', viewOnly );
    }
    let tablesTemplate;
    if( tablesDiv && tablesDiv.length > 0 ) {
        tablesTemplate = _getHeaderFooterWidgetHtml( 'tables', 'tables', _data.i18n.tablesLabel, tablesDiv[0].innerHTML, viewOnly );
    } else{
        tablesTemplate = _getHeaderFooterWidgetHtml( 'tables', 'tables',  _data.i18n.tablesLabel, '<p></p>', viewOnly );
    }
    elementHeaderFooter[ 0 ].innerHTML = coverPageTeamplate +  htmlHeaderWidget + specContentTemplate + figureTemplate + tablesTemplate +  htmlFooterWidget;
};

// Add Page-Break Text to show in viewer.  CKEditor takes care it in edit mode.
let _updatePageBreaksForView = function( coverPageDiv ) {
    let pageBreaks = coverPageDiv.getElementsByClassName( 'page-break' );
    for ( const pageBreak of pageBreaks ) {
        let labelSpan = document.createElement( 'span' );
        labelSpan.classList.add( 'page-break__label' );
        labelSpan.innerText = _data.i18n.pageBreakLabel;
        pageBreak.appendChild( labelSpan );
    }
};

/**
 * Get initial html content for HeaderFooter revision
 *
 * @return {String} HTML content
 */
let _getInitialHeaderFooterHtml = function() {
    return '<coverPage><p></p></coverPage><header><p></p></header><specContent><h1>Heading 1</h1><p>Content under heading 1</p><h2>1 Heading 2</h2><p>Content under heading 2</p><h3>1.1 Heading 3</h3><p>Content under heading 3</p><h4>1.1.1 Heading 4</h4><p>Content under heading 4</p><h5>1.1.1.1 Heading 5</h5><p>Content under heading 5</p><h6>1.1.1.1.1 Heading 6</h6><p>Content under heading 6</p></specContent><figures><p></p></figures><tables><p></p></tables><footer><p></p></footer>';
};

/**
 * Get Requirement top Element of Panel.
 *
 * @return {Object} HTML element
 */
let _getRMElement = function() {
    let element = document.getElementsByClassName( 'aw-requirements-xrtRichText' );
    if( !element || element.length <= 0 ) {
        return null;
    }
    return element;
};

/**
 * Set viewer content
 *
 * @param {String} htmlContent - html Content
 */
let _setViewerContent = function( htmlContent ) {
    let requirementElement = _getRMElement();
    requirementElement[ 0 ].classList.add( 'aw-requirementsCkeditor-panel' );
    let element = requirementElement[ 0 ].getElementsByClassName( 'aw-requirement-a4SizePaper aw-richtexteditor-document aw-richtexteditor-documentPanel' );
    if( !element || element.length <= 0 ) {
        let elementChild = document.createElement( 'div' );
        elementChild.className += ' aw-requirement-a4SizePaper aw-richtexteditor-document aw-richtexteditor-documentPanel';
        elementChild.innerHTML = htmlContent;
        requirementElement[ 0 ].appendChild( elementChild );
    } else {
        element[ 0 ].innerHTML = htmlContent;
    }
};

/**
 * Set CKEditor Content.
 *
 * @param {Object} data - The panel's view model object
 * @param {String} id - CKEditor ID
 * @param {String} content - content to set in CK Editor
 */
let _setCKEditorContent = function( data, id, content ) {
    setTimeout( function() {
        let editorInstance = document.getElementsByClassName( 'aw-richtexteditor-editorPanel aw-ckeditor-panel aw-requirements-mainPanel' );
        if( editorInstance.length > 0 ) {
            editorInstance[ 0 ].setAttribute( 'class', 'aw-requirement-a4SizePaper aw-ckeditor-panel aw-requirements-mainPanel' );
        }
        ckeditorOperations.setCKEditorContent( id, content, appCtxService.ctx );
        eventBus.publish( 'requirementsEditor.resizeEditor' );
    }, 1000 ); // TODO:: This timeout needs to be removed
};

/**
 * Pre-process the contetns and set it to editor
 * @param {Object} data - view model object data
 */
let _preprocessContentsAndSetToEditor = function( data ) {
    let headerFooterDiv = getHeaderFooterDivFromHtmlElement( data );
    _updateHeaderFooterWidget( headerFooterDiv, !data.editMode );

    if( !data.editMode ) {
        _setViewerContent( headerFooterDiv[ 0 ].innerHTML );
    } else {
         if( data.ckeditorReady ) {
             //  If ckeditor is ready, set contents
             _setCKEditorContent( data, data.editorProps.id, headerFooterDiv[ 0 ].innerHTML );
         } else {
             // If not, set flat to indicate that content is ready to set
             data.contentReady = true;
         }
    }
};

/**
 * Check if ckeditor instance created before setting contents
 * @param {Object} data - view model data
 */
 export let isCkeditorInstanceReady = function( data ) {
    if( appCtxService.ctx.AWRequirementsEditor && appCtxService.ctx.AWRequirementsEditor.id === data.editorProps.id && appCtxService.ctx.AWRequirementsEditor.ready ) {
        data.ckeditorReady = true;

        // If content is ready to set
        if( data.contentReady ) {
            // If ckeditor is ready, set contents
            let headerFooterDiv = getHeaderFooterDivFromHtmlElement( data );
            _updateHeaderFooterWidget( headerFooterDiv, !data.editMode );
            _setCKEditorContent( data, data.editorProps.id, headerFooterDiv[ 0 ].innerHTML );

            // Reset the flag
            data.contentReady = false;
        }
    }
    return {
        contentReady: data.contentReady,
        ckeditorReady: data.ckeditorReady
    };
};

/**
 * Get headerFooterDiv from html element
 * @param {Object} data - view model object data
 */
 let getHeaderFooterDivFromHtmlElement = function( data ) {
    let htmlContent = data.htmlContent;
    let htmlElement = document.createElement( 'div' );
    htmlElement.innerHTML = htmlContent;
    let headerFooterDiv = htmlElement.getElementsByClassName( 'aw-requirement-bodytext' );

    if( headerFooterDiv[ 0 ].getElementsByTagName( 'header' ).length < 1 || headerFooterDiv[ 0 ].getElementsByTagName( 'footer' ).length < 1 ) {
        headerFooterDiv[ 0 ].innerHTML = '';
    }

    if( headerFooterDiv[ 0 ].innerHTML === '' ) {
        headerFooterDiv[ 0 ].innerHTML = _getInitialHeaderFooterHtml();
    }
    return headerFooterDiv;
};

/**
 * Initialize Ckeditor
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Context object
 */
export let initCkeditor = function( data ) {
    data.editorProps.id = reqUtils.generateCkeditorID();
    data.editorProps.preferences = appCtxService.getCtx( 'preferences' );
    data.editorProps.a4SizeEditor = true;
    if( data.dispatch ) {
        data.dispatch( { path: 'data.editorProps', value: data.editorProps } );
    }
    rmCkeditorService.isCkeditorLoaded().then(
        function() {
            data.editorProps.showCKEditor = true;
            if( data.dispatch ) {
                data.dispatch( { path: 'data.editorProps', value: data.editorProps } );
            }
            eventBus.publish( 'requirement.initCKEditorEvent' );
        } );
    return {
        editorProps: data.editorProps
    };
};

/**
 * Initialize HTML content
 *
 * @param {Object} data - The panel's view model object
 */
export let initContent = function( data ) {
    _data = data;
    if( !data.editMode ) {
        data.showCKEditor = false;
    } else {
        data.showCKEditor = true;
    }
    if( data.dispatch ) {
        data.dispatch( { path: 'data.showCKEditor', value: data.showCKEditor } );
    }

    _preprocessContentsAndSetToEditor( data );

    return {
        contentReady: data.contentReady,
        ckeditorReady: data.ckeditorReady,
        showCKEditor: data.showCKEditor
    };
};

/**
 * Cancel all edits made in document
 */
export let cancelEdits = function() {
    exports.unloadContent();

    // Event to load the saved contents
    eventBus.publish( 'Arm0HtmlHeaderFooter.initContent' );
};

/**
 * Remove the handlers and events on content unloading
 */
export let unloadContent = function() {
    leavePlaceService.registerLeaveHandler( null );
};

/**
 * update data for fileData
 *
 * @param {Object} fileData - key string value the location of the file
 * @param {Object} data - the view model data object
 * @return {Object} formData
 */
export let updateFormData = function( fileData, data ) {
    if( fileData && fileData.value ) {
        let form = data.form;
        data.formData = new FormData( $( form )[ 0 ] );
        data.formData.append( fileData.key, fileData.value );
    }
    return data.formData;
};

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 * @return file URL
 */

let _getFileURL = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + fmsUtils.getFMSUrl() + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
};

/**
 * Insert Image
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let insertImage = function( data ) {
    if( data.fmsTicket ) {
        let imageURL = _getFileURL( data.fmsTicket );
        let uid = data.createdObject.uid;
        if( imageURL !== null ) {
            ckeditorOperations.insertImage( data.editorProps.id, imageURL, uid, appCtxService.ctx );
        }
    }
};

/**
 * get Export options.
 *
 * @return {Any} array of export options
 */
export let getExportOptions = function() {
    let options = [];
    let baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    let requestPref = {
        option: 'base_url',
        optionvalue: baseURL
    };
    options.push( requestPref );
    return options;
};

/**
 * Process EditHandlerStateChanged Event
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} source - datasource
 * @return {Object} editMode true or false
 */
export let processEditHandlerStateChanged = function( data, source ) {
    if ( data.eventData.dataSource.context === source ) {
        if( data.eventData.state === 'starting' ) {
            _data = data;
            data.editMode = true;
            appCtxService.registerCtx( 'editHeaderFooterSaveHandler', true );
            eventBus.publish( 'Arm0HtmlHeaderFooter.getHTMLTextContent' );
        } else if( ( data.eventData.state === 'canceling' || data.eventData.state === 'saved' ) && data.editMode ) {
            data.editMode = false;

            appCtxService.updateCtx( 'editHeaderFooterSaveHandler', false );
            appCtxService.unRegisterCtx( 'editHeaderFooterSaveHandler' );
            eventBus.publish( 'Arm0HtmlHeaderFooter.getHTMLTextContent' );
        }
    }
    return {
        editMode: data.editMode
    };
};

/**
 * Prepare input for image insertion
 *
 * @param {Object} data - The panel's view model object
 * @return {Object} datasetInfo and form
 */
export let prepareInputforImageInsert = function( data ) {
    let eventData = data.eventData;
    let fileName = 'fakepath\\' + eventData.file.name;

    if( reqUtils.stringEndsWith( fileName.toUpperCase(), '.gif'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.png'.toUpperCase() ) ||
        reqUtils.stringEndsWith( fileName.toUpperCase(), '.jpg'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.jpeg'.toUpperCase() ) ||
        reqUtils.stringEndsWith( fileName.toUpperCase(), '.bmp'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.wmf'.toUpperCase() ) ) {
        data.form = eventData.form;

        let datasetInfo = {
            clientId: eventData.clientid,
            namedReferenceName: 'Image',
            fileName: fileName,
            name: eventData.clientid,
            type: 'Image'
        };

        data.datasetInfo = datasetInfo;
    } else {
        messagingService.reportNotyMessage( data, data._internal.messages,
            'notificationForImageErrorWrongFile' );
    }
    return {
        datasetInfo: data.datasetInfo,
        form: eventData.form
    };
};

export default exports = {
    getSaveHandler,
    initContent,
    cancelEdits,
    unloadContent,
    updateFormData,
    insertImage,
    getExportOptions,
    processEditHandlerStateChanged,
    initCkeditor,
    prepareInputforImageInsert,
    isCkeditorInstanceReady
};
