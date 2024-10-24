// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1SearchContentService
 */
import eventBus from 'js/eventBus';

var exports = {};
export let checkAndReloadContentTable = function( eventMap ) {
    if( eventMap.editHandlerStateChange.state !== undefined ) {
        var state = eventMap.editHandlerStateChange.state;
        if( state === 'saved' ) {
            eventBus.publish( 'contentTable.plTable.reload' );
        }
    }
};

export default exports = {
    checkAndReloadContentTable
};
