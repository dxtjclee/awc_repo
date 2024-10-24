// Copyright (c) 2022 Siemens

/* *
 * @module js/Att1CompareParametersService
 */
import AwStateService from 'js/awStateService';

var exports = {};

/**
 * Method to get the search criteria for compare table
 * @param
 */
export let getComparisonElements = function( seperator ) {
    var searchCriteria = {};
    var params = undefined;
    var state = AwStateService.instance;
    if( state ) {
        params = state.params;
        var currentVariantUid = params.curr_var_uid;
        var currentRevRuleUid = params.curr_rev_uid;
        searchCriteria = {
            vrUid: currentVariantUid ? currentVariantUid : '',
            revisionRuleUid: currentRevRuleUid ? currentRevRuleUid : '',
            openedObjectUid: params.uid,
            comparisonElementUids: getComparisonElementsUids( seperator, params ),
            parentUids: params.sel_uids,
            productContextUids: params.productContextUids,
            selectedUids: params.sel_uids,
            showFromChildren: params.showFromChildren ? 'true' : 'false'
        };
    }
    return searchCriteria;
};

/**
 * Method to get the comparison element uids separated by separator
 */
function getComparisonElementsUids( seperator, params ) {
    var comparisonElementUids = '';
    if( params ) {
        var comparisonElementUids = params.comp_uids;
        if( comparisonElementUids === null ) {
            if( params.rv_uids ) {
                comparisonElementUids = params.rv_uids.split( ',' ).join( seperator );
            } else if( params.vrs_uids ) {
                comparisonElementUids = params.vrs_uids.split( '#' ).join( seperator );
            } else if( params.rcp_uids ) {
                comparisonElementUids = params.rcp_uids.split( '#' ).join( seperator );
            }
        }
    }
    return comparisonElementUids;
}

export default exports = {
    getComparisonElements
};
