// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/Saw1AssignTaskDeliverableService
 */

import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import smConstants from 'js/ScheduleManagerConstants';
import soa_dataManagementService from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';


var exports = {};

/**
 * Is file format of text type
 *
 * @param {Object} addPanelState - atomic data needed to get access to creationType, createdObject information from sub components
 * @return {Object} true if file format is TEXT, else false, referenceName and file name
 */
export let getDatasetFileInfos = function( addPanelState ) {
    let fileType = addPanelState.datasetVMO.props.datasetType.uiValue;
    let isTextFile = fileType && fileType.toLowerCase() === 'text';
    let  namedReferenceName = addPanelState.references[0].propInternalValue.referenceName;
    let file = addPanelState.datasetVMO.props.datasetName.dbValue;
    let fileExt = addPanelState.references[0].propInternalValue.fileExtension;
    let ext = fileExt.split( '*' ).pop();
    let fileName = file.concat( ext );

    return {
        isTextFile: isTextFile,
        namedReferenceName: namedReferenceName,
        fileName: fileName
    };
};

/**
 * Check Schedule Deliverable Name of the Deliverable to be added
 *
 * @param {Object} data - The qualified data of the viewModel
 * @param {Object} creationType - newly created object
 * @param {Object} sourceObj - searched object
 * @param {Object} subPanelContext - subPanelContext to get selected element from open object.
 * @return {Promise} Promise
 */
export let checkSchDeliverableName = ( data, creationType, sourceObj, subPanelContext ) => {
    var createType;
    var taskDelProps;
    if( !_.isEmpty( creationType ) ) {
        if( creationType.props.type_name ) {
            createType = creationType.props.type_name.dbValues[ 0 ];
        }
        taskDelProps = addObjectUtils.getObjCreateEditableProperties( createType, 'CREATE', [ 'object_name' ] );
    }

    var schedulesList = [];
    let selectionData = subPanelContext.selectionData ? subPanelContext.selectionData.getValue() : null;
    if( !_.isEmpty( selectionData ) ) {
        for( var i = 0; i < subPanelContext.selectionData.selected.length; i++ ) {
            schedulesList.push( subPanelContext.selectionData.selected[ i ].props.schedule_tag.dbValues[ '0' ] );
        }
    }

    var deferred = AwPromiseService.instance.defer();

    soa_dataManagementService.getProperties( schedulesList, [ 'schedule_deliverable_list' ] ).then( function() {
        var deliverableUiValues = [];
        for( var j = 0; j < schedulesList.length; j++ ) {
            var schedule = cdm.getObject( schedulesList[ j ] );
            deliverableUiValues.push( schedule.props.schedule_deliverable_list.uiValues );
        }

        deliverableUiValues.forEach( function( deliverableUiValue ) {
            var computedDelObjName;
            if( !_.isEmpty( taskDelProps ) ) {
                computedDelObjName = 'sd_' + taskDelProps.object_name.dbValue;
            } else if( !_.isEmpty( sourceObj ) ) {
                computedDelObjName = 'sd_' + sourceObj[ 0 ].props.object_name.dbValue;
            }
            if(  computedDelObjName && deliverableUiValue === computedDelObjName  ) {
                deferred.reject( data.i18n.sameInstanceNameErrorMsg );
            }
        } );
        deferred.resolve();
    } );
    return deferred.promise;
};

/**
 * Return input for createMultipleTaskDeliverables SOA
 *
 * @param {Object} ctx - ctx from where Add Deliverable command is invoked
 * @param {Object} selectedTab - id of tab on the aw-add panel
 * @param {Object} sourceObjects - object selected on pallette/search tab
 * @param {Object} createdObject - object created from new tab
 * @param {Object} createdDataset - created dataset object
 * @return {Array} input structure for createMultipleTaskDeliverables SOA
 */
export let getCreateTaskDeliverablesInput = function( ctx, selectedTab, sourceObjects, createdObject, createdDataset ) {
    var input = [];
    var inputData;
    var deliverableNameOfObject;
    var schToTaskArrayMap = createScheduleToTasksArrayMap( ctx );
    let createdObj;
    for ( var schUid in schToTaskArrayMap ) {
        if ( selectedTab.view === 'NewTabPageSub' ) {
            if( createdObject ) {
                createdObj = createdObject;
            } else {
                createdObj = createdDataset;
            }
            deliverableNameOfObject = createdObj.props.object_name.dbValues[0];
            inputData = {
                schedule: cdm.getObject( schUid ),
                scheduleTasks: schToTaskArrayMap[schUid],
                submitType: 0,
                deliverableReference: createdObj,
                deliverableName: deliverableNameOfObject,
                deliverableType: createdObj.type
            };
            input.push( inputData );
        } else {
            for ( var secondObj in sourceObjects ) {
                if ( sourceObjects.hasOwnProperty( secondObj ) ) {
                    inputData = {
                        schedule: cdm.getObject( schUid ),
                        scheduleTasks: schToTaskArrayMap[schUid],
                        submitType: 0,
                        deliverableReference: sourceObjects[secondObj],
                        deliverableName: sourceObjects[secondObj].props.object_string.dbValues[0],
                        deliverableType: sourceObjects[secondObj].type
                    };
                    input.push( inputData );
                }
            }
        }
    }
    return input;
};

var createScheduleToTasksArrayMap = function( ctx ) {
    var scheduleToTasksArrayMap = {};
    var selection = ctx.mselected;
    for( var i = 0; i < selection.length; i++ ) {
        var selectedObj = selection[ i ];
        var scheduleUid = selectedObj.props.schedule_tag.dbValues[ 0 ];
        var taskArray = scheduleToTasksArrayMap[ scheduleUid ];
        if( !taskArray ) {
            taskArray = [];
        }
        taskArray.push( selectedObj );
        scheduleToTasksArrayMap[ scheduleUid ] = taskArray;
    }
    return scheduleToTasksArrayMap;
};

// Make includeType as comma separated string
export let populateValidIncludeTypes = function( data, ctx ) {
    var dataClone = _.clone( data );
    var prefValues = ctx.preferences.ScheduleDeliverableWSOTypes;

    var includeDataTypes = '';

    includeDataTypes = prefValues.join( ',' );

    dataClone.includeTypes = includeDataTypes;
    let isDatasetPresent = prefValues.indexOf( 'Dataset' ) > -1;
    return {
        includeTypes: dataClone.includeTypes,
        isDatasetPresent : isDatasetPresent
    };
};

/**
 * Method for invoking and registering/un-registering data for the Add Task Deliverable command panel
 *
 * @param {String} commandId - Command Id for the Add Task Deliverable command
 * @param {String} location - Location of the Add Task Deliverable command
 * @param {Object} commandContext - commandContext
 * @param {Boolean} isAllowMultiSchedule - Whether to allow multiple schedules or not
 */
export let addTaskDeliverablePanel = function( commandId, location, commandContext, isAllowMultiSchedule ) {
    let context = { selectedTasks: [] };
    if( commandContext.vmo ) {
        context.selectedTasks.push( commandContext.vmo );
    } else if( commandContext.selectionData ) {
        context.selectedTasks = commandContext.selectionData.selected;
    }
    var selection = context.selectedTasks;
    if( isAllowMultiSchedule === undefined || isAllowMultiSchedule === false ) {
        checkScheduleTags( selection );
    }
    if( selection ) {
        for( var i = 0; i < selection.length; i++ ) {
            var selectedObj = selection[ i ];
            if( selectedObj ) {
                var workflowProcess = selectedObj.props.workflow_process.dbValues[ 0 ];
                if( workflowProcess !== null && workflowProcess.length > 0 ) {
                    throw 'deliverableWorkflowError';
                }
                var taskType = selectedObj.props.task_type.dbValues[ 0 ];
                if( taskType !== smConstants.TASK_TYPE.T && taskType !== smConstants.TASK_TYPE.M &&
                    taskType !== smConstants.TASK_TYPE.G ) {
                    throw 'deliverableTaskTypeError';
                }
            }
        }
    }
    commandPanelService.activateCommandPanel( commandId, location, context );
};

/**
 * Check is selected object from same Schedule.
 *
 * @param {Array} selectedTasks - The list of selected task
 * @throw deliverableDiffSchError - if selected object are from different schedule.
 */
var checkScheduleTags = function( selectedTasks ) {
    if( selectedTasks && selectedTasks.length > 0 ) {
        var firstTaskSchUid = selectedTasks[ 0 ].props.schedule_tag.dbValues[ 0 ];
        for( var i = 1; i < selectedTasks.length; i++ ) {
            var schUid = selectedTasks[ i ].props.schedule_tag.dbValues[ 0 ];
            if( firstTaskSchUid !== schUid ) {
                throw 'deliverableDiffSchError';
            }
        }
    }
};

/**
 * Cleanup of atomic data while changing type selection
 * @param {String} fields - fields
 */
export let cleanUpOnTypeSelected = function( fields ) {
    let addPanelState = fields.addPanelState.getValue();
    let xrtState = fields.xrtState.getValue();

    if( addPanelState.datasetVMO && addPanelState.datasetVMO.props.datasetType.dbValue.type !== addPanelState.creationType.type ) {
        let newAddPanelState = {
            creationType : addPanelState.creationType,
            formData : '',
            isAddACopy : addPanelState.isAddACopy,
            isDatasetCreate : addPanelState.isDatasetCreate,
            selectedRelation: '',
            selectedTab: addPanelState.selectedTab,
            sourceObjects: addPanelState.sourceObjects
        };
        fields.addPanelState.update( newAddPanelState, {}, { markModified: true, runValidation: true } );
    }

    if( !_.isEmpty( xrtState ) ) {
        let newXrtState = {};
        fields.xrtState.update( newXrtState, {}, { markModified: true, runValidation: true } );
    }
};

exports = {
    getDatasetFileInfos,
    checkSchDeliverableName,
    getCreateTaskDeliverablesInput,
    populateValidIncludeTypes,
    addTaskDeliverablePanel,
    cleanUpOnTypeSelected
};

export default exports;
