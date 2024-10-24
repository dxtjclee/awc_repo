// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

import _ from 'lodash';
import AwGanttCallbacks from 'js/AwGanttCallbacks';
import timelineOverrides from 'js/Pgp0PlanTimelineOverrides';
import eventBus from 'js/eventBus';
import timelineTemplates from 'js/Pgp0PlanTimelineTemplates';
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';


export class Pgp0CompareSelectedPlanCallbacks extends AwGanttCallbacks {
    constructor() {
        super();
        // this.schedule = schedule;
    }

    onBeforeGanttReady() {
        if( this.ganttInstance ) {
            super.onBeforeGanttReady();
            initializeChartsDetails( this.ganttInstance );
        }
    }

    onTaskClick() {}

    onGanttInitialized( ganttChartState ) {
        let ganttInstance = this.ganttInstance;
        if( ganttInstance && ganttChartState && ganttChartState.rootNode ) {
            super.onBeforeGanttReady();
            let uids = [];
            ganttInstance.batchUpdate( () => {
                ganttInstance.addTask( ganttChartState.rootNode );

                // This is for the plans does not have any events
                let startDate = ganttChartState.eventObjects && ganttChartState.eventObjects.length > 0 ? ganttChartState.eventObjects[0].start_date : false;
                if( ganttChartState.eventObjects ) {
                    configureChartRange( startDate, ganttChartState.offset, ganttInstance );

                    ganttChartState.eventObjects.forEach( ( event ) => {
                        ganttInstance.addTask(
                            event,
                            ganttChartState.rootNode.id );
                        uids.push( event.uid );
                    } );
                    ganttInstance.render();
                }
            } );
            ganttInstance.recalculateStackedObjInfo( uids );
        }
        attachTimelineEventCallbacks( ganttInstance );
        initializeChartsDetails( ganttInstance );
        displayLastScrollbar();
    }

    onGanttScroll( left, top ) {
        if( left ) {
            let scrollTimeout;
            clearTimeout( scrollTimeout );
            scrollTimeout = setTimeout( () => {
                let scrollData = {
                    position: left,
                    ganttInstance : this.ganttInstance
                };
                eventBus.publish( 'Pgp0ComparePlanItems.scrollUpdated', scrollData );
            }, 100 );
        }
    }

    onObjectsSelected( selectedUids, previousSelectedUids ) {
        let parentUid;
        let selectedObjectIds;
        if( selectedUids.length > 0 ) {
            const selectedEvents = selectedUids.map( id => cdm.getObject( id ) );
            parentUid = selectedEvents[0].props.prg0PlanObject.dbValues[0];
            selectedObjectIds = selectedUids;
        } else {
            const deselectedEvents = previousSelectedUids.map( id => cdm.getObject( id ) );
            parentUid = deselectedEvents[0].props.prg0PlanObject.dbValues[0];
            selectedObjectIds = null;
        }
        eventBus.publish( 'timelineChart.objectsSelected', { planUid: parentUid, selectedUid: selectedObjectIds } );
    }

    onClickToZoom() {
        return;
    }
}

let configureChartRange = ( startDate, offset, ganttInstance ) => {
    let date = new Date();
    date = startDate ? new Date( startDate ) : date;
    const previous = new Date( date.getTime() );
    previous.setDate( date.getDate() - 1 );
    ganttInstance.config.start_date = previous;
    let endDate = new Date( date.getTime() + offset * 24 * 60 * 60 * 1000 );
    const nextDate = new Date( endDate.getTime() );
    nextDate.setDate( endDate.getDate() + 1 );
    ganttInstance.config.end_date = nextDate;
    ganttInstance.render();
};

let initializeChartsDetails = ( ganttInstance ) => {
    timelineOverrides.initOverrideVariables( ganttInstance );
    timelineOverrides.addTimelineOverrides( ganttInstance );
    ganttInstance.templates.grid_folder = ( task ) => { return timelineTemplates.getGridIconTemplate( task ); };
    ganttInstance.templates.grid_file = ( task ) => { return timelineTemplates.getGridIconTemplate( task ); };
    ganttInstance.templates.task_class = ( start, end, task ) => { return timelineTemplates.getTaskClass( task ); };
    ganttInstance.templates.link_class = ( link ) => { return timelineTemplates.getLinkClass( link, ganttInstance ); };
    ganttInstance.templates.task_text = ( start, end, task ) => { return timelineTemplates.getTaskText( start, end, task, ganttInstance ); };
    ganttInstance.templates.tooltip_date_format = ( date ) => { return ganttInstance.date.date_to_str( '%d-%M-%Y' )( date ); };
    ganttInstance.templates.tooltip_text = ( start, end, task ) => { return timelineTemplates.getTooltipText( start, end, task, ganttInstance ); };
    ganttInstance.templates.rightside_text = ( start, end, task ) => { return timelineTemplates.getRightSideText( start, end, task, ganttInstance ); };
    ganttInstance.templates.leftside_text = ( start, end, task ) => { return timelineTemplates.getLeftSideText( start, end, task, ganttInstance ); };
    ganttInstance.templates.timeline_cell_class = ( task, date ) => { return timelineTemplates.getTimelineCellClass( task, date,ganttInstance ); };
};

const openObject = function( taskUid ) {
    var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};
    var options = {};

    toParams.uid = taskUid;
    options.inherit = false;

    AwStateService.instance.go( showObject, toParams, options );
};

const onWindowClick = ( e ) => {
    var target = e.target;
    if( target.className === 'gantt_tooltip_open_icon' ) {
        var taskId = target.getAttribute( 'task_id' );
        if( taskId ) {
            openObject( taskId );
        }
    }
};

export const displayLastScrollbar = function() {
    let allScrollBars = document.getElementsByClassName( 'gantt_layout_cell gantt_hor_scroll' );
    let toHideScrollBars = _.difference( allScrollBars, [ _.last( allScrollBars ) ] );
    _.forEach( toHideScrollBars, function( scrollbar ) {
        scrollbar.style.visibility = 'hidden';
    } );
};
const attachTimelineEventCallbacks = ( ganttInstance ) => {
    if( ganttInstance ) {
        ganttInstance.event( window, 'click', function( e ) {
            onWindowClick( e );
        } );
    }
};

export default {
    displayLastScrollbar
};

