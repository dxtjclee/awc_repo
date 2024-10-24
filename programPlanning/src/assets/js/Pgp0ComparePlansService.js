// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/Pgp0ComparePlansService
 */


import awGanttConfigService from 'js/AwGanttConfigurationService';
import  { Pgp0CompareSelectedPlanCallbacks } from 'js/Pgp0CompareSelectedPlanCallbacks';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';

import Pgp0PlanTimelineDataService from 'js/Pgp0PlanTimelineDataService';

var exports = {};
let offset = 0;

export let updateObjectInContext = function( openedObj, selectedObjs ) {
    let currentPlan = openedObj;
    if( typeof selectedObjs !== typeof undefined && selectedObjs.length > 0 ) {
        currentPlan = selectedObjs[0];
    }
    return {
        selectedPlanUid : currentPlan.uid,
        openedObjUid: openedObj.uid
    };
};


/**
  * Initializes the required properties for the Timeline to be loaded.
  * @param {Object} listOfPlans list of plans whose timeline is to be rendered
  * @param {Object} planEventsMap plan-event map
  * @returns {String} required properties
  */
export const initializeRefPlansChartState = (  listOfPlans, planEventsMap, atomicDataRef ) => {
    let refPlansPropArr = [];

    let selectionData = [];

    let chartState = [];
    for( let i = 1; i < listOfPlans.length; i++ ) {
        let timelineDataService = new Pgp0PlanTimelineDataService();
        let chartData = {
            zoomLevel: atomicDataRef.sourcePlanGanttChartState.getAtomicData().zoomLevel ? atomicDataRef.sourcePlanGanttChartState.getAtomicData().zoomLevel : 'day',
            ganttConfig: getPlanTimelineGanttConfig(),
            callbacks: new Pgp0CompareSelectedPlanCallbacks(),
            rootNode: timelineDataService.constructGanttObject( cdm.getObject( listOfPlans[i].uid ) ),
            eventObjects: fetchEvents( planEventsMap[listOfPlans[i].uid], timelineDataService )
        };
        chartState.push( {
            zoomLevel: chartData.zoomLevel,
            ganttConfig: chartData.ganttConfig,
            callbacks: chartData.callbacks,
            rootNode: chartData.rootNode,
            eventObjects: chartData.eventObjects,
            zoomLevels: [ 'year', 'month', 'quarter', 'week', 'day' ]
        } );
        refPlansPropArr.push( {
            displayName: 'Label',
            dbValue: 'refplans',
            type: 'STRING',
            dispValue: chartData.rootNode.text,
            labelPosition: 'NO_PROPERTY_LABEL'
        } );
        selectionData.push( {} );
    }

    _.forEach( chartState, function( state ) {
        state.offset = offset;
    } );

    return {
        states: chartState,
        isRefPlansStateReady: true,
        plansNameArr: refPlansPropArr,
        selectionData: selectionData
    };
};
export const initializeSourceTimelineChartState = ( planObj, atomicDataRef ) => {
    appCtxService.updatePartialCtx( 'preferences.AWC_Timeline_Zoom_Level', [ 'day' ] );
    atomicDataRef.sourcePlanGanttChartState.setAtomicData( {
        ...atomicDataRef.sourcePlanGanttChartState.getAtomicData(),
        ganttConfig: getPlanTimelineGanttConfig(),
        zoomLevel: 'day',
        callbacks: new Pgp0CompareSelectedPlanCallbacks()
    } );

    return {
        isSelectedPlanReady: true,
        timelineDataService: new Pgp0PlanTimelineDataService()
    };
};

/**
  * Initialize the basic Timeline properties for loading the Timeline chart.
  * @param {Date} startDate The start date of the Timeline chart.
  * @param {Date} endDate The finish date of the Timeline chart.
  * @returns {Object} The Timeline properties
  */
const getPlanTimelineGanttConfig = () => {
    let timelineConfig = awGanttConfigService.getDefaultConfiguration();
    timelineConfig.scale_height = 72; // XLARGE
    timelineConfig.bar_height = 'full';
    timelineConfig.drag_move = false;
    timelineConfig.drag_resize = false;
    timelineConfig.link_wrapper_width = 20;
    timelineConfig.order_branch = true;
    timelineConfig.order_branch_free = true;
    timelineConfig.readonly = true;
    timelineConfig.show_grid = false;
    timelineConfig.fit_tasks = false;
    timelineConfig.multiselect = true;
    timelineConfig.tooltip_hide_timeout = 1500;
    return timelineConfig;
};


export const parseRefPlanAndEventObjects = ( response, planObjectsArr ) => {
    let planEventMap = {};
    let refPlanArr = _.difference( planObjectsArr, [ planObjectsArr[0] ] );
    _.forEach( refPlanArr, function( plan ) {
        let events = _.filter( response.modelObjects, function( o ) {
            if( o.props && o.props.prg0PlanObject && o.props.prg0PlanObject.dbValues ) {
                return o.props.prg0PlanObject.dbValues[0] === plan.uid;
            }
        } );
        planEventMap[plan.uid] = events;
    } );
    return planEventMap;
};
export const pushInitialDataToTimeline = ( atomicDataRef, modelObject, timelineDataService, sourcePlanEventsRes ) => {
    let ganttInstance = atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance;
    if( ganttInstance ) {
        let uids = [];
        ganttInstance.batchUpdate( () => {
            let rootNode = timelineDataService.constructGanttObject( modelObject );
            ganttInstance.addTask( rootNode );
            if( sourcePlanEventsRes && sourcePlanEventsRes.plain && sourcePlanEventsRes.plain.length > 0 ) {
                let sourceEventsUids = sourcePlanEventsRes.plain;
                let sourcePlanEvenObjs = [];
                sourceEventsUids.forEach( function( eventUid ) {
                    sourcePlanEvenObjs.push( sourcePlanEventsRes.modelObjects[eventUid] );
                } );
                uids = pushEventsToTimeline( sourcePlanEvenObjs, atomicDataRef, timelineDataService, modelObject.uid );
            }
        } );
        ganttInstance.recalculateStackedObjInfo( uids );
    }
};

let calculateOffSetForScale = ( firstEventDate, lastEventDate ) => {
    let diffInTime = new Date( lastEventDate ).getTime() - new Date( firstEventDate ).getTime();
    let diffInDays = diffInTime / ( 1000 * 3600 * 24 );
    offset = diffInDays > offset ? diffInDays : offset;
};

const fetchEvents = ( relatedEvents, timelineDataService ) => {
    if( relatedEvents && relatedEvents.length > 0 ) {
        let eventGanttObjs = [];
        relatedEvents.sort( ( a, b ) => a.props.prg0PlannedDate.dbValues[ 0 ] >= b.props.prg0PlannedDate.dbValues[ 0 ] ? 1 : -1 );
        relatedEvents.forEach( ( event ) => {
            eventGanttObjs.push( timelineDataService.constructGanttObject( cdm.getObject( event.uid ) ) );
        } );
        calculateOffSetForScale( eventGanttObjs[0].start_date, _.last( eventGanttObjs ).start_date );
        return eventGanttObjs;
    }
};

const pushEventsToTimeline = ( events, atomicDataRef, timelineDataService, parentUid ) => {
    let atomicData = atomicDataRef.sourcePlanGanttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }
    let eventObjects = _.filter( events, function( o ) {
        if( o.props && o.props.prg0PlanObject && o.props.prg0PlanObject.dbValues ) {
            return o.props.prg0PlanObject.dbValues[0] === parentUid;
        }
    } );
    eventObjects.sort( ( a, b ) => a.props.prg0PlannedDate.dbValues[ 0 ] >= b.props.prg0PlannedDate.dbValues[ 0 ] ? 1 : -1 );
    configureChartRange( eventObjects[0].props.prg0PlannedDate.dbValues[ 0 ], atomicDataRef );
    calculateOffSetForScale( eventObjects[0].props.prg0PlannedDate.dbValues[ 0 ],  _.last( eventObjects ).props.prg0PlannedDate.dbValues[ 0 ] );
    let uids = [];
    eventObjects.forEach( ( event ) => {
        atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance.addTask(
            timelineDataService.constructGanttObject( cdm.getObject( event.uid ) ),
            parentUid );
        uids.push( event.uid );
    } );
    return uids;
};

let configureChartRange = ( startDate, atomicDataRef ) => {
    let date = new Date( startDate );
    const previous = new Date( date.getTime() );
    previous.setDate( date.getDate() - 1 );
    let ganttInstance = atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance;
    ganttInstance.config.start_date = previous;
    ganttInstance.render();
};


const removeExisitngPlansFromPWA = ( planFlag ) => {
    let newFlag = _.clone( planFlag );
    newFlag = false;
    return newFlag;
};


const updateSourcePlanName = ( obj, prop ) => {
    let updatedProp = _.clone( prop );
    updatedProp.dispValue = obj.props.object_name.dbValues[0];
    return updatedProp;
};

export const setZoomLevel = ( newZoomLevel, atomicDataRef ) => {
    // for source plan
    if( atomicDataRef.sourcePlanGanttChartState.getAtomicData().zoomLevel !== newZoomLevel ) {
        atomicDataRef.sourcePlanGanttChartState.setAtomicData( { ...atomicDataRef.sourcePlanGanttChartState.getAtomicData(), zoomLevel: newZoomLevel } );
    }

    // for ref plan
    let refChartStates = atomicDataRef.ganttChartStates.getAtomicData();
    for( let i = 0; i < refChartStates.chartState.length; i++ ) {
        refChartStates.chartState[i].zoomLevel = newZoomLevel;
    }
    atomicDataRef.ganttChartStates.setAtomicData( { ...atomicDataRef.ganttChartStates.getAtomicData() } );
};

export const showHideEventInfo = ( atomicDataRef, showOrHideInfo, refChartStates ) => {
    atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance.showEventProperties = showOrHideInfo;
    atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance.config.show_markers = showOrHideInfo !== 'true';
    atomicDataRef.sourcePlanGanttChartState.setAtomicData( { ...atomicDataRef.sourcePlanGanttChartState.getAtomicData() } );
    atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance.render();
    for( let i = 0; i < refChartStates.chartState.length; i++ ) {
        refChartStates.chartState[i].ganttInstance.showEventProperties = showOrHideInfo;
        refChartStates.chartState[i].ganttInstance.config.show_markers = showOrHideInfo !== 'true';
    }
    atomicDataRef.ganttChartStates.setAtomicData( { ...atomicDataRef.ganttChartStates.getAtomicData() } );
    for( let i = 0; i < refChartStates.chartState.length; i++ ) {
        refChartStates.chartState[i].ganttInstance.render();
    }
};

export const updateChartRangeForSourcePlan = ( atomicDataRef ) => {
    let ganttInstance = atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance;
    if( ganttInstance ) {
        let startDate = ganttInstance.config.start_date;
        // This is for the plan items which do not have any events
        if( !startDate ) {
            ganttInstance.config.start_date = new Date();
            startDate = new Date();
        }
        let endDate = new Date( startDate.getTime() + offset * 24 * 60 * 60 * 1000 );
        const nextDate = new Date( endDate.getTime() );
        nextDate.setDate( endDate.getDate() + 1 );
        ganttInstance.config.end_date = nextDate;
        ganttInstance.render();
    }
};

export let setModelObjects = function( selectionData, eventData, planObjects ) {
    let objectsSelected = [];
    let planEventMap = {};
    if( eventData.selectedUid ) {
        planEventMap[eventData.planUid] = eventData.selectedUid;
    } else {
        planEventMap[eventData.planUid] = null;
    }
    for( let plan in planEventMap ) {
        if( planEventMap[plan] ) {
            selectionData[plan] = planEventMap[plan];
        } else if ( selectionData[plan] && planEventMap[plan] === null ) {
            delete selectionData[plan];
        }
    }
    for( let plan in selectionData ) {
        let selectedData = selectionData[plan];
        objectsSelected = objectsSelected.concat( selectedData.map( id => cdm.getObject( id ) ) );
    }
    if( objectsSelected.length === 0 ) {
        objectsSelected = planObjects;
    }
    return {
        selectionData: selectionData,
        objectsSelected: objectsSelected
    };
};

export let getBaseSelection = function( currentPlan, referencePlans ) {
    let planObjects = [ cdm.getObject( currentPlan ) ];
    let planList = referencePlans.split( ',' );
    for( let i = 0; i < planList.length; i++ ) {
        planObjects = planObjects.concat( cdm.getObject( planList[i] ) );
    }
    let uids = _.map( planObjects, 'uid' );
    return {
        objs : planObjects,
        uids : uids
    };
};

export let scrollCharts = ( atomicDataRef, eventData, refChartStates ) => {
    let sourcePlanInstance = atomicDataRef.sourcePlanGanttChartState.getAtomicData().ganttInstance;
    let allChartInstances = [ sourcePlanInstance ];
    let lastRefInstance = _.last( refChartStates ).ganttInstance;
    let isScrolled = false;
    for( let i = 0; i < refChartStates.length - 1; i++ ) {
        allChartInstances.push( refChartStates[i].ganttInstance );
    }
    // When last ref plan is scrolled
    if( !isScrolled ) {
        let lastRefPlanScrolled = _.isEqual( eventData.ganttInstance, lastRefInstance );
        if( lastRefPlanScrolled || !eventData.ganttInstance ) {
            isScrolled = true;
            _.forEach( allChartInstances, function( instance ) {
                instance.scrollTo( lastRefInstance.getScrollState().x );
            } );
        }
    }
};

export const removePlanFromPWA = ( refChartStates, cmdContext  ) => {
    if( cmdContext ) {
        let newChartStates = _.remove( refChartStates, function( item ) {
            return item.rootNode.uid === cmdContext.rootNode.uid;
        } );
        return {
            refChartStateArr: newChartStates,
            isUpdated : false
        };
    }
};
export const updateURLPramas = ( cmdContext, modelObjects  ) => {
    let objects = _.clone( modelObjects );
    let stateSvc = AwStateService.instance;
    let state = appCtxService.getCtx( 'state' );
    let comparePlanUidsArr = state.params.comparePlanUids.split( ',' );
    let index = _.findIndex( comparePlanUidsArr, function( item ) {
        return item === cmdContext.rootNode.uid;
    } );
    let objsIndex = _.findIndex( objects, function( obj ) {
        return obj.uid === cmdContext.rootNode.uid;
    } );
    if( objsIndex > -1 ) {
        objects.splice( objsIndex, 1 );
    }
    comparePlanUidsArr.splice( index, 1 );
    let navigationParams = {
        uid : state.params.uid,
        comparePlanUids : comparePlanUidsArr.toString()
    };
    let newState = {
        params: navigationParams
    };
    appCtxService.updateCtx( 'state', newState );
    stateSvc.go( stateSvc.current.name, navigationParams );
    return {
        isUpdated : true,
        objs : objects
    };
};

export let resetEventSelection = function( isRefPlansStateReady, sourcePlanGanttChartState, selectionData ) {
    if( isRefPlansStateReady && sourcePlanGanttChartState.getAtomicData().ganttInstance ) {
        sourcePlanGanttChartState.getAtomicData().ganttInstance.eachSelectedTask( ( taskId ) => {
            sourcePlanGanttChartState.getAtomicData().ganttInstance.unselectTask( taskId );
        } );
        selectionData = {};
        return {
            selectionData: selectionData
        };
    }
};

exports = {
    updateObjectInContext,
    pushInitialDataToTimeline,
    parseRefPlanAndEventObjects,
    initializeSourceTimelineChartState,
    initializeRefPlansChartState,
    removeExisitngPlansFromPWA,
    updateSourcePlanName,
    setZoomLevel,
    showHideEventInfo,
    updateChartRangeForSourcePlan,
    setModelObjects,
    getBaseSelection,
    resetEventSelection,
    scrollCharts,
    removePlanFromPWA,
    updateURLPramas
};

export default exports;

