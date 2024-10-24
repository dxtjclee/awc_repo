// Copyright (c) 2022 Siemens

/**
 * @module js/Evm1SeedSelectionCmdPanelService
 */
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

/** This method is used add the selected objects from the ADD command panel
 * @param {object} sourceObjects the selected objects in add panel
 */
export let addSeedSelection = function( sourceObjects ) {
    let seedsToAdd = [];
    if( sourceObjects ) {
        for( let i = 0; i < sourceObjects.length; i++ ) {
            if( sourceObjects[ i ].modelType && !cmm.isInstanceOf( 'Fnd0SearchRecipe', sourceObjects[ i ].modelType ) ) {
                seedsToAdd.push( sourceObjects[ i ] );
            }
        }
    }
    return seedsToAdd;
};

export default exports = {
    addSeedSelection
};
