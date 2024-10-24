// Copyright (c) 2023 Siemens
/**
 * Service Plan functions
 *
 * @module js/Ssp1ServiceReqDependencyService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dmService from 'soa/dataManagementService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import viewModelObjectSvc from 'js/viewModelObjectService';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import policySvc from 'soa/kernel/propertyPolicyService';
import { getBaseUrlPath } from 'app';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';

var exports = {};

export let getCreateInput = async( data )=>{
    let serviceRequirement;
    let requirementsResult;
    let serviceReqRevId = appCtxSvc.getCtx( 'selectedVMO.props.bl_revision.dbValue' );
    var serviceReqRev = cdm.getObject( serviceReqRevId );
    await dmService.getProperties( [ serviceReqRevId ], [ 'items_tag' ] ).then( function( response ) {
        serviceRequirement = serviceReqRev.props.items_tag.dbValues[0];
    } );
    var serviceReq = cdm.getObject( serviceRequirement );
    const input = {
        primaryObjects: [ { uid:serviceRequirement,
            type: serviceReq.type
        } ],
        pref:
         {
             expItemRev: false,
             returnRelations: true,
             info:
             [
                 {
                     relationName: data.relation,
                     otherSideObjectTypes: ''
                 }
             ]
         }
    };
    var policy = {
        types: [ {
            name: 'SSP0ServiceReq',
            properties: [ {
                name: 'object_name'
            },
            {
                name: 'object_desc'
            },
            {
                name: 'fnd0HasEditInContext'
            },
            {
                name: 'project_ids'
            },
            {
                name: 'fnd0ContextContrast'
            },
            {
                name: 'ssp0RequirementType'
            }
            ]
        } ]
    };
    policySvc.register( policy );
    return soaSvc.post( 'Core-2007-06-DataManagement', 'expandGRMRelationsForPrimary', input ).then( function( response ) {
        var requirementsModelObject = _.filter( response.output[0].otherSideObjData[0].otherSideObjects, { type: serviceReq.type } );
        let serviceData = response.ServiceData.modelObjects;
        requirementsResult = _.filter( serviceData, function( o1 ) {
            return requirementsModelObject.some( function( o2 ) {
                return o1.uid === o2.uid;
            } );
        } );
        return requirementsResult;
    } );
};

export let getProperties = async( data )=>{
    let serviceRequirement;
    let requirementsResult;
    let serviceReqRevId = appCtxSvc.getCtx( 'selectedVMO.props.bl_revision.dbValue' );
    var serviceReqRev = cdm.getObject( serviceReqRevId );
    await dmService.getProperties( [ serviceReqRevId ], [ 'items_tag' ] ).then( function( response ) {
        serviceRequirement = serviceReqRev.props.items_tag.dbValues[0];
    } );
    var serviceReq = cdm.getObject( serviceRequirement );
    const input = {
        objects: [ { uid:serviceRequirement,
            type: serviceReq.type
        } ],
        attributes: [ data.attribute ]
    };
    var policy = {
        types: [ {
            name: 'SSP0ServiceReq',
            properties: [ {
                name: 'object_name'
            },
            {
                name: 'object_desc'
            },
            {
                name: 'fnd0HasEditInContext'
            },
            {
                name: 'project_ids'
            },
            {
                name: 'fnd0ContextContrast'
            },
            {
                name: 'ssp0RequirementType'
            }
            ]
        } ]
    };
    policySvc.register( policy );
    return soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', input ).then( function( response ) {
        var requirementsPlainObject = response.plain;
        let serviceData = _.filter( response.modelObjects, { type: serviceReq.type } );
        requirementsResult = _.filter( serviceData, function( o1 ) {
            return requirementsPlainObject.some( function( o2 ) {
                return o1.uid !== o2;
            } );
        } );
        return requirementsResult;
    } );
};

export let setNodeProperties = function( response ) {
    let objectsToReturn = [];
    let type = 'SSP0ServiceReq';
    if ( response !== undefined ) {
        Object.values( response ).forEach( function( modelObjectJson ) {
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObjectJson, 'create', undefined, undefined, true );
            vmo.displayName = modelObjectJson.props.object_string.dbValues[0];
            vmo.isVisible = false;
            vmo.isLeaf = true;
            vmo.typeIconURL = getBaseUrlPath() + '/image/typeServiceRequirementRevision48.svg';
            objectsToReturn.push( vmo );
        }
        );
    }
    return {
        response: objectsToReturn,
        totalFound: objectsToReturn.length
    };
};
export let loadRequirementColumns = async function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = [];
    let servercolumns = [];
    var input = {
        getOrResetUiConfigsIn: [
            {
                scope: 'LoginUser',
                scopeName: '',
                clientName: 'AWClient',
                resetColumnConfig: true,
                columnConfigQueryInfos: [
                    {
                        clientScopeURI: 'Ssp0RequirementManagement',
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
            awColumnInfos.push( column );
        } );
    }
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );
    deferred.resolve(
        {
            columnConfig: {
                columns: awColumnInfos
            }
        }
    );
    return deferred.promise;
};
/**
  * Save VMO in ctx
  * @param {Object} vmo view model object
  */
export let saveRequiredVMOInCtx = function( vmo ) {
    if( vmo === undefined && appCtxSvc.ctx.selectedDepReqVMO ) { appCtxSvc.unRegisterCtx( 'selectedDepReqVMO' ); }

    if ( vmo ) {
        if ( !appCtxSvc.ctx.selectedDepReqVMO ) {
            appCtxSvc.registerCtx( 'selectedDepReqVMO', vmo );
        }
        appCtxSvc.updateCtx( 'selectedDepReqVMO', vmo );
    }
};
/**
  * Save VMO in ctx
  * @param {Object} vmo view model object
  */
export let saveSatisfyVMOInCtx = function( vmo ) {
    if( vmo === undefined && appCtxSvc.ctx.selectedDepSatisfyVMO ) { appCtxSvc.unRegisterCtx( 'selectedDepSatisfyVMO' ); }

    if ( vmo ) {
        if ( !appCtxSvc.ctx.selectedDepSatisfyVMO ) {
            appCtxSvc.registerCtx( 'selectedDepSatisfyVMO', vmo );
        }
        appCtxSvc.updateCtx( 'selectedDepSatisfyVMO', vmo );
    }
};

export let cutRequirement = async( ctx, relation ) => {
    let serviceRequirementUid;
    let serviceReqRevId = appCtxSvc.getCtx( 'selectedVMO.props.bl_revision.dbValue' );
    var serviceReqRev = cdm.getObject( serviceReqRevId );
    await dmService.getProperties( [ serviceReqRevId ], [ 'items_tag' ] ).then( function( response ) {
        serviceRequirementUid = serviceReqRev.props.items_tag.dbValues[0];
    } );
    let input = [];
    if( relation === 'SSP0Requires' ) {
        let inputForDelete = {
            primaryObject :{
                uid: serviceRequirementUid,
                type: ctx.selectedDepReqVMO.type
            },
            clientId : '',
            relationType :relation,
            secondaryObject : {
                uid: ctx.selectedDepReqVMO.uid,
                type: ctx.selectedDepReqVMO.type
            }
        };
        input.push( inputForDelete );
    }else  if( relation === 'SSP0Satisfies' ) {
        let inputForDelete = {
            primaryObject :{
                uid: serviceRequirementUid,
                type: ctx.selectedDepSatisfyVMO.type
            },
            clientId : '',
            relationType :relation,
            secondaryObject : {
                uid: ctx.selectedDepSatisfyVMO.uid,
                type: ctx.selectedDepSatisfyVMO.type
            }
        };
        input.push( inputForDelete );
    }
    var delRelInput = {
        input: input
    };
    soaSvc.postUnchecked( 'Core-2006-03-DataManagement', 'deleteRelations', delRelInput )
        .then( function( response ) {
            if ( response.partialErrors && response.partialErrors.length > 0 ) {
                showError( response.partialErrors );
            } else {
                if( relation === 'SSP0Satisfies' ) {
                    eventBus.publish( 'satisfiesReqList.plTable.reload' );
                } else if( relation === 'SSP0Requires' ) { eventBus.publish( 'requiresReqList.plTable.reload' ); }
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
export default exports = {
    getCreateInput,
    getProperties,
    setNodeProperties,
    loadRequirementColumns,
    saveRequiredVMOInCtx,
    saveSatisfyVMOInCtx,
    cutRequirement
};


