// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Psi0PasteProgramRelationCommandHandler
 */
import relService from 'js/Psi0ProgramRelationService';
import ClipboardService from 'js/clipboardService';
import 'js/ProgramScheduleManagerConstants';
import 'soa/kernel/clientDataModel';

var exports = {};

var isValidClipboardContent = function( ctx, includeTypes, copiedObject ) {
    let validTypes = relService.populateValidIncludeTypes( includeTypes, null, ctx );
    includeTypes = validTypes.includeTypes;
    var includeTypesArray = [];
    if( includeTypes ) {
        includeTypesArray = includeTypes.split( ',' );
    }
    for( let index = 0; index < includeTypesArray.length; index++ ) {
        if( copiedObject.modelType.typeHierarchyArray.indexOf( includeTypesArray[ index ] ) > -1 ) {
            return true;
        }
    }
    return false;
};

/**
 * createRelations SOA input data.
 *
 * @param {object} ctx selected view model object
 * @param {object} data the view model data object
 */
export let getCreateInputForPaste = function( ctx, includeTypes ) {
    var input = [];
    var copiedObjects = ClipboardService.instance.getContents();
    for( let index = 0; index < copiedObjects.length; index++ ) {
        var copiedObject = copiedObjects[ index ];
        var isLinkableObject = isValidClipboardContent( ctx, includeTypes, copiedObject );
        if( isLinkableObject ) {
            var inputData = {
                primaryObject: ctx.selected,
                secondaryObject: copiedObject,
                relationType: 'Psi0ProgramRelation',
                clientId: '',
                userData: ''
            };
            input.push( inputData );
        } else {
            throw 'linkObjectErrorMsg';
        }
    }
    return input;
};

export default exports = {
    getCreateInputForPaste
};
