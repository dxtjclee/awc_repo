// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';
import cmm from 'soa/kernel/clientMetaModel';
import lzstring from 'lz-string';

/**
 * NGP Product Assignments service
 *
 * @module js/services/ngpAssignmentTypeService
 */
'use strict';

const ASSIGNMENT_TYPE_INFORMATION_LS_KEY = 'ngpAssignmentTypeInfo';

/**
 * This method loads all of the assignment type information needed for the application.
 * @returns {promise<undefined>} - a promised resolved to undefined
 */
export function loadAssignmentTypeInfo() {
    const assignmentTypeInfo = localStorage.getItem( ASSIGNMENT_TYPE_INFORMATION_LS_KEY );
    if( assignmentTypeInfo ) {
        return new Promise( ( res ) => res() );
    }
    return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getAssignmentTypeInformation', {} ).then(
        ( response ) => {
            if( response.assignmentTypes ) {
                const assignmentTypeInfoMap = {};
                response.assignmentTypes.forEach( ( { assignToType, assigneeType, defaultAssignmentType, validAssignmentTypes } ) => {
                    if( !assignmentTypeInfoMap[assignToType.uid] ) {
                        assignmentTypeInfoMap[assignToType.uid] = {};
                    }
                    assignmentTypeInfoMap[assignToType.uid][assigneeType.uid] = {
                        defaultAssignmentTypeUid: defaultAssignmentType.uid,
                        validAssignmentTypeUids : validAssignmentTypes.map( ( validType ) => validType.uid )
                    };
                } );
                localStorage.setItem( ASSIGNMENT_TYPE_INFORMATION_LS_KEY, lzstring.compressToUTF16( JSON.stringify( assignmentTypeInfoMap ) ) );
            }
        }
    );
}

/**
 *
 * @param {modelObject} assignToModelObject - the modelObject we assign to
 * @param {modelObject} assigneeModelObject - the modelObject that we are assigning
 * @returns {modelType[]} array of modelTypes
 */
export function getValidAssignmentTypes( assignToModelObject, assigneeModelObject ) {
    if( assignToModelObject && assigneeModelObject ) {
        let assignmentTypeInfoMap = localStorage.getItem( ASSIGNMENT_TYPE_INFORMATION_LS_KEY );
        if( assignmentTypeInfoMap ) {
            assignmentTypeInfoMap = JSON.parse( lzstring.decompressFromUTF16( assignmentTypeInfoMap ) );
            const assignmentTypeInfo = assignmentTypeInfoMap[assignToModelObject.modelType.typeUid][assigneeModelObject.modelType.typeUid];
            if( assignmentTypeInfo ) {
                return assignmentTypeInfo.validAssignmentTypeUids.map( ( typeUid ) => cmm.getType( typeUid ) );
            }
        }
    }
    return [];
}


let exports = {};
export default exports = {
    loadAssignmentTypeInfo,
    getValidAssignmentTypes
};
