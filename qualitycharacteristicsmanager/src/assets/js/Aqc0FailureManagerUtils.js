// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for characteristics manager from quality center foundation module
 *
 * @module js/Aqc0FailureManagerUtils
 */
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import Aqc0CharManagerUtils from 'js/Aqc0CharManagerUtils';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import messagingSvc from 'js/messagingService';
import appCtxService from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import editHandlerSvc from 'js/editHandlerService';
import _localeSvc from 'js/localeService';
import _ from 'lodash';
import aqc0CharMangrUtils from 'js/Aqc0CharManagerUtils';
import aqc0CharSpecOPSvc from 'js/Aqc0CharSpecOperationsService';
import addObjectUtils from 'js/addObjectUtils';
import dateTimeSvc from 'js/dateTimeService';


var exports = {};

/**
 * set the variablity for Add child Panel
 */
export let setAddElementInputParentElementToSelectedElement = function( subPanelContext ) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    var addElementInput = {};
    var selectedElement = appCtxService.getCtx( 'selected' );
    addElementInput = viewModelObjectService.createViewModelObject( selectedElement.uid );
    if( searchState ) {
        let searchData = { ...searchState.value };
        searchData.parentElement = addElementInput;
        searchState.update( { ...searchData } );
    }
};

/**
 * set the variablity for Add sibling Panel
 */
export let updateParentElementForFailureAddSiblingPanel = function(subPanelContext) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    var addElementInput = {};
    var selectedElement = appCtxService.getCtx( 'selected' );
    addElementInput = viewModelObjectService.createViewModelObject( cdm.getObject( selectedElement.uid ).props.qc0ParentFailure.dbValues[ 0 ] );
    if( searchState ) {
        let searchData = { ...searchState.value };
        searchData.parentElement = addElementInput;
        searchState.update( { ...searchData } );
    }
};

export let setAddElementInputParentElementNull = function(subPanelContext) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    if( searchState ) {
        let searchData = { ...searchState.value };
        searchData.parentElement = null;
        searchState.update( { ...searchData } );
    }
};


/**
 * Set context to select node after edit complete and reset primary work area
 *@param {ModelObject} selectedModelObject view mdoel that is selected after edit complete
 * @param {ActiveEditHandler} activeEditHandler current active edit handler
 */
 export let setEditedObjectInContextAndReset = function( selectedModelObject, subPanelContext, activeEditHandler ) {
        if(subPanelContext !== undefined && subPanelContext !== null){

            let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
                if( searchState ) {
                    let searchData = { ...searchState.value };
                    searchData.selectedNodes = [];
                    searchData.selectedNodes.push(selectedModelObject);
                    searchState.update( { ...searchData } );
                }
        }
        if( activeEditHandler ) {
            activeEditHandler.saveEditsPostActions( true );
        } else if( activeEditHandler === null || activeEditHandler === undefined ) {
            var saveActvEditHandler = editHandlerSvc.getActiveEditHandler();
            saveActvEditHandler.cancelEdits();
            saveActvEditHandler.saveEditsPostActions( true );
        }
};

/**
 * toggle show Inactive checkbox value and save in context
 */
export let setToggleInputToFailure = function( data, subPanelContext ) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    if( searchState ) {
        let searchData = { ...searchState.value };
        searchData.showInactive = data.showInactive.dbValue;
        if(data.showInactive.dbValue === true){
            searchData.selectedNodes = [];
        }
        searchState.update( { ...searchData } );
    }
};

/**
 * Drag and drop functionality for cut and paste the object in the tree view
 * @param{ModelObject} targetObject Parent to which the object is to be pasted
 * @param{ModelObject} sourceObjects object to be pasted
 */
export let setPropertiesForPaste = function( targetObject, sourceObjects ) {
    var deferred = AwPromiseService.instance.defer();
    var inputData = [];
    var selectedParent = appCtxService.getCtx( 'pselected' );
    var subLocationContext = appCtxService.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );

    if( targetObject.type === 'Qc0Failure' && sourceObjects.length > 0 && ( subLocationContext === 'FailureSpecificationSubLocation' || subLocationContext === 'qualityfailuremanager' ) ) {
        _.forEach( sourceObjects, function( sourceObject ) {
            if( targetObject.type === 'Qc0Failure' && sourceObject.type === 'Qc0Failure' && targetObject.uid !== sourceObject.uid ) {
                var input = {
                    object: sourceObject,
                    timestamp: '',
                    vecNameVal: [ {
                        name: 'qc0ParentFailure',
                        values: [
                            targetObject.uid
                        ]
                    } ]
                };
                inputData.push( input );
            }
        } );
        soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', {
            info: inputData
        } ).then(
            function() {
                deferred.resolve();
                if( selectedParent !== undefined ) {
                    eventBus.publish( 'cdm.relatedModified', {
                        relatedModified: [ selectedParent, targetObject ]
                    } );
                } else {
                    eventBus.publish( 'primaryWorkarea.reset' );
                }
            },
            function( error ) {
                var errMessage = messagingSvc.getSOAErrorMessage( error );
                messagingSvc.showError( errMessage );
                deferred.reject( error );
                eventBus.publish( 'cdm.relatedModified', {
                    relatedModified: [ selectedParent, targetObject ]
                } );
            }
        );
    } else {
        var resource = 'qualityfailuremanagerMessages';
        var localTextBundle = _localeSvc.getLoadedText( resource );
        var errorMessage = localTextBundle.Aqc0FailureSpecDragDropFailed;
        messagingSvc.showError( errorMessage );
    }
    return deferred.promise;
};

/** This function checks the TC version and decides whether the dataprovider need to be called with additional params
 * @returns{ boolean } boolean - true/false
 */
export let getIsReleasedFlag = function() {
    Aqc0CharManagerUtils.getSupportedTCVersion();
    var isTC13_2OnwardsSupported = appCtxService.getCtx( 'isTC13_2OnwardsSupported' );
    if( isTC13_2OnwardsSupported ) {
        return isTC13_2OnwardsSupported.toString();
    }

    return isTC13_2OnwardsSupported.toString();
};

/**
 * This function will return the createInput information for creation of selected Type of object
 * @param {data} - data from view model to check the sub panel data
 * @param {ctx} - ctx object
 * @param {props} - react props to check the sub panel name
 * @param {edithandler} - editHandler
 */
export let getCreateObjectInfo = function( data, ctx, props, editHandler ) {
    if( !data.objCreateInfo ) {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( data.selectedType, editHandler );
    }
    var doubleProps = {};
    var boolProps = {};
    var strProps = {};
    var dateProps = {};
    var objectProps = {};

    if( data.objCreateInfo && data.objCreateInfo.props ) {
        data.objCreateInfo.props.forEach( ( vmProp ) => {
            if( vmProp.type === 'DOUBLE' && vmProp.dbValue !== null ) {
                doubleProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'BOOLEAN' && vmProp.dbValue !== null ) {
                boolProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'STRING' && vmProp.dbValue !== null ) {
                strProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'DATE' && vmProp.dbValue !== null ) {
                dateProps[ vmProp.propertyName ] = dateTimeSvc.formatUTC( vmProp.dbValue );
            }
            if( vmProp.type === 'OBJECT' && vmProp.dbValue !== null ) {
                objectProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
        } );
    }

    //handle use case for adding child/sibling function element specification
    if( ctx && ctx.selected !== null && ctx.selected !== undefined ) {
        let activeView = props.subPanelContext.data.activeView;
        if( activeView === 'Aqc0AddChildFailureSpec' ) {
            objectProps.qc0ParentFailure = ctx.selected;
        } else {
            objectProps.qc0ParentFailure = { type: ctx.selected.type, uid: ctx.selected.props.qc0ParentFailure.dbValue };
        }
    }

    var inputData = {
        boName: data.objCreateInfo.createType,
        stringProps: strProps,
        tagProps: objectProps,
        doubleProps: doubleProps,
        boolProps: boolProps,
        dateProps: dateProps
    };

    let input = [];

    input.push( {
        clientId: '',
        data: inputData
    } );
    return input;
};

/**
* This method to create save edit SOA input preperation
*
* @param dataSource Data Source
*/
export let buildInputForSaveEditingFailure = function() {
    editHandlerSvc.setActiveEditHandlerContext( 'NONE' );

    var activeEditHandler = editHandlerSvc.getActiveEditHandler();
    var dataSource = activeEditHandler.getDataSource();
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsMap = dataSource.getModifiedPropertiesMap( modifiedViewModelProperties );

    var inputs = [];
    _.forEach( modifiedPropsMap, function( modifiedObj ) {
        var modelObject;
        var viewModelObject = modifiedObj.viewModelObject;

        if( viewModelObject && viewModelObject.uid ) {
            modelObject = cdm.getObject( viewModelObject.uid );
        }

        if( !modelObject ) {
            modelObject = {
                uid: cdm.NULL_UID,
                type: 'unknownType'
            };
        }

        var viewModelProps = modifiedObj.viewModelProps;
        var input = dms.getSaveViewModelEditAndSubmitToWorkflowInput( modelObject );
        _.forEach( viewModelProps, function( props ) {
            if( Array.isArray( props.sourceObjectLastSavedDate ) ) {
                props.sourceObjectLastSavedDate = props.sourceObjectLastSavedDate[0];
            }
            dms.pushViewModelProperty( input, props );
        } );
        inputs.push( input );
    } );
    return inputs;
};

/**
 * This API is added to form the message string from the Partial error being thrown from the SOA
 */
 var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * This API is added to process the Partial error being thrown from the SOA
 *
 * @param {object} response - the response of SOA
 * @return {String} message - Error message to be displayed to user
 */
 export let populateErrorString = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if ( response && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

/**
 *  Prepares SOA input for remove attachment
 * @returns inputData
 */
 export let getSoaInputForRemoveSpecAttchments = function (primaryObject, relation, secondaryObjects) {
    var inputData = {};
    var soaInput = [];

    if (primaryObject && secondaryObjects.length > 0) {
        secondaryObjects.forEach(function (selectedObj) {
            inputData = {
                clientId: '',
                relationType: relation,
                primaryObject: primaryObject,
                secondaryObject: selectedObj
            };
            soaInput.push(inputData);
        });
    }
    return soaInput;
};

/**
 * This API is added to process the Partial error being thrown from the SOA
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
 export let processPartialErrors = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    var informationMsg = {
        compltdMsg: '',
        inProgressMsg: ''
    };

    if( response ) {
        if ( response.partialErrors ) {
            _.forEach( response.partialErrors, function( partialError ) {
                getMessageString( partialError.errorValues, msgObj );
                getInformationMessageString( partialError.errorValues, informationMsg );
            } );
        } else if(  response.ServiceData && response.ServiceData.partialErrors ) {
            _.forEach( response.ServiceData.partialErrors, function( partialError ) {
                getMessageString( partialError.errorValues, msgObj );
                getInformationMessageString( partialError.errorValues, informationMsg );
            } );
        }
    }
    if( informationMsg.compltdMsg || informationMsg.inProgressMsg ) {
        if( informationMsg.compltdMsg && informationMsg.inProgressMsg ) {
            var combinedMessage = {};
            combinedMessage += informationMsg.compltdMsg;
            combinedMessage += '<BR/>';
            combinedMessage += informationMsg.inProgressMsg;
            messagingSvc.showInfo( combinedMessage );
        }else if( informationMsg.compltdMsg ) {
            messagingSvc.showInfo( informationMsg.compltdMsg );
        }else if( informationMsg.inProgressMsg ) {
            messagingSvc.showInfo( informationMsg.inProgressMsg );
        }
    }
    return msgObj.msg;
};

/**
 * This method returns a count of the total causes/effects removed
 * @param {data} data
 * @param {response} response
 **/
 export let getRemovedObjectCount = function( response, totalSelected ) {
    if ( response ) {
        return response.partialErrors ? totalSelected - response.partialErrors.length : totalSelected;
    }
};

/**
 * This API is added to identify information message from server and display it accordningly
 *
 * @param {Object} messages - messages array
 * @param {Object} informationObj - message object
 */
 export let getInformationMessageString = function( messages, informationMsg ) {
    _.forEach( messages, function( object ) {
        if( object.code === 397103 ) {
            informationMsg.compltdMsg = object.message;
        }else if( object.code === 397102 ) {
            informationMsg.inProgressMsg = object.message;
        }
    } );
};

export default exports = {
    setAddElementInputParentElementToSelectedElement,
    updateParentElementForFailureAddSiblingPanel,
    setAddElementInputParentElementNull,
    setToggleInputToFailure,
    setPropertiesForPaste,
    getIsReleasedFlag,
    getCreateObjectInfo,
    buildInputForSaveEditingFailure,
    setEditedObjectInContextAndReset,
    populateErrorString,
    getSoaInputForRemoveSpecAttchments,
    processPartialErrors,
    getRemovedObjectCount,
    getInformationMessageString
};
