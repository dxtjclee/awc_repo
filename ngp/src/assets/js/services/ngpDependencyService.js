// Copyright (c) 2022 Siemens

import ngpRelationSvc from 'js/services/ngpRelationService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpTableCellRenderSvc from 'js/services/ngpTableCellRenderService';
import mfeTooltipUtils from 'js/mfeGenericTooltipUtil';
import mfeNotyUtils from 'js/mfgNotificationUtils';

import { getBaseUrlPath } from 'app';
import localeSvc from 'js/localeService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import msgSvc from 'js/messagingService';
import eventBus from 'js/eventBus';

import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';

const localizedMsgs = localeSvc.getLoadedText( 'NgpDetailedPlanningMessages' );
const DEPENDENCY_TYPE = 'dependencyType';
const PREDECESSOR_TYPE = 'predecessorType';
const SUCCESSOR_TYPE = 'successorType';

const EXTERNAL_PREDECESSORS_IMAGE_NAME = 'indicatorHasExternalPredecessors16.svg';
const EXTERNAL_SUCCESSORS_IMAGE_NAME = 'indicatorHasExternalSuccessors16.svg';

const PRED_DEPENDENCY_TYPE_TOOLTIP_DATA = {
    extendedTooltip: {
        title: localizedMsgs.predecessorDependencyTooltipTitle,
        messages: [ localizedMsgs.predecessorDependencyTooltipMsg ]
    }
};
const SUCC_DEPENDENCY_TYPE_TOOLTIP_DATA = {
    extendedTooltip: {
        title: localizedMsgs.successorTooltipTitle,
        messages: [ localizedMsgs.successorDependencyTooltipMsg ]
    }
};
const HAS_EXTERNAL_PREDECESSORS_TOOLTIP_DATA = {
    title: localizedMsgs.externalPredecessorTooltipTitle,
    messages: [ localizedMsgs.externalPredecessorTooltipMsg ],
    instruction: localizedMsgs.externalDependencyTooltipInstruction,
    className: 'aw-ngp-tooltipPadding'
};
const HAS_EXTERNAL_SUCCESSORS_TOOLTIP_DATA = {
    title: localizedMsgs.externalSuccessorsTooltipTitle,
    messages: [ localizedMsgs.externalSuccessorsTooltipMsg ],
    instruction: localizedMsgs.externalDependencyTooltipInstruction,
    className: 'aw-ngp-tooltipPadding'
};

/**
 * NGP dependency service
 *
 * @module js/services/ngpDependencyService
 */
'use strict';

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @returns {promise<modelObject[]>} - a promise which is resolved to an array of modelObjects
 */
export function loadDependenciesTableData( modelObject ) {
    return ngpRelationSvc.getProcessDependencies( modelObject ).then(
        ( dependentModelObjects ) => dependentModelObjects.map(
            ( modelObj ) => {
                const vmo = viewModelObjectSvc.createViewModelObject( modelObj );
                createDependencyTypeProperty( vmo, modelObject );
                return vmo;
            }
        )
    );
}

/**
 *
 * @param {modelObject[]} dependenciesToRemove - the dependency objects to remove
 * @param {modelObject} contextObject - the object which is either predecessor or successor of the given dependencies
 * @returns {promise} a promise object
 */
export function removeExternalDependencies( dependenciesToRemove, contextObject ) {
    const externalPredecessers = dependenciesToRemove.filter( ( modelObj ) => modelObj.props[ DEPENDENCY_TYPE ].value === PREDECESSOR_TYPE );
    if( externalPredecessers.length > 0 ) {
        if( externalPredecessers.length === dependenciesToRemove.length ) {
            return removeExternalPredecessors( externalPredecessers, contextObject );
        }
        return mfeNotyUtils.displayConfirmationMessage( localizedMsgs.canRemoveOnlyExternalPredecessors, localizedMsgs.continue, localizedMsgs.cancel ).then(
            removeExternalPredecessors.bind( this, externalPredecessers, contextObject ),
            () => null
        );
    }
    const closeBtn = mfeNotyUtils.createButtonWhichClosesNotyMsg( localizedMsgs.close );
    msgSvc.showError( localizedMsgs.cannotRemoveExternalSuccessors, null, null, [ closeBtn ] );
    return new Promise( ( res ) => res( null ) );
}

/**
 *
 * @param {modelObject[]} predecessors - the predecessors of the given successor
 * @param {modelObject} contextObject - the successor of the given predecessors
 * @returns {promise} a promise object
 */
function removeExternalPredecessors( predecessors, contextObject ) {
    const predAndSuccPairsArray = predecessors.map( ( predecessor ) => ( {
        predecessor,
        successor: contextObject
    } ) );
    return ngpRelationSvc.removePredecessors( predAndSuccPairsArray ).then(
        postRemoveExternalPredecessors.bind( this, predecessors, contextObject ),
        postRemoveExternalPredecessors.bind( this, predecessors, contextObject )
    );
}

/**
 *
 * @param {modelObject[]} predecessors - the predecessors of the given successor
 * @param {modelObject} contextObject - the successor of the given predecessors
 */
function postRemoveExternalPredecessors( predecessors, contextObject ) {
    const updatedPreds = contextObject.props[ ngpPropConstants.CROSS_ACTIVITY_PREDECESSORS ].dbValues;
    const removedPredecessors = predecessors.filter( ( pred ) => updatedPreds.indexOf( pred ) === -1 );
    if( removedPredecessors.length > 0 ) {
        eventBus.publish( 'ngp.removedExternalPredecessors', {
            successor: contextObject,
            removedPredecessorsUids: removedPredecessors.map( ( obj ) => obj.uid )
        } );
    }
}

/**
 *
 * @param {ViewModelObject} vmo - a given vmo
 * @param {modelObject} dependencyWithModelObj - the modelObject the given vmo has a dependency with
 */
function createDependencyTypeProperty( vmo, dependencyWithModelObj ) {
    let dependencyType = SUCCESSOR_TYPE;
    const predecessors = dependencyWithModelObj.props[ ngpPropConstants.CROSS_ACTIVITY_PREDECESSORS ].dbValues;
    if( predecessors.indexOf( vmo.uid ) > -1 ) {
        dependencyType = PREDECESSOR_TYPE;
    }
    const dependencyTypePropObj = {
        value: dependencyType,
        displayValue: dependencyType,
        propType: 'STRING'
    };
    vmo.props[ DEPENDENCY_TYPE ] = viewModelObjectSvc.constructViewModelProperty( dependencyTypePropObj, DEPENDENCY_TYPE, vmo, false );
}

/**
 *
 * @param {ViewModelObject} vmo - a given vmo
 * @param {DOMElement} containerElement - the container element which will contain the image
 */
export function renderDependencyTypeCellImage( vmo, containerElement ) {
    const dependencyType = vmo.props[ DEPENDENCY_TYPE ].value;
    let imageUrl;
    let tooltipData;
    switch ( dependencyType ) {
        case SUCCESSOR_TYPE:
            imageUrl = EXTERNAL_SUCCESSORS_IMAGE_NAME;
            tooltipData = SUCC_DEPENDENCY_TYPE_TOOLTIP_DATA;
            break;
        case PREDECESSOR_TYPE:
            imageUrl = EXTERNAL_PREDECESSORS_IMAGE_NAME;
            tooltipData = PRED_DEPENDENCY_TYPE_TOOLTIP_DATA;
            break;
        default:
            break;
    }
    if( imageUrl ) {
        const props = {
            imageSrc: `${getBaseUrlPath()}/image/${imageUrl}`,
            tooltipView: 'MfeGenericTooltip',
            tooltipData
        };
        let extendedTooltipElement = includeComponent( 'MfeTableCellImage', props );
        renderComponent( extendedTooltipElement, containerElement );
    }
}

/**
 *
 * @param {DomElement} element - the dom element we hover over
 * @param {boolean} hasPredecessorsIcon - true if we are hovering over an icon indication it has predecessors
 */
function onHoverOverPredOrSuccDependencyIcon( element, hasPredecessorsIcon ) {
    mfeTooltipUtils.displayCellIconIndicationTooltip( element, hasPredecessorsIcon ? HAS_EXTERNAL_PREDECESSORS_TOOLTIP_DATA : HAS_EXTERNAL_SUCCESSORS_TOOLTIP_DATA );
}

/**
 *
 * @param {ViewModelObject} vmo - a given vmo
 * @param {DOMElement} containerElement - the container element which will contain the image
 */
export function renderPredecessorDependencyCellImage( vmo, containerElement ) {
    renderPredOrSuccDependencyCellImage( vmo, containerElement, ngpPropConstants.NUM_OF_CROSS_ACTIVITY_PREDECESSORS, EXTERNAL_PREDECESSORS_IMAGE_NAME );
}

/**
 *
 * @param {ViewModelObject} vmo - a given vmo
 * @param {DOMElement} containerElement - the container element which will contain the image
 */
export function renderSuccessorDependencyCellImage( vmo, containerElement ) {
    renderPredOrSuccDependencyCellImage( vmo, containerElement, ngpPropConstants.NUM_OF_CROSS_ACTIVITY_SUCCESSORS, EXTERNAL_SUCCESSORS_IMAGE_NAME );
}

/**
 *
 * @param {ViewModelObject} vmo - a given vmo
 * @param {DOMElement} containerElement - the container element which will contain the image
 * @param {string} propName - the property name we need to fetch the information from
 * @param {string} imageFileName - the image file name
 */
function renderPredOrSuccDependencyCellImage( vmo, containerElement, propName, imageFileName ) {
    if( vmo.props[ propName ] && vmo.props[ propName ].dbValue > 0 ) {
        const imageUrl = `${getBaseUrlPath()}/image/${imageFileName}`;
        const element = ngpTableCellRenderSvc.createAndAppendIconCellElement( imageUrl, containerElement, [ 'aw-ngp-tableIconCellCursor' ] );
        element.addEventListener( 'mouseover', onHoverOverPredOrSuccDependencyIcon.bind( this, element, propName === ngpPropConstants.NUM_OF_CROSS_ACTIVITY_PREDECESSORS ) );
        addMouseOutEventListener( element );
        element.addEventListener( 'click', () => eventBus.publish( 'ngp.contentElementsTable.dependencyIconClick' ) );
    }
}

/**
 *
 * @param {DomElement} element - a given dom element we can add a mouse out event upon
 */
function addMouseOutEventListener( element ) {
    element.addEventListener( 'mouseout', mfeTooltipUtils.hideCellIconIndicationTooltip );
}

let exports = {};
export default exports = {
    loadDependenciesTableData,
    renderDependencyTypeCellImage,
    renderPredecessorDependencyCellImage,
    renderSuccessorDependencyCellImage,
    removeExternalDependencies
};
