// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Digital Industries Software
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**

 * @module js/qa0FindingService
 */

 import * as app from 'app';
 import changeCommandService from 'js/Cm1ChangeCommandService';
 import appCtxService from 'js/appCtxService';
 
 var exports = {};
 
 /**
 * This function will create the SOA input for deleteRelations for removing findings.
 * @param {Object} auditObject Audit object, that contains the findings
 * @param {String} relation name of the audit finding relation
 * @param {Array} selectedFindings Array of selected audit findings to be removed
 * @return {Array} Returns inputData array for deleteRelations service
 */
 export let createDeleteFindingsInput = function( auditObject, relation, selectedFindings ) {     
     var soaInput = [];
     if ( auditObject && selectedFindings && selectedFindings.length > 0 ) {
         selectedFindings.forEach( function( selectedObj ) {
             let inputData = {
                 clientId: 'AWClient',
                 primaryObject: selectedObj,
                 relationType: relation,
                 secondaryObject: auditObject,
                 userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
             };
             soaInput.push( inputData );
         } );
     }
     return soaInput;
 };

  /**
 * This function will create the SOA input for deleteRelations for removing findings.
 * @param {String} commandId Id of the command panel.
 * @param {Object} params State params 
 */
  export let openCreateFindingPanel = function( commandId, params ) {     
    
    var appCreateChangePanelContext = 'appCreateChangePanel';
    appCtxService.unRegisterCtx( appCreateChangePanelContext );
    var appCreateChangeObjParam = {};
    appCreateChangeObjParam.exactTypeToCreate = 'C2Issue';
    appCtxService.registerCtx( appCreateChangePanelContext, appCreateChangeObjParam );

    changeCommandService.openCreateChangePanel( commandId, 'aw_toolsAndInfo', params );
};
 
 export default exports = {
     createDeleteFindingsInput,
     openCreateFindingPanel
 };
 
 app.factory( 'qa0FindingService', () => exports );
 
 