// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Balancing Chips related services
 *
 * @module js/epBalancingLabelsService
 */

import messagingService from 'js/messagingService';
import epTabsService from 'js/epTabsService';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import epTimeUnitsService from 'js/epTimeUnitsService';
import ctxService from 'js/appCtxService';

/**
 * resetOperationsHeader
 * @param {*} operationsTableTitle operationsTableTitle
 * @param {*} operationsTableTitleWithStation operationsTableTitleWithStation
 * @param {*} operationsTableTitleWithStationAndPR operationsTableTitleWithStationAndPR
 * @param {*} station station
 * @param {*} processResource processResource
 * @param {*} unassigned unassigned
 * @param {*} contentPanelData contentPanelData
 * @param {*} tabKey tabKey
 * @returns {Object} new operation header
 */
function resetOperationsHeaderAndSetSelection( operationsTableTitle, operationsTableTitleWithStation, operationsTableTitleWithStationAndPR,
    station, processResource, unassigned, contentPanelData, tabKey ) {
    let text = getOperationTabLabel( operationsTableTitle, operationsTableTitleWithStation, operationsTableTitleWithStationAndPR, station, processResource, unassigned );
    const tabsObjects = epTabsService.setLabelOnTab( contentPanelData, tabKey, text );
    tabsObjects.tabs[ 0 ].station = station;
    tabsObjects.tabs[ 0 ].pr = processResource;
    return tabsObjects;
}

/**
 *
 * @param {String} operationsTableTitle title with no selection
 * @param {String} operationsTableTitleWithStation title with station
 * @param {String} operationsTableTitleWithStationAndPR title with station and process resource
 * @param {ViewModelObject} station station
 * @param {ViewModelObject} processResource process resource
 * @param {Boolean} unassigned is unassigned selected
 * @returns {String} label
 */
function getOperationTabLabel( operationsTableTitle, operationsTableTitleWithStation, operationsTableTitleWithStationAndPR, station, processResource, unassigned ) {
    if( station && station.uid ) {
        let stationName = station.props.bl_rev_object_name.uiValues[ 0 ];
        if( processResource && processResource.uid || unassigned ) {
            let processResourceName = '';
            if( unassigned ) {
                const balancingMessages = localeService.getLoadedText( 'BalancingMessages' );
                processResourceName = balancingMessages.unassigned;
            } else {
                processResourceName = processResource.props.bl_rev_object_name.uiValues[ 0 ];
            }
            return messagingService.applyMessageParamsWithoutContext( operationsTableTitleWithStationAndPR, [ stationName, processResourceName ] );
        }
        // station selected
        return messagingService.applyMessageParamsWithoutContext( operationsTableTitleWithStation, [ stationName ] );
    }
    return operationsTableTitle;
}

/**
 * stringToFloat
 * @param {String} numberString  the string to format
 * @returns {number} formatted string, 2 digits after floating point, no 0 digits
 */
function stringToFloat( numberString ) {
    return parseFloat( parseFloat( numberString ).toFixed( 2 ) );
}

/**
 *
 * @param {Object} vmo  view model object
 * @param {Element} containerElem prent element
 */
function renderProcessResourceName( vmo, containerElem ) {
    // set as read only
    if ( containerElem.parentElement && containerElem.parentElement.prop ) {
        containerElem.parentElement.prop.isEnabled = false;
    }
    if( vmo.props.Mfg0processResource && vmo.props.Mfg0processResource.dbValue !== '' ) {
        const pr = cdm.getObject( vmo.props.Mfg0processResource.dbValue );
        if( pr.props.bl_rev_object_name ) {
            const prName = document.createElement( 'div' );
            prName.innerHTML = pr.props.bl_rev_object_name.uiValues[ 0 ];
            containerElem.appendChild( prName );
        }
    }
}

/**
 *
 * @param {Object} vmo  view model object
 * @param {Element} containerElem prent element
 */
function renderAllocatedTimeUnit( vmo, containerElem ) {
    if( vmo.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrOperation' ) > -1 && vmo.props.Mfg0AllocatedTimeConverted && vmo.props.Mfg0AllocatedTimeConverted.dbValue !== '' ) {
        const allocatedTime = vmo.props.Mfg0AllocatedTimeConverted.dbValue;
        const time = document.createElement( 'div' );
        if( ctxService.getCtx( 'isProductBOPPanelActive' ) ) {
            const unitName = epTimeUnitsService.getCurrentTimeUnitShort();
            const timeCellSeperator = '|';
            time.innerHTML = timeCellSeperator + ' ' + allocatedTime.toString() + ' ' + unitName;
        } else {
            time.innerHTML = vmo.props.Mfg0AllocatedTimeConverted.dbValue;
        }
        containerElem.appendChild( time );
    }
}

export default {
    resetOperationsHeaderAndSetSelection,
    stringToFloat,
    renderProcessResourceName,
    renderAllocatedTimeUnit
};
