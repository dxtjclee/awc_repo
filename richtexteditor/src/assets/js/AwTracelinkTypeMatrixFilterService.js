// Copyright 2021 Siemens Product Lifecycle Management Software Inc


import AwParseService from 'js/awParseService';
import AwPanelHeader from 'viewmodel/AwPanelHeaderViewModel';
import AwLayoutSlot from 'viewmodel/AwLayoutSlotViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwFilterPanel from 'viewmodel/AwFilterPanelViewModel';

/**
 * render function for Awb0StructureFilterCommandSubPanel
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awTracelinkTypeMatrixFilterPanelRenderFunction = ( props ) => {
    let subPanelContext = props.subPanelContext;
    let { viewModel: { data, dataProviders, dispatch, conditions, selectionModels, chartProviders, ports  }, ctx, actions, fields, i18n, formProp, viewPath  } = props;
    data = { ...data, dataProviders };
    if( subPanelContext ) {
        fields = { ...subPanelContext };
    }


    const selectFilterAction = ( filter, category ) => {
        dispatch( { path: 'data.filter', value: filter } );
        dispatch( { path: 'data.category', value: category } );
        actions.selectTracelinkTypeFilterAction();
    };

    const facetSearchAction = ( categoryForFacetSearchInput, category ) => {
        dispatch( { path: 'data.facetCategorySearchInput', value: categoryForFacetSearchInput } );
        dispatch( { path: 'data.facetCategory', value: category } );
        actions.performFacetSearch();
    };

    return (
        <>
            <AwPanelHeader>
                <AwLayoutSlot name='Awb0ContextFeature_ContextInFilter'>
                </AwLayoutSlot>
            </AwPanelHeader>
            <AwPanelBody scrollable='false'>
                <AwFilterPanel subPanelContext={AwParseService.instance( '{searchState:fields.searchState}' )( { props, data, fields, dataProviders, ctx, i18n, actions, subPanelContext, viewPath, conditions, formProp, dispatch, selectionModels, chartProviders, ports } ) } selectFilterCallBack={selectFilterAction} stringFacetCallBack={facetSearchAction}>
                </AwFilterPanel>
            </AwPanelBody>
        </>
    );
};

