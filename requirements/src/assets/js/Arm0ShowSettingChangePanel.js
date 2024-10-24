// Copyright (c) 2021 Siemens

/**
 * @module js/Arm0ShowSettingChangePanel
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};


/**
 * Gets the setting change and fires the event to
 *@param {Object} selectedObject - selected row
 */
export let handleCommandSelection = function( selectedObject ) {
    var row = selectedObject.selectedRow;
    if( row.internalName === 'Revise' || row.internalName === 'Update' || row.internalName === 'Delete' || row.internalName === 'Add' || row.internalName === 'NoChange' || row.internalName ===
        'AcceptUpdate' ) {
        var eventData = {
            sourceObject: row
        };
        eventBus.publish( 'importpreview.updateSetting', eventData );
    }
};

/**
 * Returns the selected object
 *
 * @return {Object} selected object
 */
export let getSelectedObject = function() {
    var uid = appCtxService.getCtx( 'selectedRequirementObjectUID' );
    return cdm.getObject( uid );
};


export default exports = {

    handleCommandSelection,
    getSelectedObject
};
