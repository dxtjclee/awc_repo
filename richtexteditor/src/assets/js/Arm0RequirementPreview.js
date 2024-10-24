// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement Custom Preview
 *
 * @module js/Arm0RequirementPreview
 */
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import reqUtils from 'js/requirementsUtils';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import Arm0DocumentationUtil from 'js/Arm0DocumentationUtil';
import sanitizer from 'js/sanitizer';
import requirementsUtils from 'js/requirementsUtils';

var exports = {};

var _data = null;
var uidFileNameMap = {};

/** CKEditor image reference name prefix */
var CKE_IMG_REFNAME_PREFIX = 'tccke_ref_'; //$NON-NLS-1$
var index = 0;
var revIndex = 0;
var view1uid = null;
var view2uid = null;

// This will avoid loading content/imgs
var tempDocument = document.implementation.createHTMLDocument( 'Test Doc' );

/**
 * get object of type from collection
 *
 * @param modelObjects collection of objects.
 * @param objType objType.
 * @return result object
 */
var _getObjectOfType = function( modelObjects, objType ) {
    if ( modelObjects ) {
        var arrKey = Object.keys( modelObjects );

        for ( var i = 0; i < arrKey.length; i++ ) {
            var key = arrKey[i];
            var modelObj = modelObjects[key];

            if ( modelObj.type === objType ) {
                return modelObj;
            }
        }
    }
    return null;
};

/**
 * set OLE object to download
 *
 * @param {Object} data - The panel's view model object
 */
export let setOLEObjectToDownload = function( data ) {
    data.oleObjsToDownload = [];

    if ( data.response && data.response.modelObjects ) {
        var modelObj = _getObjectOfType( data.response.modelObjects, 'ImanFile' );
        if ( modelObj !== null ) {
            data.oleObjsToDownload = [ modelObj ];
        }
    }
};

/**
 * Get Image/OLE object from Fulltext named reference list.
 *
 * @param id Image/OLE id.
 * @return Object
 */

var _getFullTextRefObj = function( id ) {
    var _fullTextObject = _data.fullTextObject;

    if ( _fullTextObject && _fullTextObject.props.ref_list ) {
        if ( _.includes( id, CKE_IMG_REFNAME_PREFIX ) ) {
            for ( var i = 0; i < _fullTextObject.props.ref_list.dbValues.length; i++ ) {
                var refUIVal = _fullTextObject.props.ref_list.uiValues[i];
                if ( refUIVal === id ) {
                    return _fullTextObject.props.ref_list.dbValues[i];
                }
            }
        } else {
            for ( var i = 0; i < _fullTextObject.props.ref_list.dbValues.length; i++ ) {
                var refUIVal = _fullTextObject.props.ref_list.dbValues[i];
                if ( _.includes( id, refUIVal ) ) {
                    return _fullTextObject.props.ref_list.dbValues[i];
                }
            }
        }
    }
    return null;
};

/**
 * Get file URL from ticket.
 *
 * @param ticket File ticket.
 * @return Any
 */

var _getFileURL = function( ticket ) {
    if ( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
};

/**
 * Get Document Element of Panel.
 *
 * @return Any
 */
var _getDocument = function() {
    var element = document.getElementsByClassName( 'aw-requirements-xrtRichText' );
    if ( !element || element.length <= 0 ) {
        return null;
    }
    return element;
};

/**
 * OLE object on click listener
 *
 * @param {Event} event The event
 */
function onClickOnOLEObject( event ) {
    var target = event.currentTarget;
    var oleID = target.getAttribute( 'oleid' );
    var oleObjectUID = target.getAttribute( 'oleObjectUID' );
    if ( oleID ) {
        var imanID = _getFullTextRefObj( oleID );

        if ( imanID ) {
            _data.oleObjsToDownload = [ {
                uid: imanID,
                type: 'ImanFile'
            } ];

            eventBus.publish( 'documentViewer.downloadOLEObject' );
        } else {
            _data.oleObjectDS = [ {
                uid: oleObjectUID,
                type: 'unknownType'
            } ];

            eventBus.publish( 'documentViewer.downloadOLEObjectFromDataSet' );
        }
    }
}

/**
 * Add click event on OLE Objects.
 *
 * @param innerHtml innerHtml
 */

var _addEventOnOLEObjects = function( innerHtml ) {
    var imgs = innerHtml.getElementsByTagName( 'img' );
    for ( var ii = 0; ii < imgs.length; ii++ ) {
        var oleElement = imgs[ii];

        if ( oleElement.getAttribute( 'oleid' ) ) {
            oleElement.addEventListener( 'click', onClickOnOLEObject );
        }
    }
};

/**
 * Add in missing image list. These images files tickets need to be updated.
 *
 * @param {Object} data - The panel's view model object
 * @param uidImage uid of image
 */

var _addInMissingImageList = function( data, uidImage ) {
    var imanID = _getFullTextRefObj( uidImage );

    var objImage = {
        uid: imanID ? imanID : uidImage,
        type: 'unknownType'
    };

    if ( imanID ) {
        uidFileNameMap[imanID] = uidImage;
        data.missingRefImages.push( objImage );
    } else {
        data.missingImages.push( objImage );
    }
};

/**
 * Read all image IDs that have broken links and add in missing Image list.
 *
 * @param {Object} data - The panel's view model object
 * @param innerHtml innerHtml
 * @return Any
 */

var _getAllBrokenImageIDs = function( data, innerHtml ) {
    var imgs = innerHtml.getElementsByTagName( 'img' );
    data.missingImages = [];
    data.missingRefImages = [];

    for ( var ii = 0; ii < imgs.length; ii++ ) {
        if ( typeof imgs[ii].id !== 'undefined' && imgs[ii].id !== '' ) {
            if ( imgs[ii].src.indexOf( 'base64' ) > -1 ) {
                continue;
            }
            if ( !imgs[ii].complete ) {
                _addInMissingImageList( data, imgs[ii].id );
                continue;
            }
            if ( typeof imgs[ii].naturalWidth !== 'undefined' && imgs[ii].naturalWidth === 0 ) {
                _addInMissingImageList( data, imgs[ii].id );
                continue;
            }
        }
    }
};

/**
 * Update broken image URL.
 *
 * @param innerHtml innerHtml
 * @param imageID image uid
 * @param ticket image file ticket
 */

var _updateImage = function( innerHtml, imageID, ticket ) {
    if ( innerHtml && imageID && ticket ) {
        var imgs = innerHtml.getElementsByTagName( 'img' );

        var imageUrl = _getFileURL( ticket );
        for ( var ii = 0; ii < imgs.length; ii++ ) {
            if ( imgs[ii].id === imageID ) {
                imgs[ii].src = imageUrl;
            }
        }
    }
};

/**
 * get Revision Object.
 *
 * @param {Object} uid - uid of awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevObject = function( uid ) {
    var revObject = cdm.getObject( uid );
    if ( revObject && revObject.props && revObject.props.awb0UnderlyingObject ) {
        return cdm.getObject( revObject.props.awb0UnderlyingObject.dbValues[0] );
    }
    return revObject;
};

/**
 * get selected Revision Object.
 *
 * @param {Object} ctx - Application context
 * @return {Object} Revision Object
 */
export let getRevisionObject = function( ctx ) {
    var revObject = null;
    var obj = ctx.selected;

    if ( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        revObject = _getRevObject( obj.uid );
    } else {
        revObject = obj;
    }
    if ( ctx.splitView && ctx.splitView.mode === true && ctx.occmgmtContext && ctx.occmgmtContext2 ) {
        var uid = obj.uid;
        var modelObject1 = ctx.occmgmtContext.selectedModelObjects['0'];
        var modelObject2 = ctx.occmgmtContext2.selectedModelObjects['0'];

        if ( modelObject1.uid === modelObject2.uid ) {
            uid = modelObject1.uid;
        } else {
            if ( view1uid && view1uid !== modelObject1.uid && view2uid && view2uid !== modelObject2.uid ) {
                revIndex = 0;
            }

            if (  modelObject1.modelType.typeHierarchyArray.indexOf( 'SpecElementRevision' ) > -1 || modelObject1.modelType.typeHierarchyArray.indexOf( 'Arm0RequirementSpecElement' ) > -1  || ( !view2uid && revIndex === 1 || view2uid && view2uid !== modelObject2.uid ) ) {
                uid = modelObject2.uid;
                view2uid = uid;
                revIndex = 0;
            } else if(  modelObject2.modelType.typeHierarchyArray.indexOf( 'SpecElementRevision' ) > -1 || modelObject2.modelType.typeHierarchyArray.indexOf( 'Arm0RequirementSpecElement' ) > -1  || ( !view1uid && revIndex === 0 || view1uid && view1uid !== modelObject1.uid ) ) {
                uid = modelObject1.uid;
                view1uid = uid;
                revIndex = 1;
            }
        }
        revObject = _getRevObject( uid );
    }

    return revObject;
};

/**
 * get getExport Options
 *
 * @return {Object}
 */
export let getExportOptions = function() {
    var exportOptions = [];
    var baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    var requestPref = {
        option: 'base_url',
        optionvalue: baseURL
    };
    exportOptions.push( requestPref );

    return exportOptions;
};

/**
 *
 * Update broken images urls with new url image file ticket
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let updateImages = function( data ) {
    var element = _getDocument();

    if ( !element ) {
        return;
    }
    var innerHtml = element[index];

    if ( data.imageRefTickets && data.imageRefTickets.tickets && data.imageRefTickets.tickets.length > 1 ) {
        var arrImanObj = data.imageRefTickets.tickets[0];
        var arrTickets = data.imageRefTickets.tickets[1];

        for ( var i = 0; i < arrImanObj.length; i++ ) {
            var objIman = arrImanObj[i];

            var imageID = uidFileNameMap[objIman.uid];
            var ticket = arrTickets[i];
            _updateImage( innerHtml, imageID, ticket );
        }
        data.imageRefTickets = null;
    }

    if ( data.imageTickets && data.imageTickets.modelObjects ) {
        var arrKey = Object.keys( data.imageTickets.modelObjects );

        for ( var i = 0; i < arrKey.length; i++ ) {
            var key = arrKey[i];
            var modelObj = data.imageTickets.modelObjects[key];

            if ( modelObj.type === 'Image' ) {
                var ticket = modelObj.props.awp0ThumbnailImageTicket.dbValues[0];
                _updateImage( innerHtml, modelObj.uid, ticket );
            }
        }
        data.imageTickets = null;
    }
};

/**
 * Get model objects through the plain objects uids
 *
 * @param {Object} response - response containing plain and model objects
 * @return {Object} model objects
 */
var _getPlainObjectsList = function( response ) {
    var values;
    values = response.ServiceData.plain.map( function( Objuid ) {
        return response.ServiceData.modelObjects[ Objuid ];
    } );
    return values;
};

/**
 * Remove non requirement objects
 *
 * @param {Object} modelObjects -  model objects
 */
var _removeNonRequirementObjects = function( modelObjects ) {
    for ( var i = modelObjects.length - 1; i >= 0; i-- ) {
        var obj = modelObjects[i];
        var modelObject = cdm.getObject( obj.uid );
        var typeHierarchy = modelObject.modelType.typeHierarchyArray;
        if ( !( typeHierarchy.indexOf( 'Arm0RequirementElement' ) > -1 || typeHierarchy.indexOf( 'Arm0RequirementSpecElement' ) > -1 || typeHierarchy.indexOf( 'Arm0ParagraphElement' ) > -1 ||
            typeHierarchy.indexOf( 'RequirementSpec Revision' ) > -1 || typeHierarchy.indexOf( 'Requirement Revision' ) > -1 || typeHierarchy.indexOf( 'Paragraph Revision' ) > -1 ) ) {
            modelObjects.splice( i, 1 );
        }
    }
};

/**
 * Initialize HTML content
 *
 * @param {Object} data - The panel's view model object
 *
 */
// eslint-disable-next-line complexity
export let initContent = function( data, ctx ) {
    _data = data;
    if ( data.content ) {
        var transientFileReadTickets = data.content.transientFileReadTickets;

        if ( transientFileReadTickets ) {
            if ( data.content.ServiceData.modelObjects ) {
                var modelObj = _getObjectOfType( data.content.ServiceData.modelObjects, 'FullText' );
                if ( modelObj !== null ) {
                    data.fullTextObject = modelObj;
                }
            }

            data.htmlString = transientFileReadTickets[0];

            var element = _getDocument();

            if ( element ) {
                if ( element.length === 1 ) {
                    index = 0;
                }
                if ( element.length > 1 && ctx.splitView && ctx.splitView.mode === true && ctx.occmgmtContext && ctx.occmgmtContext2 && ctx.occmgmtContext.selectedModelObjects['0'].uid !== ctx.occmgmtContext2.selectedModelObjects['0'].uid ) {
                    var modelObjects = _getPlainObjectsList( data.content );
                    _removeNonRequirementObjects( modelObjects );

                    var revObject1 = _getRevObject( ctx.occmgmtContext.selectedModelObjects['0'].uid );
                    var revObject2 = _getRevObject( ctx.occmgmtContext2.selectedModelObjects['0'].uid );

                    if ( modelObjects && modelObjects[0].uid === revObject2.uid ) {
                        index = 1;
                    } else if ( modelObjects && modelObjects[0].uid === revObject1.uid ) {
                        index = 0;
                    }
                }

                element[index].className += ' aw-richtexteditor-documentPaper aw-richtexteditor-document aw-richtexteditor-documentPanel';

                data.htmlString = reqUtils.correctImageTags( data.htmlString );
                data.htmlString = reqUtils.correctAnchorTags( data.htmlString );

                // This is required to sanitize html, without body tag in content
                var ele = tempDocument.createElement( 'div' );
                ele.innerHTML = data.htmlString;
                requirementsUtils.prepareAndUpdateListStyleType( ele );
                ele = ele.getElementsByClassName( 'requirement' );
                if( ele && ele.length > 0 ) {
                    data.htmlString = sanitizer.sanitizeHtmlValue( ele[0].outerHTML );
                }

                element[index].innerHTML = data.htmlString;
                reqUtils.insertTypeIconToOleObjects( element[index] );
                _addEventOnOLEObjects( element[index] );
                _getAllBrokenImageIDs( data, element[index] );

                if ( element.length > 1 && ctx.splitView && ctx.splitView.mode === true && ctx.occmgmtContext.currentState.uid === ctx.occmgmtContext2.currentState.uid ) {
                    if ( index === 0 ) {
                        index = 1;
                    } else if ( index === 1 ) {
                        index = 0;
                    }
                }
                // Attach and listen click event on viewer container
                Arm0DocumentationUtil.attachClickEventOnViewer( element[ index ] );

                // Render Equation in React DOM
                reqUtils.loadEquationAsReactComponents( element[ index ] );
            }
        }
    }
};


export default exports = {
    setOLEObjectToDownload,
    getRevisionObject,
    getExportOptions,
    updateImages,
    initContent
};
