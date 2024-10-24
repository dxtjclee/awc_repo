// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to activities tree
*
* @module js/ssp0CreateActivityService
*/

import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Get the List of Service Containers
 * @param {Object} data data
 * @return {Object} List of Service Containers
 */
export let activityList = function( data ) {
    let activitiesList = [];
    let currentSelectedType;
    if ( data.ServiceData && data.ServiceData.modelObjects ) {
        var activityNames = data.ServiceData.modelObjects;
        Object.values( activityNames ).forEach(
            activityName => {
                if ( activityName.props.type_name.dbValues[0] !== 'Ept0InstanceActivityBase' && activityName.props.type_name.dbValues[0] !== 'Ept0LibraryActivityBase' ) {
                    let dbValue = activityName.props.type_name.dbValues[0];
                    let uiValue = activityName.props.type_name.uiValues[0];

                    activitiesList.push( {
                        incompleteTail: true,
                        propDisplayValue: uiValue,
                        propInternalValue: dbValue,
                        selected: false
                    } );
                }
            } );

        currentSelectedType = activitiesList.find( obj => obj.propInternalValue === 'MEActivity' );
        if ( activitiesList.length > 0 ) {
            currentSelectedType = currentSelectedType !== undefined ? currentSelectedType : activitiesList[0];
            eventBus.publish( 'ssp0CreateActivity.updateCurrentActivity', { currentActivityType: currentSelectedType } );
        }
        return activitiesList;
    }
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
        cloneData.selectedType.dbValue = 'MEActivity';
    } else {
        cloneData.selectedType.dbValue = data.currentActivity.dbValue;
        const newObjectSetStateValue = { ...fields.xrtState.getValue() };
        newObjectSetStateValue.dpRef = fields.xrtState.dpRef;
        if ( fields.xrtState.update ) {
            fields.xrtState.update( newObjectSetStateValue );
        }
    }

    return cloneData;
};

export default exports = {
    activityList,
    changeAction
};
