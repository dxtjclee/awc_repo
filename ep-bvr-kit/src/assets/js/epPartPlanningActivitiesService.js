// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import appCtxService from 'js/appCtxService';

/**
 * Part Planning set Root Service
 *
 * @module js/epPartPlanningActivitiesService
 */
'use strict';


const SHOW_ACTIVITIES_TABLE_TOGGLE = 'epPageContext.showPartPlanningActivities';

/**
 * setParentNodeObject
 *
 * @param {Object} data - model object or view model object
 */
export function getRootActivityFromResponse( revisionUID, responseModelObjects ) {
    if( responseModelObjects && responseModelObjects[revisionUID] && responseModelObjects[revisionUID].props &&
       responseModelObjects[revisionUID].props.root_activity && responseModelObjects[revisionUID].props.root_activity.dbValues ) {
        return responseModelObjects[revisionUID].props.root_activity.dbValues[0];
    }
}

/**
 *
 */
export function toggleActivitiesTable() {
    let isActivitiesTableDisplayed = appCtxService.getCtx( SHOW_ACTIVITIES_TABLE_TOGGLE ) ? appCtxService.getCtx( SHOW_ACTIVITIES_TABLE_TOGGLE ) : false;
    appCtxService.updatePartialCtx( SHOW_ACTIVITIES_TABLE_TOGGLE, !isActivitiesTableDisplayed );
}

/**
 *
 */
export function setSingleSelectionInResponse( value ) {
    return { actionData: value };
}

export default {
    getRootActivityFromResponse,
    toggleActivitiesTable,
    setSingleSelectionInResponse
};
