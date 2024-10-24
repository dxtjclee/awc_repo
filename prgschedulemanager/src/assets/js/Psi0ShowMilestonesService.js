// Copyright (c) 2022 Siemens

/**
 * @module js/Psi0ShowMilestonesService
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import stackedEventsSvc from 'js/StackedEventsService';
import soaSvc from 'soa/kernel/soaService';
import logger from 'js/logger';
import psmConstants from 'js/ProgramScheduleManagerConstants';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';

let exports = {};
var _milestoneEvents = [];

var policyId = {
    types: [ {
        name: 'ScheduleTask',
        properties: [ {
            name: 'start_date'
        }, {
            name: 'finish_date'
        }, {
            name: 'fnd0status'
        }, {
            name: 'object_string'
        }, {
            name: 'schedule_tag'
        } ]
    } ]
};

/**
 * Subscribes to reloadMilestonesOnTimeline event to call method reloadMilestones
 */
export let subscribeMilestoneEvents = function() {
    if( _milestoneEvents.length === 0 ) {
        _milestoneEvents.push( eventBus.subscribe( 'planNavigationTree.planObjectsLoaded', function( eventData ) {
            if( eventData && eventData.planNavigationContext && eventData.planNavigationContext.showMilestonesOperation === psmConstants.OPERATION_TYPE_FOR_SHOW_AND_HIDE_MILESTONES
                .SHOW_ALL ) {
                showAllMilestonesForTreeChange( eventData.newLoadedPlanObjects );
            }
            if( eventData && eventData.planNavigationContext && eventData.planNavigationContext.showMilestonesOperation === psmConstants.OPERATION_TYPE_FOR_SHOW_AND_HIDE_MILESTONES
                .SHOW_SELECTED ) {
                let selectedPlanUids = eventData.planNavigationContext.selectedPlansForShowMilestones;
                let selectedObjects = eventData.newLoadedPlanObjects.filter( object => selectedPlanUids.includes( object.uid ) );
                showMilestonesOnTimeline( selectedObjects, 0, '' );
            }
        } ) );
    }
};

/**
 * Unsubscribes reloadMilestonesOnTimeline event
 */
export let unsubscribeMilestoneEvents = function() {
    if( _milestoneEvents.length > 0 ) {
        _milestoneEvents.forEach( ( event ) => {
            eventBus.unsubscribe( event );
        } );
    }
    _milestoneEvents = [];
};

/**
 * Performs performSearchViewModel5 call to show Milestones on Timeline
 * @param {String} operation - 'SHOW_ALL'      - Show all the milestones
 *                           - 'SHOW_SELECTED' - Show the milestones for selected levels
 *                           -  If not specified then it is a reload Milestone call
 * @param {int} startIndex start index input to SOA
 * @param {String} clientScopeURI  clientScopeURI input to SOA
 */
export let showMilestones = function( commandContext, operation, startIndex, clientScopeURI, selectedPlanObjects ) {
    if( commandContext ) {
        let commandContextValue = commandContext.getValue();
        let selectedPlansForShowMilestones = commandContextValue.selectedPlansForShowMilestones;
        let planUids = selectedPlanObjects.map( object => object.uid );
        selectedPlansForShowMilestones = selectedPlansForShowMilestones.concat( planUids );
        commandContext.update( { ...commandContext.getValue(), showMilestonesOperation: operation, selectedPlansForShowMilestones: selectedPlansForShowMilestones } );
    }
    showMilestonesOnTimeline( selectedPlanObjects, startIndex, clientScopeURI );
};

export const showAllMilestonesForTreeChange = ( newPlanObjects ) => {
    showMilestonesOnTimeline( newPlanObjects, 0, '' );
};

const showMilestonesOnTimeline = ( planObjects, startIndex, clientScopeURI ) => {
    let planUIDString = convertObjArrayToUidString( planObjects );
    if( planUIDString ) {
        const searchSOAInput = getPerformSearchSOAInput( planUIDString, startIndex, clientScopeURI );
        return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', {
            columnConfigInput: searchSOAInput.columnConfigInput,
            searchInput: searchSOAInput.searchInput,
            inflateProperties: false,
            noServiceData: false
        }, policyId ).then( function( response ) {
            processMilestones( response );
            return response.totalFound;
        },
        function( error ) {
            logger.error( 'Error occurred ' + error );
        } );
    }
};

export const updateTimelineState = ( planNavigationContext, operation ) => {
    if( planNavigationContext ) {
        planNavigationContext.update( { ...planNavigationContext.getValue(), showMilestonesOperation: operation } );
    }
};

/**
 * Returns input for performSearchViewModel SOA call
 * @param {String} parentplanUIDs Comma separated planUids input to SOA
 * @param {int} startIndex start index input to SOA
 * @param {String} clientScopeURI  clientScopeURI input to SOA
 * @returns {*} input for SOA performSearchViewModel
 */
var getPerformSearchSOAInput = function( parentplanUIDs, startIndex, clientScopeURI ) {
    let startIndexLocal = 0;
    if( startIndex ) {
        startIndexLocal = startIndex;
    }

    let clientScopeURILocal = '';
    if( clientScopeURI ) {
        clientScopeURILocal = clientScopeURI;
    }

    return {
        searchInput: {
            attributesToInflate: [],
            maxToLoad: 20000000,
            maxToReturn: 20000000,
            providerName: 'Psi0ScheduleSearchProvider',
            searchCriteria: {
                planUids: parentplanUIDs,
                searchContentType: 'ScheduleMilestones',
                returnParentHierarchy: false,
                searchEventRecursive: false
            },
            searchFilterFieldSortType: 'Priority',
            cursor: {
                startIndex: startIndexLocal
            }
        },
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: clientScopeURILocal
        }
    };
};

/**
 * Format the array of objects into comma separated UID string
 * @param {Array} objectArray array of objects
 * @returns comma separated uid string
 */
const convertObjArrayToUidString = ( objectArray ) => {
    let uidString = '';
    if( objectArray && objectArray.length > 0 ) {
        objectArray.map( ( object ) => { uidString += object.uid + ','; } );
        uidString = uidString.substring( 0, uidString.length - 1 );
    }
    return uidString;
};

/**
 * update milestone view based on timeline plan uid selection.
 * @param {object} soaResponse response for performSearch Soa.
 */
export let processMilestones = function( soaResponse ) {
    var searchResults = JSON.parse( soaResponse.searchResultsJSON );
    var planMilestoneMap = {};
    var ganttMilestoneArray = [];

    var mapPlanMilestoneInfo = new Map();
    var mapOfAdjEventAndOffset = new Map();
    var milestonesToPlansMap = {};
    var planUid;
    // flag to check if Milestones are returned. This handles the case where user do not have read access to milestones
    let isMilestonePresentInResponse = false;
    for( let index = 0; index < searchResults.objects.length; index++ ) {
        let searchedUid = searchResults.objects[ index ].uid;
        let searchedObj = cdm.getObject( searchedUid );

        if( searchedObj && searchedObj.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ) {
            planUid = searchedObj.uid;
            planMilestoneMap[ planUid ] = [];
        } else if( searchedObj && searchedObj.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
            planMilestoneMap[ planUid ].push( searchedObj );
            // Need to intialize one time
            if( !milestonesToPlansMap[ searchedUid ]  ) {
                milestonesToPlansMap[ searchedUid ] = [];
            }
            milestonesToPlansMap[ searchedUid ].push( planUid );
            isMilestonePresentInResponse = true;
        }
    }

    // consuming to render the dependency
    if( _.isEmpty( appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid ) ) {
        let isCtxRegistered = appCtxSvc.getCtx( 'planNavigationCtx' );
        if( isCtxRegistered.showMilestonesToPlansUid ) {
            appCtxSvc.updatePartialCtx( 'planNavigationCtx.showMilestonesToPlansUid', milestonesToPlansMap );
        }
    } else{
        updateShowMilestonesToPlansUidMap( milestonesToPlansMap );
    }
    if( !isMilestonePresentInResponse ) {
        let sourceModule = 'PrgScheduleManagerMessages';
        let localTextBundle = localeSvc.getLoadedText( sourceModule );
        let showMilestonesInfoMsg = localTextBundle.showMilestonesInfoMsg;
        messagingService.showInfo( showMilestonesInfoMsg );
        return;
    }
    let isTimelineEnabled = appCtxSvc.getCtx( 'preferences.AW_SubLocation_PlanNavigationSubLocation_ShowTimeline' );
    if( isTimelineEnabled && isTimelineEnabled[ 0 ].toLowerCase() === 'true' && appCtxSvc.ctx.planNavigationCtx.isTimelineInitialized ) {
        let planSortedMilestonesMap = {};
        for( let planUid in planMilestoneMap ) {
            let milestones = planMilestoneMap[ planUid ];
            if( milestones ) {
                milestones.sort( ( a, b ) => a.props.start_date.dbValues[ 0 ] > b.props.start_date.dbValues[ 0 ] ? 1 : -1 );
                planSortedMilestonesMap[ planUid ] = milestones;
                mapOfAdjEventAndOffset = stackedEventsSvc.findAdjEventAndOffsetMilestone( milestones );
                mapPlanMilestoneInfo.set( planUid, mapOfAdjEventAndOffset );
            }
        }
        if( appCtxSvc.ctx.popupContext.mapParentPlanMilestone && appCtxSvc.ctx.popupContext.mapParentPlanMilestone.size > 0 ) {
            for( const [ planUid, mapOfEventOffsets ] of mapPlanMilestoneInfo.entries() ) {
                let finalMap = appCtxSvc.ctx.popupContext.mapParentPlanMilestone;
                if( !finalMap.get( planUid ) ) {
                    finalMap.set( planUid, mapOfEventOffsets );
                    appCtxSvc.ctx.popupContext.mapParentPlanMilestone = finalMap;
                }
            }
        } else if( appCtxSvc.ctx.popupContext.mapParentPlanMilestone && appCtxSvc.ctx.popupContext.mapParentPlanMilestone.size <= 0 ) {
            appCtxSvc.ctx.popupContext.mapParentPlanMilestone = mapPlanMilestoneInfo;
        }
        eventBus.publish( 'planTimelineChart.milestonesAdded', { addedMilestonesMap: planSortedMilestonesMap } );

        //Publish this event so as to render timeline information related data
        eventBus.publish( 'eventsAddedOnTimeline', ganttMilestoneArray );

        //Publish event to fetch all the Milestone Event dependencies
        let eventDependenciesFlag = appCtxSvc.getCtx( 'showHideEventDependencyFlag' );
        if( eventDependenciesFlag && isMilestonePresentInResponse ) {
            let milestonesObj = [];
            searchResults.objects.forEach( ( obj )=>{
                let object = cdm.getObject( obj.uid );
                if( object.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
                    let index = milestonesObj.findIndex( x => x.uid === obj.uid );
                    //add if not found
                    if( index < 0 ) {
                        milestonesObj.push( obj );
                    }
                }
            } );
            let eventData = {
                primaryObjects : milestonesObj
            };
            eventBus.publish( 'fetchMilestoneEventDependencies', eventData );
        }
    }
};

/**
 * Get milestone map
 *
 * @return {Map} updated milestone to planId map
 */
const updateShowMilestonesToPlansUidMap = ( milestonesToPlansMap ) => {
    // if milestone already there in the map, need to check planId present or not.
    // PlanId not there for particular milestone then Only need to update planId
    let existingMilestoneToPlanMap = {};
    if( appCtxSvc.ctx.planNavigationCtx && appCtxSvc.ctx.planNavigationCtx.showMilestonesToPlansUid ) {
        let planNavigationCtx = appCtxSvc.getCtx( 'planNavigationCtx' );
        existingMilestoneToPlanMap = planNavigationCtx.showMilestonesToPlansUid;
        for ( let milestone in milestonesToPlansMap ) {
            if( !( milestone in existingMilestoneToPlanMap ) ) {
                existingMilestoneToPlanMap[milestone] = [];
            }
            milestonesToPlansMap[milestone].forEach( ( planId )=>{
                if( !existingMilestoneToPlanMap[milestone].includes( planId ) ) {
                    existingMilestoneToPlanMap[ milestone ].push( planId );
                }
            } );
        }
    }
    appCtxSvc.updatePartialCtx( 'planNavigationCtx.showMilestonesToPlansUid',  existingMilestoneToPlanMap );
};


/**
 * Hide selected milestones from Timeline
 */
export let hideMilestones = function( selectedPlanObjs, commandContext ) {
    if( selectedPlanObjs ) {
        const planUids = selectedPlanObjs.map( planObj => planObj.uid );
        let commandContextValue = commandContext.getValue();
        let selectedPlansForShowMilestones = commandContextValue.selectedPlansForShowMilestones;
        selectedPlansForShowMilestones = selectedPlansForShowMilestones.filter( ( el ) => !planUids.includes( el ) );
        commandContext.update( { ...commandContext.getValue(), selectedPlansForShowMilestones: selectedPlansForShowMilestones } );
        eventBus.publish( 'planTimelineChart.hideMilestones', { removeMilestonesForPlan: planUids } );
    }
};

/**
 * Remove selected schedule milestones from Timeline when schedule is removed
 */
export let hideRemovedScheduleMilestone = function( selectedPlanObj, scheduleObj ) {
    if ( selectedPlanObj && scheduleObj ) {
        eventBus.publish( 'planTimelineChart.hideMilestones', { removeMilestonesForPlan: [ selectedPlanObj.uid ], removedScheduleUid: scheduleObj.uid } );
    }
};

export default exports = {
    processMilestones,
    hideMilestones,
    subscribeMilestoneEvents,
    unsubscribeMilestoneEvents,
    showMilestones,
    updateTimelineState,
    hideRemovedScheduleMilestone
};
