//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
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
 * @module js/Evm1CreateRecipeFromSelection
 */
import Evm1RecipeBuilderService from 'js/Evm1RecipeBuilderService';
import addObjectUtils from 'js/addObjectUtils';

let exports = {};

/**
 * This method is used create the input for calling the ManageRecipe SOA for create manage action
 * This is specifically for creating a recipe from BOM selection/s
 * @param {object} data The view-model data
 * @param {object} occContext The occmgmtContext
 * @param {object} editHandler The editHandler
 * @returns {Object} input The input used as input for SOA
 */
export let ManageRecipesInput = function( data, occContext, editHandler ) {
    let input = [];
    // Check if recipe object has description and set it
    let createInput = addObjectUtils.getCreateInput( data, null, null, editHandler );
    // EVM1 TOBE - Also we have to send the product context from ace
    let inputData = {
        clientId: 'Create',
        manageAction: 'Create',
        recipeCreInput: createInput[ 0 ].createData,
        recipeObject: undefined
    };

    // Check if seed selections are present i.e. BOM elements are selected in ACE.
    if( occContext && occContext.selectedModelObjects && occContext.selectedModelObjects.length > 0 ) {
        let modelObjects = occContext.selectedModelObjects;
        let selectContentInputs = [];

        for( let i = 0; i < modelObjects.length; i++ ) {
            let modelObj = modelObjects[ i ];

            if( modelObj.uid && modelObj.type ) {
                let selectedObj = {
                    uid: modelObj.uid,
                    type: modelObj.type
                };

                selectContentInputs.push( selectedObj );
            }
        }

        // Set the Revision Rule from ACE PC
        let revRuleFromAce = Evm1RecipeBuilderService.revisionRuleFromPCI( {}, occContext.productContextInfo );
        let effecDateFromAce = Evm1RecipeBuilderService.effectivityDateFromPCI( data, occContext.productContextInfo );
        let units = Evm1RecipeBuilderService.effectivityUnitFromPCI( data, occContext.productContextInfo );
        let variantRulesFromAce = Evm1RecipeBuilderService.variantRuleFromPCI( data, occContext.productContextInfo );
        let variantRulesObjList = [];
        let effecUnitsFromAce = parseInt( units );

        if( !revRuleFromAce ) {
            revRuleFromAce = '';
        }

        if( !effecDateFromAce ) {
            effecDateFromAce = '';
        }

        if( isNaN( effecUnitsFromAce ) ) {
            effecUnitsFromAce = -1;
        }

        let endItemFromAce = {
            uid: '',
            type: ''
        };

        if( occContext.productContextInfo.props.awb0EffEndItem && occContext.productContextInfo.props.awb0EffEndItem.dbValues &&
            occContext.productContextInfo.props.awb0EffEndItem.dbValues.length > 0 ) {
            let uid = occContext.productContextInfo.props.awb0EffEndItem.dbValues[ 0 ];

            if( uid !== null ) {
                endItemFromAce.uid = uid;
            }
        } else if( occContext.productContextInfo.props.awb0Product && occContext.productContextInfo.props.awb0Product.dbValues &&
            occContext.productContextInfo.props.awb0Product.dbValues.length > 0 ) {
            let uid = occContext.productContextInfo.props.awb0Product.dbValues[ 0 ];

            if( uid !== null ) {
                endItemFromAce.uid = uid;
            }
        }

        if( variantRulesFromAce && variantRulesFromAce.length > 0 ) {
            for( let i = 0; i < variantRulesFromAce.length; i++ ) {
                let variantRule = variantRulesFromAce[ i ];

                if( variantRule && variantRule.uid ) {
                    let uid = variantRule.uid;

                    if( uid !== '' ) {
                        variantRulesObjList.push( {
                            uid: uid,
                            type: ''
                        } );
                    }
                }
            }
        }

        inputData.criteriaInput = {
            selectContentInputs: selectContentInputs,
            configSet: {
                revisionRule: revRuleFromAce,
                variantRules: variantRulesObjList,
                effectivityUnit: effecUnitsFromAce,
                effectivityEndItem: endItemFromAce,
                effectivityDate: effecDateFromAce,
                effectivityGroups: []
            },
            criteriaSet: {
                closureRuleNames: [],
                lwoQueryExpression: ''
            },
            productContext :{ uid: occContext.productContextInfo.uid },
            isConfigChanged: false
        };
    }

    input.push( inputData );
    return input;
};

export default exports = {
    ManageRecipesInput
};
