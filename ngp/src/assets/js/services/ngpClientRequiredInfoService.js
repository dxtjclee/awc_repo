// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpPropConstats from 'js/constants/ngpPropertyConstants';
import { PROPERTY_NAMES } from 'js/services/ngpAssignmentMismatchOrMissingService';
import { TABLE_COLUMNS } from 'js/services/ngpTableService';
import vmoSvc from 'js/viewModelObjectService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

/**
 * NGP ngp Client Required Info Service
 *
 * @module js/services/ngpClientRequiredInfoService
 */
'use strict';

/**
 * @param {modelObject} contextObject - the context object
 * @param {modelObject[]} objects - a given array of assignment modelObjects
 * @param {String[]} clientRequiredInfo - array of client required info values
 * @return {Promise} - a promise
 */
 export function getClientRequiredInfo( contextObject, objects, clientRequiredInfo ) {
    if ( objects.length === 0 ) {
        return new Promise( ( res ) => res() );
    }
    const soaInput = {
        input:[
            {
                context: contextObject,
                clientRequiredInformation: clientRequiredInfo,
                updatedObjects: objects
            }
        ]
    };

    return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getClientRequiredInfo', soaInput ).then(
        ( result ) => ( {
            objects: result.output[0].objectClientRequiredInfoMap[0],
            objectsInfos: result.output[0].objectClientRequiredInfoMap[1]
        } )
    );
}

/**
 * A map of response types to the props
 */
const CLIENT_REQUIRED_RESPONSE_TO_PROPS = {
    tagArrayInfo: {
        AssignmentType: {
            createProperty: function( vmo ) {
                let value = '';
                if( vmo.getAssignmentTypeUid ) {
                    const assignmentTypeUid = vmo.getAssignmentTypeUid();
                    let assignmentTypeObj = cmm.getType( assignmentTypeUid );
                    if( assignmentTypeObj ) {
                        value = assignmentTypeObj.displayName;
                    } else {
                        assignmentTypeObj = cdm.getObject( assignmentTypeUid );
                        value = assignmentTypeObj.props[ngpPropConstats.OBJECT_STRING].uiValues[0];
                    }
                }
                const propObj = {
                    displayValue: value,
                    propType: 'STRING'
                };
                vmo.props.AssignmentType =  vmoSvc.constructViewModelProperty( propObj, 'AssignmentType', vmo, false );
                vmo.props.AssignmentType.uiValue = vmo.props.AssignmentType.uiValues;
            }
        },
        AssignedToProcess: {
            createProperty: function( vmo, value ) {
                const propObj = {
                    displayValue: value,
                    value,
                    propType: 'OBJECTARRAY'
                };
                vmo.props.AssignedToProcess = vmoSvc.constructViewModelProperty( propObj, 'AssignedToProcess', vmo, false );
            }
        },
        AssignedToOperation:{
            createProperty: function( vmo, value ) {
                const propObj = {
                    displayValue: value,
                    value,
                    propType: 'OBJECTARRAY'
                };
                vmo.props.AssignedToOperation = vmoSvc.constructViewModelProperty( propObj, 'AssignedToOperation', vmo, false );
            }
        },
        UsedInActivity:{
            createProperty: function( vmo, value ) {
                const propObj = {
                    displayValue: value,
                    value,
                    propType: 'OBJECTARRAY'
                };
                vmo.props.UsedInActivity = vmoSvc.constructViewModelProperty( propObj, 'UsedInActivity', vmo, false );
            }
        }
    },
    stringInfo: {
        MismatchStatus:{
            createProperty: function( vmo, value ) {
                const propObj = {
                    displayValue: value,
                    value,
                    propType: 'STRING'
                };
                vmo.props.MismatchStatus = vmoSvc.constructViewModelProperty( propObj, 'MismatchStatus', vmo, false );
            }
        },
        MissingInSource:{
            createProperty: function( vmo, value ) {
                const propObj = {
                    displayValue: value,
                    value,
                    propType: 'STRING'
                };
                vmo.props.MissingInSource = vmoSvc.constructViewModelProperty( propObj, 'MissingInSource', vmo, false );
            }
        }
    },
    tagToTagVectorMapInfo: {
        AssignmentInContextAttributeGroups:{
            createProperty: function( vmo, value ) {
                let ags = [];
                if( value.tagToTagVectorMap ) {
                    const assignmentTypeToAgs = value.tagToTagVectorMap;
                    const assignmentTypeUid = vmo.getAssignmentTypeUid();
                    const index = _.findIndex( assignmentTypeToAgs[0], ( modelObj ) => modelObj.modelType.uid === assignmentTypeUid );
                    ags = assignmentTypeToAgs[1][index];
                }
                const propObj = {
                    displayValue: ags,
                    value: ags,
                    propType: 'STRING'
                };
                vmo.props.AssignmentInContextAttributeGroups = vmoSvc.constructViewModelProperty( propObj, 'AssignmentInContextAttributeGroups', vmo, false );
            }
        }
    }
};

/**
  *
  * @param {Object} dataProvider - the data provider object
  * @param {Object[]} clientColumns - the column config object
  * @return {String[]} the client required columns
  */
export function getClientRequiredColumnsInTable( dataProvider, clientColumns ) {
    const currentTableColumns = dataProvider.columnConfig.columns.map( ( column ) => column.propertyName );
    const possibleClientColumns = clientColumns.map( ( column ) => column.propertyName );
    const neededClientInfo = currentTableColumns.filter( ( name ) => possibleClientColumns.indexOf( name ) > -1 );
    const index = neededClientInfo.indexOf( TABLE_COLUMNS.MISMATCH_OR_MISSING );
    if( index > -1 ) {
        neededClientInfo.splice( index, 1 );
        neededClientInfo.push( PROPERTY_NAMES.DESIGN_ELEMENT_OR_FEATURE_MISMATCH_PROP, PROPERTY_NAMES.DESIGN_ELEMENT_OR_FEATURE_MISSING_PROP );
    }
    return neededClientInfo;
}

/**
 *
 * @param {object} clientRequiredInfoObject - the
 * @returns {string[]} the assignment types array
 */
export function getAssignmentTypes( clientRequiredInfoObject ) {
    if( clientRequiredInfoObject ) {
        return clientRequiredInfoObject.tagArrayInfo.AssignmentType;
    }
    return [];
}

/**
 *
 * @param {viewModelObject} vmo - a given viewModelObject
 * @param {object} clientRequiredInfoOfVmo - the clientRequiredInfo object
 */
export function createClientRequiredInfoProps( vmo, clientRequiredInfoOfVmo ) {
    Object.keys( CLIENT_REQUIRED_RESPONSE_TO_PROPS ).forEach(
        ( responseType ) => {
            if( clientRequiredInfoOfVmo[responseType] ) {
                Object.keys( clientRequiredInfoOfVmo[responseType] ).forEach(
                    ( prop ) => CLIENT_REQUIRED_RESPONSE_TO_PROPS[responseType][prop] &&
                        CLIENT_REQUIRED_RESPONSE_TO_PROPS[responseType][prop].createProperty( vmo, clientRequiredInfoOfVmo[responseType][prop] )
                );
            }
        }
    );
}

let exports = {};
export default exports = {
    getClientRequiredInfo,
    getClientRequiredColumnsInTable,
    getAssignmentTypes,
    createClientRequiredInfoProps
};
