/*
* @module js/Dpv1ClusterGroupService
*/
import _ from 'lodash';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import soaService from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';

var exports = {};

export let loadClusterGroups = function( routineVMO ) {
    var deferred = AwPromiseService.instance.defer();
    var outputData = {
        totalFound: 0,
        clusterGroupList: []
    };

    if( !routineVMO ) {
        deferred.resolve( outputData );
    }

    var routineRevUid = undefined;

    if( routineVMO && routineVMO.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        routineRevUid = routineVMO.uid;
    } else if( routineVMO && routineVMO.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        routineRevUid = routineVMO.props.awb0UnderlyingObject.dbValues[0];
    }

    var routineRev = cdm.getObject( routineRevUid );

    var routineRevObjects = [ routineRev ];

    var propsToLoad = [ 'item_id', 'item_revision_id', 'creation_date', 'object_type', 'release_status_list', 'owning_user', 'DPVClusterGroupContent' ];

    // Call SOA to get cluster group revisions
    soaService.postUnchecked( 'ProductionManagement-2011-06-MeasurementDataQuery', 'queryClusterGroupInfo', { routineRevs: routineRevObjects }  ).then(
        function( response ) {
            if ( response && response.clusterGroupInfoSet && response.clusterGroupInfoSet.length > 0 ) {
                var uidToLoad = [];
                var vmos = [];
                for ( let idx = 0; idx < response.clusterGroupInfoSet.length; idx++ ) {
                    uidToLoad.push( response.clusterGroupInfoSet[idx].uid );
                }
                uidToLoad = _.uniq( uidToLoad );
                dmSvc.getProperties( uidToLoad, propsToLoad ).then( function() {
                    var modelObjects = cdm.getObjects( uidToLoad );
                    for ( var nn = 0; nn < modelObjects.length; nn++ ) {
                        vmos.push( viewModelObjectSvc.createViewModelObject( modelObjects[nn] ) );
                    }
                    var sortedVMOs = _.sortBy( vmos, [ function( clsGrpRev ) { return clsGrpRev.props.creation_date.dbValues[ 0 ]; } ] );
                    outputData.totalFound = sortedVMOs.length;
                    outputData.clusterGroupList = sortedVMOs;
                    deferred.resolve( outputData );
                } );
                return deferred.promise;
            }
            deferred.resolve( outputData );
        },
        function( error ) {
            deferred.reject( error );
        } );
    return deferred.promise;
};

export let loadClusterGroupColumns = async function() {
    let deferred = AwPromiseService.instance.defer();
    let servercolumns = [];
    let awColumnInfos = [];
    var soaInput = {
        getOrResetUiConfigsIn: [ {
            scope: 'LoginUser',
            clientName: 'AWClient',
            resetColumnConfig: true,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Dpv1ClusterGroups',
                operationType: 'configured'
            } ],
            businessObjects:  [
                {}
            ]
        } ]
    };

    await soaService.post( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', soaInput ).then( function( response ) {
        servercolumns = response.columnConfigurations[0].columnConfigurations[0].columns;
    } );
    if ( servercolumns.length > 0 ) {
        servercolumns.forEach( column => {
            awColumnInfos.push( column );
        } );
    }
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'clusterGroupsColConfig',
            objectSetUri: 'Dpv1ClusterGroups'
        }
    } );

    return deferred.promise;
};

export let loadRoutineRevColumns = async function() {
    let deferred = AwPromiseService.instance.defer();
    let servercolumns = [];
    let awColumnInfos = [];
    var soaInput = {
        getOrResetUiConfigsIn: [ {
            scope: 'LoginUser',
            clientName: 'AWClient',
            resetColumnConfig: true,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Dpv1Inspection',
                operationType: 'configured'
            } ],
            businessObjects:  [
                {}
            ]
        } ]
    };

    await soaService.post( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', soaInput ).then( function( response ) {
        servercolumns = response.columnConfigurations[0].columnConfigurations[0].columns;
    } );
    if ( servercolumns.length > 0 ) {
        servercolumns.forEach( column => {
            awColumnInfos.push( column );
        } );
    }
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'inspectionColConfig',
            objectSetUri: 'Dpv1Inspection'
        }
    } );

    return deferred.promise;
};

/*
 * To get the Item tag Uid from selected Item Revision
 */
export let getItemUid = function( itemVMO ) {
    var itemRevUid = getItemRevUid( itemVMO );
    var itemRev = cdm.getObject( itemRevUid );
    return itemRev.props.items_tag.dbValues[0];
};

export let processRoutineRevObjects = function( response, routineVMO ) {
    let routineItemUid = exports.getItemUid( routineVMO );
    var currRoutineRevUid = getItemRevUid( routineVMO );
    var searchResults = [];
    var outputData = {
        revisions: [],
        length: 0
    };
    var routineItem = cdm.getObject( routineItemUid );
    if( routineItem.props.revision_list && routineItem.props.revision_list.dbValues.length > 1 ) {
        var revisionsUids = routineItem.props.revision_list.dbValues;
        for( var ind = 0; ind < revisionsUids.length; ind++ ) {
            if( revisionsUids[ ind ] !== currRoutineRevUid ) {
                var vmo = viewModelObjectSvc.createViewModelObject( cdm.getObject( revisionsUids[ ind ] ) );
                searchResults.push( vmo );
            }
        }
        var sortedSearchResults = _.sortBy( searchResults, [ function( revision ) { return revision.props.creation_date.dbValues[ 0 ]; } ] );
        for( var idx = 0; idx < sortedSearchResults.length; idx++ ) {
            var bIsSecondLatest = idx >= sortedSearchResults.length - 1;
            sortedSearchResults[ idx ].props.is2ndLatestRev = uwPropertyService.createViewModelProperty( 'is2ndLatestRev', '', 'BOOLEAN', bIsSecondLatest );
        }
        outputData.revisions = sortedSearchResults;
        outputData.length = searchResults.length;
    }
    return outputData;
};

//set markClsGrpRev, exclusiveInSelRoutineRev, exclusiveInEitherRoutineRev custom properties on cluster group Revisions for curr routine rev
export let prepareClusterGroupRevTableData = function( clsGrpRevsToReturn, clsGrpRevsToCompare, exclusiveRelPropRequired ) {
    var deferred = AwPromiseService.instance.defer();
    var outputData = {
        totalFound: 0,
        clusterGroupList: []
    };
    if( _.isEmpty( clsGrpRevsToReturn ) ) {
        deferred.resolve( outputData );
    } else {
        setCustomVMProperties( clsGrpRevsToReturn, clsGrpRevsToCompare, exclusiveRelPropRequired, deferred );
    }
    return deferred.promise;
};

export let setTitlesForClusterGrpTables = function( currRoutineVMO, selRoutineVMO ) {
    var currRoutineRevUid = getItemRevUid( currRoutineVMO );
    var currRoutineRev = cdm.getObject( currRoutineRevUid );
    var selRoutineRevUid = getItemRevUid( selRoutineVMO );
    var selRoutineRev = cdm.getObject( selRoutineRevUid );
    return {
        currRoutineRevTitle : currRoutineRev.props.object_string.dbValues[0],
        selRoutineRevTitle : selRoutineRev.props.object_string.dbValues[0]
    };
};

export let selectFirstRevision = function( routineRevDataProvider ) {
    if( routineRevDataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        routineRevDataProvider.selectionModel.setSelection( routineRevDataProvider.viewModelCollection.loadedVMObjects[ 0 ] );
    }
};

function getItemRevUid( itemVMO ) {
    var itemRevUid = undefined;
    if( itemVMO && itemVMO.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        itemRevUid = itemVMO.uid;
    } else if( itemVMO && itemVMO.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        itemRevUid = itemVMO.props.awb0UnderlyingObject.dbValues[0];
    }
    return itemRevUid;
}

function getLatestItemRevUid( itemObject ) {
    var sortedItemRevs = [];
    if( itemObject.props.revision_list && itemObject.props.revision_list.dbValues.length > 0 ) {
        let itemRevList = itemObject.props.revision_list.dbValues.map( uid => cdm.getObject( uid ) );
        sortedItemRevs = _.sortBy( itemRevList, [ function( revision ) { return revision.props.creation_date.dbValues[ 0 ]; } ] ).reverse();
    }
    return sortedItemRevs && sortedItemRevs.length > 0 ? sortedItemRevs[0].uid : undefined;
}

function setCustomVMProperties( clsGrpRevsToReturn, clsGrpRevsToCompare, exclusiveRelPropRequired, deferred ) {
    var clsGrpRevsOut = _.cloneDeep( clsGrpRevsToReturn );
    let megaClsRevUidList = [];
    _.forEach( clsGrpRevsOut, function( clsGrpRev ) {
        megaClsRevUidList = megaClsRevUidList.concat( clsGrpRev.props.DPVClusterGroupContent.dbValue );
    } );
    megaClsRevUidList = _.uniq( megaClsRevUidList );
    var clsRevToLatestClsRevMap = new Map();
    var propsToLoad = [ 'item_id', 'item_revision_id', 'creation_date', 'object_type', 'release_status_list', 'owning_user' ];

    return dmSvc.getProperties( megaClsRevUidList, propsToLoad).then( () => {
        _.forEach( megaClsRevUidList, function( clsRevUid ) {
            clsRevToLatestClsRevMap.set( clsRevUid, getLatestItemRevUid( cdm.getObject( clsRevUid ) ) );
        } );
        for( var i = 0; i < clsGrpRevsOut.length; i++ ) {
            var clsRevsUids = clsGrpRevsOut[ i ].props.DPVClusterGroupContent.dbValue;
            let bMarkClsGrpRev = false;
            for( var j = 0; j < clsRevsUids.length; j++ ) {
                let latestClsRevUid = clsRevToLatestClsRevMap.get( clsRevsUids[ j ] );
                bMarkClsGrpRev = !clsRevsUids.includes( latestClsRevUid ) && clsRevsUids[ j ] !== latestClsRevUid;
                if( bMarkClsGrpRev ) {
                    break;
                }
            }
            //set markClsGrpRev
            clsGrpRevsOut[ i ].props.markClsGrpRev = uwPropertyService.createViewModelProperty( 'markClsGrpRev', '', 'BOOLEAN', bMarkClsGrpRev );
            //set exclusiveInEitherRoutineRev
            let bHasRevToCompare = clsGrpRevsToCompare && clsGrpRevsToCompare.length > 0;
            var filteredClsGrpRevs = bHasRevToCompare ? clsGrpRevsToCompare.filter( clsGrpRevToCompare => clsGrpRevToCompare.uid === clsGrpRevsOut[ i ].uid ) : undefined;
            var bExclusiveInEitherRoutineRev = !( filteredClsGrpRevs && filteredClsGrpRevs.length === 1 );
            clsGrpRevsOut[ i ].props.exclusiveInEitherRoutineRev = uwPropertyService.createViewModelProperty( 'exclusiveInEitherRoutineRev', '', 'BOOLEAN', bExclusiveInEitherRoutineRev );
            if ( exclusiveRelPropRequired ) {
                //set exclusiveInSelRoutineRev
                let bHasRevToCompare = clsGrpRevsToCompare && clsGrpRevsToCompare.length > 0;
                filteredClsGrpRevs = bHasRevToCompare ? clsGrpRevsToCompare.filter( clsGrpRevToCompare => clsGrpRevToCompare.uid === clsGrpRevsOut[ i ].uid ) : undefined;
                var bexclusiveInSelRoutineRev = !( filteredClsGrpRevs && filteredClsGrpRevs.length === 1 );
                clsGrpRevsOut[ i ].props.exclusiveInSelRoutineRev = uwPropertyService.createViewModelProperty( 'exclusiveInSelRoutineRev', '', 'BOOLEAN', bexclusiveInSelRoutineRev );
            }
        }
        deferred.resolve( {
            totalFound: clsGrpRevsOut.length,
            clusterGroupList: clsGrpRevsOut
        } );
    },
    function( error ) {
        deferred.reject( error );
    } );
}

export default exports = {
    loadClusterGroups,
    loadClusterGroupColumns,
    loadRoutineRevColumns,
    getItemUid,
    processRoutineRevObjects,
    prepareClusterGroupRevTableData,
    setTitlesForClusterGrpTables,
    selectFirstRevision
};
