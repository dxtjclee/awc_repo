// Copyright (c) 2022 Siemens

/**
 * Module for the Preview of Header Footer Template object
 *
 * @module js/Arm0HtmlHeaderFooterPreview
 */
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import { getBaseUrlPath } from 'app';


var img = document.createElement( 'img' );
img.setAttribute( 'src', getBaseUrlPath() + '/image/indicatorContainsInnerMismatchesInOtherScope16.svg' );
img.setAttribute( 'style', 'width:300px' );
var exports = {};

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
    let element = document.querySelectorAll( '.aw-requirements-xrtRichText' );
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
    if( requirementElement && requirementElement.length > 0 ) {
        let element = requirementElement[0].querySelectorAll( 'aw-richtexteditor-documentPaper aw-richtexteditor-document aw-richtexteditor-documentPanel' );
        if( !element || element.length <= 0 ) {
            let elementChild = document.createElement( 'div' );
            elementChild.className += ' aw-richtexteditor-documentPaper aw-richtexteditor-document aw-richtexteditor-documentPanel';
            elementChild.innerHTML = htmlContent;
            requirementElement[ 0 ].appendChild( elementChild );
        } else {
            element[ 0 ].innerHTML = htmlContent;
        }
    }
};

/**
  * Creates html for HeaderFooter widget
  *
  * @param {Object} id - html element id
  * @param {Object} objType - html element object type
  * @param {Object} title - html element title
  * @param {Object} bodyText - html element bodyText
  */
let _getHeaderFooterWidgetHtml = function( id, objType, title, bodyText ) {
    let htmlWidget = '<div class="requirement" id="' + id + '" objecttype="' + objType + '" >';
    htmlWidget += '<div class="aw-requirement-header" contenttype="TITLE" style="outline:none;background-color:#f0f0f0;" contenteditable="false">';
    htmlWidget += '<h3 contenteditable="false"><span contenteditable="false" style="outline:none;background-color:#f0f0f0;"></span> <label data-placeholder="Title">' + title + ' </label></h3></div>';
    htmlWidget += '<div class="aw-requirement-content" contenteditable="false" style="cursor:pointer;"><div class="aw-requirement-bodytext" contenteditable="false" >';
    htmlWidget += bodyText;
    htmlWidget += '</div></div></div>';
    return htmlWidget;
};

/**
  * Creates widget for HeaderFooter revision
  *
  * @param {Object} elementHeaderFooter - html object
  */
let _updateHeaderFooterWidget = function( elementHeaderFooter, data ) {
    let headerDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'header' );
    let footerDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'footer' );
    let coverPageDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'coverPage' );
    let specContentDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'specContent' );
    let figuresDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'figures' );
    let tablesDiv = elementHeaderFooter[ 0 ].getElementsByTagName( 'tables' );

    let htmlHeaderWidget = _getHeaderFooterWidgetHtml( 'header', 'header', data.i18n.headerLabel, headerDiv[ 0 ].innerHTML );
    let htmlFooterWidget = _getHeaderFooterWidgetHtml( 'footer', 'footer', data.i18n.footerLabel, footerDiv[ 0 ].innerHTML );
    let coverPageTeamplate;
    if( coverPageDiv && coverPageDiv.length > 0 ) {
        _updatePageBreaksForView( coverPageDiv[0], data );
        coverPageTeamplate = _getHeaderFooterWidgetHtml( 'cover page', 'cover page', data.i18n.coverPageLabel, coverPageDiv[0].innerHTML );
    } else{
        coverPageTeamplate = _getHeaderFooterWidgetHtml( 'cover page', 'cover page', data.i18n.coverPageLabel, '<p></p>' );
    }
    let specContentTemplate;
    if( specContentDiv && specContentDiv.length > 0 ) {
        specContentTemplate = _getHeaderFooterWidgetHtml( 'specContent', 'specContent', data.i18n.specContentLabel, specContentDiv[0].innerHTML );
    } else{
        specContentTemplate = _getHeaderFooterWidgetHtml( 'specContent', 'specContent',  data.i18n.specContentLabel, '<h1>Heading 1</h1><p>Content under heading 1</p><h2>1 Heading 2</h2><p>Content under heading 2</p><h3>1.1 Heading 3</h3><p>Content under heading 3</p><h4>1.1.1 Heading 4</h4><p>Content under heading 4</p><h5>1.1.1.1 Heading 5</h5><p>Content under heading 5</p><h6>1.1.1.1.1 Heading 6</h6><p>Content under heading 6</p>' );
    }

    let figureTemplate;

    if( figuresDiv && figuresDiv.length > 0 && figuresDiv[0].innerHTML.indexOf( 'img' ) === -1 ) {
        figureTemplate = _getHeaderFooterWidgetHtml( 'figures', 'figures', data.i18n.figuresLabel, img.outerHTML );
    } else if( figuresDiv && figuresDiv.length > 0 ) {
        figureTemplate = _getHeaderFooterWidgetHtml( 'figures', 'figures',  data.i18n.figuresLabel, figuresDiv[0].innerHTML );
    }else{
        figureTemplate = _getHeaderFooterWidgetHtml( 'figures', 'figures',  data.i18n.figuresLabel, '<p></p>' );
    }

    let tablesTemplate;
    if( tablesDiv && tablesDiv.length > 0 ) {
        tablesTemplate = _getHeaderFooterWidgetHtml( 'tables', 'tables', data.i18n.tablesLabel, tablesDiv[0].innerHTML );
    } else{
        tablesTemplate = _getHeaderFooterWidgetHtml( 'tables', 'tables',  data.i18n.tablesLabel, '<p></p>' );
    }
    elementHeaderFooter[ 0 ].innerHTML = coverPageTeamplate +  htmlHeaderWidget + specContentTemplate + figureTemplate + tablesTemplate + htmlFooterWidget;
};

// Add Page-Break Text to show in viewer.
let _updatePageBreaksForView = function( coverPageDiv, data ) {
    let pageBreaks = coverPageDiv.getElementsByClassName( 'page-break' );
    for ( const pageBreak of pageBreaks ) {
        let labelSpan = document.createElement( 'span' );
        labelSpan.classList.add( 'page-break__label' );
        labelSpan.innerText = data.i18n.pageBreakLabel;
        pageBreak.appendChild( labelSpan );
    }
};

/**
  * Pre-process the contents and set it to editor
  * @param {Object} data - view model object data
  */
let _preprocessContentsAndSetToEditor = function( data ) {
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
    _updateHeaderFooterWidget( headerFooterDiv, data );
    _setViewerContent( headerFooterDiv[ 0 ].innerHTML );
};

/**
  * Initialize HTML content
  *
  * @param {Object} data - The panel's view model object
  */
export let initContent = function( data ) {
    _preprocessContentsAndSetToEditor( data );
};

/**
  * get Export options.
  *
  * @param {Object} data - data
  * @return {Any} array of export options
  */
export let getExportOptions = function( data ) {
    let options = [];
    let baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    let requestPref = {
        option: 'base_url',
        optionvalue: baseURL
    };
    options.push( requestPref );

    return options;
};

export default exports = {
    initContent,
    getExportOptions
};
