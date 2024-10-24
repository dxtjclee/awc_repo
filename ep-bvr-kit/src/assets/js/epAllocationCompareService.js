// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epAllocationCompareService
 */

import { constants as epLoadConstants } from 'js/epLoadConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import cdm from 'soa/kernel/clientDataModel';
import typeDisplayNameService from 'js/typeDisplayName.service';
import messagingService from 'js/messagingService';
import epAllocationIndicationService from 'js/epAllocationIndicationService';
import _ from 'lodash';

/**
 * formatPopupTitle
 *
 * @param {*} title popup title
 * @param {*} target the target object uid - in plant bop
 * @returns {Object} variant formulas of source and target
 */
function formatPopupTitle( title, target ) {
    const objectName = typeDisplayNameService.instance.getDisplayName( cdm.getObject( target ) );
    return title.format( objectName );
}

/**
 * getSourceObjectAndNumberOfTargets
 *
 * @param {String} target the target object uid - in plant bop
 * @param {String} message warning message if more than 1 targets
 * @returns {Object} variant formulas of source and target
 */
function getSourceObjectAndNumberOfTargets( target, message ) {
    const source = epAllocationIndicationService.getSourceForTarget( target );
    const numberOfTargets = epAllocationIndicationService.getTargetsForSource( source ).length;
    const compareMultipleMismatchesText = numberOfTargets > 1 ? message.format( numberOfTargets ) : '';
    return {
        source,
        numberOfTargets,
        compareMultipleMismatchesText
    };
}

/**
 * loadProperties
 *
 * @param {*} sourceUid the source object uid - in product bop
 * @param {*} targetUid the target object uid - in plant bop
 * @returns {Promise} variant formulas of source and target
 */
function loadProperties( sourceUid, targetUid ) {
    const compareProperties = epAllocationIndicationService.getCompareProperties();
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.GET_PROPERTIES ], [ sourceUid, targetUid ], compareProperties );
    return epLoadService.loadObject( loadTypeInput ).then( () => {
        return getProperties( sourceUid, targetUid, compareProperties );
    } );
}

/**
 * getProperties
 * @param {*} sourceUid the source object uid - in product bop
 * @param {*} targetUid the target object uid - in plant bop
 * @param {Array} compareProperties compareProperties array
 * @returns {String} variant formula formatted for compare
 */
function getProperties( sourceUid, targetUid, compareProperties ) {
    const sourceObject = cdm.getObject( sourceUid );
    const targetObject = cdm.getObject( targetUid );
    const modelType = sourceObject.modelType;

    return _.filter( _.map( compareProperties, property => ( {
        displayName: modelType.propertyDescriptorsMap[ property ].displayName, //
        sourceValue: sourceObject.props[ property ].uiValues[ 0 ],
        targetValue: targetObject.props[ property ].uiValues[ 0 ],
        isVariantFormula: property === epBvrConstants.BL_FORMULA
    } ) ), property => property.sourceValue !== property.targetValue );
}
/**
 * propagateChanges
 *
 * @param {*} sourceUid the source object uid - in product bop
 * @param {*} targetUid the target object uid - in plant bop
 * @param {*} message success message
 * @returns {Promise} save promise
 */
function propagateChanges( sourceUid, targetUid, message ) {
    const source = cdm.getObject( sourceUid );
    const target = cdm.getObject( targetUid );
    const saveWriter = saveInputWriterService.get();
    saveWriter.addPropagateProperties( source, target, epAllocationIndicationService.getCompareProperties() );
    return epSaveService.saveChanges( saveWriter, false, [ source, target ] ).then( () => {
        messagingService.showInfo( message.format( typeDisplayNameService.instance.getDisplayName( source ) ) );
    } );
}

export default {
    formatPopupTitle,
    getSourceObjectAndNumberOfTargets,
    loadProperties,
    propagateChanges
};
