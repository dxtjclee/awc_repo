// Copyright (c) 2022 Siemens
/**
 * @module js/Dpv1ETLHealthService
 */
import appCtxSvc from 'js/appCtxService';
import AwHttpService from 'js/awHttpService';
import AwPromiseService from 'js/awPromiseService';
import browserUtils from 'js/browserUtils';
import dateTimeService from 'js/dateTimeService';
import iconSvc from 'js/iconService';
import _ from 'lodash';
import logger from 'js/logger';
import _localeSvc from 'js/localeService';
var exports = {};

const ETL_FILES_URL = 'tc/micro/dpvservice/etl/operation/dashboard/files';
const DOWNLOAD_URL_PART = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/download?';

export let loadHealthReportData = function( selectedPlants, selectedETLServer, searchInputHealthReport ) {
    var deferred = AwPromiseService.instance.defer();
    var targetResponse = {};
    var plantNames = [];
    if ( selectedPlants && selectedPlants.length > 0 ) {
        _.forEach( selectedPlants, function( selected ) {
            plantNames.push( selected.props.PlantName.displayValues[0] );
        } );
        var $http = AwHttpService.instance;
        var searchCriteriaPost = {
            availability: 95.5,
            plants: plantNames
        };
        var searchInputPost = {
            searchCriteria: searchCriteriaPost,
            MaxToLoad: searchInputHealthReport.maxToLoad,
            MaxToReturn: searchInputHealthReport.maxToReturn,
            cursor: searchInputHealthReport.cursor,
            searchSortCriteria: searchInputHealthReport.searchSortCriteria,
            searchFilterFieldSortType: searchInputHealthReport.searchFilterFieldSortType,
            searchFilterMap6: searchInputHealthReport.searchFilterMap6
        };
        var launchInfoInput = {
            searchInput: searchInputPost
        };
        var totalFound = 0;
        var targetURL = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/healthOverview';
        var postPromise = $http.post( targetURL, launchInfoInput, { headers: { ETLServer: selectedETLServer } } );
        postPromise.then( function( response ) {
            if ( response && response.data && response.data.Data ) {
                totalFound = response.data.Data.totalFound;
                if ( totalFound > 0 ) {
                    targetResponse = _.clone( response.data.Data );
                    processHealthReportResponse( targetResponse );
                }
                deferred.resolve( targetResponse );
            }
        }, function( err ) {
            deferred.reject( err );
        } );
    } else {
        processHealthReportResponse( targetResponse );
        deferred.resolve( targetResponse );
    }
    return deferred.promise;
};

function processHealthReportResponse( response ) {
    let targetResults = [];
    if ( response && response.searchResults ) {
        for ( var idx = 0; idx < response.searchResults.length; idx++ ) {
            var baseHealthInfo = response.searchResults[idx];
            for ( var ind = 0; ind < baseHealthInfo.DeviceOVerview.length; ind++ ) {
                var healthValObj = baseHealthInfo.DeviceOVerview[ind];
                let healthInfoObj = ind > 0 ? _.cloneDeep( baseHealthInfo ) : baseHealthInfo;
                healthInfoObj.DeviceName = healthValObj.DeviceName;
                healthInfoObj.DeviceId = healthValObj.DeviceId;
                healthInfoObj.FailedFiles = healthValObj.FailedFiles;
                healthInfoObj.SuccessFiles = healthValObj.SuccessFiles;
                healthInfoObj.PartialSuccessFiles = healthValObj.PartialSuccessFiles;
                targetResults.push( healthInfoObj );
            }
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.totalFound = targetResults.length;
    response.columnConfig = getHealthReportColumnConfig();
}

function getHealthReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [
            {
                displayName: dpvColCfgBundle.plantName,
                typeName: '',
                propertyName: 'PlantName',
                pixelWidth: 150,
                columnOrder: 100,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.measDeviceId,
                typeName: '',
                propertyName: 'DeviceId',
                pixelWidth: 180,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.measDevice,
                typeName: '',
                propertyName: 'DeviceName',
                pixelWidth: 150,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.filesInFailedFolder,
                typeName: '',
                propertyName: 'FailedFiles',
                pixelWidth: 150,
                columnOrder: 100,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'Integer',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.filesInSuccessFolder,
                typeName: '',
                propertyName: 'SuccessFiles',
                pixelWidth: 150,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'Integer',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.filesInPartialSuccessFolder,
                typeName: '',
                propertyName: 'PartialSuccessFiles',
                pixelWidth: 150,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'Integer',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            }
        ]
    };
}

export let loadFailedFiles = function( searchInput, selectedETLServer ) {
    var deferred = AwPromiseService.instance.defer();

    var launchInfoInput = {
        searchInput : searchInput
    };

    var url = browserUtils.getBaseURL() + ETL_FILES_URL;
    var $http = AwHttpService.instance;
    var postPromise = $http.post( url, launchInfoInput, { headers: { ETLServer: selectedETLServer } } );

    postPromise.then( function( response ) {
        if ( response && response.data && response.data.Data ) {
            var updatedResponse = _.clone( response.data.Data );
            var updatedFailedResponse = processFailedReportResponse( updatedResponse );
            deferred.resolve( updatedFailedResponse );
        } else {
            logger.error( 'Failed Reports : Invalid Response.' );
        }
    }, function( err ) {
        // error message if the ms call's promise is not resolved.
        deferred.reject( err );
    } );
    return deferred.promise;
};

function processFailedReportResponse( response ) {
    let targetResults = [];
    if ( response ) {
        var baseFailedInfo = response.searchResults;
        for ( var ind = 0; ind < baseFailedInfo.DeviceFiles.length; ind++ ) {
            var failedValObj = baseFailedInfo.DeviceFiles[ind];
            let failedInfoObj = ind > 0 ? _.cloneDeep( baseFailedInfo ) : baseFailedInfo;
            failedInfoObj.DataFile = failedValObj.DataFile;
            failedInfoObj.DataFileName = getFilenameFromPath( failedValObj.DataFile );
            failedInfoObj.DMLFile = failedValObj.DMLFile;
            failedInfoObj.DMLFileName = getFilenameFromPath( failedValObj.DMLFile );
            failedInfoObj.ErrorFile = failedValObj.ErrorFile;
            failedInfoObj.ErrorFileName = getFilenameFromPath( failedValObj.ErrorFile );
            failedInfoObj.ProcessedTime = dateTimeService.formatSessionDateTime( failedValObj.ProcessedTime );
            targetResults.push( failedInfoObj );
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.columnConfig = getFailedReportColumnConfig();
    return response;
}

function getFailedReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [
            {
                displayName: dpvColCfgBundle.fileName,
                typeName: '',
                propertyName: 'FileName',
                pixelWidth: 300,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.processTime,
                typeName: '',
                propertyName: 'ProcessTime',
                pixelWidth: 250,
                columnOrder: 250,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            }
        ]
    };
}

export let loadSuccessFiles = function( searchInput, selectedETLServer ) {
    var deferred = AwPromiseService.instance.defer();

    var launchInfoInput = {
        searchInput : searchInput
    };

    var url = browserUtils.getBaseURL() + ETL_FILES_URL;
    var $http = AwHttpService.instance;
    var postPromise = $http.post( url, launchInfoInput, { headers: { ETLServer: selectedETLServer } } );

    postPromise.then( function( response ) {
        if ( response && response.data && response.data.Data ) {
            var updatedResponse = _.clone( response.data.Data );
            var updatedFailedResponse = processSuccessReportResponse( updatedResponse );
            deferred.resolve( updatedFailedResponse );
        } else {
            logger.error( 'Failed Reports : Invalid Response.' );
        }
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

function processSuccessReportResponse( response ) {
    let targetResults = [];
    if ( response ) {
        var baseSuccessInfo = response.searchResults;
        for ( var ind = 0; ind < baseSuccessInfo.DeviceFiles.length; ind++ ) {
            var successValObj = baseSuccessInfo.DeviceFiles[ind];
            let successInfoObj = ind > 0 ? _.cloneDeep( baseSuccessInfo ) : baseSuccessInfo;
            successInfoObj.DataFile = successValObj.DataFile;
            successInfoObj.DataFileName = getFilenameFromPath( successValObj.DataFile );
            successInfoObj.ProcessedTime = dateTimeService.formatSessionDateTime( successValObj.ProcessedTime );
            targetResults.push( successInfoObj );
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.columnConfig = getSuccessReportColumnConfig();
    return response;
}

function getSuccessReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [ {
            displayName: dpvColCfgBundle.fileName,
            typeName: '',
            propertyName: 'FileName',
            pixelWidth: 300,
            columnOrder: 300,
            hiddenFlag: false,
            sortPriority: 0,
            sortDirection: '',
            filterDefinitionKey: '',
            isFilteringEnabled: true,
            dataType: 'String',
            isFrozen: false,
            filterValue: {
                operation: ''
            }
        },
        {
            displayName: dpvColCfgBundle.processTime,
            typeName: '',
            propertyName: 'ProcessTime',
            pixelWidth: 250,
            columnOrder: 250,
            hiddenFlag: false,
            sortPriority: 0,
            sortDirection: '',
            filterDefinitionKey: '',
            isFilteringEnabled: true,
            dataType: 'String',
            isFrozen: false,
            filterValue: {
                operation: ''
            }
        } ]
    };
}

export let loadPartialSuccessFiles = function( searchInput, selectedETLServer ) {
    var deferred = AwPromiseService.instance.defer();

    var launchInfoInput = {
        searchInput : searchInput
    };

    var url = browserUtils.getBaseURL() + ETL_FILES_URL;
    var $http = AwHttpService.instance;
    var postPromise = $http.post( url, launchInfoInput, { headers: { ETLServer: selectedETLServer } } );

    postPromise.then( function( response ) {
        if ( response && response.data && response.data.Data ) {
            var updatedResponse = _.clone( response.data.Data );
            var updatedPartialSuccessResponse = processPartialSuccessReportResponse( updatedResponse );
            deferred.resolve( updatedPartialSuccessResponse );
        } else {
            logger.error( 'Partial Success Reports : Invalid Response.' );
        }
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

function processPartialSuccessReportResponse( response ) {
    let targetResults = [];
    if ( response ) {
        var basePartialSuccessInfo = response.searchResults;
        for ( var ind = 0; ind < basePartialSuccessInfo.DeviceFiles.length; ind++ ) {
            var partialSuccessValObj = basePartialSuccessInfo.DeviceFiles[ind];
            let partialSuccessInfoObj = ind > 0 ? _.cloneDeep( basePartialSuccessInfo ) : basePartialSuccessInfo;
            partialSuccessInfoObj.DataFile = partialSuccessValObj.DataFile;
            partialSuccessInfoObj.DataFileName = getFilenameFromPath( partialSuccessInfoObj.DataFile );
            partialSuccessInfoObj.WarningFile = partialSuccessValObj.WarningFile;
            partialSuccessInfoObj.WarningFileName = getFilenameFromPath( partialSuccessInfoObj.WarningFile );
            partialSuccessInfoObj.ProcessedTime =  dateTimeService.formatSessionDateTime( partialSuccessValObj.ProcessedTime );
            targetResults.push( partialSuccessInfoObj );
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.columnConfig = getPartialSuccessReportColumnConfig();
    return response;
}

function getPartialSuccessReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [
            {
                displayName: dpvColCfgBundle.fileName,
                typeName: '',
                propertyName: 'FileName',
                pixelWidth: 300,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.processTime,
                typeName: '',
                propertyName: 'ProcessTime',
                pixelWidth: 250,
                columnOrder: 250,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            }
        ]
    };
}

export let createFilesPieChart = function( searchState ) {
    var arrayOfSeriesDataForChart = [];

    var keyValueDataForChart = [];
    let countFailed = searchState.healthInfo ? searchState.healthInfo.failedCount : -1;
    let countSuccess = searchState.healthInfo ? searchState.healthInfo.successCount : -1;
    let countPartialSuccess = searchState.healthInfo ? searchState.healthInfo.partialSuccessCount : -1;

    keyValueDataForChart.push( {
        label: '0',
        value: countFailed,
        name: 'Failed',
        y: countFailed
    } );

    keyValueDataForChart.push( {
        label: '1',
        value: countSuccess,
        name: 'Success',
        y: countSuccess
    } );

    keyValueDataForChart.push( {
        label: '2',
        value: countPartialSuccess,
        name: 'Partial Success',
        y: countPartialSuccess
    } );

    arrayOfSeriesDataForChart.push( {
        seriesName: 'Files in Folders',
        keyValueDataForChart: keyValueDataForChart
    } );
    return arrayOfSeriesDataForChart;
};

export const updateSearchResultsWithIcon = ( searchResponse, svgIconFile ) => {
    var schIconName = svgIconFile ? svgIconFile : 'typeFile48.svg';

    var imageIconUrl = iconSvc.getTypeIconFileUrl( schIconName );
    var searchResults = _.clone( searchResponse.searchResults );
    _.forEach( searchResults, function( vmoSch ) {
        vmoSch.thumbnailURL = imageIconUrl;
        vmoSch.hasThumbnail = true;
    } );
    return searchResults;
};

export let updateHealthInfo = function( searchState, gridSelection, dataProvider,selectionModel  ) {
    
    let searchStateData = { ...searchState.value };
    let lastSelectedIndx = -1;
    if(searchStateData.healthInfo.refreshInitiated){
        var lastIndex = searchStateData.healthInfo.lastSelectedRowIndex;
        setRefreshInitiated(searchState, false);
        selectSpecificTableRow(lastIndex,dataProvider);
    }
    else{
        var deviceName = gridSelection.length > 0 ? gridSelection[0].props.DeviceName.dbValue : '';
        var deviceId = gridSelection.length > 0 ? gridSelection[0].props.DeviceId.dbValue : '';
        var plantName = gridSelection.length > 0 ? gridSelection[0].props.PlantName.dbValue : '';
        var fileType = gridSelection.length > 0 ? 0 : -1;
        var failedCount = gridSelection.length > 0 ? gridSelection[0].props.FailedFiles.dbValue : -1;
        var successCount = gridSelection.length > 0 ? gridSelection[0].props.SuccessFiles.dbValue : -1;
        var partialSuccessCount = gridSelection.length > 0 ? gridSelection[0].props.PartialSuccessFiles.dbValue : -1;


        if(gridSelection.length > 0){
            lastSelectedIndx = selectionModel.getSelectedIndex(gridSelection[0]);
        }
        if( searchStateData.healthInfo ) {
            searchStateData.healthInfo.deviceName = deviceName;
            searchStateData.healthInfo.deviceId = deviceId;
            searchStateData.healthInfo.plantName = plantName;
            searchStateData.healthInfo.fileType = fileType;
            searchStateData.healthInfo.failedCount = failedCount;
            searchStateData.healthInfo.successCount = successCount;
            searchStateData.healthInfo.partialSuccessCount = partialSuccessCount;
            searchStateData.healthInfo.selectedFileReports = [];
            searchStateData.healthInfo.lastSelectedRowIndex = lastSelectedIndx;

        } else {
            const healthInfo = {
                deviceName: deviceName,
                deviceId: deviceId,
                plantName: plantName,
                failedCount: failedCount,
                successCount: successCount,
                partialSuccessCount: partialSuccessCount,
                selectedFileReports: [],
                fileType: fileType,
                lastSelectedRowIndex: lastSelectedIndx
            };
            searchStateData.healthInfo = healthInfo;
        }
        searchState.update( { ...searchStateData } );    
    }
};

export let updateFileType = function( searchState, pieSelection ) {
    let searchStateData = { ...searchState.value };
    searchStateData.healthInfo.fileType = pieSelection ? Number( pieSelection.xValue ) : 0;
    searchState.update( { ...searchStateData } );
};

export let openFiles = function( selectedFileReports, selectedETLServer, fileType ) {
    var deferred = AwPromiseService.instance.defer();
    var filePath = '';
    _.forEach( selectedFileReports, function( selectedFile ) {
        filePath = getFilePath( selectedFile, fileType );
        if( filePath ) {
            var url = getDownloadURL( filePath, selectedETLServer );
            window.open( url,  Math.random().toString( 36 ).substring( 2, 10 ) );
        }
    } );
    deferred.resolve( null );
    return deferred.promise;
};

export let openConfigFile = function( vmo ) {
    var deferred = AwPromiseService.instance.defer();
    var url = vmo.props.ConfigurationXML.dbValue;
    window.open( url, '_blank' );
    deferred.resolve( null );
    return deferred.promise;
};

export let updateFileReportInfo = function( data, selectedFileReports, fileType ) {
    let dataCopy = _.cloneDeep( data );
    var numSelected = selectedFileReports ? selectedFileReports.length : 0;
    var hyperlinkText = '';

    if( numSelected === 1 ) {
        hyperlinkText = getFilenameFromPath( selectedFileReports[0].props.DataFile.dbValue );
    } else if ( numSelected > 1 ) {
        hyperlinkText = String( numSelected );
    }
    dataCopy.dataFileLink.displayName = hyperlinkText;
    dataCopy.dataFileLink.uiValue = dataCopy.dataFileLink.displayName;
    dataCopy.dataFileLink.uiValues[0] = dataCopy.dataFileLink.displayName;

    if ( fileType === 0 ) {
        if( numSelected === 1 ) {
            hyperlinkText = getFilenameFromPath( selectedFileReports[0].props.DMLFile.dbValue );
        } else if ( numSelected > 1 ) {
            hyperlinkText = String( numSelected );
        }
        dataCopy.dmlFileLink.displayName = hyperlinkText;
        dataCopy.dmlFileLink.uiValue = dataCopy.dmlFileLink.displayName;
        dataCopy.dmlFileLink.uiValues[0] = dataCopy.dmlFileLink.displayName;
        if( numSelected === 1 ) {
            hyperlinkText = getFilenameFromPath( selectedFileReports[0].props.ErrorFile.dbValue );
        } else if ( numSelected > 1 ) {
            hyperlinkText = String( numSelected );
        }
        dataCopy.errorFileLink.displayName = hyperlinkText;
        dataCopy.errorFileLink.uiValue = dataCopy.errorFileLink.displayName;
        dataCopy.errorFileLink.uiValues[0] = dataCopy.errorFileLink.displayName;
    } else if ( fileType === 2 ) {
        if( numSelected === 1 ) {
            hyperlinkText = getFilenameFromPath( selectedFileReports[0].props.WarningFile.dbValue );
        } else if ( numSelected > 1 ) {
            hyperlinkText = String( numSelected );
        }
        dataCopy.warnFileLink.displayName = hyperlinkText;
        dataCopy.warnFileLink.uiValue = dataCopy.warnFileLink.displayName;
        dataCopy.warnFileLink.uiValues[0] = dataCopy.warnFileLink.displayName;
    }
    return {
        dmlFileLink: dataCopy.dmlFileLink,
        errorFileLink: dataCopy.errorFileLink,
        dataFileLink: dataCopy.dataFileLink,
        warnFileLink: dataCopy.warnFileLink
    };
};

export let updateFileReport = function( selection, searchState ) {
    let searchData = { ...searchState.value };
    searchData.healthInfo.selectedFileReports = selection;
    searchState.update( { ...searchData } );
};

export let selectTableRow = function( healthInfo, dataProvider ) {
    if ( healthInfo && healthInfo.plantName ) {
        var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        var selection = loadedObjects.filter( function( element ) {
            return  element.props.PlantName.dbValue === healthInfo.plantName &&
                element.props.DeviceId.dbValue === healthInfo.deviceId;
        } );
        dataProvider.selectionModel.setSelection( selection );
    }
};

export let setRefreshInitiated = function(searchState, refreshStatus){    
    let searchStateData = { ...searchState.value };
    searchStateData.healthInfo.lastSelectedRowIndex = refreshStatus ? -1 : searchStateData.healthInfo.lastSelectedRowIndex;
    searchStateData.healthInfo.refreshInitiated = refreshStatus;
    searchState.update( { ...searchStateData } ); 
};

function selectSpecificTableRow ( index, dataProvider ) {
    if(index > -1){
        var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        var selection = [loadedObjects[index]];
        dataProvider.selectionModel.setSelection( selection );  
    }
}

export let reprocessFiles = function( selectedFileReports, selectedETLServer ) {
    var deferred = AwPromiseService.instance.defer();
    var targetURL = browserUtils.getBaseURL() + ETL_FILES_URL;

    var filesInfo = [];
    _.forEach( selectedFileReports, function( selectedFile ) {
        filesInfo.push( selectedFile.props.DataFile.dbValue );
    } );

    var $http = AwHttpService.instance;
    var postPromise = $http.put( targetURL, filesInfo, { headers: { ETLServer: selectedETLServer } } );
    postPromise.then( function( response ) {
        deferred.resolve( response );
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

export let deleteFiles = function( selectedFileReports, selectedETLServer ) {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    var targetURL = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/files/delete';

    var filesInfo = [];
    _.forEach( selectedFileReports, function( selectedFile ) {
        filesInfo.push( selectedFile.props.DataFile.dbValue );
    } );

    var postPromise = $http.put( targetURL, filesInfo, { headers: { ETLServer: selectedETLServer } } );
    postPromise.then( function( response ) {
        deferred.resolve( response );
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

export let downloadFiles = function( selectedFileReports, selectedETLServer, fileType ) {
    var deferred = AwPromiseService.instance.defer();
    _.forEach( selectedFileReports, function( selectedFile ) {
        openDataFile( selectedFile, selectedETLServer );
        if ( fileType === 0 ) {
            openDMLFile( selectedFile, selectedETLServer );
            openErrorFile( selectedFile, selectedETLServer );
        } else if ( fileType === 2 ) {
            openWarningFile( selectedFile, selectedETLServer );
        }
    } );
    deferred.resolve();
    return deferred.promise;
};

export let populateError = function( response ) {
    var message = '';
    if ( response.Errors && response.Errors.length > 0 ) {
        message = response.Errors[0];
    }
    return message;
};

export let getFileCount = function( selectedFileReports, fileType ) {
    var fileCount = selectedFileReports ? selectedFileReports.length : 0;
    if ( fileType === 0 ) {
        fileCount *= 3;
    } else if ( fileType === 1 ) {
        fileCount *= 1;
    } else if ( fileType === 2 ) {
        fileCount *= 2;
    }
    return fileCount;
};

export let updateETLFormData = ( healthInfo, parameters ) => {
    let formData = new FormData();
    let fileCount = 0;
    let supFileTypes = appCtxSvc.ctx.preferences.DPV_ETL_upload_supported_file_types;
    let extToCheck = parameters.fileExt;
    if ( supFileTypes && extToCheck && extToCheck.every( v => supFileTypes.includes( v ) ) ) {
    formData.append( 'PlantName', healthInfo.plantName );
    formData.append( 'DeviceId', healthInfo.deviceId );
    formData.append( 'DeviceName', healthInfo.deviceName );
    let fileData = parameters.formData;
        fileCount = fileData && fileData.length > 0 ? fileData.length : 0;
    if( fileData && fileData.length > 0 ) {
        for( var idx = 0; idx < fileData.length; idx++ ) {
            let key = 'file' + ( idx + 1 );
            formData.append( key, fileData[ idx ].file, fileData[ idx ].selectedFile );
            }
        }
    }
    return {
        formData: formData,
        fileCount: fileCount
    };
};

export let initialize = () => {
    let uploadUrl = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/uploadmeasfiles';
    let numFileTypes = appCtxSvc.ctx.preferences.DPV_ETL_upload_supported_file_types ? appCtxSvc.ctx.preferences.DPV_ETL_upload_supported_file_types.length : 0;
    var typeFilter = '.';
    if( numFileTypes > 0 ) {
        for( var idx = 0; idx < numFileTypes; idx++ ) {
            let entry = appCtxSvc.ctx.preferences.DPV_ETL_upload_supported_file_types[ idx ];
            entry = entry.charAt( 0 ) === '.' ? entry.slice( 1 ) : entry;
            typeFilter += entry;
            if( idx < numFileTypes - 1 ) {
                typeFilter += ',.';
            }
        }
    } else {
        // Use default list if pref DPV_ETL_upload_supported_file_types is not found or empty
        typeFilter = '.xml,.csv,.cdi,.dmis,.dml,.dfq,.dmo,.sam,.txt,.b,.cfi';
    }
    return {
        uploadUrl: uploadUrl,
        typeFilter: typeFilter
    };
};

function openDataFile( selectedFile, selectedETLServer ) {
    var filePath = getFilePath( selectedFile, 'data' );
    if( filePath ) {
        var url = getDownloadURL( filePath, selectedETLServer );
        window.open( url,  Math.random().toString( 36 ).substring( 2, 10 ) );
    }
}

function openDMLFile( selectedFile, selectedETLServer ) {
    var filePath = getFilePath( selectedFile, 'dml' );
    if( filePath ) {
        var url = getDownloadURL( filePath, selectedETLServer );
        window.open( url,  Math.random().toString( 36 ).substring( 2, 10 ) );
    }
}

function openErrorFile( selectedFile, selectedETLServer ) {
    var filePath = getFilePath( selectedFile, 'error' );
    if( filePath ) {
        var url = getDownloadURL( filePath, selectedETLServer );
        window.open( url,  Math.random().toString( 36 ).substring( 2, 10 ) );
    }
}

function openWarningFile( selectedFile, selectedETLServer ) {
    var filePath = getFilePath( selectedFile, 'warn' );
    if( filePath ) {
        var url = getDownloadURL( filePath, selectedETLServer );
        window.open( url,  Math.random().toString( 36 ).substring( 2, 10 ) );
    }
}

function getFilenameFromPath( filePath ) {
    var fileName = filePath;
    let lastInd = filePath.lastIndexOf( '/' );
    if( lastInd > -1 ) {
        fileName = fileName.substring( lastInd + 1 );
    }
    return fileName;
}

function getFilePath( selectedFileReport, fileType ) {
    var filePath = '';
    if ( fileType === 'dml' ) {
        filePath = selectedFileReport.props.DMLFile.dbValue;
    } else if ( fileType === 'error' ) {
        filePath = selectedFileReport.props.ErrorFile.dbValue;
    } else if ( fileType === 'warn' ) {
        filePath = selectedFileReport.props.WarningFile.dbValue;
    } else if ( fileType === 'data' ) {
        filePath = selectedFileReport.props.DataFile.dbValue;
    }
    return filePath;
}

function getDownloadURL( filePath, etlServer ) {
    var url = DOWNLOAD_URL_PART;
    url += 'ds=';
    url += filePath;
    url += '&etlserver=';
    url += etlServer;
    return url;
}

export default exports = {
    loadHealthReportData,
    loadFailedFiles,
    loadSuccessFiles,
    loadPartialSuccessFiles,
    createFilesPieChart,
    updateSearchResultsWithIcon,
    updateHealthInfo,
    updateFileType,
    openFiles,
    openConfigFile,
    updateFileReportInfo,
    updateFileReport,
    selectTableRow,
    reprocessFiles,
    deleteFiles,
    downloadFiles,
    populateError,
    getFileCount,
    updateETLFormData,
    initialize,
    setRefreshInitiated
};
