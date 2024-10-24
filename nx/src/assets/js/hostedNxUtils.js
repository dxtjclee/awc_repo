// Copyright (c) 2022 Siemens

/**
 * This module is an NX Utility module. NX Specific Javascript will be injected from here.
 *
 * @module js/hostedNxUtils
 * @namespace hostedNxUtils
 */
import { getBaseUrlPath } from 'app';
import appCtxService from 'js/appCtxService';
import preferenceSvc from 'soa/preferenceService';
import hostQueryService from 'js/hosting/hostQueryService';
import hostInteropSvc from 'js/hosting/hostInteropService';
import hostConfigSvc from 'js/hosting/hostConfigService';
import hostConfigValues from 'js/hosting/hostConst_ConfigValues';
import $ from 'jquery';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cfgSvc from 'js/configurationService';
import 'config/hosting';

var exports = {};


/**
 *
 */
export let initialize = function() {
    //check if host type is nx then perform tasks to initialize the module
    eventBus.subscribe( 'hosting.configured', function( ) {
        if( hostConfigSvc.getHostType() === hostConfigValues.HOST_TYPE_NX ) {
            exports.injectNxCSS();
            exports.addDatasetTypesToAppContext();
            exports.subscribeInteropQueryEvent();
        }
    } );
};

/**
 *
 */
export let injectNxCSS = function() {
    var baseUrlPath = getBaseUrlPath();
    var link = document.createElement( 'link' );
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = baseUrlPath + '/css/nx_hosted.css';
    $( 'head' ).append( link );
};


/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostedNxUtils
 */
export let subscribeInteropQueryEvent = function() {
    //check if host type is nx then perform tasks to register the module
    eventBus.subscribe( 'nxCommands.update', function( eventData ) {
        if( eventData.name === 'visibleServerCommands' ) {
            exports.updateCommandVisibilityContext();
        }
    } );
};

/**
 *
 */
export let addDatasetTypesToAppContext = function() {
    var foreignDatasetTypes = [ 'UGMASTER', 'UGPART', 'UGALTREP', 'UGSCENARIO', 'NXSimulation', 'NXMotion',
        'CAESolution', 'CAEMesh', 'CAEGeom', 'UGCAMPTP', 'UGCAMCLSF'
    ];

    var prefNames = [ 'TC_NX_Foreign_Datasets' ];

    preferenceSvc.getStringValues( prefNames ).then( function( values ) {
        if( values ) {
            for( var i = 0; i < values.length; i++ ) {
                var result = values[ i ];

                if( result !== null && result.length > 0 ) {
                    var DELIMS = '"';
                    var DATASET_TYPE = 'DatasetType';

                    var tokens = result.split( DELIMS );

                    for( var ii = 0; ii < tokens.length; ii++ ) {
                        var currToken = tokens[ ii ].trim();

                        if( ( function( str, searchString, position ) {
                            return str.substr( position, searchString.length ) === searchString;
                        } )( currToken, DATASET_TYPE, 0 ) ) {
                            if( ii < tokens.length - 1 ) {
                                var dataTypeVal = tokens[ ++ii ].trim();
                                foreignDatasetTypes.push( dataTypeVal );
                                break;
                            }
                        }
                    }
                }
            }
        }
    } );
    appCtxService.registerCtx( 'nxDatasetDelegateTypes', foreignDatasetTypes );
};

/**
 *
 */
export let updateCommandVisibilityContext = function() {
    // We will call the service here and update the context here. Right now it is a Sync service, but it
    // would be agood IDea to move to Async ASAP.

    var hostingConfig = cfgSvc.getCfgCached( 'hosting' );

    var commandIdList = hostingConfig.nxCommandsList;

    _.forEach( commandIdList, function( commandId ) {
        var ctxToUpdate = 'nxVisiblity_' + commandId;

        if( hostInteropSvc.isRemoteHostingEnabled() ) {
            hostQueryService.isQueryAvailableForCommandAsync( commandId ).then( function( canHostHandleQuery ) {
                var isCommandSupported = false;

                if( canHostHandleQuery ) {
                    var selectedObjects = appCtxService.getCtx( 'mselected' );

                    hostQueryService.areAnyObjectsSupportedAsync( commandId, selectedObjects ).then( function( isCommandSupportedAsync ) {
                        appCtxService.updateCtx( ctxToUpdate, isCommandSupportedAsync );
                    } );
                } else {
                    appCtxService.updateCtx( ctxToUpdate, isCommandSupported );
                }
            } );
        } else {
            var isCommandSupported = false;

            var canHostHandleQuery = hostQueryService.isQueryAvailableForCommand( commandId );

            if( canHostHandleQuery ) {
                var selectedObjects = appCtxService.getCtx( 'mselected' );

                isCommandSupported = hostQueryService.areAnyObjectsSupported( commandId, selectedObjects );
            }

            appCtxService.updateCtx( ctxToUpdate, isCommandSupported );
        }
    } );
};

export default exports = {
    initialize,
    injectNxCSS,
    subscribeInteropQueryEvent,
    addDatasetTypesToAppContext,
    updateCommandVisibilityContext
};
