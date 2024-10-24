// Copyright (c) 2022 Siemens

/**
 * @module js/prgPlanningEventChangeService
 */
import selectionService from 'js/selection.service';

var exports = {};

export let removeEventChangeOperation = function() {
    var relationInputs = [];
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var primaryObj = selectionService.getSelection().parent;
        for( var index = 0; index < selection.length; index++ ) {
            relationInputs.push( {
                primaryObject: primaryObj,
                secondaryObject: selection[ index ],
                relationType: 'Pec0EventChangeRelation'
            } );
        }
    }
    return relationInputs;
};

export default exports = {
    removeEventChangeOperation
};
