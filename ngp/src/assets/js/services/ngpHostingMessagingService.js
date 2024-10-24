// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import mfeHostingMessagingService from 'js/services/mfeHostingMessagingService';
import eventBus from 'js/eventBus';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import clientDataModel from 'soa/kernel/clientDataModel';
import { sendToViewMaker } from 'js/services/ngpModelViewsService';
import { openPredecessorProcessesAsBackgroundDialog } from 'js/services/ngpBackgroundProcessesService';

/**
 * @module js/services/ngpHostingMessagingService
 */

/**
 * Submit to workflow event subscribtion
 */
let submitToWorkflowSubscribe;

/**
 *
 * @param {object} sourceWindow - the source window object
 * @return {string} the iframe id
 */
function getNgpHostedIframeID( sourceWindow ) {
    if( sourceWindow.location && sourceWindow.location.href && sourceWindow.location.href.indexOf( '#/com.siemens.splm.client.mfg.ngp/ngpEcn?uid=' ) >= 0 ) {
        return 'impactedAnalysisHostedIframe';
    }
    return mfeHostingMessagingService.getDefaultHostedIframeID();
}

/**
 * init method for this hosting service
 */
export function init() {
    mfeHostingMessagingService.initHostingMessaging( getNgpHostedIframeID );
    mfeHostingMessagingService.messageHandlers.mfeAddPopupGlassPanel.push( addGlassPanel );
    submitToWorkflowSubscribe = eventBus.subscribe( 'ngp.message.submitToWorkflow', submitToWorkflowHandler, false );

    mfeHostingMessagingService.addWhiteListSoaRequests( 'Internal-Process-2017-05-Assignment', 'getAssignmentTypeInformation' );
    mfeHostingMessagingService.addWhiteListSoaRequests( 'Core-2013-05-LOV', 'getInitialLOVValues' );
    mfeHostingMessagingService.addWhiteListSoaRequests( 'Core-2015-10-Session', 'getTypeDescriptions2' );
    mfeHostingMessagingService.addWhiteListSoaRequests( 'Administration-2012-09-PreferenceManagement', 'getPreferences', null, 'Administration-2012-09-PreferenceManagement', 'setPreferences2' );
    mfeHostingMessagingService.addWhiteListSoaRequests( 'AWS2-2017-06-UiConfig', 'getUIConfigs3' );
    mfeHostingMessagingService.addWhiteListSoaRequests( 'Internal-AWS2-2022-12-DataManagement', 'getCurrentUserGateway3' );
    mfeHostingMessagingService.addWhiteListSoaRequests( 'Internal-AWS2-2016-12-DataManagement', 'getDeclarativeStyleSheets', checkIsValidXRTRequest );

    mfeHostingMessagingService.registerCommand( 'ngpSendToViewMaker', sendToViewMaker );
    mfeHostingMessagingService.registerCommand( 'ngpDisplayAddPredecessorsDialog', openPredecessorProcessesAsBackgroundDialog );
}

/**
 *
 * This method adds a glass pane when we open a dialog from the hosted iframe
 * @param {object} data - data object
 */
function addGlassPanel( data ) {
    if( !mfeHostingMessagingService.getGlassPanelForKey( 'headerNavigation' ) ) {
        let mfeNgpHeaderElement = document.querySelector( 'aw-layout-slot[name=\'mfe_header\']' );

        if( !mfeNgpHeaderElement ) {
            mfeNgpHeaderElement = document.getElementsByClassName( 'afx-layout-header-container aw-layout-row aw-layout-flexbox afx-base-parentElement ng-scope' )[ 0 ];
        }
        const mfeNgpHeaderElementLeft = mfeNgpHeaderElement.offsetLeft + 'px';

        //calculate the height of the header + tabs
        let hostedIframeHeight = document.querySelector( '#hostedIframe' ).offsetHeight;
        let mfeNgpHeaderElementHeight = document.querySelector( 'body' ).offsetHeight - hostedIframeHeight;
        let element = document.createElement( 'div' );
        mfeHostingMessagingService.setGlassPanelStyle( mfeNgpHeaderElementHeight + 'px', '100%', element, data.backgroundColor, mfeNgpHeaderElementLeft );
        mfeHostingMessagingService.addGlassPanelToMap( 'headerNavigation', element );
        mfeNgpHeaderElement.appendChild( element );
    }
}

/**
 * Post a message upon a submit to workflow
 * @param {object} event - the event object
 */
function submitToWorkflowHandler( event ) {
    const iFrame = document.getElementById( 'hostedIframe' );
    if( iFrame ) {
        var targetWindow = iFrame.contentWindow;
        var modelObjectsUid = event.updatedObjects;

        targetWindow.postMessage( {
            type: 'submitToWorkflow',
            data: modelObjectsUid
        }, '*' );
    }
}

/**
 * This method destroys this instance of the host messaging service
 */
export function destroy() {
    mfeHostingMessagingService.removeEventListners();
    if( submitToWorkflowSubscribe ) {
        submitToWorkflowSubscribe.unsubscribe();
    }
}

/**
  *
  * @param {object} jsonData - request data input
  */
export function checkIsValidXRTRequest( jsonData ) {
    const jsonBody = jsonData.body;
    let isValid = true;

    if ( jsonBody ) {
        if ( jsonBody && jsonBody.input && Array.isArray( jsonBody.input ) ) {
            isValid = jsonBody.input.every( input => {
                const xrtOject = clientDataModel.getObject( input.businessObject.uid );
                const isWorkUnitTab = input.clientContext['ActiveWorkspace:SubLocation'] === 'workunitBuildup';
                const isActivity = ngpTypeUtils.isActivity( xrtOject );
                const isOperationsTab = input.clientContext['ActiveWorkspace:SubLocation'] === 'operations';
                const isProcess = ngpTypeUtils.isProcessElement( xrtOject );
                const isCreate = input.styleSheetType.toUpperCase() === 'CREATE';

                return !isCreate && ( isWorkUnitTab && isActivity || isOperationsTab && isProcess );
            }
            );
        }
    }
    return isValid;
}
export default {
    init,
    destroy
};
