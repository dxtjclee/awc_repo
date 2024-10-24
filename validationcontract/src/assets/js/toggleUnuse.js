// Copyright (c) 2022 Siemens

/**
 * @module js/toggleUnuse
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import AwStateService from 'js/awStateService';

var exports = {};
var proxyMeasurableAttrs;
var pselected = null;

export let performSetUsageOperationForProxyTable = function( usage, parametersTable ) {
    if( parametersTable && parametersTable.selectedObjects ) {
        proxyMeasurableAttrs = parametersTable.selectedObjects;
    }
    var parentSelectedUid = getOpenedObjectUid();
    if( parametersTable && parametersTable.parentObjects ) {
        var scopeSelection = parametersTable.parentObjects[ 0 ];
    }
    //Check if in overview tab. If yes then get scope table selection uid.
    if( scopeSelection && scopeSelection.modelType && scopeSelection.modelType.typeHierarchyArray && scopeSelection.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 ) {
        parentSelectedUid = scopeSelection.uid;
    }

    pselected = cdm.getObject( parentSelectedUid );
    var inputs = [];
    var parentElementObj = null;

    //Need to check while implementing interface definition
    var idCtx = appCtxSvc.getCtx( 'interfaceDetails' );
    if( idCtx && idCtx.isPortSelected && idCtx.targetModelObject ) {
        parentElementObj = cdm.getObject( idCtx.targetModelObject.uid );
    }

    if( proxyMeasurableAttrs.length > 0 ) {
        inputs.push( {
            clientId: 'InputOrOutputOrNone',
            analysisRequest: pselected,
            data: [ {
                parentElement: parentElementObj,
                attrs: proxyMeasurableAttrs,
                direction: usage
            } ]
        } );
    }
    return inputs;
};

/**
 * Get the opened object uid
 */
function getOpenedObjectUid() {
    var openedObjectUid = '';
    var stateSvc = AwStateService.instance;
    if( stateSvc && stateSvc.params ) {
        var params = stateSvc.params;
        if( params.s_uid ) {
            openedObjectUid = params.s_uid;
        } else if( params.uid ) {
            openedObjectUid = params.uid;
        }
    }
    return openedObjectUid;
}

/**
 * Method to hide and show unused parameters
 */
export let unusedParametersSelected = function( parametersTable, commandContext ) {
    let parametersTableCtx = { ...parametersTable.value };
    if( commandContext.context.vrSublocationState && commandContext.context.vrSublocationState.value ) {
        var vrSublocationCtx = { ...commandContext.context.vrSublocationState.value };
    }
    if( parametersTableCtx ) {
        if( parametersTable.searchCriteria && parametersTable.searchCriteria.showUnusedAttrs === 'false' ||
        parametersTable.searchCriteria && parametersTable.searchCriteria.showUnusedAttrs === '' ) {
            parametersTableCtx.searchCriteria.showUnusedAttrs = 'true';
            if( vrSublocationCtx ) {
                vrSublocationCtx.unusedFlag = 'true';
            }
        } else {
            parametersTableCtx.searchCriteria.showUnusedAttrs = 'false';
            if( vrSublocationCtx ) {
                vrSublocationCtx.unusedFlag = 'false';
            }
        }
        parametersTable.update( parametersTableCtx );
        if( commandContext.context.vrSublocationState ) {
            commandContext.context.vrSublocationState.update( vrSublocationCtx );
        }
    }
};

export default exports = {
    performSetUsageOperationForProxyTable,
    unusedParametersSelected
};
