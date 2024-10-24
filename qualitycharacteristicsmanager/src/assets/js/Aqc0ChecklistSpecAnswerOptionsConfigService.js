// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**

 * @module js/Aqc0ChecklistSpecAnswerOptionsConfigService
 */

import app from 'app';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import _localeSvc from 'js/localeService';
import dms from 'soa/dataManagementService';
import preferenceSvc from 'soa/preferenceService';
import cdm from 'soa/kernel/clientDataModel';
import awColumnSvc from 'js/awColumnService';
import checklistSpecSvc from 'js/Aqc0ChecklistSpecService';
import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';

import 'jquery';

var exports = {};


/**
  * @return {Array} Array of answer and values already exist in the object..
  */
function createChecklistAnswerConfigTableRowData( ratingObject, data ) {
    var tableRows = [];
    if ( ratingObject ) {
        var answerOptions = ratingObject.props.qc0AnswerOptions.dbValues;
        var answerValues = ratingObject.props.qc0AnswerOptionValues.dbValues;
        for ( var i = 0; i < answerOptions.length; i++ ) {
            var option = {};

            option.type = ratingObject.type + 'AnswerOptions';
            option.uid = i + 1;
            option.typeIconURL = '';
            var qc0AnswerOptions = {
                type: 'STRING',
                hasLov: false,
                isArray: false,
                displayValue: answerOptions[i],
                uiValue: answerOptions[i],
                value: answerOptions[i],
                propertyName: 'qc0AnswerOptions',
                propertyDisplayName: data.i18n.Aqc0ChecklistAnswerTableColumnName,
                isEnabled: true
            };
            var qc0AnswerOptionValues = {
                type: 'INTEGER',
                hasLov: false,
                isArray: false,
                displayValue: answerValues[i],
                uiValue: answerValues[i],
                value: answerValues[i],
                propertyName: 'qc0AnswerOptionValues',
                propertyDisplayName: data.i18n.Aqc0ChecklistAnswerValueTableColumnName,
                isEnabled: true
            };
            option.props = {
                qc0AnswerOptions: qc0AnswerOptions,
                qc0AnswerOptionValues: qc0AnswerOptionValues
            };
            tableRows.push( option );
        }
    }

    return tableRows;
}

/**
  * get existing answer options.
  * @param {Object} ctx current context
  * @param {DeclViewModel} data data of the current View model.
  * @param {boolean} createTableRowMetadata set true, if required Table Row object array in return else false.
  * @return {Array} Array of answers (type string) already exist in the object..
  */
function getExistingAnswers( ctx, data, createTableRowMetadata ) {
    var ratingObject;
    if( data.ratingObject ) {
        ratingObject = data.ratingObject;
    } else {
        var checklistSpecObject = ctx.selected;
        var ratingruleObjectUID = checklistSpecObject.props.qc0RatingRuleReference.dbValues[0];
        ratingObject = cdm.getObject( ratingruleObjectUID );
        data.ratingObject = ratingObject;
    }
    if( createTableRowMetadata ) {
        return createChecklistAnswerConfigTableRowData( ratingObject, data );
    }
    var answerValueArray = [];
    var answers = ratingObject.props.qc0AnswerOptions.dbValues;
    var answerValues = ratingObject.props.qc0AnswerOptionValues.dbValues;
    for( var i = 0; i < answers.length; i++ ) {
        answerValueArray.push( {
            answerText: answers[i],
            answerValue: answerValues[i]
        } );
    }
    return answerValueArray;
}

/**
  * Get the preference configured in RAC for default answers and load them in LOV
  *
  * @param {DeclViewModel} data - The qualified data of the viewModel
  */
export let loadDefaultAnswersInLOV = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var preferenceValue;
    var lovEntries = [];
    soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: [ 'AWC_Qc0RatingRuleDefaultAnswers' ],
        includePreferenceDescriptions: false
    } ).then( function( preferenceResult ) {
        if ( preferenceResult ) {
            preferenceValue = preferenceResult.response[0].values.values;
            handleLOVFunction( preferenceValue, data, deferred );
        }
    } );
    return deferred.promise;
};

var handleLOVFunction = function( preferenceValue, data, deferred ) {
    var answerOptionPropName = 'qc0AnswerOptions';
    var lovinput = data.ratingObject.props[answerOptionPropName].dbValues;

    var lovEntries = [];

    _.forEach( preferenceValue, optionString => {
        var entryExists = false;
        if ( optionString.includes( ':' ) ) {
            var answerTextToken = optionString.split( ':' );
            if ( lovinput.includes( answerTextToken[0] ) ) {
                entryExists = true;
            }
            if ( !entryExists ) {
                var answerValue = answerTextToken[1];
                if ( answerValue.trim() !== '' && !isNaN( answerValue ) ) {
                    var displayDescription = data.i18n.Aqc0ChecklistAnswerValueTableColumnName + ': ' + answerValue;

                    lovEntries.push( {
                        propDisplayValue: answerTextToken[0],
                        propInternalValue: answerTextToken[0],
                        propDisplayDescription: displayDescription,
                        hasChildren: false,
                        children: {}
                    } );
                }
            }
        }
    } );

    return deferred.resolve( {
        defaultAnswers: lovEntries,
        defaultAnswerPreferenceValue: preferenceValue
    } );
};

/**
  * get value of selected answer loaded from preference
  * @param {DeclViewModel} data data of the current View model.
  */
export let changeAnswerAction = function( data ) {
    let answerValueProp = {...data.answerValue};
    if ( data.defaultAnswerPreferenceValue ) {
        var preferenceValue = data.defaultAnswerPreferenceValue;

        var found = false;
        if ( data.answerText.dbValue !== '' ) {
            for ( var i = 0; i < preferenceValue.length; i++ ) {
                if ( preferenceValue[i].includes( data.answerText.dbValue ) ) {
                    var answerTextToken = preferenceValue[i].split( ':' );
                    var answerValue = Number( answerTextToken[1] );
                    answerValueProp.uiValue = answerValue;
                    answerValueProp.dbValue = answerValue;
                    found = true;
                    break;
                }
            }
        }
        if ( !found ) {
            answerValueProp.uiValue = '';
            answerValueProp.dbValue = 0;
        }
    } else {
        answerValueProp.uiValue = '';
        answerValueProp.dbValue = 0;
    }
    return answerValueProp;
};

/**
  * add answer and  returned info object with updated property value.
  * @param {Object} ctx current context
  * @param {DeclViewModel} data data of the current View model.
  */
export let addNewAnswerWithValueAndReturnInputData = function( ctx, data ) {
    var existingAnswerAndValues = getExistingAnswers( ctx, data, false );

    //add new answer in the array
    existingAnswerAndValues.push( {
        answerText: data.answerText.dbValue,
        answerValue: String( data.answerValue.dbValue )
    } );

    //create return input data
    var updatedQc0AnswerOptions = existingAnswerAndValues.map( e => e.answerText );
    var updatedQc0AnswerOptionValues = existingAnswerAndValues.map( e => e.answerValue );

    return [ {
        object: data.ratingObject,
        timestamp: '',
        vecNameVal: [
            {
                name: 'qc0AnswerOptions',
                values: updatedQc0AnswerOptions
            },
            {
                name: 'qc0AnswerOptionValues',
                values: updatedQc0AnswerOptionValues
            }
        ]
    } ];
};

/**
  * clean answer values from widget
  * @param {DeclViewModel} data data of the current view model.
  */
export let clearAndRefreshData = function( data, ctx ) {
    var deferred = AwPromiseService.instance.defer();
    data.answerText.dbValue = '';
    data.answerText.uiValue = '';
    data.answerValue.dbValue = 0;
    data.answerValue.uiValue = 0;

    //reload rating rule object and refresh LOV entries of answer option.
    checklistSpecSvc.loadRatingRuleObjectWithProps( ctx ).then( function( response ) {
        data.ratingObject = response.ratingObject;
        var preferenceValue = data.defaultAnswerPreferenceValue;
        handleLOVFunction( preferenceValue, data, deferred );
    } );

    return deferred.promise;
};

export let populateErrorString = function( response ) {
    return checklistSpecSvc.populateErrorString( response );
};

export let checkForDuplicateAnswer = function( ctx, data ) {
    var deferred = AwPromiseService.instance.defer();
    var existingAnswerAndValues = getExistingAnswers( ctx, data, false );
    var isDuplicate = false;
    for ( var i = 0; i < existingAnswerAndValues.length; i++ ) {
        //Removing white spaces and converting to lower case to compare
        if ( existingAnswerAndValues[i].answerText.replace( /\s/g, '' ).toLowerCase() === data.answerText.dbValue.replace( /\s/g, '' ).toLowerCase() ) {
            isDuplicate = true;
        }
    }
    deferred.resolve( {
        duplicateFlag : isDuplicate,
        answer : data.answerText.dbValue
    } );
    return deferred.promise;
};

/**
  * Delete selected answer options and returned array with remaining answer options.
  * @param {Object} ctx current context
  * @param {data} data - The qualified data of the viewModel
  */
export let deleteSelectedAnswerAndReturnInputData = function( ctx, commandContext, data ) {
    var selectedAnswers = commandContext.checklistAnswerConfigDataProvider.selectedObjects;

    var existingAnswerAndValues = getExistingAnswers( ctx, data, true );

    for ( var i = 0; i < selectedAnswers.length; i++ ) {
        var indexOfSelection = selectedAnswers[i].uid;
        var selectedAnswerText = selectedAnswers[i].props.qc0AnswerOptions.value;
        var selectedAnswerValue = selectedAnswers[i].props.qc0AnswerOptionValues.value;
        for ( var j = 0; j < existingAnswerAndValues.length; j++ ) {
            var existing = existingAnswerAndValues[j];
            if ( existing.uid === indexOfSelection && existing.props.qc0AnswerOptions.value === selectedAnswerText && existing.props.qc0AnswerOptionValues.value === selectedAnswerValue ) {
                existingAnswerAndValues.splice( j, 1 );
                break;
            }
        }
    }

    //create return input data
    var updatedQc0AnswerOptions = existingAnswerAndValues.map( e => e.props.qc0AnswerOptions.value );
    var updatedQc0AnswerOptionValues = existingAnswerAndValues.map( e => e.props.qc0AnswerOptionValues.value );

    return [ {
        object: data.ratingObject,
        timestamp: '',
        vecNameVal: [
            {
                name: 'qc0AnswerOptions',
                values: updatedQc0AnswerOptions
            },
            {
                name: 'qc0AnswerOptionValues',
                values: updatedQc0AnswerOptionValues
            }
        ]
    } ];
};

/**
  * Load existing answer options and values.
  * @param {DeclViewModel} data data of the current View model.
  */
export let loadChecklistAnswerConfigTreeTableData = function( data, subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    var ratingObject;
    if ( data.ratingObject ) {
        ratingObject = data.ratingObject;
    } else {
        var selectedObject = subPanelContext.selected;
        var ratingObjectUID = selectedObject.props.qc0RatingRuleReference.dbValues[0];
        ratingObject = cdm.getObject( ratingObjectUID );
    }

    let propsInTable = [ 'qc0AnswerOptions', 'qc0AnswerOptionValues' ];
    let propsToLoadArray = [];
    for( let i = 0; i < propsInTable.length; i++ ) {
        if( !ratingObject.props[propsInTable[i]] ) {
            propsToLoadArray.push( propsInTable[i] );
        }
    }

    if ( ratingObject && propsToLoadArray.length === 0 ) {
        var tableRows = createChecklistAnswerConfigTableRowData( ratingObject, data );
        deferred.resolve( {
            tableRows: tableRows
        } );
    } else {
        dms.getProperties( [ ratingObject.uid ], propsToLoadArray ).then(
            function() {
                var tableRows = createChecklistAnswerConfigTableRowData( ratingObject, data );
                deferred.resolve( {
                    tableRows: tableRows
                } );
            } );
    }

    return deferred.promise;
};

/**
  * Load existing answer options and values as table columns
  * @param {DeclViewModel} data data of the current View model.
  */
export let loadChecklistAnswerConfigTableColumns = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var width = 225;
    var awColumnInfos = [];

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'qc0AnswerOptions',
        displayName: data.Aqc0ChecklistAnswerTableColumnName.propertyDisplayName,
        width: width,
        minWidth: 50,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'qc0AnswerOptionValues',
        displayName: data.Aqc0ChecklistAnswerValueTableColumnName.propertyDisplayName,
        width: width - 25,
        minWidth: 50,
        typeName: 'Integer',
        enableColumnResizing: true,
        enableColumnMoving: false
    } ) );

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );

    return deferred.promise;
};

/**
 * Load LOV in data for Answer.
 * @param {DeclViewModel} data - The qualified data of the viewModel
 * @returns {Object} value the LOV value 
 */
 export let loadAnswerOptionsInLOV = function(data, ratingObject) {

    var answerOptionPropName = "qc0AnswerOptions";
    var answerOptionValuesPropName = "qc0AnswerOptionValues";
    var lovEntries = [];    
    var lovinput = ratingObject.props[answerOptionPropName].dbValues ;
    var lovinputValue = ratingObject.props[answerOptionValuesPropName].dbValues;
   

    for( let i = 0; i < lovinput.length; i++ ) {
        var internalValue = lovinput[ i ];
        var displayValue = lovinput[ i ];
        var displayDescription = data.i18n.Aqc0ChecklistAnswerValueTableColumnName + ": " + lovinputValue[ i ]; 
    
        lovEntries.push( {
            propDisplayValue: displayValue,
            propInternalValue: internalValue,
            propDisplayDescription: displayDescription,
            hasChildren: false,
            children: {}
        } );
    }

    return lovEntries;
};

/**
  * Move selected answer up or down and returned info object with updated property value.
  * @param {Object} ctx current context
  * @param {DeclViewModel} data data of the current View model.
  */
export let moveSelectedAnswerAndReturnInputData = function( ctx, commandContext, eventData, data ) {
    //move Answer option up/down
    var selectedAnswer = commandContext.checklistAnswerConfigDataProvider.selectedObjects[0];
    ctx.selectedAnswerObject = null;
    ctx.selectedAnswerObject = selectedAnswer;
    var indexOfSelection = selectedAnswer.uid;
    var selectedAnswerText = selectedAnswer.props.qc0AnswerOptions.value;
    var selectedAnswerValue = selectedAnswer.props.qc0AnswerOptionValues.value;
    var existingAnswerAndValues = getExistingAnswers( ctx, data, false );
    indexOfSelection -= 1;
    if ( existingAnswerAndValues.length > 0 ) {
        if ( eventData.activeCommandId === 'Aqc0MoveUpSelectedAnswerForChecklist' ) {
            if ( indexOfSelection > 0 ) {
                var selectedAnswerValueFromArray = existingAnswerAndValues[indexOfSelection];
                if ( selectedAnswerValueFromArray.answerText === selectedAnswerText && selectedAnswerValueFromArray.answerValue === selectedAnswerValue ) {
                    existingAnswerAndValues[indexOfSelection] = existingAnswerAndValues[indexOfSelection - 1];
                    existingAnswerAndValues[indexOfSelection - 1] = selectedAnswerValueFromArray;
                }
            }
        } else if ( eventData.activeCommandId === 'Aqc0MoveDownSelectedAnswerForChecklist' ) {
            if ( indexOfSelection < existingAnswerAndValues.length - 1 ) {
                var selectedAnswerValueFromArray = existingAnswerAndValues[indexOfSelection];
                if ( selectedAnswerValueFromArray.answerText === selectedAnswerText && selectedAnswerValueFromArray.answerValue === selectedAnswerValue ) {
                    existingAnswerAndValues[indexOfSelection] = existingAnswerAndValues[indexOfSelection + 1];
                    existingAnswerAndValues[indexOfSelection + 1] = selectedAnswerValueFromArray;
                }
            }
        }
    }

    //create return input data

    var updatedQc0AnswerOptions = existingAnswerAndValues.map( e => e.answerText );
    var updatedQc0AnswerOptionValues = existingAnswerAndValues.map( e => e.answerValue );

    return [ {
        object: data.ratingObject,
        timestamp: '',
        vecNameVal: [
            {
                name: 'qc0AnswerOptions',
                values: updatedQc0AnswerOptions
            },
            {
                name: 'qc0AnswerOptionValues',
                values: updatedQc0AnswerOptionValues
            }
        ]
    } ];
};

export default exports = {
    addNewAnswerWithValueAndReturnInputData,
    clearAndRefreshData,
    checkForDuplicateAnswer,
    changeAnswerAction,
    deleteSelectedAnswerAndReturnInputData,
    loadAnswerOptionsInLOV,
    loadDefaultAnswersInLOV,
    loadChecklistAnswerConfigTreeTableData,
    loadChecklistAnswerConfigTableColumns,
    moveSelectedAnswerAndReturnInputData,
    populateErrorString
};
app.factory( 'Aqc0ChecklistSpecAnswerOptionsConfigService', () => exports );

