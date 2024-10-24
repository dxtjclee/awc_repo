// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the declarative Requirement occ mgmt page contribution.
 *
 * @module js/declarativeRequirementManagement.occMgmtPageKey
 */
import appCtxService from 'js/appCtxService';
import localStorage from 'js/localStorage';

'use strict';

var contribution = {
    label: {
        source: '/i18n/MatrixMessages',
        key: 'Traceability'
    },
    id: 'arm0TraceabilityMatrix',
    priority: 3,
    pageNameToken: 'Arm0TraceabilityMatrix',
    condition: function( selection ) {
        var showTraceabilityMatrix = localStorage.get( 'TraceabilityMatrixGenerateOnReveal' );
        if( ( selection.length === 1 || selection.length === 2 ) && ( showTraceabilityMatrix === 'true' || appCtxService.ctx.visibleTracebilityPage ) &&
            !( appCtxService.ctx.splitView && appCtxService.ctx.splitView.mode ) ) {
            var typesToCheck = [ 'Awb0Element' ];

            for( var i = 0; i < typesToCheck.length; i++ ) {
                if( selection[ 0 ].modelType.typeHierarchyArray.indexOf( typesToCheck[ i ] ) > -1 ) {
                    return true;
                }
            }
        }
        return false;
    }
};

export default function( key, deferred ) {
    if( key === 'occMgmtPageKey' ) {
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}
