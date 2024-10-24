// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Eda0OpenInViewerService
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import propSvc from 'soa/kernel/propertyPolicyService';
import msgSvc from 'js/messagingService';
import prefSvc from 'soa/preferenceService';
import localeSvc from 'js/localeService';

var exports = {};

var serverUrl = null;

var designInfo = null;

var url = null;

/**
 * This method opens the EDACCABaseRevision object in new tab in external viewer
 */
export let redirectToUrl = function() {
    prefSvc.getStringValue( 'EDA_EDMHosting.URL' ).then( function( result ) {
        var resource = 'EdaMessages';
        var localTextBundle = localeSvc.getLoadedText( resource );
        var localizedMsg = localTextBundle.preferenceNotConfigured;
        if( result !== '' && result !== null ) {
            serverUrl = result;
        } else {
            msgSvc.showError( localizedMsg );
        }
    } );

    var inputData = {
        primaryObjects: [ {
            uid: appCtxSvc.ctx.selected.uid,
            type: appCtxSvc.ctx.selected.type
        } ],
        pref: {
            expItemRev: false,
            returnRelations: true,
            info: [ {
                relationTypeName: 'Eda0HasDesignInfo',
                otherSideObjectTypes: [ 'Eda0MentorDesignInfo' ]
            } ]
        }
    };

    var policyId = propSvc.register( {
        types: [ {
            name: 'Eda0MentorDesignInfo',
            properties: [ {
                name: 'eda0CadProjectUid'
            } ]
        } ]
    } );

    //Fetch the secondary object Eda0MentorDesignInfo attached to the EDACCABaseRevision based on relation provided.
    soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputData ).then( function( result ) {
        serverUrl = validateEdmHostingUrl( serverUrl );
        if( result.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ] ) {
            designInfo = result.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject;
        }
        url = constructEDMProjectURL( designInfo );
        if( url !== '' ) {
            //Open the url in new tab
            window.open( url, '_tab' );
        }
        propSvc.unregister( policyId );
    } );
};

/**
 * Constructs edm project url to open in external EDM viewer.
 * @param {any} designInfo object to fecth url details.
 * @returns {String} EDM project url.
 */
function constructEDMProjectURL( designInfo ) {
    var prjUrl = '';
    if( designInfo !== null ) {
        var projPath = designInfo.props.eda0CadProjectUid.dbValues[ 0 ];
        if( projPath !== null && projPath !== '' && serverUrl !== null && serverUrl !== '' ) {
            prjUrl = serverUrl + '/xdm.web/design/openPath?path=/' + projPath + '&showDetails';
        }
    }
    return prjUrl;
}

/**
 * Checks and appends http to the URL if required.
 * @param {any} serverUrl server url.
 * @returns {String} corrected server url.
 */
function validateEdmHostingUrl( serverUrl ) {
    //Check and append the http to the EDM hosting URL if not present.
    if( serverUrl !== null && serverUrl !== '' ) {
        if( !serverUrl.includes( 'http://' ) ) {
            serverUrl = 'http://' + serverUrl;
        }
    }
    return serverUrl;
}

export default exports = {
    redirectToUrl
};
