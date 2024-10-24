// Copyright (c) 2023 Siemens
/**
 * Service Plan functions
 *
 * @module js/ssp0CreateOrAssignNoticeService
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import viewModelObjectSvc from 'js/viewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import _localeSvc from 'js/localeService';
import { getBaseUrlPath } from 'app';
import cdm from 'soa/kernel/clientDataModel';

var localTextBundle = _localeSvc.getLoadedText( 'ssp0Messages' );
var exports = {};

export let getCreateInput = async( data )=>{
    let workcardRev = appCtxSvc.getCtx( 'selected' );
    let notices = [];
    const input = {
        primaryObjects: [ workcardRev ],
        pref:
         {
             expItemRev: false,
             info:
             [
                 {
                     relationName: 'SSP0HasWarning',
                     objectTypeNames: []
                 }
             ]
         }
    };
    var policy = {
        types: [ {
            name: 'Smr0Warning',
            properties: [ {
                name: 'object_name'
            },
            {
                name: 'smr0longDescription'
            },
            {
                name: 'smr0warningType'
            }            ]
        } ]
    };
    policySvc.register( policy );
    return soaSvc.post( 'Core-2007-06-DataManagement', 'expandGRMRelationsForPrimary', input ).then( function( response ) {
        if( response && response.output && response.output[0] && response.output[0].otherSideObjData && response.output[0].otherSideObjData[0] &&
             response.output[0].otherSideObjData[0].otherSideObjects ) {
            response.output[0].otherSideObjData[0].otherSideObjects.forEach( notice => {
                notices.push( notice );
            } );
        }
        return notices;
    } );
};

export let setNodeProperties = function( response ) {
    let objectsToReturn = [];
    let type = servicePlannerConstants.TYPE_NOTICE;
    if ( response !== undefined ) {
        Object.values( response ).filter( modelObject => modelObject.modelType.typeHierarchyArray.includes( type )  ).forEach(
            modelObject => {
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObject, 'create', undefined, undefined, true );
                vmo.displayName = modelObject.props.object_string.dbValues[0];
                vmo.isVisible = false;
                vmo.isLeaf = true;
                vmo.typeIconURL = getIconSourcePath( vmo );

                objectsToReturn.push( vmo );
            }
        );
    }
    return {
        response: objectsToReturn,
        totalFound: objectsToReturn.length
    };
};
export let loadRequirementColumns = async function( resetFlag ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = _getTreeTableColumnInfos(  );
    let serverColumns = [];
    var input = {
        getOrResetUiConfigsIn: [ {
            scope: 'LoginUser',
            scopeName: '',
            clientName: 'AWClient',
            resetColumnConfig: resetFlag,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Ssp0NoticesTableManagement',
                operationType: 'union',
                typeNames: [],
                columnsToExclude: []
            } ],
            businessObjects: [
                {}
            ]
        } ]
    };
    await soaSvc.post( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', input ).then( function( response ) {
        serverColumns = response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns;
    } );
    if( serverColumns.length > 0 ) {
        serverColumns.forEach( column => {
            awColumnInfos.push( column );
        } );
    }
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    var type;
    _.forEach( awColumnInfos, function( columnDef ) {
        if( type && type.propertyDescriptorsMap[ columnDef.name ] ) {
            columnDef.displayName = type.propertyDescriptorsMap[ columnDef.name ].displayName;
        }
    } );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'Ssp0NoticesTableManagement',
            objectSetUri: 'Ssp0NoticesTableManagement'
        }
    } );

    return deferred.promise;
};

/**
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getTreeTableColumnInfos(  ) {
    return [ {
        name: 'object_name',
        propertyName: 'object_name',
        displayName: localTextBundle.nameValueColumn,
        width: 200,
        modifiable: true,
        enableColumnResizing: true,
        enableColumnMoving: false,
        pinnedLeft: true,
        columnOrder: 2,
        pixelWidth: 200,
        hiddenFlag: false
    }
    ];
}

/**
 * Reload the Tools Tree
 * @param {Object} dataProvider dataProvider of Tools tree
 * @param {String} selection boolean value
 */
export let reloadNoticesTree = function( dataProvider, selection ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        eventBus.publish( 'noticesTree.plTable.reload' );
    }
    if ( selection ) {
        const subscribeTablePageLoaded = eventBus.subscribe( 'noticesTree.plTable.loadMorePages', function( eventData ) {
            eventBus.publish( 'Ssp0NoticesTree.selectVMOinTree' );
            eventBus.unsubscribe( subscribeTablePageLoaded );
        } );
    }
};
/**
 * Select VMO the Tools Tree
 * @param {Object} dataProvider dataProvider
 */
export let selectVMOinTree = function( dataProvider ) {
    if ( dataProvider ) {
        const objectToSelect = dataProvider.viewModelCollection.loadedVMObjects[dataProvider.viewModelCollection.totalFound - 1];
        dataProvider.selectionModel.setSelection( objectToSelect );
    }
};

/**
 *Get icon path based on object type
 @param {object} vmo object node
 @return {String} image Path
 */
let getIconSourcePath = function( vmo ) {
    let imagePath = getBaseUrlPath() + '/image/';
    let underlyingObjectType = vmo.modelType.typeHierarchyArray;
    if ( underlyingObjectType.indexOf( 'Smr0Warning' ) > -1 ) {
        if( vmo.props.smr0warningType.dbValues[0] === 'Smr0WarningValue' || vmo.props.smr0warningType.dbValues[0] === 'Smr0HazardousMaterial' ) {
            imagePath += 'typeWarning48.svg';
        }else if( vmo.props.smr0warningType.dbValues[0] === 'Smr0Caution' ) {
            imagePath += 'indicatorCaution16.svg';
        } else{
            imagePath += 'typeCustomNote48.svg';
        }
    }

    return imagePath;
};
export default exports = {
    getCreateInput,
    setNodeProperties,
    loadRequirementColumns,
    reloadNoticesTree,
    selectVMOinTree
};
