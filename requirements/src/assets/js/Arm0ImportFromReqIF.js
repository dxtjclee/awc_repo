/* eslint-disable max-lines */
// Copyright (c) 2021 Siemens

/**
 * Module for the Import Specification from ReqIF documents
 *
 * @module js/Arm0ImportFromReqIF
 */
import appCtxSvc from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import AwTimeoutService from 'js/awTimeoutService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';

var exports = {};
var _ruleName = null;
var _ruleScope = null;
var requiredProperties = [ 'object_name', 'body_text', 'name' ];

/**
 * Reset Data from import from reqIF panel.
 *
 * @param {Object} data - The view model data
 *
 */
export let resetReqIFImportData = function( data ) {
    var isValidMapping = false;
    var isReqIFTypes = false;
    var isReqIFTraceLinks = false;

    var viewModelPropForReqIFTypes = [];
    var typesForMapping = [];
    var reqIFTypes = [];

    var viewModelPropForReqIFTraceLinks = [];
    var traceLinksForMapping = [];
    var reqIFTraceLinks = [];

    var viewModelPropForReqIFProperties = {};
    var reqIFPropertiesForMapping = {};
    var reqIFProperties = {};

    var viewModelPropForReqIFLOVPropertyValues = {};
    var reqIFLovPropertyValuesForMapping = {};
    var reqIFLovProperyValues = {};

    var reqIfAttributeMappingInfos = [];

    var tcTypesInteranlDisplayNameMap = {};

    var typeLinkMapPropsData = {};

    appCtxSvc.registerPartialCtx( 'saveImportReqIFSaveMappingCmdVisiblity', false );
    
    let addFileAsAttachmnt = _.clone( data.addFileAsAttachmnt );
    let preferences = appCtxSvc.getCtx( 'preferences' );
    if( preferences.REQ_AttachImportSpecFileToReqSpec && preferences.REQ_AttachImportSpecFileToReqSpec[ 0 ] === "true" ){
        addFileAsAttachmnt.dbValue  = true;
    }

    // to get the new metadata for another selected reqIF file
    if( data.getSpecificationMetadataResponse ) {
        delete data.getSpecificationMetadataResponse;
    }

    return {
        isValidMapping: isValidMapping,
        isReqIFTypes: isReqIFTypes,
        isReqIFTraceLinks: isReqIFTraceLinks,
        viewModelPropForReqIFTypes: viewModelPropForReqIFTypes,
        typesForMapping: typesForMapping,
        reqIFTypes: reqIFTypes,
        viewModelPropForReqIFTraceLinks: viewModelPropForReqIFTraceLinks,
        viewModelPropForReqIFProperties: viewModelPropForReqIFProperties,
        traceLinksForMapping: traceLinksForMapping,
        reqIFTraceLinks: reqIFTraceLinks,
        reqIFPropertiesForMapping: reqIFPropertiesForMapping,
        reqIFProperties: reqIFProperties,
        viewModelPropForReqIFLOVPropertyValues: viewModelPropForReqIFLOVPropertyValues,
        reqIFLovPropertyValuesForMapping: reqIFLovPropertyValuesForMapping,
        reqIFLovProperyValues: reqIFLovProperyValues,
        reqIfAttributeMappingInfos: reqIfAttributeMappingInfos,
        tcTypesInteranlDisplayNameMap: tcTypesInteranlDisplayNameMap,
        typeLinkMapPropsData: typeLinkMapPropsData,
        addFileAsAttachmnt : addFileAsAttachmnt
    };
};

export let getImportOptionsForReqif = function( data ) {
    let ImportOptionForReqif = "";
    if( data.addFileAsAttachmnt.dbValue ) {
        ImportOptionForReqif = "AttachFile";
        return ImportOptionForReqif;  
    }
    return ImportOptionForReqif;
 };

/**
 * Populate import mapping names
 *
 * @param {Object} data - The view model data
 *
 */
export let initImportReqIFMappingsData = function( data ) {
    data.savedMappings.dbValue = '';
    data.savedMappings.uiValue = '';
    appCtxSvc.registerPartialCtx( 'mappingType', 'ImportReqIF' );
    eventBus.publish( 'importSpecificationReqIF.populateAllImportReqIFMappings' );
};

/**
 * Handles import ReqIF rule selection from listbox
 *
 * @param {Object} data - The view model data
 *
 */
export let importReqIFRuleSelectionChangeInListBox = function( data ) {
    if( data.eventData && data.eventData.selectedObjects && data.eventData.selectedObjects.length === 0 ) {
        return;
    }
    var viewModelPropForReqIFPropertiesArray = [];
    if( data.savedMappings.dbValue !== '' ) {
        var object = {};
        for( var i = 0; i < data.ruleList.length; i++ ) {
            if( data.savedMappings.dbValue === data.ruleList[ i ].ruleName ) {
                object = data.ruleList[ i ];
                break;
            }
        }
        if( !_.isEmpty( object ) ) {
            object.ruleObject = {
                uid: object.ruleObject.uid,
                type: object.ruleObject.type
            };
            var selectedRule = object;
            appCtxSvc.updatePartialCtx( 'importReqIFSavedMapping', data.savedMappings.dbValue );
        }
        if( !_.isEmpty( selectedRule ) ) {
            var returnObj = exports.clearAllReqIFData( data );
        }
    } else {
        var returnObj = exports.removeAllMappings( data );
    }
    return {
        isValidMapping: returnObj.isValidMapping,
        isReqIFTypes: returnObj.isReqIFTypes,
        isReqIFTraceLinks: returnObj.isReqIFTraceLinks,
        viewModelPropForReqIFProperties: returnObj.viewModelPropForReqIFProperties,
        viewModelPropForReqIFLOVPropertyValues: returnObj.viewModelPropForReqIFLOVPropertyValues,
        reqIFPropertiesForMapping: returnObj.reqIFPropertiesForMapping,
        reqIFLovPropertyValuesForMapping: returnObj.reqIFLovPropertyValuesForMapping,
        reqIFLovProperyValues: returnObj.reqIFLovProperyValues,
        reqIfAttributeMappingInfos: returnObj.reqIfAttributeMappingInfos,
        typeLinkMapPropsData: returnObj.typeLinkMapPropsData,
        viewModelPropForReqIFTypes: returnObj.viewModelPropForReqIFTypes,
        viewModelPropForReqIFTraceLinks: returnObj.viewModelPropForReqIFTraceLinks,
        reqIFProperties: returnObj.reqIFProperties,
        tcTypesInteranlDisplayNameMap: returnObj.tcTypesInteranlDisplayNameMap,
        typesForMapping: returnObj.typesForMapping,
        reqIFTypes: returnObj.reqIFTypes,
        traceLinksForMapping: returnObj.traceLinksForMapping,
        reqIFTraceLinks: returnObj.reqIFTraceLinks,
        selectedRule: selectedRule,
        viewModelPropForReqIFPropertiesArray: viewModelPropForReqIFPropertiesArray
    };
};

/**
 * Add the 'lovApi' function set import reqIF mappings to the given ViewModelProperty
 *
 * @param {Object} data - The view model data
 *
 */
export let initImportReqIFMappingLovApi = function( data ) {
    var ruleList = data.getRulesInfoResponse.rulesData;
    var listModels = [];
    var listModel1 = {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        sel: false
    };
    listModels.push( listModel1 );
    var propertiesForMapping = data.getRulesInfoResponse.rulesData;
    for( var index = 0; index < propertiesForMapping.length; index++ ) {
        var entry = propertiesForMapping[ index ];

        var listModel = {
            propDisplayValue: '',
            propInternalValue: '',
            propDisplayDescription: '',
            sel: false
        };
        listModel.propDisplayValue = entry.ruleDispName;
        listModel.propInternalValue = entry.ruleName;
        listModels.push( listModel );
    }
    var savedMappingsListBoxValues = listModels;
    return {
        ruleList: ruleList,
        savedMappingsListBoxValues: savedMappingsListBoxValues
    };
};

/**
 * Remove all created reqIF data for import reqIF.
 *
 * @param {Object} data - The view model data
 */
export let clearAllReqIFData = function( data ) {
    var isValidMapping = false;
    var isReqIFTypes = false;
    var isReqIFTraceLinks = false;

    var viewModelPropForReqIFTypes = [];
    var typesForMapping = [];
    var reqIFTypes = [];

    var viewModelPropForReqIFTraceLinks = [];
    var traceLinksForMapping = [];
    var reqIFTraceLinks = [];

    var viewModelPropForReqIFProperties = {};
    var reqIFPropertiesForMapping = {};
    var reqIFProperties = {};

    var viewModelPropForReqIFLOVPropertyValues = {};
    var reqIFLovPropertyValuesForMapping = {};
    var reqIFLovProperyValues = {};

    var reqIfAttributeMappingInfos = [];
    var tcTypesInteranlDisplayNameMap = {};

    var typeLinkMapPropsData = {};

    appCtxSvc.updatePartialCtx( 'saveImportReqIFSaveMappingCmdVisiblity', false );
    var returnObj = {
        isValidMapping,
        isReqIFTypes,
        isReqIFTraceLinks,
        viewModelPropForReqIFProperties,
        viewModelPropForReqIFLOVPropertyValues ,
        reqIFPropertiesForMapping,
        reqIFLovPropertyValuesForMapping,
        reqIFLovProperyValues,
        reqIfAttributeMappingInfos,
        typeLinkMapPropsData,
        viewModelPropForReqIFTypes,
        viewModelPropForReqIFTraceLinks,
        reqIFProperties,
        tcTypesInteranlDisplayNameMap,
        typesForMapping,
        reqIFTypes,
        traceLinksForMapping,
        reqIFTraceLinks
    };
    return returnObj;
};

/**
 * Remove all mapping of import reqIF.
 *
 * @param {Object} data - The view model data
 */
export let removeAllMappings = function( data ) {
    var isValidMapping = false;
    var isReqIFTypes = Boolean( data && data.reqIFTypes && data.reqIFTypes.length > 0 );
    var isReqIFTraceLinks = Boolean( data && data.viewModelPropForReqIFTraceLinks && data.viewModelPropForReqIFTraceLinks.length > 0 );
    if( data.viewModelPropForReqIFTypes && data.viewModelPropForReqIFTypes.length > 0 ) {
        var viewModelPropForReqIFTypes = _.clone(data.viewModelPropForReqIFTypes);
        viewModelPropForReqIFTypes = _clearReqIFTypesDisplayValue( viewModelPropForReqIFTypes );
    }
    if( data.viewModelPropForReqIFTraceLinks && data.viewModelPropForReqIFTraceLinks.length > 0 ) {
        var viewModelPropForReqIFTraceLinks = _.clone(data.viewModelPropForReqIFTraceLinks);
        viewModelPropForReqIFTraceLinks =_clearReqIFTypesDisplayValue( viewModelPropForReqIFTraceLinks );
    }
    var viewModelPropForReqIFProperties = {};
    var viewModelPropForReqIFLOVPropertyValues = {};
    var reqIFPropertiesForMapping = {};
    var reqIFLovPropertyValuesForMapping = {};
    var reqIFLovProperyValues = {};
    var reqIfAttributeMappingInfos = [];
    var typeLinkMapPropsData = {};
    var reqIFProperties = data.reqIFProperties;
    var tcTypesInteranlDisplayNameMap = data.tcTypesInteranlDisplayNameMap;
    appCtxSvc.updatePartialCtx( 'saveImportReqIFSaveMappingCmdVisiblity', false );
    var returnObj = {
        isValidMapping,
        isReqIFTypes,
        isReqIFTraceLinks,
        viewModelPropForReqIFProperties,
        viewModelPropForReqIFLOVPropertyValues,
        reqIFPropertiesForMapping ,
        reqIFLovPropertyValuesForMapping,
        reqIFLovProperyValues,
        reqIfAttributeMappingInfos,
        typeLinkMapPropsData,
        viewModelPropForReqIFTypes,
        viewModelPropForReqIFTraceLinks,
        reqIFProperties,
        tcTypesInteranlDisplayNameMap
    };
    return returnObj;
};

/**
 * Populate the mapping for the selected saved mapping name
 *
 * @param {Object} data - The view model data
 *
 */
export let populateRulesFromSavedMappingNameInitial = function( data ) {
    var reqIFTypes = [];
    var reqIFTraceLinks =[];
    for( var i = 0; i < data.getSpecificationMetadataResponse.reqIFTypePropInfos.length; i++ ) {
        var listModel = {
            dispTypeName: '',
            objectType: ''
        };
        listModel.dispTypeName = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].dispTypeName;
        listModel.objectType = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].dispTypeName;
        listModel.typeInfo = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].typeInfo;
        if( data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].typeInfo !== 'Relation' ) {
            reqIFTypes.push( listModel );
        } else {
            reqIFTraceLinks.push( listModel );
        }
    }

    // to show map types panel section if types exist
    if( reqIFTypes.length > 0 ) {
        var isReqIFTypes = true;
    }

    // to show map tracelinks panel section if tracelinks exist
    if( reqIFTraceLinks.length > 0 ) {
        var isReqIFTraceLinks = true;
    }

    var reqIFProperties = _getPropertiesFromReqIFObject( data );

    var typePropInfos = _.clone( data.getSpecificationMetadataResponse.typePropInfos, true );
    var tcTypesInteranlDisplayNameMap =[];
    // create map of tc object and property information
    for( var j = 0; j < typePropInfos.length; j++ ) {
        var typeInfo = _getTcTypePropsInfoInMap( typePropInfos[ j ] );
        tcTypesInteranlDisplayNameMap[ typePropInfos[ j ].objectType ] = typeInfo;
    }
    var typesForMapping = [];
    var viewModelPropForReqIFTraceLinks = [];

    var traceLinksForMapping = [];
    var viewModelPropForReqIFTypes = [];

    var reqIFPropertiesForMapping = {};
    var viewModelPropForReqIFProperties = {};

    var reqIFLovPropertyValuesForMapping = {};
    var viewModelPropForReqIFLOVPropertyValues = {};

    // Create view model properties for types
    if( reqIFTypes && reqIFTypes.length > 0 ) {
        viewModelPropForReqIFTypes = _createViewModelPropertyForObjects( reqIFTypes, data.typesForMapping, data.viewModelPropForReqIFTypes );
    }

    // Create view model properties for trace links
    if( reqIFTraceLinks && reqIFTraceLinks.length > 0 ) {
        viewModelPropForReqIFTraceLinks = _createViewModelPropertyForObjects( reqIFTraceLinks, data.traceLinksForMapping, data.viewModelPropForReqIFTraceLinks );
    }

    // Get selected properties
    for( var i = 0; i < typePropInfos.length; i++ ) {
        var typePropInfo = typePropInfos[ i ];
        if( typePropInfo.typeInfo !== 'Relation' ) {
            typePropInfo = _createViewModelObjectForData( typePropInfo );
            typesForMapping.push( typePropInfo );
        } else {
            typePropInfo = _createViewModelObjectForData( typePropInfo );

            traceLinksForMapping.push( typePropInfo );
        }
    }
    return {
        reqIFTypes:reqIFTypes,
        reqIFTraceLinks:reqIFTraceLinks,
        isReqIFTypes:isReqIFTypes,
        isReqIFTraceLinks:isReqIFTraceLinks,
        reqIFProperties:reqIFProperties,
        typePropInfos:typePropInfos,
        tcTypesInteranlDisplayNameMap:tcTypesInteranlDisplayNameMap,
        typesForMapping:typesForMapping,
        traceLinksForMapping:traceLinksForMapping,
        viewModelPropForReqIFTypes:viewModelPropForReqIFTypes,
        viewModelPropForReqIFTraceLinks:viewModelPropForReqIFTraceLinks,
        reqIFPropertiesForMapping:reqIFPropertiesForMapping,
        viewModelPropForReqIFProperties:viewModelPropForReqIFProperties,
        reqIFLovPropertyValuesForMapping:reqIFLovPropertyValuesForMapping,
        viewModelPropForReqIFLOVPropertyValues:viewModelPropForReqIFLOVPropertyValues
    };
};

var _returnLOVArrayContainer = function( returnObj1, keys, reqIFTypeInfo ){
    var viewModelPropForReqIFLOVPropertyArrayContainer=[];
    var viewModelPropForReqIFLOVPropertyArrayClone = {};
    if( returnObj1 && returnObj1.viewModelPropForReqIFLOVPropertyArray ) {
        viewModelPropForReqIFLOVPropertyArrayClone = _.clone( returnObj1.viewModelPropForReqIFLOVPropertyArray );
        for( var i = 0; i < keys.length; i++ ) {
            for( var j = 0; j < viewModelPropForReqIFLOVPropertyArrayClone.length; j++ ) {
                var keys1 = Object.keys( reqIFTypeInfo.reqIfAttrVsTcAttr[ keys[ i ] ].reqIfLovValuesVsTcLovValues );
                var valuesLov1 = Object.values( reqIFTypeInfo.reqIfAttrVsTcAttr[ keys[ i ] ].reqIfLovValuesVsTcLovValues );
                for( var h = 0; h < keys1.length; h++ ) {
                    if( viewModelPropForReqIFLOVPropertyArrayClone[ j ].propertyName === keys1[ h ] ) {
                        viewModelPropForReqIFLOVPropertyArrayClone[ j ].dbValue = valuesLov1[ h ];
                        viewModelPropForReqIFLOVPropertyArrayClone[ j ].uiValue = valuesLov1[ h ];
                    }
                }
            }
        }
        viewModelPropForReqIFLOVPropertyArrayContainer = viewModelPropForReqIFLOVPropertyArrayContainer.concat( viewModelPropForReqIFLOVPropertyArrayClone );
    }
    return viewModelPropForReqIFLOVPropertyArrayContainer;

};

var _returnLOVArrayContainerTC = function( returnObj2, keys, reqIFTracelinkInfo ){
    var viewModelPropForReqIFLOVPropertyArrayContainerTC = [];
    var viewModelPropForReqIFLOVPropertyArrayCloneTC = {};
    if( returnObj2 && returnObj2.viewModelPropForReqIFLOVPropertyArray ) {
        viewModelPropForReqIFLOVPropertyArrayCloneTC = _.clone( returnObj2.viewModelPropForReqIFLOVPropertyArray );
        for( var i = 0; i < keys.length; i++ ) {
            for( var j = 0; j < viewModelPropForReqIFLOVPropertyArrayCloneTC.length; j++ ) {
                var keys1 = Object.keys( reqIFTracelinkInfo.reqIfAttrVsTcAttr[ keys[ i ] ].reqIfLovValuesVsTcLovValues );
                var valuesLov1 = Object.values( reqIFTracelinkInfo.reqIfAttrVsTcAttr[ keys[ i ] ].reqIfLovValuesVsTcLovValues );
                for( var h = 0; h < keys1.length; h++ ) {
                    if( viewModelPropForReqIFLOVPropertyArrayCloneTC[ j ].propertyName === keys1[ h ] ) {
                        viewModelPropForReqIFLOVPropertyArrayCloneTC[ j ].dbValue = valuesLov1[ h ];
                        viewModelPropForReqIFLOVPropertyArrayCloneTC[ j ].uiValue = valuesLov1[ h ];
                    }
                }
            }
        }
        viewModelPropForReqIFLOVPropertyArrayContainerTC = viewModelPropForReqIFLOVPropertyArrayContainerTC.concat( viewModelPropForReqIFLOVPropertyArrayCloneTC );
    }
    return viewModelPropForReqIFLOVPropertyArrayContainerTC;
};

/**
 * Populate the mapping for the selected saved mapping name
 *
 * @param {Object} data - The view model data
 *
 */
export let populateRulesFromSavedMappingName = function( data ) {
    var rulesData = data.response.rulesData;
    var typeLinkPropsData = [];
    var typeLinkMapPropsData = {};
    var viewModelPropForReqIFProperties = {};
    var viewModelPropForReqIFPropertiesArrayClone = {};
    var viewModelPropForReqIFLOVPropertyArrayContainer=[];
    var viewModelPropForReqIFLOVPropertyArrayContainerTC=[];

    for( let k = 0; k < rulesData.length; k++ ) {
        var singleRulesData = rulesData[ k ];
        typeLinkPropsData = JSON.parse( singleRulesData.rules );
        if( typeLinkPropsData && typeLinkPropsData.length > 0 ) {
            for( let index = 0; index < typeLinkPropsData.length; index++ ) {
                typeLinkMapPropsData[ typeLinkPropsData[ index ].reqIfType ] = typeLinkPropsData[ index ];
            }
            if( data && data.viewModelPropForReqIFTypes && data.viewModelPropForReqIFTypes.length > 0 ) {
                for( let l = 0; l < data.viewModelPropForReqIFTypes.length; l++ ) {
                    var viewModelPropForReqIFTypes = _.clone(data.viewModelPropForReqIFTypes);
                    var reqIFTypeInfo = typeLinkMapPropsData[ data.viewModelPropForReqIFTypes[ l ].propertyName ];
                    var eventData = {
                        reqObjectName: reqIFTypeInfo.tcType,
                        reqIfObjectName: reqIFTypeInfo.reqIfType,
                        reqIfObjectDisplayName: reqIFTypeInfo.reqIfType
                    };
                    appCtxSvc.updatePartialCtx( 'showImportReqIFSaveMappingVisiblity', true );
                    var returnObj = _showReqIFProperties(data,eventData);

                    var values = Object.values( returnObj.viewModelPropForReqIFProperties );
                    viewModelPropForReqIFProperties[reqIFTypeInfo.reqIfType] = values[0];
                    if( reqIFTypeInfo ) {
                        var ObjectLOV = Object.values(reqIFTypeInfo.reqIfAttrVsTcAttr);
                        var keys = Object.keys(reqIFTypeInfo.reqIfAttrVsTcAttr);
                        for(var i = 0; i<ObjectLOV.length; i++){
                            if(ObjectLOV[i].hasLov === true){
                                var eventData = {
                                    reqIFPropertyParentName: reqIFTypeInfo.reqIfType,
                                    reqIfObjectDisplayName: keys[i],
                                    reqIfObjectName: '',
                                    reqObjectName: ObjectLOV[i].propName
                                };
                                var returnObj1 = _showReqIFLOVProprtyValues(data, eventData, eventData.reqIFPropertyParentName, viewModelPropForReqIFProperties);
                                var viewModelPropForReqIFLOVPropertyArrayContainer = _returnLOVArrayContainer( returnObj1, keys, reqIFTypeInfo );
                            }
                        }
                        viewModelPropForReqIFPropertiesArrayClone = _.clone(viewModelPropForReqIFProperties);
                        for(var i = 0;i< viewModelPropForReqIFPropertiesArrayClone[reqIFTypeInfo.reqIfType].length; i++){
                            for(var j=0; j<keys.length; j++){
                                if(viewModelPropForReqIFPropertiesArrayClone[reqIFTypeInfo.reqIfType][i].propDisplayValue === keys[j]){
                                    viewModelPropForReqIFPropertiesArrayClone[reqIFTypeInfo.reqIfType][i].dbValue = reqIFTypeInfo.reqIfAttrVsTcAttr[keys[j]].propName;
                                    var propdbName = reqIFTypeInfo.reqIfAttrVsTcAttr[ keys[j] ].propName;
                                    viewModelPropForReqIFPropertiesArrayClone[reqIFTypeInfo.reqIfType][i].uiValue = //
                                        data.tcTypesInteranlDisplayNameMap[reqIFTypeInfo.tcType].propInfos[ propdbName ].dispPropName;
                                }
                            }
                        }
                        viewModelPropForReqIFTypes[ l ].dbValue = reqIFTypeInfo.tcType;
                        if( data.tcTypesInteranlDisplayNameMap[ reqIFTypeInfo.tcType ] && data.tcTypesInteranlDisplayNameMap[ reqIFTypeInfo.tcType ].dispTypeName ) {
                            viewModelPropForReqIFTypes[ l ].uiValue = data.tcTypesInteranlDisplayNameMap[ reqIFTypeInfo.tcType ].dispTypeName;
                        }
                    }
                }
            }
            if( data && data.viewModelPropForReqIFTraceLinks && data.viewModelPropForReqIFTraceLinks.length > 0 ) {
                for( var m = 0; m < data.viewModelPropForReqIFTraceLinks.length; m++ ) {
                    var viewModelPropForReqIFTraceLinks = _.clone(data.viewModelPropForReqIFTraceLinks);
                    var reqIFTracelinkInfo = typeLinkMapPropsData[ data.viewModelPropForReqIFTraceLinks[ m ].propertyName ];
                    var eventData = {
                        reqObjectName: reqIFTracelinkInfo.tcType,
                        reqIfObjectName: reqIFTracelinkInfo.reqIfType,
                        reqIfObjectDisplayName: reqIFTracelinkInfo.reqIfType
                    };
                    appCtxSvc.updatePartialCtx( 'showImportReqIFSaveMappingVisiblity', true );
                    var returnObj = _showReqIFProperties(data,eventData);

                    var values = Object.values( returnObj.viewModelPropForReqIFProperties );
                    viewModelPropForReqIFProperties[reqIFTracelinkInfo.reqIfType] = values[0];

                    if( reqIFTracelinkInfo ) {
                        var ObjectLOV = Object.values(reqIFTracelinkInfo.reqIfAttrVsTcAttr);
                        var keys = Object.keys(reqIFTracelinkInfo.reqIfAttrVsTcAttr);
                        for(var i = 0; i<ObjectLOV.length; i++){
                            if(ObjectLOV[i].hasLov === true){
                                var eventData = {
                                    reqIFPropertyParentName: reqIFTracelinkInfo.reqIfType,
                                    reqIfObjectDisplayName: keys[i],
                                    reqIfObjectName: '',
                                    reqObjectName: ObjectLOV[i].propName
                                };
                                var returnObj2 = _showReqIFLOVProprtyValues(data, eventData, eventData.reqIFPropertyParentName, viewModelPropForReqIFProperties);
                                var viewModelPropForReqIFLOVPropertyArrayContainerTC = _returnLOVArrayContainerTC( returnObj2, keys, reqIFTracelinkInfo );
                            }
                        }
                        viewModelPropForReqIFPropertiesArrayClone = _.clone(viewModelPropForReqIFProperties);
                        var keys = Object.keys(reqIFTracelinkInfo.reqIfAttrVsTcAttr);
                        for(var i = 0;i< viewModelPropForReqIFPropertiesArrayClone[reqIFTracelinkInfo.reqIfType].length; i++){
                            for(var j=0; j<keys.length; j++){
                                if(viewModelPropForReqIFPropertiesArrayClone[reqIFTracelinkInfo.reqIfType][i].propDisplayValue === keys[j]){
                                    viewModelPropForReqIFPropertiesArrayClone[reqIFTracelinkInfo.reqIfType][i].dbValue = reqIFTracelinkInfo.reqIfAttrVsTcAttr[keys[j]].propName;
                                    var propdbName = reqIFTracelinkInfo.reqIfAttrVsTcAttr[ keys[j] ].propName;
                                    viewModelPropForReqIFPropertiesArrayClone[reqIFTracelinkInfo.reqIfType][i].uiValue = //
                                        data.tcTypesInteranlDisplayNameMap[reqIFTracelinkInfo.tcType].propInfos[ propdbName ].dispPropName;
                                }
                            }
                        }
                        viewModelPropForReqIFTraceLinks[ m ].dbValue = reqIFTracelinkInfo.tcType;
                        if( data.tcTypesInteranlDisplayNameMap[ reqIFTracelinkInfo.tcType ] && data.tcTypesInteranlDisplayNameMap[ reqIFTracelinkInfo.tcType ].dispTypeName ) {
                            viewModelPropForReqIFTraceLinks[ m ].uiValue = data.tcTypesInteranlDisplayNameMap[ reqIFTracelinkInfo.tcType ].dispTypeName;
                        }
                    }
                }
            }
        }
    }

    var viewModelPropForReqIFPropertiesArray = [];
    var values = Object.values( viewModelPropForReqIFPropertiesArrayClone );
    for( var i = 0; i < values.length; i++ ) {
        for( var j = 0; j < values[ i ].length; j++ ) {
            viewModelPropForReqIFPropertiesArray.push( values[ i ][ j ] );
        }
    }
    var viewModelPropForReqIFLOVPropertyArray = [];
    viewModelPropForReqIFLOVPropertyArray = viewModelPropForReqIFLOVPropertyArrayContainer.concat(viewModelPropForReqIFLOVPropertyArrayContainerTC);
    return {
        viewModelPropForReqIFTypes:viewModelPropForReqIFTypes,
        viewModelPropForReqIFProperties:viewModelPropForReqIFProperties,
        typeLinkMapPropsData:typeLinkMapPropsData,
        viewModelPropForReqIFPropertiesArray:viewModelPropForReqIFPropertiesArray,
        viewModelPropForReqIFLOVPropertyArray:viewModelPropForReqIFLOVPropertyArray

    };
};

/**
 * Hide ImportReqIF SaveMapping Visiblity
 */
export let hideImportReqIFSaveMappingVisiblity = function() {
    AwTimeoutService.instance( function() {
        appCtxSvc.updatePartialCtx( 'showImportReqIFSaveMappingVisiblity', false );
    }, 200 );
};

/**
 * Selected object to import
 *
 * @param {Object} ctx -  Application context
 *
 * @return {Object} selected object
 */
export let selectedObjectToImport = function( selected ) {
    var object = { uid: 'AAAAAAAAAAAAAA' };
    if( selected && selected.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        object.uid = selected.uid;
        object.type = selected.type;
    }
    return object;
};

/**
 * Get Base URL
 *
 * @return {string} Base URL
 */
export let getBaseURL = function() {
    return browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
};

/**
 * Get types from response data.
 *
 * @param {Object} data - The view model data
 *
 */
export let createTypesRelationsMap = function( data, sharedData ) {

    // delete earlier generated fms ticket to process fms upload on button action
    const newSharedData = { ...sharedData.value };
    var newForm = newSharedData.formData;
    newForm.delete( 'fmsTicket' );
    newSharedData.formData = newForm;
    sharedData.update && sharedData.update( newSharedData );

    // initialize import reqIF mapping data
    exports.initImportReqIFMappingsData( data );

    //initiailze type relations data
    var returnObj = exports.initTypeRelationsData( data );

    return {
        reqIFTypes: returnObj.reqIFTypes,
        reqIFTraceLinks: returnObj.reqIFTraceLinks,
        isReqIFTypes: returnObj.isReqIFTypes,
        isReqIFTraceLinks: returnObj.isReqIFTraceLinks,
        reqIFProperties: returnObj.reqIFProperties,
        typePropInfos: returnObj.typePropInfos,
        tcTypesInteranlDisplayNameMap: returnObj.tcTypesInteranlDisplayNameMap,
        typesForMapping: returnObj.typesForMapping,
        traceLinksForMapping: returnObj.traceLinksForMapping,
        viewModelPropForReqIFTypes: returnObj.viewModelPropForReqIFTypes,
        viewModelPropForReqIFTraceLinks: returnObj.viewModelPropForReqIFTraceLinks,
        reqIFPropertiesForMapping: returnObj.reqIFPropertiesForMapping,
        viewModelPropForReqIFProperties: returnObj.viewModelPropForReqIFProperties,
        reqIFLovPropertyValuesForMapping: returnObj.reqIFLovPropertyValuesForMapping,
        viewModelPropForReqIFLOVPropertyValues: returnObj.viewModelPropForReqIFLOVPropertyValues,
        viewModelPropForReqIFTypesClone: returnObj.viewModelPropForReqIFTypesClone,
        viewModelPropForReqIFTraceLinksClone : returnObj.viewModelPropForReqIFTraceLinksClone
    };
};

/**
 * Initialize type relations data
 *
 * @param {Object} data - The view model data
 */
export let initTypeRelationsData = function( data ) {
    // add reqIF objects data in an array
    var reqIFTypes = [];
    var reqIFTraceLinks = [];
    for( var i = 0; i < data.getSpecificationMetadataResponse.reqIFTypePropInfos.length; i++ ) {
        var listModel = {
            dispTypeName: '',
            objectType: ''
        };
        listModel.dispTypeName = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].dispTypeName;
        listModel.objectType = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].dispTypeName;
        listModel.typeInfo = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].typeInfo;
        if( data.getSpecificationMetadataResponse.reqIFTypePropInfos[ i ].typeInfo !== 'Relation' ) {
            reqIFTypes.push( listModel );
        } else {
            reqIFTraceLinks.push( listModel );
        }
    }

    // to show map types panel section if types exist
    if( reqIFTypes.length > 0 ) {
        var isReqIFTypes = true;
    }

    // to show map tracelinks panel section if tracelinks exist
    if( reqIFTraceLinks.length > 0 ) {
        var isReqIFTraceLinks = true;
    }

    var reqIFProperties = _getPropertiesFromReqIFObject( data );

    var typePropInfos = _.clone( data.getSpecificationMetadataResponse.typePropInfos, true );
    var tcTypesInteranlDisplayNameMap = [];
    // create map of tc object and property information
    for( var j = 0; j < typePropInfos.length; j++ ) {
        var typeInfo = _getTcTypePropsInfoInMap( typePropInfos[ j ] );
        tcTypesInteranlDisplayNameMap[ typePropInfos[ j ].objectType ] = typeInfo;
    }

    var typesForMapping = [];
    var viewModelPropForReqIFTraceLinks = [];
    var viewModelPropForReqIFTraceLinksClone = [];

    var traceLinksForMapping = [];
    var viewModelPropForReqIFTypes = [];
    var viewModelPropForReqIFTypesClone = [];

    var reqIFPropertiesForMapping = {};
    var viewModelPropForReqIFProperties = {};

    var reqIFLovPropertyValuesForMapping = {};
    var viewModelPropForReqIFLOVPropertyValues = {};

    // Create view model properties for types
    if( reqIFTypes && reqIFTypes.length > 0 ) {
        viewModelPropForReqIFTypes = _createViewModelPropertyForObjects( reqIFTypes, typesForMapping, viewModelPropForReqIFTypes );
    }

    // Create view model properties for trace links
    if( reqIFTraceLinks && reqIFTraceLinks.length > 0 ) {
        viewModelPropForReqIFTraceLinks = _createViewModelPropertyForObjects( reqIFTraceLinks, traceLinksForMapping, viewModelPropForReqIFTraceLinks );
    }

    // Get selected properties
    for( var i = 0; i < typePropInfos.length; i++ ) {
        var typePropInfo = typePropInfos[ i ];
        if( typePropInfo.typeInfo !== 'Relation' ) {
            typePropInfo = _createViewModelObjectForData( typePropInfo );
            viewModelPropForReqIFTypesClone = viewModelPropForReqIFTypes;
            typesForMapping.push( typePropInfo );
        } else {
            typePropInfo = _createViewModelObjectForData( typePropInfo );
            viewModelPropForReqIFTraceLinksClone = viewModelPropForReqIFTraceLinks;
            traceLinksForMapping.push( typePropInfo );
        }
    }

    var returnObj = {
        reqIFTypes,
        reqIFTraceLinks,
        isReqIFTypes,
        isReqIFTraceLinks,
        reqIFProperties,
        typePropInfos,
        tcTypesInteranlDisplayNameMap,
        typesForMapping,
        traceLinksForMapping,
        viewModelPropForReqIFTypes,
        viewModelPropForReqIFTraceLinks,
        reqIFPropertiesForMapping,
        viewModelPropForReqIFProperties,
        reqIFLovPropertyValuesForMapping,
        viewModelPropForReqIFLOVPropertyValues,
        viewModelPropForReqIFTypesClone,
        viewModelPropForReqIFTraceLinksClone
    };
    return returnObj;
};

/**
 * Add the 'lovApi' function set object to the given ViewModelProperty
 *
 * @param {ViewModelProperty} viewProp - view model property
 *
 */
export let initNativeCellLovApi = function( viewProp ) {
    viewProp.lovApi.getInitialValues = function( filterStr, deferred ) {
        var lovEntries = _.clone( this.requiredPropertiesList );
        if( this.dataForMapping ) {
            // First add the all required properties from all subTypes
            if( this.requiredPropertiesList.length === 0 ) {
                _createLovEntries( this, lovEntries );
                this.requiredPropertiesList = _.clone( lovEntries, true );
            }
        }
        return deferred.resolve( lovEntries );
    };

    viewProp.lovApi.getNextValues = function( deferred ) {
        // LOVs do not support paging.
        deferred.resolve( null );
    };

    viewProp.lovApi.validateLOVValueSelections = function() {
        eventBus.publish( 'importSpecificationReqIF.validateMapping' );
        return false;
    };

    viewProp.lovApi.type = 'static';
};

/**
 * Validate if all types and properties are mapped.
 *
 * @param {Object} data - The view model data
 *
 */
export let validateMapping = function( data ) {
    var isValidMappingForTypes = false;
    var isValidMappingForTraceLinks = false;
    isValidMappingForTypes = data && data.viewModelPropForReqIFTypes && data.viewModelPropForReqIFTypes.length > 0 ? _checkValidMapping( data, data.viewModelPropForReqIFTypes ) : true;
    isValidMappingForTraceLinks = data && data.viewModelPropForReqIFTraceLinks && data.viewModelPropForReqIFTraceLinks.length > 0 ? _checkValidMapping( data, data.viewModelPropForReqIFTraceLinks ) :
        true;
    var isValidMapping = Boolean( isValidMappingForTypes && isValidMappingForTraceLinks );
    if( isValidMapping ) {
        appCtxSvc.updatePartialCtx( 'saveImportReqIFSaveMappingCmdVisiblity', true );
    } else {
        appCtxSvc.updatePartialCtx( 'saveImportReqIFSaveMappingCmdVisiblity', false );
    }
    return {
        isValidMapping: isValidMapping
    };
};

/**
 * Get new mappiing input data to Import from ReqIF
 *
 * @param {Object} data - The view model data
 *
 * @return {object} reqIfAttributeMappingInfos
 */
export let getNewReqIFImportInput = function( data ) {

    var importFromReqIFProgressing = false;
    if( !data.runInBackgroundReqIF.dbValue ) {
        var importFromReqIFProgressing = true;
    }
    var returnObj = _getReqIFImportInput( data );
    return {
        importFromReqIFProgressing: importFromReqIFProgressing,
        reqIfAttributeMappingInfos: returnObj.reqIfAttributeMappingInfos
    };
};

/**
 * Unregister the flags from view model data for ReqIF import
 *
 * @param {Object} data - The view model object
 */
export let unRegisterReqIFData = function() {
    var importFromReqIFProgressing = false;
    return {
        importFromReqIFProgressing: importFromReqIFProgressing
    };
};

/**
 * To set command dimentions to show ballon popup
 *
 * @param {Object} data - The view model data
 */
export let setCmdDimensionForBallonPopup = function( data ) {
    var rect = document.querySelector( 'button[button-id=\'Arm0ImportFromReqIFMappingSubSaveCmd\']' ).getBoundingClientRect();
    var cmdDimension = {
        offsetHeight: rect.height,
        offsetLeft: rect.left,
        offsetTop: rect.top,
        offsetWidth: rect.width,
        popupId: 'Arm0ImportFromReqIFMappingSubSaveCmd'
    };
    return cmdDimension;
};

/**
 * To fire event for save mapping button click on popup
 *
 * @param {Object} data - The view model data
 */
export let saveImportReqIFMappingPopupButtonClicked = function( data ) {
    _ruleName = data.ruleName.dbValue;
    if( data.globalScopeCheck.dbValue === true ) {
        _ruleScope = 'GLOBAL';
    } else {
        _ruleScope = 'LOCAL';
    }
    eventBus.publish( 'importSpecificationReqIF.createSaveImportReqIFMappingInput' );
};

/**
 * Update existing mapping for import reqIF
 */
export let updateImportReqIFMapping = function() {
    eventBus.publish( 'importSpecificationReqIF.createSaveImportReqIFMappingInput' );
};

/**
 * Create input for saving import reqIF mapping
 *
 * @param {Object} data - The view model data
 */
export let createSaveImportReqIFMappingInput = function( data ) {
    var input = {};
    var rulesData = {};

    // get existing mapping input
    var mappingData = _getReqIFImportInput( data );

    if( data && data.savedMappings && data.savedMappings.dbValue ) {
        rulesData.ruleName = data.savedMappings.dbValue;
        rulesData.ruleDispName = data.savedMappings.dbValue;
        rulesData.accessRight = 'WRITE';
        rulesData.ruleObject = data.selectedRule.ruleObject;
        rulesData.ruleScope = data.selectedRule.ruleScope;
        input.actionName = 'UPDATE';
    } else {
        rulesData.ruleName = _ruleName;
        rulesData.ruleDispName = _ruleName;
        rulesData.accessRight = 'WRITE';
        rulesData.ruleObject = {
            uid: '',
            type: ''
        };
        input.actionName = 'CREATE';
        if( _ruleScope ) {
            rulesData.ruleScope = _ruleScope;
        }
    }
    input.mappingType = 'ImportReqIF';
    rulesData.rules = '';
    rulesData.rules = JSON.stringify( mappingData.reqIfAttributeMappingInfos );
    input.rulesData = [ rulesData ];
    var importReqIFMappingInput = input;
    _ruleName = null;
    _ruleScope = null;
    return {
        importReqIFMappingInput: importReqIFMappingInput
    };
};

/**
 * Unregister all context related to import reqIF
 *
 */
export let importReqIFcontentUnloaded = function() {
    appCtxSvc.unRegisterCtx( 'saveImportReqIFSaveMappingCmdVisiblity' );
    appCtxSvc.unRegisterCtx( 'mappingType' );
    appCtxSvc.unRegisterCtx( 'showImportReqIFSaveMappingVisiblity' );
    appCtxSvc.unRegisterCtx( 'importReqIFSavedMapping' );
};

/**
 * Map reqIF to teamcenter properties
 *
 * @param {Object} data - The view model data
 * @param {Object} eventData - event data with reqIF object information
 */
export let mapReqIFToTcProps = function( data, eventData ) {
    if( eventData.reqObjectName && typeof eventData.reqObjectName === 'string' && eventData.reqObjectName !== '' ) {
        var returnObj = _showReqIFProperties( data, eventData );
    } else if( typeof eventData.reqObjectName === 'string' ) {
        // clear previously selected properties
        var viewModelPropForReqIFProperties = _.clone( data.viewModelPropForReqIFProperties );
        var values = Object.values( data.viewModelPropForReqIFProperties );
        var viewModelPropForReqIFPropertiesArray = [];
        var viewModelPropForReqIFLOVPropertyArray = [];
        if( data.viewModelPropForReqIFPropertiesArray === undefined ) {
            for( var i = 0; i < values.length; i++ ) {
                for( var j = 0; j < values[ i ].length; j++ ) {
                    if( values[ i ][ j ].objectTypeName !== eventData.reqIfObjectName ) {
                        viewModelPropForReqIFPropertiesArray.push( values[ i ][ j ] );
                    } else {
                        viewModelPropForReqIFProperties[ values[ i ][ j ].objectTypeName ] = [];
                    }
                }
            }
        } else {
            for( var j = 0; j < data.viewModelPropForReqIFPropertiesArray.length; j++ ) {
                if( data.viewModelPropForReqIFPropertiesArray[ j ].objectTypeName !== eventData.reqIfObjectName ) {
                    viewModelPropForReqIFPropertiesArray.push( data.viewModelPropForReqIFPropertiesArray[ j ] );
                } else {
                    viewModelPropForReqIFProperties[ data.viewModelPropForReqIFPropertiesArray[ j ].objectTypeName ] = [];
                }
            }
            if( data.viewModelPropForReqIFLOVPropertyValues ) {
                var viewModelPropForReqIFLOVPropertyValues = _.clone( data.viewModelPropForReqIFLOVPropertyValues );
                for( var j = 0; j < data.viewModelPropForReqIFLOVPropertyArray.length; j++ ) {
                    if( data.viewModelPropForReqIFLOVPropertyArray[ j ].objectParentTypeName !== eventData.reqIfObjectName ) {
                        viewModelPropForReqIFLOVPropertyArray.push( data.viewModelPropForReqIFLOVPropertyArray[ j ] );
                    } else {
                        for( var k = 0; k < viewModelPropForReqIFLOVPropertyValues.length; k++ ) {
                            if( viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues ) {
                                viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues[ data.viewModelPropForReqIFLOVPropertyArray[ j ].objectPropertyTypeName ] = [];
                            }
                        }
                    }
                }
            }
        }
        var returnObj = {
            viewModelPropForReqIFPropertiesArray: viewModelPropForReqIFPropertiesArray,
            viewModelPropForReqIFProperties: viewModelPropForReqIFProperties,
            viewModelPropForReqIFLOVPropertyArray: viewModelPropForReqIFLOVPropertyArray,
            viewModelPropForReqIFLOVPropertyValues: viewModelPropForReqIFLOVPropertyValues

        };
    }
    return {
        viewModelPropForReqIFPropertiesArray: returnObj.viewModelPropForReqIFPropertiesArray,
        viewModelPropForReqIFProperties: returnObj.viewModelPropForReqIFProperties,
        propertiesForMapping: returnObj.propertiesForMapping,
        viewModelPropForReqIFLOVPropertyArray: returnObj.viewModelPropForReqIFLOVPropertyArray,
        viewModelPropForReqIFLOVPropertyValues: returnObj.viewModelPropForReqIFLOVPropertyValues

    };
};

/**
 * Map reqIF to teamcenter lov values
 *
 * @param {Object} data - The view model data
 * @param {Object} eventData - event data with reqIF object and property information
 * @param {String} eventData - event data with reqIF object and property information
 */
export let mapReqIFToTcLovValues = function( data, eventData, awObjectName ) {
    if( eventData.reqObjectName && typeof eventData.reqObjectName === 'string' && eventData.reqObjectName !== '' ) {
        for( var i = 0; i < data.viewModelPropForReqIFTypes.length; i++ ) {
            if( data.viewModelPropForReqIFTypes[ i ].propertyName === eventData.reqIFPropertyParentName ) {
                awObjectName = data.viewModelPropForReqIFTypes[ i ].dbValue;
            }
        }
        var returnObj = _showReqIFLOVProprtyValues( data, eventData, awObjectName );
    } else if( typeof eventData.reqObjectName === 'string' ) {
        var viewModelPropForReqIFLOVPropertyValues = _.clone( data.viewModelPropForReqIFLOVPropertyValues );
        var values = [];
        for( var i = 0; i < viewModelPropForReqIFLOVPropertyValues.length; i++ ) {
            if( viewModelPropForReqIFLOVPropertyValues[ i ].viewModelPropForReqIFLOVPropertyValues ) {
                var value = Object.values( viewModelPropForReqIFLOVPropertyValues[ i ].viewModelPropForReqIFLOVPropertyValues );
                values.push( value[ 0 ] );
            }
        }
        var viewModelPropForReqIFLOVPropertyArray = [];
        if( data.viewModelPropForReqIFLOVPropertyArray === undefined ) {
            for( var i = 0; i < values.length; i++ ) {
                for( var j = 0; j < values[ i ].length; j++ ) {
                    if( values[ i ][ j ].objectParentTypeName !== eventData.reqIFPropertyParentName ) {
                        viewModelPropForReqIFLOVPropertyArray.push( values[ i ][ j ] );
                    } else {
                        for( var k = 0; k < viewModelPropForReqIFLOVPropertyValues.length; k++ ) {
                            if( viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues ) {
                                viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues[ values[ i ][ j ].objectPropertyTypeName ] = [];
                            }
                        }
                    }
                }
            }
        } else {
            for( var j = 0; j < data.viewModelPropForReqIFLOVPropertyArray.length; j++ ) {
                if( data.viewModelPropForReqIFLOVPropertyArray[ j ].objectParentTypeName !== eventData.reqIFPropertyParentName ) {
                    viewModelPropForReqIFLOVPropertyArray.push( data.viewModelPropForReqIFLOVPropertyArray[ j ] );
                } else {
                    for( var k = 0; k < viewModelPropForReqIFLOVPropertyValues.length; k++ ) {
                        if( viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues ) {
                            viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues[ data.viewModelPropForReqIFLOVPropertyArray[ j ].objectPropertyTypeName ] = [];
                        }
                    }
                }
            }
        }
        var returnObj = {
            viewModelPropForReqIFLOVPropertyArray: viewModelPropForReqIFLOVPropertyArray,
            viewModelPropForReqIFLOVPropertyValues: viewModelPropForReqIFLOVPropertyValues
        };
    }
    return {
        viewModelPropForReqIFLOVPropertyArray: returnObj.viewModelPropForReqIFLOVPropertyArray,
        viewModelPropForReqIFLOVPropertyValues: returnObj.viewModelPropForReqIFLOVPropertyValues,
        lovPropertiesForMapping: returnObj.lovPropertiesForMapping
    };
};

/**
 * Get type property in map format
 *
 * @param {Array} typePropInfo - type propInfo array data
 * @returns {Object} type - return type propInfo map
 *
 */
var _getTcTypePropsInfoInMap = function( typePropInfo ) {
    var type = {
        dispTypeName: '',
        typeInfo: '',
        objectType: '',
        propInfos: {},
        requiredPropInfosArray: []
    };
    var props = {};
    var requiredPropsArray = [];

    if( typePropInfo.propInfos && typePropInfo.propInfos.length > 0 ) {
        for( var j = 0; j < typePropInfo.propInfos.length; j++ ) {
            props[ typePropInfo.propInfos[ j ].propName ] = typePropInfo.propInfos[ j ];
            props[ typePropInfo.propInfos[ j ].propName ].lovInfo = {};
            if( typePropInfo.propInfos[ j ].isRequired && typePropInfo.propInfos[ j ].propName !== 'item_revision_id' ) {
                requiredPropsArray.push( typePropInfo.propInfos[ j ] );
            }
            if( typePropInfo.propInfos[ j ].hasLOV ) {
                if( typePropInfo.propInfos[ j ].lovDispValues && typePropInfo.propInfos[ j ].lovDispValues.length > 0 ) {
                    for( var k = 0; k < typePropInfo.propInfos[ j ].lovDispValues.length; k++ ) {
                        props[ typePropInfo.propInfos[ j ].propName ].lovInfo[ typePropInfo.propInfos[ j ].lovDispValues[ k ] ] = typePropInfo.propInfos[ j ].lovDispValues[ k ];
                    }
                }
            }
        }
    }
    type.objectType = typePropInfo.objectType;
    type.dispTypeName = typePropInfo.dispTypeName;
    type.typeInfo = typePropInfo.typeInfo;
    type.propInfos = props;
    if( typePropInfo.objectType !== 'RequirementSpec' ) {
        type.requiredPropInfosArray = requiredPropsArray;
    }
    return type;
};

/**
 *  Checks if objects or properties are mapped or not .
 *
 * @param {Object} data - The view model data
 * @param {Object} viewModelPropForReqIFTypesTraceLinks - The view model data for types or traceLinks
 * @returns {Boolean} true/false - true, if all objects and properties are mapped
 *
 */
var _checkValidMapping = function( data, viewModelPropForReqIFTypesTraceLinks ) {
    for( var i = 0; i < viewModelPropForReqIFTypesTraceLinks.length > 0; i++ ) {
        if( typeof viewModelPropForReqIFTypesTraceLinks[ i ].dbValue !== 'string' || viewModelPropForReqIFTypesTraceLinks[ i ].dbValue === '' ) {
            return false;
        }
        var reqIFObject = viewModelPropForReqIFTypesTraceLinks[ i ];
        var tcObjectdbValue = reqIFObject.dbValue;
        if( tcObjectdbValue !== 'RequirementSpec' ) {
            var reqIFProps = data.viewModelPropForReqIFProperties[ reqIFObject.propertyDisplayName ];
            if( data.tcTypesInteranlDisplayNameMap[ tcObjectdbValue ] && data.tcTypesInteranlDisplayNameMap[ tcObjectdbValue ].requiredPropInfosArray ) {
                var requiredProps = data.tcTypesInteranlDisplayNameMap[ tcObjectdbValue ].requiredPropInfosArray;
                if( requiredProps && requiredProps.length > 0 ) {
                    for( var j = 0; j < requiredProps.length > 0; j++ ) {
                        reqIFProps = [];
                        for( var l = 0; l < data.viewModelPropForReqIFPropertiesArray.length > 0; l++ ) {
                            if( data.viewModelPropForReqIFPropertiesArray[ l ].objectTypeName === reqIFObject.propertyDisplayName ) {
                                reqIFProps.push( data.viewModelPropForReqIFPropertiesArray[ l ] );
                            }
                        }
                        var isRequiredPropMap = false;
                        if( reqIFProps && reqIFProps.length > 0 ) {
                            for( var k = 0; k < reqIFProps.length > 0; k++ ) {
                                if( typeof reqIFProps[ k ].dbValue === 'string' && reqIFProps[ k ].dbValue !== '' && reqIFProps[ k ].dbValue === requiredProps[ j ].propName ) {
                                    isRequiredPropMap = true;
                                    break;
                                }
                            }
                        }
                        if( !isRequiredPropMap ) {
                            return false;
                        }
                    }
                }
            }
            if( reqIFProps && reqIFProps.length > 0 ) {
                for( var l = 0; l < reqIFProps.length > 0; l++ ) {
                    if( reqIFProps[ l ].hasLOVValues && typeof reqIFProps[ l ].dbValue === 'string' && reqIFProps[ l ].dbValue !== '' ) {
                        var propDisplayname = reqIFProps[ l ].propertyDisplayName;
                        var reqIFLovPropertyValues = reqIFProps[ l ].viewModelPropForReqIFLOVPropertyValues[ propDisplayname ];
                        if( reqIFLovPropertyValues && reqIFLovPropertyValues.length > 0 ) {
                            for( var k = 0; k < reqIFLovPropertyValues.length > 0; k++ ) {
                                for( var n = 0; n < data.viewModelPropForReqIFLOVPropertyArray.length; n++ ) {
                                    if( ( reqIFLovPropertyValues[ k ].objectParentTypeName === data.viewModelPropForReqIFLOVPropertyArray[ n ].objectParentTypeName ) &&
                                        ( reqIFLovPropertyValues[ k ].objectPropertyTypeName === data.viewModelPropForReqIFLOVPropertyArray[ n ].objectPropertyTypeName ) &&
                                        ( typeof data.viewModelPropForReqIFLOVPropertyArray[ n ].dbValue !== 'string' || data.viewModelPropForReqIFLOVPropertyArray[ n ].dbValue === '' ) ) {
                                        return false;
                                    }
                                }
                            }
                        } else { return false; }
                    }
                }
            }
        }
    }
    return true;
};

var _getReqIfAttrVsTcAttr = function( index, data, reqIFType, reqIfAttrVsTcAttr ){
    var tcAttrInfo = {};
    if( data.viewModelPropForReqIFPropertiesArray[ index ].objectTypeName === reqIFType ) {
        var reqIFTypeProperty = data.viewModelPropForReqIFPropertiesArray[ index ];
        if( typeof reqIFTypeProperty.dbValue === 'string' && reqIFTypeProperty.dbValue !== '' ) {
            tcAttrInfo.propName = reqIFTypeProperty.dbValue;
            tcAttrInfo.hasLov = reqIFTypeProperty.hasLOVValues;
            tcAttrInfo.reqIfLovValuesVsTcLovValues = {};

            if( tcAttrInfo.hasLov ) {
                var viewModelPropValues = reqIFTypeProperty.viewModelPropForReqIFLOVPropertyValues[ reqIFTypeProperty.propertyDisplayName ];
                if( viewModelPropValues && viewModelPropValues.length > 0 ) {
                    for( let k = 0; k < viewModelPropValues.length; k++ ) {
                        for( let m = 0; m < data.viewModelPropForReqIFLOVPropertyArray.length; m++ ) {
                            if( viewModelPropValues[ k ].propertyName === data.viewModelPropForReqIFLOVPropertyArray[ m ].propertyName ) {
                                tcAttrInfo.reqIfLovValuesVsTcLovValues[ viewModelPropValues[ k ].propertyName ] = data.viewModelPropForReqIFLOVPropertyArray[ m ].dbValue;
                            }
                        }

                    }
                }
            }
            reqIfAttrVsTcAttr[ reqIFTypeProperty.propertyDisplayName ] = tcAttrInfo;
        }
    }
    return reqIfAttrVsTcAttr;

};
/**
 *  To collect all mappped ReqIF and teamcenter properties
 *
 * @param {Object} data - The view model data
 * @param {Array} viewModelPropForReqIFTypesLinks - The view model data with reqIF and tc object mapping
 *
 */
var _createReqIFAttributeMapForImport = function( data, viewModelPropForReqIFTypesLinks ) {
    var reqIfAttributeMappingInfos = [];
    for( let i = 0; i < viewModelPropForReqIFTypesLinks.length; i++ ) {
        var reqIfAttributeMappingInfo = {};
        var objectType = viewModelPropForReqIFTypesLinks[ i ];

        var reqIFType = objectType.propertyName;
        var tcType = objectType.dbValue;
        var typeInfo = objectType.typeInfo;
        var reqIfAttrVsTcAttr = {};

        if( data && data.viewModelPropForReqIFProperties && data.viewModelPropForReqIFProperties[ reqIFType ] &&
            data.viewModelPropForReqIFProperties[ reqIFType ].length > 0 ) {
            for( let j = 0; j < data.viewModelPropForReqIFProperties[ reqIFType ].length; j++ ) {
                for( let index = 0; index < data.viewModelPropForReqIFPropertiesArray.length; index++ ) {
                    reqIfAttrVsTcAttr = _getReqIfAttrVsTcAttr( index, data, reqIFType, reqIfAttrVsTcAttr );
                }
            }
        }

        reqIfAttributeMappingInfo.reqIfType = reqIFType;
        reqIfAttributeMappingInfo.tcType = tcType;
        reqIfAttributeMappingInfo.reqIfAttrVsTcAttr = reqIfAttrVsTcAttr;
        reqIfAttributeMappingInfo.typeInfo = typeInfo;

        reqIfAttributeMappingInfos.push( reqIfAttributeMappingInfo );
    }
    return reqIfAttributeMappingInfos;
};

/**
 * Get all properties for the selected reqIF object
 *
 * @param {Object} data - The view model data
 * @return {object} propMap
 *
 */
var _getPropertiesFromReqIFObject = function( data ) {
    var propMap = {};
    for( var index = 0; index < data.getSpecificationMetadataResponse.reqIFTypePropInfos.length; index++ ) {
        var typePropInfo = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ index ];
        var propInfos = typePropInfo.propInfos;
        propMap[ typePropInfo.dispTypeName ] = propInfos;
    }
    return propMap;
};

/**
 * Create view model property for all objects
 * @param {Object} data - The view model data
 * @param {Array} reqIFObjects - array of reqIF objects
 * @param {Array} objectsForMapping - array of mapping reqIF objects to append to LOV
 * @param {Array} viewModelPropForReqIFobjects - array of reqIF objects with view model property
 *
 */
var _createViewModelPropertyForObjects = function( reqIFObjects, objectsForMapping, viewModelPropForReqIFobjects ) {
    for( let index = 0; index < reqIFObjects.length; index++ ) {
        var reqIFObject = reqIFObjects[ index ];
        var eventName = reqIFObject.objectType + '.lovValueChanged';

        // Subscribe event to map reqIF properties to teamcenter properties for selected reqIF object
        eventBus.subscribe( eventName, function( eventData ) {
            if( eventData && eventData.lovValue ) {
                eventData = {
                    reqObjectName: eventData.lovValue.propInternalValue,
                    reqIfObjectName: reqIFObjects[ index ].objectType,
                    reqIfObjectDisplayName: reqIFObjects[ index ].dispTypeName
                };
            } else {
                eventData = {
                    reqObjectName: "",
                    reqIfObjectName: reqIFObjects[ index ].objectType,
                    reqIfObjectDisplayName: reqIFObjects[ index ].dispTypeName
                };
            }
            eventBus.publish( 'importSpecificationReqIF.validateMapping' );
            eventBus.publish( 'importSpecificationReqIF.mapReqIFToTcProps', eventData );
        } );
        // Show reqIF object list with initilization of lov properties
        var viewProp = _createViewModelObjectForData( reqIFObject );
        viewProp.typeInfo = reqIFObjects[ index ].typeInfo;
        viewProp.lovApi = {};
        viewProp.lovApi.dataForMapping = objectsForMapping;
        viewProp.lovApi.requiredPropertiesList = [];
        viewProp.dataProvider = 'Arm0TypesLOVDataProvider';
        exports.initNativeCellLovApi( viewProp );
        viewModelPropForReqIFobjects.push( viewProp );
    }
    return viewModelPropForReqIFobjects;
};

/**
 * Show reqIF Properties of reqIF Object and attach teamcenter properties to its LOV listbox
 *
 * @param {Object} data - The view model data
 * @param {Array} eventData - event Data
 *
 */
var _showReqIFProperties = function( data, eventData ) {
    // covert reqIF properties into view Model properties
    var viewModelPropForReqIFProperties = _.clone(data.viewModelPropForReqIFProperties);
    var reqIFPropertiesForMapping = _.clone(data.reqIFPropertiesForMapping);
    for( var index = 0; index < data.getSpecificationMetadataResponse.reqIFTypePropInfos.length; index++ ) {
        var objectType = data.getSpecificationMetadataResponse.reqIFTypePropInfos[ index ].dispTypeName;
        if( objectType === eventData.reqIfObjectName ) {
            reqIFPropertiesForMapping[ objectType ] = [];
            var reqIFPropertyList = data.reqIFProperties[ objectType ];
            var viewProps = [];
            for( var i = 0; i < reqIFPropertyList.length; i++ ) {
                var viewProp = _createViewModelObjectForReqIFProperty( reqIFPropertyList[ i ], objectType );
                viewProp.hasLOVValues = reqIFPropertyList[ i ].hasLOV;
                if( reqIFPropertyList[ i ].hasLOV ) {
                    viewProp.reqIFLovPropertyValuesForMapping = {};
                    viewProp.viewModelPropForReqIFLOVPropertyValues = {};
                    viewProp.viewModelPropForReqIFLOVPropertyValues[ viewProp.propertyDisplayName ] = {};
                }
                viewProp.lovApi = {};
                viewProp.lovApi.dataForMapping = reqIFPropertiesForMapping[ objectType ];
                viewProp.lovApi.requiredPropertiesList = [];
                viewProp.dataProvider = 'Arm0TypesLOVDataProvider';
                viewProp.objectTypeName = objectType;
                exports.initNativeCellLovApi( viewProp );
                viewProps.push( viewProp );
            }
            viewModelPropForReqIFProperties[objectType] = viewProps;
        }
    }
    if( data && data.typePropInfos && data.typePropInfos.length > 0 ) {
        for( let i = 0; i < data.typePropInfos.length; i++ ) {
            var typePropInfo = data.typePropInfos[ i ];
            if( typePropInfo.objectType === eventData.reqObjectName ) {
                if( viewModelPropForReqIFProperties[ eventData.reqIfObjectName ] && viewModelPropForReqIFProperties[ eventData.reqIfObjectName ].length > 0 ) {
                    for( let j = 0; j < viewModelPropForReqIFProperties[ eventData.reqIfObjectName ].length; j++ ) {
                        if( typePropInfo.propInfos && typePropInfo.propInfos.length > 0 ) {
                            var propInfos = typePropInfo.propInfos;
                            var viewProps = [];
                            var isLOVProperty = false;

                            // check if both reqIF properties and teamcenter properties of same type or not
                            // of same type or not (LOV or string)
                            if( data.reqIFProperties[ eventData.reqIfObjectName ] && data.reqIFProperties[ eventData.reqIfObjectName ].length > 0 ) {
                                for( let l = 0; l < data.reqIFProperties[ eventData.reqIfObjectName ].length; l++ ) {
                                    var viewModelReqIFPropertyName = viewModelPropForReqIFProperties[ eventData.reqIfObjectName ][ j ].propertyDisplayName;
                                    var reqIFPropertyName = data.reqIFProperties[ eventData.reqIfObjectName ][ l ].dispPropName;
                                    if( viewModelReqIFPropertyName === reqIFPropertyName ) {
                                        isLOVProperty = data.reqIFProperties[ eventData.reqIfObjectName ][ l ].hasLOV;
                                        if( isLOVProperty ) {
                                            var vmProperty = viewModelPropForReqIFProperties[ eventData.reqIfObjectName ][ j ];
                                            var eventName = vmProperty.propertyDisplayName + ':' + eventData.reqIfObjectName + '.lovValueChanged';
                                            eventBus.subscribe( eventName, function( eventData ) {
                                                if(eventData.lovValue.ParentObjectToPass){
                                                var propEventData = {
                                                    reqIFPropertyParentName: eventData.lovValue.ParentObjectToPass,
                                                    reqIfObjectDisplayName: eventData.lovValue.ParentPropertyToPass,
                                                    reqIfObjectName: eventData.lovValue.ParentPropertyToPass,
                                                    reqObjectName: eventData.lovValue.propInternalValue
                                                };
                                            }else{
                                                var ParentPropertyToPass = eventName.substring(eventName.indexOf(":") + 1, eventName.indexOf("."));
                                                var propEventData = {
                                                    reqIFPropertyParentName: ParentPropertyToPass,
                                                    reqIfObjectDisplayName: '',
                                                    reqIfObjectName: '',
                                                    reqObjectName: '',
                                                    eventName:eventName
                                                };
                                            }
                                                eventBus.publish( 'importSpecificationReqIF.mapReqIFToTcLovValues', propEventData );
                                            }, eventName );
                                        }
                                    }
                                }
                            }
                            if( propInfos && propInfos.length > 0 ) {
                                _sortTcPropsListUsingIsRequiredProp( propInfos );
                                for( var k = 0; k < propInfos.length; k++ ) {
                                    // map only if both properties of same type
                                    if( propInfos[ k ].hasLOV === isLOVProperty ) {
                                        var viewAwProp = _createViewModelObjectForTcProperty( propInfos[ k ], typePropInfo.objectType, data );
                                        viewProps.push( viewAwProp );
                                    }
                                }
                            }
                        }
                        //map reqIF properties to teamcenter properties
                        var viewProperty = viewModelPropForReqIFProperties[ eventData.reqIfObjectName ][ j ];
                        viewProperty.lovApi.dataForMapping = viewProps;
                    }
                }

                var isShowImportReqIFSaveMapping = appCtxSvc.getCtx( 'showImportReqIFSaveMappingVisiblity' );
                if( isShowImportReqIFSaveMapping ) {
                    eventBus.publish( 'importSpecificationReqIF.validateMapping' );
                }
            }
        }
    }
    var values = Object.values( viewModelPropForReqIFProperties );
    var viewModelPropForReqIFPropertiesArray = [];
    if( data.viewModelPropForReqIFPropertiesArray === undefined ) {
        for( var i = 0; i < values.length; i++ ) {
            for( var j = 0; j < values[ i ].length; j++ ) {
                viewModelPropForReqIFPropertiesArray.push( values[ i ][ j ] );
            }
        }
    } else if(data && data.eventData && data.eventData.reqIfObjectName) {
        var reqIFPropertiesArrayOfSelectedReqIF = [];
        for( var i = 0; i < values.length; i++ ) {
            for( var j = 0; j < values[ i ].length; j++ ) {
                if( values[ i ][ j ].objectTypeName === data.eventData.reqIfObjectName ) {
                    reqIFPropertiesArrayOfSelectedReqIF.push( values[ i ][ j ] );
                }
            }
        }
        var reqIFPropertiesArrayApartFromSelectedReqIF = [];
        for( var j = 0; j < data.viewModelPropForReqIFPropertiesArray.length; j++ ) {
            if( data.viewModelPropForReqIFPropertiesArray[ j ].objectTypeName !== data.eventData.reqIfObjectName ) {
                reqIFPropertiesArrayApartFromSelectedReqIF.push( data.viewModelPropForReqIFPropertiesArray[ j ] );
            }
        }
        viewModelPropForReqIFPropertiesArray = reqIFPropertiesArrayApartFromSelectedReqIF.concat( reqIFPropertiesArrayOfSelectedReqIF );
    }
    if( data.viewModelPropForReqIFLOVPropertyArray ) {
        var viewModelPropForReqIFLOVPropertyArray = [];
        var viewModelPropForReqIFLOVPropertyValues = _.clone( data.viewModelPropForReqIFLOVPropertyValues );
        for( var i = 0; i < data.viewModelPropForReqIFLOVPropertyArray.length; i++ ) {
            if( data.viewModelPropForReqIFLOVPropertyArray[ i ].objectParentTypeName !== data.eventData.reqIfObjectName ) {
                viewModelPropForReqIFLOVPropertyArray.push( data.viewModelPropForReqIFLOVPropertyArray[ i ] );
            } else {
                for( var k = 0; k < viewModelPropForReqIFLOVPropertyValues.length; k++ ) {
                    if( viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues ) {
                        viewModelPropForReqIFLOVPropertyValues[ k ].viewModelPropForReqIFLOVPropertyValues[ data.viewModelPropForReqIFLOVPropertyArray[ i ].objectPropertyTypeName ] = [];
                    }
                }
            }
        }
    }
    var ReturnObj = {
        viewModelPropForReqIFPropertiesArray: viewModelPropForReqIFPropertiesArray,
        viewModelPropForReqIFProperties: viewModelPropForReqIFProperties,
        propertiesForMapping: viewProps,
        viewModelPropForReqIFLOVPropertyArray: viewModelPropForReqIFLOVPropertyArray,
        viewModelPropForReqIFLOVPropertyValues: viewModelPropForReqIFLOVPropertyValues
    };
    return ReturnObj;
};

/**
 * Show reqIF LOV Property values of reqIF Object and attach teamcenter LOV property values of teamcenter object
 *
 * @param {Object} data - The view model data
 * @param {Array} eventData - event Data
 * @param {String} awObjectName - AW object name
 *
 */
var _showReqIFLOVProprtyValues = function( data, eventData, awObjectName, viewModelPropForReqIFProperties ) {
    var vmProprties;
    var viewModelPropForReqIFPropertiesData;
    if(viewModelPropForReqIFProperties){
        vmProprties = viewModelPropForReqIFProperties[ eventData.reqIFPropertyParentName ];
        viewModelPropForReqIFPropertiesData = viewModelPropForReqIFProperties;
    }else{
        vmProprties = data.viewModelPropForReqIFProperties[ eventData.reqIFPropertyParentName ];
        viewModelPropForReqIFPropertiesData = data.viewModelPropForReqIFProperties;
    }

    if( vmProprties && vmProprties.length > 0 ) {
        for( var i = 0; i < vmProprties.length; i++ ) {
            if( vmProprties[ i ].propertyDisplayName === eventData.reqIfObjectDisplayName ) {
                var reqIFPropertyName = vmProprties[ i ].propertyDisplayName;
                var reqIFPropertyLOVValues = [];
                vmProprties[ i ].reqIFLovPropertyValuesForMapping[ reqIFPropertyName ] = [];
                for( var j = 0; j < data.reqIFProperties[ eventData.reqIFPropertyParentName ].length; j++ ) {
                    if( data.reqIFProperties[ eventData.reqIFPropertyParentName ][ j ].dispPropName === reqIFPropertyName ) {
                        reqIFPropertyLOVValues = data.reqIFProperties[ eventData.reqIFPropertyParentName ][ j ].lovDispValues;
                        break;
                    }
                }
                var viewLOVProps = [];
                for( var k = 0; k < reqIFPropertyLOVValues.length; k++ ) {
                    var viewProp = uwPropertyService.createViewModelProperty( reqIFPropertyLOVValues[ k ], reqIFPropertyLOVValues[ k ], 'STRING', [], [] );
                    uwPropertyService.setHasLov( viewProp, true );
                    uwPropertyService.setIsArray( viewProp, false );
                    uwPropertyService.setIsEnabled( viewProp, true );
                    uwPropertyService.setIsEditable( viewProp, true );
                    uwPropertyService.setIsNull( viewProp, false );
                    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_SIDE' );
                    viewProp.lovApi = {};
                    viewProp.lovApi.dataForMapping = vmProprties[ i ].reqIFLovPropertyValuesForMapping[ reqIFPropertyName ];
                    viewProp.lovApi.requiredPropertiesList = [];
                    viewProp.dataProvider = 'Arm0TypesLOVDataProvider';
                    viewProp.objectPropertyTypeName = reqIFPropertyName;
                    viewProp.objectParentTypeName = vmProprties[ i ].objectTypeName;
                    viewProp.propertyName = viewProp.propertyDisplayName + ':' + vmProprties[ i ].objectTypeName;
                    exports.initNativeCellLovApi( viewProp );
                    viewLOVProps.push( viewProp );
                }
                vmProprties[ i ].viewModelPropForReqIFLOVPropertyValues[ reqIFPropertyName ] = viewLOVProps;
            }
        }
    }

    if( viewModelPropForReqIFPropertiesData[ eventData.reqIFPropertyParentName ] && viewModelPropForReqIFPropertiesData[ eventData.reqIFPropertyParentName ].length > 0 ) {
        var viewProps = [];
        // create view model properties for LOV values of selected property
        if( data && data.typePropInfos && data.typePropInfos.length > 0 ) {
            for( var i = 0; i < data.typePropInfos.length; i++ ) {
                var reqObject = data.typePropInfos[ i ];
                if( reqObject.objectType === awObjectName ) {
                    for( var j = 0; j < reqObject.propInfos.length; j++ ) {
                        var reqObjectProperty = reqObject.propInfos[ j ];
                        if( reqObjectProperty.propName === eventData.reqObjectName && reqObjectProperty.hasLOV ) {
                            var lovDispValues = reqObjectProperty.lovDispValues;
                            if( lovDispValues && lovDispValues.length > 0 ) {
                                for( var k = 0; k < lovDispValues.length; k++ ) {
                                    var awViewModelPropLOVValue = _createViewModelObjectForPropertyLOVValue( lovDispValues[ k ] );
                                    awViewModelPropLOVValue.objectPropertyTypeName = reqObjectProperty.dispPropName;
                                    awViewModelPropLOVValue.objectParentTypeName = eventData.reqIFPropertyParentName;
                                    viewProps.push( awViewModelPropLOVValue );
                                }
                            }
                        }
                    }
                }
            }
        }
        var viewModelPropForReqIFProps = viewModelPropForReqIFPropertiesData[ eventData.reqIFPropertyParentName ];
        if( viewModelPropForReqIFProps && viewModelPropForReqIFProps.length > 0 ) {
            for( var l = 0; l < viewModelPropForReqIFProps.length; l++ ) {
                if( viewModelPropForReqIFProps[ l ].propertyDisplayName === eventData.reqIfObjectDisplayName ) {
                    if( viewModelPropForReqIFProps[ l ].viewModelPropForReqIFLOVPropertyValues[ eventData.reqIfObjectDisplayName ] && //
                        viewModelPropForReqIFProps[ l ].viewModelPropForReqIFLOVPropertyValues[ eventData.reqIfObjectDisplayName ].length > 0 ) {
                        for( var m = 0; m < viewModelPropForReqIFProps[ l ].viewModelPropForReqIFLOVPropertyValues[ eventData.reqIfObjectDisplayName ].length; m++ ) {
                            var viewProperty = viewModelPropForReqIFProps[ l ].viewModelPropForReqIFLOVPropertyValues[ eventData.reqIfObjectDisplayName ][ m ];
                            viewProperty.lovApi.dataForMapping = viewProps;
                        }
                    }
                }
            }
        }
    }
    var isShowImportReqIFSaveMapping = appCtxSvc.getCtx( 'showImportReqIFSaveMappingVisiblity' );
    if( isShowImportReqIFSaveMapping ) {
        eventBus.publish( 'importSpecificationReqIF.validateMapping' );
    }
    var values = [];
    for( var i = 0; i < vmProprties.length; i++ ) {
        if( vmProprties[ i ].viewModelPropForReqIFLOVPropertyValues ) {
            var value = Object.values( vmProprties[ i ].viewModelPropForReqIFLOVPropertyValues );
            values.push( value[ 0 ] );
        }
    }
    var viewModelPropForReqIFLOVPropertyArray = [];
    if( data.viewModelPropForReqIFLOVPropertyArray === undefined ) {
        for( var i = 0; i < values.length; i++ ) {
            for( var j = 0; j < values[ i ].length; j++ ) {
                viewModelPropForReqIFLOVPropertyArray.push( values[ i ][ j ] );
            }
        }
    } else {
        var viewModelPropForReqIFLOVPropertyArray12 = [];
        for( var i = 0; i < values.length; i++ ) {
            for( var j = 0; j < values[ i ].length; j++ ) {
                if( values[ i ][ j ].objectParentTypeName === data.eventData.reqIFPropertyParentName ) {
                    viewModelPropForReqIFLOVPropertyArray12.push( values[ i ][ j ] );
                }
            }
        }
        var viewModelPropForReqIFLOVPropertyArray11 = [];
        for( var j = 0; j < data.viewModelPropForReqIFLOVPropertyArray.length; j++ ) {
            if( data.viewModelPropForReqIFLOVPropertyArray[ j ].objectParentTypeName !== data.eventData.reqIFPropertyParentName ) {
                viewModelPropForReqIFLOVPropertyArray11.push( data.viewModelPropForReqIFLOVPropertyArray[ j ] );
            }
        }
        viewModelPropForReqIFLOVPropertyArray = viewModelPropForReqIFLOVPropertyArray11.concat( viewModelPropForReqIFLOVPropertyArray12 );
    }
    var returnObj = {
        viewModelPropForReqIFLOVPropertyArray: viewModelPropForReqIFLOVPropertyArray,
        viewModelPropForReqIFLOVPropertyValues: vmProprties,
        lovPropertiesForMapping: viewProps,
        viewModelPropForReqIFPropertiesData:viewModelPropForReqIFPropertiesData
    };
    return returnObj;
};

/**
 * Create view model property for reqIF property
 *
 * @param {Object} dataInfo - data information
 * @param {Object} objectName - objectname of that property
 * @returns {Object} viewModelObject - view model object for the given property info
 */
var _createViewModelObjectForReqIFProperty = function( dataInfo, objectName ) {
    var dispPropName = dataInfo.dispPropName;
    return _createViewModelObjectForProperty( dataInfo, dispPropName, objectName );
};

/**
 * Create view model property for teamcenter property
 *
 * @param {Object} dataInfo - data information
 * @param {Object} objectName - objectname of that property
 * @returns {Object} viewModelObject - view model object for the given property info
 */
var _createViewModelObjectForTcProperty = function( dataInfo, objectName, data ) {
    var dispPropName = dataInfo.dispPropName;
    if( objectName === 'RequirementSpec' && dataInfo.isRequired && dataInfo.propName === 'object_name' ) {
        dispPropName = dataInfo.dispPropName;
    } else if( dataInfo.isRequired && dataInfo.propName !== 'item_revision_id' ) {
        dispPropName = dataInfo.dispPropName + ' (' + data.i18n.requiredLabel + ')';
    }
    return _createViewModelObjectForProperty( dataInfo, dispPropName, objectName );
};

/**
 * Create view model property for data info
 *
 * @param {Object} dataInfo - data information
 *  @param {Object} dispPropName - property display name
 * @param {Object} objectName - objectname of that property
 * @returns {Object} viewModelObject - view model object for the given property info
 */
var _createViewModelObjectForProperty = function( dataInfo, dispPropName, objectName ) {
    var viewProp = uwPropertyService.createViewModelProperty( dataInfo.propName, dispPropName, 'STRING', [], [] );
    uwPropertyService.setHasLov( viewProp, true );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEnabled( viewProp, true );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_SIDE' );
    if( requiredProperties.indexOf( viewProp.propertyName ) !== -1 ) {
        uwPropertyService.setValue( viewProp, true );

        uwPropertyService.setIsEnabled( viewProp, false );
    } else {
        uwPropertyService.setValue( viewProp, false );

        uwPropertyService.setIsEnabled( viewProp, true );
    } // attributes required to show property in lov
    viewProp.propDisplayValue = viewProp.propertyDisplayName;
    viewProp.propInternalValue = viewProp.propertyName;
    viewProp.propertyName = viewProp.propDisplayValue + ':' + objectName;
    if( objectName ) {
        viewProp.objectName = objectName;
    }
    return viewProp;
};

/**
 * Create view model property for LOV property value
 *
 * @param {Object} propertyValueName - LOV property value name
 * @returns {Object} viewModelObject - view model object for the given property info
 */
var _createViewModelObjectForPropertyLOVValue = function( propertyValueName ) {
    var viewProp = uwPropertyService.createViewModelProperty( propertyValueName, propertyValueName, 'STRING', [], [] );
    uwPropertyService.setHasLov( viewProp, true );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEnabled( viewProp, true );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_SIDE' );
    if( requiredProperties.indexOf( viewProp.propertyName ) !== -1 ) {
        uwPropertyService.setValue( viewProp, true );

        uwPropertyService.setIsEnabled( viewProp, false );
    } else {
        uwPropertyService.setValue( viewProp, false );

        uwPropertyService.setIsEnabled( viewProp, true );
    } // attributes required to show property in lov

    viewProp.propDisplayValue = viewProp.propertyDisplayName;
    viewProp.propInternalValue = viewProp.propertyName;
    viewProp.dataProvider = 'Arm0TypesLOVDataProvider';

    return viewProp;
};

/**
 * Create view model property for data info
 *
 * @param {Object} dataInfo - data information
 * @returns {Object} viewModelObject - view model object for the given property info
 */
var _createViewModelObjectForData = function( dataInfo ) {
    var viewProp = uwPropertyService.createViewModelProperty( dataInfo.objectType, dataInfo.dispTypeName, 'STRING', [], [] );

    uwPropertyService.setHasLov( viewProp, true );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEnabled( viewProp, true );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_SIDE' );
    if( requiredProperties.indexOf( viewProp.propertyName ) !== -1 ) {
        uwPropertyService.setValue( viewProp, true );

        uwPropertyService.setIsEnabled( viewProp, false );
    } else {
        uwPropertyService.setValue( viewProp, false );

        uwPropertyService.setIsEnabled( viewProp, true );
    } // attributes required to show property in lov

    viewProp.propDisplayValue = viewProp.propertyDisplayName;
    viewProp.propInternalValue = viewProp.propertyName;

    return viewProp;
};

/**
 * Find the given property in properties list
 *
 * @param {List} properties - list of selected properties
 * @param {String} propertyRealName - property real name
 * @returns {Boolean} - true, if property exist in the list
 */
var _getPropertyFromList = function( properties, propertyRealName ) {
    for( var index = 0; index < properties.length; index++ ) {
        var property = properties[ index ];
        if( property.propertyName === propertyRealName || property.propInternalValue === propertyRealName ) {
            return property;
        }
    }
    return null;
};

/**
 * Create LOV entries.
 *
 * @param {Object} lovApi - lovApi
 * @param {Array} lovEntries - lovEntries
 *
 */
var _createLovEntries = function( lovApi, lovEntries ) {
    for( var index = 0; index < lovApi.dataForMapping.length; index++ ) {
        var entry = lovApi.dataForMapping[ index ];
        var hasProperty = _getPropertyFromList( lovEntries, entry.propertyName );
        // Avoid duplicate property in list
        if( !hasProperty ) {
            lovEntries.push( {
                propDisplayValue: entry.propertyDisplayName,
                propInternalValue: entry.propertyName,
                propDisplayDescription: '',
                hasChildren: false,
                children: {},
                sel: false,
                isRequired: entry.isRequired
            } );
        }
    }
};

/**
 * Sort the teamcenter properties using IsRequired property.
 *
 * @param {Object} list - List to sort
 */
var _sortTcPropsListUsingIsRequiredProp = function( list ) {
    if( list && list.length > 0 ) {
        list.sort( function( a, b ) {
            // true values first
            if( a.propName === 'item_revision_id' ) {
                return 0;
            }
            return a.isRequired === b.isRequired ? 0 : a.isRequired ? -1 : 1;
        } );
    }
};

/**
 * Get input data to show existing mapping or to Import new mapping from ReqIF
 *
 * @param {Object} data - The view model data
 *
 * @return {object} reqIfAttributeMappingInfos
 */
var _getReqIFImportInput = function( data ) {
    var reqIfAttributeMappingInfos = [];
    var reqIfAttributeMappingInfoTypes = [];
    var reqIfAttributeMappingInfoTracelink = [];
    if( data && data.viewModelPropForReqIFTypes && data.viewModelPropForReqIFTypes.length > 0 ) {
        var reqIfAttributeMappingInfoTypes = _createReqIFAttributeMapForImport( data, data.viewModelPropForReqIFTypes );
    }
    if( data && data.viewModelPropForReqIFTypes && data.viewModelPropForReqIFTraceLinks.length > 0 ) {
        var reqIfAttributeMappingInfoTracelink = _createReqIFAttributeMapForImport( data, data.viewModelPropForReqIFTraceLinks );
    }
    reqIfAttributeMappingInfos = reqIfAttributeMappingInfoTypes.concat(reqIfAttributeMappingInfoTracelink);
    var returnObj = {
        reqIfAttributeMappingInfos: reqIfAttributeMappingInfos
    };
    return returnObj;
};

/**
 * Clear display name map to ReqIF types/traceLinks
 *
 * @param {Object} viewModelPropForReqIFTypes - The view model property of reqIF types
 */

var _clearReqIFTypesDisplayValue = function( viewModelPropForReqIFTypes ) {
    for( var index = 0; index < viewModelPropForReqIFTypes.length; index++ ) {
        viewModelPropForReqIFTypes[ index ].dbValue = [];
        viewModelPropForReqIFTypes[ index ].uiValue = '';
    }
    return viewModelPropForReqIFTypes;
};

export let getTypesLOV = ( viewModelPropForReqIFTypes, viewModelPropForReqIFTraceLinks, viewModelPropForReqIFPropertiesArray, viewModelPropForReqIFLOVPropertyArray, viewModelPropForReqIFTypesClone,
    viewModelPropForReqIFTraceLinksClone ) => {
    let lovEntries = [];
    let lovListToShow = [];
    var ParentObjectToPass;
    var ParentPropertyToPass;

    const lovInfo = appCtxSvc.getCtx( 'aw.lovInfo' );
    for( var i = 0; i < viewModelPropForReqIFTypes.length; i++ ) {
        if( viewModelPropForReqIFTypes[ i ].propertyName === lovInfo.ctxLovPropName &&
            viewModelPropForReqIFTypes[ i ].lovApi.dataForMapping && viewModelPropForReqIFTypes[ i ].lovApi.dataForMapping.length > 0 ) {
            lovListToShow = viewModelPropForReqIFTypes[ i ].lovApi.dataForMapping;
            break;
        }
    }
    if( lovListToShow && lovListToShow.length === 0 && viewModelPropForReqIFTraceLinks ) {
        for( var i = 0; i < viewModelPropForReqIFTraceLinks.length; i++ ) {
            if( viewModelPropForReqIFTraceLinks[ i ].propertyName === lovInfo.ctxLovPropName &&
                viewModelPropForReqIFTraceLinks[ i ].lovApi.dataForMapping && viewModelPropForReqIFTraceLinks[ i ].lovApi.dataForMapping.length > 0 ) {
                lovListToShow = viewModelPropForReqIFTraceLinks[ i ].lovApi.dataForMapping;
                break;
            }
        }
    }
    if( lovListToShow && lovListToShow.length === 0 && viewModelPropForReqIFPropertiesArray ) {
        for( var i = 0; i < viewModelPropForReqIFPropertiesArray.length; i++ ) {
            if( viewModelPropForReqIFPropertiesArray[ i ].propertyName === lovInfo.ctxLovPropName ) {
                lovListToShow = viewModelPropForReqIFPropertiesArray[ i ].lovApi.dataForMapping;
                ParentObjectToPass = viewModelPropForReqIFPropertiesArray[ i ].objectName;
                ParentPropertyToPass = viewModelPropForReqIFPropertiesArray[ i ].propDisplayValue;
                break;
            }
        }
    }
    if( lovListToShow && lovListToShow.length === 0 && viewModelPropForReqIFLOVPropertyArray ) {
        for( var i = 0; i < viewModelPropForReqIFLOVPropertyArray.length; i++ ) {
            if( viewModelPropForReqIFLOVPropertyArray[ i ].propertyName === lovInfo.ctxLovPropName ) {
                lovListToShow = viewModelPropForReqIFLOVPropertyArray[ i ].lovApi.dataForMapping;
                break;
            }
        }
    }
    if( lovListToShow && lovListToShow.length === 0 && viewModelPropForReqIFTypesClone ) {
        for( var i = 0; i < viewModelPropForReqIFTypesClone.length; i++ ) {
            if( viewModelPropForReqIFTypesClone[ i ].propertyName === lovInfo.ctxLovPropName ) {
                lovListToShow = viewModelPropForReqIFTypesClone[ i ].lovApi.dataForMapping;
                break;
            }
        }
    }
    if( lovListToShow && lovListToShow.length === 0 && viewModelPropForReqIFTraceLinksClone ) {
        for( var i = 0; i < viewModelPropForReqIFTraceLinksClone.length; i++ ) {
            if( viewModelPropForReqIFTraceLinksClone[ i ].propertyName === lovInfo.ctxLovPropName ) {
                lovListToShow = viewModelPropForReqIFTraceLinksClone[ i ].lovApi.dataForMapping;
                break;
            }
        }
    }
    for( let index = 0; index < lovListToShow.length; index++ ) {
        let vmProp = lovListToShow[ index ];
        addPropertyValueToArray( lovEntries, vmProp, ParentObjectToPass, ParentPropertyToPass );
    }
    return {
        lovData: lovEntries,
        totalFound: lovEntries.length
    };
};

/**
 * Adds property to the array of it is not already available in the passed array.
 * @param {*} arrayOfProps Array of properties
 * @param {*} vmProp : View Model Property
 */
let addPropertyValueToArray = function( arrayOfProps, vmProp, ParentObjectToPass, ParentPropertyToPass ) {
    let hasProperty1 = _getPropertyFromList( arrayOfProps, vmProp );
    // Avoid duplicate property in list
    if( !hasProperty1 ) {
        arrayOfProps.push( {
            propDisplayValue: vmProp.propertyDisplayName,
            propInternalValue: vmProp.propInternalValue,
            isRequired: vmProp.isRequired,
            ParentObjectToPass:ParentObjectToPass,
            ParentPropertyToPass: ParentPropertyToPass
        } );
    }
};

export default exports = {
    resetReqIFImportData,
    initImportReqIFMappingsData,
    initImportReqIFMappingLovApi,
    clearAllReqIFData,
    removeAllMappings,
    populateRulesFromSavedMappingName,
    populateRulesFromSavedMappingNameInitial,
    hideImportReqIFSaveMappingVisiblity,
    selectedObjectToImport,
    getBaseURL,
    createTypesRelationsMap,
    initTypeRelationsData,
    initNativeCellLovApi,
    validateMapping,
    getNewReqIFImportInput,
    unRegisterReqIFData,
    setCmdDimensionForBallonPopup,
    saveImportReqIFMappingPopupButtonClicked,
    updateImportReqIFMapping,
    createSaveImportReqIFMappingInput,
    importReqIFcontentUnloaded,
    mapReqIFToTcProps,
    mapReqIFToTcLovValues,
    importReqIFRuleSelectionChangeInListBox,
    getTypesLOV,
    getImportOptionsForReqif
};
