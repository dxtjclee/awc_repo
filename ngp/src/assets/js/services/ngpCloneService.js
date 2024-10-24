// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpLoadSvc from 'js/services/ngpLoadService';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import ngpRelationSvc from 'js/services/ngpRelationService';
import ngpCloneStatusCache from 'js/services/ngpCloneStatusCache';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpNavigationSvc from 'js/services/ngpNavigationService';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpSelectUponLoadSvc from 'js/services/ngpSelectUponLoadService';
import mfeNotyUtils from 'js/mfgNotificationUtils';
import ngpStorageSvc from 'js/services/ngpStorageService';
import ngpStorageConstants from 'js/constants/ngpStorageConstants';
import ngpAssignmentMappSvc from 'js/services/ngpAssignmentMappingService';

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import msgSvc from 'js/messagingService';
import popupSvc from 'js/popupService';
import cmdSvc from 'js/command.service';
import eventBus from 'js/eventBus';

const localizedMessages = localeSvc.getLoadedText( 'NgpCloneMgmtMessages' );
const emptyFunction = () => null;
let _popup = null;

/**
 * NGP Favorites service
 *
 * @module js/services/ngpCloneService
 */
'use strict';

/**
 *
 * @param {modelObject[]} cloneCandidates - the clone candidates model objects
 * @param {String} revisionRuleUid - the revision rule uid
 */
export function setCloneCandidates( cloneCandidates, revisionRuleUid ) {
    //save to local storage
    ngpStorageSvc.saveModelObjectsAndPropNamesInStorage( ngpStorageConstants.CLONE_CANDIDATE, cloneCandidates );
    ngpStorageSvc.saveUidsAndPropNamesInStorage( ngpStorageConstants.CLONE_CANDIDATE_REVISION_RULE, [ revisionRuleUid ] );
    ngpStorageSvc.saveUidsAndPropNamesInStorage( ngpStorageConstants.ORIGINAL_CLONE_HULL, [ ngpDataUtils.getMfgModelUid( cloneCandidates[ 0 ] ) ] );
    let msg;
    if( cloneCandidates.length === 1 ) {
        msg = localizedMessages.successfulSavedCandidateForCloning.format( cloneCandidates[ 0 ].props[ ngpPropConstants.OBJECT_STRING ].dbValues[0] );
    } else{
        msg = localizedMessages.successfulSavedMultipleCandidatesForCloning.format( cloneCandidates.length, cloneCandidates[0].modelType.uiDisplayName.plural );
    }
    msgSvc.showInfo( msg  );
}

/**
 *
 * @param {modelObject} selectedPasteContext - the context where we can possibly paste it, speciically the selected context
 * @param {modelObject} pagePasteContext - the context where we can possibly paste it, specifically the page context
 * @param {boolean} createLink -  flag for Traceability on\off
 */
export function pasteCloneCandidates( selectedPasteContext, pagePasteContext, createLink ) {
    const pasteContext = selectedPasteContext ? selectedPasteContext : pagePasteContext;
    const cloneCandidates = ngpStorageSvc.getModelObjectsFromStorage( ngpStorageConstants.CLONE_CANDIDATE );
    const revisionRule = ngpStorageSvc.getModelObjectsFromStorage( ngpStorageConstants.CLONE_CANDIDATE_REVISION_RULE )[ 0 ];
    const soaInput = {
        inputSourceObjects: cloneCandidates,
        targetScope: pasteContext,
        revisionRule,
        createLink
    };
    const options = {
        ignoreReject: true
    };
    ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Clone', 'cloneObjects', soaInput, options ).then(
        ( responseData ) => {
            if( responseData.assignmentMappingFailures ) {
                ngpAssignmentMappSvc.showAssignmentMappingFailureDialog( responseData.assignmentMappingFailures, localizedMessages.assignmentsCouldNotBeCloned );
            }
            const clonesInfo = responseData.clonesInfo;
            if( clonesInfo ) {
                if( createLink ) {
                    const clonesInfoMap = {};
                    clonesInfo.forEach( ( info ) => {
                        clonesInfoMap[ info.clone.uid ] = {
                            clonesInfo: [],
                            masterInfo: info.masterInfo,
                            status: 'CLONE'
                        };
                    } );
                    ngpCloneStatusCache.updateCache( clonesInfoMap );
                }

                const createdCloneUids = clonesInfo.map( ( cloneInfo )=> cloneInfo.clone.uid );
                eventBus.publish( 'ngpCloneFinishSuccessfully', {
                    context: pasteContext,
                    createdCloneUids
                } );
            }
        } );
}

/**
 * @param {modelObject} modelObject - a given array modelObject
 * @param {boolean} checkCache - true if we should check cache
 * @return {promise<string>} a promise which when resolved returns the clone status
 */
export function getCloneStatus( modelObject, checkCache = true ) {
    return getCloneStatuses( [ modelObject ], checkCache ).then(
        ( uidToCloneStatus ) => {
            return uidToCloneStatus[ modelObject.uid ];
        }
    );
}

/**
 * @param {modelObject[]} modelObjects - a given array modelObject
 * @param {boolean} checkCache - true if we should check cache
 * @return {promise} a promise object which eventually returns "map" object with uid as "key" and the clone status as "value"
 */
export function getCloneStatuses( modelObjects, checkCache = true ) {
    if( Array.isArray( modelObjects ) ) {
        const filteredObjects = modelObjects.filter( ( modelObj ) => canHaveCloneStatus( modelObj ) );
        if( filteredObjects.length > 0 ) {
            const uidToCloneStatus = {};
            const objectsWithNotCachedStatus = [];
            if( checkCache ) {
                filteredObjects.forEach( ( obj ) => {
                    const status = ngpCloneStatusCache.getStatus( obj.uid );
                    if( status ) {
                        uidToCloneStatus[ obj.uid ] = status;
                    } else {
                        objectsWithNotCachedStatus.push( obj );
                    }
                } );
                if( objectsWithNotCachedStatus.length === 0 ) {
                    return new Promise( ( resolve ) => {
                        resolve( uidToCloneStatus );
                    } );
                }
            }
            const modlObjectsToLoadCloneStatus = checkCache ? objectsWithNotCachedStatus : filteredObjects;
            return ngpRelationSvc.getStatusInformation( modlObjectsToLoadCloneStatus, 'CloneStatus' ).then(
                ( { cloneStatuses } ) => {
                    if( cloneStatuses ) {
                        modlObjectsToLoadCloneStatus.forEach( ( modelObj ) => {
                            uidToCloneStatus[ modelObj.uid ] = cloneStatuses[ modelObj.uid ].status;
                        } );
                    }
                    return uidToCloneStatus;
                }
            );
        }
    }
    return new Promise( ( resolve ) => {
        resolve( {} );
    } );
}

/**
 * This method displays a confirmation message to the user before unlinking
 * @param {modelObjects[]} cloneObjects - an array of clone modelObjects
 */
export function unlinkClonesWithConfrimation( cloneObjects ) {
    if( _popup ) {
        popupSvc.hide( _popup );
        _popup = null;
    }
    let msg;
    if( cloneObjects.length === 1 ) {
        msg = localizedMessages.unlinkFromMasterMsg.format( cloneObjects[ 0 ].props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ] );
    } else {
        msg = localizedMessages.unlinkMultipleClonesFromMasterMsg.format( cloneObjects.length );
    }
    return mfeNotyUtils.displayConfirmationMessage( msg, localizedMessages.unlink, localizedMessages.cancel ).then(
        unlinkClones.bind( this, cloneObjects ),
        emptyFunction
    );
}

/**
 *
 * @param {IModelObject[]} cloneObjects - an array of modelObjects
 * @return {promise} a promise object which returns a map of the new statuses
 */
export function unlinkClones( cloneObjects ) {
    if( Array.isArray( cloneObjects ) ) {
        const soaInput = {
            cloneObjects
        };
        return ngpSoaSvc.executeSoa( 'Process-2018-11-Clone', 'unlinkObjects', soaInput ).then(
            () => {
                ngpCloneStatusCache.updateStatusesAfterUnlink( cloneObjects );
                eventBus.publish( 'ngp.clonesUnlinked', {
                    unlinkedClones: cloneObjects
                } );
                if( cloneObjects.length === 1 ) {
                    return ngpCloneStatusCache.getStatus( cloneObjects[ 0 ].uid );
                }
                const uidToNewStatus = {};
                cloneObjects.forEach( ( { uid } ) => {
                    uidToNewStatus[ uid ] = ngpCloneStatusCache.getStatus( uid );
                } );
                //return map of uid to new clone status
                return uidToNewStatus;
            }
        );
    }
}

/**
 * Displays a confirmation before updating the given clone modelObjects
 * @param {modelObject[]} cloneObjects - the given clone objects to update
 */
export function updateCloneWithConfirmation( cloneObjects ) {
    if( _popup ) {
        popupSvc.hide( _popup );
        _popup = null;
    }
    let msg;
    const msgParam = cloneObjects.length === 1 ? cloneObjects[ 0 ].modelType.uiDisplayName.lowerCase : cloneObjects[ 0 ].modelType.uiDisplayName.plural;
    if( ngpTypeUtils.isProcessElement( cloneObjects[ 0 ] ) ) {
        msg = localizedMessages.updateClonedProcessConfirmationMsg.format( msgParam );
    } else {
        msg = localizedMessages.updateClonedActivityConfirmationMsg.format( msgParam );
    }
    return mfeNotyUtils.displayConfirmationMessage( msg, localizedMessages.update, localizedMessages.cancel ).then(
        preUpdateClone.bind( this, cloneObjects ),
        emptyFunction
    );
}

/**
 *
 * @param {modelObject[]} cloneModelObjects - the clone objects
 * @param {string} clonesWithDeletedMasterAction - the action
 */
function updateClones( cloneModelObjects, clonesWithDeletedMasterAction = 'SKIP_CLONE' ) {
    const soaInput = {
        inputSourceObjects: cloneModelObjects,
        action: clonesWithDeletedMasterAction
    };
    ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Clone', 'updateCloneObjects', soaInput ).then(
        ( response ) => {
            if( response.assignmentMappingFailures ) {
                ngpAssignmentMappSvc.showAssignmentMappingFailureDialog( response.assignmentMappingFailures, localizedMessages.assignmentsCouldNotBeCloned );
            }
            if( response.ServiceData.updated ) {
                const scopeObject = appCtxSvc.getCtx( 'ngp.scopeObject' );
                //if we updated the scope object, then possibly need a navigation
                if( cloneModelObjects.length === 1 && cloneModelObjects[ 0 ].uid === scopeObject.uid ) {
                    const cloneModelObject = cloneModelObjects[ 0 ];
                    if( ngpModelUtils.isReleased( cloneModelObject ) ) {
                        ngpNavigationSvc.navigateToConfiguredRevision( cloneModelObject,
                            localizedMessages.updateCreatedNewRevisionMsg.format( cloneModelObject.props[ ngpPropConstants.OBJECT_NAME ].uiValues[ 0 ] ) );
                    } else {
                        ngpNavigationSvc.reloadCurrentPage();
                    }
                } else {
                    //publish a general event that clones we're updated
                    eventBus.publish( 'ngp.clonesUpdated', { cloneModelObjects } );
                }
            } else {
                //if nothing was updated, then we display that the clone/s already up-to-date
                const msg = cloneModelObjects.length > 1 ? localizedMessages.clonesUpToDate :
                    localizedMessages.cloneUpToDate.format( cloneModelObjects[ 0 ].props[ ngpPropConstants.OBJECT_STRING ].uiValues[ 0 ] );
                msgSvc.showInfo( msg );
            }
        }
    );
}

/**
 *
 * @param {modelObject[]} cloneObjects -the given clone objects to update
 */
export function preUpdateClone( cloneObjects ) {
    //for now we assume that updating an activity is done only one by one
    if( cloneObjects.length === 1 && ngpTypeUtils.isActivity( cloneObjects[ 0 ] ) ) {
        const activityClone = cloneObjects[ 0 ];
        ngpLoadSvc.getPropertiesAndLoad( [ activityClone.uid ], [ ngpPropConstants.ACTIVITY_SUB_PROCESSES ] ).then(
            () => {
                const updatedActivity = cdm.getObject( activityClone.uid );
                const subProcesses = updatedActivity.props[ ngpPropConstants.ACTIVITY_SUB_PROCESSES ].dbValues.map( ( uid ) => cdm.getObject( uid ) );
                return getCloneStatuses( subProcesses );
            }
        )
            .then(
                ( subProcessesCloneStatus ) => {
                    const deletedMasterUids = [];
                    Object.keys( subProcessesCloneStatus ).forEach( ( uid ) => {
                        if( subProcessesCloneStatus[ uid ].indexOf( 'MASTER_DELETED' ) > -1 ) {
                            deletedMasterUids.push( uid );
                        }
                    } );
                    if( deletedMasterUids.length > 0 ) {
                        displayClonesWithDeletedMasterActionDialog( cloneObjects, deletedMasterUids );
                    } else {
                        updateClones( cloneObjects );
                    }
                }
            );
    } else {
        updateClones( cloneObjects );
    }
}

/**
 *
 * @param {modelObject[]} clonedActivities - the cloned activities
 * @param {string[]} cloneUidsWithDeletedMasters - the uids of clones with deleted masters
 */
function displayClonesWithDeletedMasterActionDialog( clonedActivities, cloneUidsWithDeletedMasters ) {
    popupSvc.show( {
        options: {
            view: 'NgpClonesWithDeletedMasterActionDialog',
            height: '400',
            width: '500',
            preset: 'modal',
            caption:localizedMessages.updateClonesDialogTitle,
            subPanelContext: {
                scopeObjects: clonedActivities,
                ammountOfClonesWithDeletedMasters: cloneUidsWithDeletedMasters.length
            }
        }
    } );
}

/**
 *
 * @param {modelObject} masterModelObject - the master modelObject
 * @param {string/DOMElement} elementRef - the element reference or its id to open the popup relative to
 */
export function displayFindOrNavigateToCloneCmdList( masterModelObject, elementRef ) {
    const clonesInfoArray = ngpCloneStatusCache.getClonesOfMaster( masterModelObject );
    cmdSvc.getCommand( 'ngpFindOrNavigateToClone' ).then(
        ( cmd ) => {
            const cloneUids = clonesInfoArray.map( ( cloneInfo ) => cloneInfo.clone.uid );
            //all clones and masters must be of same type, therefore share the same parent property name
            const parentProp = ngpModelUtils.getParentPropertyName( masterModelObject );
            ngpLoadSvc.getPropertiesAndLoad( cloneUids, [ parentProp ] ).then(
                () => {
                    const commandsArray = clonesInfoArray.map( ( cloneInfo ) => createFindCloneCmd( cloneInfo, cmd, masterModelObject, parentProp ) );
                    displayCloneOrMasterCommandPopup( commandsArray, elementRef );
                }
            );
        }
    );
}

/**
 *
 * @param {object} cloneInfo - object containing information about the clone object
 * @param {object} cmdObject - a swf command object
 * @param {modelObject} masterModelObject - the master modelObject
 * @param {string} parentProp - the parent property name of the master model object
 * @return {object} a command object
 */
function createFindCloneCmd( cloneInfo, cmdObject, masterModelObject, parentProp ) {
    const newCmd = _.cloneDeep( cmdObject );
    let shouldNavigate = shouldNavigateToTarget( masterModelObject, cloneInfo.clone );
    newCmd.icon = shouldNavigate ? 'cmdOpen' : 'cmdSearch';
    let parentModelObj = cdm.getObject( cloneInfo.clone.props[ parentProp ].dbValues[ 0 ] );
    const cloneObjectString =  cloneInfo.clone.props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ];
    newCmd.title = parentModelObj ? localizedMessages.findCloneCmdTitle.format( cloneInfo.cloneProductEffectivity,
        parentModelObj.props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ], cloneObjectString ) :
        localizedMessages.findCloneWithNoParentCmdTitle.format( cloneInfo.cloneProductEffectivity, cloneObjectString );
    newCmd.execute = findCloneOrMaster.bind( newCmd, shouldNavigate, masterModelObject.uid, cloneInfo.clone.uid, parentModelObj ? parentModelObj.uid : null );
    return newCmd;
}

/**
 *
 * @param {boolean} isNavigationAction - is a navigation action
 * @param {string} sourceObjUid - the source object uid
 * @param {string} targetObjUid  - the target object uid that we're looking for
 * @param {string} targetParentUid - the target object parent uid that we'll navigate to
 */
function findCloneOrMaster( isNavigationAction, sourceObjUid, targetObjUid, targetParentUid ) {
    if( !targetObjUid ) {
        msgSvc.showInfo( localizedMessages.cantFindConfiguredOutMaster );
    } else if( !isNavigationAction ) {
        eventBus.publish( 'ngp.selectOrHighlightObjects', {
            uidsToSelect: [ targetObjUid ]
        } );
    } else {
        const scopeObject = appCtxSvc.getCtx( 'ngp.scopeObject' );
        if( sourceObjUid === scopeObject.uid || !targetParentUid ) {
            ngpNavigationSvc.navigateWithInNgp( targetObjUid );
        } else {
            ngpSelectUponLoadSvc.setUidsToSelectUponLoad( [ targetObjUid ] );
            ngpNavigationSvc.navigateWithInNgp( targetParentUid );
        }
    }
    if( _popup ) {
        popupSvc.hide( _popup );
        _popup = null;
    }
}

/**
 *
 * @param {modelObject} cloneModelObj - the clone modelObject
 */
export function navigateToMaster( cloneModelObj ) {
    const configuredMaster = ngpCloneStatusCache.getConfiguredMaster( cloneModelObj.uid );
    findCloneOrMaster( true, cloneModelObj.uid, configuredMaster ? configuredMaster.uid : null );
}

/**
 *
 * @param {modelObject} sourceModelObj - the master modelObject
 * @param {modelObject} targetModelObj - the clone modelObject
 * @return {boolean} true if a navigation should occur
 */
function shouldNavigateToTarget( sourceModelObj, targetModelObj ) {
    const scopeObject = appCtxSvc.getCtx( 'ngp.scopeObject' );
    if( sourceModelObj.uid === scopeObject.uid ) {
        return true;
    }
    const masterHullUid = ngpDataUtils.getMfgModelUid( sourceModelObj, true );
    const cloneHullUid = ngpDataUtils.getMfgModelUid( targetModelObj, true );
    if( masterHullUid !== cloneHullUid ) {
        return true;
    }
    const isScopeAncestorOfSource = ngpModelUtils.getAncestorUids( sourceModelObj ).indexOf( scopeObject.uid ) > -1;
    const isScopeAncestorOfTarget = ngpModelUtils.getAncestorUids( targetModelObj ).indexOf( scopeObject.uid ) > -1;
    return !( isScopeAncestorOfSource && isScopeAncestorOfTarget );
}

/**
 *
 * @param {object[]} commandsList - array of commands
 * @param {string} reference - elemenet reference id
 */
function displayCloneOrMasterCommandPopup( commandsList, reference ) {
    commandsList.forEach( ( cmd ) => cmd.enabled = true );
    popupSvc.show( {
        options: {
            view:'NgpCommandPopup',
            whenParentScrolls: 'follow',
            reference,
            placement: 'bottom-start',
            isModal: false,
            flipBehavior: 'opposite',
            clickOutsideToClose: true,
            ignoreReferenceClick: true,
            draggable: false,
            subPanelContext: {
                commandsList
            }
        }
    } ).then( ( popup ) => _popup = popup );
}

/**
 *
 * @param {modelObject} cloneModelObj - the clone modelObject
 * @param {DOMElement} refElement - the element reference id to open the popup to
 */
export function displayCloneCommandsList( cloneModelObj, refElement ) {
    const cloneStatusObj = ngpCloneStatusCache.getCloneStatusObject( cloneModelObj.uid );
    let commandIds = [];
    switch ( cloneStatusObj.status ) {
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE:
        case ngpCloneStatusCache.cloneStatusConstants.CLONE:
        case ngpCloneStatusCache.cloneStatusConstants.CLONE_OUT_OF_DATE:
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_OUT_OF_DATE:
            commandIds = [ 'ngpUnlinkClone', 'ngpFindMaster', 'ngpUpdateClone' ];
            if( ngpTypeUtils.isBuildElement( cloneModelObj ) ) {
                commandIds.pop();
            }
            break;
        case ngpCloneStatusCache.cloneStatusConstants.CLONE_MASTER_DELETED:
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_MASTER_DELETED:
            commandIds = [ 'ngpUnlinkClone' ];
            break;
        default:
            break;
    }

    if( commandIds.length > 0 ) {
        const promiseArray = [];
        const masterModelObj = ngpCloneStatusCache.getConfiguredMaster( cloneModelObj.uid );
        let parentProp = ngpModelUtils.getParentPropertyName( cloneModelObj );
        //master object could be configured out
        if( masterModelObj ) {
            promiseArray.push( ngpLoadSvc.getPropertiesAndLoad( [ masterModelObj.uid ], [ parentProp ] ) );
        } else {
            promiseArray.push( new Promise( ( resolve ) => resolve( null ) ) );
        }
        commandIds.forEach( ( cmdId ) => promiseArray.push( cmdSvc.getCommand( cmdId ) ) );
        Promise.all( promiseArray ).then( ( [ getProp, ...commands ] ) => {
            const [ unlinkCmd, findMasterCmd, updateCloneCmd ] = commands;
            const commandsArray = [];
            if( findMasterCmd ) {
                commandsArray.push( createFindMasterCmd( findMasterCmd, masterModelObj, cloneModelObj, parentProp ) );
            }
            if( updateCloneCmd ) {
                updateCloneCmd.execute = updateCloneWithConfirmation.bind( updateCloneCmd, [ cloneModelObj ] );
                updateCloneCmd.title = updateCloneCmd.title.value;
                commandsArray.push( updateCloneCmd );
            }
            if( unlinkCmd ) {
                unlinkCmd.execute = unlinkClonesWithConfrimation.bind( unlinkCmd, [ cloneModelObj ] );
                unlinkCmd.title = unlinkCmd.title.value;
                commandsArray.push( unlinkCmd );
            }
            displayCloneOrMasterCommandPopup( commandsArray, refElement );
        } );
    }
}

/**
 *
 * @param {object} cmdObject - the command object
 * @param {modelObject} masterModelObj - the master model object
 * @param {modelObject} cloneModelObj - the clone model object
 * @param {string} parentProp - the parent property name of the clone/master
 * @return {object} the command object
 */
function createFindMasterCmd( cmdObject, masterModelObj, cloneModelObj, parentProp ) {
    if( masterModelObj ) {
        const isNavigationAction = shouldNavigateToTarget( cloneModelObj, masterModelObj );
        cmdObject.icon = isNavigationAction ? 'cmdOpen' : 'cmdSearch';
        let parentModelObj = cdm.getObject( masterModelObj.props[ parentProp ].dbValues[ 0 ] );
        cmdObject.execute = findCloneOrMaster.bind( cmdObject, isNavigationAction, cloneModelObj.uid, masterModelObj.uid, parentModelObj ? parentModelObj.uid : null );
    } else {
        cmdObject.execute = findCloneOrMaster.bind( cmdObject, false, cloneModelObj.uid );
    }
    cmdObject.title = cmdObject.title.value;
    return cmdObject;
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {boolean} true if the given modelObject can have a clone status
 */
export function canHaveCloneStatus( modelObject ) {
    return ngpTypeUtils.isProcessElement( modelObject ) || ngpTypeUtils.isActivity( modelObject ) || ngpTypeUtils.isBuildElement( modelObject );
}

let exports;
export default exports = {
    setCloneCandidates,
    getCloneStatus,
    getCloneStatuses,
    unlinkClones,
    unlinkClonesWithConfrimation,
    preUpdateClone,
    updateCloneWithConfirmation,
    displayFindOrNavigateToCloneCmdList,
    displayCloneCommandsList,
    updateClones,
    navigateToMaster,
    canHaveCloneStatus,
    pasteCloneCandidates
};
