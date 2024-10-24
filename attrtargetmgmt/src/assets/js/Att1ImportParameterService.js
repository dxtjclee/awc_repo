// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ImportParameterService
 */
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import parameterMgmtUtils from 'js/Att1ParameterMgmtUtilService';
import _dms from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';

var exports = {};

export let setIsImportInProgress = function( data ) {
    eventBus.publish( 'Att1ImportParameter.startImportOrImportChanges' );
    return { isImportInProgress : true};
};

export let setImportFileUploadInProgress = function( data, value ) {
    return { importFileUploadInProgress: value };
};

export let getApplicationFormat = function() {
    return 'Dataset';
};

export let getSelectedObject = function() {
    var selectedInParamContext = _.get( appCtxSvc, 'ctx.parammgmtctx.selected', undefined );
    if( !selectedInParamContext ) {
        selectedInParamContext = _.get( appCtxSvc, 'ctx.selected', undefined );
    }
    return selectedInParamContext;
};

export let getTemplateName = function( data ) {
    var template = appCtxSvc.ctx.preferences.PLE_Parameter_Import_Excel_Template[ 0 ];

    if( parameterMgmtUtils.isTCReleaseAtLeast( 14, 2 ) && template === 'Parameter_import_template' ) {
        template += '_142';
    }
    var selectedObject = _.get( appCtxSvc, 'ctx.panelContext.importTarget', undefined );
    if( selectedObject && selectedObject.modelType ) {
        if( selectedObject.modelType.typeHierarchyArray.indexOf( 'Att0ParamDictionary' ) > -1 ) {
            template = appCtxSvc.ctx.preferences.PLE_Parameter_Definition_Import_Excel_Template[ 0 ];
        }
    }


    return template;
};

export let handleImport = function( data, parametersTable, reusableParamTable ) {
    if( appCtxSvc.ctx.sublocation && appCtxSvc.ctx.sublocation.nameToken === 'com.siemens.splm.client.attrtarget.paramProjectSubLocation:Att1ParamProjectSubLocation' ) {
        // In the project sublocation
        _handelForParamProjectSublocation();
    }

    if( parametersTable ) {
        if( parametersTable.isParameterWidePanelOpen === undefined || parametersTable.isParameterWidePanelOpen === false ) {
            // In the uniform table
            eventBus.publish( 'uniformParamTable.reloadTable', { reusable: reusableParamTable } );
        }
    } else {
        var selectedElement = _.get( appCtxSvc, 'ctx.selected', undefined );
        var contextElement = _.get( appCtxSvc, 'ctx.pselected', undefined );

        if( selectedElement && cmm.isInstanceOf( 'Crt0VldnContractRevision', selectedElement.modelType ) || contextElement && cmm.isInstanceOf( 'Crt0VldnContractRevision', contextElement.modelType ) ) {
            // In the VR
            _handleVRImport();
        } else if( appCtxSvc.ctx.xrtSummaryContextObject ) {
            // In the XRT Summary
            eventBus.publish( 'cdm.relatedModified', { relatedModified: [ appCtxSvc.ctx.xrtSummaryContextObject ] } );
        }
    }

    data.isImportInProgress = false;

    if (  data.importMessages && data.importMessages.importPartialErrorsMsg !== '' ) {
        throw data.importMessages.importPartialErrorsMsg;
    }
};

/**
 * This API is added to process the message shown to user after importParameterExcel SOA import
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error/Success message to be displayed to user
 */
export let processImportExcelMessage = function( response, data ) {
    let defer = AwPromiseService.instance.defer();
    var responseMsg = {
        importSuccessMsg: '',
        importPartialErrorsMsg: ''
    };
    processImportSuccess( response, data ).then( function( msg ) {
        var successMsg = msg;
        var importPartialErrors = processPartialErrors( response );

        if( successMsg === ''  ) {
            successMsg = data.i18n.roundTripImportSuccess;
        }
        // these error should be seen as notification
        if( importPartialErrors.code === 185460 || importPartialErrors.code === 185461 || importPartialErrors.code === 185474) {
            successMsg = importPartialErrors.msg;
            importPartialErrors.msg = '';
        }
        responseMsg.importSuccessMsg = successMsg;
        responseMsg.importPartialErrorsMsg = importPartialErrors.msg;
        defer.resolve( responseMsg );
    } );
    return defer.promise;
};

/**
 * This function is added to process the Partial error being thrown from the importParameterExcel SOA
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
function processPartialErrors( response ) {
    var msgObj = {
        msg: '',
        code: 0,
        level: 0
    };
    if( response && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj;
}

var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.code = object.code;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};
/**
 * This function is added to process the successful import from the importParameterExcel SOA
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Success message to be displayed to user
 */
function processImportSuccess( response, data ) {
    let defer = AwPromiseService.instance.defer();
    var createObjLen = 0;
    var createdObj = null;
    var updatedObj = null;
    var updatedObjLen = 0;
    var createdObjName = '';
    var updatedObjName = '';
    var isParamDef = false;

    var loadObjects = [];
    if( response && response.importExcelOutput ) {
        _.forEach( response.importExcelOutput, function( infoImport ) {
            _.forEach( infoImport.createdObjects, function( createdObjects ) {
                loadObjects.push( createdObjects );
            } );
            _.forEach( infoImport.updatedObjects, function( updatedObjects ) {
                loadObjects.push( updatedObjects );
            } );
        } );
    }
    _dms.getPropertiesUnchecked( loadObjects, [ 'object_name' ] ).then( function() {
        if( response && response.importExcelOutput ) {
            _.forEach( response.importExcelOutput, function( infoImport ) {
                if( infoImport.createdObjects ) {
                    createObjLen = infoImport.createdObjects.length;
                    if( createObjLen === 1 ) {
                        createdObj = cdm.getObject( infoImport.createdObjects[ 0 ].uid );
                        if( createdObj ) {
                            createdObjName = _.get( createdObj, 'props.object_name.dbValues[0]', undefined );
                        }
                    }
                }
                if( infoImport.updatedObjects ) {
                    updatedObjLen = infoImport.updatedObjects.length;
                    if( updatedObjLen === 1 ) {
                        updatedObj = cdm.getObject( infoImport.updatedObjects[ 0 ].uid );
                        if( updatedObj ) {
                            updatedObjName = _.get( updatedObj, 'props.object_name.dbValues[0]', undefined );
                        }
                    }
                }
            } );
        }

        var selected = appCtxSvc.getCtx( 'selected' );
        if( selected && selected.modelType && selected.modelType.typeHierarchyArray ) {
            if( selected.modelType.typeHierarchyArray.indexOf( 'Att0ParamDictionary' ) > -1 ||
                selected.modelType.typeHierarchyArray.indexOf( 'Att0AttributeDefRevision' ) > -1 ) {
                isParamDef = true;
            }
        }

        var msg = '';

        if( createObjLen === 1 ) {
            msg = msg.concat( data.i18n.Att1AddImportSuccess.replace( '{0}', createdObjName ) );
        } else if( createObjLen > 1 ) {
            if( isParamDef ) {
                msg = msg.concat( data.i18n.Att1AddParamDefMultipleImportSuccess.replace( '{0}', createObjLen ) );
            } else {
                msg = msg.concat( data.i18n.Att1AddParamMultipleImportSuccess.replace( '{0}', createObjLen ) );
            }
        }
        if( updatedObjLen === 1 ) {
            msg = msg.concat( data.i18n.Att1UpdateImportSuccess.replace( '{0}', updatedObjName ) );
        } else if( updatedObjLen > 1 ) {
            if( isParamDef ) {
                msg = msg.concat( data.i18n.Att1UpdateParamDefMultipleImportSuccess.replace( '{0}', updatedObjLen ) );
            } else {
                msg = msg.concat( data.i18n.Att1UpdateParamMultipleImportSuccess.replace( '{0}', updatedObjLen ) );
            }
        }
        defer.resolve( msg );
    } );

    return defer.promise;
}

/**Initialize Import parameter panel */
export let initImportPanel = function() {
    var selectedObject = parameterMgmtUtils.getSelectedForImport();
    if( selectedObject.modelType.typeHierarchyArray.indexOf( 'Att0ParamDictionary' ) > -1 ) {
        return { isParamDictionarySelected: true };
    }
    return { isParamDictionarySelected: false };
};

/**
 * Method to get import Options array passed as input to importParameterExcel SOA
 * @return {Array} of strings based upon parameter / definition import.
 */
export let getImportOptions = function( ctx, data ) {
    var importOptions = [ 'RoundTripImport' ];
    if( data.isParamDictionarySelected && data.paramDefRelease.dbValue === true ) {
        importOptions.push( 'autoReleaseParamDef' );
    }
    if( !data.isParamDictionarySelected && data.autoCreateAndReleaseparamDef.dbValue === true ) {
        importOptions.push( 'autoCreateAndReleaseDef' );
    }
    return importOptions;
};

var _handelForParamProjectSublocation = function() {
    var selectedElement = _.get( appCtxSvc, 'ctx.parammgmtctx.selected', undefined );
    if( selectedElement && selectedElement.modelType ) {
        if( cmm.isInstanceOf( 'Att0ParamProject', selectedElement.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedElement.modelType ) ) {
            eventBus.publish( 'paramProject.expandSelectedNode', { source: 'importParameter', refreshParamTable: true } );
        } else if( cmm.isInstanceOf( 'Att0MeasurableAttribute', selectedElement.modelType ) ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    }
};

var _handleVRImport = function() {
    var primaryXrtPageID = _.get( appCtxSvc, 'ctx.xrtPageContext.primaryXrtPageID', undefined );
    var secondaryXrtPageID = _.get( appCtxSvc, 'ctx.xrtPageContext.secondaryXrtPageID', undefined );

    if( secondaryXrtPageID === 'tc_xrt_Studies' || primaryXrtPageID === 'tc_xrt_Studies' || secondaryXrtPageID === 'tc_xrt_Requests' || primaryXrtPageID === 'tc_xrt_Requests' ) {
        eventBus.publish( 'Att1ShowStudyAttrsTable.refreshStudyTable' );
    } else {
        eventBus.publish( 'Att1ShowAttrProxyTable.refreshTable' );
    }
};

export default exports = {
    setImportFileUploadInProgress,
    getApplicationFormat,
    getSelectedObject,
    getTemplateName,
    handleImport,
    initImportPanel,
    processImportExcelMessage,
    getImportOptions,
    setIsImportInProgress
};
