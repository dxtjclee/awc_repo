// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

import _ from 'lodash';
import AwGanttCallbacks from 'js/AwGanttCallbacks';
import awFilterService from 'js/awFilterService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import timelineIconService from 'js/Pgp0PlanTimelineIconService';
import timelineLayoutService from 'js/Pgp0PlanTimelineLayoutService';
import timelineOverrides from 'js/Pgp0PlanTimelineOverrides';
import timelineScrollService from 'js/Pgp0PlanTimelineScrollService';
import timelineTemplates from 'js/Pgp0PlanTimelineTemplates';
import AwStateService from 'js/awStateService';
import appCtxSvc from 'js/appCtxService';

export class Pgp0PlanTimelineCallbacks extends AwGanttCallbacks {
    constructor() {
        super();
        // this.schedule = schedule;
    }

    onBeforeGanttReady() {
        super.onBeforeGanttReady();
        timelineOverrides.initOverrideVariables( this.ganttInstance );
        timelineOverrides.addTimelineOverrides( this.ganttInstance );
        timelineIconService.addIconLayer( this.ganttInstance );
        this.ganttInstance.templates.grid_folder = ( task ) => { return timelineTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.grid_file = ( task ) => { return timelineTemplates.getGridIconTemplate( task ); };
        // this.ganttInstance.templates.grid_row_class = ( start, end, task ) => { return timelineTemplates.getGridRowCssClass( start, end, task ); };
        this.ganttInstance.templates.task_class = ( start, end, task ) => { return timelineTemplates.getTaskClass( task ); };
        this.ganttInstance.templates.link_class = ( link ) => { return timelineTemplates.getLinkClass( link, this.ganttInstance ); };
        this.ganttInstance.templates.task_text = ( start, end, task ) => { return timelineTemplates.getTaskText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.tooltip_date_format = ( date ) => { return this.ganttInstance.date.date_to_str( '%d-%M-%Y' )( date ); };
        this.ganttInstance.templates.tooltip_text = ( start, end, task ) => { return timelineTemplates.getTooltipText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.rightside_text = ( start, end, task ) => { return timelineTemplates.getRightSideText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.leftside_text = ( start, end, task ) => { return timelineTemplates.getLeftSideText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.timeline_cell_class = ( task, date ) => { return timelineTemplates.getTimelineCellClass( task, date, this.ganttInstance ); };
    }

    onGanttScroll( left, top ) {
        timelineScrollService.scrollTable();
    }

    onBeforeLinkAdd( id, link ) {
        if( cdm.getObject( link.uid ) ) {
            return true;
        }

        //NOTE : for milestones ('milestoneUid__parentPlanUid') the uid shows in this format, so we split to get the actual BO
        let source = link.source.split( '__' )[ 0 ];
        let target = link.target.split( '__' )[ 0 ];

        var sourceObject = cdm.getObject( source );
        var targetObject = cdm.getObject( target );

        let sourceModule = 'ProgramPlanningCommandPanelsMessages';
        let localTextBundle = localeSvc.getLoadedText( sourceModule );

        if( sourceObject && targetObject ) {
            var sourceObjectType = sourceObject.modelType;
            var targetObjectType = targetObject.modelType;

            if( cmm.isInstanceOf( 'Prg0AbsEvent', sourceObjectType ) &&
                cmm.isInstanceOf( 'Prg0AbsEvent', targetObjectType ) ) {
                var sourceObjDate = new Date( sourceObject.props.prg0PlannedDate.dbValues[ 0 ] );
                var targetObjDate = new Date( targetObject.props.prg0PlannedDate.dbValues[ 0 ] );
                if( dateTimeSvc.compare( targetObjDate, sourceObjDate ) >= 0 ) {
                    var info = {
                        predTask: sourceObject,
                        succTask: targetObject
                    };
                    eventBus.publish( 'createEventDependency', info );
                } else {
                    let pastDateErrorMessage = localTextBundle.Pgp0DepCreateErrorMsg;
                    let finalMessage = messagingService.applyMessageParams( pastDateErrorMessage, [ '{{sourceEvent}}', '{{targetEvent}}', '{{sourceEvent}}' ], {
                        sourceEvent: sourceObject.props.object_name.dbValues[ 0 ],
                        targetEvent: targetObject.props.object_name.dbValues[ 0 ]
                    } );
                    messagingService.showError( finalMessage );
                }
            } else {
                let sourceObjDate = sourceObject.props.start_date ? new Date( sourceObject.props.start_date.dbValues[ 0 ] ) : new Date( sourceObject.props.prg0PlannedDate.dbValues[ 0 ] );
                let targetObjDate = targetObject.props.start_date ? new Date( targetObject.props.start_date.dbValues[ 0 ] ) : new Date( targetObject.props.prg0PlannedDate.dbValues[ 0 ] );
                if( dateTimeSvc.compare( targetObjDate, sourceObjDate ) >= 0 ) {
                    let DepInfo = {
                        primary : targetObject,
                        secondary : sourceObject
                    };
                    eventBus.publish( 'createMilestoneEventDependency',  DepInfo  );
                } else {
                    let pastDateErrorMessage = localTextBundle.Pgp0DepCreateErrorMsg;
                    let sourceObjDisplayName = sourceObject.props.object_string ? sourceObject.props.object_string.dbValues[ 0 ] : sourceObject.props.object_name.dbValues[ 0 ];
                    let targetObjDisplayName = targetObject.props.object_string ? targetObject.props.object_string.dbValues[ 0 ] : targetObject.props.object_name.dbValues[ 0 ];
                    let finalMessage = messagingService.applyMessageParams( pastDateErrorMessage, [ '{{sourceObjDisplayName}}', '{{targetObjDisplayName}}', '{{sourceObjDisplayName}}' ], {
                        sourceObjDisplayName : sourceObjDisplayName,
                        targetObjDisplayName : targetObjDisplayName
                    } );
                    messagingService.showError( finalMessage );
                }
            }
        }
        return false;
    }

    onLinkDblClick( id, e ) {
        let dependency = cdm.getObject( id.split( '__' )[ 0 ] );
        if( dependency ) {
            eventBus.publish( 'planTimelineChart.confirmDeleteOfEventDependency', { dependencyDeletes: [ dependency ] } );
        }
        eventBus.publish( 'confirmDeleteOfEventDependency' );
    }

    onBeforeTaskDrag( id, mode, e ) {
        return this.ganttInstance.getTask( id ).canDragMove();
    }

    onAfterTaskDrag( id, mode, e ) {
        handleEventDrag( id, mode, this.ganttInstance );
    }
}

// Variable to process drag(move) with mutiselect. Since 'onAfterTaskDrag' event is fired
// for each task individually, we need to accumulate and process the updateTasks call in bulk.
let eventUpdates = { updateEventsInfo: {} };
let taskUpdates = { updateTasksInfo:{} };
const handleEventDrag = ( id, mode, ganttInstance ) => {
    let tcEvent = cdm.getObject( id.split( '__' )[ 0 ] );
    if( tcEvent && tcEvent.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
        let oldPlannedDate = new Date( tcEvent.props.prg0PlannedDate.dbValues[ 0 ] );

        let ganttEvent = ganttInstance.getTask( id );
        let dragStart = new Date( ganttEvent.start_date.toGMTString() );

        const modes = ganttInstance.config.drag_mode;
        switch ( mode ) {
            case modes.move: {
            // Init updates

                eventUpdates.updateEventsInfo = { updates: [], eventObjects: [] };


                // Skip the processed objects. DHTMLX fires one extra event for the task being dragged during multiselect.
                if( !eventUpdates.updateEventsInfo.eventObjects.find( object => object.uid === tcEvent.uid ) ) {
                // Read the hours and minute before drag and assign to new date, so that
                // the dates will not have different time depending on the amount of drag.
                    dragStart.setHours( oldPlannedDate.getHours() );
                    dragStart.setMinutes( oldPlannedDate.getMinutes() );

                    //Formats the date to be shown in confirmation message as per user locale
                    var formattedDate = awFilterService.instance( 'date' )( dragStart, dateTimeSvc.getSessionDateFormat() );

                    if( oldPlannedDate.getTime() !== dragStart.getTime() ) {
                        let eventUpdateInfo = {
                            object: tcEvent,
                            plannedDate: dateTimeSvc.formatUTC( dragStart ),
                            formattedDate: formattedDate
                        };
                        eventUpdates.updateEventsInfo.updates.push( eventUpdateInfo );
                        eventUpdates.updateEventsInfo.eventObjects.push( tcEvent );
                    }
                }

                let nSelectedEvents = ganttInstance.getSelectedTasks().length;
                if( nSelectedEvents <= 1 ) {
                    if( eventUpdates.updateEventsInfo.updates.length > 0 ) {
                        eventBus.publish( 'planTimelineEventsDragged', eventUpdates.updateEventsInfo );
                    }
                    // Reset updates.

                    eventUpdates.updateEventsInfo = {};
                }
                break;
            }
        }
    } else if( tcEvent && tcEvent.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        let dragMilestoneInfo = {
            mode : mode,
            tcTask : cdm.getObject( id.split( '__' )[ 0 ] ),
            ganttInstance : ganttInstance,
            ganttTaskId : id
        };
        eventBus.publish( 'getScheduleTaskProperties', dragMilestoneInfo );
    }
};

export const handleMilestoneDrag = ( eventData ) => {
    let mode = eventData.updateTaskInfo.mode;
    let ganttInstance = eventData.updateTaskInfo.ganttInstance;
    let tcTask = eventData.updateTaskInfo.tcTask;
    let oldStart = new Date( tcTask.props.start_date.dbValues[ 0 ] );
    let oldEnd = new Date( tcTask.props.finish_date.dbValues[ 0 ] );
    if( ganttInstance ) {
        let ganttTask = ganttInstance.getTask( eventData.updateTaskInfo.ganttTaskId );
        let dragStart;
        let dragEnd;
        if( ganttTask && ganttTask !== null ) {
            dragStart = new Date( ganttTask.start_date.toGMTString() );
            dragEnd = new Date( ganttTask.end_date.toGMTString() );
        }
        let scheduleTag = tcTask.props.schedule_tag.dbValues[ 0 ];
        let schedule;
        if( scheduleTag ) {
            schedule = cdm.getObject( scheduleTag );
        }
        if( schedule && schedule.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
            let isFinishDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ];
            let isEndDateScheduling = isFinishDateSchedule === 'true' || isFinishDateSchedule === '1';
            const modes = ganttInstance.config.drag_mode;
            switch ( mode ) {
                case modes.move: {
                    // Init updates

                    taskUpdates.updateTasksInfo = { schedule: schedule, updates: [], taskObjects: [] };


                    // Skip the processed objects. DHTMLX fires one extra event for the task being dragged during multiselect.
                    if( !taskUpdates.updateTasksInfo.taskObjects.find( object => object.uid === tcTask.uid ) ) {
                        // Read the hours and minute before drag and assign to new date, so that
                        // the dates will not have different time depending on the amount of drag.
                        dragStart.setHours( oldStart.getHours() );
                        dragStart.setMinutes( oldStart.getMinutes() );
                        dragEnd.setHours( oldEnd.getHours() );
                        dragEnd.setMinutes( oldEnd.getMinutes() );
                        //Formats the date to be shown in confirmation message as per user locale
                        var formattedDate = awFilterService.instance( 'date' )( dragStart, dateTimeSvc.getSessionDateFormat() );

                        if( oldStart.getTime() !== dragStart.getTime() || oldEnd.getTime() !== dragEnd.getTime() ) {
                            let taskUpdateInfo = {
                                object: tcTask,
                                formattedDate: formattedDate,
                                updates: [ getUpdateAttribute( isEndDateScheduling ? 'finish_date' : 'start_date', dateTimeSvc.formatUTC( isEndDateScheduling ? dragStart : dragEnd ) ) ]
                            };
                            taskUpdates.updateTasksInfo.updates.push( taskUpdateInfo );
                            taskUpdates.updateTasksInfo.taskObjects.push( tcTask );
                        }
                    }
                    let nSelectedTasks = ganttInstance.getSelectedTasks().length;
                    if( nSelectedTasks <= 1 ) {
                        if( taskUpdates.updateTasksInfo.updates.length > 0 && appCtxSvc.getCtx( 'isValidToCallMoveMilestoneSOA' ) ) {
                            eventBus.publish( 'prgSchedule.milestoneDragged', taskUpdates.updateTasksInfo );
                        }
                        // Reset updates.

                        taskUpdates.updateTasksInfo = {};
                    }
                    break;
                }
            }
        }
    }
};

const openObject = function( taskUid ) {
    var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};
    var options = {};

    toParams.uid = taskUid;
    options.inherit = false;

    AwStateService.instance.go( showObject, toParams, options );
};

export const onWindowClick = ( e ) => {
    var target = e.target;
    if( target.className === 'gantt_tooltip_open_icon' ) {
        var taskId = target.getAttribute( 'task_id' );
        if( taskId ) {
            openObject( taskId );
        }
    }
};


const onTreeNodesLoaded = ( eventData, timelineDataService, atomicDataRef ) => {
    if( atomicDataRef.ganttChartState.getAtomicData().ganttInitialized !== true ) {
        return;
    }

    if( eventData && !_.isEmpty( eventData.treeLoadResult ) ) {
        let parentNode = eventData.treeLoadResult.parentNode;
        let isColumnFilteringApplied = appCtxSvc.getCtx( 'isColumnFilteringApplied' );
        if( parentNode ) {
            if( eventData.treeLoadInput.isTopNode ) {
                resetGanttChart( atomicDataRef.ganttChartState.getAtomicData().ganttInstance );
                timelineLayoutService.debounceResetTimelineRowHeight( atomicDataRef.ganttChartState.getAtomicData().ganttInstance );

                // Listen to Tree table scroll to sync up Timeline scroll
                timelineScrollService.registerTable2TimelineScrollSync();
            }
            eventData.treeLoadResult.childNodes && eventData.treeLoadResult.childNodes.forEach( ( node ) => {
                let nodeObject = cdm.getObject( node.uid );
                atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addTask(
                    timelineDataService.constructGanttObject( nodeObject ),
                    nodeObject.props && nodeObject.props.prg0ParentPlan && !isColumnFilteringApplied ? nodeObject.props.prg0ParentPlan.dbValues[ 0 ] : parentNode.uid,
                    node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
                if( node.isExpanded === true ) {
                    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.open( node.uid );
                }
            } );
        }
    }
};

const resetGanttChart = ( ganttInstance ) => {
    if( ganttInstance && ganttInstance.getTaskCount() > 0 ) {
        let links = ganttInstance.getLinks();
        let allTasks = ganttInstance.getTaskByTime();

        ganttInstance.batchUpdate( () => {
            links.forEach( link => ganttInstance.isLinkExists( link.id ) && ganttInstance.deleteLink( link.id ) );
            allTasks.forEach( task => ganttInstance.isTaskExists( task.id ) && ganttInstance.deleteTask( task.id ) );
        } );
    }
};

// export const onDependenciesLoaded = ( eventData, ganttDataService, atomicDataRef ) => {
//     let atomicData = atomicDataRef.ganttChartState.getAtomicData();
//     if( _.isEmpty( eventData.loadedDependencies ) || atomicData.ganttInitialized !== true ) {
//         return;
//     }
//     eventData.loadedDependencies.forEach( ( dependencyInfo ) => {
//         atomicData.ganttInstance.addLink( {
//             ...ganttDataService.constructGanttObject( cdm.getObject( dependencyInfo.uid ) ),
//             source: dependencyInfo.secondaryUid,
//             target: dependencyInfo.primaryUid
//         } );
//     } );
// };

export const onToggleTreeNode = ( node, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized === true ) {
        if( node.isExpanded === true ) {
            atomicData.ganttInstance.open( node.id );
        } else {
            atomicData.ganttInstance.close( node.id );
        }
    }
};

// export const onCollapseBelow = ( eventData, atomicDataRef ) => {
//     let atomicData = atomicDataRef.ganttChartState.getAtomicData();
//     if( atomicData.ganttInitialized === true ) {
//         atomicData.ganttInstance.close( eventData.node.id );

//         let childIds = atomicData.ganttInstance.getChildren( eventData.node.id );
//         atomicData.ganttInstance.batchUpdate( () => {
//             childIds.forEach( childId => atomicData.ganttInstance.deleteTask( childId ) );
//         } );
//     }
// };

export const onNodesAdded = ( eventData, timelineDataService, ganttInstance ) => {
    ganttInstance.batchUpdate( () => {
        eventData.addedNodes.length > 0 && eventData.addedNodes.forEach( node => {
            ganttInstance.addTask( timelineDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                node.parentNodeUid,
                node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
            let parentGanttTask = ganttInstance.getTask( node.parentNodeUid );
            if( !parentGanttTask.$open ) {
                ganttInstance.open( node.parentNodeUid );
            }
        } );
    } );
};

export const onEventsAdded = ( eventData, timelineDataService, ganttInstance ) => {
    let objectUids = [];
    ganttInstance.batchUpdate( () => {
        eventData.addedEvents.length > 0 && eventData.addedEvents.forEach( event => {
            let parentUid = event.props.prg0PlanObject.dbValues[ 0 ];
            ganttInstance.addTask( timelineDataService.constructGanttObject( cdm.getObject( event.uid ) ),
                parentUid );
            objectUids.push( event.uid );
        } );
    } );
    ganttInstance.recalculateStackedObjInfo( objectUids );
};

export const onMilestonesAdded = ( eventData, timelineDataService, ganttInstance ) => {
    if( eventData.addedMilestonesMap ) {
        let objectUids = [];
        ganttInstance.batchUpdate( () => {
            for( let planUid in eventData.addedMilestonesMap ) {
                let milestones = eventData.addedMilestonesMap[ planUid ];
                milestones && milestones.forEach( milestone => {
                    let ganttObject = timelineDataService.constructGanttObject( cdm.getObject( milestone.uid ) );
                    let updatedUid = milestone.uid + '__' + planUid;
                    objectUids.push( updatedUid );
                    ganttObject.id = updatedUid;
                    ganttInstance.addTask( ganttObject, planUid );
                } );
            }
        } );
        ganttInstance.recalculateStackedObjInfo( objectUids );
    }
};

export const onNodesRemoved = ( eventData, ganttInstance ) => {
    let parentUids = [];
    eventData.removedNodeUids.length > 0 && eventData.removedNodeUids.forEach( nodeUid => {
        if( ganttInstance.isTaskExists( nodeUid ) ) {
            let ganttTask = ganttInstance.getTask( nodeUid );
            if( parentUids.indexOf( ganttTask.parent ) === -1 ) {
                parentUids.push( ganttTask.parent );
            }
            ganttInstance.deleteTask( nodeUid );
        }
    } );
    ganttInstance.recalculateStackedObjInfoForParent( parentUids );
};

export const onPlansReordered = ( moveRequest, ganttInstance ) => {
    if( moveRequest && moveRequest.timelineMovePlanContainer && ganttInstance ) {
        ganttInstance.moveTask( moveRequest.timelineMovePlanContainer.planUid, moveRequest.timelineMovePlanContainer.index, moveRequest.timelineMovePlanContainer.parentUid );
    }
};

// export const onDependenciesAdded = ( eventData, ganttDataService, ganttInstance ) => {
//     if( eventData && eventData.dependenciesInfo && eventData.dependenciesInfo.length > 0 ) {
//         eventData.dependenciesInfo.forEach( depInfo => {
//             ganttInstance.addLink( { ...ganttDataService.constructGanttObject( cdm.getObject( depInfo.uid ), depInfo.primaryUid, depInfo.secondaryUid ) } );
//         } );
//     }
// };

export const onDependenciesDeleted = ( eventData, ganttInstance ) => {
    if( eventData && eventData.dependenciesInfo && eventData.dependenciesInfo.length > 0 ) {
        eventData.dependenciesInfo.forEach( depInfo => {
            ganttInstance.isLinkExists( depInfo.uid ) && ganttInstance.deleteLink( depInfo.uid );
        } );
    }
};

export const onObjectsUpdated = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }
    const objectUids = [];
    let mapPlanMilestoneInfo;
    atomicData.ganttInstance.batchUpdate( () => {
        eventData.updatedObjects && eventData.updatedObjects.forEach( modelObject => {
            if( modelObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
                // Get milestone & planIs's in the planNavigationCtx
                if( appCtxSvc.ctx.planNavigationCtx && appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid ) {
                    let planNavigationCtx = appCtxSvc.getCtx( 'planNavigationCtx' );
                    mapPlanMilestoneInfo = planNavigationCtx.showMilestonesToPlansUid;
                }
                let milestonePlanIds = mapPlanMilestoneInfo[modelObject.uid];
                let objectID = modelObject.uid;
                for ( let planId in milestonePlanIds ) {
                    let ganttId = objectID + '__' + milestonePlanIds[planId];
                    ganttDataService.updateGanttObject( ganttId, atomicData.ganttInstance );
                    objectUids.push( ganttId );
                }
            }else{
                ganttDataService.updateGanttObject( modelObject.uid, atomicData.ganttInstance );
                objectUids.push( modelObject.uid );
            }
        } );
    } );
    atomicData.ganttInstance.recalculateStackedObjInfo( objectUids );
};

const getUpdateAttribute = ( propName, propValue ) => {
    return { attrName: propName, attrValue: propValue, attrType: 1 /*Unused*/ };
};

export default {
    onTreeNodesLoaded,
    onToggleTreeNode,
    onNodesAdded,
    onEventsAdded,
    onMilestonesAdded,
    onNodesRemoved,
    onObjectsUpdated,
    onPlansReordered,
    onDependenciesDeleted,
    onWindowClick,
    handleMilestoneDrag
};
