/* eslint-disable max-lines */
// Copyright (c) 2021 Siemens

/**
 * Module for the Import Specification panel for Word
 *
 * @module js/Arm0ImportFromWord
 */

import messagingService from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import notyService from 'js/NotyModule';
import requirementsUtils from 'js/requirementsUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import { image } from 'd3-fetch';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';

var exports = {};

var _ruleName = null;
var _ruleScope = null;
var PROP_RULE_CONST = 'Arm0AddRulesSub.selectedPropRule';
var RULE_CONST = 'Arm0AddRulesSub.selectedRule';
var RULE_ERROR_CONST = 'importSpecification.showAddRuleError';
var PROP_RULE_ERROR_CONST = 'importSpecification.showAddPropRuleError';
var CONDITION_ERROR = 'importSpecification.showAddConditionError';

// Form data of the selected file, required on Update Preview in case of PDF
var _formData;

/**
 * Show leave warning message in Preview Screen
 *
 * @param {Object} data - The view model data
 * @param {Object} fileName - Selected file for import
 */
export let closeImportPreview = function( data ) {
    var fileName = data.fileName;
    if( fileName && data && data.i18n && data.i18n.notificationForPreviewClose ) {
        var msg = data.i18n.notificationForPreviewClose.replace( '{0}', fileName );
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: data.i18n.stayTitle,
            onClick: function( $noty ) {
                $noty.close();
            }
        }, {
            addClass: 'btn btn-notify',
            text: data.i18n.closeTitle,
            onClick: function( $noty ) {
                $noty.close();
                eventBus.publish( 'importPreview.navigateToBack' );
            }
        } ];

        messagingService.showWarning( msg, buttons );
    }
};

/**
 * Proxy function to publish closeImportPreview event
 */
export let closeImportPreviewProxyFunction = function() {
    eventBus.publish( 'Arm0ImportPreview.closeImportPreview' );
};

var _isSentenceBeginOnNewLineRuleAdded = function( data ) {
    var isSentenceBeginOnNewLineRuleAdded = false;
    for( var i = 0; i < data.operationTypeValues.dbValue.length; i++ ) {
        if( data.operationTypeValues.dbValue[ i ].propInternalValue === 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
            isSentenceBeginOnNewLineRuleAdded = true;
        }
    }
    return isSentenceBeginOnNewLineRuleAdded;
};
/**
 * revealArm0AddRulesSub for reveal of Arm0AddRulesSub panel.
 *
 * @param {Object} data - The view model data
 */
export let revealArm0AddRulesSub = function( data, ctx, sharedData ) {
    //var selectedRule = ctx.Arm0AddRulesSub.selectedRule;
    const sharedDataValue = { ...sharedData.value };

    var selectedRule =  sharedDataValue.RULE_CONST;
    var importRules =  sharedDataValue.importRules;
    var conditionOfRuleMap = {};
    if ( sharedDataValue.conditionOfRuleMap ) {
        conditionOfRuleMap = sharedDataValue.conditionOfRuleMap;
    }

    var addConditionList = [];
    var conditionVMOs = [];
    var operationTypeValues =  _.clone( data.operationTypeValues );
    var operationSubTypeValues =  _.clone( data.operationSubTypeValues );
    var operationSubType = _.clone( data.operationSubType );
    var tempPropRuleArray = [];
    var importType = _.clone( data.importType );
    //var dispPropRules = sharedDataValue.dispPropRules;
    var dispPropRules = [];
    var operationValues = _.clone( data.operationValues );
    var style = _.clone( data.style );
    var operationType = _.clone( data.operationType, true );
    var operationCheckboxValues = _.clone( data.operationCheckboxValues, true );
    var styleValues =  _.clone( data.styleValues, true );

    if( selectedRule !== null && selectedRule !== undefined && selectedRule.keywordImportConditions ) {
        //while editing other rules than "SENTENCE_BEGIN_ON_NEW_LINE" delete this rule from list if already added
        for( let index = 0; index < selectedRule.keywordImportConditions.length; index++ ) {
            if( !selectedRule || selectedRule && selectedRule.keywordImportConditions[ index ].opType !== 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
                if( conditionOfRuleMap && conditionOfRuleMap.SENTENCE_BEGIN_ON_NEW_LINE ) {
                    for( var i = data.operationTypeValues.dbValue.length - 1; i >= 0; i-- ) {
                        if( data.operationTypeValues.dbValue[ i ].propInternalValue === 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
                            operationTypeValues.dbValue.splice( i, 1 );
                        }
                    }
                }
            }
            var isSentenceBeginOnNewLineRuleAdded = _isSentenceBeginOnNewLineRuleAdded( data );
            //Add rule back to list if user wants to edit "SENTENCE_BEGIN_ON_NEW_LINE" rule
            if( selectedRule && selectedRule.keywordImportConditions[ index ].opType === 'SENTENCE_BEGIN_ON_NEW_LINE' && !isSentenceBeginOnNewLineRuleAdded ) {
                var sentenceBeginOnNewLineModel = _getEmptyListModel();
                sentenceBeginOnNewLineModel.propDisplayValue = data.i18n.sentenceBeginOnNewLine;
                sentenceBeginOnNewLineModel.propInternalValue = 'SENTENCE_BEGIN_ON_NEW_LINE';
                operationTypeValues.dbValue.push( sentenceBeginOnNewLineModel );
            }
        }
    }else{
        //while adding new rule check and delete "SENTENCE_BEGIN_ON_NEW_LINE" rule if already added
        var isSentenceBeginOnNewLineRuleAdded = _isSentenceBeginOnNewLineRuleAdded( data );
        if( isSentenceBeginOnNewLineRuleAdded && conditionOfRuleMap && conditionOfRuleMap.SENTENCE_BEGIN_ON_NEW_LINE ) {
            for( var i = data.operationTypeValues.dbValue.length - 1; i >= 0; i-- ) {
                if( data.operationTypeValues.dbValue[ i ].propInternalValue === 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
                    operationTypeValues.dbValue.splice( i, 1 );
                }
            }
        }
    }
    // remove style rule in case of pdf import
    if( appCtxSvc.ctx && appCtxSvc.ctx.isArm0ImportFromPDFSubPanelActive && data.operationTypeValues && data.operationTypeValues.dbValues ) {
        operationTypeValues.dbValues.splice( _.findIndex( data.operationTypeValues.dbValues, function( item ) {
            return item.propInternalValue === 'Has_Style';
        } ), 1 );
    }
    var index = 0;
    if( sharedData.reqSpecEleTypeList ) {
        for( var j = 0; j < sharedData.reqSpecEleTypeList.length; j++ ) {
            var output1 = sharedData.reqSpecEleTypeList[ j ];

            if( output1.propInternalValue === 'Requirement' ) {
                index = j;
            }
        }
    }

    if( appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' )[ 0 ] === 'true' ) {
        if( selectedRule && sharedData.importRules.length > 0 ) {
            importType.dbValue = selectedRule.targetChildType;
            importType.uiValue = selectedRule.targetChildType;

            dispPropRules = selectedRule.advancedRules;
            if( selectedRule.advancedRules.length ) {
                _.forEach( selectedRule.advancedRules, function( advancedRuleObj ) {
                    tempPropRuleArray.push( advancedRuleObj.propertyNameValue.Key );
                } );
            }
            setTimeout( function() {
                getConditionListForBasedOnAddedRules( data, selectedRule, sharedData );
            }, 200 );
        } else {
            const conditionVMO = createNewConditionVMO( data );
            conditionVMOs.push( conditionVMO );
            importType.dbValue = sharedData.reqSpecEleTypeList[ index ].propInternalValue;
            importType.uiValue = sharedData.reqSpecEleTypeList[ index ].propDisplayValue;
        }
    } else {
        if( importRules && importRules.length > 0 ) {
            _getOpTypesBasedOnAddedRules( data, sharedDataValue );
            operationValues.dbValue = data.operationValues.dbValue;
            operationValues.uiValue = data.operationValues.dbValue;
            importType.dbValue = sharedData.reqSpecEleTypeList[ index ].propInternalValue;
            importType.uiValue = sharedData.reqSpecEleTypeList[ index ].propDisplayValue;
            operationSubType.dbValue = data.operationSubTypeValues.dbValue[0].propInternalValue;
            operationSubType.uiValue = data.operationSubTypeValues.dbValue[0].propInternalValue;
            importType.dbValue = sharedData.reqSpecEleTypeList[ index ].propInternalValue;
            importType.uiValue = sharedData.reqSpecEleTypeList[ index ].propDisplayValue;
            style.dbValue = 'Heading 1';
            style.uiValue = 'Heading 1';
            operationType.dbValue = data.operationTypeValues.dbValue[0].propInternalValue;
            operationType.uiValue = data.operationTypeValues.dbValue[0].propInternalValue;
        } else{
            importType.dbValue = sharedData.reqSpecEleTypeList[ index ].propInternalValue;
            importType.uiValue = sharedData.reqSpecEleTypeList[ index ].propDisplayValue;
            operationSubType.dbValue = operationSubTypeValues.dbValue[0].propInternalValue;
            operationSubType.uiValue = operationSubTypeValues.dbValue[0].propInternalValue;
        }
        if( selectedRule && data.importType ) {
            importType.dbValue = selectedRule.cellHeader1InVal;
            importType.uiValue = selectedRule.cellHeader1;
            if( selectedRule.cellHeader2InVal === 'Word_Contains' ) {
                operationValues.dbValue = selectedRule.cellHeader4;
                operationValues.uiValue = selectedRule.cellHeader4;
                operationSubType.dbValue = selectedRule.cellHeader3InVal;
                operationSubType.uiValue = selectedRule.cellHeader3;
            } else {
                style.dbValue = selectedRule.cellHeader3InVal;
                style.uiValue = selectedRule.cellHeader3;
                operationType.dbValue = data.operationTypeValues.dbValue[0].propInternalValue;
                operationType.uiValue = data.operationTypeValues.dbValue[0].propInternalValue;
            }
        }
    }

    const newsharedData = { ...sharedData.value };
    if( newsharedData.editRuleClicked ) {
        conditionVMOs = newsharedData.addConditionList;
    }
    newsharedData.addConditionList = addConditionList;
    newsharedData.operationType = operationType;
    newsharedData.style = style;
    newsharedData.operationValues = operationValues;
    newsharedData.operationCheckboxValues = operationCheckboxValues;
    newsharedData.operationTypeValues = operationTypeValues;
    newsharedData.styleValues = styleValues;
    newsharedData.dispPropRules = dispPropRules;
    newsharedData.addConditionForOperationType = true;
    newsharedData.conditionOfRuleMap = conditionOfRuleMap;
    sharedData.update && sharedData.update( newsharedData );

    return {
        addConditionList: addConditionList,
        operationTypeValues:operationTypeValues,
        operationSubType:operationSubType,
        importType:importType,
        dispPropRules:dispPropRules,
        operationValues:operationValues,
        style:style,
        operationSubTypeValues:operationSubTypeValues,
        operationType:operationType,
        conditionOfRuleMap:conditionOfRuleMap,
        conditionVMOs:conditionVMOs
    };
};


/**
 * Return an empty ListModel object.
 * @param {Object} data - The view model data
 */
var _getOpTypesBasedOnAddedRules = function( data, sharedDataValue ) {
    var isWordContainsRule = false;
    if( sharedDataValue.importRules.length > 0 && sharedDataValue.importRules[ 0 ].cellHeader2InVal === 'Word_Contains' ) {
        isWordContainsRule = true;
    }

    for( var i = data.operationTypeValues.dbValue.length - 1; i >= 0; i-- ) {
        if( isWordContainsRule ) {
            clearWordContainsRule( data, sharedDataValue );
            if( data.operationTypeValues.dbValue[ i ].propInternalValue === 'Has_Style' ) {
                data.operationTypeValues.dbValue.splice( i, 1 );
            }
        } else {
            clearHasStyleRule( data, sharedDataValue );
            if( data.operationTypeValues.dbValue[ i ].propInternalValue === 'Word_Contains' ) {
                data.operationTypeValues.dbValue.splice( i, 1 );
            }
        }
    }
};

/**
 * Clears view data
 * @param {Object} data - The view model data
 */
function clearWordContainsRule( data, sharedData ) {
    data.operationValues.uiValue = '';
    data.operationValues.dbValue = '';
    data.operationSubType.uiValue = data.i18n.exactMatch;
    data.operationSubType.dbValue = 'Exact_Match';
    data.importType.dbValue = sharedData.reqSpecEleTypeList[ 0 ].propInternalValue;
    data.importType.uiValue = sharedData.reqSpecEleTypeList[ 0 ].propDisplayValue;
}

/**
 * Clears view data
 * @param {Object} data - The view model data
 */
function clearHasStyleRule( data, sharedData ) {
    data.importType.dbValue = sharedData.reqSpecEleTypeList[ 0 ].propInternalValue;
    data.importType.uiValue = sharedData.reqSpecEleTypeList[ 0 ].propDisplayValue;
    data.style.dbValue = 'Heading 1';
    data.style.uiValue = 'Heading 1';
}

/**
 * Create imput for saving an import rule
 *
 * @param {Object} data - The view model data
 */
export let createSaveRulesInput = function( data, sharedData ) {
    const newsharedData = { ...sharedData.value };

    var input = {};
    var rulesData = {};
    if( data.savedRules.dbValue ) {
        rulesData.ruleName = data.savedRules.dbValue;
        rulesData.ruleDispName = data.savedRules.dbValue;
        rulesData.accessRight = 'WRITE';
        rulesData.ruleObject = newsharedData.selectedRule.ruleObject;
        rulesData.ruleScope = newsharedData.selectedRule.ruleScope;
        input.actionName = 'UPDATE';
    } else if( _ruleName ) {
        rulesData.ruleName = _ruleName;
        rulesData.ruleDispName = _ruleName;
        rulesData.accessRight = 'WRITE';
        rulesData.ruleObject = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
        input.actionName = 'CREATE';
        if( _ruleScope ) {
            rulesData.ruleScope = _ruleScope;
        }
    }
    rulesData.rules = JSON.stringify( data.importRules );
    if( appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' )[ 0 ] === 'true' ) {
        input.mappingType = 'SaveAdvanceRule';
    } else {
        input.mappingType = 'SaveLegacyRule';
    }
    input.rulesData = [ rulesData ];
    data.importInput = input;
    _ruleName = null;
    _ruleScope = null;
    eventBus.publish( 'importSpecification.saveImportRule' );
};

/**
 * To fire event for save rule button click on popup
 * @param {Object} data - The view model data
 */
export let saveImportRulePopupButtonClicked = function( data, sharedData ) {
    _ruleName = data.ruleName.dbValue;
    if( data.globalScopeCheck.dbValue === true ) {
        _ruleScope = 'GLOBAL';
    } else {
        _ruleScope = 'LOCAL';
    }
    const newsharedData = { ...sharedData.value };
    newsharedData.savedRuleClicked = true;
    newsharedData.current_ruleData = _ruleName;
    sharedData.update && sharedData.update( newsharedData );
    eventBus.publish( 'importSpecification.createSaveRulesInput' );
};

/**
 * Populate the rules for the selected saved rule
 *
 * @param {Object} data - The view model data
 *
 */
export let populateRulesFromSavedRuleName = function( data, sharedData ) {
    var rulesData = data.response.rulesData;
    const newsharedData = { ...sharedData.value };

    var typeOfRuleMap = newsharedData.typeOfRuleMap;
    for( var k = 0; k < rulesData.length; k++ ) {
        var singleRulesData = rulesData[ k ];
        var importRules = JSON.parse( singleRulesData.rules );
    }
    _.forEach( importRules, function( savedRuleObj ) {
        typeOfRuleMap[ savedRuleObj.targetChildType ] = savedRuleObj.targetChildType;
    } );
    newsharedData.typeOfRuleMap = typeOfRuleMap;
    newsharedData.importRules = importRules;
    sharedData.update && sharedData.update( newsharedData );
    eventBus.publish( 'ImportFromOffice.refreshImportRuleList' );
};

/**
 * To fire event for save rule button click
 * @param {Sting} isReqMicroServiceInstalled - For Advance Rule Check
 */
export let saveImportRuleButtonClicked = function() {
    eventBus.publish( 'importSpecification.checkActionForSave' );
};

/**
 * To set appropriate action for save
 * @param {Object} data - The view model data
 */
export let checkActionForSave = function( data ) {
    // if( data.savedRules.dbValue ) {
    //     showUpdateRuleNotificationWarning( data );
    // } else {
    var rect = document.querySelector( 'button[button-id=\'Arm0ImportFromWordSubSaveCmd\']' ).getBoundingClientRect();
    return {
        offsetHeight: rect.height,
        offsetLeft: rect.left,
        offsetTop: rect.top,
        offsetWidth: rect.width,
        popupId: 'Arm0ImportFromWordSubSaveCmd'
    };
    //eventBus.publish( 'importSpecification.displayPopup' );
    //}
};

/**
 * Show leave warning message
 *
 * @param {Object} data - The view model data
 */

export let  showUpdateRuleNotificationWarning = function( data ) {
    var msg = data.i18n.notificationForUpdateMsg.replace( '{0}', data.savedRules.dbValue );
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.update,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'importSpecification.createSaveRulesInput' );
        }
    } ];

    notyService.showWarning( msg, buttons );
};

/**
 * Add new Rule to importRule list.
 *
 * @param {Object} data - The view model data
 * @param {Object} newRule - The new Rule to be added
 */
export let addRule = function( data, sharedData, newRule ) {
    if( newRule ) {
        const newsharedData = { ...sharedData.value };
        var importRules = [];
        if( newsharedData.importRules ) {
            importRules = newsharedData.importRules;
        }
        importRules.push( newRule );
        newsharedData.activeView = 'Arm0ImportFromOfficeSub';
        newsharedData.importRules = importRules;
        sharedData.update && sharedData.update( newsharedData );
    }
};

/**
 * Remove given importRule from importRulesList list.
 *
 * @param {Object} data - The view model data
 * @param {Object} importRule - The overrideType to be removed
 */
export let removeRule = function( data, importRule, sharedData ) {
    if( importRule ) {
        for( var i = data.importRules.length - 1; i >= 0; i-- ) {
            if( data.importRules[ i ] === importRule ) {
                data.importRules.splice( i, 1 );
                if( data.typeOfRuleMap ) {
                    delete data.typeOfRuleMap[ importRule.targetChildType ];
                    delete data.typeOfPropRuleMap[ importRule.targetChildType ];
                }
            }
        }

        //Adds rule back to list if user deletes existing rule
        if( importRule.keywordImportConditions && importRule.keywordImportConditions[ 0 ].opType === 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
            var sentenceBeginOnNewLineModel = _getEmptyListModel();
            sentenceBeginOnNewLineModel.propDisplayValue = data.i18n.sentenceBeginOnNewLine;
            sentenceBeginOnNewLineModel.propInternalValue = 'SENTENCE_BEGIN_ON_NEW_LINE';
            if( data.operationTypeValues ) {
                data.operationTypeValues.dbValue.push( sentenceBeginOnNewLineModel );
            }
            //data.conditionOfRuleMap = {};
        }
    }

    if( data.importRules.length === 0 ) {
        _getInitialOperationTypes( data );
    }

    const newsharedData = { ...sharedData.value };
    newsharedData.importRules = data.importRules;
    delete newsharedData.conditionOfRuleMap;
    sharedData.update && sharedData.update( newsharedData );
};

/**
 * Prepares the initial list of operation types supported
 * @param {Object} data - The view model data
 */
var _getInitialOperationTypes = function( data ) {
    _clearOperationTypesList( data );

    var wordContainsModel = _getEmptyListModel();
    wordContainsModel.propDisplayValue = 'Word Contains';
    wordContainsModel.propInternalValue = 'Word_Contains';

    var hasStyleModel = _getEmptyListModel();
    hasStyleModel.propDisplayValue = 'Has Style';
    hasStyleModel.propInternalValue = 'Has_Style';
    if( !data.operationTypeValues ) {
        data.operationTypeValues = {
            isArray: true,
            dbValue: []
        };
    }
    data.operationTypeValues.dbValue.push( wordContainsModel );
    data.operationTypeValues.dbValue.push( hasStyleModel );
};

var _clearOperationTypesList = function( data ) {
    if( data.operationTypeValues ) {
        for( var i = data.operationTypeValues.dbValue.length - 1; i >= 0; i-- ) {
            data.operationTypeValues.dbValue.splice( i, 1 );
        }
    }
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * updatePartialCtx for update Rule.
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedRule - The overrideType to be removed
 * @param {Boolean} isMicroserviceInstalled - for microservice check
 */
export let updateRuleFn = function( data, selectedRule, isMicroserviceInstalled, sharedData ) {
    var newValue;
    if( isMicroserviceInstalled ) {
        newValue = 'Arm0AddAdvanceRulesSub';
    } else {
        newValue = 'Arm0AddRulesSub';
    }
    const newsharedData = { ...sharedData.value };
    newsharedData.activeView = newValue;
    newsharedData.RULE_CONST = selectedRule;
    newsharedData.editRuleClicked = true;
    sharedData.update && sharedData.update( newsharedData );
};

/**
 * Update given updatedRule to importRulesList list.
 *
 * @param {Object} data - The view model data
 * @param {Object} updatedRule - The overrideType to be removed
 */
export let updateRule = function( data, updatedRule, sharedData ) {
    const newsharedData = { ...sharedData.value };
    var selectedRule =  newsharedData.RULE_CONST;
    var importRules = newsharedData.importRules;
    if( updatedRule && selectedRule && importRules ) {
        for( var i = importRules.length - 1; i >= 0; i-- ) {
            if( importRules[ i ] === selectedRule ) {
                importRules.splice( i, 1, updatedRule );
            }
        }
    }
    newsharedData.importRules = importRules;
    newsharedData.activeView = 'Arm0ImportFromOfficeSub';
    newsharedData.editRuleClicked = true;
    sharedData.update && sharedData.update( newsharedData );
};

/**
 * updatePartialCtx to null for NEW add rule.
 */
export let unRegisterArm0AddRulesSubCtx = function( sharedData )  {
    if( sharedData ) {
        const sharedDataValue = { ...sharedData.value };
        delete sharedDataValue.RULE_CONST;
        delete sharedDataValue.PROP_RULE_CONST;
    }

    // appCtxSvc.updatePartialCtx( RULE_CONST, null );
    //appCtxSvc.updatePartialCtx( PROP_RULE_CONST, null );
};

/**
 * updatePartialCtx to null for NEW Prop add rule.
 */
export let unRegisterArm0AddPropRulesCtx = function( sharedData ) {
    if( sharedData ) {
        const sharedDataValue = { ...sharedData.value };
        delete sharedDataValue.PROP_RULE_CONST;
    }
    //appCtxSvc.updatePartialCtx( PROP_RULE_CONST, null );
};

/****************************** Advance Rule  start ************************************************/
/**
 * rule Object processing
 * @param {Object} ruleObject - Rule Object
 * @param {Array} ruleConditionList - condition number
 * @returns {Boolean} return true if there is an error
 *
 */
function processRuleObj( ruleObject, ruleConditionList ) {
    for( var i = 0; i < ruleConditionList.length; i++ ) {
        var conditionObject = ruleConditionList[ i ].props;
        if( ( conditionObject.operationType.dbValue === 'Has_Style' && conditionObject.style.dbValue || conditionObject.operationValues.dbValue ) && conditionObject.operationType.dbValue !==
            'SENTENCE_BEGIN_ON_NEW_LINE' ) {
            ruleObject.keywordImportConditions.push( {
                opType: conditionObject.operationType.dbValue,
                opDisplayType: conditionObject.operationType.uiValue,
                keyword: conditionObject.operationType.dbValue === 'Has_Style' ? conditionObject.style.dbValue : conditionObject.operationValues.dbValue,
                operationCheckboxValues: false
            } );
        } else if( conditionObject.operationType.dbValue === 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
            ruleObject.keywordImportConditions.push( {
                opType: conditionObject.operationType.dbValue,
                opDisplayType: conditionObject.operationType.uiValue,
                keyword: '',
                operationCheckboxValues: conditionObject.operationCheckboxValues.dbValue
            } );
        } else {
            return true;
        }
    }
}

/**
 * constructs and returns the input typePropMap required while making the SOA call.
 *
 * @param {Object} data - The view model data
 */
export let getInputForAddPropRules = function( data ) {
    var inputData = {};
    if( data.importType && data.importType.dbValue ) {
        var objType = data.importType.dbValue;
        inputData[ objType ] = [ 'object_name' ];
    }
    return inputData;
};

/**
 * @param {Object} data  The view model data
 * @param {Object} outputTypeDescriptionsList return property list
 */
export let populateTypeDescriptions = function( data, outputTypeDescriptionsList, sharedData ) {
    //var selectedRule = appCtxSvc.getCtx( PROP_RULE_CONST );
    const sharedDataValue = { ...sharedData.value };
    var selectedRule = sharedDataValue.PROP_RULE_CONST;


    if( selectedRule ) {
        _.remove( sharedData.tempPropRuleArray, function( n ) {
            return n === selectedRule.propertyNameValue.Key;
        } );
    }
    var tempPropRuleArray = sharedData.tempPropRuleArray;
    var mapOfTypeDescriptions = {};
    var setFieldTypeList = [];
    var selectedOutputTypeDesc = {};
    selectedOutputTypeDesc = outputTypeDescriptionsList.filter( function( obj ) { return obj.objectType === sharedData.importType.dbValue; } );
    _.forEach( selectedOutputTypeDesc[0].propInfos, function( propertyDescriptorObj ) {
        if( propertyDescriptorObj.isEditable ) {
            var result = _.find( tempPropRuleArray, propName => propName === propertyDescriptorObj.propName );
            if( !result ) {
                setFieldTypeList.push( { propDisplayValue: propertyDescriptorObj.dispPropName, propInternalValue: propertyDescriptorObj.propName } );
            }
            mapOfTypeDescriptions[ propertyDescriptorObj.propName ] = propertyDescriptorObj.hasLOV;
        }
    } );

    return {
        setFieldTypeList: setFieldTypeList,
        mapOfTypeDescriptions: mapOfTypeDescriptions,
        tempPropRuleArray: tempPropRuleArray
    };
};

export let dispplayFieldTypeValue = function( data, fieldTypeValueList ) {
    data.setFieldTypeValueList.dbValue = fieldTypeValueList;
};
/**
 * This method is used to get the LOV values for the versioning panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVList = function( response ) {
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
            propInternalValue: obj.propInternalValues.lov_values[ 0 ]
        };
    } );
};

/**
 * Adds new condition in a Rule
 * @param {Object} data - The view model data
 * @param {Object} conditionVMOs The list of conditions
 */
export let addCondition = function( data, conditionVMOs ) {
    const conditionVMO = createNewConditionVMO( data );
    conditionVMOs.push( conditionVMO );
    return conditionVMOs;
};

let _conditionVMOIdCounter = 0;

const createNewConditionVMO = function( data ) {
    const serverVMO = { ...data._conditionVMOTemplate };
    const conditionVMO = viewModelObjectSvc.constructViewModelObjectFromModelObject( { props: {} }, 'Edit', '', serverVMO, true );
    conditionVMO.alternateID += _conditionVMOIdCounter++;
    conditionVMO.props.operationType.dbValue = data.operationTypeValues.dbValue[0].propInternalValue;
    conditionVMO.props.operationType.uiValue = data.operationTypeValues.dbValue[0].propDisplayValue;
    conditionVMO.props.operationCheckboxValues.dbValue = data.operationCheckboxValues.dbValue;
    conditionVMO.props.operationCheckboxValues.propertyDisplayName = data.operationCheckboxValues.propertyDisplayName;
    if( data.operationType ) {
        conditionVMO.props.operationType.propertyDisplayName = data.operationType.propertyDisplayName;
    }
    return conditionVMO;
};


/**
 * to Remove condition in a Rule
 * @param {Object} addConditionList - The list of conditions
 * @param {Object} selectedCondition - condition number
 */

export let removeCondition = function( addConditionList, selectedCondition, sharedData, conditionVMOs ) {
    if( addConditionList.length > 1 && selectedCondition ) {
        for( var i = addConditionList.length - 1; i >= 0; i-- ) {
            if( addConditionList[ i ] === selectedCondition ) {
                addConditionList.splice( i, 1 );
            }
        }
    } else{
        return conditionVMOs;
    }

    _.remove( conditionVMOs, function( conditionVMO ) {
        return conditionVMO.alternateID === selectedCondition.alternateID;
    } );

    const newsharedData = { ...sharedData.value };
    newsharedData.addConditionList = addConditionList;
    sharedData.update && sharedData.update( newsharedData );
    return conditionVMOs;
};

/**
 * Adds new condition in a Rule
 * @param {Object} data - The view model data
 * @param {Object} addConditionList - The list of conditions
 */
export let addConditionForProp = function( conditionPropRulesVMOs, data ) {
    const conditionPropRules = createNewConditionVMO( data );
    conditionPropRulesVMOs.push( conditionPropRules );
    return conditionPropRulesVMOs;
};
/**
 * to Remove condition in a Rule
 * @param {Object} addConditionList - The list of conditions
 * @param {Object} selectedCondition - condition number
 */
export let removeConditionForProp = function( addPropConditionList, selectedCondition, sharedData, conditionPropRulesVMOs ) {
    //var addPropConditionList = _.clone( addPropConditionList, true );
    if( addPropConditionList.length > 1 && selectedCondition ) {
        for( var i = addPropConditionList.length - 1; i >= 0; i-- ) {
            if( addPropConditionList[ i ] === selectedCondition ) {
                addPropConditionList.splice( i, 1 );
            }
        }
    } else{
        return conditionPropRulesVMOs;
    }

    _.remove( conditionPropRulesVMOs, function( conditionPropRuleVMO ) {
        return conditionPropRuleVMO.alternateID === selectedCondition.alternateID;
    } );

    const newsharedData = { ...sharedData.value };
    newsharedData.addPropConditionList = addPropConditionList;
    sharedData.update && sharedData.update( newsharedData );
    return conditionPropRulesVMOs;
};

/**
 * Adds Rule in a List of ImportRule
 * @param {Object} data - The view model data
 * @param {Array} ruleConditionList - condition number
 */
export let addAdvanceRule = function( data, ruleConditionList, sharedData ) {
    var importRules;
    const newsharedData = { ...sharedData.value };
    if( newsharedData.importRules ) {
        importRules = newsharedData.importRules;
    } else {
        importRules = [];
    }
    var typeOfRuleMap =  newsharedData.typeOfRuleMap;
    var typeOfPropRuleMap =  newsharedData.typeOfPropRuleMap;
    var conditionOfRuleMap = newsharedData.conditionOfRuleMap;

    //Adds rule to map if its "SENTENCE_BEGIN_ON_NEW_LINE"
    for( var i = 0; i < ruleConditionList.length; i++ ) {
        var conditionObject = ruleConditionList[ i ].props;
        if( conditionObject.operationType.dbValue === 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
            conditionOfRuleMap[ conditionObject.operationType.dbValue ] = conditionObject.operationType.dbValue;
        }
    }
    if( typeOfRuleMap && typeOfRuleMap[ data.importType.dbValue ] ) {
        eventBus.publish( RULE_ERROR_CONST );
    } else {
        var ruleObject = {
            targetChildType: _.clone( data.importType.dbValue, true ),
            targetChildDisplayType: _.clone( data.importType.uiValue, true ),
            conditionProcessingType: _.clone( data.conditionProcessingType.dbValue, true ),
            keywordImportConditions: [],
            advancedRules: []
        };
        var isError = false;
        isError = processRuleObj( ruleObject, ruleConditionList );
        if( isError ) {
            eventBus.publish( CONDITION_ERROR );
        } else {
            typeOfRuleMap[ data.importType.dbValue ] = data.importType.dbValue;
            ruleObject.advancedRules = sharedData.dispPropRules;
            typeOfPropRuleMap[ data.importType.dbValue ] = data.tempPropRuleArray;
            // data.importRules.dbValue.push( ruleObject );
            // data.dispPropRules.dbValue = [];
            // data.tempPropRuleArray = [];
            //data.activeView = 'Arm0ImportFromOfficeSub';
            importRules.push( ruleObject );
            var newValue = 'Arm0ImportFromOfficeSub';
            // var newValue = 'Arm0AddRulesSub';
            // if( preference[0] === 'true' ) {
            //     newValue = 'Arm0AddAdvanceRulesSub';
            // }
            newsharedData.activeView = newValue;
            newsharedData.importRules = importRules;
            newsharedData.typeOfRuleMap = typeOfRuleMap;
            newsharedData.typeOfPropRuleMap = typeOfPropRuleMap;
            newsharedData.conditionOfRuleMap = conditionOfRuleMap;
            newsharedData.ruleConditionVmos = ruleConditionList;
            sharedData.update && sharedData.update( newsharedData );
        }
    }
};

/**
 * Process Rule list for popoulation in UI
 * @param {Object} data - The view model data
 * @param {Object} selectedRule - selected Rule for Updation
 */
function getConditionListForBasedOnAddedRules( data, selectedRule, sharedData ) {
    var addConditionList = [];
    var importType = selectedRule.targetChildType;
    data.conditionProcessingType.dbValue = selectedRule.conditionProcessingType;
    for( var i = 0; i < selectedRule.keywordImportConditions.length; ++i ) {
        var conditionObject = createNewConditionVMO( data );
        conditionObject.props.operationValues.dbValue = selectedRule.keywordImportConditions[i].keyword;
        conditionObject.props.operationValues.uiValue = selectedRule.keywordImportConditions[i].keyword;
        conditionObject.props.operationCheckboxValues.dbValue = selectedRule.keywordImportConditions[i].operationCheckboxValues;
        conditionObject.props.operationCheckboxValues.uiValue = selectedRule.keywordImportConditions[i].operationCheckboxValues;
        conditionObject.props.operationType.dbValue = selectedRule.keywordImportConditions[i].opType;
        conditionObject.props.operationType.uiValue = selectedRule.keywordImportConditions[i].opDisplayType;
        conditionObject.props.style.dbValue = selectedRule.keywordImportConditions[i].opType === 'Has_Style' && selectedRule.keywordImportConditions[i].keyword;
        conditionObject.props.style.uiValue = selectedRule.keywordImportConditions[i].opType === 'Has_Style' && selectedRule.keywordImportConditions[i].keyword;
        addConditionList.push( conditionObject );

        const newsharedData = { ...sharedData.value };
        newsharedData.addConditionList = addConditionList;
        newsharedData.importType = importType;
        sharedData.update && sharedData.update( newsharedData );
        eventBus.publish( 'ImportFromOffice.refreshConditionListProviderForEdit' );
    }
}

/**
 * Update Advance Rule
 * @param {Object} data - The view model data
 * @param {Array} ruleConditionList - condition number
 */
export let updateAdvanceRule = function( data, ruleConditionList, sharedData ) {
    const sharedDataValue = { ...sharedData.value };
    var selectedRule =  sharedDataValue.RULE_CONST;
    sharedDataValue.addPropConditionButtonClicked = false;
    var conditionOfRuleMap = sharedDataValue.conditionOfRuleMap;
    var ruleObject = {};

    //Clear map if rule is not there in updated condition list
    for( var i = 0; i < ruleConditionList.length; i++ ) {
        if( ruleConditionList[ i ].props.operationType.dbValue === 'SENTENCE_BEGIN_ON_NEW_LINE' ) {
            conditionOfRuleMap[ ruleConditionList[ i ].props.operationType.dbValue ] = ruleConditionList[ i ].props.operationType.dbValue;
        } else {
            conditionOfRuleMap = {};
        }
    }
    if( data.typeOfRuleMap && data.typeOfRuleMap[ data.importType.dbValue ] ) {
        if( data.typeOfRuleMap[ data.importType.dbValue ] === selectedRule.targetChildType ) {
            ruleObject = getRuleObject( data );
            var isError = processRuleObj( ruleObject, ruleConditionList );
            if( isError ) {
                eventBus.publish( CONDITION_ERROR );
            } else {
                ruleObject.advancedRules = data.dispPropRules.dbValue;
                updateSelectedRule( data, selectedRule, ruleObject, ruleConditionList );
            }
        } else {
            eventBus.publish( RULE_ERROR_CONST );
        }
    } else {
        ruleObject = getRuleObject( data );
        isError = processRuleObj( ruleObject, ruleConditionList );
        if( isError ) {
            eventBus.publish( CONDITION_ERROR );
        } else {
            if( data.typeOfRuleMap ) {
                delete data.typeOfRuleMap[ selectedRule.targetChildType ];
                data.typeOfRuleMap[ data.importType.dbValue ] = data.importType.dbValue;
            }
            if( data.typeOfRuleMap ) {
                delete data.typeOfPropRuleMap[ selectedRule.targetChildType ];
                data.typeOfPropRuleMap[ data.importType.dbValue ] = data.tempPropRuleArray;
            }
            ruleObject.advancedRules = sharedData.dispPropRules;
            updateSelectedRule( data, selectedRule, ruleObject, sharedData, ruleConditionList );
        }
    }
};

/**
 * to Update the Selected Rule in Rule List
 * @param {Array} data - The view model data
 * @param {Object} selectedRule - selected rule Object
 * @param {Object} ruleObject - rule Object
 */
function updateSelectedRule( data, selectedRule, ruleObject, sharedData, ruleConditionList ) {
    if( selectedRule ) {
        for( var index = sharedData.importRules.length - 1; index >= 0; index-- ) {
            if( sharedData.importRules[ index ] === selectedRule ) {
                sharedData.importRules.splice( index, 1, ruleObject );
            }
        }
    }
    var newValue = 'Arm0ImportFromOfficeSub';
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = newValue;
    newSharedData.addConditionList = [];
    delete newSharedData.RULE_CONST;
    newSharedData.editRuleClicked = false;
    newSharedData.ruleConditionVmos = ruleConditionList;
    sharedData.update && sharedData.update( newSharedData );
}

/**
 * To fire event for save rule button click on popup
 * @param {Object} key -
 * @param {Object} value -
 * @param {Object} uiValue -
 * @param {Object} data View Model data-
 * @returns {Object} object
 */
function getKeyMap( key, value, uiValue, data ) {
    // data.propertyTypeMap[ key ] = uiValue;
    return { Key: key, Value: value, dispKey: uiValue };
}

/**
 * returns the rule Object for processing
 * @param {Object} data - The view model data
 * @returns {Object} ruleObject - Rule Object
 */
function getRuleObject( data ) {
    return {
        targetChildType: _.clone( data.importType.dbValue, true ),
        targetChildDisplayType: _.clone( data.importType.uiValue, true ),
        conditionProcessingType: _.clone( data.conditionProcessingType.dbValue, true ),
        keywordImportConditions: [],
        advancedRules: []
    };
}

eventBus.subscribe( 'importSpecification.addPropRuleCmd', function() {
    eventBus.publish( 'importSpecification.addAdvanceOptions' );
} );

/**
 * Add Advance Options in a Rule
 * @param {Object} data - The view model data
 */
export let addAdvanceOptions = function( data, sharedData ) {
    var context = {
        destPanelId: 'Arm0AddPropertyRuleSub',
        title: data.i18n.showAdvanceOptionsLabel,
        supportGoBack: true,
        recreatePanel: true
    };
    exports.unRegisterArm0AddPropRulesCtx( sharedData );
    eventBus.publish( 'awPanel.navigate', context );
};

export let changeFiledTypes = function( data ) {
    if( data.mapOfTypeDescriptions && data.setFieldType && data.setFieldType.dbValue &&
        data.mapOfTypeDescriptions[ data.setFieldType.dbValue ] ) {
        var eventData = {
            boName: data.importType.dbValue,
            propertyName: data.setFieldType.dbValue
        };
        eventBus.publish( 'importSpecification.getInitialLOVValues', eventData );
    }
};

/**
 * to get the TypeNames for getTypeDescriptions2
 * @param {Object} data - The view model data
 * @returns {Array} TypeNames Array
 */
export let getTypeNames = function( data ) {
    if( data.importType ) {
        return [ data.importType.dbValue ];
    }
    return [ data.reqType.dbValue ];
};

/**
 * to get the exclusions for getTypeDescriptions2
 * @returns {Object} exclusion Object
 */
export let getExclusions = function() {
    return {
        PropertyExclusions: [ 'NamingRules', 'RendererReferences' ],
        TypeExclusions: [ 'DirectChildTypesInfo', 'RevisionNamingRules', 'ToolInfo' ]
    };
};

/**
 * Store form data for file selected to import
 *
 * @param {Object} formData - Form Data
 */
export let storeFormDataForUpdatePreviewForImportPDF = function( formData ) {
    _formData = formData;
};

/**
 * Return the cached formData
 *
 * @return {Object} formData - Form Data
 */
export let getCachedFormData = function() {
    return _formData;
};

/*************************** Advance Rule Move Operations 5.1 start ****************************************/

/* Register context to update command state
 */
export let registerCmdContext = function( ) {
    var jso = {
        enableMoveUp: false,
        enableMoveDown: false
    };
    appCtxSvc.registerCtx( 'Arm0AddRulesCtx', jso );
};
/* Register context to update command state
 */
export let registerSharedData = function( sharedData ) {
    const sharedDataValue = { ...sharedData.value };
    sharedDataValue.enableMoveUp = false;
    sharedDataValue.enableMoveDown = false;
    sharedData.update && sharedData.update( sharedDataValue );
};

/* Change move up/down command state on selection change
 *
 * @param {Object} data - The view model data
 */
export let columnSelectionChanged = function( data, sharedData ) {
    var arm0AddRulesSub = appCtxSvc.getCtx( 'Arm0AddRulesCtx' );
    const sharedDataValue = { ...sharedData.value };

    var columnListLength = data.importRulesList.getLength();
    var selectedColumn = data.importRulesList.selectedObjects[ 0 ];
    if( selectedColumn ) {
        if( data.importRulesList.getItemAtIndex( 0 ) === selectedColumn ) {
            arm0AddRulesSub.enableMoveUp = false;
            sharedDataValue.enableMoveUp = false;
        } else {
            arm0AddRulesSub.enableMoveUp = true;
            sharedDataValue.enableMoveUp = true;
        }
        if( data.importRulesList.getItemAtIndex( columnListLength - 1 ) === selectedColumn ) {
            arm0AddRulesSub.enableMoveDown = false;
            sharedDataValue.enableMoveDown = false;
        } else {
            arm0AddRulesSub.enableMoveDown = true;
            sharedDataValue.enableMoveDown = true;
        }
    } else {
        arm0AddRulesSub.enableMoveDown = false;
        arm0AddRulesSub.enableMoveUp = false;
        sharedDataValue.enableMoveDown = false;
        sharedDataValue.enableMoveUp = false;
    }
    sharedData.update && sharedData.update( sharedDataValue );
};

/**
 * Move one down or up from list
 *
 * @param {Object} dataProvider - dataprovider
 * @param {Array} importRules - list of rules
 * @param {Object} moveTo - Direction to move to
 */
export let moveUpDown = function( dataProvider, importRules, moveTo ) {
    var sortColumns;
    if( dataProvider.importRulesList ) {
        sortColumns = dataProvider.importRulesList;
    }
    if( sortColumns ) {
        var selectedCount = sortColumns.getSelectedIndexes()[ 0 ];
        if( moveTo === 'Down' ) {
            importRules = move( importRules, selectedCount, selectedCount + 1 );
        }
        if( moveTo === 'Up' ) {
            importRules = move( importRules, selectedCount, selectedCount - 1 );
        }
        eventBus.publish( 'ImportFromOffice.refreshImportRuleList' );
    }
};

var move = function( arr, old_index, new_index ) {
    while( old_index < 0 ) {
        old_index += arr.length;
    }
    while( new_index < 0 ) {
        new_index += arr.length;
    }
    if( new_index >= arr.length ) {
        var k = new_index - arr.length;
        while( k-- + 1 ) {
            arr.push( undefined );
        }
    }
    arr.splice( new_index, 0, arr.splice( old_index, 1 )[ 0 ] );
    return arr;
};

/****************************** Advance Rule Move Operations 5.1 end ************************************************/

/****************************** Advance Property Rule 5.1 start ************************************************/
/**
 * Process Rule list for popoulation in UI
 * @param {Object} data - The view model data
 * selectedRule - selected Rule for Updation
 */
export let getConditionListForAddedPropRules = function( data, sharedData ) {
    var addPropConditionList = [];
    //var selectedRule = appCtxSvc.getCtx( PROP_RULE_CONST );
    const sharedDataValue = { ...sharedData.value };
    var selectedRule = sharedDataValue.PROP_RULE_CONST;
    var setFieldTypeTextValue = _.clone( data.setFieldTypeTextValue, true );
    var setFieldTypeValue = _.clone( data.setFieldTypeValue, true );
    var advanceConditionProcessingType = _.clone( data.advanceConditionProcessingType, true );
    var setFieldType = _.clone( data.setFieldType, true );


    if( selectedRule ) {
        var tempConditionProcessingType = '';
        if( selectedRule.conditionProcessingType && selectedRule.conditionProcessingType.dbValue ) {
            tempConditionProcessingType = selectedRule.conditionProcessingType.dbValue;
        } else{
            tempConditionProcessingType = selectedRule.conditionProcessingType;
        }
        for( var i = 0; i < data.advanceCProcessingTypeList.dbValue.length; ++i ) {
            if( data.advanceCProcessingTypeList.dbValue[i].propInternalValue === tempConditionProcessingType ) {
                advanceConditionProcessingType.dbValue = tempConditionProcessingType;
                advanceConditionProcessingType.uiValue = data.advanceCProcessingTypeList.dbValue[i].propDisplayValue;
            }
        }

        //advanceConditionProcessingType.uiValue = data.advanceCProcessingTypeList.dbValue[1].propDisplayValue;
        setFieldType.dbValue = selectedRule.propertyNameValue.Key;
        setFieldTypeValue.dbValue = data.mapOfTypeDescriptions[ selectedRule.propertyNameValue.Key ] ? selectedRule.propertyNameValue.Value : '';
        setFieldTypeTextValue.dbValue = !data.mapOfTypeDescriptions[ selectedRule.propertyNameValue.Key ] ? selectedRule.propertyNameValue.Value : '';

        for( var propRuleIndex = 0; propRuleIndex < selectedRule.keywordImportConditions.length; ++propRuleIndex ) {
            var conditionObject = createNewConditionVMO( data );
            conditionObject.props.operationValues.dbValue = selectedRule.keywordImportConditions[propRuleIndex].keyword;
            conditionObject.props.operationValues.uiValue = selectedRule.keywordImportConditions[propRuleIndex].keyword;
            conditionObject.props.operationType.dbValue = selectedRule.keywordImportConditions[propRuleIndex].opType;
            conditionObject.props.operationType.uiValue = selectedRule.keywordImportConditions[propRuleIndex].opDisplayType;
            conditionObject.props.style.dbValue = selectedRule.keywordImportConditions[propRuleIndex].opType === 'Has_Style' && selectedRule.keywordImportConditions[propRuleIndex].keyword;
            conditionObject.props.style.uiValue = selectedRule.keywordImportConditions[propRuleIndex].opType === 'Has_Style' && selectedRule.keywordImportConditions[propRuleIndex].keyword;
            conditionObject.props.operationCheckboxValues.dbValue = selectedRule.keywordImportConditions[propRuleIndex].operationCheckboxValues;
            addPropConditionList.push( conditionObject );
        }
    }
    /**Property Rule Refresh Option Process */
    sharedDataValue.addPropConditionList = addPropConditionList;
    sharedData.update && sharedData.update( sharedDataValue );
    //eventBus.publish( 'ImportFromOffice.refreshPropConditionListProvider' );

    return {
        addPropConditionList: addPropConditionList,
        setFieldTypeTextValue: setFieldTypeTextValue,
        advanceConditionProcessingType:advanceConditionProcessingType,
        setFieldType:setFieldType,
        setFieldTypeValue:setFieldTypeValue,
        conditionPropRulesVMOs:addPropConditionList
    };
};

/**
 * revealArm0AddPropRules for reveal of Arm0AddPropertyRulesSub panel.
 *
 * @param {Object} data - The view model data
 */
export let revealArm0AddPropRules = function( data, sharedData ) {
    var addPropConditionList = [];
    var conditionPropRulesVMOs1 = [];
    const newsharedData = { ...sharedData.value };
    if( newsharedData.editPropRuleClicked ) {
        conditionPropRulesVMOs1 = newsharedData.conditionPropRulesVMOs;
    }
    newsharedData.addPropConditionList = addPropConditionList;
    sharedData.update && sharedData.update( newsharedData );
    eventBus.publish( 'importSpecification.getTypeDescriptions' );
    return conditionPropRulesVMOs1;
};

/***
 * addConditionProcessing for Advance Condition
 * @param {Object} data - The view model data
 */
export let addConditionProcessing = function( data, sharedData ) {
    const newsharedData = { ...sharedData.value };
    var conditionPropRulesVMOs = [];
    if( data.advanceConditionProcessingType.dbValue !== 'ALWAYS' ) {
        const conditionPropRuleVMO = createNewConditionVMO( data );
        conditionPropRulesVMOs.push( conditionPropRuleVMO );
    }
    newsharedData.addPropConditionList = conditionPropRulesVMOs;
    newsharedData.addConditionForOperationType = true;
    var conditionPropRules1 = {
        conditionPropRulesVMOs : conditionPropRulesVMOs
    };
    newsharedData.conditionPropRules = conditionPropRules1;
    sharedData.update && sharedData.update( newsharedData );
    return conditionPropRulesVMOs;
};

/**
 * updatePartialCtx for update Rule.
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedRule - The overrideType to be removed
 *
 */
export let editPropRuleFn = function( data, selectedRule, sharedData ) {
    //appCtxSvc.updatePartialCtx( PROP_RULE_CONST, selectedRule );

    var newValue = 'Arm0AddPropertyRuleSub';
    const newsharedData = { ...sharedData.value };
    newsharedData.activeView = newValue;
    newsharedData.PROP_RULE_CONST = selectedRule;
    newsharedData.editPropRuleClicked = true;
    sharedData.update && sharedData.update( newsharedData );
    //eventBus.publish( 'importSpecification.editPropRuleEvent' );
};

/**
 * Adds Rule in a List of ImportRule
 * @param {Object} data - The view model data
 * @param {Array} ruleConditionList - condition list
 */
export let addPropRule = function( data, ruleConditionList, sharedData ) {
    var dispPropRules = [];
    var conditionProcessingType = _.clone( data.advanceConditionProcessingType, true );
    conditionProcessingType.dbValue =  data.advanceConditionProcessingType.dbValue;
    conditionProcessingType.uiValue =  data.advanceConditionProcessingType.uiValue;
    var setFieldType = data.setFieldType.dbValue;
    var mapOfTypeDescriptions;
    if( data.mapOfTypeDescriptions ) {
        mapOfTypeDescriptions = data.mapOfTypeDescriptions[ data.setFieldType.dbValue ];
    }
    var propertyNameValue = getKeyMap( data.setFieldType.dbValue, mapOfTypeDescriptions );
    var setFieldTypeValue = data.setFieldTypeValue.dbValue;
    var setFieldTypeTextValue = data.setFieldTypeTextValue.dbValue;
    var setFieldTypeUi = data.setFieldType.uiValue;

    var propRuleObject = {
        conditionProcessingType: _.clone( conditionProcessingType.dbValue, true ),
        propertyNameValue: getKeyMap( setFieldType, mapOfTypeDescriptions ?
            setFieldTypeTextValue : setFieldTypeTextValue, setFieldTypeUi, data ),
        keywordImportConditions: []
    };
    var isError = false;
    if( data.advanceConditionProcessingType.dbValue !== 'ALWAYS' ) {
        isError = processRuleObj( propRuleObject, ruleConditionList );
    }
    if( isError ) {
        eventBus.publish( CONDITION_ERROR );
    } else {
        var flagForNewRule = false;
        if( data.dispPropRules ) {
            for( var index = 0; index < data.dispPropRules.dbValue.length; index++ ) {
                if( data.dispPropRules.dbValue[ index ].propertyNameValue.Key === propRuleObject.propertyNameValue.Key ) {
                    flagForNewRule = true;
                    break;
                }
            }
        }
        if( flagForNewRule ) {
            eventBus.publish( PROP_RULE_ERROR_CONST );
        } else {
            const newsharedData = { ...sharedData.value };
            if( newsharedData.dispPropRules ) {
                dispPropRules = newsharedData.dispPropRules;
                dispPropRules.push( propRuleObject );
                //newsharedData.tempPropRuleArray.push( propRuleObject );
            } else {
                dispPropRules.push( propRuleObject );
                //newsharedData.tempPropRuleArray = dispPropRules;
            }
            var tempPropRuleArray = propRuleObject.propertyNameValue.Key;
            var newValue = 'Arm0AddAdvanceRulesSub';
            newsharedData.dispPropRules = dispPropRules;
            newsharedData.activeView = newValue;
            newsharedData.tempPropRuleArray = tempPropRuleArray;
            newsharedData.addPropConditionButtonClicked = false;
            newsharedData.conditionPropRulesVMOs = ruleConditionList;
            sharedData.update && sharedData.update( newsharedData );
        }
    }
};

/**
 * Update Advance Rule
 * @param {Object} data - The view model data
 * @param {Array} ruleConditionList - condition number
 */
export let updatePropRule = function( data, ruleConditionList, sharedData ) {
    var mapOfTypeDescriptions;
    //var selectedRule = appCtxSvc.getCtx( PROP_RULE_CONST );
    const sharedDataValue = { ...sharedData.value };
    var selectedRule = sharedDataValue.PROP_RULE_CONST;
    var advanceConditionProcessingType = _.clone( data.advanceConditionProcessingType.dbValue, true );

    // advanceConditionProcessingType.dbValue = data.advanceConditionProcessingType.dbValue;
    // advanceConditionProcessingType.uiValue = data.advanceConditionProcessingType.uiValue;
    var setFieldType = data.setFieldType.dbValue;
    if ( data.mapOfTypeDescriptions ) {
        mapOfTypeDescriptions = data.mapOfTypeDescriptions[ data.setFieldType.dbValue ];
    }
    var setFieldTypeValue = data.setFieldTypeValue.dbValue;
    var  setFieldTypeTextValue = data.setFieldTypeTextValue.dbValue;
    var setFieldTypeUi = data.setFieldType.uiValue;

    var propRuleObject = {
        conditionProcessingType: _.clone( advanceConditionProcessingType, true ),
        propertyNameValue: getKeyMap( setFieldType, mapOfTypeDescriptions ?
            setFieldTypeValue : setFieldTypeTextValue, setFieldTypeUi ),
        keywordImportConditions: []
    };
    var isError = false;
    if( data.advanceConditionProcessingType.dbValue !== 'ALWAYS' ) {
        isError = processRuleObj( propRuleObject, ruleConditionList );
    }
    if( isError ) {
        eventBus.publish( CONDITION_ERROR );
    } else {
        var flagForNewRule = false;
        for( var index = 0; index < sharedData.dispPropRules.length; index++ ) {
            if( sharedData.dispPropRules[ index ].propertyNameValue.Key === propRuleObject.propertyNameValue.Key ) {
                if( selectedRule.propertyNameValue.Key === propRuleObject.propertyNameValue.Key ) {
                    flagForNewRule = false;
                    break;
                } else {
                    flagForNewRule = true;
                }
            }
        }
        if( flagForNewRule ) {
            eventBus.publish( PROP_RULE_ERROR_CONST );
        } else {
            updateSelectedPropRule( sharedData, selectedRule, propRuleObject, ruleConditionList );
        }
    }
};

/**
 * to Update the Selected Rule in Rule List
 * @param {Array} data - The view model data
 * @param {Object} selectedRule - selected rule Object
 * @param {Object} ruleObject - rule Object
 */
function updateSelectedPropRule( sharedData, selectedRule, ruleObject, ruleConditionList ) {
    var tempPropRuleArray = [];
    var addPropConditionList = [];
    var newValue = 'Arm0AddAdvanceRulesSub';
    if( selectedRule ) {
        for( var index = sharedData.dispPropRules.length - 1; index >= 0; index-- ) {
            if( sharedData.dispPropRules[ index ] === selectedRule ) {
                sharedData.dispPropRules.splice( index, 1, ruleObject );
                tempPropRuleArray.push( ruleObject.propertyNameValue.Key );
            }
        }
    }

    const newsharedData = { ...sharedData.value };
    newsharedData.activeView = newValue;
    newsharedData.tempPropRuleArray = tempPropRuleArray;
    newsharedData.addPropConditionList = addPropConditionList;
    newsharedData.conditionPropRulesVMOs = ruleConditionList;
    delete newsharedData.PROP_RULE_CONST;
    newsharedData.editPropRuleClicked = false;
    sharedData.update && sharedData.update( newsharedData );
}

/**
 * Remove given importRule from importRulesList list.
 *
 * @param {Object} data - The view model data
 * @param {Object} importRule - The overrideType to be removed
 */
export let removePropRule = function( data, importRule, sharedData ) {
    if( importRule ) {
        for( var i = data.dispPropRules.length - 1; i >= 0; i-- ) {
            if( data.dispPropRules[ i ] === importRule ) {
                data.dispPropRules.splice( i, 1 );
            }
        }
    }
    const newsharedData = { ...sharedData.value };
    newsharedData.dispPropRules = data.dispPropRules;
    sharedData.update && sharedData.update( newsharedData );
};

/**
 * Returns the selected object
 *
 * @return {Object} selected object
 */
export let prepareSelectedSepcData = function( subPanelContext, selectionData ) {
    if( appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:Location' ] !== 'ImportPreviewLocation' ) {
        var selectedSpecObj;
        if( subPanelContext ) {
            var modelObject = selectionData ? selectionData : subPanelContext.value.selected[0];
            if( modelObject && modelObject.modelType && modelObject.modelType.typeHierarchyArray && modelObject.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
                selectedSpecObj = {
                    iconURL: requirementsUtils.getTypeIconURL( modelObject.type ),
                    specName: modelObject.cellHeader1
                };
            } else {
                selectedSpecObj = {
                    iconURL: requirementsUtils.getTypeIconURL( modelObject.type ),
                    specName: modelObject.cellHeader1 || ( modelObject.props.awb0ArchetypeRevName ? modelObject.props.awb0ArchetypeRevName.dbValues[ 0 ] : null )
                };
            }
        }
        return selectedSpecObj;
    }
};

export const updateSharedDataStateForAddRule = ( commandContext, preference ) => {
    var newValue = 'Arm0AddRulesSub';
    if( preference[0] === 'true' ) {
        newValue = 'Arm0AddAdvanceRulesSub';
    }
    commandContext.sharedData.value.reqSpecEleTypeList = commandContext.sharedData.reqSpecEleTypeList;
    const sharedData = commandContext.sharedData;
    const newsharedData = { ...sharedData.value };
    newsharedData.activeView = newValue;
    sharedData.update && sharedData.update( newsharedData );
};

export const backActionForRule = ( sharedData ) => {
    let newSharedData = { ...sharedData };
    newSharedData.activeView = 'Arm0ImportFromOfficeSub';
    newSharedData.backButtonForRuleClicked = true;
    delete newSharedData.RULE_CONST;
    newSharedData.editRuleClicked = false;
    return newSharedData;
};

export const updateSharedDataStateForAddPropRule = ( commandContext ) => {
    var newValue = 'Arm0AddPropertyRuleSub';
    const sharedData = commandContext.subPanelContext.sharedData;
    const newsharedData = { ...sharedData.value };
    newsharedData.importType = commandContext.importType;
    newsharedData.activeView = newValue;
    sharedData.update && sharedData.update( newsharedData );
};
export const backActionForPropRule = ( sharedData, preference ) => {
    var newValue = 'Arm0AddRulesSub';
    if( preference[ 0 ] === 'true' ) {
        newValue = 'Arm0AddAdvanceRulesSub';
    }
    let newSharedData = { ...sharedData };
    newSharedData.activeView = newValue;
    if( newSharedData.PROP_RULE_CONST ) {
        delete newSharedData.PROP_RULE_CONST;
        newSharedData.editPropRuleClicked = false;
    }
    return newSharedData;
};

export let revealForCondition = function( condition ) {
    var operationType = _.clone( condition.operationType );
    var operationTypeValues = _.clone( condition.operationTypeValues );
    var style = _.clone( condition.style );
    var styleValues = _.clone( condition.styleValues );
    var operationValues = _.clone( condition.operationValues );
    var operationCheckboxValues = _.clone( condition.operationCheckboxValues );

    return {
        operationType: operationType,
        operationTypeValues: operationTypeValues,
        style: style,
        styleValues: styleValues,
        operationValues: operationValues,
        operationCheckboxValues:operationCheckboxValues
    };
};

export let removeAddRuleCondition = function( context ) {
    var eventdata;
    if( context.vmo ) {
        eventdata = context.vmo;
    }
    eventBus.publish( 'importSpecification.removeAddRuleCondition', eventdata );
};
export let removeAddPropRuleCondition = function( context ) {
    var eventdata;
    if( context.vmo ) {
        eventdata = context.vmo;
    }
    eventBus.publish( 'importSpecification.removeAddPropRuleCondition', eventdata );
};
export let removePropRuleCondition = function( context ) {
    var eventdata;
    if( context.vmo ) {
        eventdata = context.vmo;
    }
    eventBus.publish( 'importSpecification.removePropRuleCondition', eventdata );
};
export let getDisplayRule = function( dispPropRules ) {
    return dispPropRules;
};
export let getDisplayImportRules = function( importRules ) {
    return importRules;
};
export let editPropRuleCondition = function( context ) {
    var eventdata;
    if( context.vmo ) {
        eventdata = context.vmo;
    }
    eventBus.publish( 'importSpecification.editPropRuleCondition', eventdata );
};

export let mainEditPropRuleCondition = function( importRule ) {
    var eventdata;
    if( importRule ) {
        eventdata = importRule;
    }
    eventBus.publish( 'importSpecification.updateRule', eventdata );
};
export let mainRemovePropRuleCondition = function( importRule ) {
    var eventdata;
    if( importRule ) {
        eventdata = importRule;
    }
    eventBus.publish( 'importSpecification.removeRule', eventdata );
};
export let addConditionListProviderForEdit = function( sharedData ) {
    const newsharedData = { ...sharedData.value };
    var addConditionList = newsharedData.addConditionList;
    var importType =  newsharedData.importType;

    return {
        addConditionList: addConditionList,
        importType: importType
    };
};

export let refreshConditionListProviderTest = function( data, sharedData ) {
    var addConditionList = _.clone( data.addConditionList );
    var importType =  _.clone( data.importType );

    const newsharedData = { ...sharedData.value };
    addConditionList = newsharedData.addConditionList;
    importType.dbValue =  newsharedData.importType;
    importType.uiValue =  newsharedData.importType;


    return {
        addConditionList: addConditionList,
        importType: importType,
        conditionVMOs: addConditionList
    };
};

export let initOperationType = function( data, sharedData ) {
    var operationValues = _.clone( data.operationValues, true );
    operationValues.dbValue = null;
    operationValues.uiValue = null;

    var operationType =  _.clone( data.operationType, true );
    operationType.dbValue = sharedData.operationTypeValues.dbValue[0].propInternalValue;
    operationType.uiValue = sharedData.operationTypeValues.dbValue[0].dispValue;

    return {
        operationValues: operationValues,
        operationType: operationType
    };
};

export default exports = {
    closeImportPreview,
    closeImportPreviewProxyFunction,
    revealArm0AddRulesSub,
    addPropRule,
    unRegisterArm0AddPropRulesCtx,
    editPropRuleFn,
    updatePropRule,
    removePropRule,
    revealArm0AddPropRules,
    addConditionProcessing,
    getConditionListForAddedPropRules,
    createSaveRulesInput,
    saveImportRulePopupButtonClicked,
    populateRulesFromSavedRuleName,
    saveImportRuleButtonClicked,
    checkActionForSave,
    addRule,
    removeRule,
    updateRuleFn,
    updateRule,
    unRegisterArm0AddRulesSubCtx,
    getInputForAddPropRules,
    populateTypeDescriptions,
    dispplayFieldTypeValue,
    getLOVList,
    addCondition,
    removeCondition,
    addAdvanceRule,
    updateAdvanceRule,
    addAdvanceOptions,
    changeFiledTypes,
    getTypeNames,
    getExclusions,
    storeFormDataForUpdatePreviewForImportPDF,
    getCachedFormData,
    columnSelectionChanged,
    registerCmdContext,
    registerSharedData,
    moveUpDown,
    prepareSelectedSepcData,
    updateSharedDataStateForAddRule,
    backActionForRule,
    updateSharedDataStateForAddPropRule,
    backActionForPropRule,
    revealForCondition,
    removeAddRuleCondition,
    removeAddPropRuleCondition,
    getDisplayRule,
    removePropRuleCondition,
    editPropRuleCondition,
    addConditionForProp,
    removeConditionForProp,
    getDisplayImportRules,
    mainEditPropRuleCondition,
    mainRemovePropRuleCondition,
    addConditionListProviderForEdit,
    refreshConditionListProviderTest,
    initOperationType,
    showUpdateRuleNotificationWarning
};
