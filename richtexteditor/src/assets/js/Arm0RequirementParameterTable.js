// Copyright (c) 2022 Siemens

/**
 * Service for Parameter table in Requirement Documentation Page
 *
 * @module js/Arm0RequirementParameterTable
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import selectionService from 'js/selection.service';
import eventBus from 'js/eventBus';

var _isMappingTableEditing = 'isMappingTableEditing';

var exports = {};

/**
 * Update Bottom/Right split panel as per selection in diagram
 */
export let updateSplitPanelContent = function( data ) {
    var attrContext = {};
    if( appCtxSvc.ctx.visibleServerCommands && appCtxSvc.ctx.visibleServerCommands.Ase0ShowSplitPanel ) {
        attrContext = appCtxSvc.getCtx( 'Att1ShowMappedAttribute' );
        if( attrContext ) {
            if( !appCtxSvc.ctx.isSectionChangedInPWA && data.eventData && data.eventData.selections ) {
                attrContext.parentUids = data.eventData.selections[0].uid;
                appCtxSvc.ctx.isSectionChangedInPWA = true;
            } else{
                var selection = selectionService.getSelection();
                var selectedObjs = selection.selected;
                attrContext.parentUids =  selectedObjs['0'].uid;
            }
            appCtxSvc.updateCtx( 'Att1ShowMappedAttribute', attrContext );
        }
    }
    eventBus.publish( 'Att1ShowMappedAttribute.refreshTable' );
};

/**
 * initPage
 * @param {Object} ctx the context object
 */
export let loadParameterCtxDetails = function( ctx, data ) {
    // Disable "Add > Sibling" visibility for parent-less requirements
    var reqCtx = { StructureDisplayModeContext: 'NestedDisplay' };
    appCtxSvc.updateCtx( 'StructureDisplayModeContext', reqCtx );
    var attrContext = {};
    // Initialize ctx for Attributes table
    if( ctx.visibleServerCommands && ctx.visibleServerCommands.Ase0ShowSplitPanel ) {
        var selectedObjs = appCtxSvc.ctx.aceActiveContext.context.selectedModelObjects;
        var selModelObj = null;
        var mappingCmd = 'true';

        if( selectedObjs.length > 0 && selectedObjs[ 0 ].props && selectedObjs[ 0 ].props.awb0UnderlyingObject ) {
            selModelObj = cdm.getObject( selectedObjs[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] );
        }

        if( selModelObj && selModelObj.modelType && selModelObj.modelType.typeHierarchyArray.indexOf( 'SpecElementRevision' ) > -1 ) {
            mappingCmd = 'false';
        }

        attrContext = appCtxSvc.getCtx( 'Att1ShowMappedAttribute' );

        if( !attrContext ) {
            attrContext = {};
        }

        attrContext.clientName = 'AWClient';
        attrContext.clientScopeURI = 'ReqAttributeMappingTable';
        attrContext.parentUids = selectedObjs[ '0' ].uid;
        attrContext.rootElementUids = exports.getRootElementUids();
        attrContext.productContextUids = exports.getProductContextUids();
        attrContext.mappingCommand = mappingCmd;
        attrContext.connectionInfo = '';
        appCtxSvc.updateCtx( 'Att1ShowMappedAttribute', attrContext );

        // Initialize Editing Context
        appCtxSvc.updateCtx( _isMappingTableEditing, false );
    } else {
        attrContext = {
            clientName: 'AWClient',
            clientScopeURI: 'ReqAttributeMappingTable',
            parentUids: '',
            rootElementUids: '',
            productContextUids: '',
            connectionInfo: ''
        };
        appCtxSvc.updateCtx( 'Att1ShowMappedAttribute', attrContext );
    }

    // initialize pageSplit value
    if( !ctx.SystemRequirements || !ctx.SystemRequirements.pageSplit ) {
        reqCtx = { pageSplit: 'all' };
        appCtxSvc.updateCtx( 'SystemRequirements', reqCtx );
    }
    eventBus.publish( 'Att1ShowMappedAttribute.refreshTable' );
};

/**
 * getRootElementUids
 *  @return {String} rootElement
 */
export let getRootElementUids = function() {
    var rString = '';

    var elementToPCIMap = appCtxSvc.ctx.occmgmtContext.elementToPCIMap;

    if( elementToPCIMap ) {
        var uids = [];
        uids = Object.keys( elementToPCIMap );

        for( var x = 0; x < uids.length; ++x ) {
            rString += uids[ x ];

            if( x < uids.length - 1 ) {
                rString += ' ';
            }
        }
    } else {
        var topElement = appCtxSvc.ctx.occmgmtContext.topElement;
        rString = topElement.uid;
    }

    return rString;
};

/**
 * getProductContextUids
 * @return {String} ProductContextUids
 */
export let getProductContextUids = function() {
    var rString = '';

    var elementToPCIMap = appCtxSvc.ctx.occmgmtContext.elementToPCIMap;

    if( elementToPCIMap ) {
        var uids = [];
        for( var i in elementToPCIMap ) {
            if( elementToPCIMap.hasOwnProperty( i ) ) {
                uids.push( elementToPCIMap[ i ] );
            }
        }

        for( var x = 0; x < uids.length; ++x ) {
            rString += uids[ x ];

            if( x < uids.length - 1 ) {
                rString += ' ';
            }
        }
    } else {
        var pCtx = appCtxSvc.ctx.occmgmtContext.productContextInfo;
        rString = pCtx.uid;
    }

    return rString;
};

export default exports = {
    updateSplitPanelContent,
    loadParameterCtxDetails,
    getRootElementUids,
    getProductContextUids
};
