// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Crt1AddContentsPanelService
 */
import commandPanelService from 'js/commandPanel.service';
import mesgSvc from 'js/messagingService';

var exports = {};

//Register command id and open create panel for appropriate object
export let setCommandId = function( commandId, cmdCtx ) {
    cmdCtx.ActiveCommandId = commandId;
    commandPanelService.activateCommandPanel( 'Crt1AddContentsPanel', 'aw_toolsAndInfo', cmdCtx, null, null, {
        isPinUnpinEnabled: true
    } );
};

export let setCommandIdForSWATables = function( input ) {
    const {commandContext} =  input;   
    const {dialogAction} = commandContext;   
    let options = {
        view: input.CommandId,
        parent: '.aw-layout-workareaMain',
        placement:'right',
        width: 'SMALL',
        height: 'FULL',
        push:true,
        isCloseVisible:false,      
        subPanelContext: commandContext.context
    };
    dialogAction.show( options  );
};

function replaceRevision( createObjTypes ) {
    let replaceRevision = createObjTypes.replaceAll( ' Revision', '' );
    replaceRevision = replaceRevision.replaceAll( 'Revision', '' );
    return replaceRevision;
}
function updateTypes( panelContext, typeName ) {
    var createData = {};
    let typesToInclude = panelContext.subPanelContext.context.vrSublocationState.typesToInclude;
    let createObjTypes = typesToInclude.get( typeName );
    createData.createObj = replaceRevision( createObjTypes );
    var splitString = createObjTypes.split( ',' );
    createData.preferredType = replaceRevision( splitString[0] );
    createData.typeFilter = typesToInclude.get( typeName );
    return createData;
}
//Sets create input for panel.
export let setObjToDisplayPanel = function( panelContext ) {
    var createData = {};
    var commandId = panelContext.ActiveCommandId;
    var tabsToShow = 'new,palette,search';
    if( commandId && commandId === 'Crt1AddRequirement' ) {
        createData = updateTypes( panelContext, 'Requirement' );
    } else if( commandId && commandId === 'Crt1AddFunction' ) {
        createData = updateTypes( panelContext, 'Functionality' );
    } else if( commandId && commandId === 'Crt1AddSystem' ) {
        createData = updateTypes( panelContext, 'Fnd0LogicalBlock' );
    } else if( commandId && commandId === 'Crt1AddPart' ) {
        createData = updateTypes( panelContext, 'Part' );
    } else if( commandId && commandId === 'Crt1AddSoftware' ) {
        createData = updateTypes( panelContext, 'Software' );
    } else if( commandId && commandId === 'Crt1AddConfigTableOne' ) {
        createData = updateTypes( panelContext, 'ConfigTableOne' );
    } else if( commandId && commandId === 'Crt1AddConfigTableTwo' ) {
        createData = updateTypes( panelContext, 'ConfigTableTwo' );
    } else if( commandId && commandId === 'Crt1AddConfigTableThree' ) {
        createData = updateTypes( panelContext, 'ConfigTableThree' );
    } else if( commandId && commandId === 'Crt1AddConfigTableFour' ) {
        createData = updateTypes( panelContext, 'ConfigTableFour' );
    } else if( commandId && commandId === 'Crt1AddConfigTableFive' ) {
        createData = updateTypes( panelContext, 'ConfigTableFive' );
    } else if( commandId && commandId === 'Crt1AddConfigTableSix' ) {
        createData = updateTypes( panelContext, 'ConfigTableSix' );
    } else if( commandId && commandId === 'Crt1AddConfigTableSeven' ) {
        createData = updateTypes( panelContext, 'ConfigTableSeven' );
    } else if( commandId && commandId === 'Crt1AddConfigTableEight' ) {
        createData = updateTypes( panelContext, 'ConfigTableEight' );
    } else if( commandId && commandId === 'Crt1AddConfigTableNine' ) {
        createData = updateTypes( panelContext, 'ConfigTableNine' );
    } else if( commandId && commandId === 'Crt1AddConfigTableTen' ) {
        createData = updateTypes( panelContext, 'ConfigTableTen' );
        tabsToShow = 'palette,search';
    }
    createData.tabsToShow = tabsToShow;
    createData.commandId = commandId;
    createData.crt0Domain = panelContext.subPanelContext.selection[0].props.crt0Domain.dbValue;
    return createData;
};

export let throwError = function( addPanelState, sourceObjects, throwErrorVRNotCreated ) {
    var error = '';
    if( addPanelState && addPanelState.createdObject ) {
        error = error.concat( '\'' + addPanelState.createdObject.props.object_name.dbValues[ 0 ] + '\'' + ' ' + 'is' + ' ' + '\'' + addPanelState.createdObject.modelType.displayName + ' (Classname :: ' + addPanelState.createdObject.type + ')\'' + '\n' );
    } else {
        for( var i = 0; i < addPanelState.sourceObjects.length; i++ ) {
            error = error.concat( '\'' + sourceObjects[ i ].props.object_string.dbValue + '\'' + ' ' + 'is' + ' ' + '\'' + sourceObjects[ i ].modelType.displayName + ' (Classname :: ' + sourceObjects[ i ].type + ')\'' + '\n' );
        }
    }
    var msg = throwErrorVRNotCreated.replace( '{0}', error );
    var errorString = msg + ' ';
    mesgSvc.showInfo( errorString );
};

export default exports = {
    setObjToDisplayPanel,
    setCommandId,
    throwError,
    setCommandIdForSWATables
};
