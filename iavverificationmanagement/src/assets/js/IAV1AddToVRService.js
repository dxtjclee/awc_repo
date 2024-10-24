// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/IAV1AddToVRService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';

// Exports to hold the methods to be used
var exports = {};

/**
 * @private
 *
 * @property {soa_kernel_clientDataModel} Cached reference to the injected AngularJS service.
 */

//Register command id and open create panel for appropriate object
export let setCommandId = function( commandId, cmdCtx ) {
    cmdCtx.ActiveCommandId = commandId;
    commandPanelService.activateCommandPanel( 'IAV1AddToTPTMContentsTable', 'aw_toolsAndInfo', cmdCtx, null, null, {
        isPinUnpinEnabled: true
    } );
};

export let setCommandIdForTestBOM = function( commandId, cmdCtx ) {
    commandPanelService.activateCommandPanel( commandId, 'aw_toolsAndInfo', cmdCtx, null, null, {
        isPinUnpinEnabled: true
    } );
};
export let addToTestMethod = function( createData ) {
    createData.createObj = 'IAV0TestRequest';
    createData.preferredType = 'IAV0TestRequest';
    createData.typeFilter = 'IAV0TestRequestRevision';
};
export let addChildToTestMethod = function( createData ) {
    var testMethodChildren = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0TestRequest;
    if( testMethodChildren !== undefined && testMethodChildren.length > 0 ) {
        createData.createObj = testMethodChildren.join( ',' );
        createData.preferredType = 'IAV0MeasureReqmt';
        var typeFilterMethodArray = [];
        for( var i = 0; i < testMethodChildren.length; i++ ) {
            var typeFilterMethodString = '';
            typeFilterMethodString = typeFilterMethodString.concat( testMethodChildren[ i ] + 'Revision' );
            typeFilterMethodArray.push( typeFilterMethodString );
        }
        createData.typeFilter = typeFilterMethodArray.join( ',' );
    } else {
        createData.createObj = 'IAV0TestCond,IAV0MeasureReqmt,IAV0InspectReqmt,IAV0DataReqmt,IAV0OprReqmt,IAV0ExtEqpReqmt,IAV0RigCompReqmt';
        createData.preferredType = 'IAV0MeasureReqmt';
        createData.typeFilter = 'IAV0TestCondRevision,IAV0MeasureReqmtRevision,IAV0InspectReqmtRevision,IAV0DataReqmtRevision,IAV0OprReqmtRevision,IAV0ExtEqpReqmtRevision,IAV0RigCompReqmtRevision';
    }
};
export let addChildChildToTestMethod = function( createData, subPanelSelection ) {
    if( subPanelSelection && subPanelSelection.selected && subPanelSelection.selected[0].props.awb0UnderlyingObject ) {
        if( subPanelSelection.selected[0].modelType.typeHierarchyArray.indexOf( 'Arm0ParagraphElement' ) === -1 ) {
            let selectedUnderlyingObj = cdm.getObject( subPanelSelection.selected[0].props.awb0UnderlyingObject.dbValues[0] );
            var selectedUnderlyingType = selectedUnderlyingObj.type;
        } else if( subPanelSelection.selected[0].modelType.typeHierarchyArray.indexOf( 'Arm0ParagraphElement' ) > -1 ) {
            selectedUnderlyingType = 'IAV0TestStepRevision';
        }
    }
    if( selectedUnderlyingType === 'IAV0TestCondRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0TestCond;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    } else if( selectedUnderlyingType === 'IAV0TestStepRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0TestStep;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    } else if( selectedUnderlyingType === 'IAV0MeasureReqmtRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0MeasureReqmt;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    } else if( selectedUnderlyingType === 'IAV0InspectReqmtRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0InspectReqmt;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    } else if( selectedUnderlyingType === 'IAV0DataReqmtRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0DataReqmt;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    } else if( selectedUnderlyingType === 'IAV0OprReqmtRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0OprReqmt;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    } else if( selectedUnderlyingType === 'IAV0ExtEqpReqmtRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0ExtEqpReqmt;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    } else if( selectedUnderlyingType === 'IAV0RigCompReqmtRevision' ) {
        var childTypes = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0RigCompReqmt;
        childTypesforSectectedType( selectedUnderlyingType, childTypes, createData );
    }
};
export let getParentSelection = function( panelContext ) {
    var parentObj;
    if( panelContext.selectionData && panelContext.selectionData.selected && panelContext.selectionData.selected[ 0 ].props &&
        panelContext.selectionData.selected[ 0 ].props.awb0Parent && panelContext.selectionData.selected[ 0 ].props.awb0Parent.dbValues ) {
        var selObjectParent = cdm.getObject( panelContext.selectionData.selected[ 0 ].props.awb0Parent.dbValues[ 0 ] );
        if( selObjectParent && selObjectParent.props && selObjectParent.props.awb0UnderlyingObject &&
            selObjectParent.props.awb0UnderlyingObject.dbValues ) {
            parentObj = cdm.getObject( selObjectParent.props.awb0UnderlyingObject.dbValues[ 0 ] );
        } else if( panelContext.selectionData && panelContext.selectionData.selected && panelContext.selectionData.selected[ 0 ].props &&
            panelContext.selectionData.selected[ 0 ].props.awb0UnderlyingObject &&
            panelContext.selectionData.selected[ 0 ].props.awb0UnderlyingObject.dbValues ) {
            parentObj = cdm.getObject( panelContext.selectionData.selected[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] );
        }
    }
    return parentObj;
};

export let setObjToDisplayPanel = function( panelContext ) {
    var subPanelSelection = panelContext.selectionData;
    var createData = {};
    var commandId = panelContext.ActiveCommandId;
    var parentObj = getParentSelection( panelContext );
    if( commandId === 'IAV1AddContentToTMTable' || commandId === 'IAV1AddContentToTMTableAsSibling' ) {
        addToTestMethod( createData );
    } else if( ( commandId === 'IAV1AddContentToTMTableAsChild' || commandId === 'IAV1AddContentToTMTableAsSiblingSibling' ) &&
    parentObj && parentObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestRequestRevision' ) > -1 ) {
        addChildToTestMethod( createData );
    } else if( commandId === 'IAV1AddContentToTMTableAsSiblingSibling' && parentObj && parentObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestRequestRevision' ) === -1 ||
        commandId === 'IAV1AddContentToTMTableAsChildChild' ) {
        addChildChildToTestMethod( createData, subPanelSelection );
    }
    createData.commandId = commandId;
    return createData;
};

export let childTypesforSectectedType = function( selectedUnderlyingType, childTypes, createData ) {
    var selectedItemType = selectedUnderlyingType.split( 'Revision' )[0];
    createData.preferredType = selectedItemType;
    if( childTypes !== undefined && childTypes.length > 0 ) {
        createData.createObj = childTypes.join( ',' );
        var typeFilterMethodArray = [];
        for( var i = 0; i < childTypes.length; i++ ) {
            var typeFilterMethodString = '';
            typeFilterMethodString = typeFilterMethodString.concat( childTypes[ i ] + 'Revision' );
            typeFilterMethodArray.push( typeFilterMethodString );
        }
        createData.typeFilter = typeFilterMethodArray.join( ',' );
    } else {
        createData.createObj = selectedItemType;
        createData.preferredType = selectedItemType;
        createData.typeFilter = selectedUnderlyingType;
    }
    return createData;
};

export let setPanelPinnedState = function( eventData ) {
    var pinStateObj;
    if( eventData && eventData.isPanelPinned ) {
        pinStateObj = { panelPinned: eventData.isPanelPinned };
    }
    return pinStateObj;
};

export default exports = {
    setObjToDisplayPanel,
    setCommandId,
    setCommandIdForTestBOM,
    setPanelPinnedState,
    childTypesforSectectedType,
    addToTestMethod,
    addChildToTestMethod,
    addChildChildToTestMethod
};
