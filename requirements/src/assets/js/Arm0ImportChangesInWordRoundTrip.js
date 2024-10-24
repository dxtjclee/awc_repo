// Copyright (c) 2022 Siemens

/**
 * This provides functionality related to Word Round-trip: Import the word
 * @module js/Arm0ImportChangesInWordRoundTrip
 */
import browserUtils from 'js/browserUtils';
import AwPromiseService from 'js/awPromiseService';
import AwHttpService from 'js/awHttpService';
import rmTreeDataService from 'js/Arm0ImportPreviewJsonHandlerService';
import importPreviewService from 'js/ImportPreview';
import eventBus from 'js/eventBus';
import compareJsonService from 'js/Arm0CompareJsonStructureService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import reqACEUtils from 'js/requirementsACEUtils';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};

var microServiceURLString = 'tc/micro/REQIMPORT/v1/api/import/importdocument';

var WEB_XML_FMS_PROXY_CONTEXT = 'fms';
var CLIENT_FMS_DOWNLOAD_PATH = WEB_XML_FMS_PROXY_CONTEXT + '/fmsdownload/?ticket=';

/**
  * Returns the input for the microservice call
  *
  * @param {Object} data - The view model data
  * @param {Object} ctx - the Context Object
  * @return {Array} inputs of the microservice call
  */
export let getImportWordDocumentInput = function( data, ctx ) {
    var options = [];
    if( data.overwriteConflict.dbValue ) {
        var option = {
            option: 'OverwriteConflicts',
            val: 'true'
        };
        options.push( option );
    }
    let topObject = reqACEUtils.getTopSelectedObject( ctx );
    return [ {
        selectedObject: topObject,
        transientFileWriteTicket: data.importData,
        applicationFormat: 'RoundTripImport',
        createSpecElementType: 'Alenia.docx',
        specificationType: '',
        isLive: false,
        isRunInBackground: false,
        isPermanentconvertToHtml: '',
        importAsSpec: '',
        pasteTopSpecRevisionUnderSelection: true,
        specDesc: '',
        keywordImportRules: [],
        importOptions: options
    } ];
};

export let getImportWordDocumentInputInPreviewMode = function(  ) {
    var options = [];
    if( _roundTripOptionsData.overwriteConflict ) {
        var option = {
            option: 'OverwriteConflicts',
            val: 'true'
        };
        options.push( option );
    }

    return [ {
        selectedObject: _roundTripOptionsData.selectedOccurrence,
        transientFileWriteTicket: _roundTripOptionsData.ticketToImport, //
        applicationFormat: 'RoundTripImport',
        createSpecElementType: 'Alenia.docx',
        specificationType: '',
        isLive: false,
        isRunInBackground: false,
        isPermanentconvertToHtml: '',
        importAsSpec: '',
        pasteTopSpecRevisionUnderSelection: true,
        specDesc: '',
        keywordImportRules: [],
        importOptions: options
    } ];
};

export let updateFileContentInFormDataForRoundTripImport = function( data ) {
    let jsonFromMicroservice = _roundTripOptionsData.jsonDataToImport;
    // Filter for Updated
    // Check if any setting changed on Preview. Update json to be imported
    jsonFromMicroservice.update = jsonFromMicroservice.update.filter( function( element ) {
        let objectFromTree = rmTreeDataService.getObjectFromId( element.uid );
        // Change setting to discard update for this object, hence remove it from json while sending to server
        return objectFromTree.status !== 'NoChange';
    } );

    // Filter for Added/Deleted
    // Check if any setting changed on Preview. Update json to be imported
    jsonFromMicroservice.added = jsonFromMicroservice.added.filter( function( element ) {
        let objectFromTree = rmTreeDataService.getObjectFromId( element.uid );
        element.type = objectFromTree.type; // If type changed on Preview
        // Change setting to discard update for this object, hence remove it from json while sending to server
        return objectFromTree.status !== 'Delete';
    } );
    // Check if any setting changed on Preview. Update json to be imported
    jsonFromMicroservice.deleted = jsonFromMicroservice.deleted.filter( function( element ) {
        let objectFromTree = rmTreeDataService.getObjectFromId( element.uid );
        // Change setting to discard update for this object, hence remove it from json while sending to server
        return objectFromTree.status !== 'Add';
    } );

    let deferred = AwPromiseService.instance.defer();
    data.formDataForRoundTripImport = new FormData();
    data.formDataForRoundTripImport.append( 'fmsFile', new Blob( [ JSON.stringify( jsonFromMicroservice ) ], { type: 'text/plain' } ) );
    data.formDataForRoundTripImport.append( 'fmsTicket', _roundTripOptionsData.ticketToImport.trim() );

    deferred.resolve( {
        formDataForRoundTripImport:data.formDataForRoundTripImport,
        topLineToOpenOnRoundTrip: _roundTripOptionsData.selectedRevisionObject
    } );
    return deferred.promise;
};

/**
  * Returns the url for the microservice call
  * @return {String} url for the microservice call
  */
export let getMicroServiceURL = function( ) {
    return browserUtils.getBaseURL() + microServiceURLString;
};

/**
 * @param {Object} data - The view model data
 * @param {Object} subPanelContext - the Context Object
 * @return {String} dbValue of the selected type
  */
export let updateDataValues = function( data, subPanelContext ) {
    return{
        toplineID : subPanelContext.occContext.topElement.uid,
        toplineRevID : subPanelContext.occContext.topElement.props.awb0UnderlyingObject.dbValues[ 0 ],
        includeComments : data.importComments.dbValue
    };
};

export let getOccurrenceId = function( updatedRevIds ) {
    var div = [];
    var objects = [];
    for( var i = 0; i < updatedRevIds.length; i++ ) {
        div[i] = document.querySelector( 'div[revisionId="' + updatedRevIds[i]  + '"]' );
        if( div[i] !== null ) {
            objects.push( {
                uid:div[i].id } );
        }
    }
    return objects;
};


export let updateImportWordRoundTripEventValue = function( data ) {
    return data.isImportWordRoundTripEventProgressing !== true;
};

//==================== PREVIEW ====================

export let updateDataToInitiatePreview = function( ) {
    return true;
};

export let getJsonTicketFromResponse = function( existingJsonTicket, newJsonTicket ) {
    return {
        existingJsonTicket: existingJsonTicket,
        newJsonTicket: newJsonTicket
    };
};

/**
 * Set existing structures JSON data to service for rendering Preview
 * @param {String} data - The ViewModel Object
 * @returns {Object} - Json object
 */
export let getJsonFromResponseTicket = function( resp, ticket ) {
    let deferred = AwPromiseService.instance.defer();
    let promise = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + ticket );
    promise.then( function( response ) {
        if( response ) {
            deferred.resolve( response.data );
        }
    } ).catch( function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

let _objectString;
let _roundTripOptionsData;

export let compareJsonForPreview = function( existingJson, newJson, data ) {
    let topObject = reqACEUtils.getTopSelectedObject( appCtxSvc.ctx );
    _roundTripOptionsData = {
        overwriteConflict: data.overwriteConflict.dbValue,
        jsonDataToImport: _.cloneDeep( newJson, true ),
        ticketToImport: data.importData,
        selectedRevisionObject: { uid: cdm.getObject( topObject.uid ).props.awb0UnderlyingObject.dbValues[0] },
        selectedOccurrence: topObject
    };

    existingJson = existingJson.specification[0];

    // Get to update Location title
    _objectString = cdm.getObject( topObject.uid ).props && cdm.getObject( topObject.uid ).props.awb0UnderlyingObject ? cdm.getObject( topObject.uid ).props.awb0UnderlyingObject.uiValues[0] : undefined;

    getAllowedChildTypes().then( function( response3 ) {
        let outputSpecList = response3.rootTypes;
        let outputSpecElementList = response3.specElementTypes;
        let specList = Object.assign( outputSpecList, outputSpecElementList );

        rmTreeDataService.setDisplayType( existingJson, specList );
        rmTreeDataService.updateDisplayTypes( existingJson, specList );

        let compareJsonData  = compareJsonService.compareJsonForRoundTripPreview( existingJson, newJson );

        rmTreeDataService.setJSONData( compareJsonData.comparedData );
        rmTreeDataService.setPreviewInitiator( 'RoundTripPreview' );
        importPreviewService.setSecondaryArea();
        eventBus.publish( 'importPreview.openImportPreview' );
    } );
};

let getAllowedChildTypes = function() {
    let inputData = {
        input: {
            rootTypeName: '',
            specElementTypeName: 'SpecElement',
            exclusionBOTypeNames: [],
            option: ''
        }
    };

    let deferred = AwPromiseService.instance.defer();
    soaSvc.post( 'Internal-ActiveWorkspaceReqMgmt-2017-06-ImportExport', 'getDisplayableTypes', inputData )
        .then( function( response ) {
            if ( response ) {
                deferred.resolve( response );
            }
        } ).catch( function( error ) {
            deferred.reject( error );
            eventBus.publish( 'progress.end' );
        } );

    return deferred.promise;
};

export let convertComparedSpecContentsToHTML = function( data ) {
    rmTreeDataService.setJSONData( data.comparedData );
    importPreviewService.setSecondaryArea();
    eventBus.publish( 'importPreview.openImportPreview' );
};

export let setHeaderTitleOnRoundTrip = function() {
    if( _objectString ) {
        let locationTitleCtx = appCtxSvc.getCtx( 'location.titles' );
        locationTitleCtx.headerTitle = locationTitleCtx.headerTitle.replace( '{0}', _objectString );
        appCtxSvc.updateCtx( 'location.titles', locationTitleCtx );
    }
};

export let updateDocumentName = function( data ) {
    var fileName = data.fileName;
    if( fileName && data && data.i18n && data.i18n.NoUpdatesToImportError ) {
        var msg = data.i18n.NoUpdatesToImportError.replace( '{0}', fileName );
    }
};

//=================================================

export default exports = {
    getImportWordDocumentInput,
    getMicroServiceURL,
    updateDataValues,
    getOccurrenceId,
    updateImportWordRoundTripEventValue,
    updateDataToInitiatePreview,
    compareJsonForPreview,
    getJsonTicketFromResponse,
    getJsonFromResponseTicket,
    setHeaderTitleOnRoundTrip,
    updateFileContentInFormDataForRoundTripImport,
    getImportWordDocumentInputInPreviewMode,
    updateDocumentName
};

