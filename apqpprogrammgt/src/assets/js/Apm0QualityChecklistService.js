// Copyright (c) 2022 Siemens

/**
 * @module js/Apm0QualityChecklistService
 */

import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import messagingService from 'js/messagingService';
import editHandlerService from 'js/editHandlerService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import _ from 'lodash';
import 'jquery';
import colorDecoratorService from 'js/colorDecoratorService';
import ProgramScheduleManagerConstants from 'js/ProgramScheduleManagerConstants';

var exports = {};

export let setSelectedChecklistSpec = function( ctx, data ) {
    let selectedChecklistSpec = {};
    selectedChecklistSpec = data.dataProviders.checklistTypeListProvider.selectedObjects[ 0 ];

    selectedChecklistSpec.object_name = data.dataProviders.checklistTypeListProvider.selectedObjects[ 0 ].props.object_name.dbValue;
    selectedChecklistSpec.object_desc = data.dataProviders.checklistTypeListProvider.selectedObjects[ 0 ].props.object_desc.dbValue;
    selectedChecklistSpec.qc0ChecklistType = data.dataProviders.checklistTypeListProvider.selectedObjects[ 0 ].props.qc0ChecklistType.dbValue;

    selectedChecklistSpec.qc0AssessmentRequired = data.dataProviders.checklistTypeListProvider.selectedObjects[ 0 ].props.qc0AssessmentRequired.dbValue;
    selectedChecklistSpec.qc0Mandatory = data.dataProviders.checklistTypeListProvider.selectedObjects[ 0 ].props.qc0Mandatory.dbValue;
    selectedChecklistSpec.qc0Number = data.dataProviders.checklistTypeListProvider.selectedObjects[ 0 ].props.qc0Number.dbValue;

    appCtxService.updateCtx( 'selectedChecklistSpec', selectedChecklistSpec );
};

/**
 * Update fnd0ActionId in data
 *
 * @param {object} data - The qualified data of the viewModel
 * @param {ctx} ctx - The qualified context of the viewModel
 */
export let updateQualityChecklistID = function( data, ctx ) {
    data.psi0ID.dbValue = ctx.QualityChecklistId;
    data.psi0ID.uiValue = ctx.QualityChecklistId;
    data.psi0ID.dbValues = ctx.QualityChecklistId;
};

/**
 * This method is used to get the LOV values for the versioning panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVList = function( response, data ) {
    var value = response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
            propDisplayDescription: obj.propDisplayValues.lov_value_descriptions ? obj.propDisplayValues.lov_value_descriptions[ 0 ] : obj.propDisplayValues.lov_values[ 0 ],
            propInternalValue: obj.propInternalValues.lov_values[ 0 ]
        };
    } );

    var updatedLovArray = [];
    for( let index = 0; index < value.length; index++ ) {
        if( value[ index ].propInternalValue === 'Checklist' ) {
            data.checklistType.dbValue = value[ index ].propInternalValue;
            data.checklistType.uiValue = value[ index ].propDisplayValue;
        }
        updatedLovArray.push( value[ index ] );
    }
    return updatedLovArray;
};

/**
 * Get the preference configured in RAC for answers options specific for 14.0 version and load them in LOV
 *
 * @param {DeclViewModel} data - The qualified data of the viewModel
 */
var loadAnswersFromPreference = function() {
    var deferred = AwPromiseService.instance.defer();
    soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: [ 'Apm0AnswerOptionsForTCVersion140' ],
        includePreferenceDescriptions: false
    } ).then( function( preferenceResult ) {
        if( preferenceResult && preferenceResult.response.length > 0 ) {
            var preferenceValues = preferenceResult.response[ 0 ].values.values;
            deferred.resolve( preferenceValues );
        } else if( preferenceResult && preferenceResult.ServiceData.partialErrors.length > 0 ) {
            deferred.reject( preferenceResult.ServiceData );
        }
    }, function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

/**
 * load answer options and values from rating rule object.
 */
var loadAnswerOptionsFromSpecification = function( checklistSpecReferenceUID, data ) {
    let deferred = AwPromiseService.instance.defer();

    let ratingRulePropName = 'qc0RatingRuleReference';
    let answerOptionPropName = 'qc0AnswerOptions';
    let answerOptionValuesPropName = 'qc0AnswerOptionValues';

    var checklistSpecObject;
    var answerOptions;
    var answerOptionValues;

    getRootChecklistSpecificationObject( checklistSpecReferenceUID ).then( function( obj ) {
        checklistSpecObject = obj;

        if( checklistSpecObject ) {
            var ratingRuleObjectUID = checklistSpecObject.props[ ratingRulePropName ].dbValues[ 0 ];
            if( ratingRuleObjectUID ) {
                var ratingObject = cdm.getObject( ratingRuleObjectUID );
                if( !ratingObject.props[ answerOptionPropName ] ) {
                    dms.getProperties( [ ratingRuleObjectUID ], [ answerOptionPropName, answerOptionValuesPropName ] ).then(
                        function() {
                            ratingObject = cdm.getObject( ratingRuleObjectUID );
                            answerOptions = ratingObject.props[ answerOptionPropName ].dbValues;
                            answerOptionValues = ratingObject.props[ answerOptionValuesPropName ].dbValues;
                            deferred.resolve( {
                                answerOptions: answerOptions,
                                answerOptionValues: answerOptionValues
                            } );
                        }
                    );
                } else {
                    answerOptions = ratingObject.props[ answerOptionPropName ].dbValues;
                    answerOptionValues = ratingObject.props[ answerOptionValuesPropName ].dbValues;
                    deferred.resolve( {
                        answerOptions: answerOptions,
                        answerOptionValues: answerOptionValues
                    } );
                }
            } else {
                var msg = '';
                msg = msg.concat( data.i18n.Apm0AnswerConfigUnavailable );
                deferred.reject( msg );
            }
        }
    } );
    return deferred.promise;
};

var getRootChecklistSpecificationObject = function( parentChecklistUID ) {
    let deferred = AwPromiseService.instance.defer();

    var checklistSpecObject = null;

    checklistSpecObject = cdm.getObject( parentChecklistUID );
    //check if qc0ParentChecklistSpec property exists in object
    if( checklistSpecObject.props && checklistSpecObject.props.hasOwnProperty( 'qc0ParentChecklistSpec' ) ) {
        parentChecklistUID = checklistSpecObject.props.qc0ParentChecklistSpec.dbValues[ 0 ];

        if( parentChecklistUID ) {
            return getRootChecklistSpecificationObject( parentChecklistUID );
        }
        deferred.resolve( checklistSpecObject );
    } else {
        //qc0ParentChecklistSpec property does not exist. Need to get properties.
        dms.getProperties( [ parentChecklistUID ], [ 'qc0ParentChecklistSpec', 'qc0RatingRuleReference' ] ).then(
            function() {
                checklistSpecObject = cdm.getObject( parentChecklistUID );
                parentChecklistUID = checklistSpecObject.props.qc0ParentChecklistSpec.dbValues[ 0 ];

                if( parentChecklistUID ) {
                    //recursive function call to load parent checklist object
                    getRootChecklistSpecificationObject( parentChecklistUID ).then(
                        function( obj ) {
                            deferred.resolve( obj );
                        }
                    );
                } else {
                    deferred.resolve( checklistSpecObject );
                }
            }
        );
    }

    return deferred.promise;
};

export let bindProperties = function( subPanelContext ) {
    let newApm0Answer = { ...subPanelContext.selected.props.apm0Answer };
    newApm0Answer.isArray = false;
    newApm0Answer.isEditable = false;
    newApm0Answer.type = 'STRING';
    newApm0Answer.isSelectOnly = true;
    newApm0Answer.dataProvider = 'QualityChecklistAnswerOptionDataProvider';
    newApm0Answer.hasLov = true;
    //set LastSavedDate cause of bug in framework
    if(subPanelContext.selected.props.last_mod_date)
    {
        newApm0Answer.sourceObjectLastSavedDate = subPanelContext.selected.props.last_mod_date.dbValues[ 0 ];
    }

    return newApm0Answer;
};

export let getChecklistSpecReference = function(selected) {

    var checklistSpecRefId;
   //check if realized Quality checklist has reference of checklist specification( checklist masterData)
   if(selected.props.apm0ChecklistSpecReference.dbValues[ 0 ] !== null)
   {
    checklistSpecRefId = selected.props.apm0ChecklistSpecReference.dbValues[ 0 ];
   }
   else
   {
    if( selected.props && selected.props.hasOwnProperty( 'apm0ParentChecklist' ) ) {
        var parentChecklistUID = selected.props.apm0ParentChecklist.dbValues[ 0 ];

        var parentQualityChecklistObject = cdm.getObject( parentChecklistUID );
        
        if(parentQualityChecklistObject.props.apm0ChecklistSpecReference.dbValues[ 0 ] !== null)
        {
            checklistSpecRefId = parentQualityChecklistObject.props.apm0ChecklistSpecReference.dbValues[ 0 ];
        }
        else
        {
            checklistSpecRefId = getChecklistSpecReference(parentQualityChecklistObject);
        }
    }
  }

  return checklistSpecRefId;
};

export let qualityChecklistEditAnswersOptions = function( tcSessionData, data, subPanelContext ) {
    var activeEditHandler = null;
    var enabled = false;
    if( subPanelContext.xrtType === 'SUMMARY' && appCtxService.getCtx( 'NONE' ) && appCtxService.getCtx( 'NONE._editing' ) === true ) {
        activeEditHandler = editHandlerService.getEditHandler( 'NONE' );
    } else if( subPanelContext.xrtType === 'SUMMARY' && appCtxService.getCtx( 'NONE' ) ) {
        enabled = editHandlerService.isEditEnabled( 'NONE' );
        if( enabled ) {
            activeEditHandler = editHandlerService.getEditHandler( 'NONE' );
        }
    }
    if( subPanelContext.xrtType === 'INFO' && appCtxService.getCtx( 'INFO_PANEL_CONTEXT' ) && appCtxService.getCtx( 'INFO_PANEL_CONTEXT._editing' ) === true ) {
        activeEditHandler = editHandlerService.getEditHandler( 'INFO_PANEL_CONTEXT' );
    } else if( subPanelContext.xrtType === 'INFO' && appCtxService.getCtx( 'INFO_PANEL_CONTEXT' ) ) {
        enabled = editHandlerService.isEditEnabled( 'INFO_PANEL_CONTEXT' );
        if( enabled ) {
            activeEditHandler = editHandlerService.getEditHandler( 'INFO_PANEL_CONTEXT' );
        }
    }
    if( activeEditHandler ) {
        var deferred = AwPromiseService.instance.defer();
        if( activeEditHandler.editInProgress() ) {
            let newApm0Answer = { ...data.answerOption };
            // set answerOption to editable
            newApm0Answer.isEditable = activeEditHandler.editInProgress();
            // load LOV Values
            if( tcSessionData.tcMajorVersion > 14 || tcSessionData.tcMajorVersion === 14 && tcSessionData.tcMinorVersion >= 1 ) {
                // Retrieve Answer options from checklist spec reference
                //retrieve answer options for adhoc question find quality check which has ChecklistSpecificationReference attached
                var checklistSpecReferenceUID = getChecklistSpecReference(subPanelContext.selected);
                loadAnswerOptionsFromSpecification( checklistSpecReferenceUID, data ).then( function( response ) {
                    var lovEntries = [];
                    var lovinput = response.answerOptions;
                    var lovinputValue = response.answerOptionValues;

                    for( let i = 0; i < lovinput.length; i++ ) {
                        var internalValue = lovinput[ i ];
                        var displayValue = lovinput[ i ];
                        var displayDescription = 'Value: ' + lovinputValue[ i ];

                        var isSelected = newApm0Answer.dbValue === internalValue;

                        lovEntries.push( {
                            propDisplayValue: displayValue,
                            propInternalValue: internalValue,
                            propDisplayDescription: displayDescription,
                            hasChildren: false,
                            children: {},
                            sel: isSelected
                        } );
                    }

                    deferred.resolve( {
                        answerOption: newApm0Answer,
                        answerOptions: lovEntries
                    } );
                },
                function( error ) {
                    messagingService.showError( error );
                } );
            } else if( tcSessionData.tcMajorVersion === 14 && tcSessionData.tcMinorVersion === 0 ) {
                loadAnswersFromPreference().then( function( preferenceValues ) {
                    var lovEntries = [];
                    _.forEach( preferenceValues, optionString => {
                        if( optionString.includes( ':' ) ) {
                            var answerTextToken = optionString.split( ':' );
                            var answerDesc = answerTextToken[ 1 ];
                            if( answerDesc.trim() !== '' ) {
                                lovEntries.push( {
                                    propDisplayValue: answerTextToken[ 0 ],
                                    propInternalValue: answerTextToken[ 0 ],
                                    propDisplayDescription: answerDesc,
                                    hasChildren: false,
                                    children: {}
                                } );
                            } else {
                                lovEntries.push( {
                                    propDisplayValue: answerTextToken[ 0 ],
                                    propInternalValue: answerTextToken[ 0 ],
                                    hasChildren: false,
                                    children: {}
                                } );
                            }
                        }
                    } );
                    deferred.resolve( {
                        answerOption: newApm0Answer,
                        answerOptions: lovEntries
                    } );
                }, function( error ) {
                    var errMessage = messagingService.getSOAErrorMessage( error );
                    messagingService.showError( errMessage );
                } );
            }
        } else {
            let newApm0Answer = bindProperties(subPanelContext);
            deferred.resolve( {
                answerOption: newApm0Answer,
                answerOptions: null
            } );
        }
        return deferred.promise;
    }
};

export let qualityChecklistAnswerChangeAction = function( data, subPanelContext ) {
    if( subPanelContext.xrtType === 'SUMMARY' && appCtxService.getCtx( 'NONE' ) && appCtxService.getCtx( 'NONE._editing' ) === true || subPanelContext.xrtType === 'INFO' && appCtxService.getCtx( 'INFO_PANEL_CONTEXT' ) && appCtxService.getCtx( 'INFO_PANEL_CONTEXT._editing' ) === true ) {
        let newApm0Answer = { ...data.answerOption };
        //update LastSavedDate cause of bug in framework
        newApm0Answer.sourceObjectLastSavedDate = subPanelContext.selected.props.last_mod_date.dbValues[ 0 ];
        return newApm0Answer;
    }
};

/**
  * This function will return the createInput information for creation of selected Type of object
  * @param {data} - data from view model to check the sub panel data
  */
export let getCreateInputDataForRootLevelQualityChecklist = function( data, ctx ) {
    var inputData = [];
    var dataVal = {};
    dataVal = {
        boName: "Apm0QualityChecklist",
        //data.creationType.props.type_name.dbValues[ 0 ],
        stringProps: {
            psi0ID: data.psi0ID.dbValue,
            object_name: ctx.selectedChecklistSpec.object_name,
            object_desc: ctx.selectedChecklistSpec.object_desc,
            apm0ChecklistType: ctx.selectedChecklistSpec.qc0ChecklistType,
            apm0Number: ctx.selectedChecklistSpec.qc0Number
        },   
        boolProps: {
            apm0AssessmentRequired: ctx.selectedChecklistSpec.qc0AssessmentRequired,
            apm0Mandatory: ctx.selectedChecklistSpec.qc0Mandatory
        },
        tagProps: {
            apm0ChecklistSpecReference: ctx.selectedChecklistSpec
        }
    };

    if( ctx.tcSessionData.tcMajorVersion >= 14 && ctx.tcSessionData.tcMinorVersion >= 3) {
        dataVal.stringProps.apm0ChecklistArea = ctx.selectedChecklistSpec.props.qc0ChecklistArea.dbValue;
        dataVal.stringProps.apm0IndustryStandard = ctx.selectedChecklistSpec.props.qc0IndustryStandard.dbValue;
    }

    var input = {
        clientId: '',
        data: dataVal
    };
    inputData.push( input );

    return inputData;
};
export let getIsReleased = function(ctx){
    var flag = 'false';
    if( ctx.tcSessionData.tcMajorVersion > 14 || ctx.tcSessionData.tcMajorVersion === 14 && 
        ctx.tcSessionData.tcMinorVersion >= 3 ) {
        flag = 'true';
    }
    return flag;
};

export let groupObjectsForDecorators = function( vmos ) {
    exports.setDecoratorStyles( vmos, false );
};

/**
 * Method to set Grid and Cell Decorator style to vmo
 * @param {ViewModelObject} vmos - Array of tree nodes of quality audit tree
 */
export let setDecoratorStyles = function( vmos ) {
    if( vmos && vmos.length > 0 ) {
        var rygObjectTags = vmos.map( obj => obj.props.apm0RatedReference.dbValues[0] );
        var rygObjects = cdm.getObjects( rygObjectTags );
        var rygObjectsWOProps = rygObjects.filter( rygObjectFilter );

        if( rygObjectsWOProps && rygObjectsWOProps.length > 0 ) {
            dms.getProperties( rygObjectsWOProps.map( obj=> obj.uid ), [ 'apm0RatedObject', 'apm0Rating' ] ).then( () => setDecoratorStylesInner( vmos, rygObjects ) );
        } else {
            setDecoratorStylesInner( vmos, rygObjects );
        }
    }
};

var setDecoratorStylesInner = function( vmos, rygObjects ) {
    var objectsToDecorate = [];
    _.forEach( vmos, function( mod ) {
        var rygObject;
        var vmto;
        if( mod.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 ) {
            let rygtag = mod.props.apm0RatedReference.dbValues[0];
            rygObject = rygObjects.find( obj=> obj.uid === rygtag );
            vmto = mod;
        }
        if( rygObject && vmto ) {
            objectsToDecorate.push( {
                rygObject: rygObject,
                viewModelTreeNode: vmto
            } );
        }
    } );
    if( objectsToDecorate && objectsToDecorate.length > 0 ) {
        setRYGDecorators( objectsToDecorate );
        colorDecoratorService.setDecoratorStyles( objectsToDecorate.map( obj => obj.viewModelTreeNode ) );
    }
};

var setRYGDecorators = function( objectsToDecorate ) {
    _.forEach( objectsToDecorate, function( objInArr ) {
        var rygValue = objInArr.rygObject.props.apm0Rating.dbValues[ 0 ];
        if( rygValue ) {
            var rygDecoratorMap = ProgramScheduleManagerConstants.RYG_DECORATOR_STYLE;
            if( rygDecoratorMap && rygDecoratorMap[ rygValue ].cellDecoratorStyle ) {
                objInArr.viewModelTreeNode.cellDecoratorStyle = rygDecoratorMap[ rygValue ].cellDecoratorStyle;
            }
            if( rygDecoratorMap && rygDecoratorMap[ rygValue ].gridDecoratorStyle ) {
                objInArr.viewModelTreeNode.gridDecoratorStyle = rygDecoratorMap[ rygValue ].gridDecoratorStyle;
            }
        } else {
            objInArr.viewModelTreeNode.cellDecoratorStyle = '';
            objInArr.viewModelTreeNode.gridDecoratorStyle = '';
        }
    } );
};

var rygObjectFilter = function( obj ) {
    return obj.modelType.typeHierarchyArray.indexOf( 'Apm0RYG' ) > -1 && !( obj.props && obj.props.hasOwnProperty( 'apm0RatedObject' ) && obj.props.hasOwnProperty( 'apm0Rating' ) );
};

var setDecoratorStylesOnModifiedObjectsInner = function( filteredVmos, modifiedObjects ) {
    var objectsToDecorate = [];
    _.forEach( modifiedObjects, function( mod ) {
        var rygObject;
        var vmto;
        if( mod.modelType.typeHierarchyArray.indexOf( 'Apm0RYG' ) > -1 ) {
            rygObject = mod;
            vmto = filteredVmos.find( obj => obj.uid === mod.props.apm0RatedObject.dbValues[0] );
        } else if( mod.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 ) {
            rygObject = cdm.getObject( mod.props.apm0RatedReference.dbValues[0] );
            vmto = filteredVmos.find( vmo => vmo.uid === mod.uid );
        }
        if( rygObject && vmto ) {
            objectsToDecorate.push( {
                rygObject: rygObject,
                viewModelTreeNode: vmto
            } );
        }
    } );

    if( objectsToDecorate && objectsToDecorate.length > 0 ) {
        setRYGDecorators( objectsToDecorate );
        colorDecoratorService.setDecoratorStyles( objectsToDecorate.map( obj => obj.viewModelTreeNode ) );
    }
};

/**
 * Method to set Grid and Cell Decorator style to vmo which are modified
 * @param {ViewModelObject} vmos - Array of tree nodes of quality audit tree
 * @param {ViewModelObject} clearStyles - Array of tree nodes which are modified and need to update the style
 */
export let setDecoratorStylesOnModifiedObjects = function( vmos, modifiedObjects ) {
    vmos = vmos.filter( vmo => vmo.modelType.typeHierarchyArray.indexOf( 'Awp0XRTObjectSetRow' ) === -1 );
    var rygObjects = modifiedObjects ? modifiedObjects.filter( rygObjectFilter ) : null;

    if( rygObjects && rygObjects.length > 0 ) {
        dms.getProperties( rygObjects.map( obj=> obj.uid ), [ 'apm0RatedObject', 'apm0Rating' ] ).then( () => setDecoratorStylesOnModifiedObjectsInner( vmos, modifiedObjects ) );
    } else if( modifiedObjects && Array.isArray( modifiedObjects ) && modifiedObjects.length > 0 ) {
        setDecoratorStylesOnModifiedObjectsInner( vmos, modifiedObjects );
    }
};

export let getCreateObjectInputXRT = function( data, addPanelState, editHandler, parentObject) {
    var input = addObjectUtils.getCreateInput( data, null, addPanelState.creationType, editHandler );
    
    //Customization (if required)
    //setting parent checklist
    if(parentObject && parentObject[0] && parentObject[0].uid) {
        let parentObjUidArray = [];
        parentObjUidArray.push(parentObject[0].uid); 
        input[ 0 ].createData.propertyNameValues.apm0ParentChecklist = parentObjUidArray;
    }
    
    return input;
};
export default exports = {
    setSelectedChecklistSpec,
    updateQualityChecklistID,
    getLOVList,
    qualityChecklistEditAnswersOptions,
    qualityChecklistAnswerChangeAction,
    bindProperties,
    getCreateInputDataForRootLevelQualityChecklist,
    getIsReleased,
    setDecoratorStyles,
    setDecoratorStylesOnModifiedObjects,
    groupObjectsForDecorators,
    getCreateObjectInputXRT
};
