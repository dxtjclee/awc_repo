// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * List epListSelection related Service
 *
 * @module js/mfeListSelectionService
 */

import _ from 'lodash';

/**
 * remove list from source and add to target  list
 * @param {*} fields
 */
export function removeFromSrcAndAddToTarget( srcInfo, targetInfo, selectionData ) {
    const selectedVMOs = [ ...srcInfo.list ];
    _.forEach( selectionData, itemToRemove => {
        let index = _.findIndex( selectedVMOs, item => item.uid === itemToRemove.uid );
        selectedVMOs.splice( index, 1 );
    } );

    targetInfo.list = _.uniqWith( [ ...targetInfo.list, ...selectionData ], _.isEqual );

    return {
        availableListInfo: { ...srcInfo, list: selectedVMOs },
        selectedListInfo: { ...targetInfo }
    };
}

/**
 * intialize panel data and returns availableListInfo and selectedListInfo
 * @param {*} props
 * @returns object
 */
export function initializeSelectionPanelData( props ) {
    return {
        availableListInfo: {
            title: props.availableListTitle,
            isListFilterVisible: props.availableListHasFilter,
            list: props.availableList || []
        },
        selectedListInfo: {
            title: props.selectedListTitle,
            isListFilterVisible: props.selectedListHasFilter,
            list: props.selectedList || []
        }
    };
}

/**
 * filter list
 * @param {*} filterString
 * @param {*} pvsList
 * @param {*} startIndex
 * @returns filteredList
 */
function filterList( filterString, list, startIndex ) {
    if( filterString !== '' ) {
        let pagesize = list.length;
        let endIndex = startIndex + pagesize;
        let filteredData = [];
        let pvsNamesMap = {};
        let pvsNames = [];
        list.forEach( function( cc ) {
            const ccName = cc.props.object_string.dbValues[ 0 ];
            pvsNamesMap[ ccName ] = cc;
            pvsNames.push( ccName );
        } );

        const filteredAltNames = pvsNames.filter( function( alt ) {
            return alt.toLowerCase().indexOf( filterString.toLowerCase() ) >= 0;
        } );

        filteredAltNames.forEach( function( ccName ) {
            filteredData.push( pvsNamesMap[ ccName ] );
        } );

        return {
            filteredList: filteredData.slice( startIndex, endIndex )
        };
    }
    return {
        filteredList: list
    };
}

export default {
    initializeSelectionPanelData,
    removeFromSrcAndAddToTarget,
    filterList
};
