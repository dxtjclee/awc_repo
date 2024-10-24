// Copyright (c) 2022 Siemens

/**
 * @module js/Apm0ApqpProgramMgtService
 */

import cdm from 'soa/kernel/clientDataModel';
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import selectionService from 'js/selection.service';
import ClipboardService from 'js/clipboardService';
import messagingService from 'js/messagingService';
import soa_dataManagementService from 'soa/dataManagementService';
import dateTimeSvc from 'js/dateTimeService';

import _ from 'lodash';

var exports = {};

var EDIT_HANDLER_CONTEXT_CONSTANT = 'NONE';

/**
 * Static XRT commands that should be active when the view model is visible.
 *
 */
var _staticXrtCommandIds = [ 'Awp0StartEdit', 'Awp0StartEditGroup', 'Awp0SaveEdits',
    'Awp0CancelEdits'
];

export let getResetAssessmentRYGObject = function( ctx ) {
    let inputData = [];
    let rygObject = cdm.getObject( ctx.mselected[ 0 ].uid );
    inputData.push( rygObject );
    return [ {
        rygObject: inputData
    } ];
};

export let getCountOfOverrideRollUpRYGObject = function( response ) {
    let count = 0;
    if(response.plain)
    {
        count = response.plain.length;
    }
    return count;
};

/**
  * This function will return the createInput information for creation of selected Type of object
  * @param {data} - data from view model to check the sub panel data
  */
export let getCreateInputDataForRYG = function( data, editHandler ) {
    if( !data.objCreateInfo ) {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( data.selectedType, editHandler );
    }

    var strProps = {};
    if( data.objCreateInfo && data.objCreateInfo.props ) {
        data.objCreateInfo.props.forEach( ( vmProp ) => {
            strProps[ vmProp.propertyName ] = vmProp.dbValue;
        } );
    }

    var inputData = {
        boName: 'Apm0RYG',
        stringProps: strProps
    };

    let input = [];

    input.push( {
        clientId: '',
        data: inputData
    } );
    return input;
};

export let cutChecklistQuestionOperation = function() {
    var selection = selectionService.getSelection().selected;
    var input =  appCtxService.getCtx( 'pselected' );
    var checklistName = input.props.object_string.dbValues[ 0 ];

    var tasksToBeCut = [];

    if( selection !== null && selection.length > 0 ) {
        for( var index = 0; index < selection.length; index++ ) {
            var objectToBeCut = cdm.getObject( selection[ index ].uid );
            tasksToBeCut.push( objectToBeCut );
        }
        selectionService.updateSelection( tasksToBeCut, input );
        ClipboardService.instance.setContents( tasksToBeCut );
    }
    return checklistName;
};

/**
 * prepare the input for set properties SOA call to add the responsible User
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 * @param {ctx} contextObject - Context Object
 */

export let pasteChecklistQuestion = function( ctx, data ) {
    var deferred = AwPromiseService.instance.defer();

    var inputData = [];

    var parentChecklist = ctx.pselected.uid;

    var arrayHie = _.get( ctx, 'selected.modelType.typeHierarchyArray' );

    if( arrayHie !== null || arrayHie !== undefined ) {
        var isChecklistQuestion = arrayHie.indexOf( 'Psi0ChecklistQuestion' );

        if( isChecklistQuestion > -1 && ctx.awClipBoardProvider[ 0 ].props.psi0ParentChecklist.dbValues[ 0 ] === ctx.selected.props.psi0ParentChecklist.dbValues[ 0 ] ) {
            soa_dataManagementService.getProperties( [ parentChecklist ], [ 'psi0ChecklistQuestions' ] ).then( function() {
                var infoObj = {};

                infoObj.object = cdm.getObject( parentChecklist );

                infoObj.timestamp = '';

                var temp = {};

                var tempQuestions = [];

                var QuestionArray = ctx.pselected.props.psi0ChecklistQuestions.dbValues;

                var tempClipBoardArray = [];

                for( var clipIndex = 0; clipIndex < ctx.awClipBoardProvider.length; clipIndex++ ) {
                    tempClipBoardArray.push( ctx.awClipBoardProvider[clipIndex].uid );
                }

                for( var index = 0; index < QuestionArray.length; index++ ) {
                    if( QuestionArray[ index ] === ctx.selected.uid ) {
                        for( var clipobardIndex = 0; clipobardIndex < ctx.awClipBoardProvider.length; clipobardIndex++ ) {
                            checkIfQuestionExistOrAddInArray( ctx.awClipBoardProvider[ clipobardIndex ].uid, tempQuestions );
                        }
                        checkIfQuestionExistOrAddInArray( ctx.pselected.props.psi0ChecklistQuestions.dbValues[ index ], tempQuestions );
                    } else if(  ctx.awClipBoardProvider.length === 1 && QuestionArray[ index ] !== ctx.awClipBoardProvider[ '0' ].uid  ||
                    ctx.awClipBoardProvider.length > 1 && tempClipBoardArray.indexOf( QuestionArray[ index ] ) === -1 ) {
                        checkIfQuestionExistOrAddInArray( ctx.pselected.props.psi0ChecklistQuestions.dbValues[ index ], tempQuestions );
                    }
                }
                temp.name = 'psi0ChecklistQuestions';

                temp.values = tempQuestions;

                var vecNameVal = [];
                vecNameVal.push( temp );

                infoObj.vecNameVal = vecNameVal;
                inputData.push( infoObj );

                deferred.resolve( inputData );
            } );
        } else if( isChecklistQuestion > -1 && ctx.awClipBoardProvider[ 0 ].props.psi0ParentChecklist.dbValues[ 0 ] !== ctx.selected.props.psi0ParentChecklist.dbValues[ 0 ] ) {
            messagingService.showError( data.i18n.moveChecklistQuestion );
            deferred.resolve();
        }
    }
    return deferred.promise;
};

/**
 * Check if Current Question Exist in Array if not then Add
 *
 * @param { CurrentQuestion, QuestionArray} data
 */
 function checkIfQuestionExistOrAddInArray( question, updatedArray ) {
    var index = updatedArray.indexOf( question );
    if( index === -1 ) {
        updatedArray.push( question );
    }
}

/**
  * This function will return the createInput information for creation of selected Type of object
  * @param {data} - data from view model to check the sub panel data
  */
 export let getCreateInputDataForQualityChecklist = function( data, editHandler, ctx ) {

    var doubleObj = {};
    var boolObj = {};
    var strObj = {};
    var dateObj = {};
    var objArrObj = {};
    var inputData = [];

    if( !data.objCreateInfo ) {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( data.selectedType, editHandler );
    }

    if( data.objCreateInfo && data.objCreateInfo.props ) {
        data.objCreateInfo.props.forEach( ( vmProp ) => {
            if( vmProp.type === 'DOUBLE' && vmProp.dbValue !== null ) {
                doubleObj[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'BOOLEAN' && vmProp.dbValue !== null ) {
                boolObj[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'STRING' && vmProp.dbValue !== null ) {
                strObj[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'DATE' && vmProp.dbValue !== null ) {
                dateObj[ vmProp.propertyName ] = dateTimeSvc.formatUTC( vmProp.dbValue );
            }
        } );
    }


    var dataVal = {
        boName: 'Apm0QualityChecklist',
        doubleProps: doubleObj,
        boolProps: boolObj,
        stringProps: strObj,
        dateProps: dateObj,
        tagProps:{
            apm0ParentChecklist : ctx.selected
        },
        tagArrayProps: objArrObj
    };

    var input = {
        clientId: 'createObjects',
        data: dataVal
    };

    inputData.push( input );
    return inputData;
};

/**
 * The method gets the view model for current Prevention and Detection control and optimization actions for selected failure cause
 * @param {data} data to get selectedObject from dataProvider
 * @param {subPanelContext} subPanelContext set selectedQualityActions in subPanelContext
 */
 export let updateAddNewlyAddedObjectToSubPanelContext = function( newlyCreatedObject, subPanelContext ) {
    let state = { ...subPanelContext.pageContext.sublocationState.value };
    state.newlyCreatedElement = [];
    state.isNewlyCreatedToBeSelected = false;
    state.newlyCreatedElement = newlyCreatedObject;
    subPanelContext.pageContext.sublocationState.update( { ...state } );
};

/**
  * This function will create the SOA input for deleteRelations for removing objects from Plan.
  * @param {Object} planObject Plan object, that contains plan vendor relation
  * @param {String} relation name of the plan vendor relation
  * @param {Array} selectedObject selected object to be removed
  * @return {Array} Returns inputData for deleteRelations service
  */
export let createRemoveRelationWithPlanInput = function( planObject, relation, selectedObject ) {
    var inputData = {};
    var soaInput = [];
    if ( planObject && selectedObject && selectedObject.length > 0 ) {
        selectedObject.forEach( function( selectedObj ) {
            inputData = {
                clientId: 'AWClient',
                primaryObject: planObject,
                relationType: relation,
                secondaryObject: selectedObj,
                userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
            };
            soaInput.push( inputData );
        } );
    }
    return soaInput;
};

export default exports = {
    getResetAssessmentRYGObject,
    getCountOfOverrideRollUpRYGObject,
    getCreateInputDataForRYG,
    pasteChecklistQuestion,
    cutChecklistQuestionOperation,
    getCreateInputDataForQualityChecklist,
    updateAddNewlyAddedObjectToSubPanelContext,
    createRemoveRelationWithPlanInput
};
