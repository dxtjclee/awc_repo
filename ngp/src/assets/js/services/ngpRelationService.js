// Copyright (c) 2022 Siemens

import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpCloneStatusCache from 'js/services/ngpCloneStatusCache';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import ngpLoadService from 'js/services/ngpLoadService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import localeService from 'js/localeService';
import _ from 'lodash';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import ngpStorageService from 'js/services/ngpStorageService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpStorageConstants from 'js/constants/ngpStorageConstants';
import msgSvc from 'js/messagingService';
import ngpDataUtil from 'js/utils/ngpDataUtils';
import ngpChangeMgmtValidationSvc from 'js/services/ngpChangeManagementValidationService';

/**
 * The ngp relation service
 *
 * @module js/services/ngpRelationService
 */
const dataMgmtMsgs = localeService.getLoadedText( 'NgpDataMgmtMessages' );

//manufacturing model uid to cd
const modelUidToCDModelObject = {};

/**
 *
 * @param {modelObject[]} modelObjects - the modelObjects
 * @param {string[]} relationTypeNames - the relation type names
 * @return {promise<Object>} a promise object
 */
export function getSecondaryRelation( modelObjects, relationTypeNames ) {
    const info = relationTypeNames.map( ( relationTypeName ) => ( {
        relationTypeName,
        otherSideObjectTypes: null
    } ) );
    const soaInput = {
        primaryObjects: modelObjects,
        pref: {
            expItemRev: false,
            returnRelations: true,
            info
        }
    };
    return ngpSoaSvc.executeSoa( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', soaInput ).then(
        ( response ) => {
            const uidToRelationshipData = {};
            if ( response ) {
                response.output.forEach( ( { inputObject, relationshipData } ) => uidToRelationshipData[inputObject.uid] = relationshipData );
            }
            return uidToRelationshipData;
        }
    );
}


/**
 *
 * @param {modelObject[]} modelObjects - a given modelObjects
 * @param {string[]} relationTypeNames - the relation type names
 * @return {promise<Object>} a promise object
 */
export function getSecondaryObjects( modelObjects, relationTypeNames ) {
    return getSecondaryRelation( modelObjects, relationTypeNames ).then( ( uidToRelationshipData ) => {
        const uidToRelationshipObject = {};

        modelObjects.forEach( ( modelObject ) => uidToRelationshipObject[modelObject.uid] =
            extractObjectsFromRelation( uidToRelationshipData[modelObject.uid] ) );

        return uidToRelationshipObject;
    } );
}
/**
 * @param {object} relationshipData - map of relationship per model object
 * @return {ModelObject[]} - relation model object
 */
function extractObjectsFromRelation( relationshipData ) {
    return relationshipData.map( ( relationshipDataForRelName ) =>
        relationshipDataForRelName.relationshipObjects.map( ( relObject ) => relObject.otherSideObject ) );
}
/**
 *
 * @param {modelObject} manufacturingModelObj - the given manufacturing model object
 * @return {promise<string>} a promise object
 */
export function getProductEffectivityValue( manufacturingModelObj ) {
    return getSecondaryRelation( [ manufacturingModelObj ], [ ngpPropConstants.PRODUCT_MODEL ] ).then(
        ( uidToRelationshipData ) => {
            let productEffectivity = '';
            const relationshipData = uidToRelationshipData[manufacturingModelObj.uid];
            if ( relationshipData ) {
                const relationData = _.find( relationshipData, ( data ) => data.relationName === ngpPropConstants.PRODUCT_MODEL );
                if ( relationData && Array.isArray( relationData.relationshipObjects ) && relationData.relationshipObjects.length > 0 ) {
                    const relation = relationData.relationshipObjects[0].relation;
                    if ( relation ) {
                        const productEffectivityValue = relation.props[ngpPropConstants.PRODUCT_EFFECTIVITY_FORMULA].uiValues[0];
                        const value = productEffectivityValue.split( '=' ).pop();
                        if ( value ) {
                            productEffectivity = value;
                        }
                    }
                }
            }
            return productEffectivity;
        }
    );
}

/**
 * @param {modelObject} modelObject - a given modelObject
 * @return {Promise<ModelObject[]>} a promise object
 */
export function getBreadcrumbs( modelObject ) {
    if ( modelObject ) {
        const soaInput = {
            objects: [ {
                clientID: 'tc-mfg-web',
                object: modelObject
            } ]
        };
        return ngpSoaSvc.executeSoa( 'Internal-ManufacturingCore-2017-05-RelationManagement', 'getBreadcrumbs', soaInput ).then(
            ( response ) => {
                if ( response && response.objectBreadcrumbs ) {
                    return response.objectBreadcrumbs[0].breadcrumbs || [];
                }
                return [];
            }
        );
    }
    console.warn( 'Tried to get breadcrumbs with null modelObject' );
    return new Promise( ( resolve ) => {
        resolve( [] );
    } );
}

/**
 *
 * @param {Object} soaInput - an input object
 * @return {promise} a promise object
 */
export function createRelateAndSubmitObjects( soaInput ) {
    return ngpSoaSvc.executeSoa( 'Internal-Core-2012-10-DataManagement', 'createRelateAndSubmitObjects', { inputs: soaInput } );
}

/**
 *
 * @param {Object} primaryObject - primaryObject
 * @param {Object} secondaryObject - secondaryObject
 * @param {String} relationType - relationType
 * @param {String} clientId - clientId
 * @return {promise} a promise object
 */
export function createRelations( primaryObject, secondaryObject, relationType, clientId ) {
    const input = {
        primaryObject,
        secondaryObject,
        relationType,
        clientId
    };
    const soaInput = [ input ];
    //soaInput.push( input );
    return ngpSoaSvc.executeSoa( 'Core-2006-03-DataManagement', 'createRelations', { input: soaInput } );
}

/**
 *
 * @param {modelObject[]} modelObjects - an array of modelObject that we need a status on
 * @param {string} option - option to provide which status you want on the object. Can be ['All', 'AssignmnetStatus', 'CloneStatus']
 * @return {promise} a promise object
 */
export function getStatusInformation( modelObjects = [], option = 'All' ) {
    if ( Array.isArray( modelObjects ) && modelObjects.length > 0 ) {
        const soaInput = {
            input: modelObjects,
            option
        };
        return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Compare', 'getStatusInformation', soaInput ).then(
            ( response ) => {
                const cloneStatuses = {};
                const assignmentStatuses = {};
                response.objectsStatusData.forEach( ( statusData ) => {
                    const context = statusData.assignedToObjects[0];
                    assignmentStatuses[context.uid] = statusData.assignmentStatuses || [];
                    cloneStatuses[context.uid] = statusData.cloneStatus || [];
                } );
                Object.keys( cloneStatuses ).forEach( ( key ) => {
                    const cloneObj = cloneStatuses[key];
                    if ( cloneObj.status === ngpCloneStatusCache.cloneStatusConstants.NO_STATUS ) {
                        cloneObj.masterInfo = null;
                        cloneObj.clonesInfo = [];
                    }
                    if ( cloneObj.masterInfo && cloneObj.masterInfo.originalMaster.uid === cdm.NULL_UID ) {
                        cloneObj.masterInfo.originalMaster = null;
                    }
                    if ( cloneObj.masterInfo && cloneObj.masterInfo.configuredMaster.uid === cdm.NULL_UID ) {
                        cloneObj.masterInfo.configuredMaster = null;
                    }
                    if ( ( cloneObj.status === ngpCloneStatusCache.cloneStatusConstants.CLONE || cloneObj.status === ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE )
                        && cloneObj.masterInfo.hasMasterProgressed ) {
                        cloneObj.status = cloneObj.status.concat( '_OUT_OF_DATE' );
                    }
                } );

                ngpCloneStatusCache.updateCache( cloneStatuses );
                return {
                    cloneStatuses,
                    assignmentStatuses
                };
            }
        );
    }
    return new Promise( ( resolve ) => resolve( { cloneStatuses: [], assignmentStatuses: [] } ) );
}

/**
 *
 * @param {String} uid - a given modelObject
 * @param {boolean} returnAsVMOs - true if you want the returned array as viewModelObjects
 * @return {Promise} a promise object
 */
export function getContentElements( uid, returnAsVMOs ) {
    if ( uid ) {
        const modelObject = cdm.getObject( uid );
        if ( modelObject ) {
            let childrenPropArray = ngpModelUtils.getChildrenProperties( modelObject );
            if ( childrenPropArray ) {
                return ngpLoadService.getPropertiesAndLoad( [ modelObject.uid ], childrenPropArray ).then(
                    () => {
                        let children = [];
                        childrenPropArray.forEach( ( childProp ) => {
                            const childObjects = modelObject.props[childProp].dbValues.map( ( childUid ) => {
                                const modelObj = cdm.getObject( childUid );
                                return returnAsVMOs ? viewModelObjectSvc.createViewModelObject( modelObj ) : modelObj;
                            } );
                            children = children.concat( childObjects );
                        } );
                        return children;
                    }
                );
            }
        }
    }
    return new Promise( ( resolve ) => {
        resolve( [] );
    } );
}

/**
 * This method deletes the selected objects
 *
 * @param {modelObject[]} objects - a given array of modelObjects
 * @param {object[]} errorsToIgnore - a given array of error objects to ignore when executing removeObjects
 * @return {promise} the soa promise
 */
export function removeObjects( objects, errorsToIgnore = [] ) {
    const options = {
        errorsToIgnore
    };
    return ngpSoaSvc.executeSoa( 'Internal-ManufacturingCore-2018-06-DataManagement', 'removeObjects', { objects }, options ).then(
        ( response ) => {
            if ( Array.isArray( response.deleted ) && response.deleted.length > 0 ) {
                eventBus.publish( 'ngp.removedObjects', {
                    removedUids: response.deleted,
                    updatedUids: response.updated
                } );
            }
            return response.deleted;
        }
    );
}

/**
 * This method deletes the selected objects
 *
 * @param {modelObject[]} objectsToRemove - The objects to remove
 * @return {Promise} a promise object
 */
export function removeObjectsWithConfirmation( objectsToRemove ) {
    const deferred = AwPromiseService.instance.defer();
    let deleteConfirmationObject = null;

    ngpChangeMgmtValidationSvc.validateUserCanPerformChange( objectsToRemove ).then(
        ( canPerformChange )=>{
            if( canPerformChange ) {
                if ( objectsToRemove && objectsToRemove.length === 1 ) {
                    const objectToDeleteDisplayName = Array.isArray( objectsToRemove[0].props[ngpPropConstants.OBJECT_STRING].uiValues ) ?
                        objectsToRemove[0].props[ngpPropConstants.OBJECT_STRING].uiValues[0] : objectsToRemove[0].props.object_string.uiValue;
                    deleteConfirmationObject = getConfirmationMessage( objectsToRemove, objectToDeleteDisplayName );
                } else {
                    deleteConfirmationObject = getConfirmationMessage( objectsToRemove );
                }
                mfgNotificationUtils.displayConfirmationMessage( deleteConfirmationObject.message, deleteConfirmationObject.button, dataMgmtMsgs.cancel )
                    .then(
                        () => removeObjects( objectsToRemove )
                    )
                    .then(
                        ( removedUids ) => deferred.resolve( removedUids ),
                        () => deferred.resolve( {} )
                    );
            }
        } );

    return deferred.promise;
}

/**
 * This method checks for Master object and composes the
 *
 * @param {modelObject[]} objectsToRemove - The objects to remove
 * @param {String} displayName - display name for the message
 * @return {String} a confirmation message
 */
function getConfirmationMessage( objectsToRemove, displayName = '' ) {
    let confirmationMessage = null;
    if( objectsToRemove.length > 0 ) {
        if( objectsToRemove.length === 1 ) {
            return messageForOneObject( objectsToRemove[0], displayName );
        }
        return messageForMultipleObjects( objectsToRemove );
    }
    return {
        message: confirmationMessage,
        button: dataMgmtMsgs.deleteTooltipMsg
    };
}

/**
 * This method checks for Master object and composes the
 *
 * @param {modelObject} objectToRemove - The objects to remove
 * @param {String} displayName - display name for the message
 * @return {String} a confirmation message
 */
function messageForOneObject( objectToRemove, displayName ) {
    let confirmationMessage = null;
    if( ngpTypeUtils.isProcessElement( objectToRemove ) && ngpCloneStatusCache.isMaster( objectToRemove.uid )  ) {
        return {
            message: dataMgmtMsgs.singleCloneWithDeletedMasterNote.format( displayName ),
            button: dataMgmtMsgs.deleteMasterButton
        };
    }
    confirmationMessage = ngpTypeUtils.isNGPObject( objectToRemove ) ? dataMgmtMsgs.singleDeleteNGPObjectMessage.format( displayName ) :
        dataMgmtMsgs.singleDeleteGeneralMessage.format( displayName );
    return {
        message: confirmationMessage,
        button: dataMgmtMsgs.deleteTooltipMsg
    };
}

/**
 * This method checks for Master object and composes the
 *
 * @param {modelObject[]} objectsToRemove - The objects to remove
 * @return {String} a confirmation message
 */
function messageForMultipleObjects( objectsToRemove ) {
    let confirmationMessage = null;
    let m_masterProcessCount = 0;

    objectsToRemove.forEach( ( obj ) => {
        if( ngpTypeUtils.isProcessElement( obj ) && ngpCloneStatusCache.isMaster( obj.uid ) ) {
            m_masterProcessCount++;
        }
    } );
    if( m_masterProcessCount > 0 ) {
        if( m_masterProcessCount === objectsToRemove.length ) {
            return {
                message: dataMgmtMsgs.multipleCloneWithDeletedMasterNote.format( m_masterProcessCount ),
                button: dataMgmtMsgs.deleteMastersButton
            };
        }
        confirmationMessage = dataMgmtMsgs.multipleCloneWithSomeDeletedMasterMsg.format(
            m_masterProcessCount, objectsToRemove.length );
        m_masterProcessCount = 0;
        return {
            message: confirmationMessage,
            button: dataMgmtMsgs.deleteAllAnywayButton
        };
    }
    confirmationMessage = ngpTypeUtils.isNGPObject( objectsToRemove[0] ) ? dataMgmtMsgs.multipleDeleteNGPObjectMessage.format( objectsToRemove.length ) :
        dataMgmtMsgs.multipleDeleteGeneralMessage.format( objectsToRemove.length );

    return {
        message: confirmationMessage,
        button: dataMgmtMsgs.deleteTooltipMsg
    };
}

/**
 * Delete a relation between 2 objects
 *
 * @param {modelObject} secondaryObject - a given modelObject  (secondary object)
 * @param {modelObject} primaryObject - a given modelObject (primary object)
 * @param {String} relation - relation
 * @return {promise<Object>} a promise object
 */
export function removeRelation( secondaryObject, primaryObject, relation ) {
    let inputData = {
        input: [ {
            primaryObject,
            secondaryObject,
            relationType: relation,
            clientId: 'tc-mfg-web'
        } ]
    };
    return ngpSoaSvc.executeSoa( 'Core-2006-03-DataManagement', 'deleteRelations', inputData );
}

/**
 *
 * @param {modelObject[]} modelObjects - a given set of model objects
 * @return {Promise} a promise
 */
export function deleteObjects( modelObjects ) {
    if ( modelObjects && modelObjects.length > 0 ) {
        return ngpSoaSvc.executeSoa( 'Core-2006-03-DataManagement', 'deleteObjects', { objects: modelObjects } );
    }
}


/**
 * Save model object as predecessor candidate in local storage
 * @param {ModelObject[]} predecessorModelObjects - a given set of modelObjects to set as predecessors
 */
export function setAsPredecessor( predecessorModelObjects ) {
    const predecessorObjectsUid = predecessorModelObjects.map( ( predecessor ) => predecessor.uid );
    const parentPropertyName = ngpModelUtils.getParentPropertyName( predecessorModelObjects[0] );
    ngpStorageService.saveUidsAndPropNamesInStorage( ngpStorageConstants.CONSTRAINT_FLOW_PROCESS, predecessorObjectsUid, [ parentPropertyName ] );
    let msg;
    if ( predecessorModelObjects.length === 1 ) {
        msg = dataMgmtMsgs.setAsSinglePredecessor.format( predecessorModelObjects[0].displayName );
    } else {
        msg = dataMgmtMsgs.setAsMultiPredecessors.format( predecessorModelObjects.length );
    }
    msgSvc.showInfo( msg );
}

/**
 * Set the given set of modelObjects as successors
 * @param {ModelObject[]} successorModelObjects - a given set of modelObjects to set as successors
 */
export function setAsSuccessor( successorModelObjects ) {
    let predecessorObjects = ngpStorageService.getModelObjectsFromStorage( ngpStorageConstants.CONSTRAINT_FLOW_PROCESS );
    if ( predecessorObjects.length > 1 && successorModelObjects.length > 1 ) {
        msgSvc.showError( dataMgmtMsgs.setMultiplePredecessorsAndSuccessors );
        return;
    }
    const pairsInput = [];
    let foundOverlap = false;
    predecessorObjects.forEach( ( predecessor ) => {
        successorModelObjects.forEach( ( successor ) => {
            if ( successor.uid !== predecessor.uid ) {
                pairsInput.push( {
                    predecessor,
                    successor
                } );
            } else {
                foundOverlap = true;
            }
        } );
    } );

    if ( pairsInput.length > 0 ) {
        if ( foundOverlap ) {
            let overlappedMessage;
            if ( predecessorObjects.length > 1 ) {
                // multiple to 1
                overlappedMessage = dataMgmtMsgs.setOverlappedPredecessorsAndSuccessor;
            } else {
                // 1 to multiple
                overlappedMessage = dataMgmtMsgs.setOverlappedPredecessorAndSuccessors;
            }
            mfgNotificationUtils.displayConfirmationMessage( overlappedMessage, dataMgmtMsgs.continue, dataMgmtMsgs.cancel )
                .then( callAddPredecessorsSoa.bind( this, pairsInput ) );
        } else {
            callAddPredecessorsSoa( pairsInput );
        }
    } else {
        msgSvc.showError( dataMgmtMsgs.setOverlappedPredecessorAndSuccessor );
    }
}

/**
 * call soa addPredecessors
 * @param {Object[]} pairsInput - an array of object pairs of predecessor and successor
 */
function callAddPredecessorsSoa( pairsInput ) {
    const options = {
        aggregateErrors: true
    };
    ngpSoaSvc.executeSoa( 'Process-2017-05-RelationManagement', 'addPredecessors', { input: pairsInput }, options ).then(
        () => {
            const successorUids = {};
            pairsInput.forEach( ( { successor } ) => successorUids[successor.uid] = true );
            let msg;
            const successorUidsArray = Object.keys( successorUids );
            if ( successorUidsArray.length === 1 ) {
                const successor = cdm.getObject( successorUidsArray[0] );
                msg = dataMgmtMsgs.setAsSingleSuccessor.format( successor.props.object_string.uiValues[0] );
            } else {
                msg = dataMgmtMsgs.setAsMultiSuccessors.format( successorUidsArray.length );
            }
            msgSvc.showInfo( msg );
        }
    );
}

/**
 *
 * @param {object[]} predecessorAndSuccessorPairsArray - array of pair of objects, predecessor and successor
 * @param {modelObject} successor - the successor of the given predecessors
 * @returns {promise} a promise
 */
export function removePredecessors( predecessorAndSuccessorPairsArray ) {
    return ngpSoaSvc.executeSoa( 'Process-2017-05-RelationManagement', 'removePredecessors', { input: predecessorAndSuccessorPairsArray } );
}

/**
 *
 * @param {modelObject} modelObject - an object with a uid
 * @returns {promise<modelObject[]>} - a promise resolved to an array of modelObjects
 */
export function getProcessDependencies( modelObject ) {
    if( ngpTypeUtils.isProcessElement( modelObject ) ) {
        return ngpLoadService.getPropertiesAndLoad( [ modelObject.uid ], [ ngpPropConstants.CROSS_ACTIVITY_PREDECESSORS, ngpPropConstants.CROSS_ACTIVITY_SUCCESSORS ] ).then(
            () => {
                const modelObj = cdm.getObject( modelObject.uid );
                let dependencyUids = [ ...modelObj.props[ngpPropConstants.CROSS_ACTIVITY_PREDECESSORS].dbValues ];
                dependencyUids.push( ...modelObj.props[ngpPropConstants.CROSS_ACTIVITY_SUCCESSORS].dbValues );
                dependencyUids = dependencyUids.filter( ( val, index, arr ) => arr.indexOf( val ) === index );
                return dependencyUids.map( ( uid ) => cdm.getObject( uid ) );
            }
        );
    }
    return new Promise( ( res ) => res( [] ) );
}


/**
 *
 * @param {modelObject} modelObject - the given manufacturing model object
 * @return {Promise} - a promise object
 */
export function getCollaborationDesignObject( modelObject ) {
    const modelUid = ngpDataUtil.getMfgModelUid( modelObject );
    if ( modelUid ) {
        if ( Object.hasOwn( modelUidToCDModelObject, modelUid ) ) {
            return new Promise( ( resolve ) => resolve( modelUidToCDModelObject[modelUid] ) );
        }
        const manufacturingModelObj = cdm.getObject( modelUid );
        return getSecondaryRelation( [ manufacturingModelObj ], [ ngpPropConstants.PRODUCT_MODEL ] ).then(
            ( uidToRelationshipData ) => {
                const relationshipData = uidToRelationshipData[modelUid];
                let cdModelObj = null;
                if ( relationshipData ) {
                    const relationData = _.find( relationshipData, ( data ) => data.relationName === ngpPropConstants.PRODUCT_MODEL );
                    if ( relationData && relationData.relationshipObjects.length > 0 ) {
                        const otherSideObject = relationData.relationshipObjects[0].otherSideObject;
                        if ( otherSideObject ) {
                            cdModelObj = cdm.getObject( otherSideObject.uid );
                        }
                    }
                }
                modelUidToCDModelObject[modelUid] = cdModelObj;
                return cdModelObj;
            }
        );
    }
    return new Promise( ( resolve ) => resolve( null ) );
}

let exports;
export default exports = {
    createRelateAndSubmitObjects,
    getProductEffectivityValue,
    getSecondaryRelation,
    getSecondaryObjects,
    getBreadcrumbs,
    getStatusInformation,
    getContentElements,
    getCollaborationDesignObject,
    removeObjectsWithConfirmation,
    removeObjects,
    deleteObjects,
    removeRelation,
    createRelations,
    setAsPredecessor,
    setAsSuccessor,
    getProcessDependencies,
    removePredecessors
};
