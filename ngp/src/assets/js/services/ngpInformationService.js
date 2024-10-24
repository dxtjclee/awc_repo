// Copyright (c) 2022 Siemens

import _ from 'lodash';
import ngpSoaSvc from 'js/services/ngpSoaService';
import vmoSvc from 'js/viewModelObjectService';
import ngpVMOPropSvc from 'js/services/ngpViewModelPropertyService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import localeService from 'js/localeService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpRelationService from 'js/services/ngpRelationService';
import fmsUtils from 'js/fmsUtils';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import msgSvc from 'js/messagingService';
import dms from 'soa/dataManagementService';

/**
 * NGP Model Views Service
 *
 * @module js/services/ngpInformationService
 */
const localizedMsgs = localeService.getLoadedText( 'ngpInformationMessages' );
const errorsToIgnoreWhenRemovingRelation = [ {
    description: 'Trying to delete object when user has no permissions',
    errorNum: 51010,
    printError: false
} ];

/**
 *
 * @param {modelObject} context - the context modelObject
 * @return {promise} a promise object
 */
export function getAttachmentsAgsAndForms( context ) {
    const soaInput = {
        input: [ context ]
    };
    return ngpSoaSvc.executeSoa( 'Internal-ManufacturingCore-2017-05-DataManagement', 'getAttachments', soaInput ).then(
        ( response ) => {
            const attachments = [];
            const attributeGroups = [];
            const forms = [];
            if( response && response.responseData && response.responseData[ 0 ] ) {
                const { attachmentDatasetInfo, attributeGroupRelationInfo, sourceObjectForms } = response.responseData[ 0 ];
                if( attachmentDatasetInfo && attachmentDatasetInfo[ 0 ] ) {
                    attachmentDatasetInfo[ 0 ].forEach( ( dataset ) => {
                        const vmo = vmoSvc.createViewModelObject( dataset );
                        ngpVMOPropSvc.setIconURL( vmo );
                        attachments.push( vmo );
                    } );
                }

                if( attributeGroupRelationInfo && attributeGroupRelationInfo[ 0 ] ) {
                    attributeGroupRelationInfo[ 0 ].forEach( ( ag ) => {
                        const vmo = vmoSvc.createViewModelObject( ag );
                        ngpVMOPropSvc.setIconURL( vmo );
                        attributeGroups.push( vmo );
                    } );
                }

                if( sourceObjectForms ) {
                    sourceObjectForms.forEach( ( form ) => {
                        const vmo = vmoSvc.createViewModelObject( form );
                        ngpVMOPropSvc.setIconURL( vmo );
                        forms.push( vmo );
                    } );
                }
            }
            return {
                attachments,
                attributeGroups,
                forms,
                allDataProvidersPopulated: true
            };
        },
        () => {
            return {
                attachments: [],
                attributeGroups: [],
                forms: [],
                allDataProvidersPopulated: true
            };
        }
    );
}
/**
 *
 * Removes previously selected object in all dataProviders but the one with the current selection
 * @param {dataProvider[]} dataProviders array of the data provider objects
 * @param {ViewModelObject[]} selectedObjects an array of selected object
 */
export function keepSelectionInOneDataProvider( dataProviders, selectedObjects ) {
    dataProviders.forEach( ( dp ) => {
        const foundSelectedVmo = Array.isArray( selectedObjects ) ?
            _.find( dp.getViewModelCollection().getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === selectedObjects[ 0 ].uid ) : false;
        if( !foundSelectedVmo ) {
            dp.selectNone();
        }
    } );
}

/**
 * This method checks if we can delete object or only remove relation and then delegates the call to the corresponding function
 *
 * @param {modelObject} objectToDelete - The object to delete (AG or Attachment)
 */
export function deleteAttachmentsAgs( objectToDelete ) {
    //check if we are trying to delete an object that the user doesn't have permission to delete
    let splittedString = objectToDelete.props[ ngpPropConstants.PROTECTION ].dbValues[ 0 ].split( '-' )[ 0 ];
    const cannotDeleteObject = splittedString.toLowerCase().indexOf( 'd' ) === -1;
    if( cannotDeleteObject ) {
        const objectToDeleteDisplayName = objectToDelete.props[ ngpPropConstants.OBJECT_STRING ].uiValue ||
            objectToDelete.props[ ngpPropConstants.OBJECT_STRING ].uiValues && objectToDelete.props[ ngpPropConstants.OBJECT_STRING ].uiValues[ 0 ];
        let deleteConfirmationMessage = localizedMsgs.cannotDeleteAttachmentOrAg.format( objectToDeleteDisplayName );
        mfgNotificationUtils.displayConfirmationMessage( deleteConfirmationMessage, localizedMsgs.remove, localizedMsgs.cancel ).then(
            () => {
                return ngpRelationService.removeObjects( [ objectToDelete ], errorsToIgnoreWhenRemovingRelation ).then(
                    () => {
                        eventBus.publish( 'ngp.removedRelation', {
                            removedRelationOf: [ objectToDelete.uid ]
                        } );
                    }
                );
            }
        );
    } else {
        ngpRelationService.removeObjectsWithConfirmation( [ objectToDelete ] );
    }
}

/**
 *
 * @param {dataset[]} files - dataset files
 * @returns {promise} a promise object
 */
function ensureFilesRefListLoaded( files ) {
    const fileUids = files.map( ( file ) => file.uid );
    return dms.getProperties( fileUids, [ ngpPropConstants.REF_LIST ] );
}

/**
 * this method downloads given attachment file
 * @param {Object[]} files files
 */
export function downloadAttachment( files ) {
    ensureFilesRefListLoaded( files )
        .then(
            () => {
                const updatedFileObjects = files.map( ( file ) => cdm.getObject( file.uid ) );
                const imanFileUids = [];
                updatedFileObjects.forEach( ( file ) => imanFileUids.push( ...file.props[ ngpPropConstants.REF_LIST ].dbValues ) );
                const imanFiles = imanFileUids.map( ( uid ) => cdm.getObject( uid ) ).filter( ( obj ) => Boolean( obj ) );
                if( imanFiles.length > 0 ) {
                    return ngpSoaSvc.executeSoa( 'Core-2006-03-FileManagement', 'getFileReadTickets', { files: imanFiles } );
                }
                //currently we only download one file at a time, so no need for multiple files messages
                const zeroCompileMsgs = localeService.getLoadedText( 'ZeroCompileCommandMessages.json' );
                const msg = zeroCompileMsgs.dataSetCannotBeDownloaded.format( files[ 0 ].props[ ngpPropConstants.OBJECT_STRING ].dbValues[ 0 ] );
                msgSvc.showInfo( msg );
                return null;
            }
        )
        .then(
            ( ticketsResponse ) => {
                if( ticketsResponse && ticketsResponse.tickets && ticketsResponse.tickets.length > 1 ) {
                    const imanFiles = ticketsResponse.tickets[ 0 ];
                    const fileNameAndTicketArray = imanFiles.map( ( imanFile, index ) => {
                        let fileName = imanFile.props[ ngpPropConstants.ORIGINAL_FILE_NAME ].uiValues[ 0 ];
                        return {
                            fileName,
                            fileTicket: ticketsResponse.tickets[ 1 ][ index ]
                        };
                    } );
                    if( fileNameAndTicketArray.length > 0 ) {
                        fmsUtils.openFiles( fileNameAndTicketArray );
                    }
                }
            }
        );
}

let exports = {};
export default exports = {
    getAttachmentsAgsAndForms,
    keepSelectionInOneDataProvider,
    deleteAttachmentsAgs,
    downloadAttachment
};
