// Copyright (c) 2022 Siemens

/**
 * Service Work Card functions
 *
 * @module js/ssp0CreateWorkCardService
 */

import _ from 'lodash';
import eventBus from 'js/eventBus';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';

var exports = {};

/**
  * Get the List of Work Card
  * @param {Object} data data
  * @return {Object} List of Work Card
  */
export let workCardList = function( data ) {
    let workCardList = [];
    if ( data.searchResults ) {
        var workCardNames = data.searchResults;
        for ( let i = 0; i < workCardNames.length; i++ ) {
            let dbValue = workCardNames[i].props.type_name.dbValues[0];
            let uiValue = workCardNames[i].props.type_name.uiValues[0];

            workCardList.push( {
                incompleteTail: true,
                propDisplayValue: uiValue,
                propInternalValue: dbValue,
                selected: false
            } );
        }
        if ( workCardList.length > 0 ) {
            eventBus.publish( 'ssp0CreateWorkCard.updateCurrentWorkCard', { currentWorkCardType: workCardList[0] } );
        }
    }
    return workCardList;
};

/**
  * Clone the type of Selected Object into the data
  * @param {Object} data data
  * @param {Object} fields fields
  * @return {Object} an object for given context
  */
export let changeAction = function( data, fields ) {
    let cloneData = _.clone( data );
    if ( cloneData.totalFound === 0 ) {
        cloneData.selectedType.dbValue = servicePlannerConstants.TYPE_WORK_CARD;
    } else {
        cloneData.selectedType.dbValue = data.currentWorkCard.dbValue;
        const newObjectSetStateValue = { ...fields.xrtState.getValue() };
        newObjectSetStateValue.dpRef = fields.xrtState.dpRef;
        if ( fields.xrtState.update ) {
            fields.xrtState.update( newObjectSetStateValue );
        }
    }
    return cloneData;
};

export default exports = {

    workCardList,
    changeAction
};
