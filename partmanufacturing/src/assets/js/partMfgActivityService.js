// Copyright (c) 2023 Siemens

/**
 * @module js/partMfgActivityService
 */
import addObjectUtils from 'js/addObjectUtils';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cutUtils from 'js/cutUtils';
import localeService from 'js/localeService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

var exports = {};

export let getActivityCreateInput = function( data, creationType, editHandler ) {
    var soaInput = {};
    var returnedInput = addObjectUtils.getCreateInput( data, '', creationType, editHandler );
    returnedInput[0].pasteProp = 'contents';

    returnedInput[0].targetObject = {
        uid: data.targetActivity.uid,
        type: data.targetActivity.type
    };
    soaInput = returnedInput;
    return soaInput;
};

export let setTargetActivity = function( subPanelContext ) {
    let pwaUnderlyingObj = undefined;
    let parentActivity = undefined;
    if( subPanelContext.searchState.pwaSelection && subPanelContext.searchState.pwaSelection[ 0 ] ) {
        let pwaSel = cdm.getObject( subPanelContext.searchState.pwaSelection[ 0 ].uid );
        pwaUnderlyingObj = cdm.getObject( pwaSel.props.al_object.dbValues[ 0 ] );
    }

    // Target object is selected activity
    if( pwaUnderlyingObj && pwaUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'MEActivity' ) > -1 ) {
        parentActivity = viewModelObjectSvc.createViewModelObject( pwaUnderlyingObj.uid );
    } else { // Target object is root_activity
        var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );
        var actLineObj = cdm.getObject( partMfgCtx.activityLine );
        var rootAct = cdm.getObject( actLineObj.props.al_object.dbValues[ 0 ] );
        parentActivity = viewModelObjectSvc.createViewModelObject( rootAct.uid );
    }
    return parentActivity;
};

export let getCreatedActivity = function( response ) {
    var activityObject;
    if ( response.ServiceData && response.ServiceData.created ) {
        _.forEach( response.ServiceData.created, function( uid ) {
            if ( cdm.getObject( uid ) ) {
                activityObject = cdm.getObject( uid );
                return activityObject;
            }
        } );
    }
    return activityObject;
};

export let updateActivityState = function( searchState, activity, operation ) {
    let searchData = { ...searchState.value };
    if( operation === 'add' ) {
        searchData.activityAdded = activity;
    } else {
        searchData.activityDeleted = activity;
    }
    searchState.update( { ...searchData } );
};

/**
 * Invokes unlinkAndDeleteObjects operation
 * @param { OBJECTARRAY } pwaSelection - user selected objects
 * @return promise of soaSvc.postUnchecked function
 */

export let unlinkAndDeleteActivity = function( pwaSelection ) {
    let soaInputs = [];
    let isConfRevContextApplied = false;

    //pwaSelection is either ActivityLine or Dataset
    let selectedObject = cdm.getObject( pwaSelection[ 0 ].uid );
    let parentActivity = undefined;
    if( selectedObject.type === 'CfgActivityLine' ) {
        let parentActLine = cdm.getObject( selectedObject.props.me_cl_parent.dbValues[ 0 ] );
        parentActivity = cdm.getObject( parentActLine.props.al_object.dbValues[ 0 ] );
    } else {
        var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );
        var rootActLine = cdm.getObject( partMfgCtx.activityLine );
        parentActivity = getParentActivity( selectedObject, rootActLine );
    }
    let objToDelete = selectedObject.type === 'CfgActivityLine' ? cdm.getObject( selectedObject.props.al_object.dbValues[ 0 ] ) : selectedObject;
    let objsToDelete = [ objToDelete ];

    soaInputs.push( {
        deleteInput: cutUtils.unlinkAndDeleteInputs( objsToDelete, isConfRevContextApplied )
    } );

    soaInputs[0].deleteInput[0].container = parentActivity;
    soaInputs[0].deleteInput[0].property = 'contents';
    soaInputs[0].deleteInput[0].unlinkAlways = true;

    return soaSvc.postUnchecked( 'Core-2019-06-DataManagement', 'unlinkAndDeleteObjects',
        soaInputs[ 0 ] ).then(
        function( response ) {
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
};

/**
 * Invokes deleteObjects operation. This function is called if unlinkAndDeleteActivity call fails
 * @param { OBJECTARRAY } pwaSelection - user selected objects
 * @return promise of soaSvc.post function
 */

export let deleteActivity = function( pwaSelection ) {
    //pwaSelection is either ActivityLine or Dataset
    let pwaSel = cdm.getObject( pwaSelection[ 0 ].uid );
    let objToDelete = pwaSelection[0].type === 'CfgActivityLine' ? cdm.getObject( pwaSel.props.al_object.dbValues[ 0 ] ) : pwaSel;

    return soaSvc.post( 'Core-2006-03-DataManagement', 'deleteObjects', {
        objects: objToDelete
    } ).then(
        function( response ) {
            return response;
        },
        function( error ) {
            return error.message;
        }
    );
};

export let getDeleteMsgInfo = function( selectedVMO ) {
    let displayName = selectedVMO.props.object_string.dbValues[ 0 ];
    let hasChildren = Boolean( selectedVMO.type === 'CfgActivityLine' && !selectedVMO.isLeaf );
    let msgText = '';
    if( hasChildren ) {
        var pmTextBundle = localeService.getLoadedText( 'partmanufacturingMessages' );
        msgText = pmTextBundle.Pm1SingleObjWithChildrenDeleteConfirmationMessage.format( displayName );
    } else {
        var fmkTextBundle = localeService.getLoadedText( 'ZeroCompileCommandMessages' );
        msgText = fmkTextBundle.singleObjDeleteConfirmationMessage.format( displayName );
    }
    return msgText;
};

function getParentActivity( selectedObject, activityLine ) {
    let parentActivity = undefined;
    var children = activityLine.props.me_cl_child_lines.dbValues;

    for( var ind = 0; ind < children.length && !parentActivity; ind++ ) {
        var childLine = cdm.getObject( children[ ind ] );
        if( childLine.type === 'CfgActivityLine' && containChildren( childLine ) ) {
            parentActivity = getParentActivity( selectedObject, childLine );
        } else {
            var underlyingObj = cdm.getObject( childLine.props.al_object.dbValues[ 0 ] );
            if( underlyingObj.modelType.typeHierarchyArray.indexOf( 'Dataset' ) > -1 && selectedObject.uid === underlyingObj.uid ) {
                parentActivity = cdm.getObject( activityLine.props.al_object.dbValues[ 0 ] );
            }
        }
    }
    return parentActivity;
}

function containChildren( obj ) {
    if( obj.modelType.typeHierarchyArray.indexOf( 'MECfgLine' ) > -1 ) {
        if( obj.props && obj.props.me_cl_has_children && obj.props.me_cl_has_children.dbValues[ 0 ] === '1' ) {
            return true;
        }
        return false;
    }
    return false;
}

/**
  * Part Manufacturing Activity service
  */
export default exports = {
    getActivityCreateInput,
    setTargetActivity,
    getCreatedActivity,
    updateActivityState,
    unlinkAndDeleteActivity,
    deleteActivity,
    getDeleteMsgInfo
};
