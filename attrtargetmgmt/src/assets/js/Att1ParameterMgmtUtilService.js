// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ParameterMgmtUtilService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import tcVmoService from 'js/tcViewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import selectionService from 'js/selection.service';
import uwPropertyService from 'js/uwPropertyService';
import clipboardService from 'js/clipboardService';
import _ from 'lodash';
import cmdPanelSvc from 'js/commandPanel.service';
import adapterSvc from 'js/adapterService';
import tcSessionData from 'js/TcSessionData';
import soaSvc from 'soa/kernel/soaService';
import _prefSvc from 'soa/preferenceService';


var exports = {};
var PLE_Parameter_Create_With_Default_Usage = 'PLE_Parameter_Create_With_Default_Usage';

export let getDefaultUsage = function() {
    var deferred = AwPromiseService.instance.defer();
    var defaultUsage = 'output';
    if( isTCReleaseAtLeast( 14, 3 ) ) {
        // For tc14.3 and higher versions, read value of default usage from preference PLE_Parameter_Create_With_Default_Usage to create parameter
        // If preference PLE_Parameter_Create_With_Default_Usage does not exist or has empty values or has invalid values, the default usage would be output
        _prefSvc.getStringValues( [ PLE_Parameter_Create_With_Default_Usage ] ).then(
            function( values ) {
                if( values && values[0] && ( values[0].toLowerCase() === 'output' || values[0].toLowerCase() === 'input' || values[0].toLowerCase() === 'unused' ) ) {
                    // assign the default as per preference
                    defaultUsage = values[0].toLowerCase();
                }
                deferred.resolve( defaultUsage );
            } );
    } else{
        // For tc14.2 and lower versions, value of default usage is unused
        defaultUsage = 'unused';
        deferred.resolve( defaultUsage );
    }

    return deferred.promise;
};
export let createViewModelProperty = function( object ) {
    var vMProp = null;
    vMProp = uwPropertyService.createViewModelProperty( object.dbValues[ 0 ],
        object.uiValues[ 0 ], 'STRING', object.dbValues[ 0 ], '' );
    vMProp.uiValue = object.uiValues[ 0 ];
    return vMProp;
};
/**
 * This function returns the correct selected Object if the selected object is Allignment Proxy Object
 * @returns  {Object} selected
 */
export let getSelectedInParamProjSublocation = function() {
    var selected = appCtxSvc.getCtx( 'parammgmtctx.selected' );
    if( selected && selected.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
        var sourceAttribute = _.get( selected, 'props.att1SourceAttribute.dbValue', undefined );
        if( sourceAttribute ) {
            selected = cdm.getObject( sourceAttribute );
        }
    }
    return selected;
};
export let getParamgmtTextBundle = function() {
    return localeService.getLoadedText( 'Att1AttrMappingMessages' );
};
export let prepareErrorMessage = function( message, parameters ) {
    var msg = message;
    if( parameters && parameters.length > 0 ) {
        for( var i = 0; i < parameters.length; i++ ) {
            msg = msg.replace( '{' + i + '}', parameters[ i ] );
        }
    }
    return msg;
};
export let getParentUids = function( selectedObjects, seperator ) {
    if( !seperator ) {
        seperator = '#';
    }
    var parentUids = '';
    _.forEach( selectedObjects, function( object ) {
        parentUids = parentUids.concat( seperator + object.uid );
    } );
    if( !parentUids ) {
        parentUids = parentUids.slice( seperator.length );
    }
    return parentUids;
};
export let getParameterDefinitionOnly = function() {
    return _.filter( _.get( appCtxSvc, 'ctx.awClipBoardProvider', undefined ), function( objToCopy ) {
        return objToCopy.modelType.typeHierarchyArray.indexOf( 'Att0AttributeDefRevision' ) > -1;
    } );
};
/**
 * Unregister the context
 */
export let unregisterContexts = function() {
    appCtxSvc.unRegisterCtx( 'canCheckoutProxyObjects' );
    appCtxSvc.unRegisterCtx( 'canCheckinProxyObjects' );
};

/**
 * Unregister the context
 */
export let clearGroupsSelection = function() {
    appCtxSvc.updateCtx( 'parammgmtctx.selectedLeafGroups', null );
};

/**
 * updates the context with given key and value.
 * @param {keyContext} keyContext key.
 * @param {value} value value.
 */
export let setContext = function( keyContext, value ) {
    appCtxSvc.updateCtx( keyContext, value );
};

export let getOpenedParamProject = function( openedObject ) {
    if( openedObject && cmm.isInstanceOf( 'Att0ParamProject', openedObject.modelType ) ) {
        return openedObject;
    } else if( openedObject && cmm.isInstanceOf( 'Att0ParamGroup', openedObject.modelType ) ) {
        openedObject = cdm.getObject( openedObject.props.att0ParamProject.dbValues[ 0 ] );
    } else if( appCtxSvc.ctx.parammgmtctx && appCtxSvc.ctx.parammgmtctx.paramProject ) {
        openedObject = appCtxSvc.ctx.parammgmtctx.paramProject;
    }

    return openedObject;
};

export let getConfigurationObject = function( openedObject ) {
    var configurationContextObject = null;
    if( cmm.isInstanceOf( 'Att0ParamProject', openedObject.modelType ) ) {
        configurationContextObject = cdm.getObject( _.get( openedObject, 'props.Att0HasConfigurationContext.dbValues[0]', undefined ) );
    } else if( cmm.isInstanceOf( 'Att0ParamGroup', openedObject.modelType ) ) {
        openedObject = cdm.getObject( openedObject.props.att0ParamProject.dbValues[ 0 ] );
        configurationContextObject = cdm.getObject( _.get( openedObject, 'props.Att0HasConfigurationContext.dbValues[0]', undefined ) );
    } else if( appCtxSvc.ctx.parammgmtctx && appCtxSvc.ctx.parammgmtctx.ConfigurationContext ) {
        configurationContextObject = _.get( appCtxSvc, 'ctx.parammgmtctx.ConfigurationContext', undefined );
    }
    return configurationContextObject;
};

/**
 *
 * @param {String} propName propertyName of which we ned to get the Value
 * @returns {String} propValue returns the PropertyValue
 */
export let getRequiredPropValueFromConfigurationContext = function( propName, openedObject ) {
    if( propName ) {
        var configurationContextObject = exports.getConfigurationObject( openedObject );
        var propValue = null;
        if( configurationContextObject ) {
            propValue = _.get( configurationContextObject, 'props.' + propName, undefined );
        }
    }
    return propValue;
};

/**
 * checks if the variant configuration is attached with the parameter Project.
 * @returns { boolean } hasVariantConfigContext
 */
export let isVariantConfigurationContextAttached = function( openedObject ) {
    var hasVariantConfigContext = false;
    var locationObject = getOpenedParamProject( openedObject );
    if( locationObject ) {
        if( _.get( locationObject, 'props.Att0HasVariantConfigContext.dbValues[0]', undefined ) ) {
            hasVariantConfigContext = true;
        }
        return hasVariantConfigContext;
    }
};

export let checkOverriddenParams = function( attributes ) {
    appCtxSvc.unRegisterCtx( 'ignoredOverriddenParams' );

    var paramList = [];
    var ignoredOverriddenParams = [];
    for( var i = 0; i < attributes.length; i++ ) {
        if( attributes[ i ].props.att1InContext.dbValues[ 0 ] === '1' ) {
            //it means this is overridden attribute, ignore this
            ignoredOverriddenParams.push( attributes[ i ] );
        } else {
            paramList.push( attributes[ i ] );
        }
    }
    if( ignoredOverriddenParams.length > 0 ) {
        appCtxSvc.registerCtx( 'ignoredOverriddenParams', ignoredOverriddenParams );
    }
    return paramList;
};

export let isTCReleaseAtLeast122 = function() {
    var tcSessionData = appCtxSvc.getCtx( 'tcSessionData' );
    if( tcSessionData && ( tcSessionData.tcMajorVersion > 12 || tcSessionData.tcMajorVersion === 12 && tcSessionData.tcMinorVersion >= 2 ) ) {
        return true;
    }
    return false;
};

export let getSelectedForImport = function( data, parameterstableCtx ) {
    var selected = appCtxSvc.getCtx( 'selected' );
    var pselected = appCtxSvc.getCtx( 'pselected' );
    var sourceObj = null;

    if( selected && pselected && cmm.isInstanceOf( 'Att0AttributeDefRevision', selected.modelType ) && cmm.isInstanceOf( 'Att0ParamDictionary', pselected.modelType ) ) {
        return pselected;
    }

    var openedObject = _.get( appCtxSvc, 'ctx.locationContext.modelObject', undefined );
    if( openedObject && cmm.isInstanceOf( 'Att0MeasurableAttribute', openedObject.modelType ) ) {
        return openedObject;
    }

    // While select a Parameter Project / Group or VR / Study
    if( cmm.isInstanceOf( 'Att0ParamProject', selected.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', selected.modelType ) || cmm.isInstanceOf( 'Crt0VldnContractRevision', selected.modelType ) ) {
        return selected;
    }

    // While select a Parameter Group in the Project PWA
    if( cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', selected.modelType ) ) {
        sourceObj = cdm.getObject( selected.props.att1SourceAttribute.dbValues[ 0 ] );
        if( sourceObj && sourceObj.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 ) {
            return sourceObj;
        }
    }

    // While launch Import from the uniform parameters table
    if( parameterstableCtx !== undefined ) {
        return parameterstableCtx.isParameterWidePanelOpen ? selected : parameterstableCtx.parentObjects[ 0 ];
    }

    // While launch Import from the legacy parameters table
    if( cmm.isInstanceOf( 'Att0MeasurableAttribute', selected.modelType ) ) {
        return pselected;
    }

    return selected;
};

var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

// This API sets the ctx.parammgmtctx.selectedParentsAreModifiable based on the server command Att1AddMeasurableAttrFromTable
// Note, it should be invoked while loading the parameters table for the given parent, and or while the parent selections changed.
export let resetParentAccess = function() {
    var xrtSummaryContextObject = _.get( appCtxSvc, 'ctx.xrtSummaryContextObject', undefined );
    if( xrtSummaryContextObject !== undefined && xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        if( xrtSummaryContextObject.props && xrtSummaryContextObject.props.awb0UnderlyingObject ) {
            var underlyingObjectUid = xrtSummaryContextObject.props.awb0UnderlyingObject.dbValues[ 0 ];
            var underlyingObject = cdm.getObject( underlyingObjectUid );
            if( underlyingObject && underlyingObject.props && underlyingObject.props.is_modifiable ) {
                var isModifiable = underlyingObject.props.is_modifiable.dbValues[ 0 ];
                appCtxSvc.updateCtx( 'selectedParentsAreModifiable', isModifiable === '1' );
            } else {
                // To load is_modifiable
                var propertiesToLoad = [ 'is_modifiable' ];
                var objArray = [];
                objArray.push( {
                    uid: underlyingObjectUid
                } );

                loadModelObjects( objArray, propertiesToLoad ).then( function() {
                    setTimeout( function() {
                        underlyingObject = cdm.getObject( underlyingObjectUid );
                        if( underlyingObject && underlyingObject.props && underlyingObject.props.is_modifiable ) {
                            var isModifiable = underlyingObject.props.is_modifiable.dbValues[ 0 ];
                            appCtxSvc.updateCtx( 'selectedParentsAreModifiable', isModifiable === '1' );
                        }
                    }, 500 );
                } );
            }
        }
    } else {
        var isModifiable = _.get( appCtxSvc, 'ctx.visibleServerCommands.Att1AddMeasurableAttrFromTable', false );
        appCtxSvc.updateCtx( 'selectedParentsAreModifiable', isModifiable );
        // in case the server command is evaluated again because of the selection change
        var visibleServerCmdListener = eventBus.subscribe( 'soa.getVisibleCommands', function() {
            isModifiable = _.get( appCtxSvc, 'ctx.visibleServerCommands.Att1AddMeasurableAttrFromTable', false );
            appCtxSvc.updateCtx( 'selectedParentsAreModifiable', isModifiable );
            eventBus.unsubscribe( visibleServerCmdListener );
        } );
    }
};

/**
 * Load model objects common properties require to show
 * @param {Array} objsToLoad - Model object list
 * returns the model objects from the given input
 */

export let loadModelObjects = function( objsToLoad, cellProp ) {
    var deferred = AwPromiseService.instance.defer();
    tcVmoService.getViewModelProperties( objsToLoad, cellProp ).then( function( response ) {
        deferred.resolve( response );
    } );
    return deferred.promise;
};

export let selectedObjectIsModifiable = function( parentObj, parentObjWithParameters ) {
    var selectedObjectIsModifiable = false;
    if( parentObjWithParameters ) {
        var incontextParameterList = parentObjWithParameters.incontextParamList;
        var nonIncontextParameterList = parentObjWithParameters.nonIncontextList;
        //when Both In-context and NonContext Parameters Are selected
        if( incontextParameterList.length > 0 && nonIncontextParameterList.length > 0 ) {
            selectedObjectIsModifiable = exports.inContextParametersAreModifiable( incontextParameterList ) && exports.reusableParametersAreModifiable( parentObj );
        } else if( nonIncontextParameterList.length > 0 ) {
            selectedObjectIsModifiable = exports.reusableParametersAreModifiable( parentObj );
        } else {
            selectedObjectIsModifiable = exports.inContextParametersAreModifiable( incontextParameterList );
        }
        return selectedObjectIsModifiable;
    }
};

/**
 *
 * @param {*Array} incontextParameterList List Of IncontextParameter
 * check only if parameter is modifiable in case of Incontext Parameter
 */
//for incontext parameter check access on the source attribute Object
export let inContextParametersAreModifiable = function( incontextParameterList ) {
    var selectedObjectIsModifiable = false;
    const modifiableParameters = incontextParameterList.filter( parameter => cdm.getObject( parameter.props.att1SourceAttribute.dbValue ).props.is_modifiable.dbValues[ 0 ] === '1' );
    if( modifiableParameters.length === incontextParameterList.length ) { selectedObjectIsModifiable = true; }
    return selectedObjectIsModifiable;
};

export let reusableParametersAreModifiable = function( parentObj ) {
    var selectedObjectIsModifiable = false;
    let underlyingObject = null;
    if( parentObj && parentObj[ 0 ].props && parentObj[ 0 ].props.awb0UnderlyingObject && parentObj[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] ) {
        underlyingObject = cdm.getObject( parentObj[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] );
        if( underlyingObject && underlyingObject.props && underlyingObject.props.is_modifiable.dbValues[ 0 ] ) {
            selectedObjectIsModifiable = underlyingObject.props.is_modifiable.dbValues[ 0 ] === '1';
        }
    }
    return selectedObjectIsModifiable;
};
export let getParentOfInterests = function( selectedProxyParameters ) {
    var parentOfInterests = [];
    var parentParameterMap = new Map();
    _.forEach( selectedProxyParameters, function( proxyParam ) {
        var parentId = _.get( proxyParam, 'props.att1SourceElement.dbValues[0]', undefined );
        if( parentId ) {
            var parameterList = parentParameterMap.get( parentId ) || [];
            parameterList.push( proxyParam );
            parentParameterMap.set( parentId, parameterList );
        }
    } );
    //set the ParentInput Map in Context
    appCtxSvc.updateCtx( 'parameterTableCtx.parentParameterMap', parentParameterMap );
    for( const [ parentId, parameterList ] of parentParameterMap.entries() ) {
        var mapOfInterests = [];
        var incontextParamList = [];
        var nonIncontextList = [];
        _.forEach( parameterList, function( parameter ) {
            if( parameter.props[ 'REF(att1SourceAttribute,Att0MeasurableAttribute).att1InContext' ] &&
                parameter.props[ 'REF(att1SourceAttribute,Att0MeasurableAttribute).att1InContext' ].dbValues[ 0 ] === 'true' ) {
                incontextParamList.push( parameter );
            } else {
                nonIncontextList.push( parameter );
            }
        } );
        mapOfInterests = { parentId: parentId, parentIsModifiable: false, incontextParamList: incontextParamList, nonIncontextList: nonIncontextList };
        parentOfInterests.push( mapOfInterests );
    }
    return parentOfInterests;
};
export let getSelectedParameterNames = function( commandContext, data, action ) {
    var parameterNames = '';
    var sublocation = _.get( appCtxSvc, 'ctx.sublocation.nameToken', undefined );
    var paramProxiesSelectedFromUniformTable = commandContext.parametersTable.selectedObjects;
    var selectedParameterModelObjects = commandContext.parametersTable.selectedUnderlyingObjects;
    if( sublocation === 'com.siemens.splm.client.attrtarget.paramProjectSubLocation:Att1ParamProjectSubLocation' ) {
        selectedParameterModelObjects = _.filter( _.get( appCtxSvc, 'ctx.parammgmtctx.mselected', [] ), function( element ) {
            return element.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1;
        } );

        if( selectedParameterModelObjects.length === 0 && paramProxiesSelectedFromUniformTable.length > 0 ) {
            selectedParameterModelObjects = _.filter( _.get( appCtxSvc, 'ctx.mselected', [] ), function( element ) {
                return element.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1;
            } );
        }
    }
    _.forEach( selectedParameterModelObjects, function( parameter ) {
        parameterNames = parameterNames.concat( ',', TypeDisplayNameService.instance.getDisplayName( parameter ) );
    } );
    var parameterNamesFinal = parameterNames.slice( 1 );
    var warningConfirmationMessage = getWarningMessageString( selectedParameterModelObjects, data, action );

    //appCtxSvc.updateCtx( 'parammgmtctx.parameterTableCtx.selectedParameterNames', parameterNamesFinal );
    //appCtxSvc.updateCtx('parammgmtctx.parameterTableCtx.warningConfirmationMessage', warningConfirmationMessage );

    if( paramProxiesSelectedFromUniformTable.length > 0 ) {
        let parametersTableCtx = { ...commandContext.parametersTable.value };
        parametersTableCtx.selectedParameterNames = parameterNamesFinal;
        commandContext.parametersTable.update( parametersTableCtx );
    }
    return {
        selectedParameterNames: parameterNamesFinal,
        warningConfirmationMessage: warningConfirmationMessage
    };
};

var getWarningMessageString = function( selectedParameterModelObjects, data, action ) {
    var message = '';
    var totalCount = selectedParameterModelObjects.length;
    var ignoredCount;
    var overriddenParameters = [];
    var nonOverriddenParameters = [];

    _.forEach( selectedParameterModelObjects, function( parameter ) {
        if( parameter.props !== undefined && parameter.props.att1InContext !== undefined && parameter.props.att1InContext.dbValues[ 0 ] === '1' ) {
            overriddenParameters.push( TypeDisplayNameService.instance.getDisplayName( parameter ) );
        } else {
            nonOverriddenParameters.push( TypeDisplayNameService.instance.getDisplayName( parameter ) );
        }
    } );

    if( action === 'removeoverride' ) {
        message = data.i18n.removeOverrideConfirmation.replace( '{0}', overriddenParameters.length );
        message = message.replace( '{1}', totalCount );
        for( var i = 0; i < nonOverriddenParameters.length; i++ ) {
            message = message.concat( '\n' );
            message = message.concat( data.i18n.ignoreNonOverriddenObjects.replace( '{0}', nonOverriddenParameters[ i ] ) );
        }
    } else if( action === 'delete' ) {
        message = data.i18n.deleteObjectConfirmation.replace( '{0}', nonOverriddenParameters.length );
        message = message.replace( '{1}', totalCount );
        for( var i = 0; i < overriddenParameters.length; i++ ) {
            message = message.concat( '\n' );
            message = message.concat( data.i18n.ignoreOverriddenObjects.replace( '{0}', overriddenParameters[ i ] ) );
        }
    } else if( action === 'remove' ) {
        if( overriddenParameters.length > 0 ) {
            message = data.i18n.removeConfirmation.replace( '{0}', nonOverriddenParameters.length );
            message = message.replace( '{1}', totalCount );
            for( var i = 0; i < overriddenParameters.length; i++ ) {
                message = message.concat( '\n' );
                message = message.concat( data.i18n.ignoreObjectsWhileRemove.replace( '{0}', overriddenParameters[ i ] ) );
            }
        }
    }
    return message;
};

export let refreshParameterTable = function( response, source, subPanelContext, parametersTable ) {
    var parametersTableCtx = parametersTable || subPanelContext.parametersTable;
    var openedObject = subPanelContext.openedObject || subPanelContext.baseSelection;
    var responseServiceData = _.get( response, 'ServiceData.deleted', [] );
    var updatedResponseServiceData = _.get( response, 'ServiceData.updated', [] );
    if( source || responseServiceData.length > 0 || updatedResponseServiceData.length > 0 ) {
        var inHomeFolder = openedObject && openedObject.modelType.typeHierarchyArray.indexOf( 'Fnd0HomeFolder' ) > -1;
        var selected = parametersTableCtx.selectedUnderlyingObjects && parametersTableCtx.selectedUnderlyingObjects[ 0 ]; //_.get( appCtxSvc, 'ctx.selected', undefined );
        var selectedParent = parametersTableCtx.parentObjects[ 0 ]; //_.get( appCtxSvc, 'ctx.pselected', undefined );
        var projectSelected;
        var groupSelected;
        var isItemRevSelected;

        if( selectedParent ) {
            projectSelected = selectedParent.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1;
            groupSelected = selectedParent.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1;
            isItemRevSelected = selectedParent.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1;
        }

        //handle For Project Group
        if( !inHomeFolder && ( projectSelected || groupSelected ) ) {
            var parameterState = subPanelContext.parameterState || subPanelContext.context.parameterState;
            exports.refreshParamProjectInOwnLocation( parameterState );
        } else {
            //handle For ItemRevision or the case when we have selected parameter from parameter tab for itemRevision in its own location
            var relatedModifiedData = { relatedModified: [ selectedParent ] };
            eventBus.publish( 'cdm.relatedModified', relatedModifiedData );
        }
    }
};

export let resetSelectionAfterRefresh = function( selectedBeforeRefresh, pselectedBeforeRefresh ) {
    if( selectedBeforeRefresh ) {
        if( selectedBeforeRefresh.length === 1 ) {
            selectedBeforeRefresh = selectedBeforeRefresh[ 0 ];
        }
        selectionService.updateSelection( selectedBeforeRefresh, pselectedBeforeRefresh );
    }
};
/**
 * This function will fire event that will refresh the selected group in Project/Group PWA.
 */
export let refreshParamProjectInOwnLocation = function( parameterState ) {
    var relatedModifiedData = {};
    var selectedProxyParams = parameterState.selectedProxyParams;
    var parameterSelectedInPramProjectContext = parameterState.parameterSelectedInPramProjectContext;
    var selectedElement = parameterState.mselected[ 0 ];
    if( selectedProxyParams.length > 0 && !parameterSelectedInPramProjectContext ) {
        // now check if the parent Element is of type Project So that we can refresh completePWA
        if( exports.checkAnyOfParentIsOfTypeProject( parameterState ) ) {
            relatedModifiedData = {
                isResetPWA: true
            };
        } else {
            relatedModifiedData = {
                isCutParamFromPWA: true
            };
        }
    } else if( selectedElement && selectedElement.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1 || selectedElement.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 && selectedProxyParams.length === 0 ) {
        relatedModifiedData = {
            relatedModified: selectedElement,
            refreshParamTable: true
        };
    } else if( selectedElement.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 ) {
        var selectedGroups = parameterState.selectedGroups;
        relatedModifiedData = {
            relatedModified: selectedGroups,
            refreshParamTable: true
        };
    }
    eventBus.publish( 'paramProject.expandSelectedNode', relatedModifiedData );
};
export let checkAnyOfParentIsOfTypeProject = function( parameterState ) {
    var selectioncontainsProject = false;
    var selectedProxyParams = parameterState.selectedProxyParams;

    selectedProxyParams.some( function( parameter ) {
        var parent = cdm.getObject( _.get( parameter, 'props.att1SourceElement.dbValues[0]', undefined ) );
        if( parent && parent.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1 ) {
            selectioncontainsProject = true;
            return parent.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1 === true;
        }
    } );
    return selectioncontainsProject;
};
export let checkParamSelectedWithoutSWA = function() {
    var parameterSelectedWithoutSWA = false;
    var selectedParamsFromPwa = _.get( appCtxSvc, 'ctx.parammgmtctx.mselected', [] );
    var secondaryTab = _.get( appCtxSvc, 'ctx.xrtPageContext.secondaryXrtPageID', undefined );
    if( !secondaryTab && selectedParamsFromPwa.length > 0 ) {
        parameterSelectedWithoutSWA = true;
    }
    appCtxSvc.updateCtx( 'paramSelectedWithoutSWA', parameterSelectedWithoutSWA );
    return parameterSelectedWithoutSWA;
};
export let parameterSelectedInPramProjectContext = function( selectedObjects, subPanelContext ) {
    var parameterSelectedInPramProjectContext = false;
    //in case of Home Folder And item revision in its own location
    var paramProjectSelectedParameters = subPanelContext.parameterState.mselected[ 0 ];
    var pselected = _.get( appCtxSvc, 'ctx.pselected', undefined );
    var inHomeFolder = subPanelContext.baseSelection.modelType.typeHierarchyArray.indexOf( 'Fnd0HomeFolder' ) > -1;
    var isParamProjectContext = false;
    if( pselected ) {
        isParamProjectContext = pselected.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1 || pselected.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1;
    }
    if( paramProjectSelectedParameters || inHomeFolder && isParamProjectContext ) {
        parameterSelectedInPramProjectContext = selectedObjects.length > 0;
    }
    return parameterSelectedInPramProjectContext;
};

export let getValidParameterInstance = function() {
    var panelContext = appCtxSvc.getCtx( 'panelContext' );
    if( panelContext && panelContext.engrTable ) {
        var parametersTable = panelContext.engrTable.parametersTable;
        if( parametersTable && parametersTable.isParameterWidePanelOpen ) {
            return panelContext.engrTable.selectedParameter;
        }
    }
    var selected = appCtxSvc.getCtx( 'selected' );
    if( cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', selected.modelType ) ) {
        //get the source attribute
        var objUid = selected.props.att1SourceAttribute.dbValues[ 0 ];
        var underlyingObj = cdm.getObject( objUid );

        if( cmm.isInstanceOf( 'Att0MeasurableAttribute', underlyingObj.modelType ) ) {
            return underlyingObj;
        }
    }
    if( cmm.isInstanceOf( 'Att0MeasureValue', selected.modelType ) ) {
        var xrtOpenedObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
        if( xrtOpenedObject && xrtOpenedObject.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
            selected = xrtOpenedObject;
        }
    }
    return selected;
};

/**
 * Populates the importOptions required while importing the Complex data from Excel.
 * The import Options are populated based on whether Values are getting imported
 * Or Measurements are getting imported.
 * @return selected parameter instance
 */
export let getImportOptionsForComplexData = function( panelContext ) {
    var engrTableCtx = panelContext.engrTable;
    var importOptions = [ 'ComplexDataImport' ];
    if( engrTableCtx && engrTableCtx.measurementTable !== undefined ) {
        importOptions.push( 'isMeasurementComplexDataImport' );
    }
    if( engrTableCtx && engrTableCtx.valueTable && engrTableCtx.measurementTable === undefined ) {
        importOptions.push( 'isValueComplexDataImport' );
    }
    return importOptions;
};

export let getTopElement = function( node ) {
    if( node.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        var loop = true;
        while( loop ) {
            if( node.props.awb0Parent && node.props.awb0Parent.dbValues[ 0 ] ) {
                node = cdm.getObject( node.props.awb0Parent.dbValues[ 0 ] );
            } else {
                loop = false;
            }
        }
    }
    return node;
};

/**
 * Copy the parameter underlying objects to the clipboard
 *
 * @param selectedObjs Selected objects
 * @returns Parameter underlying objects
 */
export let att1CopyParamUnderlyingObjects = function( selectedObjs ) {
    if( selectedObjs && selectedObjs.length > 0 ) {
        if( !isTCReleaseAtLeast( 14, 3 ) ) {
            var underlyingObjs = [];
            _.forEach( selectedObjs, function( obj ) {
                if( obj.modelType && obj.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 || obj.type === 'Att1AttributeAlignmentProxy' ) {
                    if( obj.props && obj.props.att1SourceAttribute ) {
                        var objUid = obj.props.att1SourceAttribute.dbValues[ 0 ];
                        var underlyingObj = cdm.getObject( objUid );
                        if( underlyingObj ) {
                            underlyingObjs.push( underlyingObj );
                        }
                    }
                }
            } );
            // Copy underlying objects to the clipboard
            clipboardService.instance.setContents( underlyingObjs );
        } else{
            // Copy proxy objects to the clipboard
            clipboardService.instance.setContents( selectedObjs );
        }
    }
};

/**
 * Get the owning object from the parameter proxy
 *
 * @param proxy Parameter proxy object
 * @returns The owning object of the parameter proxy
 */
export let getOwningObjectFromParamProxy = function( proxy ) {
    if( proxy ) {
        proxy = cdm.getObject( proxy.uid );
    }
    if( proxy && proxy.props && proxy.props.att1SourceAttribute ) {
        var objUid = proxy.props.att1SourceAttribute.dbValues[ 0 ];
        //TODO - enable this return statement when we work on BA
        // return viewModelObjectSvc.constructViewModelObjectFromModelObject(cdm.getObject( objUid ), 'EDIT');
        return cdm.getObject( objUid );
    }

    return null;
};

/**
 * Get template type to get the corresponding excel templates for export
 * @param {Object} data - The panel's view model object
 * @return {Object} templateName - the name of template
 */
export let getTemplateRequestPref = function( ctx, invoked, paramTableCtx, commandContext ) {
    var selectedElements = ctx.mselected;
    var pwaSelected = ctx.pselected;
    var templateName = {
        excel_template_rules: ''
    };

    var context = undefined;
    if( invoked === 'SWA' ) {
        context = paramTableCtx && paramTableCtx.selectedUnderlyingObjects && paramTableCtx.selectedUnderlyingObjects.length !== 0 ? paramTableCtx.selectedUnderlyingObjects : ctx.mselected;
    }

    if( ctx && invoked && invoked === 'PWA' && ctx.selected &&
        ( cmm.isInstanceOf( 'Att0ParamDictionary', ctx.selected.modelType ) ||
            checkIfParameterFamilyObject( ctx.selected ) ) ) {
        setParameterTemplateNameForExport( pwaSelected, selectedElements, templateName, ctx, invoked );
    } else if( ctx && ctx.selected &&
        ( ctx.parammgmtctx || cmm.isInstanceOf( 'Att0ParamDictionary', ctx.selected.modelType ) ||
            checkIfParameterFamilyObject( ctx.selected ) || invoked === 'SWA' ) ) {
        setParameterTemplateNameForExport( pwaSelected, selectedElements, templateName, ctx, invoked );
        if( context && context.length > 0 && cmm.isInstanceOf( 'Att0MeasurableAttribute', context[ 0 ].modelType ) ) {
            if( pwaSelected && cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', pwaSelected.modelType ) ) {
                context = adapterSvc.getAdaptedObjectsSync( [ pwaSelected ] );
            }
        }
    }
    const { dialogAction } = commandContext;

    if ( dialogAction ) {
        let options = {
            view: 'Arm0ExportToRoundTripExcelDocument',
            parent: '.aw-layout-workareaMain',
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            isCloseVisible: false,
            subPanelContext: {
                selectionData: commandContext.selectionData,
                selectedParemeters: context
            }
        };
        dialogAction.show( options );
    }
    exports.updateViewForExportPanel( ctx, paramTableCtx );
};

/**
 * Update the export panel's view
 * @param {Object} pwaSelected - pwa selection in context
 * @param {Object} selectedElements - mselected object in context
 * @param {Object} templateName - template object
 * @param {Object} ctx - The context
 * @return {Object} templateName - the name of template
 */
function setParameterTemplateNameForExport( pwaSelected, selectedElements, templateName, ctx, invoked ) {
    var objForExport = {
        templateName: '',
        parameterTemplate: ''
    };

    var defaultTemplate = 'Parameter_template';
    if( isTCReleaseAtLeast( 14, 2 )  ) {
        defaultTemplate = 'Parameter_template_142';
    }

    if( pwaSelected && cmm.isInstanceOf( 'Att0ParamDictionary', pwaSelected.modelType ) ) {
        registerContextForExcelExport( objForExport, templateName, 'ParameterDefinition_template', 'parameter_templates' );
    } else if( pwaSelected && ( cmm.isInstanceOf( 'Att0ParamProject', pwaSelected.modelType ) ||
            cmm.isInstanceOf( 'Att0ParamGroup', pwaSelected.modelType ) ) ) {
        registerContextForExcelExport( objForExport, templateName, defaultTemplate, 'parameter_templates' );
    } else if( selectedElements && selectedElements.length > 0 &&
        cmm.isInstanceOf( 'Att0ParamProject', selectedElements[ 0 ].modelType ) ) {
        registerContextForExcelExport( objForExport, templateName, defaultTemplate, 'parameter_templates' );
    } else if( selectedElements && selectedElements.length > 0 &&
        cmm.isInstanceOf( 'Att0ParamDictionary', selectedElements[ 0 ].modelType ) ) {
        registerContextForExcelExport( objForExport, templateName, 'ParameterDefinition_template', 'parameter_templates' );
    } else if( pwaSelected && cmm.isInstanceOf( 'Crt0VldnContractRevision', pwaSelected.modelType ) || selectedElements && selectedElements.length > 0 &&
        cmm.isInstanceOf( 'Crt0VldnContractRevision', selectedElements[ 0 ].modelType ) && invoked !== 'PWA' ) {
        registerContextForExcelExport( objForExport, templateName, 'Parameter_TestManagement_template', 'parameter_templates' );
    } else if( ctx.parammgmtctx && pwaSelected && invoked !== 'PWA' ) {
        registerContextForExcelExport( objForExport, templateName, defaultTemplate, 'parameter_templates' );
    } else if( invoked === 'SWA' ) {
        registerContextForExcelExport( objForExport, templateName, defaultTemplate, 'parameter_templates' );
    } else {
        appCtxSvc.registerCtx( 'excelTemplateForExport', null );
    }
    return templateName;
}

/**
 * set and register theb excelTemplateForExport context
 * @param {Object} objForExport - object to register
 * @param {Object} templateObject - template object
 * @param {Object} templateName - current template required
 * @param {Object} soaTemplateName - soa Template Name
 */
function registerContextForExcelExport( objForExport, templateObject, templateName, soaTemplateName ) {
    templateObject.excel_template_rules = soaTemplateName;
    objForExport.templateName = templateObject;
    objForExport.parameterTemplate = templateName;
    appCtxSvc.registerCtx( 'excelTemplateForExport', objForExport );
}

/**
 * check if parameter family object
 * @param {Object} selectedElements - current selection
 * @return {Object} boolean flag
 */
function checkIfParameterFamilyObject( selectedElements ) {
    if( cmm.isInstanceOf( 'Att0ParamProject', selectedElements.modelType ) ||
        cmm.isInstanceOf( 'Att0MeasurableAttribute', selectedElements.modelType ) ||
        cmm.isInstanceOf( 'Att0AttributeDefRevision', selectedElements.modelType ) ||
        cmm.isInstanceOf( 'Att0ParamGroup', selectedElements.modelType ) ||
        cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', selectedElements.modelType ) ||
        cmm.isInstanceOf( 'Crt0VldnContractRevision', selectedElements.modelType ) ) {
        return true;
    }
    return false;
}

/**
 * @param {Boolean} value - true/false
 * @return {Boolean} defaultValue - true/false
 */
function _getBooleanValue( value, defaultValue ) {
    if( value && value === true ) {
        return 'true';
    }
    return defaultValue;
}

/**
 * Update the view
 * @param {Object} data - The panel's view model object
 * @return {Object} ctx - The context
 */
export let updateViewForExportPanel = function( ctx, paramTableCtx ) {
    var selectedElements = ctx.mselected;
    var pwaSelected = ctx.pselected;
    var parameterFamilyObjects = 0;
    var parameterDictionaryObject = 0;
    var showSettingsSection = false;
    var showRadioButton = false;
    var isShowChildrenON = _.get( paramTableCtx, 'options.showFromChildren', false );
    var extraExportOptions = [];
    extraExportOptions.push( {
        option: 'showChildren',
        optionvalue: _getBooleanValue( isShowChildrenON, 'false' )
    } );
    appCtxSvc.updateCtx( 'extraExportOptions', extraExportOptions );

    if( ctx.excelTemplateForExport ) {
        var excelTemplateForExport = ctx.excelTemplateForExport;
        for( var i = 0; i < selectedElements.length; i++ ) {
            if( ( checkIfParameterFamilyObject( selectedElements[ i ] ) || ctx.parammgmtctx ) &&
                !cmm.isInstanceOf( 'Att0ParamDictionary', selectedElements[ i ].modelType ) ) {
                parameterFamilyObjects += 1;
            } else if( cmm.isInstanceOf( 'Att0ParamDictionary', selectedElements[ i ].modelType ) ) {
                parameterDictionaryObject += 1;
            }
        }
        if( parameterFamilyObjects === selectedElements.length ) {
            showRadioButton = false;
            if( pwaSelected && cmm.isInstanceOf( 'Att0ParamDictionary', pwaSelected.modelType ) ) {
                showSettingsSection = true;
            } else {
                showSettingsSection = false;
            }
        } else if( parameterDictionaryObject > 0 ) {
            showRadioButton = false;
            showSettingsSection = true;
        }
        excelTemplateForExport.showRadioButton = showRadioButton;
        excelTemplateForExport.showSettingsSection = showSettingsSection;

        appCtxSvc.updateCtx( 'excelTemplateForExport', excelTemplateForExport );
    }
};

export let createInputForSetParametersDirection = function( direction, paramTableCtx ) {
    var inputs = [];
    var inputParameters = _.get( paramTableCtx, 'selectedObjects', undefined );
    var selectedParent = _.get( appCtxSvc, 'ctx.pselected', undefined );
    if( inputParameters ) {
        var input = { clientId: 'AW_ATT1_setDirection', parent: selectedParent, parameters: inputParameters, paramDirection: direction };
        inputs.push( input );
    } else {
        var locationContext = _.get( appCtxSvc, 'ctx.locationContext', undefined );
        //in case of Home Folder And item revision in its own location
        if( locationContext.modelObject.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 || selectedParent.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            inputs = createInputForSetDirectionItemRevision( selectedParent, direction );
        } else {
            inputs = createInputForSetDirectionInAceContext( selectedParent, direction );
        }
    }
    return inputs;
};

function createInputForSetDirectionItemRevision( selectedParent, direction ) {
    var inputs = [];
    var selectedParameters = _.get( appCtxSvc, 'ctx.mselected', undefined );
    var input = { clientId: 'AW_ATT1_setDirection', parent: selectedParent, parameters: selectedParameters, paramDirection: direction };
    inputs.push( input );
    return inputs;
}
/**
 * This function returns the SOA input for SOA call setParametersDirection
 * @returns  {Object} SOA input
 */
function createInputForSetDirectionInAceContext( selectedParent, direction ) {
    var inputs = [];
    var parentParameterMap = _.get( appCtxSvc, 'ctx.parammgmtctx.parameterTableCtx.parentParameterMap', undefined );
    var inputParameters = [];
    for( const [ parentId, parameterList ] of parentParameterMap.entries() ) {
        _.forEach( parameterList, function( parameter ) {
            inputParameters.push( parameter );
        } );
    }
    var input = { clientId: 'AW_ATT1_setDirection', parent: selectedParent, parameters: inputParameters, paramDirection: direction };
    inputs.push( input );
    return inputs;
}

/**
 * This function is added to process the Partial error being thrown from the updateParameters2 SOA
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let processPartialErrorForComplexData = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if( response && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

/**
 * Method to get the source element of the given proxy obect
 * @param {Object} sourceObject the object to find the source element
 * @returns {Object} the parent object of the proxy parameter object
 */
export let getSourceElement = function( sourceObject ) {
    return cdm.getObject( _.get( sourceObject, 'props.att1SourceElement.dbValues[0]', undefined ) );
};

/**
 * Method to get the source attribute of the given proxy obect
 * @param {Array} sourceObjects the array of attribute proxy objects
 * @returns {Object} the underlying parameter object of the proxy object
 */
export let getUnderlyingParameters = function( sourceObjects ) {
    return adapterSvc.getAdaptedObjectsSync( sourceObjects );
};

/**
 * Method to create parent vs attributes map for selected proxy attributes
 * @param {Array} sourceObjects the array of attribute proxy objects
 * @returns {Map} the map of parent vs attributes
 */
export let getParentVsAttributesMap = function( sourceObjects ) {
    var parentVsAttributes = new Map();
    for( var i = 0; i < sourceObjects.length; i++ ) {
        var sourceAttributeList = getUnderlyingParameters( [ sourceObjects[ i ] ] );
        var selectedParent = getSourceElement( sourceObjects[ i ] );
        if( parentVsAttributes.has( selectedParent ) ) {
            var attrsList = parentVsAttributes.get( selectedParent );
            attrsList.push( sourceAttributeList[ 0 ] );
        } else {
            var attributes = [ sourceAttributeList[ 0 ] ];
            parentVsAttributes.set( selectedParent, attributes );
        }
    }
    return parentVsAttributes;
};

/**
 * Return the input model object array UID array
 * @return {StringArray} UID's string array
 */
export let getParentUidArray = function() {
    var uids = [];
    var modelObjects = appCtxSvc.getCtx( 'mselected' );
    for( var x in modelObjects ) {
        if( modelObjects[ x ] && modelObjects[ x ].uid && cmm.isInstanceOf( 'Att0AttributeDefRevision', modelObjects[ x ].modelType ) ) {
            var targetUid = modelObjects[ x ].uid;
        }
        uids.push( targetUid );
    }

    return uids;
};
/**
 * Get the attachment types
 */
export let getAttachmentTypes = function( modelObjects ) {
    if( Array.isArray( modelObjects ) && modelObjects.length > 0 ) {
        return new Array( modelObjects.length ).fill( 1 );
    }
    return [];
};

/**
 * Method to get the release template name associated with PLE_Release_ParamDef_Workflow_Template preference
 * @return {String} the release template name
 */
export let getReleaseTemplateName = function( ctx ) {
    if( ctx.preferences.PLE_Release_ParamDef_Workflow_Template && ctx.preferences.PLE_Release_ParamDef_Workflow_Template.length > 0 ) {
        var templateName = ctx.preferences.PLE_Release_ParamDef_Workflow_Template[ 0 ];
        if( templateName !== undefined ) {
            return templateName;
        }
    }

    return 'TCM Release Process';
};

/**
 * Verify if platform version meets requirement
 * @param {Int} majorVersion TC Major Version
 * @param {Int} minorVersion TC Minor Version
 * @returns {Boolean} true if platform version meets requirement
 */
export let isPlatformVersionAtleast = function( majorVersion, minorVersion ) {
    var tcMajorVersion = tcSessionData.getTCMajorVersion();
    var tcMinorVersion = tcSessionData.getTCMinorVersion();
    return tcMajorVersion > majorVersion || tcMajorVersion === majorVersion && tcMinorVersion >= minorVersion;
};

export let getFileDataInputForSetComplexDataSOA = function( ctx, data ) {
    if( ctx.xrtPageContext.primaryXrtPageID === 'tc_xrt_MeasurementsTab' ) {
        return {
            fileTicket: data.fmsTicket,
            sheetNamePropNameMapping: {},
            sheetNameMeasurementPropNameMapping: {
                att0ValueTable: 'att0ValueTable'
            }
        };
    }

    return {
        fileTicket: data.fmsTicket,
        sheetNamePropNameMapping: {
            att0GoalTable: 'att0GoalTable',
            att0MinTable: 'att0MinTable',
            att0MaxTable: 'att0MaxTable'
        },
        sheetNameMeasurementPropNameMapping: {

        }
    };
};

export let cutOrDeleteSecondaryFromElement = function( relationType, action ) {
    var selectedParentsFromPWA = _.get( appCtxSvc, 'ctx.occmgmtContext.selectedModelObjects', [] );

    if( selectedParentsFromPWA && selectedParentsFromPWA.length > 0 ) {
        var mselected = _.get( appCtxSvc, 'ctx.mselected', [] );
        var inputs = [];

        var selectedElements = adapterSvc.getAdaptedObjectsSync( selectedParentsFromPWA );
        var parent = selectedElements[ 0 ];

        if( parent && mselected && mselected.length > 0 ) {
            if( action === 'delete' ) {
                var soaInputs = [];

                var input = [];
                var deleteInput = { container: parent, objectsToDelete: mselected, property: relationType, unlinkAlways: false };
                input.push( deleteInput );
                input = Array.from( input );
                soaInputs.push( {
                    deleteInput: input
                } );
                return soaSvc.postUnchecked( 'Core-2019-06-DataManagement', 'unlinkAndDeleteObjects',
                    soaInputs[ 0 ] ).then(
                    function( response ) {
                        eventBus.publish( 'cdm.relatedModified', { relatedModified: [ appCtxSvc.ctx.xrtSummaryContextObject ] } );
                        return response;
                    },
                    function( error ) {
                        var errMsg = error.message;
                        if( error && error.cause && error.cause.status === 500 ) {
                            errMsg = 'ServiceUnavailable';
                        }
                        return errMsg;
                    }
                );
            } else if( action === 'cut' ) {
                inputs.push( { clientId: 'AW_Client_RemoveDictionary', parentObj: parent, propertyName: relationType, childrenObj: mselected } );
                return inputs;
            }
        }
    }
};

/**
 * Private function to check if the object is a configured revision
 * @param {OBJECT } response - object to be deleted
 * @return {Number} number of deleted objects
 */

export let getDeleteObjectsPartialErrors = function( response ) {
    let errorDetails = {
        totalSelected: appCtxSvc.getCtx( 'mselected' ).length,
        totalRemainToDelete: appCtxSvc.getCtx( 'mselected' ).length
    };
    if( response.partialErrors ) {
        errorDetails.message = '';
        _.forEach( response.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                errorDetails.message += '<BR/>';
                errorDetails.message += object.message;
            } );
        } );
    }
    if( response && response.deleted ) {
        let relnCtx = appCtxSvc.ctx.relationContext;
        let mSel = appCtxSvc.ctx.mselected;
        let notdeleted = mSel && mSel.filter( x => !response.deleted.includes( x.uid ) );
        let relationInfo = relnCtx && relnCtx.relationInfo && relnCtx.relationInfo.filter( x => !response.deleted.includes( x.secondaryObject.uid ) );
        //We have to attempt cut on remaining objects hence update mselected
        appCtxSvc.updateCtx( 'mselected', notdeleted );
        appCtxSvc.updateCtx( 'relationContext', { relationInfo } );
        errorDetails.totalRemainToDelete = notdeleted.length;
    }

    return errorDetails;
};

/**
 * Get parent objects for parameters
 * @param {OBJECT } response - object to be deleted
 * @return {Number} number of deleted objects
 */

export let getParentObjectForParameters = function() {
    var parentObjs = appCtxSvc.getCtx( 'parametersTable.parentObjects' );
    if( parentObjs && parentObjs.length > 0 && parentObjs[ 0 ] ) {
        var parent = parentObjs[ 0 ];
    }
    if( parent && parentObjs.length > 0 && parentObjs[ 0 ].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        parent = getBomLine( parent.uid );
    }
    return parent;
};

export let isTCReleaseAtLeast = function( majorVersion, minorVersion ) {
    var majVer = appCtxSvc.ctx.tcSessionData.tcMajorVersion;
    var minVer = appCtxSvc.ctx.tcSessionData.tcMinorVersion;

    if( majVer > majorVersion ||  majVer === majorVersion && minVer >= minorVersion   ) {
        return true;
    }

    return false;
};

/**
 *Get BOMLine out of element
 * @return {parent} element object
 */
export let getBomLine = function( parentUid ) {
    var uid = parentUid.match( 'BOMLine(.*),' );
    uid = 'SR::N::' + uid[ 0 ].replace( ',,', '' );
    return new IModelObject( uid, 'BOMLine' );
};

var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};
/**
 *Parameter Management UtilService
 */

export default exports = {
    getDeleteObjectsPartialErrors,
    createViewModelProperty,
    getSelectedInParamProjSublocation,
    getParameterDefinitionOnly,
    unregisterContexts,
    getOpenedParamProject,
    getConfigurationObject,
    getRequiredPropValueFromConfigurationContext,
    isVariantConfigurationContextAttached,
    checkOverriddenParams,
    isTCReleaseAtLeast122,
    getSelectedForImport,
    resetParentAccess,
    selectedObjectIsModifiable,
    inContextParametersAreModifiable,
    reusableParametersAreModifiable,
    getParentOfInterests,
    getSelectedParameterNames,
    refreshParameterTable,
    refreshParamProjectInOwnLocation,
    checkAnyOfParentIsOfTypeProject,
    checkParamSelectedWithoutSWA,
    parameterSelectedInPramProjectContext,
    getValidParameterInstance,
    getImportOptionsForComplexData,
    getTopElement,
    getParamgmtTextBundle,
    prepareErrorMessage,
    getParentUids,
    resetSelectionAfterRefresh,
    att1CopyParamUnderlyingObjects,
    getOwningObjectFromParamProxy,
    getTemplateRequestPref,
    updateViewForExportPanel,
    createInputForSetParametersDirection,
    loadModelObjects,
    processPartialErrorForComplexData,
    getSourceElement,
    getUnderlyingParameters,
    getParentVsAttributesMap,
    clearGroupsSelection,
    getParentUidArray,
    getAttachmentTypes,
    getReleaseTemplateName,
    isPlatformVersionAtleast,
    getFileDataInputForSetComplexDataSOA,
    cutOrDeleteSecondaryFromElement,
    getParentObjectForParameters,
    setContext,
    isTCReleaseAtLeast,
    getDefaultUsage,
    getBomLine
};
