// Copyright (c) 2022 Siemens

/**
 * Defines {@link arm0TracelinkPollingService}
 *
 * @module js/Arm0TracelinkPollingService
 */
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localStrg from 'js/localStorage';
import { loadDependentModule } from 'js/moduleLoader';

let exports = {};

/**
 * Setup to listen to get Tracelink Popup data updated events.
 */
function subscribeEventToHandleTracelinkData() {
    localStrg.subscribe( 'CreateTraceLinkPopup', function( eventData ) {
        setTimeout( async function() {
            var traceLinkStorage = localStrg.get( 'CreateTraceLinkPopup' );
            if( !traceLinkStorage ) {
                eventBus.publish( 'CreateTracelinkPopup.Close' );
            } else {
                // Check if popup is shown, if not open it
                if( !appCtxService.ctx.CreateTraceLinkPopupCtx ) {
                    const arm0CreateTraceLinkPopup = await loadDependentModule( 'js/Arm0CreateTraceLinkPopupService' );
                    arm0CreateTraceLinkPopup.openTracelinkPopup();
                } else {
                    // If popup already opened, update objects on panel
                    eventBus.publish( 'createTracelink.initStartItemList' );
                }
            }
        }, 0 );
    } );
}

/**
 * Initialize the polling service
 */
export let init = function() {
    // Check AW session
    var traceLinkStorageAwSession = localStrg.get( 'CreateTraceLinkPopupAWSession' );
    var awSession = localStrg.get( 'awSession' );
    if( traceLinkStorageAwSession !== awSession ) {
        localStrg.removeItem( 'CreateTraceLinkPopup' );
    }
    // Check if tracelink popup in localcache, if found open
    var traceLinkStorage = localStrg.get( 'CreateTraceLinkPopup' );
    var locationChangeEventSub;
    var gatewayContentEventSub;
    var traceabilityMatrixContentLoadedEventSub;
    if( traceLinkStorage ) {
        // Timeout to open the tracelink popup
        setTimeout( async() => {
            const arm0CreateTraceLinkPopup = await loadDependentModule( 'js/Arm0CreateTraceLinkPopupService' );
            arm0CreateTraceLinkPopup.openTracelinkPopup();
        }, 3000 );
        // event when gateway page
        gatewayContentEventSub = eventBus.subscribe( 'gateway.contentLoaded',
            function() {
                eventBus.unsubscribe( locationChangeEventSub );
                eventBus.unsubscribe( gatewayContentEventSub );
                eventBus.unsubscribe( traceabilityMatrixContentLoadedEventSub );
                setTimeout( async function() {
                    const arm0CreateTraceLinkPopup = await loadDependentModule( 'js/Arm0CreateTraceLinkPopupService' );
                    arm0CreateTraceLinkPopup.openTracelinkPopup();
                }, 50 );
            } );
        // event when Traceability Matrix page
        traceabilityMatrixContentLoadedEventSub = eventBus.subscribe( 'Arm0TraceabilityMatrix.contentLoaded',
            function() {
                eventBus.unsubscribe( locationChangeEventSub );
                eventBus.unsubscribe( gatewayContentEventSub );
                eventBus.unsubscribe( traceabilityMatrixContentLoadedEventSub );
                setTimeout( async function() {
                    const arm0CreateTraceLinkPopup = await loadDependentModule( 'js/Arm0CreateTraceLinkPopupService' );
                    arm0CreateTraceLinkPopup.openTracelinkPopup();
                }, 50 );
            } );
    }

    subscribeEventToHandleTracelinkData();
};

export default exports = {
    init
};
