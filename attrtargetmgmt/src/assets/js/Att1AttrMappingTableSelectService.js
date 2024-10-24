// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Att1AttrMappingTableSelectService
 */
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import attrSvc from 'js/Att1MeasurableAttributeService';

var exports = {};

/**
 *
 * @param {Array} selectedProxyObjects the selected proxy objects
 */
export let proxyListSelection = function( selectedProxyObjects ) {
    var isModifiable = false;
    if( selectedProxyObjects ) {
        for( var idx = 0; idx < selectedProxyObjects.length; ++idx ) {
            var selectedObj = selectedProxyObjects[ idx ];
            if( selectedObj && selectedObj.props && selectedObj.props.att1ContextObject ) {
                var contextObject = cdm.getObject( selectedObj.props.att1ContextObject.dbValue );
                if( contextObject && contextObject.props &&
                    contextObject.props.is_modifiable.dbValues[ 0 ] === '1' ) {
                    isModifiable = true;
                }
            }
        }
    }
    return {
        selectedListAlignmentObjectsModifiable: isModifiable
    };
};

/*
 * Gets the attribute for open cell command
 */
export let getAttributeObject = function( obj ) {
    if( obj.props.att1SourceAttribute ) {
        // set the opened context property, if needed
        attrSvc.checkOpenedContext( obj );

        // return the attribute ID
        var measurableAttrUid = obj.props.att1SourceAttribute.dbValues[ 0 ];
        return cdm.getObject( measurableAttrUid );
    }
};

export default exports = {
    proxyListSelection,
    getAttributeObject
};
