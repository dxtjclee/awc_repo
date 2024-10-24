// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Crt1AddToVRService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import addObjectUtils from 'js/addObjectUtils';
import AwStateService from 'js/awStateService';
import dataManagementSvc from 'soa/dataManagementService';
import viewModelObjectService from 'js/viewModelObjectService';
import manageVerificationService from 'js/manageVerificationService';
import tableSvc from 'js/published/splmTablePublishedService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';

// Exports to hold the methods to be used
var exports = {};
var ISSUE_COLUMN_NAME = 'crt1IssueCount';
var ATTACHMENT_COLUMN_NAME = 'crt1AttachmentCount';
var TARGET = 'crt1IsTarget';
import tcVmoService from 'js/tcViewModelObjectService';

var columnsToShowHyperlinks = [ ISSUE_COLUMN_NAME, ATTACHMENT_COLUMN_NAME, TARGET ];

/**
 * @private
 *
 * @property {soa_kernel_clientDataModel} Cached reference to the injected AngularJS service.
 */

// get parent info for overview and execute
function _getParentInfo( subPanelContext ) {
    // parentType for overview
    var parentType;
    if( subPanelContext && subPanelContext.subPanelContext && subPanelContext.subPanelContext.vrObject && subPanelContext.subPanelContext.vrObject.type &&
        appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
        parentType = subPanelContext.subPanelContext.vrObject.type;
    } else if( subPanelContext && subPanelContext.subPanelContext && subPanelContext.subPanelContext.selected && subPanelContext.subPanelContext.selected.type ) {
        // parentType for execute
        parentType = subPanelContext.subPanelContext.selected.type;
    }
    var parentUid;
    // parentUid for overview
    if( subPanelContext && subPanelContext.subPanelContext && subPanelContext.subPanelContext.vrObject && subPanelContext.subPanelContext.vrObject.uid &&
        appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
        parentUid = subPanelContext.subPanelContext.vrObject.uid;
    } else if( AwStateService && AwStateService.instance && AwStateService.instance.params && AwStateService.instance.params.uid ) {
        // parentUid for execute
        parentUid = AwStateService.instance.params.uid;
    }
    return {
        parentType: parentType,
        parentUid: parentUid
    };
}
//Register command id and open create panel for appropriate object
export let setCommandId = function( commandId, cmdCtx ) {
    cmdCtx.ActiveCommandId = commandId;
    commandPanelService.activateCommandPanel( 'Crt1AddContentsToTestProcedure', 'aw_toolsAndInfo', cmdCtx, null, null, {
        isPinUnpinEnabled: true
    } );
};

export let addTestProcedure = function( createData ) {
    createData.createObj = 'IAV0TestProcedur';
    createData.preferredType = 'IAV0TestProcedur';
    createData.typeFilter = 'IAV0TestProcedurRevision';
};

export let addTestCase = function( createData ) {
    createData.createObj = 'IAV0TestCase';
    createData.preferredType = 'IAV0TestCase';
    createData.typeFilter = 'IAV0TestCaseRevision';
};

export let addChildToTestProcedure = function( createData ) {
    var testProcChildren = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0TestProcedur;
    if( testProcChildren !== undefined && testProcChildren.length > 0 ) {
        createData.createObj = testProcChildren.join( ',' );
        createData.preferredType = 'IAV0TestStep';
        var typeFilterProcArray = [];
        for( var i = 0; i < testProcChildren.length; i++ ) {
            var typeFilterProcString = '';
            typeFilterProcString = typeFilterProcString.concat( testProcChildren[ i ] + 'Revision' );
            typeFilterProcArray.push( typeFilterProcString );
        }
        createData.typeFilter = typeFilterProcArray.join( ',' );
    } else {
        createData.createObj = 'IAV0TestCond,IAV0TestStep,IAV0MeasureReqmt';
        createData.preferredType = 'IAV0TestStep';
        createData.typeFilter = 'IAV0TestStepRevision,IAV0TestCondRevision,IAV0MeasureReqmtRevision';
    }
};

export let addChildToTestCase = function( createData ) {
    var testCaseChildren = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0TestCase;
    if( testCaseChildren !== undefined && testCaseChildren.length > 0 ) {
        createData.createObj = testCaseChildren.join( ',' );
        createData.preferredType = 'IAV0TestStep';
        var typeFilterProcArray = [];
        for( var i = 0; i < testCaseChildren.length; i++ ) {
            var typeFilterProcString = '';
            typeFilterProcString = typeFilterProcString.concat( testCaseChildren[ i ] + 'Revision' );
            typeFilterProcArray.push( typeFilterProcString );
        }
        createData.typeFilter = typeFilterProcArray.join( ',' );
    } else {
        createData.createObj = 'IAV0TestStep,IAV0TestCase';
        createData.preferredType = 'IAV0TestStep';
        createData.typeFilter = 'IAV0TestStepRevision,IAV0TestCaseRevision';
    }
};

export let addChildChildToTestProcedure = function( createData, subPanelSelection ) {
    if( subPanelSelection && subPanelSelection.selected && subPanelSelection.selected[ 0 ].props.awb0UnderlyingObject ) {
        if( subPanelSelection.selected[ 0 ].modelType.typeHierarchyArray.indexOf( 'Arm0ParagraphElement' ) === -1 ) {
            let selectedUnderlyingObj = cdm.getObject( subPanelSelection.selected[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] );
            var selectedUnderlyingType = selectedUnderlyingObj.type;
        } else if( subPanelSelection.selected[ 0 ].modelType.typeHierarchyArray.indexOf( 'Arm0ParagraphElement' ) > -1 ) {
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
    }
};

export let addChildChildToTestCase = function( createData, subPanelSelection ) {
    var testStepChildren = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0TestStep;
    var testCaseChildren = appCtxSvc.ctx.preferences.TCAllowedChildTypes_IAV0TestCase;
    if( subPanelSelection && subPanelSelection.selected && subPanelSelection.selected[ 0 ].type === 'Arm0ParagraphElement' ) {
        if( testStepChildren !== undefined && testStepChildren.length > 0 ) {
            createData.createObj = testStepChildren.join( ',' );
            createData.preferredType = 'IAV0TestStep';
            var typeFilterProcArray = [];
            for( var i = 0; i < testStepChildren.length; i++ ) {
                var typeFilterProcString = '';
                typeFilterProcString = typeFilterProcString.concat( testStepChildren[ i ] + 'Revision' );
                typeFilterProcArray.push( typeFilterProcString );
            }
            createData.typeFilter = typeFilterProcArray.join( ',' );
        } else {
            createData.createObj = 'IAV0TestStep';
            createData.preferredType = 'IAV0TestStep';
            createData.typeFilter = 'IAV0TestStepRevision';
        }
    } else if( subPanelSelection && subPanelSelection.selected && subPanelSelection.selected[ 0 ].type === 'Arm0RequirementElement' ) {
        if( testCaseChildren !== undefined && testCaseChildren.length > 0 ) {
            createData.createObj = testCaseChildren.join( ',' );
            createData.preferredType = 'IAV0TestStep';
            var typeFilterProcArray = [];
            for( var i = 0; i < testCaseChildren.length; i++ ) {
                var typeFilterProcString = '';
                typeFilterProcString = typeFilterProcString.concat( testCaseChildren[ i ] + 'Revision' );
                typeFilterProcArray.push( typeFilterProcString );
            }
            createData.typeFilter = typeFilterProcArray.join( ',' );
        } else {
            createData.createObj = 'IAV0TestStep,IAV0TestCase';
            createData.preferredType = 'IAV0TestStep';
            createData.typeFilter = 'IAV0TestStepRevision,IAV0TestCaseRevision';
        }
    }
};
export let getParentSelection = function( subPanelSelection, panelContext ) {
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
    var parentObj = getParentSelection( subPanelSelection, panelContext );
    if( commandId === 'IAV1AddContentToTPTable' || commandId === 'IAV1AddContentToTPTableAsSibling' ) {
        //If nothing is selected from table, then add TP
        //If TP is selected and add as a sibling, then add TP
        addTestProcedure( createData );
    } else if( ( commandId === 'IAV1AddContentToTPTableAsChild' || commandId === 'IAV1AddContentToTPTableAsSiblingSibling' ) &&
        parentObj && parentObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestProcedurRevision' ) > -1 ) {
        //If TP is selected and add as a child, then show all child types
        //If TP's 1st level child is selected and add as a sibling to it, then show all child types
        addChildToTestProcedure( createData );
    } else if( commandId === 'IAV1AddContentToTPTableAsSiblingSibling' && parentObj && parentObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestProcedurRevision' ) === -1 ||
        commandId === 'IAV1AddContentToTPTableAsChildChild' ) {
        //If TP's other than 1st level child is selected then only show selected type as create object
        addChildChildToTestProcedure( createData, subPanelSelection );
    } else if( commandId === 'IAV1AddContentToTestCaseTable' || commandId === 'IAV1AddContentToTestCaseTableAsSibling' ) {
        //If nothing is selected from table, then add TC
        //If TP is selected and add as a sibling, then add TC
        addTestCase( createData );
    } else if( ( commandId === 'IAV1AddContentToTestCaseTableAsChild' || commandId === 'IAV1AddContentToTestCaseTableAsSiblingSibling' ) &&
        parentObj && parentObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestCaseRevision' ) > -1 ) {
        //If TC is selected and add as a child, then show all child types
        //If TC's 1st level child is selected and add as a sibling to it, then show all child types
        addChildToTestCase( createData );
    } else if( commandId === 'IAV1AddContentToTestCaseTableAsSiblingSibling' && parentObj && parentObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestCaseRevision' ) === -1 ||
        commandId === 'IAV1AddContentToTestCaseTableAsChildChild' ) {
        //If TC's other than 1st level child is selected then only show selected type as create object
        addChildChildToTestCase( createData, subPanelSelection );
    }
    createData.commandId = commandId;
    return createData;
};
export let setObjToDisplayPanelForIssue = function( data ) {
    let cloneData = _.clone( data );
    cloneData.selectedType.dbValue = 'IssueReport';
    return cloneData;
};

export let childTypesforSectectedType = function( selectedUnderlyingType, childTypes, createData ) {
    var selectedItemType = selectedUnderlyingType.split( 'Revision' )[ 0 ];
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

export let unRegisterTMTPTableSelection = function() {
    appCtxSvc.unRegisterCtx( 'TR_TPTableSelection' );
    appCtxSvc.unRegisterCtx( 'TR_TMTableSelection' );
    appCtxSvc.unRegisterCtx( 'selectedVRProxyObjects' );

    appCtxSvc.unRegisterCtx( 'firstTimeTableLoadTPTable' );
};
export let getCreateInput = function( data, editHandler ) {
    var soaInput = {};
    var returnedinput = addObjectUtils.getCreateInput( data, '', data.selectedType.dbValue, editHandler );
    soaInput = returnedinput;
    return soaInput;
};
/**
 *
 * Opens the created issue
 *
 * @param {Object} vmo view Model Object
 */
export let openObject = function( uid ) {
    var stateSvc = AwStateService.instance;

    if( uid ) {
        var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
        var toParams = {};
        var options = {};

        toParams.uid = uid;

        options.inherit = false;

        stateSvc.go( showObject, toParams, options );
    }
};
/**
 * Return the selected object in the secondary work area table.
 * @param {Object} subPanelContext subPanelContext
 */

export let getObjectSelectedInTable = function( panelContext ) {
    let targetObj = [];
    let selObjs;
    // for overview
    if( panelContext && panelContext.dataProvider && panelContext.dataProvider.selectedObjects.length > 0 ) {
        selObjs = panelContext.dataProvider.selectedObjects;
    } else if( panelContext && panelContext.subPanelContext && panelContext.subPanelContext.selection.length > 0 ) {
        //for execute
        selObjs = panelContext.subPanelContext.selection;
    }
    if( selObjs && selObjs !== null ) {
        for( let i = 0; i < selObjs.length; i++ ) {
            let objUid;
            // for overview
            if( selObjs[ i ] && selObjs[ i ].props && selObjs[ i ].props.crt1UnderlyingObject.dbValue ) {
                objUid = selObjs[ i ].props.crt1UnderlyingObject.dbValue;
            } else if( selObjs[ i ] && selObjs[ i ].props && selObjs[ i ].props.crt1UnderlyingObject.dbValues ) {
                // for execute
                objUid = selObjs[ i ].props.crt1UnderlyingObject.dbValues;
            }
            let oUidObject = cdm.getObject( objUid );
            let vmoObj = viewModelObjectService.createViewModelObject( oUidObject );
            targetObj.push( vmoObj );
        }
    }
    var loadProps = false;
    for ( let j = 0; j < targetObj.length; j++ ) {
        if ( !targetObj[j].cellProperties ) {
            loadProps = true;
            break;
        }
    }
    if ( loadProps ) {
        var deferred = AwPromiseService.instance.defer();
        tcVmoService.getViewModelProperties( targetObj, [ 'awp0CellProperties', 'object_string' ] ).then( function( response ) {
            deferred.resolve( response );
        } );
        return deferred.promise;
    }
    return targetObj;
};
/**
 * @param {Object} subPanelContext subPanelContext
 */
export let addIssueToVRContent = function( issueObjs, subPanelContext, parentScopeObjects, action ) {
    if( issueObjs.length > 0 && issueObjs[ 0 ].uid ) {
        var _manageAction = action;
        var arContentObject;
        // get selection for overview
        if( parentScopeObjects && parentScopeObjects.dataProvider && parentScopeObjects.dataProvider.selectedObjects.length > 0 &&
            appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
            arContentObject = parentScopeObjects.dataProvider.selectedObjects;
        } else if( parentScopeObjects && parentScopeObjects.subPanelContext && parentScopeObjects.subPanelContext.selection.length > 0 ) {
            // get selection for execute
            arContentObject = parentScopeObjects.subPanelContext.selection;
        }
        var elementsToAdd = issueObjs;
        if( arContentObject && arContentObject !== null ) {
            var manageARInputForCreateVR = getManageARInputForAddIssue( arContentObject, _manageAction, elementsToAdd, subPanelContext );
            manageVerificationService.callManageVerificationSOA( manageARInputForCreateVR );
        }
    }
};
/**
 * @param {Object} subPanelContext subPanelContext
 */
export let addAttachmentToVRContent = function( subPanelContext, parentScopeObjects, action, eventMap ) {
    if( eventMap ) {
        var updated = eventMap[ 'cdm.updated' ];
        var _manageAction = action;
        var arContentObject;
        // get selection for overview
        if( parentScopeObjects && parentScopeObjects.dataProvider && parentScopeObjects.dataProvider.selectedObjects.length > 0 &&
            appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
            arContentObject = parentScopeObjects.dataProvider.selectedObjects;
        } else if( parentScopeObjects && parentScopeObjects.subPanelContext && parentScopeObjects.subPanelContext.selection.length > 0 ) {
            // get selection for execute
            arContentObject = parentScopeObjects.subPanelContext.selection;
        }
        var elementsToAdd = updated.updatedObjects;
        if( arContentObject && arContentObject !== null ) {
            if( elementsToAdd[ 0 ].modelType.typeHierarchyArray.indexOf( 'Dataset' ) > -1 ) {
                var manageARInputForCreateVR = getManageARInputForAddIssue( arContentObject, _manageAction, elementsToAdd, subPanelContext );
                manageVerificationService.callManageVerificationSOA( manageARInputForCreateVR );
            }
        }
    }
};
export let getManageARInputForAddIssue = function( arContentObject, _manageAction, elementsToAdd, subPanelContext ) {
    var elementInputs = [];
    var contextType = '';
    var contextUid = '';
    var ctx = appCtxSvc.ctx;
    let params = AwStateService.instance.params;
    for( var j = 0; j < arContentObject.length; j++ ) {
        for( var i = 0; i < elementsToAdd.length; i++ ) {
            var elementInput = {};
            elementInput.elementAction = '';
            elementInput.objectToAdd = {
                type: elementsToAdd[ i ].type,
                uid: elementsToAdd[ i ].uid
            };
            elementInput.objectToAddContext = '';
            elementInput.objectToAddParent = arContentObject[ j ];
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
    }
    var pref = {
        diagramAction: '',
        useClosureRule: false
    };
    var parentType;
    // parentType for overview.
    if( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.pselected && subPanelContext.selectionData.pselected.type &&
        appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
        parentType = subPanelContext.selectionData.pselected.type;
    } else if( ctx && ctx.vr_previousSelectionForExecute && ctx.vr_previousSelectionForExecute.type ) {
        // parentType for execute.
        parentType = ctx.vr_previousSelectionForExecute.type;
    } else if( params && params.pci_uid ) {
        // parentType if user refresh the execute sublocation.
        parentType = params.pci_uid;
    }
    var parentUid;
    // parentUid for overview.
    if( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.pselected && subPanelContext.selectionData.pselected.uid &&
        appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
        parentUid = subPanelContext.selectionData.pselected.uid;
    } else if( ctx && ctx.vr_previousSelectionForExecute && ctx.vr_previousSelectionForExecute.uid ) {
        // parentUid for execute.
        parentUid = ctx.vr_previousSelectionForExecute.uid;
    } else if( params && params.uid ) {
        // parentUid if user refresh the execute sublocation.
        parentUid = params.uid;
    }
    var input = [ {
        clientId: 'AW_AR_Client',
        verificationRequest: {
            type: parentType,
            uid: parentUid
        },
        data: [ {
            manageAction: _manageAction,
            elementInputs: elementInputs,
            recipeData: {
                recipe: '',
                seedObjects: '',
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
    manageARInputForCreateVR.oobj = arContentObject;
    return manageARInputForCreateVR;
};

/**

 * @param {Object} subPanelContext subPanelContext

 */

export let removeIssuesFromVRContent = function( issueObjs, subPanelContext, parentScopeObjects, action ) {
    if( issueObjs.length > 0 && issueObjs[ 0 ].uid ) {
        var _manageAction = action;
        var arContentObject;
        // get selection for overview.
        if( parentScopeObjects && parentScopeObjects.subPanelContext && parentScopeObjects.subPanelContext.treeNodeUid &&
            appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
            arContentObject = [ parentScopeObjects.subPanelContext.treeNodeUid ];
        } else if( parentScopeObjects && parentScopeObjects.subPanelContext && parentScopeObjects.subPanelContext.selection.length > 0 ) {
            // get selection for execute.
            arContentObject = [ parentScopeObjects.subPanelContext.selection[ 0 ] ];
        }
        var elementsToRemove = issueObjs;
        if( arContentObject && arContentObject !== null ) {
            var manageARInputForDeleteVR = getManageARInputForRemoveIssue( arContentObject, _manageAction, elementsToRemove, subPanelContext );
            manageVerificationService.callManageVerificationSOA( manageARInputForDeleteVR );
        }
    }
};

export let getManageARInputForRemoveIssue = function( arContentObject, _manageAction, elementsToRemove, subPanelContext ) {
    var elementInputs = [];
    var contextType = '';
    var contextUid = '';
    for( var j = 0; j < arContentObject.length; j++ ) {
        for( var i = 0; i < elementsToRemove.length; i++ ) {
            var elementInput = {};
            elementInput.elementAction = '';
            elementInput.objectToAdd = {
                type: elementsToRemove[ i ].type,
                uid: elementsToRemove[ i ].uid
            };
            elementInput.objectToAddContext = '';
            elementInput.objectToAddParent = arContentObject[ j ];
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
            if( elementsToRemove[ i ].props && elementsToRemove[ i ].props.object_string ) {
                if( elementsToRemove.length === 1 ) {
                    succMsg += elementsToRemove[ i ].props.object_string.dbValues[ 0 ];
                } else {
                    succMsg += elementsToRemove[ i ].props.object_string.dbValues[ 0 ] + ',';
                }
            }
        }
    }
    var pref = {
        diagramAction: '',
        useClosureRule: false
    };
    var input = [ {
        clientId: 'AW_AR_Client',
        verificationRequest: {
            type: _getParentInfo( subPanelContext ).parentType,
            uid: _getParentInfo( subPanelContext ).parentUid
        },
        data: [ {
            manageAction: _manageAction,
            elementInputs: elementInputs,
            recipeData: {
                recipe: '',
                seedObjects: '',
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
    manageARInputForCreateVR.oobj = arContentObject;
    return manageARInputForCreateVR;
};

/**

 * @param {Object} subPanelContext subPanelContext

 */

export let removeAttchmentsFromVRContent = function( issueObjs, subPanelContext, parentScopeObjects, action ) {
    if( issueObjs.length > 0 && issueObjs[ 0 ].uid ) {
        var _manageAction = action;

        var arContentObject;
        // get selection for overview
        if( parentScopeObjects && parentScopeObjects.subPanelContext && parentScopeObjects.subPanelContext.treeNodeUid &&
            appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
            arContentObject = [ parentScopeObjects.subPanelContext.treeNodeUid ];
        } else if( parentScopeObjects && parentScopeObjects.subPanelContext && parentScopeObjects.subPanelContext.selection.length > 0 ) {
            // get selection for execute
            arContentObject = [ parentScopeObjects.subPanelContext.selection[ 0 ] ];
        }

        var elementsToRemove = issueObjs;
        if( arContentObject && arContentObject !== null ) {
            var manageARInputForDeleteVR = getManageARInputForRemoveAttachment( arContentObject, _manageAction, elementsToRemove, subPanelContext );
            manageVerificationService.callManageVerificationSOA( manageARInputForDeleteVR );
        }
    }
};

export let getManageARInputForRemoveAttachment = function( arContentObject, _manageAction, elementsToRemove, subPanelContext ) {
    var elementInputs = [];
    var contextType = '';
    var contextUid = '';
    for( var j = 0; j < arContentObject.length; j++ ) {
        for( var i = 0; i < elementsToRemove.length; i++ ) {
            var elementInput = {};
            elementInput.elementAction = '';
            elementInput.objectToAdd = {
                type: elementsToRemove[ i ].type,
                uid: elementsToRemove[ i ].uid
            };
            elementInput.objectToAddContext = '';
            elementInput.objectToAddParent = arContentObject[ j ];
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
            if( elementsToRemove[ i ].props && elementsToRemove[ i ].props.object_string ) {
                if( elementsToRemove.length === 1 ) {
                    succMsg += elementsToRemove[ i ].props.object_string.dbValues[ 0 ];
                } else {
                    succMsg += elementsToRemove[ i ].props.object_string.dbValues[ 0 ] + ',';
                }
            }
        }
    }
    var pref = {
        diagramAction: '',
        useClosureRule: false
    };
    var input = [ {
        clientId: 'AW_AR_Client',
        verificationRequest: {
            type: _getParentInfo( subPanelContext ).parentType,
            uid: _getParentInfo( subPanelContext ).parentUid
        },
        data: [ {
            manageAction: _manageAction,
            elementInputs: elementInputs,
            recipeData: {
                recipe: '',
                seedObjects: '',
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
    manageARInputForCreateVR.oobj = arContentObject;
    return manageARInputForCreateVR;
};

export default exports = {
    setObjToDisplayPanel,
    setCommandId,
    unRegisterTMTPTableSelection,
    setPanelPinnedState,
    childTypesforSectectedType,
    getParentSelection,
    addTestProcedure,
    addTestCase,
    addChildToTestProcedure,
    addChildToTestCase,
    addChildChildToTestProcedure,
    addChildChildToTestCase,
    setObjToDisplayPanelForIssue,
    getCreateInput,
    openObject,
    getObjectSelectedInTable,
    addIssueToVRContent,
    addAttachmentToVRContent,
    removeIssuesFromVRContent,
    getManageARInputForRemoveIssue,
    removeAttchmentsFromVRContent,
    getManageARInputForRemoveAttachment
};
