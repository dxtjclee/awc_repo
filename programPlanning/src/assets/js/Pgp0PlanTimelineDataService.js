// Copyright (c) 2022 Siemens

import appCtx from 'js/appCtxService';
import awIconService from 'js/awIconService';
import cdm from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import ganttDataService, { AwGanttDataService } from 'js/AwGanttDataService';
import _ from 'lodash';

/**
 * Schedule Timeline data transform service
 */
export default class Pgp0PlanTimelineDataService extends AwGanttDataService {
    constructor() {
        super();
        this.createFnMap = new Map( [
            [ 'Prg0AbsPlan', Pgp0PlanTimelineDataService.programPlanCreateFn ],
            [ 'Prg0AbsEvent', Pgp0PlanTimelineDataService.programEventCreateFn ],
            [ 'Prg0EventDependencyRel', Pgp0PlanTimelineDataService.programEventDependencyCreateFn ],
            [ 'ScheduleTask', Pgp0PlanTimelineDataService.scheduleTaskCreateFn ]
        ] );

        this.updateFnMap = new Map( [
            [ 'Prg0AbsEvent', Pgp0PlanTimelineDataService.programEventUpdateFn ],
            [ 'ScheduleTask', Pgp0PlanTimelineDataService.scheduleTaskUpdateFn ]
        ] );
    }

    static programPlanCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.render = 'split';
        ganttObject.unscheduled = true;
        ganttObject.getOverlayIcon = ( ganttTask, ganttInstance ) => { return getEventOverlayIcon( ganttTask, ganttInstance ); };
        return ganttObject;
    }

    static programEventCreateFn( eventObject ) {
        let plannedDateStr = eventObject.props.prg0PlannedDate.dbValues[ 0 ];
        let plannedDateObj = new Date( plannedDateStr );
        let plannedDate = dateTimeSvc.formatNonStandardDate( plannedDateObj, 'yyyy-MM-dd HH:mm' );
        let ganttObject = ganttDataService.createGanttObject( eventObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = plannedDate;
        ganttObject.end_date = plannedDate;
        ganttObject.type = 'milestone';
        ganttObject.getCssClass = () => { return 'event'; };
        ganttObject.color = ganttObject.getDbValue( 'pgp0EventColor' );
        ganttObject.getLeftSideText = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventLeftSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideText = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventRightSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getLeftSideValue = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventLeftSideValue( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideValue = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventRightSideValue( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getEventTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.isBubbleCountSupported = () => { return true; };
        ganttObject.canDragMove = () => { return true; };
        ganttObject.renderOverlayIcon = () => { return true; };
        let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
        let eventTooltipPreference = appCtx.getCtx( 'preferences.PP_Event_Tooltip_Information' );
        let configuredProperties = eventInfoPreference.concat( eventTooltipPreference );
        configuredProperties.push( 'prg0State' );
        configuredProperties && configuredProperties.forEach( ( prefPropety ) => ganttObject[ prefPropety ] = ganttObject.getDbValue( prefPropety ) );
        ganttObject.isSplitChild = true; //Object to be in same row as parent
        return ganttObject;
    }

    static scheduleTaskCreateFn( schTaskObject ) {
        let ganttObject = ganttDataService.createGanttObject( schTaskObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( schTaskObject.props.start_date.dbValues[ 0 ] );
        ganttObject.end_date = new Date( schTaskObject.props.finish_date.dbValues[ 0 ] );
        ganttObject.type = 'milestone';
        ganttObject.fnd0StatusUiValue = ganttObject.getUiValue( 'fnd0status' );
        ganttObject.isBubbleCountSupported = () => { return true; };
        ganttObject.getCssClass = () => { return 'milestone'; };
        ganttObject.canDragMove = () => { return true; };
        ganttObject.getLeftSideText = ( start, end, ganttTask, ganttInstance ) => { return getMilestoneLeftSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideText = ( start, end, ganttTask, ganttInstance ) => { return getMilestoneRightSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getMilestoneTooltipText( start, end, ganttTask, ganttInstance ); };
        ganttObject.isSplitChild = true; //Object to be in same row as parent
        return ganttObject;
    }

    static programEventDependencyCreateFn( eventDepObject ) {
        let alternateUid = '';
        if( eventDepObject.planId ) {
            // Need to differentiate ganttObject Id, if same milestone there in the different plans. (GanttObjectId Format : GanttObjId + '__' + milestonePlanId)
            alternateUid = eventDepObject.uid + '__' + eventDepObject.planId;
        }
        let ganttObject = ganttDataService.createGanttObject( eventDepObject.uid, alternateUid );
        ganttObject.source = ganttObject.getDbValue( 'secondary_object' );
        ganttObject.target = ganttObject.getDbValue( 'primary_object' );
        ganttObject.type = '0';
        return ganttObject;
    }

    static programEventUpdateFn( ganttObjectId, ganttInstance ) {
        if( ganttInstance.isTaskExists( ganttObjectId ) ) {
            let ganttObject = ganttInstance.getTask( ganttObjectId );
            ganttObject.text = ganttObject.getUiValue( 'object_string' );
            ganttObject.start_date = new Date( ganttObject.getDbValue( 'prg0PlannedDate' ) );
            ganttObject.end_date = new Date( ganttObject.getDbValue( 'prg0PlannedDate' ) );
            ganttObject.color = ganttObject.getDbValue( 'pgp0EventColor' );
            ganttInstance.updateTask( ganttObject.id );
        }
    }

    static scheduleTaskUpdateFn( ganttObjectId, ganttInstance ) {
        let ganttObject = ganttInstance.getTask( ganttObjectId );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( ganttObject.getDbValue( 'start_date' ) );
        ganttObject.end_date = new Date( ganttObject.getDbValue( 'finish_date' ) );
        ganttInstance.updateTask( ganttObject.id );
    }
}

const canShowTaskText = ( ganttInstance ) => {
    return ganttInstance.showEventProperties === 'true';
};

function isValidDate( date ) {
    return date && Object.prototype.toString.call( date ) === '[object Date]' && !isNaN( date );
}

const getEventOverlayIcon = ( ganttTask, ganttInstance ) => {
    let children = ganttInstance.getChildren( ganttTask.id );
    children = children.filter( child => ganttInstance.getTask( child ).renderOverlayIcon ); //Remove if Plan Object Project/Subproject
    if( children.length <= 0 ) { return; }
    children = children.sort( function( child1, child2 ) { return ganttInstance.getTask( child1 ).start_date.getTime() - ganttInstance.getTask( child2 ).start_date.getTime(); } );
    var parentDiv = document.createElement( 'div' );
    let prevRightPos = 0;
    let prevLeftPos = 0;
    let layout = appCtx.getCtx( 'layout' );
    for( let childId in children ) {
        let child = ganttInstance.getTask( children[childId] );
        let position = ganttInstance.getTaskPosition( child, child.start_date, child.start_date );
        if ( prevRightPos >= position.left && prevLeftPos <= position.left ) {
            parentDiv.removeChild( parentDiv.lastChild );
        }
        if( child.renderOverlayIcon && child.renderOverlayIcon() ) {
            let childObj = cdm.getObject( child.id );
            var childDiv = document.createElement( 'div' );
            // 1. If childObj type is OOTB event then don't add overlay icon
            // 2. If childObj type is Custom event then add overlay icon
            // 3. If for Custom event, overlay icon is not present then system will show Workspace Object icon on gantt
            if ( childObj.type !== 'Prg0Event' ) {
                childDiv.className = 'sw-overlay-icon-' + layout;
                let custom_icon = awIconService.getTypeIconFileUrl( childObj );
                childDiv.style.backgroundImage = 'url(' + custom_icon + ')';
                childDiv.style.left = position.left + 'px';
                childDiv.style.top = position.top + 'px';
            }
            parentDiv.appendChild( childDiv );
        }
        prevLeftPos = position.left;
        prevRightPos = position.left + 15;
    }
    return parentDiv;
};

const getPlanEventLeftSideText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) || ganttTask.showLeftText !== true ) {
        return;
    }

    let taskText = [];
    let propValue = '';
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 0 ] ) {
        const prefProperty = eventInfoPreference[ 0 ];
        let propType = _.get( cdm.getObject( ganttTask.uid ), [ 'props', prefProperty, 'propertyDescriptor', 'valueType' ], 0 );
        //If Date property
        if( propType === 2 ) {
            propValue = ganttTask.getDbValue( prefProperty );
            let dateObj = new Date( propValue );
            if( isValidDate( dateObj ) ) {
                if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                    let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                    propValue = dateTimeSvc.formatDate( date );
                    taskText.push( '<div class="gantt_task_date">' + propValue + '</div>' );
                }
            } else {
                taskText.push( '<div class="gantt_task_text">' + propValue + '</div>' );
            }
        } else {
            propValue = ganttTask.getUiValue( prefProperty );
            taskText.push( '<div class="gantt_task_text">' + propValue + '</div>' );
        }
    }
    return taskText.join( '' );
};

const getPlanEventRightSideText = ( start, end, ganttTask, ganttInstance ) => {
    let taskText = [];
    let propValue = '';
    if( ganttTask.getStackedObjectsUids().length > 1 ) {
        let layout = appCtx.getCtx( 'layout' );
        taskText.push( '<div class="gantt_task_stackedInfo ' + layout + '"><div class="gantt_task_stackedCount">' + ganttTask.getStackedObjectsUids().length + '</div></div>' );
    }
    if( !canShowTaskText( ganttInstance ) || ganttTask.showRightText !== true ) {
        return taskText.join( '' );
    }
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 1 ] ) {
        const prefProperty = eventInfoPreference[ 1 ];
        let propType = _.get( cdm.getObject( ganttTask.uid ), [ 'props', prefProperty, 'propertyDescriptor', 'valueType' ], 0 );
        //If Date property
        if( propType === 2 ) {
            propValue = ganttTask.getDbValue( prefProperty );
            let dateObj = new Date( propValue );
            if( isValidDate( dateObj ) ) {
                if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                    let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                    propValue = dateTimeSvc.formatDate( date );
                    taskText.push( '<div class="gantt_task_date">' + propValue + '</div>' );
                }
            } else {
                taskText.push( '<div class="gantt_task_text">' + propValue + '</div>' );
            }
        } else {
            propValue = ganttTask.getUiValue( prefProperty );
            taskText.push( '<div class="gantt_task_text">' + propValue + '</div>' );
        }
    }
    return taskText.join( '' );
};

const getPlanEventLeftSideValue = ( start, end, ganttTask, ganttInstance ) => {
    let propValue = '';
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 0 ] ) {
        const prefProperty = eventInfoPreference[ 0 ];
        let propType = _.get( cdm.getObject( ganttTask.uid ), [ 'props', prefProperty, 'propertyDescriptor', 'valueType' ], 0 );
        propValue = ganttTask.getUiValue( prefProperty );
        // If Date Property
        if( propType === 2 ) {
            propValue = ganttTask.getDbValue( prefProperty );
            let dateObj = new Date( propValue );
            if( isValidDate( dateObj ) ) {
                if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                    let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                    propValue = dateTimeSvc.formatDate( date );
                }
            }
        }
    }
    return propValue;
};

const getPlanEventRightSideValue = ( start, end, ganttTask, ganttInstance ) => {
    let propValue = '';
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 1 ] ) {
        const prefProperty = eventInfoPreference[ 1 ];
        let propType = _.get( cdm.getObject( ganttTask.uid ), [ 'props', prefProperty, 'propertyDescriptor', 'valueType' ], 0 );
        propValue = ganttTask.getUiValue( prefProperty );
        // If Date Property
        if( propType === 2 ) {
            propValue = ganttTask.getDbValue( prefProperty );
            let dateObj = new Date( propValue );
            if( isValidDate( dateObj ) ) {
                if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                    let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                    propValue = dateTimeSvc.formatDate( date );
                }
            }
        }
    }
    return propValue;
};

const getMilestoneLeftSideText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) || ganttTask.showLeftText !== true ) {
        return;
    }
    let PlannedDateObj = new Date( ganttTask.start_date );
    let milestonePlannedDate = dateTimeSvc.formatNonStandardDate( PlannedDateObj, 'yyyy-MM-dd' );
    let leftText = [];
    leftText.push( '<div class="gantt_task_date">' + dateTimeSvc.formatDate( milestonePlannedDate ) + '</div>' );
    return leftText.join( '' );
};

const getMilestoneRightSideText = ( start, end, ganttTask, ganttInstance ) => {
    let rightText = [];
    if( ganttTask.getStackedObjectsUids().length > 1 ) {
        let layout = appCtx.getCtx( 'layout' );
        rightText.push( '<div class="gantt_task_stackedInfo ' + layout + '"><div class="gantt_task_stackedCount">' + ganttTask.getStackedObjectsUids().length + '</div></div>' );
    }
    if( !canShowTaskText( ganttInstance ) || ganttTask.showRightText !== true ) {
        return rightText.join( '' );
    }
    rightText.push( '<div class="gantt_task_text">' + ganttTask.text + '</div>' );
    return rightText.join( '' );
};

const getMilestoneTooltipText = ( start, end, ganttTask, ganttInstance ) => {
    let tooltipText = [];
    tooltipText.push( '<div class="gantt_tooltip_text">' );
    var icon = '<div class=\'gantt_tooltip_open_icon\' task_id=' + ganttTask.uid + '></div>';
    tooltipText.push( '<strong>' + ganttTask.text + '- </strong>' );
    tooltipText.push( icon );
    tooltipText.push( '<strong>' + ganttTask.fnd0StatusUiValue + '</strong>' );
    tooltipText.push( '<br/>' );
    tooltipText.push( '<strong>' + ganttInstance.locale.labels.timeline_label_plannedDate + ': </strong> ' + ganttInstance.templates.tooltip_date_format( new Date( ganttTask.getUiValue(
        'start_date' ) ) ) );
    return tooltipText.join( '' );
};

const canShowTooltip = ( ganttInstance ) => {
    return ganttInstance.showEventProperties !== 'true';
};

const getEventTooltip = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTooltip( ganttInstance ) ) {
        return;
    }
    let tooltipText = [];
    tooltipText.push( '<div class="gantt_tooltip_text">' );
    var icon = '<div class=\'gantt_tooltip_open_icon\' task_id=' + ganttTask.id + '></div>';
    if( ganttTask.prg0EventCode ) {
        tooltipText.push( '<strong>' + ganttTask.prg0EventCode + '- </strong>' );
    }
    tooltipText.push( '<strong>' + ganttTask.text + '</strong>' );
    tooltipText.push( icon );
    if( ganttTask.prg0State ) {
        tooltipText.push( ' -<strong>' + ganttTask.getUiValue( 'prg0State' ) + '</strong>' );
    }
    tooltipText.push( '<br/>' );

    let toolTipProperties = appCtx.ctx.preferences.PP_Event_Tooltip_Information;
    let length = toolTipProperties.length < 3 ? toolTipProperties.length : 3;
    let ganttObject = cdm.getObject( ganttTask.uid );
    if( toolTipProperties ) {
        for( let i = 0; i < length; i++ ) {
            if( ganttObject && ganttObject.props[toolTipProperties[ i ]] && ganttObject.props[toolTipProperties[ i ]].dbValues[0] ) {
                tooltipText.push( '<strong>' + ganttObject.props[toolTipProperties[ i ]].propertyDescriptor.displayName + '</strong> ' + ganttObject.props[toolTipProperties[ i ]].uiValues[0] );
                tooltipText.push( '<br/>' );
            }
        }
    }

    return tooltipText.join( '' );
};
