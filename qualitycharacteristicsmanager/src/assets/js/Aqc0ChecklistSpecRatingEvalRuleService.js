// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**

 * @module js/Aqc0ChecklistSpecRatingEvalRuleService
 */

 import eventBus from 'js/eventBus';
 import app from 'app';
 import AwPromiseService from 'js/awPromiseService';
 import viewModelObjectSvc from 'js/viewModelObjectService';
 import soaSvc from 'soa/kernel/soaService';  
 import _localeSvc from 'js/localeService';
 import dms from 'soa/dataManagementService';
 import cdm from 'soa/kernel/clientDataModel';
 import awColumnSvc from 'js/awColumnService';
 import dateTimeSvc from 'js/dateTimeService';
 import checklistSpecSvc from 'js/Aqc0ChecklistSpecService'; 
 import _ from 'lodash';
 import addObjectUtils from 'js/addObjectUtils';
 
 import 'jquery';
 
 var exports = {};
 
 var _editCondition = null;
 
 //Constants for widgte types
 let CHECKLIST_WIDGET_TYPE_LIST = {
     DATE: 'DATE',
     STRING: 'STRING',
     BOOLEAN: 'BOOLEAN'
 };
 
 //Constants for Value types and widget types for new fields to be added in prefrence
 let CHECKLIST_VALUE_TYPE_TO_WIDGET_TYPE_LIST = {
     1: 'STRING',
     2: 'DATE',
     3: 'DOUBLE',
     4: 'STRING',
     5: 'INTEGER',
     6: 'BOOLEAN',
     7: 'INTEGER',
     8: 'STRING',
     9: 'STRING', //TypedReference
     10: 'STRING', //UnTypedReference    
     11: 'STRING', //unknown
     12: 'STRING', //unknown
     13: 'STRING', //unknown
     14: 'STRING'
 };

 /**
  * Update the Checklist Evaluation Parameters section based on ChecklistRatingConditions.
  *
  * @param {DeclViewModel} data - The qualified data of the viewModel
  * @param {checklistRatingConditions} checklistRatingConditions - The checklistRatingConditions of the viewModel
  */
export let updateConditionProvider = function (data, checklistRatingConditions) {
    if (data && data.dataProviders && data.dataProviders.getEvaluationRuleConditions && checklistRatingConditions && checklistRatingConditions.length > 0) {
        let objs = [];
        for (let i = 0; i < checklistRatingConditions.length; i++) {
            let mObj = viewModelObjectSvc.createViewModelObject(i + 1, 'EDIT');
            mObj = {
                cellProperties: {}
            };
            mObj.uid = checklistRatingConditions[i].uid;

            mObj.cellHeader1 = checklistRatingConditions[i].conditionDisplayName;
            mObj.cellHeaderInternalValue = checklistRatingConditions[i].conditionName;

            mObj.cellProperties[data.Aqc0PropertySection.dbValue] = {
                key: data.Aqc0PropertySection.uiValue,
                value: checklistRatingConditions[i].propertyDisplayName,
                internalValue: checklistRatingConditions[i].propertyQName
            };

            mObj.cellProperties[data.Aqc0ConditionCellValueSection.dbValue] = {
                key: data.Aqc0ConditionCellValueSection.uiValue,
                value: checklistRatingConditions[i].value,
                internalValue: checklistRatingConditions[i].internalValue
            };
            //TODO:: image request has been submitted until then "typeMissingImage48" will be used.
            mObj.typeIconURL = app.getBaseUrlPath() + '/image/typeMissingImage48.svg';
            objs.push(mObj);
        }
        data.dataProviders.getEvaluationRuleConditions.update(objs, objs.length);
    }
};

/**
  * Get the evaluation preference configured in RAC for evaluation condition
  *
  * @param {object} typeInternalName - The type internal name
  * @param {object} preferenceName - The preference name
  */
 export let getPreferenceAction = function (typeInternalName, preferenceName) {
    let deferred = AwPromiseService.instance.defer();
    let preferenceNames = [];
    preferenceNames.push(preferenceName);
    soaSvc.postUnchecked('Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: preferenceNames,
        includePreferenceDescriptions: false
    }).then(function (preferenceResult) {
        if (preferenceResult) {
            let preferenceProp = preferenceResult.response[0].values.values;
            let EvalautionRatingPreferenceMap = {};
            EvalautionRatingPreferenceMap[typeInternalName] = [];
            for (let i = 0; i < preferenceProp.length; i++) {
                let propertyName = preferenceProp[i];
                EvalautionRatingPreferenceMap[typeInternalName].push(propertyName);
            }
            deferred.resolve(EvalautionRatingPreferenceMap);
        }
    },function (error) {
        deferred.reject(error);
    });
    return deferred.promise;
};
 
 /**
  * Get the property preference configured in RAC for evaluation condition
  *
  * @param {object} typeInternalName - The type internal name
  */
export let getPropertyAction = function (typeInternalName) {
    let deferred = AwPromiseService.instance.defer();
    let objs = [];
    objs.push(typeInternalName);
    soaSvc.postUnchecked('Core-2015-10-Session', 'getTypeDescriptions2', {
        typeNames: objs,
        options: {
            PropertyExclusions: ["AllExclusions"],
            TypeExclusions: ["AllExclusions"],
            TypeConstants: [""],
            PropertyConstants: [""]
        }
    }).then(function (descResult) {
        let EvalautionRatingPropertiesMap = {};
        if (descResult.types) {
            for (let k = 0; k < descResult.types.length; k++) {
                EvalautionRatingPropertiesMap[descResult.types[k].name] = descResult.types[k].propertyDescriptors;
            }
            deferred.resolve(EvalautionRatingPropertiesMap);
        }
    }, function (error) {
        deferred.reject(error);
    });
    return deferred.promise;
};

/**
  * Display the property preferences in edit mode , It would populate the field names for Panel
  *
  * @param {object} typeInternalName - The type internal name
  * @param {DeclViewModel} data - The qualified data of the viewModel
  * @param {DeclViewModel} subPanelContext - The subPanelContext of the viewModel
  */
export let displayPropertyPreferencesActionInEdit = function (typeInternalName, data, subPanelContext) {

    let propertyContextValues = displayPropertyPreferencesAction(typeInternalName, data);
    let uiProps = {};
    if (subPanelContext && subPanelContext.addPanelState && subPanelContext.addPanelState.editParameterContext) {
        let propertyContext = { ...data.propertyContext };
        propertyContext.dbValue = subPanelContext.addPanelState.editParameterContext.cellProperties[data.i18n.Aqc0PropertySection].internalValue;
        propertyContext.uiValue = subPanelContext.addPanelState.editParameterContext.cellProperties[data.i18n.Aqc0PropertySection].value;

        uiProps = selectionChange(data, propertyContext, propertyContextValues, subPanelContext.addPanelState);
    }
    return {
        propertyContextValues: uiProps.propertyContextValues,
        propertyContext: uiProps.propertyContext,
        genericWidget: uiProps.genericWidget,
        currentFieldValueType: uiProps.currentFieldValueType,
        genericValueContext: uiProps.genericValueContext
    };
};
 
 /**
  * Display the property preferences , It would populate the field names for Panel
  *
  * @param {object} typeInternalName - The type internal name
  * @param {DeclViewModel} data - The qualified data of the viewModel
  */
export let displayPropertyPreferencesAction = function (typeInternalName, data) {
    let propertyContextValues = [];
    if (typeInternalName) {
        let properties = data.EvalautionRatingPropertiesMap[typeInternalName];
        let prefProperties = data.EvalautionRatingPreferenceMap[typeInternalName];
        if (properties && properties.length > 0 && prefProperties && prefProperties.length > 0) {
            for (let j = 0; j < prefProperties.length; j++) {
                for (let k = 0; k < properties.length; k++) {
                    if (properties[k].name === prefProperties[j]) {
                        let propertyContextValue = {};
                        propertyContextValue.propDisplayValue = properties[k].displayName;
                        propertyContextValue.propInternalValue = properties[k].name;
                        propertyContextValue.valueType = properties[k].valueType;
                        propertyContextValues.push(propertyContextValue);
                        break;
                    }
                }
            }
        }
    }
    return propertyContextValues;
};

/**
  * Selection change for property change 
  *
  * @param {DeclViewModel} data - The data of view model
  * @param {propertyContext} propertyContext - The propertyContext of view model
  * @param {propertyContextValues} propertyContextValues - The propertyContextValues of view model
  * @param {DeclViewModel} addPanelState - The addPanelState of view model
  */
var selectionChange = function (data, propertyContext, propertyContextValues, addPanelState) {
    if (!propertyContext) {
        var propertyContext = { ...data.propertyContext };
    }

    if (!propertyContextValues) {
        var propertyContextValues = data.propertyContextValues.dbValue;
    }

    let genericWidget = { ...data.genericWidget };
    let currentFieldValueType = { ...data.currentFieldValueType };
    let genericValueContext = { ...data.genericValueContext };

    if (propertyContext.dbValue) {
        var valueType = null;
        for (let j = 0; j < propertyContextValues.length; j++) {
            if (propertyContext.dbValue === propertyContextValues[j].propInternalValue) {
                valueType = propertyContextValues[j].valueType;
                break;
            }
        }
        if (valueType !== null && valueType >= 0) {
            let widgetType = CHECKLIST_WIDGET_TYPE_LIST[valueType];
            if (widgetType) {
                //TODO:: Add support for LISTBOX
                genericWidget.type = widgetType;
                genericWidget.propertyDisplayName = propertyContext.uiValue;
            } else {
                widgetType = CHECKLIST_VALUE_TYPE_TO_WIDGET_TYPE_LIST[valueType];
                genericWidget.type = widgetType;
                genericWidget.propertyDisplayName = propertyContext.uiValue;
            }
            currentFieldValueType.dbValue = widgetType;
            genericWidget.propertyDisplayName = propertyContext.uiValue;
            genericValueContext.propertyDisplayName = propertyContext.uiValue;

            //Edit Functionality : Sets the other Widget on the edit Panel
            if (addPanelState && addPanelState.editParameterContext) {
                let fieldValue = addPanelState.editParameterContext.cellProperties["Value"].value;
                if (fieldValue) {
                    if (genericWidget.type === 'BOOLEAN') {
                        genericWidget.dbValue = fieldValue === 'true';
                    } else {
                        genericWidget.dbValue = fieldValue;
                    }
                    //TODO:: Support LISTBOX
                    genericWidget.uiValue = fieldValue;
                }
            }
            else {
                if (widgetType && widgetType === 'BOOLEAN') {
                    genericWidget.dbValue = true;
                    genericWidget.uiValue = true;
                } else {
                    genericWidget.dbValue = null;
                }
            }
        }
    }
    return {
        propertyContext: propertyContext,
        propertyContextValues: propertyContextValues,
        genericWidget: genericWidget,
        currentFieldValueType: currentFieldValueType,
        genericValueContext: genericValueContext
    };
};
 
 /**
  * Selection change event for property change 
  *
  * @param {DeclViewModel} data - The data of view model
  */
export let selectionChangeOfPropertyContext = function (data) {
    var uiProps = selectionChange(data, null, null);

    return {
        genericWidget: uiProps.genericWidget,
        currentFieldValueType: uiProps.currentFieldValueType,
        genericValueContext: uiProps.genericValueContext,
        isDuplicate: false,
        isFieldEmpty: false
    };
};
 
 /**
  * Add the condition to ctx
  *
  * @param {DeclViewModel} data - The qualified data of the viewModel
  * @param {addPanelState} addPanelState - The addPanelState of the viewModel
  */
export let addCondition = function (data, addPanelState) {
    var checklistRatingConditions = [];

    if (addPanelState.checklistRatingConditions && addPanelState.checklistRatingConditions.length > 0) {
        checklistRatingConditions = addPanelState.checklistRatingConditions;
    }

    if (addPanelState.editParameterContext) {
        _editCondition = addPanelState.editParameterContext;
        var result = editFromChecklistEvaluationRuleEdit(data, checklistRatingConditions);
        if (!result.valid) {
            return {
                isDuplicate: result.isDuplicate,
                isFieldEmpty: result.isFieldEmpty,
                param: result.param
            };
        }
        addObjectUtils.updateAtomicDataValue(addPanelState, { checklistRatingConditions: checklistRatingConditions, editParameterContext: null, triggerConditionAdded: true });
        _editCondition = null;
    } else {
        let length = checklistRatingConditions.length;
        checklistRatingConditions[length] = [];
        var result = checkForValidations(length, data, checklistRatingConditions, true);
        if (!result.valid) {
            checklistRatingConditions.pop();
            return {
                isDuplicate: result.isDuplicate,
                isFieldEmpty: result.isFieldEmpty,
                param: result.param
            };
        }
        if (addPanelState) {
            let newAddPanelState = { ...addPanelState.value };
            if (checklistRatingConditions.length > 0) {
                newAddPanelState.checklistRatingConditions = checklistRatingConditions;
                newAddPanelState.triggerConditionAdded = true;
            } else {
                newAddPanelState.checklistRatingConditions = [];
                newAddPanelState.triggerConditionAdded = true;
            }
            addPanelState.update(newAddPanelState);
        }
    }
};
 
 /**
 * Edit filter condition when clicked on the edit cell.
  *
  * @param {data} data - The qualified data of the viewModel
  * @param {checklistRatingConditions} checklistRatingConditions - The checklistRatingConditions of the addPanelState
  * @returns {boolean} true/false
  */
var editFromChecklistEvaluationRuleEdit = function (data, checklistRatingConditions) {
    for (let i = 0; i < checklistRatingConditions.length; i++) {
        let cond = checklistRatingConditions[i];
        if (cond.uid === _editCondition.uid) {
            var result = checkForValidations(i, data, checklistRatingConditions, false);
            if (!result.valid) {
                return result;
            }
            break;
        }
    }
    return {
        valid: true,
        isDuplicate: false,
        isFieldEmpty: false
    };
};

 /**
  * checkForValidations
  *
  * @param {var} i - The index
  * @param {DeclViewModel} data - The qualified data of the viewModel
  * @param {checklistRatingConditions} checklistRatingConditions - The checklistRatingConditions of the addPanelState
  * @param {boolean} generateUid - Whether to generate UID or not
  * @returns {boolean} true/false
  */
var checkForValidations = function (i, data, checklistRatingConditions, generateUid) {
    //check if selected property is already exist in list
    for (let j = 0; j < checklistRatingConditions.length; j++) {
        let cond = checklistRatingConditions[j];
        if ((_editCondition && cond.uid !== _editCondition.uid && cond.propertyQName === data.propertyContext.dbValue) || (!_editCondition && cond.propertyQName === data.propertyContext.dbValue)) {
            return {
                valid: false,
                isDuplicate: true,
                isFieldEmpty: false,
                param: data.propertyContext.uiValue
            };
        }
    }
    checklistRatingConditions[i].conditionDisplayName = data.i18n.Aqc0ConditionCellNameSection;
    checklistRatingConditions[i].conditionName = data.i18n.Aqc0ConditionCellNameSection;

    checklistRatingConditions[i].propertyQName = data.propertyContext.dbValue;
    checklistRatingConditions[i].propertyDisplayName = data.propertyContext.uiValue;

    if (data.currentFieldValueType.dbValue === 'DATE') {
        if (checkWidgetEmptyOrNot(data.genericWidget)) {
            return {
                valid: false,
                isDuplicate: false,
                isFieldEmpty: true
            };
        }
        let date = new Date(parseInt(data.genericWidget.dbValue));
        let formatDate = dateTimeSvc.formatDate(date, data.genericWidget.dateApi.dateFormatPlaceholder);
        checklistRatingConditions[i].value = formatDate;
        checklistRatingConditions[i].internalValue = dateTimeSvc.formatUTC(date);
    } else {
        let internalName = data.propertyContext.dbValue;
        if (internalName !== 'object_name' && internalName !== 'object_desc') {
            if (checkWidgetEmptyOrNot(data.genericWidget)) {
                return {
                    valid: false,
                    isDuplicate: false,
                    isFieldEmpty: true
                };
            }
            checklistRatingConditions[i].value = data.genericWidget.uiValue.toString();
            checklistRatingConditions[i].internalValue = data.genericWidget.dbValue.toString();
        } else {
            checklistRatingConditions[i].value = data.genericWidget.uiValue;
            checklistRatingConditions[i].internalValue = data.genericWidget.dbValue;
        }
    }

    if (generateUid) {
        checklistRatingConditions[i].uid = Math.floor(Math.random() * 10000 + 1); // Uid generation for New Condition
    }
    return {
        valid: true,
        isDuplicate: false,
        isFieldEmpty: false
    };
};

 /**
  * check for value Widget Empty or Not .
  *
  * @param {object} genericWidget - The current active widget
  * @returns {boolean} true/false
  */
var checkWidgetEmptyOrNot = function (genericWidget) {
    if (genericWidget.type === 'DATE') {
        if (genericWidget.dbValue > 0) {
            return false;
        }
    } else if (genericWidget.dbValue || genericWidget.dbValue === 0 || genericWidget.dbValue === false) { // false is added to support boolean type
        return false;
    }
    return true;
};
 
 /**
  * Get all the new checklist evaluation rules with existing rules
  * @param {DeclViewModel} data data of the current View model.
  * @param {DeclViewModel} subPanelContext subPanelContext of the current View model.
  * @param {DeclViewModel} ratingObject ratingObject of the current View model.
  */
export let getChecklistEvalRulesToAdd = function (data, subPanelContext, ratingObject) {
    var existingConditions = [];
    if (ratingObject) {
        if (ratingObject.props.qc0AssessmentRule.dbValues) {
            for (var i = 0; i < ratingObject.props.qc0AssessmentRule.dbValues.length; i++) {
                existingConditions.push(ratingObject.props.qc0AssessmentRule.dbValues[i]);
            }
        }
    }
    var parameterList = subPanelContext.addPanelState.checklistRatingConditions;
    var condition = [];
    if (data.assessmentRequired.dbValue === true) {
        condition = "qc0AssessmentRequired: " + data.assessmentRequired.dbValue + "; Rating: " + data.rating.dbValue + "; Answer: " + data.answer.dbValue;
        if (data.state.dbValue || data.state.dbValue !== '') {
            condition += "; qc0State: " + data.state.dbValue;
        }
    }
    else if (data.assessmentRequired.dbValue === false) {
        var type = "";
        for (var i = 0; i < data.typeLov.dbValue.length; i++) {
            type += data.typeLov.dbValue[i];
            if(i !== (data.typeLov.dbValue.length - 1)) 
            {
                type += ",";
            }
        }
        condition = "qc0AssessmentRequired: " + data.assessmentRequired.dbValue + "; Type: " + type;
        if (data.evaluatedTypeLov.dbValue || data.evaluatedTypeLov.dbValue !== '') {
            condition += "; Evaluated Type: " + data.evaluatedTypeLov.dbValue;
        }
        condition += "; qc0UnitOfThreshold: " + data.unitOfThreshold.dbValue + "; qc0ThresholdOfRedYellow: " + data.redYellowThreshold.dbValue + "; qc0ThresholdOfYellowGreen: " + data.yellowGreenThreshold.dbValue + "; qc0ThresholdOfGreenNull: " + data.greenNullThreshold.dbValue;
    }
    if (parameterList) {
        for (var cond = 0; cond < parameterList.length; cond++) {
            condition += "; ";
            condition += parameterList[cond].propertyQName;
            condition += ": ";
            condition += parameterList[cond].internalValue;
        }
    }
    existingConditions.push(condition.toString());
    return existingConditions;
};
 
 /**
  * @return {Array} Array of conditions or rules (type string) already exist in the object..
  */
function createTableRowData(ratingObject, data) {
    var rules = [];
    if (ratingObject) {
        var assessmentRules = ratingObject.props.qc0AssessmentRule.dbValues;
        for (var i = 0; i < assessmentRules.length; i++) {
            var rule = {};

            rule.type = ratingObject.type;
            rule.uid = i + 1;
            rule.typeIconURL = "";
            rule.props = {};
            var qc0AssessmentRule = {
                "type": "STRING",
                "hasLov": false,
                "isArray": false,
                "displayValue": assessmentRules[i],
                "uiValue": assessmentRules[i],
                "value": assessmentRules[i],
                "propertyName": "qc0AssessmentRule",
                "propertyDisplayName": data.Aqc0TableColumnName.propertyDisplayName,
                "isEnabled": true
            };
            rule.props = {
                qc0AssessmentRule: qc0AssessmentRule
            };
            rules.push(rule);
        }
    }
    return rules;
}
 
 /**
  * Load Checklist evaluation rules. It creates data row to get loaded in table. 
  * @param {DeclViewModel} data data of the current View model.
  */
export let loadChecklistEvalRuleExprTreeTableData = function (data, selectedObject) {

    var deferred = AwPromiseService.instance.defer();
    var ratingObject;
    if (data.ratingObject && data.ratingObject.props.qc0AssessmentRule) {
        ratingObject = data.ratingObject;
    }
    else {
        var ratingObjectUID = selectedObject.props.qc0RatingRuleReference.dbValues[0];
        ratingObject = cdm.getObject(ratingObjectUID);
    }

    if (ratingObject && ratingObject.props && ratingObject.props.qc0AssessmentRule) {
        var rules = createTableRowData(ratingObject, data);
        deferred.resolve({
            rules: rules
        });
    } else {
        dms.getProperties([ratingObject.uid], ['qc0AssessmentRule']).then(
            function () {
                var rules = createTableRowData(ratingObject, data);
                deferred.resolve({
                    rules: rules
                });
            });
    }
    return deferred.promise;
};
 
 /**
  * Load table columns
  * @param {UwDataProvider} uwDataProvider an object that wraps access to a 'viewModelCollection'
  * @param {DeclViewModel} data data of the current View model.
  */
export let loadTableColumns = function (uwDataProvider, data) {
    var awColumnInfos = [];
    awColumnInfos.push(awColumnSvc.createColumnInfo({
        name: 'qc0AssessmentRule',
        displayName: data.Aqc0TableColumnName.propertyDisplayName,
        minWidth: 300,
        width: 800,
        typeName: 'String',
        enableColumnResizing: true,
        enableColumnMoving: false
    }));

    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };
};
 
 /**
  * Move selected checklist evaluation rule up or down and returned array with updated order.
  * @param {Object} context current context
  * @param {activeCommandId} activeCommandId the active command id.
  */
export let moveSelectedChecklistEvalRule = function (context, activeCommandId) {

    var selectedEvalRule = context.checklistEvalRuleExprDataProvider.selectedObjects[0];
    var indexOfSelection = selectedEvalRule.uid - 1; // uid starts with 1 
    var selectedConditionValue = selectedEvalRule.props.qc0AssessmentRule.value;
    var existingEvalRules = context.ratingObject.props.qc0AssessmentRule.dbValues;

    if (existingEvalRules.length > 0) {
        if (activeCommandId === 'Aqc0MoveUpCondForChecklistEvaluation') {
            if (indexOfSelection > 0) {
                var selectedConditionFromArray = existingEvalRules[indexOfSelection];
                if (selectedConditionFromArray === selectedConditionValue) {
                    existingEvalRules[indexOfSelection] = existingEvalRules[indexOfSelection - 1];
                    existingEvalRules[indexOfSelection - 1] = selectedConditionFromArray;
                }
            }
        } else if (activeCommandId === 'Aqc0MoveDownCondForChecklistEvaluation') {
            if (indexOfSelection < existingEvalRules.length - 1) {
                var selectedConditionFromArray = existingEvalRules[indexOfSelection];
                if (selectedConditionFromArray === selectedConditionValue) {
                    existingEvalRules[indexOfSelection] = existingEvalRules[indexOfSelection + 1];
                    existingEvalRules[indexOfSelection + 1] = selectedConditionFromArray;
                }
            }
        }
    }
    return existingEvalRules;
};
 
 /**
  * Delete selected checklist evaluation rule and returned array with remaining evaluation rules.
  * @param {Object} commandContext current context
  * @param {data} data - The qualified data of the viewModel
  */
export let deleteSelectedChecklistEvalRule = function (commandContext, data) {
    var selectedConditions = commandContext.checklistEvalRuleExprDataProvider.selectedObjects;
    var existingEvalRules = createTableRowData(commandContext.ratingObject, data);

    for (var i = 0; i < selectedConditions.length; i++) {
        var selectedConditionUid = selectedConditions[i].uid; // uid starts with 1 
        var selectedConditionValue = selectedConditions[i].props.qc0AssessmentRule.value;
        for (var j = 0; j < existingEvalRules.length; j++) {
            if (existingEvalRules[j].uid === selectedConditionUid && existingEvalRules[j].props.qc0AssessmentRule.value === selectedConditionValue) {
                existingEvalRules.splice(j, 1);
                break;
            }
        }
    }
    return existingEvalRules.map(rule => rule.props.qc0AssessmentRule.value);
};
 
/**
  * Update panel state after removing condition.
  *
  * @param {subPanelContext} subPanelContext - The subPanelContext of the viewModel
  * @param {data} data - The qualified data of the viewModel
  * @param {object} deletedUid - The Uid to be deleted
  */
var updatePanelState = function (subPanelContext, data, deletedUid) {
    let conditions = subPanelContext.addPanelState.checklistRatingConditions;
    for (let i = 0; i < conditions.length; i++) {
        let cond = conditions[i];
        if (cond.uid === deletedUid) {
            conditions.splice(i, 1);
            break;
        }
    }
    return true;
};
 
 /**
  * Remove condition called when clicked on the remove cell.
  *
  * @param {subPanelContext} subPanelContext - The subPanelContext of the viewModel
  * @param {data} data - The qualified data of the viewModel
  * @param {object} deletedUid - The Uid to be deleted
  */
export let removeCondition = function (subPanelContext, data, deletedUid) {
    let memberModelObjects = data.dataProviders.getEvaluationRuleConditions.viewModelCollection.loadedVMObjects;

    for (let i = 0; i < memberModelObjects.length; i++) {
        if (memberModelObjects[i].uid === deletedUid) {
            memberModelObjects.splice(i, 1);
            break;
        }
    }
    data.dataProviders.getEvaluationRuleConditions.update(memberModelObjects, memberModelObjects.length);
    updatePanelState(subPanelContext, data, deletedUid);
};
 
 /**
  * Execute the delete command. 
  *
  * @param {ViewModelObject} vmo - Context for the command 
  * @param {DeclViewModel} data - The qualified data of the viewModel
  */
export let deleteEvaluationRuleCondition = function (vmo, data) {
    if (vmo && vmo.uid && data) {
        data.vmo = vmo;
        eventBus.publish('Aqc0AddChecklistEvaluationRuleSub.removeCondition', data);
    }
};
 
 /**
  * Execute the edit command. 
  *
  * @param {ViewModelObject} vmo - Context for the command 
  * @param {DeclViewModel} data - The qualified data of the viewModel
  */
export let editEvaluationRuleCondition = function (vmo, context) {
    if (vmo && context) {
        addObjectUtils.updateAtomicDataValue(context.addPanelState, { editParameterContext: vmo });
        addObjectUtils.updateAtomicDataValue(context.activeState, { activeView: "Aqc0AddEvaluationCondition" });
    }
};

 export let populateErrorString = function( response ) {
    return checklistSpecSvc.populateErrorString(response);
};
 
 export default exports = {
     updateConditionProvider,
     getPreferenceAction,
     getPropertyAction,
     displayPropertyPreferencesAction,
     displayPropertyPreferencesActionInEdit,
     selectionChangeOfPropertyContext,
     addCondition,     
     getChecklistEvalRulesToAdd,
     loadChecklistEvalRuleExprTreeTableData,     
     loadTableColumns,     
     moveSelectedChecklistEvalRule,
     deleteSelectedChecklistEvalRule,    
     removeCondition,
     deleteEvaluationRuleCondition,
     editEvaluationRuleCondition,    
     populateErrorString
 };
 app.factory('Aqc0ChecklistSpecRatingEvalRuleService', () => exports);
 