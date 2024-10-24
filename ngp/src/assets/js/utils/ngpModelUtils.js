//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpConstants from 'js/constants/ngpModelConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpSoaSvc from 'js/services/ngpSoaService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import ngpLoadSvc from 'js/services/ngpLoadService';

/**
 * @module js/utils/ngpModelUtils
 */
'use strict';

/**
 * @param {modelObject} modelObject - the given modelObject
 * @return {boolean} true if the given object can be checked out
 */
export function isCheckoutable( modelObject ) {
    if( modelObject && modelObject.props[ ngpPropConstants.IS_CHECKOUTABLE ] ) {
        return modelObject.props[ ngpPropConstants.IS_CHECKOUTABLE ].uiValues[ 0 ].toLowerCase() === 'true' &&
            isModifiable( modelObject );
    }
    return false;
}

/**
 * @param {modelObject} modelObject - the given modelObject
 * @param {modelObject} userObj - the user object
 * @return {boolean} true if the given object is checked out by the current user
 */
export function isCheckedOutByCurrentUser( modelObject, userObj ) {
    if( modelObject && userObj && modelObject.props[ ngpPropConstants.CHECKED_OUT_USER ] ) {
        return userObj.props.uid === modelObject.props[ ngpPropConstants.CHECKED_OUT_USER ].dbValues[ 0 ];
    }
    return false;
}

/**
 * @param {modelObject} modelObject - the given modelObject
 * @return {boolean} true if the given object is modifiable
 */
export function isModifiable( modelObject ) {
    if( modelObject && modelObject.props[ ngpPropConstants.IS_MODIFIABLE ] ) {
        return modelObject.props[ ngpPropConstants.IS_MODIFIABLE ].uiValues[ 0 ].toLowerCase() === 'true';
    }
    return false;
}

/**
 * @param {modelObjects[]} modelObjects - the array of given modelObjects
 * @return {boolean} true if the all given objects are modifiable
 */
export function areAllModifiable( modelObjects ) {
    for( let index in modelObjects ) {
        if( !isModifiable( modelObjects[index] ) ) { return false; }
    }
    return true;
}


/**
 * @param {modelObject} modelObject - a given modelObject
 * @return {promise} a promise object
 */
export function checkOut( modelObject ) {
    return checkInOrCheckOut( modelObject, 'checkout' );
}

/**
 * @param {modelObject} modelObject - a given modelObject
 * @return {promise} a promise object
 */
export function checkIn( modelObject ) {
    return checkInOrCheckOut( modelObject, 'checkin' );
}

/**
 * @param {modelObject} modelObject - a given modelObject
 * @param {string} soaMethodName - the soa method that needs to be called
 * @return {promise} a promise object
 */
function checkInOrCheckOut( modelObject, soaMethodName ) {
    if( modelObject ) {
        const soaInput = {
            objects: [ modelObject ]
        };
        return ngpSoaSvc.executeSoa( 'Core-2006-03-Reservation', soaMethodName, soaInput );
    }
    return new Promise( ( resolve ) => {
        resolve( null );
    } );
}

/**
 * @param {modelObject} modelObject - a given modelObject
 * @return {boolean} true if the object is released
 */
export function isReleased( modelObject ) {
    if( modelObject ) {
        return Boolean( modelObject.props[ ngpPropConstants.LAST_RELEASE_STATUS ] && modelObject.props[ ngpPropConstants.LAST_RELEASE_STATUS ].dbValues[ 0 ] !== '' );
    }
    return false;
}

/**
 * @param {modelObject[]} modelObjects - a given array of modelObject
 * @return {Promise <map<uid,revstatus>>} true if the object is released
 */
export function getSiblingRevisionsStateForArrayOfObjects( modelObjects ) {
    const uidToSiblingRevisions = {};
    if( Array.isArray( modelObjects ) && modelObjects.length > 0 ) {
        const uids = modelObjects.map( ( object ) => object.uid );
        return dms.getProperties( uids, [ ngpPropConstants.SIBLING_REVISIONS ] ).then(
            (  ) => {
                modelObjects.forEach( ( object ) =>  {
                    uidToSiblingRevisions[ object.uid ] = Boolean( object.props[ ngpPropConstants.SIBLING_REVISIONS ] && object.props[ ngpPropConstants.SIBLING_REVISIONS ].dbValues.length > 1 );
                } );

                return uidToSiblingRevisions;
            }
        );
    }
    return new Promise( ( resolve ) => {
        resolve( null );
    } );
}

/**
 * @param {modelObject[]} modelObjects - a given array of modelObject
 * @return {Boolean}  - true if even one of the objects from the the modelObjects has more then one Revision
 */
export function isArrayOfObjectsHasMultipleRev( modelObjects ) {
    return getSiblingRevisionsStateForArrayOfObjects( modelObjects ).then(
        ( multipleRevisionsRes ) => {
            return modelObjects.some( ( candidate ) =>
                multipleRevisionsRes[candidate.uid] );
        }
    );
}

/**
 *
 * @param {modelObject} modelobject - a given modelObject
 * @return {String} the parent modelObject property name
 */
export function getParentPropertyName( modelobject ) {
    if( ngpTypeUtils.isProcessElement( modelobject ) || ngpTypeUtils.isManufacturingElement( modelobject ) ) {
        return ngpPropConstants.PARENT_OF_PROCESS_OR_ME;
    }
    if( ngpTypeUtils.isActivity( modelobject ) || ngpTypeUtils.isBuildElement( modelobject ) ) {
        return ngpPropConstants.PARENT_OF_ACTIVITY_OR_BE;
    }
    if( ngpTypeUtils.isOperation( modelobject ) ) {
        return ngpPropConstants.PARENT_OF_OPERATION;
    }
    if( ngpTypeUtils.isDesignElement( modelobject ) ) {
        return ngpPropConstants.DESIGN_ELEMENT_PARENT;
    }
    if( ngpTypeUtils.isDesignFeature( modelobject ) ) {
        return '';
    }
}

/**
 *
 * @param {String} objectBaseType - a given object type
 * @return {String} the parent modelObject property name
 */
 export function getParentPropertyNameByType( objectBaseType ) {
    if( objectBaseType === ngpConstants.PROCESS_TYPE || objectBaseType === ngpConstants.MANUFACTURING_ELEMENT_TYPE ) {
        return ngpPropConstants.PARENT_OF_PROCESS_OR_ME;
    }
    if( objectBaseType === ngpConstants.ACTIVITY_TYPE || objectBaseType === ngpConstants.BUILD_ELEMENT_TYPE ) {
        return ngpPropConstants.PARENT_OF_ACTIVITY_OR_BE;
    }
    if( objectBaseType === ngpConstants.OPERATION_TYPE ) {
        return ngpPropConstants.PARENT_OF_OPERATION;
    }
}

/**
 *
 * @param { modelObject } modelObject - a given modelObject
 * @return { String[] } an array of the children property names
 */
export function getChildrenProperties( modelObject ) {
    if( ngpTypeUtils.isActivity( modelObject ) ) {
        return [ ngpPropConstants.ACTIVITY_SUB_PROCESSES ];
    }
    if( ngpTypeUtils.isProcessElement( modelObject ) ) {
        return [ ngpPropConstants.PROCESS_SUB_OPERATIONS ];
    }
    if( ngpTypeUtils.isBuildElement( modelObject ) ) {
        return [ ngpPropConstants.BE_SUB_ACTIVITIES, ngpPropConstants.BE_SUB_BES ];
    }
    return [];
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {boolean} true if the given modelObject has content elements
 */
export function hasContentElements( modelObject ) {
    if( ngpTypeUtils.isActivity( modelObject ) ) {
        return modelObject.props[ ngpPropConstants.HAS_PROCESS_ELEMENTS ] && modelObject.props[ ngpPropConstants.HAS_PROCESS_ELEMENTS ].dbValues[ 0 ] === '1';
    }
    if( ngpTypeUtils.isProcessElement( modelObject ) ) {
        return modelObject.props[ ngpPropConstants.HAS_OPERATIONS ] && modelObject.props[ ngpPropConstants.HAS_OPERATIONS ].dbValues[ 0 ] === '1';
    }
    if( ngpTypeUtils.isBuildElement( modelObject ) ) {
        const hasSubBEs = modelObject.props[ ngpPropConstants.HAS_SUB_BUILD_ELEMENTS ] && modelObject.props[ ngpPropConstants.HAS_SUB_BUILD_ELEMENTS ].dbValues[ 0 ] === '1';
        const hasSubActivities = modelObject.props[ ngpPropConstants.HAS_ACTIVITIES ] && modelObject.props[ ngpPropConstants.HAS_ACTIVITIES ].dbValues[ 0 ] === '1';
        return hasSubBEs || hasSubActivities;
    }
    return false;
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {string[]} array of uids, closest ancestor first
 */
export function getAncestorUids( modelObject ) {
    const ancestors = [];
    if( modelObject ) {
        let current = modelObject;
        while( current ) {
            const parentProp = getParentPropertyName( current );

            const parentUid = current.props[ parentProp ] && current.props[ parentProp ].dbValues[ 0 ];
            if( parentUid ) {
                ancestors.push( parentUid );
                current = cdm.getObject( parentUid );
            } else {
                break;
            }
        }
    }
    return ancestors;
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {String} the parent modelObject property name
 */
export function getParentPropertyNameForParentObject( modelObject ) {
    if ( ngpTypeUtils.isActivity( modelObject ) ) {
        return ngpPropConstants.PARENT_OF_PROCESS_OR_ME;
    }
    if ( ngpTypeUtils.isProcessElement( modelObject ) ) {
        return ngpPropConstants.PARENT_OF_OPERATION;
    }
    if ( ngpTypeUtils.isBuildElement( modelObject ) ) {
        return ngpPropConstants.PARENT_OF_ACTIVITY_OR_BE;
    }
    return null;
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @param {modelObject[]} ancestors - an array of ancestor uids
 * @return {string[]} array of uids, closest ancestor first
 */
 export function getAncestorUidsAsync( modelObject, ancestors ) {
    if( modelObject ) {
        let current = modelObject;
        const parentProp = getParentPropertyName( current );
        return ngpLoadSvc.getPropertiesAndLoad( [ current.uid ], [ parentProp ] ).then( ()=> {
            const parentUid = current.props[ parentProp ] && current.props[ parentProp ].dbValues[ 0 ];
            if( parentUid ) {
                ancestors.push( parentUid );
                current = cdm.getObject( parentUid );
                return getAncestorUidsAsync( current, ancestors );
            }
            return ancestors;
        } );
    }
}


let exports;
export default exports = {
    isCheckedOutByCurrentUser,
    isModifiable,
    isCheckoutable,
    checkOut,
    checkIn,
    isReleased,
    getParentPropertyName,
    getParentPropertyNameByType,
    getChildrenProperties,
    hasContentElements,
    getAncestorUids,
    getAncestorUidsAsync,
    getSiblingRevisionsStateForArrayOfObjects,
    areAllModifiable,
    isArrayOfObjectsHasMultipleRev,
    getParentPropertyNameForParentObject
};
