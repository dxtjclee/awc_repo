
// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import cdm from 'soa/kernel/clientDataModel';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import uwPropertySvc from 'js/uwPropertyService';
import popupSvc from 'js/popupService';
import localeSvc from 'js/localeService';
import ngpLoadSvc from 'js/services/ngpLoadService';

const localizedMessages = localeSvc.getLoadedText( 'NgpDataMgmtMessages' );

/**
 * The ngp assignment mapping service
 *
 * @module js/services/ngpAssignmentMappingService
 */
'use strict';

/**
 * extract data from assignmentMappingFailures response from server, this structure is arranged by process
 * each process has array of data adjust to aw table
 * @param { object } assignmentMappingFailures - the given response with assignment failures
 * @return { object } structure which is needed to show in table per process
 */
export function extractGridDataFromAssignmentMappingFailures( assignmentMappingFailures ) {
    const listOfAssignmnets = assignmentMappingFailures[ 0 ];
    const failedToAssigntoToPurposeMap = assignmentMappingFailures[ 1 ];

    const rowsPerPe = [];
    const pesArray = [];
    const activitiesOfPEs = new Map();
    for( let i = 0; i < listOfAssignmnets.length; i++ ) {
        const assignedObject = cdm.getObject( listOfAssignmnets[ i ].uid );
        const assignmnetName = assignedObject.props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ];
        let parentName = '';
        const parentPropName = ngpModelUtils.getParentPropertyName( assignedObject );
        if( parentPropName.length > 0 && assignedObject.props[ parentPropName ] ) {
            const parent = cdm.getObject( assignedObject.props[ parentPropName ].dbValues[ 0 ] );
            if( parent ) {
                parentName = parent.props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ];
            }
        }

        const assignToNameValues = [];
        const objectsFailToAssignTo = failedToAssigntoToPurposeMap[ i ].assignedToRelationTypesMap[ 0 ];

        const purposeValueObject = {};
        objectsFailToAssignTo.forEach( ( obj ) => {
            const assignToObject = cdm.getObject( obj.uid );
            let assignToName = assignToObject.props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ];
            assignToNameValues.push( assignToName );
            let process = assignToObject;

            if( ngpTypeUtils.isOperation( assignToObject ) ) {
                const parentUid = assignToObject.props[ ngpPropConstants.PARENT_OF_OPERATION ].dbValues[ 0 ];
                process = cdm.getObject( parentUid );
                assignToName = process.props[ ngpPropConstants.OBJECT_STRING ] ? process.props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ] : '';
            }
            if( pesArray.indexOf( assignToName ) < 0 ) {
                pesArray.push( assignToName );
                rowsPerPe[ assignToName ] = [];
                const activityUid = process.props[ ngpPropConstants.PARENT_OF_PROCESS_OR_ME ].dbValues[ 0 ];
                activitiesOfPEs.set( assignToName, activityUid );
            }
        } );
        const purposeValue = failedToAssigntoToPurposeMap[ i ].assignedToRelationTypesMap[ 1 ];
        for( let assignToIndex = 0; assignToIndex < assignToNameValues.length; assignToIndex++ ) {
            purposeValue[ assignToIndex ].forEach( ( purpose ) => {
                const purposeValue = cdm.getObject( purpose.uid ).props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ];
                const assignToObjName = assignToNameValues[ assignToIndex ];

                if( !purposeValueObject[ purposeValue ] ) {
                    purposeValueObject[ purposeValue ] = {
                        assignToArr: [ assignToObjName ],
                        type: 'AssignmentFailure',
                        props: {
                            object: createWrapForTable( assignmnetName, 'object' ),
                            assignedTo: createWrapArrayForTable( [ assignToObjName ], 'assignedTo' ),
                            purpose: createWrapForTable( purposeValue, 'purpose' ),
                            parent: createWrapForTable( parentName, 'parent' )
                        }
                    };
                } else {
                    purposeValueObject[ purposeValue ].assignToArr.push( assignToObjName );
                    purposeValueObject[ purposeValue ].props.assignedTo = createWrapArrayForTable( purposeValueObject[ purposeValue ].assignToArr );
                }

                if ( pesArray.length === 1 ) {
                    rowsPerPe[ pesArray[0] ].push( purposeValueObject[ purposeValue ] );
                    purposeValueObject[ purposeValue ].uid = rowsPerPe[ pesArray[0] ].length;
                } else if( pesArray.indexOf( assignToObjName ) >= 0 && rowsPerPe[ assignToObjName ].indexOf( purposeValueObject[ purposeValue ] ) < 0 ) {
                    rowsPerPe[ assignToObjName ].push( purposeValueObject[ purposeValue ] );
                    purposeValueObject[ purposeValue ].uid = rowsPerPe[ assignToObjName ].length;
                }
            } );
        }
    }
    const tablesInfo = [];

    Object.keys( rowsPerPe ).forEach( ( peName ) =>
        tablesInfo.push( {
            rows: rowsPerPe[ peName ],
            peName: peName,
            activity: activitiesOfPEs.get( peName )
        } )
    );
    return tablesInfo;
}

/**
 * cretae structure for string to show table cell adjust to aw table
 * @param { key } key of the table key
 * @param { name } name column in the table
 * @return { object } structure which adjust to table
 */
function createWrapForTable( key, name ) {
    return uwPropertySvc.createViewModelProperty( name, name, 'STRING', key, [ key ] );
}

/**
 * cretae structure for array to show in table cell adjust to aw table
 * @param { arr } arr of the table key
 * @param { name } name column in the table
 * @return { object } structure which adjust to table
 */
function createWrapArrayForTable( arr, name ) {
    const key = String( arr );
    return createWrapForTable( key, name );
}

/**
 * create formated message acumulate number of failures
 * @param {object} assignmentMappingFailures - aray of rows per pes
 * @param { string } infoString - string that defines action: move or clone
 * @returns { string } - formated message with number of failures
 */
function prepareMessageForTitleNumOfFailures( assignmentMappingFailures, infoString ) {
    let sum = 0;
    assignmentMappingFailures.forEach( pe => sum += pe.rows.length );
    return infoString.format( sum );
}


/**
 * This method shows the dialog with assignment mapping failures report
 * @param { object } assignmentMappingFailures - the given response with assignment failures
 * @param {string} infoString - the string with the information about failures during the action (clone/move)
 */
export function showAssignmentMappingFailureDialog( assignmentMappingFailures, infoString ) {
    const tablesInfo = extractGridDataFromAssignmentMappingFailures( assignmentMappingFailures );
    popupSvc.show( {
        declView: 'NgpAssignmentMappingFailuresDialog',
        options: {
            height: '700',
            width: '1000',
            draggable: true,
            resizable: true,
            clickOutsideToClose: false,
            caption: localizedMessages.failedToMapAssignments
        },
        subPanelContext: {
            tablesInfo,
            infoString
        }
    } );
}

/**
 *
 * @param { object } assignmentMappingFailures - the given response with assignment failures
 */
export function saveAssignmentMappingFailures( assignmentMappingFailures ) {
    let activities = assignmentMappingFailures.map( ( info ) => info.activity );
    ngpLoadSvc.ensureObjectsLoaded( activities ).then( () => {
        let content = '';

        /**
         *
         * @param {String} line - the line to write
         */
        function writeLine( line ) {
            content = content.concat( line + '\n' );
        }

        // write the column headers
        writeLine( [ 'Activity', 'Object', 'Parent', 'Purpose', 'Assigned To' ].join( ',' ) );
        assignmentMappingFailures.forEach( ( info ) => {
            const activityName = cdm.getObject( info.activity ).props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ];
            writeLine( activityName );
            info.rows.forEach( row => writeLine( [ '', row.props.object.dbValue, row.props.parent.dbValue, row.props.purpose.dbValue, row.props.assignedTo.dbValue ].join( ',' ) ) );
        } );
        const link = document.createElement( 'a' );
        const file = new Blob( [ content ], { type: 'text/plain' } );
        link.href = URL.createObjectURL( file );
        link.download = 'assignmentMappingFailures.csv';
        link.click();
        URL.revokeObjectURL( link.href );
    } );
}

let exports;
export default exports = {
    extractGridDataFromAssignmentMappingFailures,
    prepareMessageForTitleNumOfFailures,
    showAssignmentMappingFailureDialog,
    saveAssignmentMappingFailures
};
