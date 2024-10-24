// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpLoadSvc from 'js/services/ngpLoadService';
import ngpHostingMessagingService from 'js/services/ngpHostingMessagingService';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import ngpVmoPropSvc from 'js/services/ngpViewModelPropertyService';
import ngpNavigationService from 'js/services/ngpNavigationService';
import ngpStorageSvc from 'js/services/ngpStorageService';
import ngpDataUtils from 'js/utils/ngpDataUtils';

import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import eventBus from 'js/eventBus';

/**
 * navigation service for ngp objects.
 *
 * @module js/services/ngpInitializationService
 */
'use strict';

let eventListeners = [];
let revisionRuleChangeEventListener;
const ngpScopeObject = 'ngp.scopeObject';

/**
 * Local storage keys used for the docked out 3D viewer feature
 * This is the key which transfers sync data
 */
const mfgSyncBetweenWindowsLocalStorageKey = 'mfgSyncBetweenWindowsLSKey_graphicsView_';

/**
 * Local storage keys used for the docked out 3D viewer feature
 * This is the key which transfers the initial data which is defined between the two windows
 */
const mfgDualScreenDataLocalStorageKey = 'mfgDualScreenDockedContentDataLSKey_graphicsView_';
/**
 * resets the ngp context object
 */
function resetNgpContext() {
    appCtxSvc.updatePartialCtx( ngpScopeObject, null );
    eventBus.publish( 'ngp.scopeObjectCleared', { scopeObject: null } );
}

/**
 * @return {boolean} true if we're loading the same object again
 */
function isLoadingCurrentScopeObject() {
    const modelObject = appCtxSvc.getCtx( ngpScopeObject );
    if( modelObject ) {
        return modelObject.uid === AwStateService.instance.params.uid || ngpDataUtils.getFoundationId( modelObject ) === AwStateService.instance.params.uid;
    }
    return false;
}

/**
 * Updates the browser tab title
 */
function updateBrowserTabTitle() {
    const location = appCtxSvc.getCtx( 'location.titles' );
    if( location ) {
        location.browserTitle = 'Next Generation Planning';
        appCtxSvc.updateCtx( 'location.titles', location );
    }
}

/**
 * This method unsubscribes from everything
 */
function unsubscribeFromEverything() {
    eventListeners.forEach( ( listener ) => {
        eventBus.unsubscribe( listener );
    } );
    eventListeners = [];
    if( revisionRuleChangeEventListener ) {
        eventBus.unsubscribe( revisionRuleChangeEventListener );
    }
}

/**
 *
 */
function initNGP() {
    ngpHostingMessagingService.init();
    mfeVMOLifeCycleSvc.init();
    ngpStorageSvc.init();
    eventListeners.push( eventBus.subscribe( 'navigateToObjectFromHostedContent', navigationFromHostedContent ) );
    revisionRuleChangeEventListener = eventBus.subscribe( 'aw.revisionRuleChangeEvent', onRevisionRuleChange );

    //Here we check if the 'beforeunload' event listener is already active
    //if not, then we add the listener
    if( !window.ngpBeforeunloadListenerAlreadyActive ) {
        window.ngpBeforeunloadListenerAlreadyActive = true;
        window.addEventListener( 'beforeunload', onBeforeUnload );
    }
}

/**
 *
 * @param {object} eventData the event data
 */
function navigationFromHostedContent( eventData ) {
    ngpNavigationService.onNavigationFromHostedRequest( eventData );
}

/**
 * The method to execute when a change in the revision rule has occured
 */
function onRevisionRuleChange() {
    eventBus.unsubscribe( revisionRuleChangeEventListener );
    AwStateService.instance.reload();
}

/**
 * the function to exectue on before unload
 * Here we remove the local storage items relevant to the 3D viewer docking feature
 */
function onBeforeUnload() {
    const guid = sessionStorage.getItem( 'mfgDualScreenGuid' );
    if( guid ) {
        const dockedOutLocalStorageKey = mfgDualScreenDataLocalStorageKey.concat( guid );
        const dockedOutLocalStorageValue = localStorage.getItem( dockedOutLocalStorageKey );
        if( dockedOutLocalStorageValue ) {
            const newValue = {
                actionPerformedByUser: 'mfgClosedWindow'
            };
            localStorage.setItem( dockedOutLocalStorageKey, JSON.stringify( newValue ) );
            localStorage.removeItem( mfgSyncBetweenWindowsLocalStorageKey.concat( guid ) );
        }
    }
}

/**
 * Loads the model scope object
 */
function loadModel() {
    const state = AwStateService.instance;
    if( state.params.uid ) {
        if( !isLoadingCurrentScopeObject() ) {
            ngpLoadSvc.getConfiguredObject( state.params.uid ).then(
                ( configuredObj ) => {
                    const vmo = mfeVMOLifeCycleSvc.createViewModelObjectFromModelObject( configuredObj );
                    ngpVmoPropSvc.addLocalizedTypeDisplayNames( vmo );
                    ngpVmoPropSvc.addClassLibraryProperty( vmo );
                    appCtxSvc.registerPartialCtx( ngpScopeObject, vmo );
                    eventBus.publish( 'mfe.scopeObjectChanged', { scopeObject: vmo }  );
                    updateBrowserTabTitle();
                }
            );
        } else {
            //refresh object
            const scopeObject = appCtxSvc.getCtx( ngpScopeObject );
            ngpLoadSvc.refreshObjects( [ scopeObject ] ).then(
                () => eventBus.publish( 'mfe.scopeObjectChanged', { scopeObject }  )
            );
        }
        updateLocationChangeForDockedOutWindow();
    }
}

/**
 *this is for the dual screen
 *  We need this code due to the new hosting-hosted mechanisim
 */
function updateLocationChangeForDockedOutWindow() {
    const guid = sessionStorage.getItem( 'mfgDualScreenGuid' );
    if( guid ) {
        const dockedOutLSKey = mfgDualScreenDataLocalStorageKey.concat( guid );
        const value = localStorage.getItem( dockedOutLSKey );
        if( value ) {
            //check if the user closed the docked out window first
            var jsonValue = JSON.parse( value );
            if( jsonValue && jsonValue.actionPerformedByUser && ( jsonValue.actionPerformedByUser === 'mfgClosedWindow' || jsonValue.actionPerformedByUser === 'mfgContextChanged' ) ) {
                return;
            }
            const newValue = {
                actionPerformedByUser: 'mfgContextChanged'
            };
            localStorage.setItem( dockedOutLSKey, JSON.stringify( newValue ) );
        }
    }
}

/**
 * This method is called when we leave an NGP page to AW page
 */
function onDestroy() {
    updateLocationChangeForDockedOutWindow();
    unsubscribeFromEverything();
    ngpHostingMessagingService.destroy();
    mfeVMOLifeCycleSvc.destroy();
    appCtxSvc.unRegisterCtx( 'ngp' );
}

let exports = {};
export default exports = {
    initNGP,
    loadModel,
    onDestroy
};
