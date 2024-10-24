// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import appCtxSvc from 'js/appCtxService';

/**
 * Service for attaching files to an object.
 *
 * @module js/services/ngpUiPanelSizingService
 */

const PANEL_SIZES_LS_KEY = 'ngpPanelSizes';

/**
 *
 * @param {DomElement} splitter - the splitter dom element
 * @param {DomElement} area1 - the area left of the splitter
 * @param {DomElement} area2 - the area right of the splitter
 * @returns {object} an object containing the primary area (area which width we want to save) and the splitter name
 */
function decipherSplitterNameAndPrimaryArea( splitter, area1, area2 ) {
    const splitterNameAttr = splitter.attributes.getNamedItem( 'splitter-id' );
    let primaryArea = area1;
    if( splitterNameAttr && splitterNameAttr.value.includes( 'Right' ) ) {
        primaryArea = area2;
    }
    return {
        splitterNameValue: splitterNameAttr ? splitterNameAttr.value : null,
        primaryArea
    };
}

/**
 *
 * @param {object} splitterMoveEventData - the splitter move event data
 */
export function savePanelSize( { splitter, area1, area2 } ) {
    const { splitterNameValue, primaryArea } = decipherSplitterNameAndPrimaryArea( splitter, area1, area2 );
    if( splitterNameValue ) {
        let panelSizes = localStorage.getItem( PANEL_SIZES_LS_KEY );
        if( !panelSizes ) {
            panelSizes = {};
        } else {
            panelSizes = JSON.parse( panelSizes );
        }
        const width = Math.round( primaryArea.offsetWidth / primaryArea.parentElement.offsetWidth  * 12 );
        const height = Math.round( primaryArea.offsetHeight / primaryArea.parentElement.offsetHeight * 12 );
        panelSizes[getStorageKey( splitterNameValue )] = {
            width:  width > 0 ? width : 1,
            height:  height > 0 ? height : 1
        };
        localStorage.setItem( PANEL_SIZES_LS_KEY, JSON.stringify( panelSizes ) );
    }
}

/**
 *
 * @param {string/string[]} splitterNameOrNames - the view name
 * @returns {object} an object containing the width and height
 */
export function getPanelSizes( splitterNameOrNames ) {
    const splitterNameToDimesions = {};
    let splitterNames = splitterNameOrNames;
    if( !Array.isArray( splitterNameOrNames ) ) {
        splitterNames = [ splitterNameOrNames ];
    }
    let panelSizes = localStorage.getItem( PANEL_SIZES_LS_KEY );
    if( panelSizes ) {
        panelSizes = JSON.parse( panelSizes );
        splitterNames.forEach( ( name ) => {
            splitterNameToDimesions[name] = panelSizes[getStorageKey( name )];
        } );
    }
    if( !Array.isArray( splitterNameOrNames ) ) {
        return splitterNameToDimesions[splitterNameOrNames];
    }
    return splitterNameToDimesions;
}

/**
 *
 * @param {string} viewName - the view name
 * @returns {string} the current subpage name
 */
function getStorageKey( viewName ) {
    const subpageName = appCtxSvc.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
    return `${subpageName}_${viewName}`;
}

/**
 *
 * @param {string} key - the key to search by in the local storage
 * @param {string} defaultLayoutMode - the default layout mode
 * @return {string} - the value of the key
 */
export function getLayoutMode( key, defaultLayoutMode ) {
    const value = localStorage.getItem( key );
    return value ? value : defaultLayoutMode;
}

/**
 * Setting the next layout mode to the storage according to the layout modes' order
 *
 * @param {string} key - the key in which to store the value in the local storage
 * @param {[string]} layoutModes - an array of possible layout modes
 * @param {string} currentLayoutMode - the currevt layout mode stored in the view model data
 * @return {string} - the value of the key
 */
export function setNextLayoutMode( key, layoutModes, currentLayoutMode ) {
    const modePosition =  layoutModes.indexOf( currentLayoutMode );
    const nextModePosition = ( modePosition + 1 ) % layoutModes.length;
    localStorage.setItem( key, layoutModes[nextModePosition] );
    return layoutModes[nextModePosition];
}

let exports;
export default exports = {
    savePanelSize,
    getPanelSizes,
    getLayoutMode,
    setNextLayoutMode
};
