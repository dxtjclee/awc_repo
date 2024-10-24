// Copyright (c) 2022 Siemens

/**
 * @module js/qa0AuditTeamService
 */
 import AwPromiseService from 'js/awPromiseService';
 import qa0AuditUtils from 'js/qa0AuditUtils';
 import dms from 'soa/dataManagementService';
 import cdm from 'soa/kernel/clientDataModel';
 import _ from 'lodash';
 
 var exports = {};
 
 /**
  * Get the default audit team group from Audit guideline object
  * @param {Object} selectionData - selection data to get selected object 
  * @param {boolean} loadDefaultGroup - if true, default group will be returned, else not
  */
 export let getDefaultGroup = function( selectionData, loadDefaultGroup ) {
 
     var deferred = AwPromiseService.instance.defer();
    
     if(loadDefaultGroup === false || _.isNull(loadDefaultGroup)) {
        return deferred.resolve(null);
     }
     let selectedObject;
     if(selectionData.selected[0].modelType.typeHierarchyArray.indexOf( 'Qa0QualityAudit' )>-1){
         selectedObject=selectionData.selected[0];
     }
     else if (selectionData.pselected.modelType.typeHierarchyArray.indexOf( 'Qa0QualityAudit' )>-1) {
         selectedObject=selectionData.pselected;
     }
     // Get default audit team group from the guideline object
     dms.getProperties([selectedObject.uid], ['qa0AuditGuideline']).then(
      function() {           
         dms.getProperties([selectedObject.props.qa0AuditGuideline.dbValues[0]], ['qa0AuditTeamGroup']).then(
             function() {
                 const defaultGroups = exports.getDefaultGroupInner(selectedObject);
                 if(!defaultGroups) { deferred.resolve (null); }
                 deferred.resolve({ "group": defaultGroups });
             });
      });
 
     return deferred.promise;
 };

 /**
  * Get the default audit team group from Audit guideline object
  * @param {Object} selectedObject - selected object
  */
 export let getDefaultGroupInner = function(selectedObject) {

    var guidelineObj = cdm.getObject( selectedObject.props.qa0AuditGuideline.dbValues[0] );
    var prop = guidelineObj.props.qa0AuditTeamGroup;
    // If default audit team group is configured, use it for preselecting group in panel
    if ( prop && prop.dbValues.length > 0 && (prop.dbValues[0] !== null || prop.uiValues[0] !== '' )) {        
        const defaultGroups = guidelineObj.props.qa0AuditTeamGroup.uiValues;            
        return defaultGroups;        
    } else {
        return null;
    } 
 };
 
 /**
  * This function will create the SOA input for createRelation for adding audit team members.
  * @param {String} relation Destination relation
  * @param {Array} selectedUsers Array of selected GroupMember or User objects
  * @param {Object} selectionData The selectionData to find Audit object, to which the audit team members should be added to
  * @return {Array} Returns inputData array for createRelation service
  */
 export let createAddUserRelationWithAuditInput = function( relation, selectedUsers, selectionData ) {
     var inputData = {};
     var secondaryObject = {};
     var soaInput = [];
 
     if ( selectionData && selectedUsers && selectedUsers.length > 0 ) {
        let auditObject;
        if(selectionData.selected[0].modelType.typeHierarchyArray.indexOf( 'Qa0QualityAudit' )>-1){
            auditObject=selectionData.selected[0];
        }
        else if (selectionData.pselected.modelType.typeHierarchyArray.indexOf( 'Qa0QualityAudit' )>-1) {
            auditObject=selectionData.pselected;
        }
        selectedUsers.forEach( function( selectedObj ) {
             secondaryObject = { uid: selectedObj.uid, type: selectedObj.type };
             inputData = {
                 clientId: 'AWClient',
                 primaryObject: auditObject,
                 relationType: relation,
                 secondaryObject: secondaryObject,
                 userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
             };
             soaInput.push( inputData );
         } );
     }
     return soaInput;
 };
 
 /**
  * This function will create the SOA input for deleteRelations for removing audit team members.
  * @param {Object} auditObject Audit object, that contains the audit team relation
  * @param {String} relation name of the audit team relation
  * @param {Array} selectedUsers Array of selected audit team members to be removed
  * @return {Array} Returns inputData array for deleteRelations service
  */
 export let createRemoveUserRelationWithAuditInput = function( auditObject, relation, selectedUsers ) {
     var inputData = {};
     var soaInput = [];
     if ( auditObject && selectedUsers && selectedUsers.length > 0 ) {
         selectedUsers.forEach( function( selectedObj ) {
             inputData = {
                 clientId: 'AWClient',
                 primaryObject: auditObject,
                 relationType: relation,
                 secondaryObject: selectedObj,
                 userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
             };
             soaInput.push( inputData );
         } );
     }
     return soaInput;
 };
 
 /**
  * Populate the subPanel context object from panelContext value present on appctx
  * object and return the subPanelContext object.
  *
  * @param {Object} panelContext Panel context information being used on app context
  * @param {Object} addUserPanelState User panel state object
  * @param {Object} criteria Default criteria object
  * @param {Object} fiter any preset filters
  * @returns {Object} Returns the user panel data by reading the values from panelCOntext
  *                  and returns.
  */
  export let populatePeopleSearchCriteriaContextData = function(panelContext, addUserPanelState, criteria, filter ) {
     const userPanelState = { ...addUserPanelState };
     userPanelState.criteria = criteria;
 
     //check if predefined filter passed then set the presetFilters property
     if(filter) {
         var presetFilters = {};
         for( var key in filter ) {
             if( filter.hasOwnProperty( key ) ) {
                 presetFilters[ 'GroupMember.' + key ] = _.clone( filter[ key ] );
             }
         }
         userPanelState.presetFilters = presetFilters;
     }
 
     // Check if panel contxt is not null then iterate for all keys and update the user panel state if there
     // is any key present on panel context object.
     if( panelContext && panelContext.searchState) {
         // Iterate for all entries in additional search criteria and add to main search criteria.
         // There is specifical processing for additionalSearchCriteria needed as we need to add
         // values present in this varible to search criteria only.
         for( var key in panelContext.searchState ) {
             if( panelContext.searchState.hasOwnProperty( key ) && key !== 'additionalSearchCriteria' ) {
                 userPanelState[ key ] = _.clone( panelContext.searchState[ key ] );
             }
         }      
     }
 
     // Set this flag so that it can be used in panel so other child component will
     // not be loaded until this flag set to true.
     userPanelState.isDataInit = true;
     return {
         userPanelState: userPanelState,
         isDataInit: true
     };
 };
 
 /**
  * This API is added to process the Partial error being thrown from the SOA
  *
  * @param {object} response - the response of SOA
  * @return {String} message - Error message to be displayed to user
  */
 export let populateErrorString = function (response) {
     return qa0AuditUtils.populateErrorString(response);
 };
 
 /**
  * This factory creates a service and returns exports
  *
  * @member qa0AuditTeamService
  */
 
 export default exports = {
     getDefaultGroup,
     getDefaultGroupInner,
     createAddUserRelationWithAuditInput,
     createRemoveUserRelationWithAuditInput,
     populatePeopleSearchCriteriaContextData,
     populateErrorString 
 };
 