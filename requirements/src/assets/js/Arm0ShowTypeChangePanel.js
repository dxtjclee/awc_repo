// Copyright (c) 2021 Siemens

/**
 * @module js/Arm0ShowTypeChangePanel
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import rmTreeDataService from 'js/Arm0ImportPreviewJsonHandlerService';
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Method to update the options. If nothing is copied thrn only show Cut and Copy else
 * show paste options as well
 * @param {Object} data - the data object of view model
 * @return {Object} allowedTypesInfo
 */
export let updateOptionsOnLoad = function( data ) {
    var allowedTypeList = [];
    var allowedTypes = rmTreeDataService.getAllowedTypesInfo();
    var allowedTypeObject = {};
    for( var index = 0; index < allowedTypes.length; index++ ) {
        var objectElements = allowedTypes[ index ];
        allowedTypeObject = {
            displayName: objectElements.displayTypeName,
            internalName: objectElements.typeName,
            iconId: objectElements.typeIconURL
        };
        allowedTypeList.push( allowedTypeObject );
    }

    data.allowedTypesInfo = allowedTypeList;
    return { allowedTypesInfo:allowedTypeList };
};

/**
 *@param {Object} selectedObject - selected row
 */
export let handleCommandSelection = function( selectedObject ) {
    var row = selectedObject.selectedRow;
    var eventData = {
        sourceObject: row
    };
    eventBus.publish( 'importPreview.changeTypeEvent', eventData );
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
    updateOptionsOnLoad,
    handleCommandSelection,
    getSelectedObject
};
