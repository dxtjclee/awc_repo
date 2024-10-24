// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Acp0NamingConventionBuilderService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import editHandlerService from 'js/editHandlerService';
import messagingService from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import acp0RuleNCCondition from 'js/Acp0RuleNCCondUtils';

var exports = {};
let invalidPropList = [];
var getSeletedAttributeLOV = function( sourceClass ) {
    var deferred = AwPromiseService.instance.defer();
    var inputData = {
        initialData: {
            propertyName: 'acp0SourceClassAttribute',
            lovInput: {
                owningObject: {
                    type: 'Acp0NamingConvention',
                    uid: undefined
                },
                operationName: 'Edit',
                boName: 'Acp0NamingConvention',
                propertyValues: {
                    acp0SourceClassAttribute: []
                }
            }
        }
    };
    var propertyValues = inputData.initialData.lovInput.propertyValues;
    if ( sourceClass.value ) {
        propertyValues.acp0SourceClassType = [ sourceClass.value ];
    }
    soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', inputData )
        .then( function( responseData ) {
            deferred.resolve( responseData.lovValues.map( function( obj ) {
                return {
                    propDisplayValue: obj.propDisplayValues.lov_values[0],
                    propInternalValue: obj.propDisplayValues.lov_values[0]
                };
            } ) );
        } );
    return deferred.promise;
};

var callSaveEditSoa = function( input ) {
    return soaSvc.post( 'Internal-AWS2-2018-05-DataManagement', 'saveViewModelEditAndSubmitWorkflow2', input ).then(
        function( response ) {
            return response;
        },
        function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            return error;
        }
    );
};

var createSaveEditSoaInput = function( dataSource ) {
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsMap = dataSource.getModifiedPropertiesMap( modifiedViewModelProperties );

    var inputs = [];
    _.forEach( modifiedPropsMap, function( modifiedObj ) {
        var modelObject;
        var viewModelObject = modifiedObj.viewModelObject;

        if ( viewModelObject && viewModelObject.uid ) {
            modelObject = cdm.getObject( viewModelObject.uid );
        }

        if ( !modelObject ) {
            modelObject = {
                uid: cdm.NULL_UID,
                type: 'unknownType'
            };
        }

        var viewModelProps = modifiedObj.viewModelProps;
        var input = dms.getSaveViewModelEditAndSubmitToWorkflowInput( modelObject );
        _.forEach( viewModelProps, function( props ) {
            if ( Array.isArray( props.sourceObjectLastSavedDate ) ) {
                props.sourceObjectLastSavedDate = props.sourceObjectLastSavedDate[0];
            }
            dms.pushViewModelProperty( input, props );
        } );
        inputs.push( input );
    } );
    return inputs;
};

var getInvalidNCBUilderPropList = function( vmo ) {
    var notNullPropList = [
        vmo.props.acp0SourceClassType,
        vmo.props.acp0SelectedAttributes,
        vmo.props.acp0delimiter,
        vmo.props.object_name
    ];
    return notNullPropList.filter( function( propertyName ) {
        var dbVal = propertyName.dbValue;
        return !dbVal || Array.isArray( dbVal ) && dbVal.length === 0;
    } );
};

var saveEditHandler = {};

/**
 * custom save handler save edits called by framework
 * @param {dataSource} dataSource of selected object
 * @returns {promise}
 **/
saveEditHandler.saveEdits = function( dataSource ) {
    var deferred = AwPromiseService.instance.defer();
    var vmo = dataSource.getLoadedViewModelObjects();
    invalidPropList = getInvalidNCBUilderPropList( vmo[0] );
    if ( invalidPropList.length ) {
        if ( invalidPropList.length === 1 &&
            invalidPropList[0].propertyName === 'acp0SelectedAttributes' &&
            invalidPropList[0].dirty ) {
            var errorMessage = appCtxService.ctx.Acp0invalidNCBErrorMsg;
            messagingService.showError( errorMessage );
        } else {
            var localMsgString = appCtxService.ctx.Acp0nullNCBErrorMsg;
            localMsgString = localMsgString.replace( '{1}', vmo[0].modelType.displayName );
            _.forEach( invalidPropList, function( prop ) {
                var errorMessage = localMsgString.replace( '{0}', prop.propertyDisplayName );
                messagingService.showError( errorMessage );
            } );
        }
        deferred.reject();
    } else {
        var input = {};
        input.inputs = createSaveEditSoaInput( dataSource );
        callSaveEditSoa( input ).then( function() {
            deferred.resolve();
        }, function( error ) {
            deferred.reject();
            throw error;
        } );
    }
    return deferred.promise;
};

/**
 * Returns dirty bit.
 * @param {dataSource} dataSource of selected object
 * @returns {Boolean} isDirty bit
 */
saveEditHandler.isDirty = function( dataSource ) {
    var vmo = dataSource.getLoadedViewModelObjects();
    var invalidPropList = getInvalidNCBUilderPropList( vmo[0] );
    if ( invalidPropList.length ) {
        return true;
    }
    return vmo.length;
};

export let getNamingConventionSaveHandler = function() {
    return saveEditHandler;
};

export let loadProperties = function( data, subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    var selectedObject = subPanelContext.selected;
    // list of list; containing object to check, if loadded, and internal property name
    var requiredPropsListOfList = [
        [ selectedObject.props.acp0SourceClassType, 'acp0SourceClassType' ],
        [ selectedObject.props.acp0SelectedAttributes, 'acp0SelectedAttributes' ],
        [ selectedObject.props.acp0delimiter, 'acp0delimiter' ],
        [ selectedObject.props.acp0NamingConvention, 'acp0NamingConvention' ],
        [ selectedObject.props.acp0SourceClassAttribute, 'acp0SourceClassAttribute' ]
    ];

    var propsToLoad = [];
    _.forEach( requiredPropsListOfList, function( prop ) {
        if ( !prop[0] ) {
            propsToLoad.push( prop[1] );
        }
    } );

    var uids = [ selectedObject.uid ];
    if ( propsToLoad.length > 0 ) {
        dms.getProperties( uids, propsToLoad )
            .then(
                function() {
                    deferred.resolve( bindProperties( data, subPanelContext ) );
                }
            );
    } else {
        deferred.resolve( bindProperties( data, subPanelContext ) );
    }
    appCtxService.registerCtx( 'Acp0nullNCBErrorMsg', data.i18n.Acp0nullNCBErrorMsg );
    appCtxService.registerCtx( 'Acp0invalidNCBErrorMsg', data.i18n.Acp0invalidNCBErrorMsg );
    return deferred.promise;
};

export let bindProperties = function( data, subPanelContext ) {
    let newSelectedAttribute = { ...data.selectedAttribute };
    let newNCString = { ...subPanelContext.selected.props.acp0NamingConvention };
    // preview requires no label
    newNCString.propertyDisplayName = '';
    newSelectedAttribute = subPanelContext.selected.props.acp0SelectedAttributes;
    newSelectedAttribute.hasLov = true;
    newSelectedAttribute.isSelectOnly = false;
    newSelectedAttribute.dataProvider = 'selectedAttributeLOVProvider';





    
    return {
        selectedAttribute: newSelectedAttribute,
        NCString: newNCString
    };
};

export let NCBEditStateChanger = function( selectedAttributeLOV, sourceClass, subPanelContext ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    let newNCString = { ...subPanelContext.xrtState.value.xrtVMO.props.acp0NamingConvention };
    let newSelectedAttributeLOV = { ...selectedAttributeLOV };
    let newSelectedAttribute = { ...subPanelContext.xrtState.value.xrtVMO.props.acp0SelectedAttributes };
    var dataSource = activeEditHandler.getDataSource();
    var viewModelObjectList = dataSource.getLoadedViewModelObjects();
    invalidPropList = getInvalidNCBUilderPropList( viewModelObjectList[0] );
    if ( activeEditHandler ) {
        if( viewModelObjectList.length > -1 ) {
            viewModelObjectList[0].props.acp0SourceClassType.isRequired = activeEditHandler.editInProgress();
            viewModelObjectList[0].props.acp0delimiter.isRequired = activeEditHandler.editInProgress();
            viewModelObjectList[0].props.acp0SelectedAttributes.isRequired = activeEditHandler.editInProgress();
            newSelectedAttribute.isRequired = activeEditHandler.editInProgress();
            newSelectedAttribute.isEditable = activeEditHandler.editInProgress();
        }
        if ( activeEditHandler.editInProgress() && sourceClass.fielddata.uiValue ) {
            newSelectedAttributeLOV = getSeletedAttributeLOV( sourceClass );
        }
    }
    return {
        selectedAttributeLOV: newSelectedAttributeLOV,
        selectedAttribute: newSelectedAttribute,
        NCString: newNCString
    };
};

/**
 * To update the NC string on runtime by changing the selected Attributes and Delimiter.
 * @param {data} data view model data
 * @Param {subPanelContext} subPanelContext Sub Panel Context
 */
export let updateNamingConventionOnSelectionChange = function( subPanelContext, fields ) {
    let newNCString =  { ...subPanelContext.selected.props.acp0NamingConvention };
    subPanelContext.selected.props.acp0NamingConvention.propertyDisplayName = '';
    newNCString.dbValue = fields.selectedAttribute && fields.selectedAttribute.checked &&
                          fields.selectedAttribute.checked.length > 0 ? fields.selectedAttribute.checked.join( subPanelContext.xrtState.value.xrtVMO.props.acp0delimiter.uiValue ) : '';
    newNCString.uiValue = newNCString.dbValue;
    newNCString.propertyDisplayName = '';
    newNCString.valueUpdated = Boolean( newNCString.dbValue );
    newNCString.value = newNCString.dbValue;
    if( fields.NCString ) { fields.NCString.update( newNCString.dbValue ); }
    return { NCString: newNCString };
};
/**
 * To update the NC string on runtime by changing the selected Attributes and Delimiter.
 * @param {sourceClass} sourceClass selcted source class
 *
 */
export let updateSeletedAttribute = function( sourceClass, subPanelContext ) {
    let newSelectedAttribute = { ...subPanelContext.selected.props.acp0SelectedAttributes };
    let newSelectedAttributeLOV;
    if ( appCtxService.ctx.editInProgress && sourceClass.uiValue ) {
        newSelectedAttributeLOV = getSeletedAttributeLOV( sourceClass );
    }
    if ( !sourceClass.uiValue ) {
        newSelectedAttribute = {};
    }
    return { sourceClass: sourceClass, selectedAttributeLOV: newSelectedAttributeLOV, selectedAttribute: newSelectedAttribute };
};
export default exports = {
    getNamingConventionSaveHandler,
    loadProperties,
    bindProperties,
    NCBEditStateChanger,
    updateNamingConventionOnSelectionChange,
    updateSeletedAttribute
};
