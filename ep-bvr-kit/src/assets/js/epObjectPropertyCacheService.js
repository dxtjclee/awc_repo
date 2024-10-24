// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epObjectPropertyCacheService
 *
 * Storing properties in a cache
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';

let propertiesCache = {};
const NOT_FOUND = -1;

/**
 * Will add new properties or update existing ones.In case the value already exists it will be replaced.
 * @param {string} key - the property entry key
 * @param {object[]} properties - the properties to be cached with the key
 */
export function setProperties( key, properties ) {
    if( !propertiesCache[ key ] ) {
        propertiesCache[ key ] = properties;
    } else {
        Object.assign( propertiesCache[ key ], properties );
    }
}
/**
 * Will add a new property or update existing one. Keeping existing values as an array, push new values to it.
 * Triggers cache update event.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 *
 */
export function updateProperty( key, propertyKey, propertyValue ) {
    if( !propertiesCache[ key ] ) {
        propertiesCache[ key ] = {};
    }
    if( propertiesCache[ key ][ propertyKey ] ) {
        const cachePropertyKeyIsArray = Array.isArray( propertiesCache[ key ][ propertyKey ] );
        const propertyValueIsArray = Array.isArray( propertyValue );
        // if property isn't store as array and need to add additional values, need to change value into array
        if( !cachePropertyKeyIsArray ) {
            propertiesCache[ key ][ propertyKey ] = [ propertiesCache[ key ][ propertyKey ] ];
        }
        if( !propertyValueIsArray ) {
            propertyValue = [ propertyValue ];
        }
        propertyValue.forEach( value => addValueToArray( key, propertyKey, value ) );
    } else {
        propertiesCache[ key ][ propertyKey ] = propertyValue;
    }

    eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated' );
}

/**
 * Will add/remove a new property or update existing one. Keeping existing values as an array, push new values to it. Removing missing values from it.
 * Triggers cache update event with added/removed value array.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 * @param {string[]} objUIDsToSelect the new created objects uids
 *
 */
export function updateAndNotifyPropertyChange( key, propertyKey, propertyValue, objUIDsToSelect ) {
    if( !propertiesCache[ key ] ) {
        propertiesCache[ key ] = {};
    }

    let eventData = { key: key, propertyKey: propertyKey };

    // if received property values ain't an array need to change it into array
    propertyValue =  Array.isArray( propertyValue ) ? propertyValue : [ propertyValue ];

    if( propertiesCache[ key ][ propertyKey ] ) {
        let currentPropertyCache = _.clone( propertiesCache[ key ][ propertyKey ] );
        currentPropertyCache.forEach( ( existingValue, index ) => {
            if( !propertyValue.includes( existingValue ) || propertyValue[index] !== existingValue ) {
                removeValueFromArray( key, propertyKey, existingValue, eventData );
            }
        } );
    } else {
        // Initialize the value
        propertiesCache[ key ][ propertyKey ] = [];
    }
    propertyValue.forEach( value => {
        addValueToArray( key, propertyKey, value, eventData );
        addValuesToSelect( objUIDsToSelect, value, eventData );
    } );
    eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated', eventData );
}

/**
 *
 * @param {string[]} objUIDsToSelect the new created objects uids
 * @param {string} propertyValue - the propertyValue Value
 * @param {object} eventData - eventData
 */
function addValuesToSelect( objUIDsToSelect, propertyValue,  eventData ) {
    if( !eventData.valuesToSelect ) { eventData.valuesToSelect = []; }
    objUIDsToSelect.forEach( valueToSelect => {
        if( !eventData.valuesToSelect.includes( valueToSelect ) ) {
            eventData.valuesToSelect.push( valueToSelect );
        }
    } );
}

/**
 * Will remove a property or update existing one. Keeping existing values as an array, removing missing values from it.
 * Triggers cache update event with removed value array.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 *
 */
export function removeAndNotifyPropertyChange( key, propertyKey ) {
    if( !propertiesCache[ key ] ) {
        return;
    }

    if( propertiesCache[ key ][ propertyKey ] ) {
        let eventData = { key: key, propertyKey: propertyKey };
        let currentPropertyCache = _.clone( propertiesCache[ key ][ propertyKey ] );
        currentPropertyCache.map( existingValue => {
            removeValueFromArray( key, propertyKey, existingValue, eventData );
        } );
        eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated', eventData );
    }
}

/**
 * Will add a new SINGLE property or update existing one. In case the value already exists it will be replaced. Triggers cache update event.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 *
 */
export function setProperty( key, propertyKey, propertyValue ) {
    if( !propertiesCache[ key ] ) {
        propertiesCache[ key ] = {};
    }

    propertiesCache[ key ][ propertyKey ] = propertyValue;
    eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated' );
}
/**
 *  Will remove a property value. In case the value not exists it will be ignored.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {object[]} propertyValue - the values to be cached with the key and propertyKey
 *
 */
export function removeProperty( key, propertyKey, propertyValue ) {
    if( !propertiesCache[ key ] || !propertiesCache[ key ][ propertyKey ] || !propertiesCache[ key ][ propertyKey ] ) {
        return;
    }

    const propertyValueIsArray = Array.isArray( propertyValue );
    if( propertyValueIsArray ) {
        propertyValue.forEach( value => removeValueFromArray( key, propertyKey, value ) );
    } else {
        removeValueFromArray( key, propertyKey, propertyValue );
    }
}


/**
 *
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {string} propertyValue - the propertyValue Value
 * @param {object} eventData - eventData
 */
function removeValueFromArray( key, propertyKey, propertyValue, eventData ) {
    const index = propertiesCache[ key ][ propertyKey ].findIndex( value => value === propertyValue );
    if( index > NOT_FOUND ) {
        if( eventData ) {
            if( !eventData.removedValues ) { eventData.removedValues = []; }
            eventData.removedValues.push( propertyValue );
        }
        propertiesCache[ key ][ propertyKey ].splice( index, 1 );
    }
}

/**
 *
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @param {string} propertyValue - the propertyValue Value
 * @param {object} eventData - eventData
 */
function addValueToArray( key, propertyKey, propertyValue, eventData ) {
    if( !propertiesCache[ key ][ propertyKey ].includes( propertyValue ) ) {
        if( eventData ) {
            if( !eventData.addedValues ) { eventData.addedValues = []; }
            eventData.addedValues.push( propertyValue );
        }
        propertiesCache[ key ][ propertyKey ].push( propertyValue );
    }
}

/**
 *
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 * @return {string} Property
 */
export function getProperty( key, propertyKey ) {
    if( propertiesCache[ key ] && propertiesCache[ key ][ propertyKey ] ) {
        return propertiesCache[ key ][ propertyKey ];
    }
    return '';
}

/**
 * @param {string} key - the property entry key
 */
export function clearCache( key ) {
    if( key ) {
        delete propertiesCache[ key ];
    } else {
        propertiesCache = {};
    }
}

/**
 *  Deletes entry of propertykey from cache.
 * @param {string} key - the property entry key
 * @param {string} propertyKey - the propertyKey entry
 */
export function clearPropertyKeyCache( key, propertyKey, stopEvent ) {
    if( key && propertyKey && propertiesCache[ key ] && propertiesCache[ key ][ propertyKey ] ) {
        delete propertiesCache[ key ][ propertyKey ];
        if ( !stopEvent ) {
            eventBus.publish( 'epObjectPropertyCache.' + propertyKey + 'Updated' );
        }
    }
}

export default {
    setProperties,
    updateProperty,
    updateAndNotifyPropertyChange,
    removeAndNotifyPropertyChange,
    removeProperty,
    getProperty,
    clearCache,
    clearPropertyKeyCache,
    setProperty
};
