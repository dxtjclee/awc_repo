// Copyright (c) 2022 Siemens

/**
 * This module holds structure viewer 3D data
 *
 * @module js/structureViewerDataService
 */
import StructureViewerService from 'js/structureViewerService';
import awPromiseService from 'js/awPromiseService';
import logger from 'js/logger';
import StructureViewerData from 'js/structureViewerData';
import awIconService from 'js/awIconService';
import viewerContextService from 'js/viewerContext.service';
import viewerPreferenceService from 'js/viewerPreference.service';
import viewerPerformanceService from 'js/viewerPerformance.service';
import tcSessionData from 'js/TcSessionData';
import _ from 'lodash';
import viewerGraphicsSupportService from 'js/viewerGraphicsSupportService';

var exports = {};

/**
 *
 * Set structure viewer configuration
 * @param {Object} occmgmtContext occmgmt context
 * @param {Object} viewerAtomicData viewer atomic data
 * @param {Object} renderLocation render location
 */
export let setStructureViewerConfiguration = function( occmgmtContext, viewerAtomicData, renderLocation ) {
    const occmgmtContextKey = occmgmtContext.context.contextKey;
    const newViewerAtomicData = { ...viewerAtomicData.getValue() };
    _.set( newViewerAtomicData, 'viewerCtxNamespace', StructureViewerService.instance.getViewerCtxNamespaceUsingOccmgmtKey( occmgmtContextKey ) );
    _.set( newViewerAtomicData, 'occmgmtContextKey', occmgmtContextKey );
    _.set( newViewerAtomicData, 'renderLocation', renderLocation );
    viewerAtomicData.update( newViewerAtomicData );
};

/**
 * Set thumbnail url
 *
 * @param {Object} occMgmtCtx occmgmt context name key
 * @returns {String} thimbnail url
 */
export let setThumbnailUrl = function( occMgmtCtx ) {
    return awIconService.getThumbnailFileUrl( occMgmtCtx.occContext.topElement );
};

/**
 * Initialize 3D viewer.
 * @param {Object} data Data from viewmodel
 * @param {Object} subPanelContext Sub panel context
 * @param {Object} viewerAtomicData viewer atomic data
 * @param {Boolean} force3DViewerReload boolean indicating if 3D should be reloaded forcefully
 *
 * @returns {Promise} promise
 */
export let initialize3DViewer = function( data, subPanelContext, viewerAtomicData, force3DViewerReload ) {
    let viewerContainerDivEle = null;
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
    }
    if( data && data.viewContainerProp && data.viewContainerProp.viewerContainerDiv ) {
        viewerContainerDivEle = data.viewContainerProp.viewerContainerDiv;
    } else {
        throw 'The viewer container div can not be null';
    }
    let structureViewerInstance = null;
    if( data.svInstance && data.svInstance instanceof StructureViewerData ) {
        structureViewerInstance = data.svInstance;
        let deferred = awPromiseService.instance.defer();
        structureViewerInstance.reload3DViewer( subPanelContext.context, viewerAtomicData ).then( () => {
            deferred.resolve( structureViewerInstance );
        } ).catch( ( error ) => {
            logger.error( error );
            deferred.resolve( structureViewerInstance );
        } );
        return deferred.promise;
    }
    structureViewerInstance = new StructureViewerData( viewerContainerDivEle, subPanelContext.context.contextKey );
    return structureViewerInstance.initialize3DViewer( subPanelContext.context, viewerAtomicData, force3DViewerReload );
};

/**
 *
 * Reload 3D viewer.
 * @param {Object} svInstance Data from viewmodel
 * @param {Object} subPanelContext Sub panel context
 * @param {Object} viewerAtomicData viewer atomic data
 * @param {Object} occmgmtCtx occurence management context
 * @param {Object} occmgmtContextNameKey occurence management context key
 */
export let reload3DViewer = function( svInstance, subPanelContext, viewerAtomicData, occmgmtCtx, occmgmtContextNameKey, additionalData ) {
    if ( occmgmtCtx.viewKey !== occmgmtContextNameKey ) {
        return;
    }
    if( svInstance && typeof svInstance.reload3DViewer === 'function' ) {
        svInstance.reload3DViewer( subPanelContext.context, viewerAtomicData, additionalData );
    }
};

/**
 * Reload 3D viewer for PCI change.
 * @param {Object} svInstance Data from viewmodel
 * @param {Object} subPanelContext Sub panel context
 * @param {Object} viewerAtomicData viewer atomic data
 * @param {Object} occmgmtCtx occurence management context
 * @param {Object} occmgmtContextNameKey occurence management context key
 */
export let reload3DViewerForPCIChange = function( svInstance, subPanelContext, viewerAtomicData, occmgmtCtx, occmgmtContextNameKey ) {
    if ( occmgmtCtx.viewKey !== occmgmtContextNameKey ) {
        return;
    }
    let reloadSession = occmgmtCtx.openedElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) !== -1;
    if( svInstance && typeof svInstance.reload3DViewerForPCIChange === 'function' ) {
        svInstance.reload3DViewerForPCIChange( subPanelContext.context, viewerAtomicData, reloadSession );
    }
};

/**
 * Resize 3D viewer
 * @param {Object} svInstance Data from viewmodel
 */
export let set3DViewerSize = function( svInstance ) {
    if( svInstance && typeof svInstance.set3DViewerSize === 'function' ) {
        svInstance.set3DViewerSize();
    }
};

/**
 * Send message to Vis to reconfigure viewer.
 * @param {Object} tempAppSessionResponse createOrUpdateSavedSession SOA response
 * @param {Object} svInstance Data from viewmodel
 * @param {Object} subPanelContext subpanel context
 */
export let reconfigure3DViewer = function( tempAppSessionResponse, svInstance, subPanelContext ) {
    if( svInstance && typeof svInstance.reconfigureViewer === 'function' ) {
        svInstance.reconfigureViewer( tempAppSessionResponse, subPanelContext );
    }
};

/**
 * Send message to Vis to update the Show Suppressed option.
 * @param {Object} svInstance Data from viewmodel
 */
export let setShowSuppressed3DViewer = function( svInstance ) {
    if( svInstance && typeof svInstance.setShowSuppressed === 'function' ) {
        svInstance.setShowSuppressed();
    }
};

/**
 * Reset parameters for 3D reload
 * @param {Boolean} isLoading - boolen indicating if 3D viewer loading is in progress
 * @returns {Array} - Array with reset parameters
 */
export let resetParametersFor3DReload = function() {
    return [ {
        displayImageCapture: false,
        loadingViewer: true,
        showViewerEmmProgress: true,
        showViewerProgress: false,
        viewerLoadbarVisible: false,
        viewerStopButtonVisible: false
    } ];
};

/**
 * Set viewer loading status
 * @param {Boolean} isLoading boolen indicating if viewer is loading
 * @returns {Boolean} boolean indicating if viewer is loading
 */
export let setViewerLoadingStatus = function( isLoading ) {
    return isLoading;
};

/**
 * Show viewer emm progress
 * @param {Boolean} isShow boolen indicating is emm progress indicator should be shown
 * @returns {Boolean} boolean indicating if emm progress indicator should be shown
 */
export let showViewerEmmProgress = function( isShow ) {
    return isShow;
};

/**
 * Show viewer progress
 * @param {Boolean} isShow boolen indicating is viewer progress indicator should be shown
 * @param {Boolean} isViewerLoading boolen indicating is viewer loading
 * @returns {Boolean} boolean indicating if viewer progress indicator should be shown
 */
export let showViewerProgress = function( isShow, isViewerLoading ) {
    if( !isShow && viewerPerformanceService.isPerformanceMonitoringEnabled() && viewerPerformanceService.getViewerPerformanceInfo() === 'InitialLoading' && !isViewerLoading ) {
        viewerPerformanceService.setViewerPerformanceMode( false );
        viewerPerformanceService.stopViewerPerformanceDataCapture( 'Last image loaded: ' );
    }
    return isShow;
};

/**
 * cleanup 3D view
 * @param {String} viewerInstance viewer instance
 */
export let cleanup3DViewer = function( viewerInstance ) {
    if( viewerInstance && typeof viewerInstance.cleanup3DViewer === 'function' ) {
        viewerInstance.cleanup3DViewer();
    }
};

/**
 * Check if viewer needs to force reload or not
 * @param {string} occmgmtContextKey viewer occmgmtContextKey
 * @returns {boolean} true if viewer needs to force reload else return false.
 */
export let isForceReloadViewer = function( occmgmtContextKey ) {
    return StructureViewerService.instance.isForceReloadViewer( occmgmtContextKey );
};

/**
 * Handle selection change
 * @param {Object} svInstance Data from viewmodel
 * @param {Array} selection selection
 */
export let handleSelectionChange = function( svInstance, selection ) {
    if( svInstance && typeof svInstance.handleSelectionChange === 'function' ) {
        svInstance.handleSelectionChange( selection );
    }
};

/**
 * This function will check whether the to disable creation of tempAppSession or not
 * @param {string} occmgmtContextKey viewer occmgmtContextKey
 * @returns {boolean} true if viewer opened object is of Fnd0WorksetRevision or its subtype or betapref contains value disableUsageOfTempAppSessionForLaunch
 */
export let disableUsageOfTempAppSession = function( occmgmtContextKey ) {
    let viewerExposedBeta = viewerPreferenceService.getViewerBetaPref();
    if( viewerExposedBeta && Array.isArray( viewerExposedBeta ) && _.includes( viewerExposedBeta, 'disableUsageOfTempAppSessionForLaunch' ) ||
        StructureViewerService.instance.isViewerOpenedForFnd0Workset( occmgmtContextKey ) ) {
        return true;
    }
    return false;
};

/**
 * Prepare input for creating temp app session
 * @param {Array} topLinesArray top lines array
 * @returns  {String} uid for bomline for createOrUpdateSavedSession SOA input
 */
export let prepareInputForCreateTempAppSession = function( topLinesArray ) {
    return topLinesArray[ 0 ].uid;
};

/**
 * Structure viewer component mounted
 * @param {Object} elementRefList element ref list
 * @param {Object} viewerContainerProp container prop
 */
export let structureViewerComponentMounted = function( elementRefList, viewerContainerProp ) {
    const newViewerContainerProp = { ...viewerContainerProp.getValue() };
    newViewerContainerProp.viewerContainerDiv = elementRefList.get( 'awStructureViewer' ).current;
    viewerContainerProp.update( newViewerContainerProp );
};

/**
 * Structure viewer component rendered
 * @param {Object} props props object
 * @returns {Object} the vdom object
 */
export let structureViewerComponentRendered = function( props ) {
    return <div ref={props.elementRefList.get( 'awStructureViewer' )}></div>;
};

/**
 * Viewer loadbar component rendered
 * @param {Object} props props object
 * @returns {Object} vdom object for loadbar dashboard
 */
export let loadbarViewerComponentRendered = function( props ) {
    let loadPercent = props.viewerstateprop.viewerLoadbarPercentage + '%';
    return <div className='aw-threeDViewer-loadbar' style={{ width: loadPercent }} ></div>;
};


/**
 * Determines the needed data type the Vis server needs to perform a reconfigure.
 * Can also specify to reload instead of reconfiguring.
 * @param {String} occmgmtContextKey occurence management context key
 * @returns {String} the name of the data type needed
 */
export let getReconfigureDataType = function( occmgmtContextKey ) {
    // First, check if we are running in PLMVisWeb-based CSR. If so, we will reload instead of reconfigure the viewer.

    // Now check if the TempAppSession has been disabled.
    var tempAppSessionDisabled = disableUsageOfTempAppSession( occmgmtContextKey );
    if( tempAppSessionDisabled ) {
        // Use PCI UID
        return 'PCI_UID';
    }

    // Last, check the Teamcenter version to make sure it is 13.3 or greater.
    var tcMajor = tcSessionData.getTCMajorVersion();
    var tcMinor = tcSessionData.getTCMinorVersion();

    if( tcMajor === 13 && tcMinor >= 3 || tcMajor > 13 ) {
        return 'TempAppSession';
    }
    return 'PCI_UID';
};

/**
 * Handle selection change
 * @param {Object} svInstance Data from viewmodel
 * @param {Object} occContext Occurance management atomic data
 */
export let showOnlyInViewer = function( svInstance, occContext ) {
    if( svInstance && typeof svInstance.showOnlyInViewer === 'function' ) {
        svInstance.showOnlyInViewer( occContext );
    }
};

/**
 * Handle render Location changed event
 * @param {Object} svInstance Data from viewmodel
 * @param {Object} subPanelContext Sub panel context
 * @param {Object} viewerAtomicData viewer atomic data
 */
export let renderSourceLocationChanged = function( svInstance, subPanelContext, viewerAtomicData ) {
    if( svInstance && typeof svInstance.handleRenderLocationChanged === 'function' ) {
        svInstance.handleRenderLocationChanged( subPanelContext.context, viewerAtomicData );
    }
};

/**
 * Handle Vis session save
 * @param {Object} occContext occurence management context
 *
 */
export let saveVisSessionData = function( occContext ) {
    StructureViewerService.instance.updateVisSession( occContext );
};

export let stopButtonClicked = function( viewerCtxData, viewerCtxNamespace ) {
    let viewerCtx = viewerCtxData;
    if( !viewerCtx ) {
        viewerCtx = viewerContextService.getRegisteredViewerContext( viewerCtxNamespace );
    }
    if( viewerCtx ) {
        let progressIndicator = viewerCtx.getViewerProgressIndicator();
        if( progressIndicator ) {
            progressIndicator.stopButtonPressed();
            return true;
        }
    }
    return false;
};


/**
 * Gets supported Render location for loading viewer
 * @param {Object} occContext occurence management context
 * @param {Object} viewerAtomicData viewer atomic data
 * @returns {Promise} promise which resolve with render location
 */
export let getSupportedRenderLocationFor3D = ( occContext, viewerAtomicData  )=>{
    let pciObj = StructureViewerService.instance.getPCIModelObject( occContext );
    let topElementModelObj = occContext.topElement || occContext.openedElement;
    return viewerGraphicsSupportService.getSupportedRenderLocation( topElementModelObj,
        StructureViewerService.instance.isSameProductOpenedAsPrevious( pciObj, occContext.viewKey ) )
        .then( ( renderLocation )=>{
            if( renderLocation === 'unSupported' || renderLocation === 'viewerNotConfigured' ) {
                stopViewerProgressIndicator( viewerAtomicData );
            }
            return renderLocation;
        } );
};

/**
 * update view model data with renderLocation to SSR
 * @returns {String} renderLocation value
 */
export let updateRenderLocationToSSR = ()=>{
    return 'SSR';
};

/**
 * Stops viewer progress indicator
 * @param {Object} viewerAtomicData viewer atomic data
 */
export let stopViewerProgressIndicator = ( viewerAtomicData )=>{
    const newViewerAtomicData = { ...viewerAtomicData.getValue() };
    _.set( newViewerAtomicData, 'showViewerProgress', false );
    _.set( newViewerAtomicData, 'showViewerEmmProgress', false );
    _.set( newViewerAtomicData, 'loadingViewer', false );
    viewerAtomicData.update( newViewerAtomicData );
};

export default exports = {
    setStructureViewerConfiguration,
    setThumbnailUrl,
    initialize3DViewer,
    reload3DViewer,
    reload3DViewerForPCIChange,
    set3DViewerSize,
    reconfigure3DViewer,
    setShowSuppressed3DViewer,
    resetParametersFor3DReload,
    setViewerLoadingStatus,
    showViewerEmmProgress,
    showViewerProgress,
    cleanup3DViewer,
    isForceReloadViewer,
    structureViewerComponentMounted,
    structureViewerComponentRendered,
    loadbarViewerComponentRendered,
    disableUsageOfTempAppSession,
    prepareInputForCreateTempAppSession,
    handleSelectionChange,
    getReconfigureDataType,
    showOnlyInViewer,
    saveVisSessionData,
    stopButtonClicked,
    renderSourceLocationChanged,
    getSupportedRenderLocationFor3D,
    updateRenderLocationToSSR,
    stopViewerProgressIndicator
};
