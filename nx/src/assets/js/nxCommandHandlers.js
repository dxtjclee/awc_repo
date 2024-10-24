// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/nxCommandHandlers
 */
import appCtxSvc from 'js/appCtxService';
import preferenceSvc from 'soa/preferenceService';
import soaSvc from 'soa/kernel/soaService';
import fileManagementService from 'soa/fileManagementService';
import tcServerVersion from 'js/TcServerVersion';
import cmm from 'soa/kernel/clientMetaModel';
import hostOpenService from 'js/hosting/hostOpenService';
import tcSessionData from 'js/TcSessionData';
import viewModelObjectSvc from 'js/viewModelObjectService';
import commandPanelService from 'js/commandPanel.service';
import cdm from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import browserUtils from 'js/browserUtils';
import _uwPropSrv from 'js/uwPropertyService';
import addObjectUtils from 'js/addObjectUtils';
import objectsToPackedOccurrenceCSIDsService from 'js/objectsToPackedOccurrenceCSIDsService';
import csidsToObjectsConverterService from 'js/csidsToObjectsConverterService';
import createWorksetService from 'js/createWorksetService';
import _ from 'lodash';
import logger from 'js/logger';
import declUtils from 'js/declUtils';


var exports = {};

var _fileInputForms;

var nxOpenObjectToOpen = [];

/******************************************************************************************************************/
// Begin Stand ALone commands handlers
/******************************************************************************************************************/

var getSelectionStrings = function( selectedObjects ) {
    if( selectedObjects ) {
        var selectedString = 'SelectedObject=';
        if( _.isArray( selectedObjects ) ) {
            for( var i = 0; i < selectedObjects.length; i++ ) {
                if( selectedObjects[ i ].modelType !== 'mselected' ) {
                    // 2 different scenarios exist when folders are selected, if only the home folder is selected or if any folders are selected with items
                    if( cmm.isInstanceOf( 'Folder', selectedObjects[ i ].modelType ) ) {
                        // This scenario only occurs when the home folder is being Opened
                        // Removes the Selected Object line in the downloaded file to prevent errors upon opening NX
                        if( selectedString === 'SelectedObject=' ) {
                            selectedString = '';
                        } else {
                            // Covers all other scenarios of folders being selected with items to Open in NX
                            // Folders are checked last for selected objects in the Open in NX file, this ensures nothing is added on to the item UIDs in file
                            selectedString = selectedString.concat( '' );
                        }
                    } else {
                        // Adds items, assemblies, etc as normal
                        selectedString = selectedString.concat( selectedObjects[ i ].uid );
                        // Allows for multiple objects to be Opened in NX together
                        if( i + 1 < selectedObjects.length ) {
                            selectedString = selectedString.concat( ' ' );
                        }
                    }
                }
            }
        } else {
            if( selectedObjects.uid !== null ) {
                selectedString = selectedString.concat( selectedObjects.uid );
            }
        }
        return selectedString;
    }
};
var getProductContextInfo = function() {
    var pciUID = appCtxSvc.getCtx( 'occmgmtContext.productContextInfo.uid' );
    if( pciUID ) {
        return 'ProductContextInfo=' + pciUID;
    }
};
var getContextObject = function() {
    var coUID = appCtxSvc.getCtx( 'occmgmtContext.productContextInfo.props.awb0ContextObject.dbValues[0]' );
    if( coUID ) {
        return 'ContextObject=' + coUID;
    }
};
var getContextObjectType = function() {
    var coUID = appCtxSvc.getCtx( 'occmgmtContext.productContextInfo.props.awb0ContextObject.dbValues[0]' );
    if( coUID ) {
        var obj = cdm.getObject( coUID );
        if( obj ) {
            return 'ContextObjectType=' + obj.type;
        }
    }
};
var getServerInfoString = function( ssoHostPathUrl ) {
    var CLIENT_SOA_PATH = 'tc';
    var _soaPath = browserUtils.getBaseURL() + CLIENT_SOA_PATH;

    var protocol = _soaPath.substring( 0, _soaPath.indexOf( '://', 0 ) );
    return 'Protocol=' + protocol + '&' + 'HostPath=' + _soaPath + '&' + 'SSOHostPathValue=' + _soaPath + '&' + 'Server_Version=' + tcServerVersion.majorVersion;
};
var getUserToken = function( userName ) {
    return 'UserName=' + userName;
};
var getAppToken = function( app ) {
    return 'Application=' + app;
};
var getEnvToken = function( env ) {
    return 'Environment=' + env;
};
var getOEMToken = function( oem ) {
    return 'OEMDefitionDir=' + oem;
};
var getSSOToken = function( sso ) {
    return 'tcSSOURL=' + sso;
};
var getFSCToken = function( fsc ) {
    return 'FSCURL=' + fsc;
};
var getTCCSToken = function( tccs ) {
    return 'TCCSENV=' + tccs;
};
var getSecureToken = function( secureToken ) {
    var encodedSecureToken = encodeURIComponent( secureToken );
    return 'SessionInfo=' + encodedSecureToken;
};
export let nxTcXmlCommandHandler = function( sourceObjects ) {
    var versionNumber;
    if( sourceObjects.props && sourceObjects.props.revision_number && sourceObjects.props.revision_number.dbValue ) {
        versionNumber = sourceObjects.props.revision_number.dbValue;
        sourceObjects = [ appCtxSvc.ctx.selected ];
    }
    if ( !Array.isArray( sourceObjects ) ) {
        sourceObjects = [ sourceObjects ];
    }

    // If a revision is not configured correctly, don't include it.
    sourceObjects = sourceObjects.filter( function( sourceObject ) {
        if ( sourceObject && ( !sourceObject.props.awb0UnderlyingObject || sourceObject.props.awb0UnderlyingObject.dbValues[ 0 ] ) ) {
            return sourceObject;
        }
        return null;
    } );

    var userName = appCtxSvc.ctx.userSession.props.user_id.dbValues[ 0 ];
    var time = 300;
    var input = {
        duration: time
    };

    return soaSvc.postUnchecked( 'Internal-Core-2014-11-Session', 'getSecurityToken', input ).then(
        function( responseData ) {
            var secureToken = responseData.out;

            var promiseChain = Promise.resolve();

            var productContextInfo = getProductContextInfo();
            var getCloneStableIDsWithPackedOccurrencesResult = '';
            //In search view, there is no product context info, so we cannot get packed items and should treat the input as non-packed.
            //Additionally, if the input is not of an Awb0Element derived type, we should not make the call. getCloneStableIDsWithPackedOccurrences() does not
            //properly prevent making the SOA call for such items (which are non-packed)
            if ( productContextInfo && appCtxSvc.getCtx( 'selected' ).modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                getCloneStableIDsWithPackedOccurrencesResult = objectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( productContextInfo, sourceObjects );
            }
            //getCloneStableIDsWithPackedOccurrences returns undefined if there are no packed items, so check if the result is undefined.
            //if it is undefined, then the item to open is not packed, and we should open as normal.
            if( getCloneStableIDsWithPackedOccurrencesResult ) {
                promiseChain = getCloneStableIDsWithPackedOccurrencesResult;
            }
            promiseChain.then(
                function( responseData ) {
                    if( getCloneStableIDsWithPackedOccurrencesResult ) {
                        //Since we want to load the packed items, we want to set shouldFocusOnHiddenPackedElements to true.
                        var shouldFocusOnHiddenPackedElements = 'true';
                        //Perform search to obtain the Model Objects for each CSID
                        return csidsToObjectsConverterService.doPerformSearchForProvidedCSIDChains( responseData.csids, shouldFocusOnHiddenPackedElements );
                    }
                    return;
                }
            ).then( function( responseData ) {
                if( getCloneStableIDsWithPackedOccurrencesResult ) {
                    var objectsToOpenInNX = [];
                    //Need to pass in array of Model Objects to openInHost, so we massage responseData to obtain that
                    responseData.elementsInfo.forEach( objectToOpenInNX => {
                        objectsToOpenInNX.push( objectToOpenInNX.element );
                    } );
                    sourceObjects = objectsToOpenInNX;
                }
            } ).then( function() {
                var prefNames = [ 'AWC_NX_TCCS_ENV', 'AWC_NX_SSO_URL', 'AWC_NX_FSC_URL' ];
                preferenceSvc.getStringValues( prefNames ).then( function( values ) {
                    var uriToLaunch = browserUtils.getBaseURL() + 'launcher/openinnx?';

                    // Check if any types are unsupported.
                    // If unsupported type preference is unset or object type couldn't be found, then treat no type as unsupported..
                    sourceObjects = sourceObjects.filter( sourceObject => {
                        var unsupportedTypes = appCtxSvc.ctx.preferences.AWC_NX_OpenUnsupportedTypes;
                        var objectType = sourceObject.props.awb0UnderlyingObjectType || sourceObject.props.object_type;
                        return !( objectType && unsupportedTypes && unsupportedTypes.includes( objectType.dbValues[0] ) );
                    } );

                    if ( sourceObjects.length > 0 ) {
                        uriToLaunch = uriToLaunch + getSelectionStrings( sourceObjects ) + '&';
                    }
                    uriToLaunch = uriToLaunch + getServerInfoString( appCtxSvc.ctx.preferences.AWC_NX_SSO_URL ) + '&' +
                     getUserToken( userName ) + '&' + getSecureToken( secureToken );
                    if( versionNumber ) {
                        uriToLaunch = uriToLaunch + '&' + 'VersionNumber=' + versionNumber;
                    }
                    if( appCtxSvc.ctx.preferences.TC_NX_Current_Application && appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported &&
                        appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported[ 0 ] === 'true' ) {
                        uriToLaunch = uriToLaunch + '&' + getAppToken( appCtxSvc.ctx.preferences.TC_NX_Current_Application[ 0 ] );
                    }
                    if( appCtxSvc.ctx.preferences.TC_NX_Current_Environment && appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported &&
                         appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported[ 0 ] === 'true' ) {
                        uriToLaunch = uriToLaunch + '&' + getEnvToken( appCtxSvc.ctx.preferences.TC_NX_Current_Environment[ 0 ] );
                    }
                    if( appCtxSvc.ctx.preferences.TC_NX_OEM_DEFINITION_DIR && appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported &&
                         appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported[ 0 ] === 'true' ) {
                        uriToLaunch = uriToLaunch + '&' + getOEMToken( appCtxSvc.ctx.preferences.TC_NX_OEM_DEFINITION_DIR );
                    }

                    if( appCtxSvc.ctx.preferences.AWC_NX_SSO_URL ) {
                        uriToLaunch = uriToLaunch + '&' + getSSOToken( appCtxSvc.ctx.preferences.AWC_NX_SSO_URL );
                    }

                    if( appCtxSvc.ctx.preferences.AWC_NX_TCCS_ENV ) {
                        uriToLaunch = uriToLaunch + '&' + getTCCSToken( appCtxSvc.ctx.preferences.AWC_NX_TCCS_ENV );
                    }

                    if( appCtxSvc.ctx.preferences.AWC_NX_FSC_URL ) {
                        uriToLaunch = uriToLaunch + '&' + getFSCToken( appCtxSvc.ctx.preferences.AWC_NX_FSC_URL );
                    }
                    if( getProductContextInfo() !== undefined ) {
                        uriToLaunch = uriToLaunch + '&' + getProductContextInfo();
                    }

                    let currentCtx = appCtxSvc.ctx.aceActiveContext === undefined ? null : appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
                    if ( appCtxSvc.getCtx( 'preferences.AWC_NX_Supports_TempSession' ) &&
                           appCtxSvc.getCtx( 'preferences.AWC_NX_Supports_TempSession' )[0] === 'true' &&
                           ( appCtxSvc.getCtx( 'occmgmtContext.topElement.type' ) === 'Awb0PartElement' ||
                                ( appCtxSvc.getCtx( 'mselected' )[0] === appCtxSvc.getCtx( 'occmgmtContext.topElement' ) ||
                                 sourceObjects[0] === appCtxSvc.getCtx( 'occmgmtContext.topElement' ) ) &&
                                currentCtx !== null && currentCtx.productContextInfo.props.awb0FilterCount.dbValues[0] > 0

                           )

                    ) {
                        //LCS-652326 - If we send part that is a sub element in ebom scenario, nx doesn't handle properly. So instead we
                        //substitute sub element in this case with top element.
                        var nxtcxmlObjectsToOpen = nxOpenObjectToOpen;
                        nxtcxmlObjectsToOpen = nxOpenObjectToOpen.filter( nxOpenObject =>{
                            if( nxOpenObject.type === 'Awb0PartElement' && nxOpenObject !== appCtxSvc.getCtx( 'occmgmtContext.topElement' ) ) {
                                return appCtxSvc.getCtx( 'occmgmtContext.topElement' );
                            }
                            return nxOpenObject;
                        } );
                        //LCS-652326 - No need to eliminate duplicates in this case (unlike in openInNX) since the only the first element
                        //in the selection is used, and that element should always be topElement if the LCS-652326 fix using filters was used.
                        uriToLaunch = uriToLaunch + '&' + 'ContextObject=' + nxtcxmlObjectsToOpen[0].uid;
                        uriToLaunch = uriToLaunch + '&' + 'ContextObjectType=' + 'Fnd0TempAppSession';
                    } else {
                        if( getContextObject() !== undefined ) {
                            uriToLaunch = uriToLaunch + '&' + getContextObject();
                        }
                        if( getContextObjectType() !== undefined ) {
                            uriToLaunch = uriToLaunch + '&' + getContextObjectType();
                        }
                    }
                    //if 3D is active or previously loaded then set skip as true to avoid viewer unload
                    let skipBeforeUnload = appCtxSvc.getCtx( 'viewer.skipBeforeUnloadExecution' );
                    if( skipBeforeUnload === false ) {
                        appCtxSvc.updatePartialCtx( 'viewer.skipBeforeUnloadExecution', true );
                    }
                    window.open( uriToLaunch, '_self', 'enabled' );
                } );
            } );
        } );
};

export let downloadPartFile = function( filesUiValues, fileDbValues ) {
    for( var i = 0; i < filesUiValues.length; i++ ) {
        if( filesUiValues[ i ].endsWith( 'prt' ) ) {
            fileManagementService.getFileReadTickets( fileDbValues[ i ] );
            return;
        }
    }
};

/**
 * Uses the underlying object for the case of Workset Revision in Hosted NX
 *
 * @param {IModelObject|IModelObjectArray} sourceObjects - IModelObject(s) to open.
 */
export let openInNX = function( sourceObjects ) {
    let sourceObjectsToOpen = openInNXInitialChecks( sourceObjects );
    let isPacked = false;
    // Check if any of the selected objects is packed
    for( let sourceObject of sourceObjectsToOpen ) {
        if( sourceObject.props && sourceObject.props.awb0IsPacked && sourceObject.props.awb0IsPacked.dbValues &&
            _.isEqual( sourceObject.props.awb0IsPacked.dbValues[ 0 ], '1' ) ) {
            isPacked = true;
        }
    }

    // Call openPackedInNx only if any of the selected objects is packed
    if( isPacked ) {
        let getCloneStableIDsWithPackedOccurrencesResult = openInNXCheckPacked( sourceObjectsToOpen );
        if( getCloneStableIDsWithPackedOccurrencesResult ) {
            openPackedInNX( getCloneStableIDsWithPackedOccurrencesResult ).then( function( responseData ) {
                hostOpenService.openInHost( responseData );
            } );
        }
    }else{
        hostOpenService.openInHost( sourceObjectsToOpen );
    }
};

/**
 * Does some initial checks and filtering on the source objects
 *
 * @param {IModelObject|IModelObjectArray} sourceObjects - IModelObject(s) to filter through.
 */
export let openInNXInitialChecks = function( sourceObjects ) {
    //In the testing environment appCtxSvc.ctx.aceActiveContext was undefined, leading to tests to fail and exceptions to be thrown
    let currentCtx = appCtxSvc.ctx.aceActiveContext === undefined ? null : appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
    if ( appCtxSvc.getCtx( 'preferences.AWC_NX_Supports_TempSession' ) &&
        appCtxSvc.getCtx( 'preferences.AWC_NX_Supports_TempSession' )[0] === 'true' &&
        ( appCtxSvc.getCtx( 'occmgmtContext.topElement.type' ) === 'Awb0PartElement' ||
            ( appCtxSvc.getCtx( 'mselected' )[0] === appCtxSvc.getCtx( 'occmgmtContext.topElement' ) ||
             sourceObjects[0] === appCtxSvc.getCtx( 'occmgmtContext.topElement' ) ) &&
            currentCtx !== null && currentCtx.productContextInfo.props.awb0FilterCount.dbValues[0] > 0

        )

    ) {
        //LCS-652326 - If we send part that is a sub element in ebom scenario, nx doesn't handle properly. So instead we
        //substitute sub element in this case with top element.
        sourceObjects = nxOpenObjectToOpen.filter( nxOpenObject => {
            if ( nxOpenObject.type === 'Awb0PartElement' && nxOpenObject !== appCtxSvc.getCtx( 'occmgmtContext.topElement' ) ) {
                return appCtxSvc.getCtx( 'occmgmtContext.topElement' );
            }
            return nxOpenObject;
        } );
        //LCS-652326 - Because of multiselection, there can be duplicates after using the LCS-652326 filter fix, so let's remove those.
        sourceObjects = sourceObjects.filter( ( sourceObject1, sourceObject1Index ) => {
            return sourceObjects.indexOf( sourceObject1 ) === sourceObject1Index;
        } );
    }


    var check = false;
    for ( var it = 0; it < sourceObjects.length; it++ ) {
        if ( sourceObjects[it] && ( cmm.isInstanceOf( 'Cpd0WorksetRevision', sourceObjects[it].modelType )
            || cmm.isInstanceOf( 'Fnd0TempAppSession', sourceObjects[it].modelType ) ) ) {
            check = true;
            break;
        }
    }


    var sourceObjectsToOpen = sourceObjects;
    if ( !check ) {
        sourceObjectsToOpen = appCtxSvc.getCtx( 'mselected' );
        // Check if any types are unsupported.
        // If unsupported type preference is unset or object type couldn't be found, then treat no type as unsupported..
        sourceObjectsToOpen = sourceObjectsToOpen.filter( sourceObject => {
            var unsupportedTypes = appCtxSvc.ctx.preferences.AWC_NX_OpenUnsupportedTypes;
            var objectType = sourceObject.props.awb0UnderlyingObjectType || sourceObject.props.object_type;
            return !( objectType && unsupportedTypes && unsupportedTypes.includes( objectType.dbValues[0] ) );
        } );
    }
    return sourceObjectsToOpen;
};

/**
 * Checks if objects are packed or not, returns a promise if they are
 *
 * @param {IModelObject|IModelObjectArray} sourceObjects - Packed objects to check.
 */
export let openInNXCheckPacked = function( sourceObjects ) {
    var productContextInfo = getProductContextInfo();
    var getCloneStableIDsWithPackedOccurrencesResult = '';

    //In search view, there is no product context info, so we cannot get packed items and should treat the input as non-packed.
    //Additionally, if the input is not of an Awb0Element derived type, we should not make the call. getCloneStableIDsWithPackedOccurrences() does not
    //properly prevent making the SOA call for such items (which are non-packed)
    if ( productContextInfo && appCtxSvc.getCtx( 'selected' ).modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        getCloneStableIDsWithPackedOccurrencesResult = objectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( productContextInfo, sourceObjects );
    }
    return getCloneStableIDsWithPackedOccurrencesResult;
};

/**
 * sets up a promise to return packed objects
 *
 * @param {Promise} getCloneStableIDsWithPackedOccurrencesResult promise to set up
 */
export let openPackedInNX = function( getCloneStableIDsWithPackedOccurrencesResult ) {
    return getCloneStableIDsWithPackedOccurrencesResult.then(
        function( responseData ) {
            //Since we want to load the packed items, we want to set shouldFocusOnHiddenPackedElements to true.
            var shouldFocusOnHiddenPackedElements = 'true';
            //Perform search to obtain the Model Objects for each CSID
            return csidsToObjectsConverterService.doPerformSearchForProvidedCSIDChains( responseData.csids, shouldFocusOnHiddenPackedElements );
        }
    ).then( function( responseData ) {
        var objectsToOpenInHost = [];
        //Need to pass in array of Model Objects to openInHost, so we massage responseData to obtain that
        responseData.elementsInfo.forEach( objectToOpenInHost => {
            objectsToOpenInHost.push( objectToOpenInHost.element );
        } );
        return objectsToOpenInHost;
    } );
};

export let setCreateInfoForSession = function( data ) {
    data.objCreateInfo = {
        createType: 'Fnd0TempAppSession'
    };
};

export let mapSessionUidToNxOpenObjectToOpen = function( createdWorkingContext ) {
    nxOpenObjectToOpen[0] = createdWorkingContext;
};

/**
 * Get the vmo from the model object, and save it to data
 *
 * @param {IModelObject|IModelObjectArray} sourceObjects - IModelObject(s) to update selectedVersion with
 * @param {Object} data - Object by which we access selectedVersion so we can update it
 */
export let updateNxSelection = function( sourceObjects, data ) {
    if( sourceObjects[ 0 ] ) {
        var retVmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( sourceObjects[ 0 ].uid ), 'Edit' );
        data.selectedVersion.dbValue = retVmo;
    }
};

/**
 * Wrapper for openWithInHost that provides a dataset version number.
 *
 * @param {IModelObject|IModelObjectArray} versionObject - IModelObject(s) to open.
 * @param {IModelObject|IModelObjectArray} datasetObject - IModelObject(s) to open.
 */
export let openVersionWithInHost = function( versionObject, datasetObject ) {
    var versionNumber = versionObject.props.revision_number.dbValue;
    var openContext = 'com.siemens.splm.client.nx.hosted.internal.operations.OpenVersionWithInHost.' + versionNumber;
    hostOpenService.openWithInHost( openContext, datasetObject );
};

/**
 * Associates the selected Measurable Attributes to NX.
 *
 */
export let associateToNx = function( commandContext ) {
    // Get the current TC platform version
    var majorVersion = tcSessionData.getTCMajorVersion();
    var minorVersion = tcSessionData.getTCMinorVersion();
    var qrmNumber = tcSessionData.getTCQRMNumber();

    // TC11.6 onwards, there have been some data model changes to Att0MeasurableAttribute and also
    // to the overall Analysis Request data flow. We will need to work off "Att1AttributeAlignmentProxy"
    // object instead of "Att0MeasurableAttribute" to get the relevant information needed for this action.
    var useNewAssociateEvent = true;

    // TC11.6 changes were integrated into TC12.1 and hence we will not use new behavior for TC12.0
    // Below condition checks if the TC version is less than TC11.6 or is TC12.0. In that case, we will
    // use the previous behavior.
    if( majorVersion < 11 || // If the major version is less than TC11
        majorVersion === 11 && minorVersion === 2 && qrmNumber < 7 || // If the major version is TC11, it is less than TC11.6
        majorVersion === 12 && minorVersion === 0 ) { // If the TC version is TC12.0
        useNewAssociateEvent = false;
    }

    var context = 'com.siemens.splm.client.nx.hosted.internal.operations.AssociateToNxOperation';
    var sourceObjects = [];
    // If on a TCversion later or equal to TC11.6, use Att1AttributeAlignmentProxy objects
    if( useNewAssociateEvent ) {
        //get the selected objects from the command context
        var selectedObjs = commandContext.selectionData.selected;

        for( var it = 0; it < selectedObjs.length; it++ ) {
            //check if the selected object type is of Att1AttributeAlignmentProxy
            if( selectedObjs[it].modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
                sourceObjects.push( selectedObjs[it] );
            }
        }
        //var selectedAttrProxy = appCtxSvc.getCtx( 'selectedAttrProxyObjects' );
        // No need to send context for old versions, we need the context for NX1980 or later
        var pciUID = appCtxSvc.getCtx( 'occmgmtContext.productContextInfo.uid' );
        if( pciUID !== null ) {
            var pciModelObj = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( pciUID ), 'Edit' );
            sourceObjects.push( pciModelObj );
        }
    } else {
        sourceObjects = appCtxSvc.ctx.mselected;
    }


    hostOpenService.openWithInHost( context, sourceObjects );
};

/**
 * Disassociates the consuming relation of a measurable attribute from selected Item Revisions.
 *
 */
export let disassociateConsumingItemRev = function() {
    var context = 'com.siemens.splm.client.nx.hosted.internal.operations.DisassociateItemRevFromNxOperation';
    var sourceObjects = [];

    // Selected Item Revisions.
    sourceObjects = appCtxSvc.ctx.mselected;

    // Measurable Attribute for which the disassociate action needs to be performed. This has to be the
    // first entry of sourceObjects vector.
    sourceObjects.unshift( appCtxSvc.ctx.pselected );

    hostOpenService.openWithInHost( context, sourceObjects );
};

/**
 * Get the VMOs for the dataset version Model Objects,
 * put them in an array and sort and filter it, and store the array in data.
 *
 * If the table provides sort criteria, then sort the rows accordingly.
 *
 * @param {Object} sortCriteria Sort criteria
 * @param {Object} data - the data
 */
export let storeRevisionsPropProp = function( sortCriteria, data ) {
    if( data.modelObjects ) {
        var versionModelObjects = _.values( data.modelObjects );
        var versionViewModelObjects = [];
        for( var i = 0; i < versionModelObjects.length; i++ ) {
            if( versionModelObjects[ i ] &&
                versionModelObjects[ i ].modelType &&
                versionModelObjects[ i ].modelType.parentTypeName === 'Dataset' &&
                versionModelObjects[ i ].props.revisions_prop.uiValues.indexOf( versionModelObjects[ i ].props.object_string.uiValues[ 0 ] ) !== -1 ) {
                var retVmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( versionModelObjects[ i ].uid ), 'Create' );
                versionViewModelObjects.push( retVmo );
            }
        }

        if( versionViewModelObjects.length > 1 ) {
            //Sort the array by version number.
            versionViewModelObjects.sort( ( a, b ) => {
                // Check if either a or b's object_string isn't contained within revisions_prop.displayValues.
                // If it is not there, then it is the anchor, so order the anchor below the other version.
                if( a.props.revisions_prop.displayValues.indexOf( a.props.object_string.displayValues[ 0 ] ) === -1 ) {
                    return 1;
                } else if( b.props.revisions_prop.displayValues.indexOf( b.props.object_string.displayValues[ 0 ] ) === -1 ) {
                    return -1;
                }

                if( a.props.revision_number.dbValue > b.props.revision_number.dbValue ) {
                    //If a's version number is greater, place a below b
                    return 1;
                }
                //If a's version number is lesser, place b below a
                return -1;
            } );
        }

        if( sortCriteria && sortCriteria.length > 0 ) {
            var criteria = sortCriteria[ 0 ];
            var sortDirection = criteria.sortDirection;
            var sortColName = criteria.fieldName;

            if( sortDirection === 'ASC' ) {
                versionViewModelObjects.sort( function( a, b ) {
                    if( a.props[ sortColName ].value <= b.props[ sortColName ].value ) {
                        return -1;
                    }

                    return 1;
                } );
            } else if( sortDirection === 'DESC' ) {
                versionViewModelObjects.sort( function( a, b ) {
                    if( a.props[ sortColName ].value >= b.props[ sortColName ].value ) {
                        return -1;
                    }

                    return 1;
                } );
            }
        }

        data.datasetVersionVMOArray = versionViewModelObjects;
        data.dataProviders.datasetVersionTableProvider.viewModelCollection.loadedVMObjects = versionViewModelObjects;
    }
};

/**
 * Reset the state of the panel to its initial state of displaying the Sub Location Content selection
 *
 * @param {Object} data - the data
 */
export let resetOpenDatasetVersionPanelState = function( data ) {
    data.datasetVersionVMOArray = appCtxSvc.ctx.selected;
    data.selectedVersion.dbValue = appCtxSvc.ctx.selected;
};

/**
 * Load the column configuration for OpenDatasetVersionPanel table
 *
 * @param {Object} dataprovider - the data provider
 * @param {Object} data - the data
 * @returns {Promise} promise.
 */
export let loadColumns = function( dataprovider, data ) {
    var colInfos = [ {
        name: 'object_string',
        typeName: 'UGMASTER',
        displayName: data.i18n.datasetObjectString,
        maxWidth: 400,
        minWidth: 40,
        width: 120,
        enableColumnMenu: true,
        enableColumnMoving: false,
        enableColumnResizing: true,
        enableFiltering: false,
        enablePinning: false,
        enableSorting: true,
        headerTooltip: true
    },
    {
        name: 'revision_number',
        typeName: 'UGMASTER',
        displayName: data.i18n.versionNumber,
        maxWidth: 400,
        minWidth: 40,
        width: 120,
        enableColumnMenu: true,
        enableColumnMoving: false,
        enableColumnResizing: false,
        enableFiltering: false,
        enablePinning: false,
        enableSorting: true,
        headerTooltip: true
    }
    ];

    dataprovider.columnConfig = {
        columns: colInfos
    };

    var deferred = AwPromiseService.instance.defer();

    deferred.resolve( {
        columnInfos: colInfos
    } );

    return deferred.promise;
};

export let updateAddAMObjectContext = function( panelContext, childRelation ) {
    var targetObjectVMO = appCtxSvc.getCtx( 'selected' );
    // In tree mode for folders, ViewModelTreeNode is the object in selection , however aw-add looks for a ViewModelObject , hence the check
    if ( !viewModelObjectSvc.isViewModelObject( targetObjectVMO ) ) {
        var modelObject = cdm.getObject( targetObjectVMO.uid );

        if( !modelObject ) {
            logger.error( 'viewModelObject.createViewModelObject: ' +
                'Unable to locate ModelObject in the clientDataModel with UID=' + targetObjectVMO.uid );
            return null;
        }

        targetObjectVMO = viewModelObjectSvc.constructViewModelObjectFromModelObject( targetObjectVMO, null, null, null, true );
    }
    var addObjectContext = {
        relationType:  childRelation ? childRelation : 'contents',
        refreshFlag: false,
        targetObject: targetObjectVMO,
        loadSubTypes: true,
        typeFilterNames: 'WorkspaceObject'
    };
    if( panelContext && panelContext.visibleTabs ) {
        addObjectContext.visibleTabs = panelContext.visibleTabs;
    }

    var baseTypeNameList = [];
    var shouldCheckIfDataset = true;

    if( !panelContext ) {
        panelContext = {};
    }

    //Designate which types are available to create.
    if( targetObjectVMO.type === 'Clr0ProductAppBreakdown' ) {
        baseTypeNameList = [ 'Clr0AppearanceAreaBreakdown' ];
    } else if( targetObjectVMO.type === 'Clr0AppearanceAreaBreakdown' ) {
        baseTypeNameList = [ 'Clr0AppearanceAreaBreakdown', 'Clr0AppearanceArea' ];
    } else if( targetObjectVMO.type === 'Clr0AppearanceArea' ) {
        baseTypeNameList = [ 'Clr0AppearanceDesignator' ];
    }
    //If there is a single type specified do auto-select when the type is loaded
    if( baseTypeNameList.length === 1 ) {
        addObjectContext.autoSelectOnUniqueType = true;
    }
    addObjectContext.includedTypes = baseTypeNameList.join( ',' );

    //Register the context
    appCtxSvc.registerCtx( 'addObject', addObjectContext );

    var isDataset =  baseTypeNameList.indexOf( 'Dataset' ) !== -1  ||  panelContext.objectSetSourceHasDataset === true;

    //If this is dataset
    if( isDataset ) {
        //Show dataset upload panel
        addObjectContext.showDataSetUploadPanel = true;
    } else if( shouldCheckIfDataset ) {
        //Otherwise call SOA for some reason
        soaSvc.postUnchecked( 'Core-2007-06-DataManagement', 'getDatasetTypeInfo', {
            datasetTypeNames: baseTypeNameList
        } ).then( function( response ) {
            addObjectContext.showDataSetUploadPanel = response.infos.length > 0;
            addObjectContext.moreLinkShown = response.infos.length > 0;
        } );
    }

    commandPanelService.activateCommandPanel( 'AMObjectAddPanel', 'aw_toolsAndInfo', addObjectContext, null, null, {
        isPinUnpinEnabled: true
    } );
};

export let updateAMAddPanelTypeSelection = function( panelContext, childType, data, commandContext ) {
    var childRelation;
    if( childType.dbValue === 'Clr0AppearanceArea' ) {
        childRelation = 'clr0ChildAppAreas';
        data.creationRelation.dbValue = 'clr0ChildAppAreas';
    } else if( childType.dbValue === 'Clr0AppearanceAreaBreakdown' ) {
        childRelation = 'clr0ChildAppAreaBreakdown';
        data.creationRelation.dbValue = 'clr0ChildAppAreaBreakdown';
    } else if( childType.dbValue === 'Clr0AppearanceDesignator' ) {
        childRelation = 'clr0ChildAppDesignators';
        data.creationRelation.dbValue = 'clr0ChildAppDesignators';
    }
    return childRelation;
    //updateAddAMObjectContext( panelContext, childRelation );
};

/**
 * Update the add object context
 *
 * @param {Object} panelContext - (Optional) The context for the panel. May contain command arguments.
 */
export let updateAddAMObject = function( panelContext ) {
    //If the panel is already opened do nothing
    //Eventually this could be modified to update the context and expect the panel to respond to the change
    //Just doing nothing (next action will close panel) to match existing behavior
    if( appCtxSvc.getCtx( 'activeToolsAndInfoCommand.commandId' ) === 'AMObjectAddPanel' ) {
        return;
    }
    updateAddAMObjectContext( panelContext );
};

/**
 * Get input data for object creation.
 *
 * @param {Object} data - the view model data object
 * @return {Object} create input
 */
export let initExtensionProps = function( targetObject ) {
    let extensionVMProps = {};
    var selectedType = appCtxSvc.getCtx( 'selected.type' );
    if( selectedType === 'Col1AppearanceBreakdownSchm' ) {
        var appArea = appCtxSvc.getCtx( 'selected' ).props.col1AppearanceArea;
        extensionVMProps.clr0AppearanceArea = _uwPropSrv.createViewModelProperty( 'clr0AppearanceArea', 'Appearance Area', 'OBJECT', appArea.dbValues[0], appArea.uiValues );
        extensionVMProps.clr0AppearanceArea.propertyName = 'clr0AppearanceArea';
        extensionVMProps.clr0AppearanceArea.valueUpdated = true;
        //RevisitMe: In BA , if there is no clr0AppearanceArea in panel, should add as a new extensionVMProp
        //so no need to check it
        // if( !data.objCreateInfo.propNamesForCreate.includes( 'clr0AppearanceArea' ) ) {
        //     data.objCreateInfo.propNamesForCreate.push( 'clr0AppearanceArea' );
        // }
    } else if( targetObject.type === 'Clr0ProductAppBreakdown' ) {
        extensionVMProps.clr0PABRoot = _uwPropSrv.createViewModelProperty( 'clr0PABRoot', 'Appearance Product Breakdown', 'OBJECT', targetObject.uid, targetObject.props.object_name.displayValues );
        extensionVMProps.clr0PABRoot.propertyName = 'clr0PABRoot';
        extensionVMProps.clr0PABRoot.valueUpdated = true;
    } else {
        extensionVMProps.clr0PABRoot = targetObject.props.clr0PABRoot;
        extensionVMProps.clr0PABRoot.propertyName = 'clr0PABRoot';
        extensionVMProps.clr0PABRoot.valueUpdated = true;
    }

    return {
        clr0AppearanceArea: extensionVMProps.clr0AppearanceArea,
        clr0PABRoot: extensionVMProps.clr0PABRoot
    };
};

/**
 * Get input data for object creation.
 *
 * @param {Object} data - the view model data object
 * @return {Object} create input
 */
export let getCreateInput = function( data, creationType, editHandler ) {
    let extensionVMProps = {};
    var selectedType = appCtxSvc.getCtx( 'selected.type' );
    var targetObject = appCtxSvc.getCtx( 'addObject.targetObject' );
    if( selectedType === 'Col1AppearanceBreakdownSchm' ) {
        var appArea = appCtxSvc.getCtx( 'selected' ).props.col1AppearanceArea;
        extensionVMProps.clr0AppearanceArea = _uwPropSrv.createViewModelProperty( 'clr0AppearanceArea', 'Appearance Area', 'OBJECT', appArea.dbValues[0], appArea.uiValues );
        extensionVMProps.clr0AppearanceArea.propertyName = 'clr0AppearanceArea';
        extensionVMProps.clr0AppearanceArea.valueUpdated = true;
        //RevisitMe: In BA , if there is no clr0AppearanceArea in panel, should add as a new extensionVMProp
        //so no need to check it
        // if( !data.objCreateInfo.propNamesForCreate.includes( 'clr0AppearanceArea' ) ) {
        //     data.objCreateInfo.propNamesForCreate.push( 'clr0AppearanceArea' );
        // }
    } else if( targetObject.type === 'Clr0ProductAppBreakdown' ) {
        extensionVMProps.clr0PABRoot = _uwPropSrv.createViewModelProperty( 'clr0PABRoot', 'Appearance Product Breakdown', 'OBJECT', data.targetObject.uid, data.targetObject.props.object_name.displayValues );
        extensionVMProps.clr0PABRoot.propertyName = 'clr0PABRoot';
        extensionVMProps.clr0PABRoot.valueUpdated = true;
    } else {
        extensionVMProps.clr0PABRoot = targetObject.props.clr0PABRoot;
        extensionVMProps.clr0PABRoot.propertyName = 'clr0PABRoot';
        extensionVMProps.clr0PABRoot.valueUpdated = true;
    }

    return addObjectUtils.getCreateInput( data, extensionVMProps, creationType, editHandler );
};

export let getCreateInputForAAS = function( data, creationType, editHandler ) {
    return addObjectUtils.getCreateInput( data, null, creationType, editHandler );
};

/**
 * Wrapper for getCreatedObject from addObjectUtils.js
 *
 * @param {Object} the response of createRelateAndSubmitObjects SOA call
 * @return the created object
 */
export let getCreatedObject = function( response ) {
    return addObjectUtils.getCreatedObject( response );
};

/**
 * Wrapper for getDatasets from addObjectUtils.js
 *
 * @param {Object} the response of createRelateAndSubmitObjects SOA call
 * @return the created object
 */
export let getDatasets = function( response ) {
    return addObjectUtils.getDatasets( response );
};

export let cacheAMUserLicense = function( currentCache ) {
    if( currentCache ) {
        return;
    }
    var hasAMUserLicense = 'false';
    appCtxSvc.registerCtx( 'cachedAMUserLicense',  hasAMUserLicense );
    var licenseCheckPromise = soaSvc.post( 'Core-2008-03-Session', 'connect', { featureKey: 'appearance_mgmt_aw', action: 'get' } );

    licenseCheckPromise.then(
        ( response ) => {
            if ( parseInt( response.outputVal, 10 ) > 0 ) {
                appCtxSvc.registerCtx( 'cachedAMUserLicense', 'true' );
            }
        }
    )
        .catch(
            ( exception ) => {
                logger.error( 'Failed to get the Appearance Management User for Active Workspace license.' );
                logger.error( exception );

                appCtxSvc.registerCtx( 'cachedAMUserLicense', 'false' );
            }
        );
};

/**
 * Create the temp app session and send to NX
 */
export let createOrUpdateSavedSession = function() {
    let currentCtx = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
    declUtils.loadDependentModule( 'js/occmgmtBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                return occMBOPSMod.getBackingObjects( [ currentCtx.topElement ] );
            }
        } ).then( ( topLinesArray ) => {
            return soaSvc.post( 'Cad-2020-01-AppSessionManagement', 'createOrUpdateSavedSession', {
                sessionsToCreateOrUpdate: [ {
                    sessionToCreateOrUpdate: {
                        objectToCreate: {
                            creInp: {
                                boName: 'Fnd0TempAppSession'
                            }
                        }
                    },
                    productAndConfigsToCreate: [ {
                        structureRecipe: {
                            structureContextIdentifier: {
                                product: {
                                    uid: topLinesArray[ 0 ].uid
                                }
                            }
                        }
                    } ]
                } ]
            } );
        } ).then( createOutput => {
            let tempAppSes = createOutput.sessionOutputs[ 0 ].sessionObject;
            mapSessionUidToNxOpenObjectToOpen( tempAppSes );
            openInNX( appCtxSvc.getCtx( 'mselected' )[0] );
        } );
};

/**
 * Create the temp app session and send to NX
 */
export let createOrUpdateSavedSessionNXTCXML = function() {
    let currentCtx = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
    declUtils.loadDependentModule( 'js/occmgmtBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                return occMBOPSMod.getBackingObjects( [ currentCtx.topElement ] );
            }
        } ).then( ( topLinesArray ) => {
            return soaSvc.post( 'Cad-2020-01-AppSessionManagement', 'createOrUpdateSavedSession', {
                sessionsToCreateOrUpdate: [ {
                    sessionToCreateOrUpdate: {
                        objectToCreate: {
                            creInp: {
                                boName: 'Fnd0TempAppSession'
                            }
                        }
                    },
                    productAndConfigsToCreate: [ {
                        structureRecipe: {
                            structureContextIdentifier: {
                                product: {
                                    uid: topLinesArray[ 0 ].uid
                                }
                            }
                        }
                    } ]
                } ]
            } );
        } ).then( createOutput => {
            let tempAppSes = createOutput.sessionOutputs[ 0 ].sessionObject;
            mapSessionUidToNxOpenObjectToOpen( tempAppSes );
            nxTcXmlCommandHandler( appCtxSvc.getCtx( 'mselected' )[0] );
        } );
};

//Takes the top element, gets the backing object and creates a tempappsession off it
var createTempAppSession = function( topElement ) {
    return declUtils.loadDependentModule( 'js/occmgmtBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                return occMBOPSMod.getBackingObjects( [ topElement ] );
            }
        } ).then( ( topLinesArray ) => {
            return soaSvc.post( 'Cad-2020-01-AppSessionManagement', 'createOrUpdateSavedSession', {
                sessionsToCreateOrUpdate: [ {
                    sessionToCreateOrUpdate: {
                        objectToCreate: {
                            creInp: {
                                boName: 'Fnd0TempAppSession'
                            }
                        }
                    },
                    productAndConfigsToCreate: [ {
                        structureRecipe: {
                            structureContextIdentifier: {
                                product: {
                                    uid: topLinesArray[ 0 ].uid
                                }
                            }
                        }
                    } ]
                } ]
            } );
        } );
};

var exportToNX = function( elementToExport, nonMasterInput, associatedFiles, sessionUId, worksetUid ) {
    return soaSvc.post( 'Internal-NX-2020-05-DataManagement', 'exportConfiguredAssyToNX', {
        input :{
            elementToExport: elementToExport,
            requestPref: {
                exportNonMasters: [ nonMasterInput ],
                exportAssociatedFiles: [ associatedFiles ],
                exportTempAppSessionUid: [ sessionUId ],
                exportWorksetUid: [ worksetUid ]
            }
        }
    } );
};

/**
 * Exports to NX
 * For app sessions, it reuses the temp app session and leaves the workset uid blank
 * for worksets, it uses the workset uid of the top element and leaves the temp app session blank
 * if the object is anything else then a temp app session is created and the workset is left blank,
 * In the final case the temp app session is also deleted server side.
 */
export let objectExport = function( elementToExportInput, nonMasterInput, associatedFiles ) {
    var topElement = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key ).topElement;
    if( createWorksetService.isWorkset( topElement ) ) {
        var parentUnderlyingObj = cdm.getObject( topElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
        return exportToNX( elementToExportInput, nonMasterInput, associatedFiles, '', parentUnderlyingObj.uid );
    } else if( topElement.type === 'Fnd0TempAppSession' || topElement.type === 'Fnd0AppSession' ) {
        return exportToNX( elementToExportInput, nonMasterInput, associatedFiles, topElement.uid, '' );
    }

    //This temp app session is deleted server side, trying to use it after the export will end in failure
    return createTempAppSession( topElement ).then( ( appSession ) => {
        return exportToNX( elementToExportInput, nonMasterInput, associatedFiles, appSession.sessionOutputs[ 0 ].sessionObject.uid, '' );
    } );
};

/**
 * Open the product in NX.
 * @param {boolean} isHosted Is hosted mode.
 */
export let openProductInNX = function( isHosted ) {
    const sourceObjects = [ getTopElement() ];
    const handleTempAppSession = shouldCreateTempAppSession( sourceObjects ) ?
        createTempAppSession( getTopElement() ).then( ( appSession ) => {
            mapSessionUidToNxOpenObjectToOpen( appSession.sessionOutputs[0].sessionObject );
        } ) : Promise.resolve();
    handleTempAppSession.then( () => {
        if ( isHosted ) {
            let objectsToOpen = openProductInNXInitialChecks( sourceObjects );
            if ( objectsToOpen.some( isPacked ) ) {
                let packed = openInNXCheckPacked( objectsToOpen );
                if ( packed ) {
                    openPackedInNX( packed ).then( response => hostOpenService.openInHost( response ) );
                }
            } else {
                hostOpenService.openInHost( objectsToOpen );
            }
        } else {
            openProductInNXStandalone( sourceObjects );
        }
    } );
};

/**
 * Check if the Temp App Session is supported.
 * @returns {boolean} Is the Temp App Session is supported.
 */
let isTempAppSessionSupported = function() {
    const tempSessionPreference = appCtxSvc.getCtx( 'preferences.AWC_NX_Supports_TempSession' );
    return tempSessionPreference && tempSessionPreference[0] === 'true';
};

/**
 * Check if the filter is active.
 * @returns {boolean} Is filter active.
 */
let isFilterActive = function() {
    let ret = false;
    const aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
    if ( aceActiveContext !== undefined ) {
        const currentCtx = appCtxSvc.getCtx( aceActiveContext.key );
        ret = currentCtx !== null && currentCtx.productContextInfo.props.awb0FilterCount.dbValues[0] > 0;
    }
    return ret;
};

/**
 * Helper function uses to remove the duplicate elements of an array.
 * @param {Object} item The current element begin processing in the array.
 * @param {Number} index The index of the current element begin processing in the array.
 * @param {Array} array The array to be processed.
 * @returns {boolean} True if the item is duplicated.
 */
const removeDuplicates = ( item, index, array ) => array.indexOf( item ) === index;

/**
 * Helper function uses to remove the elements of an array which have unsupported types.
 * @param {IModelObject} item The element to be checked.
 * @returns {boolean} True if the element's type is unsupported.
 */
const removeUnsupportedTypes = ( item ) => {
    const unsupportedTypes = appCtxSvc.ctx.preferences.AWC_NX_OpenUnsupportedTypes;
    const type = item.props.awb0UnderlyingObjectType || item.props.object_type;
    return !( unsupportedTypes && type && unsupportedTypes.includes( type.dbValues[0] ) );
};

/**
 * Helper function uses to check if the object beyonds to a temp app session or a work-set revision.
 * @param {IModelObject} item The element to be checked.
 * @returns {boolean} True if the element beyonds to a temp app session or a work-set revision.
 */
const isWorksetRevisionOrTempAppSession = ( item ) => cmm.isInstanceOf( 'Cpd0WorksetRevision', item.modelType )
                || cmm.isInstanceOf( 'Fnd0TempAppSession', item.modelType );

/**
 * Helper function uses to check if the object is packed.
 * @param {IModelObject} item The element to be checked.
 * @returns  {boolean} True if the object is packed.
 */
const isPacked = ( item ) => item.props && item.props.awb0IsPacked && item.props.awb0IsPacked.dbValues && _.isEqual( item.props.awb0IsPacked.dbValues[ 0 ], '1' );

/**
 * Filter the source object to be opened through the Open Product in NX functionality.
 * @param {IModelObjectArray} sourceObjects Initial objects to be filtered.
 * @returns {IModelObjectArray} The filtered objects.
 */
let openProductInNXInitialChecks = function( sourceObjects ) {
    var objectsToOpen = shouldCreateTempAppSession( sourceObjects ) ? nxOpenObjectToOpen.filter( removeDuplicates ) : sourceObjects;
    return objectsToOpen.some( isWorksetRevisionOrTempAppSession ) ? objectsToOpen : objectsToOpen.filter( removeUnsupportedTypes );
};

/**
 * Helper function that returns the top element.
 * @returns {IModelObject} The top element.
 */
let getTopElement = function() {
    return appCtxSvc.getCtx( 'occmgmtContext.topElement' );
};

/**
 * Helper function that returns the selected objects.
 * @returns {IModelObjectArray} The selected objects.
 */
let getSelectedObjects = function() {
    return appCtxSvc.getCtx( 'mselected' );
};

/**
 * Helper function to check if a particular element is the top element.
 * @param {IModelObject} item The element to be checked.
 * @returns  {boolean} True if the item is the top element.
 */
const isTopElement = ( item ) => item === getTopElement();

/**
 * Helper function to check if a particular element is a part element.
 * @param {IModelObject} item The element to be checked.
 * @returns {boolean} True if the item is a part element.
 */
const isAPartElement = ( item ) => item.type === 'Awb0PartElement';

/**
 * Helper function to check if a temp app session should be created.
 * @param {IModelObjectArray} sourceObjects The source objects.
 * @returns {boolean} If a temp app session should be created.
 */
let shouldCreateTempAppSession = function( sourceObjects ) {
    return isTempAppSessionSupported() &&
        getTopElement() &&
        getTopElement().type !== 'Fnd0AppSession' &&
        ( isAPartElement( getTopElement() ) || sourceObjects.some( isTopElement ) && isFilterActive() );
};

/**
 * Helper function to generate open in NX URL.
 * @param {IModelObjectArray} sourceObjects The source objects.
 * @param {String} secureToken The URL's secure token.
 * @param {Number} versionNumber The URL's version number.
 * @returns {String} The open in NX URL.
 */
let generateUrl = function( sourceObjects, secureToken, versionNumber ) {
    const userName = appCtxSvc.ctx.userSession.props.user_id.dbValues[ 0 ];

    var uriToLaunch = browserUtils.getBaseURL() + 'launcher/openinnx?';

    if ( sourceObjects.length > 0 ) {
        uriToLaunch = uriToLaunch + getSelectionStrings( sourceObjects ) + '&';
    }
    uriToLaunch = uriToLaunch + getServerInfoString( appCtxSvc.ctx.preferences.AWC_NX_SSO_URL ) + '&' +
                     getUserToken( userName ) + '&' + getSecureToken( secureToken );
    if( versionNumber ) {
        uriToLaunch = uriToLaunch + '&' + 'VersionNumber=' + versionNumber;
    }
    if( appCtxSvc.ctx.preferences.TC_NX_Current_Application && appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported &&
                        appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported[ 0 ] === 'true' ) {
        uriToLaunch = uriToLaunch + '&' + getAppToken( appCtxSvc.ctx.preferences.TC_NX_Current_Application[ 0 ] );
    }
    if( appCtxSvc.ctx.preferences.TC_NX_Current_Environment && appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported &&
                         appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported[ 0 ] === 'true' ) {
        uriToLaunch = uriToLaunch + '&' + getEnvToken( appCtxSvc.ctx.preferences.TC_NX_Current_Environment[ 0 ] );
    }
    if( appCtxSvc.ctx.preferences.TC_NX_OEM_DEFINITION_DIR && appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported &&
                         appCtxSvc.ctx.preferences.AWC_NX_ApplicationAndEnvironmentIsSupported[ 0 ] === 'true' ) {
        uriToLaunch = uriToLaunch + '&' + getOEMToken( appCtxSvc.ctx.preferences.TC_NX_OEM_DEFINITION_DIR );
    }

    if( appCtxSvc.ctx.preferences.AWC_NX_SSO_URL ) {
        uriToLaunch = uriToLaunch + '&' + getSSOToken( appCtxSvc.ctx.preferences.AWC_NX_SSO_URL );
    }

    if( appCtxSvc.ctx.preferences.AWC_NX_TCCS_ENV ) {
        uriToLaunch = uriToLaunch + '&' + getTCCSToken( appCtxSvc.ctx.preferences.AWC_NX_TCCS_ENV );
    }

    if( appCtxSvc.ctx.preferences.AWC_NX_FSC_URL ) {
        uriToLaunch = uriToLaunch + '&' + getFSCToken( appCtxSvc.ctx.preferences.AWC_NX_FSC_URL );
    }
    if( getProductContextInfo() !== undefined ) {
        uriToLaunch = uriToLaunch + '&' + getProductContextInfo();
    }

    if ( shouldCreateTempAppSession( sourceObjects ) ) {
        //LCS-652326 - If we send part that is a sub element in ebom scenario, nx doesn't handle properly. So instead we
        //substitute sub element in this case with top element.
        const objectsToOpen = nxOpenObjectToOpen.filter( nxOpenObject => {
            return isAPartElement( nxOpenObject ) && !isTopElement( nxOpenObject ) ? getTopElement() : nxOpenObject;
        } );
        //LCS-652326 - No need to eliminate duplicates in this case (unlike in openInNX) since the only the first element
        //in the selection is used, and that element should always be topElement if the LCS-652326 fix using filters was used.
        uriToLaunch = uriToLaunch + '&' + 'ContextObject=' + objectsToOpen[0].uid;
        uriToLaunch = uriToLaunch + '&' + 'ContextObjectType=' + 'Fnd0TempAppSession';
    } else {
        if( getContextObject() !== undefined ) {
            uriToLaunch = uriToLaunch + '&' + getContextObject();
        }
        if( getContextObjectType() !== undefined ) {
            uriToLaunch = uriToLaunch + '&' + getContextObjectType();
        }
    }
    //if 3D is active or previously loaded then set skip as true to avoid viewer unload
    let skipBeforeUnload = appCtxSvc.getCtx( 'viewer.skipBeforeUnloadExecution' );
    if( skipBeforeUnload === false ) {
        appCtxSvc.updatePartialCtx( 'viewer.skipBeforeUnloadExecution', true );
    }

    return uriToLaunch;
};

/**
 * Opens the source objects in NX in standalone mode.
 * It generates a URL and then loads this URL, as a result a .nxtcxml is download by the browser.
 * @param {IModelObjectArray} sourceObjects The source objects to open.
 */
let openProductInNXStandalone = function( sourceObjects ) {
    var versionNumber;
    if( sourceObjects.props && sourceObjects.props.revision_number && sourceObjects.props.revision_number.dbValue ) {
        versionNumber = sourceObjects.props.revision_number.dbValue;
        sourceObjects = [ appCtxSvc.ctx.selected ];
    }
    if ( !Array.isArray( sourceObjects ) ) {
        sourceObjects = [ sourceObjects ];
    }

    // If a revision is not configured correctly, don't include it.
    sourceObjects = sourceObjects.filter( ( sourceObject ) => {
        return  sourceObject && ( !sourceObject.props.awb0UnderlyingObject || sourceObject.props.awb0UnderlyingObject.dbValues[ 0 ] )  ? sourceObject : null;
    } );

    soaSvc.postUnchecked( 'Internal-Core-2014-11-Session', 'getSecurityToken', { duration: 300 } ).then( ( responseData ) => {
        var secureToken = responseData.out;
        var productContextInfo = getProductContextInfo();
        var getCloneStableIDsWithPackedOccurrencesResult = '';
        //In search view, there is no product context info, so we cannot get packed items and should treat the input as non-packed.
        //Additionally, if the input is not of an Awb0Element derived type, we should not make the call. getCloneStableIDsWithPackedOccurrences() does not
        //properly prevent making the SOA call for such items (which are non-packed)
        if ( productContextInfo && sourceObjects.every( ( item ) => item.modelType.typeHierarchyArray.includes( 'Awb0Element' ) ) ) {
            getCloneStableIDsWithPackedOccurrencesResult = objectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( productContextInfo, sourceObjects );
        }
        //getCloneStableIDsWithPackedOccurrences returns undefined if there are no packed items, so check if the result is undefined.
        //if it is undefined, then the item to open is not packed, and we should open as normal.
        var promiseChain = getCloneStableIDsWithPackedOccurrencesResult
            ? getCloneStableIDsWithPackedOccurrencesResult.then( ( responseData ) => {
                var shouldFocusOnHiddenPackedElements = 'true';
                return csidsToObjectsConverterService.doPerformSearchForProvidedCSIDChains( responseData.csids, shouldFocusOnHiddenPackedElements );
            } ).then( ( responseData ) => {
                sourceObjects = responseData.elementsInfo.map( info => info.element );
            } ) : Promise.resolve();
        promiseChain.then( ( ) => {
            var prefNames = [ 'AWC_NX_TCCS_ENV', 'AWC_NX_SSO_URL', 'AWC_NX_FSC_URL' ];
            return preferenceSvc.getStringValues( prefNames );
        } ).then( () => {
            const uriToLaunch = generateUrl( sourceObjects, secureToken, versionNumber );
            window.open( uriToLaunch, '_self', 'enabled' );
        } );
    } );
};

export default exports = {
    nxTcXmlCommandHandler,
    downloadPartFile,
    openInNX,
    openInNXInitialChecks,
    openInNXCheckPacked,
    openPackedInNX,
    setCreateInfoForSession,
    mapSessionUidToNxOpenObjectToOpen,
    updateNxSelection,
    openVersionWithInHost,
    associateToNx,
    disassociateConsumingItemRev,
    storeRevisionsPropProp,
    resetOpenDatasetVersionPanelState,
    loadColumns,
    updateAMAddPanelTypeSelection,
    updateAddAMObject,
    getCreateInput,
    getCreatedObject,
    getDatasets,
    objectExport,
    cacheAMUserLicense,
    updateAddAMObjectContext,
    createOrUpdateSavedSession,
    createOrUpdateSavedSessionNXTCXML,
    initExtensionProps,
    openProductInNX
};
