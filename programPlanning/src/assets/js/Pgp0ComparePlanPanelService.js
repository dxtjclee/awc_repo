// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/Pgp0ComparePlanPanelService
 */

import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';

var exports = {};
var _removeProject = null;

/**
  * This method loads the selected reference plans in the Compare With panel
  * @param {Object} refPlanUids - selected reference plan UIDs
  * @param {Object} sharedData - Newly selected reference plan/s in panel
  */
export let loadReferencePlan = function( refPlanUids, sharedData ) {
    if( refPlanUids && sharedData ) {
        let planList = refPlanUids.split( ',' );
        const referencePlans = planList.map( id => cdm.getObject( id ) );
        let newSharedData = _.clone( sharedData );
        if( newSharedData.selectedPlans.length === 0 && referencePlans ) {
            newSharedData.selectedPlans = referencePlans;
        }
        sharedData.update( newSharedData );
    }
};

/**
  * This method is used to set the condition for enability of Add command in panel based on number of selection of reference plan
  * @param {Object} totalObjectsLoaded - Number of reference plan/s selected
  * @param {Object} referenceCount - Value of preference PP_Compare_Plan_Count
  * @returns {Boolean} true if more reference plan can be selected which is based on preference value
  */
export let enableDisableAdd = function( totalObjectsLoaded, referenceCount ) {
    //If preference is set greater than 4, resetting it to 4 since maximum value for preference is 4.
    if( parseInt( referenceCount ) > 4 ) {
        referenceCount = 4;
    }
    return totalObjectsLoaded < parseInt( referenceCount );
};

/**
  * This method is used to set the pre-filter based on current plan
  * @param {Object} timelineSelectedObject - Current or main plan from timeline
  * @param {Object} compareMainObject - Current or main plan from compare location
  * @returns {String} string for search-filter to set the pre-filter equal to type of main plan
  */
export let setSearchFilter = function( timelineSelectedObject, compareMainObject ) {
    let currentPlan;
    if( timelineSelectedObject ) {
        currentPlan = timelineSelectedObject;
    } else {
        currentPlan = cdm.getObject( compareMainObject );
    }
    return 'WorkspaceObject.object_type=' + currentPlan.type;
};

/**
  * This method de-selects plan from search results if the preference count is already reached
  * @param {Object} eventData - eventData
  * @param {Object} sharedData - Shared Data between sub-panels
  * @param {Object} referenceCount - Preference value for number of reference plans that can be selected
  */
export let checkPreferenceCount = function( eventData, sharedData, referenceCount ) {
    //If preference is set greater than 4, resetting it to 4 since maximum value for preference is 4.
    if( parseInt( referenceCount ) > 4 ) {
        referenceCount = 4;
    }
    if( eventData.dataProvider.selectedObjects.length > parseInt( referenceCount ) - sharedData.selectedPlans.length ) {
        eventData.dataProvider.selectedObjects.pop();
        eventData.selectedObjects.pop();
        eventData.selected.pop();
        eventData.selectedUids.pop();
    }
};

/**
  * Add selected reference plan/s to the data provider to be used for comparison
  * @param {Object} eventData - eventData
  * @param {Object} sharedData - Shared Data between sub-panels
  * @param {Object} referenceCount - Preference value for number of reference plans that can be selected
  * @param {Object} currentPlan - Current or main plan in compare location
  * @param {Object} selected - selected plan from timeline location
  */
export let addPlans = function( eventData, sharedData, referenceCount, currentPlan, selected ) {
    //If preference is set greater than 4, resetting it to 4 since maximum value for preference is 4.
    if( parseInt( referenceCount ) > 4 ) {
        referenceCount = 4;
    }

    let newFlag;
    let newSharedData = _.clone( sharedData );

    if( eventData.selected.length > 0 ) {
        for( let i = 0; i < eventData.selected.length; i++ ) {
            newFlag = true;
            if ( sharedData.selectedPlans.length > 0 ) {
                for( let j = 0; j < sharedData.selectedPlans.length; j++ ) {
                    if( eventData.selected[i] && sharedData.selectedPlans[j] ) {
                        if( eventData.selected[i].uid === sharedData.selectedPlans[j].uid || eventData.selected[i].uid === currentPlan.uid ||  selected && eventData.selected[i].uid === selected.uid  ) {
                            newFlag = false;
                            break;
                        }
                    }
                }
            } else if( eventData.selected[i].uid === currentPlan.uid ||  selected && eventData.selected[i].uid === selected.uid ) {
                newFlag = false;
            }
            if( newFlag && eventData.selected[i] ) {
                newSharedData.selectedPlans = newSharedData.selectedPlans.concat( eventData.selected[i] );
            }
        }
        newSharedData.selectedPlans.splice( parseInt( referenceCount ), newSharedData.selectedPlans.length - 1 );
        sharedData.update( newSharedData );
    }
};

/**
  * Remove selected reference plan from the data provider to be used for comparison
  * @param {Object} vmo - vmo
  */
export let removePlan = function( vmo ) {
    if( vmo && vmo.uid ) {
        _removeProject = vmo;
        eventBus.publish( 'Pgp0ComparePlanSub.removePlan' );
    }
};

/**
  * Remove selected reference plan from the data provider to be used for comparison
  * @param {Object} referencePlanDataProvider - vmo
  * @param {Object} sharedData - Shared Data between sub-panels
  */
export let removeSelectedPlan = function( referencePlanDataProvider, sharedData ) {
    if( sharedData ) {
        let newSharedData = _.clone( sharedData );
        if ( newSharedData.selectedPlans.length > 0 ) {
            _.remove( newSharedData.selectedPlans, function( vmo ) {
                if ( vmo.uid && _removeProject.uid && vmo.uid === _removeProject.uid ) {
                    return true;
                }
                return false;
            } );
        }
        referencePlanDataProvider.update( newSharedData.selectedPlans );
        sharedData.update( newSharedData );
    }
};

/**
  * This method is used to update the selected reference plans on main component
  * @param {Object} eventData - eventData
  * @param {Object} ctx - ctx
  */
export let updateRefPlansArray = function( eventData ) {
    let stateSvc = AwStateService.instance;
    let state = appCtxService.getCtx( 'state' );
    let navigationParams = {
        uid : state.params.uid,
        comparePlanUids : eventData.data.referenceUIDs
    };
    let newState = {
        params: navigationParams
    };
    if( state ) {
        appCtxService.updateCtx( 'state', newState );
    } else {
        appCtxService.registerCtx( 'state', newState );
    }
    stateSvc.go( stateSvc.current.name, navigationParams );
};

/**
  * This method is used to set the enability of Compare button on panel
  * @returns {Boolean} true when reference plans added or removed in panel
  */
export let setCompareCondition = function( ) {
    return true;
};

/**
  * This method is used to update the selected reference plans on taskbar component
  * @param {Object} referencePlanObjects - reference plan selection
  * @returns {String} reference plan uids
  */
export let getPlanUIDs = function( referencePlanObjects ) {
    let uids = '';
    for( let i = 0; i < referencePlanObjects.length; i++ ) {
        if( i === 0 ) {
            uids = referencePlanObjects[i].uid;
        } else {
            uids = uids + ',' + referencePlanObjects[i].uid;
        }
    }
    return uids;
};

exports = {
    loadReferencePlan,
    enableDisableAdd,
    setSearchFilter,
    checkPreferenceCount,
    addPlans,
    removePlan,
    removeSelectedPlan,
    updateRefPlansArray,
    setCompareCondition,
    getPlanUIDs
};

export default exports;
