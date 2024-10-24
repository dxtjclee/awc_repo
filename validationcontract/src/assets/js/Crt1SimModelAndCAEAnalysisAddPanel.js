// Copyright (c) 2022 Siemens

/**
 * This file populates data related to Reports Page
 *
 * @module js/Crt1SimModelAndCAEAnalysisAddPanel
 */
import appCtxSvc from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';

var exports = {};
var flagForFilter;

//Register command id and open create panel for appropriate object
export let setTypeCommandId = function( commandId, cmdCtx ) {
    appCtxSvc.registerCtx( 'ActiveCommandId', commandId );
    commandPanelService.activateCommandPanel( 'Crt1SimModelAndCAEAnalysisAddPanel', 'aw_toolsAndInfo', cmdCtx, null, null, {
        isPinUnpinEnabled: true
    } );
};
export let setObjToDisplayOnAddPanel = function( panelContext ) {
    var commandId = appCtxSvc.ctx.ActiveCommandId;
    var createData = {};
    if( commandId && commandId === 'Crt1AddSimModel' ) {
        let typesToInclude = panelContext.subPanelContext.context.vrSublocationState.typesToInclude;
        let createObjTypes = typesToInclude.get( 'CAEModel' );
        createData.createObj = replaceRevision( createObjTypes );
        var splitString = createObjTypes.split( ',' );
        createData.preferredType = replaceRevision( splitString[ 0 ] );
        createData.typeFilter = typesToInclude.get( 'CAEModel' );
    }
    return createData;
};

function replaceRevision( createObjTypes ) {
    let replaceRevision = createObjTypes.replaceAll( ' Revision', '' );
    replaceRevision = replaceRevision.replaceAll( 'Revision', '' );
    return replaceRevision;
}
export default exports = {
    setObjToDisplayOnAddPanel,
    setTypeCommandId
};
