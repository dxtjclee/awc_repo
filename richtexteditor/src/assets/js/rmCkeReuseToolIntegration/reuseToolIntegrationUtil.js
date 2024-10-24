// Copyright (c) 2022 Siemens

import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import { svgString as miscChevronUp } from 'image/miscChevronUp16.svg';
import { svgString as miscChevronDown } from 'image/miscChevronDown16.svg';

var exports = {};

var arrForCorrectionElements = [];
var arrForNavigateUpElements = [];
var arrForSeparators = [];
var arrForNavigateDownElements = [];
var arrForToggelButtonElements = [];

var localTextBundle = localeService.getLoadedText( 'RichTextEditorCommandPanelsMessages' );

/**
 * Module for the Ckeditor5 in Requirement Documentation Page
 *
 * @module js/rmCkeReuseToolIntegration/reuseToolIntegrationUtil
 */

/**
 * @param {*} viewWriter -
 * @param {*} editor -
 * @param {*} h3 -
 * @param {*} requirementHeader -
*/
function insertNavigationCommands( viewWriter, editor, h3, requirementHeader ) {
    const navigateUpElement = createNavigateUp( viewWriter, editor );
    const navigateDownElement = createNavigateDown( viewWriter, editor );
    const correctionElement = createCorrectionElement( viewWriter, editor );
    const separatorElement = createSeparator( viewWriter, editor );
    const separatorElement2 = createSeparator( viewWriter, editor );
    var toggleButtonElement;
    if ( !editor.RATData.isNewRequirement ) {
        toggleButtonElement = createToggleButton( viewWriter, editor );
    } else {
        toggleButtonElement = createToggleButtonForNewReq( viewWriter, editor );
        editor.newSelectedRequirement = editor.editing.mapper.toViewElement( requirementHeader.parent );
        eventBus.publish( 'Arm0ShowQualityMetricData.CalculateQuality' );
    }
    if ( navigateUpElement && navigateDownElement && correctionElement && toggleButtonElement ) {
        if ( requirementHeader._children.length === 0 ) {
            viewWriter.insert( viewWriter.createPositionAt( h3, 1 ), toggleButtonElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 2 ), separatorElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 3 ), navigateDownElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 4 ), navigateUpElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 5 ), separatorElement2 );
            viewWriter.insert( viewWriter.createPositionAt( h3, 6 ), correctionElement );
        } else {
            viewWriter.insert( viewWriter.createPositionAt( h3, 2 ), toggleButtonElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 3 ), separatorElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 4 ), navigateDownElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 5 ), navigateUpElement );
            viewWriter.insert( viewWriter.createPositionAt( h3, 6 ), separatorElement2 );
            viewWriter.insert( viewWriter.createPositionAt( h3, 7 ), correctionElement );
        }
        detachNavigationCommands( editor );
    }
}

/**
 *
 * @param {*} viewWriter -
 * @param {*} editor -
 * @returns {*} domelement
 */
function createNavigateUp( viewWriter, editor ) {
    return viewWriter.createUIElement( 'faulticonup', { class: 'aw-ckeditor-header-element' }, function( domDocument ) {
        const domElement = this.toDomElement( domDocument );
        domElement.innerHTML = miscChevronUp;
        domElement.title = localTextBundle.faultIconUpTitle;
        domElement.style = 'float: right;width:26px;cursor:pointer';
        domElement.addEventListener( 'click', () => {
            var flag = 'navigateUp';
            editor.fire( 'highlightOnNavigation', flag );
        } );

        if ( editor.RATData.isNewRequirement && appCtxSvc.ctx.showRequirementQualityData ) {
            domElement.style.visibility = 'visible';
        } else {
            domElement.style.visibility = 'hidden';
        }

        arrForNavigateUpElements.push( domElement );

        return domElement;
    } );
}

/**
 *
 * @param {*} viewWriter -
 * @param {*} editor -
 * @returns {*} domelement
 */
function createNavigateDown( viewWriter, editor ) {
    return viewWriter.createUIElement( 'faulticondown', { class: 'aw-ckeditor-header-element' }, function( domDocument ) {
        const domElement = this.toDomElement( domDocument );
        domElement.innerHTML = miscChevronDown;
        domElement.title = localTextBundle.faultIconDownTitle;
        domElement.style = 'float: right;width:26px;cursor:pointer;';
        domElement.addEventListener( 'click', () => {
            var flag = 'navigateDown';
            editor.fire( 'highlightOnNavigation', flag );
        } );
        if ( editor.RATData.isNewRequirement && appCtxSvc.ctx.showRequirementQualityData ) {
            domElement.style.visibility = 'visible';
        } else {
            domElement.style.visibility = 'hidden';
        }
        arrForNavigateDownElements.push( domElement );

        return domElement;
    } );
}

/**
 * Code for Separators
 * @param {*} viewWriter -
 * @param {*} editor -
 * @returns {*} domElement
 */
function createSeparator( viewWriter, editor ) {
    return viewWriter.createUIElement( 'span', { class: 'aw-ckeditor-header-element' }, function( domDocument ) {
        const domElement = this.toDomElement( domDocument );
        domElement.innerHTML = '|';
        domElement.title = '';
        domElement.style = 'float: right;padding-right: 10px;';
        if ( editor.RATData.isNewRequirement && appCtxSvc.ctx.showRequirementQualityData ) {
            domElement.style.visibility = 'visible';
        } else {
            domElement.style.visibility = 'hidden';
        }
        arrForSeparators.push( domElement );

        return domElement;
    } );
}

/**
 * Correction label
 * @param {*} viewWriter -
 * @param {*} editor -
 * @returns {*} domelement
 */
function createCorrectionElement( viewWriter, editor ) {
    return viewWriter.createUIElement( 'correction', { class: 'aw-ckeditor-header-element' }, function( domDocument ) {
        const domElement = this.toDomElement( domDocument );
        domElement.innerHTML = ' Corrections: ' + editor.RATData.currentCorrectionCount + '/' + editor.RATData.countOfCorrection;
        domElement.style = 'float: right; font-weight: normal;padding-right: 10px;';
        domElement.addEventListener( 'click', () => {

        } );
        if ( editor.RATData.isNewRequirement && appCtxSvc.ctx.showRequirementQualityData ) {
            domElement.style.visibility = 'visible';
        } else {
            domElement.style.visibility = 'hidden';
        }
        arrForCorrectionElements.push( domElement );
        editor.RATData.isNewRequirement = undefined;
        return domElement;
    } );
}


/**
 * creating Toggle Button for requirement
 * @param {*} viewWriter -
 * @param {*} editor -
 * @returns {*} domElement
 */
function createToggleButton( viewWriter, editor ) {
    return viewWriter.createUIElement( 'label', { class: 'aw-requirements-toggleButton1-switch' }, function( domDocument ) {
        const domElement = this.toDomElement( domDocument );
        domElement.innerHTML = 'Pattern Assist: <input type="checkbox" style="vertical-align: middle;"><span class="aw-requirements-toggleButton1-slider"></span>';
        domElement.title = 'Toggle Pattern Assist';
        domElement.style = 'float:right;font-weight: normal;padding-right: 10px;';

        domElement.addEventListener( 'click', ( event ) => {
            var parentNode = event.currentTarget.parentNode;
            checkNavigationCommandsCondition( parentNode, editor );
        } );
        domElement.style.visibility = 'hidden';
        arrForToggelButtonElements.push( domElement );
        return domElement;
    } );
}


/**
 * creating Toggle Button for new requirement
 * @param {*} viewWriter -
 * @param {*} editor -
 * @returns {*} domElement
 */
function createToggleButtonForNewReq( viewWriter, editor ) {
    return viewWriter.createUIElement( 'label', { class: 'aw-requirements-toggleButton1-switch' }, function( domDocument ) {
        const domElement = this.toDomElement( domDocument );
        domElement.innerHTML = 'Pattern Assist: <input type="checkbox"><span class="aw-requirements-toggleButton1-slider"></span>';
        if ( appCtxSvc.ctx.showRequirementQualityData ) {
            editor.RATData.toggleButtonState = true;
            domElement.control.checked = true;
            domElement.style = 'float: right;visibility:visible;padding-right: 10px;';
        } else {
            domElement.style = 'float: right;visibility:hidden;padding-right: 10px;';
        }
        domElement.title = 'Toggle Pattern Assist';
        domElement.addEventListener( 'click', ( event ) => {
            var parentNode = event.currentTarget.parentNode;
            checkNavigationCommandsCondition( parentNode, editor );
        } );
        arrForToggelButtonElements.push( domElement );
        editor.eventBus.publish( 'Arm0ShowQualityMetricData.toggleButtonClicked',
            { toggleState: true } );
        return domElement;
    } );
}

/**
 * Update Correction count after up/down button click
 * @param {*} editor -
 */
function updateCorrectionCount( editor ) {
    _.forEach( arrForCorrectionElements, function( domElement ) {
        domElement.innerHTML = ' Corrections: ' + editor.RATData.currentCorrectionCount + '/' + editor.RATData.countOfCorrection;
    } );
}


/**
 * detach all commands when AQC is turned off
 * @param {*} editor -
 */
function detachNavigationCommands( editor ) {
    _.forEach( arrForCorrectionElements, function( domElement ) {
        domElement.style.visibility = 'hidden';
    } );

    _.forEach( arrForNavigateDownElements, function( domElement ) {
        domElement.style.visibility = 'hidden';
    } );

    _.forEach( arrForNavigateUpElements, function( domElement ) {
        domElement.style.visibility = 'hidden';
    } );

    _.forEach( arrForSeparators, function( domElement ) {
        domElement.style.visibility = 'hidden';
    } );

    _.forEach( arrForToggelButtonElements, function( domElement ) {
        domElement.control.checked = false;
        domElement.style.visibility = 'hidden';
    } );
    editor.RATData.toggleButtonState = false;
}

export let attachPatternAssistToggle = function( domElement, editor, isNewRequirment ) {
    var requirementElement = getRequirementElement( domElement );
    if ( requirementElement ) {
        var reqId = requirementElement.getAttribute( 'revisionId' );
        var revElement = cdm.getObject( reqId );
        var isSpecification = revElement && revElement.modelType.typeHierarchyArray.indexOf( 'RequirementSpec Revision' ) >= 0;
        if( !isSpecification || !revElement ) {
            var requirementHeader = requirementElement.getElementsByClassName( 'aw-requirement-header' )[0];
            var toggleButton = requirementHeader.getElementsByClassName( 'aw-requirements-toggleButton1-switch' )[0];
            editor.eventBus.publish( 'Arm0ShowQualityMetricData.toggleButtonClicked', { toggleState: toggleButton.control.checked } );
            if ( !isNewRequirment ) {
                if ( toggleButton && toggleButton.style.visibility !== 'visible' ) {
                    detachNavigationCommands( editor );
                    toggleButton.style.visibility = 'visible';
                }
            } else if ( isNewRequirment ) {
                if ( toggleButton && toggleButton.style.visibility !== 'visible' ) {
                    detachNavigationCommands( editor );
                    toggleButton.style.visibility = 'visible';
                    toggleButton.control.checked = true;
                    editor.RATData.toggleButtonState = true;
                    editor.eventBus.publish( 'Arm0ShowQualityMetricData.toggleButtonClicked',
                        { toggleState: true } );
                }
            }
            changeVisibilityOfNavigation( toggleButton );
        } else{
            detachNavigationCommands( editor );
        }
    }
};


/**
*  @param {*} toggleButton - contains the dom node to change the visibilty
*/
function changeVisibilityOfNavigation( toggleButton ) {
    var h3Element = toggleButton.parentNode;
    if ( h3Element ) {
        var navigationElements = h3Element.getElementsByClassName( 'aw-ckeditor-header-element' );
        if ( navigationElements ) {
            for ( var i = 0; i < navigationElements.length; i++ ) {
                navigationElements[i].style.visibility = 'visible';
            }
        }
    }
}

/**
* @param {*} node - contains the target node clicked
* @returns {*} -
*/
function getRequirementElement( node ) {
    if ( !node ) {
        return null;
    }
    if ( node.classList.contains( 'requirement' ) ) {
        return node;
    }
    return getRequirementElement( node.parentNode );
}

/**
 * Turn on/off the "Pattern Assist" tab using toggle button
 * @param {*} node -
 * @param {*} editor -
 */
function checkNavigationCommandsCondition( node, editor ) {
    var childNodes = node.childNodes;
    if ( editor.RATData.toggleButtonState === undefined ) {
        editor.RATData.toggleButtonState = false;
    } else {
        editor.RATData.toggleButtonState = !editor.RATData.toggleButtonState;
    }
    editor.eventBus.publish( 'Arm0ShowQualityMetricData.toggleButtonClicked', { toggleState: editor.RATData.toggleButtonState } );

    editor.fire( 'clearHighlightForHighlightedWord' );
}


export default exports = {
    insertNavigationCommands,
    updateCorrectionCount,
    detachNavigationCommands,
    attachPatternAssistToggle
};
