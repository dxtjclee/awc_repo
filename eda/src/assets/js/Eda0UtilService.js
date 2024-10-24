// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Eda0UtilService
 */
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';

var exports = {};

/**
 * Construct the name of CollaborationContextObject.
 */
export let constructCCObjectName = function( ctx ) {
    var resource = 'EdaMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var name = localTextBundle.collaborationName;
    if( ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' ) {
        var messageTextParams = ctx.locationContext.modelObject.props.object_string.dbValues[ 0 ];
    } else {
        var messageTextParams = ctx.selected.props.object_name.uiValues[ 0 ];
    }
    name = name.replace( '{0}', messageTextParams );
    return name;
};
export let getUnderlyingObjectUid = function( ctx ) {
    var uid = '';
    if( ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' ) {
        uid = ctx.selected.props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        uid = ctx.selected.uid;
    }
    return uid;
};

/**
 * Get selected objects from palette/search tab.
 * @param {Object} data - the viewmodel data for this panel
 * @returns {Array} selected objects from palette/search tab
 */
export let getSelectionFromAddPanel = function( data ) {
    var paletteSelection;
    if( data.addPanelState.sourceObjects.length === 1 ) {
        paletteSelection =  data.addPanelState.sourceObjects[0].uid;
    }
    var object = cdm.getObject( paletteSelection );
    data.objectAddedToCollaboration = object.props.object_name.dbValues[0];
    return paletteSelection;
};

export default exports = {
    constructCCObjectName,
    getUnderlyingObjectUid,
    getSelectionFromAddPanel
};
