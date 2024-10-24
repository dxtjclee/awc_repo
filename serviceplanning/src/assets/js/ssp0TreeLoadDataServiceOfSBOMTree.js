// Copyright (c) 2022 Siemens

/**
* Service for loading tree data of SBOM
*
* @module js/ssp0TreeLoadDataServiceOfSBOMTree
*/
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import cdmService from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import parsingUtils from 'js/parsingUtils';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaSvc from 'soa/kernel/soaService';

let exports = {};
let alreadyLoaded = [];
const treeNodeMap = new Map();
const IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

/**
 * Get a page of row column data for a tree-table.
 * @param {Object} dataProvider dataProvider
 * @param {String} gridId grid Id
 * @param {Array} vmNodes array of visible view model object
 * @param {Object} context Context
 * @return {promise} an promise resolves
 */
export let loadTreeTableProperties = function( dataProvider, gridId, vmNodes, context ) {
    let currentVmNodes = [];
    _.forEach( vmNodes, function( vmNode ) {
        if ( !alreadyLoaded.some( loadedNode => loadedNode.uid === vmNode.uid ) ) {
            currentVmNodes.push( vmNode );
        }
    } );
    if ( currentVmNodes.length > 0 ) {
        return new Promise( function( resolve, reject ) {
            resolve( _loadProperties( dataProvider, gridId, currentVmNodes, context ) );
        } );
    }
    const propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( currentVmNodes );
    return {
        propertyLoadResult: propertyLoadResult
    };
};

/**
 * Initial call for getting a page of row column data for a tree-table.
 * @param {Object} dataProvider dataProvider
 * @param {String} gridId grid Id
 * @param {Array} vmNodes array of visible view model object
 * @param {Object} context Context
 * @return {promise} an promise resolves
 */
export let initialLoadTreeTableProperties = function( dataProvider, gridId, vmNodes, context ) {
    dataProvider.columnConfigLoadingInProgress = true;
    let currentVmNodes = [];
    let loadVMOPropsThreshold = 0;
    _.forEach( vmNodes, function( vmNode ) {
        if ( !vmNode.props ) {
            vmNode.props = {};
        }
        if ( !alreadyLoaded.some( loadedNode => loadedNode.uid === vmNode.uid ) && loadVMOPropsThreshold <= 50 ) {
            currentVmNodes.push( vmNode );
            loadVMOPropsThreshold++;
        }
    } );
    if ( currentVmNodes.length > 0 ) {
        return new Promise( function( resolve, reject ) {
            resolve( _loadProperties( dataProvider, gridId, currentVmNodes, context ) );
        } );
    }
    const propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( currentVmNodes );
    return {
        propertyLoadResult: propertyLoadResult
    };
};

/**
 * Initial call for getting a page of row column data for a tree-table.
 * @param {Object} dataProvider dataProvider
 * @param {String} gridId grid Id
 * @param {Array} vmNodes array of visible view model object
 * @param {Object} context Context
 * @return {Object} propertyLoadResult
 */
function _loadProperties( dataProvider, gridId, vmNodes, context ) {
    let allChildNodes = [];
    alreadyLoaded.push( ...vmNodes );

    _.forEach( vmNodes, function( vmNode ) {
        if ( !vmNode.props || !_.size( vmNode.props ) ) {
            vmNode.props = {};
        }
        allChildNodes.push( vmNode );
    } );

    let propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );
    propertyLoadResult.columnConfig = dataProvider.columnConfig;

    const resolutionObj = {
        propertyLoadResult: propertyLoadResult
    };
    if ( allChildNodes.length > 0 ) {
        return tcVmoService.getTableViewModelProperties( allChildNodes, context ).then(
            function() {
                eventBus.publish( gridId + '.plTable.clientRefresh' );
            } ).then(
            function() {
                return resolutionObj;
            }
        );
    }
    return resolutionObj;
}

/**
 * Get Row column for tree table
 * @param {Object} data data
 * @param {Object} columnProvider columnProvider
 * @return {Promise} deferred promise
 */
export let loadTreeTableColumns = async function( data, columnProvider, resetFlag ) {
    const localizeDisplayName = data.grids.sbomTree.i18n;
    let servercolumns = [];
    const zerothColumnConfigCol = {
        name: 'graphicVisibility',
        width: 50,
        enableFiltering: true,
        enableColumnResizing: true,
        pinnedLeft: true,
        columnOrder: 90,
        propertyName: 'graphicVisibility',
        pixelWidth: 50,
        hiddenFlag: false,
        displayName: 'Graphic Visibility',
        enableColumnMenu: false,
        enableColumnMoving: false
    };
    const firstColumnConfigCol = {
        name: 'object_string',
        displayName: localizeDisplayName.elementValueColumn,
        typeName: 'Awb0Element',
        width: 300,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true,
        columnOrder: 100,
        propertyName: 'object_string',
        pixelWidth: 300,
        hiddenFlag: false
    };

    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];

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
                        clientScopeURI: 'Ssp0SbomManagement',
                        operationType: 'OVERWRITE',
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
            if( column.propertyName !== 'object_string' ) { awColumnInfos.push( column ); }
        } );
    }
    let clientColumns = columnProvider && columnProvider.clientColumns ? columnProvider.clientColumns : [];
    if ( clientColumns ) {
        _.forEach( clientColumns, function( column ) {
            if ( column.clientColumn ) {
                const column1 = awColumnInfos.find( awColumn =>{ return  awColumn.propertyName === column.propertyName; } );
                if( column1 === undefined ) {
                    awColumnInfos.push( column );
                }
            }
        } );
    }
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'Ssp0SbomManagement',
            objectSetUri: 'Ssp0SbomManagement'
        }
    } );

    return deferred.promise;
};

/**
 * Extracts the view model properties from response and updates the corresponding viewmodelObject
 *
 * @param {ViewModelObject[]} viewModelObjects - view model object to update.
 * @param {Object} response - response
 */
function processViewModelObjectsFromJsonResponse( viewModelObjects, response ) {
    // update the view model object with the view model properties.
    if ( response.viewModelJSON && !response.viewModelPropertiesJsonString ) {
        // remove after SOA is updated
        response.viewModelPropertiesJsonString = response.viewModelJSON;
    }

    if ( response && response.viewModelPropertiesJsonString ) {
        const responseObject = parsingUtils.parseJsonString( response.viewModelPropertiesJsonString );
        const objectsInResponse = responseObject.objects;

        _.forEach( viewModelObjects, function( viewModelObject ) {
            let objectUpdated = false;
            if ( viewModelObject ) {
                _.forEach( objectsInResponse, function( currentObject ) {
                    if ( !objectUpdated && currentObject && currentObject.uid === viewModelObject.uid ) {
                        exports.mergeObjects( viewModelObject, currentObject );
                        objectUpdated = true;
                    }
                } );
            }
        } );
    }
}

/**
 * Merges the properties of a view model object and either another view model object, or a server view model object
 * from the SOA response.
 *
 * @param {ViewModelObject} targetViewModelObject - target object to merge to.
 * @param {ViewModelObject|Object} sourceViewModelObject - source object to merge values (overrides target values)
 */
export let mergeObjects = function( targetViewModelObject, sourceViewModelObject ) {
    let responseViewModelObject = sourceViewModelObject;

    if ( !viewModelObjectSvc.isViewModelObject( sourceViewModelObject ) ) {
        responseViewModelObject = viewModelObjectSvc.createViewModelObject( sourceViewModelObject.uid, 'EDIT', null, sourceViewModelObject );
    }

    let visible = targetViewModelObject.visible;
    _.merge( targetViewModelObject, responseViewModelObject );
    targetViewModelObject.visible = visible;
};

/**
 * Reset the Tree Properties
 * @param {Object} dataProvider dataProvider
 */
let resetTreeProps = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        alreadyLoaded = [];
    }
};

/**
 * Get a page of row column data for a tree-table.
 * @param {Object} response response of SOA
 * @param {String} nodeBeingExpanded Node being expanded
 * @param {Array} ctx ctx
 * @param {Object} dataProvider dataProvider
 * @return {Object} TreeLoadResult of node
 */
export let setParentNodeProperties = function( response, nodeBeingExpanded, ctx, dataProvider ) {
    resetTreeProps( dataProvider );
    if ( response.rootProductContext ) {
        appCtxSvc.registerCtx( 'sbomProductContext', response.rootProductContext );
    }
    const modelObjects = response.parentChildrenInfos[0].parentInfo || response.data.parentChildrenInfos[0].parentInfo;
    let objectsToReturn = [];
    if ( modelObjects ) {
        const modelObjectJson = modelObjects;
        if ( cdmService.isValidObjectUid( modelObjectJson.occurrenceId ) ) {
            let vmo = getObject( modelObjectJson.occurrenceId );
            if ( modelObjectJson ) {
                vmo.displayName = modelObjectJson.displayName;
                vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                vmo.isVisible = false;
                vmo.isExpanded = false;
                vmo.isLeaf = modelObjectJson.numberOfChildren === 0;
            }
            vmo.alreadyExpanded = false;
            objectsToReturn.push( vmo );
            saveVMOInCtxForSecondaryView( vmo );
        }
    }
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

/**
 * Get neutral Product Uid.
 * @param {Object} response response of SOA
 * @return {String} uid
 */
export let getNeutralProductUid = function( response ) {
    let uid = '';
    if ( response && response.output[0] ) {
        uid = response.output[0].relationshipData[0].relationshipObjects[0].otherSideObject.uid;
    }
    return uid;
};

/**
 * Get a page of row column data for a tree-table.
 * @param {Object} response response of SOA
 * @param {String} nodeBeingExpanded Node being expanded
 * @return {Object} TreeLoadResult of node
 */
export let setChildNodeProperties = function( response, nodeBeingExpanded ) {
    const modelObjects = response.parentChildrenInfos[0].childrenInfo || response.data.parentChildrenInfos[0].childrenInfo;
    let objectsToReturn = [];
    if ( modelObjects ) {
        Object.values( modelObjects ).filter( modelObject => modelObject.displayName && modelObject.occurrenceId ).forEach( modelObject => {
            if ( cdmService.isValidObjectUid( modelObject.occurrenceId ) ) {
                let vmo = getObject( modelObject.occurrenceId );

                if ( modelObject ) {
                    vmo.displayName = modelObject.displayName;
                    if ( vmo.type === 'unknownType' ) {
                        vmo.type = modelObject.underlyingObjectType;
                    }
                    vmo.uid = modelObject.occurrenceId;
                    vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                    vmo.isVisible = false;
                    vmo.isLeaf = modelObject.numberOfChildren === 0;
                }
                vmo.props = {};
                vmo.alreadyExpanded = false;
                objectsToReturn.push( vmo );
            }
        } );
    }
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

/**
 * Get Tree Load Result of parent node
 * @param {Object} parentNode parentnode of tree
 * @return {Object} TreeLoadResult of node
 */
export let retrieveTreeLoadResult = function( parentNode ) {
    if ( !parentNode.uid ) {
        parentNode = parentNode.parentNode;
    }

    if ( parentNode.totalChildCount !== null ) {
        let tem = treeNodeMap.get( parentNode.uid ).parentNode;
        tem.children = [];
        tem.totalChildCount = null;
        return tem;
    }

    if ( treeNodeMap.has( parentNode.uid ) ) {
        return treeNodeMap.get( parentNode.uid );
    }
};

/**
* Get Model object of given uid.
* @param {String} uid uid of object
* @return {Object} IModelObject
*/
export let getObject = function( uid ) {
    if ( cdmService.isValidObjectUid( uid ) ) {
        const obj = cdmService.getObject( uid );

        if ( !obj ) {
            return new IModelObject( uid, 'unknownType' );
        }

        return obj;
    }

    return new IModelObject( cdmService.NULL_UID, 'unknownType' );
};

/**
* Get Uid of Service Plan Object
* @param {Object} response response
* @return {Object} IModelObject
*/
export let getServicePlanID = function( response ) {
    const modelObjects = response.modelObjects;
    if ( modelObjects ) {
        let servicePlanUid = '';
        Object.values( modelObjects ).filter( modelObject => modelObject.props.items_tag ).forEach( modelObject => {
            servicePlanUid = modelObject.props.items_tag.dbValues[0];
        } );
        return {
            uid: servicePlanUid,
            type: 'SSP0ServicePlan'

        };
    }
};

export let subscribeToNodesLoaded = function() {
    const subscribeTreeNodesLoaded = eventBus.subscribe( 'sbomTreeDataProvider.treeNodesLoaded', function( eventData ) {
        eventBus.publish( 'SBOMTree.expandSelectedNode', {} );
        eventBus.unsubscribe( subscribeTreeNodesLoaded );
    } );
};

export let expandSelectedNode = function( dataProvider ) {
    if ( dataProvider !== null ) {
        let vmo;
        let vmoCollection = dataProvider.getViewModelCollection().loadedVMObjects;
        vmo = vmoCollection[0];
        if ( vmo ) {
            if ( !vmo.isExpanded && !vmo.isLeaf ) {
                vmo.isExpanded = true;
                vmo.isLeaf = false;
                eventBus.publish( 'sbomTree.plTable.toggleTreeNode', vmo );
            }
        } else {
            // Log the errors
        }
    }
};

/**
 * Save VMO in ctx
 * @param {Object} vmo view model object
 */
export let saveVMOInCtx = function( vmo ) {
    let revObjects = [];
    vmo.forEach( obj=>{
        revObjects.push( cdmService.getObject( obj.props.awb0UnderlyingObject.dbValues[0] ) );
    } );
    if ( vmo[0] ) {
        if ( !appCtxSvc.ctx.selectedSBOM ) {
            appCtxSvc.registerCtx( 'selectedSBOM', revObjects[0] );
        } else {
            appCtxSvc.updateCtx( 'selectedSBOM', revObjects[0] );
        }
        if ( !appCtxSvc.ctx.selectedSBOMForXRT ) {
            appCtxSvc.registerCtx( 'selectedSBOMForXRT', vmo[0] );
        } else {
            appCtxSvc.updateCtx( 'selectedSBOMForXRT', vmo[0] );
        }
        if ( !appCtxSvc.ctx.mselectedSBOM ) {
            appCtxSvc.registerCtx( 'mselectedSBOM', revObjects );
        } else {
            appCtxSvc.updateCtx( 'mselectedSBOM', revObjects );
        }
    }
};

/**
 * Save VMO in ctx
 * @param {Object} vmo view model object
 */
export let saveVMOInCtxForSecondaryView = function( vmo ) {
    if ( vmo ) {
        if ( !appCtxSvc.ctx.selectedSBOMForXRT ) {
            appCtxSvc.registerCtx( 'selectedSBOMForXRT', vmo );
        } else {
            appCtxSvc.updateCtx( 'selectedSBOMForXRT', vmo );
        }
    }
};

export default exports = {
    expandSelectedNode,
    subscribeToNodesLoaded,
    getServicePlanID,
    retrieveTreeLoadResult,
    setChildNodeProperties,
    getNeutralProductUid,
    setParentNodeProperties,
    loadTreeTableColumns,
    loadTreeTableProperties,
    mergeObjects,
    initialLoadTreeTableProperties,
    processViewModelObjectsFromJsonResponse,
    saveVMOInCtx
};
