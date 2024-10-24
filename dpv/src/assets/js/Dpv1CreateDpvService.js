// Copyright (c) 2022 Siemens

/**
 * @module js/Dpv1CreateDpvService
 */
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import mesgSvc from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import _localeSvc from 'js/localeService';

var exports = {};

export let loadDatabaseKeys = function() {
    var deferred = AwPromiseService.instance.defer();
    var resource = 'DpvMessages';
    var localTextBundle = _localeSvc.getLoadedText( resource );
    let databaseMsg = localTextBundle.database;
    let serverMsg = localTextBundle.serverString;
    let userMsg = localTextBundle.user;
    let noDataMsg = localTextBundle.noDataError;
    let totalFound = 0;
    let outputData;
    var measurementDatabaseMap = new Map();
    // Call SOA to save the modified data
    soaService.postUnchecked( 'Internal-ProductionManagement-2017-11-MeasurementDataQuery', 'getMeasurementDatabaseDetails', {} ).then(
        function( response ) {
            if( response && response.measurementDatabaseSet && response.measurementDatabaseSet.length > 0 ) {
                totalFound = response.measurementDatabaseSet.length;
                for( let idx = 0; idx < response.measurementDatabaseSet.length; idx++ ) {
                    var mapKey = response.measurementDatabaseSet[idx].databaseKey;
                    var mapVal = databaseMsg + ':' + response.measurementDatabaseSet[idx].databaseName + '  ' +
                                 serverMsg + ':' + response.measurementDatabaseSet[idx].hostName + '  ' +
                                 userMsg + ':' + response.measurementDatabaseSet[idx].databaseUsername;

                    measurementDatabaseMap.set( mapKey, mapVal );
                }
                if( measurementDatabaseMap.size > 0 ) {
                    var databaseKeysListProps = [];
                    measurementDatabaseMap.forEach( function( value, key ) {
                        databaseKeysListProps.push( {
                            propDisplayValue: key,
                            propInternalValue: key,
                            propDisplayDescription: value
                        } );
                    } );
                }
                if( totalFound > 0 ) {
                    outputData = {
                        totalFound: totalFound,
                        databaseKeysList: databaseKeysListProps
                    };
                    deferred.resolve( outputData );
                } else {
                    mesgSvc.showWarning( noDataMsg );
                }
            }else {
                mesgSvc.showWarning( noDataMsg );
            }
            deferred.resolve();
        },
        function( error ) {
            mesgSvc.showError( error.message );
            deferred.reject( error );
        } );
    return deferred.promise;
};

export let addMeasurementData = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var resource = 'DpvMessages';
    var localTextBundle = _localeSvc.getLoadedText( resource );
    let databaseLocatorMsg = localTextBundle.databaseLocatorMessage;
    let linkLocatorMessageMsg = localTextBundle.linkLocatorMessage;
    let noSchemaErrorMsg = localTextBundle.noSchemaError;
    if( data ) {
        var inputData = {
            dbKey:          data.databaseKey.dbValue,
            dbName:         data.databaseName.dbValue,
            targetDbType:   data.databaseTypeList.dbValue,
            serverName:     data.server.dbValue,
            userName:       data.username.dbValue,
            password:       data.password.dbValue
        };
        soaService.postUnchecked( 'Internal-ProductionManagement-2018-06-MeasurementDataLoad', 'populateLinkLocatorTable', inputData ).then(
            function( response ) {
                if( response ) {
                    if ( response.partialErrors ) {
                        mesgSvc.showError( linkLocatorMessageMsg );
                    }else{
                        mesgSvc.showInfo( databaseLocatorMsg );
                    }
                }
                deferred.resolve();
            },
            function( error ) {
                mesgSvc.showError( noSchemaErrorMsg );
                mesgSvc.showError( error.message );
                deferred.reject( error );
            } );
    }
    return deferred.promise;
};

export let assignPlant = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var resource = 'DpvMessages';
    var localTextBundle = _localeSvc.getLoadedText( resource );
    let assignPlantMsg = localTextBundle.assignPlantMessage;

    if( data ) {
        let plantUid = appCtxSvc.ctx.mselected[0].props.items_tag.dbValues;
        let inputPlantId = data.plantId.dbValue;
        var plantIdAndUid = inputPlantId + ':' + plantUid;

        var inputData = {
            plantId:plantIdAndUid,
            dbKey:data.databaseKeyList.dbValue
        };
        soaService.postUnchecked( 'Internal-ProductionManagement-2018-06-MeasurementDataLoad', 'populateDBLocatorTable', inputData ).then(
            function( response ) {
                if( response ) {
                    mesgSvc.showInfo( assignPlantMsg );
                }
                deferred.resolve();
            },
            function( error ) {
                mesgSvc.showError( error.message );
                deferred.reject( error );
            } );
    }
    return deferred.promise;
};

export default exports = {
    loadDatabaseKeys,
    addMeasurementData,
    assignPlant
};
