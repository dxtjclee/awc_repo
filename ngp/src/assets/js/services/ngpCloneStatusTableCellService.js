// Copyright (c) 2022 Siemens

import ngpCloneStatusCache from 'js/services/ngpCloneStatusCache';
import ngpCloneSvc from 'js/services/ngpCloneService';
import { getBaseUrlPath } from 'app';
import localeSvc from 'js/localeService';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';

const localizedMsgs = localeSvc.getLoadedText( 'NgpCloneMgmtMessages' );
const cloneImageCellStyling = 'aw-ngp-tableIconCellCursor';

/**
 * NGP Ui Clone service
 *
 * @module js/services/ngpCloneStatusTableCellService
 */

/**
 *
 * @param {ViewModelObject} vmo - the VMO which represents the row the cell exists it
 * @param {DOMElement} containerElement - DOMElement that should contain the image
 */
export function renderCloneStatusCellImage( vmo, containerElement ) {
    const status = ngpCloneStatusCache.getStatus( vmo.uid );
    let image;
    switch ( status ) {
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE:
        case ngpCloneStatusCache.cloneStatusConstants.CLONE:
            image = 'indicatorChipClone24.svg';
            break;
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_OUT_OF_DATE:
        case ngpCloneStatusCache.cloneStatusConstants.CLONE_OUT_OF_DATE:
            image = 'indicatorChipCloneOutOfDate24.svg';
            break;
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_MASTER_DELETED:
        case ngpCloneStatusCache.cloneStatusConstants.CLONE_MASTER_DELETED:
            image = 'indicatorChipCloneMissingMaster24.svg';
            break;
        default:
            break;
    }
    if( image ) {
        const props = {
            imageSrc: `${getBaseUrlPath()}/image/${image}`,
            tooltipView: 'MfeGenericTooltip',
            tooltipData: getTooltipData( vmo, status, false ),
            isClickable: true
        };
        let extendedTooltipElement = includeComponent( 'MfeTableCellImage', props );
        renderComponent( extendedTooltipElement, containerElement );
        addCloneClickHandler( containerElement, vmo );
    }
}

/**
 *
 * @param {ViewModelObject} vmo - the VMO which represents the row the cell exists it
 * @param {DOMElement} containerElement - DOMElement that should contain the image
 */
export function renderMasterStatusCellImage( vmo, containerElement ) {
    const status = ngpCloneStatusCache.getStatus( vmo.uid );
    let image;
    switch ( status ) {
        case ngpCloneStatusCache.cloneStatusConstants.MASTER:
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE:
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_MASTER_DELETED:
        case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_OUT_OF_DATE:
            image = 'indicatorChipMasterOfClone24.svg';
            break;
        default:
            break;
    }
    if( image ) {
        const props = {
            imageSrc: `${getBaseUrlPath()}/image/${image}`,
            tooltipView: 'MfeGenericTooltip',
            tooltipData: getTooltipData( vmo, status, true ),
            isClickable: true
        };
        let extendedTooltipElement = includeComponent( 'MfeTableCellImage', props );
        renderComponent( extendedTooltipElement, containerElement );
        addMasterClickHandler( containerElement, vmo );
    }
}

/**
 *
 * @param {DomElement} element - the dom element we hover over
 * @param {ViewModelObject} vmo - the vmo represented in the row
 * @param {string} status - the clone/master status of the given vmo
 * @param {boolean} isMasterIcon - true if we hover over the image represented in the master column
 */
function getTooltipData( vmo, status, isMasterIcon ) {
    const tooltipObj = {};
    if( isMasterIcon ) {
        tooltipObj.title = localizedMsgs.masterStatusTooltip.format( vmo.modelType.uiDisplayName.capital );
        tooltipObj.messages = [ localizedMsgs.masterTooltipMsg.format( vmo.modelType.uiDisplayName.lowerCase, vmo.modelType.uiDisplayName.plural ) ];
        tooltipObj.instruction = localizedMsgs.masterTooltipInstruction;
    } else {
        tooltipObj.title = localizedMsgs.cloneStatusTooltip.format( vmo.modelType.uiDisplayName.capital );
        tooltipObj.messages = [ localizedMsgs.cloneTooltipMsg.format( vmo.modelType.uiDisplayName.lowerCase ) ];
        switch ( status ) {
            case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE:
            case ngpCloneStatusCache.cloneStatusConstants.CLONE:
                tooltipObj.instruction = localizedMsgs.cloneTooltipInstruction;
                break;
            case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_OUT_OF_DATE:
            case ngpCloneStatusCache.cloneStatusConstants.CLONE_OUT_OF_DATE:
                tooltipObj.instruction = localizedMsgs.cloneTooltipInstruction;
                tooltipObj.information = localizedMsgs.cloneOutOfDateTooltipInformation;
                tooltipObj.className = 'aw-ngp-cloneTooltipWithWarning';
                break;
            case ngpCloneStatusCache.cloneStatusConstants.MASTER_AND_CLONE_MASTER_DELETED:
            case ngpCloneStatusCache.cloneStatusConstants.CLONE_MASTER_DELETED:
                tooltipObj.instruction = localizedMsgs.cloneWithDeletedMasterTooltipInsturction;
                tooltipObj.information = localizedMsgs.cloneWithDeletedMasterTooltipInformation.format( vmo.modelType.uiDisplayName.lowerCase );
                tooltipObj.className = 'aw-ngp-cloneTooltipWithWarning';
                break;
            default:
                break;
        }
    }
    return {
        extendedTooltip: tooltipObj
    };
}

/**
 *
 * @param {DOMobject} clickableElement - the container element
 * @param {modelObject} modelObject - a given modelObject
 */
function addMasterClickHandler( clickableElement, modelObject ) {
    clickableElement.addEventListener( 'click', () => {
        ngpCloneSvc.displayFindOrNavigateToCloneCmdList( modelObject, clickableElement );
    } );
}

/**
 *
 * @param {DOMobject} clickableElement - the container element
 * @param {modelObject} modelObject - a given modelObject
 */
function addCloneClickHandler( clickableElement, modelObject ) {
    clickableElement.addEventListener( 'click', () => {
        ngpCloneSvc.displayCloneCommandsList( modelObject, clickableElement );
    } );
}

/**
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @param {boolean} ascending - true if the sort should be in ascending order
 * @param {boolean} sortMasters - true if we need to sort only masters and not consider clones. False if vice versa
 * @return {ModelObject[]} a sorted array based on a given property value
 */
export function sortObjectsByCloneStatus( modelObjects, ascending, sortMasters ) {
    if( Array.isArray( modelObjects ) && modelObjects.length > 1 ) {
        return modelObjects.sort( ( obj1, obj2 ) => {
            let status1;
            let status2;
            if( sortMasters ) {
                status1 = ngpCloneStatusCache.isMaster( obj1.uid ) ? ngpCloneStatusCache.getStatus( obj1.uid ) : '';
                status2 = ngpCloneStatusCache.isMaster( obj2.uid ) ? ngpCloneStatusCache.getStatus( obj2.uid ) : '';
            } else {
                status1 = ngpCloneStatusCache.isClone( obj1.uid ) ? ngpCloneStatusCache.getStatus( obj1.uid ) : '';
                status2 = ngpCloneStatusCache.isClone( obj2.uid ) ? ngpCloneStatusCache.getStatus( obj2.uid ) : '';
            }
            if( ascending ) {
                return status1 >= status2 ? 1 : -1;
            }
            return status1 <= status2 ? 1 : -1;
        } );
    }
    return modelObjects;
}

let exports;
export default exports = {
    renderMasterStatusCellImage,
    renderCloneStatusCellImage,
    sortObjectsByCloneStatus
};
