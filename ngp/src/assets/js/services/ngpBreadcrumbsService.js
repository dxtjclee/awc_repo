// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpPropConst from 'js/constants/ngpPropertyConstants';
import ngpRelationSvc from 'js/services/ngpRelationService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpNavigationSvc from 'js/services/ngpNavigationService';

/**
 * NGP Class library service
 *
 * @module js/services/ngpBreadcrumbsService
 */
'use strict';

/**
 * @param {modelObject} modelObject - a given modelObject
 * @return {Promise} a promise object
 */
export function getObjectBreadcrumbs( modelObject ) {
    if( modelObject ) {
        return ngpRelationSvc.getBreadcrumbs( modelObject ).then(
            ( crumbModelObjects ) => {
                let crumbs = [];
                if( Array.isArray( crumbModelObjects ) ) {
                    crumbs = crumbModelObjects.map( ( object ) => createCrumbDataStructure( object, true ) );
                }
                const lastCrumb = createCrumbDataStructure( modelObject, !( ngpTypeUtils.isOperation( modelObject ) || ngpTypeUtils.isManufacturingElement( modelObject ) ) );
                lastCrumb.isLast = true;
                crumbs.unshift( lastCrumb );
                return crumbs.reverse();
            }
        );
    }
    return new Promise( ( res ) => res( [] ) );
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @param {boolean} showArrow - true if the arrow should be visible
 * @return {object} a json object
 */
function createCrumbDataStructure( modelObject, showArrow ) {
    return {
        scopedUid: modelObject.uid,
        displayName: modelObject.props[ ngpPropConst.OBJECT_STRING ].uiValues[ 0 ],
        selectedCrumb: false,
        clicked: false,
        showArrow,
        onCrumbClick: onCrumbClick
    };
}

/**
 *
 * @param {object} crumb - a crumb object
 */
function onCrumbClick( crumb ) {
    if( !crumb.isLast ) {
        ngpNavigationSvc.navigateWithInNgp( crumb.scopedUid );
    }
}

let exports = {};
export default exports = {
    getObjectBreadcrumbs
};
