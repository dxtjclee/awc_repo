// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * navigation service for ngp objects.
 *
 * @module js/services/ngpHeaderPolicy
 */
'use strict';

const headerPolicy = {
    types: [ {
        name: 'Mpr0ManufacturingElement',
        properties: [ {
            name: 'object_string'
        },
        {
            name: 'fnd0objectId'
        },
        {
            name: 'last_release_status',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        },
        {
            name: 'fnd0IsCheckoutable'
        },
        {
            name: 'checked_out_user'
        },
        {
            name: 'mdl0model_object',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }
        ]
    },
    {
        name: 'Mpr0BOPElement',
        properties: [ {
            name: 'object_string'
        },
        {
            name: 'fnd0objectId'
        },
        {
            name: 'last_release_status',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        },
        {
            name: 'fnd0IsCheckoutable'
        },
        {
            name: 'checked_out_user'
        },
        {
            name: 'mdl0model_object',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }
        ]
    },
    {
        name: 'Mpr0ManufacturingModel',
        properties: [ {
            name: 'mpr0isLibrary'
        },
        {
            name: 'fnd0objectId'
        },
        {
            name: 'object_name'
        }
        ]
    },
    {
        name: 'Mpr0ProductModels',
        properties: [ {
            name: 'mpr0EffectivityFormula'
        } ]
    },
    {
        name: 'EPMTaskTemplate',
        properties: [ {
            name: 'template_name'
        } ]
    },
    {
        name: 'Mpr0BuildElement',
        properties: [ {
            name: 'mpr0parentBuildElement'
        } ]
    },
    {
        name: 'Mpr0Activity',
        properties: [ {
            name: 'mpc0associatedMCNs'
        },
        {
            name: 'mpc0activeMCN'
        },
        {
            name: 'mpr0parentBuildElement'
        },
        {
            name: 'mpr0removedPEs'
        }
        ]
    },
    {
        name: 'Mpr0ProcessElementBase',
        properties: [ {
            name: 'mpr0activity'
        } ]
    },
    {
        name: 'Mpr0BaseOperation',
        properties: [ {
            name: 'mpr0processElement'
        } ]
    },
    {
        name: 'Mpc0MfgBaseCNRevision',
        properties: [ {
            name: 'CMImplements'
        },
        {
            name: 'creation_date'
        }
        ]
    },
    {
        name: 'ChangeNoticeRevision',
        properties: [ {
            name: 'creation_date'
        } ]
    },
    {
        name: 'ReleaseStatus',
        properties: [ {
            name: 'date_released'
        } ]
    },
    {
        name:'Participant',
        properties:[ {
            name:'fnd0AssigneeUser'
        } ]
    }
    ]
};

export default headerPolicy;
