// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering EpBalancingProcessResourceTile
 *
 * @module js/epBalancingProcessResourceTileService
 */

import AwIcon from 'viewmodel/AwIconViewModel';
import epBalancingLabelsService from 'js/epBalancingLabelsService';
import localeService from 'js/localeService';
import epTimeUnitsService from 'js/epTimeUnitsService';

const balancingMessages = localeService.getLoadedText( 'BalancingMessages' );
const timeUnits = epTimeUnitsService.getCurrentTimeUnitShort();

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epBalancingProcessResourceTileRender( props ) {
    let classes = 'aw-epBalancing-processResourceBar';

    const max = props.balancingData.loadedData.maxTimeInLine;
    if( props.vmo.type === 'Mfg0BvrProcessResource' ) {
        if( props.balancingData.selectionData.processResource && props.balancingData.selectionData.processResource.uid === props.vmo.uid ) {
            classes = `${classes} aw-epBalancing-selected`;
        }
        return (
            <div vmouid={props.vmo.uid} className={classes}>
                {renderNameAndCapacityContainer( props.vmo.props )}
                {renderTimeBar( props.vmo.props, max )}
                {renderClockIcon()}
                {renderWorkTime( props.vmo.props )}
            </div>
        );
    }

    if( props.balancingData.loadedData.allProcessResources.length > 0 ) {
        // line has process resources - show unassigned bar
        // TODO need to get the real bar classes and data

        if( props.vmo.props.elb0unassignedOpsByPV.dbValues.length === 0 ) {
            // no unassigned operations
            return null;
        }

        const unassignedTime = props.vmo.props.elb0unassignedTimeByPV.displayValues[ 0 ];
        const placeholderSize = max - parseFloat( unassignedTime );
        classes = `${classes} aw-epBalancing-unassignedBar`;

        if( props.balancingData.selectionData.station && props.balancingData.selectionData.station.uid === props.vmo.uid && props.balancingData.selectionData.unassigned ) {
            classes = `${classes} aw-epBalancing-selected`;
        }
        return (
            <div vmouid={props.vmo.uid} className={classes}>
                <div className='aw-epBalancing-stationTileUnassignedTitle' title={ balancingMessages.unassigned }>{ balancingMessages.unassigned }</div>
                <div className='aw-epBalancing-timeBar'>
                    <div className='aw-epBalancing-stationTileTotalTimeBarUnassignedTime' style={{ flexGrow: unassignedTime }}></div>
                    <div className='aw-epBalancing-stationTileUnassignedBarPlaceholder'></div>
                    <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: placeholderSize }}></div>
                </div>
                {renderClockIcon()}
                <div className='aw-epBalancing-stationTileTotalTimeField' title={ balancingMessages.totalTime + ' ' + epBalancingLabelsService.stringToFloat( unassignedTime ) + ' ' + timeUnits }>{epBalancingLabelsService.stringToFloat( unassignedTime )}</div>
            </div>
        );
    }

    // line dose not have process resources - show station bar
    return (
        <div className={classes}>
            {renderTimeBar( props.vmo.props, max )}
            {renderClockIcon()}
            {renderWorkTime( props.vmo.props )}
        </div>
    );
}

const renderClockIcon = () => {
    return (
        <div className='aw-epBalancing-stationTileClockIcon'>
            <AwIcon iconId='cmdTime'></AwIcon>
        </div>
    );
};

const renderTimeBar = ( vmoProps, max ) => {
    const taktTime = parseFloat( vmoProps.elb0taktTime.dbValues[ 0 ] );
    const workContent = parseFloat( vmoProps.elb0workContentByPV.dbValues[ 0 ] );
    const availableTime = taktTime - workContent;
    const usedTime = workContent > taktTime ? taktTime : workContent;
    const exceedingTime = workContent > taktTime ? workContent - taktTime : 0;
    const availableTimeClass = availableTime < 0 ? 'aw-epBalancing-stationTileTotalTimeBarExceedingTimeValue' : 'aw-epBalancing-stationTileTotalTimeBarAvailableTimeValue';

    const maxTotalTime = parseFloat( max );
    const timeToSubstract = workContent > taktTime ? workContent : taktTime;
    const placeholderSize = maxTotalTime - timeToSubstract;
    return (
        <div className='aw-epBalancing-timeBar' title={ balancingMessages.stationTaktTime + ' ' + taktTime.toFixed( 2 ) + ' ' + timeUnits + ', ' + balancingMessages.availableTime + ' ' + availableTime.toFixed( 2 ) + ' ' + timeUnits }>
            { taktTime > 0 && usedTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarUsedTime' style={{ flexGrow: usedTime }}></div>}
            { availableTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: availableTime }}></div>}
            <div className='aw-epBalancing-stationTileTotalTimeBarCycleTime'></div>
            { exceedingTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarExceedingTime' style={{ flexGrow: exceedingTime }}></div>}
            <div className={availableTimeClass}>{epBalancingLabelsService.stringToFloat( availableTime )}</div>
            {workContent < maxTotalTime && taktTime < maxTotalTime && <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: placeholderSize }}></div>}
        </div>
    );
};

const renderNameAndCapacityContainer = ( vmoProps ) => {
    return (
        <div className='aw-epBalancing-stationTilePrNameAndCapacityContainer' title={'Name: ' + vmoProps.bl_rev_object_name.displayValues[0]}>
            {vmoProps.elb0sharedWithStations.dbValues && vmoProps.elb0sharedWithStations.dbValues.length > 1 && <AwIcon iconId='cmdShare24'></AwIcon>}
            <div className='aw-epBalancing-textEllipses aw-epBalancing-stationTileProcessResourceName'>{vmoProps.bl_rev_object_name.displayValues[0]}</div>
            {vmoProps.capacity.dbValues[0] && vmoProps.capacity.dbValues[0] < 100 && <div className='aw-epBalancing-stationTileProcessResourceCapacity'>{parseInt( vmoProps.capacity.displayValues[0] )}%</div>}
        </div>
    );
};

const renderWorkTime = ( props ) => {
    return (
        <div className='aw-epBalancing-stationTileTotalTimeField' title={ balancingMessages.totalTime + ' ' + props.elb0workContentByPV.displayValues[0] + ' ' + timeUnits }>
            {props.elb0workContentByPV.displayValues[0]}
        </div>
    );
};
