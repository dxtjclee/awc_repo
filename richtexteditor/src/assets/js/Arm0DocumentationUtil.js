// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement Documentation Page
 *
 * @module js/Arm0DocumentationUtil
 */
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import rmCkeditorService from 'js/Arm0CkeditorService';
import reqUtils from 'js/requirementsUtils';
import eventBus from 'js/eventBus';
import ckeditorOperations from 'js/ckeditorOperations';
import fmsUtils from 'js/fmsUtils';
import $ from 'jquery';
import browserUtils from 'js/browserUtils';

var exports = {};
var CONTENT_TYPE_HTML = 'HTML';
var CONTENT_TYPE_WORD = 'Word';
var CONTENT_TYPE_PLAIN = 'Plain';
var uidFileNameMap = {};

/**
 * get Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {Object} Revision Object
 */
export let getRevisionObject = function( obj ) {
    var revObject = null;

    if( obj && commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        revObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    } else if( obj && commandsMapService.isInstanceOf( 'Att0MeasurableAttribute', obj.modelType ) ) {
        var selectedObjs = appCtxService.getCtx( 'pselected' );

        if( selectedObjs ) {
            return exports.getRevisionObject( selectedObjs );
        }
    } else {
        revObject = cdm.getObject( obj.uid );
    }

    return revObject;
};

/**
 * get type of Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {String} type of Object
 */
export let getRevisionObjectType = function( obj ) {
    var revObject = exports.getRevisionObject( obj );

    return revObject.type;
};

/**
 * get type of Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {String} type of Object
 */
export let getRevisionObjectUid = function( obj ) {
    var revObject = exports.getRevisionObject( obj );

    return revObject.uid;
};

/**
 * get lsd of Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {String} lsd of Object
 */
export let getRevisionObjectLsd = function( obj ) {
    var revObject = exports.getRevisionObject( obj );

    if( revObject && revObject.props && revObject.props.lsd ) {
        return revObject.props.lsd.dbValues[ 0 ];
    }

    return '';
};

/**
 * Set content type as HTML
 *
 * @param {Object} data - The panel's view model object
 */
var _setContentTypeHTML = function( data ) {
    data.editorProps.contentType = CONTENT_TYPE_HTML;
    data.editorProps.type = 'ADVANCED_NODROP';
};

/**
 * Set content type as Word
 *
 * @param {Object} data - The panel's view model object
 */
var _setContentTypeWord = function( data ) {
    data.editorProps.contentType = CONTENT_TYPE_WORD;
    data.editorProps.type = '';
};

/**
 * set FullText object of Requirement Revision
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let setFullTextObject = function( data ) {
    if( data.content.ServiceData && data.content.ServiceData.modelObjects ) {
        var modelObj = reqUtils.getObjectOfType( data.content.ServiceData.modelObjects, 'FullText' );

        if( modelObj !== null ) {
            data.fullTextObject = modelObj;
            var contentType = null;
            data.editorProps.contentType = null;

            if( modelObj.props.content_type === null || modelObj.props.content_type.dbValues[ 0 ] === null ) {
                contentType = CONTENT_TYPE_HTML;
            } else {
                contentType = modelObj.props.content_type.dbValues[ 0 ];
            }

            if( contentType.indexOf( CONTENT_TYPE_HTML ) > -1 || contentType.toLowerCase().indexOf( CONTENT_TYPE_PLAIN.toLowerCase() ) > -1 ) {
                _setContentTypeHTML( data );
            }else {
                //Object in context is NOT HTML or Plain text type, preference will not be checked and the Word Viewer will be shown.
                _setContentTypeWord( data );
            }
        } else {
            _setContentTypeHTML( data );
        }
    }
    data.editorProps.isWidePanelEditor = true;
    rmCkeditorService.isCkeditorLoaded().then(
        function() {
            eventBus.publish( 'requirement.initCKEditorEvent' );
        } );
};

/**
 * Add in missing image list. These images files tickets need to be updated.
 *
 * @param {Object} data - The panel's view model object
 * @param uidImage - uid of image
 */

var _addInMissingImageList = function( data, uidImage ) {
    var imanID = reqUtils.getFullTextRefObj( data.fullTextObject, uidImage );

    var objImage = {
        uid: imanID ? imanID : uidImage,
        type: 'unknownType'
    };

    if( imanID ) {
        uidFileNameMap[ imanID ] = uidImage;
        data.missingRefImages.push( objImage );
    } else {
        data.missingImages.push( objImage );
    }
};

/**
 * Read all image IDs that have broken links and add in missing Image list.
 *
 * @param {Object} data - The panel's view model object
 * @param {HTMLEement} innerHtml - innerHtml
 * @return Any
 */

export let getAllBrokenImageIDs = function( data, innerHtml ) {
    var imgs = innerHtml.getElementsByTagName( 'img' );
    data.missingImages = [];
    data.missingRefImages = [];

    for( var ii = 0; ii < imgs.length; ii++ ) {
        if( typeof imgs[ ii ].id !== 'undefined' && imgs[ ii ].id !== '' ) {
            if( imgs[ ii ].src.indexOf( 'base64' ) > -1 ) {
                continue;
            }
            if( !imgs[ ii ].complete ) {
                _addInMissingImageList( data, imgs[ ii ].id );
                continue;
            }
            if( typeof imgs[ ii ].naturalWidth !== 'undefined' && imgs[ ii ].naturalWidth === 0 ) {
                _addInMissingImageList( data, imgs[ ii ].id );
                continue;
            }
        }
    }
};

/**
 * Get CKEditor Content.
 *
 * @param {String} id- CKEditor ID
 * @return content of CKEditor
 */

var _getCKEditorContent = function( id ) {
    return ckeditorOperations.getCKEditorContent( id, appCtxService.ctx );
};

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 * @return file URL
 */

var _getFileURL = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
};

/**
 * Update broken image URL.
 *
 * @param innerHtml innerHtml
 * @param imageID image uid
 * @param ticket image file ticket
 */

var _updateImage = function( innerHtml, imageID, ticket ) {
    if( innerHtml && imageID && ticket ) {
        var imgs = innerHtml.getElementsByTagName( 'img' );

        var imageUrl = _getFileURL( ticket );
        for( var ii = 0; ii < imgs.length; ii++ ) {
            if( imgs[ ii ].id === imageID ) {
                imgs[ ii ].src = imageUrl;
            }
        }
    }
};
/**
 * Set CKEditor Content.
 *
 * @param {String} id - CKEditor ID
 * @param {String} content - content to set in CK Editor
 */
var _setCKEditorContent = function( id, content ) {
    setTimeout( function() {
        appCtxService.registerCtx( 'requirementEditorContentChanged', false );
        ckeditorOperations.setCKEditorContentAsync( id, content, appCtxService.ctx ).then( function() {
            // _setContentChangeEventHandler( id );
            // _setUndoEventHandler( id );
        } );
    }, 0 );
};

/**
 * Method to find anchor tag
 *
 * @param {DOMElement} element - DOM node
 * @return {DOMElement} returns the anchor node
 */
var _findAnchorTag = function( element ) {
    if( !element || element.tagName === 'DIV' ) {
        return null;
    }else if( element.tagName === 'A' ) {
        return element;
    }
    return _findAnchorTag( element.parentNode );
};

/**
 *
 * Update broken images urls with new url image file ticket
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let updateImages = function( data ) {
    var tmpElement = document.createElement( 'div' );

    if( !data.showCKEditor ) {
        tmpElement.innerHTML = data.viewerProps.dbValue;
    } else {
        tmpElement.innerHTML = _getCKEditorContent( data.editorProps.id );
    }

    if( !tmpElement ) {
        return;
    }

    if( data.imageRefTickets && data.imageRefTickets.tickets && data.imageRefTickets.tickets.length > 1 ) {
        var arrImanObj = data.imageRefTickets.tickets[ 0 ];
        var arrTickets = data.imageRefTickets.tickets[ 1 ];

        for( var i = 0; i < arrImanObj.length; i++ ) {
            var objIman = arrImanObj[ i ];
            var imageID = uidFileNameMap[ objIman.uid ];
            var ticket = arrTickets[ i ];

            _updateImage( tmpElement, imageID, ticket );
        }
        data.imageRefTickets = null;
    }

    if( data.imageTickets && data.imageTickets.modelObjects ) {
        var arrKey = Object.keys( data.imageTickets.modelObjects );

        for( var i = 0; i < arrKey.length; i++ ) {
            var key = arrKey[ i ];
            var modelObj = data.imageTickets.modelObjects[ key ];

            if( modelObj.type === 'Image' ) {
                var ticket = modelObj.props.awp0ThumbnailImageTicket.dbValues[ 0 ];
                _updateImage( tmpElement, modelObj.uid, ticket );
            }
        }
        data.imageTickets = null;
    }

    if( data.showCKEditor ) {
        _setCKEditorContent( data.editorProps.id, tmpElement.innerHTML );
    } else {
        data.viewerProps.dbValue = tmpElement.innerHTML;
    }
};

/**
 * set FullText object of Requirement Revision
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let insertImage = function( data ) {
    if( data.fmsTicket ) {
        var imageURL = _getFileURL( data.fmsTicket );
        var uid = data.createdObject.uid;
        if( imageURL !== null ) {
            ckeditorOperations.insertImage( data.editorProps.id, imageURL, uid, appCtxService.ctx );
        }
    }
};

/**
 * update data for fileData
 *
 * @param {Object} fileData - key string value the location of the file
 * @param {Object} data - the view model data object
 */
export let updateFormData = function( fileData, data ) {
    if( fileData && fileData.value ) {
        var form = data.form;
        data.formData = new FormData( $( form )[ 0 ] );
        data.formData.append( fileData.key, fileData.value );
    }
};

/**
 * @param {String} inputs IJsArray
 * @param {String} objectToProcess objectToProcess
 * @param {String} lsd last saved date
 * @param {String} bodyText bodyText
 * @param {String} contentType contentType
 * @return {String} IJsArray for input
 */
export let getSetRichContentInput = function( inputs, objectToProcess, lsd, bodyText, contentType ) {
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
 * Method to attach and listen click event on the preview viewer container
 *
 * @param {DOMElement} element - target DOM Node
 */
export let attachClickEventOnViewer = function( element ) {
    element.addEventListener( 'click', ( evt ) => {
        const tgtElement = evt.target;
        if( tgtElement.tagName && tgtElement.tagName !== 'DIV' ) {
            const anchorTag = _findAnchorTag( tgtElement );
            if( anchorTag && anchorTag.getAttribute( 'href' ) && anchorTag.getAttribute( 'href' ).startsWith( '#' ) ) {
                evt.preventDefault();
            }
        }
    } );
};

export default exports = {
    getRevisionObject,
    getRevisionObjectType,
    getRevisionObjectUid,
    getRevisionObjectLsd,
    setFullTextObject,
    getAllBrokenImageIDs,
    insertImage,
    updateImages,
    updateFormData,
    getSetRichContentInput,
    attachClickEventOnViewer
};
