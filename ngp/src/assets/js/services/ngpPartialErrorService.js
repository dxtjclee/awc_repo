// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import soaSvc from 'soa/kernel/soaService';
import msgSvc from 'js/messagingService';
import _ from 'lodash';


/**
 * The ngp page load service
 *
 * @module js/services/ngpPartialErrorService
 */
'use strict';

const ignorableErrors = [ {
        description: 'clone process, user cannot modify model views palette',
        errorNum: 160104,
        printError: true
    },
    {
        description: 'clone no subset in process',
        errorNum: 160076,
        printError: false
    },
    {
        description: 'clone PE error 1',
        errorNum: 160079,
        printError: false
    },
    {
        description: 'clone PE error 2',
        errorNum: 160080,
        printError: false
    },
    {
        description: 'clone PE error 3',
        errorNum: 160081,
        printError: false
    },
    {
        description: 'clone PE error 4',
        errorNum: 160082,
        printError: false
    },
    {
        description: 'clone no subset in activity',
        errorNum: 160086,
        printError: false
    },
    {
        description: 'unable to find property Cpd0WorksetRevision',
        errorNum: 38015,
        printError: true
    },
    {
        description: 'the specific type Foreground doesnt exist',
        errorNum: 39014,
        printError: true
    }

];

/**
 *
 * @param {object} soaServiceData - ther soa serviceData object from the soa response
 * @param {object[]} ignoreErrors - array of errors to ignore
 * @param {boolean} aggregateErrors - true if you want to show errors in one message dialog, or each error in diffrent message dialog
 */
function displaySoaErrorMessages( soaServiceData, ignoreErrors, aggregateErrors ) {
    let error = '';
    let partialErrors =  soaServiceData  ? soaServiceData.partialErrors || soaServiceData.PartialErrors : null;

    if( partialErrors ) {
        partialErrors = partialErrors.filter( ( partialError ) => {
            partialError.errorValues = partialError.errorValues.filter( ( errorMsg ) => !_.includes( ignoreErrors, errorMsg.code ) );
            return partialError.errorValues.length > 0;
        } );
        soaServiceData.partialErrors = partialErrors;
        if( aggregateErrors && partialErrors && partialErrors.length > 1 ) {
            partialErrors.forEach( ( partialError, index ) => {
                partialError.errorValues.forEach( ( error ) => {
                    const errorMsg = `- ${error.message}`;
                    error += index > 0 ? `<br>${errorMsg}` : errorMsg;
                } );
            } );
        } else {
            error = msgSvc.getSOAErrorMessage( soaSvc.createError( soaServiceData ) );
        }
    }

    msgSvc.showError( error );
}

/**
 *
 * @param {string} errorNum - the error number
 * @param {object[]} additionalErrorsToIgnore - additional errors to ignore
 * @return {object} an object in the ingorableErrors array
 */
function getEquivalentIgnorableErrorObject( errorNum, additionalErrorsToIgnore ) {
    const allIgnorableErrors = ignorableErrors.concat( ...additionalErrorsToIgnore );
    return _.find( allIgnorableErrors, ( ignorableError ) => ignorableError.errorNum === errorNum );
}

/**
 *
 * @param {object[]} partialErrors - an array of objects which represent a partial error
 * @param {object[]} additionalErrorsToIgnore - additional errors to ignore
 * @return {object[]} partial errors which aren't ignorable
 */
function splitErrorsToCategories( partialErrors, additionalErrorsToIgnore ) {
    const partialErrorNumbers = [];
    partialErrors.forEach( ( error ) => {
        error.errorValues.forEach( ( errorValue ) => {
            partialErrorNumbers.push( errorValue.code );
        } );
    } );

    const ignore = [];
    const ignoreButDisplay = [];
    const notToIgnore = [];
    partialErrorNumbers.forEach( ( errorNum ) => {
        const ignorableErrorObj = getEquivalentIgnorableErrorObject( errorNum, additionalErrorsToIgnore );
        if( ignorableErrorObj ) {
            if( ignorableErrorObj.printError ) {
                ignoreButDisplay.push( errorNum );
            } else {
                ignore.push( errorNum );
            }
        } else {
            notToIgnore.push( errorNum );
        }
    } );
    return {
        ignore,
        ignoreButDisplay,
        notToIgnore
    };
}

/**
 *
 * @param {object} soaServiceData - the soa ServiceData response
 * @param {boolean} aggregateErrors - true if you want to show errors in one message dialog, or each error in diffrent message dialog
 * @param {object[]} additionalErrorsToIgnore - additional errors to ignore
 * @return {object} an object which contains 3 arrays of errors: ignore, ignoreButDisplay, notToIgnore
 */
export function handlePartialErrors( soaServiceData, aggregateErrors = false, additionalErrorsToIgnore = [] ) {
    let categorizedErrors = {
        ignore: [],
        ignoreButDisplay: [],
        notToIgnore: []
    };
    if ( soaServiceData ) {
        if ( soaServiceData.partialErrors ) {
            categorizedErrors = splitErrorsToCategories( soaServiceData.partialErrors, additionalErrorsToIgnore );
        } else if ( soaServiceData.PartialErrors ) {
            categorizedErrors = splitErrorsToCategories( soaServiceData.PartialErrors, additionalErrorsToIgnore );
        }
    }
    if ( categorizedErrors.ignoreButDisplay.length > 0 || categorizedErrors.notToIgnore.length > 0 ) {
        //extract out error to ignore?
        displaySoaErrorMessages( soaServiceData, categorizedErrors.ignore, aggregateErrors );
    }
    return categorizedErrors;
}

let exports;
export default exports = {
    handlePartialErrors
};
