// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epBvrObjectService
 */
import _ from 'lodash';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import cdm from 'soa/kernel/clientDataModel';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';

/**
 * gets the related model objects array by given propery of object.
 */
export const getRelatedObjects = function( modelObject, propertyName ) {
    if ( modelObject && propertyName ) {
        let relatedObjs = [];
        let parentProps = modelObject.props;
        let relatedIDs;
        if( parentProps && parentProps[ propertyName ] ) {
            relatedIDs = parentProps[ propertyName ].dbValues;
            relatedIDs.map( id => id && relatedObjs.push( cdm.getObject( id ) ) );
        }
        return relatedObjs;
    }
};

/**
 * If the given object is an operation, we should either get the Process Resource that it's allocated to, or the parent station if there's no PR.
 *
 * @param {*} operation the object
 * @returns {Object} the parent
 */
export function getProcessResourceOrStationParent( operation ) {
//for operation or process that is created under the process that is under the PR, return process as a parent despite it has Mfg0processResource as a PR
    let parentObj = getParent( operation );
    if( parentObj && mfeTypeUtils.isOfType( parentObj, epBvrConstants.MFG_BVR_PROCESS ) ) {
        return parentObj;
    }
    if( operation &&
    ( mfeTypeUtils.isOfType( operation, epBvrConstants.MFG_BVR_OPERATION ) || mfeTypeUtils.isOfType( operation, epBvrConstants.MFG_BVR_PROCESS ) ) &&
    operation.props &&
    operation.props.Mfg0processResource &&
    operation.props.Mfg0processResource.dbValues &&
    operation.props.Mfg0processResource.dbValues[ 0 ] &&
    operation.props.Mfg0processResource.dbValues[ 0 ].length > 0 ) {
        return cdm.getObject( operation.props.Mfg0processResource.dbValues[ 0 ] );
    }
    // else just return the bl_parent property
    return parentObj;
}

/**
 *
 * @param {Object} modelObject Parent Obj
 * @param {String} childPropertyName  Property Name
 */
export const getSequencedChildren = function( modelObject, childPropertyName ) {
    let children = getRelatedObjects( modelObject, childPropertyName );
    if( children ) {
        children.sort( function( object1, object2 ) {
            const bl_sequence_no_obj1 = object1.props[ epBvrConstants.BL_SEQUENCE_NO ] ? Number( object1.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[0] ) : 0;
            const bl_sequence_no_obj2 = object2.props[ epBvrConstants.BL_SEQUENCE_NO ] ? Number( object2.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[0] ) : 0;
            return bl_sequence_no_obj1 - bl_sequence_no_obj2;
        } );
    }
    return children;
};
/**
 * Get parent uid of the object
 * @param {Object} object object of which parent object needs to be fetched
 * @returns {Object} uid of the parent object of the given object
 */
export const getParent = function( object ) {
    return object && object.props && object.props[ epBvrConstants.BL_PARENT ] && !_.isEmpty( object.props[ epBvrConstants.BL_PARENT ].dbValues ) &&
         cdm.getObject( object.props[ epBvrConstants.BL_PARENT ].dbValues[ 0 ] );
};

/**
 * Get parent Uids
 *
 * @param {object} objectToSelect : object to select
 * @param {String} parentProperty property of parent
 * @return {Array} parent objects Uids of selected object in the hierarchy
 */
function getParentUids( objectToSelect, parentProperty ) {
    const parentHierarchy = [];
    let parentUid =  getProcessResourceOrStationParent(objectToSelect)?.uid;

    while( parentUid ) {
        parentHierarchy.push( parentUid );
        objectToSelect = cdm.getObject( parentUid );
        parentUid = objectToSelect.props[ parentProperty ] && objectToSelect.props[ parentProperty ].dbValues[ 0 ];
    }
    return parentHierarchy;
}

export default {
    getParent,
    getRelatedObjects,
    getSequencedChildren,
    getProcessResourceOrStationParent,
    getParentUids
};
