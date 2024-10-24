// Copyright (c) 2022 Siemens

/**
 * @module js/deleteStudy
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';

var exports = {};

export let removeStudy = function( commandContext ) {
    var studyObjects = [];
    var studyRevisionObjects = [];
    var temp = null;
    appCtxSvc.registerCtx( 'previousSelection', commandContext.openedObject );
    if( commandContext && commandContext.vrSublocationState.mselected[ 0 ] && commandContext.vrSublocationState.mselected[ 0 ].uid && commandContext.pwaSelectionModel ) {
        //When user is deleting element from scope tree table, present on VR's overview page.
        for( var i = 0; i < commandContext.vrSublocationState.mselected.length; i++ ) {
            temp = cdm.getObject( commandContext.vrSublocationState.mselected[ i ].uid );
            studyRevisionObjects.push( temp );
            studyObjects.push( cdm.getObject( temp.props.items_tag.dbValues[ 0 ] ) );
        }
    } else if( commandContext && commandContext.pageContext && commandContext.selectionModel && commandContext.selectionModel.selectionData && commandContext.selectionModel.selectionData.selected &&
        commandContext.selectionModel.selectionData.selected.length > 0 ) {
        //when user is deleting element from Test Iteration table [this is xrt table] present on Trends tab, then as per selection, objects should get deleted from table.
        for( var selectedObjectIndex = 0; selectedObjectIndex < commandContext.selectionModel.selectionData.selected.length; selectedObjectIndex++ ) {
            temp = cdm.getObject( commandContext.selectionModel.selectionData.selected[ selectedObjectIndex ].props.awp0Target.dbValues[ 0 ] );
            studyRevisionObjects.push( temp );
            studyObjects.push( cdm.getObject( temp.props.items_tag.dbValues[ 0 ] ) );
        }
    }
    return {
        studyObjects, studyRevisionObjects
    };
};

/**
  * Remove delected object entry from PWA tree array list
  *
  * @param {object} commandContext  command context information
  * @param {object} data data
  */
export let removeDeletedObjectFromPWATreeList = function(  commandContext, data ) {
    if( data && data.studyRevisionObjects && data.studyRevisionObjects.length > 0 ) {
        let deletedObjects = data.studyRevisionObjects;
        deletedObjects.forEach( function( deletedObject ) {
            if( commandContext.vrSublocationState.pwaTreeElements && commandContext.vrSublocationState.pwaTreeElements.length > 0 ) {
                let pwaTreeElements = commandContext.vrSublocationState.pwaTreeElements;
                let index = pwaTreeElements.findIndex( obj => obj.contentObject.uid === deletedObject.uid );
                if( index >= 0 ) {
                    pwaTreeElements.splice( index, 1 );
                }
            }
        } );
    }
};

/**
 * Returns the deleteStudy instance
 *
 * @member deleteStudy
 */

export default exports = {
    removeStudy,
    removeDeletedObjectFromPWATreeList
};
