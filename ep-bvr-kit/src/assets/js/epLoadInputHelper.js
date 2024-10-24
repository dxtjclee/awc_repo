// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import epSessionService from 'js/epSessionService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import AwStateService from 'js/awStateService';

/**
 * @module js/epLoadInputHelper
 */


/**
 * function accepts loadTypeInputs for creating inputs data for SOA call
 * @param {array,String} loadType
 * @param {array,string} objectUid
 * @param {array} propertiesToLoad
 * @param {string} targetUid
 * @param {array} additionalLoadParams
 */
export const getLoadTypeInputs = function( loadType, objectUid, propertiesToLoad, targetUid, additionalLoadParams ) {
    const loadTypeInputs = [];

    //  fix for multiple load types input
    if( _.isArray( loadType ) ) {
        _.forEach( loadType, function( type ) {
            loadTypeInputs.push( getLoadTypeInput( type, objectUid, propertiesToLoad, targetUid, additionalLoadParams ) );
        } );
    } else {
        loadTypeInputs.push( getLoadTypeInput( loadType, objectUid, propertiesToLoad, targetUid, additionalLoadParams ) );
    }

    return loadTypeInputs;
};

const getLoadInput = function( tagName, attributeName, vmObject ) {
    let attributeValue;

    switch ( tagName ) {
        case epLoadConstants.CHECK_TYPE:
            attributeValue = vmObject.checkType;
            break;

        case epLoadConstants.CURRENT_SCOPE:
            attributeValue = vmObject.currentScope.uid;
            break;

        case epLoadConstants.SOURCE_OBJECT:
            attributeValue = vmObject.sourceObject.uid;
            break;

        case epLoadConstants.TARGET_OBJECT:
            attributeValue = vmObject.targetObject.uid;
            break;

        default:
            break;
    }

    return {
        tagName: tagName,
        attributeName: attributeName,
        attributeValue: attributeValue
    };
};

const getLoadTypeInput = function( loadType, objectUid, propertiesToLoad, targetUid, additionalLoadParams ) {
    const loadTypeInput = {
        loadType
    };
    if( Array.isArray( objectUid ) ) {
        loadTypeInput.objectsToLoad = objectUid;
    } else {
        if( objectUid ) {
            loadTypeInput.objectsToLoad = [ objectUid ];
        }
    }

    if( targetUid ) {
        loadTypeInput.targetObject = targetUid;
    }

    if( propertiesToLoad ) {
        loadTypeInput.loadParameters = [];
        for( let index in propertiesToLoad ) {
            loadTypeInput.loadParameters.push( {
                tagName: 'propertiesToLoad',
                attributeName: 'propertyName',
                attributeValue: propertiesToLoad[ index ]
            } );
        }
    }
    if( additionalLoadParams ) {
        loadTypeInput.additionalLoadParams = [];
        additionalLoadParams.forEach( parameter => {
            loadTypeInput.additionalLoadParams.push( parameter );
        } );
    }

    return loadTypeInput;
};

/**
 * Function adds 'sections' part to existing loadInputType array
 * @param {array} loadTypeInputs
 */
export const getLoadInputJSON = ( loadTypeInputs ) => ( {
    sections: [ getObjectsToLoadSection( loadTypeInputs ), epSessionService.getSessionSection( null, AwStateService.instance.params.tracking_cn, AwStateService.instance.params.impacting_cn ) ]
} );

/**
 * Function internally calls getObjectsToLoadSection for adding 'objectsToLoadSection' in existing loadInputType array
 * @param {array} loadTypeInputs
 */
export const getReloadInputJSON = ( loadTypeInputs ) => getObjectsToLoadSection( loadTypeInputs );

const getObjectsToLoadSection = function( loadTypeInputs ) {
    if( Array.isArray( loadTypeInputs ) && !_.isEmpty( loadTypeInputs ) ) {
        const objectsToLoadSection = {
            sectionName: 'objectsToLoad',
            dataEntries: []
        };

        _.forEach( loadTypeInputs, function( loadTypeInput ) {
            objectsToLoadSection.dataEntries.push( {
                entry: getEntryObjectForLoadType( loadTypeInput )
            } );
        } );

        return objectsToLoadSection;
    }
};

const getEntryObjectForLoadType = function( loadTypeInput ) {
    const entry = {
        typeToLoad: {
            nameToValuesMap: {
                loadType: [ loadTypeInput.loadType ]
            }
        }
    };

    if( loadTypeInput.checkType ) {
        entry.checkType = {
            nameToValuesMap: {
                type: [ loadTypeInput.checkType ]
            }
        };
    }

    if( loadTypeInput.objectsToLoad && Array.isArray( loadTypeInput.objectsToLoad ) &&
        !_.isEmpty( loadTypeInput.objectsToLoad ) ) {
        entry.objectToLoad = {
            nameToValuesMap: {
                objectUid: loadTypeInput.objectsToLoad
            }
        };
    }

    if( loadTypeInput.sourceObject ) {
        entry.sourceObject = {
            nameToValuesMap: {
                objectUid: [ loadTypeInput.sourceObject ]
            }
        };
    }

    if( loadTypeInput.targetObject ) {
        entry.targetObject = {
            nameToValuesMap: {
                objectUid: [ loadTypeInput.targetObject ]
            }
        };
    }

    if( loadTypeInput.searchCriteria ) {
        entry.searchCriteria = {
            nameToValuesMap: {
                searchScopeUID: [ loadTypeInput.searchCriteria.productBop ],
                searchObjectType: [ loadTypeInput.searchCriteria.searchObjectType ],
                searchString: [ loadTypeInput.searchCriteria.searchString ]
            }
        };
    }

    if( loadTypeInput.loadParameters ) {
        _.forEach( loadTypeInput.loadParameters, function( loadParameter ) {
            if( entry[ loadParameter.tagName ] ) {
                entry[ loadParameter.tagName ].nameToValuesMap[ loadParameter.attributeName ].push( loadParameter.attributeValue );
            } else {
                const nameToValuesMap = {};
                nameToValuesMap[ loadParameter.attributeName ] = [ loadParameter.attributeValue ];
                entry[ loadParameter.tagName ] = {
                    nameToValuesMap: nameToValuesMap
                };
            }
        } );
    }
    if( loadTypeInput.additionalLoadParams ) {
        loadTypeInput.additionalLoadParams.forEach( parameter => {
            if( entry[ parameter.tagName ] ) {
                if( !entry[ parameter.tagName ].nameToValuesMap[ parameter.attributeName ] ) {
                    entry[ parameter.tagName ].nameToValuesMap[ parameter.attributeName ] = [];
                }
                if( Array.isArray( parameter.attributeValue ) ) {
                    entry[ parameter.tagName ].nameToValuesMap[ parameter.attributeName ].push( ...parameter.attributeValue );
                } else{
                    entry[ parameter.tagName ].nameToValuesMap[ parameter.attributeName ].push( parameter.attributeValue );
                }
            } else {
                const nameToValuesMap = {};
                if( Array.isArray( parameter.attributeValue ) ) {
                    nameToValuesMap[parameter.attributeName ] = parameter.attributeValue;
                } else {
                    nameToValuesMap[parameter.attributeName ] = [ parameter.attributeValue ];
                }
                entry[ parameter.tagName ] = {
                    nameToValuesMap: nameToValuesMap
                };
            }
        } );
    }

    return entry;
};

let exports = {};
export default exports = {
    getLoadTypeInputs,
    getLoadInputJSON,
    getReloadInputJSON,
    getLoadInput
};
