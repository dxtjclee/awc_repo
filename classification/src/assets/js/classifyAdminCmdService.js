// Copyright (c) 2022 Siemens

/**
 * This is a utility to format the response of the getAttributes2 classification SOA to be compatible with the generic
 * property widgets.
 *
 * @module js/classifyAdminCmdService
 */
import _ from 'lodash';

var exports = {};


/**
 * Handles show/hide Properties command in classify panel
 * @param {Object} commandContext - command context
 */
export let showProperties = function( context ) {
    const tmpState = { ...context.value };
    tmpState.showAllProp  = !tmpState.showAllProp;
    context.update( tmpState );
};


export default exports = {
    showProperties
};
