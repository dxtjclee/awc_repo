// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering EpBalancingStationTile
 *
 * @module js/epBalancingStationTileService
 */

import EpBalancingProcessResourceTilesList from 'viewmodel/EpBalancingProcessResourceTilesListViewModel';
import epBalancingSelectionService from 'js/epBalancingSelectionService';
import AwCommandBar from 'viewmodel/AwCommandBarViewModel';
import AwIcon from 'viewmodel/AwIconViewModel';

/**
 * epBalancingStationTileRender
 *
 * Although rendering could be done in html file, We have to render with React
 * This is because we need the click event on the tile to stop propagating to the parent (station)
 * And it cannot be done with aw-click component (this component somehow overrides the default propagation)
 *
 * @param {*} props component props
 * @returns {JSX} render
 */
export function epBalancingStationTileRender( { vmo, balancingData, viewModel, i18n } ) {
    const problematicClass = balancingData.loadedData.problematicStations[ vmo.uid ] ? 'aw-epBalancing-problematicStation' : '';
    const selectedClass = balancingData.selectionData.station && balancingData.selectionData.station.uid === vmo.uid ? 'aw-epBalancing-selected' : '';
    const className = `sw-column w-12 aw-epBalancing-singleStationTile ${problematicClass} ${selectedClass}`;
    return (
        <div vmouid={vmo.uid} className={className} onKeyPress={() => onStationClicked( balancingData, vmo )}
            onClick={() => onStationClicked( balancingData, vmo )} role='button' tabIndex='0'>

            <div className='aw-epBalancing-cycleTimeStationHeader'
                title={vmo.props.bl_rev_object_name.displayValues[0] + ' - ' + i18n.cycleTimeChip + ' ' + viewModel.data.stationCycleTime + ' ' + viewModel.data.timeUnits}>
                <div className='aw-epBalancing-textEllipses'>{vmo.props.bl_rev_object_name.displayValues[0]}</div>
                <div className='aw-epBalancing-stationTileClockIcon'>
                    <AwIcon iconId='cmdTime'></AwIcon>
                </div>
                <div>{viewModel.data.stationCycleTime}</div>
                <AwCommandBar anchor='LB_StationTile' context={{ vmo: vmo, balancingData: balancingData }}></AwCommandBar>
            </div>

            <EpBalancingProcessResourceTilesList vmo={vmo} balancingData={balancingData}/>
        </div>
    );
}

const onStationClicked = ( balancingData, station ) => {
    epBalancingSelectionService.updateSelection( balancingData, station );
};

export default {
    epBalancingStationTileRender
};
