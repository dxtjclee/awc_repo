// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* eslint-disable */

/*global
 define
 */
/**
 * @module js/Ase0ShowDiagramService
 */

 import _ from 'lodash';
 import logger from 'js/logger';
 import eventBus from 'js/eventBus';
 import cdmSvc from 'soa/kernel/clientDataModel';
 import soaSvc from 'soa/kernel/soaService';
 import appCtxSvc from 'js/appCtxService';
 import editHandlerSvc from 'js/editHandlerService';
 import AwStateService from 'js/awStateService';
 import navigationSvc from 'js/navigationService';


 var exports = {};

 let _diagramsTabUnloadedEventListener;



 /**
  * Update the panel size and store it for session
  * @param {DOM} eventData event data for splitter move event
  */
 export let updatePanelSize = function (eventData,state) {
     let prevDiagCtx = {...state};
     var tree = eventData.area1;
     if (!tree || tree.getAttribute('id') !== 'diagramTabTreeViewCol') {
         return;
     }

     if (!prevDiagCtx) {
         prevDiagCtx = {
             tabWidth: null
         };
     }

     var tableWidthPer = null;
     var previewWidth = null;
     var totalWidth = null;
     var splitterWidth = null;

     var splitterElement = eventData.splitter;
     if (splitterElement) {
         splitterWidth = splitterElement.getBoundingClientRect().width;
     }

     var tableWidth = tree.getBoundingClientRect().width;

     var preview = eventData.area2;
     if (preview && preview.getAttribute('id') === 'diagramPreviewCol') {
         previewWidth = preview.getBoundingClientRect().width;
     }

     if (previewWidth && tableWidth && splitterWidth) {
         totalWidth = previewWidth + tableWidth + splitterWidth;
         tableWidthPer = Math.floor(tableWidth * 100 / totalWidth);
     }
     if (tableWidthPer) {
         prevDiagCtx.tabWidth = tableWidthPer.toString() + '%';
     }

     return prevDiagCtx;
 };

 /**
  * Register context on Diagrams tab load.
  * @param {Object} data viewmodel object
  *
  */
 export let handleDiagramsTabLoad = function (State) {
     let diagramState = {...State};

     editHandlerSvc.removeEditHandler('NONE');
     var diagramsCtx = diagramState;

         diagramsCtx = {
             isDiagramsTabActive: true
         };
         diagramState = diagramsCtx;


     return diagramState;
 };

 /**
  * Checks if the session has valid licenses to enable the
  * Add and delete diagram commands. If yes, it sets ctx.diagramsCtx.hasAdvancedLicense to true.
  *
  * @param {Object} ctx - application context
  */
  // Can't remove ctx as xrt needs to read licence state
  export let checkForAdvancedFeaturesLicenses = function () {

    var diagramsCtx = appCtxSvc.getCtx('diagramsCtx');
    if (!diagramsCtx) {
        appCtxSvc.registerCtx('diagramsCtx', diagramsCtx);
    }

    if( appCtxSvc.ctx.diagramsCtx && appCtxSvc.ctx.diagramsCtx.hasAdvancedLicense ) {
        return;
    }
    var licenseCheckPromise = soaSvc.post('Core-2008-03-Session', 'connect', { featureKey: 'tc_system_modeler', action: 'check' });
    licenseCheckPromise.then(
        (response) => {
            if (parseInt(response.outputVal, 10) > 0) {

                diagramsCtx = {
                    hasAdvancedLicense : true
                };

                appCtxSvc.updatePartialCtx('diagramsCtx', diagramsCtx);

            }
        }
    )
        .catch(
            (exception) => {
                logger.error('Failed to get the System Modeler license.');
                logger.error(exception);

                diagramsCtx = {
                    hasAdvancedLicense : false
                };

                appCtxSvc.updatePartialCtx('diagramsCtx', diagramsCtx);


            }
        );;
}

 /**
  * Updates the diagrams table on creation of diagram / opens the newly created diagram
  * @param{Boolean} toOpenDiagram flag to indicate if diagram needs to be opened
  * @param{String} uid newly created diagarm uid
  */
 export let updateDiagramViewOnCreate = function (toOpenDiagram, uid,xrtSummaryContextObject) {
     let eventName, eventData;
     if (toOpenDiagram) {
         eventName = 'Ase0ShowDiagram.OpenDiagram';
         eventData = {
             diagramUid: uid
         };
     } else {
         // reload the table
         eventName = 'cdm.relatedModified';
         eventData = {
             relatedModified: [xrtSummaryContextObject],
         };
     }
     eventBus.publish(eventName, eventData);
 };

 /**
  * Updates the diagrams table on creation of a markup
  */
 export let updateDiagramViewOnMarkupCreation = function( updatedObjects ,xrtSummaryContextObject) {
     let eventName, eventData;
     let flag = true;
     _.forEach( updatedObjects, function( modelObj ) {
         if( flag ) {
             if(modelObj.type !== 'Awb0AutoBookmark') {
                 // reload the table
                 eventName = 'cdm.relatedModified';
                 eventData = {
                     relatedModified: [xrtSummaryContextObject]
                 };
                 eventBus.publish(eventName, eventData);
                 flag = false;
             }
         }
     } );
 };

 //Get the list of items and its associated ECNS
 export let openDiagram = function (selectedDiagram, navigateIn,occContext,salectedUid) {
     let soaInput = {
         secondaryObjects: [selectedDiagram],
         pref: {
             expItemRev: false,
             returnRelations: true,
             info: [{
                 relationTypeName: 'TC_Attaches',
                 otherSideObjectTypes: ''
             }]
         }
     };
     return soaSvc.postUnchecked('Core-2007-09-DataManagement', 'expandGRMRelationsForSecondary', soaInput).then(
         function (response) {
             if (response.output.length > 0) {
                 let selectedItem = response.output[0].inputObject;
                 if (response.output[0].relationshipData[0].relationshipObjects.length > 0) {
                     let owningObject = response.output[0].relationshipData[0].relationshipObjects[0].otherSideObject;
                     let relation = response.output[0].relationshipData[0].relationshipObjects[0].relation;

                     let relationProxyObjectUid = 'SR::N::Ase0AssocRelationProxy..' + relation.uid + ':' + selectedItem.uid;

                     return _redirectToShowObject(owningObject, relationProxyObjectUid, navigateIn,occContext,salectedUid);
                 }
             }
         });
 };

 function _redirectToShowObject(owningObject, relationProxyObjectUid, navigateIn,occContext ,salectedUid) {
     let navigationParams = {
         uid: owningObject.uid,
         spageId: 'tc_xrt_SystemDiagrams'
     };
     let action = {
         actionType: 'Navigate',
         navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
     };

     if (navigateIn) {
         action.navigateIn = navigateIn;
         navigationParams.s_uid = relationProxyObjectUid;
     } else {
         if (occContext && salectedUid && salectedUid !== owningObject.uid) {
             appCtxSvc.registerCtx('resetTreeExpansionState', true);
         }
         appCtxSvc.updatePartialCtx('objectSetDefaultSelection.Ase0AssocDiagramProvider_Ase0AssocRelationProxy', relationProxyObjectUid);
     }
     return navigationSvc.navigate(action, navigationParams);
 };

 export let resetSuid = function () {
     let s_uid = AwStateService.instance.params.s_uid;
     AwStateService.instance.params.s_uid = null;
     AwStateService.instance.go('com_siemens_splm_clientfx_tcui_xrt_showObject', AwStateService.instance.params);
     let objToSelect = cdmSvc.getObject(s_uid);
     if (!objToSelect) {
         objToSelect = {
             uid: s_uid
         };
     }
     let eventData = {
         relatedModified: [{
             uid: AwStateService.instance.params.uid
         }],
         createdObjects: [objToSelect]
     };
     _.defer(function (eventDataInput) {
         eventBus.publish('cdm.relatedModified', eventDataInput);
     }, eventData);
 };

 export default exports = {
     updatePanelSize,
     handleDiagramsTabLoad,
     checkForAdvancedFeaturesLicenses,
     updateDiagramViewOnCreate,
     updateDiagramViewOnMarkupCreation,
     openDiagram,
     resetSuid
 };
