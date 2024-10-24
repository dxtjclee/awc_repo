// Copyright (c) 2022 Siemens

import ngpAssignmentSvc from 'js/services/ngpAssignmentStatusesService';
import mfeTooltipUtils from 'js/mfeGenericTooltipUtil';
import localeSvc from 'js/localeService';
import { getBaseUrlPath } from 'app';
import popupSvc from 'js/popupService';
import awPromiseService from 'js/awPromiseService';
import dms from 'soa/dataManagementService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpClientRequiredInfoConstants from 'js/constants/ngpClientRequiredInfoConstants';
import ngpNavigationSvc from 'js/services/ngpNavigationService';
import ngpSelectUponLoadSvc from 'js/services/ngpSelectUponLoadService';
import eventBus from 'js/eventBus';
import ngpLoadService from 'js/services/ngpLoadService';
import cdm from 'soa/kernel/clientDataModel';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import appCtxSvc from 'js/appCtxService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';

const localizedMsgs = localeSvc.getLoadedText( 'NgpProductAssignmentMessages' );

/**
 * NGP Ui Assignment Statuses service
 *
 * @module js/services/ngpAssignmentStatusesTableCellService
 */

/**
 *
 * @param {ViewModelObject} vmo - the VMO which represents the row the cell exists it
 * @param {DOMElement} containerElement - DOMElement that should contain the image
 */
export function renderAssignmentStatusesCellImage( vmo, containerElement ) {
    if( !vmo.props.assignmentIndication ) {
        return;
    }
    const status = vmo.props.assignmentIndication.dbValue;
    let imageUrl;
    switch ( status ) {
        case ngpAssignmentSvc.assignmentStatusConstants.ASSIGNED_TO_BE_OR_ACTIVITY:
            imageUrl = `${getBaseUrlPath()}/image/indicatorAssignedToPlanningScope16.svg`;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.ASSIGNED_TO_BE_OR_ACTIVITY_MULTIPLE_TIMES:
            imageUrl = `${getBaseUrlPath()}/image/indicatorMultipleAssignmentToPlanningScope16.svg`;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.CONSUMED_TO_PROCESS:
            imageUrl = `${getBaseUrlPath()}/image/indicatorAssigned16.svg`;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.CONSUMED_TO_PROCESS_MULTIPLE_TIMES:
        case ngpAssignmentSvc.assignmentStatusConstants.CONSUMED_TO_PROCESS_AND_ASSIGNED_TO_BE_OR_ACT:
            imageUrl = `${getBaseUrlPath()}/image/indicatorMultipleAssignments16.svg`;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.NO_STATE:
            break;
        default:
            break;
    }
    if( imageUrl ) {
        const element = createAndAppendIconCellElement( imageUrl, containerElement );
        element.addEventListener( 'mouseover', onHover.bind( this, element, status ) );
        element.addEventListener( 'mouseout', mfeTooltipUtils.hideCellIconIndicationTooltip );
        element.addEventListener( 'click', () => showAssignmentIndicationPopupOnClick( vmo, containerElement.parentElement ), false );
    }
}

/**
 *
 * @param {DomElement} element - the dom element we hover over
 * @param {string} status - the clone/master status of the given vmo
 */
function onHover( element, status ) {
    const tooltipObj = {};
    switch ( status ) {
        case ngpAssignmentSvc.assignmentStatusConstants.ASSIGNED_TO_BE_OR_ACTIVITY:
            tooltipObj.title = localizedMsgs.assignedToBeOrActivityTooltipTitle;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.ASSIGNED_TO_BE_OR_ACTIVITY_MULTIPLE_TIMES:
            tooltipObj.title = localizedMsgs.assignedToBeOrActivityMultipleTimesTooltipTitle;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.CONSUMED_TO_PROCESS:
            tooltipObj.title = localizedMsgs.consumedToProcessTooltipTitle;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.CONSUMED_TO_PROCESS_MULTIPLE_TIMES:
            tooltipObj.title = localizedMsgs.consumedToProcessMultipleTimesTooltipTitle;
            break;
        case ngpAssignmentSvc.assignmentStatusConstants.CONSUMED_TO_PROCESS_AND_ASSIGNED_TO_BE_OR_ACT:
            tooltipObj.title = localizedMsgs.consumedToProcessAndAssignedToBeOrActivityTooltipTitle;
            break;
        default:
            break;
    }
    mfeTooltipUtils.displayCellIconIndicationTooltip( element, tooltipObj );
}

/**
 *
 * @param {string} imageUrl - the image url path
 * @param {DOMElement} parentElement - the parent element which should contain the cell
 * @return {DOMElement} the created element
 */
function createAndAppendIconCellElement( imageUrl, parentElement ) {
    const cellImage = document.createElement( 'img' );
    cellImage.src = imageUrl;
    parentElement.appendChild( cellImage );
    return cellImage;
}

/**
 *
 * @param {ViewModelObject} contextObject - the VMO which represents the row the cell exists it
 * @param {DOMElement} reference - the created element
 */
function showAssignmentIndicationPopupOnClick( contextObject, reference ) {
    popupSvc.show( {
        declView: 'NgpAssignmentIndicationInProductScopeListPopup',
        options: {
            whenParentScrolls: 'close',
            reference,
            placement: 'bottom-start',
            isModal: false,
            flipBehavior: 'opposite',
            clickOutsideToClose: true,
            ignoreReferenceClick: true
        },
        subPanelContext: {
            contextObject
        }
    } );
}
/**
 *
 * @param {string} inputObject - the image url path
 * @param {DOMElement} dataProviderName - the parent element which should contain the cell
 * @param {DOMElement} dataProvider - the created element
 */
export function addDataProviderToObject( inputObject, dataProviderName, dataProvider ) {
    if( !inputObject.dataProviders ) {
        inputObject.dataProviders = {};
    }
    inputObject.dataProviders[ dataProviderName ] = dataProvider;
}

/**
 *
 * @param {Object} subPanelContext - the image url path
 * @returns {object} - an object with the new context and true if there was an actual change
 */
export function loadAssignmentData( subPanelContext ) {
    let assignmentIndicationAssignedIn = {};

    const assignmentIndicationInfo = subPanelContext.contextObject.assignment_array;
    const inScopeNodes = assignmentIndicationInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INCURRENTSCOPE ].concat(
        assignmentIndicationInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_ACTIVITIES_INCURRENTSCOPE ],
        assignmentIndicationInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INCURRENTSCOPE ] );
    const outOfScopeNodes = assignmentIndicationInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INOTHERSCOPE ].concat(
        assignmentIndicationInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_ACTIVITIES_INOTHERSCOPE ],
        assignmentIndicationInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INOTHERSCOPE ] );

    //get object_string property for nodes that might be not loaded
    const inScopeNodesUids = inScopeNodes.map( ( obj ) => obj.uid );
    const outOfScopeNodesUids = outOfScopeNodes.map( ( obj ) => obj.uid );
    const uidsToLoad = inScopeNodesUids.concat( outOfScopeNodesUids );
    dms.getProperties( uidsToLoad, [ ngpPropConstants.OBJECT_STRING ] );

    assignmentIndicationAssignedIn.inScopeNodes = inScopeNodes;
    assignmentIndicationAssignedIn.outOfScopeNodes = outOfScopeNodes;

    const awPromise = awPromiseService.instance;
    return awPromise.resolve( assignmentIndicationAssignedIn );
}

/**
 *
 * @param {Object} uidsToSelectInBuildStrategy - array of BE/Act uids to find in build strategy table
 * @param {Object} uidsToSelectInAssignedPartsTable - array of DE/DF uids to find in assigned parts table
 */
export function findAndRevealAssignedTo( uidsToSelectInBuildStrategy, uidsToSelectInAssignedPartsTable ) {
    const uid = ngpDataUtils.getFoundationIdFromUid( uidsToSelectInBuildStrategy[ 0 ] );
    getIDsChain( uidsToSelectInAssignedPartsTable[ 0 ] ).then( ( idsChain ) => {
        ifObjectIsInCurrentScope( uid ).then(
            ( navigateInCurrentScope ) => {
                if( navigateInCurrentScope ) {
                    eventBus.publish( 'ngp.selectOrHighlightObjects', {
                        uidsToSelect: [ uid ]
                    } );
                    eventBus.publish( 'ngp.selectAssignedObjects', {
                        assignedTo : uid,
                        selection: idsChain
                    } );
                } else {
                    //out of scope case
                    ngpSelectUponLoadSvc.setUidsToSelectUponLoad( [ uid ] );
                    const modelObj = cdm.getObject( uid );
                    ngpNavigationSvc.showObjectInBuildStrategyPage( modelObj, 'newTab' );
                }
            }
        );
        ngpSelectUponLoadSvc.setUidsToSelectUponLoad( idsChain, true );
    } );
}

/**
 *
 * @param {Object} uid - the image url path
 * @returns {Promise} -  promise with value true if the object is in same scope with topNodeUid. false otherwise
 */
function ifObjectIsInCurrentScope( uid ) {
    const topNode = appCtxSvc.getCtx( 'ngp.scopeObject' );
    const topNodeFoundationUid = ngpDataUtils.getFoundationIdFromUid( topNode.uid );
    if( uid === topNodeFoundationUid ) {
        return new Promise( ( res ) => res( false ) );
    }
    return ngpLoadService.ensureObjectsLoaded( [ uid ] )
        .then(
            () => {
                const modelObj = cdm.getObject( uid );
                return ngpModelUtils.getAncestorUidsAsync( modelObj, [] ).then( ( ancestorUids )=> {
                    return ancestorUids.indexOf( topNodeFoundationUid ) >= 0;
                } );
            }
        );
}

/**
 *
 * @param {String} inputUid - uid of object to select in assigned parts table
 * @returns {Promise} - promise with product element IDs chain
 */
function getIDsChain( inputUid ) {
    const uid = ngpDataUtils.getFoundationIdFromUid( inputUid );
    const modelObj = cdm.getObject( uid );
    return ngpModelUtils.getAncestorUidsAsync( modelObj, [] ).then( ( ancestorUids ) => {
        let chainUids = [ uid ];
        // Add ancestorUids into the object uid
        chainUids.push( ...ancestorUids );
        return chainUids.map( ( uid ) => {
            const modelObj = cdm.getObject( uid );
            return ngpTypeUtils.getProductElementID( modelObj );
        } );
    } );
}

let exports;
export default exports = {
    renderAssignmentStatusesCellImage,
    addDataProviderToObject,
    loadAssignmentData,
    findAndRevealAssignedTo
};
