// Copyright 2021 Siemens Product Lifecycle Management Software Inc


import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwDiscoveryRecipeChips from 'viewmodel/AwDiscoveryRecipeChipsViewModel';
import AwFilterPanel from 'viewmodel/AwFilterPanelViewModel';
import AwPanelHeader from 'viewmodel/AwPanelHeaderViewModel';
import AwLayoutSlot from 'viewmodel/AwLayoutSlotViewModel';
import AwPanelFooter from 'viewmodel/AwPanelFooterViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import AwSeparator from 'viewmodel/AwSeparatorViewModel';
import AwLabel from 'viewmodel/AwLabelViewModel';
import { EnableWhen, ExistWhen } from 'js/hocCollection';

const AwButtonEnableWhenExistWhen = EnableWhen( ExistWhen( AwButton ) );


/**
 * render function for Awb0DiscoveryFilterCommandSubPanel
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awDiscoveryFilterPanelRenderFunction = ( props ) => {
    let subPanelContext = props.subPanelContext;
    let { viewModel: { dispatch }, actions, fields, i18n } = props;

    if( subPanelContext && subPanelContext.fields ) {
        fields = { ...fields, ...subPanelContext.fields };
    }
    let hasRecipe = fields.recipeState && fields.recipeState.recipe && fields.recipeState.recipe.length > 0;
    const selectFilterAction = ( filter, category ) => {
        dispatch( { path: 'data.appliedFilter', value: { appliedFilterValue: filter, appliedFilterCategory: category } } );
        actions.updateSearchStateAfterFilterAction();
    };

    const facetSearchAction = ( categoryForFacetSearchInput, category ) => {
        dispatch( { path: 'data.facetCategoryInput', value: { categorySearchInput: categoryForFacetSearchInput, facetCategory: category }  } );
        if( category.categoryType === 'Partition' && ( categoryForFacetSearchInput.facetSearchString === undefined || !category.expand ) ) {
            actions.updatePartitionSchemeFacet();
        } else{
            actions.performFacetSearch();
        }
    };

    const excludeCategoryAction = ( category, excludeCategoryToggleValue ) => {
        dispatch( { path: 'data.toggleCategoryInput', value: { excludeCategoryToggleValue: excludeCategoryToggleValue, excludeCategory: category } } );
        actions.toggleCategoryLogic();
    };

    return (
        < >
            <AwPanelBody scrollable='false'>


                { hasRecipe &&
                <AwDiscoveryRecipeChips enableChips={!subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature} recipeObject={fields.recipeState}>
                </AwDiscoveryRecipeChips>
                }

                { hasRecipe &&
                <AwSeparator></AwSeparator>

                }

                { subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature &&
                    <div className='sw-row aw-filter-italicText'>
                        <div className='sw-column'>
                            <AwLabel {...fields.showFiltersDisabledMessage}></AwLabel>
                        </div>
                    </div>
                }

                { !subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature &&
                    <AwFilterPanel subPanelContext={{ searchState:fields.searchState }} selectFilterCallBack={selectFilterAction} stringFacetCallBack={facetSearchAction}
                        excludeCategoryCallBack={excludeCategoryAction}>
                    </AwFilterPanel>
                }
            </AwPanelBody>
            { !subPanelContext.sharedData.autoApply && !subPanelContext.sharedData.hideFilterApply && fields.searchState && fields.searchState.categories && fields.searchState.categories.length > 0 &&
            <AwPanelFooter>
                <br>
                </br>
                <AwButtonEnableWhenExistWhen size='auto' action={actions.applyFilter} enableWhen={subPanelContext.sharedData.enableFilterApply} existWhen={!subPanelContext.sharedData.IsEmbeddedComponent}>
                    <AwI18n>
                        {i18n.filterButtonTitle}
                    </AwI18n>
                </AwButtonEnableWhenExistWhen>
                <AwButtonEnableWhenExistWhen size='auto' action={actions.applyFilterForHostedPanel} enableWhen={subPanelContext.sharedData.enableFilterApply} existWhen={subPanelContext.sharedData.IsEmbeddedComponent}>
                    <AwI18n>
                        {i18n.filterButtonTitle}
                    </AwI18n>
                </AwButtonEnableWhenExistWhen>
            </AwPanelFooter>
            }
        </>
    );
};

