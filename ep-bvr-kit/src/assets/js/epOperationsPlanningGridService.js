// Copyright (c) 2022 Siemens
/**
 * EP Operations Planning Grid service
 *
 * @module js/epOperationsPlanningGridService
 */

import _ from 'lodash';
import epPlanningService from 'js/epPlanningService';

/**
 * Customize Header appearance for Top grid header cells
 * Calculates the total of allocated time and weighted time columns
 * @param {Object} column - the column object
 * @return {Object} data container to initialize Extended Tooltip component for column
 */
export function populateOperationsHeader( column ) {
    if ( column.field === 'elb0allocatedTimeByPV' ) {
        return {
            total: getOperationsTime( epPlanningService.getLoadedOperations() )
        };
    }
    if ( column.field === 'weightedTime' ) {
        return { totalWeighted: epPlanningService.getTotalWeightedTime().toFixed( 2 ) };
    }
    if( column.pv ) {
        return {
            pvColumnTotal: getOperationsTime( epPlanningService.getOperationsForProductVariant( column.name ) )
        };
    }
    return null;
}

/**
 * getOperationsTime
 * @param {*} operations list of operations
 * @returns {Number} sum of operations time
 */
function getOperationsTime( operations ) {
    let time = _.sumBy( operations, operation => Number( operation.props.elb0allocatedTimeByPV.uiValues[ 0 ] ) );
    time = time.toFixed( 2 );
    return time;
}

export default {
    populateOperationsHeader
};
