// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPropConst from 'js/constants/ngpPropertyConstants';
import ngpRelationSvc from 'js/services/ngpRelationService';
import cdm from 'soa/kernel/clientDataModel';

/**
 * NGP Favorites service
 *
 * @module js/services/ngpEffectivityService
 */
'use strict';

const modelUidToEffectiviyValue = {};

/**
 *
 * @param {modelObject} modelObject - a given model object
 * @return {promise} a promise object
 */
export function getProductEffectivityValue( modelObject ) {
    if( modelObject && modelObject.props && modelObject.props[ ngpPropConst.MANUFACTURING_MODEL ] ) {
        const modelUid = modelObject.props[ ngpPropConst.MANUFACTURING_MODEL ].dbValues[ 0 ];
        if( modelUidToEffectiviyValue[ modelUid ] ) {
            return new Promise( ( resolve ) => {
                resolve( modelUidToEffectiviyValue[ modelUid ] );
            } );
        }
        const manufacturingModelObj = cdm.getObject( modelUid );
        return ngpRelationSvc.getProductEffectivityValue( manufacturingModelObj ).then(
            ( productEffectivityValue ) => {
                let displayValue = '';
                if( productEffectivityValue && productEffectivityValue !== '' ) {
                    displayValue = 'U '.concat( productEffectivityValue );
                }
                const returnObj = {
                    displayValue,
                    effectivityValue: productEffectivityValue
                };
                modelUidToEffectiviyValue[ modelUid ] = returnObj;
                return returnObj;
            }
        );
    }
    return new Promise( ( resolve ) => resolve( { displayValue:'', effectivityValue:'' } ) );
}

let exports = {};
export default exports = {
    getProductEffectivityValue
};
