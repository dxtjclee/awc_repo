// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/ssp0ServicePlannerConstants
 */
'use strict';

export const constants = {
    //Types
    TYPE_SERVICE_CONTAINER: 'SSP0SvcContainer',
    TYPE_SERVICE_REQUIREMENT: 'SSP0ServiceReq',
    TYPE_WORK_CARD: 'SSP0WorkCard',
    TYPE_SKILL: 'SSP0Skill',
    TYPE_SKILL_REVISION: 'SSP0SkillRevision',
    TYPE_AWB_PART_ELEMENT: 'Awb0PartElement',
    TYPE_AWB_ELEMENT: 'Awb0Element',
    TYPE_OCCURRENCE: 'MEAssign',
    TYPE_OCCURRENCE_TOOL: 'METool',
    TYPE_PART: 'Part',
    TYPE_ITEM: 'Item',
    TYPE_PART_REVISION: 'PartRevision',
    TYPE_PART_REVISION_TYPE_HIERARCHY: 'Part Revision',
    TYPE_ITEM_REVISION: 'ItemRevision',
    TYPE_EQUIPMENT_REVISION: 'Mfg0MEEquipmentRevision',
    TYPE_NOTICE: 'Smr0Warning',

    //Process Types
    TYPE_PART_PROCESS: 'Mfg0BvrPart',
    TYPE_SERVICE_PLAN_PROCESS: 'SSP0BvrServicePlan',
    TYPE_SERVICE_PARTITION_PROCESS: 'SSP0BvrServicePartition',
    TYPE_SERVICE_REQUIREMENT_PROCESS: 'SSP0BvrServiceRequirement',
    TYPE_WORK_CARD_PROCESS: 'SSP0BvrWorkCard',
    TYPE_SKILL_PROCESS: 'SSP0BvrSkill',
    TYPE_SERVICE_CONTAINER_PROCESS: 'SSP0BvrServiceContainer',
    TYPE_EQUIPMENT_PROCESS: 'Mfg0BvrEquipment',
    TYPE_RESOURCE_PROCESS: 'Mfg0BvrResource',

    //Revision Types
    TYPE_SERVICE_PLAN_REVISION: 'SSP0ServicePlanRevision',
    TYPE_SERVICE_REQUIREMENT_REVISION: 'SSP0ServiceReqRevision',
    TYPE_WORK_CARD_REVISION: 'SSP0WorkCardRevision',
    TYPE_SERVICE_CONTAINER_REVISION: 'SSP0SvcContainerRevision',
    //Viewer Instances
    PARTS_VIEWER_INSTANCE_ID: 'PartsViewer',
    SBOM_VIEWER_INSTANCE_ID: 'SBOMViewer',

    //Messages
    MSG_WC_CREATED: 'newWorkCardCreated',
    MSG_SC_CREATED: 'serviceContainerCreated',
    MSG_SR_CREATED: 'serviceReqCreated',
    MSG_SK_CREATED: 'newSkillCreated',

    //EVENTS
    GRAPHICS_VISIBILITY_TOGGLE_EVENT: 'spVisGraphicsVisibilityChanged',
    PARTS_GRAPHICS_VISIBILITY_TOGGLE_EVENT: 'partsVisGraphicsVisibilityChanged',
    SP_PARTS_GRAPHICS_VISIBILITY_TOGGLE_EVENT: 'spPartsVisGraphicsVisibilityChanged',

    //HTML CLASS
    TABLE_CELL_INDICATOR_CLASS: 'aw-ep-tableCellindicator',
    INDICATOR_HIDDEN_CLASS: 'aw-ep-indicatorHidden'

};

export default { constants };

