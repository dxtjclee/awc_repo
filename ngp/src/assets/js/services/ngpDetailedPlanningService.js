// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpRelationSvc from 'js/services/ngpRelationService';
import ngpTableSvc from 'js/services/ngpTableService';
import ngpAssingnmentMismatchSvc from 'js/services/ngpAssignmentMismatchOrMissingService';
import ngpVMOPropSvc from 'js/services/ngpViewModelPropertyService';
import mfeTableSvc from 'js/mfeTableService';

/**
 * NGP Build Strategy service
 *
 * @module js/services/ngpDetailedPlanningService
 */
'use strict';

/**
 *
 * @param {modelObject} modelObject - the modelObject we want to get the content elements of
 * @param {object} dataProvider - the table dataprovider object
 * @param {object} sortCriteria - the sort criteria object
 * @returns {promise} a promise which is resolved to an object with the tree load results
 */
export function loadContentElementsTableData( modelObject, dataProvider, sortCriteria ) {
    return ngpRelationSvc.getContentElements( modelObject.uid, true )
        .then(
            ( contentElements ) => {
                if( contentElements.length > 0 ) {
                    const hasCloneColumn = ngpTableSvc.hasCloneStatusColumn( dataProvider );
                    const hasMismatchColumn = ngpTableSvc.hasMismatchOrMissingColumn( dataProvider );
                    if( hasCloneColumn || hasMismatchColumn ) {
                        let option = 'All';
                        if( hasCloneColumn && !hasMismatchColumn ) {
                            option = 'CloneStatus';
                        } else if( !hasCloneColumn && hasMismatchColumn ) {
                            option = 'AssignmnetStatus';
                        }
                        return ngpRelationSvc.getStatusInformation( contentElements, option ).then( ( { assignmentStatuses } ) => {
                            contentElements.forEach( ( vmo ) => ngpAssingnmentMismatchSvc.createMismatchOrMissingProperty( vmo, assignmentStatuses[vmo.uid] ) );
                            return contentElements;
                        } );
                    }
                }
                return contentElements;
            }
        )
        .then(
            ( contentElements ) => {
                contentElements.forEach( ( element ) => ngpVMOPropSvc.addLocalizedTypeDisplayNames( element ) );
                return ngpTableSvc.sortTable( contentElements, sortCriteria );
            }
        );
}

let exports = {};
export default exports = {
    loadContentElementsTableData
};
