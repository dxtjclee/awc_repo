// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/qa0AuditSaveAsService
 */

 import app from 'app';

 var exports = {};

 export let initializeSelectedData = function (subPanelContext) {
    return {
        SelectedObjects: subPanelContext.selectionData.selected
    };
 };

 export default exports = {
    initializeSelectedData
 };
 app.factory( 'qa0AuditSaveAsService', () => exports );
