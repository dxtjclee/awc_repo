// Copyright (c) 2022 Siemens

/**
 * @module js/Att1FreezePointService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import parammgmtUtlSvc from 'js/Att1ParameterMgmtUtilService';
import preferenceService from 'soa/preferenceService';
import navigationSvc from 'js/navigationService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

export let getRootObject = function() {
    var selectedNode = _.get( appCtxSvc, 'ctx.selected', undefined );
    var topNode = parammgmtUtlSvc.getTopElement( selectedNode );
    return [ { type: topNode.type, uid: topNode.uid } ];
};
export let updateNameWithEffectivity = function( data, isUnitEffectivityChanged ) {
    const name = _.clone( data.name );
    var selectedNode = _.get( appCtxSvc, 'ctx.selected', undefined );
    var topNode = parammgmtUtlSvc.getTopElement( selectedNode );
    var contextObjName = _.get( topNode, 'props.object_string.dbValues[0]', undefined );
    var contextRevisison = _.get( topNode, 'props.awb0ArchetypeRevId.dbValues[0]', undefined );
    var recipeName = contextObjName + '/' + contextRevisison + data.i18n.frozen + data.unit.dbValue;
    name.dbValue = recipeName;
    return {
        name: name
    };
};
export let setFreezePointNameAndEffectivity = function( data, isUnitEffectivityChanged ) {
    var selectedNode = _.get( appCtxSvc, 'ctx.selected', undefined );
    var topNode = parammgmtUtlSvc.getTopElement( selectedNode );
    var contextObjName = _.get( topNode, 'props.object_string.dbValues[0]', undefined );
    var contextRevisison = _.get( topNode, 'props.awb0ArchetypeRevId.dbValues[0]', undefined );
    var recipeName;
    var unitNumber;
    //default case
    if( !isUnitEffectivityChanged ) {
        unitNumber = exports.getAutoGenId( topNode );
        recipeName = contextObjName + '/' + contextRevisison + data.i18n.frozen + unitNumber;
    } else {
        //when we change the unit number manually
        unitNumber = data.unit.dbValue;
        recipeName = contextObjName + '/' + contextRevisison + data.i18n.frozen + unitNumber;
        data.name.dbValue = recipeName;
    }
};
export let initFreezePanel = function( data, isUnitEffectivityChanged, fields ) {
    var deferred = AwPromiseService.instance.defer();
    const unit = _.clone( data.unit );
    const name = _.clone( data.name );
    var templateName = _.clone( data.templateName );

    var selectedNode = _.get( appCtxSvc, 'ctx.selected', undefined );
    var topNode = parammgmtUtlSvc.getTopElement( selectedNode );
    var contextObjName = _.get( topNode, 'props.object_string.dbValues[0]', undefined );
    var contextRevisison = _.get( topNode, 'props.awb0ArchetypeRevId.dbValues[0]', undefined );
    var recipeName;
    var unitNumber;
    //default case
    if( !isUnitEffectivityChanged ) {
        unitNumber = exports.getAutoGenId( topNode );
        recipeName = contextObjName + '/' + contextRevisison + data.i18n.frozen + unitNumber;
    } else {
        //when we change the unit number manually
        unitNumber = data.unit.dbValue;
        recipeName = contextObjName + '/' + contextRevisison + data.i18n.frozen + unitNumber;
        //data.name.dbValue = recipeName;
    }
    unit.dbValue = unitNumber;
    unit.value = unitNumber;

    name.dbValue = recipeName;
    name.value = recipeName;

    if( fields ) {
        fields.unit.update( unitNumber );
        fields.name.update( recipeName );
    }

    // Fetch template name
    if( templateName === undefined ) {
        preferenceService.getStringValue( 'SetFreezePoint_Workflow_Template' ).then(
            function( prefValue ) {
                if( prefValue !== null ) {
                    templateName = prefValue;
                }
                deferred.resolve( {
                    name: name,
                    unit: unit,
                    templateName: templateName
                } );
            } );
    } else {
        deferred.resolve( {
            name: name,
            unit: unit,
            templateName: templateName
        } );
    }
    return deferred.promise;
};
export let getAutoGenId = function( element ) {
    var unitEffectivity;
    var effectivityString = _.get( element, 'props.awb0ArchetypeRevEffText.uiValues[0]', undefined );
    if( !effectivityString || effectivityString === '' ) {
        unitEffectivity = 1;
    } else {
        var splittedEffectivity = _.split( effectivityString, ' ' );
        var maxEffectivity;
        maxEffectivity = _getMaxEffectivity( splittedEffectivity );
        unitEffectivity = _.parseInt( maxEffectivity ) + 1;
    }
    return unitEffectivity.toString();
};
var _getMaxEffectivity = function( splittedEffectivity ) {
    var maxEffectivity = 0;
    var splittedEffectivityLength = splittedEffectivity.length;
    var i;

    for( i = 1; i < splittedEffectivityLength; i += 2 ) {
        if( maxEffectivity < _.parseInt( splittedEffectivity[ i ] ) ) {
            maxEffectivity = splittedEffectivity[ i ];
        }
    }

    return maxEffectivity;
};

export let getAttachedUIDS = function() {
    var selectedWorkflowElements = _.get( appCtxSvc, 'ctx.occmgmtContext.openedElement.props.awb0UnderlyingObject.dbValues[0]', undefined );
    return [ selectedWorkflowElements ];
};
export let getAttachmentTypesForFreeze = function() {
    return [ 1 ];
};

export let processErrorMessageForSubmitToWorkFlow = function( response, data ) {
    var err = null;
    var message = '';

    // Check if input response is not null and contains partial errors then only
    // create the error object
    if( response && ( response.ServiceData.partialErrors || response.ServiceData.PartialErrors ) ) {
        err = soaSvc.createError( response );
    }

    // Check if error object is not null and has partial errors then iterate for each error code
    // and filter out the errors which we don't want to display to user
    if( err && err.cause && err.cause.ServiceData.partialErrors ) {
        _.forEach( err.cause.ServiceData.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code && !_isIgnoreErrorCode( errVal.code ) ) {
                        if( errVal.code === 710079 ) {
                            message = data.i18n.freezePointUnitMessage.replace( '{0}', data.unit.dbValue );
                        }
                    }
                } );
            }
        } );
    }

    return message;
};
/**
 * Check input error code is to be ignore or not
 *
 * @param {object} errCode - the error code that needs to be check
 * @return {boolean} - True if error code needs to be ignored else false
 */
var _isIgnoreErrorCode = function( errCode ) {
    if( errCode === 33321 || errCode === 214000 ) {
        return true;
    }
    if( errCode === 33086 || errCode === 33083 || errCode === 33084 || errCode === 33085 ) {
        return true;
    }
    return false;
};
export let startRecipeCreate = function( data ) {
    eventBus.publish( 'Att1SetFreezePoint.createRecipe' );
};

/**
 * This method is used create the input for calling the ManageRecipe SOA for create manage action
 * This is specifically for creating a recipe from BOM selection/s
 * @param {object} data The view-model data
 * @returns {Object} input The input used as input for SOA
 */
export let createRecipesInput = function( data ) {
    var input = [];
    var revRuleOfSelectedBOM = '';
    var occmgmtCtx = appCtxSvc.getCtx( 'occmgmtContext' );
    var seedElement = _.get( appCtxSvc, 'ctx.pselected', undefined );
    seedElement = parammgmtUtlSvc.getTopElement( seedElement );
    //Save the product context for testing purpose
    var inputData = {
        clientId: 'Create',
        manageAction: 'Create',
        recipeCreInput: {
            boName: 'Fnd0SearchRecipe',
            propertyNameValues: {
                object_name: [ data.name.dbValue ],
                object_desc: [ data.description.dbValue ? data.description.dbValue : '' ]
            },
            compoundCreateInput: {}
        },
        recipeObject: undefined
    };

    // Check if seed selections are present i.e. BOM elements are selected in ACE.
    if( seedElement ) {
        var selectContentInputs = [];
        var modelObj = seedElement;
        if( modelObj.uid && modelObj.type ) {
            var selectedObj = {
                uid: modelObj.uid,
                type: modelObj.type
            };
            selectContentInputs.push( selectedObj );
        }
        revRuleOfSelectedBOM = 'Freeze Point or Latest';
        inputData.criteriaInput = {
            selectContentInputs: selectContentInputs,
            configSet: {
                revisionRule: revRuleOfSelectedBOM,
                variantRules: occmgmtCtx.productContextInfo.props.awb0VariantRules.dbValues,
                effectivityUnit: _.parseInt( data.unit.dbValue ),
                effectivityEndItem: { type: '', uid: seedElement.props.awb0UnderlyingObject.dbValues[0] },
                effectivityDate: occmgmtCtx.productContextInfo.props.awb0EffDate.dbValues[ 0 ] ? occmgmtCtx.productContextInfo.props.awb0EffDate.dbValues[ 0 ] : ''
            },
            criteriaSet: {
                closureRuleNames: [ 'FreezePointCR' ],
                lwoQueryExpression: ''
            },
            productContext: {
                uid: '',
                type: ''
            },
            isConfigChanged: false
        };
    }
    input.push( inputData );
    return input;
};

export let getCreatedFreezePoint = function( response, data ) {
    var selected = _.get( appCtxSvc, 'ctx.selected', undefined );
    var pselected = _.get( appCtxSvc, 'ctx.pselected', undefined );
    pselected = parammgmtUtlSvc.getTopElement( pselected );
    if( response && data.openOnCreate.dbValue ) {
        var recipeId = _.get( response, 'recipeOutput[0].recipeObject.uid', undefined );
        if( recipeId ) {
            var navigationParams = {
                uid: recipeId
            };
            var action = {
                actionType: 'Navigate',
                navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
            };

            navigationSvc.navigate( action, navigationParams );
        }
    }
    if( !data.openOnCreate.dbValue ) {
        if( selected.uid !== pselected.uid ) {
            exports.refreshRootNode();
        } else {
            // eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
        }
    }

    return response;
};
export let refreshRootNode = function() {
    soaSvc.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
        objects: exports.getRootObject()
    } ).then( function() {
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
    } );
};

export default exports = {
    getRootObject,
    updateNameWithEffectivity,
    setFreezePointNameAndEffectivity,
    getAutoGenId,
    getAttachedUIDS,
    getAttachmentTypesForFreeze,
    processErrorMessageForSubmitToWorkFlow,
    startRecipeCreate,
    createRecipesInput,
    getCreatedFreezePoint,
    refreshRootNode,
    initFreezePanel
};
