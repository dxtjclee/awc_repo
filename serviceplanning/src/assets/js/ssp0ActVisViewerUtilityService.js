// Copyright (c) 2022 Siemens

/**
 * Service used for vis viewer functionalities
 *
 * @module js/ssp0ActVisViewerUtilityService
 */

export let actViewerInstanceId;

import { constants as ssp0TimeAnalysisConstants } from 'js/ssp0TimeAnalysisConstants';
import appCtxSvc from 'js/appCtxService';
import visWebInstanceProvider from 'js/visWebInstanceProvider';


/**
  * Update Vis Viewer Instance Id
  * @param {String} instanceId instanceId
  * @param {object} data data
  * @param {String} viewerId viewerId
  */
let updateVisViewerInstanceId = ( instanceId, data, viewerId ) => {
    data.visContext.id = instanceId;
    if ( viewerId === ssp0TimeAnalysisConstants.ACT_VIEWER_INSTANCE_ID ) {
        actViewerInstanceId = instanceId;
    }
};

/**
  * Get Vis Viewer Instance Id
  * @param {String} viewerId viewerId
  * @returns {String} vis viewer id
  */
let getVisInstanceId = ( viewerId ) => {
    if ( actViewerInstanceId && viewerId === ssp0TimeAnalysisConstants.ACT_VIEWER_INSTANCE_ID ) {
        return actViewerInstanceId;
    }
    return undefined;
};

/**
 * Unload the Graphics from Viewer
 *  @param {String} visInstanceId visInstanceId
 */
export const unloadGraphics = ( visInstanceId ) => {
    visWebInstanceProvider.getVisWebInstance( visInstanceId ).Viewer.setVisibilityOfAllObjectsInViewer( false );
};

/**
 * Enable Zoom to Selection in the Viewer
 *  @param {String} visInstanceId visInstanceId
 */
export const zoomToSelection = ( visInstanceId ) => {
    visWebInstanceProvider.getVisWebInstance( visInstanceId ).Viewer.fitToSelection();
};

/**
 * Enable Select by Volume in the Viewer
 *  @param {String} visInstanceId visInstanceId
 */
export const selectByVolume = ( visInstanceId ) => {
    let cc_uid = appCtxSvc.getCtx( 'ssp0ActSelectByVolumeCommandCtx' );
    if ( !cc_uid ) {
        visWebInstanceProvider.getVisWebInstance( visInstanceId ).Viewer.enableSelectionByVolume();
        appCtxSvc.updatePartialCtx( 'ssp0ActSelectByVolumeCommandCtx', true );
    } else {
        visWebInstanceProvider.getVisWebInstance( visInstanceId ).Viewer.doSelectionByVolume();
        appCtxSvc.updatePartialCtx( 'ssp0ActSelectByVolumeCommandCtx', false );
    }
};

/**
 * Enable Select by Rectangle in the Viewer
 *  @param {String} visInstanceId visInstanceId
 */
export const enableSelectByRectangle = ( visInstanceId ) => {
    visWebInstanceProvider.getVisWebInstance( visInstanceId ).Viewer.viewerManager.setAreaSelect( true );
};
export default {
    enableSelectByRectangle,
    selectByVolume,
    zoomToSelection,
    unloadGraphics,
    getVisInstanceId,
    updateVisViewerInstanceId
};
