// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

/**
 * Utility to check mfg_ngp object type
 *
 * @module js/utils/ngpDataUtils
 */
'use strict';

/**
 *
 * @param {string} uid - a given uid
 * @return {string} the foundation id from the given uid
 */
 export function getFoundationIdFromUid( uid ) {
    if( uid ) {
        const strings = uid.split( ':' ).filter( ( str ) => str && str !== '' );
        return strings.pop();
    }
}

/**
 *
 * @param {modelObject} modelObj - a given modelObject
 * @return {string} the foundation id of the given model object
 */
export function getFoundationId( modelObj ) {
    if( modelObj ) {
        if( modelObj.props && modelObj.props[ ngpPropConstants.FOUNDATION_ID ] ) {
            return modelObj.props[ ngpPropConstants.FOUNDATION_ID ].dbValues[ 0 ];
        }
        return getFoundationIdFromUid( modelObj.uid );
    }
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @param {boolean} returnFoundationId - true if should return foundation id of the manufacturing model
 * @return {string} the hull uid of the given modelObject
 */
export function getMfgModelUid( modelObject, returnFoundationId = false ) {
    if( modelObject && modelObject.props && modelObject.props[ ngpPropConstants.MANUFACTURING_MODEL ] ) {
        const manufacturingUid = modelObject.props[ ngpPropConstants.MANUFACTURING_MODEL ].dbValues[ 0 ];
        if( returnFoundationId ) {
            const mfgModel = cdm.getObject( manufacturingUid );
            return mfgModel ? getFoundationId( mfgModel ) : getFoundationIdFromUid( manufacturingUid );
        }
        return manufacturingUid;
    }
}

/**
 * Given an array of modelObjects, this method sorts them by a property value
 *
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @param {string} sortByProp - the property to sort by
 * @param {boolean} ascending - true if the sort should be in ascending order
 * @return {ModelObject[]} - a sorted array based on a given property value
 */
export function sortModelObjectsByProp( modelObjects, sortByProp, ascending ) {
    if( Array.isArray( modelObjects ) && modelObjects.length > 1 && sortByProp ) {
        return modelObjects.sort( ( obj1, obj2 ) => {
            if( obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
                if( ascending ) {
                    return -1;
                }
                return 1;
            }
            if( !obj1.props[ sortByProp ] && obj2.props[ sortByProp ] ) {
                if( ascending ) {
                    return 1;
                }
                return -1;
            }
            if( !obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
                return 0;
            }

            let valueType;
            if( obj1.props[ sortByProp ].propertyDescriptor && obj1.props[ sortByProp ].propertyDescriptor.valueType ) {
                valueType = viewModelObjectSvc.getClientPropertyType( obj1.props[ sortByProp ].propertyDescriptor.valueType );
            }
            if( valueType === 'DATE' ) {
                const date1 = obj1.props[ sortByProp ].dbValue;
                const date2 = obj2.props[ sortByProp ].dbValue;
                return valueComparator( date1, date2, ascending );
            }
            if( valueType === 'DOUBLE' || valueType === 'INTEGER' ) {
                const num1 = parseFloat( obj1.props[ sortByProp ].uiValues[ 0 ] );
                const num2 = parseFloat( obj2.props[ sortByProp ].uiValues[ 0 ] );
                return valueComparator( num1, num2, ascending );
            }
            const val1 = obj1.props[ sortByProp ].uiValues[ 0 ];
            const val2 = obj2.props[ sortByProp ].uiValues[ 0 ];
            return valueComparator( val1, val2, ascending );
        } );
    }
    return modelObjects;
}

/**
 *
 * @param {primitive} val1 - some value
 * @param {primitive} val2 - some value
 * @param {boolean} ascending - true if compare in ascending
 * @return {number} a number which states which value is bigger
 */
function valueComparator( val1, val2, ascending ) {
    if( ascending ) {
        if( val1 >= val2 ) {
            return 1;
        }
        return -1;
    }
    // here if we're in descending mode
    if( val1 <= val2 ) {
        return 1;
    }
    return -1;
}

/**
 * @param {Object[]} array1 - array of model objects
 * @param {Object[]} array2 - array of model objects
 * @return {Boolean} - true if arrays are identical. otherwize false
 */
 function doArraysContainSameValues( array1, array2 ) {
    if ( !Array.isArray( array1 ) || !Array.isArray( array2 ) ) {
        return false;
    }
    if ( array1.length !== array2.length ) {
        return false;
    }
    const array1Sorted = [ ...array1 ].sort( ( modelObj1, modelObj2 ) => modelObj1.uid < modelObj2.uid ? 1 : -1 );
    const array2Sorted = [ ...array2 ].sort( ( modelObj1, modelObj2 ) => modelObj1.uid < modelObj2.uid ? 1 : -1 );
    return array1Sorted.every( ( modelObj, index ) => modelObj.uid === array2Sorted[index].uid );
}

let exports = {};
export default exports = {
    getFoundationId,
    getMfgModelUid,
    sortModelObjectsByProp,
    doArraysContainSameValues,
    getFoundationIdFromUid
};
