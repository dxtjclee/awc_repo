// Copyright (c) 2022 Siemens

/**
 * @module js/dynamicTableUtils
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import columnArrangeService from 'js/columnArrangeService';
import AwPromiseService from 'js/awPromiseService';
import tcSessionData from 'js/TcSessionData';
import crt1VRContentService from 'js/Crt1VRContentService';

var exports = {};

/**
 * Get fixed check boxes like Others, Report
 * @param {finalDisplayTypeList} finalDisplayTypeList - list of checkboxes
 * @param {data} data - data of view model
 */
function getFixedCheckBoxes(finalDisplayTypeList, data, typeStateMap) {
    var parametersCheckbox = uwPropertyService.createViewModelProperty('Att0MeasurableAttribute', data.i18n.Att0MeasurableAttribute, 'BOOLEAN', '', '');
    parametersCheckbox.isEditable = true;
    parametersCheckbox.isRequired = false;
    parametersCheckbox.dbValue = typeStateMap.get('Att0MeasurableAttribute');
    parametersCheckbox.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
    finalDisplayTypeList.push(parametersCheckbox);

    var reportsCheckbox = uwPropertyService.createViewModelProperty('reports', data.i18n.reports, 'BOOLEAN', '', '');
    reportsCheckbox.isEditable = true;
    reportsCheckbox.isRequired = false;
    reportsCheckbox.dbValue = typeStateMap.get('reports');
    reportsCheckbox.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
    finalDisplayTypeList.push(reportsCheckbox);
}
/**
 * Get preference values
 * @param {finalDisplayTypeList} finalDisplayTypeList - Preference list
 *  @return {tableList} List of tables
 */
function getTableDisplayList(finalDisplayTypeList) {
    var tableList = [];
    for (var i = 0; i < finalDisplayTypeList.length; i++) {
        if (finalDisplayTypeList[i].propertyName === 'Requirement') {
            tableList[i] = 'Crt1RequirementTable';
        } else if (finalDisplayTypeList[i].propertyName === 'IAV0TestCase') {
            tableList[i] = 'Crt1TestCaseTreeTable';
        } else if (finalDisplayTypeList[i].propertyName === 'IAV0TestProcedur') {
            tableList[i] = 'Crt1TestProcedureTreeTable';
        } else if (finalDisplayTypeList[i].propertyName === 'Functionality') {
            tableList[i] = 'Crt1FunctionsTable';
        } else if (finalDisplayTypeList[i].propertyName === 'Fnd0LogicalBlock') {
            tableList[i] = 'Crt1SystemsTable';
        } else if (finalDisplayTypeList[i].propertyName === 'Part') {
            tableList[i] = 'Crt1PartsTable';
        } else if (finalDisplayTypeList[i].propertyName === 'CAEModel') {
            tableList[i] = 'Crt1SimulationModelTable';
        } else if (finalDisplayTypeList[i].propertyName === 'IAV0TestRequest') {
            tableList[i] = 'IAV1TestMethodTreeTable';
        } else if (finalDisplayTypeList[i].propertyName === 'ProductAndTestEBOMs') {
            tableList[i] = 'IAV1ProductAndTestBOMTable';
        } else if (finalDisplayTypeList[i].propertyName === 'PhysicalPart') {
            tableList[i] = 'IAV1PhysicalBOMTable';
        } else if (finalDisplayTypeList[i].propertyName === 'Att0MeasurableAttribute') {
            tableList[i] = 'Crt1ParameterTable';
        } else if (finalDisplayTypeList[i].propertyName === 'Others') {
            tableList[i] = 'Crt1OthersTable';
        } else if (finalDisplayTypeList[i].propertyName === 'reports') {
            tableList[i] = 'Crt1ReportsTable';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableOne') {
            tableList[i] = 'Crt1ConfigTableOne';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableTwo') {
            tableList[i] = 'Crt1ConfigTableTwo';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableThree') {
            tableList[i] = 'Crt1ConfigTableThree';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableFour') {
            tableList[i] = 'Crt1ConfigTableFour';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableFive') {
            tableList[i] = 'Crt1ConfigTableFive';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableSix') {
            tableList[i] = 'Crt1ConfigTableSix';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableSeven') {
            tableList[i] = 'Crt1ConfigTableSeven';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableEight') {
            tableList[i] = 'Crt1ConfigTableEight';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableNine') {
            tableList[i] = 'Crt1ConfigTableNine';
        } else if (finalDisplayTypeList[i].propertyName === 'ConfigTableTen') {
            tableList[i] = 'Crt1ConfigTableTen';
        } else if (finalDisplayTypeList[i].propertyName === 'Software') {
            tableList[i] = 'Crt1SoftwareTable';
        }
    }
    return tableList;
}

/**
 *
 * render the check boxes in Tables section depend on selection in scope tree table
 *
 * @param {Object} data view Model data
 * @param {Object} selObj object selected in scope tree
 */
function createNewCheckBoxes(data, selObj, isVROpen, isStudyObjOpen, isRunObjOpen, addSecSel, vrSublocationState) {
    var type;
    //Get the preference name from selected object type
    if (selObj && selObj.type) {
        var selType = selObj.type;
        type = selType.replace('Revision', '');
    }
    //Empty checkbox list before adding new checkboxes
    data.checkBoxes = [];
    let typeStateMap = new Map();
    let columnConfig = new Map();
    let typesToInclude = new Map();
    let scopeURI = new Map();
    let contextMap = new Map();
    var prefString = 'AWC_' + type + '_DisplayTables';
    var prefValues = appCtxSvc.ctx.preferences[prefString];
    if (prefValues === undefined && vrSublocationState.mselected[0] !== undefined) {
        prefValues = getDisplayPreferenceFromParentTypes(vrSublocationState
            .mselected[0]);
    }
    //split name and state from preference values
    if (prefValues) {
        var objectsToValidate = [];
        for (let i = 0; i < prefValues.length; i++) {
            var name = prefValues[i];
            if (name !== undefined) {
                var splitString = name.split(':');
                type = String(splitString[0]);
                var enable = splitString[1];
                let config = splitString[2];
                let includeTypes = splitString[3];
                let tableConfig = config.split(',');
                columnConfig.set(type, tableConfig[0]);
                scopeURI.set(type, tableConfig[1]);
                typeStateMap.set(type, enable);
                typesToInclude.set(type, includeTypes);
                //split object type without Revision
                var objectType = includeTypes.split(',');
                objectType.forEach(function (obj) {
                    var objectType1 = obj.split(' ');
                    objectsToValidate.push(objectType1[0]);
                });
            }
        }
    }
    typeStateMap.set('Att0MeasurableAttribute', true);
    typeStateMap.set('reports', true);
    let keys = Array.from(typeStateMap.keys());
    var checkBoxObjects = [];
    //Iterated through all the preference values
    if (vrSublocationState && vrSublocationState.objNckbxState) {
        contextMap = vrSublocationState.objNckbxState;
        let propMap = Array.from(contextMap.keys());
        let isObjInMap = false;
        for (let j = 0; j < propMap.length; j++) {
            if (propMap[j] === selObj.uid) {
                typeStateMap = contextMap.get(propMap[j]);
                isObjInMap = true;
            }
        }
        if (!isObjInMap) {
            contextMap.set(selObj.uid, typeStateMap);
        }
    } else {
        contextMap.set(selObj.uid, typeStateMap);
    }
    var savedContextMap = crt1VRContentService.setBackObjNCkbxState(vrSublocationState);
    if (savedContextMap) {
        contextMap = savedContextMap;
        let propMap = Array.from(contextMap.keys());
        let isObjInMap = false;
        for (let j = 0; j < propMap.length; j++) {
            if (propMap[j] === selObj.uid) {
                typeStateMap = contextMap.get(propMap[j]);
                isObjInMap = true;
            }
        }
        if (!isObjInMap) {
            contextMap.set(selObj.uid, typeStateMap);
        }
        crt1VRContentService.clearObjNCkbxState();
    }
    var showChart = crt1VRContentService.setBackShowChartState();
    if (!showChart) {
        crt1VRContentService.clearShowChartState();
    }
    if (vrSublocationState.showChart === false) {
        showChart = vrSublocationState.showChart;
    }
    //Get display names of types from internal names
    if (objectsToValidate) {
        return soaSvc.post('Core-2015-10-Session', 'getTypeDescriptions2', {
            typeNames: objectsToValidate,
            options: {}
        }).then(function (response) {
            var notDeployedTemplate = notDeployedTemplates(response, objectsToValidate);
            if (prefValues) {
                //find deployed object to display with checkbox by comparing with not deployed object
                for (let i = 0; i < prefValues.length; i++) {
                    var name = prefValues[i];
                    if (name !== undefined) {
                        var splitString = name.split(':');
                        type = String(splitString[0]);
                        var enable = splitString[1];
                        let includeTypes = splitString[3];
                        var objectType = includeTypes.split(',');
                        let flag = false;
                        objectType.forEach(function (obj) {
                            var objectType1 = obj.split(' ');
                            var flag1 = false;
                            if (objectType1 && notDeployedTemplate.notDeployedObj) {
                                for (let j = 0; j < notDeployedTemplate.notDeployedObj.length; j++) {

                                    if (objectType1[0] === notDeployedTemplate.notDeployedObj[j]) {
                                        flag1 = true;
                                        break;
                                    }
                                }
                                if (flag1 === false) {
                                    flag = true;
                                }
                            }

                        });
                        if (flag === true) {
                            var obj = {
                                internalName: type,
                                enable: typeStateMap.get(type)
                            };
                            checkBoxObjects.push(obj);
                        }

                    }
                }
            }
            var prefTypeList = [];
            //Create checkboxes
            for (let i = 0; i < checkBoxObjects.length; i++) {
                var internalName = checkBoxObjects[i].internalName;
                var displayName = data.i18n[internalName];
                var checkBox = uwPropertyService.createViewModelProperty(internalName, displayName, 'BOOLEAN', '', '');
                checkBox.isEditable = true;
                checkBox.isRequired = false;
                if (checkBoxObjects[i].enable === 'On' || checkBoxObjects[i].enable === true) {
                    checkBox.dbValue = true;
                } else {
                    checkBox.dbValue = false;
                }
                checkBox.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
                prefTypeList.push(checkBox);
            }
            getFixedCheckBoxes(prefTypeList, data, typeStateMap);
            var tableList = getTableDisplayList(prefTypeList);
            var checkBoxes = prefTypeList;
            //_registerCheckBoxCoun( checkBoxes );
            var checkBoxesInfo = [];
            for (var i = 0; i < checkBoxes.length; i++) {
                var checkboxObj = {
                    checkBoxName: checkBoxes[i].propertyDisplayName,
                    checkBoxInternalName: checkBoxes[i].propertyName,
                    checkBoxValue: checkBoxes[i].dbValue,
                    checkBoxTable: tableList[i]
                };
                checkBoxesInfo.push(checkboxObj);
            }
            var counter = exports.registerCheckBoxCount(checkBoxesInfo, vrSublocationState);
            return AwPromiseService.instance.resolve({
                checkBoxes: checkBoxes,
                checkBoxesInfo: checkBoxesInfo,
                tableList: tableList,
                columnConfig: columnConfig,
                scopeURI: scopeURI,
                typesToInclude: typesToInclude,
                CountTablesLoaded: counter,
                objNckbxState: contextMap,
                showChart: showChart
            });
        });
    }
}

/**
 *
 * render the check boxes in Tables section depend on selection in scope tree table
 *
 * @param {Object} data view Model data
 * @param {Object} selObj object selected in scope tree
 */
export let renderCheckboxes = function (data, selObj, vrSublocationState) {
    if (selObj.uid) {
        return AwPromiseService.instance.resolve(createNewCheckBoxes(data, selObj, true, null, null, null, vrSublocationState));
    }
};

export let notDeployedTemplates = function (response, objectsToValidate) {
    //Get display names of types from internal names
    let typeNamesList = response.types;   //Deployed object templates
    var notDeployedObj = [];
    //find not deployed object templates
    if (typeNamesList) {
        for (let x = 0; x < objectsToValidate.length; x++) {
            let flag = false;
            for (let y = 0; y < typeNamesList.length; y++) {
                if (objectsToValidate[x] === typeNamesList[y].name || objectsToValidate[x] === '""' || objectsToValidate[x] === 'TestAndProdBOM' || objectsToValidate[x] === 'PhysicalTestBOM') {
                    flag = true;
                    break;
                } else {
                    flag = false;
                }
            }
            if (flag === false) {
                notDeployedObj.push(objectsToValidate[x]);
            }
        }
    }
    var isSoftwareDeployed = true;
    if (notDeployedObj) {
        for (let i = 0; i < notDeployedObj.length; i++) {
            if (notDeployedObj[i] === 'Software') {
                isSoftwareDeployed = false;
                break;
            } else {
                isSoftwareDeployed = true;
            }
        }
    }
    return {
        isSoftwareDeployed: isSoftwareDeployed,
        notDeployedObj: notDeployedObj
    };

};

/**
 *
 * _registerTableFlags
 *
 * @param {Object} checkboxes checkboxes
 */
function _registerTableFlags(checkBox, vrSublocationState) {
    const newVrSublocationState = { ...vrSublocationState.value };
    var ckbxState = newVrSublocationState.checkBoxState;
    if (vrSublocationState) {
        if (checkBox.checkBoxName === 'Requirements') {
            ckbxState.reqTableChecked = true;
        } else if (checkBox.checkBoxName === 'Functions') {
            ckbxState.funcTableChecked = true;
        } else if (checkBox.checkBoxName === 'Systems') {
            ckbxState.sysTableChecked = true;
        } else if (checkBox.checkBoxName === 'Simulation Models') {
            ckbxState.simModelTableChecked = true;
        } else if (checkBox.checkBoxName === 'Test Procedures') {
            ckbxState.tpTableChecked = true;
        } else if (checkBox.checkBoxName === 'Parts') {
            ckbxState.partTableChecked = true;
        } else if (checkBox.checkBoxName === 'Simulation Analyses') {
            ckbxState.simAnalysisTableChecked = true;
        } else if (checkBox.checkBoxName === 'Product and Test EBOMs') {
            ckbxState.prodAndTestTableChecked = true;
        } else if (checkBox.checkBoxName === 'Parameters') {
            ckbxState.paraTableChecked = true;
        } else if (checkBox.checkBoxName === 'Others') {
            ckbxState.othersTableChecked = true;
        } else if (checkBox.checkBoxName === 'Reports') {
            ckbxState.reportsTableChecked = true;
        } else if (checkBox.checkBoxName === 'Test Cases') {
            ckbxState.tcTableChecked = true;
        } else if (checkBox.checkBoxName === 'IAV0TestRequest') {
            ckbxState.tmTableChecked = true;
        } else if (checkBox.checkBoxName === 'PhysicalPart') {
            ckbxState.phyTableChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableOne') {
            ckbxState.configTableOneChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableTwo') {
            ckbxState.configTableTwoChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableThree') {
            ckbxState.configTableThreeChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableFour') {
            ckbxState.configTableFourChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableFive') {
            ckbxState.configTableFiveChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableSix') {
            ckbxState.configTableSixChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableSeven') {
            ckbxState.configTableSevenChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableEight') {
            ckbxState.configTableEightChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableNine') {
            ckbxState.configTableNineChecked = true;
        } else if (checkBox.checkBoxInternalName === 'ConfigTableTen') {
            ckbxState.configTableTenChecked = true;
        } else if (checkBox.checkBoxInternalName === 'Software') {
            ckbxState.softwareTableChecked = true;
        }
        newVrSublocationState.checkBoxState = ckbxState;
        vrSublocationState.update && vrSublocationState.update(newVrSublocationState);
    }
}

/**
 *
 * registerCheckBoxCount
 *
 * @param {Object} checkBoxes checkboxes
 */
export let registerCheckBoxCount = function (checkBoxes, vrSublocationState) {
    if (vrSublocationState && checkBoxes && checkBoxes.length > 0) {
        var counter = 0;
        for (var i = 0; i < checkBoxes.length; i++) {
            if (checkBoxes[i].checkBoxValue === true) {
                _registerTableFlags(checkBoxes[i], vrSublocationState);
                counter++;
            }
        }
        return counter;
    }
};

export let updateCheckBoxInfo = function (updatedCheckBoxes, tableList, subPanelContext, selObj) {
    var checkBoxesInfo = [];
    //Ned to check why 548-552 needed.As it is using ctx, we need to avoid.
    const newVrSublocationState = { ...subPanelContext.vrSublocationState.value };
    let typeStateMap = new Map();
    for (var i = 0; i < updatedCheckBoxes.length; i++) {
        var checkboxObj = {
            checkBoxName: updatedCheckBoxes[i].propertyDisplayName,
            checkBoxInternalName: updatedCheckBoxes[i].propertyName,
            checkBoxValue: updatedCheckBoxes[i].dbValue,
            checkBoxTable: tableList[i]
        };
        typeStateMap.set(updatedCheckBoxes[i].propertyName, updatedCheckBoxes[i].dbValue);
        checkBoxesInfo.push(checkboxObj);
    }
    let objNCkbxState = subPanelContext.vrSublocationState.objNckbxState;
    objNCkbxState.forEach((value, key) => {
        if (key === selObj.uid) {
            objNCkbxState.set(selObj.uid, typeStateMap);
        }
    });
    return checkBoxesInfo;
};


export const processOutput = (checkBoxesInfo, subPanelContext = {}, columnConfig, scopeURI, typesToInclude, counter, objNckbxState, showChart, eventData) => {
    if (checkBoxesInfo) {
        let isVrSublocationStateAvailableInSubPanelCtx = false;
        if (subPanelContext.vrSublocationState && subPanelContext.vrSublocationState.value) {
            isVrSublocationStateAvailableInSubPanelCtx = true;
        }
        const newParameterState = isVrSublocationStateAvailableInSubPanelCtx === true ? { ...subPanelContext.vrSublocationState.value } : { ...subPanelContext.context.vrSublocationState.value };
        newParameterState.checkBoxesInfo = checkBoxesInfo;
        newParameterState.columnConfig = columnConfig;
        newParameterState.scopeURI = scopeURI;
        newParameterState.typesToInclude = typesToInclude;
        newParameterState.CountTablesLoaded = counter;
        newParameterState.objNckbxState = objNckbxState;
        newParameterState.showChart = showChart;
        newParameterState.isStateUpdated = true;
        if (eventData && eventData.ckBoxEnabled === true) {
            newParameterState.ckBoxEnabled = true;
        }
        if (isVrSublocationStateAvailableInSubPanelCtx) {
            subPanelContext.vrSublocationState && subPanelContext.vrSublocationState.update(newParameterState);
        } else {
            subPanelContext.context.vrSublocationState && subPanelContext.context.vrSublocationState.update(newParameterState);
        }
    }
};

export let addExtraColumn = function (columns) {
    var resource = '/i18n/AnalysisRequestCommandPanelsMessages.json';
    var lclsrvc = localeService.getLoadedText(resource);
    var columnInfo = {
        associatedTypeName: 'Crt1VRContentProxy',
        columnOrder: 400,
        displayName: lclsrvc.result,
        hiddenFlag: false,
        pixelWidth: 80,
        propertyName: 'crt1Result',
        sortDirection: '',
        sortPriority: 0,
        typeName: 'Crt1VRContentProxy'
    };
    columns.splice(3, 0, columnInfo);
    return columns;
};
export let arrangeColumns = function (declViewModel, eventData) {
    const newData = _.clone(declViewModel);
    var evtCol = eventData.columns;
    for (let j = 0; j < evtCol.length; j++) {
        if (evtCol[j].propertyName === 'crt1Result') {
            evtCol.splice(j, 1);
        }
    }
    return columnArrangeService.arrangeColumns(newData, eventData, true);
};
export let getColumnData = function (data) {
    var columnConfig = data.columnConfig;
    if (!columnConfig) {
        columnConfig = data.columnConfigurations[0].columnConfigurations[0];
    }
    var originalColumns = columnConfig.columns;
    addExtraColumn(originalColumns);
    return columnConfig;
};

/**
 *
 * function return the table display preference value for parent types
 *
 * @param {Object} selectedObect selectedObect
 */
function getDisplayPreferenceFromParentTypes(selectedObect) {
    var prefereneValue;
    if (selectedObect && selectedObect.modelType && selectedObect.modelType.typeHierarchyArray) {
        var TypeHrArray = selectedObect.modelType.typeHierarchyArray;
        for (var idx = 0; idx < TypeHrArray.length; idx++) {
            var type = TypeHrArray[idx].replace('Revision', '');
            var prefString = 'AWC_' + type + '_DisplayTables';
            prefereneValue = appCtxSvc.ctx.preferences[prefString];
            if (prefereneValue !== undefined || TypeHrArray[idx] === 'Crt0VldnContractRevision') {
                break;
            }
        }
    }
    return prefereneValue;
}

export let getSelectedObj = function (subPanelContext) {
    var selectedObj;
    if (subPanelContext.vrSublocationState.mselected &&
        (subPanelContext.vrSublocationState.mselected.length === 0 ||
            subPanelContext.vrSublocationState.mselected.length === 1 && subPanelContext.vrSublocationState.mselected[0] === undefined)
    ) {
        selectedObj = subPanelContext.openedObject;
    } else {
        selectedObj = subPanelContext.vrSublocationState.mselected[0];
    }
    return selectedObj;
};

export let unregisterFlags = function (subPanelContext) {
    if (subPanelContext.context && subPanelContext.context.vrSublocationState && subPanelContext.context.vrSublocationState.pieChartData && subPanelContext.context.vrSublocationState.pieChartData
        .vrTables && subPanelContext.activeTab.tabKey === 'tc_xrt_Overview') {
        const newVrSublocationState = { ...subPanelContext.context.vrSublocationState.value };
        var vrTables = newVrSublocationState.pieChartData.vrTables;
        for (const vrTable in vrTables) {
            var table = vrTables[vrTable];
            for (const vrTableData in table) {
                if (vrTableData.includes('ColumnFilters')) {
                    table[vrTableData] = [];
                }
                if (vrTableData.includes('PieClicked')) {
                    table[vrTableData] = false;
                }
            }
        }
        subPanelContext.context.vrSublocationState.update && subPanelContext.context.vrSublocationState.update(newVrSublocationState);
    }
};
export let checkSelection = function (subPanelContext) {
    var shouldRender = false;
    if (subPanelContext.vrSublocationState.mselected && subPanelContext.selectionData.selected[0].modelType.typeHierarchyArray.indexOf('Crt0VldnContractRevision') > -1 &&
        subPanelContext.vrSublocationState.mselected[0].uid !== subPanelContext.selectionData.selected[0].uid
    ) {
        shouldRender = true;
    }
    return shouldRender;
};

/**
 * Returns the dynamicTableUtils instance
 *
 * @member dynamicTableUtils
 */

export default exports = {
    renderCheckboxes,
    addExtraColumn,
    arrangeColumns,
    getColumnData,
    processOutput,
    updateCheckBoxInfo,
    getSelectedObj,
    unregisterFlags,
    registerCheckBoxCount,
    checkSelection,
    notDeployedTemplates
};
