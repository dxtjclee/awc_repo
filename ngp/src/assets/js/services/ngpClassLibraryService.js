// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import cdm from 'soa/kernel/clientDataModel';

/**
 * NGP Class library service
 *
 * @module js/services/ngpClassLibraryService
 */
'use strict';

/**
 * @param {modelObject} modelObject - a given modelObject
 * @param {string} prefix - the prefix string
 * @return {string} the class library indication string
 */
export function getClassLibraryIndicationValue( modelObject, prefix ) {
    const mfgModelUid = ngpDataUtils.getMfgModelUid( modelObject );
    const mfgModelObj = cdm.getObject( mfgModelUid );
    if( mfgModelObj && mfgModelObj.props[ ngpPropConstants.IS_CLASS_LIBRARY ] ) {
        const isClassLibrary = mfgModelObj.props[ ngpPropConstants.IS_CLASS_LIBRARY ].uiValues[ 0 ];
        if( isClassLibrary.toLowerCase() === 'true' ) {
            return `${prefix} "${mfgModelObj.props[ ngpPropConstants.OBJECT_NAME ].uiValues[0]}"`;
        }
    }
    return '';
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {object} - the is class library property of the modelObject
 */
export function getClassLibraryProperty( modelObject ) {
    const mfgModelUid = ngpDataUtils.getMfgModelUid( modelObject );
    const mfgModelObj = cdm.getObject( mfgModelUid );
    if( mfgModelObj ) {
        return mfgModelObj.props[ ngpPropConstants.IS_CLASS_LIBRARY ];
    }
}

let exports = {};
export default exports = {
    getClassLibraryIndicationValue,
    getClassLibraryProperty
};
