// Copyright (c) 2022 Siemens

/**
 * @module js/setPreferenceService
 */
import soaSvc from 'soa/kernel/soaService';

var exports = {};

/**
 * Set preference.
 * 
 * @param {setPreferencesAtLocations} inputs - Object of setPreferencesAtLocations type
 */
export let setPreferencesAtLocations = function( inputs ) {
    soaSvc.post( 'Administration-2012-09-PreferenceManagement', 'setPreferencesAtLocations', inputs );
};

/**
 * Set preference.
 * 
 * @param {setPreferencesAtLocations} inputs - Object of setPreferencesAtLocations type
 */
export let setPreferencesDefinition = function( inputs ) {
    soaSvc.post( 'Administration-2012-09-PreferenceManagement', 'setPreferencesDefinition', inputs );
};

/**
 * setPreferenceService service utility
 */

export default exports = {
    setPreferencesAtLocations,
    setPreferencesDefinition
};
