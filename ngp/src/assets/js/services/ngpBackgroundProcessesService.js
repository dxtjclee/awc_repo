// Copyright (c) 2022 Siemens

import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import viewModelObjectSvc from 'js/viewModelObjectService';
import popupSvc from 'js/popupService';
import ngpSoaService from 'js/services/ngpSoaService';
import msgSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';

/**
 * @module js/services/ngpBackgroundProcessesService
 */

/**
 * NgpModelViewsMessages
 */
const ngpModelViewsMessages = localeSvc.getLoadedText( 'NgpModelViewsMessages' );

/**
 * button used in message info
 */
const closeButton = mfgNotificationUtils.createButtonWhichClosesNotyMsg( ngpModelViewsMessages.close );

/**
 * open dialog for adding Predecessor Processes As Background
 *
 * @param {modelObject} contextObject - a given context object
 * @param {modelObject[]} currentBackgroundProcesses - the current background processes of the given context
 */
export function openPredecessorProcessesAsBackgroundDialog( contextObject, currentBackgroundProcesses ) {
    const crossActivityPredecessors = contextObject.props[ ngpPropConstants.CROSS_ACTIVITY_PREDECESSORS ];
    const backgroundProcesessUid = currentBackgroundProcesses.map( ( obj ) => obj.uid );
    const crossActivityPredecessorsToShow = crossActivityPredecessors.dbValues
        .filter( ( uid ) => backgroundProcesessUid.indexOf( uid ) === -1 )
        .map( ( uid ) => viewModelObjectSvc.createViewModelObject( uid ) );
    if( crossActivityPredecessorsToShow.length === 0 ) {
        msgSvc.showInfo( ngpModelViewsMessages.noRelevantCrossActivityPredecessorsFound, null, null, [ closeButton ] );
    } else {
        const popupData = {
            declView: 'NgpAddPredecessorsToBackground',
            options: {
                height: '500',
                width: '420'
            },
            locals: {
                caption: ngpModelViewsMessages.addPredecessorsToBackgroundTitle
            },
            subPanelContext: {
                crossActivityPredecessorsToShow,
                contextObject
            }
        };
        popupSvc.show( popupData );
    }
}
/**
 * call soa to add background process
 *
 * @param {modelObject} contextObject
 * @param {modelObject[]} selection
 */
export function addBackgroundProcesses( contextObject, selection ) {
    const input = {
        context: contextObject,
        elements: selection
    };

    ngpSoaService.executeSoa( 'Internal-Process-2017-05-ManufacturingDisclosure', 'addBackgroundElements', input ).then( () => {
        let messageInfo;
        if( selection.length > 1 ) {
            messageInfo = ngpModelViewsMessages.processesWereAddedAsBackgroundMessage.format( selection.length );
        } else {
            const objName = selection[ 0 ].props[ ngpPropConstants.OBJECT_STRING ].uiValues[ 0 ];
            messageInfo = ngpModelViewsMessages.processWasAddedAsBackgroundMessage.format( objName );
        }
        msgSvc.showInfo( messageInfo, null, null, [ closeButton ] );
    } );
}

export default {
    openPredecessorProcessesAsBackgroundDialog,
    addBackgroundProcesses
};
