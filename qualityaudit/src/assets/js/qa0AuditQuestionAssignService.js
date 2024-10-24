// Copyright (c) 2022 Siemens

/**
 * @module js/qa0AuditQuestionAssignService
 */
import cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';

var exports = {};

export let createAuditQuestionFindingRelation = function( selectedQuestionList, selectedFindingList ) {
    var inputData = {};
    var primaryObject = {};
    var secondaryObject = {};
    var soaInput = [];

    if( selectedQuestionList && selectedQuestionList.length > 0 && selectedFindingList && selectedFindingList.length > 0 ) {
        selectedFindingList.forEach( function( selFinding ) {
            selectedQuestionList.forEach( function( selQuestion ) {
                primaryObject = { uid: selFinding.uid, type: selFinding.type };
                secondaryObject = { uid: selQuestion.uid, type: selQuestion.type };
                inputData = {
                    clientId: 'AWClient',
                    primaryObject: primaryObject,
                    relationType: 'CMReferences',
                    secondaryObject: secondaryObject,
                    userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
                };
                soaInput.push( inputData );
            } );
        } );
    }
    return soaInput;
};

export let assignAuditQuestion = function( selectedQuestionList, selectedFindingList ) {
    var soaRemoveInput = [];
    var soaCreateInput = [];

    if( selectedQuestionList && selectedQuestionList.length > 0 && selectedFindingList && selectedFindingList.length > 0 ) {
        selectedFindingList.forEach( function( selFinding ) {
            if( selFinding.props.CMReferences.dbValues.length > 1 ) {
                selFinding.props.CMReferences.dbValues.forEach( function( assignedObjectUID ) {
                    // get assigned objects and check if it's a question
                    var assignedObject = cdm.getObject( assignedObjectUID );

                    if( assignedObject.type === 'Apm0QualityChecklist' ) {
                        // store question for removal
                        soaRemoveInput.push( {
                            clientId: 'AWClient',
                            primaryObject: { uid: selFinding.uid, type: selFinding.type },
                            relationType: 'CMReferences',
                            secondaryObject: { uid: assignedObject.uid, type: assignedObject.type },
                            userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
                        } );
                    }
                } );
            }

            // add question for assigning
            selectedQuestionList.forEach( function( selQuestion ) {
                soaCreateInput.push( {
                    clientId: 'AWClient',
                    primaryObject: { uid: selFinding.uid, type: selFinding.type },
                    relationType: 'CMReferences',
                    secondaryObject: { uid: selQuestion.uid, type: selQuestion.type },
                    userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
                } );
            } );
        } );
    }

    if( soaRemoveInput.length > 0 ) {
        return soaService.post( 'Core-2006-03-DataManagement', 'deleteRelations', { input: soaRemoveInput } ).then( function( response ) {
            return soaService.post( 'Core-2006-03-DataManagement', 'createRelations', { input: soaCreateInput } ).then( function( response ) {
                return response;
            } );
        } );
    } else if( soaCreateInput.length > 0 ) {
        return soaService.post( 'Core-2006-03-DataManagement', 'createRelations', { input: soaCreateInput } ).then( function( response ) {
            return response;
        } );
    }
};

/**
 * This makes sure, edited object is selected
 * @param {ArrayList} selectionModel selection model of pwa
 */
export let refreshSelection = function( selectionModel ) {
    selectionModel.mselected = [];
};

/**
 * This factory creates a service and returns exports
 *
 * @member qa0AuditQuestionAssignService
 */

export default exports = {
    assignAuditQuestion,
    refreshSelection,
    createAuditQuestionFindingRelation
};
