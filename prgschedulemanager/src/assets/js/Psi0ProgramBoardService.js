// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import awKanbanUtils from 'js/AwKanbanUtils';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import iconService from 'js/iconService';
import ppConstants from 'js/ProgramPlanningConstants';
import PrgBoardKanbanCallbacks from 'js/PrgBoardKanbanCallbacks';
import psmConstants from 'js/ProgramScheduleManagerConstants';

export let getRelatedObjectsInput = function( setupPrgBoardState ) {
    let selectedObjs = setupPrgBoardState.selectedObjs;
    let getRelatedObjectsInput = [];
    if( selectedObjs.length > 0 ) {
        selectedObjs.forEach( function( programObject ) {
            let relationType = getValidRelationTypeForPrgBoard( setupPrgBoardState.context, programObject );
            if( relationType ) {
                let getRelatedObjects = {
                    contextObjectUID: programObject.uid,
                    relationType: relationType,
                    startIndex: 0,
                    maxToLoad: 50,
                    loadOptions: {
                        populateRelatedObjectUIDs: 'false'
                    }
                };
                getRelatedObjectsInput.push( getRelatedObjects );
            }
        } );
    }
    return getRelatedObjectsInput;
};

export let prepareProgramBoardColumns = function( setupPrgBoardState, atomicDataRef, kanbanId, selectionData ) {
    let kanbanColumns = [];

    let selectedObjs = setupPrgBoardState.selectedObjs;
    if( selectedObjs && selectedObjs.length > 0 ) {
        const context = setupPrgBoardState.context;
        const firstObjType = selectedObjs[ 0 ].modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ? 'Plan' : 'Event';
        selectedObjs.forEach( function( obj ) {
            if( context === 'Criteria' || context === 'Checklists' || context === 'Changes' ) {
                const supportedObjType = firstObjType === 'Event' ? 'Prg0AbsEvent' : 'Prg0AbsPlan';
                if( obj.modelType.typeHierarchyArray.indexOf( supportedObjType ) < 0 ) { //To check if all selected objects are of same type
                    return;
                }
            }
            let columnInfo = {
                name: obj.uid,
                displayName: obj.props.object_string.dbValues[ 0 ],
                isGroup: false,
                multiselect: true
            };
            kanbanColumns.push( columnInfo );
        } );
    }
    let kanbanColumnObject = awKanbanUtils.buildKanbanColumns( kanbanColumns );
    let kanbanState = atomicDataRef.kanbanState.getAtomicData();
    if( kanbanState.kanbanInitialized ) {
        closeProgramBoardPanel( setupPrgBoardState );
        openProgramBoardPanel( setupPrgBoardState );
    } else {
        let kanbanProps = { atomicDataRef, kanbanId, selectionData };
        let callbacks = new PrgBoardKanbanCallbacks( kanbanProps );
        return { kanbanColumnObject, callbacks };
    }
};

let getValidRelationTypeForPrgBoard = function( contextValue, pselected ) {
    if( pselected.modelType.typeHierarchyArray.indexOf( psmConstants.OBJECT_TYPE.PROGRAM ) > -1 ) {
        return psmConstants.VALID_RELATION_TYPE_FOR_PROGRAM_IN_PROGRAM_BOARD[ contextValue ];
    } else if( pselected.modelType.typeHierarchyArray.indexOf( psmConstants.OBJECT_TYPE.EVENT ) > -1 ) {
        return psmConstants.VALID_RELATION_TYPE_FOR_EVENT_IN_PROGRAM_BOARD[ contextValue ];
    }
};

export let parseRelatedObjSOAResponse = function( response, kanbanState, i18n ) {
    const responseRelatedObjs = response.relatedObjects;

    let relatedObjects = [];
    let programRelatedObjUIDMap = {};
    let actualUidToPrgBoardUidMap = {};

    if( responseRelatedObjs ) {
        responseRelatedObjs.forEach( function( programObject ) {
            let contextObject = programObject.contextObject;
            if( contextObject ) {
                let status = contextObject.uid;
                let loadedObjects = programObject.loadedObjects;
                if( loadedObjects ) {
                    loadedObjects.forEach( function( loadedObject ) {
                        let objectUID = loadedObject.uid;
                        let object = cdm.getObject( objectUID );
                        let id = objectUID.concat( '||',
                            status ); // use case: when duplicate object like same Risk is attached to two events is coming for two lanes , need to make id as unique.
                        let text = getObjectName( object );
                        let date = getDatePropertyValue( object );
                        let leftIconUid = object.uid; // Default to object uid.
                        let iconTooltip = null;
                        let responsibleUser = getResponsibleUser( object );
                        let rightIcon = null;
                        let showRightIcon = false;
                        let cssClass = 'aw-programPlanning-programBoardCard aw-aria-border';
                        // If there is a resposible user property, assign the value to the icon uid.
                        let objType = 'User';
                        if( responsibleUser.hasProperty === true ) {
                            if( !responsibleUser.value ) {
                                iconTooltip = i18n.unassigned;
                            }
                            var iconObject = cdm.getObject( responsibleUser.value );
                            if( iconObject ) {
                                objType = iconObject.type;
                                if( iconObject.modelType.typeHierarchyArray.indexOf( 'User' ) > -1 && iconObject.props.user_name ) {
                                    iconTooltip = iconObject.props.user_name.uiValues[ 0 ];
                                } else if( iconObject.props.object_name ) {
                                    iconTooltip = iconObject.props.object_name.uiValues[ 0 ];
                                }
                            }
                            showRightIcon = true;
                            rightIcon = iconService.getTypeIconURL( objType );
                        }
                        if( object ) {
                            let kanbanObject = {
                                id: id,
                                status: status,
                                text: '',
                                tags: [ text, date ],
                                tagValues: [ text, date ],
                                $css: cssClass,
                                leftIconUID: leftIconUid,
                                iconRightURL: rightIcon,
                                iconRightTooltip: iconTooltip,
                                showRightIcon: showRightIcon
                            };
                            relatedObjects.push( kanbanObject );
                            programRelatedObjUIDMap[ id ] =
                                objectUID; // prepare map of key as conext object and related object UID, and value is actual uid of related object, this will be used in drag/drop and in the other actions.
                            actualUidToPrgBoardUidMap[ objectUID ] = id;
                        }
                    } );
                }
            }
        } );
    }
    let atomicData = kanbanState.getAtomicData();
    atomicData.loadedObjects = relatedObjects;
    kanbanState.setAtomicData( { ...atomicData } );
    return actualUidToPrgBoardUidMap;
};

let getDatePropertyValue = function( object ) {
    let date = '';
    if( object.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) > -1 || object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 && object.props.psi0DueDate ) {
        date = object.props.psi0DueDate.uiValues[ 0 ];
    } else if( object.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 && object.props.finish_date ) {
        date = object.props.finish_date.uiValues[ 0 ];
    } else if( object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsRIO' ) > -1 && object.props.psi0TargetDate ) {
        date = object.props.psi0TargetDate.uiValues[ 0 ];
    }
    return date;
};

let getObjectName = function( object ) {
    if( object.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        return object.props.object_string.uiValues[ 0 ];
    }
    return object.props.object_name.uiValues[ 0 ];
};

let getResponsibleUser = function( object ) {
    let responsibleUser = {
        hasProperty: false,
        value: null
    };

    if( ( object.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) > -1 || object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsRIO' ) > -1 ) && object.props.psi0ResponsibleUsr ) {
        responsibleUser.hasProperty = true;
        responsibleUser.value = object.props.psi0ResponsibleUsr.dbValues[ 0 ];
    }

    if( object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 && object.props.psi0ResponsibleUser ) {
        responsibleUser.hasProperty = true;
        responsibleUser.value = object.props.psi0ResponsibleUser.dbValues[ 0 ];
    }

    if( object.modelType.typeHierarchyArray.indexOf( 'Prg0AbsCriteria' ) > -1 && object.props.fnd0ResponsibleUser ) {
        responsibleUser.hasProperty = true;
        responsibleUser.value = object.props.fnd0ResponsibleUser.dbValues[ 0 ];
    }

    return responsibleUser;
};

let updateOperationAtomicData = ( atomicDataRef, actionName, value ) => {
    const atomicData = atomicDataRef.getAtomicData();
    let atomicDataDestructured = { ...atomicData };
    atomicDataDestructured.operation = {
        action: actionName,
        value: value
    };
    atomicDataRef.setAtomicData( atomicDataDestructured );
};

export let updateRelatedBoardData = function( data ) {
    let updatedCards = [];
    let updatedObjects = data.eventData.updatedObjects;
    updatedObjects.forEach( function( object ) {
        if( object ) {
            let updatedUid = data.actualUidToPrgBoardUidMap[ object.uid ];
            if( updatedUid ) {
                let text = getObjectName( object );
                let date = getDatePropertyValue( object );
                let kanbanObject = {
                    id: updatedUid,
                    text: '',
                    tags: [ text, date ],
                    tagValues: [ text, date ]
                };
                updatedCards.push( kanbanObject );
            }
        }
    } );
    if( updatedCards.length > 0 ) {
        updateOperationAtomicData( data.atomicDataRef.kanbanState, 'updateCardProps', updatedCards );
    }
};

export const revertPrgBoardCardDragDrop = ( atomicDataRef, failedUids ) => {
    const atomicData = atomicDataRef.getAtomicData();
    let atomicDataDestructured = { ...atomicData };
    atomicDataDestructured.operation.value.dragContext.source = failedUids;
    updateOperationAtomicData( atomicDataRef, 'dragDropCardFailure', atomicDataDestructured.operation.value );
};

let getObjUidFromCardUid = ( cardUid ) => {
    const uidSplitArray = cardUid.split( '||' );
    return uidSplitArray[ 0 ];
};

/**
 * Prepares the inputs for createRelations.
 * @param {Object} kanbanState The kanban state for program board
 * @returns {array} The inputs for createRelations
 */
export let getCreateRelationsInput = function( kanbanState ) {
    let inputs = [];
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCard' ) {
        let dragDropContext = kanbanState.operation.value;
        let draggedObjectUidArray = dragDropContext.dragContext.source;
        let primaryObjUid = dragDropContext.dragContext.to.config.status;
        inputs = getCreteRelationsInputAfterDelete( primaryObjUid, draggedObjectUidArray, [] );
        return inputs;
    }
};

export let getCreteRelationsInputAfterDelete = ( primaryObjUid, draggedObjectUidArray, deleteFailedUids ) => {
    let inputs = [];
    if( deleteFailedUids && deleteFailedUids.length > 0 ) {
        draggedObjectUidArray = draggedObjectUidArray.filter( ( draggedUid ) => {
            return deleteFailedUids.indexOf( draggedUid ) === -1;
        } );
    }
    let primaryObject = cdm.getObject( primaryObjUid );

    if( primaryObject ) {
        draggedObjectUidArray.forEach( function( cardObjectUid ) {
            let actualObjectUid = getObjUidFromCardUid( cardObjectUid );
            if( actualObjectUid ) {
                let draggedObject = cdm.getObject( actualObjectUid );

                if( draggedObject ) {
                    let relationType = getValidRelationType( primaryObject, draggedObject );
                    let inputData = {
                        primaryObject: primaryObject,
                        secondaryObject: draggedObject,
                        relationType: relationType,
                        clientId: actualObjectUid,
                        userData: ''
                    };
                    inputs.push( inputData );
                }
            }
        } );
    }
    return inputs;
};

/**
 * Prepares the inputs for deleteRelations.
 * @param {Object} kanbanState The kanban state for program board
 * @returns {array} The inputs for deleteRelations
 */
export let getDeleteRelationsInput = function( kanbanState ) {
    let inputs = [];
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCard' ) {
        let dragDropContext = kanbanState.operation.value;
        let primaryObjUid = dragDropContext.dragContext.from.config.status;
        let draggedObjectUidArray = dragDropContext.dragContext.source;

        inputs = getDeleteRelationsInputAfterCreate( primaryObjUid, draggedObjectUidArray, [] );
    }
    return inputs;
};

export let getDeleteRelationsInputAfterCreate = ( primaryObjUid, uidsToDelete ) => {
    let inputs = [];
    let primaryObject = cdm.getObject( primaryObjUid );
    if( primaryObject ) {
        uidsToDelete.forEach( function( cardObjectUid ) {
            let actualObjectUid = getObjUidFromCardUid( cardObjectUid );
            if( actualObjectUid ) {
                let draggedObject = cdm.getObject( actualObjectUid );

                if( draggedObject ) {
                    let relationType = getValidRelationType( primaryObject, draggedObject );
                    let inputData = {
                        primaryObject: primaryObject,
                        secondaryObject: draggedObject,
                        relationType: relationType,
                        clientId: '',
                        userData: ''
                    };
                    inputs.push( inputData );
                }
            }
        } );
    }
    return inputs;
};
/**
 * Prepares the inputs for setProperties.
 * @param {Object} kanbanState The kanban state for program board
 * @returns {array} The inputs for setProperties
 */
export let setPropertiesInput = function( kanbanState ) {
    let inputs = [];
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCard' ) {
        let dragDropContext = kanbanState.operation.value;
        let targetObjectUid = dragDropContext.dragContext.to.config.status;
        let draggedObjectUidArray = dragDropContext.dragContext.source;
        draggedObjectUidArray.forEach( function( cardObjectUid ) {
            let actualObjectUid = getObjUidFromCardUid( cardObjectUid );
            if( actualObjectUid ) {
                let draggedObject = cdm.getObject( actualObjectUid );

                if( draggedObject ) {
                    let inputData = {
                        object: draggedObject,
                        vecNameVal: [ {
                            name: 'prg0EventObject',
                            values: [
                                targetObjectUid
                            ]
                        } ]
                    };
                    inputs.push( inputData );
                }
            }
        } );
    }
    return inputs;
};

let getValidRelationType = function( contextObject, selectedObject ) {
    if( contextObject.modelType.typeHierarchyArray.indexOf( ppConstants.OBJECT_TYPE.PROGRAM ) > -1 ) {
        if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGEREQUEST ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.CHANGEREQUEST;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGENOTICE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.CHANGEREQUEST;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.PRGDEL ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.PRGDEL;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.OPPORTUNITY ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.OPPORTUNITY;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.ISSUE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.ISSUE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.RISK ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.RISK;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.SCH ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.SCH;
        }
    } else if( contextObject.modelType.typeHierarchyArray.indexOf( ppConstants.OBJECT_TYPE.EVENT ) > -1 ) {
        if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGENOTICE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.CHANGENOTICE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGEREQUEST ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.CHANGENOTICE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.PRGDEL ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.PRGDEL;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.OPPORTUNITY ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.OPPORTUNITY;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.ISSUE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.ISSUE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.RISK ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.RISK;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.SCH ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.SCH;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHECKLIST ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.CHECKLIST;
        }
    }
};

/**
 *  Gets failed uids from SOA response of createRelations
 * @param {Object} response SOA response
 * @param {Map} actualUidToPrgBoardUidMap Map of actual uid of object to program board uid
 * @returns {array} The falied uids.
 */
export let getFailedUidsForSetProperties = function( response, actualUidToPrgBoardUidMap ) {
    var failedUids = [];
    var partialErrors = response.ServiceData.partialErrors;
    if( partialErrors && actualUidToPrgBoardUidMap ) {
        partialErrors.forEach( function( partialError ) {
            var failedUid = partialError.uid;
            if( failedUid ) {
                failedUids.push( actualUidToPrgBoardUidMap[ failedUid ] );
            }
        } );
    }
    return failedUids;
};

export let createAndDeleteRelationsResponse = ( response, actualUidToPrgBoardUidMap ) => {
    var failedUids = [];
    let successUids = [];
    var partialErrors = response.ServiceData.partialErrors;
    if( partialErrors && actualUidToPrgBoardUidMap ) {
        partialErrors.forEach( function( partialError ) {
            var failedUid = partialError.clientId;
            if( failedUid ) {
                failedUids.push( actualUidToPrgBoardUidMap[ failedUid ] );
            }
        } );
    }
    if( response.output && response.output.length > 0 ) {
        response.output.forEach( function( output ) {
            var successUid = output.clientId;
            if( successUid ) {
                successUids.push( actualUidToPrgBoardUidMap[ successUid ] );
            }
        } );
    }
    return { successUids, failedUids };
};

export let handleOperationsForPrgBoardKanban = ( kanbanState, setupPrgBoardState ) => {
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCard' ) {
        if( setupPrgBoardState.context === 'Checklists' ) {
            eventBus.publish( 'deleteAndCreateRelationsEvent' );
        } else if( setupPrgBoardState.context === 'Criteria' ) {
            eventBus.publish( 'dragDropForCriteriaEvent' );
        } else if( setupPrgBoardState.context !== 'Checklists' && setupPrgBoardState.context !== 'Criteria' ) {
            eventBus.publish( 'createAndDeleteRelationsEvent' );
        }
    }
};

export let closeProgramBoardPanel = ( setupPrgBoardState ) => {
    let prgBoardState = { ...setupPrgBoardState.getValue() };
    prgBoardState.isPrgBoardActive = false;
    setupPrgBoardState.update( prgBoardState );
};

let openProgramBoardPanel = ( setupPrgBoardState ) => {
    let prgBoardState = { ...setupPrgBoardState.getValue() };
    prgBoardState.isPrgBoardActive = true;
    setupPrgBoardState.update( prgBoardState );
};

export let splitterUpdateAction = ( atomicDataRef, setupPrgBoardState, eventData ) => {
    if( setupPrgBoardState.isPrgBoardActive && eventData.area2 && eventData.area2.classList ) {
        let classList = eventData.area2.classList;
        if( classList.contains( 'aw-programPlanning-programBoardWrapper' ) ) {
            let kanbanWidth = eventData.area2.clientWidth;
            let kanbanHeight = eventData.area2.clientHeight - 50;
            let resizeOptions = {
                height: kanbanHeight,
                width: kanbanWidth
            };
            updateOperationAtomicData( atomicDataRef, 'resizeKanban', resizeOptions );
        }
    }
};

let exports;
export default exports = {
    getRelatedObjectsInput,
    prepareProgramBoardColumns,
    parseRelatedObjSOAResponse,
    updateRelatedBoardData,
    setPropertiesInput,
    getDeleteRelationsInput,
    getDeleteRelationsInputAfterCreate,
    getCreateRelationsInput,
    getCreteRelationsInputAfterDelete,
    getFailedUidsForSetProperties,
    createAndDeleteRelationsResponse,
    revertPrgBoardCardDragDrop,
    handleOperationsForPrgBoardKanban,
    closeProgramBoardPanel,
    splitterUpdateAction
};
