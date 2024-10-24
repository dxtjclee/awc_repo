// Copyright (c) 2022 Siemens
// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * @module js/tq0SplmUtils
 */
import AwPromiseService from 'js/awPromiseService';
import viewModelObjectService from 'js/viewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
/**
 * Define public API
 */
var exports = {};

//Map of property name and disply value for reference part table in part to inspect table
var _mapOfColPropNameAndDisplayName = new Map();
let initialDataForI18n;
/**
 * This method first gets the qualification records as per the date in the date filter and loads the object
 * @param {object} date - current or the selected date from the date filter
 * @param {object} selected - the selected object contaning the uid for qualification profile when user is in home folder
 * @param {object} pSelected -the selected object contaning the uid for qualification profile
 * @returns {Object} promise
 *
 */
export let loadObjects = function( date, selected, pSelected ) {
    var parentUid = '';
    var timeValue = '23:59:59';
    let tempDate = new Date( date.dateApi.dateObject );

    //calculate the UTC offset from given filter date
    //LCS-542019 - Qualifications Tab : Date Time filter does not pass in client Time Zone hence qualifications are not visible
    let utcOffsetVal = String( tempDate.getTimezoneOffset() );

    //below function is written to convert specific locale date to english as other languages could not fetch QRs from database as data is stored in english
    //LCS-599847 - I18N - Assigned Qualification Unit not visible under Qualification Profile
    let englishDate = formatDateToEnglish( tempDate );


    //to disable the refresh records button once a request to the server is made
    appCtxSvc.updateCtx( 'tq0DisableRefreshQrsButton', true );
    if( isValidTimeFormat( timeValue ) ) {
        if( selected && selected.type === 'Tq0QualificationProfile'  ) {
            parentUid = selected.uid;
        }else{
            parentUid = pSelected.uid;
        }
        var deferred = AwPromiseService.instance.defer();
        var soaInput = {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: ''
            },
            searchInput: {
                maxToLoad: 100,
                maxToReturn: 100,
                providerName: 'Tq0AssignedQUDataProvider',
                searchCriteria: {
                    parentUid: parentUid,
                    startDate: englishDate + ' ' + timeValue,
                    utcOffset: utcOffsetVal
                },
                startIndex: 0,
                searchSortCriteria: []
            }
        };
        var policyId = policySvc.register( {
            types: [ {
                name: 'Tq0QualRecord',
                properties: [ {
                    name : 'tq0AssignmentDate'
                },
                {
                    name : 'tq0DueDate'
                },
                {
                    name : 'tq0ExpiryDate'
                },
                {
                    name : 'tq0ActualCost'
                },
                {
                    name : 'tq0Currency'
                },
                {
                    name : 'tq0ActualDuration'
                },
                {
                    name : 'tq0DurationUnit'
                },
                {
                    name : 'tq0QUnitReference'
                },
                {
                    name : 'Tq0EffectivenssCheck'
                }
                ]
            },
            {
                name:'Tq0QualificationUnit',
                properties:[ {
                    name:'fnd0RevisionId'
                },
                {
                    name: 'object_name'
                } ]
            } ]
        } );
        soaService.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then( function( response ) {
            policySvc.unregister( policyId );
            var responseData;
            var rawAttachmentObjects = JSON.parse( response.searchResultsJSON ).objects;
            var attachmentObjects = rawAttachmentObjects.map( function( obj ) {
                return response.ServiceData.modelObjects[ obj.uid ];
            } );
            var attachmentObjectsWithSecondary = _getSecondaryObjects( attachmentObjects );
            if( attachmentObjectsWithSecondary.length > 0 ) {
                // Convert the loaded model objects into viewmodel objects
                var viewModelObjects = [];
                for( var i = 0; i < attachmentObjectsWithSecondary.length; i++ ) {
                    viewModelObjects[ i ] = viewModelObjectService.constructViewModelObjectFromModelObject( attachmentObjectsWithSecondary[ i ], 'EDIT' );
                }
                attachmentObjectsWithSecondary = viewModelObjects;

                responseData = {
                    searchResults: attachmentObjectsWithSecondary
                };
                deferred.resolve( responseData );
            } else {
                //If there are no qualification records then return an empty list
                responseData = {
                    searchResults: []
                };
                deferred.resolve( responseData );
            }
        }, function( reason ) {
            deferred.reject( reason );
        } );
        return deferred.promise;
    }
};

/**
 *
 * @param {Date} date object passed from client
 * @returns {string} formatted finalDateString
 */
function formatDateToEnglish( date ) {
    let finalDateString;

    let year = new Intl.DateTimeFormat( 'en-US', { year: 'numeric' } ).format( date );
    let month = new Intl.DateTimeFormat( 'en-US', { month: 'short' } ).format( date );
    let day = new Intl.DateTimeFormat( 'en-US', { day: '2-digit' } ).format( date );
    finalDateString =  `${day}-${month}-${year}`;
    return finalDateString;
}


/**  function returns modelObjects
 * @param {Object} attachmentObjects - model objects returned from Tq0AssignedQUDataProvider data provider
 * @returns {viewModelObjects} secondaryObjects - return an object with release status, fnd0RevisionId and qualification record for SPLM table
 **/
function _getSecondaryObjects( attachmentObjects ) {
    var secondaryObjects = [];
    for( var i = 0; i < attachmentObjects.length; i += 3 ) {
        var primaryObject = attachmentObjects[ i + 1 ];
        if( primaryObject ) {
            var propertyDescriptor = {
                anArray: false,
                basedOn: undefined,
                compoundObjType: undefined,
                displayName: 'Reference Object',
                fieldType: undefined,
                lovCategory: 0,
                maxArraySize: -1,
                maxLength: 0,
                minValue: undefined,
                name: 'reference_object',
                propertyType: 2,
                propertyType2: 2,
                valueType: 9,
                constantsMap: {
                    copyFromOriginal: '1',
                    ReferencedTypeName: 'WorkspaceObject',
                    editable: '1',
                    modifiable: '1',
                    displayable: '1'
                }
            };
            var propertyDescriptor_date = {
                anArray: false,
                basedOn: undefined,
                compoundObjType: undefined,
                displayName: 'Status Effective Date',
                fieldType: undefined,
                lovCategory: 0,
                maxArraySize: -1,
                maxLength: 0,
                minValue: undefined,
                name: 'reference_object_date',
                propertyType: 2,
                propertyType2: 2,
                valueType: 9,
                constantsMap: {
                    copyFromOriginal: '1',
                    ReferencedTypeName: 'WorkspaceObject',
                    editable: '1',
                    modifiable: '1',
                    displayable: '1'
                }
            };
            var newProp = {
                dbValues: [ primaryObject.uid ],
                uiValues: [ primaryObject.props.object_name.uiValues[ 0 ] ], //status names like New , Scheduled
                propertyDescriptor: propertyDescriptor
            };
            var newProp_date = {
                uiValues: [ primaryObject.props.date_released.uiValues[0] ], //date_released
                propertyDescriptor: propertyDescriptor_date
            };
            var temp = _.cloneDeep( cdm.getObject( attachmentObjects[ i ].uid ) ); // Cloning the Qualification Record
            var temp2 = _.cloneDeep( cdm.getObject( attachmentObjects[ i + 2 ].uid ) );// Cloning the Qualification unit
            if( temp === null || temp2 === null ) {
                temp = {};
            }else{
                temp.props.reference_object = newProp; // Attaching the Release Status
                temp.props.reference_object_date = newProp_date; // Attaching the Release Status Date
                temp.props.fnd0RevisionId = temp2.props.fnd0RevisionId;//Attaching the Revision Id
            }
            secondaryObjects.push( temp );
        }
    }
    return secondaryObjects;
}

/**
 * Load the column configuration
 * @param {Object} dataprovider - the data
 * @returns {promise} promise.
 */
export let loadTreeTableColumns = function( dataprovider ) {
    var colInfos = [];
    if( _mapOfColPropNameAndDisplayName.size === 0 ) {
        _mapOfColPropNameAndDisplayName.set( 'object_name', initialDataForI18n.tq0QualRecordName );
        _mapOfColPropNameAndDisplayName.set( 'tq0QUnitReference', initialDataForI18n.tq0QualificationUnit );
        _mapOfColPropNameAndDisplayName.set( 'reference_object', initialDataForI18n.tq0QualRecordReleaseStatus );
        _mapOfColPropNameAndDisplayName.set( 'tq0AssignmentDate', initialDataForI18n.tq0QualRecordAssignmentDate );
        _mapOfColPropNameAndDisplayName.set( 'tq0DueDate', initialDataForI18n.tq0QualRecordDueDate );
        _mapOfColPropNameAndDisplayName.set( 'reference_object_date', initialDataForI18n.tq0QualRecordDateReleased );
        _mapOfColPropNameAndDisplayName.set( 'tq0ExpiryDate', initialDataForI18n.tq0QualRecordExpirationDate );
        _mapOfColPropNameAndDisplayName.set( 'tq0ActualCost', initialDataForI18n.tq0QualRecordActualCost );
        _mapOfColPropNameAndDisplayName.set( 'tq0Currency', initialDataForI18n.tq0QualRecordCurrency );
        _mapOfColPropNameAndDisplayName.set( 'tq0ActualDuration', initialDataForI18n.tq0QualRecordActualDuration );
        _mapOfColPropNameAndDisplayName.set( 'tq0DurationUnit', initialDataForI18n.tq0QualRecordActualDurationUnit );
        _mapOfColPropNameAndDisplayName.set( 'Tq0EffectivenssCheck', initialDataForI18n.Tq0QualityAction );
    }
    if( _mapOfColPropNameAndDisplayName.size > 0 ) {
        _mapOfColPropNameAndDisplayName.forEach( function( colPropDisplay, colPropName ) {
            colInfos.push( _getColumnInfoForRespectivePropColumn( colPropName, colPropDisplay ) );
        } );
    }
    dataprovider.columnConfig = {
        columns: colInfos
    };

    var deferred = AwPromiseService.instance.defer();

    deferred.resolve( {
        columnInfos: colInfos
    } );
    return deferred.promise;
};

/**
 *This function returns the column info for respective column property
 * @param {colPropName} colPropName - Property name for the column to be displayed
 * @param {colPropDisplay} colPropDisplay - Display name for the column to be displayed
 * @return {AwTableColumnInfo} column related to the row data created by this service.
 **/
function _getColumnInfoForRespectivePropColumn( colPropName, colPropDisplay ) {
    return {
        name: colPropName,
        typeName: 'Tq0QualRecord',
        displayName: colPropDisplay,
        maxWidth: 600,
        minWidth: 40,
        width: 180,
        enableColumnMenu: true,
        enableColumnMoving: true,
        enableColumnResizing: true,
        enableSorting: false,
        headerTooltip: true
    };
}

/**
 * This function will validate if the time format is correct
 * @param   {string} timeValue - the string value for time that needs to be validated
 * @returns {boolean} - return true if the string input matches the regular expression
 */
function isValidTimeFormat( timeValue ) {
    return  /^([0-1]?[0-9]|2[0-4]):([0-5][0-9]):([0-5][0-9])?$/.test( timeValue );
}

/**
 * Setting the date for the date filter as current date
 *
 * @param   {Object} data data object
 * @returns {viewModelObjects} data viewmodel with updated properties
 */
export let getCurrentDate = function( data ) {
    //initializing the i18n values here since these are not available inside the load column function
    initialDataForI18n = data.i18n;

    //Disable the refresh records button initially
    appCtxSvc.updateCtx( 'tq0DisableRefreshQrsButton', true );

    let dateProps = { ...data.date };
    dateProps.dbValue = new Date();
    return dateProps;
};

/**
 * Setting the date for the date filter as current date
 *
 * @param   {string} seperatorCode string identifying the type of seperator for date. eg 1 for dd/mm/yyy
 * @param   {string} formatCode string defining the format of month. Eg 1 for month like Jan,Feb etc
 * @returns {string} seperatorCode seperator code for seperating the date month and year
 */
function getFormattedDateTime( seperatorCode, formatCode ) {
    var today = new Date();
    var dd = today.getDate();
    var mm = '';
    switch ( formatCode ) {
        case '1':
            mm = today.toLocaleString( 'default', { month: 'short' } ); // mm= Jan for January
            break;
        case '2':
            mm = today.getMonth() + 1; //As January is 0. mm = 0 for January
            break;
        default:
            mm = today.toLocaleString( 'default', { month: 'short' } );
            break;
    }

    var yyyy = today.getFullYear();
    var sp = '';
    switch ( seperatorCode ) {
        case '1':
            sp = '/';
            break;
        case '2':
            sp = '-';
            break;
        default:
            sp = '/';
            break;
    }
    if ( dd < 10 ) { dd = '0' + dd; }
    if ( mm === '2' && mm < 10 ) { mm = '0' + mm; }
    return dd + sp + mm + sp + yyyy;
}

//This will listen to any selections made within the SPLM table and would help in enabling the remove QR button
eventBus.subscribe( 'qualificationRecordsTable.gridSelection', function( eventData ) {
    appCtxSvc.updateCtx( 'selectionArr', eventData.selectedObjects );
    if ( !eventData.notResetSelectionArrForMessage ) {
        appCtxSvc.updateCtx( 'selectionArrForMessage', eventData.selectedObjectstrue );
    }
} );
/**
 * This function will publish an event to referesh the SPLM table once a new QU is assigned to
 * the selected QP
 */
export let publishEventToReloadQrTable = function() {
    eventBus.publish( 'tq0QualificationsTabQuAssigned' );
};

export default exports = {
    loadObjects,
    loadTreeTableColumns,
    publishEventToReloadQrTable,
    getCurrentDate
};
