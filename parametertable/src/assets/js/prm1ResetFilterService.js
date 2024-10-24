// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 *
 *
 * @module js/prm1ResetFilterService
 */
import eventBus from 'js/eventBus';

'use strict';

var exports = {};
/**
 * method to publish reset filter event
 */
export let resetFilter = function() {
    eventBus.publish( "Prm1ResetFilter", {} );
};

export default exports = {
    resetFilter
};
