// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epAddObjectService
 */

import appCtxService from 'js/appCtxService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import dataManagementService from 'soa/dataManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import popupService from 'js/declpopupService';
import eventBus from 'js/eventBus';
import epInitializationService from 'js/epInitializationService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import localeService from 'js/localeService';
import logger from 'js/logger';
import epContextService from 'js/epContextService';
import { constants as _epLoadConstants } from 'js/epLoadConstants';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import AwPromiseService from 'js/awPromiseService';

/**
 * Add's selected object to the current CC.
 * @param {Object} data - declViewModel
 * @param {Object} selectedObject - selected Object from search popup
 * @param {Object} revisionRule - selected rev Rule
 */
export function addObject( data, selectedObject, revisionRule ) {
    const saveInputWriter = saveInputWriterService.get();
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const ccUid = epPageContext.collaborationContext.uid;
    const objectToAdd = selectedObject.uid;
    const revRule = revisionRule.dbValue;
    const ccObject = {
        id: [ ccUid ]
    };

    const objectToAddInCC = {
        Add: [ objectToAdd ],
        revisionRule: [ revRule ]
    };
    saveInputWriter.addObjectToCC( ccObject, objectToAddInCC );

    const objectToLoad = [ ccUid, objectToAdd, revRule ];

    return dataManagementService.loadObjects( objectToLoad ).then( function() {
        const ccObject = cdmSvc.getObject( ccUid );
        const objectToAddObj = cdmSvc.getObject( objectToAdd );
        const revRuleObj = cdmSvc.getObject( revRule );
        const relatedObjects = [ ccObject, objectToAddObj, revRuleObj ];
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
            // TODO : We have published addRemove event from this service as a WORKAROUND for now.
            // Once saveEvents are available in server response, then epSaveService should publish this event.
            const ccObjectUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext' ).uid;
            const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccObjectUid );
            return epLoadService.loadObject( loadTypeInput, true ).then( ( response ) => {
                epInitializationService.updateTaskPageContext( response );
                eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent : objectToAdd } );
                popupService.hide( data.popupId );
            } );
        } );
    } );
}

/**
 * Finds Associated twin Plant or Plant BOP object from given Plant or Plant BOP
 * @param {Object} selectedObject Selected Plant/ Plant BOP object
 * @returns {String} UID of associated twin
 */
export function findAssociatedTwin( selectedObject ) {
    const awPromise = AwPromiseService.instance;
    const input  =  epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.ASSOCIATED_TWIN, selectedObject.uid );
    return epLoadService.loadObject( input, false ).then( function( output ) {
        if( output.ServiceData.modelObjects ) {
            for( let key in output.ServiceData.modelObjects ) {
                let object = output.ServiceData.modelObjects[key];
                return object.uid;
            }
        }
        return awPromise.resolve();
    } );
}

/**
 * Add configurator context to the workpackage
 * @param {*} data - declViewModel
 * @param {*} selectedObject - selected Object from search popup
 * @returns
 */
function addConfiguratorContext( data, selectedObject ) {
    const saveInputWriter = saveInputWriterService.get();
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const ccUid = epPageContext.collaborationContext.uid;
    const objectToAdd = selectedObject.uid;
    const ccObject = {
        id: [ ccUid ]
    };
    const objectToAddInCC = {
        Add: [ objectToAdd ]
    };
    saveInputWriter.addConfiguratorContext( ccObject, objectToAddInCC );
    const objectToLoad = [ ccUid, objectToAdd ];

    return dataManagementService.loadObjects( objectToLoad ).then( function() {
        const ccObject = cdmSvc.getObject( ccUid );
        const objectToAddObj = cdmSvc.getObject( objectToAdd );
        const relatedObjects = [ ccObject, objectToAddObj ];
        const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
        const associateConfigContextConfirmationMessage = localTextBundle.associateConfigContextMessage.format( objectToAddObj.props.object_string.dbValues[0] );
        return mfgNotificationUtils.displayConfirmationMessage( associateConfigContextConfirmationMessage, localTextBundle.associateButton, localTextBundle.cancelButton ).then( () => {
            return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
                // TODO : We have published addRemove event from this service as a WORKAROUND for now.
                // Once saveEvents are available in server response, then epSaveService should publish this event.
                const ccObjectUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext' ).uid;
                const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccObjectUid );
                return epLoadService.loadObject( loadTypeInput ).then( ( response ) => {
                    epInitializationService.updateTaskPageContext( response );
                    for( let object in  response.loadedObjectsMap ) {
                        epContextService.setPageContext( object,  response.loadedObjectsMap[ object ][ 0 ] );
                    }
                    eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent : objectToAdd } );
                    popupService.hide( data.popupId );
                } );
            } );
        }, () => {
            logger.info( 'User cancelled operation' );
        } );
    } );
}

/**
 * 'Updates field values for form'
 * @param {Object} propName - propName
 * @param {Object} selectedObject - selected Object from search popup
 * @return {Object} dbValue,dispValue - dbValue and dispValue for propName
 */
export function updateSelectionToField( propName, selectedObject ) {
    let uiValue = selectedObject.props ? selectedObject.props.object_name.uiValue : '';
    propName.update( uiValue );
}

/**
 * 'Updates field values for form'
 * @param {Object} propName - propName
 * @param {Object} description - propName
 * @param {Object} selectedObject - selected Object from search popup
 * @return{Object} objectToClone - object to be added
 */
export function getObjectToClone( propName, description, selectedObject ) {
    return {
        uid: selectedObject.uid,
        name: {
            dbValue: propName.dbValue,
            uiValue: propName.uiValue
        },
        desc: {
            dbValue: description.dbValue,
            uiValue: description.uiValue
        }
    };
}
/**
 * 'Updates field values for form'
 * @param {Object} popupId - popup id
 * @param {Object} objectToClone - selected Object from search popup
 * @param {Object} revisionRule - selected Object from search popup
 * @return {Object} createdObject - New object
 */
export function createPlantFromTemplate( popupId, objectToClone, revisionRule ) {
    const saveInputWriter = saveInputWriterService.get();
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const ccUid = epPageContext.collaborationContext.uid;
    const newObjUid = mfeViewModelUtils.generateUniqueId( 'new_object_id' );

    const objToClone = {
        id: newObjUid,
        name: objectToClone.name.dbValue,
        desc: objectToClone.desc.dbValue,
        connectTo: ccUid,
        cloneFrom: objectToClone.uid,
        revisionRule: revisionRule.dbValue
    };
    saveInputWriter.addCloneObject( objToClone );
    const objectToLoad = [ ccUid, objectToClone.uid, revisionRule.dbValue ];

    return dataManagementService.loadObjects( objectToLoad ).then( function() {
        const ccObject = cdmSvc.getObject( ccUid );
        const objectToAddObj = cdmSvc.getObject( objectToClone.uid );
        const revRuleObj = cdmSvc.getObject( revisionRule.dbValue );
        const relatedObjects = [ ccObject, objectToAddObj, revRuleObj ];

        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
            // TODO : We have published addRemove event from this service as a WORKAROUND for now.
            // Once saveEvents are available in server response, then epSaveService should publish this event.
            const ccObjectUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext' ).uid;
            const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccObjectUid );

            return epLoadService.loadObject( loadTypeInput, true ).then( ( response ) => {
                epInitializationService.updateTaskPageContext( response );
                eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent : objectToClone.uid } );
                popupService.hide( popupId );
            } );
        } );
    } );
}

export function addPlantFromPlantBOP( selectedObject ) {
    const saveInputWriter = saveInputWriterService.get();
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const ccUid = epPageContext.collaborationContext.uid;
    const cloneFromObj = selectedObject.uid;
    const newObjUid = mfeViewModelUtils.generateUniqueId( 'new_object_id' );
    const objToClone = {
        id: newObjUid,
        connectTo: ccUid,
        cloneFrom: cloneFromObj,
        createTwin: 'true'
    };
    saveInputWriter.addCloneObject( objToClone );
    const objectToLoad = [ ccUid, cloneFromObj ];
    return dataManagementService.loadObjects( objectToLoad ).then( function() {
        const ccObject = cdmSvc.getObject( ccUid );
        const objectToAddObj = cdmSvc.getObject( cloneFromObj );
        const relatedObjects = [ ccObject, objectToAddObj ];
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
            // TODO : We have published addRemove event from this service as a WORKAROUND for now.
            // Once saveEvents are available in server response, then epSaveService should publish this event.
            const ccObjectUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext' ).uid;
            const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccObjectUid );
            return epLoadService.loadObject( loadTypeInput, true ).then( ( response ) => {
                epInitializationService.updateTaskPageContext( response );
                eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent : cloneFromObj } );
            } );
        } );
    } );
}

function addMbomUsingMirror( input ) {
    const saveInputWriter = saveInputWriterService.get();
    const cloneFrom = input.cloneFrom;
    const revisionRule = input.revisionRule;
    const createMirror = input.createMirror;
    const ccUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext.uid' );

    const objToClone = {
        connectTo: ccUid,
        cloneFrom: cloneFrom,
        revisionRule: revisionRule,
        createMirror: createMirror
    };

    saveInputWriter.addCloneObject( objToClone );
    const objectToLoad = [ ccUid, cloneFrom ];

    return dataManagementService.loadObjects( objectToLoad ).then( function() {
        const ccObject = cdmSvc.getObject( ccUid );
        const objectToAdd = cdmSvc.getObject( cloneFrom );
        const relatedObjects = [ ccObject, objectToAdd ];

        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
            const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccUid );
            return epLoadService.loadObject( loadTypeInput, true ).then( ( response ) => {
                epInitializationService.updateTaskPageContext( response );
                eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent : cloneFrom } );
            } );
        } );
    } );
}
/**
 * Load EBOM Revisions
 *
 * @returns {object} selected EBOM
 */
async function loadEBOMRevisions( selectedObject ) {
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.MBM_UpdateEBOMRevision ], selectedObject.uid, null, null, null );
    let response = await epLoadService.loadObject( loadTypeInput, false );
    if( response.loadedObjects.length !== 0 ) {
        return response.loadedObjectsMap.loadedObject;
    }
    return [];
}

export default {
    addObject,
    findAssociatedTwin,
    addConfiguratorContext,
    updateSelectionToField,
    getObjectToClone,
    createPlantFromTemplate,
    addPlantFromPlantBOP,
    addMbomUsingMirror,
    loadEBOMRevisions
};
