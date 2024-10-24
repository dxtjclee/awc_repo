// Copyright (c) 2022 Siemens

/**
 * @module js/RemoveScheduleService
 */
import _ from 'lodash';

var exports = {};

/**
 * Get the relation Info and prepare the input for SOA.
 *
 * @param {ctx} The context object.
 */
export let getRelationInfo = function( ctx ) {
    var relationInputs = [];
    var relationName;
    var PrimaryObject = ctx.pselected;
    if( PrimaryObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ) {
        relationName = 'Psi0PlanSchedule';
    } else {
        relationName = 'Psi0EventScheduleRelation';
    }
    _.forEach( ctx.mselected, function( selectedObj ) {
        var inputData;
        inputData = {
            primaryObject: PrimaryObject,
            secondaryObject: selectedObj,
            relationType: relationName
        };
        relationInputs.push( inputData );
    } );
    return relationInputs;
};

export default exports = {
    getRelationInfo
};
