// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for characteristics manager from quality center foundation module
 *
 * @module js/Aqc0CharSpecOperationsService
 */
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import messagingService from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import _ from 'lodash';
import logger from 'js/logger';
import eventBus from 'js/eventBus';
import uwPropertySvc from 'js/uwPropertyService';
import aqc0CharLibTreeSvc from 'js/Aqc0CharLibraryTreeTableService';
import aqc0UtilService from 'js/Aqc0UtilService';
import aqc0CharLibraryUtilService from 'js/Aqc0CharLibraryUtilService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';

//Register the default value to show reference part list to show panel
appCtxService.registerCtx('selectedObjectsName');

var exports = {};

/**
 * Bind the object name property for Edit Specification
 *
 * @param data View Model Data
 */
export let bindPropertiesForCharSpecEdit = function (subPanelContext) {
    uwPropertySvc.setIsRequired(subPanelContext.selected.props.object_name, true);
};

/**
 * Method to call the Save Edit SOA
 * @param input Input
 */
export let callSaveEditSoa = function (input) {
    return soaSvc.post('Internal-AWS2-2018-05-DataManagement', 'saveViewModelEditAndSubmitWorkflow2', input).then(
        function (response) {
            var ctx = appCtxService.getCtx();
            if (ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView') {
                // eventBus.publish( 'primaryWorkarea.reset' );
                eventBus.publish('cdm.relatedModified', {
                    relatedModified: [
                        ctx.selected
                    ]
                });
            }
            return response;
        },
        function (error) {
            var errMessage = messagingService.getSOAErrorMessage(error);
            messagingService.showError(errMessage);
            return error;
        }
    );
};
/**
 * This method to create save edit SOA input preperation
 *
 * @param dataSource Data Source
 */
export let createSaveEditSoaInput = function (dataSource) {
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsMap = dataSource.getModifiedPropertiesMap(modifiedViewModelProperties);

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
            if (Array.isArray(props.sourceObjectLastSavedDate)) {
                props.sourceObjectLastSavedDate = props.sourceObjectLastSavedDate[0];
            }
            dms.pushViewModelProperty(input, props);
        });
        inputs.push(input);
    });
    return inputs;
};

/**
 * This method return the value of required property.
 * Currently this method is for prepation of add operation data.
 * @param ctx Context
 * @param data View Model data
 * @param requiredPropName Required Property Name
 */
export let getselectedObject = function (ctx) {
    var deferred = AwPromiseService.instance.defer();
    var selectedObjectToAddFailures = ctx.selected;
    var isCharElement = selectedObjectToAddFailures.modelType.typeHierarchyArray.indexOf('Aqc0QcElement') > -1;
    //Using same for Inspection Definition as well so checking the type for runtime Instance
    if (isCharElement || selectedObjectToAddFailures.modelType.typeHierarchyArray.indexOf('Aqc0CharElementRevision') > -1) {
        var uids = isCharElement ? [selectedObjectToAddFailures.props.awb0UnderlyingObject.dbValues[0]] : [selectedObjectToAddFailures.uid];
        selectedObjectToAddFailures = isCharElement ? cdm.getObject(uids[0]) : selectedObjectToAddFailures;

        if (selectedObjectToAddFailures && !selectedObjectToAddFailures.props.Qc0HasFailures) {
            dms.getProperties(uids, ['Qc0HasFailures'])
                .then(
                    function () {
                        deferred.resolve(appCtxService.updateCtx('selectedObjectToAddFailures', selectedObjectToAddFailures));
                    }
                );
        }
        else {
            deferred.resolve(appCtxService.updateCtx('selectedObjectToAddFailures', selectedObjectToAddFailures));
        }
    }
    else {
        deferred.resolve(appCtxService.updateCtx('selectedObjectToAddFailures', selectedObjectToAddFailures));
    }
    return deferred.promise;
};

/**
 * This method return the value of required property.
 * Currently this method is for prepation of add operation data.
 * @param ctx Context
 * @param data View Model data
 * @param requiredPropName Required Property Name
 */
export let getRequiredValuesForOperation = function (ctx, data, requiredPropName) {
    var propValues = [];
    var selected = ctx.selected;
    var selectedObjectsName = [];
    //Add Action
    if (data.createdActionObject) {
        propValues = [data.createdActionObject.uid];
    }
    //Add Selected Failures
    if (data.selectedObjects) {
        for (var selectedObject of data.selectedObjects) {
            propValues.push(selectedObject.uid);
            //To handel notification messages
            selectedObjectsName.push(selectedObject.props.object_name.dbValues[0]);
        }
        appCtxService.updateCtx('selectedObjectsName', selectedObjectsName);
        //message = data.i18n.PartiallyImportedPMIs.replace( '{0}', selectedObjectsName );
    }
    //Add created/searched References
    if (data.createdObjectForFailReferences) {
        propValues = [data.createdObjectForFailReferences.uid];
    }
    if (data.sourceModelObjects && data.selectedTab.tabKey !== 'new') {
        for (var sourceModelObject of data.sourceModelObjects) {
            propValues.push(sourceModelObject.uid);
        }
    }
    //Add created attachment
    if (data.createdAttachmentObject) {
        propValues = [data.createdAttachmentObject.uid];
    }
    if (selected.modelType.typeHierarchyArray.indexOf('Aqc0QcElement') > -1 || selected.modelType.typeHierarchyArray.indexOf('Aqc0CharElementRevision') > -1) {
        selected = appCtxService.getCtx('selectedObjectToAddFailures');
    }
    //Fetch the values in which needs to be append new value/values.
    for (var qa = 0; qa < selected.props[requiredPropName].dbValues.length; qa++) {
        propValues.push(selected.props[requiredPropName].dbValues[qa]);
    }
    //Add Image to Visual Char Spec
    if (data.createdImageDatasetObjectInVisChar) {
        propValues = [data.createdImageDatasetObjectInVisChar.uid];
    }
    return propValues;
};

/**
 * This method return updated list of given property values.
 * Currently this method is for prepation of remove/replace operation data.
 * @param selectedObjFProp Selected Object For Property
 * @param propName Property Name
 * @param data VIew Model Data
 * @return getUpdatedPropValuesList Updated Property Value list
 */
export let getUpdatedPropValues = function (selectedObjFProp, propName, data) {
    //Fetching the specified property values
    var getPropValues = selectedObjFProp.props[propName].dbValues;
    var objNeedsToBeRemoved = [];
    var objNeedsToBeRemovedNames = [];
    var ctx = appCtxService.getCtx();
    for (var selected of ctx.mselected) {
        objNeedsToBeRemoved.push(selected.uid);
        //To handel notification messages
        objNeedsToBeRemovedNames.push(selected.props.object_name.dbValues[0]);
    }
    //To Handel operations on Inspection definition
    appCtxService.updateCtx('selectedObjectsName', objNeedsToBeRemovedNames);
    appCtxService.updateCtx('selectedObjectToAddFailures', selectedObjFProp);
    //Remove the selected Actions/Failures/attachments/References from fetched data
    var getUpdatedPropValuesList = getPropValues.filter(function (el) {
        return objNeedsToBeRemoved.indexOf(el) < 0;
    });
    //Update To latest failure specification
    if (data.updateToLatestFF !== undefined && data.updateToLatestFF.dbValue === 'Update' && _.findIndex(getUpdatedPropValuesList.indexOf(appCtxService.ctx.latestFailureVers[0].uid) === -1)) {
        getUpdatedPropValuesList.push(appCtxService.ctx.latestFailureVers[0].uid);
    }
    return getUpdatedPropValuesList;
};

/**
 * Method is preparing the setProperties SOA Input
 * @param requiredObject Required Object
 * @param propertyName Property Name
 * @param propertyValue Property Value
 * @return infoInput SOA input
 */
export let getSetPropertiesSOAInput = function (requiredObject, propertyName, propertyValue) {
    var infoInput = {
        object: '',
        timestamp: '',
        vecNameVal: [{
            name: '',
            values: []
        }]
    };
    infoInput.object = requiredObject;
    infoInput.vecNameVal[0].name = propertyName;
    infoInput.vecNameVal[0].values = propertyValue;
    return infoInput;
};
/**
 * Method to call the Save Edit SOA
 * @param input Input for set properties SOA
 * @param data data to do the implementation
 */
export let callSetPropertiesSoa = function (input, data) {
    return soaSvc.post('Core-2010-09-DataManagement', 'setProperties', { info: input }).then(
        function (response) {
            let ctx = appCtxService.getCtx();
            var isCharElement = ctx.pselected && ctx.pselected.modelType.typeHierarchyArray.indexOf('Aqc0QcElement') > -1;
            if (!data.performAddOperation && !isCharElement) {
                eventBus.publish('cdm.relatedModified', {
                    relatedModified: [
                        ctx.pselected
                    ]
                });
            }
            if (data.performAddOperation) {
                eventBus.publish('cdm.relatedModified', {
                    relatedModified: [
                        ctx.selected
                    ]
                });
                eventBus.publish('complete', {
                    source: 'toolAndInfoPanel'
                });
            }
            if (ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView') {
                aqc0CharLibTreeSvc.clearMapOfCharGroupAndSpecification();
            }
            if (isCharElement) {
                eventBus.publish('cdm.relatedModified', {
                    relatedModified: [
                        ctx.selectedObjectToAddFailures
                    ]
                });
            }
            //Handel the messages while remove the objects from the respective object set table
            var selectedObjectsName = appCtxService.getCtx('selectedObjectsName');
            var message;
            if(selectedObjectsName)
            {
                if (selectedObjectsName.length > 1) {
                    message = data.i18n.Aqc0FailuresRemovedMessage.replace('{0}', selectedObjectsName);
                }
                else {
                    message = data.i18n.Aqc0FailureRemovedMessage.replace('{0}', selectedObjectsName);
                }
                messagingService.showInfo(message);
            }            
            return response;
        },
        function (error) {
            var errMessage = messagingService.getSOAErrorMessage(error);
            messagingService.showError(errMessage);
            eventBus.publish('complete', {
                source: 'toolAndInfoPanel'
            });
            return error;
        }
    ).catch(function (exception) {
        logger.error(exception);
    });
};
/**
 * Method to prepare revise input
 * @param selectedObj Selected Object
 * @return reviseInputs Revise inpt
 */
export let getReviseInputsForSpecification = function (selectedObj) {
    var qc0BasedOnIdProp = Number(selectedObj.props.qc0BasedOnId.dbValues[0]) + 1;
    return {
        qc0BasedOnId: [qc0BasedOnIdProp.toString()]
    };
};
/**
 * Method to perform the revise operation
 * @param selectedObj Selected Object
 * @param reviseInputs Revise input
 */
export let performReviseSpecification = function (data, selectedObj, subPanelContext) {
    var reviseInputs = exports.getReviseInputsForSpecification(selectedObj);
    exports.callReviseAndDeepCopySOA(reviseInputs, selectedObj, data, subPanelContext);
};
/**
 * Method to call the revise and deep copydata
 * @param reviseInputs Revise Input
 * @param selectedObj Selected Object
 * @data data View Model Data
 */
export let callReviseAndDeepCopySOA = function (reviseInputs, selectedObj, data, subPanelContext) {
    var deferred = AwPromiseService.instance.defer();
    var inputData = {
        deepCopyDataInput: [{
            businessObject: selectedObj,
            operation: 'Revise'
        }]
    };

    //Calling deepCopy SOA
    soaSvc.post('Core-2014-10-DataManagement', 'getDeepCopyData', inputData).then((response) => {
        let ctx = appCtxService.getCtx();
        if (response) {
            let reviceInputlist = [];
            let reviceInput = {
                deepCopyDatas: exports.convertDeepCopyData(response.deepCopyInfoMap[1][0], false),
                reviseInputs: reviseInputs,
                targetObject: selectedObj
            };
            reviceInputlist.push(reviceInput);
            //Calling reviseObject SOA
            var policyIdLibObj = propertyPolicySvc.register(getPopertyPolicyInCharLib());

            soaSvc.post('Core-2013-05-DataManagement', 'reviseObjects', { reviseIn: reviceInputlist }).then(function (reviseResponse) {
                var createdObject = reviseResponse.output[0].objects[0];
                if (createdObject && ctx.selected.modelType.typeHierarchyArray.indexOf('Qc0MasterCharSpec') > -1) {
                    var sucessMessage = data.i18n.VersionCreated.replace('{0}', createdObject.props.object_name.dbValues[0]);
                    aqc0CharLibraryUtilService.executePostVersionEventActionsForSpecifications(createdObject, subPanelContext, true);
                    messagingService.showInfo(sucessMessage);
                }
                if (policyIdLibObj) {
                    propertyPolicySvc.unregister(policyIdLibObj);
                }
                //Refresh Failure Specification sublocation after revise 262-276
                if (createdObject && ctx.selected.modelType.typeHierarchyArray.indexOf('Qc0Failure') > -1) {
                    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
                    if (searchState) {
                        let searchData = { ...searchState.value };
                        searchData.versionedNode = {};
                        searchData.versionedNode = createdObject;
                        searchData.selectedNodes = [];
                        searchData.selectedNodes.push(createdObject);
                        searchState.update({ ...searchData });
                    }
                    var eventData = {
                        objectsToSelect: [createdObject]
                    };
                    eventBus.publish('aqc0FailureSpecSelectionUpdateEvent', eventData);
                }
                deferred.resolve('successfull');
            }, (error) => {
                var errMessage = messagingService.getSOAErrorMessage(error);
                messagingService.showError(errMessage);
            });
        }
    });
    return deferred.promise;
};

/**
 * Convert Deep Copy Data from client to server format
 *
 * @param deepCopyData property name
 * @return A list of deep copy datas
 */
export let convertDeepCopyData = function (deepCopyData, isSaveAsObject) {
    var deepCopyDataList = [];
    for (var i = 0; i < deepCopyData.length; i++) {
        var newDeepCopyData = {};
        newDeepCopyData.attachedObject = deepCopyData[i].attachedObject;
        newDeepCopyData.copyAction = deepCopyData[i].propertyValuesMap.copyAction[0];
        newDeepCopyData.propertyName = deepCopyData[i].propertyValuesMap.propertyName[0];
        newDeepCopyData.propertyType = deepCopyData[i].propertyValuesMap.propertyType[0];

        var value = false;
        var tempStrValue = deepCopyData[i].propertyValuesMap.copy_relations[0];
        if (tempStrValue === '1') {
            value = true;
        }
        newDeepCopyData.copyRelations = value;

        value = false;
        tempStrValue = deepCopyData[i].propertyValuesMap.isTargetPrimary[0];
        if (tempStrValue === '1') {
            value = true;
        }
        newDeepCopyData.isTargetPrimary = value;

        value = false;
        tempStrValue = deepCopyData[i].propertyValuesMap.isRequired[0];
        if (tempStrValue === '1') {
            value = true;
        }
        newDeepCopyData.isRequired = value;

        newDeepCopyData.operationInputTypeName = deepCopyData[i].operationInputTypeName;

        var operationInputs = {};
        operationInputs = deepCopyData[i].operationInputs;
        newDeepCopyData.operationInputs = operationInputs;

        var aNewChildDeepCopyData = [];
        if (deepCopyData[i].childDeepCopyData && deepCopyData[i].childDeepCopyData.length > 0) {
            aNewChildDeepCopyData = exports.convertDeepCopyData(deepCopyData[i].childDeepCopyData, isSaveAsObject);
        }

        if (isSaveAsObject) {
            newDeepCopyData.saveAsInput = { boName: deepCopyData[i].attachedObject.type };
        }
        newDeepCopyData.childDeepCopyData = aNewChildDeepCopyData;
        deepCopyDataList.push(newDeepCopyData);
    }

    return deepCopyDataList;
};

export let getPopertyPolicyInCharLib = function () {
    return {
        types: [{
            name: 'Qc0Failure',
            properties: [{
                name: 'qc0FailureList'
            }
            ]
        }
        ]
    };
};

export default exports = {
    bindPropertiesForCharSpecEdit,
    createSaveEditSoaInput,
    callSaveEditSoa,
    getRequiredValuesForOperation,
    getSetPropertiesSOAInput,
    getUpdatedPropValues,
    callSetPropertiesSoa,
    getReviseInputsForSpecification,
    performReviseSpecification,
    callReviseAndDeepCopySOA,
    convertDeepCopyData,
    getPopertyPolicyInCharLib,
    getselectedObject
};
