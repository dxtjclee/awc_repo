// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to service plan tree
*
* @module js/ssp0TreeLoadDataServiceOfServicePlan

*/

import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import eventBus from 'js/eventBus';
import msgSvc from 'js/messagingService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import viewModelObjectService from 'js/viewModelObjectService';
import soaSvc from 'soa/kernel/soaService';
import ClipboardService from 'js/clipboardService';
import adapterSvc from 'js/adapterService';
import cdm from 'soa/kernel/clientDataModel';
import editHandlerService from 'js/editHandlerService';
import messagingService from 'js/messagingService';
import soaService from 'soa/kernel/soaService';
import localeService from 'js/localeService';

const servicePlanParent_Hierarchy_Type = 'BusinessObject';
const resource = 'ssp0Messages';
const localTextBundle = localeService.getLoadedText( resource );

let exports = {};
let alreadyLoaded = [];

const treeNodeMap = new Map();
const servicePlanTreeObjects = [ servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS, servicePlannerConstants.TYPE_SERVICE_CONTAINER_PROCESS,
    servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS, servicePlannerConstants.TYPE_WORK_CARD_PROCESS ];


/**
 * Reload the tree
 * @param {Object} dataProvider dataProvider
 */
export let reloadServicePlanTree = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        alreadyLoaded = [];
    }
    eventBus.publish( 'servicePlanTreeTable.plTable.reload' );
};

export let expandSelectedNode = function( nodeToBeExpanded, nodeToBeSelected, isForFirstLevel, dataProvider ) {
    if ( dataProvider !== null ) {
        let vmos;
        let vmoCollection = dataProvider.getViewModelCollection().loadedVMObjects;
        if ( isForFirstLevel ) {
            vmos = [ vmoCollection[0] ];
        } else {
            vmos = vmoCollection.filter( obj => {
                return obj.uid === nodeToBeExpanded.uid;
            } );
        }
        if ( vmos && vmos.length === 1 ) {
            if ( !vmos[0].isExpanded ) {
                vmos[0].isExpanded = true;
                vmos[0].isLeaf = false;
                if ( nodeToBeSelected ) {
                    const subscribeTreeNodesLoaded = eventBus.subscribe( 'servicePlanDataProvider.treeNodesLoaded', function( eventData ) {
                        let loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
                        let loadedObjectToToSelect = null;
                        if ( nodeToBeExpanded.type === servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS && nodeToBeExpanded.type !== nodeToBeSelected.type ) {
                            loadedObjectToToSelect = loadedObjects[loadedObjects.length - 1];
                        } else {
                            loadedObjectToToSelect = loadedObjects.filter( loadedObj => loadedObj.uid === nodeToBeSelected.uid );
                        }
                        dataProvider.selectionModel.setSelection( loadedObjectToToSelect );
                        eventBus.unsubscribe( subscribeTreeNodesLoaded );
                    } );
                }
                eventBus.publish( 'servicePlanTreeTable.plTable.toggleTreeNode', vmos[0] );
            }
        } else {
            // Log the errors
        }
    }
};

/**
 * Refresh the service plan tree
 * @param {Object} dataProvider dataProvider
 */
export let refreshServicePlanTree = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        alreadyLoaded = [];
    }

    eventBus.publish( 'servicePlanTreeTable.plTable.refreshClient' );
};


/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadServicePlanTreeTableColumns = async function( data, resetFlag ) {
    const localizeDisplayName = data.grids.servicePlanTreeTable.i18n;
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    let servercolumns = [];
    const zerothColumnConfigCol = {
        name: 'graphicVisibility',
        width: 50,
        enableFiltering: true,
        enableColumnResizing: true,
        pinnedLeft: true,
        columnOrder: 1,
        propertyName: 'graphicVisibility',
        pixelWidth: 50,
        hiddenFlag: false,
        displayName: 'Graphic Visibility',
        enableColumnMenu: false,
        enableColumnMoving: false
    };
    const firstColumnConfigCol = {
        name: 'object_name',
        displayName: localizeDisplayName.nameValueColumn,
        width: 285,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true,
        columnOrder: 2,
        propertyName: 'object_name',
        pixelWidth: 200,
        hiddenFlag: false
    };
    awColumnInfos.push( zerothColumnConfigCol );
    awColumnInfos.push( firstColumnConfigCol );
    var input = {
        getOrResetUiConfigsIn: [
            {
                scope: 'LoginUser',
                scopeName: '',
                clientName: 'AWClient',
                resetColumnConfig: resetFlag,
                columnConfigQueryInfos: [
                    {
                        clientScopeURI: 'Ssp0SpManagement',
                        operationType: 'union',
                        typeNames: [],
                        columnsToExclude: []
                    }
                ],
                businessObjects: [
                    {}
                ]
            }
        ]
    };
    await soaSvc.post( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', input ).then( function( response ) {
        servercolumns = response.columnConfigurations[0].columnConfigurations[0].columns;
    } );
    if ( servercolumns.length > 0 ) {
        servercolumns.forEach( column => {
            awColumnInfos.push( column );
        } );
    }
    saveColumnConfigToCtx( servercolumns );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'Ssp0SpManagement',
            objectSetUri: 'Ssp0SpManagement'
        }
    } );

    return deferred.promise;
};
/**
 * Save VMO in ctx
 * @param {Object} vmo view model object
 */
export let saveVMOInCtx = function( vmo ) {
    let revObjects = [];
    vmo.forEach( obj => {
        revObjects.push( cdm.getObject( obj.props.bl_revision.dbValue ) );
    } );
    if ( vmo[0] ) {
        if ( !appCtxSvc.ctx.selectedVMO ) {
            appCtxSvc.registerCtx( 'selectedVMO', vmo[0] );
        } else {
            appCtxSvc.updateCtx( 'selectedVMO', vmo[0] );
        }
        if ( !appCtxSvc.ctx.mselectedVMO ) {
            appCtxSvc.registerCtx( 'mselectedVMO', vmo );
        } else {
            appCtxSvc.updateCtx( 'mselectedVMO', vmo );
        }
        if ( !appCtxSvc.ctx.mselected ) {
            appCtxSvc.registerCtx( 'mselected', revObjects );
        } else {
            appCtxSvc.updateCtx( 'mselected', revObjects );
        }
        if ( vmo[0].modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS ) ||
            vmo[0].modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_WORK_CARD_PROCESS ) ) {
            eventBus.publish( 'Ssp0Parts.triggerFunction', { selectedObj: vmo[0] } );
            eventBus.publish( 'Ssp0Tools.triggerFunction', { selectedObj: vmo[0] } );
            eventBus.publish( 'Ssp0Notices.triggerFunction', { selectedObj: vmo[0] } );
        }


        eventBus.publish( 'partsTree.plTable.reload' );
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
 * Get child nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} parentNode parentNode of Tree
 * @return {Array.Object} Array of modelObjects
 */
export let getChildNodes = function( response, parentNode ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let found = false;
    if ( modelObjects ) {
        let parentObject = Object.values( modelObjects ).filter( modelObject => modelObject.uid === parentNode.uid && modelObject.props.bl_child_lines )[0];
        if ( parentObject ) {
            found = true;
            const objects = parentObject.props.bl_child_lines.dbValues;
            const input = [];
            objects.forEach( o => input.push( {
                uid: o
            } ) );
            return input;
        }
    }
    if ( !found ) {
        return [];
    }
};


/**
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} nodeBeingExpanded nodeBeingExpanded of Tree
 * @param {Object} data data
 * @return {Object} TreeLoadResult of node
 */
export let setNodeProperties = function( response, nodeBeingExpanded, data ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    const plain = response.plain;
    let objectsToReturn = [];
    if ( modelObjects ) {
        Object.values( modelObjects ).filter( modelObject =>
            plain.includes( modelObject.uid ) && servicePlanTreeObjects.includes( modelObject.type ) && modelObject.props && modelObject.props.bl_item_object_name &&
            !modelObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_PART_PROCESS ) ).forEach(
            modelObject => {
                let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( modelObject, 'create' );
                vmo.id = vmo.uid;
                vmo.props.is_modifiable = { dbValues: [], dbValue: true };
                if ( modelObject.props.bl_rev_object_name ) {
                    vmo.displayName = modelObject.props.bl_rev_object_name.dbValues[0];
                    vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                    vmo.underlyingObjectType = modelObject.type;
                    vmo.isVisible = false;
                }
                vmo.isLeaf = _checkIfLeaf( modelObject );
                vmo.alreadyExpanded = false;
                objectsToReturn.push( vmo );
                if ( modelObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS ) ) {
                    let selected = Object.values( modelObjects ).filter( spModelObject => spModelObject.uid === modelObject.props.bl_rev_fnd0objectId.dbValues[0] )[0];
                    appCtxSvc.registerCtx( 'selected', selected );
                    appCtxSvc.registerCtx( 'pselected', selected );
                    saveVMOInCtx( [ vmo ] );
                    getSecondaryPagePreference( selected.type );
                    vmo.servicePartitionUid = data.sourceContextUid.servicePartitionUid;
                }
            } );
    }
    if ( objectsToReturn.length === 0 ) {
        nodeBeingExpanded.isLeaf = true;
    }
    let endReachedVar = objectsToReturn.length > 0;
    var tempCursorObject = {
        endReached: endReachedVar,
        startReached: true
    };
    const parentNode = nodeBeingExpanded;
    parentNode.cursorObject = tempCursorObject;
    const treeLoadResult = {
        parentNode: parentNode,
        childNodes: objectsToReturn,
        totalChildCount: objectsToReturn.length,
        startChildNdx: 0

    };
    nodeBeingExpanded.alreadyExpanded = true;
    treeNodeMap.set( nodeBeingExpanded.uid, treeLoadResult );

    return treeNodeMap.get( nodeBeingExpanded.uid );
};

let _checkIfLeaf = function( modelObject ) {
    if ( modelObject.props.bl_quick_num_children && modelObject.props.Mfg0all_material ) {
        const childCount = parseInt( modelObject.props.bl_quick_num_children.dbValues[0], 10 ); // Converting String to num.. Used 10 for base 10 values
        return childCount === 0 || childCount === modelObject.props.Mfg0all_material.dbValues.length;
    }
    return modelObject.props.bl_has_children.dbValues[0] === '0';
};

/**
 * Get source context uid
 * @param {Object} response response of SOA
 * @return {Object} Object contains uid of service plan and service partition
 */
export let getSourceContextUid = function( response ) {
    return {
        servicePartitionUid: response.output[0].contexts[0].views[0].uid,
        servicePlanUid: response.output[0].contexts[0].context.uid,
        ServiceData: response.ServiceData
    };
};

/**
 * If response contains errors show them else trigger the event to consume parts
 * @param {Object} response response of SOA
 */
export let consumeAndLoadParts = function( response, selection ) {
    if ( response ) {
        if ( response.ServiceData.partialErrors && response.ServiceData.partialErrors[0] && response.ServiceData.partialErrors[0].errorValues ) {
            response.ServiceData.partialErrors[0].errorValues.forEach( errorValue => {
                msgSvc.showError( errorValue.message );
            } );
        } else {
            eventBus.publish( 'Ssp0Parts.triggerFunction', { selectedObj: appCtxSvc.getCtx( 'selectedVMO' ), selection: selection } );
            eventBus.publish( 'Ssp0Tools.triggerFunction', { selectedObj: appCtxSvc.getCtx( 'selectedVMO' ), selection: selection } );
        }
    }
};


/**
 * If response contains errors show them else trigger the event to consume parts
 * @param {Object} nodeBeingExpanded nodeBeingExpanded
 * @return {Array} array of uid
 */
export let getNodesUids = function( nodeBeingExpanded ) {
    let a = nodeBeingExpanded.props.bl_child_lines.dbValue;
    let uids = [];
    a.forEach( element => {
        uids.push( { uid: element } );
    } );
    return uids;
};
export let getStringArrayProps = function( SelectedTab, prefValueParts, prefValueTools, sourceObjectsLength ) {
    if ( SelectedTab === 'parts' ) {
        return new Array( sourceObjectsLength ).fill( prefValueParts[0]);
    } else if ( SelectedTab === 'tools' ) {
        return new Array( sourceObjectsLength ).fill( prefValueTools[0]);
    }
    return [];
};
export let subscribeToNodesLoaded = function() {
    const subscribeTreeNodesLoaded = eventBus.subscribe( 'servicePlanDataProvider.treeNodesLoaded', function( eventData ) {
        eventBus.publish( 'expandSelectedNode', {
            isForFirstLevel: true
        } );
        eventBus.unsubscribe( subscribeTreeNodesLoaded );
    } );
};
/**
 * Get revision object and Save it in ctx
 * @param {Object} response response of SOA
 */
export let getRevisionObject = function( response ) {
    let modelObjects = undefined;
    const plain = response.plain;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let selected = Object.values( modelObjects ).filter( modelObject =>
        plain.includes( modelObject.uid ) )[0];
    if ( !appCtxSvc.ctx.selected ) {
        appCtxSvc.registerCtx( 'selected', selected );
        appCtxSvc.registerCtx( 'pselected', selected );
    } else {
        appCtxSvc.updateCtx( 'selected', selected );
        appCtxSvc.updateCtx( 'pselected', selected );
    }
};

/**
 * Get Remove Children SOA input
 * @param {Array} selectedObjs Selected Objects
 * @return {Array} array of input data
 */
export let getRemoveChildrenInput = function( selectedObjs ) {
    let inputData = [];
    if ( selectedObjs ) {
        let parentObj = appCtxSvc.getCtx( 'selected' );
        selectedObjs.forEach( object => {
            let childrenObj = [];
            childrenObj.push( { uid: object.props.awp0Secondary.dbValue, type: object.props.object_type.dbValue } );
            let propertyName = object.props.awp0RelationTypeName.dbValues[0];

            inputData.push( { childrenObj: childrenObj, parentObj: parentObj, propertyName: propertyName } );
        } );
    }
    return inputData;
};

/**
 * Add Selected Objects to clipboard
 * @param {Array} selectedObjs Selected Objects
 */
export let copyObjectToClipBoard = function( selectedObjs ) {
    if ( selectedObjs ) {
        //Add all to clipboard
        ClipboardService.instance.setContents( selectedObjs[0] );
    }
};

/**
 * Update Service Plan Tree Object
 * @return {Object} the underlying parameter object of the proxy object
 */
let updateSPVMO = function() {
    return adapterSvc.getAdaptedObjectsSync( [ appCtxSvc.ctx.selected ] );
};
/**
 * Reload the tree
 * @param {Object} data data
 */
export let reloadServicePlan = function( data ) {
    eventBus.subscribe( 'workflow.updateTaskCount', function( data ) {
        eventBus.publish( 'servicePlanTreeTable.plTable.reload', {
            retainTreeExpansionStates: true
        } );
    } );
};
/**
 * save coulmn config to CTX
 * @param {Object} data data
 */
let saveColumnConfigToCtx = function( columnConfig ) {
    let columns = [];
    columnConfig.forEach( element => {
        columns.push( element.propertyName );
    } );
    appCtxSvc.registerCtx( 'servicePlanProperties', columns );
};

/**
 * get child node attributes
 * @return {Array} array of properties to load
 */
let getChildNodeAttributes = function() {
    let attributes = [
        'awb0RevisionOwningGroup',
        'bl_rev_checked_out',
        'awb0RevisionLastModifiedUser',
        'awb0RevisionOwningUser',
        'bl_has_children',
        'bl_child_lines',
        'bl_item_object_name',
        'bl_item_item_id',
        'bl_occ_type',
        'bl_line_object',
        'bl_parent',
        'awp0ThumbnailImageTicket',
        'Mfg0all_material',
        'bl_quick_num_children',
        'Mfg0predecessors',
        'bl_rev_fnd0objectId',
        'bl_bomview_rev',
        'Mfg0used_equipment'
    ];

    let columnsFromServer = appCtxSvc.getCtx( 'servicePlanProperties' );

    return attributes.concat( columnsFromServer );
};
/**
 * get parent node attributes
 * @return {Array} array of properties to load
 */
let getParentNodeAttributes = function() {
    let attributes = [
        'awb0RevisionOwningGroup',
        'bl_rev_checked_out',
        'awb0RevisionLastModifiedUser',
        'awb0RevisionOwningUser',
        'bl_has_children',
        'bl_child_lines',
        'bl_item_object_name',
        'bl_item_item_id',
        'bl_occ_type',
        'bl_line_object',
        'bl_parent',
        'bl_item_object_desc',
        'awp0ThumbnailImageTicket',
        'bl_quick_num_children',
        'Mfg0predecessors',
        'bl_rev_fnd0objectId',
        'bl_bomview_rev'
    ];

    let columnsFromServer = appCtxSvc.getCtx( 'servicePlanProperties' );

    return attributes.concat( columnsFromServer );
};

/**
 * Edit the table
 * @param {Object} handler handler
 */
export let startEdit = function( handler ) {
    //Start editing the table
    if ( handler ) {
        editHandlerService.setActiveEditHandlerContext( handler );

        if ( !editHandlerService.isEditEnabled() ) {
            var editHandler = editHandlerService.getEditHandler( handler );
            editHandler._editing = false;
            if ( editHandler.canStartEdit() && !editHandler.editInProgress() ) {
                editHandler.startEdit();
            } else {
                editHandler._editing = true;
            }
        }
        appCtxSvc.registerCtx( 'ssp0ServicePlanTreeEditInProgress', true );
        appCtxSvc.registerCtx( 'editInProgress', true );
    }
};
/**
 * paste object on selection
 * @param {Object} sourceObjects object to paste
 * @param {Object} targetObject object on which sourceObject will be get paste
 * @param {String} relationType relation type name
 */
export let connectObjects = function( sourceObjects, targetObjects, relationType ) {
    let input = [];
    for ( let targetObject of targetObjects ) {
        for ( let sourceObject of sourceObjects ) {
            input.push( {
                targetObjects: [ {
                    uid: targetObject.uid,
                    type: targetObject.type
                } ],
                sourceInfo: {
                    sourceObjects: [ {
                        uid: sourceObject.uid,
                        type: sourceObject.type
                    } ],
                    relationType: '',
                    relationName: '',
                    additionalInfo: {
                        stringArrayProps: {
                            relationType: relationType
                        },
                        boolProps: {
                            occTypeFromPreferenceFlag: true
                        }
                    }
                }
            } );
        }
    }
    soaService.postUnchecked( 'Manufacturing-2012-02-DataManagement', 'connectObjects', {
        input: input
    } )
        .then( function( response ) {
            let msg = '';
            if ( response.partialErrors && response.partialErrors.length > 0 ) {
                showError( response.partialErrors );
            } else if ( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length > 0 ) {
                showError( response.ServiceData.partialErrors );
            } else {
                let copiedObject = appCtxSvc.getCtx( 'awSpClipBoardProvider' );
                let target = appCtxSvc.getCtx( 'selectedVMO' );
                msg = localTextBundle.objectPasted;
                msg = msg.replace( '{0}', copiedObject[0].props.bl_item_object_name.dbValue );
                msg = msg.replace( '{1}', target.props.bl_item_object_name.dbValue );
                messagingService.showInfo( msg );
                var values = response.ServiceData.created.map( function( Objeuid ) {
                    return response.ServiceData.modelObjects[Objeuid];
                } );
                var bopLine = values.filter( function( ele ) {
                    return ele.modelType.typeHierarchyArray.includes( 'ImanItemBOPLine' );
                } );
                eventBus.publish( 'SSP0ServicePlanTree.newNodeAdded', {
                    soaResult: response,
                    childNodeUid: bopLine[0].uid
                } );
            }
        } );
};
/**
 *
 * @param {Array} partialErrors - partial errors array
 */
function showError( partialErrors ) {
    for ( let i = 0; i < partialErrors.length; i++ ) {
        messagingService.showError( partialErrors[i].errorValues[0].message );
    }
}

/**
 *
 * @param {Array} input - partial errors array
 */
function copySelectionInClipBoard( ctx, input ) {
    if ( ctx && ctx.awSpClipBoardProvider ) {
        appCtxSvc.updateCtx( 'awSpClipBoardProvider', input );
    } else {
        appCtxSvc.registerCtx( 'awSpClipBoardProvider', input );
    }
}

/**
 *
 * @param {string} IdName - a given id name
 * @return {string} a random and unique ID
 */
export function generateUniqueId( IdName ) {
    return `${IdName}${Math.random().toString()}`;
}

/**
 * paste duplicate object on selection
 * @param {Object} sourceObjects object to paste
 * @param {Object} newObjectID new object uid
 * @param {Object} targetObjects object on which sourceObjects will be get paste
 * @param {String} revRule revision rule
 */
export let pasteDuplicateServiceReuirement = function( sourceObjects, newObjectID, targetObjects, revRule ) {
    let sourceRevUID = sourceObjects[0]?.props?.bl_revision?.dbValue;
    let sourceRev = cdm.getObject( sourceRevUID );
    let targetObjectUID = targetObjects.uid;
    let input = {
        saveInput: {
            sections: [ {
                sectionName: 'ObjectsToClone',
                dataEntries: [ {
                    entry: {
                        Object: {
                            nameToValuesMap: {
                                id: [
                                    newObjectID
                                ],
                                connectTo: [
                                    targetObjectUID
                                ],
                                cloneFrom: [
                                    sourceRevUID
                                ],
                                revisionRule: [
                                    revRule
                                ]
                            }
                        }
                    }
                } ]
            } ],
            relatedObjects: {
                [sourceRevUID]: {
                    uid: sourceRevUID,
                    type: sourceRev.type
                },
                [targetObjectUID]: {
                    uid: targetObjectUID,
                    type: targetObjects.type
                }
            }
        }
    };
    soaService.postUnchecked( 'Internal-MfgBvrCore-2022-12-DataManagement', 'saveData4', input )
        .then( function( response ) {
            let msg = '';
            if ( response.partialErrors && response.partialErrors.length > 0 ) {
                showError( response.partialErrors );
            } else if ( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length > 0 ) {
                showError( response.ServiceData.partialErrors );
            } else {
                let copiedObject = appCtxSvc.getCtx( 'awSpClipBoardProvider' );
                let target = appCtxSvc.getCtx( 'selectedVMO' );
                msg = localTextBundle.objectPasteDuplicated;
                msg = msg.replace( '{0}', copiedObject[0].props.bl_item_object_name.dbValue );
                msg = msg.replace( '{1}', target.props.bl_item_object_name.dbValue );
                messagingService.showInfo( msg );
                let uid = response.saveResults[response.saveResults.length - 1].saveResultObject.uid;
                var values = [ response.ServiceData.modelObjects[uid] ];
                var bopLine = values.filter( function( ele ) {
                    return ele.modelType.typeHierarchyArray.includes( 'ImanItemBOPLine' );
                } );
                eventBus.publish( 'SSP0ServicePlanTree.newNodeAdded', {
                    soaResult: response,
                    childNodeUid: bopLine[0].uid
                } );
            }
        } );
};

/**
 * Get Secondary Page Preference
 * @param {String} servicePlanType Type of Service Plan
 * @return {Object} context
 */
export let getSecondaryPagePreference = function( servicePlanType ) {
    let servicePlanUid = appCtxSvc.getCtx( 'state.params.uid' );
    const body = {
        inputData: {
            product: {

                uid: servicePlanUid
            },
            config: {
                effectivityDate: '0001-01-01T00:00:00',
                unitNo: -1
            },
            cursor: {},
            focusOccurrenceInput: {},
            filter: {},
            requestPref: {
                openWPMode: [ 'sbom_only' ]
            },
            sortCriteria: {}
        }
    };
    const servicePlan_Hierarchy_Type_Array = [ servicePlannerConstants.TYPE_SERVICE_PLAN_REVISION, servicePlanParent_Hierarchy_Type ];
    if ( servicePlanType !== servicePlannerConstants.TYPE_SERVICE_PLAN_REVISION ) {
        servicePlan_Hierarchy_Type_Array.unshift( servicePlanType );
    }
    return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', body ).then( function( response ) {
        if ( response && response.userWorkingContextInfo.sublocationAttributes.awb0ActiveSublocation ) {
            let context = {
                viewKey: 'servicePlanContext',
                editContext: 'servicePlanDataProvider'
            };
            const secondaryActiveTabId = response.userWorkingContextInfo.sublocationAttributes.awb0ActiveSublocation[0];
            if ( secondaryActiveTabId !== undefined ) {
                context.pageContext = {
                    sublocationState: {
                        secondaryActiveTabId: secondaryActiveTabId
                    }
                };
            }
            const subscribeTabSetPageLoaded = eventBus.subscribe( 'servicePlanTreeTable.plTable.loadMorePages', function() {
                context = {
                    viewKey: 'servicePlanContext',
                    editContext: 'servicePlanDataProvider'
                };
                appCtxSvc.updateCtx( 'ssp0SecondaryPageContext', context );
                eventBus.unsubscribe( subscribeTabSetPageLoaded );
            } );
            appCtxSvc.registerCtx( 'ssp0SecondaryPageContext', context );
        }
    } );
};
export let checkParentType = function() {
    let selectedItem = appCtxSvc.getCtx( 'selectedVMO' );
    let parentUid = selectedItem.props.bl_parent.dbValue;
    let parentType = cdm.getObject( parentUid );
    if ( !appCtxSvc.ctx.parentType ) {
        appCtxSvc.registerCtx( 'parentType', parentType.type );
    } else {
        appCtxSvc.updateCtx( 'parentType', parentType.type );
    }
};

export let removeSelectionInClipBoard = function() {
    // Extracting information about the selected objects
    let selectedItem = appCtxSvc.getCtx( 'selectedVMO' );
    let sourceRevUID = selectedItem.props.bl_line_object.parentUid;
    let sourceRev = cdm.getObject( sourceRevUID );
    let parentRevUID = selectedItem.props.bl_parent.dbValue;
    let parentRev = cdm.getObject( parentRevUID );

    // Constructing the input for the service call
    let soaInput = {
        saveInput: {
            sections: [ {
                sectionName: 'ObjectsToDelete',
                dataEntries: [ {
                    entry: {
                        Object: {
                            nameToValuesMap: {
                                Type: [
                                    sourceRev.type
                                ],
                                id: [
                                    sourceRevUID
                                ],
                                connectTo: [
                                    parentRevUID
                                ]
                            }
                        }
                    }
                } ]
            } ],
            relatedObjects: {
                [sourceRevUID]: {
                    uid: sourceRevUID,
                    type: sourceRev.type
                },
                [parentRevUID]: {
                    uid: parentRevUID,
                    type: parentRev.type
                }
            }
        }
    };

    // Making the asynchronous service call
    soaService.postUnchecked( 'Internal-MfgBvrCore-2022-12-DataManagement', 'saveData4', soaInput )
        .then( function( response ) {
            if ( response.partialErrors && response.partialErrors.length > 0 ) {
                showError( response.partialErrors );
            } else if ( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length > 0 ) {
                showError( response.ServiceData.partialErrors );
            } else {
                // Publishing an event to refresh the client after successful deletion
                eventBus.publish( 'servicePlanTreeTable.plTable.refreshClient' );
            }
        } )
        .catch( function( error ) {
            // Handling unexpected errors
            console.error( 'Error occurred:', error );
        } );
};

export let getCurrentRevRule = async function( sourceContextUid ) {
    let revRule = '';
    let servicePlanUid = sourceContextUid.servicePlanUid;
    let bopWindows = [];
    let modelObjects = [];
    modelObjects = sourceContextUid.ServiceData.modelObjects;
    if ( modelObjects ) {
        Object.values( modelObjects ).filter( modelObject => modelObject.type === 'BOPWindow' ).forEach( object => {
            bopWindows.push( object );
        } );
    }

    var getPropertiesInput = {
        objects: bopWindows,
        attributes: [ 'revision_rule', 'top_line' ]
    };

    let result = await soaSvc.postUnchecked( 'Core-2006-03-DataManagement', 'getProperties', getPropertiesInput );

    result?.plain.forEach( object => {
        if( result.modelObjects[object].props.top_line.dbValues[0] === servicePlanUid ) {
            revRule = result.modelObjects[object].props.revision_rule.uiValues[0];
        }
    } );
    appCtxSvc.updateCtx( 'CurrentRevisionRule', revRule );

    return revRule;
};

export let updateRevRule = function( currentRevRule ) {
    let currentRevisionRule = appCtxSvc.getCtx( 'CurrentRevisionRule' );
    currentRevRule.uiValue = currentRevisionRule;
    return currentRevRule;
};

/**
 * function to get selected elements
 */
function getInputForAllocation(  ) {
    let multipleSelections = appCtxSvc.getCtx( 'mselectedVMO' );
    let mselected = [];
    multipleSelections.forEach( element => {
        mselected.push( { uid:element.uid, type:element.type } );
    } );
    return mselected;
}
export default exports = {
    startEdit,
    subscribeToNodesLoaded,
    getStringArrayProps,
    getNodesUids,
    consumeAndLoadParts,
    getSourceContextUid,
    getChildNodes,
    setNodeProperties,
    retrieveTreeLoadResult,
    saveVMOInCtx,
    loadServicePlanTreeTableColumns,
    reloadServicePlanTree,
    refreshServicePlanTree,
    expandSelectedNode,
    copyObjectToClipBoard,
    updateSPVMO,
    getRevisionObject,
    getRemoveChildrenInput,
    reloadServicePlan,
    getChildNodeAttributes,
    getParentNodeAttributes,
    connectObjects,
    copySelectionInClipBoard,
    generateUniqueId,
    pasteDuplicateServiceReuirement,
    removeSelectionInClipBoard,
    checkParentType,
    getCurrentRevRule,
    updateRevRule,
    getInputForAllocation
};
