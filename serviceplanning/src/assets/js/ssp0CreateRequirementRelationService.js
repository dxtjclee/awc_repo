// Copyright (c) 2022 Siemens

/**
 * Create relation between Requirements
 *
 * @module js/ssp0CreateRequirementRelationService
 */

import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dmService from 'soa/dataManagementService';
import soaSvc from 'soa/kernel/soaService';
import awMessageService from 'js/messagingService';
import localeService from 'js/localeService';


var exports = {};
export const initialize = async( firstRequirementInput, secondRequirementInput ) => {
    let firstRequirement = { ...firstRequirementInput };
    let secondRequirement = { ...secondRequirementInput };
    firstRequirement.dbValue = appCtxSvc.getCtx( 'mselectedVMO[0].props.bl_rev_object_name.dbValue' );
    secondRequirement.dbValue = appCtxSvc.getCtx( 'mselectedVMO[1].props.bl_rev_object_name.dbValue' );
    return { firstRequirement, secondRequirement };
};

export let createRelation = async( relationName )=>{
    let serviceRequirement1;
    let serviceRequirement2;
    let firstReq = appCtxSvc.getCtx( 'mselectedVMO[0].props.bl_revision.dbValue' );
    var firstReqRev = cdm.getObject( firstReq );
    await dmService.getProperties( [ firstReq ], [ 'items_tag' ] ).then( function( response ) {
        serviceRequirement1 = firstReqRev.props.items_tag.dbValues[0];
    } );
    serviceRequirement1 = cdm.getObject( serviceRequirement1 );
    let secondReq = appCtxSvc.getCtx( 'mselectedVMO[1].props.bl_revision.dbValue' );
    var secondReqRev = cdm.getObject( secondReq );
    await dmService.getProperties( [ secondReq ], [ 'items_tag' ] ).then( function( response ) {
        serviceRequirement2 = secondReqRev.props.items_tag.dbValues[0];
    } );
    serviceRequirement2 = cdm.getObject( serviceRequirement2 );
    const input = [
        { primaryObject: serviceRequirement1,
            secondaryObject: serviceRequirement2,
            relationType: relationName,
            clientId: '' }
    ];
    await soaSvc.postUnchecked( 'Core-2006-03-DataManagement', 'createRelations', { input } ).then( function( response ) {
        var err;
        if( response.partialErrors || response.PartialErrors ||  response.ServiceData && response.ServiceData.partialErrors  ) {
            if( response.ServiceData && response.ServiceData.partialErrors ) {
                err = soaSvc.createError( response.ServiceData );
            } else {
                err = soaSvc.createError( response );
            }
            var errMessage = awMessageService.getSOAErrorMessage( err );
            awMessageService.showError( errMessage );
        }else {
            var resource = 'ssp0Messages';
            var localTextBundle = localeService.getLoadedText( resource );
            var localizedMsg;
            if( relationName === 'SSP0Requires' ) {
                localizedMsg = localTextBundle.requiredRelationCreated;
            }else{
                localizedMsg = localTextBundle.satisfiesRelationCreated;
            }
            awMessageService.showInfo( localizedMsg );
        }
        return response;
    } );
};
export const swapRequirements = ( sr1, sr2 ) => {
    let firstRequirement = { ...sr2 };
    let secondRequirement = { ...sr1 };
    let firstReq = appCtxSvc.getCtx( 'mselectedVMO[0]' );
    let secondReq = appCtxSvc.getCtx( 'mselectedVMO[1]' );
    appCtxSvc.updateCtx( 'mselectedVMO[0]', secondReq );
    appCtxSvc.updateCtx( 'mselectedVMO[1]', firstReq );
    return { firstRequirement, secondRequirement };
};

export default exports = {
    initialize,
    createRelation,
    swapRequirements
};

