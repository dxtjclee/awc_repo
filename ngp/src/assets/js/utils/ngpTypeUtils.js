// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import ngpConstants from 'js/constants/ngpModelConstants';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import cdm from 'soa/kernel/clientDataModel';
import ngpModelConstants from 'js/constants/ngpModelConstants';

/**
 * Utility to check mfg_ngp object type
 *
 * @module js/utils/ngpTypeUtils
 */
'use strict';

const NGP_BASE_OBJECT_TYPES = [
    ngpConstants.BOP_ELEMENT, ngpConstants.MANUFACTURING_ELEMENT_TYPE
];

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {boolean} true if the given modelO
 * bject is an NGP object we should navigate to
 */
export function isNGPObject( modelObject ) {
    return mfeTypeUtils.isOfTypes( modelObject, NGP_BASE_OBJECT_TYPES );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a process element
 */
export function isProcessElement( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.PROCESS_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is an operation
 */
export function isOperation( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.OPERATION_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is an activity
 */
export function isActivity( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.ACTIVITY_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a build element
 */
export function isBuildElement( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.BUILD_ELEMENT_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a planing scope (build element or activity)
 */
 export function isPlanningScope( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.PLANNING_SCOPE_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a plan element (process or operation)
 */
 export function isPlanElement( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.PLAN_ELEMENT_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a manufacturing element
 */
export function isManufacturingElement( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.MANUFACTURING_ELEMENT_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is an attribute group
 */
export function isAttributeGroup( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.AG_TYPE );
}

/**
 * @param {modelObject} modelObject - a given model object
 * @return {boolean} true if the given object is a class library
 */
export function isClassLibrary( modelObject ) {
    if( modelObject && modelObject.props[ ngpPropConstants.MANUFACTURING_MODEL ] ) {
        const mfgModelUid = modelObject.props[ ngpPropConstants.MANUFACTURING_MODEL ].dbValues[ 0 ];
        const mfgModelObj = cdm.getObject( mfgModelUid );
        if( mfgModelObj ) {
            const isClassLibrary = mfgModelObj.props[ ngpPropConstants.IS_CLASS_LIBRARY ].uiValues[ 0 ];
            return isClassLibrary.toLowerCase() === 'true';
        }
    }
    return false;
}

/**
 * @param {modelObject} modelObj - a given model object
 * @return {boolean} true if the given object is a RT Design Element or Design Feature
 */
 export function isAssignableObject( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.DESIGN_FEATURE ) || mfeTypeUtils.isOfType( modelObj, ngpConstants.DESIGN_ELEMENT );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a partition
 */
 export function isPartition( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.PARTITION_TYPE );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a build element
 */
 export function isDesignElement( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.DESIGN_ELEMENT );
}

/**
 * @param {object} modelObj - a given model object
 * @return {boolean} true if the given object is a build element
 */
 export function isDesignFeature( modelObj ) {
    return mfeTypeUtils.isOfType( modelObj, ngpConstants.DESIGN_FEATURE );
}
/**
 * return the element ID
 *
 * @param {ModelObject} element - the Model Object for which to get the ID
 * @returns {String} The ID of the element
 */
 export function getProductElementID( element ) {
    if( mfeTypeUtils.isOfType( element, ngpModelConstants.DESIGN_ELEMENT ) ) {
        return element.props[ngpPropConstants.DESIGN_ELEMENT_ID].dbValues[ 0 ];
    }
    if( mfeTypeUtils.isOfType( element, ngpModelConstants.DESIGN_FEATURE ) ) {
        return element.props[ngpPropConstants.DESIGN_FEATURE_ID].dbValues[ 0 ];
    }
    return '';
}


export default {
    isNGPObject,
    isProcessElement,
    isOperation,
    isActivity,
    isBuildElement,
    isManufacturingElement,
    isAttributeGroup,
    isClassLibrary,
    isAssignableObject,
    isPlanningScope,
    isPlanElement,
    isPartition,
    getProductElementID,
    isDesignElement,
    isDesignFeature
};
