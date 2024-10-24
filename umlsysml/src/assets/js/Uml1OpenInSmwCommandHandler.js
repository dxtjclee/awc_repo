// Copyright (c) 2022 Siemens

import _ from 'lodash';
import browserUtils from 'js/browserUtils';
import logger from 'js/logger';
import appCtxSvc from 'js/appCtxService';
import preferenceService from 'soa/preferenceService';
import soaSvc from 'soa/kernel/soaService';
import fileManagementService from 'soa/fileManagementService';
import cdm from 'soa/kernel/clientDataModel';
import messagingService from 'js/messagingService';

var exports = {};
var SMW_MIME_TYPE = 'Sym0SysSmw';

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Uml1OpenInSmwCommandHandler
 */
var getServerInfoString = function( ssoHostPathUrl ) {
    var CLIENT_SOA_PATH = 'tc/';
    var _soaPath = browserUtils.getBaseURL() + CLIENT_SOA_PATH;

    var protocol = _soaPath.substring( 0, _soaPath.indexOf( '://', 0 ) );
    return 'Protocol=' + protocol + '&' + 'HostPath=' + _soaPath;
};
var getUserToken = function( userName ) {
    return 'UserName=' + userName;
};
var getUid = function( selectedObj ) {
    if ( selectedObj === undefined || selectedObj === null ) {
        return 'SelectedObject=' + '';
    }
    return 'SelectedObject=' + selectedObj;
};
var getSecureToken = function( secureToken ) {
    var encodedSecureToken = encodeURIComponent( secureToken );
    return 'SessionInfo=' + encodedSecureToken;
};

var getProjectModelUid = function( projectModelUid ) {
    if ( projectModelUid === undefined || projectModelUid === null ) {
        return 'projectModelUid=' + '';
    }
    return 'projectModelUid=' + projectModelUid;
};

var getDiagramId = function( diagramId ) {
    if ( diagramId === undefined || diagramId === null ) {
        return 'diagramId=' + '';
    }
    return 'diagramId=' + diagramId;
};

var getRevisionRule = function( revRule ) {
    if ( revRule === undefined || revRule === null ) {
        return 'revRule=' + '';
    }
    return 'revRule=' + revRule;
};

var getRevisionRuleName = function( revRuleObjectName ) {
    if ( revRuleObjectName === undefined || revRuleObjectName === null ) {
        return 'revRuleName=' + '';
    }
    return 'revRuleName=' + revRuleObjectName;
};

export let Uml1OpenInSmwCommandHandler = function( sourceObjects, data, occContext ) {
    var mimeType = null;
    var diagramId = null;
    var projectModelUid = null;
    var selectedObj = null;
    var bhv1OwningBranch = null;
    var revRuleObject = null;
    var revRuleObjectName = null;
    var xmlTagName = 'MMGXML';

    soaSvc.post( 'Core-2008-03-Session', 'connect', { featureKey: 'sdpd_smw_pro', action: 'get' } ).then(
        ( response ) => {
            /* 10 in parseInt function represents the base to be used for the  response.outputVal
                No need to check negative outputVal as they are errors and soaSvc.post throughs exception for errors which are handled */
            if ( parseInt( response.outputVal, 10 ) >= 0 ) {
                if ( sourceObjects ) {
                    if ( sourceObjects[0].type === 'Seg0Diagram' ) {
                        projectModelUid = sourceObjects[0].props.seg0OwningModel.dbValues[0];
                        diagramId = sourceObjects[0].props.seg0Id.dbValues[0];
                    } else if ( sourceObjects[0].type === 'Fnd0LogicalBlockRevision' ) {
                        if ( sourceObjects[0].props.Uml0AssociatedModel.dbValues !== null && sourceObjects[0].props.Uml0AssociatedModel.dbValues.length > 0 ) {
                            //Project model associated to System block
                            projectModelUid = sourceObjects[0].props.Uml0AssociatedModel.dbValues[0];
                        } else {
                            //No Project model associated to System block hence return uid of system block
                            selectedObj = sourceObjects[0].uid;
                        }
                    } else if ( sourceObjects[0].type === 'Uml0MLModelRevision' ) {
                        projectModelUid = sourceObjects[0].uid;
                    } else if ( sourceObjects[0].type === 'Ase0AssocRelationProxy' ) {
                        var diagramUid = sourceObjects[0].props.ase0EndObject.dbValues[0];
                        var diagramObject = cdm.getObject( diagramUid );
                        projectModelUid = diagramObject.props.seg0OwningModel.dbValues[0];
                        diagramId = diagramObject.props.seg0Id.dbValues[0];
                    } else if ( occContext.topElement.modelType.typeHierarchyArray.indexOf( 'Uml1ModelElement' ) > -1 ) {
                        projectModelUid = occContext.topElement.props.awb0UnderlyingObject.dbValues[0];
                        selectedObj = occContext.selectedModelObjects[0].props.awb0UnderlyingObject.dbValues[0];
                        var revRule = occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[0];

                        if ( !_.isEmpty( revRule ) ) {
                            revRuleObject = cdm.getObject( occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[0] );
                            if ( revRuleObject && revRuleObject.props && revRuleObject.props.object_name
                                    && revRuleObject.props.object_name.dbValues && revRuleObject.props.object_name.dbValues.length > 0 ) {
                                revRuleObjectName = revRuleObject.props.object_name.dbValues[0];
                            }
                        }
                    }
                    mimeType = SMW_MIME_TYPE;
                    downloadfile( selectedObj, mimeType, diagramId, projectModelUid, revRule, revRuleObjectName, bhv1OwningBranch, xmlTagName );
                }
            }
        }
    )
        .catch(
            ( exception ) => {
                logger.error( 'Failed to get the sdpd_smw_pro license.' );
                var objectname = '';
                if ( sourceObjects ) {
                    if ( sourceObjects[0].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                        objectname = sourceObjects[0].props.object_string.dbValues[0];
                    } else if ( sourceObjects[0].type === 'Ase0AssocRelationProxy' ) {
                        objectname = sourceObjects[0].props.object_string.dbValue;
                    } else {
                        objectname = sourceObjects[0].props.object_name.dbValues[0];
                    }
                }
                var LicenseNotFoundMessage = messagingService.applyMessageParams( data.i18n.licenseNotFound, [ '{{object_name}}', '{{toolname}}' ], {
                    object_name: objectname,
                    toolname: 'SMW'
                } );
                messagingService.showError( LicenseNotFoundMessage );
            }
        );
};

var downloadfile = function( selectedObj, mimeType, diagramId, projectModelUid, revRule, revRuleObjectName, bhv1OwningBranch, xmlTagName ) {
    var userName = appCtxSvc.ctx.userSession.props.user_id.dbValues[0];
    var time = 300;
    var input = {
        duration: time
    };

    return soaSvc.postUnchecked( 'Internal-Core-2014-11-Session', 'getSecurityToken', input ).then(
        function( responseData ) {
            var secureToken = responseData.out;
            var prefNames2 = [ 'WEB_default_site_deployed_app_name' ];
            var prefPromise = preferenceService.getStringValues( prefNames2 );
            if ( prefPromise ) {
                prefPromise.then( function( values ) {
                    if ( values ) {
                        var ssoHostPathUrl = '/' + values[0];
                        var uriToLaunch = browserUtils.getBaseURL() + 'launcher/openin' + '?' + 'xmlTagName=' + xmlTagName + '&' + 'mimeType=' + mimeType + '&' +
                            getServerInfoString( ssoHostPathUrl ) + '&' + getUid( selectedObj ) + '&' + getSecureToken( secureToken )
                            + '&' + getProjectModelUid( projectModelUid ) + '&' + getDiagramId( diagramId ) + '&' + getRevisionRule( revRule ) + '&' + getRevisionRuleName( revRuleObjectName ) + '&' + getUserToken( userName );
                        window.open( uriToLaunch, '_self', 'enabled' );
                    }
                } );
            }
        } );
};

export let downloadPartFile = function( filesUiValues, fileDbValues ) {
    for ( var i = 0; i < filesUiValues.length; i++ ) {
        if ( filesUiValues[i].endsWith( 'prt' ) ) {
            fileManagementService.getFileReadTickets( fileDbValues[i] );
            return;
        }
    }
};

export default exports = {
    downloadPartFile,
    Uml1OpenInSmwCommandHandler
};
