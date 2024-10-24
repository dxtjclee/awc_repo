// Copyright (c) 2021 Siemens

/**
 * @module js/Arm0PopupMenuPanel
 */
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};

var _actionList = null;

/**
  * Handle the  popup menu click event
  *@param {Object} selectedObject - Selected pop up menu item
  */
export let handleCommandSelection = function( selectedObject ) {
    var row = selectedObject.selectedRow;
    eventBus.publish( row.eventName );
};

/**
  * Method to update the options. If nothing is copied thrn only show Cut and Copy else
  * show paste options as well
  * @param {Object} data - the data object of view model
  * @return {Object} actionItems
  */
export let updateOptions = function( ) {
    var actionItems = {
        dbValue : _actionList
    };
    return { actionItems: actionItems };
};

/**
  * Refresh menu item list
  * @param {Object} data - view model object data
  */
export let updateActionList = function( data ) {
    data.actionItems.dbValue = data.eventData.actionItems.dbValue;
    eventBus.publish( 'requirementDocumentation.refreshOptions' );
};

/**
  * Register context for show type actions
  * @param {Object} data - view model object data
  */
export let registerCxtForActionsPanel = function( data ) {
    var selectedObjectUid = [];
    if( data.selectedObjectUid && data.selectedObjectUid.length <= 1 && data.dataProviders.importPreviewTreeProvider ) {
        selectedObjectUid.push( data.eventData.sourceObject[ 0 ].uid );
        _actionList = data.actionItems.dbValue;
        eventBus.publish( 'requirementDocumentation.showActionsPanel', data.eventData );
        return{
            selectedObjectUid: selectedObjectUid
        };
    }else if( !data.dataProviders.importPreviewTreeProvider ) {
        selectedObjectUid.push( data.eventData.sourceObject[ 0 ].uid );
        _actionList = data.actionItems.dbValue;
        eventBus.publish( 'requirementDocumentation.showActionsPanel', data.eventData );
        return{
            selectedObjectUid: selectedObjectUid
        };
    }
    return selectedObjectUid;
};

export default exports = {
    handleCommandSelection,
    updateOptions,
    updateActionList,
    registerCxtForActionsPanel
};
