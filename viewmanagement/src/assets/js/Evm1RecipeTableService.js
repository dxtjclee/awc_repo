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
 * @module js/Evm1RecipeTableService
 */
import appCtxSvc from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import selectionService from 'js/selection.service';
import commandPanelService from 'js/commandPanel.service';
import vmcs from 'js/viewModelObjectService';
import columnArrangeService from 'js/columnArrangeService';

let exports = {};

/**
 * This method is used to set the showtable flag to display execute recipe table.
 * We need to maintain this flag because if the execute Recipe output is zero
 * then no table will be displayed.
 * @param {Object} currentDisplay the view model data
 * @returns {Boolean} true/false
 */
export let showTable = function( currentDisplay ) {
    if( currentDisplay === 'treeView' ) {
        eventBus.publish( 'view.executeRecipeTree', {} );
    } else {
        eventBus.publish( 'view.executeRecipe', {} );
    }
    return true;
};

/**
 * This method is used to hide the execute reciep table if the result is 0.
 * if the totalFound is 0 then will hide the table and messege will be displayed.
 * @param {Object} data the view model data
 */
export let evaluateShowTable = function( data, recipeState ) {
    let totalFound = _.get( data, 'totalFound', 0 );
    if( totalFound === 0 ) {
        data.showTable = false;
        eventBus.publish( 'view.hideRecipeResultTable', {} );
        // If there are any columnFilters then we should clear it.
        // Because user have no option to clear filter as we show "No result found" messege for 0 result.
        if( data.columnProviders.recipeSearchColumnDataProvider && data.columnProviders.recipeSearchColumnDataProvider.columnFilters ) {
            data.columnProviders.recipeSearchColumnDataProvider.columnFilters = undefined;
        }
    }
    const newRecipeState = { ...recipeState };
    // Recipe Execution is done so now Enable Show Result Button.
    newRecipeState.isRecipeExecuting = false;
    recipeState.update && recipeState.update( newRecipeState );
};

/**
 *   The copy command delegate for the user assignment objects in the surrogates table
 * @param {Object} objectToCopy Object to copy
 */
export let copyUnderlyingObject = function( objectToCopy ) {
    if( objectToCopy ) {
        let underlyingObjs = [];

        objectToCopy.forEach( function( obj ) {
            let underlyingobjectUid = _.get( obj, 'props.evm1UnderlyingObject.dbValues[0]', undefined );

            if( underlyingobjectUid ) {
                let underlyingobject = cdm.getObject( underlyingobjectUid );
                if( underlyingobject ) {
                    underlyingObjs.push( underlyingobject );
                }
            }
        } );

        // Copy userObjects to the clipboard
        ClipboardService.instance.setContents( underlyingObjs );
    }
};

/**
 * This method is used to get ViewModel data of Evm1RecipeResultsTableView
 */
export let evm1ExportToExcel = function( commandContext ) {
    let eventData = { commandContext };
    eventBus.publish( 'view.EventForExcelExport', eventData );
};

/**
 * This method is used to process the selected columns from recipe table.
 * @param {Object} data the view model data
 * @param {object} recipeState The recipeState object
 */
export let processExportToExcel = function( data, recipeState, { commandContext: { dialogAction } } ) {
    const newRecipeState = { ...recipeState };
    if( recipeState.recipeSearchCriteriaProvider ) {
        // LCS-350795 - For Export to Excel the view type needs to be tableView always.
        newRecipeState.recipeSearchCriteriaProvider.viewType = 'tableView';
        recipeState.update && recipeState.update( newRecipeState );
    }
    let context = {
        providerName: 'Evm1ShowRecipeRsltsProvider',
        dataProvider: data.dataProviders.recipeSearchDataProvider,
        columnProvider: data.columnProviders.recipeSearchColumnDataProvider,
        searchCriteria: recipeState.recipeSearchCriteriaProvider,
        displayTitle: data.i18n.ExportToExcel,
        vmo: appCtxSvc.ctx.xrtSummaryContextObject
    };
    let options = {
        view: 'Awp0ExportToExcel',
        parent: '.aw-layout-workareaMain',
        width: 'SMALL',
        height: 'FULL',
        context,
        isCloseVisible: false,
        subPanelContext: context
    };
    dialogAction.show( options  );
};

/**
 * This method is used to set the showTable and totalFound flag to display execute recipe table.
 * We need to maintain showTable flag because if the totalFound is 0 then no table will be displayed.
 * We also need to maintain totalFound flag because if it is 0 then we have to display no results lable.
 * @param {Object} data the view model data
 * @returns {Boolean} true/false
 */
export let hideRecipeResultTable = function( data ) {
    return { showTable: false, totalFound: 0 };
};

export let setTreeViewType = function( recipeState ) {
    const newRecipeState = { ...recipeState };
    newRecipeState.recipeSearchCriteriaProvider.viewType = 'treeView';
    recipeState.update && recipeState.update( newRecipeState );
};

export let getDisplayView = function( eventData, currentView, subPanelContext ) {
    let viewMode = currentView;
    const newParentSelectionData = { ...subPanelContext.parentSelectionData };

    if( eventData && eventData.viewMode ) {
        viewMode = eventData.viewMode;
    }
    // On view change if selection in results then move selection back to recipe
    if( newParentSelectionData.selected && newParentSelectionData.selected.length > 0 && newParentSelectionData.id !== 'seedTreeSelectionModel' ) {
        let parentSelection = selectionService.getSelection().parent;

        if( !parentSelection ) {
            parentSelection = vmcs.createViewModelObject( appCtxSvc.ctx.xrtSummaryContextObject.uid, 'EDIT' );
        }
        newParentSelectionData.selected = [ parentSelection ];
        subPanelContext.parentSelectionData.update && subPanelContext.parentSelectionData.update( newParentSelectionData );
    }
    return viewMode;
};

export const arrangeColumns = function( data, eventData, props ) {
    const updatedEventData = {
        props: props,
        ...eventData
    };

    return columnArrangeService.arrangeColumns( data, updatedEventData );
};

export default exports = {
    showTable,
    evaluateShowTable,
    copyUnderlyingObject,
    evm1ExportToExcel,
    processExportToExcel,
    hideRecipeResultTable,
    setTreeViewType,
    getDisplayView,
    arrangeColumns
};
