// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


import localeService from 'js/localeService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import messagingService from 'js/messagingService';
import ngpProductScopeSvc from 'js/services/ngpProductScopeService';
import app from 'app';
import popupSvc from 'js/popupService';
import ngpSoaService from 'js/services/ngpSoaService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';


/**
 * The ngp associate partitions service
 *
 * @module js/services/ngpRevisionRuleService
 */
'use strict';
const localizedMessages = localeService.getLoadedText( app.getBaseUrlPath() + '/i18n/NgpProductRevisionRuleMessages.json' );

/**
 *
 * @param {object[]} modelObjects - cmdObjects
 * @return {Promise} a promise
 */
export function displayProductRevisionRuleDlg( modelObjects ) {
    const  modelObjectsSet = new Set( modelObjects.map( ( modelObject ) => ngpTypeUtils.isBuildElement( modelObject ) ) );
    if ( modelObjectsSet.size > 1 ) {
        return new Promise( ( res ) => {
            const closeBtn = mfgNotificationUtils.createButton( localizedMessages.close, ( $noty ) => $noty.close() );
            messagingService.showError( localizedMessages.productRevisionCanotRevisionRuleWithDifferentTypes, null, null, [ closeBtn ] );
            res( '' );
        } );
    }
    return getRevisionRulesNames( modelObjects ).then( ( output ) => {
        const { revisionRulesNames, objectsWithsubsets } = output;
        if ( revisionRulesNames.length > 0 ) {
            if ( objectsWithsubsets.length < modelObjects.length ) {
                const message = ngpTypeUtils.isBuildElement( modelObjects[ 0 ] ) ?
                    localizedMessages.productRevisionSomeOfBuildElementsHasNoProductScope :
                    localizedMessages.productRevisionSomeOfActivitiesHasNoProductScope;

                mfgNotificationUtils.displayConfirmationMsgWithNumerousButtons( message,
                    [ localizedMessages.cancel, localizedMessages.editTheOthers ] ).then(
                    ( selection ) => {
                        if ( selection === localizedMessages.editTheOthers ) {
                            showProductRevisionRuleDlg( objectsWithsubsets, null, revisionRulesNames );
                        }
                    } );
            } else {
                showProductRevisionRuleDlg( objectsWithsubsets, null, revisionRulesNames );
            }
        } else {
            let message = null;
            if ( modelObjects.length > 0 ) {
                if ( ngpTypeUtils.isBuildElement( modelObjects[ 0 ] ) ) {
                    message = modelObjects.length === 1 ?
                        localizedMessages.productRevisionNoProductAssociteWithBE.format( modelObjects[ 0 ].props.object_string.dbValues[ 0 ] ) :
                        localizedMessages.productRevisionNoProductAssociteWithBEs;
                } else {
                    message = modelObjects.length === 1 ? localizedMessages.productRevisionNoProductAssociteWithActivity.format( modelObjects[ 0 ].props.object_string.dbValues[ 0 ] ) :
                        localizedMessages.productRevisionNoProductAssociteWithActivities;
                }
            }
            const closeBtn = mfgNotificationUtils.createButton( localizedMessages.close, ( $noty ) => $noty.close() );

            messagingService.showError( message, null, null, [ closeBtn ] );
        }
    } );
}

/**
  *
  * @param {ModelObject[]} modelObjects - array with model objects
  * @return {Promise} a promise
  */
function getRevisionRulesNames( modelObjects ) {
    if ( ngpTypeUtils.isBuildElement( modelObjects[0]  ) ) {
        return ngpProductScopeSvc.getRelatedProductScopeAndRelation( modelObjects ).then( ( relationDataArray ) => {
            const objectsWithsubsets = relationDataArray.map( ( relationData ) => relationData.planningScope );
            const relatedSubsets = relationDataArray.map( ( relationData ) => relationData.productScope );
            return ngpProductScopeSvc.getCurrRevRulesFromSubsets( relatedSubsets ).then( ( revisionRulesNames ) => {
                return { objectsWithsubsets, revisionRulesNames };
            } );
        } );
    }

    return ngpSoaService.executeSoa( 'Internal-Process-2017-05-ProductSubset', 'getProductSubsetDefinitions', { objects: modelObjects } ).then( ( out ) => {
        let objectsWithsubsets = [];
        let revisionRulesNames = [];
        out.output.forEach( ( outputItem, index ) => {
            if ( outputItem.revisionRule.uid !== 'AAAAAAAAAAAAAA' ) {
                objectsWithsubsets.push( modelObjects[ index ] );
                revisionRulesNames.push( outputItem.revisionRule.props.object_name.dbValues[ 0 ] );
            }
        } );
        return { objectsWithsubsets, revisionRulesNames };
    } );
}

/**
* Displays Create Dataset dialog.
* @param {modelObject} context - the current BE modelObject
* @param {modelObject} subsetDefinition - subset Def Object
* @param {String[]} currRevisionRules - Revision Rule names
*/
function showProductRevisionRuleDlg( context,  subsetDefinition, currRevisionRules ) {
    popupSvc.show( {
        declView: 'NgpProductRevisionRuleDlg',
        options: {
            height: '250',
            width: '500',
            caption: localizedMessages.productRevisionRuleTitle
        },
        subPanelContext:{
            context,
            subsetDefinition,
            currRevisionRules
        }
    } );
}

/**
 * @param {Object} product - model object
 * @returns {String} - title and product Name
 */
export function getProductNameDescriptionForSetRevisionRule( product ) {
    let productDescription;
    if ( product.length === 1 ) {
        productDescription = ngpTypeUtils.isBuildElement( product[0] ) ?
            localizedMessages.productRevisionRuleBEName :
            localizedMessages.productRevisionRuleActivityName;
        productDescription = productDescription.replace( '{0}', product[0].props[ngpPropConstants.OBJECT_STRING].uiValues[0] );
    }else {
        productDescription = ngpTypeUtils.isBuildElement( product[0] ) ?
            localizedMessages.productRevisionRuleMultipleBEName :
            localizedMessages.productRevisionRuleMultipleActivityName;
        productDescription = productDescription.replace( '{0}', product.length );
    }
    return productDescription;
}

/**
 *
 * @param {*} data - the new value
 * @param {*} currRevisionRule - current revision rule
 * @returns {boolean} - is revision rule changed
 */
export function revisionRuleSelectionChange( data,  currRevisionRule ) {
    return data.uiValue !== currRevisionRule.dispValue;
}

let exports = {};
export default exports = {
    displayProductRevisionRuleDlg,
    getProductNameDescriptionForSetRevisionRule,
    revisionRuleSelectionChange
};


