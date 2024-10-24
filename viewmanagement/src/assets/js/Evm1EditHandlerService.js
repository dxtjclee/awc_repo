//@<COPYRIGHT>@
//==================================================
//Copyright 2019.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/*global
 define
 */

/**
 *
 *
 * @module js/Evm1EditHandlerService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import selectionService from 'js/selection.service';
import _ from 'lodash';
import eventBus from 'js/eventBus';

let exports = {};

let saveHandler = {};

/**
 * Get save handler.
 *
 * @return {object} Save Handler
 */
export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * Custom save handler which will be called by framework. It will save both the recipe summary contents and
 * recipe builder contents
 *
 * @param {object} dataSource the data-source which the declarative view-model
 * @return {promise} resolved or rejected based on the save operations
 */
saveHandler.saveEdits = function( dataSource ) {
    let _deferredSave = AwPromiseService.instance.defer();
    let defRecipePromise = null;
    let vmData = dataSource.getDeclViewModel().customPanelInfo;
    let recipeState = vmData.Evm1RecipeBuilder.recipeState;

    // perform save operation only if recipe builder is edited
    defRecipePromise = saveRecipeEdits( vmData.Evm1RecipeBuilder, recipeState );
    // process the promises for save operation for any errors and handle post processing
    defRecipePromise.then( function( response ) {
            if( response ) {
                let _error = null;

                if( response.partialErrors || response.PartialErrors ) {
                    _error = soaSvc.createError( response );
                } else if( response.ServiceData && response.ServiceData.partialErrors ) {
                    _error = soaSvc.createError( response.ServiceData );
                }
                if( _error ) {
                    _deferredSave.reject( _error );
                } else {
                    _deferredSave.resolve();
                }
            }
        },
        function( err ) {
            _deferredSave.reject( err );
        } );
    return _deferredSave.promise;
};

/**
 * Perform save operation for recipe builder.
 *
 * @return {promise} resolved or rejected based on the save operation
 */
let saveRecipeEdits = function( data, recipeState ) {
    let seedSelections = [];

    seedSelections = createSeedSelection( recipeState );

    // prepare input for the SOA call
    let eventDataToBePublished = {
        manageAction: 'Update',
        seedObjects: seedSelections,
        closureRule: data.closureRuleValues.displayValues
    };

    if( recipeState.builderConfigValues ) {
        // Set Revision Rule
        let revisionRule = '';

        if( recipeState.builderConfigValues.revisionRule ) {
            revisionRule = recipeState.builderConfigValues.revisionRule.uiValue;
        }
        eventDataToBePublished.revisionRule = revisionRule;

        // Set variant Rules
        let variantRules = [];

        if( recipeState.builderConfigValues.variantRules && recipeState.builderConfigValues.variantRules.dbValue ) {
            // EVM1 TOBE - once the variant rule is available on the VM, check what comes in the value and apply it
            let uid = recipeState.builderConfigValues.variantRules.dbValue;

            if( uid !== '' && uid !== '_defaultVariantRule' ) {
                variantRules.push( {
                    uid: uid,
                    type: ''
                } );
            }
        }
        eventDataToBePublished.variantRules = variantRules;

        // Set Effectivity Date
        let effectivityDate = '';

        if( recipeState.builderConfigValues.effecDate && recipeState.builderConfigValues.effecDate.uiValue &&
            recipeState.builderConfigValues.effecDate.value ) {
            let effecDate = recipeState.builderConfigValues.effecDate;

            if( effecDate.uiValue === 'Today' || effecDate.uiValue === 'today' ) {
                effectivityDate = '0001-01-01T00:00:00+00:00';
            } else {
                effectivityDate = effecDate.value;
            }
        }
        eventDataToBePublished.effectivityDate = effectivityDate;

        // Set Effectivity Unit
        let effectivityUnit = -1;

        if( recipeState.builderConfigValues.effecUnits && recipeState.builderConfigValues.effecUnits.uiValue ) {
            effectivityUnit = parseInt( recipeState.builderConfigValues.effecUnits.uiValue );
            if( isNaN( effectivityUnit ) ) {
                effectivityUnit = -1;
            }
        }
        eventDataToBePublished.effectivityUnit = effectivityUnit;

        // Set Effectivity End Item
        let endItem = {
            uid: '',
            type: ''
        };

        if( recipeState.builderConfigValues.endItems && recipeState.builderConfigValues.endItems.length > 0 ) {
            if( recipeState.builderConfigValues.endItems[ 0 ].dbValues && recipeState.builderConfigValues.endItems[ 0 ].dbValues[ 0 ] ) {
                endItem.uid = recipeState.builderConfigValues.endItems[ 0 ].dbValues[ 0 ];
            } else if( recipeState.builderConfigValues.endItems[ 0 ].uid ) {
                endItem.uid = recipeState.builderConfigValues.endItems[ 0 ].uid;
            }
            endItem.type = '';
        }
        eventDataToBePublished.effectivityEndItem = endItem;

        // Set Effectivity Group
        let effecGroup = [];

        eventDataToBePublished.effectivityGroups = effecGroup;
        eventDataToBePublished.productContextInfo = recipeState.productContextInfo;
        eventDataToBePublished.showConfig = true;
        if( recipeState.context ) {
            eventDataToBePublished.showConfig = false;
        }
    }
    eventBus.publish( 'emv1ManageRecipeSOA', eventDataToBePublished );
    return AwPromiseService.instance.when( eventDataToBePublished );
};

let createSeedSelection = function( recipeState ) {
    let seedSelections = [];

    if( recipeState.seedSelections && recipeState.seedSelections.length > 0 ) {
        let seeds = recipeState.seedSelections;

        for( let i = 0; i < seeds.length; i++ ) {
            let seedObj = seeds[ i ];

            if( seedObj.uid && seedObj.type ) {
                seedSelections.push( {
                    uid: seedObj.uid,
                    type: seedObj.type
                } );
            }
        }
    }
    return seedSelections;
};

/**
 * Custom isDirty. Checks if the Recipe contents is dirty
 *
 * @param {object} dataSource the data-source which the declarative view-model
 * @return {promise} promise indicating if the recipe is dirty
 */
saveHandler.isDirty = function( dataSource ) {
    let recipeEdited = false;
    let summaryEdited = false;
    let vmData = dataSource.getDeclViewModel().customPanelInfo;
    if( !vmData ) {
        return false;
    }
    let recipeState = vmData.Evm1RecipeBuilder.recipeState;

    if( recipeState.recipeEditCache && recipeState.recipeEditCache.cacheData ) {
        let cacheData = recipeState.recipeEditCache.cacheData;

        // Check if closure rule is dirty, LwqEditor is edited, seed widget and cached seed values are different
        if( recipeState.seedsIsDirty ) {
            recipeEdited = true;
            recipeState.seedsIsDirty = false;
        }

        if( cacheData.closureRule && !vmData.Evm1RecipeBuilder.closureRuleValues ||
            !cacheData.closureRule && vmData.Evm1RecipeBuilder.closureRuleValues ) {
            recipeEdited = true;
        } else if( cacheData.closureRule && vmData.Evm1RecipeBuilder.closureRuleValues ) {
            if( cacheData.closureRule.displayValues.length === vmData.Evm1RecipeBuilder.closureRuleValues.displayValues.length ) {
                _.forEach( cacheData.closureRule.displayValues, function( closureRule ) {
                    if( _.findIndex( vmData.Evm1RecipeBuilder.closureRuleValues.displayValues, function( o ) { return o === closureRule; } ) === -1 ) {
                        recipeEdited = true;
                        return true;
                    }
                } );
            } else {
                recipeEdited = true;
            }
        } else {
            recipeEdited = true;
        }

        if( recipeState.builderConfigValues.revisionRule && recipeState.builderConfigValues.revisionRule.valueUpdated ||
            recipeState.builderConfigValues.effecDate && recipeState.builderConfigValues.effecDate.valueUpdated ||
            recipeState.builderConfigValues.effecUnits && recipeState.builderConfigValues.effecUnits.valueUpdated ||
            recipeState.builderConfigValues.variantRules && recipeState.builderConfigValues.variantRules.valueUpdated ) {
            recipeEdited = true;
        }

        if( cacheData.seedObjects && !recipeState.seedSelections ||
            !cacheData.seedObjects && recipeState.seedSelections ) {
            recipeEdited = true;
        } else if( cacheData.seedObjects && recipeState.seedSelections ) {
            if( cacheData.seedObjects.length === recipeState.seedSelections.length ) {
                _.forEach( cacheData.seedObjects, function( seedSelection ) {
                    if( _.findIndex( recipeState.seedSelections, function( o ) { return o.uid === seedSelection.uid; } ) === -1 ) {
                        recipeEdited = true;
                        return true;
                    }
                } );
            } else {
                recipeEdited = true;
            }
        }
    }

    // check if summary is edited
    if( dataSource.getAllModifiedProperties() && dataSource.getAllModifiedProperties().length > 0 ) {
        summaryEdited = true;
    }

    // Save the flags in ctx.
    //recipeEdited = true; // EVM1 TOBE - This is hard coded for now. Will have to check it as per requirements of config panel
    if( recipeEdited || summaryEdited ) {
        return AwPromiseService.instance.when( true );
    }
    return AwPromiseService.instance.when( false );
};

/**
 *  This method used to add additional implementation to edit group commands
 * On Start Edit command, all inputs of builder query are made editable
 * On Cancel Edits command, all inputs of builder query are made non-editable
 * On Save Edits command, all inputs of builder query are saved and then are made non-editable
 *
 * @param {Object} data The view-model data
 * @param {Object} eventData The event data received from even listener
 * @param {object} recipeState The recipeState object
 * @returns {Object} data The edited view-model data
 */
export let editRecipeBuilder = function( data, eventData, recipeState ) {
    const newRecipeState = { ...recipeState };

    if( data && eventData && eventData.state === 'starting' && eventData.dataSource ) {
        enableDisableEdits( data, newRecipeState, true );
    } else if( data && eventData && eventData.state === 'canceling' && eventData.dataSource ) {
        callSOAToReopenRecipe( data, newRecipeState );
    } else if( data && eventData && eventData.state === 'saved' && eventData.dataSource ) {
        enableDisableEdits( data, newRecipeState, false );
    }
    return { data, newRecipeState };
};

let callSOAToReopenRecipe = function( data, recipeState ) {
    recipeState.inEditMode = false;
    data.seedObjects = [];
    data.closureRuleValues.dbValue = [];
    data.closureRuleList = [];
    data.closureRuleValues.displayValues = [];
    data.closureRuleValues.newDisplayValues = [];
    data.closureRuleValues.newValue = [];
    clearViewModelProp( data.revisionRule );
    clearViewModelProp( data.effecDate );
    clearViewModelProp( data.effecUnits );
    clearViewModelProp( data.variantRule );
    data.closureRuleValues.isEditable = false;
    data.closureRuleValues.isEnabled = false;

    recipeState.recipeSearchCriteriaProvider = {};
    recipeState.recipeEditCache = {};

    let parentSelection = selectionService.getSelection().parent;

    if( !parentSelection ) {
        parentSelection = cdm.getObject( appCtxSvc.ctx.xrtSummaryContextObject.uid );
    }
    selectionService.updateSelection( parentSelection );
};

let clearViewModelProp = function( prop ) {
    prop.uiValue = '';
    prop.uiValues = [];
    prop.dbValue = '';
    prop.dbValues = [];
    prop.newValue = '';
    prop.newDisplayValues = [];
};

let enableDisableEdits = function( data, recipeState, isEditable ) {
    recipeState.inEditMode = isEditable;
    if( data ) {
        _.set( data, 'closureRuleValues.isEditable', isEditable );
        _.set( data, 'closureRuleValues.isEnabled', isEditable );
    }
};

export default exports = {
    getSaveHandler,
    editRecipeBuilder
};
