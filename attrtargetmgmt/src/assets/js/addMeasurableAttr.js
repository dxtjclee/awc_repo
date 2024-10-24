/* eslint-disable require-jsdoc */
// Copyright (c) 2022 Siemens

/**
 * @module js/addMeasurableAttr
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import uwPropSvc from 'js/uwPropertyService';
import filterPanelUtils from 'js/filterPanelUtils';
import msgSvc from 'js/messagingService';
import soaService from 'soa/kernel/soaService';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import parammgmtUtlSvc from 'js/Att1ParameterMgmtUtilService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import attributeDefintionTypesSrv from 'js/attributeDefinitionTypesService';
import _prefSvc from 'soa/preferenceService';
import editHandlerService from 'js/editHandlerService';
import addObjectUtils from 'js/addObjectUtils';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import iconSvc from 'js/iconService';
import awTableSvc from 'js/awTableService';
import policySvc from 'soa/kernel/propertyPolicyService';

var exports = {};
var parameterDefName;
var parameterDefDesc;
var listenForsublocationChange;
var PLE_ENABLEDDEFNSTATUSLIST_PREFERENCE = 'PLE_EnabledDefnStatusList';
var PLE_Parameter_Create_With_Definition_Ux = 'PLE_Parameter_Create_With_Definition_Ux';
var createParamWithDef = true;

var _onReviseParamCompleteEventListener = null;

/**
 * Gets the required text once
 * @param {Object} key - i18n key
 * @return {Object} - i18n text
 */
let getLocalizedText = function( key ) {
    const localeTextBundle = localeService.getLoadedText( 'Att1Messages' );
    return localeTextBundle[ key ];
};

export let getCreatedObject = function( response ) {
    var createdObjects = [];
    var createdObjectUids = response.ServiceData.created;
    _.forEach( createdObjectUids, function( uid ) {
        var parameter = cdm.getObject( uid );
        if( parameter.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) !== -1 ) {
            createdObjects.push( parameter );
        }
    } );
    return createdObjects;
};
export let refreshParamProject = function( paramProject, data ) {
    var relatedModifiedData = {
        refreshParamTable: true,
        relatedModified: paramProject
    };
    eventBus.publish( 'paramProject.expandSelectedNode', relatedModifiedData );
};

/**
 * This function will fire event that will refresh the selected group in Project/Group PWA.
 */
export let refreshOrExpandGroupInPWAForPanel = function( parentGroup ) {
    var relatedModifiedData = {
        relatedModified: parentGroup,
        refreshParamTable: true
    };
    eventBus.publish( 'paramProject.expandSelectedNode', relatedModifiedData );
};

/**
 * Get the selected attribute definition and the create xrt type to load
 *
 * @param {Object} data the view model data object
 */
export let getAttributeDefinition = function( data, addPanelState, paramName ) {
    var deferred = AwPromiseService.instance.defer();
    var attributeDefintion = cdm.getObject( data.lstParameterDefinitions.dbValue );

    var uom = attributeDefintion.props.att0Uom.uiValues[ 0 ];
    if( attributeDefintion && attributeDefintion.props.att0AttrType ) {
        const parameterDefinitionName = _.clone( data.parameterDefinitionName );
        const attrDefDesc = _.clone( data.attrDefDesc );
        const objName = _.clone( data.objName );
        const uomType = _.clone( data.uomType );
        const Goal = _.clone( data.Goal );
        const Min = _.clone( data.Min );
        const Max = _.clone( data.Max );
        const attrType = _.clone( data.attrType );

        if( parameterDefinitionName.dbValue === '' || parameterDefName === parameterDefinitionName.dbValue ) {
            parameterDefinitionName.dbValue = attributeDefintion.props.object_name.dbValues[ 0 ];
        }


        if( attrDefDesc.dbValue === '' ||  parameterDefDesc !== null && parameterDefDesc === attrDefDesc.dbValue ) {
            if( attributeDefintion.props.object_desc.dbValues ) {
                attrDefDesc.dbValue = attributeDefintion.props.object_desc.dbValues[ 0 ];
            }
        }


        parameterDefName = attributeDefintion.props.object_name.dbValues[ 0 ];
        parameterDefDesc = attributeDefintion.props.object_desc.dbValues[ 0 ];
        if( attributeDefintion.props.object_desc.dbValues[ 0 ] ) {
            attrDefDesc.dbValue = attributeDefintion.props.object_desc.dbValues[ 0 ];
        }


        objName.propertyDisplayName = attributeDefintion.props.object_name.dbValues[ 0 ];
        if( objName.propertyDisplayName !== '' ) {
            paramName.update( objName.propertyDisplayName, { isRequired : true }, { markModified : true, runValidation : true } );
        }
        uomType.propertyDisplayName = attributeDefintion.props.att0Uom.propertyDescriptor.displayName;
        uomType.uiValue = uom;
        //Get GMM value
        if( attributeDefintion.props.Att0HasDefaultParamValue && attributeDefintion.props.Att0HasDefaultParamValue.dbValues.length > 0 ) {
            var parameter = cdm.getObject( attributeDefintion.props.Att0HasDefaultParamValue.dbValues[ 0 ] );
            if( parameter.props.att0Goal && parameter.props.att0Goal.uiValues.length > 0 ) {
                Goal.propertyDisplayName = parameter.props.att0Goal.propertyDescriptor.displayName;
                Goal.uiValue = parameter.props.att0Goal.uiValues[ 0 ];
                Goal.dbValue = parameter.props.att0Goal.dbValues[ 0 ];
            }
            if( parameter.props.att0Min && parameter.props.att0Min.uiValues.length > 0 ) {
                Min.propertyDisplayName = parameter.props.att0Min.propertyDescriptor.displayName;
                Min.uiValue = parameter.props.att0Min.uiValues[ 0 ];
            }
            if( parameter.props.att0Max && parameter.props.att0Max.uiValues.length > 0 ) {
                Max.propertyDisplayName = parameter.props.att0Max.propertyDescriptor.displayName;
                Max.uiValue = parameter.props.att0Max.uiValues[ 0 ];
            }
        }

        var typeName = attributeDefintion.props.att0AttrType.dbValues[ 0 ];
        attrType.propertyDisplayName = attributeDefintion.props.att0AttrType.propertyDescriptor.displayName;
        attrType.uiValue = typeName;
        attrType.dbValue = typeName;
        var defaultAttrType = getBOType( typeName );
        var applicationName = '';
        if( attributeDefintion.props.att0Application ) {
            applicationName = attributeDefintion.props.att0Application.dbValues[ 0 ];
        }
        /*
        * Load the different XRT tag if parameter definition selected is of the same data type.
        * Object Type does not get change when user selects the same data type parameter definition.
        * Framework code renderes XRT only when object type changes.
        * When user selects the definition with same data type then object type remain same.
        * In this case we need to add WA fix to support this.
        * isLoadAlternateXRTForSameDataType flag will load alternative AwXRT tag added in view model in case data type is same.
        */
        var ctx = appCtxSvc.getCtx();
        var isLoadAlternateXRTForSameDataType = false;
        if( ctx.panelContext ) {
            if( ctx.panelContext.selectedParameterDefinition &&
                ctx.panelContext.selectedParameterDefinition.props &&
                ctx.panelContext.selectedParameterDefinition.props.att0AttrType &&
                typeName === ctx.panelContext.selectedParameterDefinition.props.att0AttrType.dbValues[ 0 ] ) {
                isLoadAlternateXRTForSameDataType = !data.isLoadAlternateXRTForSameDataType;
            }
            ctx.panelContext.selectedParameterDefinition = attributeDefintion;
        }

        attributeDefintionTypesSrv.getMeasurableAttrType( typeName, defaultAttrType, applicationName  ).then(
            function( xrtType ) {
                if( addPanelState ) {
                    let newAddPanelState = { ...addPanelState.value };
                    newAddPanelState.creationType = attrType;
                    newAddPanelState.isAddButtonEnabled = true;
                    addPanelState.update( newAddPanelState );
                }

                deferred.resolve(  {
                    xrtTypeToLoad:xrtType,
                    attrType:attrType,
                    attributeDefinition:attributeDefintion,
                    parameterDefinitionName:parameterDefinitionName,
                    attrDefDesc: attrDefDesc,
                    objName:objName,
                    uomType:uomType,
                    Goal:Goal,
                    Max:Max,
                    Min:Min,
                    isDefinitionSelected:true,
                    isLoadAlternateXRTForSameDataType:isLoadAlternateXRTForSameDataType
                } );
            } );
    }
    return deferred.promise;
};

/**
 * Reset the attribute definition and xrt
 *
 * @param {Object} addPanelState the view model data object
 * @returns {Object} updated addPanelState
 */
export let updateTabSelection = function( addPanelState ) {
    const newAddPanelState = _.clone( addPanelState );
    newAddPanelState.sourceObjects = null;
    newAddPanelState.creationType = null;
    return {
        addPanelState: newAddPanelState
    };
};

/**
 * Reset the attribute definition and xrt
 *
 * @param {Object} data the view model data object
 */
export let clearSelectedType = function( data ) {
    data.attributeDefinition = null;
    data.xrtTypeToLoad = null;
};

/**
 * This method is for parameter def heading , we don't want to show link.
 * It should be work like label
 * @param {object} data
 */
export let linkAction = function( data ) {
    data.link = null;
};

/**
 * set flag as Copy
 *
 * @param {Object} data the view model data object
 */
export let addParameterAsCopy = function( data ) {
    data.addAsCopy = true;
    eventBus.publish( 'att1AddParameterAsCopy', data );
};

/**
 * This function will return the Soa Input for attachMeasurableAttributes
 *
 * @param {Object} attributes the view model data object
 * @param {Boolean} addAsCopy true if to attach attribute as copy
 * @returns {object} SOAinput the view model data object
 */
export let getAttachParameterSoaInput = function( attributes, addAsCopy ) {
    var deferred = AwPromiseService.instance.defer();


    if( parammgmtUtlSvc.isTCReleaseAtLeast( 14, 3 ) ) {
        var paramDirection = [];
        var selectedParent = appCtxSvc.getCtx( 'panelContext.parametersTable.parentObjects' );
        if( selectedParent && selectedParent.length > 0 ) {
            selectedParent = selectedParent[ 0 ];
        }
        if( selectedParent.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 && selectedParent.props.awb0UnderlyingObject ) {
            selectedParent = cdm.getObject( selectedParent.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }

        // check that if the uid exists in clipboard

        var clipboardContents = appCtxSvc.getCtx( 'awClipBoardProvider' );

        var paramToUsageMap = new Map();
        if( clipboardContents ) {
            for( var i = 0; i < clipboardContents.length; i++ ) {
                var obj = clipboardContents[ i ];

                if( obj && obj.modelType ) {
                    if( obj.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1  && obj.props.att1AttrInOut && obj.props.att1AttrInOut.dbValues && obj.props.att1SourceAttribute &&  obj.props.att1SourceAttribute.dbValues ) {
                        var usage = obj.props.att1AttrInOut.dbValues[0];
                        var paramUid = obj.props.att1SourceAttribute.dbValues[ 0 ];
                        paramToUsageMap.set( paramUid, usage );
                    }
                }
            }
        }

        var attributesDefault = [];
        var attrsListCarryOver = [];
        for( var i = 0; i < attributes.length; i++ ) {
            if( paramToUsageMap.has( attributes[i].uid ) ) {
                //add to carry over usage list
                var usage = paramToUsageMap.get( attributes[i].uid );
                paramDirection.push( usage );
                attrsListCarryOver.push( attributes[i] );
            } else {
                //default usage list
                attributesDefault.push( attributes[i] );
            }
        }

        if( attributesDefault.length > 0 ) {
            parammgmtUtlSvc.getDefaultUsage().then(
                function( defaultUsage ) {
                    var isSingleParam = false;
                    if( attributesDefault.length === 1 ) {
                        isSingleParam = true;
                    }
                    var paramNames = [];
                    for( var i = 0; i < attributesDefault.length; i++ ) {
                        attrsListCarryOver.push( attributesDefault[i] );
                        paramDirection.push( defaultUsage );
                        paramNames.push( attributesDefault[i].props.object_name.dbValues[0] );
                    }
                    paramNames = paramNames.join( ',' ).toString();
                    var paramDirectionSet = new Set( paramDirection );
                    if( paramDirectionSet.size === 1 ) {
                        paramDirection = paramDirection[0];
                    } else{
                        paramDirection = paramDirection.join( '#' ).toString();
                    }

                    //soa input
                    var SoaInput = [ {
                        clientId: 'AW_Att1',
                        parent: selectedParent,
                        parameters: attrsListCarryOver,
                        createCopy: addAsCopy,
                        paramDirection: paramDirection
                    } ];
                    // localize direction
                    if( defaultUsage === 'output' ) {
                        localeService.getLocalizedText( 'Att1AttrMappingMessages', 'Att1SetOutputDirectionTitle' ).then( function( result ) {
                            deferred.resolve(  {
                                SoaInput:SoaInput,
                                defaultUsage:result,
                                paramNames:paramNames,
                                isSingleParam:isSingleParam
                            } );
                        } );
                    } else if( defaultUsage === 'input' ) {
                        localeService.getLocalizedText( 'Att1AttrMappingMessages', 'Att1SetInputDirectionTitle' ).then(  function( result ) {
                            deferred.resolve(  {
                                SoaInput:SoaInput,
                                defaultUsage:result,
                                paramNames:paramNames,
                                isSingleParam:isSingleParam
                            } );
                        } );
                    } else if( defaultUsage === 'unused' ) {
                        localeService.getLocalizedText( 'Att1AttrMappingMessages', 'Att1SetUnusedDirectionTitle' ).then(  function( result ) {
                            deferred.resolve(  {
                                SoaInput:SoaInput,
                                defaultUsage:result,
                                paramNames:paramNames,
                                isSingleParam:isSingleParam
                            } );
                        } );
                    }
                } );
        } else{
            var paramDirectionSet = new Set( paramDirection );
            if( paramDirectionSet.size === 1 ) {
                paramDirection = paramDirection[0];
            } else{
                paramDirection = paramDirection.join( '#' ).toString();
            }
            //soa call
            return {
                SoaInput:[ {
                    clientId: 'AW_Att1',
                    parent: selectedParent,
                    parameters: attrsListCarryOver,
                    createCopy: addAsCopy,
                    paramDirection: paramDirection
                } ]
            };
        }
    } else {
        var selectedParent = appCtxSvc.getCtx( 'panelContext.parametersTable.parentObjects' );
        if( selectedParent && selectedParent.length > 0 ) {
            selectedParent = selectedParent[ 0 ];
        }
        var relationName = '';
        if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
            relationName = 'Att0HasParamValue';
        }
        var parentType  = '';

        if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
            parentType = 'ParamProjectOrGroup';
        } else if( cmm.isInstanceOf( 'WorkspaceObject', selectedParent.modelType ) ) {
            parentType = 'WorkspaceObject';
        } else if( cmm.isInstanceOf( 'Awb0Element', selectedParent.modelType ) ) {
            parentType = 'Awb0Element';
        }
        return {
            SoaInput:[ {
                clientId: 'AW_Att1',
                parentObj: selectedParent,
                attrList: attributes,
                relation: relationName,
                addAsCopy: addAsCopy
            } ],
            parentObject:selectedParent,
            selectedParentType:parentType
        };
    }
    return deferred.promise;
};

/*
 * This function will display error message when attributes can not be pasted
 */
export let displayIgnoredAttributeMsg = function( messages, ignoredOverriddenParams ) {
    if( ignoredOverriddenParams && ignoredOverriddenParams.length > 0 ) {
        var ignoredOverriddenParamNames = '';
        for( var j = 0; j < ignoredOverriddenParams.length; j++ ) {
            if( ignoredOverriddenParamNames.length > 0 ) {
                ignoredOverriddenParamNames = ignoredOverriddenParamNames.concat( ', ' );
            }
            ignoredOverriddenParamNames = ignoredOverriddenParamNames.concat( TypeDisplayNameService.instance.getDisplayName( ignoredOverriddenParams[ j ] ) );
        }
        var msg = '';
        msg = msg.concat( messages.ignoredOverriddenParamsMsg.replace( '{0}', ignoredOverriddenParamNames ) );
        msgSvc.showError( msg );
    }
};

/**
 * Get ObjPropertiesMap
 * @param {Object} data the view model data object
 * @return objPropertiesMap
 */
function _getObjPropertiesMap( data, editHandler ) {
    var objPropertiesMap = {};
    if( !editHandler ) {
        let objectTypeIn = 'CREATE_PANEL_CONTEXT_' + data.xrtTypeToLoad;
        editHandler = editHandlerService.getEditHandler( objectTypeIn );
    }
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let modifiedViewModelProperties = dataSource.getAllModifiedProperties();
            _.forEach( modifiedViewModelProperties, function( vmProp ) {
                if( vmProp && ( vmProp.isAutoAssignable || uwPropSvc.isModified( vmProp ) ) && vmProp.dbValue ) {
                    objPropertiesMap[ vmProp.propertyName ] = [ vmProp.dbValue.toString() ];
                }
            } );
            objPropertiesMap.object_name = [ data.parameterDefinitionName.dbValue.toString() ];
        }
    }
    return objPropertiesMap;
}

/**
 * Prepare the Input for createParameters SOA
 *
 * @param {Object} data the view model data object
 */
export let prepareInputForCreateParametersSoa = function( data, editHandler ) {
    var selectedParent = appCtxSvc.getCtx( 'panelContext.selection' );
    if( selectedParent ) {
        selectedParent = selectedParent.selected ? selectedParent.selected : selectedParent;
    }else{
        selectedParent = appCtxSvc.getCtx( 'panelContext.parametersTable.parentObjects' );
    }
    var applicationName = data.Application.dbValue;
    var createEmptyMeasurementFunc = appCtxSvc.getCtx( 'panelContext.parametersTable.createEmptyMeasurementFunc' );

    var createEmptyMeasurement = 'true';
    if( createEmptyMeasurementFunc && createEmptyMeasurementFunc( applicationName ) !== true ) {
        createEmptyMeasurement = 'false';
    }

    if( selectedParent && selectedParent.length > 0 ) {
        selectedParent = selectedParent[ 0 ];
    }

    var parentObj = null;
    if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
        parentObj = selectedParent;
        data.selectedParentType = 'ParamProjectOrGroup';
    } else if( cmm.isInstanceOf( 'WorkspaceObject', selectedParent.modelType ) ) {
        parentObj = selectedParent;
        data.selectedParentType = 'WorkspaceObject';
        if( appCtxSvc.ctx.parammgmtctx && appCtxSvc.ctx.parammgmtctx.paramProject ) {
            // When VR is opend and nothing is select in primary work area
            parentObj = appCtxSvc.ctx.parammgmtctx.paramProject;
        }
    } else if( cmm.isInstanceOf( 'Awb0Element', selectedParent.modelType ) ) {
        parentObj = cdm.getObject( selectedParent.props.awb0UnderlyingObject.dbValues[ 0 ] );
        data.selectedParentType = 'Awb0Element';
    }
    for( var i = 0; i < data.parentObjectTypes.length; i++ ) {
        if( parentObj && cmm.isInstanceOf( data.parentObjectTypes[ i ], parentObj.modelType ) ) {
            data.parentObject = parentObj;
            break;
        }
    }

    var propertyNameValues = {};
    if( !editHandler ) {
        let objectTypeIn = 'CREATE_PANEL_CONTEXT_' + data.xrtTypeToLoad;
        editHandler = editHandlerService.getEditHandler( objectTypeIn );
    }
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let modifiedViewModelProperties = dataSource.getAllModifiedProperties();
            _.forEach( modifiedViewModelProperties, function( vmProp ) {
                    if( vmProp && vmProp.dbValue!== undefined && (( vmProp.propertyName ===  'att0PointX' || vmProp.propertyName ===  'att0PointY' || vmProp.propertyName ===  'att0PointZ' ||
                    vmProp.type === 'BOOLEAN' && vmProp.propertyName ===  'att0Goal' && vmProp.dbValue !== null ) || vmProp.uiValue !== '' && vmProp.dbValue !== ''   )) {
                        propertyNameValues[vmProp.propertyName] = [ vmProp.dbValue.toString() ];
                }
            } );
        }
    }


    var deferred = AwPromiseService.instance.defer();
    var typename;

    if( !parammgmtUtlSvc.isTCReleaseAtLeast( 14, 2 ) ) {
        // Use definition for tc versions below tc142
        typename = data.attrType.uiValue;
        propertyNameValues.object_name = [ data.parameterDefinitionName.dbValue ];
        if( data.attrDefDesc.dbValue ) {
            propertyNameValues.object_desc = [ data.attrDefDesc.dbValue ];
        }
        var att0AttrDefRev = data.lstParameterDefinitions.dbValue;
        propertyNameValues.att0AttrDefRev = [ att0AttrDefRev ];
        propertyNameValues.att0CreateEmptyMeasurement = [ createEmptyMeasurement ];


        createParametersSoaCall( deferred, parentObj, [ propertyNameValues ], typename, applicationName );
    } else{
        // read value of preference for tcversions tc142 and onwards
        _prefSvc.getStringValues( [ PLE_Parameter_Create_With_Definition_Ux ] ).then(
            function( values ) {
                // Use Definition
                if( !values || values && values[0] === 'true'  ) {
                    createParamWithDef = true;
                    typename = data.attrType.uiValue;
                    propertyNameValues.object_name = [ data.parameterDefinitionName.dbValue ];
                    if( data.attrDefDesc.dbValue ) {
                        propertyNameValues.object_desc = [ data.attrDefDesc.dbValue ];
                    }

                    var att0AttrDefRev = data.lstParameterDefinitions.dbValue;
                    propertyNameValues.att0AttrDefRev = [ att0AttrDefRev ];
                    propertyNameValues.att0CreateEmptyMeasurement = [ createEmptyMeasurement ];
                } else if( values && values[0] === 'false' ) {
                    // No Definition
                    createParamWithDef = false;
                    typename = data.Datatype.dbValue;
                    propertyNameValues.object_name = [ data.ParameterName.dbValue ];
                    propertyNameValues.object_desc = [ data.Description.dbValue ];
                    var att0Unit = data.lovUnitProp.dbValue;
                    if( att0Unit !== null && att0Unit !== undefined && att0Unit !== '' ) {
                        propertyNameValues.att0Unit = [ att0Unit ];
                    }

                    propertyNameValues.att0Application = [ data.Application.dbValue ];
                    propertyNameValues.att0CreateEmptyMeasurement = [ createEmptyMeasurement ];
                }
                createParametersSoaCall( deferred, parentObj, [ propertyNameValues ], typename, applicationName );
            }
        );
    }


    return deferred.promise;
};

/**
 * Prepare the Input for createParameters SOA
 *
 * @param {Object} data the view model data object
 * @param {Object} unsavedRows New inline rows
 * @param {Object} editHandler edit handler
 * @param {Object} parent Parent for parameters
 * @param {Boolean} createParamWithParamDef True if preference is set for using parameter definitions
 * @returns{Object} Create parameters input
 */
export let prepareInputForCreateInlineParametersSoa = function( data, unsavedRows, editHandler, parametersTable, parentSelection, createParamWithParamDef ) {
    if ( unsavedRows.length === 0 ) {
        return '';
    }
    createParamWithDef = createParamWithParamDef === 'true';
    var selectedParent;
    if( parentSelection ) {
        selectedParent = parentSelection;
    }else{
        selectedParent =  parametersTable.parentObjects[0];
    }

    //var applicationName = 'Engineering';  TODO support other applications
    var createEmptyMeasurement = 'true';

    var parentObj = selectedParent;
    data.selectedParentType = 'WorkspaceObject';
    if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
        parentObj = selectedParent;
        data.selectedParentType = 'ParamProjectOrGroup';
    } else if( cmm.isInstanceOf( 'WorkspaceObject', selectedParent.modelType ) ) {
        parentObj = selectedParent;
        data.selectedParentType = 'WorkspaceObject';
        if( appCtxSvc.ctx.parammgmtctx && appCtxSvc.ctx.parammgmtctx.paramProject ) {
            // When VR is opend and nothing is select in primary work area
            parentObj = appCtxSvc.ctx.parammgmtctx.paramProject;
        }
    } else if( cmm.isInstanceOf( 'Awb0Element', selectedParent.modelType ) ) {
        parentObj = cdm.getObject( selectedParent.props.awb0UnderlyingObject.dbValues[ 0 ] );
        data.selectedParentType = 'Awb0Element';
    }

    var propertyNameValuesList = [];
    _.forEach( unsavedRows, function( unsavedRow ) {
        var direction = unsavedRow.viewModelObject.props.att1AttrInOut ? unsavedRow.viewModelObject.props.att1AttrInOut.dbValues[0] : 'output';
        var rowUid = unsavedRow.viewModelObject.uid;
        let objName = unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttribute).object_name' ].dbValues ?
            unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttribute).object_name' ].dbValues[0] : '';
        var typeName = unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0AttrDefRev,Att0AttributeDefRevision).att0AttrType' ].dbValues[0];
        var propertyNameValues = {
            object_name: [ objName ],
            att0Application: [ 'Engineering' ],
            att0CreateEmptyMeasurement: [ createEmptyMeasurement ]
        };
        if ( createParamWithDef ) {
            if ( typeName === 'Point' ) {
                setPoint( propertyNameValues, unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Goal' ].dbValue );
            } else {
                if ( unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Goal' ].dbValue ) {
                    propertyNameValues.att0Goal = [ unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Goal' ].dbValue ];
                }
                if ( unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min' ].dbValue ) {
                    propertyNameValues.att0Min = [ unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min' ].dbValue ];
                }
                if ( unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max' ].dbValue ) {
                    propertyNameValues.att0Max = [ unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max' ].dbValue ];
                }
            }
            if ( unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttribute).object_desc' ].dbValue ) {
                propertyNameValues.object_desc = [ unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttribute).object_desc' ].dbValue ];
            }
        } else {
            if ( unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Uom' ].dbValues ) {
                propertyNameValues.att0Unit = [ unsavedRow.viewModelObject.props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Uom' ].dbValues[0] ];
            }
            if ( typeName === 'Point' ) {
                setPoint( propertyNameValues, '0,0,0' );
            }
        }

        editHandler = editHandlerService.getEditHandler( 'ParameterTableEditContext' );
        if( editHandler ) {
            let dataSource = editHandler.getDataSource();
            if( dataSource ) {
                let modifiedViewModelProperties = dataSource.getAllModifiedProperties();
                _.forEach( modifiedViewModelProperties, function( vmProp ) {
                    if( vmProp && vmProp.dbValue && vmProp.parentUid === rowUid ) {
                        let propName = vmProp.propertyName.split( '.' ).slice( -1 )[0];
                        let propValue = vmProp.dbValue.toString();
                        switch ( propName ) {
                            case 'att0Goal':
                                if ( typeName === 'Point' ) {
                                    setPoint( propertyNameValues, vmProp.dbValue );
                                } else {
                                    propertyNameValues.att0Goal = [ propValue ];
                                }
                                break;
                            case 'object_name':
                                if ( vmProp.propertyName.includes( 'att0AttrDefRev' ) ) {
                                    propertyNameValues.att0AttrDefRev = [ propValue ];
                                } else {
                                    propertyNameValues[ propName ] = [ propValue ];
                                }
                                break;
                            case 'att0Uom':
                                propertyNameValues.att0Unit = [ propValue ];
                                break;
                            case 'att1AttrInOut':
                                direction = propValue;
                                break;
                            case 'att0AttrType':
                                break;
                            case 'att0AsUsedValue':
                                if ( typeName === 'Point' ) {
                                    setInitialValueForPoint( propertyNameValues, vmProp.dbValue );
                                } else {
                                    propertyNameValues.att0AsUsedValue = [ propValue ];
                                }
                                break;
                            default:
                                propertyNameValues[ propName ] = [ propValue ];
                                break;
                        }
                    }
                } );
            }
        }
        propertyNameValuesList.push( { propertyNameValues: propertyNameValues, typeName: typeName, direction: direction, clientId: rowUid } );
    } );

    var deferred = AwPromiseService.instance.defer();

    createInlineParametersSoaCall( deferred, parentObj, propertyNameValuesList );

    return deferred.promise;
};

let setPoint = function( object, pointString ) {
    let point = pointString.replace( '(', '' ).replace( ')', '' ).split( ',' );
    object.att0PointX = point[0] !== undefined ? [ point[0] ] : [ '0' ];
    object.att0PointY = point[1] !== undefined ? [ point[1] ] : [ '0' ];
    object.att0PointZ = point[2] !== undefined ? [ point[2] ] : [ '0' ];
};

let setInitialValueForPoint = function( object, initialValString ) {
    let point = initialValString.replace( '(', '' ).replace( ')', '' ).split( ',' );
    object.att0AsUsedValueX = point[0] !== undefined ? [ point[0] ] : [ '0' ];
    object.att0AsUsedValueY = point[1] !== undefined ? [ point[1] ] : [ '0' ];
    object.att0AsUsedValueZ = point[2] !== undefined ? [ point[2] ] : [ '0' ];
};

export let processCreateParamName = function( response, data ) {
    if( response.ServiceData.partialErrors ) {
        let errorDetails = {
            paramName: '',
            errorCode: response.ServiceData.partialErrors[0].errorValues[0].code,
            message: response.ServiceData.partialErrors[0].errorValues[0].message
        };

        if( !parammgmtUtlSvc.isTCReleaseAtLeast( 14, 2 ) ) {
            errorDetails.paramName = data.parameterDefinitionName.dbValue;
        } else {
            if( createParamWithDef ) {
                errorDetails.paramName = data && data.parameterDefinitionName ? data.parameterDefinitionName.dbValue : '';
            } else {
                errorDetails.paramName =  data && data.ParameterName  ? data.ParameterName.dbValue : '';
            }
        }

        return errorDetails;
    }
};


let createParametersSoaCall = function( deferred, parentObj, propertyNameValuesList, typename, applicationName ) {
    parammgmtUtlSvc.getDefaultUsage().then(
        function( defaultUsage ) {
            var soaInput = [];
            var defaultAttrType = getBOType( typename );
            attributeDefintionTypesSrv.getMeasurableAttrType( typename, defaultAttrType, applicationName  ).then(
                function( boType ) {
                    _.forEach( propertyNameValuesList, function( propertyNameValues ) {
                        var createInput1 =  {
                            boName: boType,
                            compoundCreateInput: {},
                            propertyNameValues: propertyNameValues
                        };
                        var paramPropertiesIn =
                        [ {
                            clientId:'createParamIn',
                            paramInput:createInput1,
                            paramDirection: defaultUsage
                        } ];

                        soaInput
                            .push( {
                                clientId: 'createParam',
                                paramProperties: paramPropertiesIn,
                                parent:parentObj
                            } );
                    } );
                    deferred.resolve( soaInput );
                } );
        } );
};

let createInlineParametersSoaCall = function( deferred, parentObj, propertyNameValuesList ) {
    var soaInput = [];

    var propsForAllParams = [];
    _.forEach( propertyNameValuesList, function( propertyNameValues ) {
        var type = getBOType( propertyNameValues.typeName );
        var createInput1 =  {
            boName: type,
            compoundCreateInput: {},
            propertyNameValues: propertyNameValues.propertyNameValues
        };
        propsForAllParams
            .push( {
                clientId:propertyNameValues.clientId,
                paramInput:createInput1,
                paramDirection: propertyNameValues.direction
            } );
    } );

    soaInput
        .push( {
            clientId: parentObj.uid,
            paramProperties: propsForAllParams,
            parent:parentObj
        } );

    deferred.resolve( soaInput );
};


/**
 * Get the SOA Input for create attribute
 *
 * @param {Object} data the view model data object
 */
export let createAttributeInput = function( data, editHandler ) {
    var applicationName = data.Application.dbValue;
    var createEmptyMeasurementFunc = appCtxSvc.getCtx( 'panelContext.parametersTable.createEmptyMeasurementFunc' );

    var createEmptyMeasurement = 'true';
    if( createEmptyMeasurementFunc && createEmptyMeasurementFunc( applicationName ) !== true ) {
        createEmptyMeasurement = 'false';
    }

    var soaInput = [];
    var selectedParent = appCtxSvc.getCtx( 'panelContext.parametersTable.parentObjects' );
    if( selectedParent && selectedParent.length > 0 ) {
        selectedParent = selectedParent[ 0 ];
    }

    var parentObj = null;
    if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ) {
        parentObj = selectedParent;
        data.selectedParentType = 'ParamProjectOrGroup';
    } else if( cmm.isInstanceOf( 'WorkspaceObject', selectedParent.modelType ) ) {
        parentObj = selectedParent;
        data.selectedParentType = 'WorkspaceObject';
        if( appCtxSvc.ctx.parammgmtctx && appCtxSvc.ctx.parammgmtctx.paramProject ) {
            // When VR is opend and nothing is select in primary work area
            parentObj = appCtxSvc.ctx.parammgmtctx.paramProject;
        }
    } else if( cmm.isInstanceOf( 'Awb0Element', selectedParent.modelType ) ) {
        parentObj = cdm.getObject( selectedParent.props.awb0UnderlyingObject.dbValues[ 0 ] );
        data.selectedParentType = 'Awb0Element';
    }
    for( var i = 0; i < data.parentObjectTypes.length; i++ ) {
        if( parentObj && cmm.isInstanceOf( data.parentObjectTypes[ i ], parentObj.modelType ) ) {
            data.parentObject = parentObj;
            break;
        }
    }
    data.parentObject = parentObj;

    var objPropertiesMap = _getObjPropertiesMap( data, editHandler );
    if( !objPropertiesMap.att0AttrDefRev ) {
        objPropertiesMap.att0AttrDefRev = [ data.attributeDefinition.uid ];
    }

    var isPlatformAtLeastTc133 = parammgmtUtlSvc.isPlatformVersionAtleast( 13, 3 );
    if( isPlatformAtLeastTc133 && !objPropertiesMap.att0CreateEmptyMeasurement ) {
        objPropertiesMap.att0CreateEmptyMeasurement = [ createEmptyMeasurement ];
    }

    var objInput = {
        objPropertiesMap: objPropertiesMap,
        objType: data.xrtTypeToLoad
    };
    var objName = objPropertiesMap.object_name ? objPropertiesMap.object_name[0] : '';
    var attributeObjInput = {
        objInput: objInput,
        objName: objName
    };

    var relationName = '';
    if( cmm.isInstanceOf( 'Att0ParamProject', selectedParent.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selectedParent.modelType ) ||  appCtxSvc.ctx.parammgmtctx && appCtxSvc.ctx.parammgmtctx.paramProject  ) {
        relationName = 'Att0HasParamValue';
    }
    soaInput
        .push( {
            attributeObjInput: attributeObjInput,
            clientId: 'com.siemens.splm.client.attrtargetmgmt.internal.operations.CreateOrModifyMeasurableAttrOperation',
            parentObj: parentObj,
            relationName: relationName
        } );
    return soaInput;
};


/**
 *
 * Populate the stylesheet with attribute definition name, object name and sets the sets the default value for
 * Overridable as true
 *
 * @param {Object} data the view model data object
 */
export let populateXRT = function( data, editHandler ) {
    if( !editHandler ) {
        let objectTypeIn = 'CREATE_PANEL_CONTEXT_' + data.xrtTypeToLoad;
        editHandler = editHandlerService.getEditHandler( objectTypeIn );
    }

    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let updatedProps = [];
            let modifiedViewModelProperties = dataSource.getAllEditableProperties();
            _.forEach( modifiedViewModelProperties, function( vmProp ) {
                if( vmProp.propertyName ===  'object_name' ) {
                    updatedProps.push( {
                        propertyName: vmProp.propertyName,
                        dbValue: data.attributeDefinition.props.object_name.dbValues[ 0 ]
                    } );
                }else if( vmProp.propertyName ===  'object_desc' ) {
                    updatedProps.push( {
                        propertyName: vmProp.propertyName,
                        dbValue:  data.attributeDefinition.props.object_desc.dbValues[ 0 ]
                    } );
                }
                if( data.attrType && data.attrType.uiValue === 'Point' ) {
                    var goalValue = data.Goal.uiValue;
                    var positionValues = [];
                    positionValues = goalValue.substring( 1, goalValue.length - 1 ).split( ', ' );
                    if( vmProp.propertyName ===  'att0PointX' ) {
                        updatedProps.push( {
                            propertyName: vmProp.propertyName,
                            dbValue:  positionValues[ 0 ]
                        } );
                    }else if( vmProp.propertyName ===  'att0PointY' ) {
                        updatedProps.push( {
                            propertyName: vmProp.propertyName,
                            dbValue:  positionValues[ 1 ]
                        } );
                    }else if( vmProp.propertyName ===  'att0PointZ' ) {
                        updatedProps.push( {
                            propertyName: vmProp.propertyName,
                            dbValue:  positionValues[ 2 ]
                        } );
                    }
                } else if ( data.Datatype && data.Datatype.uiValue === 'Point' ) {
                    if( vmProp.propertyName ===  'att0PointX' ) {
                        updatedProps.push( {
                            propertyName: vmProp.propertyName,
                            dbValue:  '0'
                        } );
                    }else if( vmProp.propertyName ===  'att0PointY' ) {
                        updatedProps.push( {
                            propertyName: vmProp.propertyName,
                            dbValue:  '0'
                        } );
                    }else if( vmProp.propertyName ===  'att0PointZ' ) {
                        updatedProps.push( {
                            propertyName: vmProp.propertyName,
                            dbValue:  '0'
                        } );
                    }
                }else {
                    if( vmProp.propertyName ===  'att0Goal' ) {
                        if(data.attrType && data.attrType.uiValue === 'Boolean' ){
                            if(data.Goal.dbValue === '1'){
                                updatedProps.push( {
                                    propertyName: vmProp.propertyName,
                                    dbValue:  true
                                } );
                            }
                            else {
                                if(data.Goal.dbValue === '0'){
                                    updatedProps.push( {
                                        propertyName: vmProp.propertyName,
                                        dbValue:  false
                                    } );
                                }

                            }
                        }
                        else{
                            if(data.Goal.uiValue === ''){
                                updatedProps.push( {
                                    propertyName: vmProp.propertyName
                                } );
                            }
                            else{
                                updatedProps.push( {
                                    propertyName: vmProp.propertyName,
                                    dbValue:  data.Goal.uiValue
                                } );
                            }
                        }

                    }else if( vmProp.propertyName ===  'att0Min' ) {
                        if(data.Min.uiValue === ''){
                            updatedProps.push( {
                                propertyName: vmProp.propertyName
                            } );
                        }
                        else{
                            updatedProps.push( {
                                propertyName: vmProp.propertyName,
                                dbValue:  data.Min.uiValue
                            } );
                        }
                    }else if( vmProp.propertyName ===  'att0Max' ) {
                        if(data.Max.uiValue === ''){
                            updatedProps.push( {
                                propertyName: vmProp.propertyName
                            } );
                        }
                        else{
                            updatedProps.push( {
                                propertyName: vmProp.propertyName,
                                dbValue:  data.Max.uiValue
                            } );
                        }
                    }
                }
                if( vmProp.propertyName ===  'att0AttrDefRev' && data.attributeDefinition ) {
                    updatedProps.push( {
                        propertyName: vmProp.propertyName,
                        dbValue:  data.attributeDefinition.uid
                    } );
                }
            } );
            let objectType;
            addObjectUtils.assignInitialValues( updatedProps, objectType, editHandler );
        }
    }
};

/**
 * Get the most recently created attribute definitions
 *
 * @param {Object} data the view model data object
 * @return {Object} a promise with no data, once the data is loaded at client side.
 */
export let getRecentUsedTypes = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    attributeDefintionTypesSrv.getRecentMruUids( 3 ).then( function( recentAttributeUids ) {
        var uids = [];
        var recentUsedObjects = [];
        for( var i = 0; i < recentAttributeUids.length; i++ ) {
            var obj = cdm.getObject( recentAttributeUids[ i ] );
            uids.push( recentAttributeUids );
            recentUsedObjects.push( obj );
        }

        data.recentUsedTypes = recentUsedObjects;
        deferred.resolve( null );
    } );

    return deferred.promise;
};

/**
 * Update the recent attribute definitions
 *
 * @return {Object} the promise object
 */
export let updateRecentUsedTypes = function( recentAttributeUid ) {
    if( recentAttributeUid ) {
        attributeDefintionTypesSrv.updateRecentMruUids( recentAttributeUid );
    }
};

/**
 * This function will subscribe the event "appCtx.update" and close the panel if the secondaryXrtPageID changes.
 */
export let subscribeEvent = function() {
    listenForsublocationChange = eventBus.subscribe( 'appCtx.update', function( eventData ) {
        if( eventData.name === 'xrtPageContext' && eventData.target === 'secondaryXrtPageID' ) {
            eventBus.unsubscribe( listenForsublocationChange );
            var completeEventData = {
                source: 'toolAndInfoPanel'
            };
            eventBus.publish( 'complete', completeEventData );
        }
    } );
};

/**
 * Find Prefilters and perform search
 * @param {Object} data the view model data object
 */
export let findPreFiltersAndInvokeSearch = function( data ) {
    // showSearchFilter is set for the condition of showing the Search-Filter panel
    data.showSearchFilter = true;
    data.selectedSearchFilters = [];
    updateSearchCriteria( data );
    var releaseStatusList = null;
    getEnabledDefnStatusFilter().then(
        function( enabledDefnStatusList ) {
            releaseStatusList = enabledDefnStatusList;
        } );
    var inputData = {
        inBOTypeNames: []
    };
    // if user added type-filter, then the inputData.input.boTypeName is set to typeFilter[0].
    // User who don't use type-filter or the value is "", by default the inputData.input = []
    if( data.typeFilter ) {
        var typeFilter = data.typeFilter.split( ',' );
        for( var type in typeFilter ) {
            if( typeFilter.hasOwnProperty( type ) ) {
                inputData.inBOTypeNames.push( {
                    typeName: typeFilter[ type ],
                    contextName: 'subtypes',
                    exclusionPreference: ''
                } );
            }
        }
        filterPanelUtils.setHasTypeFilter( true );
    } else {
        filterPanelUtils.setHasTypeFilter( false );
    }

    filterPanelUtils.setPresetFilters( true );
    var subBusinessObjects = null;
    soaService.postUnchecked( 'Core-2013-05-DataManagement', 'getSubTypeNames', inputData ).then(
        function( response ) {
            if ( response ) {
                subBusinessObjects = processSoaResponse( response );
                if ( !data.typeFilter ) {
                    data.searchFilterMap = {};
                } else {
                    if ( releaseStatusList !== null ) {
                        data.searchFilterMap = {
                            'WorkspaceObject.object_type': subBusinessObjects,
                            'WorkspaceObject.release_status_list': releaseStatusList
                        };
                    } else {
                        data.searchFilterMap = {
                            'WorkspaceObject.object_type': subBusinessObjects
                        };
                    }
                }
                if ( data.searchFilter ) {
                    try {
                        exports.processSearchFilters( data.searchFilter, data.searchFilterMap )
                            .then( function( processResultResponse ) {
                                if ( processResultResponse !== null ) {
                                    data.searchFilterMap = processResultResponse.searchFilterMap;
                                    if ( processResultResponse.hasInvalidFilter ) {
                                        filterPanelUtils.displayPrefilterError( data.searchFilter );
                                    }
                                    filterPanelUtils.saveIncontextFilterMap( data );
                                    eventBus.publish( 'searchResultItems.doSearch' );
                                }
                            } );
                    } catch ( e ) {
                        filterPanelUtils.displayPrefilterError( data.searchFilter );
                        filterPanelUtils.saveIncontextFilterMap( data );
                        eventBus.publish( 'searchResultItems.doSearch' );
                    }
                } else {
                    filterPanelUtils.saveIncontextFilterMap( data );
                    eventBus.publish( 'searchResultItems.doSearch' );
                }
            }
        } );
};

/**
 * update the performSearch searchCriteria variable
 *
 * @param {Object} data the view model data object
 */
var updateSearchCriteria = function( data ) {
    if( data.searchBox ) {
        appCtxSvc.ctx.searchCriteria = data.searchBox.dbValue;
    } else {
        appCtxSvc.ctx.searchCriteria = '*';
    }

    if( !appCtxSvc.ctx.searchInfo ) {
        appCtxSvc.ctx.searchInfo = {};
    }
    appCtxSvc.ctx.searchInfo.incontextSearchNew = 'true';
    var incontextSearchFilterPanelCtx = appCtxSvc.getCtx( 'incontextSearchFilterPanel' );
    if( incontextSearchFilterPanelCtx && incontextSearchFilterPanelCtx.listOfExpandedCategories ) {
        delete incontextSearchFilterPanelCtx.listOfExpandedCategories;
        appCtxSvc.updatePartialCtx( 'incontextSearchFilterPanel', incontextSearchFilterPanelCtx );
    }
};

/**
 * Process response of findDisplayableSubBusinessObjectsWithDisplayNames SOA
 * @param {Object} response - response of findDisplayableSubBusinessObjectsWithDisplayNames SOA
 * @returns {StringArray} type names array
 */
var processSoaResponse = function( response ) {
    var typeNames = [];
    if( response.output ) {
        for( var ii = 0; ii < response.output.length; ii++ ) {
            var displayableBOTypeNames = response.output[ ii ].subTypeNames;
            for( var jj = 0; jj < displayableBOTypeNames.length; jj++ ) {
                var SearchFilter = {
                    searchFilterType: 'StringFilter',
                    stringValue: ''
                };
                SearchFilter.stringValue = displayableBOTypeNames[ jj ];
                typeNames.push( SearchFilter );
            }
        }
    }
    return typeNames;
};

/**
 * Get Enabled definition status list
 *
 * @return {Object} promise object
 */
var getEnabledDefnStatusFilter = function() {
    var deferred = AwPromiseService.instance.defer();
    var enabledDefnStatusList = [];
    _prefSvc.getStringValues( [ PLE_ENABLEDDEFNSTATUSLIST_PREFERENCE ] ).then(
        function( statusList ) {
            if( statusList ) {
                for( var i = 0; i < statusList.length; i++ ) {
                    var enabledStatusFilter = {
                        searchFilterType: 'StringFilter',
                        stringValue: ''
                    };
                    enabledStatusFilter.stringValue = statusList[ i ];
                    enabledDefnStatusList.push( enabledStatusFilter );
                }
                deferred.resolve( enabledDefnStatusList );
            }
        } );
    return deferred.promise;
};

/**
 * This function gets the selected object and resets the other providers in palette
 * @param {Object} ctx - context
 * @param {Object} provider - provider
 */
export let handlePaletteSelection = function( ctx, provider ) {
    if( ctx && provider ) {
        if( provider === ctx.getClipboardProvider ) {
            if( ctx.getRecentObjsProvider ) {
                ctx.getRecentObjsProvider.selectNone();
                ctx.getRecentObjsProvider.selectedObjects = [];
            }
            if( ctx.getFavoriteProvider ) {
                ctx.getFavoriteProvider.selectNone();
                ctx.getFavoriteProvider.selectedObjects = [];
            }
        }
        if( provider === ctx.getFavoriteProvider ) {
            if( ctx.getRecentObjsProvider ) {
                ctx.getRecentObjsProvider.selectNone();
                ctx.getRecentObjsProvider.selectedObjects = [];
            }
            if( ctx.getClipboardProvider ) {
                ctx.getClipboardProvider.selectNone();
                ctx.getClipboardProvider.selectedObjects = [];
            }
        }
        if( provider === ctx.getRecentObjsProvider ) {
            if( ctx.getClipboardProvider ) {
                ctx.getClipboardProvider.selectNone();
                ctx.getClipboardProvider.selectedObjects = [];
            }
            if( ctx.getFavoriteProvider ) {
                ctx.getFavoriteProvider.selectNone();
                ctx.getFavoriteProvider.selectedObjects = [];
            }
        }
    }
};
/**
 * This function handles the default selection from clipboard dataProvider on palette tab
 * @param {Object} ctx - ctx
 */
export let handleDefaultPaletteSelection = function( ctx ) {
    if( ctx.getClipboardProvider && ctx.getClipboardProvider.selectedObjects.length === 0 ) {
        ctx.getClipboardProvider.selectAll();
    }
};
/**
 * This function handles the pre-action for revising a parameter
 */
export let reviseParameterPre = function( commandContext ) {
    if( !_onReviseParamCompleteEventListener ) {
        _onReviseParamCompleteEventListener = eventBus.subscribe( 'complete', function( eventData ) {
            eventBus.unsubscribe( _onReviseParamCompleteEventListener );
            _onReviseParamCompleteEventListener = null;

            if( eventData.scope && eventData.scope.data ) {
                var reviseData = eventData.scope.data;
                if( reviseData.openNewRevision !== undefined && ( reviseData.openNewRevision.dbValue === 'false' || reviseData.openNewRevision.dbValue === false ) ) {
                    var sublocation = appCtxSvc.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
                    var contextObj = commandContext.openedObject;
                    if( !contextObj || cmm.isInstanceOf( 'Folder', contextObj.modelType ) ) {
                        contextObj = commandContext.selectionData.pselected;
                    }
                    if( contextObj && sublocation === 'com.siemens.splm.client.attrtarget.paramProjectSubLocation' ) {
                        // when it is in the Parameter Project sub-location
                        if( cmm.isInstanceOf( 'Att0MeasurableAttribute', contextObj.modelType ) ) {
                            var expandData = {
                                expandParent:true
                            };
                            eventBus.publish( 'paramProject.expandSelectedNode', expandData );
                        } else{
                            eventBus.publish( 'paramProject.expandSelectedNode', {} );
                        }
                    }
                    if( contextObj && cmm.isInstanceOf( 'Att0ParameterPrjRevision', contextObj.modelType ) ) {
                        // when the xrt context object is type of Parameter Project or Group
                        eventBus.publish( 'uniformParamTable.reloadTable' );
                    } else {
                        if( sublocation === 'com.siemens.splm.client.attrtarget.paramProjectSubLocation' ) {
                            eventBus.publish( 'Att1ParamProjectNavigation.clearPWASelection' );
                        } else {
                            // Refresh the Parameter > History table
                            eventBus.publish( 'cdm.relatedModified', {
                                refreshLocationFlag: false,
                                relations: '',
                                relatedModified: [ contextObj ],
                                createdObjects: []
                            } );
                        }
                    }
                }
            }
        } );
    }
};

/**
 *Change tab selection
 *
 * @param {Object} data the data object
 */
export let changeTabSelection = function( data ) {
    if( data.addParameterTabsModel ) {
        var tabsModel = data.addParameterTabsModel.dbValue;
        for( var i = 0; i < tabsModel.length; i++ ) {
            if( tabsModel[ i ].tabKey === appCtxSvc.ctx.panelContext.selectTab ) {
                tabsModel[ i ].selectedTab = true;
                appCtxSvc.ctx.panelContext.selectTab = '';
            } else {
                tabsModel[ i ].selectedTab = false;
            }
        }
    }
};

/**
 * Get SOA input for add parameter value
 */
export let getInputForAddParamValue = function( parameterTable ) {
    var inputs = [];
    var attributes = [];
    if( parammgmtUtlSvc.isTCReleaseAtLeast( 14, 3 ) ) {
        var parentObjForPaste;
        if ( parameterTable &&  parameterTable.parentObjects && parameterTable.parentObjects.length > 0 ) {
            parentObjForPaste = parameterTable.parentObjects[0];
            if( parentObjForPaste && parentObjForPaste.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                var paramTableViewMode = parameterTable.parametersTableViewMode.viewModeContext;
                var selObjInTable =  parameterTable.selectedObjects[0];
                if( paramTableViewMode === 'showChildLines' &&  selObjInTable && selObjInTable.props.att1SourceElement ) {
                    parentObjForPaste = cdm.getObject( selObjInTable.props.att1SourceElement.dbValues[ 0 ] );
                }
                parentObjForPaste = parammgmtUtlSvc.getBomLine( parentObjForPaste.uid );
            }
        }
        if( parameterTable.selectedObjects ) {
            attributes = parameterTable.selectedObjects;
        }

        var paramDirection = [];
        var attrsList = [];
        _.forEach( attributes, function( obj ) {
            if(  obj.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1  && obj.props.att1AttrInOut && obj.props.att1AttrInOut.dbValues ) {
                var usage = obj.props.att1AttrInOut.dbValues[0];
                paramDirection.push( usage );
                var sourceObj = parammgmtUtlSvc.getOwningObjectFromParamProxy( obj );
                if( sourceObj ) {
                    attrsList.push( sourceObj );
                }
            }
        } );
        var paramDirectionSet = new Set( paramDirection );
        if( paramDirectionSet.size === 1 ) {
            paramDirection = 'VARIANT_VALUE ' + paramDirection[0];
        } else{
            paramDirection = 'VARIANT_VALUE ' + paramDirection.join( '#' ).toString();
        }
        inputs = [ {
            clientId: 'AW_Att1',
            parent: parentObjForPaste,
            parameters: attrsList,
            createCopy: true,
            paramDirection: paramDirection
        } ];

        return inputs;
    }
    var selectedParent;


    var relation = 'VARIANT_VALUE';
    var occmgmtContext = _.get( appCtxSvc, 'ctx.occmgmtContext', undefined );
    if( occmgmtContext ) {
        var pciUid = _.get( appCtxSvc, 'ctx.occmgmtContext.productContextInfo.uid', undefined );
        if( pciUid ) {
            relation = relation.concat( '#', pciUid );
        }
    }

    var parentOfInterests = _.get( appCtxSvc, 'ctx.parammgmtctx.parameterTableCtx.parentOfInterests', undefined );
    if( parentOfInterests && parentOfInterests.length > 0 ) {
        var sourceAttributeList = [];
        selectedParent = cdm.getObject( parentOfInterests[ 0 ].parentId );
        var parentAttributesMap = new Map();
        _.forEach( parentOfInterests[ 0 ].nonIncontextList, function( item ) {
            sourceAttributeList.push( cdm.getObject( item.props.att1SourceAttribute.dbValues[ 0 ] ) );
        } );
        _.forEach( parentOfInterests[ 0 ].incontextParamList, function( item ) {
            sourceAttributeList.push( cdm.getObject( item.props.att1SourceAttribute.dbValues[ 0 ] ) );
        } );
        parentAttributesMap.set( selectedParent, sourceAttributeList );
        inputs = createAttchMeasurableAttributeInput( parentAttributesMap, relation );
    } else if ( parameterTable &&  parameterTable.selectedObjects && parameterTable.selectedObjects.length > 0 ) {
        var parentAttributesMap = parammgmtUtlSvc.getParentVsAttributesMap( parameterTable.selectedObjects );
        inputs = createAttchMeasurableAttributeInput( parentAttributesMap, relation );
    }
    return inputs;
};

/**
 * Method to create the input object required for attachMeasurableAttribute SOA call
 * @param {Map} parentAttributesMap the parent vs attributes map
 * @param {Object} relation the type of relation
 * @returns {Object} the created json input object
 */
var createAttchMeasurableAttributeInput = function( parentAttributesMap, relation ) {
    var inputs = [];
    for( let [ key, value ] of parentAttributesMap.entries() ) {
        var input = {
            clientId: 'AW_Att1',
            parentObj: key,
            attrList: value,
            relation: relation,
            addAsCopy: true
        };
        inputs.push( input );
    }
    return inputs;
};
/**
 * This method is used to get the LOV values for the versioning panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVList = function( response ) {
    var typeString = getLocalizedText( 'Type' );
    var outputs = [];
    var jsonObjs = JSON.parse( response.searchResultsJSON );
    for( var i = 0; i < jsonObjs.objects.length; i++ ) {
        var objS = cdm.getObject( jsonObjs.objects[ i ].uid );
        if( objS ) {
            outputs.push(
                {
                    propDisplayValue: objS.props.object_name.uiValues[0],
                    propInternalValue: objS.uid,
                    propDisplayDescription: _.replace( objS.props.awp0CellProperties.uiValues[2], '\\', '' ) + ' ' + typeString + ': ' +  objS.props.att0AttrType.uiValues[0]
                }
            );
        }
    }
    return outputs;
};

/**
 * This method is used to get the LOV values for the versioning panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVListForDictionaries = function( response ) {
    var outputs = [];
    outputs.push( {
        propDisplayValue: '',
        propInternalValue: ''
    } );
    var jsonObjs = JSON.parse( response.searchResultsJSON );
    for( var i = 0; i < jsonObjs.objects.length; i++ ) {
        var objS = cdm.getObject( jsonObjs.objects[ i ].uid );
        if( objS ) {
            outputs.push(
                {
                    propDisplayValue: objS.props.object_name.uiValues[0],
                    propInternalValue: objS.uid
                }
            );
        }
    }
    return outputs;
};

export function populateUnitOfMeasure( data, lovProp ) {
    var listValuesUom = [];
    let input = {
        initialData: {
            lovInput: {
                boName: 'Att0AttributeDef',
                operationName: 'Search'
            },
            propertyName:'uom_tag'
        }
    };
    return soaService
        .postUnchecked( 'Core-2013-05-LOV', 'getInitialLOVValues', input )
        .then( function( response ) {
            if( response.serviceData && response.serviceData.partialErrors && response.serviceData.partialErrors.length > 0 ) {
                showError( response.serviceData.partialErrors );
            } else {
                for( let type of response.lovValues ) {
                    listValuesUom.push( {
                        propDisplayValue: type.propDisplayValues.lov_values[ 0 ],
                        propDisplayDescription: type.propDisplayValues.lov_value_descriptions ? type.propDisplayValues.lov_value_descriptions[ 0 ] : '',
                        dispValue: type.propDisplayValues.lov_values[ 0 ],
                        propInternalValue: type.propInternalValues.lov_values[ 0 ]
                    } );
                }
            }
            const lovUnitPropOptions = _.clone( lovProp );
            if( listValuesUom.length > 0 ) {
                data.lovUnitProp.dbValue = listValuesUom[0].propInternalValue;
                data.lovUnitProp.uiValue = listValuesUom[0].propDisplayValue;
            } else{
                data.lovUnitProp.uiValue = 'each';
                data.lovUnitProp.dbValue = '';
                listValuesUom.push( {
                    propDisplayValue: 'each',
                    dispValue: 'each',
                    propInternalValue: ''
                } );
            }
            lovUnitPropOptions.dbValue = listValuesUom;
            lovUnitPropOptions.uiValue = listValuesUom;
            return lovUnitPropOptions;
        } );
}

export let processApplicationLOV = function( response, data ) {
    var listValues = [];
    var listItem = {};
    for( var i = 0; i < response.lovValues.length; i++ ) {
        var value = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
        var uid = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        listItem = { propDisplayValue: value, dispValue: value, propInternalValue: uid };
        listValues.push( listItem );
    }

    var lovApplicationPropOptions = _.clone( data.lovApplicationPropOptions );
    lovApplicationPropOptions = listValues;

    return lovApplicationPropOptions;
};

/**
 *
 * @param {Array} partialErrors - partial errors array
 */
function showError( partialErrors ) {
    for( let i = 0; i < partialErrors.length; i++ ) {
        messagingService.showError( partialErrors[ i ].errorValues[ 0 ].message );
    }
}

let getBOType = function( datatype ) {
    var boType = '';
    switch ( datatype ) {
        case 'Integer':
            boType = 'Att0MeasurableAttributeInt';
            break;
        case 'Double':
            boType = 'Att0MeasurableAttributeDbl';
            break;
        case 'Boolean':
            boType = 'Att0MeasurableAttributeBool';
            break;
        case 'String':
            boType = 'Att0MeasurableAttributeStr';
            break;
        case 'Point':
            boType = 'Att0MeasurableAttributePnt';
            break;
    }
    return boType;
};

export let getParameterBOType = function( applicationName, datatype ) {
    var deferred = AwPromiseService.instance.defer();
    var defaultAttrType = getBOType( datatype );
    var ctx = appCtxSvc.getCtx();
    if( ctx.panelContext ) {
        ctx.panelContext.datatType = datatype;
    }
    attributeDefintionTypesSrv.getMeasurableAttrType( datatype, defaultAttrType, applicationName  ).then(
        function( xrtTypeToLoad ) {
            deferred.resolve(  {
                xrtTypeToLoad:xrtTypeToLoad
            } );
        } );

    return deferred.promise;
};
export let clearList = function( prop, subPanelContext ) {
    if( subPanelContext ) {
        var currentState = subPanelContext.addPanelState;
        currentState.isAddButtonEnabled = false;
        subPanelContext.addPanelState.update( currentState );
    }
    return { ...prop, dbValue: '', uiValue: '', dbOriginalValue: '', isDefinitionSelected: false, xrtTypeToLoad:'' };
};

export let processDatatypeLOV = function( response, data ) {
    var listValues = [];
    var listItem = {};
    for( var i = 0; i < response.lovValues.length; i++ ) {
        var value = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
        var uid = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        listItem = { propDisplayValue: value, dispValue: value, propInternalValue: uid };
        listValues.push( listItem );
    }

    var lovDatatypePropOptions = _.clone( data.lovDatatypePropOptions );
    lovDatatypePropOptions = listValues;


    return lovDatatypePropOptions;
};

export let processLOVFilter = function( dataProvider ) {
    let filter = dataProvider.getFilterString();
    return filter !== undefined && filter !== null && filter.length > 0 ? filter : '*';
};

export let checkAddButtonEnablementCondition = function( data ) {
    if ( parammgmtUtlSvc.isTCReleaseAtLeast( 14, 2 ) ) {
        var ctx = appCtxSvc.getCtx();
        if ( ctx.preferences && ctx.preferences.PLE_Parameter_Create_With_Definition_Ux ) {
            var pref = ctx.preferences.PLE_Parameter_Create_With_Definition_Ux;
            if ( pref && pref.length > 0 ) {
                var value = pref[0];
                var addPanelState = data.subPanelContext.addPanelState;
                if ( value === 'false' ) {
                    var name = data.ParameterName.dbValue;
                    var dataType = data.Datatype.dbValue;

                    if ( addPanelState ) {
                        let newAddPanelState = { ...data.subPanelContext.addPanelState.value };
                        var isAddButtonEnabled = false;
                        if ( name !== '' && dataType !== '' ) {
                            isAddButtonEnabled = true;
                        } else {
                            isAddButtonEnabled = false;
                        }
                        newAddPanelState.isAddButtonEnabled = isAddButtonEnabled;
                        data.subPanelContext.addPanelState.update( newAddPanelState );
                    }
                } else{
                    validateAndSetWithDefinitionData( data );
                }
            }
        }
    } else {
        validateAndSetWithDefinitionData( data );
    }
};

function validateAndSetWithDefinitionData( data ) {
    var paraName = data.parameterDefinitionName.dbValue;
    let newAddPanelState = { ...data.subPanelContext.addPanelState.value };
    var isAddButtonEnabled = false;
    if ( paraName !== '' && data.isDefinitionSelected ) {
        isAddButtonEnabled = true;
    } else {
        isAddButtonEnabled = false;
    }
    newAddPanelState.isAddButtonEnabled = isAddButtonEnabled;
    data.subPanelContext.addPanelState.update( newAddPanelState );
}


/**
 * Function to upadte the GMm data provider values based of definition selected
 * @param {Object} dataProviders the gmm data provider
 * @param {Boolean} isSetValues falg to decide whether to update values in dataprovider or not
 * @returns {Object} the fields to update in view model data
 */
export let setGMMDropDownValues = function( selectedParameterDefintion ) {
    var listValues = [];
    if( selectedParameterDefintion ) {
        var listOfValues = selectedParameterDefintion.props.att0ListOfValues.uiValues;
        if( listOfValues ) {
            for( var i = 0; i < listOfValues.length; i++ ) {
                var value = listOfValues[ i ];
                var listItem = {
                    propDisplayValue: value,
                    dispValue: value,
                    propInternalValue: value

                };
                listValues.push( listItem );
            }
        }
        return {
            gmmLOVValues : listValues
        };
    }
};

/**
 * To display default data type
 * @param {*} dataType
 * @param {*} applicationName
 * @param {*} doubleLocalText
 * @returns
 */
export function populateDefaultDatatype( dataType, applicationName, doubleLocalText ) {
    //if application is 'Engineering','Weight' or 'Volume' then display 'Double' as default data type otherwise show blank.
    if( applicationName.dbValue === 'Engineering' || applicationName.dbValue === 'Weight' || applicationName.dbValue === 'Volume' ) {
        dataType.dbValue = 'Double';
        dataType.dbValues[0] = 'Double';
        dataType.uiValue = doubleLocalText;
        dataType.uiValues[0] = doubleLocalText;
    }else{
        //set dataType blank for other applications
        dataType.dbValue = '';
        dataType.dbValues[0] = '';
        dataType.uiValue = '';
        dataType.uiValues[0] = '';
    }
    return dataType;
}

/**
 * Add new row into View Model Object list for the newly created parameter.
 * @param {Object} parametersTable - The parameters table.
 * @param {Object} provider - the provider.
 * @param {Object} eventData - event data containinf response of getParameterVMOObjects SOA.
 */
export let addNewParamsInTable = function( parametersTable,  provider, eventData ) {
    if( eventData.response ) {
        _.forEach( eventData.response.outputs, function( output ) {
            var jsonObjs = JSON.parse( output.viewModelObject );
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( jsonObjs );
            let iconURL = 'assets/image/typeMeasurableAttribute48.svg';

            // get Icon for node
            var displayName = vmo.props['REF(att1SourceAttribute,Att0MeasurableAttribute).object_name'].dbValue;
            var topObject  = provider.getSelectedObjects();
            var parentNode = topObject[0];
            parentNode = provider.topTreeNode;

            let childlevelIndex = 0;
            let childIdx = 0;
            if( parentNode ) {
                childlevelIndex = parentNode.levelNdx + 1;
                childIdx = parentNode.childNdx;
            }
            let vmNode = awTableSvc.createViewModelTreeNode( vmo.uid, vmo.type, displayName, childlevelIndex, childIdx, iconURL );
            vmNode.isLeaf = true;
            _insertInlineRow( provider, parentNode, vmNode );
        } );
    }
};

/**
 * Add inline row into View Model Object list
 * @param {Object} treeDataProvider - tree Data Provider
 * @param {Object} parentNode - parent node object under which inline row to be added
 * @param {Object} childVMO - inline row view model object to view model object collection
 */
let _insertInlineRow = function( treeDataProvider, parentNode, childVMO ) {
    // Insert the new treeNode in the viewModelCollection after selected row or at the end
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let selectedIndex = treeDataProvider.getSelectedIndexes();
    let expectedInlineRowIdx = selectedIndex.length === 1 ? selectedIndex[0] + 1 : 0;
    let selected = treeDataProvider.selectedObjects;
    if ( selected.length === 1 && selected[0].children ) {
        expectedInlineRowIdx += selected[0].children.length;
    }

    // Add the new treeNode to the view model collection and update
    viewModelCollection.splice( expectedInlineRowIdx, 0, childVMO );
    parentNode.isLeaf = false;
    treeDataProvider.update( viewModelCollection );
};

/**
 * Prepare the Input for getParameterVMOObjects SOA
 *
 * @param {Object} createdObjectResponse The createParameters SOA response.
 * @param {Object} dataProvider The data providers.
 * @param {Object} parametersTable The data parameter table.
 * @returns{Object} getParameterVMOObjects SOA input
 */
export let prepareGetParameterVMOObjectsInput = function( createdObjectResponse, dataProvider, parametersTable ) {
    var soaInputs = [];
    var createdObjects = getCreatedObject( createdObjectResponse );
    if( createdObjects && createdObjects.length > 0 ) {
        _.forEach( createdObjects, function( createdModelObject ) {
            var inputParam = {
                type: createdModelObject.type,
                uid: createdModelObject.uid
            };
            var openedObject = {
                type: parametersTable.openedObject.type,
                uid: parametersTable.openedObject.uid
            };
            var parentObject = {
                type: parametersTable.parentObjects[0].type,
                uid: parametersTable.parentObjects[0].uid
            };
            var columnNames = [];
            var columnConfig = dataProvider.columnConfig;
            if( columnConfig !== null ) {
                for ( var i = 0; i < columnConfig.columns.length; i++ ) {
                    columnNames.push( columnConfig.columns[i].propertyName );
                }
            }
            var input = {
                clientId: 'AW_Att1',
                action: 'create',
                application: '',
                dataType: '',
                parameter:inputParam,
                columnNames: columnNames,
                openedObject: openedObject,
                parentObject: parentObject
            };
            soaInputs.push( input );
        } );
    }
    return soaInputs;
};

export let resetDefinitionListBox = function( subPanelContext ) {
    if( subPanelContext && subPanelContext.addPanelState ) {
        var currentState = subPanelContext.addPanelState;
        currentState.isAddButtonEnabled = false;
        subPanelContext.addPanelState.update( currentState );
    }
    return { isDefinitionSelected: false, xrtTypeToLoad:'' };
};

/**
 * Returns the addMeasurableAttr instance
 *
 * @member addMeasurableAttr
 */


export default exports = {
    getCreatedObject,
    refreshParamProject,
    refreshOrExpandGroupInPWAForPanel,
    getAttributeDefinition,
    clearSelectedType,
    linkAction,
    addParameterAsCopy,
    getAttachParameterSoaInput,
    displayIgnoredAttributeMsg,
    prepareInputForCreateParametersSoa,
    prepareInputForCreateInlineParametersSoa,
    prepareGetParameterVMOObjectsInput,
    addNewParamsInTable,
    populateXRT,
    getRecentUsedTypes,
    updateRecentUsedTypes,
    subscribeEvent,
    findPreFiltersAndInvokeSearch,
    handlePaletteSelection,
    handleDefaultPaletteSelection,
    reviseParameterPre,
    changeTabSelection,
    getInputForAddParamValue,
    getLOVList,
    updateTabSelection,
    processDatatypeLOV,
    processLOVFilter,
    processApplicationLOV,
    clearList,
    populateUnitOfMeasure,
    getParameterBOType,
    createAttributeInput,
    getLOVListForDictionaries,
    setGMMDropDownValues,
    processCreateParamName,
    checkAddButtonEnablementCondition,
    populateDefaultDatatype,
    resetDefinitionListBox
};
