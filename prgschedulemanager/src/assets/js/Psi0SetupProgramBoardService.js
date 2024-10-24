// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import psmConstants from 'js/ProgramScheduleManagerConstants';

export let setContextAndObjState = ( setupPrgBoardState, objDataProvider, context ) => {
    let prgBoardState = {
        selectedObjs: objDataProvider.viewModelCollection.loadedVMObjects,
        context: context,
        isPrgBoardActive: true
    };
    setupPrgBoardState.update( { ...setupPrgBoardState.getValue(), ...prgBoardState } );
};

export let initSetupPrgBoardPanel = ( setupPrgBoardState, objDataProvider, contextList, awSelectedObjects, fields ) => {
    objDataProvider.update( setupPrgBoardState.selectedObjs );
    if( setupPrgBoardState.context ) {
        let newContextList = { propInternalValue:setupPrgBoardState.context, propDisplayValue: setupPrgBoardState.context };
        if( fields ) {
            fields.listContext.setLovVal( { lovEntry:newContextList } );
        }
    }
    if( awSelectedObjects ) {
        awSelectedObjects.forEach( ( selectedObj ) => {
            if( selectedObj.levelNdx >= 0 ) {
                addToSetupProgramBoard( objDataProvider, selectedObj, contextList.dbValue );
            }
        } );
    }
};

/**
 * This function will add data to setup program board panel.
 *
 * @param {Object} dataProvider - The data provider for selected objects
 * @param {Object} newObj - The object to be added in data provider
 * @param {Object} context - The context for setup program board panel
 * @param {Object} openedObject - The opened object for timeline
 */
export let addToSetupProgramBoard = function( dataProvider, newObj, context, openedObject ) {
    if( dataProvider && newObj && ( openedObject && newObj.uid !== openedObject.uid || newObj.levelNdx >= 0 ) ) {
        let selectedObj = cdm.getObject( newObj.uid );
        return addToDataProvider( dataProvider, selectedObj, context );
    }
};

/**
 * Add object to data provider.
 *
 * @param {Object} dataProvider - The data provider for selected objects
 * @param {Object} newObj - The object to be added in data provider
 * @param {Object} context - The context for setup program board panel
 */
let addToDataProvider = function( dataProvider, newObj, context ) {
    let isValidObjectType = validateObjectTypeForBoard( newObj, context );
    if( isValidObjectType && isValidObjectType.value ) {
        return isValidObjectType;
    }
    let loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    if( newObj && dataProvider && loadedObjects.length > 0 ) {
        let isValidObjTyp = validateSameObjectTypeInBoard( loadedObjects, newObj, context );
        if( isValidObjTyp && isValidObjTyp.value ) {
            return isValidObjTyp;
        }
    }

    let vmc = dataProvider.viewModelCollection;
    let index = vmc.findViewModelObjectById( newObj.uid );
    if( index <= -1 ) {
        loadedObjects.push( newObj );
        dataProvider.update( loadedObjects );
    } else {
        let vmo = vmc.getViewModelObject( index );
        dataProvider.selectionModel.setSelection( vmo );
    }
    return true;
};

/**
 *  Validates program object type for program board .
 *
 * @param {Object} selectedObject The selected object.
 * @param {String} context The selected context for Program Board
 *
 */
let validateObjectTypeForBoard = function( selectedObject, context ) {
    if(  selectedObject && selectedObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 && ( context && ( context === 'Criteria' || context === 'Checklists' ) )  ||
         selectedObject && selectedObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1  ||
         selectedObject && selectedObject.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1  ) {
        return {
            validObject: psmConstants.VALID_OBJECT_TYPE_FOR_PROGRAM_BOARD.VALID_OBJECTS,
            value : 'invalidSelectionForBoard'
        };
    }
};

/**
 *  Validates program objects type in program board.
 *
 * @param {Object} loadedObjects The loaded Objects.
 * @param {String} context The selected context for Program Board
 *
 */
let validateObjectTypeInBoard = function( loadedObjects, context ) {
    loadedObjects.forEach( function( loadedObject ) {
        if(  loadedObject && loadedObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 && ( context && ( context === 'Criteria' || context === 'Checklists' ) )  ||
             loadedObject && loadedObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1  ||
             loadedObject && loadedObject.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1  ) {
            return {
                validObject: psmConstants.VALID_OBJECT_TYPE_FOR_PROGRAM_BOARD.VALID_OBJECTS,
                value : 'invalidSelectionInBoard'
            };
        }
    } );
};

/**
 *  Validates if Program board contains the same types of object.
 *
 * @param {Object} loadedObjects The loaded Objects.
 * @param {Object} selectedObject The selected object.
 * @param {String} context The selected context for Program Board
 *
 */
let validateSameObjectTypeInBoard = function( loadedObjects, selectedObject, context ) {
    if( context === 'Changes' ) {
        if( selectedObject ) {
            let existingObjType = loadedObjects[ 0 ] && loadedObjects[ 0 ].modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ? 'Prg0AbsPlan' : 'Prg0AbsEvent';
            if( selectedObject.modelType.typeHierarchyArray.indexOf( existingObjType ) < 0 ) {
                return {
                    validObject: loadedObjects[ 0 ].modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ? 'Plan' : 'Event',
                    value : 'invalidSelectionForBoard'
                };
            }
        }
        let isPlan = false;
        let isEvent = false;
        loadedObjects.forEach( function( loadedObject ) {
            if( loadedObject ) {
                if( loadedObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ) {
                    isPlan = true;
                } else if( loadedObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
                    isEvent = true;
                }
                if( isPlan && isEvent ) {
                    return {
                        validObject: loadedObjects[ 0 ].modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ? 'Plan' : 'Event',
                        value : 'invalidSelectionInBoard'
                    };
                }
            }
        } );
    }
};

/**
 * selectionChange Of ListContext.
 *
 * @param {Array} selectedObjects selected objects in Program Board
 * @param {String} context The selected context for Program Board
 */
export let selectionChangeOfContextList = function( selectedObjects, context ) {
    if( selectedObjects && selectedObjects.length > 0 ) {
        let isValidOb = validateObjectTypeInBoard( selectedObjects, context );
        if( isValidOb && isValidOb.value ) {
            return isValidOb;
        }
        let isValidObjTyp = validateSameObjectTypeInBoard(  selectedObjects, context );
        if( isValidObjTyp && isValidObjTyp.value ) {
            return isValidObjTyp;
        }
        return true;
    }
};

/**
 * clears all selected objects from setup program board panel
 *
 * @param {Object} dataProvider The DataProvider for Setup Program Board panel
 */
export let clearSetupProgramBoard = function( dataProvider ) {
    if( dataProvider ) {
        dataProvider.update( [], 0 );
    }
};
/**
 * Method to publish event for removing object from setup program board panel.
 * @param {vmo} The selected view model project
 */
export let publishRemovePrgBoardObject = function( vmo ) {
    if( vmo ) {
        eventBus.publish( 'removeObjFromSetupPrgBoardEvent', vmo );
    }
};

export let removeObjectFromSetupPrgBoard = function( dataProvider, objectToRemove ) {
    if( objectToRemove && objectToRemove.uid && dataProvider ) {
        var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        var updatedobjList = loadedObjects.filter( function( object ) {
            return object.uid !== objectToRemove.uid;
        } );
        dataProvider.update( updatedobjList );
    }
};

let exports;
export default exports = {
    setContextAndObjState,
    initSetupPrgBoardPanel,
    addToSetupProgramBoard,
    selectionChangeOfContextList,
    clearSetupProgramBoard,
    publishRemovePrgBoardObject,
    removeObjectFromSetupPrgBoard
};
