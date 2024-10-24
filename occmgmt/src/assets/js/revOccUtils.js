// Copyright (c) 2022 Siemens

/**
 * @module js/revOccUtils
 */
import appCtxService from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import occmgmtTTDataService from 'js/occmgmtTreeTableDataService';


/* This function will return part and usages from selection
 * @return {Object} array of change input
*/
export const getPartAndUsageListFromSelection = function() {
    const changeInput = [];
    const selectedObjects = appCtxService.ctx.mselected;
    _.forEach( selectedObjects, function( selectedObject ) {
        const awb0Archetype = selectedObject.props.awb0Archetype;
        if ( awb0Archetype && awb0Archetype.dbValues.length > 0 && awb0Archetype.dbValues[0] !== null && awb0Archetype.dbValues[0] !== '' ) {
            const partObject = cdmSvc.getObject( awb0Archetype.dbValues[0] );
            changeInput.push( partObject );
        }

        const usg0UsageOccRev = selectedObject.props.usg0UsageOccRev;
        if ( usg0UsageOccRev && usg0UsageOccRev.dbValues.length > 0 && usg0UsageOccRev.dbValues[0] !== null && usg0UsageOccRev.dbValues[0] !== '' ) {
            const puObject = cdmSvc.getObject( usg0UsageOccRev.dbValues[0] );
            changeInput.push( puObject );
        }
    } );
    return changeInput;
};


const revOccPropertyHandler = {
    key: 'revOccProperty',
    callbackFunction: ( overriddenPropertyPolicy ) => {
        _.forEach( overriddenPropertyPolicy.types, function( type ) {
            var properties = [];
            if( type.name === 'Awb0PositionedElement' ) {
                _.forEach( type.properties, function( property ) {
                    if( property.name !== 'usg0UsageOccRev' ) {
                        properties.push( property );
                    }
                } );
                type.properties = properties;
            }
        } );
    },
    condition: ( occContext ) => {
        if( !_.isUndefined( occContext.supportedFeatures ) && occContext.supportedFeatures.Awb0EnableConfigurationPanelFeature &&
        !occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature ) { return true; }
        return false;
    }
};

/**
 * Register the call back function for each and every property which needs to add as a part of overridden property policy.
 */
export let registerHandlerForOverriddenProperties = function( ) {
    occmgmtTTDataService.registerOverriddenPropertyPolicyHandler( revOccPropertyHandler );
};

/* This function will return usages from selection
 * @return {Object} array of change input
*/
export const getUsageListFromSelection = function() {
    const changeInput = [];
    const selectedObjects = appCtxService.ctx.mselected;
    _.forEach( selectedObjects, function( selectedObject ) {
        const usg0UsageOccRev = selectedObject.props.usg0UsageOccRev;
        if ( usg0UsageOccRev && usg0UsageOccRev.dbValues.length > 0 && usg0UsageOccRev.dbValues[0] !== null && usg0UsageOccRev.dbValues[0] !== '' ) {
            const puObject = cdmSvc.getObject( usg0UsageOccRev.dbValues[0] );
            changeInput.push( puObject );
        }
    } );
    return changeInput;
};


const exports = {
    getPartAndUsageListFromSelection,
    registerHandlerForOverriddenProperties,
    getUsageListFromSelection
};

export default exports;
