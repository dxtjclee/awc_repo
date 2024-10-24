// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Balancing Chips related services
 *
 * @module js/epBalancingProductVariantsService
 */

import cdm from 'soa/kernel/clientDataModel';
import epContextService from 'js/epContextService';
import typeDisplayNameService from 'js/typeDisplayName.service';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import epStructureConfigurationService from 'js/epStructureConfigurationService';
import appCtxService from 'js/appCtxService';
import epBalancingService from 'js/epBalancingService';
import localStorage from 'js/localStorage';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import AwPromiseService from 'js/awPromiseService';

var shouldReloadAfterPVChange = false;

const PRODUCT_VARIANT_PBOP_CHANGED_EVENT = 'ep.productVariant.productBOPChanged';
const EXCLUDE_FEATURE_KEY = 'ep.excludeVariantFeature';

/**
 * Get productVariants list to display in balancing dashboard
 *
 * @param {Array} staticProductVariantsList 3 static values list
 * @param {Array} productVariantsFromCache productVariants uid list from cache
 *
 * @returns {ObjectList} The full list of pvs + 3 static values
 */
export function getProductVariantsList( staticProductVariantsList, productVariantsFromCache ) {
    let productVariantsList = productVariantsFromCache.map( pvUid => {
        return {
            propDisplayValue: typeDisplayNameService.instance.getDisplayName( cdm.getObject( pvUid ) ),
            propInternalValue: pvUid
        };
    } );

    productVariantsList = sortProductVariantsList( productVariantsList );
    return [ ...staticProductVariantsList, ...productVariantsList ];
}

/**
 * Sort the product variants list
 *
 * @param {ObjectArray} productVariantsList the productVariants list
 *
 * @return {ObjectArray} the sorted productVariantsList
 */
function sortProductVariantsList( productVariantsList ) {
    return productVariantsList.sort( ( pvA, pvB ) => {
        const nameA = pvA.propDisplayValue.toUpperCase(); // ignore upper and lowercase
        const nameB = pvB.propDisplayValue.toUpperCase(); // ignore upper and lowercase
        if( nameA < nameB ) {
            return -1;
        }
        if( nameA > nameB ) {
            return 1;
        }
        // names must be equal
        return 0;
    } );
}

/**
 * Set selected ProductVariant to filter the station or process resource operations by
 *
 * @param {Object} productVariant the selected productVariant]
 * @param {Array} excludeFeatures exclude feature list
 * @param {Boolean} isShouldReloadAfterPVChange isShouldReloadAfterPVChange
 */
export function setSelectedProductVariant( productVariant, excludeFeatures, isShouldReloadAfterPVChange = true ) {
    const productVariantType = productVariant === epLoadConstants.ALL || productVariant === epLoadConstants.MAXIMUM || productVariant === epLoadConstants.WEIGHTED ? productVariant : epLoadConstants.PV_UID;
    const productVariantUid = productVariant === epLoadConstants.ALL || productVariant === epLoadConstants.MAXIMUM || productVariant === epLoadConstants.WEIGHTED ? null : productVariant;
    if( productVariant !== epLoadConstants.ALL ) {
        appCtxService.updatePartialCtx( EXCLUDE_FEATURE_KEY, excludeFeatures );
    } else if( productVariant === epLoadConstants.ALL &&  excludeFeatures === null ) {
        appCtxService.updatePartialCtx( EXCLUDE_FEATURE_KEY, null );
    }
    epContextService.setProductVariant( productVariantUid, productVariantType, !isShouldReloadAfterPVChange );
    setShouldReloadAfterPVChange( isShouldReloadAfterPVChange );
}

/**
 * Set selected ProductVariant to filter the station or process resource operations by
 * @param {Object} processStructure BOP to apply configuration to.
 * @param {Array} processVariant process variant
 * @param {Object} functionalPlan ProductBOP to apply configuration to.
 * @param {Array} pbopVariant product bop variant
 * @returns {object} saveChanges response
 */
export function resetConfiguration( processStructure, processVariant, functionalPlan, pbopVariant ) {
    let structures = [];
    if( functionalPlan && pbopVariant && pbopVariant.length > 0 ) {
        structures.push( functionalPlan );
    }
    if( processStructure && processVariant && processVariant.length > 0 ) {
        structures.push( processStructure );
    }
    return applyConfigurationToMultipleStructures( getEmptyVariantRuleConfigInput(), structures );
}

/**
 * Applies configuration to given structures
 * @param {*} configData the changed configuration data
 * @param {Array} structureArray structureArray
 * @returns {Object} saveResponse
 */
function applyConfigurationToMultipleStructures( configData, structureArray ) {
    if( epStructureConfigurationService.isDirty( configData ) && structureArray && structureArray.length > 0 ) {
        const saveWriter = saveInputWriterService.get();
        let upadtedConfigChanges = epStructureConfigurationService.getConfigurationToSave( configData );
        let relatedObjects = [];
        structureArray.forEach( ( structure ) => {
            const targetAsm = {
                id: [ structure.uid ]
            };
            saveWriter.addConfigurationChangeEntry( targetAsm, upadtedConfigChanges );
            relatedObjects = epStructureConfigurationService.getRelatedObjects( structureArray );
        } );
        return epSaveService.saveChanges( saveWriter, false, relatedObjects, true ).then( function( appliedConfig ) {
            return appliedConfig;
        } );
    }
    return AwPromiseService.instance.resolve();
}

/**
 * Sets value of 'ep.excludeVariantFeature' in 'ctx'.
 * This controls visibility of Variant Rule feature in configuration panel.
 * @param {Array} excludeFeatures exclude feature list
 */
function updateExcludeFeatureInContext( excludeFeatures ) {
    if( excludeFeatures ) {
        localStorage.publish( EXCLUDE_FEATURE_KEY, JSON.stringify( excludeFeatures ) );
        appCtxService.updatePartialCtx( EXCLUDE_FEATURE_KEY, excludeFeatures );
    } else{
        appCtxService.updatePartialCtx( EXCLUDE_FEATURE_KEY, null );
    }
}


/**
  * Initialization of 'ep.excludeVariantFeature' in ctx if found in local storage,
  * and is removed immediately to clear the storage.
  * @param {Array} excludeArray array of features to exclude from configuration.
  */
function initExcludeFeatureInContext( excludeArray ) {
    if( localStorage.get( EXCLUDE_FEATURE_KEY ) ) {
        appCtxService.updatePartialCtx( EXCLUDE_FEATURE_KEY, excludeArray );
        localStorage.removeItem( EXCLUDE_FEATURE_KEY );
    }
}


/**
 * Creates config input object for saving empty variant rule
 * @returns {object} config input object for saving empty variant rule
 */
function getEmptyVariantRuleConfigInput() {
    let configChange = {
        values:{
            variantRule: [ '' ]
        },
        getValue: function() {
            return this.values;
        }
    };
    configChange.variantRule = [ '' ];

    return configChange;
}

/**
 * When product variant is selected from time distribution
 * the selected value in the product variants list should be updated
 *
 * @param {ObjectList} productVariantsList the product variants list
 *
 * @returns {Object} the selected pv
 */
export function getProductVariantToDisplay( productVariantsList ) {
    const productVariantTypeInCtx = epContextService.getProductVariantType();
    const productVariantUidInCtx = epContextService.getProductVariantUid();
    let selectedVal = null;
    if( productVariantsList ) {
        if( !productVariantUidInCtx && !productVariantTypeInCtx ) {
            return productVariantsList[0];
        } else if( productVariantTypeInCtx && productVariantTypeInCtx !== epLoadConstants.PV_UID ) {
            selectedVal = productVariantsList.find( ( pv ) => {
                return pv.propInternalValue === productVariantTypeInCtx;
            } );
        } else {
            selectedVal = productVariantsList.find( ( pv ) => {
                return pv.propInternalValue === productVariantUidInCtx;
            } );
        }

        return selectedVal ? selectedVal : productVariantsList[ 0 ];
    }
    return productVariantsList;
}

/**
 * Un-registers balancing station policy because same policy should not be applicable on ProductBop load call.
 * Returns toggle value of the "reloadTree". "reloadTree" value should be changed everytime this methods is called becuase,
 * on change of the "reloadTree" EpTreeTableViewModel reloads actual tree.
 * @param {Boolean} reloadTree to change
 * @returns {Boolean} toggle value
 */
export function handleProductVariantChanged( reloadTree ) {
    epBalancingService.unRegisterStationTilesPolicy();
    return !reloadTree;
}
/**
 *
 * @param {Boolean} isShouldReloadAfterPVChange isShouldReloadAfterPVChange
 */
export function setShouldReloadAfterPVChange( isShouldReloadAfterPVChange ) {
    shouldReloadAfterPVChange = isShouldReloadAfterPVChange;
}

export default {
    getProductVariantsList,
    getProductVariantToDisplay,
    resetConfiguration,
    handleProductVariantChanged,
    updateExcludeFeatureInContext,
    initExcludeFeatureInContext,
    setSelectedProductVariant,
    setShouldReloadAfterPVChange
};
