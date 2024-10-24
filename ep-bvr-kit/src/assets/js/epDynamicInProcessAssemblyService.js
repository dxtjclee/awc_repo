// Copyright (c) 2022 Siemens

/**
 * Service for DIPA
 *
 * @module js/epDynamicInProcessAssemblyService
 */
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import awPromiseSvc from 'js/awPromiseService';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
/**
 * This method creates DIPA for selected station.
 * @param { string } inputObject : selected Station
 * @returns {promise} : promise
 */
function createDIPA( inputObject, sharedSelectionData ) {
    const awPromise = awPromiseSvc.instance;
    const saveInputWriter = saveInputWriterService.get();
    saveInputWriter.createDIPA( inputObject.uid );

    return epSaveService.saveChanges( saveInputWriter, true, [ inputObject ] ).then( () => {
        mfeViewModelUtils.mergeValueInAtomicData( sharedSelectionData, { isTreeDataLoaded: 'true' } );
        return awPromise.resolve();
    } );
}

/**
 * This method creates DIPA for selected station.
 * @param { string } inputObject : selected Station
 * @param {*} sharedSelectionData: SelectionData
 * @returns {promise} : promise
 */
function updateDIPA( inputObject, sharedSelectionData ) {
    const saveInputWriter = saveInputWriterService.get();
    const awPromise = awPromiseSvc.instance;
    saveInputWriter.updateDIPA( inputObject.uid );

    return epSaveService.saveChanges( saveInputWriter, true, [ inputObject ] ).then( () => {
        // need to manually set the value to false first to trigger the observer function so that it will make load call.
        mfeViewModelUtils.mergeValueInAtomicData( sharedSelectionData, {
            isTreeDataLoaded: 'false'
        } );
        mfeViewModelUtils.mergeValueInAtomicData( sharedSelectionData, {
            isTreeDataLoaded: 'true'
        } );

        return awPromise.resolve();
    } );
}
let exports;
export default exports = {
    updateDIPA,
    createDIPA
};
