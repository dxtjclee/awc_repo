// Copyright (c) 2022 Siemens

/**
 * Service Requirement functions
 *
 * @module js/ssp0HeaderTimeLinkService
 */

import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import msgSvc from 'js/messagingService';
import preferenceService from 'soa/preferenceService';
import soaService from 'soa/kernel/soaService';

var exports = {};

/**
  * Create a Time Unit List
  * @param {Object} dataProvider dataProvider
  * @return {Object} an object of Time Unit List
  */
export let getTimeUnitsFromResponse = function( dataProvider ) {
    let timeUnitsLinkList;
    const awPromise = AwPromiseService.instance;
    const currentTimeUnit = appCtxSvc.getCtx( 'ssp0selectedCurrentTime.timeUnit' );
    if ( appCtxSvc.getCtx( 'ssp0selectedCurrentTime.timeUnitsList' ) !== undefined ) {
        timeUnitsLinkList = appCtxSvc.getCtx( 'ssp0selectedCurrentTime.timeUnitsList' );
    } else {
        timeUnitsLinkList = getTimeUnitsLinkList( currentTimeUnit );
    }
    dataProvider.selectionModel.setSelection( getSelectedTimeUnit( timeUnitsLinkList ) );
    return awPromise.resolve( timeUnitsLinkList );
};
/**
  * Get Current Time Unit Preference Value
  * @param {Object} response response
  * @return {String} Current Time Unit Preference Value
  */
export let getCurrentTimeUnitPreferenceValue = function( response ) {
    if ( response && response.response ) {
        appCtxSvc.registerCtx( 'ssp0selectedCurrentTime.timeUnit', response.response[0].values.values[0] );
        return response.response[0].values.values[0];
    }
};
/**
  * get Time Units List
  * @param {Object} currentTimeUnit Current Time Unit
  * @return {Object} an object of Time Unit List
  */
export let getTimeUnitsLinkList = function( currentTimeUnit ) {
    let timeUnitsLinkList = [];
    let body = {
        sections: [
            {
                sectionName: 'objectsToLoad',
                dataEntries: [
                    {
                        entry: {
                            typeToLoad: {
                                nameToValuesMap: {
                                    loadType: [
                                        'TimeUnits'
                                    ]
                                }
                            },
                            objectToLoad: {
                                nameToValuesMap: {
                                    objectUid: [
                                        appCtxSvc.getCtx( 'state.params.uid' )
                                    ]
                                }
                            }
                        }
                    }
                ]
            }
        ]
    };
    return soaService.postUnchecked( 'Internal-MfgBvrCore-2015-03-DataManagement', 'loadObjectData3', body ).then( function( result ) {
        if ( result.ServiceData.partialErrors && result.ServiceData.partialErrors.length > 0 && result.ServiceData.partialErrors[0] && result.ServiceData.partialErrors[0].errorValues ) {
            msgSvc.showError( result.ServiceData.partialErrors[0].errorValues[0].message );
            return result;
        }

        const responseObj = result.relatedObjectsMap;
        for ( let elements in responseObj ) {
            if ( responseObj[elements].additionalPropertiesMap2 && responseObj[elements].additionalPropertiesMap2.longName ) {
                timeUnitsLinkList.push( {
                    staticDisplayValue: responseObj[elements].additionalPropertiesMap2.longName[0],
                    staticElementObject: 'cmdListView',
                    selected: currentTimeUnit === responseObj[elements].additionalPropertiesMap2.longName[0]
                } );
            }
        }
        appCtxSvc.registerCtx( 'ssp0selectedCurrentTime.timeUnitsList', timeUnitsLinkList );
        return timeUnitsLinkList;
    } );
};

/**
  * Change Time Unit
  * @param {Object} newTimeUnit Changed Time Unit
  * @return {Object} List of Service Requirements
  */
export function changeTimeUnit( newTimeUnit ) {
    if (newTimeUnit && newTimeUnit.staticDisplayValue !== undefined && newTimeUnit.staticDisplayValue !== appCtxSvc.getCtx( 'ssp0selectedCurrentTime.timeUnit' ) ) {
        const timeUnits = appCtxSvc.getCtx( 'ssp0selectedCurrentTime.timeUnitsList' );
        const timeUnit = _.filter( timeUnits, function( timeUnit ) {
            return timeUnit.staticDisplayValue === newTimeUnit.staticDisplayValue;
        } );
        if ( timeUnit ) {
            return preferenceService.setStringValue( 'SPCurrentTimeUnit', [ timeUnit[0].staticDisplayValue ] ).then( function( result ) {
                window.location.reload();
            } );
        }
    }
}
/**
  * Get Selected Time Unit
  * @param {Object} timeUnitArray Time Unit List
  * @return {Object} Object of selected time unit
  */
function getSelectedTimeUnit( timeUnitArray ) {
    return _.filter( timeUnitArray, function( timeUnit ) {
        return timeUnit.selected === true;
    } );
}

export default exports = {
    changeTimeUnit,
    getTimeUnitsFromResponse,
    getCurrentTimeUnitPreferenceValue
};
