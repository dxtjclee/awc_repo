// Copyright (c) 2022 Siemens

/**
 * @module js/senSplitViewerService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import dmSvc from 'soa/dataManagementService';


/**
 * Get state params
 *
 * @returns {Promise} The promise after fetching state parameters
 */
let getStateParams = function() {
    let toParams = {};
    let stateParams = appCtxSvc.getCtx( 'state.params' );
    if( stateParams ) {
        toParams.cc_uid = stateParams.cc_uid;
    }
    return toParams;
};


/**
 * Load SE data before page launch
 *
 * @returns {Promise} Promise after data load is done
 */
let loadSEData = function() {
    let defer = AwPromiseService.instance.defer();

    const contextKeys = [ 'ebomContext', 'sbomContext' ];

    localeService.getLocalizedText( 'senMessages', 'subTaskName' ).then( function( result ) {
        appCtxSvc.updatePartialCtx( 'sentaskPageContext.subTaskName', result );
    } );

    localeService.getLocalizedText( 'senMessages', 'taskName' ).then( function( result ) {
        appCtxSvc.updatePartialCtx( 'sentaskPageContext.taskName', result );
    } );
    let tcReleaseIsAtleast143 = isTcReleaseAtLeast( 14, 3 );
    appCtxSvc.updateCtx( 'tcReleaseIsAtleast143', tcReleaseIsAtleast143 );
    appCtxSvc.updatePartialCtx( 'requestPref.savedSessionMode', 'ignore' );

    appCtxSvc.updatePartialCtx( 'splitView.mode', true );

    appCtxSvc.updatePartialCtx( 'splitView.viewKeys', contextKeys );

    appCtxSvc.updatePartialCtx( 'skipAutoBookmark', true );

    // don't need to show the Right Wall.
    appCtxSvc.updatePartialCtx( 'hideRightWall', true );

    let toParams = getStateParams();
    let objectToLoad = [];
    if( toParams.cc_uid ) {
        objectToLoad.push( toParams.cc_uid );
        dmSvc.loadObjects( objectToLoad ).then( function() {
            let result = {};
            result.data = [];
            let ccObject = cdmSvc.getObject( toParams.cc_uid );
            if( ccObject ) {
                appCtxSvc.updatePartialCtx( 'sentaskPageContext.ccObject', ccObject );
                appCtxSvc.updatePartialCtx( 'sentaskPageContext.ccName', ccObject.props.object_string.dbValues[ 0 ] );
                let modelObjectsToOpen = {
                    ebomContextInfo: {
                        modelObject: ccObject
                    },
                    sbomContextInfo: {
                        modelObject: ccObject
                    }
                };
                result.data.push( modelObjectsToOpen );
            }
            defer.resolve( result );
        } );
    }
    return defer.promise;
};

let activateSenWindow = function( eventData ) {
    let senData = {
        selectedContextKey : ''
    };
    if( eventData.key ) {
        senData.selectedContextKey = eventData.key;
    }
    return senData;
};

/**
 * Method to check TC version
 *@param {String} majorVersion major version tocheck
  *@param {String} minorVersion minor version to check
 * @returns {Bool} true if the version matches the input else returns fasle
 */
let isTcReleaseAtLeast = function( majorVersion, minorVersion ) {
    let majVer =  appCtxSvc.getCtx( 'tcSessionData.tcMajorVersion' );
    let minVer =  appCtxSvc.getCtx( 'tcSessionData.tcMinorVersion' );

    if( majVer > majorVersion ||  majVer === majorVersion && minVer >= minorVersion   ) {
        return true;
    }

    return false;
};

export default {
    loadSEData,
    activateSenWindow
};
