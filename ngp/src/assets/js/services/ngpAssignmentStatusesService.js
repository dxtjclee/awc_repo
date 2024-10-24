// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpClientRequiredInfoConstants from 'js/constants/ngpClientRequiredInfoConstants';
import ngpVmoPropSvc from 'js/services/ngpViewModelPropertyService';

/**
 * NGP Assignment Statuses Service
 *
 * @module js/services/ngpAssignmentStatusesService
 */
'use strict';

const assignmentStatusConstants = {
    ASSIGNED_TO_BE_OR_ACTIVITY: 'ASSIGNED_TO_BE_OR_ACTIVITY',
    ASSIGNED_TO_BE_OR_ACTIVITY_MULTIPLE_TIMES: 'ASSIGNED_TO_BE_OR_ACTIVITY_MULTIPLE_TIMES',
    CONSUMED_TO_PROCESS: 'CONSUMED_TO_PROCESS',
    CONSUMED_TO_PROCESS_MULTIPLE_TIMES: 'CONSUMED_TO_PROCESS_MULTIPLE_TIMES',
    CONSUMED_TO_PROCESS_AND_ASSIGNED_TO_BE_OR_ACT: 'CONSUMED_TO_PROCESS_AND_ASSIGNED_TO_BE_OR_ACT',
    NO_STATE: 'NO_STATE'
};

const clientRequiredInformation = [
    ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INCURRENTSCOPE,
    ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INOTHERSCOPE,
    ngpClientRequiredInfoConstants.ASSIGNEDTO_ACTIVITIES_INCURRENTSCOPE,
    ngpClientRequiredInfoConstants.ASSIGNEDTO_ACTIVITIES_INOTHERSCOPE,
    ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INCURRENTSCOPE,
    ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INOTHERSCOPE
];


/**
 * @param {modelObject[]} assignmentObjects - a given array of assignment modelObjects
 * @param {Object[]} assignmentObjectsInfos - array of client required infos
 * @param {modelObject[]} childTreeNodes - ViewModelTreeNode objects
 */
export function setAssignmentStatuses( assignmentObjects, assignmentObjectsInfos, childTreeNodes ) {
    assignmentObjects.forEach( ( object, index ) => {
        const assignmentTreeObject = childTreeNodes.find( node => node.uid === object.uid );
        if( assignmentTreeObject ) {
            setNodeAssignmentData( assignmentTreeObject, assignmentObjectsInfos[ index ].tagArrayInfo );
        }
    } );
}

/**
 * @param {object} tagArrayInfo - an object that contains 6 arrays of possible assignedTo objects
 * @return {string} - a string which presents the assignment status of the assigned object
 */
export function getAssignmentStatus( tagArrayInfo ) {
    const numberOfProcessAssignments = tagArrayInfo.AssignedToProcessesInCurrentScope.length + tagArrayInfo.AssignedToProcessesInOtherScope.length;
    const numberOfBeAndActAssignments = tagArrayInfo.AssignedToBuildElementsInCurrentScope.length +
        tagArrayInfo.AssignedToBuildElementsInOtherScope.length + tagArrayInfo.AssignedToActivitiesInCurrentScope.length +
        tagArrayInfo.AssignedToActivitiesInOtherScope.length;

     if ( numberOfProcessAssignments === 0 ) {
        if ( numberOfBeAndActAssignments === 0 ) {
            return assignmentStatusConstants.NO_STATE;
        } else if ( numberOfBeAndActAssignments === 1 ) {
            return assignmentStatusConstants.ASSIGNED_TO_BE_OR_ACTIVITY;
        }
            return assignmentStatusConstants.ASSIGNED_TO_BE_OR_ACTIVITY_MULTIPLE_TIMES;
     }

     if ( numberOfProcessAssignments > 1 ) {
        return assignmentStatusConstants.CONSUMED_TO_PROCESS_MULTIPLE_TIMES;
     }

     if ( numberOfProcessAssignments === 1 ) {
        if ( numberOfBeAndActAssignments === 0 ) {
            return assignmentStatusConstants.CONSUMED_TO_PROCESS;
        }
        return assignmentStatusConstants.CONSUMED_TO_PROCESS_AND_ASSIGNED_TO_BE_OR_ACT;
     }
}

/**
 * @param {modelObject} vmo - tree node object
 * @param {modelObject[]} tagArrayInfo - structure arrays of objects where our vmo is assigned
 */
export function setNodeAssignmentData( vmo, tagArrayInfo ) {
    const status = getAssignmentStatus( tagArrayInfo );
    vmo.props.assignmentIndication = ngpVmoPropSvc.createStringViewModelProperty( 'assignmentIndication', status, vmo );
    vmo.assignment_array = tagArrayInfo;
}

let exports;
export default exports = {
    setAssignmentStatuses,
    getAssignmentStatus,
    setNodeAssignmentData,
    assignmentStatusConstants,
    clientRequiredInformation
};
