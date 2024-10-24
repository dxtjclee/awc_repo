// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/ssp0TimeAnalysisConstants
 */
'use strict';

export const constants = {
    //Types
    TYPE_Activity: 'MEActivity',
    TYPE_Activity_Line: 'CfgActivityLine',
    TYPE_PART_REVISION: 'PartRevision',
    TYPE_PART_REVISION_TYPE_HIERARCHY: 'Part Revision',
    TYPE_SKILL_REVISION_TYPE : 'SSP0SkillRevision',
    TYPE_ITEM_REVISION: 'ItemRevision',
    TYPE_EQUIPMENT_REVISION: 'Mfg0MEEquipmentRevision',
    TYPE_SKILL : 'SSP0BvrSkill',

    //Process Types
    TYPE_PART_PROCESS: 'Mfg0BvrPart',
    TYPE_WORK_CARD_PROCESS: 'SSP0BvrWorkCard',
    TYPE_EQUIPMENT_PROCESS: 'Mfg0BvrEquipment',
    TYPE_RESOURCE_PROCESS: 'Mfg0BvrResource',

    //Messages
    MSG_ACTIVITY_CREATED: 'newActivityCreated',

    //Properties
    BOMLINE_WORK_TIME: 'bl_me_work_time',
    BOMLINE_DURATION_TIME: 'bl_me_duration_time',
    ACTIVITY_WORK_TIME: 'al_activity_work_time',
    ACTIVITY_DURATION_TIME: 'al_activity_duration_time',
    ACTIVITY_SYSTEM_UNIT_TIME: 'al_activity_time_system_unit_time',

    //Units
    UNITS: {
        '1/1000th min': { multiplierToSec: 0.06 },
        '1/100th min': { multiplierToSec: 0.6 },
        '1/10th min': { multiplierToSec: 6 },
        day: { multiplierToSec: 86400 },
        FAC: { multiplierToSec: 0.18 },
        hour: { multiplierToSec: 3600 },
        minute: { multiplierToSec: 60 },
        MOD: { multiplierToSec: 0.129 },
        second: { multiplierToSec: 1 },
        TMU: { multiplierToSec: 0.036 }
    },

    //Viewer Instances
    ACT_VIEWER_INSTANCE_ID: 'actVisViewer'


};

export default { constants };
