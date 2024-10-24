// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 */

/**
 * Service for handling System modeler specific 3D viewer functionality
 *
 * @module js/Ase0VisSelectionService
 */
import viewerContextService from 'js/viewerContext.service';
import logger from 'js/logger';

var getSelectedUids = function( selections ) {
    var selectedUids = '';
    if( selections !== null ) {
        for( var i = 0; i < selections.length; i++ ) {
            var obj = selections[ i ];
            if( obj !== null ) {
                selectedUids += selections[ i ].uid;
                if( i !== selections.length - 1 ) {
                    selectedUids += ' ';
                }
            } else {
                logger.debug( 'getSelectedUids: obj is null.' );
            }
        }
    } else {
        logger.debug( 'getSelectedUids: selections is null.' );
    }
    return selectedUids;
};

var getProductContextOrRootElementUids = function( occmgmtContext ) {
    var uidProductContexts = '';
    var uidRootElements = '';
    var uids = [];

    if( occmgmtContext.elementToPCIMap ) {
        for( var k in occmgmtContext.elementToPCIMap ) {
            if( occmgmtContext.elementToPCIMap[ k ] ) {
                uidProductContexts = uidProductContexts.concat( occmgmtContext.elementToPCIMap[ k ], ' ' );
                uidRootElements = uidRootElements.concat( k, ' ' );
            }
        }
    }

    if( uidRootElements.length === 0 ) {
        uidProductContexts = occmgmtContext.productContextInfo.uid;
        uidRootElements = occmgmtContext.topElement.uid;
    }

    if( uidProductContexts.length > 0 ) {
        uids.push( uidProductContexts.trim() );
    }

    if( uidRootElements.length > 0 ) {
        uids.push( uidRootElements.trim() );
    }

    return uids;
};

/**
 * Invoke the search for getting tracelinked physicals
 *
 * @param {ModelObject[]} selections the objects to process
 * @param {String} action the visualization action
 * @param {String} viewerContext the applicable viewer context
 * @param {Object} occmgmtContext occ mgmt context
 *
 * @return {Boolean} true after success
 */
export let setViewerVisibility = function( selections, action, viewerContext, occmgmtContext ) {
    var _viewerContext = viewerContextService.getRegisteredViewerContext( viewerContext );
    if( !_viewerContext ) {
        logger.debug( 'Unable to perform Viewer Search with Options due to undefined viewer context.' );
        return false;
    }
    var rootElementUids = getProductContextOrRootElementUids( occmgmtContext );
    var selectedUids = getSelectedUids( selections );
    var pcUid = rootElementUids[ 0 ];
    var searchInput = {
        searchInput: {
            searchCriteria: {
                elementUids: selectedUids,
                processConnections: 'false',
                productContextUids: pcUid,
                processTracelinks: 'true',
                processConnectionTracelinks: 'true',
                rootElementUids: rootElementUids[ 1 ],
                useGetComplyingElements: 'true'
            }
        }
    };

    var searchInputJSON = JSON.stringify( searchInput );
    var searchAction = _viewerContext.ViewerSearchActions.SET_VISIBLE;
    if( action === 'selectedOnly' ) {
        searchAction = _viewerContext.ViewerSearchActions.SET_VIEW_ONLY;
    } else if( action === 'selectedOn' ) {
        searchAction = _viewerContext.ViewerSearchActions.SET_VISIBLE;
    } else if( action === 'selectedOff' ) {
        searchAction = _viewerContext.ViewerSearchActions.SET_INVISIBLE;
    }

    var searchManager = _viewerContext.getSearchMgr();
    if( searchManager ) {
        searchManager.performSearch( 'Ase0RelationObjectProvider', searchInputJSON, 10000, searchAction ).then(
            function() {
                logger.debug( 'Viewer Search with Options operation completed' );
            },
            function( reason ) {
                logger.error( 'Viewer Search with Options operation failed:' + reason );
            } );
    } else {
        logger.debug( 'Unable to perform Viewer Search with Options due to undefined search manager.' );
        return false;
    }
    return true;
};

/**
 * This factory creates a service and returns exports
 *
 * @member Ase0VisSelectionService
 */

const exports = {
    setViewerVisibility
};
export default exports;
