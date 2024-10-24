// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement Documentation Page
 *
 * @module js/Arm0RequirementDocumentation
 */
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import messagingService from 'js/messagingService';
import iconService from 'js/iconService';
import reqUtils from 'js/requirementsUtils';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import appCtxService from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import ckeditorOperations from 'js/ckeditorOperations';
import rmCkeditorService from 'js/Arm0CkeditorService';
import _ from 'lodash';
import reqACEUtils from 'js/requirementsACEUtils';
import Arm0DocumentationUtil from 'js/Arm0DocumentationUtil';
import markupUtil from 'js/Arm0MarkupUtil';
import sanitizer from 'js/sanitizer';
import requirementsUtils from 'js/requirementsUtils';

var exports = {};

var _data = null;
var uidFileNameMap = {};

var saveHandler = {};
var updatedObjetsInput = null;

/** Content type HTML */
var CONTENT_TYPE_HTML = 'HTML';

/** Content type Plain */
var CONTENT_TYPE_PLAIN = 'Plain';

/** Content type Word */
var CONTENT_TYPE_WORD = 'Word';

var tempDocument = document.implementation.createHTMLDocument( 'Test Doc' );


/**
 * Get save handler.
 *
 * @return {Object} Save Handler
 */
export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * custom save handler save edits called by framework. The handler resolves the promise only
 * after the document & table/properties save operations are completed.
 *
 * @param {Object} dataSource - data source
 * @param {Object} inputs - input
 * @return {promise} resolved or rejected based on document & table/properties save results
 */
saveHandler.saveEdits = function( dataSource, inputs ) {
    var _deferredSave = AwPromiseService.instance.defer();
    var _reqDocDirty = false;
    var _docPromise = null;
    var _attrPromise = null;

    try {
        _reqDocDirty = saveHandler.isDirty( dataSource );
    } catch ( e ) {
        _reqDocDirty = false;
    }

    if( inputs && inputs.length && inputs.length > 0 ) {
        // LCS-187289
        dataSource.registerPropPolicy();
        _attrPromise = dms.saveViewModelEditAndSubmitWorkflow( inputs );
    } else {
        var _attrDefer = AwPromiseService.instance.defer();
        _attrPromise = _attrDefer.promise;
        _attrDefer.resolve();
    }

    _attrPromise.then(
        function( response ) {
            var _error = null;
            if( response ) {
                dataSource.unregisterPropPolicy();

                if( response.partialErrors || response.PartialErrors ) {
                    _error = soaSvc.createError( response );
                } else if( response.ServiceData && response.ServiceData.partialErrors ) {
                    _error = soaSvc.createError( response.ServiceData );
                }
            }

            // Do editor content save, once properties got saved
            if( _reqDocDirty ) {
                _docPromise = _saveReqContentEdits( );
            } else {
                var _docDefer = AwPromiseService.instance.defer();
                _docPromise = _docDefer.promise;
                _docDefer.resolve();
            }
            _docPromise.then( function() {
                if( _error ) {
                    _deferredSave.reject( _error );
                } else {
                    _deferredSave.resolve( response );
                }
            },
            function( err ) {
                _deferredSave.reject( err );
            }
            );
        },
        function( err ) {
            _deferredSave.reject( err );
        }
    );

    return _deferredSave.promise;
};

var saveHTMLReqTextContent = function( deferred ) {
    var createUpdateInput = exports.getCreateUpdateInput( _data );
    if ( !createUpdateInput ) {
        var errorMsg = _data.i18n.invalidObjectName.replace( '{0}', appCtxService.ctx.occmgmtContext.topElement.props.object_string.uiValues[0] );
        deferred.reject( errorMsg );
    } else {
        var input = {
            createUpdateInput: createUpdateInput
        };
        // Register event to handel load contents after save
        var promise = soaSvc.post( 'Internal-AwReqMgmtSe-2019-06-SpecNavigation',
            'createOrUpdateContents', input );

        promise.then( function( response ) {
            deferred.resolve( response );
        } ).catch( function( error ) {
            var errorCode = error.cause.partialErrors['0'].errorValues['0'].code;
            //error handler when multiple users are trying to edit same requirement
            if ( errorCode === 141023 ) {
                var errorMsg = _data.i18n.multiUserEditError.replace( '{0}', _data.selected.cellHeader1 );

                messagingService.showError( errorMsg );
                error = null;
            }

            deferred.reject( error );
        } );
    }
};

var saveHTMLObjTmplContent = function( deferred ) {
    var _modelObj = _data.selected;

    var input = {
        inputs: [ {
            objectToProcess: exports.getRevisionObject( _modelObj ),
            bodyText: exports.getBodyText( _data ),
            lastSavedDate: exports.getRevisionObjectLsd( _modelObj ),
            contentType: exports.getContentType( _data ),
            isPessimisticLock: true
        } ]
    };

    var promise = soaSvc.post( 'Internal-AWS2-2016-12-RequirementsManagement',
        'setRichContent2', input );

    promise.then( function( response ) {
        var relatedObjects = response.updated;
        deferred.resolve( relatedObjects );
    } )
        .catch( function( error ) {
            var errorCode = error.cause.partialErrors[ '0' ].errorValues[ '0' ].code;
            //error handler when multiple users are trying to edit same requirement
            if( errorCode === 141023 ) {
                var errorMsg = _data.i18n.multiUserEditError.replace( '{0}', _data.selected.cellHeader1 );

                messagingService.showError( errorMsg );
                error = null;
            }

            deferred.reject( error );
        } );
};

/**
 * Save contents of ckeditor
 *
 * @return {promise} resolved or rejected
 */
var _saveReqContentEdits = function() {
    var deferred = AwPromiseService.instance.defer();

    if( _data && _data.editorProps && _checkCKEditorDirty( _data.editorProps.id ) ) {
        if( _isHTMLObjTmplRevision( appCtxService.ctx ) ) {
            saveHTMLObjTmplContent( deferred );
        }else{
            saveHTMLReqTextContent( deferred );
        }
    } else {
        deferred.resolve( null );
    }
    return deferred.promise;
};

/**
 * Input for save
 *
 * @param {Object} data - view model data
 * @return {String} IJSO for input
 */
export let getCreateUpdateInput = function( data ) {
    var setContentInputJSO = [];
    var input = [];
    var markUpInput = [];
    // Clear highlighting before saving contents
    ckeditorOperations.clearQualityHighlighting( data.editorProps.id, appCtxService.ctx );
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
    if ( !widgetsToSave ) {
        return null;
    }
    var setContentData = widgetsToSave.setContentInput;
    updatedObjetsInput = _.cloneDeep( widgetsToSave );
    if ( setContentData.length > 0 ) {
        input = _getWidgetSaveData( widgetsToSave, data );
        setContentInputJSO = input.setContentInput;
        markUpInput = _getCreateMarkupInput( _data );
    }


    var requestPref = {};

    var baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();

    requestPref.base_url = baseURL;

    return {
        inputCtxt: {},
        createInput: [],
        setContentInput: setContentInputJSO,
        markUpInput: markUpInput,
        selectedElement: reqACEUtils.getTopSelectedObject( appCtxService.ctx )
    };
};


/**
 * Return true if any property modification or ckeditor content modification
 *
 * @param {Obkect} dataSource - data source
 * @return {boolean} true, property/editor is dirty
 */
saveHandler.isDirty = function( dataSource ) {
    // Get all properties that are modified
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    if( modifiedViewModelProperties && modifiedViewModelProperties.length > 0 ) {
        return true;
    }
    return _checkCKEditorDirty( _data.editorProps.id );
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
 * set FullText object of Requirement Revision
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let setFullTextObject = function( data ) {
    if( data.ServiceData && data.ServiceData.modelObjects ) {
        var modelObj = reqUtils.getObjectOfType( data.ServiceData.modelObjects, 'FullText' );

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
            data.editorProps.contentType = CONTENT_TYPE_HTML;
            data.editorProps.type = 'ADVANCED_NODROP';
        }
    }
    rmCkeditorService.isCkeditorLoaded().then(
        function() {
            eventBus.publish( 'requirement.initCKEditorEvent' );
        } );
};

/**
 * set FullText object of Requirement Revision
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let insertOLE = function( data ) {
    if( data.fmsTicket ) {
        var imageURL = _getFileURL( data.fmsTicket );
        var fileName = data.eventData.file.name;

        var uid = data.createdObject.uid;
        if( imageURL !== null ) {
            var thumbnailURL = iconService.getTypeIconURL( data.createdObject.type );
            if( !thumbnailURL ) {
                thumbnailURL = iconService.getTypeIconURL( 'Dataset' );
            }

            thumbnailURL = browserUtils.getBaseURL() + thumbnailURL;

            ckeditorOperations.insertOLE( data.editorProps.id, uid, thumbnailURL, fileName, data.createdObject.type, appCtxService.ctx );
        }
    }
};

/**
 * Prepare Input for OLE Insert Event
 *
 * @param {Object} data - The panel's view model object
 */
export let prepareInputforOLEInsert = function( data ) {
    if( data.datasetTypesWithDefaultRelInfo ) {
        var dataset = data.datasetTypesWithDefaultRelInfo[ 0 ];
        var objDataset = cdm.getObject( dataset.datasetType.uid );
        var refInfoList = dataset.refInfos;

        var fileName = data.eventData.file.name;
        var fileNameWithoutExt = fileName.replace( '.' + data.fileExtensions, '' );

        var datasetInfo = {
            clientId: fileNameWithoutExt,
            namedReferenceName: refInfoList[ 0 ].referenceName,
            fileName: fileName,
            name: fileNameWithoutExt,
            type: objDataset.props.object_string.uiValues[ 0 ]

        };

        data.datasetInfo = datasetInfo;
    }
    return {
        datasetInfo: data.datasetInfo
    };
};

/**
 * Process EditHandlerStateChanged Event
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} source - The data Source type
 */
export let processEditHandlerStateChanged = function( data, source ) {
    if( data.eventData.dataSource.context === source ) {
        if( data.eventData.state === 'starting' ) {
            _data = data;
            data.editMode = true;
            data.editorProps.showCKEditor = true;

            if( data.editorProps.contentType === CONTENT_TYPE_WORD ) {
                eventBus.publish( 'requirementDocumentation.getHTMLTextContent' );
            } else {
                eventBus.publish( 'requirementDocumentation.getHTMLTextContent' );
            }
        } else if( ( data.eventData.state === 'canceling' || data.eventData.state === 'saved' ) && data.editMode ) {
            data.editMode = false;
            data.editorProps.showCKEditor = false;
            eventBus.publish( 'requirementDocumentation.getHTMLTextContent' );
        }
    }
    return {
        editMode: data.editMode,
        editorProps: data.editorProps
    };
};


export let InsertOLEInCKEditor = function( data ) {
    data.form = data.eventData.form;

    var fileName = data.eventData.file.name;
    data.fileExtensions = fileName.split( '.' ).pop();

    return {
        eventData: data.eventData,
        form: data.form,
        fileExtensions : data.fileExtensions
    };
};

export let prepareInputforImageInsert = function( data ) {
    var eventData = data.eventData;
    var fileName = 'fakepath\\' + eventData.file.name;

    if ( reqUtils.stringEndsWith( fileName.toUpperCase(), '.gif'.toUpperCase() ) || reqUtils.stringEndsWith( fileName.toUpperCase(), '.png'.toUpperCase() ) ||
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
    } else {
        messagingService.reportNotyMessage( data, data._internal.messages,
            'notificationForImageErrorWrongFile' );
    }

    return {
        datasetInfo:  data.datasetInfo,
        form : eventData.form
    };
};

/**
 * Insert Image
 *
 * @param {Object} data - The panel's view model object
 */
export let insertImage = function( data ) {
    if( data.fmsTicket ) {
        var imageURL = reqUtils.getFileURLFromTicket( data.fmsTicket );
        var uid = data.createdObject.uid;
        if( imageURL !== null ) {
            ckeditorOperations.insertImage( data._editorProps.id, imageURL, uid );
        }
    }
};

/**
 * set OLE object to download
 *
 * @param {Object} data - The panel's view model object
 */
export let setOLEObjectToDownload = function( data ) {
    data.oleObjsToDownload = [];

    if( data.response && data.response.modelObjects ) {
        var modelObj = reqUtils.getObjectOfType( data.response.modelObjects, 'ImanFile' );

        if( modelObj !== null ) {
            data.oleObjsToDownload = [ modelObj ];
        }
    }

    return {
        oleObjsToDownload:  data.oleObjsToDownload
    };
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
 * @param {Object} data - view model data object
 */
var _setCKEditorContent = function( id, content, data ) {
    setTimeout( function() {
        appCtxService.registerCtx( 'requirementEditorContentChanged', false );
        ckeditorOperations.initializationMarkupContext( data );
        ckeditorOperations.setCKEditorContentAsync( id, content, appCtxService.ctx ).then( function() {
            ckeditorOperations.setCkeditorDirtyFlag( id, appCtxService.ctx );
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
    }, 500 );
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
 * Check CKEditor content changed / Dirty.
 *
 * @param {String} id- CKEditor ID
 * @return {Boolean} isDirty
 *
 */

var _checkCKEditorDirty = function( id ) {
    return ckeditorOperations.checkCKEditorDirty( id, appCtxService.ctx );
};

/**
 * process HTML BodyText.
 *
 * @param {String} bodyText - body text
 * @return {String} updated bodyText
 */
var _processPlainBodyText = function( bodyText ) {
    if( bodyText ) {
        // removing all html tags
        bodyText = bodyText.replace( /<p>/g, '' );
        bodyText = bodyText.replace( /<\/p>/g, '' );
        bodyText = bodyText.replace( /<br \/>/g, '' );

        bodyText = bodyText.replace( /\&nbsp;/g, ' ' );
        bodyText = bodyText.replace( /\&#39;/g, '\'' );
    }
    return bodyText;
};

/**
 * process HTML BodyText.
 *
 * @param {String} bodyText - body text
 * @return {String} updated bodyText
 */
var _processHTMLBodyText = function( bodyText ) {
    var outerDiv = document.createElement( 'div' );
    outerDiv.innerHTML = bodyText;
    // Remove ckeditor specific classes from bodytext div
    var bodyTextDiv = outerDiv.getElementsByClassName( 'aw-requirement-bodytext' );
    if( bodyTextDiv.length > 0 ) {
        bodyTextDiv = bodyTextDiv[0];
        reqUtils.removeCkeditorSpecificClasses( bodyTextDiv );
    }
    var bodyTextElement = outerDiv.querySelector( '#aw-requirement-body-text' );
    if( bodyTextDiv instanceof Element && bodyTextDiv.hasAttribute( 'isEmpty' ) ) {   // In case of System Block, while first time editing, FullText is not present, in that case send content without bodytext div
        bodyText = bodyTextDiv.innerHTML;
    } else if( bodyTextElement ) {
        bodyText = bodyTextElement.innerHTML;
    } else {
        bodyText = outerDiv.firstChild.innerHTML;
    }
    if( bodyText ) {
        // remove next line character
        bodyText = bodyText.replace( /\n/g, '' );
        bodyText = bodyText.replace( /<(\s*)col\s(.*?)\s*>/g, '<$1col $2/>' );
        bodyText = reqUtils.processHTMLBodyText( bodyText );
    }
    return bodyText;
};

/**
 * get BodyText.
 *
 * @param {Object} data - data
 * @return {Object} Revision Object
 */
export let getBodyText = function( data ) {
    var bodyText = _getCKEditorContent( data.editorProps.id );

    if( data.editorProps.contentType === CONTENT_TYPE_PLAIN ) {
        bodyText = _processPlainBodyText( bodyText );
    } else {
        bodyText = _processHTMLBodyText( bodyText );
    }

    return bodyText;
};

/**
 * get Application Format.
 *
 * @param {Object} data - data
 * @return {String} application format
 */
export let getApplicationFormat = function( data ) {
    if( data.editorProps.contentType === CONTENT_TYPE_WORD && data.editMode ) {
        data.applicationFormat = 'MSWordXMLLive';
    } else {
        data.applicationFormat = 'HTML';
    }

    return data.applicationFormat;
};

/**
 * get Export options.
 *
 * @param {Object} data - data
 * @return {Any} array of export options
 */
export let getExportOptions = function( data ) {
    var options = [];
    if( data.editorProps.contentType === CONTENT_TYPE_WORD && data.editMode ) {
        options = [ {
            option: 'CheckOutObjects',
            optionvalue: 'CheckOutObjects'
        } ];
    } else if( data.editMode ) {
        options = [ {
            option: 'inEditMode',
            optionvalue: 'True'
        } ];
    }

    var baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    var requestPref = {
        option: 'base_url',
        optionvalue: baseURL
    };
    options.push( requestPref );

    return options;
};

/**
 * get getContentType.
 *
 * @param {Object} data - data
 * @return {Object} content type
 */
export let getContentType = function( data ) {
    if( data.editorProps.contentType === CONTENT_TYPE_PLAIN ) {
        return 'REQ_PLAINTEXT';
    }
    return 'REQ_HTML';
};
/**
 * get Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {Object} Revision Object
 */
export let getRevisionObject = function( obj ) {
    var revObject = null;

    if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        revObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    } else if( commandsMapService.isInstanceOf( 'Att0MeasurableAttribute', obj.modelType ) ) {
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
 *
 * Update broken images urls with new url image file ticket
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let updateImages = function( data ) {
    var tmpElement = document.createElement( 'div' );

    if( !data.editorProps.showCKEditor ) {
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

    if( data.editorProps.showCKEditor ) {
        _setCKEditorContent( data.editorProps.id, tmpElement.innerHTML, data );
    } else {
        data.viewerProps.dbValue = tmpElement.innerHTML;
    }
};
/**
 * Check if HTML object template is present in the typeHierarchy
 *
 * @param {Object} ctx - The Context object
 * @return true or false
 */

var _isHTMLObjTmplRevision = function( ctx ) {
    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Fnd0HTMLObjTmplRevision' ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Initialize HTML content
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - The Context service Object
 *
 */
export let initContent = function( data, ctx ) {
    ckeditorOperations.setCkeditorDirtyFlag( 'id', appCtxService.ctx, 'close' );
    data.selected = ctx.selected;
    if ( data.content ) {
        _data = data;
        var transientFileReadTickets = null;
        if ( data.content.htmlContents && data.content.htmlContents.length ) {
            transientFileReadTickets = data.content.htmlContents;
        }
        if ( data.content.transientFileReadTickets && data.content.transientFileReadTickets.length ) {
            transientFileReadTickets = data.content.transientFileReadTickets;
        }
        if ( transientFileReadTickets ) {
            exports.setFullTextObject( data );

            data.htmlString = transientFileReadTickets[0];
            data.htmlString = reqUtils.correctImageTags( data.htmlString );
            data.htmlString = reqUtils.correctSpanTags( data.htmlString );
            data.htmlString = reqUtils.correctAnchorTags( data.htmlString );
            data.htmlString = reqUtils.removeSelfEndedUL( data.htmlString );

            if ( !data.editMode ) {
                data.editorProps.showCKEditor = false;
                data.viewerProps.dbValue = data.htmlString;
                var tmpElement = tempDocument.createElement( 'div' );
                tmpElement.innerHTML = data.htmlString;
                requirementsUtils.prepareAndUpdateListStyleType( tmpElement );
                reqUtils.insertTypeIconToOleObjects( tmpElement );
                Arm0DocumentationUtil.getAllBrokenImageIDs( data, tmpElement );
                data.viewerProps.dbValue = sanitizer.sanitizeHtmlValue( tmpElement.innerHTML );
                data.dispatch( { path: 'data.viewerProps.dbValue', value: tmpElement.innerHTML } );
                eventBus.publish( 'AwRequirementContent.updateViewerContent' ); // TODO BA - should use onUpdate in aw-requirement-content on prop
            } else {
                data.htmlString = reqUtils.convertToSuggestionTags( data.htmlString );
                data.editorProps.showCKEditor = true;
                data.viewerProps.dbValue = '';
                if( data.ckeditorReady ) {
                    // If ckeditor is ready, set contents
                    _preprocessContentsAndSetToEditor( data );
                } else {
                    // If not, set flat to indicate that content is ready to set
                    data.contentReady = true;
                }
            }
        }
    }

    return {
        showCKEditor: data.showCKEditor,
        viewerProps: data.viewerProps,
        editorProps: data.editorProps,
        ckeditorReady : data.ckeditorReady,
        contentReady: data.contentReady,
        htmlString: data.htmlString
    };
};

/**
 * Function to preprocess html content before loading to editor
 * @param {Object} data - viewmodel object
 */
function _preprocessContentsAndSetToEditor( data ) {
    var nodeList = tempDocument.createElement( 'div' );
    nodeList.innerHTML = data.htmlString;
    var contentDiv;
    contentDiv = document.createElement( 'div' );
    var divElement = nodeList.getElementsByClassName( 'aw-requirement-content' );
    var headerDivElement = nodeList.getElementsByClassName( 'aw-requirement-header' );
    if( divElement && divElement.length > 0 ) {
        divElement[0].innerHTML = sanitizer.sanitizeHtmlValue( divElement[0].innerHTML );
    }
    if( headerDivElement && headerDivElement.length > 0 ) {
        headerDivElement[0].innerHTML = sanitizer.sanitizeHtmlValue( headerDivElement[0].innerHTML );
    }
    if ( headerDivElement && _isHTMLObjTmplRevision( appCtxService.ctx ) ) {
        var headerDiv = document.createElement( 'div' );
        headerDiv.setAttribute( 'contenteditable', 'false' );
        headerDiv.innerHTML = headerDivElement[0].innerHTML;
        contentDiv.appendChild( headerDiv );
    } else {
        contentDiv.setAttribute( 'class', 'requirement' );
        contentDiv.setAttribute( 'revisionid', _data.selected.uid );
    }
    if ( divElement ) {
        var outerDiv = document.createElement( 'div' );
        if ( _isHTMLObjTmplRevision( appCtxService.ctx ) ) {
            outerDiv.setAttribute( 'contenteditable', 'true' );
            outerDiv.setAttribute( 'id', 'aw-requirement-body-text' );
        }
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
    appCtxService.unRegisterCtx( 'reqMarkupCtx' );
    _setCKEditorContent( data.editorProps.id, contentDiv.outerHTML, data );
}

/**
  * Unregister context on Documentation page unloaded.
 */
export let handleDocumentationUnloaded = function() {
    appCtxService.unRegisterCtx( 'isRMDocumentationTabActive' );
    ckeditorOperations.setCkeditorDirtyFlag( 'id', appCtxService.ctx, 'close' );
};

/**
 * Get Input data for getSpecificationSegment.
 *
 * @returns {Object} - Json object for SOA input
 */
export let getSpecificationSegmentInput = function (data) {
    var objUid;
    var revObject;
    var inputCtxt = reqACEUtils.getInputContext();
    var selectedObjs = appCtxService.getCtx('Ase0SystemRequirementsSelection');
    if (selectedObjs && selectedObjs.selection && selectedObjs.selection.length > 0) {
        if (selectedObjs.selection[0].props.ase0RelatedElement && selectedObjs.selection[0].props.ase0RelatedElement.dbValue) {
            objUid = selectedObjs.selection[0].props.ase0RelatedElement.dbValue;
        } else {
            objUid = selectedObjs.selection[0].uid;
        }
        var adaptedObject = cdm.getObject(objUid);
        revObject = Arm0DocumentationUtil.getRevisionObject(adaptedObject);
    } else if (data.subPanelContext && data.subPanelContext.selection && data.subPanelContext.selection[0]) {
        selectedObjs = data.subPanelContext.selection[0];
        revObject = Arm0DocumentationUtil.getRevisionObject(selectedObjs);
    }
    else {
        selectedObjs = appCtxService.getCtx('selected');
        revObject = Arm0DocumentationUtil.getRevisionObject(selectedObjs);
    }

    var option = ['ExportContent'];
    if (data.editMode) {
        option.push('EditMode');
    }
    return {
        inputCtxt: inputCtxt,
        inputObjects: [{ uid: revObject.uid, type: revObject.type }],
        options: option
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
 * Get Input for save
 *
 * @param{Object} widgetsToSave - widget to be save
 * @param {Object} data - view model data
 * @return {String} IJSO for input
 */
var _getWidgetSaveData = function( widgetsToSave, data ) {
    var setContentInputJSO = [];
    var setContentInput = widgetsToSave.setContentInput;

    if ( setContentInput !== null && setContentInput.length > 0 ) {
        for ( var i = 0; i < setContentInput.length; i++ ) {
            var updatedRequirement = setContentInput[i];
            var uid = updatedRequirement.uid;
            var contents = updatedRequirement.contents;
            var ele = document.createElement( 'div' );
            ele.innerHTML = contents;
            contents = _preProcessBeforeSave( contents );

            if ( uid !== null ) {
                var obj = appCtxService.getCtx( 'selected' );
                var revObject = Arm0DocumentationUtil.getRevisionObject( obj );
                var specSegmentContent = { uid: revObject.uid, type: revObject.type };
                var lastSavedDate = Arm0DocumentationUtil.getRevisionObjectLsd( obj );
                if ( specSegmentContent !== null ) {
                    updatedObjetsInput.setContentInput[i].objectToProcess = specSegmentContent;
                    setContentInputJSO = Arm0DocumentationUtil.getSetRichContentInput( setContentInputJSO, specSegmentContent,
                        lastSavedDate, contents, 'REQ_HTML' );
                }
            }
        }
    }
    return {
        createInput: [],
        setContentInput: setContentInputJSO
    };
};

var _getCreateMarkupInput = function( data ) {
    return markupUtil.getCreateMarkupInput( data.content );
};


/**
 * check And Get Content baed on type
 *
 * @param {Object} ctx - The Context service Object
 *
 */
export let checkAndGetContent = function( ctx ) {
    if( _isHTMLObjTmplRevision( ctx ) ) {
        eventBus.publish( 'requirementDocumentation.getHTMLObjTmplContent' );
    }else{
        eventBus.publish( 'requirementDocumentation.getHTMLReqTextContent' );
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
            _preprocessContentsAndSetToEditor( data );

            // Reset the flag
            data.contentReady = false;
        }
    }
    return {
        contentReady: data.contentReady,
        ckeditorReady: data.ckeditorReady
    };
};


export default exports = {
    getSaveHandler,
    updateFormData,
    setFullTextObject,
    insertOLE,
    prepareInputforOLEInsert,
    processEditHandlerStateChanged,
    setOLEObjectToDownload,
    getBodyText,
    getApplicationFormat,
    getExportOptions,
    getContentType,
    getRevisionObject,
    getRevisionObjectType,
    getRevisionObjectLsd,
    updateImages,
    initContent,
    getSpecificationSegmentInput,
    getCreateUpdateInput,
    checkAndGetContent,
    isCkeditorInstanceReady,
    prepareInputforImageInsert,
    InsertOLEInCKEditor,
    handleDocumentationUnloaded,
    insertImage
};
