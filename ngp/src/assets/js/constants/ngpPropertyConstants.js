// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Utility to check mfg_ngp object type
 *
 * @module js/constants/ngpPropertyConstants
 */
 const ngpPropConstants = {
    MANUFACTURING_MODEL: 'mdl0model_object',
    FOUNDATION_ID: 'fnd0objectId',
    OBJECT_STRING: 'object_string',
    OBJECT_NAME: 'object_name',
    IS_MODIFIABLE: 'is_modifiable',
    CHECKED_OUT_USER: 'checked_out_user',
    IS_CHECKOUTABLE: 'fnd0IsCheckoutable',
    LAST_RELEASE_STATUS: 'last_release_status',
    CREATION_DATE: 'creation_date',
    PROTECTION: 'protection',
    CM_MATURITY:'CMMaturity',
    CM_DISPOSITION:'CMDisposition',
    CM_CLOSURE:'CMClosure',
    CM_ANALYST:'cm0Analyst',
    USER:'user',
    REF_LIST:'ref_list',
    ORIGINAL_FILE_NAME:'original_file_name',
    IS_LEAF:'cpd0is_leaf',
    PARTITION_OBJ_CRITERIA: 'ptn0partition_obj_criteria',
    SELECTED_CONTENTS: 'mdl0selectedcontents',
    PARTITION_SCHEME_TYPE: 'ptn0partition_scheme_type',

    PRODUCT_MODEL: 'Mpr0ProductModels',
    PRODUCT_EFFECTIVITY_FORMULA: 'mpr0EffectivityFormula',
    IS_CLASS_LIBRARY: 'mpr0isLibrary',
    ACTIVITY_SUB_PROCESSES: 'mpr0processElements',
    PROCESS_SUB_OPERATIONS: 'mpr0operations',
    BE_SUB_ACTIVITIES: 'Mpr0BuildElementActivities',
    BE_SUB_BES: 'Mpr0SubBuildElements',
    ACTIVE_MCN: 'mpc0activeMCN',
    ASSOCIATED_MCNS: 'mpc0associatedMCNs',
    ECNS_OF_MCN: 'CMImplements',
    PARENT_OF_OPERATION: 'mpr0processElement',
    PARENT_OF_PROCESS_OR_ME: 'mpr0activity',
    PARENT_OF_ACTIVITY_OR_BE: 'mpr0parentBuildElement',
    NUMBER_OF_ASSIGNED_PARTS: 'mpr0numberOfAssignedParts',
    NUMBER_OF_ASSIGNED_FEATURES: 'mpr0numOfAssignedFeatures',
    PREDECESSORS: 'mpr0predecessors',
    DISCONTINUED_PROCESSES: 'mpr0removedPEs',
    HAS_SUB_BUILD_ELEMENTS: 'mpr0hasSubBuildElements',
    HAS_ACTIVITIES: 'mpr0hasActivities',
    HAS_PROCESS_ELEMENTS: 'mpr0hasProcessElements',
    HAS_OPERATIONS: 'mpr0hasOperations',
    ATTACHED_ATTRIBUTE_GROUPS_PROPERTY_NAME : 'mpr0AttachedAttributeGroups',
    TYPE_NAME:'type_name',
    CROSS_ACTIVITY_PREDECESSORS: 'mpr0crossActivityPreds',
    CROSS_ACTIVITY_SUCCESSORS:'mpr0crossActivitySuccessors',
    NUM_OF_CROSS_ACTIVITY_PREDECESSORS:'mpr0numOfCrossActivityPreds',
    NUM_OF_CROSS_ACTIVITY_SUCCESSORS:'mpr0numOfCrossActivitySuccs',
    SIBLING_REVISIONS: 'mdl0sibling_revisions',
    PRODUCT_SCOPE_PROP: 'mpr0ProductScope',
    PRODUCT_SCOPE_RELATION: 'Mpr0ProductScope',
    SUBSET_DEF_CONFIG_CONTEXT: 'fnd0configuration_context',
    REVISION_RULE: 'revision_rule',
    CLONE_STABLE_ID_PATH: 'cloneStableIdPath',
    AWB_0_OCCURRENCE_OBJECT: 'awb0OccurrenceObject',
    DESIGN_ELEMENT_ID: 'cpd0design_element_id',
    DESIGN_FEATURE_ID: 'cpd0design_feature_id',
    DESIGN_ELEMENT_PARENT: 'cpd0presented_parent',
    SUPPRESSED: 'suppressed',
    USER_VISIBLE: 'user_visible'
};

export default ngpPropConstants;
