// Copyright (c) 2022 Siemens

/**
 * @module js/Psi0AddChecklistQuestionService
 */
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import selectionService from 'js/selection.service';
import appCtxService from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import AwPromiseService from 'js/awPromiseService';
import soa_dataManagementService from 'soa/dataManagementService';
import editHandlerSvc from 'js/editHandlerService';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import addObjectUtils from 'js/addObjectUtils';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import ProgramScheduleManagerConstants from 'js/ProgramScheduleManagerConstants';

var saveHandler = {};

var exports = {};

var m_openedObj = null;

/**
 * Get save handler.
 *
 * @return Save Handler
 */
export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * Get save handler.
 *
 * @return Save Handler
 */
saveHandler.saveEdits = function( dataSource ) {
    var deferred = AwPromiseService.instance.defer();
    var selection = appCtxService.getCtx( 'mselected' );
    var activeEditHandler = editHandlerSvc.getActiveEditHandler();
    //var dataSource = activeEditHandler.getDataSource();
    m_openedObj = selection[ 0 ];
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsWithoutSubProp = dataSource.getModifiedPropertiesMap( modifiedViewModelProperties );
    var inputs = [];
    var AnswerFlag = false;
    var queNumber = [];
    var questionNumberArray = [];
    var lastQuestionNumber;

    for( var i in modifiedPropsWithoutSubProp ) {
        var viewModelObj = modifiedPropsWithoutSubProp[ i ].viewModelObject;

        var input = soa_dataManagementService.getSaveViewModelEditAndSubmitToWorkflowInput( viewModelObj );

        modifiedPropsWithoutSubProp[ i ].viewModelProps.forEach( function( modifiedVMProperty ) {
           
            if( (modifiedVMProperty.propertyName === 'psi0IsMandatory' || modifiedVMProperty.propertyName === 'psi0Answer') && 
                ( (viewModelObj.props.psi0IsMandatory.dbValue === true ) && 
                  (viewModelObj.props.psi0Answer.dbValues[ 0 ] === 'NA' || modifiedVMProperty.newValue === 'NA') ) ) {
                if(viewModelObj.props.psi0Answer.value !== 'Y' &&
                   viewModelObj.props.psi0Answer.value !== 'N') {
                    viewModelObj.props.psi0Answer.dbValue = '';
                    viewModelObj.props.psi0Answer.newValue = '';
                } else {
                    viewModelObj.props.psi0Answer.dbValue = viewModelObj.props.psi0Answer.value;
                    viewModelObj.props.psi0Answer.newValue = viewModelObj.props.psi0Answer.value;
                }
                AnswerFlag = true;
                if( !queNumber.includes(viewModelObj.props.psi0QuestionNumber.dbValues[ 0 ])){
                    queNumber.push( viewModelObj.props.psi0QuestionNumber.dbValues[ 0 ] );
                }
                soa_dataManagementService.pushViewModelProperty( input, viewModelObj.props.psi0Answer );
            }

            soa_dataManagementService.pushViewModelProperty( input, modifiedVMProperty );
            //setRYGDecorator( viewModelObj );
        } );
        inputs.push( input );
    }
    var index;
    if( queNumber.length > 1 ) {
        for( index = 0; index < queNumber.length - 1; index++ ) {
            questionNumberArray.push( queNumber[ index ] );
        }
    }
    lastQuestionNumber = queNumber.pop();

    var saveEditInput = {
        inputs
    };

    if( activeEditHandler ) {
        activeEditHandler.saveEditsPostActions( true );
    }
    exports.callSaveEditSoa( saveEditInput ).then( function() {
        refreshSelectedObjects( activeEditHandler, AnswerFlag, lastQuestionNumber, questionNumberArray );
        deferred.resolve();
    }, function( err ) {
        deferred.reject();
    } );
    return deferred.promise;
};

/**
 * Call Versioning SOA for specifications and handle success and failure cases
 *@param {Input} input
 * @return  {Response} promise when all modified Function Specification properties get saved
 */
export let callSaveEditSoa = function( input ) {
    return soaSvc.post( 'Internal-AWS2-2018-05-DataManagement', 'saveViewModelEditAndSubmitWorkflow2', input ).then(
        function( response ) {
            return response;
        },
        function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            throw error;
        }
    );
};

/**
 * Set context to select node after edit complete and reset primary work area
 * @param {ActiveEditHandler} activeEditHandler current active edit handler
 */
var refreshSelectedObjects = function( activeEditHandler, AnswerFlag, lastQuestionNumber, questionNumberArray ) {
    if( activeEditHandler ) {
        activeEditHandler.saveEditsPostActions( true );
    }

    var resource = 'PrgScheduleManagerMessages';
    var localTextBundle = localeService.getLoadedText( resource );

    if( AnswerFlag === true && questionNumberArray.length === 0 ) {
        var errMsg1 = localTextBundle.SaveEditSingleChecklistQuestionErrorMsg;
        messagingService.showError( errMsg1.replace( '{0}', lastQuestionNumber ) );
    } else if( AnswerFlag === true && questionNumberArray.length >= 1 ) {
        var errMsg2 = localTextBundle.SaveEditMultipleChecklistQuestionErrorMsg;
        messagingService.showError( errMsg2.replace( '{0}', questionNumberArray ).replace( '{1}', lastQuestionNumber ) );
    }
    eventBus.publish( 'cdm.relatedModified', {
        refreshLocationFlag: true,
        relatedModified: [ appCtxService.getCtx( 'xrtSummaryContextObject' ) ]
    } );
};

/**
 * Returns dirty bit.
 * @returns {Boolean} isDirty bit
 */
saveHandler.isDirty = function( dataSource ) {
    var modifiedPropCount = dataSource.getAllModifiedProperties().length;
    if( modifiedPropCount === 0 ) {
        return false;
    }
    return true;
};

/**


/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {dateObject} dateObject - The date object
 * @return {dateValue} The date string value
 */
export let getDateString_DueDate = function( dateObject ) {
    var dateValue = {};
    dateValue = dateTimeSvc.formatUTC( dateObject );
    return dateValue;
};

/**
 * Return the Primary object(checklist) of ChecklistQuestion
 *
 * @param {ctx} contextObject - Context Object
 */
export let getParentChecklist = function( ctx ) {
    var checklistParent;

    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Psi0Checklist' ) > -1 ) {
        checklistParent = ctx.selected.uid;
    } else {
        checklistParent = ctx.pselected.uid;
    }
    return checklistParent;
};

/**
 * Return the input for Primary object for createRelations SOA call
 *
 * @param {ctx} contextObject - Context Object
 */
export let getPrimaryObject = function( ctx ) {
    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Psi0Checklist' ) > -1 ) {
        return ctx.selected;
    }

    return ctx.pselected;
};

/**
 * Add the selected object to data
 *
 * @param {object} data - The qualified data of the viewModel
 * @param {object} selection - The selected object
 */
export let addSelectedObject = function( data, selection ) {
    if( selection && selection[ 0 ] ) {
        data.selectedObject = selection[ 0 ];
    } else {
        data.selectedObject = null;
    }
};

/**
 * Perform the paste behavior for the IModelObjects from schedulemanager/paste.json onto the given 'target'
 * IModelObject creating the given relationship type between them.
 *
 * @param {Object} targetObject - The 'target' IModelObject for the paste.
 * @param {Array} sourceObjects - Array of 'source' IModelObjects to paste onto the 'target' IModelObject
 * @param {String} relationType - relation type name (object set property name)
 *
 */
export let psi0DefaultPasteHandler = function( targetObject, sourceObjects, relationType ) {
    if( targetObject.uid !== sourceObjects[ 0 ].props.psi0ParentChecklist.dbValues[ 0 ] ) {
        var resource = 'PrgScheduleManagerMessages';
        var localTextBundle = localeService.getLoadedText( resource );
        var errMsg = localTextBundle.moveChecklistQuestion;
        messagingService.showError( errMsg );
        throw 'Question was not moved across checklists because question is always unique to a checklist.';
    }
};

/**
 * method throws error if isMandatory property on Checklist Question object is True and User sets Answer property to NA.
 * Update Answer property to NULL if Modified property for Mandary Question is True and Answer property already Set to NA.
 * method covers User sould not be able to Save Answer to Mandary Question as NS from Info panel
 *
 * @param {Boolean} InfoPanel - true if the Save operation perfromed from Info Panel.
 * @returns {Object} Returns inputData to saveViewModelEditAndSubmitWorkflow SOA call
 */
export let saveEditsChecklistQuestionOperation = function( InfoPanel ) {
    if( InfoPanel ) {
        editHandlerSvc.setActiveEditHandlerContext( 'INFO_PANEL_CONTEXT' );
    }
    var activeEditHandler = editHandlerSvc.getActiveEditHandler();
    var dataSource = activeEditHandler.getDataSource();
    var selection = appCtxService.getCtx( 'mselected' );
    m_openedObj = selection[ 0 ];
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsWithoutSubProp = dataSource.getModifiedPropertiesMap( modifiedViewModelProperties );
    var inputs = [];
    var AnswerFlag = false;
    var queNumber = [];
    var questionNumberArray = [];
    var lastQuestionNumber;

    for( var i in modifiedPropsWithoutSubProp ) {
        var viewModelObj = modifiedPropsWithoutSubProp[ i ].viewModelObject;

        var input = soa_dataManagementService.getSaveViewModelEditAndSubmitToWorkflowInput( viewModelObj );

        modifiedPropsWithoutSubProp[ i ].viewModelProps.forEach( function( modifiedVMProperty ) {
            //for each prop
            if( modifiedVMProperty.propertyName === 'psi0Answer' && modifiedVMProperty.newValue === 'NA' && ( viewModelObj.props.psi0IsMandatory.dbValues[ 0 ] === '1' || viewModelObj.props.psi0IsMandatory.dbValues[ 0 ] === true ) ) {
                modifiedVMProperty.dbValue = modifiedVMProperty.value;
                modifiedVMProperty.newValue = modifiedVMProperty.value;

                AnswerFlag = true;
                queNumber.push( viewModelObj.props.psi0QuestionNumber.dbValues[ 0 ] );
            }
            if( modifiedVMProperty.propertyName === 'psi0IsMandatory' && modifiedVMProperty.newValue === true && viewModelObj.props.psi0Answer.dbValues[ 0 ] === 'NA' ) {
                viewModelObj.props.psi0Answer.dbValue = '';
                viewModelObj.props.psi0Answer.newValue = '';

                AnswerFlag = true;
                queNumber.push( viewModelObj.props.psi0QuestionNumber.dbValues[ 0 ] );
                soa_dataManagementService.pushViewModelProperty( input, viewModelObj.props.psi0Answer );
            }

            soa_dataManagementService.pushViewModelProperty( input, modifiedVMProperty );
            //setRYGDecorator( viewModelObj );
        } );
        inputs.push( input );
    }
    var index;
    if( queNumber.length > 1 ) {
        for( index = 0; index < queNumber.length - 1; index++ ) {
            questionNumberArray.push( queNumber[ index ] );
        }
    }
    lastQuestionNumber = queNumber.pop();

    var response = {
        inputs: inputs,
        AnswerFlag: AnswerFlag,
        questionNumberArray: questionNumberArray,
        lastQuestionNumber: lastQuestionNumber
    };
    if( InfoPanel && activeEditHandler ) {
        activeEditHandler.saveEditsPostActions( true );
        refreshSelectedObjects( activeEditHandler, AnswerFlag, lastQuestionNumber, questionNumberArray );
    }
    return response;
};

/**
 * Method to set Grid and Cell Decorator style to vmo through Constant Map
 * @param {ViewModelObject} vmo - ViewModelObject(s) to set style on
 */

var setRYGDecorator = function( vmo ) {
    if ( vmo.props.apm0RatedReference ) {
        var targetUid = vmo.props.apm0RatedReference.dbValues;
        var targetObj = cdm.getObject( targetUid );
        var propsToLoad = [ 'apm0Rating' ];
        var uidArr = [ targetUid ];

        soa_dataManagementService.getProperties( uidArr, propsToLoad )
            .then(
                function() {
                    var rygValue = targetObj.props.apm0Rating.dbValues[ 0 ];
                    if( targetObj.props.apm0Rating.valueUpdated === true || rygValue ) {
                        if ( rygValue ) {
                            var rygDecoratorMap = ProgramScheduleManagerConstants.RYG_DECORATOR_STYLE;
                            if ( rygDecoratorMap && rygDecoratorMap[ rygValue ].cellDecoratorStyle ) {
                                vmo.cellDecoratorStyle = rygDecoratorMap[ rygValue ].cellDecoratorStyle;
                            }
                            if ( rygDecoratorMap && rygDecoratorMap[ rygValue ].gridDecoratorStyle ) {
                                vmo.gridDecoratorStyle = rygDecoratorMap[ rygValue ].gridDecoratorStyle;
                            }
                        } else {
                            vmo.cellDecoratorStyle = '';
                            vmo.gridDecoratorStyle = '';
                        }
                    }
                }
            );
    }
};

export let getInputForCreateObject = function( data, ctx, creationType, editHandler ) {
    var input = addObjectUtils.getCreateInput( data, null, creationType, editHandler );
    //Set the Parent Checklist
    var checklistParent;
    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Psi0Checklist' ) > -1 ) {
        checklistParent = ctx.selected.uid;
    } else {
        checklistParent = ctx.pselected.uid;
    }
    input[ 0 ].createData.propertyNameValues.psi0ParentChecklist = [ checklistParent ];
    input[ 0 ].pasteProp = 'psi0ChecklistQuestions';
    if( ctx.ViewModeContext.ViewModeContext === 'TableView' || ctx.ViewModeContext.ViewModeContext === 'ListView' ) {
        input[ 0 ].targetObject = {
            uid: ctx.mselected[0].uid,
            type: ctx.mselected[0].type
        };
    } else {
        input[ 0 ].targetObject = {
            uid: ctx.xrtSummaryContextObject.uid,
            type: ctx.xrtSummaryContextObject.type
        };
    }

    return input;
};

export default exports = {
    getSaveHandler,
    callSaveEditSoa,
    getDateString_DueDate,
    getParentChecklist,
    addSelectedObject,
    psi0DefaultPasteHandler,
    saveEditsChecklistQuestionOperation,
    getInputForCreateObject,
    getPrimaryObject
};
