// Copyright (c) 2023 Siemens

/**
 * @module js/Ssp0AssignOwnerService
 */
import _ from 'lodash';
import adapterSvc from 'js/adapterService';

var exports = {};

/**
 * Do the changeOwnership call to transfer the owner
 * @param {Array} selectedObjects - selected objects
 * @param {Array} selectedUserObject - selected users
 * @returns {Array} soaInput - Input for SOA
 */
export let getChangeOwnerInput = function( selectedObjects, selectedUserObject ) {
    // Check if selectedUserObject is null or undefined then no need to process further
    // and return from here
    if( !selectedUserObject || selectedUserObject.length <= 0 ) {
        return;
    }

    let soaInput = [];
    let groupCriteria = {};
    let objectCriteria = {};
    let ownerCriteria = {};
    let inputCriteria = {};

    let selectedObjFrompanel = selectedUserObject[ 0 ];
    if( selectedObjFrompanel && selectedObjFrompanel.props && selectedObjFrompanel.props.user ) {
        ownerCriteria = {
            uid: selectedObjFrompanel.props.user.dbValues[ 0 ],
            type: 'User'
        };
    }

    if( selectedObjFrompanel && selectedObjFrompanel.props && selectedObjFrompanel.props.group ) {
        groupCriteria = {
            uid: selectedObjFrompanel.props.group.dbValues[ 0 ],
            type: 'Group'
        };
    }

    let adaptedObjects = [];
    adaptedObjects = adapterSvc.getAdaptedObjectsSync( selectedObjects );

    if( adaptedObjects && adaptedObjects.length > 0 ) {
        _.forEach( adaptedObjects, function( adaptedObject ) {
            if( adaptedObject && adaptedObject.uid && adaptedObject.type ) {
                objectCriteria = {
                    uid: adaptedObject.uid,
                    type: adaptedObject.type
                };
            }

            inputCriteria = {
                group: groupCriteria,
                object: objectCriteria,
                owner: ownerCriteria
            };

            soaInput.push( inputCriteria );
        } );
    }
    return soaInput;
};

exports = {
    getChangeOwnerInput
};

export default exports;
