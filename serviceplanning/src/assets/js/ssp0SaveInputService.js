// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/ssp0SaveInputService
 */

import _ from 'lodash';


export default class SaveInput {
    constructor() {
        this.sections = {};
        this.relatedObjects = {};
        this.prepareNameToValuesMap = prepareNameToValuesMap.bind( this );
    }

    addEntryToSection( sectionName, entry ) {
        let section = this.sections[ sectionName ];
        if( !section ) {
            section = {
                sectionName: sectionName,
                dataEntries: []
            };
            this.sections[ sectionName ] = section;
        }

        section.dataEntries.push( { entry } );
    }

    addRelatedObjects( objects ) {
        _.forEach( objects, object => {
            this.relatedObjects[ object.uid ] = {

                uid: object.uid,
                type: object.type
            };
        } );
    }

    addIgnoreReadOnlyMode() {
        this.ignoreReadOnlyMode = true;
    }

    addPredecessor( predecessorInfo, isFlowInput = 'false' ) {
        if( predecessorInfo ) {
            const successorObjMap = prepareNameToValuesMap( {
                id: predecessorInfo.objectId
            } );
            const predecessorObjMap = prepareNameToValuesMap( {
                Add: predecessorInfo.predecessorId,
                isFlowInput: isFlowInput
            } );
            const entry = {
                Object: successorObjMap,
                Predecessors: predecessorObjMap
            };
            this.addEntryToSection( 'ObjectsToModify', entry );
        }
    }

    addSuccessor( successorInfo, isFlowInput = 'false' ) {
        if( successorInfo ) {
            const objMap = prepareNameToValuesMap( {
                id: successorInfo.objectId
            } );

            const predMap = prepareNameToValuesMap( {
                Add: successorInfo.successorId,
                isFlowInput: isFlowInput
            } );
            const entry = {
                Object: objMap,
                Successors: predMap
            };
            this.addEntryToSection(  'ObjectsToModify', entry );
        }
    }

    deleteFlow( flowObject, isFlowInput = 'false' ) {
        if( flowObject ) {
            const successorObjMap = prepareNameToValuesMap( {
                id: flowObject.toId
            } );
            const predecessorObjMap = prepareNameToValuesMap( {
                Remove: flowObject.fromId,
                isFlowInput: isFlowInput
            } );
            const entry = {
                Object: successorObjMap,
                Predecessors: predecessorObjMap
            };
            this.addEntryToSection(  'ObjectsToModify', entry );
        }
    }
}


/**
 * @param { Object } properties properties
 * @returns { Object } nameValueMap
 */
function prepareNameToValuesMap( properties ) {
    const nameToValuesMap = {};

    _.forOwn( properties, function( value, key ) {
        if( Array.isArray( value ) ) {
            nameToValuesMap[ key ] = value;
        } else {
            nameToValuesMap[ key ] = [ value ];
        }
    } );
    return { nameToValuesMap };
}
