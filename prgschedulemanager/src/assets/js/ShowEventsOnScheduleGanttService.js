// Copyright (c) 2022 Siemens

/**
 * @module js/ShowEventsOnScheduleGanttService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';

let MAX_TO_LOAD = 20000000;
let MAX_TO_RETURN = 20000000;
let PROVIDER_NAME = 'Psi0PrgObjsSearchProvider';
let SEARCH_CONTENT_TYPE = 'schedulePlanEvents';
let SEARCH_FILTER_FIELD_SORT_TYPE = 'Alphabetical';

let exports = {};
let _ganttInitializedEventListener;
let _programEventUpdateListener;
let _ganttProgramEventsListener;
let _unsubscribeProgramEventListener;

/**
 *  Registers a listener fo Gantt widget initialization
 */
let registerGanttInitializedEventsEventListener = function() {
    if ( !_ganttInitializedEventListener ) {
        _ganttInitializedEventListener = eventBus.subscribe( 'ScheduleGantt.checkForEventsAfterGanttInitialized', function() {
            updateGanttWithProgramEvents();
        } );
    }
};

let registerProgramEventUpdateListener = function() {
    if ( !_programEventUpdateListener ) {
        _programEventUpdateListener = eventBus.subscribe( 'cdm.updated', function( eventData ) {
            let eventObject = _.find( eventData.updatedObjects, function( modelObject ) { return modelObject.modelType.typeHierarchyArray.includes( 'Prg0AbsEvent' ); } );
            if ( eventObject ) {
                updateGanttWithProgramEvents();
            }
        } );
    }
};

let  registerGanttProgramEventsListener = function() {
    if ( !_ganttProgramEventsListener ) {
        _ganttProgramEventsListener = eventBus.subscribe( 'prgSchedule.checkProgramEvents', function() {
            updateGanttWithProgramEvents();
        } );
    }
};

let  unsubscribeProgramEventListener = function() {
    if ( !_unsubscribeProgramEventListener ) {
        _unsubscribeProgramEventListener = eventBus.subscribe( 'prgSchedule.unsubscribeProgramEventListener', function() {
            unregisterListenersOnGanttForProgramEventsCommand();
        } );
    }
};

export let registerListenersOnGanttForProgramEventsCommand = function() {
    registerGanttInitializedEventsEventListener();
    registerProgramEventUpdateListener();
    registerGanttProgramEventsListener();
    unsubscribeProgramEventListener();
};

export let unregisterListenersOnGanttForProgramEventsCommand = function() {
    if ( _ganttInitializedEventListener ) {
        eventBus.unsubscribe( _ganttInitializedEventListener );
        _ganttInitializedEventListener = null;
    }
    if ( _programEventUpdateListener ) {
        eventBus.unsubscribe( _programEventUpdateListener );
        _programEventUpdateListener = null;
    }
    if ( _ganttProgramEventsListener ) {
        eventBus.unsubscribe( _ganttProgramEventsListener );
        _ganttProgramEventsListener = null;
    }
    if ( _unsubscribeProgramEventListener ) {
        eventBus.unsubscribe( _unsubscribeProgramEventListener );
        _unsubscribeProgramEventListener = null;
    }
};


let updateGanttWithProgramEvents = function() {
    if ( appCtxSvc.ctx.isSchedulePlanEventsShown && appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' )[0].toLowerCase() === 'true' && appCtxSvc.ctx.pselected ) {
        let scheduleUid = appCtxSvc.ctx.pselected.uid;
        let scheduleSummaryTaskUid = appCtxSvc.ctx.pselected.props.fnd0SummaryTask.dbValues[0];
        fetchGanttEvents( scheduleUid, scheduleSummaryTaskUid );
    }
};


/**
 * Fetches the gantt events for the selected schedule object
 * and updates the parent of each of the events with the scheduleSummaryTaskUid
 * @param {string} scheduleUid  uid of the selected schedule object
 * @param {string} scheduleSummaryTaskUid uid of the summary task which would serve as the parent for the events
 */
export let fetchGanttEvents = function( scheduleUid, scheduleSummaryTaskUid ) {
    // construct the data provide inputs
    let searchSOAInput = {};
    searchSOAInput.maxToLoad = MAX_TO_LOAD;
    searchSOAInput.maxToReturn = MAX_TO_RETURN;
    searchSOAInput.providerName = PROVIDER_NAME;
    searchSOAInput.searchCriteria = {
        searchContentType: SEARCH_CONTENT_TYPE,
        searchString: '',
        scheduleUid: scheduleUid
    };
    searchSOAInput.searchFilterFieldSortType = SEARCH_FILTER_FIELD_SORT_TYPE;
    searchSOAInput.searchFilterMap = {};
    searchSOAInput.searchSortCriteria = [];
    searchSOAInput.startIndex = 0;

    return soaSvc
        .post( 'Internal-AWS2-2016-03-Finder', 'performSearch', {
            searchInput: searchSOAInput
        } )
        .then( ( response ) => {
            for ( let i = 0; i < response.totalFound; i++ ) {
                response.searchResults[i].ganttParent = scheduleSummaryTaskUid;
            }
            let sortedEvents = _.sortBy( response.searchResults, function( event ) {
                return event.props.prg0PlannedDate.dbValues[0];
            } );
            eventBus.publish( 'prgSchedule.renderAddedEventsOnGantt', {
                addedNodes: sortedEvents
            } );

            return response.totalFound;
        } )
        .catch( ( error ) => {
            console.log( 'encountered exception: ' + error );
        } );
};

export default exports = {
    fetchGanttEvents,
    registerListenersOnGanttForProgramEventsCommand,
    unregisterListenersOnGanttForProgramEventsCommand
};
