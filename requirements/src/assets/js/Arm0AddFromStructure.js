// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0AddFromStructure
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import commandsMapService from 'js/commandsMapService';
import LocationNavigationService from 'js/locationNavigation.service';

var exports = {};

self.getObject = function( object ) {
    return {
        uid: object.uid,
        type: 'unknownType'
    };
};

/**
 * get Revision Object.
 *
 * @param {Object} object - Awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevisionObject = function( object ) {
    if( object && commandsMapService.isInstanceOf( 'Awb0Element', object.modelType ) && object.props && object.props.awb0UnderlyingObject ) {
        return cdm.getObject( object.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    return object;
};
/**
 * Add in Start/End Item List.
 *
 * @param {Object} data - The view model data
 * @param {Object} newObjs - objects to be added in respective Item list
 */
export let addFromStructure = function( data ) {
    let toParams = {};
    let mselected = appCtxService.getCtx( 'mselected' );
    let first = _getRevisionObject( mselected[0] );
    data.source = self.getObject( first );

    if( data.addPanelState && data.addPanelState.sourceObjects && data.addPanelState.sourceObjects.length > 0
        && data.addPanelState.sourceObjects[ 0 ] ) {
        let second = _getRevisionObject( data.addPanelState.sourceObjects[ 0 ] );
        data.target = self.getObject( second );
    } else {
        let second = _getRevisionObject( mselected[1] );
        data.target = self.getObject( second );
    }

    toParams.uid = data.source.uid;
    toParams.uid2 = data.target.uid;
    toParams.pci_uid = '';
    toParams.pci_uid2 = '';
    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
    LocationNavigationService.instance.go( transitionTo, toParams, {} );
};


export default exports = {
    addFromStructure
};

