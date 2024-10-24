// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle common utility method execution only.
 *
 * @module js/createTaskService
 */
import selectionService from 'js/selection.service';
import uwPropertySvc from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import listBoxService from 'js/listBoxService';

var exports = {};
var createTaskData = {};
var isDefaultTargetRemoved = false;

export let doTaskPanelInit = function( data ) {
    var newSharedData = {};
    if( typeof data !== 'undefined' && typeof data.newSharedData !== 'undefined' ) {
        newSharedData = _.clone( data.sharedData );
    }
    isDefaultTargetRemoved = false;
    newSharedData.addedSourceObjects = [];
    newSharedData.addedUserObjects = [];
    newSharedData.activeView = 'tcxSimplifiedCreateDoTaskSub';
    return {
        sharedData: newSharedData
    };
};

export let openTaskAttachmentPanel = ( data, sharedData ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'tcxSimplifiedCreateTaskAttachmentSub';
    newSharedData.previousView = 'tcxSimplifiedCreateDoTaskSub';
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export const backToCreateTaskActionData = ( sharedData, data ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'tcxSimplifiedCreateDoTaskSub';
    newSharedData.previousView = 'tcxSimplifiedCreateTaskAttachmentSub';
    if( !_.isEmpty( data ) ) {
        newSharedData.addedSourceObjects = data.sharedData.addedSourceObjects;
        newSharedData.addedUserObjects = data.sharedData.addedUserObjects;
    } else {
        newSharedData.addedSourceObjects = sharedData.addedSourceObjects;
        newSharedData.addedUserObjects = sharedData.addedUserObjects;
    }

    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export let updateSharedDataWithTargets = function( sharedData, sourceObjects ) {
    var isDuplicateEntry = false;
    const newSharedData = { ...sharedData.value };
    if( sharedData.addedSourceObjects && sharedData.addedSourceObjects.length ) {
        for( var j = 0; j < sharedData.addedSourceObjects.length; j++ ) {
            if( sharedData.value.addedSourceObjects[ j ].uid === sourceObjects[ 0 ].uid ) {
                // Duplicate object added.
                isDuplicateEntry = true;
            }
        }
    }

    // In case of back navigation
    if( !sharedData.value.addedSourceObjects ) {
        sharedData.value.addedSourceObjects = [];
    }

    if( !isDuplicateEntry || sharedData.value.addedSourceObjects.length === 0 ) {
        newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects, ...sourceObjects ];
    }
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

/**
 * Remove given attachment from attachment list.
 *
 * @param {String} data - The view model data
 * @param {String} attachment - The attachment to be removed
 */
export let removeTargetAttachment = function( context ) {
    const localContext = { ...context };
    const newSharedData = localContext.createContext.sharedData.value;
    const targets = localContext.targetContextObject;
    const selectedObject = localContext.selectedObject;
    for( let j = 0; j < targets.modelObjects.length; j++ ) {
        if( targets.modelObjects[ j ].uid === selectedObject[ 0 ].uid ) {
            targets.modelObjects.splice( j, 1 );
        }
    }

    var targetUid;
    if( selectedObject[ 0 ].props.awb0UnderlyingObject ) {
        targetUid = selectedObject[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        targetUid = selectedObject[ 0 ].uid;
    }
    for( let j = 0; j < newSharedData.addedSourceObjects.length; j++ ) {
        if( newSharedData.addedSourceObjects[ j ].uid === targetUid ) {
            newSharedData.addedSourceObjects.splice( j, 1 );
        }
    }
    let defaultSelection = selectionService.getSelection().selected;

    var defaultSelectionUid;
    if( !_.isEmpty( defaultSelection ) ) {
        if( defaultSelection[ 0 ].props.awb0UnderlyingObject ) {
            defaultSelectionUid = defaultSelection[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ];
        } else {
            defaultSelectionUid = defaultSelection[ 0 ].uid;
        }
    } else {
        isDefaultTargetRemoved = true;
    }

    if( targetUid === defaultSelectionUid ) {
        isDefaultTargetRemoved = true;
    }
    context.update && context.update( localContext );
    eventBus.publish( 'createTask.reloadTargetDataProvider' );
};

/**
 * @param {*} taskName the existing task name
 * @param {*} selectedObj the selected object string
 * @returns {str} updated taskName
 */
export let setTaskName = function( taskName ) {
    var taskValue = selectionService.getSelection().selected;
    if( !_.isEmpty( taskValue ) &&
        ( appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:Location' ] !== 'com.siemens.splm.client.inbox.tasksLocation' &&
            taskValue[ 0 ].modelType.typeHierarchyArray.indexOf( 'Folder' ) === -1 || taskValue[ 0 ].modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) !== -1 ) ) {
        taskName.dbValue += taskValue[ 0 ].props.object_string.dbValues[ 0 ];
    } else {
        taskName.dbValue = '';
    }
    return taskName;
};

export let setCreateTaskState = function( taskName, priority, dueDate, description, sharedData ) {
    if( sharedData.value.previousView === 'tcxSimplifiedCreateTaskAttachmentSub' || sharedData.value.previousView === 'AwPeoplePicker' ) {
        taskName = createTaskData.taskName;
        priority = createTaskData.priority;
        dueDate = createTaskData.dueDate;
        description = createTaskData.description;
    }
    return {
        taskName,
        priority,
        dueDate,
        description
    };
};

/**
 * Return the input model object array UID array
 *
 * @param {Object} targetObjects Attached target objects
 * @return {StringArray} UID's string array
 */
export let getTargetUids = function( targetObjects, assignedUsers, subPanelContext, workflowTemplateProp ) {
    const localContext = { ...subPanelContext.value };
    var uids = [];
    var attachmentList = [];
    if( targetObjects && targetObjects.modelObjects && targetObjects.modelObjects.length > 0 ) {
        uids = _getAttachmentObjectUids( targetObjects.modelObjects, uids );
        attachmentList = uids.concat( attachmentList );
    }

    if( assignedUsers && assignedUsers.modelObjects && assignedUsers.modelObjects.length > 0 ) {
        var assignedUids = [];
        var members = null;
        var action = 0;
        var profiles = 'AAAAAAAAAAAAAA';
        var origins = 'AAAAAAAAAAAAAA';
        assignedUids = _getAttachmentObjectUids( assignedUsers.modelObjects, assignedUids );
        var taskTemplate = populateCreateTaskUid( workflowTemplateProp );
        var tasksInfo;
        for( let j = 0; j < assignedUids.length; j++ ) {
            members = assignedUids[ j ];

            tasksInfo = taskTemplate + ',{' + members + '},' + '{' + profiles + '}' + ',{' + action + '}' + ',{' + origins + '}';
            attachmentList.push( tasksInfo );
        }
    }

    return attachmentList;
};

/**
 * Return the attachment types
 *
 * @param {Object} targetObjects Attached target objects
 * @return {StringArray} attachment types
 */
export let getAttachmentTypes = function( targetObjects, assignedUsers ) {
    var attachmentTypes = [];
    if( targetObjects && targetObjects.modelObjects ) {
        for( var idx = 0; idx < targetObjects.modelObjects.length; idx++ ) {
            attachmentTypes.push( 1 );
        }
    }

    if( assignedUsers && assignedUsers.modelObjects ) {
        for( var idx = 0; idx < assignedUsers.modelObjects.length; idx++ ) {
            attachmentTypes.push( 200 );
        }
    }

    return attachmentTypes;
};

/**
 * Populate the Uids that need to be added as attachments.
 *
 * @param {Array} modelObjects Model objects that need to be added
 * @param {Array} uidList Uid list that will be added as attachment
 * @returns {Array} Final Uids array that will be added as attachment.
 */
var _getAttachmentObjectUids = function( modelObjects, uidList ) {
    var uids = _.clone( uidList );
    if( modelObjects && !_.isEmpty( modelObjects ) ) {
        for( var x in modelObjects ) {
            if( modelObjects[ x ] ) {
                var targetUid;
                if( modelObjects[ x ].props.awb0UnderlyingObject ) {
                    targetUid = modelObjects[ x ].props.awb0UnderlyingObject.dbValues[ 0 ];
                } else {
                    targetUid = modelObjects[ x ].uid;
                }
                if( targetUid ) {
                    uids.push( targetUid );
                }
            }
        }
    }
    return uids;
};

/** Get the EPM Task created from the Create Instance SOA response
 *
 * @param {*} response The SOA response
 * @returns {*} The task object created
 */
export let getTaskObject = function( response ) {
    if( response && response.ServiceData && response.ServiceData.modelObjects ) {
        var allModelObjects = response.ServiceData.modelObjects;
        for( let objectId in allModelObjects ) {
            const type = allModelObjects[ objectId ].type;
            const uid = allModelObjects[ objectId ].uid;
            const startedTask = allModelObjects[ objectId ].props.fnd0StartedTasks;
            if( type === 'EPMTask' && startedTask && startedTask.dbValues[ 0 ] !== null ) {
                var empTask = {
                    uid: uid,
                    type: type
                };
                var empDoTask = {
                    uid: startedTask.dbValues[ 0 ],
                    type: 'EPMDoTask'
                };
                return {
                    empTask: empTask,
                    empDoTask: empDoTask
                };
            }
        }
    }
    return {};
};

/** Get the EPM Do Task started for the EPM Job created from the getProperties SOA response
 *
 * @param {Object} response Response object
 * @returns {*} EPM Do Task uid
 */
export let getEPMDoTaskObject = function( response ) {
    if( response && response.modelObjects ) {
        var allModelObjects = response.modelObjects;
        for ( let objectId in allModelObjects ) {
            // Fetch the Do Task if the property fnd0StartedTasks is available
            if (  allModelObjects[objectId].props.fnd0StartedTasks.dbValues[0] ) {
                return allModelObjects[objectId].props.fnd0StartedTasks.dbValues[0];   //EPMDoTask
            }
            return allModelObjects[objectId].uid;   //EMPTask
        }
    }
};

export let getUid = function( commandContext ) {
    if( commandContext.prop ) {
        var srcObjectId = uwPropertySvc.getSourceObjectUid( commandContext.prop );
        if( srcObjectId ) {
            return srcObjectId;
        }
    }
    return appCtxSvc.ctx.selected.uid;
};

/**
 * Convert due date to ISO string
 *
 * @param {number} dueDate The due date
 * @returns {string} The ISO string
 */
export let convertToIsoString = function( dueDate ) {
    if( dueDate === '' ) {
        return dueDate;
    }
    var dstartDate = new Date( dueDate );
    dstartDate.setHours( 23, 59, 59, 0 );
    var dCurrentDate = new Date();
    if( dCurrentDate > dstartDate ) {
        dueDate = '';
        return dueDate;
    }
    return dstartDate.toISOString();
};

/**
 * Populate the targets data that will store present object and selected object in specific section.
 *
 * @param {String} context key string that will be targetObjects or referencesObjects
 * @param {Array} selectedObjects Selected objects present in each section.
 * @returns {Object} Object that will contain context specific info
 */
export let populateTargetsData = ( sharedData, data ) => {
    var modelObjects = [];
    const newSharedData = { ...sharedData.value };
    if( sharedData.value.addedSourceObjects ) {
        newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects ];
    }

    if( !_.isEmpty( data ) ) {
        newSharedData.addedUserObjects = data.data.assignedUserObject;
    } else {
        newSharedData.addedUserObjects = sharedData.assignedUserObject;
    }
    // Get the local selection uid
    var selectedObject = selectionService.getSelection().selected;
    var selectedUid;

    // Populate default target
    if( !_.isEmpty( selectedObject ) ) {
        if( !isDefaultTargetRemoved &&
            ( appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:Location' ] !== 'com.siemens.splm.client.inbox.tasksLocation' &&
                selectedObject[ 0 ].modelType.typeHierarchyArray.indexOf( 'Folder' ) === -1 || selectedObject[ 0 ].modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) !== -1 ) ) {
            if( selectedObject[ 0 ].props.awb0UnderlyingObject ) {
                selectedUid = selectedObject[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ];
            } else {
                selectedUid = selectedObject[ 0 ].uid;
            }

            modelObjects = _.cloneDeep( selectedObject );
        }
    }
    // Add the targets from add panel
    _.forEach( newSharedData.addedSourceObjects, function( srcObject ) {
        var targetObject = cdm.getObject( srcObject.uid );
        if( selectedUid !== srcObject.uid || selectedUid === undefined ) {
            modelObjects.push( targetObject );
        }
    } );

    return {
        modelObjects: modelObjects
    };
};

/**
 * set data to the createTaskData
 * @param {Object} data Data
 */
export let saveCreateTaskState = function( data ) {
    // store create task panel data to a variable.
    createTaskData = data;
};

export let getCreateTaskState = function() {
    return createTaskData;
};

/**
 * Validate due date field
 * @param {Date} dueDateDateObj the due date as a JS Date Object
 */
export const validateDueDate = function( dueDateDateObj ) {
    if( typeof dueDateDateObj === 'undefined' ) {
        // Allow undefined due date - meaning user did not select a due date
        // Because the due date field is optional
        return {
            isInvalidDueDate: false
        };
    }
    let todayDateObj = new Date();
    // Initialize time to zero
    todayDateObj.setHours( 0, 0, 0, 0 );
    const isInvalidDueDate = todayDateObj > dueDateDateObj; // Due date must be >= today
    return {
        isInvalidDueDate: isInvalidDueDate
    };
};

export const updateField = function( fields, fieldName ) {
    const fieldToUpdate = fields[ fieldName ];
    fieldToUpdate.update( fieldToUpdate.value );
};

export let openAddAssigneePanel = ( data, sharedData ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'AwPeoplePicker';
    newSharedData.previousView = 'tcxSimplifiedCreateDoTaskSub';
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export let backToCreateTaskDataFromAssignee = function( sharedData, data ) {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'tcxSimplifiedCreateDoTaskSub';
    newSharedData.previousView = 'AwPeoplePicker';
    if( !_.isEmpty( data ) ) {
        newSharedData.addedSourceObjects = data.sharedData.addedSourceObjects;
        newSharedData.addedUserObjects = data.sharedData.addedUserObjects;
    } else {
        newSharedData.addedSourceObjects = sharedData.addedSourceObjects;
        newSharedData.addedUserObjects = sharedData.addedUserObjects;
    }

    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export let updateSharedDataWithUsersAndActiveView = function( sharedData, userObjects, data ) {
    var isDuplicateEntry = false;
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'tcxSimplifiedCreateDoTaskSub';
    newSharedData.previousView = 'AwPeoplePicker';
    if( sharedData.addedUserObjects && sharedData.addedUserObjects.length && !_.isEmpty( userObjects ) ) {
        for( var j = 0; j < sharedData.addedUserObjects.length; j++ ) {
            if( sharedData.addedUserObjects[ j ].uid === userObjects[ 0 ].uid ) {
                // Duplicate object added.
                isDuplicateEntry = true;
            }
        }
    }

    // In case of back navigation
    if( !sharedData.addedUserObjects ) {
        sharedData.addedUserObjects = [];
    }

    if( !_.isEmpty( data ) ) {
        newSharedData.addedSourceObjects = data.sharedData.addedSourceObjects;
    } else {
        newSharedData.addedSourceObjects = sharedData.addedSourceObjects;
    }

    if( ( !isDuplicateEntry || sharedData.addedUserObjects.length === 0 ) && !_.isEmpty( userObjects ) ) {
        newSharedData.addedUserObjects = [ ...sharedData.addedUserObjects, ...userObjects ];
    } else {
        newSharedData.addedUserObjects = [ ...sharedData.addedUserObjects ];
    }

    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

/**
 * Populate the targets data that will store present object and selected object in specific section.
 *
 * @param {String} context key string that will be targetObjects or referencesObjects
 * @param {Array} selectedObjects Selected objects present in each section.
 * @returns {Object} Object that will contain context specific info
 */
export let populateAssignedUsersData = ( sharedData ) => {
    var modelObjects = [];
    const newSharedData = { ...sharedData.value };

    if( sharedData.value.addedUserObjects ) {
        newSharedData.addedUserObjects = [ ...sharedData.value.addedUserObjects ];
    }

    // Get the local selection uid
    var selectedObject = selectionService.getSelection().selected;
    var selectedUid;
    if( selectedObject.length > 0 ) {
        if( selectedObject[ 0 ].props.awb0UnderlyingObject ) {
            selectedUid = selectedObject[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ];
        } else {
            selectedUid = selectedObject[ 0 ].uid;
        }
    }

    // Add the targets from add panel
    _.forEach( newSharedData.addedUserObjects, function( srcObject ) {
        var targetObject = cdm.getObject( srcObject.uid );
        if( selectedUid !== srcObject.uid ) {
            modelObjects.push( targetObject );
        }
    } );

    return {
        modelObjects: modelObjects
    };
};

/**
 * Remove given attachment from attachment list.
 *
 * @param {String} data - The view model data
 * @param {String} attachment - The attachment to be removed
 */
export let removeAssignedUsers = function( context ) {
    const localContext = { ...context };
    const newSharedData = localContext.createContext.sharedData.value;
    const targets = localContext.assignedUserObject;
    const selectedObject = localContext.selectedObject;
    for( let j = 0; j < targets.modelObjects.length; j++ ) {
        if( targets.modelObjects[ j ].uid === selectedObject[ 0 ].uid ) {
            targets.modelObjects.splice( j, 1 );
        }
    }
    var targetUid;
    if( selectedObject[ 0 ].props.awb0UnderlyingObject ) {
        targetUid = selectedObject[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        targetUid = selectedObject[ 0 ].uid;
    }
    for( let j = 0; j < newSharedData.addedUserObjects.length; j++ ) {
        if( newSharedData.addedUserObjects[ j ].uid === targetUid ) {
            newSharedData.addedUserObjects.splice( j, 1 );
        }
    }

    context.update && context.update( localContext );
    eventBus.publish( 'createTask.reloadAssineeDataProvider' );
};

/**
 * Populate the create assignment list panel to populate all available
 * templates.
 *
 * @param {Array} allTemplates All templates array
 * @param {Object} workflowTemplateProp Workflow templates property object
 * @return {Object} All available workflow template objects
 *
 */
export let populateCreateTaskDetails = function( allTemplates, workflowTemplateProp ) {
    var templatesObjects = allTemplates;

    if( templatesObjects && templatesObjects.length > 0 ) {
        var filterTemplates = templatesObjects;
        // Create the list model object that will be displayed
        templatesObjects = listBoxService.createListModelObjects( filterTemplates, 'props.template_name' );
        var CADtemplateObject;
        // Iterate for each template objects and populate the template description
        // that will be shown on panel
        _.forEach( templatesObjects, function( templateObject ) {
            if( templateObject.propDisplayValue === 'Cad Design Simple Task' ) {
                CADtemplateObject = templateObject;
            }
        } );
    }
    return {
        templatesObjects: templatesObjects,
        workflowTemplatesProp: CADtemplateObject
    };
};

var populateCreateTaskUid = function( workflowTemplateProp ) {
    return workflowTemplateProp.propInternalValue.props.subtask_template.dbValues[ 0 ];
};

export let tcxLiteGetRelationMapForAdd = function( type ) {
    let output = {};
    const relMap = new Map();
    var relTypeArray = [];
    relTypeArray.push( 'contents' );
    relMap.set( type, relTypeArray );
    output.relations = mapToObj( relMap );
    return output;
};

/**
 *
 * @param {Object} map - map
 * @returns {Object} map object
 */
function mapToObj( map ) {
    const obj = {};
    for( let [ k, v ] of map ) { obj[ k ] = v; }
    return obj;
}

export default exports = {
    doTaskPanelInit,
    getCreateTaskState,
    openTaskAttachmentPanel,
    backToCreateTaskActionData,
    updateSharedDataWithTargets,
    removeTargetAttachment,
    getTargetUids,
    getAttachmentTypes,
    getTaskObject,
    getEPMDoTaskObject,
    getUid,
    convertToIsoString,
    populateTargetsData,
    setTaskName,
    setCreateTaskState,
    saveCreateTaskState,
    validateDueDate,
    updateField,
    openAddAssigneePanel,
    backToCreateTaskDataFromAssignee,
    updateSharedDataWithUsersAndActiveView,
    populateAssignedUsersData,
    removeAssignedUsers,
    populateCreateTaskDetails,
    tcxLiteGetRelationMapForAdd
};
