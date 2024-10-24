// Copyright (c) 2022 Siemens

/**
 * @module js/Pgp0PlanTimelineScrollService
 */

import eventBus from 'js/eventBus';
import planNavTreeUtils from 'js/PlanNavigationTreeUtils';
import tableSvc from 'js/published/splmTablePublishedService';
import timelineLayoutService from 'js/Pgp0PlanTimelineLayoutService';

let exports;

let _awSubscriptions = [];
let _tableScrollBar = null;
let isScrollListenerRegistered = false;

/**
 * @returns the scroll bar of the plan navigation tree table.
 */
let getTableScrollBar = () => {
    let tableScrollBar = null;
    let planNavigationTreeTable = planNavTreeUtils.getPlanNavigationTreeTableElement();
    if( planNavigationTreeTable ) {
        tableScrollBar = tableSvc.getTableScrollBar( planNavigationTreeTable );
    }
    return tableScrollBar;
};

/**
 * @returns the scroll bar of the plan navigation timeline.
 */
let getTimelineScrollBar = () => {
    let timelineScrollBar = null;
    let planNavigationTimeline = planNavTreeUtils.getPlanNavigationTimelineElement();
    if( planNavigationTimeline ) {
        timelineScrollBar = planNavigationTimeline.getElementsByClassName( 'gantt_ver_scroll' )[ 0 ];
    }

    return timelineScrollBar;
};

/**
 * Scrolls the tree table based on the Timeline scrollbar position.
 */
export let scrollTable = () => {
    let tableScrollBar = getTableScrollBar();
    let timelineScrollBar = getTimelineScrollBar();
    if( tableScrollBar && timelineScrollBar && tableScrollBar.scrollTop !== timelineScrollBar.scrollTop ) {
        tableScrollBar.scrollTop = timelineScrollBar.scrollTop;
    }
};

/**
 * Callback function to scroll the Timeline based on the tree table scroll position.
 *
 * @param {object} event object containing the scroll event information
 */
let scrollTimelineCallbackFn = ( event ) => {
    let timelineScrollBar = getTimelineScrollBar();

    if( event.currentTarget && timelineScrollBar && event.currentTarget.scrollTop !== timelineScrollBar.scrollTop ) {
        timelineScrollBar.scrollTop = event.currentTarget.scrollTop;
    }
};

/**
 * Registers a scroll event listener to table scroll bar, to scroll the Timeline
 * based on the table scroll position.
 */
export let registerTable2TimelineScrollSync = function() {
    if( isScrollListenerRegistered ) {
        return;
    }

    _tableScrollBar = getTableScrollBar();
    if( _tableScrollBar && !isScrollListenerRegistered ) {
        // Register only once
        _tableScrollBar.addEventListener( 'scroll', scrollTimelineCallbackFn );

        _awSubscriptions.push( eventBus.subscribe( 'aw.windowResize', () => {
            let timelineEl = document.getElementById( 'planNavigationTimeline' );
            if( timelineEl ) {
                timelineLayoutService.debounceResetTimelineRowHeight( timelineEl.gantt );
            }
        } ) );

        isScrollListenerRegistered = true;
    }
};

/**
 * Removes the scroll event listener from table scroll bar.
 */
export let unRegisterTable2TimelineScrollSync = () => {
    if( _tableScrollBar ) {
        _tableScrollBar.removeEventListener( 'scroll', scrollTimelineCallbackFn );
        _tableScrollBar = null;
        isScrollListenerRegistered = false;
    }
    for( const awEvent of _awSubscriptions ) {
        eventBus.unsubscribe( awEvent );
    }
    _awSubscriptions = [];
};

exports = {
    scrollTable,
    registerTable2TimelineScrollSync,
    unRegisterTable2TimelineScrollSync
};

export default exports;
