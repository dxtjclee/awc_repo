//@<COPYRIGHT>@
//==================================================
//Copyright 2019.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/*global
 */

/**
 *
 *
 * @module js/Evm1ConfigurationPanelService
 */
import uwPropertyService from 'js/uwPropertyService';
import dateTimeService from 'js/dateTimeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';

let exports = {};

/**
 * This method is used to initialize the Revision Rule for the Configuration Panel and set it on data(in Non-BOM case)
 * @param {Object} recipeConfigState recipe Config state
 * @returns {Object} current revision rule
 */
export let getInitialRevisionRuleConfigData = function( recipeConfigState ) {
    let currentRevisionRule;
    if( recipeConfigState && recipeConfigState.recipeState ) {
        let recipeState = recipeConfigState.recipeState;

        if( recipeState.builderConfigValues && recipeState.builderConfigValues.revisionRule ) {
            currentRevisionRule = recipeState.builderConfigValues.revisionRule;
        }
    }
    return currentRevisionRule;
};

let convertRevisionRuleIntoVMProperty = function( currentRevisionRule ) {
    let revRuleVMProperty = uwPropertyService.createViewModelProperty( currentRevisionRule.uiValue,
        currentRevisionRule.uiValue, 'STRING', currentRevisionRule.uiValue, '' );
    revRuleVMProperty.uiValue = currentRevisionRule.uiValue;
    revRuleVMProperty.classData = currentRevisionRule;
    return revRuleVMProperty;
};


/**
 * This method is used to select the changed Revision Rule for the Configuration Panel and set it on data
 * @param {Object} data The viewModel data for revision rule view
 * @param {Object} recipeConfigState recipe Config state
 * @returns {Object} selected revision rule
 */
export let selectChangedRevisionRule = function( data, recipeConfigState ) {
    let currentRevisionRuleData = _.clone( data.currentRevisionRule );
    // Update Revision Rule For Non-Bom Use Case.
    let eventData = data.eventMap[ 'awlinkPopup.selected' ];
    if( eventData ) {
        let updatedRevRule = eventData.property.dbValue.propDisplayValue;

        if( recipeConfigState && recipeConfigState.recipeState ) {
            let newRecipeConfigState = { ...recipeConfigState };
            newRecipeConfigState.recipeState.revisionRuleNB = updatedRevRule;

            recipeConfigState.update && recipeConfigState.update( newRecipeConfigState );
        }
    }
    return currentRevisionRuleData;
};


/**
 * This method is used to select the changed date effectivity for the Configuration Panel and set it on data
 * @param {Object} data The viewModel data for date effectivity view
 * @param {Object} eventData The event data from the event
 * @param {Object} recipeConfigState recipe Config state
 * @returns {Object} selected effectivity
 */
export let selectChangedEffectivityDate = function( data, recipeConfigState, eventData, occContext ) {
    // The effectivity date which is given by event data is actually the current time.
    // The directive by ACE which is used returns this. In order to get the selected date, the directive sets that
    //  on the currentEffectiveData' db value of data. Hence the UI value and DB value of currentEffectiveDate does not reflect
    // the correct synced information.
    let newRecipeConfigState = { ...recipeConfigState };
    let selectedEffecDate = _.get( eventData, 'currentEffectiveDate.dbValue', undefined );
    if( !selectedEffecDate || selectedEffecDate === null ) {
        selectedEffecDate = data.i18n.occurrenceManagementTodayTitle;
    }
    if( newRecipeConfigState ) {
        newRecipeConfigState.selectedEffecDate = selectedEffecDate;
        occContext.productContextInfo.props.awb0EffDate.dbValues[ 0 ] = eventData.currentEffectiveDate.dbValue;
        occContext.productContextInfo.props.awb0EffDate.uiValues[ 0 ] = eventData.currentEffectiveDate.uiValue;
    }
    return {
        recipeConfigState: newRecipeConfigState, occContext: occContext
    };
};


/**
 * This method is used to select the changed unit Effectivity
 * @param {Object} eventData The event data from the event
 * @param {Object} recipeConfigState recipe Config state
 */

export let selectChangedUnitEffectivity = function( eventData, recipeConfigState, occContext, data ) {
    let newRecipeConfigState = { ...recipeConfigState };
    if( eventData && eventData.effectiveUnit && newRecipeConfigState ) {
        let selectedEffecUnit = eventData.effectiveUnit;
        newRecipeConfigState.currentEffecUnit = selectedEffecUnit;
        occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ] = selectedEffecUnit;

        if( selectedEffecUnit === -1 ) {
            occContext.productContextInfo.props.awb0EffUnitNo.uiValues[ 0 ] = data.i18n.effectivityUnitSectionAllUnitsValue;
        } else {
            occContext.productContextInfo.props.awb0EffUnitNo.uiValues[ 0 ] = selectedEffecUnit;
        }
    }
    return {
        recipeConfigState: newRecipeConfigState, occContext: occContext
    };
};

/**
 * This method is used to select the changed End Item
 * @param {Object} eventData The event data from the event
 * @param {Object} recipeConfigState recipe Config state
 */

export let selectChangedEndItem = function( eventData, recipeConfigState, occContext ) {
    let newRecipeConfigState = { ...recipeConfigState };
    if( eventData && eventData.endItem && newRecipeConfigState ) {
        let selectedEndItem = _.get( eventData, 'endItem.uid', undefined );
        newRecipeConfigState.currentEndItemUid = selectedEndItem;
        let adaptedObjectForEndItem = cdm.getObject( eventData.endItem.uid );
        occContext.productContextInfo.props.awb0EffEndItem.dbValues[ 0 ] = selectedEndItem;
        occContext.productContextInfo.props.awb0EffEndItem.uiValues[ 0 ] = adaptedObjectForEndItem.props.object_string.uiValues[ 0 ];
    }
    return { recipeConfigState: newRecipeConfigState, occContext: occContext };
};


/**
 * This method is used to select the changed variant Rule and SVR Owning Item
 * @param {Object} eventData the event data from the event
 * @param {Object} recipeConfigState recipe config state
 */

export let selectChangedVariantInfoOrSvrOwningItem = function( eventData, recipeConfigState, occContext ) {
    let newRecipeConfigState = { ...recipeConfigState };
    if( newRecipeConfigState ) {
        if( eventData && eventData.selectedObject ) {
            if( ( !newRecipeConfigState.currentVariantRuleUid || newRecipeConfigState.currentVariantRuleUid === '' ) && occContext.productContextInfo.props.awb0VariantRules.dbValues[ 0 ] !== eventData
                .selectedObject
                .props.object_string.dbValue ) {
                occContext.productContextInfo.props.awb0VariantRules.dbValues[ 0 ] = eventData.selectedObject.props.object_string.dbValue;
                occContext.productContextInfo.props.awb0VariantRules.uiValues[ 0 ] = eventData.selectedObject.props.object_string.uiValue;
                if( occContext.productContextInfo.props.awb0VariantRules.uiValues[ 0 ] === '' ) {
                    occContext.productContextInfo.props.awb0VariantRules.uiValues[ 0 ] = eventData.selectedObject.props.object_string.value;
                }
                newRecipeConfigState.currentVariantRuleUid = eventData.selectedObject.uid;
            }
        }
        if( eventData && eventData.svrOwningItem && occContext.productContextInfo.props.awb0VariantRuleOwningRev.dbValues[ 0 ] !== eventData.svrOwningItem.uid ) {
            let selectedSvrOwningItem = _.get( eventData, 'svrOwningItem.uid', undefined );
            let adaptedObjectForSvrOwningItem = cdm.getObject( selectedSvrOwningItem );
            if( newRecipeConfigState ) {
                newRecipeConfigState.currentSVROwningItemUid = selectedSvrOwningItem;
                occContext.productContextInfo.props.awb0VariantRuleOwningRev.dbValues[ 0 ] = selectedSvrOwningItem;
                occContext.productContextInfo.props.awb0VariantRuleOwningRev.uiValues[ 0 ] = adaptedObjectForSvrOwningItem.props.object_string.uiValues[ 0 ];
            }
        }
    }
    return {
        recipeConfigState: newRecipeConfigState, occContext: occContext
    };
};

/**
 * This method is used to add the configuration values from Configuration Panel to teh Builder config values of Recipe
 * @param {Object} recipeConfigState recipe Config state
 */

export let addConfigOnRecipeBuilder = function( recipeConfigState, data ) {
    if( recipeConfigState && recipeConfigState.recipeState ) {
        if( recipeConfigState.currentRevisionRule || recipeConfigState.selectedEffecDate ||
            recipeConfigState.currentEffecUnit || recipeConfigState.currentVariantRuleUid || recipeConfigState.currentEndItemUid || recipeConfigState.currentSVROwningItemUid ) {
            let isRevisionRuleUnChanged = true;
            let isEffecUnitUnChanged = true;
            let isEffecDateUnChanged = true;
            let isVariantRuleUnChanged = true;
            let isSvrOwningItemUnChanged = true;
            let isEndItemUnChanged = true;
            let effecDate = '';

            if( recipeConfigState.currentSVROwningItemUid ) {
                isSvrOwningItemUnChanged = Boolean( recipeConfigState.recipeState.builderConfigValues.svrOwningItem.dbValues[ 0 ] === recipeConfigState.currentSVROwningItemUid );
            }

            if( recipeConfigState.currentEndItemUid ) {
                isEndItemUnChanged = Boolean( recipeConfigState.recipeState.builderConfigValues.endItems[ 0 ].dbValues[ 0 ] === recipeConfigState.currentEndItemUid );
            }

            if( recipeConfigState.currentRevisionRule ) {
                isRevisionRuleUnChanged = Boolean( recipeConfigState.recipeState.builderConfigValues.revisionRule.uiValue === recipeConfigState.currentRevisionRule.uiValue );
            }

            if( recipeConfigState.currentEffecUnit ) {
                isEffecUnitUnChanged = Boolean( recipeConfigState.recipeState.builderConfigValues.effecUnits.uiValue === recipeConfigState.currentEffecUnit );
            }

            if( recipeConfigState.selectedEffecDate ) {
                effecDate = dateTimeService.formatDate( recipeConfigState.selectedEffecDate );
                isEffecDateUnChanged = Boolean( recipeConfigState.recipeState.builderConfigValues.effecDate.uiValue === effecDate );
            }

            if( recipeConfigState.currentVariantRuleUid ) {
                // Though Variant Rules can potentially be list of array, and there is provision for the same, but currently ace does not support
                // multiple selections and hence we are just checking the below condition as comparision of string value. When array are implemented
                // then we would need to check the elements in array
                isVariantRuleUnChanged = Boolean( recipeConfigState.recipeState.builderConfigValues.variantRules.uiValue === recipeConfigState.currentVariantRuleUid );
            }
            if( !isRevisionRuleUnChanged || !isEffecUnitUnChanged || !isEffecDateUnChanged || !isVariantRuleUnChanged || !isSvrOwningItemUnChanged || !isEndItemUnChanged ) {
                let eventData = {
                    manageAction: 'ApplyConfig'
                };

                eventData.variantRules = getVariantRulesForInput( recipeConfigState, recipeConfigState.recipeState );
                eventData.revisionRule = getRevisionRuleForInput( recipeConfigState, recipeConfigState.recipeState );
                eventData.effectivityDate = getEffecDateForInput( recipeConfigState, recipeConfigState.recipeState, data );
                eventData.effectivityUnit = getEffectivityUnitForInput( recipeConfigState, recipeConfigState.recipeState, data );
                eventData.svrOwningItem = setSvrOwningItemForInput( recipeConfigState, recipeConfigState.recipeState );
                eventData.effectivityEndItem = setEndItemForInput( recipeConfigState, recipeConfigState.recipeState );

                { var seedSelections = []; }
                if( recipeConfigState.recipeState.seedSelections && recipeConfigState.recipeState.seedSelections.length ) {
                    if( recipeConfigState.recipeState.seedSelections && recipeConfigState.recipeState.seedSelections.length > 0 ) {
                        let seeds = recipeConfigState.recipeState.seedSelections;
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
                }
                eventData.seedObjects = seedSelections;
                eventBus.publish( 'evm1ConfigurationChanged', eventData );
            }
        } else if( recipeConfigState.recipeState && recipeConfigState.recipeState.revisionRuleNB ) {
            getRevisionRuleForInputNonBOM( recipeConfigState.recipeState );
        }
    } else {
        getRevisionRuleForInputNonBOM( recipeConfigState.recipeState );
    }
};

let getRevisionRuleForInput = function( recipeConfigState, recipeState ) {
    // If revision rule is changed then take the latest form the recipeConfigState
    // Else take the original value from recipeState
    if( recipeConfigState.currentRevisionRule && recipeConfigState.currentRevisionRule.uiValue ) {
        return recipeConfigState.currentRevisionRule.uiValue;
    } else if( recipeState.builderConfigValues && recipeState.builderConfigValues.revisionRule ) {
        return recipeState.builderConfigValues.revisionRule.uiValue;
    }
};

let getEffecDateForInput = function( recipeConfigState, recipeState, data ) {
    // If effec date is blank i.e. its value is not changed then we will use the original value from recipeState
    // If the effec date is Today then we don't need to set it.
    let effecDate;
    if( recipeConfigState.selectedEffecDate ) {
        effecDate = recipeConfigState.selectedEffecDate;
        if( effecDate === data.i18n.occurrenceManagementTodayTitle ) {
            return '';
        }
        // We are already receiving the effec date in proper format so no need to convert
        // As converting date will give incorrect timings and leads to localization issues
        return effecDate;
    }
    effecDate = recipeState.builderConfigValues.effecDate.uiValue;
    if( effecDate === data.i18n.occurrenceManagementTodayTitle ) {
        return '';
    }
    return recipeState.builderConfigValues.effecDate.dbValue;
};

let getEffectivityUnitForInput = function( recipeConfigState, recipeState, data ) {
    let units = -1;
    if( recipeConfigState.currentEffecUnit ) {
        units = recipeConfigState.currentEffecUnit;
        if( units === -1 ) {
            return -1;
        }
    } else if( recipeState.builderConfigValues && recipeState.builderConfigValues.effecUnits ) {
        units = recipeState.builderConfigValues.effecUnits.uiValue;
        if( units === data.i18n.effectivityUnitSectionAllUnitsValue ) {
            return -1;
        }
        units = parseInt( units );
    }
    return units;
};

let getVariantRulesForInput = function( recipeConfigState, recipeState ) {
    let variantRules = [];
    if( recipeConfigState.currentVariantRuleUid ) {
        let uid = recipeConfigState.currentVariantRuleUid;
        if( uid === '_defaultVariantRule' || recipeConfigState.currentVariantRuleUid === 'No Variant Rule' ) {
            uid = '';
        }
        variantRules.push( {
            uid: uid,
            type: ''
        } );
    } else if( recipeState.builderConfigValues.variantRules.dbValue ) {
        variantRules.push( {
            uid: recipeState.builderConfigValues.variantRules.dbValue,
            type: ''
        } );
    }
    return variantRules;
};

let setEndItemForInput = function( recipeConfigState, recipeState ) {
    let endItem;
    if( recipeConfigState.currentEndItemUid ) {
        endItem = recipeConfigState.currentEndItemUid;
    } else if( recipeState.builderConfigValues && recipeState.builderConfigValues.endItems ) {
        endItem = recipeState.builderConfigValues.endItems[ 0 ].dbValues[0];
    }
    return endItem;
};

let setSvrOwningItemForInput = function( recipeConfigState, recipeState ) {
    let svrOwningItem;
    if( recipeConfigState.currentSVROwningItemUid ) {
        svrOwningItem = recipeConfigState.currentSVROwningItemUid;
    } else if( recipeState.builderConfigValues && recipeState.builderConfigValues.svrOwningItem ) {
        svrOwningItem = recipeState.builderConfigValues.svrOwningItem.dbValues[ 0 ];
    }
    return svrOwningItem;
};

let getRevisionRuleForInputNonBOM = function( recipeState ) {
    let revisionRule;
    if( recipeState && recipeState.revisionRuleNB ) {
        revisionRule = recipeState.revisionRuleNB;
    } else if( recipeState && recipeState.builderConfigValues && recipeState.builderConfigValues.revisionRule ) {
        revisionRule = recipeState.builderConfigValues.revisionRule.uiValue;
    }
    let eventData1 = {
        revisionRule: revisionRule
    };

    eventBus.publish( 'evm1RevRuleChanged', eventData1 );
};


export let initializeRecipeState = function( recipeState, recipeConfigState ) {
    recipeConfigState.recipeState = recipeState;
    let occContext = { configContext: {} };
    let panelId = populateOccContextInfo( recipeState, occContext );
    return { recipeConfigState: recipeConfigState, occContext: occContext, panelId: panelId };
};

let populateOccContextInfo = function( recipeState, occContext ) {
    let panelId = 'ConfigurationPanelFilters';
    if( recipeState.productContextInfo ) {
        // If we have productContextInfo in the recipeState it means its a BOM recipe.
        // For BOM recipe we need to create Context Key object which will be used by ACE to add new Rev Rule.
        occContext.productContextInfo = { ...recipeState.productContextInfo };
        occContext.productContextInfo.props.awb0UseGlobalRevisionRule = {
            dbValues: [ '0' ]
        };

        // for adding readOnlyFeatures property as ACE team have check on that
        occContext.readOnlyFeatures = { Awb0DateEffectivityConfigFeature: false };
        occContext.supportedFeatures = { Awb0EnableUseDefaultRevisionRuleFeature: false };
        occContext.readOnlyFeatures.Awb0RevisionRuleFeature = false;
        occContext.readOnlyFeatures.Awb0VariantFeature = false;
        occContext.supportedFeatures.Awb0UnitEffectivityConfigFeature = true;
        occContext.supportedFeatures.Awb0DateEffectivityConfigFeature = true;
        occContext.supportedFeatures.Awb0VariantFeature = true;
        occContext.supportedFeatures.Awb0HideSVROwningItem = false;
        occContext.supportedFeatures.Awb0SupportsClassicVariantsRule = true;
        occContext.supportedFeatures.Awb0GroupEffectivityFeature = false;
        occContext.supportedFeatures.Awb0UnifiedFindInStructure = true;
    } else {
        panelId = 'Evm1ConfigPanelFilters';
        occContext.supportedFeatures = {
            Awb0EnableUseGlobalRevisionRuleFeature: true,
            Awb0GroupEffectivityFeature: false
        };
    }
    return panelId;
};

export let revisionRuleChanged = function( recipeConfigState, eventData, occContext ) {
    let newRecipeConfigState = { ...recipeConfigState };
    let selectedRevRule = _.get( eventData, 'selectedObject.props.object_name', undefined );
    let selectedRevRuleUid = _.get( eventData, 'selectedObject.uid', undefined );
    let adaptedObjectForRevisionRule = cdm.getObject( selectedRevRuleUid );
    if( selectedRevRule ) {
        let currentRevisionRuleData = convertRevisionRuleIntoVMProperty( selectedRevRule );
        if( recipeConfigState ) {
            newRecipeConfigState.currentRevisionRule = currentRevisionRuleData;
            occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ] = selectedRevRuleUid;
            occContext.productContextInfo.props.awb0CurrentRevRule.uiValues[ 0 ] = adaptedObjectForRevisionRule.props.object_name.uiValues[ 0 ];
        }
    }
    return {
        recipeConfigState: newRecipeConfigState
    };
};

export default {
    getInitialRevisionRuleConfigData,
    selectChangedRevisionRule,
    selectChangedEffectivityDate,
    selectChangedUnitEffectivity,
    selectChangedEndItem,
    selectChangedVariantInfoOrSvrOwningItem,
    addConfigOnRecipeBuilder,
    initializeRecipeState,
    revisionRuleChanged
};
