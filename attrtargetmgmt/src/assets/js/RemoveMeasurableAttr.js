// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/RemoveMeasurableAttr
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import msgSvc from 'js/messagingService';
import policySvc from 'soa/kernel/propertyPolicyService';
import parammgmtUtlSvc from 'js/Att1ParameterMgmtUtilService';
import _ from 'lodash';
import tcClipboardService from 'js/tcClipboardService';
import adapterSvc from 'js/adapterService';

var exports = {};

var _selectedParentObject = null;
var _isAttributeOverridden = false;
var _selectedAttributeModels = null;
var _attributeObjects = [];
var _overridenAttributes = [];
var _sourceAttributes = [];
var _undeletedAttributes = null;
var _totalSelectedAttrCount = 0;
var _unDeletedAttrCountFromSOA = 0;
var _sourceAttrCount = 0;
var _deletedAttrCount = 0;

var _getUnderlyingObject = function( occurence ) {
    var underlyingObj = null;
    if( occurence && occurence.props.awb0UnderlyingObject && occurence.props.awb0UnderlyingObject.dbValues[ 0 ] ) {
        underlyingObj = cdm.getObject( occurence.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    return underlyingObj;
};

var _isTypeOf = function( modelObject, types ) {
    if( modelObject && types && types.length > 0 ) {
        for( var i = 0; i < types.length; i++ ) {
            if( cmm.isInstanceOf( types[ i ], modelObject.modelType ) ) {
                return true;
            }
        }
    }
    return false;
};

var _getAttrModelsOfSelectedAttrObjects = function( selectedObjectList ) {
    var selectedAttributeModels = [];
    var tempObject = {};
    for( var i = 0; i < selectedObjectList.length; i++ ) {
        if( selectedObjectList[ i ].props.att1InContext ) {
            if( parseInt( selectedObjectList[ i ].props.att1InContext.dbValues[ 0 ] ) ) {
                tempObject = {};
                _isAttributeOverridden = true;
                tempObject.targetAttrObject = selectedObjectList[ i ];
                tempObject.targetAttrType = 'OVERRIDDEN';
                tempObject.relatedAttrObjects = [];
                tempObject.groupName = null;
                selectedAttributeModels.push( tempObject );
            } else {
                tempObject = {};
                tempObject.targetAttrObject = selectedObjectList[ i ];
                tempObject.targetAttrType = 'SOURCE';
                tempObject.relatedAttrObjects = [];
                tempObject.groupName = null;
                selectedAttributeModels.push( tempObject );
            }
        } else {
            tempObject = {};
            tempObject.targetAttrObject = selectedObjectList[ i ];
            tempObject.targetAttrType = 'SOURCE';
            tempObject.relatedAttrObjects = [];
            tempObject.groupName = null;
            selectedAttributeModels.push( tempObject );
        }
    }
    return selectedAttributeModels;
};

/**
 * Unregister Policy Id
 */
function _unregisterPolicyId() {
    var policyId = policySvc.register( {
        types: [ {
            name: 'Att0MeasurableAttribute',
            properties: [ {
                name: 'att1InContext'
            } ]
        } ]
    } );

    if( policyId ) {
        policySvc.unregister( policyId );
    }
}

var _getParentObject = function( preferences ) {
    var mselected = appCtxSvc.getCtx( 'mselected' );
    var selectedObjectList = [];
    for( var i = 0; i < mselected.length; i++ ) {
        if( cmm.isInstanceOf( 'Att0MeasurableAttribute', mselected[ i ].modelType ) ) {
            selectedObjectList.push( mselected[ i ] );
        } else if( cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', mselected[ i ].modelType ) ) {
            //get the source attribute
            var objUid = mselected[ i ].props.att1SourceAttribute.dbValues[ 0 ];
            selectedObjectList.push( cdm.getObject( objUid ) );
        }
    }

    _unregisterPolicyId();

    if( selectedObjectList.length > 0 ) {
        _selectedAttributeModels = _getAttrModelsOfSelectedAttrObjects( selectedObjectList );
        var pselected = appCtxSvc.getCtx( 'pselected' );
        if( cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', pselected.modelType ) ) {
            //get the source attribute
            var objUid = pselected.props.att1SourceAttribute.dbValues[ 0 ];
            pselected = cdm.getObject( objUid );
        }

        var modelType;
        var selectedParent;

        if( pselected.length === undefined ) {
            modelType = pselected.modelType;
            selectedParent = pselected;
        } else {
            modelType = pselected[ 0 ].modelType;
            selectedParent = pselected[ 0 ];
        }
        if( selectedParent && cmm.isInstanceOf( 'Awb0Element', modelType ) ) {
            if( _isAttributeOverridden ) {
                _selectedParentObject = _getUnderlyingObject( selectedParent );
            }
        } else if( cmm.isInstanceOf( 'WorkspaceObject', modelType ) &&
            _isTypeOf( selectedParent, preferences.PLE_MeasurableAttrParentObjectTypes ) ) {
            _selectedParentObject = selectedParent;
        } else if( cmm.isInstanceOf( 'ItemRevision', modelType ) ) { //This check for interface def delete parameter
            _selectedParentObject = selectedParent;
        }
    }
};
export let createInputForDeleteParameters = function() {
    return exports.createInputForRemoveParameters;
};
export let createInputForRemoveParameters = function( isRemoveOverride, commandContext ) {
    var selectedParent = commandContext.parametersTable ? commandContext.parametersTable.parentObjects[ 0 ] : commandContext.selectionData.pselected;
    var locationContext = commandContext.openedObject ? commandContext.openedObject : commandContext.baseSelection;
    var parentOfInterests = _.get( appCtxSvc, 'ctx.parammgmtctx.parameterTableCtx.parentOfInterests', [] );
    //in case of Home Folder And item revision in its own location
    var paramProjectSelectedParameters = Boolean( commandContext.parameterState );
    var paramProxiesSelectedFromUniformTable = commandContext.parametersTable ? commandContext.parametersTable.selectedObjects : commandContext.selectionData.selected;

    var inHomeFolder = commandContext.openedObject ? commandContext.openedObject.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 : commandContext.openedObject;
    var selectedParamsFromPwa = commandContext.parameterState ? commandContext.selectionData.selected : null;
    var inputs = [];
    //in case oF Project And Group, parameters selected from SWA table
    if( paramProjectSelectedParameters ) {
        inputs = getInputInProjectOrGroup( parentOfInterests );
        //incase of itemRevision
    } else if( inHomeFolder && ( selectedParent.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 || selectedParent.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) ) {
        //get underlyingObjects from param proxy objects
        var selectedParams = adapterSvc.getAdaptedObjectsSync( paramProxiesSelectedFromUniformTable );
        inputs = [ { clientId: 'AW_Client_RemoveParameter', parent: selectedParent, selectedParams: selectedParams } ];
        //in case of Ace
    } else if( selectedParamsFromPwa && selectedParamsFromPwa.length > 0 && paramProxiesSelectedFromUniformTable.length === 0 ) {
        inputs = getInputForParameterSelectionFromTree();
    } else if( paramProxiesSelectedFromUniformTable.length > 0 ) {
        var parentAttributesMap = parammgmtUtlSvc.getParentVsAttributesMap( paramProxiesSelectedFromUniformTable );
        for( let [ key, value ] of parentAttributesMap.entries() ) {
            if( isRemoveOverride === true ) {
                var overriddenParams = [];
                for( var i = 0; i < value.length; i++ ) {
                    if( value[ i ].props.att1InContext !== null && value[ i ].props.att1InContext.dbValues[ 0 ] === '1' ) {
                        overriddenParams.push( value[ i ] );
                    }
                }
                var input = { clientId: 'AW_Client_RemoveParameter', parent: key, selectedParams: overriddenParams };
                inputs.push( input );
            } else {
                var nonOverriddenParams = [];
                for( var i = 0; i < value.length; i++ ) {
                    if( value[ i ].props.att1InContext !== null && value[ i ].props.att1InContext.dbValues[ 0 ] === '0' ) {
                        nonOverriddenParams.push( value[ i ] );
                    }
                }
                var input = { clientId: 'AW_Client_RemoveParameter', parent: key, selectedParams: nonOverriddenParams };
                inputs.push( input );
            }
        }
    } else {
        inputs = getInputInAce( parentOfInterests );
    }
    return inputs;
};
var getInputInProjectOrGroup = function( parentOfInterests ) {
    var inputs = [];
    _.forEach( parentOfInterests, function( parent ) {
        var selectedParentModelObject = cdm.getObject( parent.parentId );
        var paramProjectParameters = parent.nonIncontextList;
        var attachedAttributesToParent = paramProjectParameters.map( function( parameter ) {
            return parammgmtUtlSvc.getUnderlyingParameters( [ parameter ] )[ 0 ];
        } );
        inputs.push( { clientId: 'AW_Client_RemoveParameter', parent: selectedParentModelObject, selectedParams: attachedAttributesToParent } );
    } );
    return inputs;
};
export let createInputForValueFileCut = function() {
    var selectedProxyParameters = _.get( appCtxSvc, 'ctx.parammgmtctx.selectedProxyParams', [] );
    var mselected = _.get( appCtxSvc, 'ctx.mselected', [] );
    var pselected = _.get( appCtxSvc, 'ctx.pselected', [] );
    var openedObj = _.get( appCtxSvc, 'ctx.locationContext.modelObject', [] );
    var inputs = [];
    var selectedProxyCountInPWA = selectedProxyParameters.length;

    var parent;
    var datasetObj = mselected[ 0 ];
    var relationType;

    if( selectedProxyCountInPWA === 1 && mselected.length > 0 && mselected[ 0 ].modelType.typeHierarchyArray.indexOf( 'Dataset' ) > -1 ) {
        parent = parammgmtUtlSvc.getUnderlyingParameters( [ selectedProxyParameters[ 0 ] ] ); //Parameter selected in Project tree PWA
    } else if( openedObj && openedObj.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
        parent = openedObj; //Parameter opened in own location
    } else if( openedObj && openedObj.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 && pselected && pselected.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
        parent = pselected; // Parameter selected in HOME Folder
    }

    if( parent && datasetObj ) {
        relationType = _.get( appCtxSvc, 'ctx.relationContext.relationInfo[0].relationType', [] );
        if( relationType === 'Att1MeasurementFileProvider' ) {
            relationType = 'Att0HasMeasurementFile';
            var measureObjUid = parent.props.att0CurrentValue.dbValues[ 0 ];
            parent = cdm.getObject( measureObjUid );
        }

        inputs.push( { clientId: 'AW_Client_RemoveParameter', parentObj: parent, propertyName: relationType, childrenObj: [ datasetObj ] } );
    }
    return inputs;
};

var getInputForParameterSelectionFromTree = function() {
    var selectedProxyParameters = _.get( appCtxSvc, 'ctx.parammgmtctx.selectedProxyParams', [] );
    var inputs = [];

    if( selectedProxyParameters.length > 0 ) {
        _.forEach( selectedProxyParameters, function( parameter ) {
            var parent = parammgmtUtlSvc.getSourceElement( parameter );
            var attributeObject = parammgmtUtlSvc.getUnderlyingParameters( [ parameter ] );
            if( parent && attributeObject ) {
                inputs.push( { clientId: 'AW_Client_RemoveParameter', parent: parent, selectedParams: attributeObject } );
            }
        } );
        return inputs;
    }
};

var getInputInAce = function( parentOfInterests ) {
    var inputs = [];
    var selectedParentInAce = _.get( appCtxSvc, 'ctx.occmgmtContext.selectedModelObjects', [] );

    _.forEach( parentOfInterests, function( parent ) {
        var selectedParentModelObject = selectedParentInAce.filter( function( modelObject ) {
            return modelObject.uid === parent.parentId;
        } );
        var reusableParameters = parent.nonIncontextList;
        var attachedAttributesToParent = reusableParameters.map( function( parameter ) {
            return parammgmtUtlSvc.getUnderlyingParameters( [ parameter ] )[ 0 ];
        } );
        var nonReusableParameters = parent.incontextParamList;
        var nonReusableAttributesToParent = nonReusableParameters.map( function( parameter ) {
            return parammgmtUtlSvc.getUnderlyingParameters( [ parameter ] )[ 0 ];
        } );
        var totalAttributesToBeDeleted = attachedAttributesToParent.concat( nonReusableAttributesToParent );
        inputs.push( { clientId: 'AW_Client_RemoveParameter', parent: selectedParentModelObject[ 0 ], selectedParams: totalAttributesToBeDeleted } );
    } );
    return inputs;
};
export let cutParameters = function() {
    var parentToChildrenParamsMap = {};

    var parentObject = appCtxSvc.ctx.pselected;
    if( cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', parentObject.modelType ) ) {
        //get the source attribute
        var objUid = parentObject.props.att1SourceAttribute.dbValues[ 0 ];
        parentObject = cdm.getObject( objUid );
    }

    var relationType = '';
    var childrenObjects = appCtxSvc.ctx.mselected;

    ignoreOverriddenParams( childrenObjects );

    if( cmm.isInstanceOf( 'Awb0Element', parentObject.modelType ) || cmm.isInstanceOf( 'ItemRevision', parentObject.modelType ) ) {
        if( cmm.isInstanceOf( 'Awb0Element', parentObject.modelType ) ) {
            parentObject = _getUnderlyingObject( parentObject );
        }
        parentToChildrenParamsMap[ parentObject.uid ] = childrenObjects;
    } else if( cmm.isInstanceOf( 'Att0ParamProject', parentObject.modelType ) || cmm.isInstanceOf( 'Att0ParamGroup', parentObject.modelType ) ) {
        childrenObjects = [];
        relationType = 'Att0HasParamValue';

        var selectedProxyParams = _.get( appCtxSvc, 'ctx.parammgmtctx.selectedProxyParams', undefined );
        if( !selectedProxyParams ) {
            var params = _.get( appCtxSvc, 'ctx.mselected', undefined );
            _.forEach( params, function( param ) {
                if( param.props.wso_thread ) {
                    var paramThread = cdm.getObject( param.props.wso_thread.dbValues[ 0 ] );
                    childrenObjects.push( paramThread );
                }
            } );
            parentToChildrenParamsMap[ parentObject.uid ] = childrenObjects;
        } else {
            for( var i = 0; i < selectedProxyParams.length; i++ ) {
                if( cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', selectedProxyParams[ i ].modelType ) ) {
                    //get the source attribute
                    var objUid = selectedProxyParams[ i ].props.att1SourceAttribute.dbValues[ 0 ];
                    var selectedParam = cdm.getObject( objUid );

                    //Get the Parameter thread
                    if( selectedParam.props.wso_thread ) {
                        var paramThread = cdm.getObject( selectedParam.props.wso_thread.dbValues[ 0 ] );

                        //get the source element (Parent of Parameters)
                        var paramParentUid = selectedProxyParams[ i ].props.att1SourceElement.dbValues[ 0 ];

                        //prepare map of source element as key and attributes threads as value.
                        //e.g. map[Group1] = vector<P1,P2,P3>, map[Group2] = vector<P4,P5>, map[Project1] = vector<P6,P7> etc.
                        var keys = Object.keys( parentToChildrenParamsMap );

                        if( keys && keys.includes( paramParentUid ) ) {
                            var paramValues = parentToChildrenParamsMap[ paramParentUid ];
                            paramValues.push( paramThread );
                            parentToChildrenParamsMap[ paramParentUid ] = paramValues;
                        } else {
                            var childrenParams = [];
                            childrenParams.push( paramThread );
                            parentToChildrenParamsMap[ paramParentUid ] = childrenParams;
                        }
                    }
                }
            }
        }
    }

    var input = [];

    _.forOwn( parentToChildrenParamsMap, function( value, key ) {
        var childrenObjects = value;
        var parentObject = cdm.getObject( key );
        var inputData = {
            clientId: '',
            parentObj: parentObject,
            childrenObj: childrenObjects,
            propertyName: relationType
        };
        input.push( inputData );
    } );

    return input;
};

var ignoreOverriddenParams = function( childrenObjects ) {
    var overriddenParams = appCtxSvc.ctx.overriddenParamsSelected;

    if( overriddenParams && overriddenParams.length > 0 ) {
        for( var i = 0; i < childrenObjects.length; i++ ) {
            for( var j = 0; j < overriddenParams.length; j++ ) {
                if( childrenObjects[ i ].uid === overriddenParams[ j ].uid ) {
                    childrenObjects.splice( i );
                    break;
                }
            }
        }
    }
};

export let isValidationContract = function( preferences ) {
    var locationContext = appCtxSvc.getCtx( 'locationContext' );
    var selected = appCtxSvc.getCtx( 'selected' );
    var mselected = appCtxSvc.getCtx( 'mselected' );
    appCtxSvc.unRegisterCtx( 'removeAttrVisibility' );

    _selectedAttributeModels = null;
    _selectedParentObject = null;
    _isAttributeOverridden = false;

    var otherCheck = false;
    if( locationContext !== null && selected !== null && mselected !== null &&
        mselected.length > 0 ) {
        otherCheck = ( locationContext.modelObject && !cmm.isInstanceOf( 'Crt0VldnContractRevision',
            locationContext.modelObject.modelType ) || locationContext.modelObject === undefined ) &&
            ( cmm.isInstanceOf( 'Att0MeasurableAttribute', selected.modelType ) || cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', selected.modelType ) );
    }

    if( otherCheck ) {
        _getParentObject( preferences );
    }
};

var _setMeasurableAttributes = function() {
    _attributeObjects = [];
    _overridenAttributes = [];
    _sourceAttributes = [];
    if( _selectedAttributeModels && _selectedAttributeModels.length > 0 ) {
        for( var i = 0; i < _selectedAttributeModels.length; i++ ) {
            _attributeObjects.push( _selectedAttributeModels[ i ].targetAttrObject );
            if( _selectedAttributeModels[ i ].targetAttrType === 'OVERRIDDEN' ) {
                _overridenAttributes.push( _selectedAttributeModels[ i ].targetAttrObject );
            } else if( _selectedAttributeModels[ i ].targetAttrType === 'SOURCE' ) {
                _sourceAttributes.push( _selectedAttributeModels[ i ].targetAttrObject );
            }
        }
    }
};

var _getObjectNames = function( modelObjects ) {
    var objectName = '';
    if( modelObjects && modelObjects.length > 0 ) {
        for( var i = 0; i < modelObjects.length; i++ ) {
            if( objectName.length > 0 ) {
                objectName = objectName.concat( ', ' );
            }
            objectName = objectName.concat( TypeDisplayNameService.instance.getDisplayName( modelObjects[ i ] ) );
        }
    }
    return objectName;
};

export let getObjectNames = function() {
    var objectNames = '';
    if( _selectedAttributeModels && _selectedParentObject ) {
        _setMeasurableAttributes();
        objectNames = _getObjectNames( _attributeObjects );
    }
    return {
        objectNames: objectNames,
        isSelectedAttrInContext: _isAttributeOverridden
    };
};

var _getAttributeToDelete = function() {
    var attributes = null;
    if( _isAttributeOverridden ) {
        if( _overridenAttributes && _overridenAttributes.length > 0 ) {
            attributes = _overridenAttributes;
        }
    } else {
        if( _sourceAttributes && _sourceAttributes.length > 0 ) {
            attributes = _sourceAttributes;
        }
    }
    return attributes;
};
export let displayCutParametersMessage = function( data ) {
    var selectedParams = [];
    if( data.parameterInputData !== undefined && data.parameterInputData.length ) {
        for( var i = 0; i < data.parameterInputData.length; i++ ) {
            for( j = 0; j < data.parameterInputData[ i ].selectedParams.length; j++ ) {
                selectedParams.push( data.parameterInputData[ i ].selectedParams[ j ] );
            }
        }
    } else {
        var selectedParams = appCtxSvc.ctx.mselected;
    }

    var selectedParamNames = '';

    var msg = '';
    if( selectedParams !== null && selectedParams.length === 1 && data.cutParameterFrameworkSoaResponse.ServiceData.deleted && data.cutParameterFrameworkSoaResponse.ServiceData.deleted.length === 1 ) {
        msg = msg.concat( data.i18n.paramCutMessage.replace( '{0}', TypeDisplayNameService.instance.getDisplayName( appCtxSvc.ctx.mselected[ 0 ] ) ) );
        msg = msg.replace( '{1}', appCtxSvc.ctx.pselected.props.object_string.uiValues[ 0 ] );
    } else if( selectedParams !== null && selectedParams.length > 1 && data.cutParameterFrameworkSoaResponse.ServiceData.deleted && data.cutParameterFrameworkSoaResponse.ServiceData.deleted.length >
        1 ) {
        var selectedParents = [];
        for( var j = 0; j < selectedParams.length; j++ ) {
            if( selectedParamNames.length > 0 ) {
                selectedParamNames = selectedParamNames.concat( ', ' );
            }
            if( !selectedParams[ j ].props ) {
                selectedParams[ j ] = cdm.getObject( selectedParams[ j ].uid );
            }
            selectedParamNames = selectedParamNames.concat( TypeDisplayNameService.instance.getDisplayName( selectedParams[ j ] ) );
            var openContext = selectedParams[ j ].props.att1OpenedContext;
            if( openContext ) {
                var contextName = openContext.uiValues[ 0 ];
                if( contextName && contextName.length > 0 && !selectedParents.includes( contextName ) ) {
                    selectedParents.push( contextName );
                }
            }
        }
        msg = msg.concat( data.i18n.multipleParamCutMsg.replace( '{0}', selectedParamNames ) );
        var parentsString = selectedParents.length > 0 ? selectedParents.join( ', ' ) : TypeDisplayNameService.instance.getDisplayName( appCtxSvc.ctx.pselected );
        msg = msg.replace( '{1}', parentsString );
    }
    msgSvc.showInfo( msg );
};
export let displayCutCompletedMessage = function( data ) {
    var selectedParams = appCtxSvc.ctx.mselected;
    var selectedParamNames = '';
    var msg = '';
    if( data.cutParameterFrameworkSoaResponse.deleted && data.cutParameterFrameworkSoaResponse.deleted.length === 1 ) {
        msg = msg.concat( data.i18n.paramCutMessage.replace( '{0}', TypeDisplayNameService.instance.getDisplayName( appCtxSvc.ctx.mselected[ 0 ] ) ) );
        msg = msg.replace( '{1}', appCtxSvc.ctx.pselected.props.object_string.uiValues[ 0 ] );
        msgSvc.showInfo( msg );
    } else if( data.cutParameterFrameworkSoaResponse.updated ) {
        for( var j = 0; j < selectedParams.length; j++ ) {
            if( selectedParamNames.length > 0 ) {
                selectedParamNames = selectedParamNames.concat( ', ' );
            }
            selectedParamNames = selectedParamNames.concat( TypeDisplayNameService.instance.getDisplayName( selectedParams[ j ] ) );
        }
        msg = msg.concat( data.i18n.multipleParamCutMsg.replace( '{0}', selectedParamNames ) );
        msg = msg.replace( '{1}', TypeDisplayNameService.instance.getDisplayName( appCtxSvc.ctx.pselected ) );
        msgSvc.showInfo( msg );
    }

    var overriddenParamsSelected = appCtxSvc.getCtx( 'overriddenParamsSelected' );
    if( overriddenParamsSelected && overriddenParamsSelected.length > 0 ) {
        var ignoredOverriddenParamNames = '';
        for( var j = 0; j < overriddenParamsSelected.length; j++ ) {
            if( ignoredOverriddenParamNames.length > 0 ) {
                ignoredOverriddenParamNames = ignoredOverriddenParamNames.concat( ', ' );
            }
            ignoredOverriddenParamNames = ignoredOverriddenParamNames.concat( TypeDisplayNameService.instance.getDisplayName( overriddenParamsSelected[ j ] ) );
        }
        msg = '';
        msg = msg.concat( data.i18n.cutOperationIgnoredOverriddenParamsMsg.replace( '{0}', ignoredOverriddenParamNames ) );
        msgSvc.showError( msg );
        appCtxSvc.unRegisterCtx( 'overriddenParamsSelected' );
    }
};

export let startDelete = function() {
    var attributes = _getAttributeToDelete();
    _undeletedAttributes = [];
    var inputs = [ {
        parentObj: _selectedParentObject,
        measurableAttributes: attributes
    } ];

    return {
        inputs: inputs,
        attributes: attributes
    };
};

var _setDeletedAttrCount = function() {
    _totalSelectedAttrCount = 0;
    _unDeletedAttrCountFromSOA = 0;
    _sourceAttrCount = 0;
    _deletedAttrCount = 0;
    if( _attributeObjects && _attributeObjects.length > 0 ) {
        _totalSelectedAttrCount = _attributeObjects.length;
    }
    if( _undeletedAttributes && _undeletedAttributes.length > 0 ) {
        _unDeletedAttrCountFromSOA = _undeletedAttributes.length;
    }
    if( _sourceAttributes && _sourceAttributes.length > 0 ) {
        _sourceAttrCount = _sourceAttributes.length;
    }
    if( _isAttributeOverridden ) {
        _deletedAttrCount = _totalSelectedAttrCount - _sourceAttrCount - _unDeletedAttrCountFromSOA;
    } else {
        _deletedAttrCount = _totalSelectedAttrCount - _unDeletedAttrCountFromSOA;
    }
};

var _displayDeleteInfoMessageInContextForTable = function( data ) {
    var msg = '';
    if( _deletedAttrCount === 0 ) {
        msg = msg.concat( data.i18n.deleteInfoMessageOnOccurance1 );
    } else {
        msg = msg.concat( data.i18n.deleteInfoMessageOnOccurance2.replace( '{0}', _deletedAttrCount ) );
        msg = msg.replace( '{1}', _totalSelectedAttrCount );
    }
    if( _totalSelectedAttrCount > _deletedAttrCount ) {
        if( _sourceAttributes && _sourceAttributes.length > 0 ) {
            msg = msg.concat( data.i18n.deleteInfoMessageOnOccurance3.replace( '{0}',
                _getObjectNames( _sourceAttributes ) ) );
        }
        if( _undeletedAttributes && _undeletedAttributes.length > 0 ) {
            msg = msg.concat( data.i18n.deleteInfoMessageOnOccurance4.replace( '{0}',
                _getObjectNames( _undeletedAttributes ) ) );
        }
    }
    msgSvc.showInfo( msg );
};

var _getListOfUndeletedAttribute = function() {
    var totalUndeletedAttributes = null;
    if( _isAttributeOverridden ) {
        var sourceAttr = _getObjectNames( _sourceAttributes );
        var unDeletedAttrFromSOA = _getObjectNames( _undeletedAttributes );
        if( sourceAttr ) {
            totalUndeletedAttributes = sourceAttr;
            if( unDeletedAttrFromSOA ) {
                totalUndeletedAttributes = totalUndeletedAttributes.concat( ',', unDeletedAttrFromSOA );
            }
        } else {
            totalUndeletedAttributes = _getObjectNames( _undeletedAttributes );
        }
    } else {
        totalUndeletedAttributes = _getObjectNames( _undeletedAttributes );
    }
    return totalUndeletedAttributes;
};

var _displayDeleteInfoMessageOutOfContextForTable = function( data ) {
    var msg = '';
    if( _deletedAttrCount === 0 ) {
        if( _undeletedAttributes && _undeletedAttributes.length === 1 ) {
            msg = msg.concat( data.i18n.deleteInfoMessageOnItemRev1.replace( '{0}', _getListOfUndeletedAttribute() ) );
        } else {
            msg = msg.concat( data.i18n.deleteInfoMessageOnItemRev3.replace( '[{0}]', _undeletedAttributes.length ) );
        }
    } else {
        msg = msg.concat( data.i18n.deleteInfoMessageOnItemRev2.replace( '{0}', _deletedAttrCount ) );
        msg = msg.replace( '{1}', _totalSelectedAttrCount );
        msg = msg.replace( '{2}', TypeDisplayNameService.instance.getDisplayName( _selectedParentObject ) );
        if( _totalSelectedAttrCount > _deletedAttrCount && _undeletedAttributes && _undeletedAttributes.length > 0 ) {
            msg = msg.concat( data.i18n.deleteInfoMessageOnItemRev3.replace( '{0}', _getListOfUndeletedAttribute() ) );
        }
    }
    msgSvc.showInfo( msg );
};

export let deleteDone = function( response, data ) {
    if( appCtxSvc.ctx.xrtPageContext.secondaryXrtPageID === 'tc_xrt_AttributesForDCP' ) {
        appCtxSvc.unRegisterCtx( 'Att1ShowMappedAttribute' );
    }
    if( response.hasOwnProperty( 'failedToDeleteAttrTagMap' ) ) {
        _undeletedAttributes = [];
        var obj = response.failedToDeleteAttrTagMap;
        var undeletedAttributes = null;
        for( var key in obj ) {
            if( obj.hasOwnProperty( key ) ) {
                undeletedAttributes = obj[ key ];
                for( var i = 0; i < undeletedAttributes.length; i++ ) {
                    _undeletedAttributes.push( undeletedAttributes[ i ] );
                }
            }
        }
    }
    _setDeletedAttrCount();

    if( _totalSelectedAttrCount !== _deletedAttrCount ) {
        if( _isAttributeOverridden ) {
            _displayDeleteInfoMessageInContextForTable( data );
        } else {
            _displayDeleteInfoMessageOutOfContextForTable( data );
        }
    }
    return _selectedParentObject;
};

/**
 * This method add only processed parameters to clipboard
 * @param {*} data
 */
export let cutToAwClipboardExceptOverridden = function( data ) {
    var removedParameters = data.parameterInputData;
    var paramAddToClipboard = [];
    if( removedParameters && removedParameters.length > 0 ) {
        for( var j = 0; j < removedParameters.length; j++ ) {
            var processedParameters = removedParameters[ j ].selectedParams;
            if( processedParameters && processedParameters.length > 0 ) {
                for( var i = 0; i < processedParameters.length; i++ ) {
                    paramAddToClipboard.push( processedParameters[ i ].uid );
                }
            }
        }
    }
    tcClipboardService.setContents( paramAddToClipboard );
};

/**
 * remove parameter from the table without reloading the table.
 * @param {*} parameterTable - subpanelContext.parameterTable
 * @param {*} provider  - data.provider
 * @param {*} eventData - contains response and reusable table ifo
 * @returns
 */
export let removeParamsFromTable = function( parameterTable, provider, eventData ) {
    if( eventData.reusable && eventData.requestId !== parameterTable.requestId ) {
        return;
    }
    if( eventData.response ) {
        var vmc = provider.viewModelCollection;
        var loadedVMOs;
        if( vmc ) {
            loadedVMOs = vmc.getLoadedViewModelObjects();
        }
        var removedObjects = [];
        _.forEach( eventData.response.outputs, function( output ) {
            _.forEach( output.removedParams, function( removedParam ) {
                removedObjects.push( removedParam.uid );
            } );
            _.forEach( output.deletedParams, function( deletedParam ) {
                removedObjects.push( deletedParam );
            } );
        } );
        if( removedObjects.length > 0 ) {
            _.forEach( removedObjects, function( removedObject ) {
                _.remove( loadedVMOs, function( vmo ) {
                    if( vmo.uid && vmo?.props?.att1SourceAttribute.dbValues[0] === removedObject ) {
                        return true;
                    }
                } );
            } );
            provider.update( loadedVMOs );
            provider.selectNone();
        }
    }
};

/**
 * Returns the RemoveMeasurableAttr instance
 *
 * @member RemoveMeasurableAttr
 */

export default exports = {
    createInputForDeleteParameters,
    createInputForRemoveParameters,
    createInputForValueFileCut,
    cutParameters,
    isValidationContract,
    getObjectNames,
    displayCutParametersMessage,
    displayCutCompletedMessage,
    startDelete,
    deleteDone,
    cutToAwClipboardExceptOverridden,
    removeParamsFromTable
};
