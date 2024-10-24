// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement Compare Utilities
 *
 * @module js/Arm0CompareUtils
 */
import browserUtils from 'js/browserUtils';
import appCtxSvc from 'js/appCtxService';

var exports = {};
var TC_MICRO_PREFIX = 'tc/micro';
var RM_COMPARE_HTML = '/req_compare/v1/compare/html';

/**
 * get Compare HTML service URL.
 *
 * @return {String} url of html microservice.
 */
export let getCompareHtmlServiceURL = function() {
    return browserUtils.getBaseURL() + TC_MICRO_PREFIX + RM_COMPARE_HTML;
};

/**
 * @param {String} content - html content
 * @return {String} processed html content
 * Add removed spans back in the header
 */
export let addSpansInContent = function( content, data ) {
    var map = null;
    if( data.mapOfVerAndRev !== undefined ) {
        map = data.mapOfVerAndRev;
    }
    var aceActiveContext = appCtxSvc.getCtx( 'Arm0ReqSpecVersionHistoryContext.selectedSpecRevs' );
    if( content && map !== null ) {
        var contentDivElement = document.createElement( 'div' );
        contentDivElement.innerHTML = content;

        var h3Element = contentDivElement.getElementsByTagName( 'h3' );
        var emptySpan = document.createElement( 'span' );
        emptySpan.className = 'aw-requirements-compareSpecVersionHistory';
        for ( let index = 0; index < map.length; index++ ) {
            for( let i = 0; i < h3Element.length; i++ ) {
                var spanElements = h3Element[ i ].getElementsByTagName( 'span' );
                var splittedSpan = spanElements[ 0 ].innerText.split( '-' );
                if( index === 1 ) {
                    if( map[ index ].has( splittedSpan[ 1 ] ) ) {
                        var spanElements1 = h3Element[ i ].getElementsByTagName( 'span' );
                        if( spanElements1.length > 2 || spanElements1.length === 1 ) {
                            emptySpan.innerHTML = map[ index ].get(  splittedSpan[ 1 ]  );
                            h3Element[ i ].innerHTML += emptySpan.outerHTML;
                        }else{
                            var msg =  data.i18n.withLabel.replace( '{0}', spanElements1[1].innerHTML );
                            msg = msg.replace( '{1}', map[ index ].get(  splittedSpan[ 1 ]  ) );
                            spanElements1[1].innerHTML = msg;
                        }
                    }
                } else if( map[ index ].has( splittedSpan[ 1 ] ) ) {
                    emptySpan.innerHTML = '';
                    emptySpan.innerHTML = map[ 0 ].get(  splittedSpan[ 1 ]  );
                    h3Element[ i ].innerHTML += emptySpan.outerHTML;
                }
            }
        }

        //Get Version/Revision information of top elements
        var revVerInfoObj1 = _getVersionRevisionInfo( aceActiveContext.selectedSpecRevs.Obj1, data );
        var revVerInfoObj2 = _getVersionRevisionInfo( aceActiveContext.selectedSpecRevs.Obj2, data );

        var versionRevisionInfo = document.createElement( 'span' );
        versionRevisionInfo.className = 'aw-requirements-compareSpecVersionHistory';

        var headermsg = data.i18n.withLabel.replace( '{0}', revVerInfoObj1 );
        headermsg = headermsg.replace( '{1}', revVerInfoObj2 );
        versionRevisionInfo.innerText = headermsg;
        h3Element[0].append( versionRevisionInfo );
        return contentDivElement.innerHTML;
    }
    return content;
};

/**
 * Return objects Version and revision Info for top element
 * @param {Object} element - html element
 * @returns {Object} element
 */
var _getVersionRevisionInfo = function( object, data ) {
    var Obj1VersionNo = object.replace( /(\r\n|\n|\r)/gm, '' );
    var revVerInfo = Obj1VersionNo.split( ';' );
    var revTitle = revVerInfo[0].split( data.i18n.revision );
    var revision = data.i18n.revision + ' ' + revTitle[1];
    var verTitle = revVerInfo[1].split( data.i18n.versionNumber );
    var version = data.i18n.versionNumber + ' ' + verTitle[1];
    var revVerInfo = revision + '; ' + version;
    return revVerInfo;
};

/**
 * Compare images from given html strings and sync if same image based on imageuid attribute
 *
 * @param {Object} htmlContentData - Json data with 2 html string contents
 */
export let syncSameImagesAndOLE = function( htmlContentData ) {
    var firstHtmldiv = document.createElement( 'div' );
    firstHtmldiv.innerHTML = htmlContentData.html1;
    var secondHtmldiv = document.createElement( 'div' );
    secondHtmldiv.innerHTML = htmlContentData.html2;
    var contentUpdated = false;
    var attributesToSync = [ 'id', 'alt', 'src', 'oleobjectuid', 'oleid', 'datasettype', 'datasetFileTicket', 'olepreviewid' ];
    // Find same image from second html and sync with first html
    var firstImages = firstHtmldiv.getElementsByTagName( 'img' );
    for ( let index = 0; index < firstImages.length; index++ ) {
        const firstImg = firstImages[index];
        var imageuid = firstImg.getAttribute( 'imageuid' );
        if( imageuid && imageuid !== '' ) {
            //try to get image from second content with same id
            var secondImg = secondHtmldiv.querySelector( '[imageuid="' + imageuid + '"]' );

            if( secondImg ) {
                // same image
                attributesToSync.forEach( attr => {
                    if( firstImg.getAttribute( attr ) ) {
                        secondImg.setAttribute( attr, firstImg.getAttribute( attr ) );
                    }
                } );
                contentUpdated = true;
            }
        }
    }

    if( contentUpdated ) {
        htmlContentData.html1 = firstHtmldiv.innerHTML;
        htmlContentData.html2 = secondHtmldiv.innerHTML;
    }
};


export default exports = {
    getCompareHtmlServiceURL,
    syncSameImagesAndOLE,
    addSpansInContent
};
