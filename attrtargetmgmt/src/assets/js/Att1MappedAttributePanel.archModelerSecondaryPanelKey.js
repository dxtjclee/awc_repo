// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the attributes' mapping split panel contribution to Architecture page
 *
 * @module js/Att1MappedAttributePanel.archModelerSecondaryPanelKey
 */

import _ from 'lodash';

'use strict';

var contribution = {
    id: 'Att1ShowParametersTableForSync',
    priority: 1,
    splitPanelId: 'Att1ShowParametersTableForSync',
    condition: 'commandContext.nodeModels[0].modelObject.modelType.typeHierarchyArray.indexOf(\'Awb0ConditionalElement\') > -1  || commandContext.edgeModels[0].modelObject.modelType.typeHierarchyArray.indexOf(\'FND_TraceLink\') > -1'
};

/**
 *
 * @param {*} key
 * @param {*} deferred
 */
export default function( key, deferred ) {
    if( key === 'archModelerSecondaryPanelKey' ) {
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}
