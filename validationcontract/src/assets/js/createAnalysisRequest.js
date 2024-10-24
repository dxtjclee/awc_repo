// Copyright (c) 2022 Siemens

/**
 * @module js/createAnalysisRequest
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import addObjectUtils from 'js/addObjectUtils';

var exports = {};

/**
 * Get input data for object creation.
 *
 * @param {Object} data the view model data object
 * @param {Object} ctx the ctx object
 * @param {Object} creationType the view model data object
 * @param {Object} editHandler the view model data object
 */
export let initCreateObject = function( data, ctx, creationType, editHandler ) {
    var createInputs = addObjectUtils.getCreateInput( data, null, creationType, editHandler );
    createInputs[ 0 ].clientId = 'CreateAnalysisRequest';

    // To Do remove the ctx uses here. and read the needed information here from subcontextpanel
    // set domain
    if( ctx.selected.type === 'Att0ParamProject' ) {
        createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues.crt0Domain = [ ctx.selected.uid ];
    } else if( ctx.parammgmtctx && ctx.parammgmtctx.paramProject ) {
        createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues.crt0Domain = [ ctx.parammgmtctx.paramProject.uid ];
    } else if( ctx.pselected && ctx.pselected.type === 'Att0ParamProject' ) {
        createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues.crt0Domain = [ ctx.pselected.uid ];
    } else if( ctx.selected.type === 'Fnd0SearchRecipe' || ctx.xrtSummaryContextObject && ctx.xrtSummaryContextObject.type === 'Fnd0SearchRecipe' ) {
        createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues.crt0Domain = [ ctx.xrtSummaryContextObject.uid ];
    } else if( data.domainUid !== undefined && data.domainUid !== null ) {
        createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues.crt0Domain = [ data.domainUid ];
    }
    return createInputs;
};

export let getManageARInputForCreateVR = function( createdAR, _manageAction, elementsToAdd, recipeId, seeds ) {
    var elementInputs = [];
    var contextType = '';
    var contextUid = '';
    for( var i = 0; i < elementsToAdd.length; i++ ) {
        var elementInput = {};
        elementInput.elementAction = '';
        elementInput.objectToAdd = {
            type: elementsToAdd[ i ].type,
            uid: elementsToAdd[ i ].uid
        };
        elementInput.objectToAddContext = '';
        elementInput.objectToAddParent = '';
        elementInput.addParameterAsInOut = '';
        elementInput.addUnderlyingObject = false;
        elementInput.parameterInfo = [ {
            parameter: '',
            direction: ''
        } ];
        elementInput.portToInterfaceDefsMap = [
            [],
            []
        ];
        elementInputs.push( elementInput );
        var succMsg = '';
        if( elementsToAdd[ i ].props && elementsToAdd[ i ].props.object_string ) {
            if( elementsToAdd.length === 1 ) {
                succMsg += elementsToAdd[ i ].props.object_string.dbValues[ 0 ];
            } else {
                succMsg += elementsToAdd[ i ].props.object_string.dbValues[ 0 ] + ',';
            }
        }
    }
    var pref = {
        diagramAction: '',
        useClosureRule: false
    };

    if( recipeId && appCtxSvc.ctx.aceActiveContext && appCtxSvc.ctx.aceActiveContext.context && appCtxSvc.ctx.aceActiveContext.context.productContextInfo ) {
        contextType = appCtxSvc.ctx.aceActiveContext.context.productContextInfo.type;
        contextUid = appCtxSvc.ctx.aceActiveContext.context.productContextInfo.uid;
    } else if( recipeId && appCtxSvc.ctx.panelContext && appCtxSvc.ctx.panelContext.recipeState && appCtxSvc.ctx.panelContext.recipeState.productContextInfo ) {
        contextType = appCtxSvc.ctx.panelContext.recipeState.productContextInfo.type;
        contextUid = appCtxSvc.ctx.panelContext.recipeState.productContextInfo.uid;
    }
    var input = [ {
        clientId: 'AW_AR_Client',
        verificationRequest: {
            type: createdAR.type,
            uid: createdAR.uid
        },
        data: [ {
            manageAction: _manageAction,
            elementInputs: elementInputs,
            recipeData: {
                recipe: recipeId,
                seedObjects: seeds,
                context: {
                    type: contextType,
                    uid: contextUid
                }
            }
        } ]
    } ];
    var manageARInputForCreateVR = {};
    manageARInputForCreateVR.input = input;
    manageARInputForCreateVR.pref = pref;
    manageARInputForCreateVR.succMsg = succMsg;
    manageARInputForCreateVR.oobj = createdAR;
    return manageARInputForCreateVR;
};
/*
 * Gets the content for open cell command
 */
export let getContentObject = function( obj ) {
    if( obj !== undefined && obj.props.crt1SourceObject ) {
        // return the content ID
        var contentUid = obj.props.crt1SourceObject.dbValues[ 0 ];
        return cdm.getObject( contentUid );
    }else if( obj !== undefined && !obj.props.crt1SourceObject ) {
        // return the content ID
        var contentUid = obj.props.crt1UnderlyingObject.dbValues[ 0 ];
        return cdm.getObject( contentUid );
    }else if( obj === undefined ) {
        if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.props.awb0UnderlyingObject ) {
            return appCtxSvc.ctx.selected.props.awb0UnderlyingObject.dbValues[ 0 ];
        }
        return appCtxSvc.ctx.selected.uid;
    }
};

/**
 * Returns the createAnalysisRequest instance
 *
 * @member createAnalysisRequest
 */

export default exports = {
    initCreateObject,
    getManageARInputForCreateVR,
    getContentObject
};
