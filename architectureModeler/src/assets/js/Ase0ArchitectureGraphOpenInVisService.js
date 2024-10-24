// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * Service to provide Architecture graph content for Opening in Vis
 *
 * @module js/Ase0ArchitectureGraphOpenInVisService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import openInVisProductContextInfoProvider from 'js/openInVisualizationProductContextInfoProvider';
import _ from 'lodash';

/**
 * Get Product Launch Info to be used by Open In Vis action
 * If nothing is selected in Architecture Tab, all visible objects in Architecture
 * are returned.
 * If one or more nodes are selected in Architecture Tab, only selected objects in Architecture
 * are returned.
 *
 * @return {Array} Product Context and Occurreneces
 */
const getOpenInVisLaunchInfo = async function() {
    var productOccMap = {};
    var productOccArray = [];

    let graphControl = appCtxSvc.getCtx( 'graph.graphModel.graphControl' );
    if( graphControl ) {
        var nodes = graphControl.getSelected( 'Node' );
        if( !nodes || nodes.length < 1 ) {
            nodes = graphControl.graph.getVisibleNodes();
        }

        _.forEach( nodes, function( nodeItem ) {
            var productContextUid = occmgmtUtils.getProductContextForProvidedObject( nodeItem.modelObject );
            if( !productOccMap[ productContextUid ] ) {
                productOccMap[ productContextUid ] = [];
            }
            productOccMap[ productContextUid ].push( nodeItem.modelObject );
        } );

        _.forOwn( productOccMap, function( value, key ) {
            var productContextObj = cdm.getObject( key );
            if( productContextObj ) {
                var productOccObj = {
                    productContextInfo: productContextObj,
                    selections: value
                };
                productOccArray.push( productOccObj );
            }
        } );
    }

    return productOccArray;
};

/**
 * Unregister context on Architecture view load.
 */
export let handleArchitectureGraphLoad = function() {
    openInVisProductContextInfoProvider.registerProductContextToLaunchVis( getOpenInVisLaunchInfo );
};

const exports = {
    handleArchitectureGraphLoad
};
export default exports;
