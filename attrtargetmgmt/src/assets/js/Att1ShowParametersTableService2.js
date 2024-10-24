// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ShowParametersTableService2
 */
import _ from 'lodash';

var exports = {};

/**
 * Update parametersTable context for syncing uniform prameters table
 */
export let syncParametersTable = function( eventData, parametersTable ) {
    const parametersTableCtx = _.clone( parametersTable );
    // Set the parent objects
    if( eventData ) {
        if( eventData.selectedParents && _.isArray( eventData.selectedParents ) ) {
            parametersTableCtx.parentObjects = eventData.selectedParents;
        }
        if( eventData.searchCriteria ) {
            parametersTableCtx.searchCriteria = parametersTableCtx.searchCriteria || {};
            for( var prop in eventData.searchCriteria ) {
                parametersTableCtx.searchCriteria[ prop ] = eventData.searchCriteria[ prop ];
            }
        }
        if( eventData.options ) {
            parametersTableCtx.options = parametersTableCtx.options || {};
            for( var option in eventData.options ) {
                parametersTableCtx.options[ option ] = eventData.options[ option ];
            }
        }
        if( eventData.columnFilters ) {
            parametersTableCtx.columnFilters = eventData.columnFilters;
        }
    }
    return { parametersTable: parametersTableCtx };
};

/**
 * Returns the Att1ShowParametersTableService2 instance
 */
export default exports = {
    syncParametersTable
};
