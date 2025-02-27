// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/epLoadConstants
 */

'use strict';

export const constants = {

    // LOAD TYPES
    HEADER: 'Header',
    LINE_BALANCING_STATIONS: 'LineBalancingStations',
    TIME_ANALYSIS: 'TimeAnalysis',
    CC: 'CC',
    PRODUCTION_PROGRAM: 'ProductionProgram',
    PRODUCT_VARIANT: 'ProductVariant',
    OPTIONS: 'Options',
    STATION_PLANNING: 'StationPlanning',
    PROCESS_AREA: 'ProcessArea',
    PLANT: 'Plant',
    GET_PROPERTIES: 'getProperties',
    EFFECTIVITY: 'Effectivity',
    WORKFLOW_TEMPLATES: 'WorkflowTemplates',
    ATTACHMENTS: 'Attachments',
    STATION_OPERATIONS: 'StationOperations',
    FUNCTIONAL_PLAN: 'FunctionalPlan',
    ACCOUNTABILITY_CHECK: 'AccountabilityCheck',
    EP_ASSIGNMENT_INDICATION: 'epAssignmentIndication',
    CONFIGURATION: 'Configuration',
    STATION_PRI: 'StationPRI',
    VARIANT_FAMILIES: 'VariantFamilies',
    STATION_TILE: 'StationTile',
    TIME_DISTRIBUTION: 'TimeDistribution',
    GRAPHICS_INFORMATION: 'GraphicsInformation',
    TIME_UNITS: 'TimeUnits',
    ALTERNATIVE_WP_INFO: 'AlternativeWPInformation',
    OBJ_IN_RELATED_PACKAGE: 'ObjectInRelatedPackage',
    DOCUMENT_FILE_TICKET: 'DocumentFileTicket',
    LayoutInfo: 'LayoutInfo',
    FILM_STRIP_PANEL: 'FilmStripPanel',
    WI_EDITOR_DATA: 'GetFullWIData',
    GET_ASSOCIATED_ASSEMBLY: 'GetAssociatedAssembly',
    GET_HIERARCHY: 'GetHierarchy',
    MFG_VALIDATIONS: 'GetMfgValidations',
    EFFECTIVITY_INFO: 'EffectivityInfo',
    GET_OCCURRENCE_TYPE: 'GetOccurrenceTypes',
    SET_DEFAULT_OCC_TYPE:'MEConsumed',
    FIND_NODE_IN_CONTEXT: 'FindNodeInContext',
    CHANGE_INDICATIONS: 'ChangeIndications',
    PRODUCT_VIEW_CHANGE_INDICATIONS: 'ProductViewChangeIndications',
    PV_UID: 'PVUID',
    ALL: 'ALL',
    MAXIMUM: 'MAXIMUM',
    WEIGHTED: 'WEIGHTED',
    ASSOCIATED_TWIN: 'AssociatedTwin',
    GET_AWB_ELEMENTS: 'GetAwbElements',
    COMMON_EXPAND : 'CommonExpand',
    MBM_UpdateEBOMRevision: 'MbmUpdateEbomRevision',

    // Accountability Load Constants
    MISSING_IN_SOURCE: '-1',
    INDICATIONS_OFF: '100',
    SINGLE_CONSUMPTION_IN_SCOPE: '101',
    SINGLE_CONSUMPTION_OUT_OF_SCOPE: '102',
    MULTIPLE_CONSUMPTION_IN_SCOPE: '103',
    MULTIPLE_CONSUMPTION_OUT_OF_SCOPE: '104',
    NOT_CONSUMED: '105',

    //  AccountabilityCheck response for Allocation Indication
    ALLOCATION_INDICATION_RESPONSE_MAP: {
        0: 'SINGLE_MATCH',
        1: 'MULTIPLE_MATCH',
        2: 'PARTIAL_SINGLE_MATCH',
        3: 'PARTIAL_MULTIPLE_MATCH'
    },

    CHECK_TYPE: 'checkType',
    CURRENT_SCOPE: 'currentScope',
    SOURCE_OBJECT: 'sourceObject',
    TARGET_OBJECT: 'targetObject',
    OBJECT_UID: 'objectUid',
    TYPE: 'type'
};

export default { constants };
