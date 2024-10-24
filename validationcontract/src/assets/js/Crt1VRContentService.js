// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1VRContentService
 */
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';
import locationNavigationService from 'js/locationNavigation.service';
import appCtxSvc from 'js/appCtxService';
import occmgmtPropertyPolicyService from 'js/occmgmtPropertyPolicyService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import occmgmtTreeTableDataService from 'js/occmgmtTreeTableDataService';
import occmgmtUpdatePwaDisplayService from 'js/occmgmtUpdatePwaDisplayService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import backgroundWorkingCtxTimer from 'js/backgroundWorkingContextTimer';
import backgroundWorkingCtxSvc from 'js/backgroundWorkingContextService';
import dataManagementService from 'soa/dataManagementService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import dynamicTableUtils from 'js/dynamicTableUtils';


var exports = {};
var objNckbxState;
var showChart = true;

export let launchContentView = function( commandContext ) {
    objNckbxState = commandContext.vrSublocationState.objNckbxState;
    showChart = commandContext.vrSublocationState.showChart;
    let openedObject = commandContext.baseSelection;
    let selectedObj = commandContext.vrSublocationState.mselected.length === 0 ? openedObject : commandContext.vrSublocationState.mselected[0];
    let toParams = {};
    let options = {};
    toParams.uid = selectedObj.uid;
    toParams.pci_uid = '';
    if( selectedObj && selectedObj.props && selectedObj.props.object_name && selectedObj.props.object_name.dbValues[ 0 ] ) {
        toParams.uid2 = selectedObj.props.object_name.dbValues[0];
    }
    let transitionTo = 'VRContent';
    locationNavigationService.instance.go( transitionTo, toParams, options );
};
export let launchContentViewFromAddFromContent = function( vrSublocationState ) {
    objNckbxState = vrSublocationState.objNckbxState;
    showChart = vrSublocationState.showChart;
};

export let loadContentHeader = function() {
    let defer = AwPromiseService.instance.defer();
    var vrHeaderViewContext = {};
    let params = AwStateService.instance.params;
    var selectedObjUids = params.uid;
    var selectedObject = cdm.getObject( selectedObjUids );
    if( selectedObject && selectedObject.props && selectedObject.props.object_name && selectedObject.props.object_name.dbValues[ 0 ] ) {
        vrHeaderViewContext.objectNameTitle = selectedObject.props.object_name.dbValues[ 0 ];
        var uiValues;
        if( selectedObject.props && selectedObject.props.crt0ReleaseVersions && selectedObject.props.crt0ReleaseVersions.uiValues ) {
            uiValues = selectedObject.props.crt0ReleaseVersions.uiValues;
        }
        if( uiValues && uiValues !== undefined ) {
            if( uiValues.length >= 1 ) {
                var softwareValues = uiValues[ 0 ];
                for( var j = 1; j < uiValues.length; j++ ) {
                    softwareValues = softwareValues.concat( ',', uiValues[ j ] );
                    if( softwareValues.length > 113 ) {
                        softwareValues = softwareValues.substring( 0, 113 );
                        softwareValues = softwareValues.concat( ' ...' );
                    }
                }
            }
        }
        vrHeaderViewContext.softwareName = softwareValues;
    } else if( params && params.uid2 || params.c_uid ) {
        // when user refreshes the sublocation selected object is undefined take values from params.
        vrHeaderViewContext.objectNameTitle = params.uid2;
        vrHeaderViewContext.softwareName = params.c_uid;
    }
    defer.resolve( vrHeaderViewContext );
    return defer.promise;
};

export let loadContentTastBar = function() {
    let defer = AwPromiseService.instance.defer();
    var vrTaskBarContext = {};

    let params = AwStateService.instance.params;
    var openedObjectUid = params.uid;
    var openedObject = cdm.getObject( openedObjectUid );
    vrTaskBarContext.openedObject = openedObject;

    defer.resolve( vrTaskBarContext );

    return defer.promise;
};

export const destroyOccmgmtVRContentView = ( subPanelContext ) => {
    destroyOccMgmtServices( subPanelContext );
    appCtxSvc.unRegisterCtx( 'taskbarfullscreen' );
    appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    appCtxSvc.unRegisterCtx( 'locationContext' );
};

let destroyOccMgmtServices = ( subPanelContext ) => {
    let contextKey = subPanelContext.occContext.viewKey;
    occMgmtStateHandler.destroyOccMgmtStateHandler( contextKey );
    occmgmtUpdatePwaDisplayService.destroy( contextKey );
    occmgmtTreeTableDataService.destroy( contextKey );
    occmgmtPropertyPolicyService.unRegisterPropertyPolicy();
    aceExpandBelowService.destroy( contextKey );
    backgroundWorkingCtxTimer.reset();
    backgroundWorkingCtxSvc.reset( subPanelContext );
};
export const initializeOccMgmtVRContentView = ( viewKeys, hiddenCommands ) => {
    appCtxSvc.registerCtx( 'aceActiveContext', { key: '', context: '' } );
    appCtxSvc.registerCtx( 'decoratorToggle', false );
    appCtxSvc.registerCtx( 'locationContext', {
        'ActiveWorkspace:Location': 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation',
        'ActiveWorkspace:SubLocation': 'showObject'
    } );
};

export const synchronizeViewStateWithURL = ( objectsToOpen = [], activeState = [], occContext, data ) => {
    //Get which parameters have changed
    let changedParams = {};
    let newOccContext;

    for ( var i in AwStateService.instance.params ) {
        if ( AwStateService.instance.params[i] !== activeState[i] ) {
            changedParams[i] = AwStateService.instance.params[i];
        }
    }

    //If the uid is changed refresh the whole page
    if ( changedParams.hasOwnProperty( 'uid' ) ) {
        objectsToOpen[0] = objectsToOpen[0] || {};
        if ( changedParams.uid ) {
            objectsToOpen[0].uid = AwStateService.instance.params.uid;
            newOccContext = data.declViewModelJson.data.occContext.initialValues;
        } else {
            delete objectsToOpen[0].uid;
        }
    }

    if ( !_.isUndefined( newOccContext ) ) {
        occContext.update( newOccContext );
    }
    return dataManagementService.loadObjects( [ objectsToOpen[0].uid ] ).then( function() {
        var vmos = [
            viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( objectsToOpen[0].uid ), null )
        ];
        return {
            activeState: JSON.parse( JSON.stringify( AwStateService.instance.params ) ),
            objectsToOpen: vmos
        };
    } );
};

export const setBackObjNCkbxState = ( subPanelContext ) => {
    if ( objNckbxState ) {
        return objNckbxState;
    }
};
export let setBackShowChartState = function() {
    return showChart;
};
export let clearObjNCkbxState = function() {
    objNckbxState = null;
};
export let clearShowChartState = function() {
    showChart = true;
};

export let getSoftwareDeployedStatus = function() {
    var objectsToValidate = [ 'Software' ];
    return soaSvc.post( 'Core-2015-10-Session', 'getTypeDescriptions2', {
        typeNames: objectsToValidate,
        options: {}
    } ).then( function( response ) {
        if( response.types ) {
            let notDeployedTemplate = dynamicTableUtils.notDeployedTemplates( response, objectsToValidate );
            return { isSoftwareDeployed: notDeployedTemplate.isSoftwareDeployed };
        }
        var isSoftwareDeployed = false;
        return { isSoftwareDeployed };
    } );
};

/**
 * Returns the Crt1VRContentService instance
 *
 * @member Crt1VRContentService
 */
export default exports = {
    launchContentView,
    loadContentHeader,
    loadContentTastBar,
    destroyOccmgmtVRContentView,
    initializeOccMgmtVRContentView,
    synchronizeViewStateWithURL,
    setBackObjNCkbxState,
    clearObjNCkbxState,
    launchContentViewFromAddFromContent,
    setBackShowChartState,
    clearShowChartState,
    getSoftwareDeployedStatus
};
