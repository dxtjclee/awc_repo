// Copyright (c) 2021 Siemens

/**
 * Module for the Export to ReqIF panel
 *
 * @module js/Arm0ExportToReqIF
 */
import appCtxSvc from 'js/appCtxService';
import reqACEUtils from 'js/requirementsACEUtils';
import modelPropertySvc from 'js/modelPropertyService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import notyService from 'js/NotyModule';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import AwCheckbox from 'viewmodel/AwCheckboxViewModel';

var exports = {};

var _ruleName = null;
var _ruleScope = null;

/** Required properties*/
var requiredProperties = [ 'object_name', 'body_text', 'name' ];

/**
 * returns input context input as object
 *
 * @return {String} input object
 */
export let getInputContext = function() {
    return reqACEUtils.getInputContext();
};

/**
 * return input selected objects as an array
 *
 * @param {Object} ctx - Application context
 * @returns {Object} - Json object
 */
export let getSelectedObjects = function( ctx ) {
    if( ctx.occmgmtContext !== undefined ) {
        var selectedTop = reqACEUtils.getTopSelectedObject( ctx );
        return [ cdm.getObject( selectedTop.uid ) ];
    }
    return ctx.mselected;
};

/**
 * Invokes the Export to ReqIf panel if selected objects are valid.
 *
 * @param {Object} ctx - Application context
 *@param {Object} data - The view model data
 */
export let exportToReqIfCommon = function( ctx, data ) {
    var objectsToExport = getSelectedObjects( ctx );
    var isValid = _validateObjectTypes( objectsToExport, data );

    if( isValid === true ) {
        //Invoke Panel
        commandPanelService.activateCommandPanel( 'Arm0ExportToReqIF', 'aw_toolsAndInfo' );
    }
};

/**
 * get all types and properties
 *
 * @param {Object} data - The view model data
 *
 */
export let setSpecificationMetadata = function( data, sharedData ) {
    const cloneAddTypes = _.cloneDeep( data.addTypes );
    const addTraceLinks = _.cloneDeep( data.addTraceLinks );
    var typePropInfosToAddProperties;
    var typePropInfos;
    if( data.getSpecificationMetadataResponse && data.getSpecificationMetadataResponse.typePropInfos ) {
        typePropInfosToAddProperties = _.cloneDeep( data.getSpecificationMetadataResponse.typePropInfos );
        typePropInfos = _.cloneDeep( data.getSpecificationMetadataResponse.typePropInfos );
    }
    if( typePropInfosToAddProperties && typePropInfosToAddProperties.length > 0 ) {
        for( var index = 0; index < typePropInfosToAddProperties.length; index++ ) {
            var typePropInfo = typePropInfosToAddProperties[ index ];
            var propInfos = typePropInfo.propInfos;
            if( propInfos && propInfos.length > 0 ) {
                for( var i = 0; i < propInfos.length; i++ ) {
                    propInfos[ i ] = _createViewModelObjectForProperty( propInfos[ i ], data );
                }
            }
            _sortBooleanList( propInfos );
        }
    }

    var objectPropInfos = [];
    var traceLinkPropInfos = [];

    var objectPropInfosMap = {};
    var traceLinkPropInfosMap = {};
    if( typePropInfos && typePropInfos.length > 0 ) {
        for( var j = 0; j < typePropInfos.length; j++ ) {
            if( typePropInfos[ j ].typeInfo === 'Relation' ) {
                traceLinkPropInfos.push( typePropInfos[ j ] );
                traceLinkPropInfosMap[ typePropInfos[ j ].objectType ] = {
                    objectType: typePropInfos[ j ].objectType,
                    objectInfo: typePropInfos[ j ]
                };
            } else {
                objectPropInfos.push( typePropInfos[ j ] );
                objectPropInfosMap[ typePropInfos[ j ].objectType ] = {
                    objectType: typePropInfos[ j ].objectType,
                    objectInfo: typePropInfos[ j ]
                };
            }
        }
    }

    // Filter already mapped object types, if any
    filterMappedAddTypes( data );

    // to set the command visibility for Arm0AddTypeSubCmd, Arm0AddTraceLinkSubCmd
    appCtxSvc.registerPartialCtx( 'Arm0AddTypeSub.addTypeCmdVisibility', false );
    appCtxSvc.registerPartialCtx( 'Arm0AddTraceLinkSub.addTraceLinkCmdVisibility', false );
    const sharedDataValue = { ...sharedData.value };
    sharedDataValue.typePropInfosToAddProperties = typePropInfosToAddProperties;
    sharedDataValue.typePropInfos = typePropInfos;
    sharedDataValue.objectPropInfos = objectPropInfos;
    sharedDataValue.objectPropInfosMap = objectPropInfosMap;
    sharedDataValue.traceLinkPropInfos = traceLinkPropInfos;
    sharedDataValue.traceLinkPropInfosMap = traceLinkPropInfosMap;
    sharedDataValue.addTypes = cloneAddTypes;
    sharedDataValue.addTraceLinks = addTraceLinks;
    sharedData.update( sharedDataValue );
    return {
        typePropInfosToAddProperties: typePropInfosToAddProperties,
        typePropInfos: typePropInfos,
        objectPropInfos: objectPropInfos,
        traceLinkPropInfos: traceLinkPropInfos,
        objectPropInfosMap: objectPropInfosMap,
        traceLinkPropInfosMap: traceLinkPropInfosMap,
        'savedConfigurations.dbValue': '',
        'savedConfigurations.uiValue': ''
    };
};

/**
 * Populate export configurations name
 *
 * @param {Object} data - The view model data
 *
 */
export let initExportReqIFConfigurationsData = function( data ) {
    _setExportReqIFConfigCommandVisibility( data );
    appCtxSvc.registerPartialCtx( 'mappingType', 'ExportReqIF' );

    eventBus.publish( 'Arm0ExportToReqIF.populateAllExportReqIFConfigrations' );
};

/**
 * Handles export ReqIF rule/configuration selection from listbox
 *
 * @param {Object} data - The view model data
 *
 */
export let exportReqIFRuleSelectionChangeInListBox = function( data ) {
    if( data.savedConfigurations.dbValue !== '' ) {
        var selectedRule = exports.getRuleObjectForSelection( data );
        return {
            selectedRule: selectedRule,
            'addTypes.dbValue': [],
            'addTypes.dbValues': [],
            'addTraceLinks.dbValue': [],
            'addTraceLinks.dbValues': []
        };
    }
    appCtxSvc.registerPartialCtx( 'Arm0AddTypeSub.addTypeCmdVisibility', false );
    appCtxSvc.registerPartialCtx( 'Arm0AddTraceLinkSub.addTraceLinkCmdVisibility', false );
    _setContextToCheckAddTypeCmdVisibility( data );
    _setContextToCheckAddTraceLinkCmdVisibility( data );
    _setExportReqIFConfigCommandVisibility( data );
    return {
        'addTypes.dbValue': [],
        'addTypes.dbValues': [],
        'addTraceLinks.dbValue': [],
        'addTraceLinks.dbValues': []
    };
};

/**
 * Add the 'lovApi' function set export configurations to the given ViewModelProperty
 *
 * @param {Object} data - The view model data
 *
 */
export let initConfigsLovApi = function( data ) {
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
    var exportReqIFSavedConfigListBoxValues = listModels;
    return {
        ruleList: ruleList,
        exportReqIFSavedConfigListBoxValues: exportReqIFSavedConfigListBoxValues
    };
};
/**
 * To retrieve the rule object for the selected configuration name
 *
 * @param {Object} data - The view model data
 * @returns {Object} - rule object
 */
export let getRuleObjectForSelection = function( data ) {
    var object = {};
    for( var i = 0; i < data.ruleList.length; i++ ) {
        if( data.savedConfigurations.dbValue === data.ruleList[ i ].ruleName ) {
            object = data.ruleList[ i ];
            break;
        }
    }
    if( !_.isEmpty( object ) ) {
        object.ruleObject = {
            uid: object.ruleObject.uid,
            type: object.ruleObject.type
        };
        appCtxSvc.updatePartialCtx( 'exportReqIFSavedMapping', data.savedConfigurations.dbValue );
    }
    return object;
};

/**
 * Populate the configurations for the selected saved configuration
 *
 * @param {Object} data - The view model data
 *
 */
export let populateRulesFromSavedConfigName = function( data, sharedData ) {
    var rulesData = data.response.rulesData;
    var objectType = _.cloneDeep( data.addTypes );
    var tracelinkType = _.cloneDeep( data.addTraceLinks );

    for( var k = 0; k < rulesData.length; k++ ) {
        var singleRulesData = rulesData[ k ];
        var typePropsData = JSON.parse( singleRulesData.rules );

        var typeObjectList = [];
        var traceLinkObjectList = [];

        if( typePropsData && typePropsData.length > 0 ) {
            for( var i = 0; i < typePropsData.length; i++ ) {
                if( typePropsData[ i ].typeInfo === 'Relation' ) {
                    traceLinkObjectList.push( typePropsData[ i ] );
                } else {
                    typeObjectList.push( typePropsData[ i ] );
                }
            }
        }
        if( typeObjectList.length > 0 ) {
            _showOnlyExisitingObjectFromRule( typeObjectList, data.objectPropInfosMap, objectType );
        }

        if( traceLinkObjectList.length > 0 ) {
            _showOnlyExisitingObjectFromRule( traceLinkObjectList, data.traceLinkPropInfosMap, tracelinkType );
        }
    }
    const sharedDataValue = { ...sharedData.value };
    sharedDataValue.addTypes = objectType;
    sharedDataValue.addTraceLinks = tracelinkType;
    sharedData.update( sharedDataValue );

    return {
        objectType: objectType,
        tracelinkType: tracelinkType
    };
};

/**
 *Get all properties for the selected subtype
 *
 * @param {Object} data - The view model data
 *Cr
 */
export let updateObjectTypeList = function( data, sharedData ) {
    var objectTypeList = {};
    var tracelinkTypeList = {};
    var objectTypeListVMP = {};
    var objectPropInfos = sharedData.objectPropInfos;
    var traceLinkPropInfos = sharedData.traceLinkPropInfos;
    var addTypes = sharedData.addTypes;
    var addTraceLinks = sharedData.addTraceLinks;
    var objectPropInfosMap = sharedData.objectPropInfosMap;
    var traceLinkPropInfosMap = sharedData.traceLinkPropInfosMap;

    var isAddTypes = appCtxSvc.getCtx( 'Arm0AddTypeSub.addTypes' );

    // if adding or updating types
    if( isAddTypes ) {
        var selectedType = appCtxSvc.getCtx( 'Arm0AddTypeSub.selectedTypes' );
        // if updating selected types
        if( selectedType && selectedType.selectedObjectInternalName && selectedType.selectedObjectInternalName !== '' ) {
            objectTypeListVMP = _updateObjectListToUpdateExistingObject( sharedData.objectPropInfos, sharedData.typePropertiesToSelect, selectedType );
            objectTypeList = objectTypeListVMP;
        } else {
            //if new types to add
            objectTypeListVMP = _updateObjectListToAddNewObjects( sharedData.objectPropInfos, sharedData.addTypes );
            objectTypeList = objectTypeListVMP;
        }
    }
    var isAddedTraceLink = appCtxSvc.getCtx( 'Arm0AddTraceLinkSub.addTraceLinks' );

    // if adding or updating tracelinks
    if( isAddedTraceLink ) {
        var selectedTraceLink = appCtxSvc.getCtx( 'Arm0AddTraceLinkSub.selectedTraceLinks' );
        // if updating selected tracelinks
        if( selectedTraceLink && selectedTraceLink.selectedObjectInternalName && selectedTraceLink.selectedObjectInternalName !== '' ) {
            objectTypeListVMP = _updateObjectListToUpdateExistingObject( sharedData.traceLinkPropInfos, sharedData.tracelinkPropertiesToSelect, selectedTraceLink );
            tracelinkTypeList = objectTypeListVMP;
        } else {
            //if new tracelinks to add
            objectTypeListVMP = _updateObjectListToAddNewObjects( sharedData.traceLinkPropInfos, sharedData.addTraceLinks );
            tracelinkTypeList = objectTypeListVMP;
        }
    }
    return {
        objectTypeList: objectTypeList,
        tracelinkTypeList: tracelinkTypeList,
        objectPropInfos: objectPropInfos,
        traceLinkPropInfos: traceLinkPropInfos,
        addTypes: addTypes,
        addTraceLinks: addTraceLinks,
        objectPropInfosMap: objectPropInfosMap,
        traceLinkPropInfosMap: traceLinkPropInfosMap
    };
};

/**
 * Reset the filter, when object type gets changed.
 *
 * @param {Object} data - The view model data
 */
export let resetTypePropertiesFilter = function( data ) {
    return {
        'filterBoxForType.displayName': '',
        'filterBoxForType.dbValue': ''
    };
};

/**
 * Reset the filter, when tracelink types gets changed.
 *
 * @param {Object} data - The view model data
 */
export let resetTraceLinkPropertiesFilter = function( data ) {
    data.filterBoxForTraceLink.displayName = '';
    data.filterBoxForTraceLink.dbValue = '';
};

/**
 * Action on the on the object type filter
 *
 * @param {Object} data - The view model data
 * @param {Object} subType - Selected subType
 *
 */
export let actionFilterListForType = function( data, subType, sharedData ) {
    var filter = '';
    var propInfosSelectedType = [];
    if( 'filterBoxForType' in data && 'dbValue' in data.filterBoxForType ) {
        filter = data.filterBoxForType.dbValue;
    }
    // Get propInfos for the selected subType
    propInfosSelectedType = _getPropertiesFromSubType( data, subType, sharedData );
    var typePropertiesToSelect = _getFilteredProperties( filter, propInfosSelectedType );
    return {
        propInfosSelectedType: propInfosSelectedType,
        typePropertiesToSelect: typePropertiesToSelect
    };
};

/**
 * Action on the Trace Link type filter
 *
 * @param {Object} data - The view model data
 * @param {Object} traceLinkType - Selected tracelink type
 *
 */
export let actionFilterListForTraceLink = function( data, traceLinkType, sharedData ) {
    var filter = '';
    var propInfosSelectedTraceLink = [];
    if( 'filterBoxForTraceLink' in data && 'dbValue' in data.filterBoxForTraceLink ) {
        filter = data.filterBoxForTraceLink.dbValue;
    }
    // Get propInfos for the selected trace link type
    propInfosSelectedTraceLink = _getPropertiesFromSubType( data, traceLinkType, sharedData );
    var tracelinkPropertiesToSelect = _getFilteredProperties( filter, propInfosSelectedTraceLink );
    return {
        propInfosSelectedTraceLink: propInfosSelectedTraceLink,
        tracelinkPropertiesToSelect: tracelinkPropertiesToSelect
    };
};

/**
 * Gets objects and properties to be selected
 *
 * @param {Object} data - The view model data
 * @return {Object} propInfos - Return selected object and its properties
 *
 */
export let getObjectsPropsToBeSelected = function( data ) {
    var isAddTypes = appCtxSvc.getCtx( 'Arm0AddTypeSub.addTypes' );
    var isAddedTraceLink = appCtxSvc.getCtx( 'Arm0AddTraceLinkSub.addTraceLinks' );
    var addedObject = {};
    var propInfos = [];

    if( isAddTypes ) {
        if( data && data.propInfosSelectedType && data.propInfosSelectedType.length > 0 ) {
            propInfos = _getPropertyInfo( data.typePropertiesToSelect, data.propInfosSelectedType );
        }

        addedObject.selectedObjectInternalName = data.objectType.dbValue;
        addedObject.selectedObjectDispName = data.objectType.uiValue;
    } else if( isAddedTraceLink ) {
        if( data && data.propInfosSelectedTraceLink && data.propInfosSelectedTraceLink.length > 0 ) {
            propInfos = _getPropertyInfo( data.tracelinkPropertiesToSelect, data.propInfosSelectedTraceLink );
        }
        addedObject.selectedObjectInternalName = data.traceLinkType.dbValue;
        addedObject.selectedObjectDispName = data.traceLinkType.uiValue;
    }
    addedObject.propInfos = propInfos;
    return addedObject;
};

/**
 * Add types and properties to addType list
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedTypeProperties -  selected type and its properties
 *
 */
export let addTypes = function( data, selectedTypeProperties, sharedData ) {
    if( selectedTypeProperties ) {
        var addSharedTypes = _.cloneDeep( sharedData.addTypes );
        var index = addSharedTypes.dbValue.findIndex( x => x.selectedObjectInternalName === selectedTypeProperties.selectedObjectInternalName );
        index === -1 ? addSharedTypes.dbValue.push( selectedTypeProperties ) : addSharedTypes.dbValue[index] =  selectedTypeProperties;
        appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.addTypes', false );
        let newSharedData = { ...sharedData.value };
        newSharedData.addTypes = addSharedTypes;
        sharedData.update( newSharedData );
        return {
            addTypes: addSharedTypes
        };
    }
};

/**
 * Remove type from addTypesList list
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedTypesWithProps -  selected types with its properties
 *
 */
export let removeType = function( commandContext ) {
    var selectedTypesWithProps = commandContext.vmo;
    let newSharedData = { ...commandContext.itemOptions.value };
    if( selectedTypesWithProps ) {
        for( var i = newSharedData.addTypes.dbValue.length - 1; i >= 0; i-- ) {
            if( newSharedData.addTypes.dbValue[ i ].selectedObjectInternalName === selectedTypesWithProps.selectedObjectInternalName ) {
                newSharedData.addTypes.dbValue.splice( i, 1 );
                _setContextToCheckAddTypeCmdVisibility( newSharedData );
                break;
            }
        }
    }
    //remove checked properties
    if( selectedTypesWithProps && selectedTypesWithProps.selectedObjectInternalName ) {
        _removedCheckedProperties( newSharedData, selectedTypesWithProps.selectedObjectInternalName );
    }

    _setExportReqIFConfigCommandVisibility( newSharedData );
    commandContext.itemOptions.update( newSharedData );
};

/**
 * updatePartialCtx to null for NEW add types.
 */
export let unRegisterArm0AddTypesSubCtx = function() {
    appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.addTraceLinks', false );
    appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.addTypes', true );
    appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.selectedTypes', null );
};

/**
 *updatePartialCtx for update Type.
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedTypeProperties - The overrideType to be removed
 */
export let updateTypeFn = function( commandContext ) {
    _checkedProperties( commandContext.itemOptions, commandContext.vmo );
    appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.addTypes', true );
    appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.selectedTypes', commandContext.vmo );
    let newSharedData = { ...commandContext.itemOptions.value };
    newSharedData.activeView = 'Arm0AddTypeSub';
    commandContext.itemOptions.update( newSharedData );
};

/**
 * Add types and properties to addType list
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedTraceLinkProperties -  selected TraceLink and its properties
 *
 */
export let addTraceLinks = function( data, selectedTraceLinkProperties, sharedData ) {
    if( selectedTraceLinkProperties ) {
        var addSharedTraceLinks = _.cloneDeep( sharedData.addTraceLinks );
        var index = addSharedTraceLinks.dbValue.findIndex( x => x.selectedObjectInternalName === selectedTraceLinkProperties.selectedObjectInternalName );
        index === -1 ? addSharedTraceLinks.dbValue.push( selectedTraceLinkProperties ) : addSharedTraceLinks.dbValue[index] =  selectedTraceLinkProperties;
        appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.addTraceLinks', false );
        let newSharedData = { ...sharedData.value };
        newSharedData.addTraceLinks = addSharedTraceLinks;
        sharedData.update( newSharedData );
        return {
            addTraceLinks: addSharedTraceLinks
        };
    }
};

/**
 * Remove type from addTraceLinksList list
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedTraceLinksWithProps -  selected TraceLink with its properties
 *
 */
export let removeTraceLink = function( commandContext ) {
    var selectedTraceLinksWithProps = commandContext.vmo;
    let newSharedData = { ...commandContext.itemOptions.value };
    if( selectedTraceLinksWithProps ) {
        for( var i = newSharedData.addTraceLinks.dbValue.length - 1; i >= 0; i-- ) {
            if( newSharedData.addTraceLinks.dbValue[ i ].selectedObjectInternalName === selectedTraceLinksWithProps.selectedObjectInternalName ) {
                newSharedData.addTraceLinks.dbValue.splice( i, 1 );
                _setContextToCheckAddTraceLinkCmdVisibility( newSharedData );
                break;
            }
        }
    }

    //remove checked properties
    if( selectedTraceLinksWithProps && selectedTraceLinksWithProps.selectedObjectInternalName ) {
        _removedCheckedProperties( newSharedData, selectedTraceLinksWithProps.selectedObjectInternalName );
    }

    _setExportReqIFConfigCommandVisibility( newSharedData );
    commandContext.itemOptions.update( newSharedData );
};

/**
 * updatePartialCtx to null for NEW add types.
 */
export let unRegisterArm0AddTraceLinksSubCtx = function() {
    appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.addTypes', false );
    appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.addTraceLinks', true );
    appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.selectedTraceLinks', null );
};

/**
 *updatePartialCtx for update TraceLink and navigate to tracelink panel.
 *
 * @param {Object} commandContext - command context
 *
 */
export let updateTraceLinkFn = function( commandContext ) {
    _checkedProperties( commandContext.itemOptions, commandContext.vmo );
    appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.addTraceLinks', true );
    appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.selectedTraceLinks', commandContext.vmo );
    let newSharedData = { ...commandContext.itemOptions.value };
    newSharedData.activeView = 'Arm0AddTypeSub';
    commandContext.itemOptions.update( newSharedData );
};
/**
 * Set FLAG to false while navigating to main Export panel
 *
 * @param {Object} data - The view model data
 *
 */
export let resetArm0AddTypesTraceLinksSubCtx = function() {
    appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.addTraceLinks', false );
    appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.addTypes', false );
};

/**
 * Get objects and its property data to export
 *
 * @param {Object} data - The view model data
 *
 * @returns {Array} typePropInfos - return objects and its selected property data
 */
export let getTypePropsData = function( data ) {
    var typePropInfos = [];
    var traceLinkPropInfos = [];
    if( data && data.addTypes && data.addTypes.dbValue.length > 0 && data.objectPropInfos && data.objectPropInfos.length > 0 ) {
        typePropInfos = _getObjectsWithPropsToExport( data.addTypes, data.objectPropInfos );
    }

    if( data && data.addTraceLinks && data.addTraceLinks.dbValue.length > 0 && data.traceLinkPropInfos && data.traceLinkPropInfos.length > 0 ) {
        traceLinkPropInfos = _getObjectsWithPropsToExport( data.addTraceLinks, data.traceLinkPropInfos );
    }
    return typePropInfos.concat( traceLinkPropInfos );
};

/**
 * To set command dimentions to show ballon popup
 *
 * @param {Object} data - The view model data
 */
export let setCmdDimensionForBallonPopup = function( data ) {
    var rect = document.querySelector( 'button[button-id=\'Arm0ExportToReqIFConfigurationSubSaveCmd\']' ).getBoundingClientRect();
    return {
        offsetHeight: rect.height,
        offsetLeft: rect.left,
        offsetTop: rect.top,
        offsetWidth: rect.width,
        popupId: 'Arm0ExportToReqIFConfigurationSubSaveCmd'
    };
};

/**
 * To fire event for save configuration button click on popup
 *
 * @param {Object} data - The view model data
 */
export let saveExportReqIFConfigPopupButtonClicked = function( data ) {
    _ruleName = data.ruleName.dbValue;
    if( data.globalScopeCheck.dbValue === true ) {
        _ruleScope = 'GLOBAL';
    } else {
        _ruleScope = 'LOCAL';
    }
    eventBus.publish( 'Arm0ExportToReqIF.createSaveExportConfigInput' );
};

/**
 * Update existing configuration
 */
export let updateConfigExportReqIF = function() {
    eventBus.publish( 'Arm0ExportToReqIF.createSaveExportConfigInput' );
};

/**
 * Create input for saving export reqIF configuration
 *
 * @param {Object} data - The view model data
 */
export let createSaveExportConfigInput = function( data ) {
    var typePropsData = exports.getTypePropsData( data );
    var input = {};
    var rulesData = {};
    if( data && data.savedConfigurations && data.savedConfigurations.dbValue ) {
        rulesData.ruleName = data.savedConfigurations.dbValue;
        rulesData.ruleDispName = data.savedConfigurations.dbValue;
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

    input.mappingType = 'ExportReqIF';
    rulesData.rules = JSON.stringify( typePropsData );
    input.rulesData = [ rulesData ];
    var exportReqIFRuleInput = input;
    _ruleName = null;
    _ruleScope = null;
    return exportReqIFRuleInput;
};

/**
 * Unregister all context related to reqIF
 *
 */
export let exportReqIFcontentUnloaded = function() {
    appCtxSvc.unRegisterCtx( 'saveExportReqIFConfigCmdVisiblity' );
    appCtxSvc.unRegisterCtx( 'mappingType' );
    appCtxSvc.unRegisterCtx( 'Arm0AddTypeSub' );
    appCtxSvc.unRegisterCtx( 'Arm0AddTraceLinkSub' );
    appCtxSvc.unRegisterCtx( 'exportReqIFSavedMapping' );
};

/**
 *  Get objects and its property data to export
 *
 * @param {Object} addObjects - Objects and properties list selected to export
 * @param {Array} objectPropInfos - All objects and its properties populated initially
 * @returns {Array} typePropInfos - return objects and its selected property data
 */
var _getObjectsWithPropsToExport = function( addObjects, objectPropInfos ) {
    var typePropInfos = [];
    for( var i = 0; i < addObjects.dbValue.length; i++ ) {
        for( var j = 0; j < objectPropInfos.length; j++ ) {
            if( addObjects.dbValue[ i ].selectedObjectInternalName === objectPropInfos[ j ].objectType ) {
                var objectInfo = {};
                objectInfo.dispTypeName = objectPropInfos[ j ].dispTypeName;
                objectInfo.objectType = objectPropInfos[ j ].objectType;
                objectInfo.objectTypeRev = objectPropInfos[ j ].objectTypeRev;
                objectInfo.typeInfo = objectPropInfos[ j ].typeInfo;
                objectInfo.propInfos = [];
                if( addObjects.dbValue[ i ].propInfos && addObjects.dbValue[ i ].propInfos.length > 0 ) {
                    for( var k = 0; k < addObjects.dbValue[ i ].propInfos.length; k++ ) {
                        if( objectPropInfos[ j ].propInfos && objectPropInfos[ j ].propInfos.length > 0 ) {
                            for( var l = 0; l < objectPropInfos[ j ].propInfos.length; l++ ) {
                                if( addObjects.dbValue[ i ].propInfos[ k ].propertyName === objectPropInfos[ j ].propInfos[ l ].propName ) {
                                    objectInfo.propInfos.push( objectPropInfos[ j ].propInfos[ l ] );
                                }
                            }
                        }
                    }
                }
                typePropInfos.push( objectInfo );
            }
        }
    }
    return typePropInfos;
};

/**
 * Update object list and its properties to add new objects
 *
 * @param {Object} typePropInfos - Objects with its properties
 * @param {Object} addObjects - objects list which is already added
 *
 * @return {Object} objectTypeListVMP - object type list view model property
 */
var _updateObjectListToAddNewObjects = function( typePropInfos, addObjects ) {
    var objectTypeList = {};
    var typeValues = {
        type: 'STRING',
        dbValue: []
    };
    var output = {};
    var listModel = {};
    objectTypeList = typeValues;

    // Add all types with its properties
    if( addObjects && addObjects.dbValue.length === 0 ) {
        if( typePropInfos && typePropInfos.length > 0 ) {
            for( var j = 0; j < typePropInfos.length; j++ ) {
                output = typePropInfos[ j ];

                listModel = _getEmptyListModel();
                listModel.propDisplayValue = output.dispTypeName;
                listModel.propInternalValue = output.objectType;

                if( output.objectType !== 'RequirementSpec' ) {
                    objectTypeList.dbValue.push( listModel );
                } else {
                    objectTypeList.dbValue.splice( 0, 0, listModel );
                }
            }
        }
    } else {
        // add only not added types and its properties
        if( typePropInfos && typePropInfos.length > 0 ) {
            for( var k = 0; k < typePropInfos.length; k++ ) {
                var typeAlreadyExist = false;
                for( var l = 0; l < addObjects.dbValue.length; l++ ) {
                    if( addObjects.dbValue[ l ].selectedObjectInternalName === typePropInfos[ k ].objectType ) {
                        typeAlreadyExist = true;
                        break;
                    }
                }
                if( !typeAlreadyExist ) {
                    output = typePropInfos[ k ];
                    listModel = _getEmptyListModel();
                    listModel.propDisplayValue = output.dispTypeName;
                    listModel.propInternalValue = output.objectType;
                    if( output.objectType !== 'RequirementSpec' ) {
                        objectTypeList.dbValue.push( listModel );
                    } else {
                        objectTypeList.dbValue.splice( 0, 0, listModel );
                    }
                }
            }
        }
    }
    return modelPropertySvc.createViewModelProperty( objectTypeList );
};

/**
 * Update object list and its properties to update exisiting object
 *
 * @param {Object} typePropInfos - Objects with its properties
 * @param {Object} objectPropertiesToSelect - object properties to be select
 * @param {Object} selectedObject - selected object which needs to be updated
 *
 * @return {Object} objectTypeListVMP - object type list view model property
 */
var _updateObjectListToUpdateExistingObject = function( typePropInfos, objectPropertiesToSelect, selectedObject ) {
    var objectTypeList = {};
    var typeValues = {
        type: 'STRING',
        dbValue: []
    };
    var output = {};
    var listModel = {};

    objectTypeList = typeValues;

    if( selectedObject.propInfos.length > 0 ) {
        for( var i = 0; i < selectedObject.propInfos.length; i++ ) {
            if( objectPropertiesToSelect && objectPropertiesToSelect.length > 0 ) {
                for( var j = 0; j < objectPropertiesToSelect.length; j++ ) {
                    if( selectedObject.propInfos[ i ].propertyName === objectPropertiesToSelect[ j ].propInternalValue ) {
                        objectPropertiesToSelect[ j ].dbValue = true;
                        break;
                    }
                }
            }
        }
    }
    if( typePropInfos && typePropInfos.length > 0 ) {
        for( var k = 0; k < typePropInfos.length; k++ ) {
            if( typePropInfos[ k ].objectType === selectedObject.selectedObjectInternalName ) {
                output = typePropInfos[ k ];
                listModel = _getEmptyListModel();
                listModel.propDisplayValue = output.dispTypeName;
                listModel.propInternalValue = output.objectType;
                objectTypeList.dbValue.push( listModel );
            }
        }
    }
    return modelPropertySvc.createViewModelProperty( objectTypeList );
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Get the property inforamtion
 *
 * @param {Array} objectPropertiesToSelect - Filter value
 * @param {Array} propInfosSelectedObject - All property information for selected type
 *
 * @returns {Array} - get property infos
 *
 */
var _getPropertyInfo = function( objectPropertiesToSelect, propInfosSelectedObject ) {
    var propInfos = [];
    if( propInfosSelectedObject && propInfosSelectedObject.length > 0 ) {
        for( var i = 0; i < propInfosSelectedObject.length; i++ ) {
            if( objectPropertiesToSelect && objectPropertiesToSelect.length > 0 ) {
                for( var j = 0; j < objectPropertiesToSelect.length; j++ ) {
                    if( propInfosSelectedObject[ i ].propertyName === objectPropertiesToSelect[ j ].propertyName ) {
                        propInfosSelectedObject[ i ].dbValue = objectPropertiesToSelect[ j ].dbValue;
                    }
                }
            }
            var viewProp = propInfosSelectedObject[ i ];
            if( viewProp.dbValue ) {
                var dispProp = viewProp.propertyDisplayName;
                var prop = {
                    propertyName: viewProp.propertyName,
                    propertyDisplayName: dispProp
                };
                propInfos.push( prop );
            }
        }
    }
    return propInfos;
};

/**
 * Create view model property for the property info
 *
 * @param {Object} propInfo - Property info
 * @returns {Object} viewModelObject - view model object for the given property info
 */
var _createViewModelObjectForProperty = function( propInfo, data ) {
    // Append "(Required)" to the display name, if property is required
    var dispPropName = propInfo.dispPropName;

    if( requiredProperties.indexOf( propInfo.propName ) !== -1 ) {
        dispPropName = propInfo.dispPropName + ' (' + data.i18n.requiredLabel + ')';
    }

    var viewProp = uwPropertyService.createViewModelProperty( propInfo.propName, dispPropName, 'BOOLEAN', [], [] );

    //uwPropertyService.setIsRequired( viewProp, propInfo.isRequired );

    uwPropertyService.setIsArray( viewProp, false );

    uwPropertyService.setIsEditable( viewProp, true );

    uwPropertyService.setIsNull( viewProp, false );

    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_RIGHT' );

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
 * Sort the boolean list. True values first
 *
 * @param {Object} list - List to sort
 */
var _sortBooleanList = function( list ) {
    list.sort( function( a, b ) {
        // true values first
        if( a.isRequired === b.isRequired ) {
            if( a.isRequired ) {
                return 0;
            } else if( requiredProperties.indexOf( a.propertyName ) !== -1 && requiredProperties.indexOf( b.propertyName ) === -1 ) {
                return -1;
            }
        }
        if( a.isRequired ) {
            return -1;
        }
        return 1;
    } );
};

/**
 * Get the filtered properties
 *
 * @param {Object} filter - Filter value
 * @param {Object} propInfos - The view model property information
 * @returns {Object} - Json object
 *
 */
var _getFilteredProperties = function( filter, propInfos ) {
    var propertiesToSelect = [];
    if( propInfos && propInfos.length > 0 ) {
        var filterValue = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );

        // We have a filter, don't add properties unless the filter matches
        if( filterValue !== '' ) {
            for( var i = 0; i < propInfos.length; i++ ) {
                var propInfo = propInfos[ i ];
                var propertyName = propInfo.propertyName.toLocaleLowerCase().replace( /\\|\s/g, '' );
                var propertyDisplayName = propInfo.propertyDisplayName.toLocaleLowerCase().replace( /\\|\s/g, '' );
                if( propertyName.indexOf( filterValue ) !== -1 || propertyDisplayName.indexOf( filterValue ) !== -1 ) {
                    propertiesToSelect.push( propInfo );
                }
            }
        } else {
            propertiesToSelect = propInfos;
        }
    }
    return propertiesToSelect;
};

/**
 * Get all selected properties from filter
 *
 * @param {Object} data - The view model data
 * @param {Object} subtype - selected subtype of the object
 * @returns {Object} - Json object
 */
var _getSelectedProperties = function( data, subType, sharedData ) {
    var typePropoperyInfo;
    if( sharedData && sharedData.typePropInfosToAddProperties && sharedData.typePropInfosToAddProperties.length > 0 ) {
        for( var index = 0; index < sharedData.typePropInfosToAddProperties.length; index++ ) {
            var typePropInfo = sharedData.typePropInfosToAddProperties[ index ];
            if( typePropInfo.objectType === subType ) {
                var propertiesToSelect;
                if( data.typePropertiesToSelect.length > 0 ) {
                    propertiesToSelect = data.typePropertiesToSelect;
                    typePropoperyInfo = _getSelectedTypeProperties( data, typePropInfo, propertiesToSelect );
                } else if ( data.tracelinkPropertiesToSelect.length > 0 ) {
                    propertiesToSelect = data.tracelinkPropertiesToSelect;
                    typePropoperyInfo = _getSelectedTypeProperties( data, typePropInfo, propertiesToSelect );
                }
                return typePropoperyInfo;
            }
        }
    }
    return [];
};

/**
 * Get all selected properties from filter
 *
 * @param {Object} data - The view model data
 * @param {Object} typePropInfo - selected subtype typePropInfosToAddProperties
 * @returns {Object} - Json object
 */
var _getSelectedTypeProperties = function( data, typePropInfo, propertiesToSelect ) {
    for( var i = 0; i < typePropInfo.propInfos.length; i++ ) {
        for( var j = 0; j < propertiesToSelect.length; j++ ) {
            var selectedProperty = propertiesToSelect[j];
            if( selectedProperty && selectedProperty.propertyName === typePropInfo.propInfos[i].propertyName ) {
                if( selectedProperty.dbValue !== typePropInfo.propInfos[i].dbValue ) {
                    typePropInfo.propInfos[i].dbValue = selectedProperty.dbValue;
                }
            }
        }
    }
    return typePropInfo.propInfos;
};


/**
 * Get all properties for the selected subtype
 *
 * @param {Object} data - The view model data
 * @param {Object} subType - selected subType
 * @returns {Object} - Json object
 */
var _getPropertiesFromSubType = function( data, subType, sharedData ) {
    if( sharedData && sharedData.typePropInfosToAddProperties && sharedData.typePropInfosToAddProperties.length > 0 ) {
        for( var index = 0; index < sharedData.typePropInfosToAddProperties.length; index++ ) {
            var typePropInfo = sharedData.typePropInfosToAddProperties[ index ];
            if( typePropInfo.objectType === subType ) {
                return typePropInfo.propInfos;
            }
        }
    }
    return [];
};

/**
 * Set context to check the command visibility for types
 *
 * @param {Object} data - The view model data
 *
 */
var _setContextToCheckAddTypeCmdVisibility = function( data ) {
    if( data.addTypes.dbValue.length === data.objectPropInfos.length ) {
        appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.addTypeCmdVisibility', false );
    } else {
        appCtxSvc.updatePartialCtx( 'Arm0AddTypeSub.addTypeCmdVisibility', true );
    }
};

/**
 * Set context to check the command visibility for trace links
 *
 * @param {Object} data - The view model data
 */
var _setContextToCheckAddTraceLinkCmdVisibility = function( data ) {
    if( data.addTraceLinks.dbValue.length === data.traceLinkPropInfos.length ) {
        appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.addTraceLinkCmdVisibility', false );
    } else {
        appCtxSvc.updatePartialCtx( 'Arm0AddTraceLinkSub.addTraceLinkCmdVisibility', true );
    }
};

/**
 * Get configuration information which has objects and its properties to display on export reqIF panel
 *
 * @param {Object} typePropData - Configuration information
 * @returns {Object} - Json object
 */
var _getTypePropConfigInfoToDisplay = function( typePropData ) {
    var objectInfo = {};
    objectInfo.selectedObjectInternalName = typePropData.objectType;
    objectInfo.selectedObjectDispName = typePropData.dispTypeName;
    objectInfo.getTypeOrTraceLink = typePropData.typeInfo;
    objectInfo.propInfos = [];

    if( typePropData.propInfos && typePropData.propInfos.length > 0 ) {
        for( var index = 0; index < typePropData.propInfos.length; index++ ) {
            var props = {};
            props.propertyDisplayName = typePropData.propInfos[ index ].dispPropName;
            props.propertyName = typePropData.propInfos[ index ].propName;
            objectInfo.propInfos.push( props );
        }
    }
    return objectInfo;
};

/**
 * Removed checked properties
 *
 * @param {Object} data - The view model data
 * @param {String} selectedObjectInternalName - Object internal name
 *
 */
var _removedCheckedProperties = function( data, selectedObjectInternalName ) {
    var propInfos = _getPropertiesFromSubType( data, selectedObjectInternalName );
    if( propInfos && propInfos.length > 0 ) {
        for( var i = 0; i < propInfos.length; i++ ) {
            if( requiredProperties.indexOf( propInfos[ i ].propertyName ) === -1 ) {
                propInfos[ i ].dbValue = false;
            }
        }
    }
};

/**
 * Check already added properties while updating types or trace Links
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedObjectProperties - selected object Properties to update
 *
 */
var _checkedProperties = function( data, selectedObjectProperties ) {
    if( selectedObjectProperties && selectedObjectProperties.selectedObjectInternalName ) {
        var propInfos = _getPropertiesFromSubType( data, selectedObjectProperties.selectedObjectInternalName, data );
        if( propInfos && propInfos.length > 0 && selectedObjectProperties.propInfos && selectedObjectProperties.propInfos.length > 0 ) {
            for( var i = 0; i < propInfos.length; i++ ) {
                for( var j = 0; j < selectedObjectProperties.propInfos.length; j++ ) {
                    if( propInfos[ i ].propertyName === selectedObjectProperties.propInfos[ j ].propertyName ) {
                        propInfos[ i ].dbValue = true;
                        break;
                    }
                }
            }
        }
    }
};

/**
 * Set export reqIF configuration command visibility
 *
 * @param {Object} data - The view model data
 */
var _setExportReqIFConfigCommandVisibility = function( data ) {
    if( data.addTypes.dbValue.length === data.objectPropInfos.length && data.addTraceLinks.dbValue.length === data.traceLinkPropInfos.length ) {
        var isExportReqIFConfigCommandVisible = true;
        if( data.addTypes.dbValue.length > 0 ) {
            for( var i = 0; i < data.addTypes.dbValue.length; i++ ) {
                if( !data.objectPropInfosMap[ data.addTypes.dbValue[ i ].selectedObjectInternalName ] ) {
                    isExportReqIFConfigCommandVisible = false;
                    break;
                }
            }
        }
        if( isExportReqIFConfigCommandVisible ) {
            if( data.addTraceLinks.dbValue.length > 0 ) {
                for( var j = 0; j < data.addTraceLinks.dbValue.length; j++ ) {
                    if( !data.traceLinkPropInfosMap[ data.addTraceLinks.dbValue[ j ].selectedObjectInternalName ] ) {
                        isExportReqIFConfigCommandVisible = false;
                        break;
                    }
                }
            }
        }
        appCtxSvc.updatePartialCtx( 'saveExportReqIFConfigCmdVisiblity', isExportReqIFConfigCommandVisible );
    } else {
        appCtxSvc.updatePartialCtx( 'saveExportReqIFConfigCmdVisiblity', false );
    }
};

/**
 * Show only Visible object from rule
 *
 * @param {Array} objectListFromRule - All object from rule
 * @param {Object} objectPropInfosMap - existing obejct list getting from metadata
 * @param {Object} objectTypes - object types to be display on panel
 *
 */
var _showOnlyExisitingObjectFromRule = function( objectListFromRule, objectPropInfosMap, objectTypes ) {
    if( objectListFromRule && objectListFromRule.length > 0 ) {
        for( var k = 0; k < objectListFromRule.length; k++ ) {
            if( objectPropInfosMap[ objectListFromRule[ k ].objectType ] ) {
                var typePropInfo = _getTypePropConfigInfoToDisplay( objectListFromRule[ k ] );
                if( typePropInfo ) {
                    objectTypes.dbValue.push( typePropInfo );
                }
            }
        }
    }
};

/**
 * validate if selected objects are valid for ReqIf export
 *
 *  @param {Array} selectedObjects - selected objects for export.
 *  @param {Object} data - The view model data
 *  @returns {Boolean} - true if is valid
 */
var _validateObjectTypes = function( selectedObjects, data ) {
    var isValid = false;
    for( var index = 0; index < selectedObjects.length; index++ ) {
        var typeHierarchy = selectedObjects[ index ].modelType.typeHierarchyArray;
        if( typeHierarchy.indexOf( 'Arm0RequirementElement' ) > -1 || typeHierarchy.indexOf( 'Arm0RequirementSpecElement' ) > -1 || typeHierarchy.indexOf( 'Arm0ParagraphElement' ) > -1 ||
            typeHierarchy.indexOf( 'RequirementSpec Revision' ) > -1 || typeHierarchy.indexOf( 'Requirement Revision' ) > -1 || typeHierarchy.indexOf( 'Paragraph Revision' ) > -1 ) {
            isValid = true;
        } else {
            isValid = false;
            var msg = data.i18n.reqifNotSupported;
            notyService.showError( msg );
            break;
        }
    }

    return isValid;
};

/**
 * Funtion to filter mapped object types, based of new metadata.
 * It will remove mapped types if not present in metadata
 *
 * @param {Object} data - View model object data
 */
export let filterMappedAddTypes = function( data ) {
    var isTypesFiltered = false;
    var isTracelinksFiltered = false;

    if( data.addTypes && data.addTypes.dbValue && data.addTypes.dbValue.length > 0 ) {
        data.addTypes.dbValue.forEach( type => {
            if( data.objectPropInfosMap[ type.selectedObjectInternalName ] === undefined ) {
                removeType( data );
                isTypesFiltered = true;
            }
        } );
    }

    // clear mapped tracelinked types on every filter
    if( data.addTraceLinks && data.addTraceLinks.dbValue && data.addTraceLinks.dbValue.length > 0 ) {
        data.addTraceLinks.dbValue = [];
        isTracelinksFiltered = true;
    }

    // Refresh dataproviders if any modifications in mapped data
    if( isTypesFiltered ) {
        eventBus.publish( 'Arm0ExportToReqIF.refreshAddTypeList' );
    }
    if( isTracelinksFiltered ) {
        eventBus.publish( 'Arm0ExportToReqIF.refreshAddTraceLinkList' );
    }
};


/**
 * Action on the properties selected
 *
 * @param {Object} data - The view model data
 * @param {Object} subType - Selected subType
 *
 */
export let checkOrUncheckForTypeProperties = function( data, subType, sharedData ) {
    return _getSelectedProperties( data, subType, sharedData );
};

/**
 * Action on the Trace Link type properties selected
 *
 * @param {Object} data - The view model data
 * @param {Object} traceLinkType - Selected tracelink type
 *
 */
export let checkOrUncheckForTraceLinkProperties = function( data, traceLinkType, sharedData ) {
    return _getSelectedProperties( data, traceLinkType, sharedData );
};

/**
 * Return options to get metadata, it will add exportLinkedItems option
 *
 * @param {Object} data - View model object data
 * @returns {Array} - array of options
 */
export let getOptionsArrayForMetadata = function( data ) {
    var options = [];
    if( data && data.exportLinkedItems && data.exportLinkedItems.dbValue ) {
        options.push( 'exportLinkedItems' );
    }
    return options;
};

/**
 * Return options to export, it will add name and exportLinkedItems options
 *
 * @param {Object} data - View model object data
 * @returns {Array} - array of options
 */
export let getOptionsArrayForExport = function( data ) {
    var options = [];
    options.push( data.name.dbValue );
    if( data.exportLinkedItems && data.exportLinkedItems.dbValue ) {
        options.push( 'exportLinkedItems' );
    }
    return options;
};
const updateSharedDataState = function( state, newValue ) {
    let stateValue = { ...state.value };
    stateValue = Object.assign( stateValue, newValue );
    state.update( stateValue );
};
export const arm0checkBoxRenderFunction = ( props ) => {
    return <AwCheckbox {...props.prop} />;
};
export let updateCmdVisibility = function( data ) {
    _setContextToCheckAddTypeCmdVisibility( data );
    _setContextToCheckAddTraceLinkCmdVisibility( data );
    _setExportReqIFConfigCommandVisibility( data );
};
export let navigateToMainPanel = function( sharedData ) {
    let newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'Arm0ExportToReqIFSub';
    sharedData.update( newSharedData );
};
export let setDataOnViewChanged = function( sharedData ) {
    let newSharedData = { ...sharedData.value };
    if( newSharedData.activeView === 'Arm0ExportToReqIFSub' ) {
        let addTypes = newSharedData.addTypes;
        let addTraceLinks = newSharedData.addTraceLinks;
        return {
            addTypes: addTypes,
            addTraceLinks: addTraceLinks
        };
    }
};

/**
 * Service for Export specification to ReqIF.
 *
 * @member Arm0ExportToReqIF
 */

export default exports = {
    exportToReqIfCommon,
    getOptionsArrayForMetadata,
    getOptionsArrayForExport,
    getInputContext,
    getSelectedObjects,
    setSpecificationMetadata,
    initExportReqIFConfigurationsData,
    initConfigsLovApi,
    getRuleObjectForSelection,
    populateRulesFromSavedConfigName,
    updateObjectTypeList,
    resetTypePropertiesFilter,
    resetTraceLinkPropertiesFilter,
    actionFilterListForType,
    actionFilterListForTraceLink,
    getObjectsPropsToBeSelected,
    addTypes,
    removeType,
    unRegisterArm0AddTypesSubCtx,
    updateTypeFn,
    addTraceLinks,
    removeTraceLink,
    unRegisterArm0AddTraceLinksSubCtx,
    updateTraceLinkFn,
    resetArm0AddTypesTraceLinksSubCtx,
    getTypePropsData,
    setCmdDimensionForBallonPopup,
    saveExportReqIFConfigPopupButtonClicked,
    updateConfigExportReqIF,
    createSaveExportConfigInput,
    exportReqIFcontentUnloaded,
    exportReqIFRuleSelectionChangeInListBox,
    updateSharedDataState,
    arm0checkBoxRenderFunction,
    updateCmdVisibility,
    navigateToMainPanel,
    setDataOnViewChanged,
    checkOrUncheckForTypeProperties,
    checkOrUncheckForTraceLinkProperties
};
