// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * Module for the HTML Spec Template Preview Page
 *
 * @module js/Arm0HTMLSpecTemplatePreview
 */
import cdm from 'soa/kernel/clientDataModel';
import reqACEUtils from 'js/requirementsACEUtils';
import reqUtils from 'js/requirementsUtils';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import addElementTypeHandler from 'js/addElementTypeHandler';
import 'js/Arm0CkeditorService';

import 'js/commandHandlerService';
import 'js/command.service';
import 'js/leavePlace.service';
import 'js/NotyModule';
import 'js/command.service';

var _removeStartnEndTags = function( strHTML ) {
    var strHTMLResult = strHTML.replace( '<start>', '' );
    strHTMLResult = strHTMLResult.replace( '<end>', '' );
    return strHTMLResult;
};
var _addWrapperOnBodyText = function( objName, level, objType, uniqueID, parentId, parentType, bodyText ) {
    var strLevel = level;

    var updatedBodyText = '';

    updatedBodyText = '<div class="aw-requirement-bodytext" contenteditable="false" isempty="true" style="cursor:pointer;background-color:#f0f0f0;">' +
        _removeStartnEndTags( bodyText ) +
        '</div>';

    if( level !== '' ) {
        updatedBodyText = '<div class="aw-requirement-bodytext" contenteditable="false" isempty="true">' +
            _removeStartnEndTags( bodyText ) +
            '</div>';
    }
    return '<div class="requirement" hastracelink="FALSE" id="' + uniqueID + '" objecttype="' + objType + '" itemtype="' + objType + '" parentid="' + parentId + '" parenttype="' + parentType + '" parentItemType="' + parentType + '">' +

        '<div class = "aw-requirement-header" contenttype="TITLE" contenteditable="false">' +
        '<h3 contenteditable="false" data-cke-enter-mode="1" data-cke-widget-editable="content" class="cke_widget_editable_focused"><span contenteditable="false" style="cursor:pointer;">' +
        strLevel + '</span><label data-placeholder="Title"> ' + objName + '</label></h3>' +
        '</div>' +
        '<div class="aw-requirement-content" contenteditable="false" style="outline:none;">' +
        updatedBodyText +
        '</div>' +
        '</div>';
};
var _createHtmlContentForObject = function( objName, objType, uniqueID ) {
    return '<start><p> </p> <end>';
};

var _createTreeContentForObject = function( objName, objType, level, uniqueID, htmlContent ) {
    return {
        name: objName,
        internalType: objType,
        level: level,
        uniqueID: uniqueID,
        contents: htmlContent,
        Word_file_Ticket: '',
        children: []
    };
};

/**
 * load HTML Spec Template JSON
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} uidHtmlSpecTemplate html spec template uid
 * @param {Object} jsonData jsonData
 */
var _createFullTextOnSpecHtmlTemplate = function( data, uidHtmlSpecTemplate, jsonData ) {
    var revObject = cdm.getObject( uidHtmlSpecTemplate );

    var createUpdateInput = {
        inputs: [ {
            objectToProcess: {
                uid: revObject.uid,
                type: revObject.type
            },
            bodyText: '<div></div>',
            lastSavedDate: revObject.props.lsd.dbValues[ 0 ],
            contentType: 'REQ_HTML',
            isPessimisticLock: true
        } ]
    };

    var promise = soaSvc.post( 'Internal-AWS2-2016-12-RequirementsManagement',
        'setRichContent2', createUpdateInput );

    promise.then( function( response ) {
        var fullTextObj = reqACEUtils.getObjectOfType( response.modelObjects, 'FullText' );
        data.fullTextObjUid = fullTextObj.uid;

        var inputData = [ {
            object: fullTextObj,
            timestamp: '',
            vecNameVal: [ {
                name: 'body_text',
                values: [
                    JSON.stringify( jsonData )
                ]
            } ]
        } ];
        soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', {
            info: inputData
        } );
    } );
};
var _createFirstTimeJson = function( uidHtmlSpecTemplate ) {
    var revObject = cdm.getObject( uidHtmlSpecTemplate );
    var name_obj = revObject.props.object_string.uiValues[ 0 ];

    var htmlContent = _createHtmlContentForObject( name_obj, 'RequirementSpec', uidHtmlSpecTemplate );
    return _createTreeContentForObject( name_obj, 'RequirementSpec', '', uidHtmlSpecTemplate, htmlContent );
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
 * Add in missing image list. These images files tickets need to be updated.
 *
 * @param {Object} data - The panel's view model object
 * @param uidImage - uid of image
 */

const _addInMissingImageList = function( fullTextObject, uidImage, uidFileNameMap ) {
    var imanID = reqUtils.getFullTextRefObj( fullTextObject, uidImage );

    var objImage = {
        uid: imanID ? imanID : uidImage,
        type: 'unknownType'
    };

    if( imanID ) {
        uidFileNameMap[ imanID ] = uidImage;
        return objImage;
    }
};

/**
 * Read all image IDs that have broken links and add in missing Image list.
 *
 * @param {Object} data - The panel's view model object
 * @param innerHtml innerHtml
 * @return Any
 */

var _getAllBrokenImageIDs = function( data, innerHtml, uidFileNameMap ) {
    const fullTextObject = cdm.getObject( data.fullTextObjUid );
    var imgs = innerHtml.getElementsByTagName( 'img' );
    const missingRefImages = [];

    for( var ii = 0; ii < imgs.length; ii++ ) {
        if( typeof imgs[ ii ].id !== 'undefined' && imgs[ ii ].id !== '' ) {
            if( imgs[ ii ].src.indexOf( 'base64' ) > -1 ) {
                continue;
            }
            if( !imgs[ ii ].complete || typeof imgs[ ii ].naturalWidth !== 'undefined' && imgs[ ii ].naturalWidth === 0 ) {
                const objImage = _addInMissingImageList( fullTextObject, imgs[ ii ].id, uidFileNameMap );
                if( objImage ) {
                    missingRefImages.push( objImage );
                }
            }
        }
    }

    return missingRefImages;
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
 *
 * Update broken images urls with new url image file ticket
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let updateImages = function( data ) {
    var requirementElement = _getRMElement();
    var element = requirementElement[ 0 ];
    const uidFileNameMap = data.uidFileNameMap;

    if( !element ) {
        return;
    }
    var innerHtml = element;

    if( data.imageRefTickets && data.imageRefTickets.tickets && data.imageRefTickets.tickets.length > 1 ) {
        var arrImanObj = data.imageRefTickets.tickets[ 0 ];
        var arrTickets = data.imageRefTickets.tickets[ 1 ];

        for( var i = 0; i < arrImanObj.length; i++ ) {
            var objIman = arrImanObj[ i ];

            var imageID = uidFileNameMap[ objIman.uid ];
            var ticket = arrTickets[ i ];
            _updateImage( innerHtml, imageID, ticket );
        }
        data.imageRefTickets = null;
    }
};

/**
 * Get Requirement top Element of Panel.
 *
 * @return {Object} HTML element
 */
var _getRMElement = function() {
    var element = document.getElementsByClassName( 'aw-requirements-xrtRichText' );
    if( !element || element.length <= 0 ) {
        return null;
    }
    return element;
};

/**
 * Set viewer content
 *
 * @param {Object} data The panel's view model object
 * @param {String} htmlContent html Content
 * @param {Object} uidFileNameMap uidFileNameMap
 * @returns {Array} missing ref
 */
var _setViewerContent = function( data, htmlContent, uidFileNameMap ) {
    var requirementElement = _getRMElement();

    var elementChild = document.createElement( 'div' );

    elementChild.className += ' aw-richtexteditor-documentPaper aw-richtexteditor-document aw-richtexteditor-documentPanel';

    elementChild.innerHTML = htmlContent;


    reqACEUtils.updateMarkers( elementChild, data );

    requirementElement[ 0 ].appendChild( elementChild );
    const missingRefImages = _getAllBrokenImageIDs( data, requirementElement[ 0 ], uidFileNameMap );
    if( missingRefImages.length > 0 ) {
        eventBus.publish( 'Arm0HTMLSpecTemplatePreview.refreshRefImages' );
    }
    return missingRefImages;
};

/**
 * load HTML Spec Template JSON
 *
 * @param {Object} data The panel's view model object
 * @param {Object} uidHtmlSpecTemplate html spec template uid
 * @returns {Object} Promise
 */
export let loadHtmlSpecTemplate = function( data, uidHtmlSpecTemplate ) {
    var deferred = AwPromiseService.instance.defer();

    var arrModelObjs = [ { uid: uidHtmlSpecTemplate } ];
    var cellProp = [ 'lsd', 'IMAN_specification' ];

    reqUtils.loadModelObjects( arrModelObjs, cellProp ).then( function( response ) {
        var fullTextObj = reqACEUtils.getObjectOfType( response.ServiceData.modelObjects, 'FullText' );

        if( !fullTextObj ) {
            var jsonData = _createFirstTimeJson( uidHtmlSpecTemplate );
            _createFullTextOnSpecHtmlTemplate( data, uidHtmlSpecTemplate, jsonData );
            deferred.resolve( jsonData );
            return;
        }
        data.fullTextObjUid = fullTextObj.uid;

        arrModelObjs = [ { uid: fullTextObj.uid } ];
        cellProp = [ 'body_text', 'ref_list' ];

        reqUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
            var jsonResult = JSON.parse( fullTextObj.props.body_text.dbValues[ 0 ] );
            deferred.resolve( jsonResult );
        } ).catch( function() {
            var jsonData = _createFirstTimeJson( uidHtmlSpecTemplate );
            _createFullTextOnSpecHtmlTemplate( data, uidHtmlSpecTemplate, jsonData );
            deferred.resolve( jsonData );
        } );
    } ).catch( function() {
        var jsonData = _createFirstTimeJson( uidHtmlSpecTemplate );
        _createFullTextOnSpecHtmlTemplate( data, uidHtmlSpecTemplate, jsonData );
        deferred.resolve( jsonData );
    } );

    return deferred.promise;
};

var _getHtmlSpecTemplateJson = function( data, jsonData, parentId, parentType ) {
    if( !jsonData.contents ) {
        return null;
    }

    data.HTML_CONTENT += _addWrapperOnBodyText( jsonData.name, jsonData.level, jsonData.internalType, jsonData.uniqueID, parentId, parentType, jsonData.contents );
    for( var i = 0; i < jsonData.children.length; i++ ) {
        _getHtmlSpecTemplateJson( data, jsonData.children[ i ], jsonData.uniqueID, jsonData.internalType );
    }
    return null;
};
/**
 * Initialize HTML content
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} selectedObjUid selected object uid
 */
export let initContent = async function( data, selectedObjUid ) {
    if( !data.HTML_SPEC_TEMPLATE_CONTENT ) {
        data.HTML_CONTENT = '';
        const response = await loadHtmlSpecTemplate( data, selectedObjUid );
        var jsonData = response.length > 0 ? response[ 0 ] : response;
        _getHtmlSpecTemplateJson( data, jsonData, '', '' );
        const htmlContent = data.HTML_CONTENT;
        const uidFileNameMap = {};
        await addElementTypeHandler._getDisplayableTypes();
        const missingRefImages = _setViewerContent( data, htmlContent, uidFileNameMap );
        return {
            HTML_SPEC_TEMPLATE_CONTENT: jsonData,
            showCKEditor: true,
            HTML_CONTENT: htmlContent,
            missingRefImages: missingRefImages,
            uidFileNameMap: uidFileNameMap,
            hideTracelink: true
        };
    }
};

const exports = {
    updateImages,
    loadHtmlSpecTemplate,
    initContent
};
export default exports;
