//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/*global
 */

/**
 *
 *
 * @module js/Evm1RecipeBuilderService
 */
import appCtxSvc from 'js/appCtxService';
import vmcs from 'js/viewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';
import dateTimeService from 'js/dateTimeService';
import cdm from 'soa/kernel/clientDataModel';
import editHandlerService from 'js/editHandlerService';
import preferenceService from 'soa/preferenceService';
import _ from 'lodash';
import dataSourceService from 'js/dataSourceService';
import awTableSvc from 'js/awTableService';
import selectionService from 'js/selection.service';
import clientMetaModel from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';

let exports = {};

/**
 * This method is used to call the soa for retrieving the closure rule and filtering it as per the input
 * @param {string} filter The input suggestion typed in for closure rule, which is used to filter the closure rule list
 * @param {string} data The view-model data
 * @param {object} closureRuleState The closureRuleState object
 * @returns {object} A Promise that will be resolved with the requested data when the data is available. In this case closure rule list
 */
export let getAllClosureRules = function( filter, data, closureRuleState ) {
    if( closureRuleState && closureRuleState.closureRules && closureRuleState.closureRules.closureRulesFromSoa && closureRuleState.closureRules.closureRulesFromSoa.ServiceData.modelObjects ) {
        let closureRuleList = getFilteredClosureRules( closureRuleState.closureRules.closureRulesFromSoa, filter, data );

        return { closureRuleList };
    }
};

let getFilteredClosureRules = function( response, filter, data ) {
    let closureRuleList = [];
    let selectedClosureRule = data.closureRuleValues.displayValues;

    if( response && response.ServiceData ) {
        let modelObjs = response.ServiceData.modelObjects;

        for( let key in modelObjs ) {
            let modelObject = modelObjs[ key ];
            let props = modelObject.props;
            let propertyValue = props.object_string.dbValues[ 0 ].trim();

            filter ? _.includes( propertyValue.toLowerCase(), filter.toLowerCase() ) && closureRuleList.push( {
                propDisplayValue: propertyValue,
                propInternalValue: propertyValue
            } ) : closureRuleList.push( {
                propDisplayValue: propertyValue,
                propInternalValue: propertyValue
            } );
        }
        if( selectedClosureRule && selectedClosureRule.length > 0 ) {
            closureRuleList = _.differenceWith( closureRuleList, selectedClosureRule, function( closureRuleEle, selectedEle ) {
                if( closureRuleEle.propInternalValue === selectedEle ) {
                    return closureRuleEle.propInternalValue;
                }
            } );
        }
        return closureRuleList;
    }
};

let pipeSeparateValues = function( inputString ) {
    let i = 0;
    let returnString;

    if( inputString.length >= 1 ) {
        returnString = inputString[ 0 ];
        for( i = 1; i < inputString.length; i++ ) {
            returnString += '|' + inputString[ i ];
        }
    }
    return returnString;
};

let getseedObjectUids = function( seedObjects ) {
    let i = 0;
    let returnString;

    if( seedObjects.length >= 1 ) {
        returnString = seedObjects[ 0 ].uid;
        for( i = 1; i < seedObjects.length; i++ ) {
            returnString += '|' + seedObjects[ i ].uid;
        }
    }
    return returnString;
};

/**
 * This method is used generate the execute reciep result.
 * @param {object} data decl viewmodel
 * @param {object} recipeState The recipeState object
 * @returns {object} newRecipeState The updated recipeState object
 */
export let generateShowResultTable = function( data, recipeState ) {
    const newRecipeState = { ...recipeState };
    let recipeCtx = appCtxSvc.getCtx( 'recipeCtx' );

    // Before updateContextWithSearchCriteria we should disable the show result button.
    if( recipeCtx ) {
        newRecipeState.isRecipeExecuting = true;
        updateContextWithSearchCriteria( recipeCtx, data, true, newRecipeState );
    } else {
        recipeCtx = {};
        newRecipeState.isRecipeExecuting = true;
        updateContextWithSearchCriteria( recipeCtx, data, false, newRecipeState );
    }
    return newRecipeState;
};

/**
 *Register or update context for data provider input for recipe table
 *
 * @param {object} recipeCtx context object
 * @param {object} data decl view model
 * @param {boolean} isUpdate if true then update the context
 * @param {object} recipeState The recipeState object
 */
let updateContextWithSearchCriteria = function( recipeCtx, data, isUpdate, recipeState ) {
    recipeState.recipeSearchCriteriaProvider = {};
    recipeState.recipeSearchCriteriaProvider.recipeObjectUid = 'AAAAAAAAAAAAAA';
    recipeState.recipeSearchCriteriaProvider.revisionRule = data.revisionRule.dbValue;
    recipeState.recipeSearchCriteriaProvider.closureRules = pipeSeparateValues( data.closureRuleValues.displayValues );

    if( recipeState.seedSelections && recipeState.seedSelections.length > 0 ) {
        let seedSelections = [];

        if( recipeCtx.userAction === 'execute' ) {
            seedSelections = recipeState.seedSelections;
            recipeCtx.userAction = undefined;
            recipeCtx.executeRecipeInput = undefined;
        } else {
            _.forEach( recipeState.seedSelections, function( seedSelection ) {
                let evm1Include = recipeState.includeToggleMap[ seedSelection.uid ];

                if( evm1Include && evm1Include.dbValue ) {
                    seedSelections.push( seedSelection );
                }
            } );
        }
        recipeState.recipeSearchCriteriaProvider.selecetedObjectUids = getseedObjectUids( seedSelections );
    }

    recipeState.recipeSearchCriteriaProvider.sqlString = '';
    if( data && data.endItems && data.endItems.length > 0 ) {
        let endItemUid = _.get( data, 'endItems[0].dbValues[0]', undefined );
        if( !endItemUid ) {
            endItemUid = _.get( data, 'endItems[0].uid', undefined );
        }
        recipeState.recipeSearchCriteriaProvider.effectivityEndItem = endItemUid;
    } else {
        let endItemUid = _.get( recipeState.builderConfigValues, 'endItems[0].dbValues[0]', undefined );
        if( endItemUid ) {
            recipeState.recipeSearchCriteriaProvider.effectivityEndItem = endItemUid;
        }
    }

    if( data.effecUnits && data.effecUnits.uiValue && data.effecUnits.dbValue &&
        data.effecUnits.uiValue !== data.i18n.effectivityUnitSectionAllUnitsValue ) {
        recipeState.recipeSearchCriteriaProvider.effectivityUnit = data.effecUnits.dbValue;
    } else {
        recipeState.recipeSearchCriteriaProvider.effectivityUnit = 'undefined';
    }
    if( data.effecDate && data.effecDate.uiValue &&
        data.effecDate.uiValue !== data.i18n.occurrenceManagementTodayTitle ) {
        recipeState.recipeSearchCriteriaProvider.effectivityDate = data.effecDate.uiValue;
    } else {
        recipeState.recipeSearchCriteriaProvider.effectivityDate = undefined;
    }

    recipeState.recipeSearchCriteriaProvider.effectivityGroups = data.effectivityGroups;

    if( recipeState.productContextInfo ) {
        recipeState.recipeSearchCriteriaProvider.productContext = recipeState.productContextInfo.uid;
    }

    if( data.variantRule && data.variantRule.dbValue && data.variantRule.dbValue !== '' &&
        data.variantRule.uiValue !== data.defaultVariantRule.uiValue ) {
        recipeState.recipeSearchCriteriaProvider.variantRules = data.variantRule.dbValue;
    } else {
        recipeState.recipeSearchCriteriaProvider.variantRules = undefined;
    }

    // check for inScopeNavigation
    recipeState.recipeSearchCriteriaProvider.isInScopeNavigation = 'false';

    if( recipeState && recipeState.isInScopeNavigationVisible && data.inContext && data.inContext.dbValue === true ) {
        recipeState.recipeSearchCriteriaProvider.isInScopeNavigation = 'true';
    }
    if( isUpdate ) {
        appCtxSvc.updateCtx( 'recipeCtx', recipeCtx );
    } else {
        appCtxSvc.registerCtx( 'recipeCtx', recipeCtx );
    }
};

/**
 * This method is used to create the inputs for the SOA Manage Recipe for the actions 'read' and 'update' only.
 * @param {Object} eventData The eventData which has the manageAction i.e either 'read' or 'update'
 * @param {object} xrtSummaryContextObject The selcted reciepe object
 * @returns {object} input The input created for manageRecipe SOA call
 */
export let getManageRecipeInput = function( eventData, xrtSummaryContextObject ) {
    let input = [];
    let manageAction = eventData.manageAction;
    let recipeCtx = appCtxSvc.getCtx( 'recipeCtx' );

    if( recipeCtx && recipeCtx.userAction && recipeCtx.userAction === 'execute' ) {
        manageAction = 'ReadOverride';
    }

    let inputData = {
        clientId: manageAction,
        manageAction: manageAction,
        recipeCreInput: {
            boName: '',
            propertyNameValues: {},
            compoundCreateInput: {}
        }
    };

    inputData.recipeObject = {
        uid: xrtSummaryContextObject.uid,
        type: xrtSummaryContextObject.type
    };

    switch ( manageAction ) {
        case 'ReadOverride':
            inputData.criteriaInput = {
                selectContentInputs: [],
                configSet: {
                    revisionRule: '',
                    variantRules: [],
                    effectivityUnit: -1,
                    effectivityEndItem: {
                        uid: '',
                        type: ''
                    },
                    effectivityDate: '',
                    effectivityGroups: []
                },
                criteriaSet: {
                    closureRuleNames: [],
                    lwoQueryExpression: ''
                },
                productContext: undefined,
                isConfigChanged: false
            };
            if( recipeCtx && recipeCtx.executeRecipeInput ) {
                if( recipeCtx.executeRecipeInput.productContext ) {
                    inputData.criteriaInput.productContext = { uid: recipeCtx.executeRecipeInput.productContext.uid };
                }
                for( let idx = 0; idx < recipeCtx.executeRecipeInput.selectedObjs.length; ++idx ) {
                    let seed = recipeCtx.executeRecipeInput.selectedObjs[ idx ];

                    inputData.criteriaInput.selectContentInputs.push( {
                        uid: seed.uid,
                        type: seed.type
                    } );
                }
            }
            break;

        case 'Read':
            inputData.criteriaInput = {
                selectContentInputs: [],
                configSet: {
                    revisionRule: '',
                    variantRules: [],
                    effectivityUnit: -1,
                    effectivityEndItem: {
                        uid: '',
                        type: ''
                    },
                    effectivityDate: '',
                    effectivityGroups: []
                },
                criteriaSet: {
                    closureRuleNames: [],
                    lwoQueryExpression: ''
                },
                productContext: undefined,
                isConfigChanged: false
            };
            break;

        case 'Update':
            inputData.criteriaInput = {
                selectContentInputs: eventData.seedObjects,
                configSet: {
                    revisionRule: eventData.revisionRule,
                    variantRules: eventData.variantRules,
                    effectivityUnit: eventData.effectivityUnit,
                    effectivityEndItem: eventData.effectivityEndItem,
                    effectivityDate: eventData.effectivityDate,
                    effectivityGroups: eventData.effectivityGroups
                },
                criteriaSet: {
                    closureRuleNames: eventData.closureRule,
                    lwoQueryExpression: ''
                },
                isConfigChanged: eventData.showConfig
            };

            if( eventData.productContextInfo && eventData.productContextInfo.uid ) {
                inputData.criteriaInput.productContext = { uid: eventData.productContextInfo.uid };
            } else {
                inputData.criteriaInput.productContext = {
                    uid: '',
                    type: ''
                };
            }
            break;

        case 'ApplyConfig':
            inputData.criteriaInput = {
                selectContentInputs: eventData.seedObjects,
                configSet: {
                    revisionRule: eventData.revisionRule,
                    variantRules: eventData.variantRules,
                    svrOwningItem: eventData.svrOwningItem,
                    effectivityUnit: eventData.effectivityUnit,
                    effectivityEndItem: eventData.effectivityEndItem,
                    effectivityDate: eventData.effectivityDate,
                    effectivityGroups: eventData.effectivityGroups
                },
                criteriaSet: {
                    closureRuleNames: [],
                    lwoQueryExpression: ''
                },
                productContext: {
                    uid: '',
                    type: ''
                },
                isConfigChanged: true
            };
            break;
    }
    input.push( inputData );
    return input;
};

/**
 * This method is used to process the response coming from manageRecipe SOA. In case of read operation, all the
 * retrieved criteria from the response is mapped to the recipe builder values
 * @param {Object} output The response from manageRecipe SOA
 * @param {Object} data The view-model data
 * @param {object} recipeState The recipeState object
 * @returns {Object} output In case of partial or service data errors
 */
export let getManageRecipeResponse = function( output, data, recipeState, xrtSummaryContextObjectUid ) {
    if( output.partialErrors || output.ServiceData && output.ServiceData.partialErrors ) {
        return output;
    }

    const newRecipeState = { ...recipeState };

    newRecipeState.showConfig = true;
    newRecipeState.hasViewManagementLicense = true;
    if( output && data && output.recipeOutput && output.recipeOutput.length > 0 && output.recipeOutput[ 0 ].recipeOutput &&
        output.recipeOutput[ 0 ].recipeObject.uid === xrtSummaryContextObjectUid ) {
        if( output.recipeOutput[ 0 ].clientId === 'Read' || output.recipeOutput[ 0 ].clientId === 'ReadOverride' ) {
            processReadResponse( output, data, newRecipeState );
            createCache( data, newRecipeState );
            exports.validateInScopeNavigation( data, newRecipeState );
            if( data && data.inContext && newRecipeState && newRecipeState.isInScopeNavigationVisible ) {
                preferenceService.getStringValue( 'Evm1InScopeNavigation' ).then( function( prefValue ) {
                    if( prefValue === 'true' ) {
                        data.inContext.dbValue = true;
                    }
                } );
            }
        }

        if( output.recipeOutput[ 0 ].clientId === 'ApplyConfig' ) {
            processApplyConfigResponse( output, data, newRecipeState );
        }

        if( output.recipeOutput[ 0 ].clientId === 'Update' ) {
            newRecipeState.inEditMode = false;
            if( newRecipeState.context ) {
                newRecipeState.showConfig = false;
            }
            createCache( data, newRecipeState );
        }
    }
    return newRecipeState;
};

let processReadResponse = function( output, data, recipeState ) {
    let seedModelObjects;
    let savedRevRule = output.recipeOutput[ 0 ].recipeOutput.configSet.revisionRule;

    if( savedRevRule && savedRevRule !== '' ) {
        data.revisionRule.dbValue = savedRevRule;
        data.revisionRule.dbValues = [ savedRevRule ];
        data.revisionRule.uiValue = savedRevRule;
        data.revisionRule.uiValues = [ savedRevRule ];
        data.revisionRule.newDisplayValues = [ savedRevRule ];
        data.revisionRule.newValue = savedRevRule;
    }

    seedModelObjects = output.recipeOutput[ 0 ].recipeOutput.selectContentInputs;

    // Get the product context from the service data if received
    let productContextFromSOA;

    if( _.get( output, 'recipeOutput[0].recipeOutput.productContext.uid', 'AAAAAAAAAAAAAA' ) !== 'AAAAAAAAAAAAAA' ) {
        productContextFromSOA = output.recipeOutput[ 0 ].recipeOutput.productContext;
    }

    // Set the flag which is used to be used for execute case.
    //Set it to false and only after apply config it will be set to true and will remain true until next read call
    recipeState.recipeExecuteFlag = false;

    //Set the context from the SOA output
    let contextObjectVMO;
    let contextObject = cdm.getObject( output.recipeOutput[ 0 ].recipeOutput.context.uid );

    if( contextObject ) {
        contextObjectVMO = vmcs.createViewModelObject( contextObject.uid, 'EDIT' );
        recipeState.showConfig = false;
    }
    recipeState.context = contextObjectVMO;
    data.context = contextObjectVMO;
    recipeState.includeToggleMap = {};
    if( output.recipeOutput[ 0 ].recipeOutput.seedInfos.length > 0 ) {
        recipeState.seedInfos = output.recipeOutput[ 0 ].recipeOutput.seedInfos;
        data.seedInfos = output.recipeOutput[ 0 ].recipeOutput.seedInfos;
    }

    // Update the context with the productContext info
    updateCtxWithProductContext( productContextFromSOA, recipeState );

    let seeds = [];

    if( seedModelObjects && seedModelObjects.length > 0 ) {
        // Create viewmodel objects from the received model objects
        for( let key in seedModelObjects ) {
            let seedModelObject = seedModelObjects[ key ];
            let seedViewModelObject = vmcs.constructViewModelObjectFromModelObject( seedModelObject, 'EDIT' );

            if( seedViewModelObject ) {
                seeds.push( seedViewModelObject );
            }
        }
    }
    //update the ctx with the new seeds if any and fire event to reset the seeds to render them
    updateCtxWithSeedSelections( seeds, recipeState );

    let savedClosureRules = output.recipeOutput[ 0 ].recipeOutput.criteriaSet.closureRuleNames;

    if( savedClosureRules && savedClosureRules.length > 0 ) {
        data.closureRuleValues.displayValues = savedClosureRules;

        data.closureRuleValues.displayValsModel = [];
        for( let i = 0; i < savedClosureRules.length; i++ ) {
            data.closureRuleValues.displayValsModel.push( {
                displayValue: savedClosureRules[ i ],
                selected: false
            } );
        }
    }
};

let processApplyConfigResponse = function( output, data, recipeState ) {
    // Get the product context from the service data if received
    let productContextFromSOA;

    if( _.get( output, 'recipeOutput[0].recipeOutput.productContext.uid', 'AAAAAAAAAAAAAA' ) !== 'AAAAAAAAAAAAAA' ) {
        productContextFromSOA = output.recipeOutput[ 0 ].recipeOutput.productContext;
    }
    // Update the context with the productContext info
    updateCtxWithProductContext( productContextFromSOA, recipeState );

    let savedRevRule = output.recipeOutput[ 0 ].recipeOutput.configSet.revisionRule;

    if( savedRevRule && savedRevRule !== '' ) {
        data.revisionRule.dbValue = savedRevRule;
        data.revisionRule.dbValues = [ savedRevRule ];
        data.revisionRule.uiValue = savedRevRule;
        data.revisionRule.uiValues = [ savedRevRule ];
        data.revisionRule.newDisplayValues = [ savedRevRule ];
        data.revisionRule.newValue = savedRevRule;
    }
    recipeState.recipeExecuteFlag = true;

    //Set the context from the SOA output
    let contextObjectVMO;
    let contextObject = cdm.getObject( output.recipeOutput[ 0 ].recipeOutput.context.uid );

    if( contextObject ) {
        contextObjectVMO = vmcs.createViewModelObject( contextObject.uid, 'EDIT' );
        recipeState.showConfig = false;
    }
    recipeState.context = contextObjectVMO;
    data.context = contextObjectVMO;
    recipeState.includeToggleMap = {};
    if( output.recipeOutput[ 0 ].recipeOutput.seedInfos.length > 0 ) {
        recipeState.seedInfos = output.recipeOutput[ 0 ].recipeOutput.seedInfos;
        data.seedInfos = output.recipeOutput[ 0 ].recipeOutput.seedInfos;
    }

    let seedsFromOP = output.recipeOutput[ 0 ].recipeOutput.selectContentInputs;

    if( seedsFromOP ) {
        recipeState.AppliedSeed = seedsFromOP;

        let newSeeds = [];

        // Create viewmodel objects from the received model objects
        for( let key in recipeState.AppliedSeed ) {
            let seedModelObject = recipeState.AppliedSeed[ key ];
            let seedViewModelObject = vmcs.constructViewModelObjectFromModelObject( seedModelObject, 'EDIT' );

            if( seedViewModelObject ) {
                newSeeds.push( seedViewModelObject );
            }
        }
        // Update the seeds with the new seeds received from SOA Response in case of Apply Config
        recipeState.seedSelections = newSeeds;
    }
};

/**
 *  This method used to update revision rule
 *
 * @param {Object} data The view-model data
 * @param {Object} eventData The event data received from even listener
 * @param {object} recipeState The recipeState object
 */
export let updateRevisionRuleNB = function( data, eventData, recipeState ) {
    const newRecipeState = { ...recipeState };

    if( eventData && eventData.revisionRule ) {
        data.revisionRule.dispValue = eventData.revisionRule;
        data.revisionRule.uiValue = eventData.revisionRule;
        data.revisionRule.uiValues = [ eventData.revisionRule ];
        data.revisionRule.newDisplayValues = [ eventData.revisionRule ];
        data.revisionRule.newValue = eventData.revisionRule;
        data.revisionRule.dbValue = eventData.revisionRule;
        data.revisionRule.dbValues = [ eventData.revisionRule ];

        if( recipeState ) {
            if( recipeState.builderConfigValues ) {
                newRecipeState.builderConfigValues.revisionRule.uiValue = eventData.revisionRule;
                newRecipeState.builderConfigValues.revisionRule.uiValues = [ eventData.revisionRule ];
                newRecipeState.builderConfigValues.revisionRule.dispValue = eventData.revisionRule;
                newRecipeState.builderConfigValues.revisionRule.dbValue = eventData.revisionRule;
                newRecipeState.builderConfigValues.revisionRule.dbValues = [ eventData.revisionRule ];
                newRecipeState.builderConfigValues.revisionRule.newDisplayValues = [ eventData.revisionRule ];
                newRecipeState.builderConfigValues.revisionRule.newValue = eventData.revisionRule;
            } else {
                newRecipeState.builderConfigValues = {
                    revisionRule: data.revisionRule
                };
            }
        }
    }
    return newRecipeState;
};

let updateCtxWithSeedSelections = function( seeds, recipeState ) {
    if( seeds ) {
        if( recipeState.seedSelections && recipeState.seedSelections.length > 0 ) {
            recipeState.seedSelections = _.unionBy( recipeState.seedSelections, seeds, 'uid' );
        } else {
            recipeState.seedSelections = seeds;
        }
    }
};

let updateCtxWithProductContext = function( productContextFromSOA, recipeState ) {
    if( productContextFromSOA ) {
        recipeState.productContextFromSOA = productContextFromSOA;
        // We are setting this productContextForVariantRule in recipeState to just query related variant rules
        // for newly selected SVR item.
        recipeState.productContextForVariantRule = productContextFromSOA.uid;
        if( recipeState.productContextFromSOA ) {
            recipeState.productContextInfo = recipeState.productContextFromSOA;
        }
    }
};

/**
 * This method is used to unregister the recipe related ctx
 */
export let unloadContent = function() {
    appCtxSvc.unRegisterCtx( 'recipeCtx' );
    appCtxSvc.unRegisterCtx( 'recipeConfigCtx' );
};

/**
 * This method is used to initialize the values of builder configuration on the recipe
 * @param {Object} data the view model data of recipe
 * @param {object} recipeState The recipeState object
 * @param {object} awp0RevRule The recipeState object
 * @return {object} newRecipeState The updated recipeState object
 */
export let initializeBuilderConfig = function( data, recipeState, awp0RevRule ) {
    const newRecipeState = { ...recipeState };

    if( newRecipeState.productContextFromSOA ) {
        newRecipeState.productContextInfo = newRecipeState.productContextFromSOA;
    }
    if( newRecipeState.productContextInfo ) {
        let productContextInfo = newRecipeState.productContextInfo;

        //We are directly taking the revision rule from output pf the SOA response.
        //Hence we do not need to take the Revision Rule form the Product Context Info object like ACE does
        //Hence commented out this function call. It might be needed in case the current UX changes or we need
        //separate case for read user action and apply config user action. So keeping the function call commented and not removing it
        //Not required to call revisionRuleFromPCI() as revision rule will get set from SOA output not from productContext
        //This is because when we set effectivity(date and/or unit) revision rule gets modified and this is set on it
        //So we need to show and use original revision rule else we get wrong results.

        effectivityDateFromPCI( data, productContextInfo );
        effectivityUnitFromPCI( data, productContextInfo );
        variantRuleFromPCI( data, productContextInfo );
        newRecipeState.builderConfigValues = {
            revisionRule: data.revisionRule,
            effecDate: data.effecDate,
            effecUnits: data.effecUnits,
            variantRules: data.variantRule,
            endItems: data.endItems,
            endItemsFromContext: data.endItemsFromContext,
            svrOwningItem: data.svrOwningItem,
            openedProduct: data.openedProduct
        };
    } else {
        newRecipeState.builderConfigValues = {
            revisionRule: awp0RevRule
        };
    }
    let eh = editHandlerService.getActiveEditHandler();
    if( eh && eh.editInProgress() ) {
        // Without this closureRule will not be editable
        eh.startEdit();
    }
    return newRecipeState;
};

export let getClosureRulesSoa = function( response ) {
    let closureRuleList = getFilteredClosureRules( response, '', { closureRuleValues: {} } );

    return {
        closureRulesFromSoa: response,
        filteredClosureRules: closureRuleList
    };
};

/**
 * This method is used to get the revision rule from Product Context Info
 * @param {Object} data the view model data
 * @param {Object} productContextInfo the product context info from the CTX
 * @returns {String} the revision rule value
 */
export let revisionRuleFromPCI = function( data, productContextInfo ) {
    if( productContextInfo.props && productContextInfo.props.awb0CurrentRevRule ) {
        let revRuleFromACE = productContextInfo.props.awb0CurrentRevRule;

        if( revRuleFromACE.uiValues && revRuleFromACE.uiValues[ 0 ] ) {
            // If it is called from initialize builder config method then set the revision rule on data property
            if( data && data.revisionRule ) {
                data.revisionRule.dispValue = revRuleFromACE.uiValues[ 0 ];
                data.revisionRule.uiValue = revRuleFromACE.uiValues[ 0 ];
            }
            // The return is for the case when we are creating the Recipe with BOM selection in ACE
            return revRuleFromACE.uiValues[ 0 ];
        }
    }
};

/**
 * This method is used to get the effectivity date from Product Context Info
 * @param {Object} data the view model data
 * @param {Object} productContextInfo the product context info from the CTX
 * @returns {String} the effectivity date value
 */
export let effectivityDateFromPCI = function( data, productContextInfo ) {
    let effecDateFromACE;

    if( productContextInfo && productContextInfo.props.awb0EffDate ) {
        effecDateFromACE = {
            dbValue: productContextInfo.props.awb0EffDate.dbValues[ 0 ]
        };
        if( !effecDateFromACE || !effecDateFromACE.dbValue ) {
            let currentRevisionRule = getRevRuleFromProductContextInfo( productContextInfo );

            effecDateFromACE = getEffectiveDateFromRevisionRule( currentRevisionRule );
            if( !effecDateFromACE || !effecDateFromACE.dbValue ) {
                if( data && data.effecDate ) {
                    effecDateFromACE = getDefaultEffectiveDate( data );
                }
            }
        }
    }
    if( effecDateFromACE ) {
        if( data && data.effecDate ) {
            let date = '';

            if( effecDateFromACE.dbValue && effecDateFromACE.uiValue !== data.occurrenceManagementTodayTitle.uiValue ) {
                date = effecDateFromACE.dbValue;
                date = dateTimeService.formatDate( date );
                effecDateFromACE.uiValue = date.toString();
            }
            uwPropertyService.updateModelData( data.effecDate, effecDateFromACE.dbValue, [ effecDateFromACE.uiValue ], false, false, false, {} );
        }
        return effecDateFromACE.dbValue;
    }
};

let getEffectiveDateFromRevisionRule = function( currentRevisionRule ) {
    if( currentRevisionRule ) {
        let currentRevisionRuleModelObject = cdm.getObject( currentRevisionRule.dbValues );

        if( currentRevisionRuleModelObject ) {
            if( currentRevisionRuleModelObject.props && currentRevisionRuleModelObject.props.rule_date ) {
                return {
                    dbValue: currentRevisionRuleModelObject.props.rule_date.dbValues[ 0 ]
                };
            }
        }
    }
};

let getDefaultEffectiveDate = function( data ) {
    if( data ) {
        return _.clone( data.occurrenceManagementTodayTitle, true );
    }
};

/**
 * This method is used to get the effectivity unit from Product Context Info
 * @param {Object} data the view model data
 * @param {Object} productContextInfo the product context info from the CTX
 * @returns {String} the effectivity unit value
 */
export let effectivityUnitFromPCI = function( data, productContextInfo ) {
    if( productContextInfo.props ) {
        let aceEffectiveUnit = getEffectiveUnitFromProductContextInfo( productContextInfo );

        if( !aceEffectiveUnit || !aceEffectiveUnit.dbValue && aceEffectiveUnit.dbValues[ 0 ] === '' ) {
            let currentRevisionRule = getRevRuleFromProductContextInfo( productContextInfo );

            aceEffectiveUnit = getEffectiveUnitFromRevisionRule( currentRevisionRule );
            if( !aceEffectiveUnit || !aceEffectiveUnit.dbValue && aceEffectiveUnit.dbValues[ 0 ] === '' ) {
                if( data && data.effecUnits ) {
                    aceEffectiveUnit = getEffectivityGroupsFromProductContextInfo( data, productContextInfo );
                    if( !aceEffectiveUnit || !aceEffectiveUnit.uiValue ) {
                        aceEffectiveUnit = getDefaultEffectiveUnit( data );
                    }
                }
            }
        }

        let endItems = [];

        if( productContextInfo.props.awb0EffEndItem.dbValues[ 0 ] !== null ) {
            endItems.push( productContextInfo.props.awb0EffEndItem );
        } else if( productContextInfo.props.awb0Product ) {
            endItems.push( productContextInfo.props.awb0Product );
        }

        let endItemsFromContext = [];

        if( productContextInfo.props.awb0EffEndItem.dbValues[ 0 ] !== null ) {
            endItemsFromContext.push( productContextInfo.props.awb0EffEndItem );
        } else if( productContextInfo.props.awb0Product ) {
            endItemsFromContext.push( productContextInfo.props.awb0Product );
        }

        let units = _.clone( data.effectivityUnitSectionAllUnitsValue, true );

        if( aceEffectiveUnit ) {
            let effectiveUnitValue = _.get( aceEffectiveUnit, 'dbValue', '' );

            if( effectiveUnitValue !== null && effectiveUnitValue !== '' ) {
                units.dbValue = aceEffectiveUnit.dbValue;
                units.uiValue = aceEffectiveUnit.dbValue;
            } else {
                effectiveUnitValue = _.get( aceEffectiveUnit, 'dbValues[0]', '' );
                if( effectiveUnitValue !== null && effectiveUnitValue !== '' ) {
                    units.dbValue = aceEffectiveUnit.dbValues[ 0 ];
                    units.uiValue = aceEffectiveUnit.uiValues[ 0 ];
                }
            }
        }

        let effecUnits = parseInt( units.dbValue );

        if( isNaN( effecUnits ) ) {
            units.dbValue = '-1';
        }
        if( data && data.effecUnits ) {
            data.effecUnits.displayValues.push( units.uiValue );
            data.effecUnits.uiValues = [];
            data.effecUnits.uiValues.push( units.uiValue );
            data.effecUnits.uiValue = units.uiValue;
            data.effecUnits.dbValue = units.dbValue;
            data.effecUnits.dbValues = [];
            data.effecUnits.dbValues.push( units.dbValue );
            data.endItems = endItems;
            data.endItemsFromContext = endItemsFromContext;
        }
        return units.dbValue;
    }
};

let getEffectiveUnitFromProductContextInfo = function( productContextInfo ) {
    let effecUnit = productContextInfo.props.awb0EffUnitNo;

    if( effecUnit ) {
        return effecUnit;
    }
};

let getRevRuleFromProductContextInfo = function( productContextInfo ) {
    let revRule = productContextInfo.props.awb0CurrentRevRule;

    if( revRule ) {
        return revRule;
    }
};

let getEffectiveUnitFromRevisionRule = function( currentRevisionRule ) {
    if( currentRevisionRule && currentRevisionRule.dbValues ) {
        let currentRevisionRuleModelObject = cdm.getObject( currentRevisionRule.dbValues );

        if( currentRevisionRuleModelObject && currentRevisionRuleModelObject.props &&
            currentRevisionRuleModelObject.props.rule_unit && currentRevisionRuleModelObject.props.rule_unit.uiValues ) {
            return currentRevisionRuleModelObject.props.rule_unit;
        }
    }
};

let getEffectivityGroupsFromProductContextInfo = function( data, productContextInfo ) {
    if( productContextInfo.props.awb0EffectivityGroups &&
        productContextInfo.props.awb0EffectivityGroups.dbValues.length > 0 ) {
        let effectivityGroupProperty = {
            dbValue: '-1'
        };

        if( productContextInfo.props.awb0EffectivityGroups.dbValues.length > 1 ) {
            effectivityGroupProperty.uiValue = data.multipleGroups.uiValue;
        } else {
            let groupItemRev = cdm.getObject( productContextInfo.props.awb0EffectivityGroups.dbValues[ 0 ] );

            effectivityGroupProperty.uiValue = groupItemRev.props.object_name.uiValues[ 0 ];
        }
        return effectivityGroupProperty;
    }
};

let getDefaultEffectiveUnit = function( data ) {
    if( data ) {
        return _.clone( data.effectivityUnitSectionAllUnitsValue, true );
    }
};

/**
 * This method is used to get the variant rules from Product Context Info
 * @param {Object} data the view model data
 * @param {Object} productContextInfo the product context info from the CTX
 * @returns {Array} the variant rules
 */
export let variantRuleFromPCI = function( data, productContextInfo ) {
    let currentVariantRules = _.get( productContextInfo, 'props.awb0VariantRules', undefined );
    let variantRuleProperties = [];

    if( currentVariantRules && currentVariantRules.dbValues && currentVariantRules.dbValues.length > 0 ) {
        for( let i = 0; i < currentVariantRules.dbValues.length; i++ ) {
            variantRuleProperties.push( {
                uid: currentVariantRules.dbValues[ i ],
                uiValue: currentVariantRules.uiValues[ i ]
            } );
        }
    }
    if( variantRuleProperties.length === 0 && data && data.defaultVariantRule ) {
        let defaultVariantRule = getDefaultVariantRule( data );

        if( defaultVariantRule ) {
            defaultVariantRule.ruleIndex = 0;
        }
        variantRuleProperties[ 0 ] = defaultVariantRule;
    }

    if( variantRuleProperties && variantRuleProperties.length > 0 && data && data.variantRule ) {
        data.variantRule.dispValue = variantRuleProperties[ 0 ].uiValue;
        data.variantRule.uiValue = variantRuleProperties[ 0 ].uiValue;
        if( variantRuleProperties[ 0 ].uid ) {
            data.variantRule.dbValue = variantRuleProperties[ 0 ].uid;
        } else {
            data.variantRule.dbValue = '';
        }
    }

    let svrOwningItem = _.get( productContextInfo, 'props.awb0VariantRuleOwningRev', undefined );
    let openedProduct = _.get( productContextInfo, 'props.awb0Product', undefined );

    if( !svrOwningItem || svrOwningItem.isNulls && svrOwningItem.isNulls.length > 0 &&
        svrOwningItem.isNulls[ 0 ] === true && openedProduct ) {
        svrOwningItem = openedProduct;
    }
    if( svrOwningItem && data ) {
        data.svrOwningItem = svrOwningItem;
    }
    if( openedProduct && data ) {
        data.openedProduct = openedProduct;
    }
    return variantRuleProperties;
};

let getDefaultVariantRule = function( data ) {
    if( data ) {
        return _.clone( data.defaultVariantRule, true );
    }
};

/**
 * This method is used to populate the configuration values on recipe builder with values coming from event data
 * @param {Object} data the view model data
 * @param {Object} eventData the event data from the event
 */
export let populateConfiguration = function( data, eventData ) {
    if( data && eventData ) {
        if( eventData.currentRevisionRule && eventData.currentRevisionRule.uiValue ) {
            data.revisionRule.dispValue = eventData.currentRevisionRule.uiValue;
            data.revisionRule.uiValue = eventData.currentRevisionRule.uiValue;
        }
        if( eventData.currentEffecUnit ) {
            data.effecUnits.displayValues.push( eventData.currentEffecUnit.toString() );
            data.effecUnits.uiValues.push( eventData.currentEffecUnit.toString() );
            data.effecUnits.uiValue = eventData.currentEffecUnit.toString();
        }
        if( eventData.selectedEffecDate ) {
            let date = dateTimeService.formatDate( eventData.selectedEffecDate );

            uwPropertyService.updateModelData( data.effecDate, eventData.selectedEffecDate, [ date.toString() ], false, false, false, {} );
        }
        if( eventData.currentVariantRule ) {
            data.variantRule.dispValue = eventData.currentVariantRule;
            data.variantRule.uiValue = eventData.currentVariantRule;
        }
    }
};

export let disableCommandsVisibility = function( recipeState ) {
    const newRecipeState = { ...recipeState };

    newRecipeState.hasViewManagementLicense = false;
    return newRecipeState;
};

export let validateInScopeNavigation = function( data, recipeState ) {
    recipeState.isInScopeNavigationVisible = false;
    recipeState.showConfig = true;
    if( recipeState.context ) {
        data.inContext.propertyDisplayName = data.i18n.evm1InContext;
        recipeState.isInScopeNavigationVisible = true;
        recipeState.showConfig = false;
    } else {
        _.forEach( recipeState.seedInfos, function( seedInfo ) {
            let rootElement = cdm.getObject( seedInfo.rootElement.uid );

            if( rootElement ) {
                data.inContext.propertyDisplayName = data.i18n.evm1InBom;
                recipeState.isInScopeNavigationVisible = true;
                recipeState.showConfig = true;
                return true;
            }
        } );
    }
    if( !recipeState.isInScopeNavigationVisible ) {
        recipeState.productContextInfo = undefined;
    }
};

export let addViewDataInDataSource = function( data, panelID ) {
    let eh = editHandlerService.getActiveEditHandler();
    let dataSource = eh.getDataSource();
    let newViewModel = { ...dataSource.getDeclViewModel() };

    newViewModel.customPanelInfo = newViewModel.customPanelInfo ? newViewModel.customPanelInfo : {};
    newViewModel.customPanelInfo[ panelID ] = data;

    let newDataSource = dataSourceService.createNewDataSource( { declViewModel: newViewModel } );
    eh.setDataSource( newDataSource );
};

export let updateTheFocussedComponent = function( localSelectionData ) {
    if( localSelectionData && localSelectionData.selected ) {
        return localSelectionData.id;
    }
};

export let handleSelectionChangeForMutuallyExclusion = function( localSelectionData, parentSelectionData, selectionModels, xrtSummaryContextObjectUid ) {
    const newLocalSelectionData = { ...localSelectionData };
    let selections = [];

    if( !_.isEmpty( newLocalSelectionData && parentSelectionData ) && newLocalSelectionData.selected && selectionModels ) {
        if( newLocalSelectionData.selected.length > 0 ) {
            selectionModels.map( selModel => {
                if( newLocalSelectionData.id !== selModel.name ) {
                    selModel.selectNone();
                }
            } );
        }
        _.forEach( newLocalSelectionData.selected, function( selected ) {
            if( awTableSvc.isViewModelTreeNode( selected ) ) {
                let uid = _.get( selected, 'props.evm1SourceObject.dbValues[0]', undefined );

                if( !uid ) {
                    uid = selected.uid;
                }
                selections.push( vmcs.createViewModelObject( uid, 'EDIT' ) );
            } else {
                if( clientMetaModel.isInstanceOf( 'Evm1RecipeResultProxy', selected.modelType ) ) {
                    let uid = _.get( selected, 'props.evm1SourceObject.dbValues[0]', undefined );

                    if( uid ) {
                        selections.push( vmcs.createViewModelObject( uid, 'EDIT' ) );
                    }
                } else {
                    selections.push( selected );
                }
            }
        } );
        newLocalSelectionData.selected = selections;
        // For deselect move selection back to recipe
        if( newLocalSelectionData.selected.length === 0 ) {
            let parentSelection = selectionService.getSelection().parent;

            if( !parentSelection ) {
                parentSelection = vmcs.createViewModelObject( xrtSummaryContextObjectUid, 'EDIT' );
            }
            newLocalSelectionData.selected.push( parentSelection );
        }
        parentSelectionData.update( { ...newLocalSelectionData } );
    }
};

let createCache = function( data, recipeState ) {
    // Cache the contents of Recipe if they are present
    recipeState.recipeEditCache = {
        cacheData: {}
    };

    if( recipeState.seedSelections ) {
        recipeState.recipeEditCache.cacheData.seedObjects = _.cloneDeep( recipeState.seedSelections );
    }
    if( recipeState.seedInfos ) {
        recipeState.recipeEditCache.cacheData.seedInfos = _.cloneDeep( recipeState.seedInfos );
    }
    if( data.closureRuleValues.displayValues ) {
        recipeState.recipeEditCache.cacheData.closureRule = _.cloneDeep( data.closureRuleValues );
    }
    if( data.revisionRule && data.revisionRule.uiValue ) {
        recipeState.recipeEditCache.cacheData.revisionRule = _.cloneDeep( data.revisionRule );
    }
    if( data.effecDate && data.effecDate.uiValue ) {
        recipeState.recipeEditCache.cacheData.effecDate = _.cloneDeep( data.effecDate );
    }
    if( data.effecUnits && data.effecUnits.uiValue ) {
        recipeState.recipeEditCache.cacheData.effecUnits = _.cloneDeep( data.effecUnits );
    }
    if( data.variantRule && data.variantRule.uiValue ) {
        recipeState.recipeEditCache.cacheData.variantRule = _.cloneDeep( data.variantRule );
    }
    if( recipeState.productContextInfo ) {
        recipeState.recipeEditCache.cacheData.productContextInfo = _.cloneDeep( recipeState.productContextInfo );
    }
    if( recipeState.productContextFromSOA ) {
        recipeState.recipeEditCache.cacheData.productContextFromSOA = _.cloneDeep( recipeState.productContextFromSOA );
    }
    if( recipeState.context ) {
        recipeState.recipeEditCache.cacheData.context = _.cloneDeep( recipeState.context );
    }
};

export let updateRecipeSearchCriteria = function( recipeState, data ) {
    const newRecipeState = { ...recipeState };

    updateContextWithSearchCriteria( {}, data, false, newRecipeState );
    return newRecipeState;
};

export let getPropertiesforSelectedObjs = function( selectionData ) {
    let uids = [];
    if( selectionData.selected.length > 0 ) {
        _.forEach( selectionData.selected, function( selectedObj ) {
            uids.push( selectedObj.props.evm1SourceObject.dbValues[ 0 ] );
        } );
    }
    return dmSvc.getProperties( uids, [ 'is_modifiable' ] );
};

export default exports = {
    getAllClosureRules,
    generateShowResultTable,
    getManageRecipeInput,
    getManageRecipeResponse,
    updateRevisionRuleNB,
    unloadContent,
    initializeBuilderConfig,
    revisionRuleFromPCI,
    effectivityDateFromPCI,
    effectivityUnitFromPCI,
    variantRuleFromPCI,
    populateConfiguration,
    disableCommandsVisibility,
    validateInScopeNavigation,
    addViewDataInDataSource,
    getClosureRulesSoa,
    updateTheFocussedComponent,
    handleSelectionChangeForMutuallyExclusion,
    updateRecipeSearchCriteria,
    getPropertiesforSelectedObjs
};
