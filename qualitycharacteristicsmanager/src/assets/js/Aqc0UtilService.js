// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Aqc0UtilService
 */
import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxSvc from 'js/appCtxService';
import aqc0CharManage from 'js/Aqc0CharManagerUtils';
import awFileNameUtils from 'js/awFileNameUtils';
import AwPromiseService from 'js/awPromiseService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import commandService from 'js/command.service';
import eventBus from 'js/eventBus';
import listBoxService from 'js/listBoxService';
import logger from 'js/logger';
import messagingSvc from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import aqc0CharSpecOPSvc from 'js/Aqc0CharSpecOperationsService';
import aqc0CharLibraryUtilService from 'js/Aqc0CharLibraryUtilService';
import dms from 'soa/dataManagementService';

var exports = {};
var VAR_CHAR_TYPE = 'Qc0VariableCharSpec';
var VIS_CHAR_TYPE = 'Qc0VisualCharSpec';
var ATT_CHAR_TYPE = 'Qc0AttributiveCharSpec';
var HAS_FAILURE_PROP = 'Qc0HasFailures';
var HAS_ACTION_PROP = 'Qc0HasActions';
var HAS_REFERENCE_PROP = 'Qc0FailureReferences';
var HAS_ATTACHMENT_PROP = 'Qc0FailureAttachments';
var ACTION_TYPE = 'Qam0QualityAction';
var FAILURE_TYPE = 'Qc0Failure';

export let getSelectedChxType = function () {
    //Need to check group type
    var type = appCtxSvc.getCtx('selected.type');
    switch (type) {
        case ATT_CHAR_TYPE:
            return 'Attributive';

        case VIS_CHAR_TYPE:
            return 'Visual';

        case VAR_CHAR_TYPE:
            return 'Variable';
    }
};

/**
  * Find the saved query
  * @param {queryName} inputs - inputCriteria: [{ queryNames: 'String[]', queryDescs:
  *            'String[]', queryType: 'int' }]
  *  @returns {String} the query data
  */
export let findSavedQueries = function (inputs) {
    return soaSvc.post('Query-2010-04-SavedQuery', 'findSavedQueries', inputs);
};

/**
  *
  * @param {*} groupListValue - Group list value
  * @param {*} GroupList - preselect Group.
  * @param {*} dataProvider - Dataprovider
  * @returns
  */
export let getGroupList = function (groupListValue, GroupList, dataProvider) {
    let ctx = appCtxSvc.getCtx();
    var deferred = AwPromiseService.instance.defer();
    let newGroupListValue = { ...groupListValue };
    let newGroupList = { ...GroupList };
    var charGroupUID;
    if (ctx && ctx.selected) {
        var groupRefProp = ctx.selected.props.qc0GroupReference;
        charGroupUID = groupRefProp ? groupRefProp.dbValue : charGroupUID;
    }
    var selectedCharGroupType = getSelectedChxType();
    var searchString = '';
    if (GroupList.filterString !== undefined) { searchString = GroupList.filterString; }
    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Acp0CharsRulesAndNCProvider',
            searchCriteria: {
                type: 'Qc0CharacteristicsGroup',
                charGroupType: selectedCharGroupType,
                searchString: searchString
            },
            searchSortCriteria: [
                {
                    fieldName: 'creation_date',
                    sortDirection: 'DESC'
                }
            ],
            startIndex: dataProvider.startIndex
        }
    };
    // SOA call made to get the content
    soaSvc.post('Internal-AWS2-2016-03-Finder', 'performSearch', inputData).then(function (response) {
        var charGroups = response.searchResults;
        newGroupList.totalFound = response.totalFound;
        if (charGroupUID) {
            var charGroup = cdm.getObject(charGroupUID);
            newGroupList.dbValue = charGroup;
            newGroupList.uiValue = charGroup.props.object_name ? charGroup.props.object_name.dbValues[0] : '';
        }
        newGroupListValue = listBoxService.createListModelObjects(charGroups, 'props.object_name');
        return deferred.resolve({ groupListValue: newGroupListValue, GroupList: newGroupList });
    });
    return deferred.promise;
};
/**
  *
  * @param {String} data - The view model data
  * @param {Object} selectedObjFProp - Selected Object
  * @param {onlyLoadProps} onlyLoadProps - Load Properties Flag
  * @param {relationProp} relationProp Relation Property
  * @param {editOperFlag} editOperFlag Edit Operation Flag
  * @param {deferred} deferred Deferred
  * @param {reviseOperFlag} reviseOperFlag Revise Operation Flag
  * @param {saveDiscardFlag} saveDiscardFlag Save/Discard Operation Flag
  */
export let getPropertiesforSelectedObject = function (data, selectedObjFProp, onlyLoadProps, relationProp, editOperFlag, deferred, reviseOperFlag, saveDiscardFlag, subPanelContext) {
    //To assign selected object to do the required operations
    if (saveDiscardFlag) {
        selectedObjFProp = data.vmo;
    }
    if (deferred === null || deferred === undefined) {
        deferred = AwPromiseService.instance.defer();
    }

    //To handle Inspection Definition selection
    
    if ((selectedObjFProp.modelType.typeHierarchyArray.indexOf('Aqc0QcElement') > -1) || (selectedObjFProp.modelType.typeHierarchyArray.indexOf('Aqc0CharElementRevision') > -1)) {
        if (selectedObjFProp.modelType.typeHierarchyArray.indexOf('Aqc0QcElement') > -1){
            var uids = [selectedObjFProp.props.awb0UnderlyingObject.dbValues[0]];
            selectedObjFProp = cdm.getObject(uids[0]);
    }
        var propsToLoad = [];
        var uids = [selectedObjFProp.uid];
        propsToLoad = [HAS_FAILURE_PROP, HAS_ACTION_PROP];
        propsToLoad = _toPreparePropstoLoadData(selectedObjFProp, propsToLoad);

        if (propsToLoad.length > 0) {
            dms.getProperties(uids, propsToLoad)
                .then(
                    function () {
                        self.performOperationBasedOnVerCheck(data, selectedObjFProp, relationProp, onlyLoadProps, editOperFlag, deferred, reviseOperFlag, saveDiscardFlag, subPanelContext);
                    }
                );
        } else {
            self.performOperationBasedOnVerCheck(data, selectedObjFProp, relationProp, onlyLoadProps, editOperFlag, deferred, reviseOperFlag, saveDiscardFlag, subPanelContext);
        }
    } else {
        self.performOperationBasedOnVerCheck(data, selectedObjFProp, relationProp, onlyLoadProps, editOperFlag, deferred, reviseOperFlag, saveDiscardFlag, subPanelContext);
    }
};


/**
 *This method ensures that the it return proper Inspect Definition object to create the relation
 */
export let createAddFailuresInput = function (selectedObj, data) {
    var underlyingObj = {};
    var input = [];
    var getFailures = {};
    if (selectedObj) {
        var underlyingObjProp = selectedObj.props.awb0UnderlyingObject;
        if (!_.isUndefined(underlyingObjProp)) {
            underlyingObj = cdm.getObject(underlyingObjProp.dbValues[0]);
        } else {
            underlyingObj = selectedObj;
        }
    }

    for (let index = 0; index < data.selectedObjects.length; index++) {
        if (data.selectedObjects) {
            getFailures = data.selectedObjects[index];
        }

        if (getFailures && underlyingObj) {
            var inputData = {
                primaryObject: underlyingObj,
                secondaryObject: getFailures,
                relationType: "Qc0HasFailures",
                clientId: "CreateObject",
                userData: ''
            };
            input.push(inputData);
        }
    }
    if (data.selectedObjects) {
        var propValues = [];
        var selectedObjectsName = [];

        for (var selectedObject of data.selectedObjects) {
            propValues.push(selectedObject.uid);
            selectedObjectsName.push(selectedObject.props.object_name.dbValues[0]);

        }
        appCtxSvc.updateCtx('selectedObjectsName', selectedObjectsName);

    }
    return input;
};



/**
  * For calling specific function
  *
  * @param {data} data - For retrive the required data
  * @param {object} selectedObjFProp - selected Object
  * @param {relationProp} relationProp Relation Property
  */
self.performOperationsOnSelectedObject = function (data, selectedObjFProp, relationProp) {
    // To get the required prop values to perform the operation
    var UpdatedPropValues;
    UpdatedPropValues = !data.performAddOperation ? aqc0CharSpecOPSvc.getUpdatedPropValues(selectedObjFProp, relationProp, data) : //
        aqc0CharSpecOPSvc.getRequiredValuesForOperation(appCtxSvc.ctx, data, relationProp);
    //Prepare set property SOA Input
    var setPropSOAInput = aqc0CharSpecOPSvc.getSetPropertiesSOAInput(selectedObjFProp, relationProp, UpdatedPropValues);
    //Call Set Properties SOA.
    aqc0CharSpecOPSvc.callSetPropertiesSoa([setPropSOAInput], data);
};

/**
  * This function is to check tc version and perform respective action
  * @param {data} data - For retrive the required data
  * @param {object} selectedObjFProp - selected Object
  * @param {relationProp} relationProp Relation Property
  * @param {onlyLoadProps} onlyLoadProps - Load Properties Flag
  * @param {editOperFlag} editOperFlag Edit Operation Flag
  * @param {deferred} deferred Deferred
  * @param {reviseOperFlag} reviseOperFlag Revise Operation Flag
  * @param {saveDiscardFlag} saveDiscardFlag Save/Discard Operation Flag
  */
self.performOperationBasedOnVerCheck = function (data, selectedObjFProp, relationProp, onlyLoadProps, editOperFlag, deferred, reviseOperFlag, saveDiscardFlag, subPanelContext) {
    aqc0CharManage.getSupportedTCVersion();
    let isTC13_2OnwardsSupported = appCtxSvc.getCtx('isTC13_2OnwardsSupported');
    if (isTC13_2OnwardsSupported) {
        !onlyLoadProps ? self.performOperationsOnSelectedObject(data, selectedObjFProp, relationProp) : 'nothing to do';
        reviseOperFlag ? aqc0CharSpecOPSvc.performReviseSpecification(data, selectedObjFProp, subPanelContext) : 'nothing to do';
    }
    if (isTC13_2OnwardsSupported === false) {
        self.addRemoveActionFVersion(data, selectedObjFProp, subPanelContext, data.i18n, data.updateToLatestFF);
    }
    editOperFlag ? aqc0CharManage.performSaveEdit(data, deferred, selectedObjFProp, saveDiscardFlag) : 'nothing to do';
};

/**
  * For calling specific function
  *
  * @param {data} data - For retrive the required data
  * @param {object} selectedObjFProp - selected Object
  */
self.addRemoveActionFVersion = function (data, selectedObjFProp, subPanelContext, i18nStrings, updateToLatestFF) {
    let ctx = appCtxSvc.getCtx();
    if (selectedObjFProp === ctx.pselected && ctx.pselected.type !== 'Qc0Failure') {
        exports.removeActionAndCreateVersion(getVersionInputFRAction(updateToLatestFF), subPanelContext, i18nStrings);
    }
    if (selectedObjFProp === ctx.pselected && ctx.pselected.type === 'Qc0Failure') {
        exports.removeActionAndCreateVersion(getVersionInputFailureFRAction(), subPanelContext, i18nStrings);
    }
    if (selectedObjFProp === ctx.selected && ctx.selected.type !== 'Qc0Failure') {
        exports.getVersionInputFAction(data);
        eventBus.publish('aqc0.createVersion');
    }
    if (selectedObjFProp === ctx.selected && ctx.selected.type === 'Qc0Failure') {
        exports.getVersionInputFFailAction(data);
        eventBus.publish('aqc0.createVersion');
    }
};

/**
  * @param {data} data
  * This method is used to get the input for the versioning soa
  * @returns {ArrayList} the arrayList of the object with input for versioning soa
  */
export let getVersionInputFAction = function (data) {
    let ctx = appCtxSvc.getCtx();
    var versionInputData = [{
        clientId: 'AWClient',
        sourceSpecification: {
            type: ctx.selected.type,
            uid: ctx.selected.uid
        },
        data: {
            stringProps: {},
            intProps: {},
            doubleProps: {},
            tagArrayProps: {},
            tagProps: {
                qc0GroupReference: {
                    type: 'Qc0CharacteristicsGroup',
                    uid: ctx.selected.props.qc0GroupReference.dbValues[0]
                }
            }
        }
    }];

    versionInputData[0].data.stringProps.object_name = ctx.selected.props.object_name.dbValues[0];
    versionInputData[0].data.stringProps.object_desc = ctx.selected.props.object_desc.dbValues[0];
    versionInputData[0].data.stringProps.qc0Context = ctx.selected.props.qc0Context.dbValues[0];
    versionInputData[0].data.stringProps.qc0Criticality = ctx.selected.props.qc0Criticality.dbValues[0];
    versionInputData[0].data.intProps.qc0BasedOnId = Number(ctx.selected.props.qc0BasedOnId.dbValues[0]) + 1;

    if (ctx.selected.type === 'Qc0VariableCharSpec') {
        versionInputData[0].data.tagProps.qc0UnitOfMeasure = {
            type: 'qc0UnitOfMeasure',
            uid: ctx.selected.props.qc0UnitOfMeasure.dbValues[0]
        };
        if (ctx.isTC12_4OnwardsSupported) {
            versionInputData[0].data.stringProps.qc0limitation = ctx.selected.props.qc0limitation.dbValues[0];
        }
        if (ctx.isTC13_1OnwardsSupported) {
            versionInputData[0].data.stringProps.qc0ToleranceType = ctx.selected.props.qc0ToleranceType.dbValues[0];
        }
        versionInputData[0].data.doubleProps.qc0NominalValue = Number(ctx.selected.props.qc0NominalValue.dbValues[0]);
        versionInputData[0].data.doubleProps.qc0LowerTolerance = Number(ctx.selected.props.qc0LowerTolerance.dbValues[0]);
        versionInputData[0].data.doubleProps.qc0UpperTolerance = Number(ctx.selected.props.qc0UpperTolerance.dbValues[0]);
    }

    if (ctx.selected.type === 'Qc0AttributiveCharSpec') {
        versionInputData[0].data.stringProps.qc0OkDescription = ctx.selected.props.qc0OkDescription.dbValues[0];
        versionInputData[0].data.stringProps.qc0NokDescription = ctx.selected.props.qc0NokDescription.dbValues[0];
    }

    var actions = [];
    var panelId = data.getPanelId();

    if (panelId === 'Aqc0AddActionForCharSpec') {
        actions = [{
            type: data.createdActionObject.type,
            uid: data.createdActionObject.uid
        }];
    }
    for (var qa = 0; qa < ctx.selected.props.Qc0HasActions.dbValues.length; qa++) {
        var hasAction = {};
        hasAction.type = ACTION_TYPE;
        hasAction.uid = ctx.selected.props.Qc0HasActions.dbValues[qa];
        actions.push(hasAction);
    }
    versionInputData[0].data.tagArrayProps.qc0Qc0HasActions = actions;

    var failuresToAdd = [];
    if (panelId === 'Aqc0AddFailuresToCharSepc') {
        var dataWithFailures = exports.checkDuplicatesAndAddFailures(data);
        if (dataWithFailures.selectedObjects) {
            failuresToAdd = dataWithFailures.selectedObjects;
        }
    }
    for (var qfailures = 0; ctx.selected.props.Qc0HasFailures && qfailures < ctx.selected.props.Qc0HasFailures.dbValues.length; qfailures++) {
        var hasFailures = {};
        hasFailures.type = FAILURE_TYPE;
        hasFailures.uid = ctx.selected.props.Qc0HasFailures.dbValues[qfailures];
        failuresToAdd.push(hasFailures);
    }
    versionInputData[0].data.tagArrayProps.qc0Qc0HasFailures = failuresToAdd;

    if (ctx.selected.type === 'Qc0VisualCharSpec') {
        var imageDataset = [];
        versionInputData[0].data.intProps.qc0GridRows = Number(ctx.selected.props.qc0GridRows.dbValues[0]);
        versionInputData[0].data.intProps.qc0GridColumns = Number(ctx.selected.props.qc0GridColumns.dbValues[0]);
        if (panelId === 'Aqc0AttachImageToVisCharSpec') {
            imageDataset = [{
                type: data.createdImageDatasetObjectInVisChar.type,
                uid: data.createdImageDatasetObjectInVisChar.uid
            }];
        } else {
            if (ctx.selected.props.IMAN_specification.dbValues.length > 0) {
                var hasImageDataset = {};
                hasImageDataset.type = 'Image';
                hasImageDataset.uid = ctx.selected.props.IMAN_specification.dbValues[0];
                imageDataset.push(hasImageDataset);
            } else {
                imageDataset.push(null);
            }
        }
        versionInputData[0].data.tagArrayProps.qc0IMAN_specification = imageDataset;
    }
    data.versionInputDataFVM = versionInputData;
    return versionInputData;
};

/**
  * This method is used to get the input for the versioning soa
  * @returns {ArrayList} the arrayList of the object with input for versioning soa
  */
export let getVersionInputFRAction = function (updateToLatestFF) {
    let ctx = appCtxSvc.getCtx();
    var versionInputData = [{
        clientId: 'AWClient',
        sourceSpecification: {
            type: ctx.pselected.type,
            uid: ctx.pselected.uid
        },
        data: {
            stringProps: {},
            intProps: {},
            doubleProps: {},
            tagArrayProps: {},
            tagProps: {
                qc0GroupReference: {
                    type: 'Qc0CharacteristicsGroup',
                    uid: ctx.pselected.props.qc0GroupReference.dbValues[0]
                }
            }
        }
    }];

    versionInputData[0].data.stringProps.object_name = ctx.pselected.props.object_name.dbValues[0];
    versionInputData[0].data.stringProps.object_desc = ctx.pselected.props.object_desc.dbValues[0];
    versionInputData[0].data.stringProps.qc0Context = ctx.pselected.props.qc0Context.dbValues[0];
    versionInputData[0].data.stringProps.qc0Criticality = ctx.pselected.props.qc0Criticality.dbValues[0];
    versionInputData[0].data.intProps.qc0BasedOnId = Number(ctx.pselected.props.qc0BasedOnId.dbValues[0]) + 1;

    if (ctx.pselected.type === 'Qc0VariableCharSpec') {
        versionInputData[0].data.tagProps.qc0UnitOfMeasure = {
            type: 'qc0UnitOfMeasure',
            uid: ctx.pselected.props.qc0UnitOfMeasure.dbValues[0]
        };
        if (ctx.isTC12_4OnwardsSupported) {
            versionInputData[0].data.stringProps.qc0limitation = ctx.pselected.props.qc0limitation.dbValues[0];
        }
        if (ctx.isTC13_1OnwardsSupported) {
            versionInputData[0].data.stringProps.qc0ToleranceType = ctx.pselected.props.qc0ToleranceType.dbValues[0];
        }
        versionInputData[0].data.doubleProps.qc0NominalValue = Number(ctx.pselected.props.qc0NominalValue.dbValues[0]);
        versionInputData[0].data.doubleProps.qc0LowerTolerance = Number(ctx.pselected.props.qc0LowerTolerance.dbValues[0]);
        versionInputData[0].data.doubleProps.qc0UpperTolerance = Number(ctx.pselected.props.qc0UpperTolerance.dbValues[0]);
    }

    if (ctx.pselected.type === 'Qc0AttributiveCharSpec') {
        versionInputData[0].data.stringProps.qc0OkDescription = ctx.pselected.props.qc0OkDescription.dbValues[0];
        versionInputData[0].data.stringProps.qc0NokDescription = ctx.pselected.props.qc0NokDescription.dbValues[0];
    }

    var actionProp = '';
    var actionPropSec = '';
    var afobjType = '';
    var afobjTypeSec = '';
    if (ctx.mselected[0].type === 'Qam0QualityAction') {
        actionProp = HAS_ACTION_PROP;
        actionPropSec = HAS_FAILURE_PROP;
        afobjType = ACTION_TYPE;
        afobjTypeSec = FAILURE_TYPE;
    } else {
        if (ctx.mselected[0].type === 'Qc0Failure') {
            actionProp = HAS_FAILURE_PROP;
            actionPropSec = HAS_ACTION_PROP;
            afobjType = FAILURE_TYPE;
            afobjTypeSec = ACTION_TYPE;
        }
    }

    var selectedPropValues = [];

    if (ctx.pselected.props[actionProp].dbValues.length === ctx.mselected.length && updateToLatestFF === undefined) {
        selectedPropValues.push(null);
    } else {
        for (var qa = 0; qa < ctx.pselected.props[actionProp].dbValues.length; qa++) {
            for (var ms = 0; ms < ctx.mselected.length; ms++) {
                var hasAction = {};
                hasAction.type = afobjType;
                hasAction.uid = ctx.pselected.props[actionProp].dbValues[qa];

                if (_.findIndex(ctx.mselected, ['uid', hasAction.uid]) === -1 && _.findIndex(selectedPropValues, ['uid', hasAction.uid]) === -1) {
                    selectedPropValues.push(hasAction);
                }
                if (updateToLatestFF !== undefined && updateToLatestFF.dbValue === 'Update' && _.findIndex(selectedPropValues, ['uid', ctx.latestFailureVers[0].uid]) === -1) {
                    var LatestFailure = {};
                    LatestFailure.type = afobjType;
                    LatestFailure.uid = ctx.latestFailureVers[0].uid;
                    selectedPropValues.push(LatestFailure);
                }
            }
        }
    }
    versionInputData[0].data.tagArrayProps['qc0' + actionProp] = selectedPropValues;

    // carry forward
    var CFPropValues = [];
    for (var qa1 = 0; qa1 < ctx.pselected.props[actionPropSec].dbValues.length; qa1++) {
        CFPropValues.push({ type: afobjTypeSec, uid: ctx.pselected.props[actionPropSec].dbValues[qa1] });
    }
    versionInputData[0].data.tagArrayProps['qc0' + actionPropSec] = CFPropValues;

    if (ctx.pselected.type === 'Qc0VisualCharSpec') {
        var imageDatasetWR = [];
        versionInputData[0].data.intProps.qc0GridRows = Number(ctx.pselected.props.qc0GridRows.dbValues[0]);
        versionInputData[0].data.intProps.qc0GridColumns = Number(ctx.pselected.props.qc0GridColumns.dbValues[0]);
        if (ctx.pselected.props.IMAN_specification.dbValues.length > 0) {
            var hasImageDataset = {};
            hasImageDataset.type = 'Image';
            hasImageDataset.uid = ctx.pselected.props.IMAN_specification.dbValues[0];
            imageDatasetWR.push(hasImageDataset);
        } else {
            imageDatasetWR.push(null);
        }
        versionInputData[0].data.tagArrayProps.qc0IMAN_specification = imageDatasetWR;
    }
    //data.versionInputDataFVM = versionInputData;
    return versionInputData;
};

/**
  * This method is used to get the input for the versioning soa
  * @param {object} versionInputData - version Input
  * @param {object} subPanelContext -sub Panel Context to update the component state
  */
export let removeActionAndCreateVersion = function (versionInputData, subPanelContext, i18nStrings) {
    var inputData = {
        specificationInputs: versionInputData
    };
    soaSvc.post('Internal-CharManagerAW-2018-12-QualityManagement', 'createSpecificationVersion', inputData).then(function (response) {
        var ctx = appCtxSvc.getCtx();
        var createdObject = response.specificationsOutput[0].newSpecification;
        if (response.specificationsOutput[0]) {
            //var sucessMessage = '"' + data.createdObject.props.object_name.dbValues[0] + '" version was created';
            var sucessMessage = i18nStrings.VersionCreated.replace('{0}', createdObject.props.object_name.dbValues[0]);
            ctx.pselected.modelType.typeHierarchyArray.indexOf('Qc0MasterCharSpec') > -1 ? aqc0CharLibraryUtilService.executePostVersionEventActionsForSpecifications(createdObject, subPanelContext, true) : 'Nothing to do';
            ctx.pselected.modelType.typeHierarchyArray.indexOf('Qc0Failure') > -1 ? exports.executePostVersionEventActionsForFailureSpec(createdObject, subPanelContext, true) : 'Nothing to do';
            messagingSvc.showInfo(sucessMessage);
        }
    }, function (error) {
        var errMessage = messagingSvc.getSOAErrorMessage(error);
        messagingSvc.showError(errMessage);
    })
        .catch(function (exception) {
            logger.error(i18nStrings.FailedToCreateVersion);
            logger.error(exception);
        });
};

/**
  * This method is used to get the input for the versioning soa
  * @returns {ArrayList} the arrayList of the object with input for versioning soa
  */
export let getVersionInputFailureFRAction = function () {
    let ctx = appCtxSvc.getCtx();
    var versionInputData = [{
        clientId: 'AWClient',
        sourceSpecification: {
            type: ctx.pselected.type,
            uid: ctx.pselected.uid
        },
        data: {
            stringProps: {},
            intProps: {},
            doubleProps: {},
            tagArrayProps: {},
            tagProps: {},
            boolProps: {}
        }
    }];

    versionInputData[0].data.stringProps.object_name = ctx.pselected.props.object_name.dbValues[0];
    versionInputData[0].data.stringProps.object_desc = ctx.pselected.props.object_desc.dbValues[0];
    if (ctx.pselected.props.qc0Status.dbValues[0] === '1') {
        versionInputData[0].data.boolProps.qc0Status = true;
    } else {
        versionInputData[0].data.boolProps.qc0Status = false;
    }
    versionInputData[0].data.stringProps.qc0FailureCode = ctx.pselected.props.qc0FailureCode.dbValues[0];
    versionInputData[0].data.tagProps.qc0ParentFailure = cdm.getObject(ctx.pselected.props.qc0ParentFailure.dbValues[0]);
    versionInputData[0].data.intProps.qc0BasedOnId = Number(ctx.pselected.props.qc0BasedOnId.dbValues[0]) + 1;
    versionInputData[0].data.tagArrayProps['qc0' + HAS_ACTION_PROP] = _removeAndCarryForwardForFailureSpec(HAS_ACTION_PROP);
    versionInputData[0].data.tagArrayProps['qc0' + HAS_REFERENCE_PROP] = _removeAndCarryForwardForFailureSpec(HAS_REFERENCE_PROP);
    versionInputData[0].data.tagArrayProps['qc0' + HAS_ATTACHMENT_PROP] = _removeAndCarryForwardForFailureSpec(HAS_ATTACHMENT_PROP);
    return versionInputData;
};

/**
  * This method provides the selected failures for adding them to the characteristics specification
  * @param {Object} data data for the selected panel
  * @param {Object} ctx context for the selected panel
  * @returns {ArrayList} ArrayList for the selected failures
  */
export let checkDuplicatesAndAddFailures = function (data) {
    var ctx = appCtxSvc.getCtx();
    var loadedVMObjects = data.dataProviders.failureListProvider.viewModelCollection.loadedVMObjects;
    var selected = ctx.selected;
    data.selectedObjects = [];
    data.selctedObjectsOlderVersionNames = [];
    data.selectedObjectsAlreadyPresentNames = [];
    if (selected.modelType.typeHierarchyArray.indexOf('Aqc0QcElement') > -1 || selected.modelType.typeHierarchyArray.indexOf('Aqc0CharElementRevision') > -1) {
        selected = appCtxSvc.getCtx('selectedObjectToAddFailures');
    }
    var existingFailures = selected.props.Qc0HasFailures ? selected.props.Qc0HasFailures.dbValues : [];

    //Code added to resolve defect LCS-795758 - User can add duplicate failure to inspection definition if its version is different
    var failureObjects = {
        uids: existingFailures
    };
    var deferred = AwPromiseService.instance.defer();
    return soaSvc.post('Core-2007-09-DataManagement', 'loadObjects', failureObjects).then(function (response) {
        checkObjects(data, existingFailures, loadedVMObjects);
        return deferred.resolve(data);
    }, function (reason) {
        deferred.reject(reason);
    });
};

/**
  * This method check for duplicate objects
  */
export let checkObjects = function (data, existingFailures, loadedVMObjects) {
    var existingFailuresObject = [];
    for (var index = 0; index < existingFailures.length; index++) {
        var failureObject = cdm.getObject(existingFailures[index]);
        if (failureObject && failureObject.props.qc0IsLatest.dbValues[0] !== '1') {
            existingFailuresObject.push(failureObject.props.qc0FailureCode.dbValues[0]);
        }
    }

    _.find(loadedVMObjects, function (viewmodel) {
        if (viewmodel.selected === true) {
            if (existingFailures.length === 0) {
                data.selectedObjects.push({ type: FAILURE_TYPE, uid: viewmodel.uid, props: viewmodel.props });
            } else if (existingFailuresObject.indexOf(viewmodel.props.qc0FailureCode.dbValues[0]) !== -1) {
                data.selctedObjectsOlderVersionNames.push(viewmodel.props.qc0FailureCode.dbValues[0]);
            }
            if (existingFailures.length !== 0 && !_.includes(existingFailures, viewmodel.uid) && !_.includes(existingFailuresObject, viewmodel.props.qc0FailureCode.dbValues[0])) {
                data.selectedObjects.push({ type: FAILURE_TYPE, uid: viewmodel.uid, props: viewmodel.props });
            }
            //Below condition is updated because older versiona nd already exists, these two messages were coming
            if (existingFailures.length !== 0 && _.includes(existingFailures, viewmodel.uid) && !_.includes(data.selctedObjectsOlderVersionNames, viewmodel.props.qc0FailureCode.dbValues[0])) {
                data.selectedObjectsAlreadyPresentNames.push(viewmodel.props.qc0FailureCode.dbValues[0]);
            }
        }
    });
};
/**
  * @param {data} data
  * This method is used to get the input for the versioning soa
  * @returns {ArrayList} the arrayList of the object with input for versioning soa
  */
export let getVersionInputFFailAction = function (data) {
    let ctx = appCtxSvc.getCtx();
    var versionInputData = [{
        clientId: 'AWClient',
        sourceSpecification: {
            type: ctx.selected.type,
            uid: ctx.selected.uid
        },
        data: {
            stringProps: {},
            intProps: {},
            doubleProps: {},
            tagArrayProps: {},
            tagProps: {},
            boolProps: {}
        }
    }];
    var actions = [];
    var references = [];
    var attchments = [];
    var panelId = data.getPanelId();

    versionInputData[0].data.stringProps.object_name = ctx.selected.props.object_name.dbValues[0];
    versionInputData[0].data.stringProps.object_desc = ctx.selected.props.object_desc.dbValues[0];
    if (ctx.selected.props.qc0Status.dbValues[0] === '1') {
        versionInputData[0].data.boolProps.qc0Status = true;
    } else {
        versionInputData[0].data.boolProps.qc0Status = false;
    }
    versionInputData[0].data.stringProps.qc0FailureCode = ctx.selected.props.qc0FailureCode.dbValues[0];
    versionInputData[0].data.tagProps.qc0ParentFailure = cdm.getObject(ctx.selected.props.qc0ParentFailure.dbValues[0]);
    versionInputData[0].data.intProps.qc0BasedOnId = Number(ctx.selected.props.qc0BasedOnId.dbValues[0]) + 1;
    if (panelId === 'Aqc0AddActionForCharSpec') {
        actions = [{
            type: data.createdActionObject.type,
            uid: data.createdActionObject.uid
        }];
    } else if (panelId === 'Aqc0AddReferencesToFailureObject') {
        if (data.addPanelState.selectedTab.tabKey !== 'new') {
            references = data.addPanelState.sourceObjects;
        } else {
            references = [{
                type: 'AAAAAAAAA',
                uid: data.createdObjectForFailReferences.uid
            }];
        }
    } else if (panelId === 'Aqc0AddAttachmentToFailureSpec') {
        attchments = [{
            type: data.createdAttachmentObject.type,
            uid: data.createdAttachmentObject.uid
        }];
    }

    for (var qa = 0; qa < ctx.selected.props.Qc0HasActions.dbValues.length; qa++) {
        var hasAction = {};
        hasAction.type = ACTION_TYPE;
        hasAction.uid = ctx.selected.props.Qc0HasActions.dbValues[qa];
        actions.push(hasAction);
    }
    for (var ref = 0; ref < ctx.selected.props.Qc0FailureReferences.dbValues.length; ref++) {
        var reference = {};
        reference.type = 'AAAAAAAAA';
        reference.uid = ctx.selected.props.Qc0FailureReferences.dbValues[ref];
        references.push(reference);
    }
    for (var dataset = 0; dataset < ctx.selected.props.Qc0FailureAttachments.dbValues.length; dataset++) {
        var attchment = {};
        attchment.type = 'AAAAAAAAA';
        attchment.uid = ctx.selected.props.Qc0FailureAttachments.dbValues[dataset];
        attchments.push(attchment);
    }
    if (actions.length > 0) {
        versionInputData[0].data.tagArrayProps.qc0Qc0HasActions = actions;
    }
    if (references.length > 0) {
        versionInputData[0].data.tagArrayProps.qc0Qc0FailureReferences = references;
    }
    if (attchments.length > 0) {
        versionInputData[0].data.tagArrayProps.qc0Qc0FailureAttachments = attchments;
    }
    data.versionInputDataFVM = versionInputData;
    return versionInputData;
};

/** This method contains the carry forward logic for failure specification when user REMOVES the attachment/reference/quality action
  * @param { Object } prop - identifies the type to carry forward ( attachments/references/QA )
  * @returns { Object } selectedPropValues - this object contains the tagArrayProps which need to be carry forwarded
  */
function _removeAndCarryForwardForFailureSpec(prop) {
    var selectedPropValues = [];
    var objType = 'AAAAAA';
    let ctx = appCtxSvc.getCtx();
    for (var qa = 0; qa < ctx.pselected.props[prop].dbValues.length; qa++) {
        for (var ms = 0; ms < ctx.mselected.length; ms++) {
            var hasProp = {};
            hasProp.type = objType;
            hasProp.uid = ctx.pselected.props[prop].dbValues[qa];

            if (_.findIndex(ctx.mselected, ['uid', hasProp.uid]) === -1 && _.findIndex(selectedPropValues, ['uid', hasProp.uid]) === -1) {
                selectedPropValues.push(hasProp);
            }
        }
    }
    if (selectedPropValues.length === 0) {
        selectedPropValues = [null];
    }
    return selectedPropValues;
}

/**
  * This method returns the localised display names for the given properties.
  * This method assumes that the type information is already loaded in client meta model.
  *
  * @param {Sting} type Model Object Type
  * @param {StingArray} propertyNames Array of internal property names
  * @returns {StingArray}  Array of localised property display names
  */
export let getSavedQueryEntries = function (type, propertyNames) {
    var propertyDisplayNames = [];
    propertyNames = propertyNames.slice(1, -1).split(',');
    if (type && propertyNames && propertyNames.length) {
        var modelType = cmm.getType(type);
        for (var i = 0; i < propertyNames.length; i++) {
            var propDesc = modelType.propertyDescriptorsMap[propertyNames[i]];
            propertyDisplayNames.push(propDesc.displayName);
        }
    }
    return propertyDisplayNames;
};

/** This method passes the values to be considered while fetching the latest released failure spec in comparison mode
  *  @param {Sting} type Model Object Type
  *  @param {StingArray} propertyValues Array of property values to be considered prior to TC13.2
  *  @returns {StingArray}  Array of property values to be considered after TC13.2
  */
export let getValuesToPass = function () {
    return [
        'true',
        appCtxSvc.ctx.selected.props.qc0FailureCode.dbValue
    ];
};

/**
  *Returns the search filter string .wild character is returned if an empty string is passed.
  *
  * @param {Sting} filterString filter string
  * @returns {Sting}  filter string or wild character
  */
export let getSearchFailureFilterBoxValue = function (filterString) {
    if (filterString && filterString.trim() !== '') {
        return '*' + filterString + '*';
    }
    return '*';
};

/**
  * Returns the search criteria with vaild inputs for characteristics library sublocation.
  * It also populates the search filter information.
  */
export let getSearchCriteriaInputForCharLib = function () {
    var searchCriteriaInput = {};
    let search = appCtxSvc.getCtx('search');
    if (search && search.criteria) {
        var criteria = search.criteria;
        // Populate the search criteria input
        searchCriteriaInput = {
            queryName: criteria.queryName,
            searchID: criteria.searchID,
            lastEndIndex: criteria.lastEndIndex,
            totalObjectsFoundReportedToClient: criteria.totalObjectsFoundReportedToClient,
            typeOfSearch: criteria.typeOfSearch,
            utcOffset: criteria.utcOffset,
            Type: criteria.Type
        };

        // Add the 'name' key to the search createria only if a vaild search filter is present.
        if (criteria.searchString && criteria.searchString.trim().length > 0) {
            searchCriteriaInput.Name = exports.getSearchFailureFilterBoxValue(criteria.searchString);
        }
    }
    return searchCriteriaInput;
};
/**
  * Set the selected node value when doing the Failure Version as part of add/Remove actions,references and attchments.
  */
export let pushSelectedNodeInFailureContext = function (createdObject) {
    //appCtxSvc.ctx.failureManagerContext.selectedNodes = [];
    appCtxSvc.updateCtx('failureManagerContext.selectedNodes', []);
    appCtxSvc.ctx.failureManagerContext.selectedNodes.push(createdObject);
};
/**
  * function returns file extension.
  */
export let getFileExtension = function (data) {
    var fileExtension = awFileNameUtils.getFileExtension(data.fileName);
    data.datasetName.dbValue = data.fileName.split('.')[0];
    data.fileExtension = fileExtension.split('.').pop();
    return data;
};
/**
  * function returns file update selected dataset type.
  */
export let updateCurrentDatasetType = function (data) {
    data.datasetType.dbValue = data.datasetTypeList[0].propInternalValue.props.object_string.dbValues[0];
    data.datasetType.uiValue = data.datasetTypeList[0].propInternalValue.props.object_string.dbValues[0];
    data.isText = data.reference[0].fileFormat === 'TEXT';
    return data;
};

/**Function is called while creating the naming convention from the characteristics library(when create panel is pinned).
  * @param { String } - Next value for the object name as per naming pattern
  * @param { Object } - Data object is passed to the function to set the next dbValue for creating the object
  */
export let setNewValueForNamingConvention = function (nextValue, data) {
    data.object_name.dbValue = nextValue;
    data.object_name.dbValues[0] = nextValue;
};

/**
  *  This method creates the input for attaching the references to the failure specification
  *  @param { Object } data - data for getting object name and to put createdObject
  *  @returns { Object } createdObject - created object
  *
  */
export let getCreateInputForCreateObject = function (data, creationType, selectedTab, editHandler) {
    var deferred = AwPromiseService.instance.defer();

    if (selectedTab.tabKey === 'new') {
        var createInput = addObjectUtils.getCreateInput(data, null, creationType, editHandler);
        var Inputs = {
            inputs: createInput
        };
        soaSvc.post('Core-2016-09-DataManagement', 'createAttachAndSubmitObjects', Inputs).then(function (response) {
            var values = response.ServiceData.created.map(function (Objuid) {
                return response.ServiceData.modelObjects[Objuid];
            });
            if (values && values.length > 0) {
                _.forEach(values, function (val) {
                    if (val.modelType.typeHierarchyArray.indexOf('ItemRevision') > -1) {
                        deferred.resolve(val);
                    }
                });
            } else {
                deferred.resolve(response);
            }
        },
            function (error) {
                deferred.reject(error);
            });
    } else {
        data.createdObject = data.addPanelState.sourceObjects[0];
        deferred.resolve(data);
    }

    return deferred.promise;
};

export let getCreateInputForCreateChecklistObject = function (data, creationType, selectedTab, editHandler) {
    var deferred = AwPromiseService.instance.defer();

    if (selectedTab.tabKey === 'new') {
        var createInput = addObjectUtils.getCreateInput(data, null, creationType, editHandler);
        var Inputs = {
            inputs: createInput
        };
        soaSvc.post('Core-2016-09-DataManagement', 'createAttachAndSubmitObjects', Inputs).then(function (response) {
            var values = response.ServiceData.created.map(function (Objuid) {
                return response.ServiceData.modelObjects[Objuid];
            });
            if (values && values.length > 0) {
                _.forEach(values, function (val) {
                    if (val.modelType.typeHierarchyArray.indexOf('ItemRevision') > -1) {
                        deferred.resolve(val);
                    }
                });
            } else {
                deferred.resolve(response);
            }
        },
            function (error) {
                deferred.reject(error);
            });
    } else {
        data.createdObject = data.addPanelState.sourceObjects[0];
        deferred.resolve(data.createdObject);
    }

    return deferred.promise;
};

export let subscribeContentLoaded = function () {
    let ctx = appCtxSvc.getCtx();
    eventBus.subscribe('awXRT2.contentLoaded', function () {
        //Open object in edit mode after create or version operation.
        if (ctx.newlyCeatedObj) {
            ctx.newlyCeatedObj = false;
            var viewMode = ctx.ViewModeContext.ViewModeContext;
            var executeCommandId = viewMode === 'TreeSummaryView' ? 'Awp0StartEditSummary' : 'Awp0StartEdit';
            commandService.executeCommand(executeCommandId);
        }
        //To fix the defect LCS-497880 - Group List not updated on Save As Panel In tree view if selection change is for different type of char spec objects
        // Subscribe xrt2 content loaded event for on revel of SaveAS panel only when action done in tree view.
        if (ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView' && ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId ===
            'Aqc0SaveAsVariableCharSpec' || ctx.activeToolsAndInfoCommand.commandId ===
            'Aqc0SaveAsAttributiveCharSpec' || ctx.activeToolsAndInfoCommand.commandId ===
            'Aqc0SaveAsVisualCharSpec') {
            eventBus.publish('aqc0SelectionChangeForSaveAs.refreshGroupList');
            eventBus.publish('aqc0SelectionChangeForSaveAs.loadUnitOfMeasure');
        }
    });
};
// Below are the required functions for Specification operations.
/*
  * This method to return the property lists which needs to be loaded
  */
function _toPreparePropstoLoadData(selectedCondObj, propsToLoad) {
    var propsToLoadData = [];
    for (var prop of propsToLoad) {
        if (!selectedCondObj.props.prop) {
            propsToLoadData.push(prop);
        }
    }
    return propsToLoadData;
}

export let getLastReleased = function (response, data) {
    appCtxSvc.ctx.showMessage = true;
    let values = response.ServiceData.plain.map(function (Objuid) {
        return response.ServiceData.modelObjects[Objuid];
    });

    if (appCtxSvc.ctx.selected.props.qc0BasedOnId.dbValues[0] !== values[0].props.qc0BasedOnId.dbValues[0]) {
        appCtxSvc.ctx.showMessage = false;
        return values;
    }
    return;
};

/** This function calls the soa/saved query based on TC version
  *  @param { Object } data - data object from view model
  *  @returns { Object } Promise - promis object containing the response
  */
export let getFailureObjects = function (data) {
    var deferred = AwPromiseService.instance.defer();
    aqc0CharManage.getSupportedTCVersion();
    let isTC13_2OnwardsSupported = appCtxSvc.getCtx('isTC13_2OnwardsSupported');
    if (isTC13_2OnwardsSupported) {
        let inputData = {
            searchInput: {
                maxToLoad: 50,
                maxToReturn: 50,
                providerName: 'Aqc0QualityBaseProvider',
                searchFilterMap6: {
                    'WorkspaceObject.object_type': [{
                        searchFilterType: 'StringFilter',
                        stringValue: 'Qc0Failure'
                    }]
                },
                searchCriteria: {
                    objectType: 'Qc0Failure',
                    objectName: exports.getSearchFailureFilterBoxValue(data.filterBox.dbValue),
                    isReleased: 'true'
                },
                searchSortCriteria: []
            }
        };
        soaSvc.post('Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData).then(function (response) {
            var responseData = {};
            if (response.ServiceData.plain) {
                var values = response.ServiceData.plain.map(function (Objuid) {
                    return response.ServiceData.modelObjects[Objuid];
                });
                responseData = {
                    searchResults: values,
                    totalLoaded: values.length
                };
                deferred.resolve(responseData);
            }
            deferred.resolve(responseData);
        }, function (reason) {
            deferred.reject(reason);
        });
    } else {
        let inputData = {
            inputCriteria: [{
                queryNames: [
                    'Failure Specification...'
                ]
            }]
        };
        soaSvc.post('Query-2010-04-SavedQuery', 'findSavedQueries', inputData).then(function (response) {
            var savedQuery = response.savedQueries[0];
            var inputToExecuteQuerySoa = {
                query: savedQuery,
                limit: 50,
                entries: getSavedQueryEntries('Qc0Failure', '[qc0Status,qc0IsLatest,object_name]'),
                values: [
                    'true',
                    'true',
                    getSearchFailureFilterBoxValue(data.filterBox.dbValue)
                ]
            };
            if (savedQuery) {
                soaSvc.post('Query-2006-03-SavedQuery', 'executeSavedQuery', inputToExecuteQuerySoa).then(function (response) {
                    var responseData = {};
                    if (response.ServiceData.plain && response.ServiceData.plain.length > 0) {
                        var values = response.ServiceData.plain.map(function (Objuid) {
                            return response.ServiceData.modelObjects[Objuid];
                        });
                        responseData = {
                            searchResults: values,
                            totalLoaded: values.length
                        };
                        deferred.resolve(responseData);
                    }
                    deferred.resolve(responseData);
                }, function (reason) {
                    deferred.reject(reason);
                });
            } else {
                //If the group doesn't have any specifications then return an empty list
                var responseData = {
                    totalLoaded: []
                };
                deferred.resolve(responseData);
            }
        }, function (reason) {
            deferred.reject(reason);
        });
    }
    return deferred.promise;
};

/**
  * Execute all post event or actions afeter Failure spec version
  * @param {Object} createdObject - created Object
  * @param {Object} subPanelContext - sub Panel Context
  * @param {boolean} removeActionflag
  */
export let executePostVersionEventActionsForFailureSpec = function (createdObject, subPanelContext, removeOrEditActionflag) {
    //Failure Specification open(showObjectLocation) location check
    !subPanelContext.openedObject ? aqc0CharLibraryUtilService.addPanelObjectCreated(createdObject, subPanelContext) : 'no state updation required';

    //Close the Panel
    if (!removeOrEditActionflag) {
        eventBus.publish('complete', { source: 'toolAndInfoPanel' });
    }
};

export default exports = {
    checkDuplicatesAndAddFailures,
    findSavedQueries,
    getCreateInputForCreateObject,
    getCreateInputForCreateChecklistObject,
    getFailureObjects,
    getFileExtension,
    getGroupList,
    getLastReleased,
    getPropertiesforSelectedObject,
    getSavedQueryEntries,
    getSearchCriteriaInputForCharLib,
    getSearchFailureFilterBoxValue,
    getSelectedChxType,
    getValuesToPass,
    getVersionInputFAction,
    getVersionInputFailureFRAction,
    getVersionInputFFailAction,
    getVersionInputFRAction,
    pushSelectedNodeInFailureContext,
    removeActionAndCreateVersion,
    setNewValueForNamingConvention,
    subscribeContentLoaded,
    updateCurrentDatasetType,
    executePostVersionEventActionsForFailureSpec,
    createAddFailuresInput
};

