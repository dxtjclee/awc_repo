// Copyright (c) 2021 Siemens

/*global
 */

/**
 * Service for secondary view in Architecture tab
 *
 * @module js/Ase0ArchitectureSecondaryViewService
 */
import conditionService from 'js/conditionService';
import contributionService from 'js/contribution.service';
import _ from 'lodash';

let _contributingSplitPanels = null;

/**
 * Get contributing panels
 *
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
let populateContributedSecondaryPanels = async function() {
    if( !_contributingSplitPanels ) {
        //Get all of the command providers
        let providers = await contributionService.loadContributions( 'archModelerSecondaryPanelKey' );
        if( providers && providers.length > 0 ) {
            let splitPanels = providers.map( function( panel, index ) {
                return {
                    selectedPanel: false,
                    visible: true,
                    panelIndex: index,
                    priority: panel.priority,
                    condition: panel.condition,
                    splitPanelId: panel.splitPanelId,
                    id: panel.id
                };
            } );

            if( splitPanels ) {
                _contributingSplitPanels = splitPanels;
            }
        }
    }
    return _contributingSplitPanels;
};

/**
 * Evaluate conditions for all given panels and return the one with valid condition and highest priority
 * @param {Array} commandContext command context
 * @param {Array} ctx application context
 * @returns {Object} active split panel
 */
export let getActiveSpiltPanel = async function( commandContext, ctx ) {
    const contributingSplitPanels = await populateContributedSecondaryPanels();
    let activeSplitPanel;
    if( contributingSplitPanels ) {
        _.forEach( contributingSplitPanels, function( panel ) {
            if( panel.condition && typeof panel.condition === 'string' ) {
                let isConditionTrue = conditionService.evaluateCondition( {
                    ctx: ctx,
                    commandContext:commandContext
                }, panel.condition );
                if( isConditionTrue && ( !activeSplitPanel || panel.priority < activeSplitPanel.priority ) ) {
                    activeSplitPanel = panel;
                }
            }
        } );
    }
    const activeSplitPanelID = activeSplitPanel?.splitPanelId;
    return {
        activeSplitPanelID : activeSplitPanelID
    };
};

/**
 * Clearing secondary selection when secondary panel unloaded
 *
 * @param {Object} secondarySelection secondary selections
 */
export let clearSelection = function( secondarySelection ) {
    if( !_.isEmpty( secondarySelection ) && !_.isEmpty( secondarySelection.selected ) ) {
        const secondarySelectionData = { ...secondarySelection.value };
        secondarySelectionData.selected = [];
        secondarySelectionData.clearSelection = true;
        secondarySelection.update && secondarySelection.update( secondarySelectionData );
    }
};

const exports = {
    getActiveSpiltPanel,
    clearSelection
};

export default exports;
