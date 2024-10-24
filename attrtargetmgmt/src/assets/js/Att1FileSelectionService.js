// Copyright (c) 2022 Siemens

/**
 * Service while will allow users to select the file and upload to FMS
 * @module js/Att1FileSelectionService
 */
import eventBus from 'js/eventBus';

var fileSelectionForm = null;
var fileName = '';
var fmsTicket = '';
var exports = {};

/**
 * Getter method to get the file name
 * @returns {String} the name of the selected file
 */
export let getFileName = function() {
    return fileName;
};

/**
 * Getter method to get the fms file ticket
 * @returns {String} the fms file ticket of the file
 */
export let getFileTicket = function() {
    return fmsTicket;
};

/**
 * Method to clear the selected file data
 */
export let clearFileData = function() {
    fmsTicket = '';
    fileName = '';
};

/**
 * Method to open File selection dialog
 * @param {Object} data  the view model object data
 * @param {String} eventToCall the next event to call
 */
export let openFileSelectionDialog = function( data, eventToCall, parametersTable ) {
    let parametersTableCtx = { ...parametersTable.value };
    parametersTableCtx.isComplexDataImportInProgress = true;
    parametersTable.update( parametersTableCtx );
    fmsTicket = '';
    fileName = '';
    fileSelectionForm = document.createElement( 'form' );

    fileSelectionForm.setAttribute( 'id', 'fileUploadForm' );
    var input = document.createElement( 'input' );
    fileSelectionForm.appendChild( input );
    input.setAttribute( 'type', 'file' );
    input.setAttribute( 'id', 'fmsFile' );
    input.setAttribute( 'name', 'fmsFile' );
    input.setAttribute( 'accept', '.xlsx,.xlsm' );
    input.addEventListener( 'change', function( event ) {
        var file = event.currentTarget.files[ 0 ];
        fileName = file.name;
        data.fileName = fileName;
        parametersTableCtx.isFileSelectedByUser = true;
        parametersTable.update( parametersTableCtx );

        if( file ) {
            eventBus.publish( eventToCall, { fileName: file.name } );
        }
    } );
    input.click();
};

/**
 * Method to set the form data in view model data object
 * @param {Object} data  the view model object data
 * @param {String} eventToCall the next event to call
 */
export let setFormDataForSelectedFile = function( data, eventToCall ) {
    var formData = new FormData( fileSelectionForm );
    fmsTicket = data.fmsTicket;
    formData.append( 'fmsTicket', data.fmsTicket );
    data.formData = formData;
    eventBus.publish( eventToCall );
};
/**
 * Returns the Att1FileSelectionService instance
 *
 * @member Att1FileSelectionService
 */

export default exports = {
    openFileSelectionDialog,
    setFormDataForSelectedFile,
    getFileName,
    getFileTicket,
    clearFileData
};
