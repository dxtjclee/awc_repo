// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Balancing related services
 *
 * @module js/epBalancingService
 */

import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import AwPromiseService from 'js/awPromiseService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import cdm from 'soa/kernel/clientDataModel';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import _ from 'lodash';
import listBoxSvc from 'js/listBoxService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import popupService from 'js/popupService';
import { renderComponent } from 'js/declReactUtils';
import { includeComponent } from 'js/moduleLoader';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import epTableService from 'js/epTableService';
import epTableCellRenderer from 'js/epTableCellRenderer';

let cachedOperationsList = [];
let policyId = null;


const policy = {
    types: [ {
        name: 'Mfg0BvrProcessStation',
        properties: [ { name: 'bl_parent' },
            {
                name: 'Mfg0processResources',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            { name: 'elb0cycleTime' },
            { name: 'elb0unassignedTimeByPV' },
            {
                name: 'elb0unassignedOpsByPV',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            { name: 'mbc0CommentText' },
            { name: 'elb0taktTime' },
            { name: 'elb0workContentByPV' }
        ]
    }, {
        name: 'Mfg0BvrProcessResource',
        properties: [ { name: 'bl_parent' },
            { name: 'awb0BomLineItemId' },
            { name: 'elb0taktTime' },
            { name: 'elb0workContentByPV' },
            { name: 'bl_rev_object_name' },
            { name: 'capacity' },
            { name: 'elb0sharedWithStations' },
            { name: 'mbc0processResourceType' },
            {
                name: 'elb0allocatedOpsByPV',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
        ]
    }, {
        name: 'Mfg0BvrOperation',
        properties: [
            { name: 'elb0allocatedTimeByPV' },
            { name: 'bl_parent' },
            { name: 'elb0startTime' },
            { name: 'Mfg0predecessors' },
            { name: 'Mfg0processResource' },
            { name: 'bl_rev_last_release_status' },
            { name: 'bl_rev_fnd0InProcess' },
            { name: 'bl_rev_fnd0AllWorkflows' },
            { name: 'awb0RevisionRelStatusList' }
        ]
    }, {
        name: 'Mfg0BvrProcess',
        properties: [
            { name: 'elb0allocatedTimeByPV' },
            { name: 'bl_parent' },
            { name: 'elb0startTime' },
            { name: 'Mfg0predecessors' },
            { name: 'Mfg0processResource' }
        ]
    } ]
};


/**
 * Get the list of stations
 * @param {Object} objectUid object
 * @returns {Object} object that contains the list of stations and length of that list
 */
function getStationTilesList( objectUid ) {
    if( objectUid ) {
        registerStationTilesPolicy();
        const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.LINE_BALANCING_STATIONS, epLoadConstants.GET_PROPERTIES, epLoadConstants.PRODUCTION_PROGRAM ], objectUid, [
            'elb0cycleTime', 'elb0taktTime',
            'elb0taktTimeConverted', 'elb0workContentByPV'
        ] );
        return epLoadService.loadObject( loadTypeInput, false ).then( ( response ) => {
            const stations = _.map( response.loadedObjectsMap.loadedObject, station =>
                mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( station.uid ) ) );
            return {
                totalFound: stations.length,
                searchResults: stations
            };
        } );
    }
    return AwPromiseService.instance.resolve( {
        totalFound: 0,
        searchResults: []
    } );
}

/**
 * Registers StationTiles property policy
 */
function registerStationTilesPolicy() {
    policyId = propPolicySvc.register( policy );
}

/**
 * Un-registers StationTiles property policy
 */
function unRegisterStationTilesPolicy() {
    propPolicySvc.unregister( policyId );
}

/**
 * create a vmo for each uid
 * @param {Array} uids list of uids
 * @param {String} selectedUid selected pr uid
 * @returns {Array} array of VMOs
 */
function createVMOsForUids( uids, selectedUid ) {
    const vmos = [];
    uids.forEach( ( uid ) => {
        const vmo = mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( uid ) );
        vmo.selectedPr = uid === selectedUid;
        vmos.push( vmo );
    } );
    return vmos;
}

/**
 * Get an array of view model objects for the process resources
 * @param {Object} station the station
 * @param {Object} pr the product resource
 * @returns {Array} an array of VMOs for the process resources
 */
function prepareListOfProcessResources( station, pr ) {
    if( station && station.props.Mfg0processResources && station.props.Mfg0processResources.dbValues ) {
        return createVMOsForUids( station.props.Mfg0processResources.dbValues, pr ? pr.uid : null );
    }
    return [];
}

/**
 * Get an array of view model objects for the process resources and the station (for unassigned)
 * @param {Object} station the station
 * @param {Array} prs all process resources in the line
 * @returns {Array} an array of VMOs for the process resources
 */
function prepareListOfProcessResourcesAndUnassigned( station, prs ) {
    let tiles = prepareListOfProcessResources( station );
    // add station object if:
    // 1 there are process resources in the line and there is unassigned time in the station
    // 2 there are no process resources in the line
    if( prs && station.props.elb0unassignedOpsByPV.dbValues.length > 0 || _.isEmpty( prs ) ) {
        const vmo = mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( station.uid ) );
        tiles.push( vmo );
    }
    return tiles;
}

/**
 * Return the cycle time
 * @param {Object} station vmo of the station
 * @returns {Float} the cycle time of the station
 */
function getStationCycleTime( station ) {
    return parseFloat( station.props.elb0cycleTime.dbValues[ 0 ] );
}

/**
 * Load Balancing Station
 * @param {String} objectUid object scope UID
 * @returns {Object} balancing information object with
 *      {
 *          balancingStations,
 *          balancingScope,
 *          scopeTaktTime
 *      }
 */
function loadBalancingStations( objectUid ) {
    const balancingScope = mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( objectUid ) );
    return getStationTilesList( objectUid ).then( ( response ) => {
        const scopeTaktTime = parseFloat( balancingScope.props.elb0taktTimeConverted.displayValues[ 0 ] );
        const balancingStations = response.searchResults;
        return {
            balancingStations,
            balancingScope,
            scopeTaktTime
        };
    } );
}

/**
 * Calculate the information with the loaded balancing stations
 * @param {Array} balancingStations balancing stations
 * @param {Double} scopeTaktTime line takt time
 * @returns {Object} balancing information object with
 *  {
 *        balancingStations,
 *        numberOfStations,
 *        maxStationsCycleTime,
 *        allProcessResources,
 *        numberOfUniqueProcessResources,
 *        totalWaitTime,
 *        unassignedTime,
 *        lineHasOverridingTaktTime,
 *        problematicStations,
 *        maxTimeInLine
 *  }
 */
function calculateBalancingInformation( balancingStations, scopeTaktTime ) {
    const numberOfStations = balancingStations.length;
    const maxStationsCycleTime = getMaxStationsCycleTime( balancingStations );
    const allProcessResources = getProcessResources( balancingStations );
    const numberOfUniqueProcessResources = getActiveResourcesCount( allProcessResources );
    const totalWaitTime = getWaitTime( allProcessResources, balancingStations, maxStationsCycleTime ).toFixed( 2 );
    const unassignedTime = getUnassignedTime( balancingStations, allProcessResources ).toFixed( 2 );
    const lineHasOverridingTaktTime = getLineHasOverridingTaktTime( balancingStations, scopeTaktTime );
    const problematicStations = getProblematicStations( balancingStations, scopeTaktTime );
    const maxTimeInLine = getMaxTimeInLine( balancingStations, maxStationsCycleTime, scopeTaktTime );
    return {
        balancingStations,
        numberOfStations,
        maxStationsCycleTime: maxStationsCycleTime.toFixed( 2 ),
        allProcessResources,
        numberOfUniqueProcessResources,
        totalWaitTime,
        unassignedTime,
        lineHasOverridingTaktTime,
        problematicStations,
        maxTimeInLine
    };
}

/**
 * getMaxStationsCycleTime
 * @param {*} balancingStations balancingStations
 * @returns {Double} max cycle time
 */
function getMaxStationsCycleTime( balancingStations ) {
    if( _.isEmpty( balancingStations ) ) {
        return 0;
    }
    return _.max( _.map( balancingStations, station => getStationCycleTime( station ) ) );
}

/**
 * hasProperty
 * @param {*} modelObject  modelObject
 * @param {*} propertyName propertyName
 * @returns {Boolean} object has property
 */
function hasProperty( modelObject, propertyName ) {
    return modelObject.props && modelObject.props.hasOwnProperty( propertyName ) && modelObject.props[ propertyName ];
}

/**
 * getProcessResources
 * @param {*} balancingStations all stations
 * @returns {Array} all process resources in the line
 */
function getProcessResources( balancingStations ) {
    const allProcessResources = [];
    balancingStations.forEach( station => {
        if( hasProperty( station, epBvrConstants.MFG_PROCESS_RESOURCES ) ) {
            // take process resources from the station
            const processResources = station.props[ epBvrConstants.MFG_PROCESS_RESOURCES ].dbValues;
            processResources.forEach( processResourceUid => {
                let processResource = cdm.getObject( processResourceUid );
                if( !processResource ) {
                    return;
                }
                let id = processResource.uid;
                // identify the process resource by "item id" in order to avoid duplications in shared PRs
                if( hasProperty( processResource, epBvrConstants.AWB_BOM_LINE_ITEM_ID ) ) {
                    id = processResource.props[ epBvrConstants.AWB_BOM_LINE_ITEM_ID ].dbValues[ 0 ];
                }
                // search for process resource in the list -
                // search by id which is the item id
                let filteredPRs = allProcessResources.filter( ( prObject ) => {
                    return prObject.id === id;
                } );
                if( filteredPRs.length === 0 ) {
                    // if the process resource is not in the list yet - add it
                    allProcessResources.push( {
                        id: id,
                        stations: [ station ],
                        instances: [ processResource ]
                    } );
                } else {
                    // if the process resource is shared and was already added to the list -
                    // add the BOM line instance and the containing station
                    let existingProcessResource = filteredPRs[ 0 ];
                    existingProcessResource.instances.push( processResource );
                    existingProcessResource.stations.push( station );
                }
            } );
        }
    } );
    return allProcessResources;
}

/**
 * getProcessResourceWaitTime
 * @param {*} cycleTime line cycle time
 * @param {*} processResource single process resource
 * @returns {Double} wait time of process resource
 */
function getProcessResourceWaitTime( cycleTime, processResource ) {
    let resourceWaitTime = 0;
    let resourceWorkContent = 0;

    if( hasProperty( processResource, epBvrConstants.MBC_PROCESS_RESOURCE_TYPE ) ) {
        const processResourceType = processResource.props[ epBvrConstants.MBC_PROCESS_RESOURCE_TYPE ].dbValues[ 0 ];
        // only PRs of type Human or None should be calculated
        if( processResourceType !== epBvrConstants.MACHINE_TYPE ) {
            if( hasProperty( processResource, epBvrConstants.ELB_WORK_CONTENT_BY_PV ) ) {
                resourceWorkContent = parseFloat( processResource.props[ epBvrConstants.ELB_WORK_CONTENT_BY_PV ].dbValues[ 0 ] );
            }

            // resources with no work content should not be calculated
            if( resourceWorkContent > 0 ) {
                //capacity < 100
                if( hasProperty( processResource, epBvrConstants.CAPACITY ) &&
                    parseFloat( processResource.props[ epBvrConstants.CAPACITY ].dbValues[ 0 ] ) < 100 ) {
                    const resourceTaktTime = getObjectTaktTime( processResource );
                    resourceWaitTime = Math.max( resourceTaktTime - resourceWorkContent, 0 );
                } else {
                    resourceWaitTime = cycleTime - resourceWorkContent;
                }
            }
        }
    }

    return resourceWaitTime;
}

/**
 * @param {*} object  object
 * @returns {Double} takt time
 */
function getObjectTaktTime( object ) {
    if( hasProperty( object, epBvrConstants.ELB_TAKT_TIME ) ) {
        return parseFloat( object.props[ epBvrConstants.ELB_TAKT_TIME ].dbValues[ 0 ] );
    }
    return 0;
}

/**
 * @param {*} processResources  process Resources
 * @returns {Ineger} number of resources
 */
function getActiveResourcesCount( processResources ) {
    let numberOfActiveResources = 0;
    processResources.forEach( ( resource ) => {
        if( hasProperty( resource.instances[ 0 ], epBvrConstants.MBC_PROCESS_RESOURCE_TYPE ) ) {
            const processResourceType = resource.instances[ 0 ].props[ epBvrConstants.MBC_PROCESS_RESOURCE_TYPE ].dbValues[ 0 ];
            // only PRs of type Human or None should be counted
            // AND only PRs with work content should be counted
            if( processResourceType !== epBvrConstants.MACHINE_TYPE && hasProperty( resource.instances[ 0 ], epBvrConstants.ELB_WORK_CONTENT_BY_PV ) &&
                parseFloat( resource.instances[ 0 ].props[ epBvrConstants.ELB_WORK_CONTENT_BY_PV ].dbValues ) > 0 ) {
                numberOfActiveResources++;
            }
        }
    } );
    return numberOfActiveResources;
}

/**
 * getAllUnassignedTimes
 * @param {*} balancingStations  balancingStations
 * @returns {Array} all unassigned times
 */
function getAllUnassignedTimes( balancingStations ) {
    return balancingStations.map( station => {
        if( hasProperty( station, epBvrConstants.ELB_UNASSIGNED_TIME_BY_PV ) ) {
            return parseFloat( station.props[ epBvrConstants.ELB_UNASSIGNED_TIME_BY_PV ].dbValues[ 0 ] );
        }
        return 0;
    } );
}

/**
 * @param {*} balancingStations balancing Stations
 * @param {*} processResources  process Resources
 * @returns {Double} unassigned time
 */
function getUnassignedTime( balancingStations, processResources ) {
    // no process resources in the line - there's no unassigned time
    if( _.isEmpty( processResources ) ) {
        return -1;
    }
    // get all unassigned times
    const unassignedTimes = getAllUnassignedTimes( balancingStations );
    // filter '-1' cycle times - filter out stations with no unassigned operations
    const filteredUnassignedTimes = unassignedTimes.filter( time => time >= 0 );
    // if no stations are left - it means we have no unassigned operations in the line - return -1
    if( _.isEmpty( filteredUnassignedTimes ) ) {
        return 0;
    }
    // we have some unassigned operations - count the time
    return _.sum( filteredUnassignedTimes );
}

/**
 *
 * @param {*} processResources  process Resources
 * @param {*} balancingStations balancing Stations
 * @param {*} cycleTime cycle Time
 * @returns {Double} total wait time
 */
function getWaitTime( processResources, balancingStations, cycleTime ) {
    let totalWaitTime = 0;
    if( processResources.length > 0 ) {
        const allWorkers = _.map( processResources, processResource => processResource.instances[ 0 ] );

        totalWaitTime = allWorkers.reduce( ( total, processResource ) => {
            return total + getProcessResourceWaitTime( cycleTime, processResource );
        }, 0 );
    } else {
        const totalWorkTime = balancingStations.reduce( ( total, worker ) => {
            let workContent = 0;
            if( hasProperty( worker, epBvrConstants.ELB_WORK_CONTENT_BY_PV ) ) {
                workContent = parseFloat( worker.props[ epBvrConstants.ELB_WORK_CONTENT_BY_PV ].dbValues[ 0 ] );
            }
            // accumulate total work time
            return total + workContent;
        }, 0 );
        totalWaitTime = cycleTime * balancingStations.length - totalWorkTime;
    }
    return totalWaitTime;
}

/**
 *
 * @param {*} balancingStations all stations
 * @param {*} scopeTaktTime line takt time
 * @returns {Boolean} true if a station overrides line's takt time
 */
function getLineHasOverridingTaktTime( balancingStations, scopeTaktTime ) {
    return !_.every( _.map( balancingStations, station => getObjectTaktTime( station ) === scopeTaktTime ) );
}

/**
 * getProblematicStations
 * @param {*} balancingStations all stations
 * @param {*} scopeTaktTime line takt time
 * @returns {Object} map with station uid to boolean - tru it station cycle time exceeds scope takt time
 */
function getProblematicStations( balancingStations, scopeTaktTime ) {
    let stationTaktTime;
    return _.reduce( balancingStations, ( accumulator, station ) => {
        stationTaktTime = station.props.elb0taktTime.dbValue > 0 ? station.props.elb0taktTime.dbValue : scopeTaktTime;
        accumulator[ station.uid ] = getStationCycleTime( station ) > stationTaktTime;
        return accumulator;
    }, {} );
}

/**
 * getMaxTimeInLine
 * @param {*} balancingStations balancingStations
 * @param {Double} maxStationsCycleTime maxStationsCycleTime
 * @param {Double} scopeTaktTime scopeTaktTime
 * @returns {Double} max time in the line
 */
function getMaxTimeInLine( balancingStations, maxStationsCycleTime, scopeTaktTime ) {
    const unassignedTimes = getAllUnassignedTimes( balancingStations );
    const taktTimes = _.map( balancingStations, station => getObjectTaktTime( station ) );
    return _.max( _.union( unassignedTimes, taktTimes, [ maxStationsCycleTime ], [ scopeTaktTime ] ) );
}

/**
 *  loadTimeDistribution
 * @param {*} objectUid line
 * @returns {Array} stations
 */
function loadTimeDistribution( objectUid ) {
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.TIME_DISTRIBUTION ], objectUid );
    return epLoadService.loadObject( loadTypeInput, false ).then( ( response ) => {
        return {
            responseStations: response.loadedObjectsMap.allLoadedStations,
            relatedData: response.relatedObjectsMap
        };
    } );
}

/**
 *
 * @param {Object} selection station and pr
 * @returns {Object} table input
 */
function getOperationsTableInput( selection ) {
    return selection.processResource ? selection.processResource : selection.station;
}

/**
 * getOperationsTableProperty
 *
 * @param {Object} selection balancing station selection
 * @returns {String} property to load
 */
function getOperationsTableProperty( { unassigned } ) {
    const propertyName = unassigned ? 'elb0unassignedOpsByPV' : 'elb0allocatedOpsByPV';
    return {
        relationName: [
            propertyName
        ],
        loadInputObject: {
            loadTypes: [
                'getProperties'
            ],
            propertiesToLoad: [
                propertyName
            ]
        }
    };
}

/**
 *
 * @param {Object} capacityPreferenceValue capacities preference values
 * @returns {Object} object to load data
 */
function getAllowedProcessResourceCapacities( capacityPreferenceValue ) {
    const capacityDataList = listBoxSvc.createListModelObjectsFromStrings( capacityPreferenceValue );
    return {
        capacityDataList
    };
}

/**
 *
 * @param {Object} selectedPr selected Process Resource
 * @param {String} capacityValue capaciy value for Process Resource
 * @returns {Promise} the promise
 */
function setPrCapacity( selectedPr, capacityValue ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];

    relatedObjects.push( selectedPr );
    saveInputWriter.addModifiedProperty( selectedPr.uid, epBvrConstants.CAPACITY, [ capacityValue ] );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        popupService.hide();
        return response;
    } );
}

/**
 * Get the shared process resource & station name for the notification message
 * This function is called only when the selected process resource is shared
 *
 * @param {Object} selection sync Object
 *
 * @returns {Object} process resource and station
 */
async function getSharedProcessResourceMessage( { station, processResource } ) {
    const processResourceName = processResource.props[ epBvrConstants.BL_REV_OBJECT_NAME ].dbValues[ 0 ];
    const sharedStations = processResource.props.elb0sharedWithStations.dbValues.filter( sharedStation => sharedStation !== station.uid );

    // if some stations are not loaded - the shared process resource is from a different line
    const unloadedStations = sharedStations.filter( sharedStation => !cdm.getObject( sharedStation ).props[ epBvrConstants.BL_REV_OBJECT_NAME ] );
    if( !_.isEmpty( unloadedStations ) ) {
        await epTableService.loadAllProperties( unloadedStations, [ epBvrConstants.BL_REV_OBJECT_NAME ], [ epLoadConstants.GET_PROPERTIES ] );
    }

    const stationNames = sharedStations.map( st => cdm.getObject( st ).props[ epBvrConstants.BL_REV_OBJECT_NAME ].dbValues[ 0 ] );

    return {
        processResourceName,
        stationNames
    };
}

/**
 * Update Vmo with external usage.
 * @param {Object} inputObject - the selected object in the station tile
 * @param {Object} vmos - the vmo for the cell
 * @param {string} columnsToUpdate - the column name
 */
function updateExternalUsageToVmo( { processResource }, vmos, columnsToUpdate ) {
    if( !vmos || vmos.length === 0 || !processResource ) {
        // no operations or station/unassigned selected - do nothing
        return;
    }
    const eventData = {};
    vmos.forEach( vmo => {
        eventData[ vmo.uid ] = columnsToUpdate;
        // process resource - possible external operations
        const isExternal = vmo.props.bl_parent.dbValues[ 0 ] !== processResource.props.bl_parent.dbValues[ 0 ];
        const prName = processResource.props.bl_rev_object_name.dbValues[ 0 ];
        const otherStationUid = vmo.props.bl_parent.dbValues[ 0 ];
        const stationName = cdm.getObject( otherStationUid ).props.bl_rev_object_name.dbValues[ 0 ];

        epObjectPropertyCacheService.setProperty( vmo.uid, 'isExternal', isExternal );
        epObjectPropertyCacheService.setProperty( vmo.uid, 'stationName', stationName );
        epObjectPropertyCacheService.setProperty( vmo.uid, 'prName', prName );
        cachedOperationsList.push( vmo );
    } );
    eventBus.publish( 'viewModelObject.propsUpdated', eventData );
}

/**
 * Clears epObjectPropertyCacheService
 */
function cleanUpExternalUsageDataFromCache() {
    if( cachedOperationsList ) {
        _.forEach( cachedOperationsList, vmo => {
            epObjectPropertyCacheService.clearPropertyKeyCache( vmo.uid, 'isExternal' );
            epObjectPropertyCacheService.clearPropertyKeyCache( vmo.uid, 'stationName' );
            epObjectPropertyCacheService.clearPropertyKeyCache( vmo.uid, 'prName' );
        } );
        cachedOperationsList = [];
    }
}

/**
 * Render process resource external usage.
 *
 * @param {ViewModelObject} vmo - object to render
 * @param {DOMElement} containerElement - the container element
 */
function rendererExternalUsage( vmo, containerElement ) {
    if( !containerElement || !vmo.uid ) {
        return;
    }
    let isExternalFlag = epObjectPropertyCacheService.getProperty( vmo.uid, 'isExternal' );
    if( isExternalFlag === true ) {
        const iconId = 'indicatorExternalUsage16';
        if( iconId ) {
            const localizedMsgs = localeSvc.getLoadedText( 'BalancingMessages' );
            let externalUsageTooltip = localizedMsgs.externalUsageTooltipData;
            let prName = epObjectPropertyCacheService.getProperty( vmo.uid, 'prName' );
            let stationName = epObjectPropertyCacheService.getProperty( vmo.uid, 'stationName' );
            externalUsageTooltip = externalUsageTooltip.replace( '{0}', prName );
            externalUsageTooltip = externalUsageTooltip.replace( '{1}', stationName );
            const tooltipData = {
                extendedTooltip: {
                    title: localizedMsgs.externalUsageTitle,
                    messages: [ externalUsageTooltip ]
                }
            };
            const props = {
                imageSrc: iconId,
                tooltipView: 'MfeGenericTooltip',
                tooltipData,
                isClickable: false
            };
            const imageElement = includeComponent( 'MfeTableCellImage', props );
            renderComponent( imageElement, containerElement );
        }
    }
}

/**
 * Renderer for external operation column header
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} tooltip - tooltip object
 * @param {Object} column - column object
 */
export function externalOperationHeaderRenderer( containerElement, columnField, tooltip, column ) {
    epTableCellRenderer.columnHeaderIndicationRenderer( containerElement, columnField, column );
}

/**
 * Update props with external usage.
 *
 * @param {Array} selectedOperations - the selected Operations
 * @param {Array} occContext -
 */
function updateMultipleSelectedExternalUsageFlag( selectedOperations, occContext ) {
    let areExternal = false;
    if( selectedOperations && selectedOperations.length > 0 ) {
        let externalOperations = [];
        _.forEach( selectedOperations, operation => {
            let isExternalFlag = epObjectPropertyCacheService.getProperty( operation.uid, 'isExternal' );
            if( isExternalFlag ) {
                externalOperations.push( operation );
            }
        } );
        if( externalOperations && externalOperations.length >= 1 ) {
            areExternal = true;
        }
    }
    mfeViewModelUtils.mergeValueInAtomicData( occContext, { areExternal: areExternal } );
}
/**
 * run over the updated stations and in case there two stations
 * we need to reload all stations need to recalculate all data.
 * other we only calculate information
 *
 * @param {Object} saveEventsData saveEventsData
 */
function checkSaveEvents( saveEventsData ) {
    const objectsHasChanged = Object.values( saveEventsData.ServiceData.modelObjects );
    if( objectsHasChanged ) {
        const stationsUpdated = objectsHasChanged.filter( obj => obj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcessStation' ) > -1 );

        if( stationsUpdated.length > 1 ) {
            eventBus.publish( 'ep.loadStationsAndCalculateInformation' );
        } else {
            eventBus.publish( 'ep.calculateInformation' );
        }
    }
}

export default {
    getStationTilesList,
    prepareListOfProcessResources,
    loadBalancingStations,
    registerStationTilesPolicy,
    unRegisterStationTilesPolicy,
    loadTimeDistribution,
    calculateBalancingInformation,
    prepareListOfProcessResourcesAndUnassigned,
    getOperationsTableInput,
    getOperationsTableProperty,
    getAllowedProcessResourceCapacities,
    setPrCapacity,
    getSharedProcessResourceMessage,
    updateExternalUsageToVmo,
    rendererExternalUsage,
    cleanUpExternalUsageDataFromCache,
    updateMultipleSelectedExternalUsageFlag,
    checkSaveEvents,
    externalOperationHeaderRenderer
};
