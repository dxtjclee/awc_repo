// Copyright (c) 2022 Siemens

/**
 * Service to register and unregister additional property policies in ACE for types supported by Structure Discovery.
 *
 * @module js/discoveryPropertyPolicyService
 */

import occmgmtUtils from 'js/occmgmtUtils';
import propPolicySvc from 'soa/kernel/propertyPolicyService';

let exports = {};
let worksetPolicyId;

/**
  * Register property policy
  */
export let registerPropertyPolicy = function() {
    if( occmgmtUtils.isMinimumTCVersion( 14, 1 ) && !occmgmtUtils.isMinimumTCVersion( 14, 2 ) ) {
        let worksetPendingChangesProperty = {
            types: [ {
                name: 'Fnd0WorksetRevision',
                properties: [ {
                    name: 'fnd0PendingChanges'
                } ]
            } ]
        };
        worksetPolicyId = propPolicySvc.register( worksetPendingChangesProperty );
    }
    // Tc14.3 - In case of Workset Revision concurrency logic written on AW SErver expect AW client to provide workset last saved time in SOA input.
    // Hence we are adding workset revision lsd in property policy.
    if( occmgmtUtils.isMinimumTCVersion( 14, 3 ) ) {
        let worksetLsdProperty = {
            types: [ {
                name: 'Fnd0WorksetRevision',
                properties: [ {
                    name: 'lsd'
                } ]
            } ]
        };
        worksetPolicyId = propPolicySvc.register( worksetLsdProperty );
    }
};

/**
  * Un-Register property policy
  */
export let unRegisterPropertyPolicy = function() {
    if( worksetPolicyId ) {
        propPolicySvc.unregister( worksetPolicyId );
        worksetPolicyId = null;
    }
};

/**
  * Occurrence Management Service Manager
  */

export default exports = {
    registerPropertyPolicy,
    unRegisterPropertyPolicy
};

