// Copyright (c) 2022 Siemens

/**
 * @module js/manageVerificationService
 */
import soaSvc from 'soa/kernel/soaService';
import mesgSvc from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import crt1VROverviewTablesService from 'js/Crt1VROverviewTablesService';
import clipboardService from 'js/clipboardService';
import AwStateService from 'js/awStateService';

var exports = {};

/**
 * Prepare input for manageVerificationRequest SOA.
 * @param {Object} manageSOAInput - Input structure for manage SOA.
 * @param {Object} i18n - Info message for invalid types.
 * @param {Object} primaryActiveTabId - Parent object selected from scope tree
 */
export let callManageVerificationSOA = function( manageSOAInput, i18n, primaryActiveTabId, subPanelContext ) {
    let clintId = manageSOAInput.input[0].clientId;
    let action = manageSOAInput.input[0].data[0].manageAction;
    if ( subPanelContext ) {
        var vrSublocationState = subPanelContext.vrSublocationState;
    }
    if ( vrSublocationState && clintId === 'ActiveWorkSpace' && action && ( action === 'addIssues' || action === 'removeObject' || action === 'addObject' || action === 'addToBOM' || action === 'addObjectAndCopyVRParameters' ) ) {
        crt1VROverviewTablesService.setGetAllRows( true );
    }
    soaSvc.post( 'ValidationContractAW-2020-12-VCManagement', 'manageVerificationRequests', {
        input: manageSOAInput.input,
        pref: manageSOAInput.pref
    } ).then( function( response ) {
        _showMessageForOverviewTab( response, manageSOAInput, i18n );
        if( manageSOAInput && manageSOAInput.input[ 0 ] && manageSOAInput.input[ 0 ].data[ 0 ] && manageSOAInput.input[ 0 ].data[ 0 ].manageAction === 'addIssue' && appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] ===
            'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
            eventBus.publish( 'issuesTableExecuteUI.plTable.reload' );
        }
        if( manageSOAInput && manageSOAInput.input[ 0 ] && manageSOAInput.input[ 0 ].data[ 0 ] && manageSOAInput.input[ 0 ].data[ 0 ].manageAction === 'addAttachment' && appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] ===
            'com.siemens.splm.client.vrtarget.vrExecuteSubLocation' ) {
            eventBus.publish( 'attachmentsTableExecuteUI.plTable.reload' );
        }
        //In case of content tab we will get.
        if ( primaryActiveTabId === 'tc_xrt_Content' ) {
            eventBus.publish( 'primaryWorkarea.reset' );
            //_showMessageForContentTab( manageSOAInput, i18n );
        }
    }, function( response ) {
        exports.processPartialErrors( response );
    } );
};

var _showMessageForOverviewTab = function( response, manageSOAInput, i18n ) {
    if ( manageSOAInput && manageSOAInput.invalidObjects && manageSOAInput.invalidObjects[0] ) {
        var elementsToAdd;
        var elementsToAdd1;
        var invalidObjects;
        if ( manageSOAInput ) {
            elementsToAdd = manageSOAInput.manageARElements;
            elementsToAdd1 = manageSOAInput.allManageARElements;
            invalidObjects = manageSOAInput.invalidObjects;
        }
        // handle Info message
        if ( response.output.length !== 0 && ( invalidObjects && invalidObjects.length !== 0 ) && i18n && i18n.detailedInfoMessageForInvalidTypes ) {
            var error = '';
            for ( var i = 0; i < invalidObjects.length; i++ ) {
                var buildDetailInfoMessage = i18n.detailedInfoMessageForInvalidTypes.replace( '{0}', invalidObjects[i].props.object_string.uiValues[0] ).replace( '{1}', invalidObjects[i]
                    .modelType.displayName ).replace( '{2}', invalidObjects[i].type );
                buildDetailInfoMessage += '\n';
                error += buildDetailInfoMessage;
            }
            var objName = response.output[0].verificationRequest.props.object_string.dbValues[0];
            var msg = i18n.throwError.replace( '{0}', elementsToAdd.length ).replace( '{1}', elementsToAdd1.length )
                .replace( '{2}', objName ).replace( '{3}', error );
            var errorString = msg + ' ';
            mesgSvc.showInfo( errorString );
        }
    }
};

export let setunusewarningmsg = function( parentObject, selectedobjs, i18n ) {
    let str = '';
    let parent_obj = '';
    if( parentObject && parentObject.props && parentObject.props.object_name && parentObject.props.object_name.dbValues ) {
        parent_obj = parentObject.props.object_name.dbValues[ 0 ];
    } else if( parentObject && parentObject.props && parentObject.props.object_string && parentObject.props.object_string.dbValues ) {
        parent_obj = parentObject.props.object_string.dbValues[ 0 ];
    }
    if ( selectedobjs && selectedobjs.length && selectedobjs.length === 1 ) {
        str = i18n.SetParametertoUnusedForSingleParameter.replace( '{0}', '\"' + selectedobjs[0].displayName + '\"' ).replace( '{1}', parent_obj );
    } else if( selectedobjs && selectedobjs.length && selectedobjs.length > 0 ) {
        let unused_cnt = 0;
        for ( let i = 0; i < selectedobjs.length; i++ ) {
            if ( selectedobjs[i].props && selectedobjs[i].props.att1AttrInOut && selectedobjs[i].props.att1AttrInOut.dbValue &&
                selectedobjs[i].props.att1AttrInOut.dbValue !== 'unused' ) {
                unused_cnt++;
            }
        }
        str = i18n.SetParametertoUnusedForMultipleParameters.replace( '{0}', unused_cnt ).replace( '{1}', parent_obj );
    }
    return str;
};

var _showMessageForContentTab = function( manageARInput, i18n ) {
    if ( manageARInput && manageARInput.input[0] && manageARInput.input[0].data[0] &&
        manageARInput.input[0].data[0].manageAction && manageARInput.input[0].data[0].manageAction === 'addObject' ) {
        var elementsToAdd = manageARInput.succMsg;
        var msg = i18n.AddedElementToVC.replace( '{0}', elementsToAdd );
        mesgSvc.showInfo( msg );
    }
};


export let processPartialErrors = function( response ) {
    if ( response.cause && response.cause.partialErrors ) {
        var msgObj = {
            msg: '',
            level: 0
        };
        if ( response && response.cause.partialErrors ) {
            _.forEach( response.cause.partialErrors, function( partialError ) {
                getMessageString( partialError.errorValues, msgObj );
            } );
        }
        mesgSvc.showError( msgObj.msg );
    }
};

export let processPartialParameterErrors = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if ( response && response.partialErrors ) {
        _.forEach( response.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }
    return msgObj.msg;
};

var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 *
 * @param {String} manageAction - action to be called for
 * @param {Object} commandContext - commandContext to get selected element from open object.
 * @param {Array} parameters - array of parameters copied to clipboard
 * @returns {manageARInput} - input to be called for SOa
 */
export let getManageInputPasteParams = function( manageAction, commandContext, parameters ) {
    var selectedObject;
    var manageParamInput = {};
    var elements = '';
    var elementInputs = [];
    var type = '';
    var uid = '';


    if ( commandContext.dataProvider ) { //check if commandContext.DataProvider exists
        elements = getSelectedElementsForDynamicUX( commandContext.dataProvider ); //returns seedObjects
        if ( elements && elements.length ) {  //check if there are any elements
            for ( var j = 0; j < elements.length; ++j ) {
                var elementInput = {};
                elementInput.elementAction = '';
                elementInput.objectToAdd = {
                    type: elements[j].type,
                    uid: elements[j].uid
                };
                var parameterInfos = [];
                elementInput.objectToAddContext = '';
                elementInput.objectToAddParent = '';
                elementInput.addParameterAsInOut = '';
                elementInput.addUnderlyingObject = false;
                elementInput.portToInterfaceDefsMap = [
                    [],
                    []
                ];
                for ( var i = 0; i < parameters.length; ++i ) {
                    if ( parameters[i].modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 || parameters[i].type === 'Att1AttributeAlignmentProxy' ) // checking if parameter is copied or not
                    {
                        var parameterinfo = {
                            parameter: parameters[i],
                            direction: parameters[i].props.att1AttrInOut.dbValue
                        };

                        parameterInfos.push( parameterinfo );
                    }
                }
                elementInput.parameterInfo = parameterInfos;
                elementInputs.push( elementInput );
            }
        }
    }


    if ( commandContext && commandContext.subPanelContext && commandContext.subPanelContext.selected ) {
        var selectedObjUid = commandContext.subPanelContext.selected.uid;
        selectedObject = cdm.getObject( selectedObjUid );
        type = selectedObject.type;
        uid = selectedObject.uid;
    }

    var input = [ {
        clientId: 'ActiveWorkSpace',
        verificationRequest:
        {
            uid: uid,
            type: type
        },
        data: [ {
            manageAction: manageAction,
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
    manageParamInput.input = input;
    manageParamInput.pref = pref;
    return manageParamInput;
};


/**
 * Prepare input for manageVerificationRequest SOA for all flat tables.
 * @param {Object} parentScopeObject - Parent object selected from scope tree
 * @param {Object} createdObject - Newly created object from add panel e.g. Req/System etc.
 * @param {Object} palletteSearchObjects - objects selected from pallete & search locations
 * @param {Object} pref_notAllowedTypes - preference for not allowed types
 * @param {Object} addAsOccurrence - Check box from add panel (add as structure/WSO)
 * @param {Object} copyParameter - check box from add panel (copy para)
 */
export let getManageInputForTables = function( parentScopeObject, createdObject, palletteSearchObjects, pref_notAllowedTypes, addAsOccurrence, autoMapParameter, throwErrorVRNotCreated ) {
    if ( addAsOccurrence.dbValue ) {
        var addAsOccurrence = addAsOccurrence.dbValue;
    }
    var elementInputs = [];
    var elementInput = {};
    var succMsg = '';
    var allManageARElements = '';
    var isInvalidObj = false;
    var filterValidObjects = pref_notAllowedTypes;
    var currentSelectedObj = parentScopeObject;
    if ( palletteSearchObjects && palletteSearchObjects.length && palletteSearchObjects.length > 0 ) {
        allManageARElements = palletteSearchObjects;
        var manageAction = 'addObject';
    } else if ( createdObject ) {
        allManageARElements = createdObject;
        var manageAction = 'addObject';
    }
    if ( filterValidObjects !== undefined && filterValidObjects.length > 0 ) {
        // filter out the invalid objects
        if ( allManageARElements && allManageARElements.length && allManageARElements.length > 0 ) {
            var invalidObjects = [];
            var manageARElements = [];
            for ( var i = 0; i < allManageARElements.length; i++ ) {
                var isInvalidObj = false;
                for ( var j = 0; j < filterValidObjects.length; j++ ) {
                    if ( allManageARElements[i].modelType.typeHierarchyArray.indexOf( filterValidObjects[j] ) > -1 ) {
                        isInvalidObj = true;
                        invalidObjects.push( allManageARElements[i] );
                    }
                }
                if ( isInvalidObj === false ) {
                    manageARElements.push( allManageARElements[i] );
                }
            }
        } else {
            for ( var i = 0; i < filterValidObjects.length; i++ ) {
                if ( allManageARElements.modelType.typeHierarchyArray.indexOf( filterValidObjects[i] ) > -1 ) {
                    var invalidObjects = allManageARElements;
                    isInvalidObj = true;
                }
            }
            if ( isInvalidObj === false ) {
                var manageARElements = allManageARElements;
            }
        }
    } else {
        //if preference not present, send all the objects without filtering to SOA
        var manageARElements = allManageARElements;
    }
    // Prepare SOA input for adding objects from pallette & search to table
    if ( manageARElements && manageARElements.length && manageARElements.length > 0 ) {
        for ( var i = 0; i < manageARElements.length; i++ ) {
            var underlyingObj;
            var underlyingObjUid;
            var underlyingObjType;

            if ( manageARElements[i].props.awb0UnderlyingObject && manageARElements[i].props.awb0UnderlyingObject.dbValues[0] ) {
                var underlyingObj = cdm.getObject( manageARElements[i].props.awb0UnderlyingObject.dbValues[0] );
                underlyingObjUid = underlyingObj.uid;
                underlyingObjType = underlyingObj.type;
            } else {
                underlyingObjUid = manageARElements[i].uid;
                underlyingObjType = manageARElements[i].type;
            }
            var elementInput = {};
            elementInput.elementAction = '';
            if ( autoMapParameter ) {
                if ( autoMapParameter.dbValue === true ) {
                    elementInput.elementAction = 'autoMapPara:true';
                } else {
                    elementInput.elementAction = 'autoMapPara:false';
                }
            }
            elementInput.objectToAdd = {
                type: underlyingObjType,
                uid: underlyingObjUid
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
            if ( manageARElements.length === 1 ) {
                succMsg += manageARElements[i].props.object_string.dbValues[0];
            } else {
                succMsg += manageARElements[i].props.object_string.dbValues[0] + ',';
            }
        }
    } else if ( manageARElements && manageARElements.type && manageARElements.props ) {
        // Prepare SOA input for adding newly created object to table
        succMsg = manageARElements.props.object_string.dbValues[0];
        elementInput.elementAction = '';
        if ( autoMapParameter ) {
            if ( autoMapParameter.dbValue === true ) {
                elementInput.elementAction = 'autoMapPara:true';
            } else {
                elementInput.elementAction = 'autoMapPara:false';
            }
        }
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
        succMsg = manageARElements.props.object_string.dbValues[0];
    } else {
        //Throw error if all objects added are invalid
        _throwError( createdObject, palletteSearchObjects, throwErrorVRNotCreated );
    }
    if ( addAsOccurrence === true ) {
        manageAction = 'addToBOM';
    } else if ( autoMapParameter && autoMapParameter.dbValue === true ) {
        manageAction = 'addObject';
    } else if ( manageAction === undefined ) {
        manageAction = 'addToBOM';
    }
    var getManageInputForTables = {};
    var input = [ {
        clientId: 'ActiveWorkSpace',
        verificationRequest: {
            type: currentSelectedObj.type,
            uid: currentSelectedObj.uid
        },
        data: [ {
            manageAction: manageAction,
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
    getManageInputForTables.input = input;
    getManageInputForTables.pref = pref;
    getManageInputForTables.succMsg = succMsg;
    getManageInputForTables.invalidObjects = invalidObjects;
    getManageInputForTables.manageARElements = manageARElements;
    getManageInputForTables.allManageARElements = allManageARElements;
    return getManageInputForTables;
};

/**
 * Function to throw error when all objects are invalid
 */
var _throwError = function( createdObject, palletteSearchObjects, throwErrorVRNotCreated ) {
    var error = '';
    if ( createdObject && createdObject.props && createdObject.type && createdObject.modelType ) {
        error = error.concat( '\'' + createdObject.props.object_name.dbValues[0] + '\'' + ' ' + 'is' + ' ' + '\'' + createdObject.modelType.displayName + ' (Classname :: ' + createdObject.type + ')\'' +
            '\n' );
    } else {
        for ( var i = 0; i < palletteSearchObjects.length; i++ ) {
            error = error.concat( '\'' + palletteSearchObjects[i].props.object_string.dbValue + '\'' + ' ' + 'is' + ' ' + '\'' + palletteSearchObjects[i].modelType.displayName + ' (Classname :: ' +
                palletteSearchObjects[i].type + ')\'' + '\n' );
        }
    }
    var msg = throwErrorVRNotCreated.replace( '{0}', error );
    var errorString = msg + ' ';
    mesgSvc.showInfo( errorString );
};

/**
 * Prepare input for manageVerificationRequest SOA for all tree tables.
 * @param {Object} parentScopeObject - Parent object selected from scope tree
 * @param {Object} createdObject - Newly created object from add panel e.g. Req/System etc.
 * @param {Object} ActiveCommandId - command Id to decide if child/sibling should be acction
 * @param {Object} palletteSearchObjects - objects selected from pallete & search locations
 * @param {Object} selectionData - parent object to add child/sibling
 */
export let getManageInputForTreeTables = function( parentScopeObject, createdObject, palletteSearchObjects, ActiveCommandId ) {
    var selected = '';
    var action = '';
    var succMsg = '';
    var type = '';
    var uid = '';
    var currentSelectionObj;
    var elementInputs = [];
    if ( parentScopeObject && parentScopeObject.vrSublocationState ) {
        currentSelectionObj = parentScopeObject.vrSublocationState.mselected[0];
    }
    if ( currentSelectionObj ) {
        type = currentSelectionObj.type;
        uid = currentSelectionObj.uid;
        if ( ActiveCommandId === 'IAV1AddContentToTPTableAsSibling' || ActiveCommandId === 'IAV1AddContentToTPTableAsSiblingSibling' ||
            ActiveCommandId === 'IAV1AddContentToTestCaseTableAsSiblingSibling' || ActiveCommandId === 'IAV1AddContentToTMTableAsSibling' || ActiveCommandId === 'IAV1AddContentToTMTableAsSiblingSibling'
        ) {
            action = 'Sibling';
        } else if ( ActiveCommandId !== 'IAV1AddContentToTPTable' && ActiveCommandId !== 'IAV1AddContentToTestCaseTable' && ActiveCommandId !== 'IAV1AddContentToTMTable' ) {
            action = 'Child';
        }
    }
    if ( parentScopeObject && parentScopeObject.dataProvider && parentScopeObject.dataProvider.selectedObjects[0] ) {
        selected = {
            type: parentScopeObject.dataProvider.selectedObjects[0].type,
            uid: parentScopeObject.dataProvider.selectedObjects[0].uid
        };
    }
    // Prepare SOA input for adding objects from pallette & search objects to table
    if ( palletteSearchObjects && palletteSearchObjects.length && palletteSearchObjects.length > 0 ) {
        manageARElements = palletteSearchObjects;
        for ( var i = 0; i < manageARElements.length; i++ ) {
            var elementInput = {};
            elementInput.elementAction = action;
            elementInput.objectToAdd = {
                type: manageARElements[i].type,
                uid: manageARElements[i].uid
            };
            elementInput.objectToAddContext = '';
            elementInput.objectToAddParent = selected;
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
            if ( manageARElements.length === 1 ) {
                succMsg += manageARElements[i].props.object_string.dbValues[0];
            } else {
                succMsg += manageARElements[i].props.object_string.dbValues[0] + ',';
            }
        }
    } else if ( createdObject ) {
        // Prepare SOA input for adding newly created object to table
        var elementInput = {};
        var manageARElements = createdObject;
        succMsg = manageARElements.props.object_string.dbValues[0];
        elementInput.elementAction = action;
        elementInput.objectToAdd = {
            type: manageARElements.type,
            uid: manageARElements.uid
        };
        elementInput.objectToAddContext = '';
        elementInput.objectToAddParent = selected;
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
        succMsg = manageARElements.props.object_string.dbValues[0];
    }
    var getManageInputForTreeTables = {};
    var input = [ {
        clientId: 'ActiveWorkSpace',
        verificationRequest: {
            type: type,
            uid: uid
        },
        data: [ {
            manageAction: 'addToBOM',
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
    getManageInputForTreeTables.input = input;
    getManageInputForTreeTables.pref = pref;
    getManageInputForTreeTables.succMsg = succMsg;
    return getManageInputForTreeTables;
};

/**
 *
 * @param {String} manageAction - action to be called for
 * @param {Object} commandContext - commandContext to get selected element from open object.
 * @returns {manageARInput} - input to be called for SOa
 */
export let getManageInputForContentTables = function( manageAction, commandContext ) {
    var selectedElements;
    var type = '';
    var uid = '';
    var elementsToAdd = [];
    var elementsToRemove = [];
    var correctedSelection = [];
    var elements = '';
    var elementInputs = [];
    var manageARElements = [];
    var succMsg = '';
    var manageARInput = {};
    let params = AwStateService.instance.params;
    var selectedUid = params.uid;
    var selectedObj = cdm.getObject( selectedUid );

    //Selection is from overview page of the vr.
    if ( commandContext.dataProvider ) {
        elements = getSelectedElementsForDynamicUX( commandContext.dataProvider );
        if ( elements && elements.length ) {
            for ( var j = 0; j < elements.length; ++j ) {
                var objUid = elements[j].props.crt1SourceObject.value;
                var attribute = cdm.getObject( objUid );
                correctedSelection.push( attribute );
            }
            selectedElements = correctedSelection;
            if ( commandContext.vrSublocationState && commandContext.vrSublocationState.mselected && commandContext.vrSublocationState.mselected.length > 0 ) {
                type = commandContext.vrSublocationState.mselected[0].type;
                uid = commandContext.vrSublocationState.mselected[0].uid;
            }
        }
    } else {
        //selection from content tab.
        //accessing occmgmtcontext for add/remove commands on task bar
        let occContext = appCtxSvc.getCtx( 'occmgmtContext' );
        if ( commandContext.occContext && commandContext.occContext.pwaSelection && commandContext.occContext.pwaSelection.length > 0 ) {
            selectedElements = commandContext.occContext.pwaSelection;
        } else {
            selectedElements = occContext.selectedModelObjects;
        }
        if( commandContext && commandContext.openedObject && commandContext.openedObject.type ) {
            type = commandContext.openedObject.type;
        } else if( selectedObj && selectedObj.type ) {
            // parentType if user refresh the context sublocation
            type = selectedObj.type;
        }
        if( commandContext && commandContext.openedObject && commandContext.openedObject.uid ) {
            uid = commandContext.openedObject.uid;
        } else if( selectedObj && selectedObj.uid ) {
            // parentUid if user refresh the context sublocation
            uid = selectedObj.uid;
        }
    }
    if ( selectedElements && selectedElements.length > 0 ) {
        _.forEach( selectedElements, function( element ) {
            // for Physical BOM crt1AddedToAnalysisRequest property is not populated by server. Thus the check
            if ( selectedElements[0].modelType && selectedElements[0].modelType.typeHierarchyArray.indexOf( 'Sam1AsMaintainedElement' ) > -1 ) {
                elementsToRemove.push( element );
            } else if ( element.props && element.props.crt1AddedToAnalysisRequest ) {
                if ( element.props.crt1AddedToAnalysisRequest.dbValues[0] === '0' ) {
                    elementsToAdd.push( element );
                } else if ( element.props.crt1AddedToAnalysisRequest.dbValues[0] === '1' ) {
                    elementsToRemove.push( element );
                }
            } else {
                elementsToAdd.push( element );
                elementsToRemove.push( element );
            }
        } );
    }
    if ( manageAction === 'addObject' ) {
        manageARElements = elementsToAdd;
    } else if ( manageAction === 'removeObject' ) {
        manageARElements = elementsToRemove;
    }
    for ( var i = 0; i < manageARElements.length; i++ ) {
        var elementInput = {};
        elementInput.elementAction = '';
        elementInput.objectToAdd = {
            type: manageARElements[i].type,
            uid: manageARElements[i].uid
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
        succMsg = succMsg.concat( manageARElements[i].props.object_string.dbValues[0], ',' );
    }
    if ( succMsg.endsWith( ',' ) ) {
        succMsg = succMsg.slice( 0, succMsg.length - 1 );
    }
    var input = [ {
        clientId: 'ActiveWorkSpace',
        verificationRequest:
        {
            type: type,
            uid: uid
        },
        data: [ {
            manageAction: manageAction,
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
    manageARInput.input = input;
    manageARInput.pref = pref;
    manageARInput.succMsg = succMsg;
    return manageARInput;
};

/**
 *
 * @param {Object}  dataProvider - action to be called for
 * @returns {Object} elements - selected element from open object.
 *
 */
function getSelectedElementsForDynamicUX( dataProvider ) {
    var elements;
    if ( dataProvider ) {
        elements = dataProvider.selectedObjects;
    }
    return elements;
}

/**
 * code to remove parameters from clipboard after paste parameters action is completed
 */
export let removeParameters = function( awClipboardBoardProvider ) {
    for ( let i = 0; i < awClipboardBoardProvider.length; i++ ) {
        if ( awClipboardBoardProvider[i].modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
            awClipboardBoardProvider.splice( i, 1 );
            i--;
        }
    }
};

/**
 * Copy the parameter underlying objects to the clipboard
 *
 * @param selectedObjs Selected objects
 * @returns Parameter underlying objects
 */
export let copyParamProxyObjects = function( selectedObjs ) {
    if ( selectedObjs && selectedObjs.length > 0 ) {
        // Copy userObjects to the clipboard
        clipboardService.instance.setContents( selectedObjs );
    }
};

export default exports = {
    copyParamProxyObjects,
    callManageVerificationSOA,
    processPartialErrors,
    processPartialParameterErrors,
    getManageInputForTables,
    getManageInputForTreeTables,
    getManageInputForContentTables,
    getManageInputPasteParams,
    removeParameters,
    setunusewarningmsg

};
