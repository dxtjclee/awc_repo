// Copyright (c) 2022 Siemens
/**
* Service to provide utilities to activities tree
*
* @module js/ssp0ActivitiesTreeService
*/
import AwPromiseService from 'js/awPromiseService';
import ClipboardService from 'js/clipboardService';
import _ from 'lodash';
import adapterSvc from 'js/adapterService';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import { getBaseUrlPath } from 'app';
import soaService from 'soa/kernel/soaService';
import { constants as timeAnalysisConstants } from 'js/ssp0TimeAnalysisConstants';
import viewModelObjectService from 'js/viewModelObjectService';
const propertiesForNumericSort = [
    timeAnalysisConstants.ACTIVITY_WORK_TIME,
    timeAnalysisConstants.ACTIVITY_DURATION_TIME,
    timeAnalysisConstants.ACTIVITY_SYSTEM_UNIT_TIME
];
let exports = {};
const treeNodeMap = new Map();
let modelType = null;
let puidVsPreduidMap = new Map(); // Map that will store uid of persistent MEActivity & uid of predecessor MEActivity
let puidVsRuntimeUidMapForPert = new Map(); // Map that will store uid of persistent

/**
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} nodeBeingExpanded nodeBeingExpanded of Tree
 * @return {Object} TreeLoadResult of node
 */
export let setActivityNodeProperties = async function( response, nodeBeingExpanded ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let iterableModelObjects = [];
    if ( nodeBeingExpanded.props ) {
        _handleEditStates( nodeBeingExpanded, 'al_activity_time_system_unit_time' );
        _handleEditStates( nodeBeingExpanded, 'al_activity_time_system_category' );
        nodeBeingExpanded.props.al_activity_time_system_unit_time.uiValue = '';
        let imagePath = getBaseUrlPath() + '/image/typeTimeActivity48.svg';
        nodeBeingExpanded.typeIconURL = imagePath;
        iterableModelObjects = excludeDatasetAsChild( nodeBeingExpanded.props.me_cl_child_lines.dbValues, modelObjects );
    } else if ( modelObjects[nodeBeingExpanded.uid] && modelObjects[nodeBeingExpanded.uid].props && modelObjects[nodeBeingExpanded.uid].props.bl_me_activity_lines ) {
        iterableModelObjects = excludeDatasetAsChild( modelObjects[nodeBeingExpanded.uid].props.bl_me_activity_lines.dbValues, modelObjects );
    }
    var sortedList = await sortActivityOrder( iterableModelObjects );
    let parentVsSortedChildren = new Map();
    let objectsToReturn = [];
    sortedList.forEach(
        key => {
            if ( modelObjects && modelObjects[key].props && modelObjects[key].props.me_cl_display_string &&
                modelObjects[key].modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_Activity_Line ) ) {
                let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( modelObjects[key], 'create' );
                vmo.displayName = modelObjects[key].props.me_cl_display_string.dbValues[0];
                vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                vmo.underlyingObjectType = modelObjects[key].type;
                vmo.isVisible = false;
                vmo.isLeaf = _checkIfLeaf( modelObjects, modelObjects[key] );
                _convertToNumber( vmo );
                if ( !vmo.isLeaf ) {
                    _handleEditStates( vmo, 'al_activity_time_system_unit_time' );
                    _handleEditStates( vmo, 'al_activity_time_system_category' );
                    vmo.props.al_activity_time_system_unit_time.uiValue = '';
                }
                let imagePath = getBaseUrlPath() + '/image/typeTimeActivity48.svg';
                vmo.typeIconURL = imagePath;
                vmo.alreadyExpanded = false;
                if ( vmo.props.me_cl_parent.dbValue === '' ) {
                    selectionChanged( vmo );
                    eventBus.publish( 'Ssp0AddTitle.setTotalTimeData' );
                    getModelTypeHierarchy( vmo );
                }
                objectsToReturn.push( vmo );
            }
        } );
    const treeLoadResult = {
        parentNode: nodeBeingExpanded,
        childNodes: objectsToReturn,
        totalChildCount: objectsToReturn.length,
        startChildNdx: 0
    };
    nodeBeingExpanded.alreadyExpanded = true;
    treeNodeMap.set( nodeBeingExpanded.uid, treeLoadResult );
    return treeNodeMap.get( nodeBeingExpanded.uid );
};

let _convertToNumber = function( vmo ) {
    const unitName = appCtxSvc.getCtx( 'ssp0selectedCurrentTime.timeUnit' );
    let modelObject = cdm.getObject( vmo.uid );
    Object.entries( vmo.props ).forEach( ( prop ) => {
        if ( propertiesForNumericSort.includes( prop[0] ) ) {
            const originalVMOProp = vmo.props[prop[0]];
            const originalMOProp = modelObject.props[prop[0]];
            let value = prop[1].dbValue;
            const multiplierToSec = timeAnalysisConstants.UNITS[unitName].multiplierToSec;
            value /= multiplierToSec;
            if ( Number.isInteger( value ) === false ) {
                value = Number( value ).toFixed( 2 );
            }
            let isArray = prop[1].propertyDescriptor.anArray ? prop[1].propertyDescriptor.anArray : false;
            const property = {
                isArray: isArray,
                value: [ value ],
                displayValue: [ value.toString() ],
                propType: viewModelObjectService.getClientPropertyType( originalMOProp.propertyDescriptor.valueType, isArray ),
                displayName: originalMOProp.propertyDescriptor.displayName
            };
            vmo.props[prop[0]] = viewModelObjectService.constructViewModelProperty( property, prop[0], vmo );
            vmo.props[prop[0]].propertyDescriptor = originalVMOProp.propertyDescriptor;
            vmo.props[prop[0]].editable = originalVMOProp.editable;
            vmo.props[prop[0]].isPropertyModifiable = originalVMOProp.isPropertyModifiable;
        } else {
            prop[1].dbValue = prop[1].uiValue;
        }
    } );
};
let getChildNodesOfRootAct = function( treeLoadResult ) {
    let rootNodeChildArray = treeLoadResult.childNodes[0].props.me_cl_child_lines.dbValues;
    let childObjArr = [];
    rootNodeChildArray.forEach( uid => childObjArr.push(
        {
            uid: uid
        }
    ) );
    return childObjArr;
};
let getChildNodesUids = function( response, nodeBeingExpanded ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let iterableModelObjects = [];
    if ( nodeBeingExpanded.props ) {
        iterableModelObjects = excludeDatasetAsChild( nodeBeingExpanded.props.me_cl_child_lines.dbValues, modelObjects );
    } else if ( modelObjects[nodeBeingExpanded.uid] && modelObjects[nodeBeingExpanded.uid].props && modelObjects[nodeBeingExpanded.uid].props.bl_me_activity_lines ) {
        iterableModelObjects = excludeDatasetAsChild( modelObjects[nodeBeingExpanded.uid].props.bl_me_activity_lines.dbValues, modelObjects );
    }
    return getChildUIDListForEachNode( iterableModelObjects, modelObjects );
};
let getChildUIDListForEachNode = function( parentsNodeList, modelObjects ) {
    let parentModelObjects = [];
    parentsNodeList.forEach( uid => {
        parentModelObjects.push( ...modelObjects[uid].props.me_cl_child_lines.dbValues );
    } );
    let childUidList = [];
    parentModelObjects.forEach( uid => {
        let underlyingObjId = modelObjects[uid].props.me_cl_fnd0objectId.dbValues[0];
        childUidList.push(
            {
                uid: underlyingObjId
            } );
        puidVsRuntimeUidMapForPert.set( underlyingObjId, uid ); // For PERT
    } );
    return childUidList;
};
// Gets the underlying object IDs of all child nodes and add them to map of uid vs SR uid
let getUidsOfChildNodes = function( response ) {
    let plain = response.plain;
    let modelObjects = response.modelObjects;
    let uidsArray = [];
    plain.forEach( uid => {
        let underlyingObjId = modelObjects[uid].props.me_cl_fnd0objectId.dbValues[0];
        uidsArray.push(
            {
                uid: underlyingObjId
            } );
        puidVsRuntimeUidMapForPert.set( underlyingObjId, uid ); // For PERT
    } );
    return uidsArray;
};
let addPredToMap = function( response ) {
    let plain = response.plain;
    let modelObjects = response.modelObjects;
    plain.forEach( uid => {
        if( modelObjects[uid].props.pred_list ) {
            puidVsPreduidMap.set( uid, modelObjects[uid].props.pred_list.dbValues ); // For PERT
        }
    } );
};
let excludeDatasetAsChild = function( allChildLineUids, modelObjects ) {
    return allChildLineUids.filter( ( uid ) => {
        if ( modelObjects[uid] && modelObjects[uid].modelType.typeHierarchyArray.includes( 'CfgActivityLine' ) ) {
            return true;
        }
    } );
};
let _checkIfLeaf = function( modelObjects, vmo ) {
    let count = 0;
    vmo.props.me_cl_child_lines.dbValues.forEach( ( element ) => {
        let modelObject = Object.values( modelObjects ).filter(
            modelObject => modelObject.uid === element );
        if ( modelObject[0].modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_Activity_Line ) ) {
            count++;
        }
    } );
    if ( count === 0 ) {
        return true;
    }
    return false;
};
let _handleEditStates = function( vmo, propertyName ) {
    vmo.props[propertyName].isPropertyModifiable = false;
};
/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadActivitiesTableColumns = function( data ) {
    const localizeDisplayName = data.grids.activitiesTreeTable.i18n;
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    const firstColumnConfigCol = {
        name: 'me_cl_display_string',
        displayName: localizeDisplayName.nameValueColumn,
        width: 400,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true
    };
    const secondColumnConfigCol = {
        name: 'al_activity_long_description',
        displayName: localizeDisplayName.descriptionValueColumn,
        width: 350,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const thirdColumnConfigCol = {
        name: 'al_activity_time_system_code',
        displayName: localizeDisplayName.codeValueColumn,
        width: 235,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const fourthColumnConfigCol = {
        name: 'al_activity_time_system_unit_time',
        displayName: localizeDisplayName.unitTimeValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const fifthColumnConfigCol = {
        name: 'al_activity_Mfg0quantity',
        displayName: localizeDisplayName.quantityValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const sixthColumnConfigCol = {
        name: 'al_activity_time_system_frequency',
        displayName: localizeDisplayName.frequencyValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const seventhColumnConfigCol = {
        name: 'al_activity_work_time',
        displayName: localizeDisplayName.workTimeValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const eightthColumnConfigCol = {
        name: 'al_activity_time_system_category',
        displayName: localizeDisplayName.categoryValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const ninethColumnConfigCol = {
        name: 'al_activity_ssp0ActivityExecutionType',
        displayName: localizeDisplayName.executionTypeValueColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    awColumnInfos.push( thirdColumnConfigCol );
    awColumnInfos.push( fourthColumnConfigCol );
    awColumnInfos.push( fifthColumnConfigCol );
    awColumnInfos.push( sixthColumnConfigCol );
    awColumnInfos.push( seventhColumnConfigCol );
    awColumnInfos.push( eightthColumnConfigCol );
    awColumnInfos.push( ninethColumnConfigCol );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );
    awColumnSvc.createColumnInfo( awColumnInfos );
    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );
    return deferred.promise;
};

// Function to sort all activities based on activities, and relationship between them
// Input Parameters - array of all Activities ,array of [activity, predecessor]
// Ouput - Sorted Activity
let sortActivities = function( activities, edges ) {
    const graph = new Map(); // a connected graph between the activities
    const inDegree = new Map(); // each activities in-degree or no of activities which are its predecessor
    // Initialize the graph and in-degree map
    for ( const string of activities ) {
        graph.set( string, [] );
        inDegree.set( string, 0 );
    }
    // Build the graph and calculate in-degrees
    for ( const [ dependent, dependency ] of edges ) {
        graph.get( dependency ).push( dependent );
        inDegree.set( dependent, inDegree.get( dependent ) + 1 );
    }
    const result = []; // sroted activities list
    const queue = [];
    // Initialize the queue with nodes that have in-degree of 0
    for ( const [ string, degree ] of inDegree.entries() ) {
        if ( degree === 0 ) {
            queue.push( string );
        }
    }
    while ( queue.length > 0 ) {
        const node = queue.shift();
        result.push( node );
        for ( const dependent of graph.get( node ) ) {
            inDegree.set( dependent, inDegree.get( dependent ) - 1 );
            if ( inDegree.get( dependent ) === 0 ) {
                queue.push( dependent );
            }
        }
    }
    return result;
};
// Function to create puidVsRuntimeUidMap, puidVsPredListMap from unordered Activity runtime UIDs List
let createActivityUidMaps = async function( inputList ) {
    let puidVsRuntimeUidMap = new Map(); // Map that will store uid of persistent MEActivity & uid of runtime MECfgLine
    let puidVsPredListMap = new Map();
    const searchObjectsList = [];
    const promisesForGetProperties2 = [];
    inputList.forEach( input => {
        let activity = cdm.getObject( input );
        let puid = activity.props.me_cl_fnd0objectId.dbValues[0];
        puidVsRuntimeUidMap.set( puid, input );
        puidVsRuntimeUidMapForPert.set( puid, input );
        const searchObject2 = {
            uid: puid,
            type: timeAnalysisConstants.TYPE_Activity
        };
        searchObjectsList.push( searchObject2 );
    } );
    var getPropertiesInput2 = {
        objects: searchObjectsList,
        attributes: [ 'pred_list' ]
    };
    let promise = _getModelTypeSOA( getPropertiesInput2 );
    promisesForGetProperties2.push( promise );
    const resultsForGetProps2 = await Promise.all( promisesForGetProperties2 );
    let result = resultsForGetProps2[0];
    for( let j = 0; j < result.plain.length; j++ ) {
        var puid = result.plain[j];
        let predList = result.modelObjects[result.plain[j]].props.pred_list.dbValues;
        if ( predList.length ) {
            puidVsPreduidMap.set( puid, predList ); // For PERT
            puidVsPredListMap.set( puid, predList );
        } else{
            puidVsPredListMap.set( puid, 'NullValue' );
        }
    }
    return {
        puidVsRuntimeUidMap: puidVsRuntimeUidMap,
        puidVsPredListMap: puidVsPredListMap
    };
};
// Function to indetify activity relations, and sort them
let getActivityOrderFromMap = function( mapResult ) {
    let puidVsRuntimeUidMap = mapResult.puidVsRuntimeUidMap; // Map that will store uid of persistent MEActivity & uid of runtime MECfgLine
    let puidVsPredListMap = mapResult.puidVsPredListMap;
    const activities = []; // array of all activites in the tree
    const edges = []; // array of [activity,predeccesor]
    const runtimeList = []; // array containing sorted runtime UIDS List
    for ( const [ puid, predList ] of puidVsPredListMap.entries() ) {
        if ( predList[0] === 'NullValue' || predList === 'NullValue' ) {
            activities.push( puid );
            continue;
        } else{
            activities.push( puid );
            predList.forEach( pred => {
                edges.push( [ puid, pred ] );
            } );
        }
    }
    if ( edges.length ) {
        let input = sortActivities( activities, edges );
        input.forEach( inputValue => {
            runtimeList.push( puidVsRuntimeUidMap.get( inputValue ) );
        } );
    } else {
        activities.forEach( stringValue => {
            runtimeList.push( puidVsRuntimeUidMap.get( stringValue ) );
        } );
    }
    return runtimeList;
};
// Function that sorts activity order
let sortActivityOrder = async function( inputList ) {
    var mapResult = await createActivityUidMaps( inputList );
    return getActivityOrderFromMap( mapResult );
};
/**
 * Get child nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} parentNode parentNode of Tree
 * @return {Array.Object} Array of modelObjects
 */
export let getChildNodesOfActivity = function( response, parentNode ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let found = false;
    if ( modelObjects ) {
        let parentObject = Object.values( modelObjects ).filter( modelObject => modelObject.uid === parentNode.uid && modelObject.props.me_cl_child_lines )[0];
        if ( parentObject ) {
            found = true;
            const objects = parentObject.props.me_cl_child_lines.dbValues;
            const input = [];
            objects.forEach( o => {
                if ( modelObjects[o] && modelObjects[o].modelType.typeHierarchyArray.includes( 'CfgActivityLine' ) ) {
                    input.push( {
                        uid: o
                    } );
                }
            }
            );
            return input;
        }
    }
    if ( !found ) {
        return [];
    }
};
/**
 * Save VMO in ctx
 * @param {Object} vmo view model object
 */
export let selectionChanged = function( vmo ) {
    if ( vmo !== undefined ) {
        if ( !appCtxSvc.ctx.selectedActivity ) {
            appCtxSvc.registerCtx( 'selectedActivity', vmo );
        }
        appCtxSvc.updateCtx( 'selectedActivity', vmo );
    } else {
        appCtxSvc.unRegisterCtx( 'selectedActivity' );
    }
    eventBus.publish( 'Ssp0ActivityNotices.triggerFunction' );
};
/**
 * Save VMO in ctx
 * @param {Object} vmo view model object
 */
export let saveVMOInCtxForXRT = function( vmo ) {
    if ( vmo ) {
        if ( !appCtxSvc.ctx.selectedVMO ) {
            appCtxSvc.registerCtx( 'selected', vmo );
        }
        appCtxSvc.updateCtx( 'selected', vmo );
    }
};
/**
 * Reload the tree
 * @param {Object} dataProvider dataProvider
 */
export let reloadActivitiesTree = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        appCtxSvc.unRegisterCtx( 'sortedUidLists' );
        eventBus.publish( 'activitiesTreeTable.plTable.reload' );
    }
};
/**
 * Get Tree Load Result of parent node
 * @param {Object} parentNode response of SOA
 * @return {Object} TreeLoadResult of node
 */
export let retrieveTreeLoadResult = function( parentNode ) {
    if ( !parentNode.uid ) {
        parentNode = parentNode.parentNode;
    }
    if ( treeNodeMap.has( parentNode.uid ) ) {
        return treeNodeMap.get( parentNode.uid );
    }
};
/**
 * Edit the table
 */
export let startEditTable = function() {
    //Start editing the table
};
export let getModelTypeHierarchy = function( vmo ) {
    const searchFolderObject = {
        uid: vmo.props.me_cl_fnd0objectId.dbValues[0],
        type: timeAnalysisConstants.TYPE_Activity
    };
    var getPropertiesInput = {
        objects: [ searchFolderObject ],
        attributes: [ 'object_string' ]
    };
    let promise = _getModelTypeSOA( getPropertiesInput );
    promise.then( ( result ) => {
        modelType = result.modelObjects[result.plain[0]].modelType;
        saveVMOInCtxForXRT( getVMO( vmo ).underlyingVMO );
    } );
};
/**
 * Build VMO for underlying MEActivity object and
 * FIXME - Get Type Hierarchy from CMM after a single init call
 */
export let getVMO = function( vmo ) {
    if ( modelType === null ) {
        modelType = cmm.getType( timeAnalysisConstants.TYPE_Activity );
    }
    let underlyingVMO = {
        uid: vmo.props.me_cl_fnd0objectId.dbValue,
        type: timeAnalysisConstants.TYPE_Activity,
        props: { object_string: vmo.props.object_string },
        modelType: modelType
    };
    appCtxSvc.updateCtx( 'pselected', underlyingVMO );
    return { underlyingVMO: underlyingVMO };
};
let _getModelTypeSOA = function( getPropertiesInput ) {
    return soaService.postUnchecked( 'Core-2006-03-DataManagement', 'getProperties', getPropertiesInput );
};
let updateMEActivityVMO = function() {
    return adapterSvc.getAdaptedObjectsSync( [ appCtxSvc.ctx.selected ] );
};
export let execute = function( selectedObjs ) {
    if ( selectedObjs ) {
        //Add all to clipboard
        ClipboardService.instance.setContents( selectedObjs[0] );
    }
};
export let getPreduidsFromPuid = function( puid ) {
    let value;
    if ( puidVsPreduidMap.has( puid ) ) {
        value = puidVsPreduidMap.get( puid );
    } else {
        throw new Error( 'Key not found in map' );
    }
    return value;
};
export let getRuntimeUidFromPuid = function( puids ) {
    let values = [];
    puids.forEach( puid => {
        if ( puidVsRuntimeUidMapForPert.has( puid ) ) {
            values.push( puidVsRuntimeUidMapForPert.get( puid ) );
        }
    } );
    return values;
};
/**
 * Get Remove Children SOA input
 * @param {Array} selectedObjs Selected Objects
 * @return {Array} array of input data
 */
export let getRemoveChildrenSOAInput = function( selectedObjs ) {
    let inputData = [];
    if ( selectedObjs ) {
        let parentObj = appCtxSvc.getCtx( 'selected' );
        selectedObjs.forEach( object => {
            let childrenObj = [];
            childrenObj.push( { uid: object.props.awp0Secondary.dbValue, type: object.type } );
            let propertyName = object.props.awp0RelationTypeName.dbValues[0];
            inputData.push( { childrenObj: childrenObj, parentObj: parentObj, propertyName: propertyName } );
        } );
    }
    return inputData;
};

export let storeOrderInfoInCtx = async function( selectedActivity ) {
    var parentActvityUID = selectedActivity.props.me_cl_parent.value;
    const searchObject1 = {
        uid: parentActvityUID
    };
    var getPropertiesInput1 = {
        objects: [ searchObject1 ],
        attributes: [ 'al_activity_contents' ]
    };
    var children = [];
    let result = await _getModelTypeSOA( getPropertiesInput1 );
    children = result.modelObjects[result.plain[0]].props.me_cl_child_lines.dbValues;
    var mapResult = await createActivityUidMaps( children );
    var sortedList = getActivityOrderFromMap( mapResult );
    var activityMaps = {
        puidVsRuntimeUidMap: mapResult.puidVsRuntimeUidMap,
        puidVsPredListMap: mapResult.puidVsPredListMap
    };
    appCtxSvc.updateCtx( 'sortedList', sortedList );
    appCtxSvc.updateCtx( 'activityMaps', activityMaps );
};
export let getkeyFromValue = function( keyValueMap, val ) {
    for ( const [ key, value ] of keyValueMap ) {
        if ( value === val ) {
            return key;
        }
    }
    return null; // Puid not found
};
export let getSucessorOfCurrentActivity = function( puidVsPredListMap, currentPuid ) {
    const sucessorList = [];
    for ( const [ puid, predList ] of puidVsPredListMap ) {
        if ( predList.includes( currentPuid ) ) {
            sucessorList.push( puid );
        }
    }
    return sucessorList;
};
export let moveActivityUp = async function( selectedActivity ) {
    var sortedUidList = appCtxSvc.getCtx( 'sortedList' );
    var activityMaps = appCtxSvc.getCtx( 'activityMaps' );
    let puidVsRuntimeUidMap = activityMaps.puidVsRuntimeUidMap;
    let puidVsPredListMap = activityMaps.puidVsPredListMap;
    var indexOfCurrentActivity = sortedUidList.indexOf( selectedActivity.uid );
    if ( indexOfCurrentActivity === sortedUidList.length - 1 ) {
        var predPuid = getkeyFromValue( puidVsRuntimeUidMap, sortedUidList[indexOfCurrentActivity - 1] );
        var currentPuid = getkeyFromValue( puidVsRuntimeUidMap, sortedUidList[indexOfCurrentActivity] );
        var predList = puidVsPredListMap.get( predPuid );
        if ( predList.includes( 'NullValue' ) ) {
            predList = [];
        }
        var input = {
            info: [],
            options: []
        };
        var inputInfo1 = {
            object: cdm.getObject( currentPuid )
        };
        inputInfo1.vecNameVal = [];
        inputInfo1.vecNameVal.push( {
            name: 'pred_list',
            values: predList
        } );
        input.info.push( inputInfo1 );
        var inputInfo2 = {
            object: cdm.getObject( predPuid )
        };
        inputInfo2.vecNameVal = [];
        inputInfo2.vecNameVal.push( {
            name: 'pred_list',
            values: [ currentPuid ]
        } );
        input.info.push( inputInfo2 );
        let response = await soaService.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', input );
        eventBus.publish( 'reloadActivitiesTree' );
    } else if ( indexOfCurrentActivity < sortedUidList.length && indexOfCurrentActivity > -1 ) {
        var predPuid = getkeyFromValue( puidVsRuntimeUidMap, sortedUidList[indexOfCurrentActivity - 1] );
        var currentPuid = getkeyFromValue( puidVsRuntimeUidMap, sortedUidList[indexOfCurrentActivity] );
        var predList = puidVsPredListMap.get( predPuid );
        if ( predList.includes( 'NullValue' ) ) {
            predList = [];
        }
        var sucessorList = getSucessorOfCurrentActivity( puidVsPredListMap, currentPuid );
        var input = {
            info: [],
            options: []
        };
        var inputInfo1 = {
            object: cdm.getObject( currentPuid )
        };
        inputInfo1.vecNameVal = [];
        inputInfo1.vecNameVal.push( {
            name: 'pred_list',
            values: predList
        } );
        input.info.push( inputInfo1 );
        var inputInfo2 = {
            object: cdm.getObject( predPuid )
        };
        inputInfo2.vecNameVal = [];
        inputInfo2.vecNameVal.push( {
            name: 'pred_list',
            values: [ currentPuid ]
        } );
        input.info.push( inputInfo2 );
        sucessorList.forEach( sucessor => {
            var inputInfo3 = {
                object: cdm.getObject( sucessor )
            };
            inputInfo3.vecNameVal = [];
            inputInfo3.vecNameVal.push( {
                name: 'pred_list',
                values: [ predPuid ]
            } );
            input.info.push( inputInfo3 );
        } );
        let response = await soaService.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', input );
        eventBus.publish( 'reloadActivitiesTree' );
    }
};
export let moveActivityDown = function( selectedActivity ) {
    var sortedUidList = appCtxSvc.getCtx( 'sortedList' );
    var indexOfCurrentActivity = sortedUidList.indexOf( selectedActivity.uid );
    if ( indexOfCurrentActivity > -1 ) {
        var sucessorActivity = cdm.getObject( sortedUidList[indexOfCurrentActivity + 1] );
        moveActivityUp( sucessorActivity );
    }
};
export let getPuidFromRuntimeId = function( runtimeId ) {
    for ( const [ puid, value ] of puidVsRuntimeUidMapForPert ) {
        if ( value === runtimeId ) {
            return puid;
        }
    }
    return null; // Key not found
};
export let getPredListFromPuid = function( puid ) {
    return puidVsPreduidMap.get( puid ) ? puidVsPreduidMap.get( puid ) : null; // Key not found
};
export let updatePuidToPredListMap = function( puid, newPredList ) {
    puidVsPreduidMap.set( puid, newPredList );
};
export let getPredListForNewlyCreatedNode = function( newNode ) {
    let currentPuid = newNode.props.me_cl_fnd0objectId.dbValues[0];
    puidVsRuntimeUidMapForPert.set( currentPuid, newNode.uid );
    const searchObject = {
        uid: currentPuid,
        type: timeAnalysisConstants.TYPE_Activity
    };
    var getPropertiesInput = {
        objects: [ searchObject ],
        attributes: [ 'pred_list' ]
    };
    soaService.postUnchecked( 'Core-2006-03-DataManagement', 'getProperties', getPropertiesInput ).then( function( response ) {
        let plain = response.plain;
        let modelObjects = response.modelObjects[plain[0]];
        let currentPredList = modelObjects.props.pred_list.dbValues;
        puidVsPreduidMap.set( plain[0], currentPredList );
        eventBus.publish( 'SSP0ActivityTree.reDrawPERTGraph' );
    } );
};

export default exports = {
    getPredListForNewlyCreatedNode,
    getRemoveChildrenSOAInput,
    updateMEActivityVMO,
    execute,
    getVMO,
    getModelTypeHierarchy,
    startEditTable,
    retrieveTreeLoadResult,
    reloadActivitiesTree,
    selectionChanged,
    getChildNodesOfActivity,
    setActivityNodeProperties,
    loadActivitiesTableColumns,
    storeOrderInfoInCtx,
    moveActivityUp,
    getPreduidsFromPuid,
    getRuntimeUidFromPuid,
    getChildNodesOfRootAct,
    getUidsOfChildNodes,
    addPredToMap,
    getChildNodesUids,
    moveActivityDown,
    getPuidFromRuntimeId,
    getPredListFromPuid,
    updatePuidToPredListMap,
    getkeyFromValue,
    getSucessorOfCurrentActivity
};
