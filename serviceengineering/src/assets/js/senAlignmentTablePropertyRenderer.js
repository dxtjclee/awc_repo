// Copyright (c) 2022 Siemens

/**
 *
 * @module js/senAlignmentTablePropertyRenderer
 */
import compUtil from 'js/senCompareUtils';
import senAlignmentCellRenderer from 'js/senAlignmentCellRenderer';
import dataMgmtService from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import { svgString as headerCompletion } from 'image/headerCompletion16.svg';
import { svgString as headerMismatch } from 'image/headerMismatch16.svg';
import senPLFCellRenderer from 'js/senPLFCellRenderer';

const  EBOM_CONTEXT = 'ebomContext';
const  SBOM_CONTEXT = 'sbomContext';


const ICON_ASSIGNED = 'indicatorAssigned16.svg';
const ICON_OVER_ASSIGNED = 'indicatorMultipleAssignmentsError16.svg';
const ICON_PARTIALLY_ASSIGNED = 'indicatorPartiallyAssignedByDescendants16.svg';
const ICON_FULLY_ASSIGNED = 'indicatorFullyAssignedByDescendants16.svg';
const ICON_PARTIAL_QUANTITY_ASSIGNED = 'indicatorPartialQuantityAssigned16.svg';
const ICON_PARTIAL_QUANTITY_ASSIGNED_RED = 'indicatorPartialQuantityAssignedAndOverassigned16.svg';
const ICON_MISMATCH = 'indicatorMismatch16.svg';
const ICON_INNER_MISMATCH = 'indicatorContainsInnerMismatches16.svg';
const ICON_MISSING = 'indicatorMissingInSource16.svg';
const ICON_MANUFACTURING_REP = 'indicatorHasManufacturingRepresentation16.svg';
const ICON_ASSIGNED_OUTOF_SCOPE = 'indicatorAssignedInOtherScope16.svg';
const ICON_OVER_ASSIGNED_OUTOF_SCOPE = 'indicatorMultipleAssignmentsInOtherScope16.svg';
const ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE = 'indicatorPartialQuantityAssignedInOtherScope16.svg';
const ICON_PARTIALLY_ASSIGNED_OUTOF_SCOPE = 'indicatorPartiallyAssignedByDescendantsInOtherScope16.svg';
const ICON_FULLY_ASSIGNED_OUTOF_SCOPE = 'indicatorFullyAssignedByDescendantsInOtherScope16.svg';
const ICON_MISMATCH_OUTOF_SCOPE = 'indicatorMishmatchInOtherScope16.svg';
const ICON_INNER_MISMATCH_OUTOF_SCOPE = 'indicatorContainsInnerMismatchesInOtherScope16.svg';
const ICON_FULLY_ASSIGNED_WITH_OVERASSIGNMENT = 'indicatorFullyAndOverAssignedByDescendants16.svg';
const ICON_PARTIALLY_ASSIGNED_WITH_OVERASSIGNMENT = 'indicatorPartiallyAndOverAssignedByDescendants16.svg';
const ICON_FULLY_ASSIGNED_WITH_OVERASSIGNMENT_OUTOF_SCOPE = 'indicatorFullyAndOverAssignedByDescendantsInOtherScope16.svg';
const ICON_PARTIALLY_ASSIGNED_WITH_OVERASSIGNMENT_OUTOF_SCOPE = 'indicatorPartiallyAndOverAssignedByDescendantsInOtherScope16.svg';

const ASSIGNMENT_EBOM_CLICKABLE_STATUS = [ 2, 4, 5, 6, 7, 8, 57, 58, 62, 63, 64, 66, 72, 73, 74, 75, 101, 102, 103, 104, 105, 106, 119 ];

const configIconSources = {
    assignmentIndication: {
        2: ICON_ASSIGNED,
        4: ICON_ASSIGNED,
        5: ICON_OVER_ASSIGNED,
        6: ICON_OVER_ASSIGNED,
        7: ICON_PARTIAL_QUANTITY_ASSIGNED,
        8: ICON_PARTIAL_QUANTITY_ASSIGNED,
        51: ICON_PARTIALLY_ASSIGNED,
        52: ICON_PARTIALLY_ASSIGNED,
        53: ICON_FULLY_ASSIGNED,
        54: ICON_FULLY_ASSIGNED,
        57: ICON_PARTIAL_QUANTITY_ASSIGNED,
        58: ICON_PARTIAL_QUANTITY_ASSIGNED,
        59: ICON_PARTIAL_QUANTITY_ASSIGNED_RED,
        60: ICON_PARTIAL_QUANTITY_ASSIGNED_RED,
        61: ICON_PARTIAL_QUANTITY_ASSIGNED,
        62: ICON_OVER_ASSIGNED,
        63: ICON_ASSIGNED,
        64: ICON_OVER_ASSIGNED,
        65: ICON_PARTIAL_QUANTITY_ASSIGNED,
        66: ICON_ASSIGNED,
        70: ICON_PARTIAL_QUANTITY_ASSIGNED,
        71: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        72: ICON_OVER_ASSIGNED_OUTOF_SCOPE,
        73: ICON_ASSIGNED_OUTOF_SCOPE,
        74: ICON_ASSIGNED_OUTOF_SCOPE,
        75: ICON_OVER_ASSIGNED_OUTOF_SCOPE,
        76: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        77: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        78: ICON_PARTIAL_QUANTITY_ASSIGNED_RED,
        101:ICON_ASSIGNED_OUTOF_SCOPE,
        102:ICON_ASSIGNED_OUTOF_SCOPE,
        103: ICON_OVER_ASSIGNED_OUTOF_SCOPE,
        104: ICON_OVER_ASSIGNED_OUTOF_SCOPE,
        105: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        106: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        107: ICON_PARTIALLY_ASSIGNED_OUTOF_SCOPE,
        108: ICON_FULLY_ASSIGNED_OUTOF_SCOPE,
        109: ICON_PARTIALLY_ASSIGNED_OUTOF_SCOPE,
        110: ICON_FULLY_ASSIGNED_OUTOF_SCOPE,
        111: ICON_FULLY_ASSIGNED_WITH_OVERASSIGNMENT,
        112: ICON_PARTIALLY_ASSIGNED_WITH_OVERASSIGNMENT,
        113: ICON_FULLY_ASSIGNED_WITH_OVERASSIGNMENT_OUTOF_SCOPE,
        114: ICON_PARTIALLY_ASSIGNED_WITH_OVERASSIGNMENT_OUTOF_SCOPE,
        115: ICON_FULLY_ASSIGNED_WITH_OVERASSIGNMENT,
        116: ICON_PARTIALLY_ASSIGNED_WITH_OVERASSIGNMENT,
        117: ICON_FULLY_ASSIGNED_WITH_OVERASSIGNMENT_OUTOF_SCOPE,
        118: ICON_PARTIALLY_ASSIGNED_WITH_OVERASSIGNMENT_OUTOF_SCOPE,
        119: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        120: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        121: ICON_PARTIAL_QUANTITY_ASSIGNED,
        122: ICON_PARTIAL_QUANTITY_ASSIGNED,
        123: ICON_PARTIAL_QUANTITY_ASSIGNED,
        124: ICON_PARTIAL_QUANTITY_ASSIGNED,
        125: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        126: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        127: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE,
        128: ICON_PARTIAL_QUANTITY_ASSIGNED_OUTOF_SCOPE
    },
    mismatchIndication: {
        2: ICON_MISMATCH,
        6: ICON_MISMATCH,
        8: ICON_MISMATCH,
        52: ICON_INNER_MISMATCH,
        54: ICON_INNER_MISMATCH,
        58: ICON_MISMATCH,
        59: ICON_INNER_MISMATCH,
        61: ICON_INNER_MISMATCH,
        62: ICON_INNER_MISMATCH,
        63: ICON_INNER_MISMATCH,
        70: ICON_INNER_MISMATCH,
        74: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        75: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        76: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        78: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        101: ICON_MISMATCH_OUTOF_SCOPE,
        104: ICON_MISMATCH_OUTOF_SCOPE,
        106: ICON_MISMATCH_OUTOF_SCOPE,
        109: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        110: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        115: ICON_INNER_MISMATCH,
        116: ICON_INNER_MISMATCH,
        117: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        118: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        120: ICON_MISMATCH_OUTOF_SCOPE,
        123: ICON_INNER_MISMATCH,
        124: ICON_INNER_MISMATCH,
        127: ICON_INNER_MISMATCH_OUTOF_SCOPE,
        128: ICON_INNER_MISMATCH_OUTOF_SCOPE
    },
    mismatchOrMissingIndication: {
        1: ICON_MISSING,
        2: ICON_MISMATCH,
        6: ICON_MISMATCH,
        8: ICON_MISMATCH,
        55: ICON_INNER_MISMATCH,
        58: ICON_MISMATCH,
        63: ICON_INNER_MISMATCH,
        67: ICON_INNER_MISMATCH,
        68: ICON_INNER_MISMATCH,
        69: ICON_INNER_MISMATCH
    }
};
/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 *
 */
let getAssignmentIndicationRenderer = function( vmo, containerElement, columnName ) {
    let status = compUtil.getStatus( EBOM_CONTEXT, vmo.uid );

    if( configIconSources.assignmentIndication.hasOwnProperty( status ) ) {
        let iconSource = configIconSources[ columnName ][ status ];
        let contextObject = {
            vmo: vmo,
            status: status
        };
        if( status === 57 || status === 58 || status === 105 || status === 106 ) {
            let uids = compUtil.findDifferencesFor( EBOM_CONTEXT, vmo.uid );
            dataMgmtService.loadObjects( uids ).then( function() {
                let assignedObjets = cdm.getObjects( uids );
                dataMgmtService.getProperties( uids, [ 'awb0Quantity' ] ).then( function() {
                    assignedObjets = cdm.getObjects( uids );
                    let assignedQuantity = 0;
                    for( let i = 0; i < assignedObjets.length; i++ ) {
                        assignedQuantity += isNaN( parseInt( assignedObjets[ i ].props.awb0Quantity.dbValues[ 0 ] ) ) ? 1 : parseInt( assignedObjets[ i ].props.awb0Quantity.dbValues[
                            0 ] );
                    }
                    let quantityInfo = {
                        totalQuantity: isNaN( parseInt( vmo.props.awb0Quantity.dbValues[ 0 ] ) ) ? 1 : parseInt( vmo.props.awb0Quantity.dbValues[ 0 ] ),
                        assignedQuantity: assignedQuantity
                    };
                    contextObject.quantityInfo = quantityInfo;
                    let callbackApi = getCallbackApi( EBOM_CONTEXT, vmo, 'sen.assignmentClickEvent' );
                    senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'SenAssignmentTooltip', null, callbackApi );
                } );
            } );
        } else {
            let callbackApi = ASSIGNMENT_EBOM_CLICKABLE_STATUS.indexOf( status ) > -1 ? getCallbackApi( EBOM_CONTEXT, vmo, 'sen.assignmentClickEvent' ) : null;
            senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'SenAssignmentTooltip', null, callbackApi );
        }
    }
};


/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 *
 */
let getMismatchIndicationRenderer = function( vmo, containerElement, columnName ) {
    let status = compUtil.getStatus( EBOM_CONTEXT, vmo.uid );
    if( configIconSources.mismatchIndication.hasOwnProperty( status ) ) {
        let iconSource = configIconSources[ columnName ][ status ];
        let contextObject = {
            vmo: vmo,
            status: status
        };
        senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'SenMismatchTooltip' );
    }
};


/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 *
 */
let getMismatchOrMissingIndicationRenderer = function( vmo, containerElement, columnName ) {
    let status = compUtil.getStatus( SBOM_CONTEXT, vmo.uid );
    if( configIconSources.mismatchOrMissingIndication.hasOwnProperty( status ) ) {
        let iconSource = configIconSources[ columnName ][ status ];
        let contextObject = {
            vmo: vmo,
            status: status
        };
        senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'SenMissingTooltip' );
    }
};

/**
 *
 * @param {String} contextKey contextKey
 * @param {Object} vmo vmo
 * @param {String} eventName eventName
 * @returns {function} function
 */
function getCallbackApi( contextKey, vmo, eventName ) {
    return function( event ) {
        let eventData = {
            vmo: vmo,
            contextName: contextKey,
            event:event
        };
        eventBus.publish( eventName, eventData );
    };
}

/**
 *
 * @param {String} resource resource name
 * @param {String} key key
 * @param {Array} params param
 * @returns {String} message
 */
function getTooltipData( resource, key, params ) {
    return localeService.getLocalizedText( resource, key ).then( function( msg ) {
        msg && params && params.forEach( function( item, index ) {
            msg = msg.replace( `{${index}}`, params[index] );
        } );
        return msg;
    } );
}

/**
  * Appends mismatch, missign and assignment header indications to the container element.
  * @param {DOMElement} containerElement containerElement
  * @param {Object} columnName the column associated with the cell
  *
  */
let getAlignmentColumnHeaderRenderer = function( containerElement, columnName ) {
    let imagePath;
    let altText;
    if( columnName === 'assignmentIndication' ) {
        imagePath = headerCompletion;
        altText = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'assignmentColumnTitle', null );
    } else if( columnName === 'mismatchIndication' ) {
        imagePath = headerMismatch;
        altText = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'mismatchColumnTitle', null );
    } else{
        imagePath = headerMismatch;
        altText = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'mismatchOrMissingColumnTitle', null );
    }

    let iconElement = document.createElement( 'span' );
    iconElement.className = 'aw-sen-header-visual-indicator';
    iconElement.innerHTML = imagePath;
    iconElement.title = altText;

    if( iconElement !== null ) {
        containerElement.appendChild( iconElement );
    }
};

export default {
    getAssignmentIndicationRenderer,
    getMismatchIndicationRenderer,
    getMismatchOrMissingIndicationRenderer,
    getTooltipData,
    getAlignmentColumnHeaderRenderer
};
