// Copyright (c) 2022 Siemens

/**
 * @module js/Acp0IndustryRuleService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import soaSvc from 'soa/kernel/soaService';
import editHandlerService from 'js/editHandlerService';
import messagingService from 'js/messagingService';
import tcVmoService from 'js/tcViewModelObjectService';
import uwPropertySvc from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};
var _data = null;
let westingHoueRuleProperties = [];


/**
 * Gets the underlying object for the selection. For selection of an occurrence in a BOM, the underlying object is
 * typically an SPCCheck Revision object. If there is no underlying object, the selected object is returned.
 *
 * @param {object} ctx - Application Context
 */
var getUnderlyingObject = function (selectedObj) {
    var underlyingObj = null;
    if (selectedObj) {
        var underlyingObjProp = selectedObj.props.awb0UnderlyingObject;
        if (!_.isUndefined(underlyingObjProp)) {
            underlyingObj = cdm.getObject(underlyingObjProp.dbValues[0]);
        } else {
            underlyingObj = selectedObj;
        }
    }
    return underlyingObj;
};

/**
 * Get the industry rules from selcted object
 */
export let getIndustryRuleName = function (selectedobject) {
    var industryRule = null;
    if (!_.isUndefined(hasUnderlyingObject(selectedobject))) {
        industryRule = selectedobject.props.acp0ElementIndustryRule.dbValue;
    } else {
        industryRule = selectedobject.props.acp0IndustryRule.fielddata.uiValue;
    }
    return industryRule;
};

var hasUnderlyingObject = function (selectedobject) {
    return selectedobject.props.awb0UnderlyingObject;
};

var getCharTypeFromSPCCheck = function () {
    // To check selected object is runtime or persistent
    var ctx = appCtxSvc.getCtx();
    var selectedObject = ctx.xrtSummaryContextObject;
    var charTypeProp = null;
    if (!_.isUndefined(hasUnderlyingObject(selectedObject))) {
        charTypeProp = selectedObject.props.acp0ElementCharType;
    } else {
        charTypeProp = selectedObject.props.acp0CharacteristicsType;
    }
    return charTypeProp;
};
/**
 *This method loads the standard rule object , reads its properties and saves it in data.ruleproperties array.
 *this array will be used by the view for displaying the standard rules.
 *
 */
export let processStandardIndustryRules = function (response) {
    if (response.partialErrors || response.ServiceData && response.ServiceData.partialErrors) {
        return response;
    }
    var industryrules = [];
    if (response.searchResultsJSON) {
        var searchResults = JSON.parse(response.searchResultsJSON);
        if (searchResults) {
            if (searchResults.objects[0]) {
                var ruleUid = searchResults.objects[0].uid;
                var ruleObject = cdm.getObject(ruleUid);
                if (ruleObject.props.acp0IndustryRuleDefinition && ruleObject.props.acp0IndustryRuleDefinition.dbValues) {
                    for (var i = 0; i < ruleObject.props.acp0IndustryRuleDefinition.dbValues.length; i++) {
                        industryrules.push({
                            displayName: ruleObject.props.acp0IndustryRuleDefinition.dbValues[i],
                            type: 'STRING'
                        });
                    }
                }
            }
        }
    }
    return industryrules;
};

/*
 *
 * Loads the acp0WestinghousRules and acp0Trend property of the selected spc check object before revealing the custom panel
 * @param {Object} - selectedObj subpanelcontext selected Object
 */
export let loadMainRulesPanelData = function (selectedObj) {
    //var selectedObj = subPanelContext.xrtState.xrtVMO;
    // need to re initalise isSubPanelObjectLoaded to false , dont remove
    appCtxSvc.registerCtx('isSubPanelObjectLoaded', false);
    // load the acp0WestinghousRules and acp0Trend property of the selected spc check object
    var objectsToLoad = [];
    objectsToLoad.push(getUnderlyingObject(selectedObj));

    tcVmoService.getViewModelProperties(objectsToLoad, ['acp0Trend', 'acp0Run', 'acp0LessThanPercentage', 'acp0MoreThanPercentage', 'acp0SamplesSize', 'acp0ControlLimits', 'acp0WarningLimits', 'acp0SpecificationLimits', 'acp0WestinghousRules', 'acp0CharacteristicsType', 'acp0MiddleThird', 'acp0EnableRun', 'acp0EnableTrend']).then(
        function () {
            appCtxSvc.updateCtx('isSubPanelObjectLoaded', true);
        });
};

/**
 * Inialises the trend and 10 westinghouse boolean properties , we set the edit state ,enabled state,and property label here
 * @param {Object} - data object of viewmodel
 * @param {Object} - selectedObject subpanelcontext selected Object
 */
export let populatePanelData = function (subPanelContext) {
    westingHoueRuleProperties = [];
    let trendProperty = [];
    let runProperty = [];
    let ruleProperties = [];
    var selectedObject = subPanelContext.xrtState.value.xrtVMO;

    var charTypeProp = getCharTypeFromSPCCheck();

    if (charTypeProp.dbValue === 'Variable') {
        var activeEditHandler = editHandlerService.getActiveEditHandler();
        if (!_.isUndefined(hasUnderlyingObject(selectedObject))) {
            selectedObject = getUnderlyingObject(selectedObject);
        }
        trendProperty.push(selectedObject.props.acp0EnableTrend);
        uwPropertySvc.setValue(trendProperty[0], selectedObject.props.acp0EnableTrend.value);
        uwPropertySvc.setPropertyLabelDisplay(trendProperty[0], 'NO_PROPERTY_LABEL');
        trendProperty.push(selectedObject.props.acp0Trend);
        uwPropertySvc.setValue(trendProperty[1], selectedObject.props.acp0Trend.value);
        uwPropertySvc.setPropertyLabelDisplay(trendProperty[1], 'PROPERTY_LABEL_AT_SIDE');

        // To Fix framework issue as it taking object instead String
        selectedObject.props.acp0EnableTrend.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0Trend.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];

        //set initial value to trendProperty
        let j; let i;
        for (j = 0; j <= trendProperty.length - 1; j++) {
            uwPropertySvc.setIsEditable(trendProperty[j], true);
            uwPropertySvc.setIsEnabled(trendProperty[j], activeEditHandler.editInProgress());
        }
        runProperty.push(selectedObject.props.acp0EnableRun);
        uwPropertySvc.setValue(runProperty[0], selectedObject.props.acp0EnableRun.value);

        uwPropertySvc.setPropertyLabelDisplay(runProperty[0], 'NO_PROPERTY_LABEL');

        runProperty.push(selectedObject.props.acp0Run);
        uwPropertySvc.setValue(runProperty[1], selectedObject.props.acp0Run.value);
        uwPropertySvc.setPropertyLabelDisplay(runProperty[1], 'PROPERTY_LABEL_AT_SIDE');


        //  // To Fix framework issue as it taking object instead String
        selectedObject.props.acp0EnableRun.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0Run.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        //set initial value to runProperty
        for (j = 0; j <= runProperty.length - 1; j++) {
            uwPropertySvc.setIsEditable(runProperty[j], true);
            uwPropertySvc.setIsEnabled(runProperty[j], activeEditHandler.editInProgress());
        }

        // To Fix framework issue as it taking object instead String
        selectedObject.props.acp0MiddleThird.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0LessThanPercentage.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0MoreThanPercentage.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0LessThanPercentage.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0SamplesSize.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0ControlLimits.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0WarningLimits.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
        selectedObject.props.acp0SpecificationLimits.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];

        ruleProperties.push(selectedObject.props.acp0MiddleThird);
        ruleProperties.push(selectedObject.props.acp0LessThanPercentage);
        ruleProperties.push(selectedObject.props.acp0MoreThanPercentage);
        ruleProperties.push(selectedObject.props.acp0SamplesSize);
        ruleProperties.push(selectedObject.props.acp0ControlLimits);
        ruleProperties.push(selectedObject.props.acp0WarningLimits);
        ruleProperties.push(selectedObject.props.acp0SpecificationLimits);

        //dynamically form acp0westingRule properties from acp0WestinghousRules property
        for (i = 0; i < 10; i++) {
            var dbValue = selectedObject.props.acp0WestinghousRules.dbValues.length > i ? selectedObject.props.acp0WestinghousRules.dbValues[i] : false;
            var displayValue = selectedObject.props.acp0WestinghousRules.displayValues && selectedObject.props.acp0WestinghousRules.displayValues.length > i ? selectedObject.props.acp0WestinghousRules.displayValues[i] : 'False';
            var tempProp = uwPropertySvc.createViewModelProperty('acp0westingRule_' + (1 + i), selectedObject.props.acp0WestinghousRules.propertyDisplayName + ' ' + (1 + i), 'BOOLEAN', dbValue,
                displayValue);
            uwPropertySvc.setIsEditable(tempProp, true);
            uwPropertySvc.setIsEnabled(tempProp, activeEditHandler.editInProgress());
            uwPropertySvc.setPropertyLabelDisplay(tempProp, 'PROPERTY_LABEL_AT_RIGHT');
            //As prop.parentUid not able to set for custom props so managing by setting here
            uwPropertySvc.setSourceObjectUid(tempProp, selectedObject.uid);
            //To fix framework defect to address SourceObjectLastSaveDate
            tempProp.sourceObjectLastSavedDate = subPanelContext.xrtState.value.xrtVMO.props.last_mod_date.dbValues[0];
            westingHoueRuleProperties.push(tempProp);
        }

        //set initial value to ruleproperties
        for (j = 0; j <= ruleProperties.length - 1; j++) {
            uwPropertySvc.setIsEditable(ruleProperties[j], true);
            uwPropertySvc.setIsEnabled(ruleProperties[j], activeEditHandler.editInProgress());
            uwPropertySvc.setPropertyLabelDisplay(ruleProperties[j], 'PROPERTY_LABEL_AT_RIGHT');
        }

    }
    return {
        runProperty,
        trendProperty,
        ruleProperties,
        westingHoueRuleProperties
    };
};

/**
 * Listen to edit events , if edit is about to happen then convert the custom rule properties into edit mode else disable edit mode and revert to initial values
 *
 * @return {ObjectArray} data the data object in scope
 */
export let processEditData = function (data, selectedObject) {
    westingHoueRuleProperties = [];
    let tempRuleProperties;
    let tempRunProperties;
    let tempTrendProperties;
    westingHoueRuleProperties = [...data.westingHoueRuleProperties];
    tempRuleProperties = [...data.ruleProperties];
    tempRunProperties = [...data.runProperty];
    tempTrendProperties = [...data.trendProperty];
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    //var selectedObject = subPanelContext.xrtState.xrtVMO;

    _.forEach(westingHoueRuleProperties, function (prop) {
        if (prop) {
            uwPropertySvc.setIsEnabled(prop, activeEditHandler.editInProgress());
        }
    });
    _.forEach(tempRuleProperties, function (prop) {
        if (prop) {
            uwPropertySvc.setIsEnabled(prop, activeEditHandler.editInProgress());
            uwPropertySvc.setIsEditable(prop, true);
        }
    });
    _.forEach(tempRunProperties, function (prop) {
        if (prop.propertyName === 'acp0Trend') {
            prop.isEnabled = tempRunProperties[0].dbValue;
        } else if (prop) {
            uwPropertySvc.setIsEnabled(prop, activeEditHandler.editInProgress());
            uwPropertySvc.setIsEditable(prop, true);
        }
    });
    _.forEach(tempTrendProperties, function (prop) {
        if (prop.propertyName === 'acp0Run') {
            prop.isEnabled = tempTrendProperties[0].dbValue;
        } else if (prop) {
            uwPropertySvc.setIsEnabled(prop, activeEditHandler.editInProgress());
            uwPropertySvc.setIsEditable(prop, true);
        }
    });

    return {
        westingHoueRuleProperties,
        tempRuleProperties,
        tempRunProperties,
        tempTrendProperties
    };
};

/**
 * @param {String} stringValue -
 *
 * @return {boolean} TRUE if given value is not NULL and equals 'true', 'TRUE' or '1'.
 */
export let isPropertyValueTrue = function (stringValue) {
    return stringValue && stringValue !== '0' &&
        (String(stringValue).toUpperCase() === 'TRUE' || stringValue === '1');
};
var saveHandler = {};

/**
 * Get save handler.
 *
 * @return Save Handler
 */
export let getSaveHandler = function () {
    return saveHandler;
};


/**
 * This method loads the properties of SPC Check object and then process for the Save
 */
export let loadControlMethodObject = function (selectedObject, modifiedViewModelProperties, modifiedPropsMap) {
    var deferred = AwPromiseService.instance.defer();
    var loadChxObjectInput = {
        objects: [selectedObject],
        attributes: ['acp0IndustryRule', 'acp0WestinghousRules', 'acp0CharacteristicsType']
    };

    soaSvc.post('Core-2006-03-DataManagement', 'getProperties', loadChxObjectInput).then(function (getPropertiesResponse) {
        var updatedCharSpecUids = [];
        Object.keys(getPropertiesResponse.modelObjects).map(function (key) {
            if (getPropertiesResponse.modelObjects[key].modelType.typeHierarchyArray.indexOf('Acp0SPCCheckRevision') > -1 ||
                getPropertiesResponse.modelObjects[key].modelType.typeHierarchyArray.indexOf('Acp0SPCCheckElement') > -1) {
                updatedCharSpecUids.push(getPropertiesResponse.modelObjects[key]);
            }
        });
        saveControlMethodObjects(updatedCharSpecUids[0], modifiedViewModelProperties, modifiedPropsMap);
        deferred.resolve(updatedCharSpecUids);

    }, function (reason) {
        deferred.reject(reason);
    });
};


/**
 * custom save handler save edits called by framework
 *
 */
saveHandler.saveEdits = function (dataSource) {
    //Checking for reset of custom rule prop values are required to reset or not.
    let selectedObject = dataSource.getLoadedViewModelObjects()[0];

    // If selectedObject is a runtime, get uderying object
    selectedObject = getUnderlyingObject(selectedObject);

    // Get the modifies properties
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsMap = dataSource.getModifiedPropertiesMap(modifiedViewModelProperties);

    // If required properties are not loaded, load these properties and then save the object
    if (_.isUndefined(selectedObject.props.acp0CharacteristicsType) || _.isUndefined(selectedObject.props.acp0IndustryRule) ||
        _.isUndefined(selectedObject.props.acp0WestinghousRules)) {
        loadControlMethodObject(selectedObject, modifiedViewModelProperties, modifiedPropsMap);
    } else {
        saveControlMethodObjects(selectedObject, modifiedViewModelProperties, modifiedPropsMap);
    }
};


/**
 * Custom function to save SPC Check object
 *
 */
export let saveControlMethodObjects = function (selectedObject, modifiedViewModelProperties, modifiedPropsMap) {
    var westingHoueRulePropertiesName = [];
    var checkForReset = !(selectedObject.props.acp0CharacteristicsType.dbValues[0] === 'Variable' && selectedObject.props.acp0IndustryRule.dbValues[0] === 'Custom');
    if (!checkForReset) {
        if (isRulePropertiesModified()) {
            if (!westingHoueRuleProperties.newValue) {
                selectedObject.props.acp0WestinghousRules.newValue = [];
            }
            if (!westingHoueRuleProperties.dbValue) {
                selectedObject.props.acp0WestinghousRules.dbValues[0] = [];
            }
            for (var i = 0; i < 10; i++) {
                var vmProp = westingHoueRuleProperties[i];
                selectedObject.props.acp0WestinghousRules.valueUpdated = true;
                selectedObject.props.acp0WestinghousRules.dbValues[i] = vmProp.dbValue;
                selectedObject.props.acp0WestinghousRules.newValue[i] = vmProp.dbValue;
                //Getting all propNames to check in modifiedProp Array
                westingHoueRulePropertiesName.push(westingHoueRuleProperties[i].propertyName);
            }
        }
    }

    // Get all properties that are modified
    //To remove custom props from input to process
    for (var propIndx = 0; propIndx < modifiedViewModelProperties.length; propIndx++) {
        if (westingHoueRulePropertiesName.indexOf(modifiedViewModelProperties[propIndx].propertyName) !== -1) {
            modifiedViewModelProperties.splice(propIndx, 1);
            propIndx--;
        }
    }

    // Prepare the SOA input
    var inputs = [];
    _.forEach(modifiedPropsMap, function (modifiedObj) {
        var modelObject;
        var viewModelObject = modifiedObj.viewModelObject;
        if (viewModelObject && viewModelObject.uid) {
            modelObject = cdm.getObject(viewModelObject.uid);
        }

        if (!modelObject) {
            modelObject = {
                uid: cdm.NULL_UID,
                type: 'unknownType'
            };
        }
        var viewModelProps = modifiedObj.viewModelProps;
        var input = dms.getSaveViewModelEditAndSubmitToWorkflowInput(modelObject);
        _.forEach(viewModelProps, function (props) {
            dms.pushViewModelProperty(input, props);
        });
        inputs.push(input);
    });

    if (inputs.length > 0) {
        // Call SOA to save the modified data
        dms.saveViewModelEditAndSubmitWorkflow(inputs).then(function (response) {
        });
    }
};

/**
 * Call save edit soa
 *@param {deferred} deferred
 * @return  {promise} promise when all modified Function Specification properties get saved
 */
export let callSaveEditSoa = function (input) {
    return soaSvc.post('Internal-AWS2-2018-05-DataManagement', 'saveViewModelEditAndSubmitWorkflow2', input).then(
        function (response) {
            return response;
        },
        function (error) {
            var errMessage = messagingService.getSOAErrorMessage(error);
            messagingService.showError(errMessage);
            throw error;
        }
    );
};

/**
 * Returns dirty bit.
 * @returns {Boolean} isDirty bit
 */
saveHandler.isDirty = function (dataSource) {
    var modifiedPropCount = dataSource.getAllModifiedProperties().length;
    if (modifiedPropCount === 0) {
        return hasPropertiesChangedfromorginalProp(dataSource);
    }
    return true;
};

export let hasPropertiesChangedfromorginalProp = function (dataSource) {
    let selectedObject = dataSource.getLoadedViewModelObjects()[0];
    for (var i = 0; i < 10; i++) {
        var vmProp = westingHoueRuleProperties[i];
        if (vmProp && selectedObject.props.acp0WestinghousRules && //
            selectedObject.props.acp0WestinghousRules.displayValues[i] !== vmProp.displayValues) {
            return true;
        }
    }
    return false;
};

export let isRulePropertiesModified = function () {
    if (westingHoueRuleProperties) {
        var modifiedPropCount = 0;
        _.forEach(westingHoueRuleProperties, function (prop) {
            if (prop.valueUpdated || prop.displayValueUpdated) {
                modifiedPropCount++;
            }
        });

        if (modifiedPropCount === 0) {
            return false;
        }
        return true;
    }
    return false;
};

export default exports = {
    getIndustryRuleName,
    processStandardIndustryRules,
    loadMainRulesPanelData,
    populatePanelData,
    processEditData,
    isPropertyValueTrue,
    getSaveHandler,
    callSaveEditSoa,
    isRulePropertiesModified,
    hasPropertiesChangedfromorginalProp,
    loadControlMethodObject,
    saveControlMethodObjects
};

/**
 * Since this module can be loaded as a dependent DUI module we need to return an object indicating which service
 * should be injected to provide the API for this module.
 */
export let moduleServiceNameToInject = 'Acp0IndustryRuleService';
