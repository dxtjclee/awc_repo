// Copyright (c) 2022 Siemens

/**
* @module js/addRevOccService
*/

import addObjectUtils from 'js/addObjectUtils';
import cdmSvc from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

/**
 * Adds Properties and sets Create Input Context
 * @param {Object} data - The view model data
 * @param {Object} subPanelContext - subPanelContext
 */
export let buildOccurrenceCreateInputAndUpdateState = function( data, subPanelContext ) {
    let numberOfObjects = 1;
    // Populates 'numberOfObjects' variable with the number of objects selected in Palette/Search Tab
    if( data.eventData ) {
        numberOfObjects = data.eventData.sourceObjects.length;
    }
    let newAddElementState = { ...subPanelContext.addElementState.value };
    let editHandler = subPanelContext.editHandler;
    if(  subPanelContext.addElementState && data.allowedRevOccTypeInfo.preferredType !== '' ) {
        editHandler = data.editHandlers.addSubPanelEditHandler;
    }
    let createData = [];
    // Populates the create Data Array which will be consumed by "addObject3" SOA as createInputs
    for( let object = 1; object <= numberOfObjects; object++ ) {
        let elementCreateInputs = addObjectUtils.getCreateInput( data, '', data.allowedRevOccTypeInfo.preferredType, editHandler );
        if( numberOfObjects > 1 ) {
            elementCreateInputs[0].createData.compoundCreateInput = {};
        }
        createData.push( elementCreateInputs[0].createData );
    }
    newAddElementState.createData = createData;
    newAddElementState.numberOfElements = subPanelContext.numberOfElements;
    subPanelContext.addElementState.update( newAddElementState );
};

/**
* check if given value is there in the preference values
* @param {Object} preferenceValues This is  name of the preference
* @param {Object} value This the value that to be found out from values in preference.
* @returns {boolean} This function will return true if the value is there in the preference else false
*/
export let preferenceHasValue = function( preferenceValues, value )
{
    if(preferenceValues && preferenceValues.indexOf(value) !== -1)
    {
         return true;
    }
    return false;
};
/**
* Get the Add Part Child/Sibling Panel ID based on different Scenarios
* @param {Object} selectedObject Object currently selected
* @param {Object} childOrSibling Flag to indicate which command Child or Sibling has been clicked
* @returns {Object} Add Part Panel ID of the Panel to show
*/
export let addPartPanelSelection = function( selectedObject, childOrSibling ) {
    // For Partition selection Scenario
    if( selectedObject.modelType.typeHierarchyArray.indexOf( 'Fgf0PartitionElement' ) > -1 && childOrSibling === 'child' ) {
        return 'Awb0AddPartChild';
    }
    let partRevisionPreferences = appCtxService.ctx.preferences.FND0_COLLABORATIVE_PARTREVISION_TYPES;
    let productRevisionPreferences = appCtxService.ctx.preferences.FND0_PRODUCTEBOMREVISION_TYPES;
    let selectedObjectUnderlyingObjType = '';
    let parentUid = '';
    if( selectedObject.props.awb0UnderlyingObjectType !== undefined ) {
        selectedObjectUnderlyingObjType = selectedObject.props.awb0UnderlyingObjectType.dbValues[0];
    }
    if( selectedObject.props.awb0Parent !== undefined ) {
        parentUid = selectedObject.props.awb0Parent.dbValues[0];
    }
    // For Root Object
    if( ( preferenceHasValue(partRevisionPreferences, selectedObjectUnderlyingObjType )  || preferenceHasValue(productRevisionPreferences, selectedObjectUnderlyingObjType ) ) && parentUid === null ) {
        return 'Awb0AddPartChild';
    }
    let parentViewModelObject = cdmSvc.getObject( parentUid );
    let parentObjectType = '';
    let parentUnderlyingObjectType = '';
    if( parentViewModelObject !== null ) {
        parentObjectType = parentViewModelObject.type;
    }
    // For Partition 'awb0UnderlyingObjectType' doesn't get populated in ViewModelObject extracted from cdmSvc
    if(  parentViewModelObject !== null  && parentViewModelObject.props.awb0UnderlyingObjectType !== undefined
        && parentViewModelObject.modelType.typeHierarchyArray.indexOf( 'Fgf0PartitionElement' ) < 0 ) {
        parentUnderlyingObjectType = parentViewModelObject.props.awb0UnderlyingObjectType.dbValues[0];
    }
    if( childOrSibling === 'child' ) {
        // For 2 Scenarios:-
        // 1. Any SMM 1 object - When Selected object is SMM 1 object
        // 2. Workset Scenario - When Selected object is SMM 1 object and parent is 'Workset'
        if( preferenceHasValue(partRevisionPreferences, selectedObjectUnderlyingObjType ) ||
            preferenceHasValue(productRevisionPreferences, selectedObjectUnderlyingObjType ) ||
            ( preferenceHasValue(partRevisionPreferences, selectedObjectUnderlyingObjType ) ||
              preferenceHasValue(productRevisionPreferences, selectedObjectUnderlyingObjType ) ) 
              && parentUnderlyingObjectType === 'Fnd0WorksetRevision' ) {
            return 'Awb0AddPartChild';
        }// For SMM 0 Object

        return'Awb0AddChildElementDeclarative';
    }

    // For 2 Scenarios:-
    // 1. Any SMM 1 object - When Selected object's parent is SMM 1 object
    // 2. Partition Scenario - When Selected object's parent is 'Partition'
    if( preferenceHasValue(partRevisionPreferences, parentUnderlyingObjectType ) || preferenceHasValue(productRevisionPreferences, parentUnderlyingObjectType )
            || parentObjectType === 'Fgf0PartitionElement' ) {
        return 'Awb0AddPartSibling';
    }// For SMM 0 Object

    return 'Awb0AddSiblingElementDeclarative';
};

/**
* Gets the created object from createRelateAndSubmitObjects SOA response. Returns ItemRev if the creation type
* is subtype of Item.
*
* @param {Object} response of createRelateAndSubmitObjects SOA call
* @return {Object} response
*/
export const getCreatedObject = function( response ) {
    return addObjectUtils.getCreatedObjects( response );
};

const exports = {
    getCreatedObject,
    buildOccurrenceCreateInputAndUpdateState,
    addPartPanelSelection
};

export default exports;

