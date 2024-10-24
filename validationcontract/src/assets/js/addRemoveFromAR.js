// Copyright (c) 2022 Siemens

/**
 * @module js/addRemoveFromAR
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import mesgSvc from 'js/messagingService';
import _prefSvc from 'soa/preferenceService';
import AwPromiseService from 'js/awPromiseService';

var exports = {};

export let getSelectedParamInput = function (openedARObject, actionElem, selectedObjects) {
    var inputs = [];
    var parentElementObj = null;
    var inputPara = [];
    var direction;
    var selected = null;

    if (selectedObjects && selectedObjects.length > 0) {
        for (var idx = 0; idx < selectedObjects.length; ++idx) {
            var proxy = cdm.getObject(selectedObjects[idx].uid);
            if (proxy && proxy.props && proxy.props.att1SourceAttribute) {
                var objUid = proxy.props.att1SourceAttribute.dbValues[0];
                selected = cdm.getObject(objUid);
                if (selected && selected.modelType.typeHierarchyArray.indexOf('Att0MeasurableAttribute') > -1) {
                    inputPara.push(selectedObjects[idx]);
                }
            }
        }
    }
    if (actionElem === 'remove') {
        direction = 'unuse';
    } else if (actionElem === 'add') {
        direction = 'input';
    }
    inputs.push({
        clientId: 'AddOrRemove',
        analysisRequest: {
            uid: openedARObject.uid,
            type: openedARObject.type
        },
        data: [{
            parentElement: parentElementObj,
            attrs: inputPara,
            direction: direction
        }]
    });

    var input = {
        input: inputs
    };
    soaSvc.post('Internal-ValidationContractAW-2018-12-VCManagement', 'setMeasurableAttrDirection', input).then(
        function () {
            eventBus.publish('cdm.relatedModified', {
                refreshLocationFlag: true,
                relations: '',
                relatedModified: [openedARObject],
                createdObjects: []
            });
        });
};

/**
 * Already present in toggleInputOutput.js file
 */
export let prepareInputForSOA = function (proxyMeasurableAttrs, refreshEvent, parameterInfo) {
    _getARAttrsForToggleInput(proxyMeasurableAttrs, refreshEvent, parameterInfo);
};

/**
 * @param {Array} inputs the inputs
 * @returns {Array} the SOA inputs
 *
 * Already present in toggleInputOutput.js file
 */
function _getARAttrsForToggleInput(proxyMeasurableAttrs, refreshEvent, parameterInfo) {
    var invalidAttrsForToggle = '';

    getDefaultUsage(parameterInfo.panelId).then(
        function (defaultUsage) {
            var unusedAttrs = [];
            var inOutAttrs = [];
            var attrType = 'unused';


            for (var j = 0; j < proxyMeasurableAttrs.length; j++) {
                if (proxyMeasurableAttrs[j].props.att1AttrInOut) {
                    attrType = proxyMeasurableAttrs[j].props.att1AttrInOut.dbValues[0];
                }

                if (attrType === 'unused') {
                    unusedAttrs.push(proxyMeasurableAttrs[j]);
                } else {
                    inOutAttrs.push(proxyMeasurableAttrs[j]);
                }
            }

            var parentElementObj = null;
            var idCtx = appCtxSvc.getCtx('interfaceDetails');
            let selectedObjCtx = appCtxSvc.getCtx('occmgmtContext.selectedModelObjects');
            if (idCtx && idCtx.isPortSelected && idCtx.targetModelObject) {
                parentElementObj = cdm.getObject(idCtx.targetModelObject.uid);
            } else if(selectedObjCtx && selectedObjCtx.length > 0) {
                var uid = selectedObjCtx[0].uid;
                parentElementObj = cdm.getObject(uid);
            }
            var inputs = [];
            if (unusedAttrs.length > 0) {
                var dataForParamInput = [];
                for (let i = 0; i < unusedAttrs.length; i++) {
                    if( parameterInfo.panelId !== "NormalAddParameters" ){
                        defaultUsage = parameterInfo.createdParams[i].paramDirection;
                    }
                    if( defaultUsage === 'unused')
                    {
                            defaultUsage = 'unuse';
                    }
                    dataForParamInput.push({
                        parentElement: parentElementObj,
                        attrs: [unusedAttrs[i]],
                        direction: defaultUsage
                    });
                }
                inputs.push({
                    clientId: 'InputOrOutputOrNone',
                    analysisRequest: appCtxSvc.ctx.openedARObject,
                    data: dataForParamInput
                });
            }

            if (inOutAttrs.length > 0) {
                var dataForParamInput = [];
                for (let i = 0; i < inOutAttrs.length; i++) {
                    dataForParamInput.push({
                        parentElement: parentElementObj,
                        attrs: [inOutAttrs[i]],
                        direction: 'automatic'
                    });
                }
                inputs.push({
                    clientId: 'InputOrOutputOrNone',
                    analysisRequest: appCtxSvc.ctx.openedARObject,
                    data: dataForParamInput
                });
            }
            var input = {
                input: inputs
            };
            soaSvc.post('Internal-ValidationContractAW-2018-12-VCManagement', 'setMeasurableAttrDirection', input).then(
                function () {
                    if (refreshEvent) {
                        eventBus.publish(refreshEvent);
                    } else {
                        eventBus.publish('Att1ShowMappedAttribute.refreshTable');
                    }

                    var unusedAttrs = appCtxSvc.getCtx('unusedAttrsSelected');
                    if (unusedAttrs && unusedAttrs.length > 0) {
                        appCtxSvc.unRegisterCtx('unusedAttrsSelected');
                        appCtxSvc.unRegisterCtx('selectedAttrsName');
                    }
                    var availAttrs = appCtxSvc.getCtx('invalidAttrsForToggle');
                    if (availAttrs && availAttrs.length > 0) {
                        appCtxSvc.unRegisterCtx('invalidAttrsForToggle');
                    }
                });
        });
}

var PLE_Parameter_Create_With_Default_Usage = 'PLE_Parameter_Create_With_Default_Usage';

function getDefaultUsage(parameterPanelId) {
    var deferred = AwPromiseService.instance.defer();
    var defaultUsage = 'output';
    if (isTCReleaseAtLeast()) {
        // For tc14.3 and higher versions, read value of default usage from preference PLE_Parameter_Create_With_Default_Usage to create parameter
        // If preference PLE_Parameter_Create_With_Default_Usage does not exist or has empty values or has invalid values, the default usage would be output
        if (parameterPanelId === "NormalAddParameters") {
            //If parameter added through noraml add, it will read the preference value 'PLE_Parameter_Create_With_Default_Usage' for usage
            _prefSvc.getStringValues([PLE_Parameter_Create_With_Default_Usage]).then(
                function (values) {
                    if (values && values[0] && (values[0].toLowerCase() === 'output' || values[0].toLowerCase() === 'input' || values[0].toLowerCase() === 'unused')) {
                        // assign the default as per preference
                        defaultUsage = values[0].toLowerCase();                  
                    }
                    deferred.resolve(defaultUsage);
                });
        }
        else {
            deferred.resolve(defaultUsage);
        }
    } else {
        // For tc14.2 and lower versions, value of default usage is unused
        defaultUsage = 'unused';
        deferred.resolve(defaultUsage);
    }

    return deferred.promise;
}

function isTCReleaseAtLeast() {
    var majVer = appCtxSvc.ctx.tcSessionData.tcMajorVersion;
    var minVer = appCtxSvc.ctx.tcSessionData.tcMinorVersion;
    let majorVersion = 14;
    let minorVersion = 3;

    if (majVer > majorVersion || majVer === majorVersion && minVer >= minorVersion) {
        return true;
    }

    return false;
}


export let unRegisterVRTableSelection = function () {
    appCtxSvc.unRegisterCtx('vrContentTableSelection');
};

export let throwError = function (data, sourceObjects) {
    var error = '';
    if (data.createdMainObject) {
        error = error.concat('\'' + data.createdMainObject.props.object_name.dbValues[0] + '\'' + ' ' + 'is' + ' ' + '\'' + data.createdMainObject.modelType.displayName + ' (Classname :: ' + data.createdMainObject.type + ')\'' + '\n');
    } else {
        for (var i = 0; i < sourceObjects.length; i++) {
            error = error.concat('\'' + sourceObjects[i].props.object_string.dbValue + '\'' + ' ' + 'is' + ' ' + '\'' + sourceObjects[i].modelType.displayName + ' (Classname :: ' + sourceObjects[i].type + ')\'' + '\n');
        }
    }
    var msg = data.i18n.throwErrorVRNotCreated.replace('{0}', error);
    var errorString = msg + ' ';
    mesgSvc.showInfo(errorString);
};


export default exports = {
    getSelectedParamInput,
    prepareInputForSOA,
    unRegisterVRTableSelection,
    throwError
};
