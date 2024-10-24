// Copyright (c) 2022 Siemens

/**
 * @module js/CreateMasterScheduleService
 */
import selectionService from 'js/selection.service';
import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';

var exports = {};

export let openCreateMasterSchedulePanel = function( commandId, location ) {
    var selectedSchedules = 'selectedSchedules';

    var inputs = selectionService.getSelection().selected;

    if( inputs && inputs.length > 0 ) {
        appCtxService.registerCtx( selectedSchedules, inputs );
    } else {
        appCtxService.unRegisterCtx( selectedSchedules );
    }

    commandPanelService.activateCommandPanel( commandId, location );
};

export default exports = {
    openCreateMasterSchedulePanel
};
