// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Services for author Plant
 *
 * @module js/epAuthorPlantService
 */

import appCtxService from 'js/appCtxService';

/**
 * To update context values as needed for Add in ACE BOE page
 */
export function updateParentElementOnCtx() {
    let key = appCtxService.getCtx( 'aceActiveContext.key' );
    let context = appCtxService.getCtx( key );
    let selected = appCtxService.getCtx( 'selected' );
    if( !context.addElement ) {
        appCtxService.updatePartialCtx( key + '.addElement', {} );
    }
    appCtxService.updatePartialCtx( key + '.addElement.parent', selected );
}

let exports = {};

export default exports = {
    updateParentElementOnCtx
};
