// Copyright (c) 2022 Siemens

/**
 * @module js/senEntSbomSplitViewer
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
        toParams.obj_uid = stateParams.obj_uid;
    }
    return toParams;
};

/**
   * Load SE data before page launch
   *
   * @returns {Promise} Promise after data load is done
   */
let loadEntSbomData = function() {
    let defer = AwPromiseService.instance.defer();

    const contextKeys = [ 'entSbomContext', 'entFilteredSbomContext' ];

    localeService.getLocalizedText( 'entSbomMessages', 'subTaskName' ).then( function( result ) {
        appCtxSvc.updatePartialCtx( 'sentaskPageContext.subTaskName', result );
    } );

    localeService.getLocalizedText( 'entSbomMessages', 'taskName' ).then( function( result ) {
        appCtxSvc.updatePartialCtx( 'sentaskPageContext.taskName', result );
    } );

    appCtxSvc.updatePartialCtx( 'requestPref.savedSessionMode', 'ignore' );

    appCtxSvc.updatePartialCtx( 'splitView.mode', true );

    appCtxSvc.updatePartialCtx( 'splitView.viewKeys', contextKeys );

    appCtxSvc.updatePartialCtx( 'skipAutoBookmark', true );

    // don't need to show the Right Wall.
    appCtxSvc.updatePartialCtx( 'hideRightWall', true );

    let toParams = getStateParams();
    let objectToLoad = [];
    if( toParams.obj_uid ) {
        objectToLoad.push( toParams.obj_uid );
        dmSvc.loadObjects( objectToLoad ).then( function() {
            let result = {};
            result.data = [];
            let entSbomObject = cdmSvc.getObject( toParams.obj_uid );
            if( entSbomObject ) {
                appCtxSvc.updatePartialCtx( 'sentaskPageContext.entSbomObject', entSbomObject );
                appCtxSvc.updatePartialCtx( 'sentaskPageContext.ccName', entSbomObject.props.object_string.dbValues[ 0 ] );
                let modelObjectsToOpen = {
                    entSbomContextInfo: {
                        modelObject: entSbomObject
                    },
                    entFilteredSbomContextInfo: {
                        modelObject: entSbomObject
                    }
                };
                result.data.push( modelObjectsToOpen );
            }
            defer.resolve( result );
        } );
    }
    return defer.promise;
};


let activateEntSbomWindow = function( eventData ) {
    let senEntSbomData = {
        selectedContextKey : ''
    };
    if( eventData.key ) {
        senEntSbomData.selectedContextKey = eventData.key;
    }
    return senEntSbomData;
};

export default {
    loadEntSbomData,
    activateEntSbomWindow
};
