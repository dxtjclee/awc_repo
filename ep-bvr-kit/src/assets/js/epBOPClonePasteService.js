// Copyright (c) 2022 Siemens

import app from 'app';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import localeService from 'js/localeService';
import messagingSvc from 'js/messagingService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import epBvrObjectService from 'js/epBvrObjectService';
import epReloadService from 'js/epReloadService';
import cdm from 'soa/kernel/clientDataModel';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import viewModelObjectSvc from 'js/viewModelObjectService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import epChangeIndicationService from 'js/epChangeIndicationService';
import occmgmtBackingObjectProviderSvc from 'js/occmgmtBackingObjectProviderService';

/**
 * EP BOP Clone Paste service
 *
 * @module js/epBOPClonePasteService
 */

const relatedObjectChildrenKey = 'childAssembly';
/**
 * Pastes new objects as the child of selected object.
 * @param {ViewModelObject} vmo - Parent ViewModelObject
 * @param {String} newObjectID - id of new object
 * @param {[ViewModelObject]} objectToPaste - objects to be pasted
 * @param {String} revRule - Revision rule of object to be pasted
 * @param {string} cloneType To decide whether to clone process with associated assembly or not. E.g: - processDetailPlanning
 * @returns {Promise} the promise
 */
export function pasteInto( vmo, newObjectID, objectToPaste, revRule, cloneType ) {
    //For Multiple Copy Paste Into Case In Assembly Planning Page
    let newObjectUID = [];
    Array.isArray( newObjectID ) ? newObjectUID = newObjectID : newObjectUID.push( newObjectID );
    const areObjectsCut = appCtxService.getCtx( 'cutIntent' );
    // In case of process cut-paste check if we are pasting under same parent,  as server do not process this use-case
    if( areObjectsCut && objectToPaste.length === 1 && mfeTypeUtils.isOfType( vmo, epBvrConstants.MFG_BVR_PROCESS ) && mfeTypeUtils.isOfType( objectToPaste[ 0 ], epBvrConstants
        .MFG_BVR_PROCESS ) ) {
        if( objectToPaste[ 0 ].props.bl_parent.dbValues[ 0 ] === vmo.uid ) {
            eventBus.publish( 'EpTreeTable.plTable.clientRefresh' );
            return AwPromiseService.instance.resolve();
        }
    }
    let saveInputWriter = saveInputWriterService.get();

    let relatedObjects = [];

    let parentObj = cdm.getObject( vmo.id ? vmo.id : vmo.uid );
    relatedObjects.push( parentObj );

    objectToPaste.forEach( function( element, index ) {
        if( areObjectsCut ) {
            addMoveObjectInput( saveInputWriter, parentObj, element );
        } else {
            addPasteInput( saveInputWriter, parentObj, element, newObjectUID[ index ], revRule, cloneType );
        }
        relatedObjects.push( element );
    } );
    relatedObjects.push( vmo );
    const children = getChildren( parentObj, relatedObjectChildrenKey );
    relatedObjects = relatedObjects.concat( children );
    saveInputWriter.addRelatedObjects( relatedObjects );
    const policyId = policySvc.register( getPastePolicy() );
    const epAllowAutoRegenerateFN = appCtxService.getCtx( 'preferences.EP_AllowAutoRegenerateFindNumbers' );
    if( epAllowAutoRegenerateFN && epAllowAutoRegenerateFN[ 0 ] === 'true' ) {
        addRegenarateFindNumberInput( saveInputWriter, parentObj );
    }
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( serviceResponse ) {
        handleSaveResponse( serviceResponse, policyId, 'pasteInto', objectToPaste, newObjectUID, vmo );
    } );
}

/**
 * Get the created Object for given Uid from serviceResponse
 *
 * @param {String} newObjectID - new Object ID
 * @param {Object} serviceResponse service Response
 * @returns {Object} created Object for given Uid from serviceResponse
 */
function getCreatedObjectFromResponse( newObjectID, serviceResponse ) {
    if( serviceResponse && serviceResponse.saveResults ) {
        let createdObjectUid = null;
        serviceResponse.saveResults.every( ( saveResult ) => {
            if( saveResult.clientID && saveResult.clientID === newObjectID ) {
                createdObjectUid = saveResult.saveResultObject.uid;
                return false;
            }
            return true;
        } );
        if( createdObjectUid ) {
            return cdm.getObject( createdObjectUid );
        }
    }
    return null;
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {VMO} connectedTo Parent of copied Object
 * @param {VMO} cloneFrom object to be copied
 * @param {String} newObjUid Newly copied object uid
 * @param {String} revisionRule revision Rule
 * @param {string} cloneType To decide whether to clone process with associated assembly or not. E.g: - processDetailPlanning
 * @returns {String} Newly copied object uid
 */
function addPasteInput( saveInputWriter, connectedTo, cloneFrom, newObjUid, revisionRule, cloneType ) {
    let revrule = '';
    if( revisionRule ) {
        revrule = revisionRule;
    }
    const objToClone = {
        id: newObjUid,
        connectTo: connectedTo.uid,
        cloneFrom: cloneFrom.uid,
        revisionRule: revrule
    };
    if( cloneType ) {
        objToClone.cloneType = cloneType;
    }
    saveInputWriter.addCloneObject( objToClone );

    return newObjUid;
}

/**
 *
 * @param {Object} parent parent
 * @param {String} relatedObjectChildrenKey key
 * @returns {Array} parents children with Process resource children if there is such
 */
function getChildren( parent, relatedObjectChildrenKey ) {
    let children = cdm.getObjects( epObjectPropertyCacheService.getProperty( parent.uid, relatedObjectChildrenKey ) );
    children.forEach( child => {
        if( mfeTypeUtils.isOfType( child, epBvrConstants.MFG_BVR_PROCESS_RESOURCE ) ) {
            children = [ ...children, ...cdm.getObjects( epObjectPropertyCacheService.getProperty( child.uid, relatedObjectChildrenKey ) ) ];
        }
    } );
    return children;
}

/**
 *This method implements paste before for selected copied object
 * @param {ViewModelObject} vmo - Paste before object
 * @param {String} id of new object being pasted
 * @param {[VMOObject]} objectToPaste array of all objects needed to paste

 */
export function pasteBefore( vmo, id, objectToPaste ) {
    pasteBeforeAfter( vmo, true, id, objectToPaste );
}

/**
 * Add regenerate input to save input writer
 *
 * @param {Object} saveInputWriter save input writer
 * @param {Object} parentObj Parent obj
 */
function addRegenarateFindNumberInput( saveInputWriter, parentObj ) {
    saveInputWriter.regenerateFindNumber( {
        objectUid: parentObj.uid,
        startNumber: '10',
        increment: '10',
        isBasedOnFlows: 'false',
        isKeepParallelFindNumber: 'false',
        isRecursive: 'false'
    } );
}

/**
 *
 * @param {VMOObject} vmo Selected object
 * @param {Boolean} isPasteBefore PASTE BEFORE : TRUE , PASTE AFTER : FALSE
 * @param {String} id of new object being pasted
 * @param {[VMOObject]} objectToPaste array of all objects needed to paste
 * @param {String} revisionRule revision rule name for cloned object
 * @param {Boolean} resequence is from resequence
 * @returns {Promise} the promise
 */
export function pasteBeforeAfter( vmo, isPasteBefore, id, objectToPaste, revisionRule, resequence ) {
    let relatedObjects = [];

    let newObjectUID = [];
    let saveInputWriter = saveInputWriterService.get();
    relatedObjects.push( vmo );
    Array.isArray( id ) ? newObjectUID = id : newObjectUID.push( id );

    //get parent object
    const parentObj = epBvrObjectService.getProcessResourceOrStationParent( vmo );
    if( parentObj ) {
        const areObjectsCut = appCtxService.getCtx( 'cutIntent' );

        relatedObjects.push( parentObj );
        objectToPaste.forEach( function( element, index ) {
            if( areObjectsCut || resequence ) {
                addMoveObjectInput( saveInputWriter, parentObj, element );
                isPasteBefore ? addSuccessor( saveInputWriter, element.uid, vmo ) : addPredecessor( saveInputWriter, element.uid, vmo );
            } else {
                addPasteInput( saveInputWriter, parentObj, element, newObjectUID[ index ], revisionRule );
                isPasteBefore ? addSuccessor( saveInputWriter, newObjectUID[ index ], vmo ) : addPredecessor( saveInputWriter, newObjectUID[ index ], vmo );
                relatedObjects.push( newObjectUID[ index ] );
            }
            relatedObjects.push( element );
        } );
        const children = getChildren( parentObj, relatedObjectChildrenKey );
        relatedObjects = relatedObjects.concat( children );

        saveInputWriter.addRelatedObjects( relatedObjects );
        const policyId = policySvc.register( getPastePolicy() );
        const epAllowAutoRegenerateFN = appCtxService.getCtx( 'preferences.EP_AllowAutoRegenerateFindNumbers' );
        if( epAllowAutoRegenerateFN && epAllowAutoRegenerateFN[ 0 ] === 'true' ) {
            addRegenarateFindNumberInput( saveInputWriter, parentObj );
        }
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( serviceResponse ) {
            const pasteType = isPasteBefore ? 'pasteBefore' : 'pasteAfter';
            handleSaveResponse( serviceResponse, policyId, pasteType, objectToPaste, newObjectUID, vmo );
        } );
    }
}

/**
 * Get the property policy
 *
 * @returns {Object} Policy object - Policy object
 */
function getPastePolicy() {
    return {
        types: [ {
            name: epBvrConstants.IMAN_ITEM_BOP_LINE,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            }, {
                name: epBvrConstants.BL_SEQUENCE_NO
            }, {
                name: epBvrConstants.MFG_SUB_ELEMENTS
            } ]
        } ]
    };
}
/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {[Object]} objectsToPaste array of all objects needed to paste
 * @param {Object} pastedObject pasted object
 * @returns {String} localizedValue - The localized message string
 */
function getPastedIntoLocalizedMessage( localTextBundle, objectsToPaste, pastedObject, targetObj ) {
    return objectsToPaste && objectsToPaste.length === 1 ? localTextBundle.pasteSuccessMessage
        .format( pastedObject.props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteMultipleSuccessMessage.format( objectsToPaste.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {[Object]} objectsToPaste array of all objects needed to paste
 * @param {Object} pastedObject pasted object
 * @returns {String} localizedValue - The localized message string
 */
function getPastedBeforeSucessLocalizedMessage( localTextBundle, objectsToPaste, pastedObject, targetObj ) {
    return objectsToPaste && objectsToPaste.length === 1 ?
        localTextBundle.pasteBeforeSuccessMessage.format( pastedObject.props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteBeforeMultipleSuccessMessage.format( objectsToPaste.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 *This method implements paste before for selected copied object
 * @param {ViewModelObject} vmo - Paste before object
 * @param {String} id of new object being pasted
 * @param {[VMOObject]} objectToPaste array of all objects needed to paste
 */
export function pasteAfter( vmo, id, objectToPaste ) {
    pasteBeforeAfter( vmo, false, id, objectToPaste );
}

/**
 *This method implements cloning of object and connecting it to selected object
 * @param {ViewModelObject} selectedObject - Selected object to add cloned object before/after/into.
 * @param {ViewModelObject} objectToClone - object which is being cloned
 * @param {ViewModelObject} revisionRule - Revision rule of objectToClone
 * @param {string} cloneType To decide whether to clone process with associated assembly or not. E.g: - processDetailPlanning
 * @returns {Promise} Promise
 */
export function cloneObject( selectedObject, objectToClone, revisionRule, cloneType ) {
    let toCloneArray = [];
    toCloneArray.push( objectToClone );
    let revRule;
    if( revisionRule ) {
        revRule = revisionRule.uiValue;
    }
    if( mfeTypeUtils.isOfType( selectedObject, epBvrConstants.MFG_BVR_OPERATION ) ) {
        let newObjectIDs = createAndRegisterReloadInputForPasteBeforeAfter( selectedObject, toCloneArray, 'epPaste' );
        return pasteBeforeAfter( selectedObject, false, newObjectIDs, toCloneArray, revRule );
    } else if( mfeTypeUtils.isOfType( selectedObject, epBvrConstants.MFG_BVR_PROCESS ) || mfeTypeUtils.isOfType( selectedObject, epBvrConstants.MFG_BVR_PROCESS_RESOURCE ) ) {
        let newObjectIDs = createAndRegisterReloadInputForPasteInto( selectedObject, toCloneArray, 'epPaste' );
        return pasteInto( selectedObject, newObjectIDs, toCloneArray, revRule, cloneType );
    }
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {[Object]} objectsToPaste array of all objects needed to paste
 * @param {Object} pastedObject pasted object
 * @returns {String} localizedValue - The localized message string
 */
function getPastedAfterSucessLocalizedMessage( localTextBundle, objectsToPaste, pastedObject, targetObj ) {
    return objectsToPaste && objectsToPaste.length === 1 ?
        localTextBundle.pasteAfterSuccessMessage.format( pastedObject.props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteAfterMultipleSuccessMessage.format( objectsToPaste.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {Object} parentObject new parent object
 * @param {Object} objectToMove object to move
 */
function addMoveObjectInput( saveInputWriter, parentObject, objectToMove ) {
    saveInputWriter.addMoveObject( { id: [ objectToMove.uid ] }, { bl_parent: [ parentObject.uid ] } );
}

/**
 * Add Predecessor Object
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {String} objectToMoveUid object to move uid
 * @param {Object} predecessorObject predecessor obj
 */
function addPredecessor( saveInputWriter, objectToMoveUid, predecessorObject ) {
    const predecessorInfo = {
        objectId: objectToMoveUid,
        predecessorId: predecessorObject.uid
    };
    saveInputWriter.addPredecessor( predecessorInfo );
}

/**
 * Add Successor Object
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {String} objectToMoveUid object to move
 * @param {Object} successorObject Successor obj
 */
function addSuccessor( saveInputWriter, objectToMoveUid, successorObject ) {
    const successorInfo = {
        objectId: objectToMoveUid,
        successorId: successorObject.uid
    };
    saveInputWriter.addSuccessor( successorInfo );
}

/**
 * return reload object data
 *
 * @param {Object} selectedObject new parent obj
 * @param {Object} copiedObjects copied Objects
 */
function createAndRegisterReloadInputForPasteInto( selectedObject, copiedObjects, reloadType ) {
    if( reloadType ) {
        let newObjectIDs = generateUniqueIDsAndSetInViewModel( copiedObjects );
        createAndRegisterReloadInput( selectedObject, copiedObjects, newObjectIDs );
        return newObjectIDs;
    }
    return {};
}

/**
 * return reload object data
 *
 * @param {Object} selectedObject new parent obj
 * @param {Object} copiedObjects copied Objects
 */
function createAndRegisterReloadInputForPasteBeforeAfter( selectedObject, copiedObjects, reloadType ) {
    if( reloadType ) {
        const parentObj = epBvrObjectService.getProcessResourceOrStationParent( selectedObject );
        let newObjectIDs = generateUniqueIDsAndSetInViewModel( copiedObjects );
        createAndRegisterReloadInput( parentObj, copiedObjects, newObjectIDs );
        return newObjectIDs;
    }
    return {};
}

/**
 * return reload object data
 *
 * @param {Object} targetParent new parent obj
 * @param {Object} copiedObjects copied Objects
 */
function createAndRegisterReloadInput( targetParent, copiedObjects, newObjectIDs ) {
    const subLocationName = appCtxService.getCtx( 'sublocation' ).nameToken;
    let parentObjects = [ targetParent ];
    const areObjectsCut = appCtxService.getCtx( 'cutIntent' );
    let reloadObjId = areObjectsCut ? copiedObjects : newObjectIDs;
    if( areObjectsCut ) {
        copiedObjects.map( ( copiedObject ) => {
            parentObjects.push( epBvrObjectService.getProcessResourceOrStationParent( copiedObject ) );
        } );
    }
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const loadedObjectUid = epPageContext.loadedObject.uid;
    let reloadData = {
        epPaste: [ {
            reloadTypeName: 'CommonExpand',
            object: parentObjects,
            additionalLoadParams: [ {
                tagName: 'expandType',
                attributeName: 'type',
                attributeValue: subLocationName === 'highLevelPlanning' ? 'ExpandProcessHighLevelPlanning' : 'ExpandProcessDetailedPlanning'
            },
            {
                tagName: 'expandInfo',
                attributeName: 'level',
                attributeValue: 'CHILDREN'
            }, {
                tagName: 'currentScope',
                attributeName: 'objectUid',
                attributeValue: loadedObjectUid
            }
            ]
        } ]
    };
    if( subLocationName === 'workInstructions' ) {
        reloadData.epPaste.push( {
            reloadTypeName: 'GetWIData',
            object: reloadObjId,
            additionalLoadParams: [ {
                tagName: 'currentScope',
                attributeName: 'objectUid',
                attributeValue:  loadedObjectUid
            } ]
        } );
    }
    epReloadService.registerReloadInput( 'epPaste', reloadData.epPaste );
}

/**
 * registerForReloadSection
 */
export function registerForReloadSectionForClone( name, type, newObjectID ) {
    if( !type ) { return; }
    if( typeof type === 'string' ) {
        type = JSON.parse( type );
    }
    type = type.epPaste ? type.epPaste : type;

    // If the reloadType/s is supposed to be registered for new objectUID,
    // then it will be empty at this point. Lets fill it.
    const reloadTypes = Array.isArray( type ) ? type : [ type ];
    reloadTypes.forEach( ( reloadType ) => {
        if( !reloadType.object ) {
            reloadType.object = newObjectID;
        }
    } );
    epReloadService.registerReloadInput( name, type );
}

/**
 * Clone And Associate Process Confirmation and then call clone based on confirmation.
 * @param { Object } objectToClone : Object to clone
 * @param { String } newObjectID : Object ID for new cloned object
 * @param { String } targetAssemblyUid: target assembly ID which will be associated with process
 * @param { String } revRule : revision rule
 */
export function cloneAndAssociateProcessConfirmation( objectToClone, newObjectID, targetAssemblyUid, revRule ) {
    let targetAssembly;

    if( targetAssemblyUid ) {
        targetAssembly = viewModelObjectSvc.createViewModelObject( cdm.getObject( targetAssemblyUid ) );
    }
    if( targetAssembly && objectToClone ) {
        const resource = localeService.getLoadedText( 'HighLevelPlanningMessages' );
        let confirmationMessage = resource.cloneConfirmationMessage.format( objectToClone.props.object_string.dbValues[ 0 ], targetAssembly.props.object_string.dbValues[ 0 ] );
        mfgNotificationUtils.displayConfirmationMessage( confirmationMessage, resource.cloneButtonText, resource.discardButtonText ).then(
            () => {
                return performCloneAndAssociationToProcess( objectToClone, newObjectID, targetAssembly, revRule );
            }
        );
    }
}

/**
 * Call Clone and associate process.
 *
 * @param { Object } objectToClone : Object to clone
 * @param { String } newObjectID : Object ID for new cloned object
 * @param { Object } targetAssembly: target assembly object which will be associated with process
 * @param { String } revRule : revision rule
 */
function performCloneAndAssociationToProcess( objectToClone, newObjectID, targetAssembly, revRule ) {
    const objectToPaste = cdm.getObject( objectToClone.props.bl_revision.dbValue );
    const parentObjVmo = viewModelObjectSvc.createViewModelObject( epBvrObjectService.getProcessResourceOrStationParent( objectToClone ) );
    createAndRegisterReloadInput( parentObjVmo, objectToPaste, newObjectID );
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [ objectToPaste, parentObjVmo ];
    const newObjectId = addPasteInput( saveInputWriter, parentObjVmo, objectToPaste, newObjectID, revRule );
    saveInputWriter.addRelatedObjects( relatedObjects );
    if( targetAssembly ) {
        const newObj = {
            id: newObjectId
        };

        const targetAsm = {
            targetObjects: targetAssembly.uid
        };

        let relModelObject = {
            uid: targetAssembly.uid,
            type: targetAssembly.type
        };
        relatedObjects.push( relModelObject );

        saveInputWriter.associateWIToAssembly( newObj, targetAsm );
    }
    const policyId = policySvc.register( getPastePolicy() );

    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
        policyId && policySvc.unregister( policyId );
        epReloadService.unregisterReloadInput( 'epPaste' );
    } );
}

/**
 * generates Unique ids for reload service and sets then in ViewModel
 *
 * @param {Object} data ViewModel data
 * @param {Object} copiedObjects copied Objects
 */
function generateUniqueIDsAndSetInViewModel( copiedObjects ) {
    let newObjectIDs = [];
    copiedObjects.forEach( object => {
        newObjectIDs.push( mfeViewModelUtils.generateUniqueId( 'new_object_id' ) );
    } );
    return newObjectIDs;
}

/**
 * Pastes new objects as the child of selected object.
 *
 * @param {ViewModelObject} vmo - Parent ViewModelObject
 * @param {String} newObjectID - id of new object
 * @param {[ViewModelObject]} objectToPaste - objects to be pasted
 * @param {String} revRule - Revision rule of object to be pasted
 */
export function pasteAssignParts( vmo, newObjectID, objectToPaste, revRule ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];
    const validObjectsToPaste = objectToPaste.filter( element => element.modelType &&
        element.modelType.typeHierarchyArray && element.modelType.typeHierarchyArray.includes( 'Awb0Element' ) );
    relatedObjects.push( vmo );
    return occmgmtBackingObjectProviderSvc.getBackingObjects(validObjectsToPaste).then((bomLines) => {
        relatedObjects = [...relatedObjects, ...bomLines];
        addAssignedPasteInput(saveInputWriter, vmo, bomLines, newObjectID, revRule);
        saveInputWriter.addRelatedObjects(relatedObjects);
        return epSaveService.saveChanges(saveInputWriter, true, relatedObjects).then(function (serviceResponse) {
            return AwPromiseService.instance.resolve();
        });
    }, (err) => {  
       return AwPromiseService.instance.reject(err);
    });
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste into section
 */
function addAssignedPasteInput( saveInputWriter, connectedTo, assignedParts, newObjUid, revisionRule ) {
    const targetObject = {
        id: connectedTo.uid
    };
    const objToPaste = {
        Add: assignedParts.map(item=>item.uid),
        useDefaultRelationType: 'true',
        AssignmentMode: 'Reference'
    };
    saveInputWriter.addAssignedParts( targetObject, objToPaste );
}

/**
 * This methood handles save response
 * @param {objet} serviceResponse response
 * @param {string} policyId policyId
 * @param {string} pasteType type
 * @param {object} objectToPaste objects
 * @param {string} newObjectID object id
 * @param {object} vmo vmo
 */
function handleSaveResponse( serviceResponse, policyId, pasteType, objectToPaste, newObjectID, vmo ) {
    policyId && policySvc.unregister( policyId );
    const resource = localeService.getLoadedText( app.getBaseUrlPath() + '/i18n/clonePasteObjectMessages' );
    const createdObject = getCreatedObjectFromResponse( newObjectID, serviceResponse );
    if( createdObject ) {
        if( pasteType === 'pasteBefore' ) {
            messagingSvc.showInfo( getPastedBeforeSucessLocalizedMessage( resource, objectToPaste, createdObject, vmo ) );
        } else if( pasteType === 'pasteAfter' ) {
            messagingSvc.showInfo( getPastedAfterSucessLocalizedMessage( resource, objectToPaste, createdObject, vmo ) );
        } else if( pasteType === 'pasteInto' ) {
            messagingSvc.showInfo( getPastedIntoLocalizedMessage( resource, objectToPaste, createdObject, vmo ) );
        }
    }
    epReloadService.unregisterReloadInput( 'epPaste' );
    calculateChangeImpactAfterCloneCopyPaste();
}

/**
 * This method calculates the change impact dynamically on Parts/Operations/PVs after an impacted operation is cloned or copy pasted.
 */
function calculateChangeImpactAfterCloneCopyPaste(){
    /* Adding below block of code for dynamically showing impact indications on Operations and Parts for Clone, Cut-Copy Paste-Into, Paste Before/After operations. */
    if( appCtxService.getCtx( 'epAssignmentIndication' ) && appCtxService.getCtx( 'epAssignmentIndication' ).isIndicationToggleOn === true && appCtxService.getCtx( 'state' ).params.tracking_cn ) {
        return epChangeIndicationService.loadChangeIndication().then( () => {
            const processContextUid = appCtxService.getCtx( 'epTaskPageContext.processStructure' ).uid;
            const isChangeImpactedPVIndication = epObjectPropertyCacheService.getProperty( processContextUid, 'ChangeImpactedPVIndication' );
            if( isChangeImpactedPVIndication ){
                return epChangeIndicationService.loadProductViewChangeIndication().then( () => {
                    eventBus.publish( 'ep.publishAssignmentIndicationChange' );
                    return AwPromiseService.instance.resolve();
                } );
            }
            eventBus.publish( 'ep.publishAssignmentIndicationChange' );
            return AwPromiseService.instance.resolve();
        } );
    }
}

/**
 * Pastes new Inspection Definition objects as the children of selected object.
 *
 * @param {ViewModelObject} vmo - Parent ViewModelObject
 * @param {String} newObjectID - id of new object
 * @param {[ViewModelObject]} objectToPaste - objects to be pasted
 * @param {String} revRule - Revision rule of object to be pasted
 */
export function pasteAssignInspectionParts( vmo, newObjectID, objectToPaste, revRule ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [], inspectionObjectUids=[],vmoIds = [];

     objectToPaste.forEach( element => {
        const inspectionObject = cdm.getObject( element.props.awb0UnderlyingObject.dbValues[ 0 ] );
        relatedObjects.push(inspectionObject);
        inspectionObjectUids.push(inspectionObject.uid);
    } );


    if (Array.isArray(vmo)) {
        vmo.forEach(item=>{
            relatedObjects.push(item);
            vmoIds.push(item.uid);
        });
    }else{

        relatedObjects.push( vmo );
        vmoIds.push(vmo.uid);
    }

    addAssignedPasteInspectionInput(  saveInputWriter,vmoIds, inspectionObjectUids );
    saveInputWriter.addRelatedObjects( relatedObjects );

    const policyId = policySvc.register( getPastePolicy() );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function(response) {
        policyId && policySvc.unregister( policyId );
    } );
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste section
 */
function addAssignedPasteInspectionInput( saveInputWriter, connectedTo, assignedParts ) {
    const targetObject = {
        id: connectedTo
    };
    const objToPaste = {
        Add: assignedParts
    };
    saveInputWriter.addAssignedParts( targetObject, objToPaste );
}

export default {
    pasteInto,
    pasteBefore,
    pasteAfter,
    pasteBeforeAfter,
    cloneObject,
    createAndRegisterReloadInputForPasteInto,
    createAndRegisterReloadInputForPasteBeforeAfter,
    cloneAndAssociateProcessConfirmation,
    pasteAssignParts,
    addPasteInput,
    addMoveObjectInput,
    pasteAssignInspectionParts,
    registerForReloadSectionForClone,
    addRegenarateFindNumberInput,
    addSuccessor,
    addPredecessor
};
