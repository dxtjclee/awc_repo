/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This is a utility for admin services
 *
 * @module js/classifyAdminClassAttrsService
 */

import _ from 'lodash';

var exports = {};


/**
 * Initialize current sec data with the metaData properties in subPanelContext.searchState to be shown in secondary work area for given selection
 * @param {Object} searchState subPanelContext's searchState
 * @param {String} subLocationName sublocation name
 * @returns {Object} result object having SWA data
 */
export let initializeClassAttrsSWA = function( searchState ) {
    let result = {};
    let propertiesSWA = searchState.propertiesSWA;
    let hasProps = propertiesSWA !== undefined && propertiesSWA.currentSecData !== undefined;
    if( hasProps ) {
        result.currentSecData = propertiesSWA.currentSecData;
        result.classAttributes = propertiesSWA.classAttributes;
        result.hasClassAttributes = propertiesSWA.hasClassAttributes;
        result.isGroup = propertiesSWA.isGroup;
        result.referenceLinks = propertiesSWA.referenceLinks;
    }
    return result;
};


export default exports = {
    initializeClassAttrsSWA
};
