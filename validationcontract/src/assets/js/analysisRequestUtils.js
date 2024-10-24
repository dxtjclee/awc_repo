// Copyright (c) 2022 Siemens

/**
 * @module js/analysisRequestUtils
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import mesgSvc from 'js/messagingService';
import addRemoveFromAR from 'js/addRemoveFromAR';
import createAnalysisRequest from 'js/createAnalysisRequest';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import cmm from 'soa/kernel/clientMetaModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import AwStateService from 'js/awStateService';
import manageVerificationService from 'js/manageVerificationService';
import pasteSvc from 'js/pasteService';

var exports = {};

var defaultExcelTemplate = null;
var _onOccDataLoadedEventListener = null;

var _onRegisterMselectedChangeEventListener = null;
var _onOccMgmtUnloadedEventListener = null;

var proxyMeasurableAttrs = [];
var Normal_Add = 'NormalAddParameters';
var Quick_Add = 'QuickAddParameters';
var createdParam = [];


var _handlePartialErrorForDiagram = function( response, data ) {
    var responseString = [];
    if ( response.cause && response.cause.partialErrors ) {
        _.forEach( response.cause.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( errValue ) {
                responseString.push( errValue.message );
            } );
        } );

        if ( responseString.length > 0 ) {
            var arName = data.createdObject.props.object_string.dbValues[0];

            var msg = data.i18n.AddObjectsForValidationFromDiagramWarning.replace( '{0}', arName );

            var errorString = msg + ' ' + responseString.join( '' );

            mesgSvc.showError( errorString );
        }
    }
};

var _exportARToExcel = function( selectedARs ) {
    if ( selectedARs ) {
        soaSvc.post( 'Internal-AWS2-2016-12-RequirementsManagement', 'exportToApplication2', {
            input: [ {
                templateName: defaultExcelTemplate,
                applicationFormat: 'MSExcelLiveBulkMode',
                objectsToExport: selectedARs,
                targetObjectsToExport: [],
                exportOptions: [],
                attributesToExport: null
            } ]
        } ).then( function( response ) {
            fmsUtils.openFile( response.transientFileReadTickets[0] );
        }, function() {
            // ignore any error
        } );
    }
};

var _isInstanceOf = function( typeName, modelType ) {
    var notNullCheck = typeName !== null && modelType !== null;

    if ( notNullCheck &&
        ( typeName === modelType.name || modelType.typeHierarchyArray &&
            modelType.typeHierarchyArray.indexOf( typeName ) > -1 ) ) {
        return true;
    }
    return false;
};

/**
 *
 * Opens the created object (AR)
 *
 * @param {Object} vmo view Model Object
 */
export let openObject = function( vmo ) {
    var stateSvc = AwStateService.instance;

    if ( vmo && vmo.uid ) {
        var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
        var toParams = {};
        var options = {};

        toParams.uid = vmo.uid;

        options.inherit = false;

        stateSvc.go( showObject, toParams, options );
    }
};

/**
 * Populates the SavedBookmark on AR create panel
 *
 * @param {Object} data data
 */
export let populateSavedBookmark = function( data ) {
    var domain = null;
    var context = appCtxSvc.getCtx( 'aceActiveContext.context' );
    if ( context && context.productContextInfo ) {
        if ( context.productContextInfo.props.awb0ContextObject.dbValues[0] ) {
            domain = context.productContextInfo.props.awb0ContextObject.dbValues[0];
        } else {
            domain = context.productContextInfo.props.awb0Product.dbValues[0];
        }
    } else {
        //Check the object selected in Home Folder is of type 'Ase0Diagram' and set the context
        var stateSvc = AwStateService.instance;
        var selectedObj = cdm.getObject( stateSvc.params.s_uid );
        if ( selectedObj && _isInstanceOf( 'Awb0SavedBookmark', selectedObj.modelType ) ) {
            domain = selectedObj.uid;
        }
    }
    return { domainUid: domain };
};

/**
 * Post processes the created AR.
 *
 * @param {Object} data createdAR
 */
export let setCCObjectForVR = function( createdAR ) {
    var parammgmtctx = appCtxSvc.getCtx( 'parammgmtctx', parammgmtctx );

    if ( parammgmtctx &&
        appCtxSvc.ctx.locationContext['ActiveWorkspace:SubLocation'] === 'com.siemens.splm.client.attrtarget.paramProjectSubLocation' ) {
        var configurationContextObject = null;
        var paramProject = null;
        configurationContextObject = cdm.getObject( _.get( createdAR, 'props.Att0HasConfigurationContext.dbValues[0]', undefined ) );
        paramProject = cdm.getObject( createdAR.props.crt0Domain.dbValues[0] );
        paramProject = cdm.getObject( paramProject.uid );
        parammgmtctx.ConfigurationContext = configurationContextObject;
        parammgmtctx.paramProject = paramProject;
        if ( paramProject && paramProject.props && paramProject.props.Att0HasVariantConfigContext ) {
            _.set( appCtxSvc, 'ctx.parammgmtctx.hasVariantConfigContext', true );
            eventBus.publish( 'Att1FullScreenConfiguratorTab.contentLoaded' );
        }
    }
};

/**
 * Post processes the created AR.
 *
 * @param {Object} data data
 */
export let processCreatedObject = function( data, subPanelContext ) {
    var createdAR = data.createdObject;
    if ( createdAR ) {
        var eventData = {
            createdObject: data.createdObject
        };
        eventBus.publish( 'swc.objectCreated', eventData );
        var openObject = null;
        var elementsToAdd = [];
        var invalidObjects = [];
        var allSelection = [];
        if ( subPanelContext.openedObject !== undefined && subPanelContext.openedObject !== null ) {
            openObject = subPanelContext.openedObject;
        }

        if (   openObject !== null && openObject.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1  ) {
            //If open object is not null and if open object is  old parameter project
            addParameterProjectToVR( createdAR, subPanelContext );
        } else {
            var seedObjects = [];
            var manageVRInputinfo = {};
            var _manageAction = 'addObject';
            if(   openObject !== null && openObject.modelType.typeHierarchyArray.indexOf( 'Fnd0SearchRecipe' ) > -1  ||
                  subPanelContext.selectionData && subPanelContext.selectionData.pselected &&  cmm.isInstanceOf( 'Folder', subPanelContext.selectionData.pselected.modelType ) &&
                 subPanelContext.selectionData.selected.length > 0 && subPanelContext.selectionData.selected[0].modelType.typeHierarchyArray.indexOf( 'Fnd0SearchRecipe' ) > -1  ) {
                //If open object is not null and if open object is recipe object OR
                //Receipe Object is selected from Home folder though use does not making sense to me.
                manageVRInputinfo = getObjectsToAddInReceipeAsRoot();
            } else if( subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 && subPanelContext.selectionData.selected[0].modelType &&
                subPanelContext.selectionData.selected[0].modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
                // If open object is new parameter project and Att1AttributeAlignmentProxy are selected from SWA
                // get all source elements to add from Att1AttributeAlignmentProxy
                manageVRInputinfo = getsourceElementsToAddFromAtt1Proxy( subPanelContext.selectionData.selected );
            } else {
                if ( subPanelContext.selectionData.selected !== undefined ) {
                    allSelection = subPanelContext.selectionData.selected;
                } else {
                    allSelection = appCtxSvc.getCtx( 'mselected' );
                }
                filterInvalidSelection( allSelection, invalidObjects, elementsToAdd );
                manageVRInputinfo.objectToAdd = elementsToAdd;
                var recipe;
                if( data.createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues.crt0Recipe ) {
                    recipe = data.createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues.crt0Recipe[ 0 ];
                }else if ( data.xrtState && data.xrtState.xrtVMO && data.xrtState.xrtVMO.props && data.xrtState.xrtVMO.props['REF(revision,Crt0TestRevisionCreI).crt0Recipe'] && data.xrtState.xrtVMO.props['REF(revision,Crt0TestRevisionCreI).crt0Recipe'].dbValue ) {
                    recipe = data.xrtState.xrtVMO.props['REF(revision,Crt0TestRevisionCreI).crt0Recipe'].dbValue;
                }
                manageVRInputinfo.reciepeUid = recipe;
            }
            var getManageVRInputToAddToContentsTable;
            getManageVRInputToAddToContentsTable = createAnalysisRequest.getManageARInputForCreateVR( createdAR, _manageAction, manageVRInputinfo.objectToAdd, manageVRInputinfo.reciepeUid, seedObjects );
            getManageVRInputToAddToContentsTable.manageARElements = elementsToAdd;
            getManageVRInputToAddToContentsTable.allManageARElements = allSelection;
            getManageVRInputToAddToContentsTable.invalidObjects = invalidObjects;
            manageVerificationService.callManageVerificationSOA( getManageVRInputToAddToContentsTable, data.i18n );
        }
        //Open newly created AR
        if ( subPanelContext && subPanelContext.panelPinned ) {
            pasteObjbyLocation( createdAR, subPanelContext );
            //If panel is pinned then load next values
            eventBus.publish( 'awPanel.loadNextValues' );
        } else if ( subPanelContext && !subPanelContext.panelPinned && data.openOnCreate.dbValue === false ) {
            pasteObjbyLocation( createdAR, subPanelContext );
        } else {
            exports.openObject( createdAR );
        }
    }
};

/*
    This function will be called to get the valid source element for given input Att1AttributeAlignmentProxy
*/
var getsourceElementsToAddFromAtt1Proxy = function( att1Proxies ) {
    var selectedObjects = [];
    var reciepeUid;
    for( var idx = 0; idx < att1Proxies.length; idx++ ) {
        var selectedElementUid = att1Proxies[idx].props.att1SourceElement.dbValues[ 0 ];
        var selectedElement = cdm.getObject( selectedElementUid );
        if( selectedElement.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            selectedObjects.push( selectedElement );
        }
    }
    var manageVRInputinfo = {};
    manageVRInputinfo.objectToAdd = selectedObjects;
    manageVRInputinfo.reciepeUid = '';
    return manageVRInputinfo;
};

/*
    This function will be called to validate the objects that are getting added to VR before manageVerification soa call
*/
var filterInvalidSelection = function( allSelection,   invalidObjects, elementsToAdd   ) {
    var restrictedTypes = appCtxSvc.ctx.preferences.PLE_AddObjectsNotAllowedTypes;
    if ( restrictedTypes !== undefined && restrictedTypes.length > 0 ) {
        for ( var i = 0; i < allSelection.length; i++ ) {
            // When It is case of multi select and create VR - Intension is to add selected into VR and folder will be processed for invalid objects checks
            // When It is case of single select and create VR - Intension is to create VR into folder , valid use case, so folder will not be processed.
            // Please note - Create test is not visible when folder object is selected.
            if ( !( allSelection.length === 1 && cmm.isInstanceOf( 'Folder', allSelection[i].modelType ) ) ) {
                var isInvalidObj = false;
                for ( var j = 0; j < restrictedTypes.length; j++ ) {
                    if ( allSelection[i].modelType.typeHierarchyArray.indexOf( restrictedTypes[j] ) > -1 ) {
                        isInvalidObj = true;
                        invalidObjects.push( allSelection[i] );
                    }
                }
                if ( isInvalidObj === false ) {
                    elementsToAdd.push( allSelection[i] );
                }
            }
        }
    } else {
        elementsToAdd = allSelection;
    }
};

/*
    This function will be called when recipe is open or selected in home folder and user is trying to create VR from its PWA selection
*/
var getObjectsToAddInReceipeAsRoot = function() {
    var selectedObjects = [];
    var reciepeUid;
    for( var j = 0; j < appCtxSvc.ctx.mselected.length; j++ ) {
        if( appCtxSvc.ctx.mselected[ j ].type === 'Evm1RecipeResultProxy' ) {
            // on reciepe page result object are selected
            var targetObj = cdm.getObject( appCtxSvc.ctx.mselected[ j ].props.evm1SourceObject.dbValues[ 0 ] );
            if( targetObj.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                selectedObjects.push( targetObj );
            }
        } else if( appCtxSvc.ctx.mselected[ j ].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            // on reciepe page seed object is selected
            selectedObjects.push( appCtxSvc.ctx.mselected[ j ] );
        } else if ( appCtxSvc.ctx.mselected[ j ].modelType.typeHierarchyArray.indexOf( 'Fnd0SearchRecipe' ) > -1 &&
             appCtxSvc.ctx.panelContext !== undefined && appCtxSvc.ctx.panelContext.recipeState !== undefined &&
             appCtxSvc.ctx.panelContext.recipeState.seedSelections !== undefined && appCtxSvc.ctx.panelContext.recipeState.seedSelections.length > 0 ) {
            // when nothing is selected, top recipe is selected, we need to push all seed objects and recipe name in return
            // In this case server will execute the given recipe on all seeds from table and add all results to VR
            reciepeUid = appCtxSvc.ctx.selected.uid;
            selectedObjects = appCtxSvc.ctx.panelContext.recipeState.seedSelections;
        }
    }
    var manageVRInputinfo = {};
    manageVRInputinfo.objectToAdd = selectedObjects;
    manageVRInputinfo.reciepeUid = reciepeUid;
    return manageVRInputinfo;
};

/*
    This function will be called when old parameter project is open in its own sub location and user is trying to create VR from its PWA selection.
 */
var addParameterProjectToVR = function( createdAR, subPanelContext ) {
    var inputs = [];
    var parentElementObj = null;
    var inputPara = [];

    if ( subPanelContext.selectionData && subPanelContext.selectionData.selected !== undefined ) {
        var selectedProxyParams = [];
        selectedProxyParams = subPanelContext.selectionData.selected;
        for ( var idx = 0; idx < selectedProxyParams.length; idx++ ) {
            // User has selected prameter group or Parameter proxy from PWA.
            if ( selectedProxyParams[idx].type === 'Att1AttributeAlignmentProxy' ) {
                var selected = {
                    uid: selectedProxyParams[idx].uid,
                    type: selectedProxyParams[idx].type
                };
                inputPara.push( selected );
            }
        }
        if ( inputPara.length === 0 && selectedProxyParams[0].modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 && subPanelContext.parameterState
        && subPanelContext.parameterState.swaSelectedObjects !== undefined ) {
            // User has open legacy parameter project and selected parameters from SWA. setMeasurableAttrDirection SOA need proxy.
            // so take up proxy from parameterState.swaSelectedObjects, populated from parameter team for this VR use case
            var swaSelectedObjects = subPanelContext.parameterState.swaSelectedObjects;
            for ( var idx = 0; idx < swaSelectedObjects.length; idx++ ) {
                if ( swaSelectedObjects[idx].type === 'Att1AttributeAlignmentProxy' ) {
                    var selected = {
                        uid: swaSelectedObjects[idx].uid,
                        type: swaSelectedObjects[idx].type
                    };
                    inputPara.push( selected );
                }
            }
        }
    }

    // If nothing is selected, then simple call setdirection. All param withing parameter project will get added to VR
    // that is nothing selected then server only needs VR as input
    // nothing needed in data.attrs
    inputs.push( {
        clientId: 'Input',
        analysisRequest: {
            uid: createdAR.uid,
            type: createdAR.type
        },
        data: [ {
            parentElement: parentElementObj,
            attrs: inputPara,
            direction: 'input'
        } ]
    } );
    var input = {
        input: inputs
    };
    soaSvc.post( 'Internal-ValidationContractAW-2018-12-VCManagement', 'setMeasurableAttrDirection', input ).then(
        function() { } );
};

export let setVRCreatedmessage = function( data, subPanelContext ) {
    let createdAR = data.createdObject;
    let vrname = createdAR.props.object_name.dbValues[0];
    let locationContextObject = subPanelContext.baseSelection;
    let msgstr = '';
    if( locationContextObject && ( locationContextObject.type === 'Fnd0HomeFolder' || locationContextObject.type === 'Folder' ) ) {
        let folderObject = cdm.getObject( locationContextObject.uid );
        let foldername = folderObject.props.object_name.dbValues[0];
        msgstr = data.i18n.dialogMessage.replace( '{0}', vrname ).replace( '{1}', foldername );
    } else{
        msgstr = data.i18n.dialogMessage.replace( '{0}', vrname ).replace( '{1}', 'Newstuff' );
    }
    return msgstr;
};

var pasteObjbyLocation = function( createdAR, subPanelContext ) {
    var locationContextObject = subPanelContext.baseSelection;
    if( locationContextObject && ( locationContextObject.type === 'Fnd0HomeFolder' || locationContextObject.type === 'Folder' ) ) {
        let folderObject = cdm.getObject( locationContextObject.uid );
        pasteObj( folderObject, [ createdAR ], subPanelContext );
    } else {
        var user  = appCtxSvc.ctx.user;
        dmSvc.getPropertiesUnchecked( [ user ], [ 'newstuff_folder' ] ).then( function( response ) {
            let obj = response.plain[0];
            let userWithNS = response.modelObjects[obj];
            let newStuffObj = response.modelObjects[userWithNS.props.newstuff_folder.dbValues[0]];
            pasteObj( response.modelObjects[newStuffObj.uid], [ createdAR ], subPanelContext );
        } );
    }
};
var pasteObj = function( target, objects, subPanelContext ) {
    if ( target && objects.length > 0 ) {
        pasteSvc.execute( target, objects, '' ).then( function() {
            if( subPanelContext && subPanelContext.pageContext && subPanelContext.pageContext.secondaryActiveTabId && subPanelContext.pageContext.secondaryActiveTabId === 'web_whereused'
            && (subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0)){
                eventBus.publish( 'cdm.relatedModified', {
                    relatedModified: [ subPanelContext.selectionData.selected[0] ]
                } );
            }else if( subPanelContext && subPanelContext.pageContext && subPanelContext.pageContext.secondaryActiveTabId && subPanelContext.pageContext.secondaryActiveTabId === 'Crt1ShowPlanTable'){
                eventBus.publish( 'refreshSWATreeTable' );
            }else{
                eventBus.publish( 'cdm.relatedModified', {
                    relatedModified: [ target ]
                } );
            }
        } );
    }
};

var _setCriteriaType = function( openedObj, recipe ) {
    var isARType = cmm.isInstanceOf( 'Crt0VldnContractRevision', openedObj.modelType );
    var isStudyType = cmm.isInstanceOf( 'Crt0StudyRevision', openedObj.modelType );
    if ( isARType || isStudyType ) {
        recipe.criteriaType = 'showAllobjects';
        return;
    }
};

var _performOccurenceFilterOperation = function() {
    var stateSvc = AwStateService.instance;
    var recipe = {};

    var filterString = appCtxSvc.ctx.occmgmtContext.requestPref.criteriaType;
    appCtxSvc.registerCtx( 'vldnContract.isFilterClicked', true );
    if ( filterString === undefined || filterString === null ||
        filterString === 'IncludeNonMatchedValidationLink' || filterString === 'showAllobjects' ) {
        recipe.criteriaType = 'ExcludeNonMatchedValidationLink';
        appCtxSvc.registerCtx( 'selectFilter', true );
    } else if ( filterString === 'ExcludeNonMatchedValidationLink' ) {
        var openedObj = cdm.getObject( stateSvc.params.uid );
        _setCriteriaType( openedObj, recipe );
        appCtxSvc.registerCtx( 'selectFilter', false );
    }
    appCtxSvc.ctx.occmgmtContext.requestPref.criteriaType = recipe.criteriaType;
    eventBus.publish( 'acePwa.reset', {
        retainTreeExpansionStates: true
    } );
    eventBus.publish( 'primaryWorkarea.reset' );

    _onOccDataLoadedEventListener = eventBus.subscribe( 'occDataLoadedEvent', function() {
        _refreshDiagram();
    }, 'analysisRequestUtils' );

    eventBus.publish( 'occurrenceManagementConfigurationChangeEvent' );
};

/**
 * AR Occurrence Filter Toggle
 */
export let arOccurenceFilter = function() {
    _performOccurenceFilterOperation();
};

/**
 * Notify the diagram to refresh after the AR Filter gets clicked
 */
function _refreshDiagram() {
    if ( appCtxSvc.getCtx( 'vldnContract.isFilterClicked' ) === true ) {
        eventBus.publish( 'architectureModeler.Refresh' );
        appCtxSvc.updatePartialCtx( 'vldnContract.isFilterClicked', false );
        eventBus.unsubscribe( _onOccDataLoadedEventListener );
    }
}

/**
 * Study Occurrence Filter Toggle
 */
export let studyOccurenceFilter = function() {
    _performOccurenceFilterOperation();
};

var evaluateARVisibility = function( oobj, mselected ) {
    var selectedObjs = [];
    var inputRevs = [];
    var input2 = null;
    inputRevs[0] = cdm.getObject( oobj.props.crt0Configuration.dbValues[0] );
    input2 = {
        inputs: inputRevs
    };
    appCtxSvc.updateCtx( 'removeFromARVisibility', true );
    setVisibility( input2, mselected, 'addToARVisibility', inputRevs );
    for ( var i = 0; i < mselected.length; i++ ) {
        if ( mselected[i] && cmm.isInstanceOf( 'Awb0Element', mselected[i].modelType ) ) {
            selectedObjs.push( mselected[i] );
        }
    }
    getTraceLinks( oobj, selectedObjs );
};

var evaluateStudyVisibility = function( oobj, mselected ) {
    var selectedObjs = [];
    var inputRevs = [];
    var input2 = null;
    inputRevs[0] = cdm.getObject( oobj.props.crt0Configuration.dbValues[0] );
    input2 = {
        inputs: inputRevs
    };
    appCtxSvc.updateCtx( 'removeFromStudyVisibility', true );
    setVisibility( input2, mselected, 'addToStudyVisibility', inputRevs );
    for ( var i = 0; i < mselected.length; i++ ) {
        if ( mselected[i] && cmm.isInstanceOf( 'Awb0Element', mselected[i].modelType ) ) {
            selectedObjs.push( mselected[i] );
        }
    }
    getTraceLinks( oobj, selectedObjs );
};

var evaluateVisibility = function() {
    appCtxSvc.unRegisterCtx( 'addToARVisibility' );
    appCtxSvc.unRegisterCtx( 'addToStudyVisibility' );
    appCtxSvc.unRegisterCtx( 'removeFromARVisibility' );
    appCtxSvc.unRegisterCtx( 'removeFromStudyVisibility' );
    appCtxSvc.unRegisterCtx( 'validObjects' );
    var selected = appCtxSvc.getCtx( 'selected' );
    var mselected = appCtxSvc.getCtx( 'mselected' );
    var state = appCtxSvc.getCtx( 'state' );
    var primaryXrtPageID = appCtxSvc.getCtx( 'xrtPageContext.primaryXrtPageID' );
    dmSvc.getProperties( [ state.params.uid ], [ 'crt0Configuration' ] );
    var oobj = cdm.getObject( state.params.uid );
    appCtxSvc.registerCtx( 'addToARVisibility', false );
    appCtxSvc.registerCtx( 'addToStudyVisibility', false );
    appCtxSvc.registerCtx( 'removeFromARVisibility', false );
    appCtxSvc.registerCtx( 'removeFromStudyVisibility', false );
    appCtxSvc.registerCtx( 'validObjects', null );
    var check = mselected !== null && primaryXrtPageID === 'tc_xrt_Content' && oobj.uid !== selected.uid &&
        oobj.props.crt0Configuration;
    if ( check ) {
        if ( oobj.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 &&
            oobj.modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) === -1 ) {
            evaluateARVisibility( oobj, mselected );
        } else if ( oobj.modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) > -1 ) {
            evaluateStudyVisibility( oobj, mselected );
        }
    }
};
/**
 * Check if the element is added to AR
 *
 * @param {Object} vmo the view model
 * @Returns {boolean} elementAddedtoAR
 */
export let isElementAddedToAR = function( vmo ) {
    if ( _isAROrStudyOpenInACE() ) {
        appCtxSvc.updatePartialCtx( 'decoratorToggle', true );

        appCtxSvc.updatePartialCtx( 'archDiagramExtraProperties.Crt0VldnContractRevision',
            'crt1AddedToAnalysisRequest' );

        if ( appCtxSvc.ctx.subscribeToRegisterMselected === undefined ) {
            _onRegisterMselectedChangeEventListener = eventBus.subscribe( 'appCtx.register', function(
                eventData ) {
                if ( ( eventData.name === 'mselected' ||
                    eventData.name === 'openedARObject' && appCtxSvc.ctx.state && appCtxSvc.ctx.state.processed && appCtxSvc.ctx.state.processed.pageId && appCtxSvc.ctx.state.processed
                        .pageId === 'tc_xrt_Content' ) &&
                    appCtxSvc.ctx.subscribeToRegisterMselected === true ) {
                    _onRegisterMselected();
                }
            }, 'analysisRequestUtils' );
            appCtxSvc.updatePartialCtx( 'subscribeToRegisterMselected', true );
        }
        if ( appCtxSvc.ctx.subscribeToContentUnloaded === undefined ) {
            _onOccMgmtUnloadedEventListener = eventBus.subscribe( 'occurrenceManagement.contentUnloaded',
                function() {
                    if ( appCtxSvc.ctx.subscribeToContentUnloaded === true ) {
                        _unregisterPropPolicies();
                    }
                }, 'analysisRequestUtils' );
            appCtxSvc.updatePartialCtx( 'subscribeToContentUnloaded', true );
        }
        //register variable to avoid repeated calls to functions _autoAddChildToVR & _autoAddSiblingToVR
        appCtxSvc.registerCtx( 'elementAddedToVR', false );

        //subscribe event as it is fired by ACE
        eventBus.subscribe( 'addElement.elementsAdded',
            function( eventData ) {
                if ( appCtxSvc.ctx.aceActiveContext.context && appCtxSvc.ctx.openedARObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 &&
                    appCtxSvc.ctx.elementAddedToVR === false ) {
                    _autoAddChildToVR( eventData );
                }
            }, 'analysisRequestUtils' );
        //subscribe event as it is fired by ACE
        eventBus.subscribe( 'uniformParamTable.updateMeasurementsIfUpdated',
            function( eventData ) {
                if ( eventData.scope && eventData.scope.subPanelContext && eventData.scope.subPanelContext.parametersTable.openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 &&
                    appCtxSvc.ctx.elementAddedToVR === false ) {
                    _reloadTable( eventData );
                }
            }, 'analysisRequestUtils' );

        //subscribe event as it is fired by ACE
        eventBus.subscribe( 'aceLoadAndSelectProvidedObjectInTree',
            function( eventData ) {
                if ( appCtxSvc.ctx.aceActiveContext.context && appCtxSvc.ctx.openedARObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 &&
                    appCtxSvc.ctx.elementAddedToVR === false ) {
                    _autoAddSiblingToVR( eventData );
                }
            }, 'analysisRequestUtils' );
        appCtxSvc.registerCtx( 'addPramaterForVR', true );
        createdParam = [];
        //subscribe event as if parameter added by normal add
        eventBus.subscribe( 'att1AddParameter.setItemEventProgressing',
            function( eventData ) {
                if (  eventData.scope && eventData.scope.subPanelContext &&
                    eventData.scope.subPanelContext.openedObject && eventData.scope.subPanelContext.openedObject.modelType
                     && eventData.scope.subPanelContext.openedObject.modelType.typeHierarchyArray && eventData.scope.subPanelContext.openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 ) {
                    exports.setInputDirectionForParamterObj( eventData, 'Att1ShowAttrProxyTable.refreshTable', Normal_Add );
                }
            }, 'analysisRequestUtils' );
        //subscribe event as if parameter added by quick add
        eventBus.subscribe( 'Att1InlineAuthoring.removeEditHandler',
            function( eventData ) {
                if ( eventData.scope && eventData.scope.subPanelContext.context &&
                    eventData.scope.subPanelContext.context.openedObject && eventData.scope.subPanelContext.context.openedObject.modelType
                    && eventData.scope.subPanelContext.context.openedObject.modelType.typeHierarchyArray && eventData.scope.subPanelContext.context.openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 ) {
                    exports.setInputDirectionForParamterObj( eventData, 'Att1ShowAttrProxyTable.refreshTable', Quick_Add );
                }
            }, 'analysisRequestUtils' );
        if ( vmo && vmo.props && vmo.props.crt1AddedToAnalysisRequest &&
            vmo.props.crt1AddedToAnalysisRequest.dbValues[0] === '1' ) {
            return true;
        }
    }

    return false;
};

/**
 * Check if the element is outside VR then return true, This function is used in decorator.json to apply empty decorators
 *
 * @param {Object} vmo the view model
 * @Returns {boolean} isElementOutsideVR
 */
export let isElementOutsideVR = function( vmo ) {
    if ( _isAROrStudyOpenInACE() ) {
        appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
        if ( vmo && vmo.props && vmo.props.crt1AddedToAnalysisRequest &&
            vmo.props.crt1AddedToAnalysisRequest.dbValues[0] === '0' ) {
            // This Element is out side VR so return true so decorators process will apply nothing.
            return true;
        }
    }
    return false;
};

/**
 * Set input direction for the paramter added in VR
 */
export let setInputDirectionForParamterObj = function( eventData, refreshEvent, paramPanelType ) {
    appCtxSvc.registerCtx( 'addPramaterForVR', false );
    proxyMeasurableAttrs = [];
    if( eventData && eventData.scope && eventData.scope.data && eventData.scope.data.createdObject &&
        eventData.scope.data.createdObject.outputs && eventData.scope.data.createdObject.outputs[0] &&
        eventData.scope.data.createdObject.outputs[0].createdParams && eventData.scope.data.createdObject.outputs[0].createdParams &&
        eventData.scope.data.createdObject.outputs[0].createdParams.length > 1 ) {
        for( var i = 0; i < eventData.scope.data.createdObject.outputs[0].createdParams.length; i++ ) {
            proxyMeasurableAttrs.push( eventData.scope.data.createdObject.outputs[0].createdParams[i].parameter );
        }
    } else if ( eventData && eventData.scope && eventData.scope.data && eventData.scope.data.createdObject &&
        eventData.scope.data.createdObject.outputs && eventData.scope.data.createdObject.outputs[0] &&
        eventData.scope.data.createdObject.outputs[0].createdParams && eventData.scope.data.createdObject.outputs[0].createdParams[0] &&
        eventData.scope.data.createdObject.outputs[0].createdParams[0].parameter ) {
        proxyMeasurableAttrs.push( eventData.scope.data.createdObject.outputs[0].createdParams[0].parameter );
    } else if ( eventData && eventData.scope && eventData.scope.fields && eventData.scope.fields.addPanelState &&
        eventData.scope.fields.addPanelState.sourceObjects && eventData.scope.fields.addPanelState.sourceObjects.length > 0 ) {
        for ( var i = 0; i < eventData.scope.fields.addPanelState.sourceObjects.length; ++i ) {
            if ( eventData.scope.fields.addPanelState.sourceObjects[i].modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
                proxyMeasurableAttrs.push( eventData.scope.fields.addPanelState.sourceObjects[i] );
            }
        }
    } else if( eventData && eventData.scope && eventData.scope.data && eventData.scope.data.createdObject ) {
        proxyMeasurableAttrs = eventData.scope.data.createdObject;
    } else {
        return;
    }
    if( proxyMeasurableAttrs.length > 0 && createdParam.length > 0 ) {
        let isElemFound = false;
        for ( let idx = 0; idx < proxyMeasurableAttrs.length; idx++ ) {
            for( let j = 0; j < createdParam.length; j++ ) {
                if ( proxyMeasurableAttrs[idx].uid !== createdParam[j].uid ) {
                    isElemFound = false;
                } else{
                    isElemFound = true;
                    break;
                }
            }
        }
        if( isElemFound === false ) {
            createdParam = [];
        }else{
            return;
        }
    }
    for( let x = 0; x < proxyMeasurableAttrs.length; x++ ) {
        createdParam.push( proxyMeasurableAttrs[x] );
    }
    var parameterInfo = {
        panelId: '',  //panelId will act as a key to differentiate flow of quick add and normal add in prepareInputForSOA fucntion.
        createdParams:[]  //CreatedParameter will have a parameter direction variable which will be used when flow is from quick add else
        //direction from preference  value will be used.
    };
    //when below code should hit,When parameter is added using normal add parameters panel.
    if( paramPanelType === Normal_Add ) {
        parameterInfo.panelId = Normal_Add;
    } else{
        //When parameter is added using quick add parameters panel. Update panelId and created parameters in parameterinfo structure.
        //Parameter info structure will be used in prepareInputForSOA
        parameterInfo.panelId = Quick_Add;
        if( eventData.scope.data.createdObject.outputs.length  > 0 &&  eventData.scope.data.createdObject.outputs[0].createdParams.length > 0 ) {
            parameterInfo.createdParams = eventData.scope.data.createdObject.outputs[0].createdParams;
        }
    }
    addRemoveFromAR.prepareInputForSOA( proxyMeasurableAttrs, refreshEvent, parameterInfo );
};


/**
 * Check if the element is added to AR
 *
 * @param {Object} vmo the view model
 * @Returns {boolean} elementAddedtoAR
 */
export let isElementAddedToVR = function( vmo ) {
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );

    if ( vmo && vmo.props && vmo.props.crt1AddedToAnalysisRequest &&
        vmo.props.crt1AddedToAnalysisRequest.dbValues[0] === '1' ) {
        return true;
    }
    return false;
};
/**
 * Unregister Property Policies as soon as AR Content tab is unloaded.
 */
function _unregisterPropPolicies() {
    eventBus.unsubscribe( _onOccMgmtUnloadedEventListener );
    appCtxSvc.unRegisterCtx( 'subscribeToContentUnloaded' );
    eventBus.unsubscribe( _onRegisterMselectedChangeEventListener );
    appCtxSvc.unRegisterCtx( 'subscribeToRegisterMselected' );
    appCtxSvc.unRegisterCtx( 'openedARObject' );
    appCtxSvc.unRegisterCtx( 'selectFilter' );
    appCtxSvc.unRegisterCtx( 'interfaceDetails' );
}

/**
 * Unregister Property Policies as soon as AR Content tab is unloaded.
 */
function _onRegisterMselected() {
    evaluateVisibility();
}

/**
 * Check if the AR/Study is open in ACE
 *
 * @returns {boolean} isAROrStudyOpenInACE
 */
function _isAROrStudyOpenInACE() {
    if ( appCtxSvc.ctx.occmgmtContext &&
        appCtxSvc.ctx.sublocation &&
        appCtxSvc.ctx.sublocation.nameToken === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' || appCtxSvc.ctx.locationContext['ActiveWorkspace:SubLocation'] ===
        'com.siemens.splm.client.attrtarget.paramProjectSubLocation' ) {
        var openedObj = cdm.getObject( appCtxSvc.ctx.occmgmtContext.currentState.uid );
        if( !openedObj ) {
            var stateSvc = AwStateService.instance;
            openedObj = cdm.getObject( stateSvc.params.uid );
        }
        if ( _isInstanceOf( 'Crt0VldnContractRevision', openedObj.modelType ) ) {
            appCtxSvc.registerCtx( 'openedARObject', openedObj );
            setCCObjectForVR( openedObj );
            return true;
        }
    }

    return false;
}

/**
 * Exports the selected AR/Study to Excel
 */
export let exportToExcel = function() {
    var selectedObjects = appCtxSvc.ctx.mselected;

    var selectedARs = [];

    if ( selectedObjects ) {
        _.forEach( selectedObjects, function( object ) {
            if ( _isInstanceOf( 'Crt0VldnContractRevision', object.modelType ) ) {
                selectedARs.push( object );
            }
        } );
    }
    if ( defaultExcelTemplate === null ) {
        soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
            preferenceNames: [ 'PLE_DefaultARExcelTemplate' ],
            includePreferenceDescriptions: false
        }, {} ).then( function( result ) {
            if ( result && result.response ) {
                if ( result.response[0].values ) {
                    defaultExcelTemplate = result.response[0].values.values[0];
                }
                if ( defaultExcelTemplate === null ) {
                    defaultExcelTemplate = 'AnalysisRequest_export_template';
                }
                _exportARToExcel( selectedARs );
            }
        } );
    } else {
        _exportARToExcel( selectedARs );
    }
};
/**
 *
 * @param {Object} soainput input for soa call
 * @param {Object} mselected selected element
 * @param {Object} ctxvar context
 * @param {Object} inputRevs input revisions
 */
function setVisibility( soainput, mselected, ctxvar, inputRevs ) {
    var allowedTypes = [];
    var t = null;
    var validObjects = [];
    if ( inputRevs[0] === null ) {
        appCtxSvc.updateCtx( ctxvar, true );
        for ( var i = 0; i < mselected.length; i++ ) {
            appCtxSvc.updateCtx( ctxvar, true );
            validObjects.push( mselected[i] );
            appCtxSvc.updateCtx( 'validObjects', validObjects );
        }
    } else {
        soaSvc
            .post( 'ValidationContract-2015-03-VCManagement', 'getContractDefnDetails', soainput )
            .then(
                function( response ) {
                    for ( var i = 0; i < response.contractDefnOutputs.length; i++ ) {
                        if ( response.contractDefnOutputs[i].groupName === 'input' ) {
                            for ( var j = 0; j < response.contractDefnOutputs[i].contractDefnSections.length; j++ ) {
                                for ( var k = 0; k < response.contractDefnOutputs[i].contractDefnSections[j].objectInfos.length; k++ ) {
                                    allowedTypes
                                        .push( response.contractDefnOutputs[i].contractDefnSections[j].objectInfos[k].type );
                                }
                            }
                        }
                    }
                    for ( i = 0; i < mselected.length; i++ ) {
                        if ( mselected[i].props.awb0Archetype ) {
                            t = cdm.getObject( mselected[i].props.awb0Archetype.dbValues[0] );
                        }
                        if ( allowedTypes.length > 0 && t !== null && allowedTypes.indexOf( t.type ) > -1 ) {
                            appCtxSvc.updateCtx( ctxvar, true );
                            validObjects.push( mselected[i] );
                            appCtxSvc.updateCtx( 'validObjects', validObjects );
                        }
                    }
                } );
    }
}

/**
 *
 * @param {Object} object s
 * @param {Object} selectedObjs selected Objects
 */
function getTraceLinks( object, selectedObjs ) {
    appCtxSvc.unRegisterCtx( 'traceLinks' );

    var traceLinks = [];
    for ( var i = 0; i < selectedObjs.length; ++i ) {
        if ( selectedObjs[i].props.crt1AddedToAnalysisRequest && selectedObjs[i].props.crt1AddedToAnalysisRequest.dbValues[0] === '1' ) {
            traceLinks.push( selectedObjs[i] );
        }
    }

    appCtxSvc.updateCtx( 'traceLinks', traceLinks );
}

/**
 * Return string that determines the usecase is dataset or not
 *
 * @param {object} data - Data of ViewModelObject
 * @returns {string} addButtonLoc
 */
export let identifyFromWhereAddButtonIsFired = function( data ) {
    var addButtonLoc;
    if ( data.datasetType && data.datasetType.dbValue === null || typeof data.datasetType.dbValue === 'undefined' ) {
        addButtonLoc = 'notADataset';
    } else {
        addButtonLoc = 'dataset';
    }
    return addButtonLoc;
};

export let addValidationResultsInput = function( data, uid ) {
    var vcRevision = cdm.getObject( uid );
    appCtxSvc.unRegisterCtx( 'vcRevision' );
    appCtxSvc.registerCtx( 'vcRevision', vcRevision );
    var input = [];
    var inputData;
    if ( data.selectedTab.panelId === 'NewTabPageSub' ) {
        inputData = {
            vcRevision: vcRevision,
            traceLinkType: 'Crt0ValidationLink',
            resultObjects: [ data.createdObject ]
        };
        input.push( inputData );
    } else {
        inputData = {
            vcRevision: vcRevision,
            traceLinkType: 'Crt0ValidationLink',
            resultObjects: data.sourceObjects
        };
        input.push( inputData );
    }
    return input;
};

var showMessage = function( ARs, studies, data, objects ) {
    if ( ARs.length > 1 && studies.length >= 1 ) {
        mesgSvc.showWarning( data.i18n.IgnoreStudyMsg );
        return ARs;
    } else if ( ARs.length === 1 && studies.length > 1 ) {
        mesgSvc.showWarning( data.i18n.IgnoreARMsg );
        return studies;
    } else if ( ARs.length === 1 && studies.length === 1 ) {
        mesgSvc.showError( data.i18n.CompareReportNotCreatedErr );
        return null;
    } else if ( ARs.length + studies.length === 1 ) {
        mesgSvc.showError( data.i18n.InvalidComparisonWarning.replace( '{0}', objects ) );
        return null;
    } else if ( ARs.length > 0 ) {
        return ARs;
    } else if ( studies.length > 0 ) {
        return studies;
    }
};

export let filterStudiesFromAR = function( data ) {
    var mselected = appCtxSvc.getCtx( 'mselected' );
    var ARs = [];
    var studies = [];
    var objects = '';
    for ( var i = 0; mselected && i < mselected.length; i++ ) {
        if ( i === mselected.length - 1 ) {
            objects = objects.concat( mselected[i] );
        } else {
            objects = objects.concat( mselected[i], ', ' );
        }
        if ( cmm.isInstanceOf( 'Crt0VldnContractRevision', mselected[i].modelType ) ) {
            if ( !cmm.isInstanceOf( 'Crt0StudyRevision', mselected[i].modelType ) ) {
                ARs.push( mselected[i] );
            } else {
                studies.push( mselected[i] );
            }
        }
    }
    return showMessage( ARs, studies, data, objects );
};

export let getGenerateChangeReportsInput = function( reportdefinitions, selections ) {
    var inContextReports = [];
    var soaInput = [];
    var reportDefObj = null;
    for ( var i = 0; i < reportdefinitions.length; i++ ) {
        inContextReports.push( reportdefinitions[i].reportdefinition );
    }
    if ( inContextReports.length > 0 ) {
        reportDefObj = cdm.getObject( inContextReports[0].uid );
        soaInput.push( {
            criteriaNames: [ 'reportType', 'reportDefUID' ],
            criteriaValues: [ 'Compare', reportDefObj.uid ],
            rdTag: reportDefObj,
            contextObjects: selections
        } );
    }
    return soaInput;
};

var buildUrlFromFileTicket = function( fileTicket, openFileName ) {
    var fileName = '';
    if ( openFileName && openFileName.length > 0 ) {
        fileName = encodeURIComponent( openFileName );
    } else {
        fileName = fmsUtils.getFilenameFromTicket( fileTicket );
    }

    var downloadUri = 'fms/fmsdownload/' + fileName + '?ticket=' + encodeURIComponent( fileTicket );
    var baseUrl = browserUtils.getBaseURL();
    return baseUrl + downloadUri;
};
/**
 *
 * @param {String} fileURL fileUrl
 * @param {Object} data data
 */
function processResponse( fileURL, data ) {
    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
        if ( xmlhttp.readyState === 4 && xmlhttp.status === 200 ) {
            var printWindow = window.open( '', 'PrintWin' );
            if ( printWindow && printWindow.top ) {
                printWindow.document.open();
                var div = printWindow.document.createElement( 'div' );
                if ( div ) {
                    div.setAttribute( 'id', 'compareReportId' );
                    var compareReport = '<div>' + xmlhttp.responseText + '</div>';
                    div.innerHTML = compareReport;
                    printWindow.document.appendChild( div );
                }
                printWindow.document.close();
            } else {
                mesgSvc.showWarning( data.i18n.ArChangeReportWarning );
            }
        }
    };
    xmlhttp.open( 'GET', fileURL, false );
    xmlhttp.send();
}

export let processGenerateResponse = function( response, data ) {
    for ( var i = 0; i < response.transientFileTicketInfos.length; i++ ) {
        var fileTicket = null;
        fileTicket = response.transientFileTicketInfos[i].ticket;
        if ( fileTicket !== null ) {
            var fileURL = buildUrlFromFileTicket( fileTicket );
            processResponse( fileURL, data );
        }
    }
};

/**
 * Check if the parameter is set as input or output
 *
 * @param {Object} vmo the view model
 * @Returns {boolean} true is set to input or output
 */
export let isParameterSetInputOrOutput = function( vmo ) {
    if ( _isAROrStudyOpenInACE() ) {
        appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
        if ( vmo.props.crt1IsAddedToVR && vmo.props.crt1IsAddedToVR.dbValues &&
            vmo.props.crt1IsAddedToVR.dbValues.length && vmo.props.crt1IsAddedToVR.dbValues[0] === '1' ) {
            return true;
        }
    }
    return false;
};

/**
 * Update column filters to filter content table
 */
export let getColumnFilters1 = function( data ) {
    appCtxSvc.unRegisterCtx( 'redrawChart' );
    if ( appCtxSvc.ctx.columnTableColumnFilters ) {
        data.columnProviders.contentsTableColumnProvider.columnFilters = appCtxSvc.ctx.columnTableColumnFilters;
    }
    return data.columnProviders.contentsTableColumnProvider.columnFilters;
};

/**
 * For contents table on TR & TE, no duplicates from tree tables should be visible
 * @param {appCtx} ctx the application context
 * @returns {string} the exclude types
 */
export let getExcludeTypeFilter = function( ctx ) {
    var excludeTypeFilter = null;
    if ( ctx.xrtSummaryContextObject && ctx.xrtSummaryContextObject.modelType && ctx.xrtSummaryContextObject.modelType.typeHierarchyArray && ctx.xrtPageContext && ctx.xrtPageContext.primaryXrtPageID && ctx.xrtPageContext.primaryXrtPageID === 'tc_xrt_Overview' ) {
        if ( ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'IAV0TestStudyRevision' ) > -1 ) {
            excludeTypeFilter = 'IAV0TestStepRevision:IAV0TestRequestRevision:IAV0AbsReqmtRevision:IAV0TestProcedurRevision:Part Revision:Design Revision';
        } else if ( ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'IAV0TestRunRevision' ) > -1 ) {
            excludeTypeFilter = 'IAV0TestStepRevision:IAV0TestRequestRevision:IAV0AbsReqmtRevision:IAV0TestProcedurRevision:PhysicalPartRevision';
        } else if ( ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) > -1 || ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Crt0RunRevision' ) > -1 ) {
            excludeTypeFilter = 'IAV0TestStepRevision:IAV0TestCondRevision:IAV0MeasureReqmtRevision:IAV0TestProcedurRevision';
        }
    }
    return excludeTypeFilter;
};

/**
 *
 * @param {Object} eventData EventData
 */
function _reloadTable( eventData ) {
    appCtxSvc.registerCtx( 'elementAddedToVR', true );
    var ObjUid = eventData.scope.subPanelContext.parametersTable.selectedObjects[ 0 ].props.att1AttrContext.dbValues[ 0 ];
    var Obj = cdm.getObject( ObjUid );
    if( Obj && Obj.props && Obj.props.crt0TargetAttr && Obj.props.crt0TargetAttr.dbValues && Obj.props.crt0TargetAttr.dbValues[ 0 ] === '' ) {
        eventBus.publish( 'uniformParamTable.reloadTable' );
        eventBus.publish( 'Att1ParameterWidePanel.ClosePopup' );
    }
}

/**
 *
 * @param {Object} eventData EventData
 */
function _autoAddChildToVR( eventData ) {
    appCtxSvc.registerCtx( 'elementAddedToVR', true );
    var state = appCtxSvc.getCtx( 'state' );
    var arObject = cdm.getObject( state.params.uid );
    var elementInputs = [];
    if( eventData && eventData.scope && eventData.scope.subPanelContext && eventData.scope.subPanelContext.occContext.currentState.pageId ) {
        var currentTab = eventData.scope.subPanelContext.occContext.currentState.pageId;
    }
    var elementInput = {};
    var succMsg = '';
    if( arObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 ) {
        var manageARElements;
        // add child / sibling inside structure
        if( eventData.objectsToSelect && eventData.objectsToSelect.length === 1 || eventData.objectToSelect && eventData.objectToSelect.rootElement ) {
            if( eventData.objectsToSelect ) {
                manageARElements = eventData.objectsToSelect[ 0 ];
            } else if( eventData.objectToSelect ) {
                manageARElements = eventData.objectToSelect.rootElement;
            }
            if( manageARElements && manageARElements.modelType.typeHierarchyArray.indexOf( 'Sam1AsMaintainedElement' ) > -1 && manageARElements.props.awb0UnderlyingObject ) {
                manageARElements = _getPartRevisionObjet( manageARElements.props.awb0UnderlyingObject );
            }
            succMsg = manageARElements.props.object_string.dbValues[ 0 ];
            elementInput.elementAction = '';
            elementInput.objectToAdd = {
                type: manageARElements.type,
                uid: manageARElements.uid
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
            succMsg = manageARElements.props.object_string.dbValues[ 0 ];
        } else {
            manageARElements = eventData.objectsToSelect;
            for( var i = 0; i < manageARElements.length; i++ ) {
                var elementInput = {};
                elementInput.elementAction = '';
                elementInput.objectToAdd = {
                    type: manageARElements[ i ].type,
                    uid: manageARElements[ i ].uid
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
            }
            if( manageARElements.length === 1 ) {
                succMsg += manageARElements[ i ].props.object_string.dbValues[ 0 ];
            } else {
                succMsg += manageARElements[ i ].props.object_string.dbValues[ 0 ] + ',';
            }
        }
        var input = [ {
            clientId: 'ActiveWorkSpace',
            verificationRequest: {
                type: arObject.type,
                uid: arObject.uid
            },
            data: [ {
                manageAction: 'addObject',
                elementInputs: elementInputs,
                recipeData: {
                    recipe: '',
                    seedObjects: [],
                    context: ''
                }
            } ]
        } ];
        var pref = {
            diagramAction: '',
            useClosureRule: false
        };
        var manageVRInput = {};
        manageVRInput.input = input;
        manageVRInput.pref = pref;
        //call manage analysis SOA
        manageVerificationService.callManageVerificationSOA( manageVRInput, '', currentTab );
    }
}

/**
 * Get part revision object if physical bom is added
 *
 *@param {Object} underlyingObj underlying part revison object
 *@returns {Object} part revision object
 */
function _getPartRevisionObjet( underlyingObj ) {
    let manageARElement;
    if( underlyingObj && underlyingObj.dbValues.length > 0 && underlyingObj.uiValues.length > 0 ) {
        var objName = underlyingObj.uiValues[ 0 ];
        var modelObj = cdm.getObject( underlyingObj.dbValues[0] );
        var physicalPartItemRev = {
            type: modelObj.type,
            uid: modelObj.uid,
            props: { object_string: { dbValues: [ objName ] } }
        };
        manageARElement = physicalPartItemRev;
    }
    return manageARElement;
}

/**
 *
 * @param {Object} eventData EventData
 */
function _autoAddSiblingToVR( eventData ) {
    appCtxSvc.registerCtx( 'elementAddedToVR', true );
    //save working context
    var uid = eventData.scope.subPanelContext.occContext.baseModelObject.uid;
    soaSvc.post( 'Internal-ActiveWorkspaceBom-2020-05-OccurrenceManagement',
        'saveWorkingContext', {

            workingContexts: [ {
                uid: uid,
                type: 'Awb0SavedBookmark'
            } ]
        } ).then(
        function() { } );

    //call this function to call manage analysis SOA
    _autoAddChildToVR( eventData );
}

export let isElementAddedToTR = function( vmo, props ) {
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
    if ( vmo && vmo.props && vmo.props.crt1SourceObject && vmo.props.crt1SourceObject.dbValues && vmo.props.crt1SourceObject.dbValues[0] !== '' ) {
        var objUid = vmo.props.crt1SourceObject.dbValues[0];
        var object = cdm.getObject( objUid );
        var object1 = cdm.getObject( vmo.props.crt1UnderlyingObject.dbValues[0] );
        var crt1AddedToAnalysisRequest = object && object.props && object.props.crt1AddedToAnalysisRequest && object.props.crt1AddedToAnalysisRequest.dbValues && object.props.crt1AddedToAnalysisRequest.dbValues[0] === '1';
        var Awb0Element = object && object.modelType && object.modelType.typeHierarchyArray && object.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1;
        if ( Awb0Element && crt1AddedToAnalysisRequest && ( object1.modelType.typeHierarchyArray.indexOf( 'IAV0TestCaseRevision' ) > -1 ||
            object1.modelType.typeHierarchyArray.indexOf( 'IAV0TestProcedurRevision' ) > -1 ||
            object1.modelType.typeHierarchyArray.indexOf( 'IAV0TestStepRevision' ) > -1 ||
            object1.modelType.typeHierarchyArray.indexOf( 'IAV0AbsReqmtRevision' ) > -1 ||
            object1.modelType.typeHierarchyArray.indexOf( 'IAV0TestRequestRevision' ) > -1 ) ) {
            return true;
        }
        return false;
    }
};

export default exports = {
    openObject,
    populateSavedBookmark,
    setCCObjectForVR,
    processCreatedObject,
    arOccurenceFilter,
    studyOccurenceFilter,
    isElementAddedToAR,
    isElementAddedToVR,
    exportToExcel,
    identifyFromWhereAddButtonIsFired,
    addValidationResultsInput,
    filterStudiesFromAR,
    getGenerateChangeReportsInput,
    processGenerateResponse,
    isParameterSetInputOrOutput,
    getColumnFilters1,
    getExcludeTypeFilter,
    setInputDirectionForParamterObj,
    isElementAddedToTR,
    isElementOutsideVR,
    setVRCreatedmessage
};
