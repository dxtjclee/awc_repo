// Copyright (c) 2023 Siemens

/**
 * @module js/ssp0OpenCommandUtilityService
 */
import appCtxSvc from 'js/appCtxService';
import preferenceSvc from 'soa/preferenceService';
import soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import hostOpenService from 'js/hosting/hostOpenService';
import cdm from 'soa/kernel/clientDataModel';
import browserUtils from 'js/browserUtils';
import _uwPropSrv from 'js/uwPropertyService';
import objectsToPackedOccurrenceCSIDsService from 'js/objectsToPackedOccurrenceCSIDsService';
import csidsToObjectsConverterService from 'js/csidsToObjectsConverterService';
import createWorksetService from 'js/createWorksetService';
import _ from 'lodash';
import localeSvc from 'js/localeService';
import sessionCtxSvc from 'js/sessionContext.service';
import declUtils from 'js/declUtils';

var exports = {};

var nxOpenObjectToOpen = [];

/******************************************************************************************************************/
// Begin Stand ALone commands handlers
/******************************************************************************************************************/

var getProductContextInfo = function() {
    var pciUID = appCtxSvc.getCtx( 'occmgmtContext.productContextInfo.uid' );
    if( pciUID ) {
        return 'ProductContextInfo=' + pciUID;
    }
};

export let nxTcXmlCommandHandler = function( sourceObjects ) {
    openInNxStandalone( sourceObjects );
};

/**
 * Open selected elements in NX.
 * @param {boolean} isHosted Is hosted mode.
 */
export let handleOpenInNX = function( isHosted ) {
    const objectsToOpen = getSelectedObjects().filter( isNotFolderType );
    const handleTempAppSession = shouldCreateTempAppSession( objectsToOpen ) ?
        createTempAppSession( getTopElement() ).then( ( appSession ) => {
            mapSessionUidToNxOpenObjectToOpen( appSession.sessionOutputs[0].sessionObject );
        } ) : Promise.resolve();
    handleTempAppSession.then( () => {
        if ( isHosted ) {
            openInNX( objectsToOpen );
        } else {
            nxTcXmlCommandHandler( objectsToOpen );
        }
    } );
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
    if ( shouldCreateTempAppSession( sourceObjects ) ) {
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
        sourceObjectsToOpen = getSelectedObjects().filter( isNotFolderType );
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


export let mapSessionUidToNxOpenObjectToOpen = function( createdWorkingContext ) {
    nxOpenObjectToOpen[0] = createdWorkingContext;
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
 * Helper function to check if a particular element is not a Folder.
 * @param {IModelObject} item The element to be checked.
 * @returns  {boolean} True if the item is a Folder.
 */
const isNotFolderType = ( item ) => !cmm.isInstanceOf( 'Folder', item.modelType );

/**
 * Helper function to check if a temp app session should be created.
 * @param {IModelObjectArray} sourceObjects The source objects.
 * @returns {boolean} If a temp app session should be created.
 */
let shouldCreateTempAppSession = function( sourceObjects ) {
    const topElement = getTopElement();
    return isTempAppSessionSupported() &&
        topElement &&
        topElement.type !== 'Fnd0AppSession' &&
        !createWorksetService.isWorkset( topElement ) &&
        ( isAPartElement( topElement ) || sourceObjects.some( isTopElement ) && isFilterActive() );
};

class Tokens {
    static get application() { return 'Application'; }
    static get contextObject() { return 'ContextObject'; }
    static get contextObjectType() { return 'ContextObjectType'; }
    static get environment() { return 'Environment'; }
    static get hostPath() { return 'HostPath'; }
    static get fsc() { return 'FSCURL'; }
    static get productContextInfo() { return 'ProductContextInfo'; }
    static get protocol() { return 'Protocol'; }
    static get oem() { return 'OEMDefitionDir'; }
    static get secure() { return 'SessionInfo'; }
    static get selectedObject() { return 'SelectedObject'; }
    static get serverVersion() { return 'Server_Version'; }
    static get sso() { return 'tcSSOURL'; }
    static get ssoHostPathValue() { return 'SSOHostPathValue'; }
    static get tccs() { return 'TCCSENV'; }
    static get userName() { return 'UserName'; }
    static get versionNumber() { return 'VersionNumber'; }
    static get locale() { return 'Locale'; }
    static get discriminator() { return 'Discriminator'; }
    static get tcServerId() { return 'TcServerId'; }
    static get group() { return 'Group'; }
    static get role() { return 'Role'; }
}

/**
 * Helper function that convert a set of IModelObjects into a string containing a concatenate list of their UIDs.
 * @param {IModelObjectArray} selectedObjects - The set of IModelObjects to convert.
 * @returns {String} A concatenate list of UIDs.
 */
const convertToSelectedObjectForUrl = function( selectedObjects ) {
    return selectedObjects
        .filter( item => item.modelType !== 'mselected' )
        .filter( item => !cmm.isInstanceOf( 'Folder', item.modelType ) )
        .map( item => item.uid ).join( ' ' );
};

/**
 * Helper function that return the Product Context's UID.
 * @returns {String} The Product Context's UID.
 */
const getProductContextInfoUid = function() {
    return appCtxSvc.getCtx( 'occmgmtContext.productContextInfo.uid' );
};

/**
 * Helper function that return the Context Object UID.
 * @returns {String} The Context Object UID.
 */
const getContextObjectUid = function() {
    return appCtxSvc.getCtx( 'occmgmtContext.productContextInfo.props.awb0ContextObject.dbValues[0]' );
};

/**
 * Helper function that return the Context Object Type UID.
 * @returns {String} The Context Object Type UID.
 */
const getContextObjectType = function() {
    var type = null;
    const contextObjectUid = getContextObjectUid();
    if ( contextObjectUid ) {
        const temp = cdm.getObject( contextObjectUid );
        if ( temp ) {
            type = temp.type;
        }
    }
    return type;
};

/**
 * Helper function that returns the user's name.
 * @returns {String} The user's name.
 */
const getUserName = function() {
    return appCtxSvc.ctx.userSession.props.user_id.dbValues[ 0 ];
};

/**
 * Helper function to generate open in NX URL.
 * @param {IModelObjectArray} sourceObjects The source objects.
 * @param {String} secureToken The URL's secure token.
 * @param {Number} versionNumber The URL's version number.
 * @returns {String} The open in NX URL.
 */
let generateUrl = async function( sourceObjects, secureToken, versionNumber ) {
    let urlToLaunch = new URL( browserUtils.getBaseURL() + 'launcher/openinnx?' );

    const selectedObjects = convertToSelectedObjectForUrl( sourceObjects );
    if ( selectedObjects ) {
        urlToLaunch.searchParams.append( Tokens.selectedObject, selectedObjects );
    }

    const soaUrl = new URL( browserUtils.getBaseURL() + 'tc' );
    urlToLaunch.searchParams.append( Tokens.protocol, soaUrl.protocol.slice( 0, -1 ) );
    urlToLaunch.searchParams.append( Tokens.hostPath, soaUrl.toString() );
    urlToLaunch.searchParams.append( Tokens.ssoHostPathValue, soaUrl.toString() );
    const userName = getUserName();
    urlToLaunch.searchParams.append( Tokens.userName,  userName );
    urlToLaunch.searchParams.append( Tokens.secure,  secureToken );

    if( versionNumber ) {
        urlToLaunch.searchParams.append( Tokens.versionNumber, versionNumber );
    }

    if ( appCtxSvc.ctx.preferences?.AWC_NX_ApplicationAndEnvironmentIsSupported?.[0] === 'true' ) {
        if( appCtxSvc.ctx.preferences.TC_NX_Current_Application ) {
            urlToLaunch.searchParams.append( Tokens.application, appCtxSvc.ctx.preferences.TC_NX_Current_Application[ 0 ] );
        }
        if( appCtxSvc.ctx.preferences.TC_NX_Current_Environment ) {
            urlToLaunch.searchParams.append( Tokens.environment, appCtxSvc.ctx.preferences.TC_NX_Current_Environment[ 0 ] );
        }
        if( appCtxSvc.ctx.preferences.TC_NX_OEM_DEFINITION_DIR ) {
            urlToLaunch.searchParams.append( Tokens.oem, appCtxSvc.ctx.preferences.TC_NX_OEM_DEFINITION_DIR );
        }
    }

    if( appCtxSvc.ctx.preferences.AWC_NX_SSO_URL ) {
        urlToLaunch.searchParams.append( Tokens.sso, appCtxSvc.ctx.preferences.AWC_NX_SSO_URL );
    }

    if( appCtxSvc.ctx.preferences.AWC_NX_TCCS_ENV ) {
        urlToLaunch.searchParams.append( Tokens.tccs, appCtxSvc.ctx.preferences.AWC_NX_TCCS_ENV );
    }

    if( appCtxSvc.ctx.preferences.AWC_NX_FSC_URL ) {
        urlToLaunch.searchParams.append( Tokens.fsc, appCtxSvc.ctx.preferences.AWC_NX_FSC_URL );
    }
    const productContextInfo = getProductContextInfoUid();
    if ( productContextInfo ) {
        urlToLaunch.searchParams.append( Tokens.productContextInfo, productContextInfo );
    }

    if ( shouldCreateTempAppSession( sourceObjects ) ) {
        //LCS-652326 - If we send part that is a sub element in ebom scenario, nx doesn't handle properly. So instead we
        //substitute sub element in this case with top element.
        const objectsToOpen = nxOpenObjectToOpen.filter( nxOpenObject => {
            return isAPartElement( nxOpenObject ) && !isTopElement( nxOpenObject ) ? getTopElement() : nxOpenObject;
        } );
        //LCS-652326 - No need to eliminate duplicates in this case (unlike in openInNX) since the only the first element
        //in the selection is used, and that element should always be topElement if the LCS-652326 fix using filters was used.
        urlToLaunch.searchParams.append( Tokens.contextObject, objectsToOpen[0].uid );
        urlToLaunch.searchParams.append( Tokens.contextObjectType, 'Fnd0TempAppSession' );
    } else {
        const contextObjectUid = getContextObjectUid();
        if ( contextObjectUid ) {
            urlToLaunch.searchParams.append( Tokens.contextObject, contextObjectUid );
        }
        const contextObjectTypeUid = getContextObjectType();
        if ( contextObjectTypeUid ) {
            urlToLaunch.searchParams.append( Tokens.contextObjectType, contextObjectTypeUid );
        }
    }
    //if 3D is active or previously loaded then set skip as true to avoid viewer unload
    let skipBeforeUnload = appCtxSvc.getCtx( 'viewer.skipBeforeUnloadExecution' );
    if( skipBeforeUnload === false ) {
        appCtxSvc.updatePartialCtx( 'viewer.skipBeforeUnloadExecution', true );
    }

    if( appCtxSvc.ctx.preferences?.AWC_NX_ReuseTcServer_StartNX?.[0] === 'true' ) {
        const response = await soaSvc.postUnchecked( 'Core-2007-01-Session', 'getTCSessionInfo', {} );
        if ( appCtxSvc.ctx.preferences?.AWC_NX_ReuseTcServer_UseAWLocale?.[0] === 'true' ) {
            var locale = localeSvc.getLocale();
            //Certain locales do not come with a country code
            //NX expects all locals to be in the format "locale_COUNTRYCODE or locale_LOCALE
            if ( locale.indexOf( '_' ) === -1 ) {
                locale = locale + '_' + locale.toUpperCase();
            }
            urlToLaunch.searchParams.append( Tokens.locale, locale );
        }
        urlToLaunch.searchParams.append( Tokens.discriminator, sessionCtxSvc.getSessionDiscriminator() );
        urlToLaunch.searchParams.append( Tokens.tcServerId, response.extraInfo.TcServerID );
    } else {
        //For group we need to get object. This is to support nested groups as group_name only gives the top group
        var groupObj = cdm.getObject( appCtxSvc.ctx.userSession.props.group.dbValue );
        urlToLaunch.searchParams.append( Tokens.group, groupObj?.props?.object_full_name?.dbValues?.[0] );
        urlToLaunch.searchParams.append( Tokens.role, appCtxSvc.ctx.userSession.props.role_name.dbValues[0] );
    }

    return urlToLaunch.toString();
};


/**
 * Opens a set of TC items in NX in standalone mode.
 * It generates and opens a URL, as a result a .nxtcxml is downloaded by the browser.
 * @param {IModelObjectArray} sourceObjects The source objects to open.
 */
let openInNxStandalone = function( sourceObjects ) {
    const versionNumber = sourceObjects?.props?.revision_number?.dbValue;
    if( versionNumber ) {
        sourceObjects = [ appCtxSvc.ctx.selected ];
    }
    if ( !Array.isArray( sourceObjects ) ) {
        sourceObjects = [ sourceObjects ];
    }

    // If a revision is not configured correctly, don't include it.
    sourceObjects = sourceObjects.filter( item =>
        item && ( !item.props.awb0UnderlyingObject || item.props.awb0UnderlyingObject.dbValues[0] )
    );

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
        } ).then( () => generateUrl( sourceObjects, secureToken, versionNumber )
        ).then( uriToLaunch => window.open( uriToLaunch, '_self', 'enabled' ) );
    } );
};

export default exports = {
    nxTcXmlCommandHandler
};

