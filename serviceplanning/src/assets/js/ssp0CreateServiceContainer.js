// Copyright (c) 2022 Siemens

/**
 * Service Container functions
 *
 * @module js/ssp0CreateServiceContainer
 */

import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import eventBus from 'js/eventBus';

var exports = {};

/**
  * Get the List of Service Containers
  * @param {Object} data data
  * @return {Object} List of Service Containers
  */
export let serviceContainerList = function( data ) {
    let serviceContainerList = [];
    if ( data.searchResults ) {
        var serviceContainerNames = data.searchResults;
        for ( let i = 0; i < serviceContainerNames.length; i++ ) {
            let dbValue = serviceContainerNames[i].props.type_name.dbValues[0];
            let uiValue = serviceContainerNames[i].props.type_name.uiValues[0];

            serviceContainerList.push( {
                incompleteTail: true,
                propDisplayValue: uiValue,
                propInternalValue: dbValue,
                selected: false
            } );
        }
        if ( serviceContainerList.length > 0 ) {
            eventBus.publish( 'ssp0CreateServiceContainer.updateCurrentServiceContainer', { currentServiceContainerType: serviceContainerList[0] } );
        }
    }
    return serviceContainerList;
};

/**
  * Clone the type of Selected Object into the data
  * @param {Object} data data
  * @param {Object} fields fields
  * @return {Object} an object for given context
  */
export let changeAction = function( data, fields ) {
    let cloneData = data;
    if ( cloneData.totalFound === 0 ) {
        cloneData.selectedType.dbValue = servicePlannerConstants.TYPE_SERVICE_CONTAINER;
    } else {
        cloneData.selectedType.dbValue = data.currentServiceContainer.dbValue;
        const newObjectSetStateValue = { ...fields.xrtState.getValue() };
        newObjectSetStateValue.dpRef = fields.xrtState.dpRef;
        if ( fields.xrtState.update ) {
            fields.xrtState.update( newObjectSetStateValue );
        }
    }
    return cloneData;
};

export default exports = {

    serviceContainerList,
    changeAction
};
