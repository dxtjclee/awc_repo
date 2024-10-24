// Copyright (c) 2022 Siemens

import _ from 'lodash';
import awGanttConfigService from 'js/AwGanttConfigurationService';

const getComputedTimelineRowHeight = () => {
    let sampleRowEl = document.querySelectorAll( '#planNavigationTree .aw-splm-tablePinnedContainer .aw-splm-tableRow' )[ 0 ];

    // Get computed border bottom width as it changes with browser zoom level.
    let borderBottomWidth = sampleRowEl ? parseFloat( window.getComputedStyle( sampleRowEl ).getPropertyValue( 'border-bottom-width' ) ) : awGanttConfigService.TABLE_ROW_BORDER_BOTTOM_WIDTH;

    return awGanttConfigService.getDefaultRowHeight() + borderBottomWidth + awGanttConfigService.TABLE_ROW_MARGIN;
};

export const updateTimelineRowHeight = ( atomicDataRef ) => {
    const ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( ganttInstance ) {
        resetTimelineRowHeight( ganttInstance );
    }
};

const resetTimelineRowHeight = ( ganttInstance ) => {
    if( ganttInstance ) {
        let rowHeight = getComputedTimelineRowHeight( );

        if( ganttInstance.config.row_height !== rowHeight ) {
            ganttInstance.config.row_height = rowHeight;
            ganttInstance.config.bar_height = 'full';
            ganttInstance.render();
        }
    }
};

export const debounceResetTimelineRowHeight = _.debounce( ( ganttInstance ) => {
    resetTimelineRowHeight( ganttInstance );
}, 500 );

export default {
    updateTimelineRowHeight,
    debounceResetTimelineRowHeight
};
