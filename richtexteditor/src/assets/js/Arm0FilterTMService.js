// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Arm0FilterTMService
 */
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';

import arm0TraceabilityMatrix from 'js/Arm0TraceabilityMatrix';
import _ from 'lodash';
import aceFilterService from 'js/aceFilterService';
import discoveryFilterService from 'js/discoveryFilterService';
import commandPanelService from 'js/commandPanel.service';
import uwPropertyService from 'js/uwPropertyService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import occmgmtUtils from 'js/occmgmtUtils';
import recipeHandler from 'js/recipeHandler';


let exports = {};


let FILTER_CONTEXT_KEY_SOURCE = 'RMFilterContextSource';
let FILTER_CONTEXT_KEY_TARGET = 'RMFilterContextTarget';


/**
  * Set subType in listbox
  *
  * @function getSearchId
  * @param {Object} data - The panel's view model object
  */
export let populateFilterInformation = function( data, ctx ) {
    data.enableTracelinkFilterApply = false;
    let TracelinkFilterList = [];
    data.dispatch( { path: 'data.enableTracelinkFilterApply', value: data.enableTracelinkFilterApply } );
    if( ctx.panelContext ) {
        if( ctx.MatrixContext.activeFilterView === 'TRACELINK' ) {
            let res = arm0TraceabilityMatrix.getLinkTypes();
            let selectedFilters = ctx.MatrixContext.typeFilter && ctx.MatrixContext.typeFilter.filter ? ctx.MatrixContext.typeFilter.filter : [];
            if( res.tlTypeList ) {
                let first = {
                    categoryType: 'Attribute',
                    currentCategory: data.i18n.TracelinkType,
                    defaultFilterValueDisplayCount: 5,
                    displayName: data.i18n.TracelinkType,
                    editable: false,
                    endIndex: 2,
                    endReached: true,
                    excludeCategory: false,
                    expand: true,
                    filterCount: 2,
                    filterLimitForCategory: 50,
                    filterValues: [],
                    hasMoreFacetValues: false,
                    index: 0,
                    internalName: data.i18n.TracelinkType,
                    isExcludeCategorySupported: false,
                    isHierarchical: false,
                    isMultiSelect: true,
                    isPopulated: true,
                    isSelected: false,
                    isServerSearch: false,
                    quickSearchable: false,
                    showColor: false,
                    showEnabled: true,
                    showExpand: true,
                    showStringFilter: true,
                    startIndexForFacetSearch: 2,
                    type: 'StringFilter'
                };
                for( const element of res.tlTypeList ) {
                    if( !res.tltypeCountMap[element.propInternalValue] ) {
                        continue;
                    }
                    if( data.i18n.all !== element.propDisplayValue ) {
                        let value = {
                            autoFocus: false,
                            categoryName: data.i18n.TracelinkType,
                            colorIndex: 0,
                            drilldown: 0,
                            count: res.tltypeCountMap[element.propInternalValue],
                            showCount: res.tltypeCountMap[element.propInternalValue],
                            internalName: element.propInternalValue,
                            name: element.propDisplayValue,
                            selected: {
                                dbValue: Boolean( selectedFilters.includes( element.propInternalValue ) ),
                                displayName: element.propDisplayValue,
                                uiValue: element.propDisplayValue
                            },
                            showSuffixIcon: false
                        };
                        first.filterValues.push( value );
                        // first.results.push( value );
                    }
                }
                TracelinkFilterList.push( first );
                // data.tracelinkTypeList = TracelinkFilterList;
                // data.dispatch( { path: 'data.tracelinkTypeList', value: data.tracelinkTypeList } );
            }
        } else if( ctx.MatrixContext.activeFilterView === 'ROW' || ctx.MatrixContext.activeFilterView === 'ROW_COLUMN' ) {
            setInitialFilterContext( data, ctx.MatrixContext.sourcePCI, FILTER_CONTEXT_KEY_SOURCE );
        } else if( ctx.MatrixContext.activeFilterView === 'COLUMN' ) {
            setInitialFilterContext( data, ctx.MatrixContext.targetPCI, FILTER_CONTEXT_KEY_TARGET );
        }
    }

    let aceFilterPanelReveledEventSub = eventBus.subscribe( 'filterPanel.initializeAndReveal', function(  ) {
        eventBus.unsubscribe( aceFilterPanelReveledEventSub );
        eventBus.publish( 'filterPanel.initializeAndRevealRMProxy' );
    } );

    const newSharedData = _.clone( data.sharedData );
    newSharedData.enableFilterApply = false;

    return {
        tracelinkFilters: {
            categories: TracelinkFilterList
        },
        sharedData: newSharedData
    };
};

let getSelectedTypeOfTraceLink = function( filterValues, doNotAddALL ) {
    let filterFlag = 0;
    let typeFilterList = [];
    if( filterValues && filterValues.length > 0 ) {
        if( filterValues.length === 1 ) {
            filterFlag = 0;
        }
        if( filterValues.length > 1 ) {
            for( const node of filterValues ) {
                let isSelected = node.selected && node.selected.value || node.selected.dbValue ? node.selected.value || node.selected.dbValue : false;
                if( isSelected ) {
                    filterFlag = 2;
                    typeFilterList.push( node.internalName );
                }
            }
        }
    }
    let typeFilter = {};
    if( filterFlag === 2 ) {
        if( typeFilterList.length === filterValues.length && !doNotAddALL ) {
            typeFilterList = [ 'ALL' ];
            typeFilter.isFilterNeeded = false;
        } else{
            typeFilter.isFilterNeeded = true;
        }
        typeFilter.filter = typeFilterList;
    }
    return typeFilter;
};

/**
  * Get all object types from preference
  *
  * @param {Object} data - The view model data
  */
export let checkForTracelinkTypeFilter = function( data ) {
    let linkFilters = data.tracelinkTypeList.categories && data.tracelinkTypeList.categories.length > 0
        && data.tracelinkTypeList.categories[0] && data.tracelinkTypeList.categories[0].filterValues ? data.tracelinkTypeList.categories[0].filterValues : [];
    appCtxService.registerPartialCtx( 'MatrixContext.typeFilter',
        getSelectedTypeOfTraceLink( linkFilters ) );
};

//------ ACE Filter Panel ------

/**

 *
 * @param {*} data - view model object

 */
export let destroyFilterPanel = function( data ) {
    appCtxService.unRegisterCtx( data.contextKey );
    appCtxService.updatePartialCtx( 'MatrixContext.activeFilterView', undefined );
    discoveryFilterService.destroy();
    _.defer( function() {
        eventBus.publish( 'Arm0TraceabilityMatrix.resizeWindow' );
    } );
};

/**
  *
  * @param {Object} data - view model object
  * @param {Object} pci - product context object
  */
let setInitialFilterContext = function( data, pci, filterContextKey ) {
    let isUpdateContext = false;
    if( data.contextKey ) {
        isUpdateContext = true;
        appCtxService.unRegisterCtx( data.contextKey );
    }
    let initialCtx = {
        context: {
            currentState: {
                filter: '',
                pci_uid: pci.uid
            },
            productContextInfo: pci,
            requestPref: {
            },
            transientRequestPref: {
            },
            supportedFeatures: {
                Awb0EnableSmartDiscoveryFeature: true
            },
            readOnlyFeatures: {}
        },
        key: 'MatrixContext'
    };

    appCtxService.updatePartialCtx( 'panelContext.contextKey', filterContextKey );
    data.contextKey = filterContextKey;
    data.dispatch( { path: 'data.contextKey', value: data.contextKey } );
    appCtxService.registerCtx( data.contextKey, initialCtx.context );
    discoveryFilterService.setContextKey( filterContextKey );
    setTimeout( () => {
        if( isUpdateContext ) {
            // eventBus.publish( 'initializeAndReveal' );
            // discoveryFilterService.setContext( data, appCtxService.ctx );
            // discoveryFilterService.getFilterData( data );
            // discoveryFilterPanelRevealedFromRM( data );
        }
    }, 100 );
};

export let applyMatrixFilter = function( data ) {
    let activeFilterView = appCtxService.ctx.MatrixContext.activeFilterView;
    if( activeFilterView === 'TRACELINK' ) {
        checkForTracelinkTypeFilter( data );
    }else {
        populateUpdatedRecipe( data );
        discoveryFilterService.clearRecipeCache( undefined, false );
        discoveryFilterService.clearCategoryLogicMap();
        // Update transient request pref and set reset flag on context
        // let occContextValue = {
        //     transientRequestPref: {
        //         calculateFilters: true,
        //         retainTreeExpansionStates: true, // Retain expansion state on application of filter
        //         filterOrRecipeChange: true,
        //         jitterFreePropLoad: true
        //     },
        //     clearExistingSelections: true,
        //     pwaReset: true
        // };
        // occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, appCtxService.getCtx( data.contextKey ) );

        let [ effectiveFilterString, effectiveRecipe ] = recipeHandler.getTransientRecipeInfo( data.contextKey );
        let filter = _populateFilterParameters(  effectiveFilterString, effectiveRecipe );

        if( activeFilterView === 'ROW' || activeFilterView === 'ROW_COLUMN' ) {
            let rowFilter = {};
            rowFilter.filter = filter;
            appCtxService.registerPartialCtx( 'MatrixContext.rowFilter', rowFilter );
        } else if( activeFilterView === 'COLUMN' ) {
            let colFilter = {};
            colFilter.filter = filter;
            appCtxService.registerPartialCtx( 'MatrixContext.colFilter', colFilter );
        }


        let contextChangedOnResponse = eventBus.subscribe( 'Arm0FilterTM.updateFilterContextOnResponse', function( eventData ) {
            eventBus.unsubscribe( contextChangedOnResponse );


            // Update Filter context
            if( eventData && eventData.filterOutput ) {
                appCtxService.updatePartialCtx( data.contextKey + '.recipe', eventData.filterOutput.recipe );
                appCtxService.updatePartialCtx( data.contextKey + '.searchFilterCategories', eventData.filterOutput.searchFilterCategories );
                appCtxService.updatePartialCtx( data.contextKey + '.searchFilterMap', eventData.filterOutput.searchFilterMap );
                // appCtxService.updatePartialCtx( data.contextKey + '.searchFilterMap', eventData.filterOutput.searchFilterMap );
            }

            eventBus.publish( 'occDataLoadedEvent', {
                dataProviderActionType: 'initializeAction',
                contextKey: data.contextKey
            } );


            // Fire event to update Filters/Categiries in ACE
            eventBus.publish( 'productContextChangedEvent', {
                dataProviderActionType: 'initializeAction',
                updatedView: 'Arm0TraceMatrixFilter'

            } );
        } );
    }
    eventBus.publish( 'Arm0FilterTM.loadMatrixFilterData' );

    const newSharedData = _.clone( data.sharedData );
    if( activeFilterView === 'TRACELINK' ) {
        newSharedData.enableFilterApply = false;
    }
    return newSharedData;
};

let populateUpdatedRecipe = function( data ) {
    let context = recipeHandler.getTransientRecipeInfo( data.contextKey );
    if( context ) {
        let effectiveRecipe = context[1];
        if( effectiveRecipe ) {
            occmgmtUtils.updateValueOnCtxOrState( 'updatedRecipe', effectiveRecipe, data.contextKey );
        }
    }
};

let omitUnwantedProperties = function( recipe, propertiesToOmit ) {
    let outRecipe = [];
    if( recipe ) {
        recipe.forEach( function( term ) {
            let outTerm = _.omit( term, propertiesToOmit );
            if( outTerm.subCriteria && outTerm.subCriteria.length > 0 ) {
                outTerm.subCriteria = omitUnwantedProperties( outTerm.subCriteria, propertiesToOmit );
            }


            outRecipe.push( outTerm );
        } );
    }
    return outRecipe;
};

let _populateFilterParameters = function( effectiveFilterString, effectiveRecipe ) {
    let filter = {};
    let filterString = null;

    filterString = effectiveFilterString;


    filter.searchFilterCategories = [];
    filter.searchFilterMap = {};
    let recipe;

    // Populate filters/recipe only when filters are applied from this action OR when a filtered structure is being refreshed
    // or expanded
    if( filterString && !effectiveRecipe ) {
        if( filterString ) {
            let categoriesInfo = aceFilterService.extractFilterCategoriesAndFilterMap( filterString );
            filter.searchFilterCategories = categoriesInfo.filterCategories;
            filter.searchFilterMap = categoriesInfo.filterMap;
            recipe = effectiveRecipe;
        }
    }
    //Populate recipe when recipe is modified via applying proximity or delete or operator change
    if( effectiveRecipe ) {
        recipe = effectiveRecipe;
    }

    filter.fetchUpdatedFilters = false;
    filter.recipe = [];


    if( recipe ) {
        filter.recipe.push.apply( filter.recipe, recipe );
    }

    filter.searchFilterFieldSortType = 'Priority';
    filter.searchSortCriteria = [];

    return filter;
};

export let activateMatrixFilterPanel = function( panelData ) {
    appCtxService.registerPartialCtx( 'MatrixContext.activeFilterView', panelData );
    if( panelData === 'ROW' || panelData === 'ROW_COLUMN' ) {
        appCtxService.registerPartialCtx( 'MatrixContext.activeFilterViewObjectName', appCtxService.ctx.MatrixContext.peakSrcInfo.displayName );
    } else if( panelData === 'COLUMN' ) {
        appCtxService.registerPartialCtx( 'MatrixContext.activeFilterViewObjectName', appCtxService.ctx.MatrixContext.peakTargetInfo.displayName );
    }
    let activeCommandId = appCtxService.getCtx( 'sidenavCommandId' );
    if( activeCommandId && activeCommandId === 'Arm0TraceMatrixFilter' ) {
        // Panel already opened
        discoveryFilterService.destroy();    // Destroy to delete existing filter cache
        appCtxService.updatePartialCtx( 'MatrixContext.activeFilterView', panelData );
        eventBus.publish( 'Arm0MatrixFilter.populateFilterInformation' );
    } else {
        commandPanelService.activateCommandPanel(
            'Arm0TraceMatrixFilter',
            'aw_navigation',
            { },
            true,
            true,
            {
                width: 'STANDARD'
            } );
    }
};

/**
  * Function to enable/disable visibility of filter button for Tracelink Type filter panel
  * @param {*} category -
  * @param {*} filter -
  * @param {*} data -
  */
export let selectTracelinkTypeFilterAction = function( category, filter, sharedData ) {
    let selectedTypes = getSelectedTypeOfTraceLink( category.filterValues, true );
    selectedTypes.filter = selectedTypes.filter ? selectedTypes.filter : [];
    // if( !selectedTypes.filter.includes( filter.internalName ) && !filter.selected ) {
    //     selectedTypes.filter.push( filter.internalName );
    // } else if( selectedTypes.filter.includes( filter.internalName ) && filter.selected ) {
    //     let index = selectedTypes.filter.indexOf( filter.internalName );
    //     selectedTypes.filter.splice( index, 1 );
    // }
    let typeFilterContext = appCtxService.ctx.MatrixContext.typeFilter && appCtxService.ctx.MatrixContext.typeFilter.filter ? appCtxService.ctx.MatrixContext.typeFilter.filter : [];
    typeFilterContext = _.cloneDeep( typeFilterContext );
    if( typeFilterContext.indexOf( 'ALL' ) > -1 ) { // replace ALL with individual all types
        typeFilterContext = Object.keys( arm0TraceabilityMatrix.getLinkTypes().tltypeCountMap );
    }
    let enableTracelinkFilterApply = false;
    if( typeFilterContext.sort().join( ',' ) === selectedTypes.filter.sort().join( ',' ) ) {
        enableTracelinkFilterApply = false;
    } else {
        enableTracelinkFilterApply = true;
    }
    const newSharedData = { ...sharedData.getValue() };
    newSharedData.enableFilterApply = enableTracelinkFilterApply;
    sharedData.update && sharedData.update( newSharedData );
};

// NEW

/**
 * To switch between discovery sub panel and structure filter panel
 * @param {Object} sharedData - shared data
 * @param {Object} occmgmtContext - current occContext object
 * @returns {Object} sharedData - updated shared data
 */
export const updateSharedActiveViewBasedOnCommandSelection = ( data, sharedData, MatrixContext ) => {
    let newSharedData = sharedData && sharedData.value ? { ...sharedData.getValue() } : {};

    let currentActiveView = newSharedData.activeView;

    if( MatrixContext && MatrixContext.activeFilterView && MatrixContext.activeFilterView === 'TRACELINK' ) {
        newSharedData.activeView = 'Arm0TraceMatrixTracelinkTypeFilter';
    } else {
        if( currentActiveView && ( currentActiveView === 'Awb0DiscoveryFilterCommandSubPanel' || currentActiveView === 'ProximitySubPanel' || currentActiveView === 'BoxZoneSubPanel' ||
                currentActiveView === 'PlaneZoneSubPanel' || currentActiveView === 'Awb0FilterPanelSettings' ) ) {
            return newSharedData;
        }
        newSharedData.activeView = 'Awb0DiscoveryFilterCommandSubPanel';
        data.dispatch( { path: 'data.activeFilterViewObjectName', value: MatrixContext.activeFilterViewObjectName } );
    }

    return newSharedData;
};

export const updateSharedData = ( sharedData ) => {
    const newSharedData = _.clone( sharedData );
    newSharedData.autoApply = false;
    return newSharedData;
};
