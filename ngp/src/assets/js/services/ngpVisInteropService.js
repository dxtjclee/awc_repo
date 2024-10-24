// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import ngpModelConstants from 'js/constants/ngpModelConstants';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';

/**
 * The ngp vis interoperability service
 *
 * @module js/services/ngpVisInteropService
 */

let initialized = false;
let hostVisQueryService = null;

/**
 * return the parent of the element
 *
 * @param {ModelObject} element - the Model Object for which to get the parent
 * @returns {ModelObject} The parent of the element
 */
function getElementParent( element ) {
    let parent_id = null;
    if( mfeTypeUtils.isOfType( element, ngpModelConstants.DESIGN_ELEMENT ) ) {
        parent_id = element.props[ ngpPropConstants.DESIGN_ELEMENT_PARENT ].dbValues[ 0 ];
    }
    if( parent_id !== null ) {
        return cdm.getObject( parent_id );
    }
    return null;
}

/**
 * computeIdChain
 *
 * @param {ModelObject} modelObject - The Model Object to compute the ID chain for
 * @returns {String} The ID chain
 */
function computeIdChain( modelObject ) {
    let currModelObject = modelObject;
    const id_array = [];
    while( currModelObject && !mfeTypeUtils.isOfType( currModelObject, ngpModelConstants.PARTITION_TYPE ) ) {
        const id = ngpTypeUtils.getProductElementID( currModelObject );
        id_array.unshift( id );
        currModelObject = getElementParent( currModelObject );
    }
    let chain = '';
    id_array.forEach( ( id, index ) => {
        if( index > 0 ) {
            chain += '/';
        }
        chain += id;
    } );
    return chain;
}

/**
 *
 * @param {String[]} occCSIDChains array of occurrence ID chains
 */
function processSelectionFromVis( occCSIDChains ) {
    let selectionArray = [];
    occCSIDChains.forEach( ( chain ) => selectionArray.push( chain.split( '/' ).reverse() ) );
    eventBus.publish( 'ngpVisInterop.selectionChangeEvent', selectionArray );
}

/**
 *
 * @param {ModelObject[]} selectedObjects - the selected objects
 */
export function setSelectionInVis( selectedObjects ) {
    const selectionArray = selectedObjects.map( ( object ) => computeIdChain( object ) );
    hostVisQueryService.sendSelectionsToVis( selectionArray );
}

/**
 * Register Vis Interop handlers
 *
 */
export function setVisInteropHandlers() {
    if( !initialized && appCtxSvc.getCtx( 'aw_hosting_state' ) && appCtxSvc.getCtx( 'aw_host_type' ) === 'Vis' ) {
        import( 'js/hostVisQueryService' ).then( ( hostVisQuerySvc ) => {
            hostVisQueryService = hostVisQuerySvc;
            hostVisQueryService.removeAllSelectionEventListeners();
            hostVisQueryService.addSelectionEventListener( processSelectionFromVis );
            initialized = true;
        } );
    }
}

/**
 * selectObjectsInVis
 *
 * @param {String[]} idChains - String array with id chains
 */
export function selectObjectsInVis( idChains ) {
    let hostingState = appCtxSvc.getCtx( 'aw_hosting_state' );
    if( hostingState && idChains.length > 0 ) {
        hostVisQueryService.sendSelectionsToVis( idChains );
    }
}

let exports = {};
export default exports = {
    setVisInteropHandlers,
    selectObjectsInVis,
    setSelectionInVis
};
