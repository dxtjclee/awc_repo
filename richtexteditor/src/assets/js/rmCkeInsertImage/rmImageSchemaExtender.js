/* eslint-disable complexity */

import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import { getSpecImageData, getSpecDataAttributes, pushSpecImageData } from 'js/rmCkeRequirementWidget/requirementWidgetMetadataService';
import tcVmoService from 'js/tcViewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import fileMgmtSvc from 'soa/fileManagementService';
import fmsUtils from 'js/fmsUtils';
import _ from 'lodash';

/** CKEditor image reference name prefix */
var CKE_IMG_REFNAME_PREFIX = 'tccke_ref_';

export default class RMImageSchemaExtender extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [];
    }
    init() {
        const editor = this.editor;
        const schema = editor.model.schema;
        schema.extend( 'imageBlock', {
            allowAttributes: [ 'imgId', 'imageuid', 'src' ]
        } );
        schema.extend( 'imageInline', {
            allowAttributes: [ 'imgId', 'imageuid', 'src' ]
        } );

        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'imgId', 'id', 'imageBlock' ) );
        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'imageuid', 'imageuid', 'imageBlock' ) );
        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'src', 'src', 'imageBlock' ) );
        setupCustomAttributeConversion( 'img', 'imageBlock', 'isanchoredimage', editor );

        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'imgId', 'id', 'imageInline' ) );
        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'imageuid', 'imageuid', 'imageInline' ) );
        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'src', 'src', 'imageInline' ) );
        setupCustomAttributeConversion( 'img', 'imageInline', 'isanchoredimage', editor );

        /**
         *
         * @param {*} attributeKey -
         * @param {*} viewAttribute -
         * @param {String} modelElementName -
         * @returns {*} -
         */
        function modelToViewAttributeConverter( attributeKey, viewAttribute, modelElementName ) {
            return dispatcher => {
                dispatcher.on( 'attribute:' + attributeKey + ':' + modelElementName, converter );
            };

            /**
             *
             * @param {*} evt -
             * @param {*} data -
             * @param {*} conversionApi -
             */
            function converter( evt, data, conversionApi ) {
                const viewWriter = conversionApi.writer;
                const figure = conversionApi.mapper.toViewElement( data.item );
                let img = figure;
                if( !figure.is( 'element', 'img' ) ) {
                    img = getViewImgFromWidget( figure );
                }

                // Replace src in case of collaboration
                if( evt.name === 'attribute:src:' + modelElementName ) {
                    const alt = data.item.getAttribute( 'alt' );
                    const imgId = data.item.getAttribute( 'imgId' );
                    // Replace src
                    const imgsrc = getSpecImageData( alt );
                    const newImageSrc = getSpecImageData( imgId );
                    if( imgsrc ) {
                        viewWriter.setAttribute( viewAttribute, imgsrc || '', img );
                        return;
                    } else if( imgId && imgId !== '' && alt === '' && newImageSrc ) { // New image, and it is already cached
                        viewWriter.setAttribute( viewAttribute, newImageSrc, img );
                    }else if( imgId && imgId !== '' && alt === '' && newImageSrc === undefined ) {    // Newly inserted Image but not cached - loading inserted image for different user
                        loadImageSrcFromDatasetUID( editor, imgId, data );
                    } else if( imgId && imgId.startsWith( CKE_IMG_REFNAME_PREFIX ) && alt && !_.isEmpty( alt ) && !newImageSrc ) {   // New Image after save
                        let datasetNameFromImgId = imgId.substring( CKE_IMG_REFNAME_PREFIX.length );
                        datasetNameFromImgId = datasetNameFromImgId.split( '_' )[0];
                        datasetNameFromImgId = datasetNameFromImgId !== '' ? datasetNameFromImgId : undefined;
                        if( datasetNameFromImgId && getSpecImageData( datasetNameFromImgId ) ) {  // set src from already cached dataset
                            viewWriter.setAttribute( viewAttribute, getSpecImageData( datasetNameFromImgId ), img );
                        } else if( getSpecImageData( datasetNameFromImgId ) === undefined && getSpecImageData( imgId ) === undefined && alt === imgId ) { // Image got inserted while roundtrip import
                            const reqElement = getRequirementElement( data.item );
                            if( reqElement && reqElement.getAttribute( 'revisionid' ) ) {
                                loadImageSrcFromImanFile( editor, imgId, data, reqElement.getAttribute( 'revisionid' ) );
                            }
                        }
                    }
                }

                if ( !conversionApi.consumable.consume( data.item, evt.name ) ) {
                    return;
                }

                viewWriter.setAttribute( viewAttribute, data.attributeNewValue || '', img );
                let isanchoredimage = img.getAttribute( 'isanchoredimage' );
                // adding style to figure tag if its anchored image
                if( isanchoredimage === 'true' ) {
                    if( img._styles && img._styles._styles && img._styles._styles['-aw-wrap-type'] === 'none' ) {
                        viewWriter.setAttribute( 'style', 'position:unset; margin:revert', figure );
                    }else{
                        viewWriter.setAttribute( 'style', 'margin:revert', figure );
                    }
                }
            }
        }

        /** */
        function getViewImgFromWidget( figureView ) {
            const figureChildren = [];

            for ( const figureChild of figureView.getChildren() ) {
                figureChildren.push( figureChild );

                if ( figureChild.is( 'element' ) ) {
                    figureChildren.push( ...figureChild.getChildren() );
                }
            }

            return figureChildren.find( viewChild => viewChild.is( 'element', 'img' ) );
        }

        editor.conversion.for( 'upcast' ).attributeToAttribute( {
            view: {
                name: 'img',
                key: 'id'
            },
            model: 'imgId'
        } );

        editor.conversion.for( 'upcast' ).attributeToAttribute( {
            view: {
                name: 'img',
                key: 'imageuid'
            },
            model: 'imageuid'
        } );

        editor.conversion.for( 'upcast' ).attributeToAttribute( {
            view: {
                name: 'img',
                key: 'src'
            },
            model: 'src'
        } );
    }
}

/**
 *
 * @param {Object} editor  -
 * @param {String} imgId -
 * @param {Object} data -
 */
function loadImageSrcFromDatasetUID( editor, imgId, data ) {
    let specImageDataMap = [];
    specImageDataMap[imgId] = '';
    pushSpecImageData( specImageDataMap ); // This is to avoid duplicate call to get image data
    // Load Read Ticket for newly inserted images - In Case of collaboration
    let datasets = [ { uid: imgId } ];
    //get Named reference File
    tcVmoService.getViewModelProperties( datasets, [ 'ref_list' ] ).then( function() {
        let datasetObj = cdm.getObject( imgId );
        if( datasetObj.props.ref_list && datasetObj.props.ref_list.dbValues.length > 0 ) {
            let imanFile = datasetObj.props.ref_list.dbValues[ 0 ];
            //Get iman file object from uid
            let imanFileModelObject = cdm.getObject( imanFile );
            //downloadTicket
            let files = [ imanFileModelObject ];
            let promise = fileMgmtSvc.getFileReadTickets( files );
            promise.then( function( readFileTicketsResponse ) {
                if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
                    let ticketsArray = readFileTicketsResponse.tickets[ 1 ]; //1st element is array of iman file while 2nd element is array of tickets
                    if( ticketsArray && ticketsArray.length > 0 ) {
                        const fileName = fmsUtils.getFilenameFromTicket( ticketsArray[0] );
                        const downloadUri = fmsUtils.getFMSUrl() + fileName + '?ticket=' + ticketsArray[0];
                        // Cache newly loaded ticket
                        specImageDataMap[imgId] = downloadUri;
                        pushSpecImageData( specImageDataMap );
                        // Update image url in ck model element
                        editor.model.enqueueChange( 'transparent', writer => {
                            // writer.setAttribute( 'src', downloadUri, img );
                            writer.setAttribute( 'src', downloadUri, data.item );
                        } );
                    }
                }
            } );
        }
    } );
}

/**
 *
 * @param {Object} editor  -
 * @param {String} imgId -
 * @param {Object} data -
 */
function loadImageSrcFromImanFile( editor, imgId, data, revisionUID ) {
    const reqMetaData = getSpecDataAttributes( revisionUID );
    if( reqMetaData && reqMetaData.fulltext ) {
        let specImageDataMap = [];
        specImageDataMap[imgId] = '';
        pushSpecImageData( specImageDataMap ); // This is to avoid duplicate call to get image data
        // Load Read Ticket for newly inserted images - In Case of collaboration
        let datasets = [ { uid: reqMetaData.fulltext } ];
        //get Named reference File
        tcVmoService.getViewModelProperties( datasets, [ 'ref_list' ] ).then( function() {
            let datasetObj = cdm.getObject( reqMetaData.fulltext );
            if( datasetObj.props.ref_list && datasetObj.props.ref_list.dbValues.length > 0 ) {
                //Get iman file object from name
                let imanFileModelObject = getImanFileUIDByName( datasetObj.props.ref_list.dbValues, imgId );
                if( imanFileModelObject ) {
                    //downloadTicket
                    let files = [ imanFileModelObject ];
                    let promise = fileMgmtSvc.getFileReadTickets( files );
                    promise.then( function( readFileTicketsResponse ) {
                        if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
                            let ticketsArray = readFileTicketsResponse.tickets[ 1 ]; //1st element is array of iman file while 2nd element is array of tickets
                            if( ticketsArray && ticketsArray.length > 0 ) {
                                const fileName = fmsUtils.getFilenameFromTicket( ticketsArray[0] );
                                const downloadUri = fmsUtils.getFMSUrl() + fileName + '?ticket=' + ticketsArray[0];
                                // Cache newly loaded ticket
                                specImageDataMap[imgId] = downloadUri;
                                pushSpecImageData( specImageDataMap );
                                // Update image url in ck model element
                                editor.model.enqueueChange( 'transparent', writer => {
                                    // writer.setAttribute( 'src', downloadUri, img );
                                    writer.setAttribute( 'src', downloadUri, data.item );
                                } );
                            }
                        }
                    } );
                }
            }
        } );
    }
}

function getImanFileUIDByName( imanFiles, name ) {
    for ( let index = 0; index < imanFiles.length; index++ ) {
        const imanFile = imanFiles[index];
        let mo = cdm.getObject( imanFile );
        if( mo && mo.props && mo.props.original_file_name && mo.props.original_file_name.dbValues[0] === name ) {
            return mo;
        }
    }
}

/**
 * Function to Return the Requirment node from given element from bodytext
 * @param {*} element -
 * @returns {Object} -
 */
function getRequirementElement( element ) {
    if( !element ) {
        return undefined;
    }
    const classAttr = element.getAttribute( 'class' );
    if( classAttr ) {
        const classesArr = classAttr.split( ' ' );
        if( classesArr.includes( 'requirement' ) ) {
            return element;
        }
    }
    return getRequirementElement( element.parent );
}

/**
 * Setups conversion for custom attribute on view elements contained inside figure.
 *
 * This method:
 *
 * - adds proper schema rules
 * - adds an upcast converter
 * - adds a downcast converter
 *
 * @param {String} viewElementName
 * @param {String} modelElementName
 * @param {String} viewAttribute
 * @param {module:core/editor/editor~Editor} editor
 */
export function setupCustomAttributeConversion( viewElementName, modelElementName, viewAttribute, editor ) {
    // Extend schema to store attribute in the model.
    const modelAttribute = `custom-${viewAttribute}`;

    editor.model.schema.extend( modelElementName, { allowAttributes: [ modelAttribute ] } );

    editor.conversion.for( 'upcast' ).add( upcastAttribute( viewElementName, viewAttribute, modelAttribute ) );
    editor.conversion.for( 'downcast' ).add( downcastAttribute( modelElementName, viewElementName, viewAttribute, modelAttribute ) );
}
/**
 * Returns a custom attribute upcast converter.
 *
 * @param {String} viewElementName
 * @param {String} viewAttribute
 * @param {String} modelAttribute
 * @returns {Function}
 */
function upcastAttribute( viewElementName, viewAttribute, modelAttribute ) {
    return dispatcher => dispatcher.on( `element:${viewElementName}`, ( evt, data, conversionApi ) => {
        const viewItem = data.viewItem;
        const modelRange = data.modelRange;

        const modelElement = modelRange && modelRange.start.nodeAfter;

        if( !modelElement ) {
            return;
        }

        conversionApi.writer.setAttribute( modelAttribute, viewItem.getAttribute( viewAttribute ), modelElement );
    } );
}

/**
 * Returns a custom attribute downcast converter.
 *
 * @param {String} modelElementName
 * @param {String} viewElementName
 * @param {String} viewAttribute
 * @param {String} modelAttribute
 * @returns {Function}
 */
function downcastAttribute( modelElementName, viewElementName, viewAttribute, modelAttribute ) {
    return dispatcher => dispatcher.on( `attribute:${modelAttribute}:${modelElementName}`, ( evt, data, conversionApi ) => {
        const modelElement = data.item;

        const viewFigure = conversionApi.mapper.toViewElement( modelElement );
        const viewElement = findViewChild( viewFigure, viewElementName, conversionApi );

        if( !viewElement ) {
            return;
        }

        if( data.attributeNewValue === null ) {
            conversionApi.writer.removeAttribute( viewAttribute, viewElement );
        } else {
            conversionApi.writer.setAttribute( viewAttribute, data.attributeNewValue, viewElement );
        }

        conversionApi.writer.setAttribute( viewAttribute, modelElement.getAttribute( modelAttribute ), viewElement );
    } );
}
/**
 * Helper method that search for given view element in all children of model element.
 *
 * @param {module:engine/view/item~Item} viewElement
 * @param {String} viewElementName
 * @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
 * @return {module:engine/view/item~Item}
 */
function findViewChild( viewElement, viewElementName, conversionApi ) {
    const viewChildren = [ ...conversionApi.writer.createRangeIn( viewElement ).getItems() ];

    return viewChildren.find( item => item.is( 'element', viewElementName ) );
}

