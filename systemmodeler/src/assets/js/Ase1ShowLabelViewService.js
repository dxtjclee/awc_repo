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
 * @module js/Ase1ShowLabelViewService
 */

import _ from 'lodash';

/**
 * create a string array of display names of label property
 * @param {Object} labelPropertiesMap label properties map
 * @returns {Array} list of labels
 */
export let populateLabelList = function( labelPropertiesMap ) {
    if( !labelPropertiesMap || labelPropertiesMap.length <= 0 ) {
        return;
    }

    return _.map( labelPropertiesMap, function( value, key ) {
        return {
            propDisplayValue: value,
            propInternalValue: key,
            propDisplayDescription: ''
        };
    } );
};

const exports = {
    populateLabelList
};

export default exports;
