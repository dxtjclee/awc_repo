// Copyright (c) 2023 Siemens

/**
 * @module js/Crt1VRExecuteService
 */
import locationNavigationService from 'js/locationNavigation.service';
import editHandlerService from 'js/editHandlerService';
import Crt1VRContentService from 'js/Crt1VRContentService';

var exports = {};
export let launchExecuteView = function( commandContext ) {
    //After context switch, tables selected by user and the chart state should be remembered
    Crt1VRContentService.launchContentViewFromAddFromContent( commandContext.context.vrSublocationState );
    let openedObject = commandContext.context.baseSelection;
    let selectedObj = commandContext.context.vrSublocationState.mselected.length === 0 ? openedObject : commandContext.context.vrSublocationState.mselected[ 0 ];
    let toParams = {};
    let options = {};
    toParams.uid = selectedObj.uid;
    toParams.pci_uid = selectedObj.type;
    let transitionTo = 'VRExecute';
    if( selectedObj && selectedObj.props && selectedObj.props.object_name && selectedObj.props.object_name.dbValues[ 0 ] ) {
        toParams.uid2 = selectedObj.props.object_name.dbValues[ 0 ];
    }
    var uiValues;
    if( selectedObj && selectedObj.props && selectedObj.props.crt0ReleaseVersions && selectedObj.props.crt0ReleaseVersions.uiValues ) {
        uiValues = selectedObj.props.crt0ReleaseVersions.uiValues;
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
    toParams.c_uid = softwareValues;
    locationNavigationService.instance.go( transitionTo, toParams, options );
};

export let editForExecute = function( handler, viewModeContext ) {
    if( !handler ) { handler = viewModeContext === 'TableView' || viewModeContext === 'TreeView' ? 'TABLE_CONTEXT' : 'NONE'; }
    editHandlerService.setActiveEditHandlerContext( handler );
    var editHandler = editHandlerService.getEditHandler( handler );
    editHandler.startEdit();
};

export default exports = {
    launchExecuteView,
    editForExecute
};
