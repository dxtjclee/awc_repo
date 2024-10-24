// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1ShowPreviewService
 */
import { popupService } from 'js/popupService';
import eventBus from 'js/eventBus';

var exports = {};

let subscriptions = [];

export let showPanel = function( popupData ) {
    popupService.show( popupData ).then( popupRef => {
        subscriptions.push( eventBus.subscribe( 'LOCATION_CHANGE_COMPLETE', hidePopupPanel ) );
        var sideNavEventSub = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
            if( eventData && eventData.id === 'aw_toolsAndInfo' ) {
                hidePopupPanel();
            }
        } );
        subscriptions.push( sideNavEventSub );
    } );
};

export let hidePopupPanel = function( popupId ) {
    popupService.hide( popupId );
};

export default exports = {
    showPanel,
    hidePopupPanel
};
