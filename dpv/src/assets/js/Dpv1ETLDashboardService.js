// Copyright (c) 2022 Siemens
/**
 * @module js/Dpv1ETLDashboardService
 */
import AwHttpService from 'js/awHttpService';
import AwPromiseService from 'js/awPromiseService';
import browserUtils from 'js/browserUtils';
import iconSvc from 'js/iconService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import logger from 'js/logger';
var exports = {};

export const initSearchState = async( searchStateAtomicDataRef, searchStateUpdater, availableServers, plantNametoIDMap ) => {
    let searchState = searchStateAtomicDataRef.getAtomicData();
    let newSearchstate = searchState ? { ...searchState } : undefined;
    const healthInfo = {
        deviceName: '',
        deviceId: '',
        plantName: '',
        failedCount: -1,
        successCount: -1,
        partialSuccessCount: -1,
        selectedFileReports: [],
        fileType: -1
    };
    const deviceAgentInfo = {
        plantId: '',
        deviceAgent: '',
        plantName: '',
        selectedStatOption: 'hourly',
        showGraph: true
    };
    if( newSearchstate ) {
        newSearchstate.availableETLServers = availableServers;
        newSearchstate.selectedETLServer = availableServers && availableServers.length > 0 ? availableServers[0] : '';
        newSearchstate.plantNametoIDMap = plantNametoIDMap;
        newSearchstate.selectedPlants = [];
        newSearchstate.healthInfo = healthInfo;
        newSearchstate.deviceAgentInfo = deviceAgentInfo;
        searchStateUpdater.searchState( newSearchstate );
    }
};

export let loadAvailablePlants = function() {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    //fetch PlantNames

    var policyJson = {
        types: [
            {
                name: 'MEPrPlantProcessRevision',
                properties: [
                    {
                        name: 'item_id'
                    },
                    {
                        name: 'object_name'
                    }
                ]
            },
            {
                name: 'Mfg0MEPlantBOPRevision',
                properties: [
                    {
                        name: 'item_id'
                    },
                    {
                        name: 'object_name'
                    }
                ]
            }
        ]
    };
    var searchCriteria = {
        Type : 'MEPrPlantProcessRevision;Mfg0MEPlantBOPRevision',
        object_name: '*',
        queryName : 'Item Revision...',
        typeOfSearch : 'ADVANCED_SEARCH',
        lastEndIndex : '',
        OwningUser : '*',
        OwningGroup : '*',
        option : 'allTemplates',
        displayMode: 'Table'
    };
    var inputData = {
        columnConfigInput: '',
        searchInput: {
            maxToLoad: 250,
            maxToReturn: 250,
            providerName: 'Awp0SavedQuerySearchProvider',
            searchCriteria: searchCriteria,
            cursor: {},
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap6: {}
        },
        saveColumnConfigData: null,
        inflateProperties: true
    };
    var plantNametoIDMap = new Map();
    var policyId = propertyPolicySvc.register( policyJson );
    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData ).then(
        function( response ) {
            if ( policyId ) {
                propertyPolicySvc.unregister( policyId );
            }
            if( response.ServiceData.modelObjects ) {
                var modelObjects = response.ServiceData.modelObjects;
                for( var key in modelObjects ) {
                    var modelObject = modelObjects[ key ];
                    if((modelObject.type === 'MEPrPlantProcessRevision' || modelObject.type === 'Mfg0MEPlantBOPRevision') && modelObject.props ) {
                        plantNametoIDMap.set( modelObject.props.object_name.dbValues[0], modelObject.props.item_id.dbValues[0] );
                    }
                }
                deferred.resolve( plantNametoIDMap );
            }
        } );
    return deferred.promise;
};

export let loadETLOverviewData = function( plantNametoIDMap, selectedETLServer, searchInputOverview ) {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    var outputData = {
        totalFound: 0,
        searchResults: []
    };

    var plantNames = plantNametoIDMap && plantNametoIDMap.size > 0 ? Array.from( plantNametoIDMap.keys() ) : [];

    if( plantNames.length > 0 ) {
        var searchCriteriaPost = {
            availability: 95.5,
            plants: plantNames
        };
        var searchInputPost = {
            searchCriteria: searchCriteriaPost,
            MaxToLoad: 250,
            MaxToReturn: 250,
            cursor: searchInputOverview.cursor,
            searchSortCriteria: searchInputOverview.searchSortCriteria,
            searchFilterFieldSortType: searchInputOverview.searchFilterFieldSortType,
            searchFilterMap6: searchInputOverview.searchFilterMap6
        };

        var launchInfoInput = {
            searchInput: searchInputPost
        };
        var totalFound = 0;

        var targetURL = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/overview';
        var postPromise = $http.post( targetURL, launchInfoInput, { headers: { ETLServer: selectedETLServer } } );
        postPromise.then( function( response ) {
            if( response && response.data && response.data.Data ) {
                totalFound = response.data.Data.totalFound;
                if( totalFound > 0 ) {
                    outputData.totalFound = totalFound;
                    outputData.searchResults = updateResultWithPlantId( response.data.Data.searchResults, plantNametoIDMap );
                    deferred.resolve( outputData );
                }
            } else {
                logger.error( 'ELT Dashboard Overview : Invalid Response.' );
            }
        }, function( err ) {
            deferred.reject( err );
        } );
    } else {
        deferred.resolve( outputData );
    }
    return deferred.promise;
};

function updateResultWithPlantId( searchResults, plantNametoIDMap  ) {
    _.forEach( searchResults, function( obj ) {
        obj.PlantId = plantNametoIDMap.get( obj.PlantName );
    } );
    return searchResults;
}

export let updatePlantSelection = function( searchState, selection ) {
    const healthInfo = {
        deviceName: '',
        deviceId: '',
        plantName: '',
        failedCount: -1,
        successCount: -1,
        partialSuccessCount: -1,
        selectedFileReports: [],
        fileType: -1
    };
    const deviceAgentInfo = {
        plantId: '',
        deviceAgent: '',
        plantName: '',
        selectedStatOption: 'hourly',
        showGraph: true
    };
    let searchStateData = { ...searchState.value };
    searchStateData.selectedPlants = selection;
    //reset healthInfo and deviceAgentInfo on plant selection
    searchStateData.healthInfo = healthInfo;
    searchStateData.deviceAgentInfo = deviceAgentInfo;

    searchState.update( { ...searchStateData } );
};

export let selectTableRows = function( selectedPlants, dataProvider ) {
    if ( selectedPlants && selectedPlants.length > 0 ) {
        var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        var selection = [];

        _.forEach( selectedPlants, function( selPlant ) {
            var filteredPlant = loadedObjects.filter( function( vmo ) {
                return vmo.props.PlantId.dbValue === selPlant.props.PlantId.dbValue;
            } );
            selection.push.apply( selection, filteredPlant );
        } );
        dataProvider.selectionModel.setSelection( selection );
    }
};

export let createFilesPieChart = function( selectedPlants ) {
    var arrayOfSeriesDataForChart = [];

    var keyValueDataForChart = [];
    let countFailed = -1;
    let countSuccess = -1;
    let countPartialSuccess = -1;

    if( selectedPlants && selectedPlants.length > 0 ) {
        countFailed = 0;
        countSuccess = 0;
        countPartialSuccess = 0;

        _.forEach( selectedPlants, function( plant ) {
            countFailed += plant.props.FailedFiles.dbValue;
            countSuccess += plant.props.SuccessFiles.dbValue;
            countPartialSuccess += plant.props.PartialSuccessFiles.dbValue;
        } );
    }

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

export function getValueInViewModel( value ) {
    return value;
}

export const updateSearchResultsWithIcon = ( searchResponse, svgIconFile ) => {
    var schIconName = svgIconFile ? svgIconFile : 'typeReportDefinition48.svg';

    var imageIconUrl = iconSvc.getTypeIconFileUrl( schIconName );
    var searchResults = _.clone( searchResponse.searchResults );
    _.forEach( searchResults, function( vmoSch ) {
        vmoSch.thumbnailURL = imageIconUrl;
        vmoSch.hasThumbnail = true;
    } );
    return searchResults;
};

export function loadETLServerList() {
    var deferred = AwPromiseService.instance.defer();

    var url = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/servers';
    var $http = AwHttpService.instance;
    var postPromise = $http.get( url );
    var availableServers = [];
    postPromise.then( function( response ) {
        if ( response && response.data && response.data.length > 0 ) {
            availableServers = response.data;
        }
        deferred.resolve( availableServers );
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
}

export const populateETLServerList = ( availableETLServers ) => {
    var entries = [];
    _.forEach( availableETLServers, function( hostName ) {
        entries.push( {
            propDisplayValue: hostName,
            dispValue: hostName,
            propInternalValue: hostName
        } );
    } );

    return {
        totalFound: entries.length,
        etlServerList: entries
    };
};

export let selectETLServer = function( etlServerVal, searchState ) {
    let searchStateData = { ...searchState.value };
    searchStateData.selectedETLServer = etlServerVal;

    searchState.update( { ...searchStateData } );
};

export let showETLServerVal = function( etlServer, selectedETLServer ) {
    var etlServerTemp = _.clone( etlServer );
    etlServerTemp.uiValue = selectedETLServer;
    etlServerTemp.dbValue = selectedETLServer;
    return {
        etlServer : etlServerTemp
    };
};

export default exports = {
    initSearchState,
    loadAvailablePlants,
    loadETLOverviewData,
    updatePlantSelection,
    selectTableRows,
    createFilesPieChart,
    getValueInViewModel,
    updateSearchResultsWithIcon,
    loadETLServerList,
    populateETLServerList,
    selectETLServer,
    showETLServerVal
};
