// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import $ from 'jquery';

const BALANCING_SELECTION_KEY = 'ep.balancingPageSelection.';

/**
 * @module js/epBalancingSelectionService
 */

/**
 * updateSelection
 *
 * @param {*} balancingData balancing data - atomic data for updating selection
 * @param {*} station clicked station
 * @param {*} processResource clicked process resource
 */
export function updateSelection( balancingData, station, processResource ) {
    const updatedBalancingData = { ...balancingData.getValue() };
    if( updatedBalancingData.selectionData.station ) {
        // reset previous selection
        updatedBalancingData.selectionData.operation = null;
        updatedBalancingData.selectionData.pendingOperation = null;
        updatedBalancingData.selectionData.processResource = null;
        updatedBalancingData.selectionData.unassigned = false;
    }

    // select the station
    updatedBalancingData.selectionData.station = station;
    updatedBalancingData.selectionData.station.selected = true;
    // select the process resource / unassigned
    if( processResource ) {
        if( station.uid === processResource.uid ) {
            if( balancingData.loadedData.allProcessResources.length > 0 ) {
                // selected object is same station uid and the line has process resources- unassigned bar
                updatedBalancingData.selectionData.unassigned = true;
            }
            // else - station bar in station mode, do nothing
        } else {
            // process resource
            updatedBalancingData.selectionData.processResource = processResource;
        }
    }

    balancingData.update( updatedBalancingData );
}

/**
 * saveSelectionToLocalStorage
 * @param {*} balancingData balancing data atomic data
 * @param {*} contextUid line uid
 */
export function saveSelectionToLocalStorage( balancingData, contextUid ) {
    const selection = {};
    selection.stationUid = balancingData.selectionData.station?.uid;
    selection.processResourceUid = balancingData.selectionData.processResource?.uid;
    selection.unassigned = Boolean( balancingData.selectionData.unassigned );
    localStorage.setItem( getBalancingSelectionKey( contextUid ), JSON.stringify( selection ) );
}

/**
 * loadSelectionFromLocalStorage
 * @param {*} balancingData balancing data atomic data
 * @param {*} contextUid line uid
 */
export function loadSelectionFromLocalStorage( balancingData, contextUid ) {
    const selectionString = localStorage.getItem( getBalancingSelectionKey( contextUid ) );
    if( selectionString && !_.isEmpty( balancingData.loadedData.balancingStations ) ) {
        const selection = JSON.parse( selectionString );
        // if there is previous station selection
        if( selection.stationUid ) {
            const station = _.find( balancingData.loadedData.balancingStations, station => station.uid === selection.stationUid );
            // if the station is in the list of stations (could be deleted)
            if( station ) {
                const updatedBalancingData = { ...balancingData.getValue() };
                updatedBalancingData.selectionData.station = station;
                // if there is previous process Resource selection
                if ( selection.unassigned && station.props.elb0unassignedOpsByPV.dbValues.length > 0 ) {
                    updatedBalancingData.selectionData.unassigned = true;
                } else if( selection.processResourceUid ) {
                    const processResourceInstances = _.find( balancingData.loadedData.allProcessResources, processResourceData =>
                        Boolean( _.find( processResourceData.instances, instance => instance.uid === selection.processResourceUid ) ) );
                    // if the process Resource is in the list of all process Resources (could be deleted)
                    if( processResourceInstances ) {
                        const stationIndex = _.findIndex( processResourceInstances.stations, sharedStation => sharedStation.uid === station.uid );
                        updatedBalancingData.selectionData.processResource = processResourceInstances.instances[ stationIndex ];
                    }
                }

                balancingData.update( updatedBalancingData );
            }
        }
    }
}

/**
 * getBalancingSelectionKey - for local storage
 * @param {*} contextUid uid of the line
 * @returns {String} local storage key
 */
function getBalancingSelectionKey( contextUid ) {
    return BALANCING_SELECTION_KEY + contextUid;
}

/**
 * scrollIntoSelectedStation
 * @param {*} balancingStations all stations
 * @param {*} selectedStation selected station
 */
export function scrollIntoSelectedStation( balancingStations, selectedStation ) {
    const stationIndex = _.findIndex( balancingStations, station => station.uid === selectedStation.uid );
    const stationElement = $( '.aw-epBalancing-singleStationTile' ).eq( stationIndex ).get( 0 );
    const stationListScrollElement = $( '.aw-epBalancing-singleStationTile' ).closest( '.aw-base-scrollPanel' ).get( 0 );
    const listTop = stationListScrollElement.getBoundingClientRect().top;
    const listBottom = stationListScrollElement.getBoundingClientRect().bottom;
    const stationTop = stationElement.getBoundingClientRect().top;
    const stationHeight = stationElement.getBoundingClientRect().height;
    if ( stationTop - listTop < 0 || stationTop + stationHeight > listBottom ) {
        stationElement.scrollIntoView( { behavior: 'smooth', block: 'end', inline: 'nearest' } );
    }
}

export default {
    saveSelectionToLocalStorage,
    loadSelectionFromLocalStorage,
    updateSelection,
    scrollIntoSelectedStation
};
