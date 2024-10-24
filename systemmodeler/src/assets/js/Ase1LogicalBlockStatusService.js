//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
*/

/**
 * @module js/Ase1LogicalBlockStatusService
 */
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';

const _typeLovValues = {};

const cacheLOVValues = function( soaResponse, objType ) {
    _typeLovValues[ objType ] = soaResponse.lovValues;
    return soaResponse.lovValues;
};

/**
 * Returns the states
 * @param {Object} selectedObj selected object in primary workarea
 * @param {Object} propName property name
 * @return {Object} The view model properties for each state
 */
export let getStates = async function( selectedObj, propName ) {
    let lovValues = _typeLovValues[ selectedObj.type ];
    if( !lovValues ) {
        const soaInput = {
            initialData: {
                propertyName : propName,
                lovInput: {
                    operationName: 'Create',
                    boName: selectedObj.type
                }
            }
        };

        const soaResponse = await soaSvc.postUnchecked( 'Core-2013-05-LOV', 'getInitialLOVValues', soaInput );
        lovValues = cacheLOVValues( soaResponse, selectedObj.type );
    }

    const propDbValue = _.get( selectedObj, 'props[' + propName + '].dbValues[0]' );
    const propUiValue = _.get( selectedObj, 'props[' + propName + '].uiValues[0]' );
    let stepMatched = false;

    const steps = _.map( lovValues, function( state ) {
        const step = {
            propertyDisplayName: _.get( state, 'propDisplayValues.lov_values[0]', '' ),
            uiValue: _.get( state, 'propDisplayValues.lov_values[0]', '' ),
            dbValue: _.get( state, 'propInternalValues.lov_values[0]', '' )
        };

        if( step.dbValue === propDbValue || step.uiValue === propUiValue ) {
            step.isInProgress = true;
            step.isCurrentActive = true;
            stepMatched = true;
        }

        return step;
    } );

    if ( !stepMatched && steps.length > 0 ) {
        steps[0].isInProgress = true;
        steps[0].isCurrentActive = true;
    }
    return steps;
};

const exports = {
    getStates
};
export default exports;
