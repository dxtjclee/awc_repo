// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ViewModeService
 */

import _ from 'lodash';

let exports = {};


var _getViewModeContext = function( parametersTableViewMode ) {
    var viewMode = {};
    if( parametersTableViewMode ) {
        viewMode = parametersTableViewMode;
    }
    return viewMode;
};

/**
 * Change view mode
 *
 * @param {String} newViewMode - View mode key to change to.
 */
export let changeViewMode = function( parametersTableViewMode, viewMode ) {
    var currentCtx = _getViewModeContext( parametersTableViewMode );
    currentCtx.viewModeContext = viewMode;
    parametersTableViewMode = currentCtx;
    sessionStorage.setItem( 'parameterTableViewModeContext', viewMode );
};

/**
 * Get the current view mode
 *
 * @return {String} The current view mode
 */
export let getViewMode = function( parametersTableViewMode, selected ) {
    var viewMode = _getViewModeContext( parametersTableViewMode ).viewModeContext;
    //tree mode supported only for Parameter Project.
    if( viewMode === undefined && selected !== undefined && ( selected.modelType.typeHierarchyArray.indexOf( 'Att1ParameterPrjElement' ) > -1 || selected.modelType.typeHierarchyArray.indexOf( 'Att1ParameterSetElement' ) > -1 ) ) {
        const viewModeContextInSession = sessionStorage.getItem( 'parameterTableViewModeContext' );
        if ( viewModeContextInSession !== null ) {
            viewMode = viewModeContextInSession;
            parametersTableViewMode.viewModeContext = viewModeContextInSession;
        }
    }
    return viewMode;
};

/**
 * Update which view modes are supported
 *
 * @param {String[]} viewModes - View modes that are available. Converted to Object to make conditions easier.
 */
export let setAvailableViewModes = function( parametersTableViewMode, viewModes ) {
    var currentCtx = _getViewModeContext( parametersTableViewMode );
    // Convert array to object - makes declarative conditions simpler
    currentCtx.supportedViewModes = {};
    if( _.isArray( viewModes ) ) {
        // eslint-disable-next-line array-callback-return
        viewModes.map( function( x ) {
            currentCtx.supportedViewModes[ x ] = {};
        } );
    }
    parametersTableViewMode = currentCtx;
};

/**
 * Get the available view modes
 *
 * @return {String[]} The supported view modes
 */
export let getAvailableViewModes = function( parametersTableViewMode ) {
    var viewModes = _getViewModeContext( parametersTableViewMode ).supportedViewModes;
    return viewModes ? Object.keys( viewModes ) : [];
};

exports = {
    changeViewMode,
    getViewMode,
    setAvailableViewModes,
    getAvailableViewModes
};
export default exports;
