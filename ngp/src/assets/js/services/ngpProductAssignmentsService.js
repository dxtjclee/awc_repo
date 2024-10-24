// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import ngpLoadService from 'js/services/ngpLoadService';
import ngpClientRequiredInfoSvc from 'js/services/ngpClientRequiredInfoService';
const ASSIGNMENT_TYPE = 'AssignmentType';

/**
 * NGP Product Assignments service
 *
 * @module js/services/ngpProductAssignmentsService
 */
'use strict';

/**
 *
 * @param {ModelObject} modelObject - the model object
 * @param {String[]} typesToInclude - array of types to include
 * @param {Integer} pageSize - page size
 * @param {Object} dataProvider - the data provider object
 * @param {Object[]} clientColumns - the column config object
 * @returns {ModelObject[]} - an array of the assigned parts vmos
 */
export function getAssignments( modelObject, typesToInclude, pageSize, dataProvider, clientColumns ) {
    if ( !modelObject ) {
        return new Promise( ( resolve ) => resolve( [] ) );
    }
    const clientRequiredInfo = getClientRequiredStrings( dataProvider, clientColumns );
    const soaInput = {
        input:[ {
            context: modelObject,
            searchOptions:{
                pageSize
            },
            filterCriteria: [ {
                filterName: 'TypesToIncludeFilter',
                filterValues: typesToInclude
            } ],
            clientRequiredInformation: clientRequiredInfo
        } ]
    };
    return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getAssignmentData', soaInput ).then(
        ( result ) => {
            if ( result.output[0].assignedObjects ) {
                const clientRequiredInfoResponse = result.output[0].assignObjClientRequiredInfo;
                const assignedObjects = [];
                result.output[0].assignedObjects.forEach( ( assignedObject, index ) => {
                    const assignmentTypes = ngpClientRequiredInfoSvc.getAssignmentTypes( clientRequiredInfoResponse[index] );
                    if( assignmentTypes.length > 0 ) {
                        //there could be multiple purposes for any assigned object
                        assignmentTypes.forEach( ( assignmentType ) => {
                            const assignedObjVmo = createVmoWithConcatinatedUid( assignedObject, assignmentType.uid );
                            assignedObjects.push( assignedObjVmo );
                            ngpClientRequiredInfoSvc.createClientRequiredInfoProps( assignedObjVmo, clientRequiredInfoResponse[index] );
                        } );
                    } else {
                        const assignedObjVmo = viewModelObjectSvc.createViewModelObject( assignedObject );
                        assignedObjects.push( assignedObjVmo );
                        ngpClientRequiredInfoSvc.createClientRequiredInfoProps( assignedObjVmo, clientRequiredInfoResponse[index] );
                    }
                } );
                return assignedObjects;
            }
            return [];
        }
    );
}

/**
 *
 * @param {object} dataProvider - the dataprovider object
 * @param {object[]} clientColumns - an array of column objects
 * @returns {string[]} an intersection between the dataprovider columns and the client columns
 */
function getClientRequiredStrings( dataProvider, clientColumns ) {
    const clientRequiredInfo = ngpClientRequiredInfoSvc.getClientRequiredColumnsInTable( dataProvider, clientColumns );
    if( clientRequiredInfo.indexOf( ASSIGNMENT_TYPE ) === -1 ) {
        clientRequiredInfo.push( ASSIGNMENT_TYPE );
    }
    return clientRequiredInfo;
}

/**
 *
 * @param {ModelObject} contextObject - the context object
 * @param {Object} dataProvider - the data provider object
 * @param {[Object]} columns - the column config object
 * @param {[ModelObject]} modelObjects - a given set of model objects
 * @returns {promise} a promise
 */
export function refreshObjects( contextObject, dataProvider, columns, modelObjects ) {
    const promiseArray = [];
    const clientRequiredInfo = ngpClientRequiredInfoSvc.getClientRequiredinfo( dataProvider, columns );
    const soaInput = {
        input:[
            {
                context: contextObject,
                clientRequiredInformation: clientRequiredInfo,
                updatedObjects: modelObjects
            }
        ]
    };
    promiseArray.push( ngpLoadService.refreshObjects( modelObjects ) );
    promiseArray.push( ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getClientRequiredInfo', soaInput ) );
    return Promise.all( promiseArray );
}

/**
 * @param {ModelObject} modelObject - a given model object
 * @param {String} assignmentTypeUid - assignment Type to concatinate with the uid
 * @returns {vmo} a vmo with the concatinated uid
 */
function createVmoWithConcatinatedUid( modelObject, assignmentTypeUid ) {
    const vmo = viewModelObjectSvc.createViewModelObject( modelObject );
    vmo.uid = `${vmo.uid}ngp@#$${assignmentTypeUid}`;
    vmo.getOriginalUid = () => modelObject.uid;
    vmo.getAssignmentTypeUid = () => assignmentTypeUid;
    return vmo;
}

let exports = {};
export default exports = {
    getAssignments,
    refreshObjects
};
