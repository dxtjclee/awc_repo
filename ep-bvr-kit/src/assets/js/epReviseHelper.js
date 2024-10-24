// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/epReviseHelper
 */
import _ from 'lodash';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import mfgNotificationUtils from 'js/mfgNotificationUtils';

export const CONSTANTS = {
    EDIT_PROPERTIES: 'editProperties',
    EDIT_VARIANT_FORMULA: 'editVariantFormula',
    EDIT_OCCURRENCE_EFFECTIVITY: 'editOccurrenceEffectivity'
};

let resource = null;

/**
 * displayConfirmationMessage
 * @param {*} result revise text
 * @param {*} resourceBundle localized text
 * @returns {Promise} response promise
 */
export function displayConfirmationMessage( result, resourceBundle ) {
    resource = localeService.getLoadedText( resourceBundle );

    return mfgNotificationUtils.displayConfirmationMessage( getErrorMessage( result ), resource.confirmButton, resource.cancelButton );
}

/**
 * getErrorMessage
 * @param {*} result revise error
 * @returns {String} localized error message
 */
export function getErrorMessage( result ) {
    return resource.reviseMessage.format( getReleasedObjects( result ) );
}

/**
 * getReleasedObjects
 * @param {*} result revise result
 * @returns {String} objects to release names
 */
export function getReleasedObjects( result ) {
    const modelObjects = result.ServiceData.modelObjects;
    return _.reduce( result.saveResults, ( acc, value ) => {
        const modelObject = modelObjects[ value.clientID ];
        return `${acc}"${modelObject.props[ epBvrConstants.BL_REV_OBJECT_NAME ].uiValues[ 0 ]}"<br>`;
    }, '' );
}

/**
 * checkAutoRevise
 * @param {Object} objects the viewModelObject to check for auto revise
 * @param {Object} action edit action hint
 * @returns {Promise} save promise 
 */
export function checkAutoRevise( objects, action = CONSTANTS.EDIT_PROPERTIES ) {
    const saveInputWriter = saveInputWriterService.get();
    const objectsArray = _.isArray( objects ) ? objects : [ objects ];
    const modelObjects = _.map( objectsArray, object => cdm.getObject( object.uid ) );
    saveInputWriter.addReviseInput( modelObjects, action );
    return epSaveService.saveChanges( saveInputWriter, true, modelObjects );
}

export const checkAutoReviseForTree = _.debounce( checkAutoRevise, 2000, { leading: true, trailing: false } );

export default {
    displayConfirmationMessage,
    getErrorMessage,
    getReleasedObjects,
    checkAutoRevise,
    checkAutoReviseForTree,
    CONSTANTS
};
