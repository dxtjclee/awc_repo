// Copyright (c) 2022 Siemens

/**
 * Service used for graphics functionality
 *
 * @module js/ssp0GraphicsUtilityService
 */
import appCtxSvc from 'js/appCtxService';
import visWebInstanceProvider from 'js/visWebInstanceProvider';

let exports = {};

/**
  * Actions on unmount of three tab
  */
export const threeDTabOnUnmount = () => {
    appCtxSvc.unRegisterCtx( 'is3DTabPresent' );
};

/**
  * Actions on mount of three tab
  */
export const threeDTabOnMount = () => {
    appCtxSvc.registerCtx( 'is3DTabPresent', true );
};

/**
 * Sets Flag to clear parts viewer on mount of Service Plan Page
 */
export const clearPartsViewer = () => {
    appCtxSvc.registerCtx( 'clearPartsViewer', true );
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
export const zoomToSelection = ( visInstanceId )=> {
    visWebInstanceProvider.getVisWebInstance( visInstanceId ).Viewer.fitToSelection();
};


/**
 * Enable Select by Rectangle in the Viewer
 *  @param {String} visInstanceId visInstanceId
 */
export const enableSelectByRectangle = ( visInstanceId )=> {
    visWebInstanceProvider.getVisWebInstance( visInstanceId ).Viewer.viewerManager.setAreaSelect( true );
};
export default exports = {
    enableSelectByRectangle,
    zoomToSelection,
    unloadGraphics,
    threeDTabOnUnmount,
    threeDTabOnMount,
    clearPartsViewer
};
