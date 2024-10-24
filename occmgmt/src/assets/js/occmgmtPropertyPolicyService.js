// Copyright (c) 2022 Siemens

/**
 * Service to register and unregister additional property policies in ACE
 *
 * @module js/occmgmtPropertyPolicyService
 */
import occmgmtUtils from 'js/occmgmtUtils';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import showMarkupServc from 'js/showMarkupService';
import revOccSvc from 'js/revOccUtils';
import ptnConfigSvc from 'js/partitionConfigurationService';

let exports = {};
let policyId;

/**
 * Register property policy
 */
export let registerPropertyPolicy = function() {
    if( occmgmtUtils.isMinimumTCVersion( 13, 2 ) ) {
        let policyIOverrideGetOcc = {
            types: [ {
                name: 'Awb0ConditionalElement',
                properties: [ {
                    name: 'awb0QuantityManaged'
                } ]
            } ]
        };
        policyId = propPolicySvc.register( policyIOverrideGetOcc );
    }
    //TODO: Need to clean up this code once there is a framework to add the dependent js files based on installed modules.
    showMarkupServc.registerHandlerForOverriddenProperties();
    revOccSvc.registerHandlerForOverriddenProperties();
    ptnConfigSvc.registerHandlerForOverriddenProperties();
};

/**
 * Un-Register property policy
 */
export let unRegisterPropertyPolicy = function() {
    if( policyId ) {
        propPolicySvc.unregister( policyId );
        policyId = null;
    }
};

/**
 * Occurrence Management Service Manager
 */

export default exports = {
    registerPropertyPolicy,
    unRegisterPropertyPolicy
};
