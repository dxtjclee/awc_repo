// Copyright (c) 2022 Siemens

/**
 * Service Plan functions
 *
 * @module js/Ssp0CreateServicePlan
 */

import _ from 'lodash';
import eventBus from 'js/eventBus';
import addObjectUtils from 'js/addObjectUtils';

let exports = {};
const TYPE_ITEM = 'Item';
const TYPE_SERVICE_PLAN = 'SSP0ServicePlan';
const TYPE_SERVICE_PLAN_PROCESS = 'SSP0ServicePlanRevision';

export const getSecondaryObject = function( response ) {
    let modelObjects = response.modelObjects || response.data.modelObjects;
    const objectToReturn = Object.values( modelObjects ).filter(
        modelObject => modelObject.modelType.typeHierarchyArray.includes( TYPE_ITEM )
    )[0];

    if ( objectToReturn ) {
        return {
            uid: objectToReturn.uid,
            type: objectToReturn.type
        };
    }
};

export const getPrimaryObj = function( data ) {
    let objects = data.serviceData.modelObjects;
    let servicePlanRevisionObject = Object.values( objects ).filter( modelObject => modelObject.type === data.revisionType &&
        modelObject.modelType.typeHierarchyArray.includes( data.revisionType ) );
    data.servicePlanRevisionId = servicePlanRevisionObject[0].uid;
    return Object.values( objects ).filter(
        modelObject => modelObject.modelType.typeHierarchyArray.includes( data.selectedType.dbValue )
    )[0];
};

export let servicePlanList = function( data ) {
    let servicePlanList = [];
    if ( data.searchResults ) {
        let servicePlanNames = data.searchResults;
        for ( let i = 0; i < servicePlanNames.length; i++ ) {
            let dbValue = servicePlanNames[i].props.type_name.dbValues[0];
            let uiValue = servicePlanNames[i].props.type_name.uiValues[0];

            servicePlanList.push( {
                incompleteTail: true,
                propDisplayValue: uiValue,
                propInternalValue: dbValue,
                selected: false
            } );
        }
        if ( servicePlanList.length > 0 ) {
            eventBus.publish( 'ssp0CreateServicePlan.updateCurrentServicePlan', { currentServicePlanType: servicePlanList[0] } );
        }
    }
    return servicePlanList;
};

export let changeAction = function( data, fields ) {
    let cloneData = _.clone( data );
    if ( data.totalFound === 0 ) {
        cloneData.selectedType.dbValue = TYPE_SERVICE_PLAN;
    } else {
        cloneData.selectedType.dbValue = data.currentServicePlan.dbValue;
        const newObjectSetStateValue = { ...fields.xrtState.getValue() };
        newObjectSetStateValue.dpRef = fields.xrtState.dpRef;
        if ( fields.xrtState.update ) {
            fields.xrtState.update( newObjectSetStateValue );
        }
    }
    return cloneData;
};

export let getCreateServicePlanInput = function( data, createType ) {
    let getCreateInput = addObjectUtils.getCreateInput( data, '', createType );
    let stringProps = getCreateInput[0].createData.propertyNameValues;
    for ( const key in stringProps ) {
        stringProps[key] = stringProps[key][0];
    }
    return {
        revisionType: getCreateInput[0].createData.compoundCreateInput.revision[0].boName,
        stringProps: stringProps
    };
};
/**
 * Get the Value from viewModel and set it on Data
 *
 * @param {String} propertyToUpdate propertyToUpdate
 * @param {String} value value
 * @param {Object} dataToUpdate dataToUpdate
 * @returns {Object} value
 */
export let getServicePlanValueInViewModel = function( propertyToUpdate, value, dataToUpdate ) {
    let cloneData = _.clone( dataToUpdate );
    cloneData[propertyToUpdate] = value;
    return cloneData;
};
export default exports = {
    getServicePlanValueInViewModel,
    getCreateServicePlanInput,
    getSecondaryObject,
    getPrimaryObj,
    servicePlanList,
    changeAction

};
