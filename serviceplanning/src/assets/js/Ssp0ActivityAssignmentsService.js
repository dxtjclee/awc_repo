// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * List Activity Assignments related Service
 *
 * @module js/Ssp0ActivityAssignmentsService
 */

import { constants as timeAnalysisConstants } from 'js/ssp0TimeAnalysisConstants';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaService from 'soa/kernel/soaService';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';
import _ from 'lodash';

export function addAndRemoveActivityAssignments( activityList, originalActivityList, selectedActivity ) {
    var toAddAssignmentsList = [];
    var toRemoveAssignmentsList = [];
    activityList.forEach( function( vmo ) {
        if ( !originalActivityList.find( o => o.uid === vmo.uid ) ) {
            toAddAssignmentsList.push( vmo.uid );
        }
    } );
    originalActivityList.forEach( function( vmo ) {
        if ( !activityList.find( o => o.uid === vmo.uid ) ) {
            toRemoveAssignmentsList.push( vmo.uid );
        }
    } );

    if( toAddAssignmentsList.length > 0 || toRemoveAssignmentsList.length > 0 ) {
        let body = {
            saveInput: {
                sections: [
                    {
                        sectionName: 'ObjectsToModify',
                        dataEntries: []
                    }
                ]
            }
        };
        _addRelatedObjects( body, selectedActivity );
        if( toAddAssignmentsList.length > 0 ) {
            _addAssignmentEntries( body, 'Add', toAddAssignmentsList, selectedActivity.uid );
        }
        if( toRemoveAssignmentsList.length > 0 ) {
            _addAssignmentEntries( body, 'Remove', toRemoveAssignmentsList, selectedActivity.uid );
        }
        let promise = _saveData3SOA( body );
        promise.then( ( result ) => {
            if ( checkForErrors( result ) ) {
                msgSvc.showError( result.ServiceData.partialErrors[0].errorValues[0].message );
                return result;
            }
        } );
    }
}

let _addRelatedObjects = function( body, selectedVMO ) {
    if ( body.saveInput ) {
        if ( body.saveInput.relatedObjects === undefined ) {
            body.saveInput.relatedObjects = {};
        }
        body.saveInput.relatedObjects[selectedVMO.uid] = {
            uid: selectedVMO.uid,
            type: selectedVMO.type
        };
    }
};

let _addAssignmentEntries = function( body, entryType, assignmentsList, activityUid ) {
    let nameValueMap = {};
    nameValueMap[entryType] = assignmentsList;
    let entry = {
        entry: {
            Object: {
                nameToValuesMap: {
                    id: [ activityUid ]
                }
            },
            AssignedObjects: {
                nameToValuesMap: nameValueMap
            }
        }
    };

    body.saveInput.sections[0].dataEntries.push( entry );
};

let checkForErrors = function( result ) {
    return result.ServiceData.partialErrors && result.ServiceData.partialErrors.length > 0 && result.ServiceData.partialErrors[0] && result.ServiceData.partialErrors[0].errorValues;
};

let _saveData3SOA = function( body ) {
    return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', body );
};

export function addToActivityList( dataProviders, activityList ) {
    const selectedVMOs = dataProviders.fetchWorkCardAssignments.selectedObjects;
    var tempActivityList = activityList;
    selectedVMOs.forEach( function( vmo ) {
        if ( !tempActivityList.find( o => o.uid === vmo.uid ) ) {
            tempActivityList.push( vmo );
        }
    } );
    dataProviders.fetchWorkCardAssignments.selectNone();
    return tempActivityList;
}

export function removeFromActivityList( selectedObjects, activityList ) {
    const selectedVMOs = selectedObjects;
    var tempActivityList = activityList;
    tempActivityList = tempActivityList.filter( function( el ) {
        return !selectedVMOs.includes( el );
    } );
    return tempActivityList;
}

export function addAllToActivityList( dataProviders, activityList ) {
    var tempActivityList = dataProviders.fetchWorkCardAssignments.vmCollectionObj.vmCollection.loadedVMObjects;
    dataProviders.fetchWorkCardAssignments.selectNone();
    return tempActivityList;
}

export function removeAllFromActivityList() {
    return [];
}

export async function getRelatedObject( response ) {
    let modelObjects = response.modelObjects;
    let returnVMOs = [];
    let uids = [];
    var loadedText = localeSvc.getLoadedText( 'timeAnalysisMessages' );

    Object.values( modelObjects ).filter( modelObject => modelObject.props && ( modelObject.modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_EQUIPMENT_PROCESS )
        || modelObject.modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_PART_PROCESS ) ||
        modelObject.modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_SKILL ) ) ).forEach(
        modelObject => {
            uids.push( modelObject.uid );
        } );
    if( uids.length > 0 ) {
        await dmSvc.getProperties( uids, [ 'object_name', 'bl_occ_type' ] ).then( function() {
            uids.forEach( uid =>{
                let modelObject1 = cdm.getObject( uid );
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObject1, 'Edit' );
                var prop = {};
                prop.key = loadedText.OccurrenceType;
                prop.value = modelObject1.props.bl_occ_type.dbValues[0];
                vmo.cellProperties[ prop.key ] = prop;
                returnVMOs.push( vmo );
            } );
        } );
    }

    return returnVMOs;
}

export default {
    addToActivityList,
    addAllToActivityList,
    removeFromActivityList,
    removeAllFromActivityList,
    getRelatedObject,
    addAndRemoveActivityAssignments
};
