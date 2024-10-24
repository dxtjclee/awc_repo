// Copyright (c) 2022 Siemens

/**
 * @module js/senOpenEnterpriseSbom
 */
 import soaSvc from 'soa/kernel/soaService';
 import AwPromiseService from 'js/awPromiseService';
 import occmgmtGetOccsResponseService from 'js/occmgmtGetOccsResponseService';
 import navigationSvc from 'js/navigationService';

 let exports = {};

 /**
   * call get occurance and redirect to show Object location if license not present
   * @param obj_uid Object Uid
   * @param obj_type Object Type
   * @param navigateIn navigate Type
   */
let openEnterpriseSBOM = function( obj_uid, obj_type, navigateIn ) {
     let navigationParams = {};
     let action = {
         actionType: 'Navigate',
         navigateIn: navigateIn
     };

     let soaInput = getOcc4SoaInput( obj_uid, obj_type );

     return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4',
         soaInput ).then( function( response ) {
         let deferred = AwPromiseService.instance.defer();

        if ( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
             occmgmtGetOccsResponseService.processPartialErrors( response );
             navigationParams.uid = obj_uid;
             action.navigateTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
             navigationSvc.navigate( action, navigationParams );
         }
        else {
                 navigationParams.obj_uid = obj_uid;
                 action.navigateTo = 'enterpriseSBOM';
                 navigationSvc.navigate( action, navigationParams );
         }
         deferred.resolve( response );
         return deferred.promise;
     }, function( error ) {
         occmgmtGetOccsResponseService.processFailedIndexError( error );
         throw soaSvc.createError( error );
     } );
 };

 /**
    *Create getOccurenses4 SOA Input
    * @param obj_uid Object Uid
    * @param obj_type Object Type
    */
 let getOcc4SoaInput = function( obj_uid, obj_type ) {
     return {
         inputData: {
             product: {
                 type: obj_type,
                 uid: obj_uid
             },
             config: {
                 effectivityDate: '0001-01-01T00:00:00',
                 unitNo: -1
             },
             cursor: {},
             focusOccurrenceInput: {},
             filter: {},
             requestPref: {
                 openWPMode: [ 'ebom_only' ]
             },
             sortCriteria: {}
         }
     };
 };

 export default exports = {
    openEnterpriseSBOM
 };

