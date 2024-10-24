// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import { getBaseUrlPath } from 'app';
import awIconService from 'js/awIconService';
import awKanbanUtils from 'js/AwKanbanUtils';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import PrgDelKanbanViewCallbacks from 'js/PrgDelKanbanViewCallbacks';
import uwPropSvc from 'js/uwPropertyService';

var exports = {};


export let populateDisplayLimit = function( data, fields, newValue ) {
    var dispLimitValue = newValue ? newValue : 2;
    var displayLimitPref = appCtxSvc.getCtx( 'preferences.AWC_Kanban_Board_Display_Limit' );
    if( !newValue && displayLimitPref && displayLimitPref[ 0 ] ) {
        dispLimitValue = parseInt( displayLimitPref[ 0 ] );
    }

    let displayLimit = _.clone( data.displayLimit );
    displayLimit.dbValue = dispLimitValue;
    displayLimit.value = dispLimitValue;
    if( fields ) {
        fields.displayLimit.update( dispLimitValue );
    }
};

export let updateDisplayLimit = function( searchState, displayLimit ) {
    const newSearchState = { ...searchState.getValue() };
    newSearchState.displayLimit = displayLimit;
    searchState.update( newSearchState );
};

export let updateDisplayLimitPreference = function( value ) {
    var valueStr = value.toString();
    appCtxSvc.ctx.preferences.AWC_Kanban_Board_Display_Limit[ 0 ] = valueStr;
    return valueStr;
};

export default exports = {
    populateDisplayLimit,
    updateDisplayLimit,
    updateDisplayLimitPreference
};
