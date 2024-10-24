// Copyright (c) 2022 Siemens

/**
 * @module js/senEndOfLifeService
 */

import cdm from 'soa/kernel/clientDataModel';

/**
 * Method to create the client-only EOL Columns
 */
let setEOLColumns = function( inputEndOfLife ) {
    let awColumnInfos = [];
    let columnNames = [ 'object_name', 'fnd0RevisionId', 'object_desc', 'release_statuses', 'smr0FromDate', 'smr0Duration', 'smr0DurationUnit' ];
    let displayNames = '';
    for ( let itr = 0; itr < columnNames.length; itr++ ) {
        if ( columnNames && inputEndOfLife.props[columnNames[itr]].propertyDescriptor.displayName ) {
            displayNames = inputEndOfLife.props[columnNames[itr]].propertyDescriptor.displayName;
        }
        let pinnedLeft = columnNames[itr] === 'object_name';
        awColumnInfos.push( {
            name: columnNames[itr],
            displayName: displayNames,
            width: 120,
            enableColumnMenu: false,
            enableColumnMoving: false,
            pinnedLeft: pinnedLeft
        } );
    }
    return {
        columnConfig: {
            columns: awColumnInfos
        }
    };
};

let getEOLRevisionListByCreationDate = function( inputEndOfLife ) {
    let endOfLifeOnSelected = [];
    var eolDateArray = [];
    let eolRevisionUidList = cdm.getObjects( inputEndOfLife.props.fnd0SiblingRevisions.dbValues );
    for ( let i = 0; i < eolRevisionUidList.length; i++ ) {
        let uidDateObject = {
            id:eolRevisionUidList[i],
            date:eolRevisionUidList[i].props.creation_date.dbValues[0]
        };
        eolDateArray.push( uidDateObject );
    }
    sortByDate( eolDateArray );
    for ( let index = 0; index < eolDateArray.length; index++ ) {
        endOfLifeOnSelected.push( eolDateArray[index].id );
    }
    return endOfLifeOnSelected;
};
const sortByDate = eolDateArray => {
    const sorter = ( a, b ) => {
        return new Date( b.date ).getTime() - new Date( a.date ).getTime();
    };
    eolDateArray.sort( sorter );
};

export default {
    getEOLRevisionListByCreationDate,
    setEOLColumns
};
