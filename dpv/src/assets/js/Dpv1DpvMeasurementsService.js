// Copyright (c) 2022 Siemens

/**
 * @module js/Dpv1DpvMeasurementsService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import dateTimeService from 'js/dateTimeService';
import soaService from 'soa/kernel/soaService';
import tabRegistrySvc from 'js/tabRegistry.service';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {date} dateObject {String} dateValue - UTC format date.
 * @returns {date} date in UTC format
 */
export let getDateString = function( dateObject ) {
    var dateValue;
    dateValue = dateTimeService.formatUTC( dateObject );
    if( dateValue === '' ) {
        dateValue = dateTimeService.NULLDATE;
    }
    return dateValue;
};


export let updateCriteria = function( searchState,routineId, fromDate, toDate, jsn ) {
    var fromDateVal = exports.getDateString( fromDate.dateApi.dateObject );
    var toDateVal   = exports.getDateString( toDate.dateApi.dateObject );
    var jsnVal = jsn.uiValue;
    var routineId = routineId;
    if( jsnVal ) {
        fromDateVal = '';
        toDateVal   = '';
    }

    let searchData = { ...searchState.value };
    searchData.fromDate = fromDateVal;
    searchData.toDate = toDateVal;
    searchData.jsn = jsnVal;
    searchData.routineId = routineId;
    searchState.update( { ...searchData } );
    var measTab = 'Measurements';

    var tabToSelect = tabRegistrySvc.getVisibleTabs( 'occmgmtContext' ).filter( function( tab ) {
        return tab.name === measTab;
    } )[0];

    tabRegistrySvc.changeTab( 'occmgmtContext', tabToSelect.tabKey );
};

export let initSearchState = function( searchState ) {
    var fromDate = dateTimeService.formatUTC( new Date( new Date().setFullYear( new Date().getFullYear() - 1 ) ) );
    var toDate = dateTimeService.formatUTC( new Date() );
    var routineId = appCtxSvc.ctx.selected.props.awb0ArchetypeId.uiValues[0];
    var jsn = '';

    let searchData = { ...searchState.value };
    searchData.fromDate = fromDate;
    searchData.toDate = toDate;
    searchData.jsn = jsn;
    searchData.routineId = routineId;
    searchState.update( { ...searchData } );
};

export let clearSearchState = function( searchState ) {
    let searchData = { ...searchState.value };
    searchData.fromDate = '';
    searchData.toDate = '';
    searchData.jsn = '';
    searchData.routineId = '';
    searchState.update( { ...searchData } );
};

export let loadMeasurementData = function( plantId, routineId, fromDate, toDate, jsn, defaultTitle ) {
    var deferred = AwPromiseService.instance.defer();
    var outputData = {
        totalFound: 0,
        dpvEvents: [],
        measTitle: defaultTitle
    };

    if( !routineId ) {
        deferred.resolve( outputData );
    }
    var searchCriterion = [];
    var searchCriterionData = {
        clientId:       '1',
        plantId:        plantId,
        routineId:      routineId,
        fromDate:       fromDate,
        toDate:         toDate,
        jsn:            jsn,
        activeInactive: 'ALL'
    };
    searchCriterion.push( searchCriterionData );
    // Call SOA to save the modified data
    soaService.postUnchecked( 'ProductionManagement-2008-03-MeasurementDataQuery', 'queryActiveOrDeactiveData', { searchCriterion } ).then(
        function( response ) {
            if( response && response.events && response.events.length > 0 ) {
                outputData.totalFound = response.events[0].eventsSet.length;
                outputData.dpvEvents = response.events[0].eventsSet;
                var updatedResponse =  _.clone( outputData.dpvEvents );
                processMeasurementResponse( updatedResponse);
                outputData.measTitle = getMeasurementTitle( defaultTitle, outputData.totalFound );
                deferred.resolve( outputData );
            }
            deferred.resolve();
        },
        function( error ) {
            deferred.reject( error );
        } );
    return deferred.promise;
};

function processMeasurementResponse( response ) {
    if ( response){
        _.forEach( response, function( obj ) { 
            //split insertion date time and shift day from shift day           
            //shiftDay:"2024-02-16 00:59:03_2024-02-06 00:00:00"
            const InsertionDateAndShift = obj.shiftDay.split( "_" );
            if( InsertionDateAndShift.length > 0 && InsertionDateAndShift[ 0 ] && InsertionDateAndShift[ 1 ] ) {
                obj.insertionDateTime = InsertionDateAndShift[0];
                const slicedShiftDay = InsertionDateAndShift[1].split(" ");
                if( slicedShiftDay.length > 0 && slicedShiftDay[ 0 ] && slicedShiftDay[ 1 ] ){
                    obj.shiftDay = slicedShiftDay[0];
                }
            }            
        });
    }
}

export const filterRowsWithSort = function( response, sortCriteria ) {
    let measurementData = response.dpvEvents;
    processResponse( measurementData );

    if( sortCriteria && sortCriteria.length > 0 ) {
        let criteria = sortCriteria[ 0 ];
        let sortDirection = criteria.sortDirection;
        let sortColName = criteria.fieldName;

        if( sortDirection === 'ASC' ) {
            measurementData.sort( function( a, b ) {
                if( a.props[ sortColName ].value <= b.props[ sortColName ].value ) {
                    return -1;
                }
                return 1;
            } );
        } else if( sortDirection === 'DESC' ) {
            measurementData.sort( function( a, b ) {
                if( a.props[ sortColName ].value >= b.props[ sortColName ].value ) {
                    return -1;
                }
                return 1;
            } );
        }
    }
    return measurementData;
};

function processResponse( response) {
    let updateResponse = {};
    if ( response) {
        for( var i = 0; i < response.length; i++ ){
            updateResponse = response[i].props;
        }
        response = updateResponse;
    }
}

export let activateDeactiveEvents = function( dataProvider, flag ) {
    var selectedObjects = dataProvider.getSelectedObjects();
    if( selectedObjects.length > 0 ) {
        var targetRows = [];

        for ( var idx = 0; idx < selectedObjects.length; idx++ ) {
            var activeInactive  = flag;
            var plantId         = selectedObjects[idx].props.plantId.value;
            var eventSysId      = selectedObjects[idx].props.eventSysId.value;

            var targetRow = {
                activeInactive: activeInactive,
                plantId: plantId,
                eventSysId: eventSysId
            };
            targetRows.push( targetRow );
        }
        var deferred = AwPromiseService.instance.defer();
        if( targetRows.length > 0 ) {
            // Call SOA to save the modified data
            const promise = soaService.postUnchecked( 'ProductionManagement-2008-03-MeasurementDataEdit', 'activateOrDeactivateData',
                { targetRows } );
            return promise.then( function( ) {
                deferred.resolve();
            } );
        }
        deferred.resolve();

        return deferred.promise;
    }
};

export let refreshMeasTable = function() {
    eventBus.publish( 'measurementsTable.plTable.reload' );
};

function getMeasurementTitle( defaultTitle, totalFound ) {
    let title = defaultTitle;
    if( totalFound > 0 ) {
        title = title + ' (' + totalFound + ')';
    }
    return title;
}

export default exports = {
    getDateString,
    loadMeasurementData,
    filterRowsWithSort,
    activateDeactiveEvents,
    initSearchState,
    clearSearchState,
    updateCriteria,
    refreshMeasTable
};
