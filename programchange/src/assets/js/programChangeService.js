// Copyright (c) 2022 Siemens

/**
 * @module js/programChangeService
 */
import selectionService from 'js/selection.service';

var exports = {};

export let removeChangeOperation = function() {
    var relationInputs = [];
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var primaryObj = selectionService.getSelection().parent;
        for( var index = 0; index < selection.length; index++ ) {
            relationInputs.push( {
                primaryObject: primaryObj,
                secondaryObject: selection[ index ],
                relationType: 'Pch0PlanChangeRelation'
            } );
        }
    }
    return relationInputs;
};

export default exports = {
    removeChangeOperation
};
