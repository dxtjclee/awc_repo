// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering epBalancingShareProcessResourceService
 *
 * @module js/epBalancingShareProcessResourceService
 */

import localeService from 'js/localeService';
import epTimeUnitsService from 'js/epTimeUnitsService';
import typeDisplayNameService from 'js/typeDisplayName.service';

const messages = localeService.getLoadedText( 'BalancingMessages' );
const timeUnit = epTimeUnitsService.getCurrentTimeUnitShort();

const title = `<span class="sw-guidanceMsg-guideText">${messages.sharePrMessageTitle}</span>`;

/**
 * This function is for message view for assign to another process for selected Operations
 * @param {Object} originalStation - station to  where operations are assigned
 * @param {Object} targetStation - station from where operations are assigned
 * @param {Object} processResource - process Resource to which operation is/ are assigned
 * @param {Object} selectedOperations - selectedOperations
 * @param {Array} selectedOperationsAllocatedTime - total Allocated Time
 * @returns {String} share message
 */
export function formatShareMessage( originalStation, targetStation, processResource, selectedOperations, selectedOperationsAllocatedTime ) {
    if( !originalStation ) {
        return '';
    }

    const numberOfOperations = selectedOperations.length;
    const originalStationName = typeDisplayNameService.instance.getDisplayName( originalStation );
    const time = selectedOperationsAllocatedTime;

    let guidanceMessage = title + ' - ';
    let infoMessage = messages.sharePrMessageInfoSingle;
    if( selectedOperations.length > 1 ) {
        infoMessage = messages.sharePrMessageInfoMultiple;
    }
    infoMessage = infoMessage.format( numberOfOperations, originalStationName, time, timeUnit );
    guidanceMessage += infoMessage;
    guidanceMessage += '<br>';

    if( processResource ) {
        const processResourceName = typeDisplayNameService.instance.getDisplayName( processResource );
        let selectionMessage = messages.sharePrMessageSelectedPr;

        if( processResource.props.mbc0processResourceType.dbValue === 'Machine' || targetStation.uid === originalStation.uid ||
            processResource.props.capacity.dbValue < 100 || processResource.props.elb0allocatedOpsByPV.dbValue.length === 0 ) {
            // invalid process resource
            // if not human OR capacity < 100 OR empty OR same station
            selectionMessage = messages.sharePrMessageInvalidPr;
        }
        guidanceMessage += selectionMessage.format( processResourceName );
    } else {
        guidanceMessage += messages.sharePrMessageInstructions;
    }

    return guidanceMessage;
}

export default {
    formatShareMessage
};
