// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering epBalancingProcessResourceTilesListService
 *
 * @module js/epBalancingProcessResourceTilesListService
 */

import EpBalancingProcessResourceTile from 'viewmodel/EpBalancingProcessResourceTileViewModel';
import epBalancingSelectionService from 'js/epBalancingSelectionService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epBalancingProcessResourceTilesListRender( props ) {
    return (
        <div className='sw-row w-12'>
            <div className='sw-column w-12 aw-epBalancing-processResourceTileList'>
                {props.viewModel.processResources.map( item => renderProcessResource( item, props ) )}
            </div>
        </div>
    );
}

const onProcessResourceClick = ( e, item, props ) => {
    e.stopPropagation();
    epBalancingSelectionService.updateSelection( props.balancingData, props.vmo, item );
};

const renderProcessResource = ( item, props ) => {
    return (
        <div className='sw-row aw-epBalancing-processResourceTile' key={item.uid} onKeyPress={e => onProcessResourceClick( e, item, props )}
            onClick={e => onProcessResourceClick( e, item, props )} role='button' tabIndex='0'>
            <EpBalancingProcessResourceTile vmo={item} balancingData={props.balancingData}/>
        </div>
    );
};

/**
 * checkIfProcessResourceWasDeleted
 * @param {*} station station
 * @param {*} eventData add/remove event data
 * @returns {Boolean} true if the remove was for pr in above station
 */
export function checkIfProcessResourceWasDeleted( station, eventData ) {
    return eventData.Mfg0processResources && eventData.Mfg0processResources.eventObjectUid === station.uid && eventData.Mfg0processResources.relatedEvents.delete;
}

/**
 * updateSelectionOfUnassigned
 * unassigned is selected and there are no unassigned operations, select station
 * If process resource was added, select it
 * @param {Object} balancingData balancingData
 * @param {ViewModelObject} station station
 */
export function updateSelectionOfUnassigned( balancingData, station ) {
    if( balancingData.selectionData.unassigned && _.isEmpty( station.props.elb0unassignedOpsByPV.dbValues ) ) {
        epBalancingSelectionService.updateSelection( balancingData, station );
    }
}

export default {
    epBalancingProcessResourceTilesListRender,
    checkIfProcessResourceWasDeleted,
    updateSelectionOfUnassigned
};
