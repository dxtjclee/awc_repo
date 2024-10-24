// Copyright (c) 2022 Siemens

/**
 * Service to provide utility methods to support showing Recipe panel
 *
 * @module js/Evm1ShowRecipeService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

var exports = {};

/**
 * Filters the recipe objects based on the property value match
 *
 * @param {Array} viewModelObjs - list of view model objects of recipe objects
 * @param {String} filter - filter text
 * @return {Array} filtered list of view model objects
 */
var _checkFilter = function( viewModelObjs, filter ) {
    let rData = [];
    let filterText;
    if( !_.isEmpty( filter ) ) {
        filterText = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );
    }

    _.forEach( viewModelObjs, function( viewModelObj ) {
        if( filterText ) {
            let modelObj = cdm.getObject( viewModelObj.uid );
            // We have a filter, don't add nodes unless the filter matches a cell property
            let cellProps = modelObj.props.awp0CellProperties.dbValues;
            _.forEach( cellProps, function( property ) {
                let tmpProperty = property.toLocaleLowerCase().replace( /\\|\s/g, '' );
                if( tmpProperty.indexOf( filterText ) > -1 ) {
                    // Filter matches a property, add node to output elementList and go to next node
                    rData.push( viewModelObj );
                    return false;
                }
            } );
        } else {
            // No filter, just add the node to output elementList
            rData.push( viewModelObj );
        }
    } );
    return rData;
};

/**
 * Filter and return list of recipe data
 *
 * @param {Object} recipeDataList - The recipe Data List
 * @param {Object} filterString - filter String entered by user
 * @return {Object} recipeDataFilterList - recipe Data Filter List
 */
export let actionFilterList = function( recipeDataList, filterString ) {
    // maintaining list of original data
    let recipeDataFilterList = [];
    if( recipeDataList && recipeDataList.length > 0 ) {
        //update the list based on filter criteria
        recipeDataFilterList = _checkFilter( recipeDataList, filterString );
    }
    return recipeDataFilterList;
};

/**
 * Execute Selected Recipe
 *
 */
export let processExecuteRecipe = function( occmgmtCtx ) {
    // perform read before execute
    // get selection and productContext from ACE

    let selectedObjs = [];
    let productContext;

    // check if ace product context exists
    if ( occmgmtCtx && occmgmtCtx.productContextInfo ) {
        productContext = occmgmtCtx.productContextInfo;
    }

    // Check if seed selections are present i.e. BOM elements are selected in ACE.
    if ( occmgmtCtx && occmgmtCtx.selectedModelObjects && occmgmtCtx.selectedModelObjects.length > 0 ) {
        selectedObjs = occmgmtCtx.selectedModelObjects;
    }

    // Maintain a flag userAction = 'execute' in recipe context
    let recipeCtx = appCtxSvc.getCtx( 'recipeCtx' );
    if ( recipeCtx ) {
        recipeCtx.userAction = 'execute';
        recipeCtx.executeRecipeInput = {
            productContext: productContext,
            selectedObjs: selectedObjs
        };
        appCtxSvc.updateCtx( 'recipeCtx', recipeCtx );
    } else {
        let executeRecipeInput = {
            productContext: productContext,
            selectedObjs: selectedObjs
        };

        recipeCtx = {
            userAction: 'execute',
            executeRecipeInput: executeRecipeInput
        };

        appCtxSvc.registerCtx( 'recipeCtx', recipeCtx );
    }
};

/**
 * Excecuting recipe to show in Relationship Browser
 * @param {Object} selectedObject - selected recipe Object
 * @param {Object} graphActionState - state of RB graph
 * @param {Object} graphSelections - selection from of RB graph
 *
 */
export let executeShowRecipe = function( selectedObject, graphActionState, graphSelections ) {
    if( !_.isEmpty( selectedObject ) ) {
        let customFact = [];
        let recipeId = selectedObject.uid;
        _.forEach( graphSelections, function( node ) {
            let rootId = node.model.nodeObject.uid;
            let fact = 'object=' + rootId + ',source=Recipe,recipe=' + recipeId;
            customFact.push( fact );
        } );
        let graphActionStateValue = {
            expandGraph: {
                customFact: customFact,
                expandDirection: 'all'
            }
        };
        graphActionState.update( graphActionStateValue );
    }
};

export default exports = {
    actionFilterList,
    processExecuteRecipe,
    executeShowRecipe
};
