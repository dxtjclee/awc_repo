// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awGanttConfigService from 'js/AwGanttConfigurationService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeService from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import Pgp0PlanTimelineDataService from 'js/Pgp0PlanTimelineDataService';
import timelineLayoutService from 'js/Pgp0PlanTimelineLayoutService';
import timelineScrollService from 'js/Pgp0PlanTimelineScrollService';
import timelineCallbacks, { Pgp0PlanTimelineCallbacks } from 'js/Pgp0PlanTimelineCallbacks';
import viewModelObjectSvc from 'js/viewModelObjectService';


/**
 * Initializes the required properties for the Timeline to be loaded.
 * @param {Object} schedule The owning schedule for which the Timeline chart will be rendered
 * @param {Object} calendarInfo The calender information to be used for the Timeline chart
 * @param {Object} atomicDataRef Atomic data
 */
export const initializeTimelineChartState = ( planObj, atomicDataRef ) => {
    let zoomLevel = appCtxSvc.getCtx( 'preferences.AWC_Timeline_Zoom_Level' );
    // Update atomic data with Timeline configuration
    atomicDataRef.ganttChartState.setAtomicData( {
        ...atomicDataRef.ganttChartState.getAtomicData(),
        ganttConfig: getPlanTimelineGanttConfig(),
        zoomLevel: getValidZoomLevel( zoomLevel && zoomLevel[ 0 ] ? zoomLevel[ 0 ] : 'unit_of_time_measure', planObj ),
        callbacks: new Pgp0PlanTimelineCallbacks()
    } );

    return {
        isTimelineChartStateInited: true,
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
    timelineConfig.drag_links = appCtxSvc.getCtx( 'showHideEventDependencyFlag' );
    timelineConfig.drag_move = true;
    timelineConfig.drag_resize = true;
    timelineConfig.link_wrapper_width = 20;
    timelineConfig.order_branch = true;
    timelineConfig.order_branch_free = true;
    timelineConfig.readonly = false;
    timelineConfig.show_grid = false;
    timelineConfig.initial_scroll = false;
    timelineConfig.fit_tasks = false;
    timelineConfig.multiselect = false;
    timelineConfig.tooltip_hide_timeout = 1500;
    //When selected event has dependency and it is dragged on Timeline , then drag message comes twice
    timelineConfig.drag_multiple = false;
    return timelineConfig;
};

const attachTimelineEventCallbacks = ( ganttInstance ) => {
    if( ganttInstance ) {
        ganttInstance.event( window, 'click', function( e ) {
            timelineCallbacks.onWindowClick( e );
        } );
    }
};

/**
 * Updates the parent selection based on the local selection.
 * @param {Object} localSelectionData Local selection data
 * @param {Object} parentSelectionData Parent selection data
 */
export const updateParentSelection = ( localSelectionData, parentSelectionData ) => {
    let selObjects = [];
    localSelectionData.selected && localSelectionData.selected.forEach( ( taskId ) => {
        let ganttId = taskId;
        if( taskId.indexOf( '__' ) > -1 ) {
            taskId = taskId.substring( 0, taskId.indexOf( '__' ) );
        }
        // This will only execute if we select object on chart.
        let viewModelObject = viewModelObjectSvc.createViewModelObject( taskId );
        //updated ganttId through selected model object
        viewModelObject.ganttId = ganttId;
        selObjects.push( viewModelObject );
    } );

    if( !parentSelectionData.getValue().selected || _.xorBy( selObjects, parentSelectionData.getValue().selected, 'ganttId' ).length > 0 ) {
        parentSelectionData.update( { ...parentSelectionData.getValue(), selected: selObjects } );
    }
};

/**
 * Updates the local selection based on the parent selection.
 * @param {*} localSelectionData Local selection data
 * @param {*} parentSelectionData Parent selection data
 * @param {*} atomicDataRef Atomic data
 */
export const updateLocalSelection = ( localSelectionData, parentSelectionData, atomicDataRef ) => {
    parentSelectionData && parentSelectionData.getValue().selected && atomicDataRef.selectionData.setAtomicData( {
        id: 'selectionData',
        // updates 'selectionData' with ganttId instead of modelObject uid. This will helps 'milestone' selection
        selected: parentSelectionData.getValue().selected.map( object => object.ganttId )
    } );
};


/**
 * This will concat all the child level nodes that are expanded in state
* @param {*} nodeItems - nodes
 * @param {*} nodesToDisplay - returns expanded nodes
 * @returns nodesToDisplay
 */
let fetchNodes = ( nodeItems, nodesToDisplay ) => {
    for( let i = 0; i < nodeItems.length; i++ ) {
        if( nodeItems[i].children && nodeItems[i].children.length > 0 ) {
            nodesToDisplay = nodesToDisplay.concat( nodeItems[i].children );
        }
        let unUsedChildNodes = _.filter( nodeItems[i].children, function( childElem ) {
            return !childElem.isLeaf && childElem.isExpanded;
        } );
        if ( unUsedChildNodes && unUsedChildNodes.length > 0 ) {
            nodesToDisplay = fetchNodes( unUsedChildNodes, nodesToDisplay );
        }
    }
    return nodesToDisplay;
};

/**
 * This will return all the nodes that are in expanded state
* @param {*} nodes - nodes that are presnet
* @param {*} nodesToDisplay - expanded nodes
* @returns nodesToDisplay
 */
const getAllExpandedNodes = ( nodes, nodesToDisplay ) => {
    let unUsedNodes = _.filter( nodes, function( elem ) {
        return !elem.isLeaf && elem.isExpanded;
    } );
    nodesToDisplay = fetchNodes( unUsedNodes, nodesToDisplay );
    return nodesToDisplay;
};

/**
 * Pushes the initial data loaded in tree table to the Timeline Chart. This is done after
 * the Timeline Chart is initialized and ready to parse the data to be displayed in Timeline.
 */
export const pushInitialDataToTimeline = ( timelineDataService, treeTableData, timelineData, atomicDataRef ) => {
    let isTimelineDataInited = false;
    if( treeTableData && treeTableData.getValue().rootNode ) {
        let rootNode = treeTableData.getValue().rootNode;
        let existingNode = _.clone( rootNode );
        let allNodes = getAllExpandedNodes( existingNode.children, [] );
        let uniqueNodes = _.uniq( allNodes );
        let nodesNotSyncedWithTable = _.difference( uniqueNodes, existingNode.children  );
        _.forEach( nodesNotSyncedWithTable, function( nodes ) {
            let parentIndex = _.findIndex( existingNode.children, function( elem ) {
                return elem.uid === nodes.props.prg0ParentPlan.dbValue;
            } );
            let childrenIndx = _.findIndex( existingNode.children[parentIndex].children, function( child ) {
                return child.uid === nodes.uid;
            } );
            let indexToAdd = parentIndex + 1 + childrenIndx;
            existingNode.children.splice( indexToAdd, 0, nodes );
        } );
        treeTableData.update( { ...treeTableData.getValue(), rootNode: existingNode } );
        addTreeNodesToTimeline( timelineDataService, rootNode, atomicDataRef );
        pushEventsToTimeline( timelineData, atomicDataRef, timelineDataService );
        isTimelineDataInited = true;
        timelineLayoutService.debounceResetTimelineRowHeight( atomicDataRef.ganttChartState.getAtomicData().ganttInstance );
        // Listen to Tree table scroll to sync up Timeline scroll
        timelineScrollService.registerTable2TimelineScrollSync();
    }
    return { isTimelineDataInited: isTimelineDataInited };
};

/**
 * Traverses the given parent node, finds the children recursively and adds
 * to the Timeline Chart.
 *
 * @param {Object} timelineDataService The Timeline data service
 * @param {Object} parentNode The parent to traverse and add children.
 * @param {Object} atomicDataRef Atomic data
 */
export const addTreeNodesToTimeline = ( timelineDataService, parentNode, atomicDataRef ) => {
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }

    childNodes && childNodes.forEach( ( node ) => {
        let nodeParent = node.props.prg0ParentPlan.dbValue ? node.props.prg0ParentPlan.dbValues[0] : parentNode.uid;
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addTask( {
            ...timelineDataService.constructGanttObject( cdm.getObject( node.uid ) ),
            parent: nodeParent,
            $open: node.isExpanded && node.isExpanded === true
        },
        nodeParent );
    } );

    childNodes && childNodes.forEach( ( node ) => { addTreeNodesToTimeline( node, atomicDataRef ); } );
};

export const subscribeEvents = ( timelineDataService, atomicDataRef ) => {
    const getGanttInstance = ( atomicDataRef ) => atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let eventSubscriptions = [];
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTreeDataProvider.treeNodesLoaded', ( eventData ) => timelineCallbacks.onTreeNodesLoaded( eventData, timelineDataService,
        atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.plTable.toggleTreeNode', ( node ) => timelineCallbacks.onToggleTreeNode( node, atomicDataRef ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.dependenciesLoaded', ( eventData ) => ganttCallbacks.onDependenciesLoaded( eventData, ganttDataService, atomicDataRef ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.collapseBelow', ( eventData ) => ganttCallbacks.onCollapseBelow( eventData, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.nodesAdded', ( eventData ) => timelineCallbacks.onNodesAdded( eventData, timelineDataService, getGanttInstance(
        atomicDataRef ) ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.eventsAdded', ( eventData ) => timelineCallbacks.onEventsAdded( eventData, timelineDataService, getGanttInstance(
    //     atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.nodesRemoved', ( eventData ) => timelineCallbacks.onNodesRemoved( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.plansReordered', ( eventData ) => timelineCallbacks.onPlansReordered( eventData, getGanttInstance( atomicDataRef ) ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.dependenciesAdded', ( eventData ) => ganttCallbacks.onDependenciesAdded( eventData, ganttDataService, getGanttInstance(
    // atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.dependenciesDeleted', ( eventData ) => timelineCallbacks.onDependenciesDeleted( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'cdm.updated', ( eventData ) => timelineCallbacks.onObjectsUpdated( eventData, timelineDataService, atomicDataRef ) ) );

    return { eventSubscriptions };
};

export const pushEventsToTimeline = ( timelineData, atomicDataRef, timelineDataService ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    attachTimelineEventCallbacks( atomicDataRef.ganttChartState.getAtomicData().ganttInstance );
    if( atomicData.ganttInitialized !== true ) {
        return;
    }
    if( timelineData.eventObjects ) {
        timelineData.eventObjects.sort( ( a, b ) => a.props.prg0PlannedDate.dbValues[ 0 ] >= b.props.prg0PlannedDate.dbValues[ 0 ] ? 1 : -1 );
        let uids = [];
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.batchUpdate( () => {
            let events = [];
            timelineData.eventObjects.forEach( ( event ) => {
                let parentUid = event.props.prg0PlanObject.dbValues[ 0 ];
               
                    events.push( { ...timelineDataService.constructGanttObject( cdm.getObject( event.uid ) ),
                        parent:parentUid } );
                    uids.push( event.uid );
                
            } );

            if( events.length > 0 ) {
                atomicDataRef.ganttChartState.getAtomicData().ganttInstance.parse( { data: events, links: [] }, 'json' );
            }
        } );
        let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
        ganttInstance.recalculateStackedObjInfo( uids );
        let eventDependenciesFlag = appCtxSvc.getCtx( 'showHideEventDependencyFlag' );
        let depInfo = {
            eventsOnTimeline : timelineData.eventObjects
        };
        if( eventDependenciesFlag ) {
            eventBus.publish( 'fetchEventDependencies', depInfo );
        }
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.render();
        eventBus.publish( 'planTimelineChart.eventsAddedOnTimeline', timelineData.eventObjects );
    }
};

const getValidZoomLevel = ( zoomLevel, planObj ) => {
    // Map of UnitofTimeMeasure LOV values to Timeline zoom level names.
    const uotmZoomLevelMap = { h: 'day', d: 'day', w: 'week', q: 'quarter', mo: 'month' };
    if( zoomLevel === 'unit_of_time_measure' ) {
        zoomLevel = uotmZoomLevelMap[ _.get( planObj, 'props.prg0UnitOfTimeMeasure.dbValues[0]', 'd' ) ];
    }
    return zoomLevel;
};

export const onEventsAdded = ( eventData, timelineDataService, atomicDataRef, parentSelectionData, timelineData  ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    timelineCallbacks.onEventsAdded( eventData, timelineDataService, ganttInstance );
    let eventObjs = timelineData.getValue().eventObjects ? timelineData.getValue().eventObjects : [];
    eventObjs = eventObjs.concat( eventData.addedEvents );
    timelineData.update( { ...timelineData.getValue(), eventObjects: eventObjs } );

    const localSelectionData = {
        selected: [ eventData.addedEvents[ 0 ].uid ]
    };
    if( !appCtxSvc.getCtx( 'isCreateEventPanelPinned' ) ) {
        updateParentSelection( localSelectionData, parentSelectionData );
    }
};

export const onMilestonesAdded = ( eventData, timelineDataService, atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    timelineCallbacks.onMilestonesAdded( eventData, timelineDataService, ganttInstance );
};

export const removeMilestonesForPlans = ( eventData, atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let milestonesToHide = [];
    eventData.removeMilestonesForPlan && eventData.removeMilestonesForPlan.forEach( ( planUid ) => {
        let childObjects = ganttInstance.getChildren( planUid );
        childObjects && childObjects.forEach( ( childUid ) => {
            let schTaskUid = childUid;
            if( childUid.indexOf( '__' ) > -1 ) {
                childUid = childUid.substring( 0, childUid.indexOf( '__' ) );
            }
            let timelineObject = cdm.getObject( childUid );
            if ( timelineObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
                if ( !eventData.removedScheduleUid ||  eventData.removedScheduleUid === timelineObject.props.schedule_tag.dbValues[0] ) {
                    milestonesToHide.push( schTaskUid );
                }
            }
        } );
    } );
    timelineCallbacks.onNodesRemoved( { removedNodeUids: milestonesToHide }, ganttInstance );
};

export const setZoomLevel = ( zoomLevel, atomicDataRef, planObject ) => {
    let newZoomLevel = getValidZoomLevel( zoomLevel, planObject );
    if( atomicDataRef.ganttChartState.getAtomicData().zoomLevel !== newZoomLevel ) {
        atomicDataRef.ganttChartState.setAtomicData( { ...atomicDataRef.ganttChartState.getAtomicData(), zoomLevel: newZoomLevel } );
    }
};

let updateZoomLevelPref = _.debounce( function( prefValue, planObject, newZoomLevel ) {
    let prefZoomLevel = getValidZoomLevel( prefValue, planObject );
    if( prefZoomLevel !== newZoomLevel ) {
        appCtxSvc.updatePartialCtx( 'preferences.AWC_Timeline_Zoom_Level', [ newZoomLevel ] );
    }
}, 1000 );

export let updateTimelineZoomLevelPref = function( prefValue, planObject, newZoomLevel ) {
    updateZoomLevelPref( prefValue, planObject, newZoomLevel );
};

export const formatNewPlannedDate = ( updatedInfo ) => {
    if( updatedInfo && updatedInfo[ 0 ] && updatedInfo[ 0 ].plannedDate ) {
        return dateTimeService.formatUTC( updatedInfo[ 0 ].plannedDate );
    }
    return '';
};

export let createEventDependency = ( predecessorEventUid, successorEventUid, dependencyUid, timelineDataService, atomicDataRef ) => {
    //To handle event dependency scenario
    let dependency = cdm.getObject( dependencyUid );
    dependency.props.primary_object = {
        dbValues: [ successorEventUid ]
    };
    dependency.props.secondary_object = {
        dbValues: [ predecessorEventUid ]
    };
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addLink( timelineDataService.constructGanttObject( dependency ) );
};

export let toggleEventDependenciesDisplay = ( atomicDataRef, planNavigationContext ) => {
    let eventDependenciesFlag = appCtxSvc.getCtx( 'showHideEventDependencyFlag' );
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.show_links = !eventDependenciesFlag;
    appCtxSvc.updateCtx( 'showHideEventDependencyFlag', !eventDependenciesFlag );
    /* If the toggle is ON then:
        1. Fetch the existing dependencies and render them.
        2. Allow to create dependency
    */
    let eventsOnTimeline = getEventsFromTimeLine( atomicDataRef );
    let milestonesOnTimeline = getMilestoneFromTimeLine( atomicDataRef );
    if( !eventDependenciesFlag && eventsOnTimeline.length > 0 ) {
        //Hide event info when dependency command button is toggle on
        appCtxSvc.updateCtx( 'showEventProperties', false );
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.drag_links = !eventDependenciesFlag;
        let depInfo = {
            eventsOnTimeline : eventsOnTimeline,
            milestonesOnTimeline : milestonesOnTimeline,
            planNavigationContext : planNavigationContext
        };
        // onSuccess of 'fetchEventDependencies' SOA, event 'fetchMilestoneEventDependencies' event is published.
        // Because, fetchMilestoneEventDependencies event consumes fetchEventDependencies event response
        eventBus.publish( 'fetchEventDependencies', depInfo );
    }
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.render();
};

/**
 * Get all events from DHTMLX timeline
 *
 * @return {Array} events event list from timeline
 */
const getEventsFromTimeLine = ( atomicDataRef ) => {
    let events = [];
    // get all event list from timeline using DHTMLX API
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.eachTask( function( task ) {
        let modelObject = cdm.getObject( task.id.split( '__' )[ 0 ] );
        if( modelObject && modelObject.modelType && cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    return events;
};

export const prepareEventDepsForTimeline = ( response, atomicDataRef, timelineDataService ) => {
    for( let i = 0; i < response.output.length; i++ ) {
        let output = response.output[ i ];
        let relationshipObjects = output.relationshipData[ 0 ].relationshipObjects;
        if( relationshipObjects.length > 0 ) {
            for( let index = 0; index < relationshipObjects.length; index++ ) {
                let dependencyObj = relationshipObjects[ index ].relation;

                //secondary object is a Milestone (primary : Event, secondary : Milestone)
                let secondaryObject = cdm.getObject( dependencyObj.props.secondary_object.dbValues[0] );
                var secondaryObjectType = secondaryObject.modelType;
                if( cmm.isInstanceOf( 'ScheduleTask', secondaryObjectType ) ) {
                    let index = appCtxSvc.ctx.planNavigationCtx.milestoneSecondary.findIndex( x => x.uid === dependencyObj.uid );
                    //add if not found
                    if( index < 0 ) {
                        appCtxSvc.ctx.planNavigationCtx.milestoneSecondary.push( dependencyObj );
                    }
                }

                //condition to check secondary object is not a Milestone (primary : Event, secondary : Event)
                else if(  !atomicDataRef.ganttChartState.getAtomicData().ganttInstance.isLinkExists( dependencyObj.uid ) ) {
                    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addLink( timelineDataService.constructGanttObject( dependencyObj ) );
                }
            }
        }
    }
    // addAndRenderDependencies( dependencyObjects );
};

export const confirmDeleteOfEventDependency = ( dependenciesToDelete, atomicDataRef ) => {
    if( !dependenciesToDelete && !dependenciesToDelete.dependencyDeletes && !dependenciesToDelete.dependencyDeletes[ 0 ] ) {
        return;
    }
    let dependencyToDelete = dependenciesToDelete.dependencyDeletes[ 0 ];
    let primaryObject = cdm.getObject( dependencyToDelete.props.primary_object.dbValues[0].split( '__' )[ 0 ] );
    let secondaryObject = cdm.getObject( dependencyToDelete.props.secondary_object.dbValues[0].split( '__' )[ 0 ] );
    if(  primaryObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1  ||  secondaryObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1  ) {
        // It handle the event-milestone delete dependency
        confirmDeleteOfEventMilestoneDependency( primaryObject, secondaryObject, dependencyToDelete );
    } else{
        let secondaryEventNameString;
        let primaryEventNameString;
        let timelineDependency = atomicDataRef.ganttChartState.getAtomicData().ganttInstance.getLink( dependencyToDelete.uid );
        if( timelineDependency ) {
            let sourceObject = cdm.getObject( timelineDependency.source );
            let targetObject = cdm.getObject( timelineDependency.target );
            if( sourceObject && targetObject ) {
                secondaryEventNameString = sourceObject.props.object_name.dbValues[ 0 ];
                primaryEventNameString = targetObject.props.object_name.dbValues[ 0 ];
            }
        }
        if( secondaryEventNameString && primaryEventNameString && dependencyToDelete &&
        dependencyToDelete.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1 ) {
            var messageParams = {
                secondaryEventName: secondaryEventNameString,
                primaryEventName: primaryEventNameString
            };
            eventBus.publish( 'deleteEventConfirmationMessage', messageParams );
        }
    }
};

const confirmDeleteOfEventMilestoneDependency = ( primaryObject, secondaryObject, dependencyToDelete ) => {
    let secondaryObjectNameString;
    let primaryObjectNameString;
    let isCtxRegistered = appCtxSvc.getCtx( 'planNavigationCtx' );
    // milestone is stored in the planNavigationCtx, after delete we will consume this milestone
    if( primaryObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 && isCtxRegistered ) {
        appCtxSvc.updatePartialCtx( 'planNavigationCtx.milestoneToDelete', dependencyToDelete.props.primary_object.dbValues[0].split( '__' )[ 0 ] );
    } else if( secondaryObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 && isCtxRegistered ) {
        appCtxSvc.updatePartialCtx( 'planNavigationCtx.milestoneToDelete', dependencyToDelete.props.secondary_object.dbValues[0].split( '__' )[ 0 ] );
    }
    primaryObjectNameString = primaryObject.props.object_name.dbValues[ 0 ];
    secondaryObjectNameString = secondaryObject.props.object_name.dbValues[ 0 ];
    if( secondaryObjectNameString && primaryObjectNameString && dependencyToDelete &&
        dependencyToDelete.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1 ) {
        var messageParams = {
            secondaryEventName: secondaryObjectNameString,
            primaryEventName: primaryObjectNameString,
            dependencyDeletes: dependencyToDelete
        };
        // event is published to display confirmation message
        eventBus.publish( 'deleteEventMilestoneDepConfirmation', messageParams );
    }
};

export const selectObjectOnTimeline = ( objectUid, atomicDataRef ) => {
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( timelineInstance.isTaskExists( objectUid ) ) {
        timelineInstance.batchUpdate( function() {
            timelineInstance.eachSelectedTask( function( task_id ) {
                timelineInstance.unselectTask( task_id );
            } );
            timelineInstance.selectTask( objectUid );
            timelineInstance.showTask( objectUid );
            atomicDataRef.selectionData.setAtomicData( { ...atomicDataRef.selectionData.getAtomicData(), selected: [ objectUid ] } );
        } );
    } else //If event is not loaded OR event is loaded and its plan object is not in expanded state
    {
        eventBus.publish( 'fetchAllParentOfEvent', objectUid );
    }
};

export const getEventsFromTimeline = ( atomicDataRef ) => {
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let events = [];
    // get all event list from timeline using DHTMLX API
    timelineInstance.eachTask( function( task ) {
        let modelObject = cdm.getObject( task.id.split( '__' )[ 0 ] );
        if( modelObject && modelObject.modelType && cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    return events;
};

export const updateTimelineEvents = ( timelineEvents, atomicDataRef, timelineDataService ) => {
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    const objectUids = [];
    timelineInstance.batchUpdate( () => {
        timelineEvents.forEach( ( timelineEvent ) => {
            timelineDataService.updateGanttObject( timelineEvent.uid, timelineInstance );
            objectUids.push( timelineEvent.uid );
        } );
    } );
    timelineInstance.recalculateStackedObjInfo( objectUids );
};

export const unsubscribeEvents = ( eventSubscriptions ) => {
    // Stop listening to Tree table scroll.
    timelineScrollService.unRegisterTable2TimelineScrollSync();
    eventSubscriptions.forEach( event => event && eventBus.unsubscribe( event ) );
    return { eventSubscriptions: [] };
};

export const showHideEventInfo = ( atomicDataRef, showOrHideInfo ) => {
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.showEventProperties = showOrHideInfo;

    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.show_links = !showOrHideInfo;
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.drag_links = !showOrHideInfo;
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.show_markers = showOrHideInfo !== 'true';
    appCtxSvc.updateCtx( 'showHideEventDependencyFlag', !showOrHideInfo );
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.refreshData();
};

export let hideAllMilestones = ( rootNode, atomicDataRef ) => {
    let planObjects = [];
    getAllPlanObjects( rootNode, planObjects );
    let planUids = planObjects.map( plan => plan.uid );
    removeMilestonesForPlans( { removeMilestonesForPlan: planUids }, atomicDataRef );
};

export let showAllMilestones = ( rootNode, planNavigationContext ) => {
    let planObjects = [];
    getAllPlanObjects( rootNode, planObjects );
    eventBus.publish( 'planNavigationTree.planObjectsLoaded', { newLoadedPlanObjects: planObjects, planNavigationContext: planNavigationContext } );
};

export let getAllPlanObjects = ( rootPlanNode, planObjects ) => {
    if( rootPlanNode ) {
        let index = _.findIndex( planObjects, ( planObject ) => {
            return  planObject.uid === rootPlanNode.uid;
        } );
        //add if not found
        if( index < 0 ) {
            planObjects.push( rootPlanNode );
        }
        let childNodes = rootPlanNode.children;

        if( !childNodes && rootPlanNode.__expandState && rootPlanNode.__expandState.children ) {
            childNodes = rootPlanNode.__expandState.children;
        }
        if( childNodes ) {
            childNodes.forEach( ( node ) => {
                getAllPlanObjects( node, planObjects );
            } );
        }
    }
};

export let scrollToDateInTimeline = function( dateString, isToday, i18n, atomicDataRef ) {
    let date = new Date();
    if( !isToday ) {
        date = new Date( dateString );
    }
    let dateToScroll = new Date( date.getFullYear(), date.getMonth(), date.getDate() );
    let dateToShowInMsg = dateTimeService.formatDate( dateToScroll );
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let dates = timelineInstance.getSubtaskDates(); //gets program's first event's and last event's date
    let startDateBoundary = new Date( dates.start_date.getFullYear(), dates.start_date.getMonth(), dates.start_date.getDate() );
    let endDateBoundary = new Date( dates.end_date.getFullYear(), dates.end_date.getMonth(), dates.end_date.getDate() );
    //the below lines check whether out of program boundary dates are entered or not
    if( endDateBoundary.getTime() < dateToScroll.getTime() ) {
        let message = i18n.Pgp0GoToOutOfBoundAfter;
        let dateLast = dateTimeService.formatDate( dates.end_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateLast}}' ], {
            dateToShow: dateToShowInMsg,
            dateLast: dateLast
        } );
        messagingService.showInfo( outOfBoundMessage );
    } else if( startDateBoundary.getTime() > dateToScroll.getTime() ) {
        let message = i18n.Pgp0GoToOutOfBoundBefore;
        let dateFirst = dateTimeService.formatDate( dates.start_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateFirst}}' ], {
            dateToShow: dateToShowInMsg,
            dateFirst: dateFirst
        } );
        messagingService.showInfo( outOfBoundMessage );
    }
    //For scrolling
    let position = timelineInstance.posFromDate( dateToScroll ); //settig the leftmost position of timeline as the date
    timelineInstance.scrollTo( position ); //scrolling to the position set
};


/**
 * Create Dependency b/w Event-Milestone
 *
 * get the primary and secondary
 * if primary is schedule task
 * then get the plan value from map ==> map[uid of primary]
 * get the list of plans --> iterate and attach the uid to milestones
 * secondary Object is event --> prepare depObject for timeline() dbValues: [ milestone + '__' + milestonePlanIds[planId] ]
 * else Event
 * Event is Primary
 * secondary object is milestone -->
 * then get the plan value from map ==> map[uid of primary]
 * get the list of plans --> iterate and attach the uid to milestones+<'__'>+planId
 * secondary Object is Milestone --> prepare depObject for timeline() dbValues: [ milestone + '__' + milestonePlanIds[planId] ]
 */

export let createMilestoneEventDependency = ( dependenciesInfo, timelineDataService, atomicDataRef ) => {
    //To handle Event-Milestone dependency creation scenario
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    var mapPlanMilestoneInfo;
    if( appCtxSvc.ctx.planNavigationCtx && appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid ) {
        mapPlanMilestoneInfo = appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid;
    }
    //Map of Milestone to plan objects
    for( const dependencyInfo of dependenciesInfo ) {
        let primaryObject = cdm.getObject( dependencyInfo.primary );
        var primaryObjectType = primaryObject.modelType;
        if( cmm.isInstanceOf( 'ScheduleTask', primaryObjectType ) ) {
            let milestonePlanIds = mapPlanMilestoneInfo[dependencyInfo.primary];
            for ( let planId in milestonePlanIds ) {
                dependencyInfo.dependency.props.primary_object = {
                    dbValues: [ dependencyInfo.primary + '__' + milestonePlanIds[planId] ]
                };
                dependencyInfo.dependency.props.secondary_object = {
                    dbValues: [ dependencyInfo.secondary ]
                };
                // updating the dependency obj with planId
                dependencyInfo.dependency.planId = milestonePlanIds[planId];
                ganttInstance.addLink( timelineDataService.constructGanttObject( dependencyInfo.dependency ) );
            }
        } else{
            let milestonePlanIds = mapPlanMilestoneInfo[dependencyInfo.secondary];
            for ( let planId in milestonePlanIds ) {
                dependencyInfo.dependency.props.secondary_object = {
                    dbValues: [ dependencyInfo.secondary + '__' + milestonePlanIds[planId] ]
                };
                dependencyInfo.dependency.props.primary_object = {
                    dbValues: [ dependencyInfo.primary ]
                };
                // updating the dependency obj with planId
                dependencyInfo.dependency.planId = milestonePlanIds[planId];
                ganttInstance.addLink( timelineDataService.constructGanttObject( dependencyInfo.dependency ) );
            }
        }
    }
};

/**
 * Render Event-Milestone Dependency
 *
 */
export let renderMilestoneEventDependency = ( dependenciesInfo, timelineDataService, atomicDataRef ) => {
    //To handle Event-Milestone dependency creation scenario
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    var mapPlanMilestoneInfo;
    // Map of Milestone to plan objects
    if( appCtxSvc.ctx.planNavigationCtx && appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid ) {
        mapPlanMilestoneInfo = appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid;
    }
    if( dependenciesInfo.length > 0 ) {
        for( const dependencyInfo of dependenciesInfo ) {
            let milestonePlanIds = mapPlanMilestoneInfo[dependencyInfo.primary];
            for ( let planId in milestonePlanIds ) {
                dependencyInfo.dependency.props.primary_object = {
                    dbValues: [ dependencyInfo.primary + '__' + milestonePlanIds[planId] ]
                };
                dependencyInfo.dependency.props.secondary_object = {
                    dbValues: [ dependencyInfo.secondary ]
                };
                // updating the dependency obj with planId
                dependencyInfo.dependency.planId = milestonePlanIds[planId];
                if( !ganttInstance.isLinkExists( dependencyInfo.dependency.uid + '__' + dependencyInfo.dependency.planId ) ) {
                    ganttInstance.addLink( timelineDataService.constructGanttObject( dependencyInfo.dependency ) );
                }
            }
        }
    }

    // handle Milestone secondary scenario for rendering
    var milestoneSecondaryDepInfo;
    if( appCtxSvc.ctx.planNavigationCtx && appCtxSvc.ctx.planNavigationCtx.milestoneSecondary ) {
        milestoneSecondaryDepInfo = appCtxSvc.ctx.planNavigationCtx.milestoneSecondary;
    }
    //Note : If Show Milestone command is selected, then I update milestoneSecondary array. If milestone found then only render dependency (Event : Primary, Milestone : Secondary)
    if( milestoneSecondaryDepInfo.length > 0 ) {
        milestoneSecondaryDepInfo.forEach( ( dependencyObj )=>{
            let milestonePlanIds = mapPlanMilestoneInfo[dependencyObj.props.secondary_object.dbValues[0].split( '__' )[ 0 ]];
            for ( let planId in milestonePlanIds ) {
                let secondaryObjId = dependencyObj.props.secondary_object.dbValues[0].split( '__' )[ 0 ];
                dependencyObj.props.secondary_object = {
                    dbValues: [ secondaryObjId + '__' + milestonePlanIds[planId] ]
                };
                // updating the dependency obj with planId
                dependencyObj.planId = milestonePlanIds[planId];
                if( !ganttInstance.isLinkExists( dependencyObj.uid + '__' + dependencyObj.planId ) ) {
                    ganttInstance.addLink( timelineDataService.constructGanttObject( dependencyObj ) );
                }
            }
        } );
    }
};

/**
 * Get all milestones from DHTMLX timeline
 *
 * @return {Array} events milestone list from timeline
 */
const getMilestoneFromTimeLine = ( atomicDataRef ) => {
    let milestones = [];
    // get all milestone list from timeline using DHTMLX API
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.eachTask( function( task ) {
        let modelObject = cdm.getObject( task.id.split( '__' )[ 0 ] );
        if( modelObject && modelObject.modelType && cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType ) ) {
            milestones.push( modelObject );
        }
    } );
    return milestones;
};

/**
 * Render delete Milestone-Event Dependency
 *
 */
export let deleteMilestoneEventDependency = ( deleteDependencyUID, atomicDataRef ) => {
    if( deleteDependencyUID  ) {
        let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
        let milestoneUid;
        // Get milestone in the planNavigationCtx
        if( appCtxSvc.ctx.planNavigationCtx.milestoneToDelete ) {
            milestoneUid  = appCtxSvc.ctx.planNavigationCtx.milestoneToDelete;
        }
        var mapPlanMilestoneInfo;
        // Get milestone to plan map from planNavigationCtx
        if( appCtxSvc.ctx.planNavigationCtx && appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid ) {
            mapPlanMilestoneInfo = appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid;
        }
        let milestonePlanIds = mapPlanMilestoneInfo[milestoneUid];
        if( milestonePlanIds ) {
            for ( let planId in milestonePlanIds ) {
                //  For the Event-Milestone dep Gantt id we used [depId+'__'+planId]
                if( ganttInstance.isLinkExists( deleteDependencyUID + '__' +  milestonePlanIds[planId] ) ) {
                    ganttInstance.deleteLink( deleteDependencyUID + '__' +  milestonePlanIds[planId] );
                }
            }
        }
        appCtxSvc.ctx.planNavigationCtx.milestoneToDelete = '';
    }
};
