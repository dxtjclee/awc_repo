//@<COPYRIGHT>@
//==================================================
//Copyright 2019.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
* @module js/Uml0ProjectModelOrderedStatusService
*/

import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';

const _typeLovValues = {};

/**
 * Cache the LOVs for a type's property and add some attributes to it
 * @param {Object} soaResponse property name
 * @param {String} typeName object's type
 * @param {String} propertyName object's property name
 * @return {ObjectArray} The view model properties for each state
 */
const cacheLOVValues = function( soaResponse, typeName, propertyName ) {
    _.forEach( soaResponse.lovValues, ( state ) => {
        const displayValue = _.get( state, 'propDisplayValues.lov_values[0]' );
        if( displayValue ) {
            state.propertyDisplayName = displayValue;
            state.uiValue = displayValue;
        }
    } );

    _typeLovValues[ typeName + '.' + propertyName ] = soaResponse.lovValues;
    return soaResponse.lovValues;
};

/**
 * Returns the states
 * @param {String} typeName type name of the object
 * @param {String} propertyName property name
 * @return {ObjectArray} The view model properties for each state
 */
export let loadLOV = async function( typeName, propertyName ) {
    let lovValues = _typeLovValues[ typeName + '.' + propertyName ];
    if( !lovValues ) {
        const soaInput = {
            initialData: {
                propertyName : propertyName,
                lovInput: {
                    operationName: 'Create',
                    boName: typeName
                }
            }
        };

        const soaResponse = await soaSvc.postUnchecked( 'Core-2013-05-LOV', 'getInitialLOVValues', soaInput );
        lovValues = cacheLOVValues( soaResponse, typeName, propertyName );
    }
    return lovValues;
};

/**
* Returns the states
* @param {Object} selectedObject uid of the selected object in primary workarea
* @param {String} propName property name
* @param {ObjectArray} listOfValues The array of steps
* @return {ObjectArray} The view model properties for each state
*/
export let getStates = function( selectedObject, propName, listOfValues ) {
    let allLovEntries = [];
    let lovEntries = [];
    let retValue = {
        states:[],
        currState:''
    };
    selectedObject = cdm.getObject( selectedObject.uid );
    // Copy the LOVs & props because the progress widget stores the current property state on the LOV
    // which conflicts with other object's property values
    let states = JSON.parse( JSON.stringify( listOfValues ) );
    if ( selectedObject && selectedObject.type === 'Uml0MLModelRevision' ) {
        let prop = JSON.parse( JSON.stringify( _.get( selectedObject, 'props[' + propName + ']', {} ) ) );
        prop.uiValue = prop.uiValue ? prop.uiValue : _.get( prop, 'uiValues[0]', '' );
        prop.dbValue = prop.dbValue ? prop.dbValue : _.get( prop, 'dbValues[0]', '' );
        prop.propertyDisplayName = prop.uiValue;

        _.forEach( states, ( state ) => {
            if( state.uiValue ) {
                allLovEntries.push( state.uiValue );
            }
        } );

        let beg = 0;
        let end = 0;
        let positions = getBegEndPosition( allLovEntries, prop.uiValue );
        beg = positions[0];
        end = positions[1];

        for ( let j = beg; j <= end; ++j ) {
            lovEntries.push( states[j] );
        }

        retValue.states = lovEntries;
        retValue.currState = prop;
    }
    return retValue;
};

/**
* Returns the array of 1st position, last position and current position
* @param {ObjectArray} allLovEntries The array of steps
* @param {Object} currValue current property value
* @return {ObjectArray} The array of 1st position, last position and current position
*/
function getBegEndPosition( allLovEntries, currValue ) {
    let length = allLovEntries.length;
    let beg = 0;
    let end = length - 1;

    let currentElemPos = -1;
    for ( let k = 0; k < length; ++k ) {
        if ( allLovEntries[k] === currValue ) {
            currentElemPos = k;
            break;
        }
    }

    // Even if page has enough width we show only 6 relevant elements which is computed by below logic
    let maxPosition = 5;
    let halfMaxPosition = Math.floor( maxPosition / 2 );
    if ( end > maxPosition ) {
        // current state is among 1st 3 LOV values then show first 6 elements.
        if ( currentElemPos <= halfMaxPosition ) {
            end = maxPosition;
        } else if ( end - currentElemPos <= halfMaxPosition ) {
            // current state is among last 3 LOV values then show last 3 elements.
            beg = end - maxPosition;
        } else {
            // current state is not any of 3 begin or end states
            // count of initial state to current state is less than or equal to count of end state to current state + 1
            if ( currentElemPos <= end - currentElemPos ) {
                beg = currentElemPos - halfMaxPosition;
                end = currentElemPos + halfMaxPosition + 1;
            } else {
                // count of initial state to current state is more than count of end state to current state + 1
                beg = currentElemPos - halfMaxPosition - 1;
                end = currentElemPos + halfMaxPosition;
            }
        }
    }

    return [ beg, end, currentElemPos ];
}

const exports = {
    loadLOV,
    getStates
};

export default exports;

