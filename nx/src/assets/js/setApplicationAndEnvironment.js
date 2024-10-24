// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/setApplicationAndEnvironment
 */
import appCtxSvc from 'js/appCtxService';
import uwPropertySvc from 'js/uwPropertyService';
import awIconService from 'js/awIconService';

/**
 *Added Preferences
 *TC_NX_Current_Environment
 *TC_NX_Environments
 *TC_NX_Applications
 *TC_NX_Current_Application
 *AWC_NX_ApplicationAndEnvironmentIsSupported
 */
var exports = {};

/**
 * Uses the selected event data to update/select a Client Application and Environment to be printed in the nxtcxml when using open in nx in stand alone
 *
 * @param {eventData} eventData - eventData selected from pop-up-link
 */

export let setApplication = function( eventData ) {
    if( eventData.property.propertyName === 'applicationInfo' ) {
        var appValue = [];
        appValue[ 0 ] = eventData.property.dbValue.props.object_string.dbValue;
        appCtxSvc.updatePartialCtx( 'preferences.TC_NX_Current_Application', appValue );
    }
};

export let setEnvironment = function( eventData ) {
    if( eventData.property.propertyName === 'environmentInfo' ) {
        var envValue = [];
        envValue[ 0 ] = eventData.property.dbValue.props.object_string.dbValue;
        appCtxSvc.updatePartialCtx( 'preferences.TC_NX_Current_Environment', envValue );
    }
};

export let CreateTCNXEnvOrAppVMOsAction = function( envOrAppPref ) {
    var envOrAppList = [];
    envOrAppPref.forEach( ( envOrApp ) => {
        var envOrAppObj = {};
        envOrAppObj.uid = envOrApp;
        envOrAppObj.props = {};
        var viewProp = uwPropertySvc.createViewModelProperty( 'object_string', 'object_string', 'string', envOrAppObj.uid,  [ envOrApp ]  );
        envOrAppObj.props[ viewProp.propertyName ] = viewProp;

        envOrAppObj.cellHeader1 = envOrApp;
        envOrAppObj.cellHeader2 = envOrAppObj.uid;
        envOrAppObj.modelType = 'Awp0Item';
        envOrAppObj.typeIconURL = awIconService.getTypeIconFileUrl( envOrAppObj );
        // Fake clear editable states for this mock vmo
        envOrAppObj.clearEditiableStates = function() { return; };

        envOrAppList.push( envOrAppObj );
    } );

    return {
        TC_NX_EnvOrAppVMOs: envOrAppList
    };
};


export default exports = {
    setApplication,
    setEnvironment,
    CreateTCNXEnvOrAppVMOsAction
};
