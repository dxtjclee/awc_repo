// Copyright (c) 2022 Siemens

/**
 * @module js/Apm0Psi0ChecklistService
 */

import appCtxService from 'js/appCtxService';

var exports = {};

/**
 * Processes the responce of expandGRMRelations and returns list of secondary Objects
 *
 * @param {responce}response responce of expandGRMRelations
 * @returns {List} availableSecondaryObject return list of secondary objects
 */
export let processSecondaryObject = function( response ) {
    var availableSecondaryObject = [];
    if( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
        for( var i in response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
            availableSecondaryObject[ i ] = response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ i ].otherSideObject;
        }
    }

    var search = {};
    search.totalFound = availableSecondaryObject.length;
    search.totalLoaded = availableSecondaryObject.length;
    appCtxService.registerCtx( 'search', search );
    return availableSecondaryObject;
};

export let setRelationContext = function( ctx ) {
    var relationInfo;
    relationInfo = {
        relationInfo: [ {
            primaryObject: ctx.locationContext.modelObject,
            relationObject: null,
            relationType: 'Psi0EventChecklistRelation',
            secondaryObject: ctx.selected
        } ]
    };
    appCtxService.registerCtx( 'relationContext', relationInfo );
};

export default exports = {
    processSecondaryObject,
    setRelationContext
};
