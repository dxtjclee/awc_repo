// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/ProgramScheduleManagerConstants
 */
var exports = {};

//Constant for inputTypes for Linked Program Objects
export let INPUT_TYPES = {
    PRGDEL: 'Psi0PrgDelRevision',
    RIO: 'Psi0AbsRIO',
    SCH: 'Schedule',
    CRITERIA: 'Prg0AbsCriteria',
    CHECKLIST: 'Psi0Checklist',
    RISK: 'Psi0ProgramRisk',
    ISSUE: 'Psi0ProgramIssue',
    OPPORTUNITY: 'Psi0ProgramOpp',
    CHANGEREQUEST: 'ChangeRequestRevision',
    CHANGENOTICE: 'ChangeNoticeRevision'
};

//Constant for validInputTypesForPRG type
export let VALID_INPUT_TYPES_FOR_PROGRAM = {
    PRGDEL: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp',
    RIO: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0PrgDel,ChangeRequest,Schedule',
    SCH: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp',
    CHANGEREQUEST: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp'
};

//Constant for validFilterTypesForPRG type
export let VALID_FILTER_TYPES_FOR_PROGRAM = {
    PRGDEL: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp',
    RIO: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0PrgDelRevision,ChangeRequestRevision,Schedule',
    SCH: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp',
    CHANGEREQUEST: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp'
};

//Constant for validInputTypesForEvent type
export let VALID_INPUT_TYPES_FOR_EVENT = {
    PRGDEL: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Prg0AbsCriteria,Psi0Checklist',
    RIO: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0PrgDel,Prg0AbsCriteria,ChangeNotice,Schedule',
    SCH: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Prg0AbsCriteria',
    CHANGENOTICE: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0Checklist,Prg0AbsCriteria',
    CRITERIA: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0PrgDel,ChangeNotice,Schedule',
    CHECKLIST: 'Psi0PrgDel,ChangeNotice'
};

//Constant for validFilterTypesForEvent type
export let VALID_FILTER_TYPES_FOR_EVENT = {
    PRGDEL: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Prg0AbsCriteria,Psi0Checklist',
    RIO: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0PrgDelRevision,Prg0AbsCriteria,ChangeNoticeRevision,Schedule',
    SCH: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Prg0AbsCriteria',
    CHANGENOTICE: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0Checklist,Prg0AbsCriteria',
    CRITERIA: 'Psi0ProgramRisk,Psi0ProgramIssue,Psi0ProgramOpp,Psi0PrgDelRevision,ChangeNoticeRevision,Schedule',
    CHECKLIST: 'Psi0PrgDelRevision,ChangeNoticeRevision'
};

export let OBJECT_TYPE = {
    PROGRAM: 'Prg0AbsPlan',
    EVENT: 'Prg0AbsEvent'

};

export let VALID_OBJECT_TYPE_FOR_PROGRAM_BOARD = {
    VALID_OBJECTS: 'Event'

};

export let VALID_RELATION_TYPE_FOR_PROGRAM = {
    PRGDEL: 'Psi0PlanPrgDel',
    RISK: 'Psi0PlanRiskRelation',
    ISSUE: 'Psi0PlanIssueRelation',
    OPPORTUNITY: 'Psi0PlanOpportunityRelation',
    SCH: 'Psi0PlanSchedule',
    CHANGEREQUEST: 'Pch0PlanChangeRelation'
};

export let VALID_RELATION_TYPE_FOR_EVENT = {
    PRGDEL: 'Psi0EventPrgDel',
    RISK: 'Psi0EventRiskRelation',
    ISSUE: 'Psi0EventIssueRelation',
    OPPORTUNITY: 'Psi0EventOppRelation',
    SCH: 'Psi0EventScheduleRelation',
    CHANGENOTICE: 'Pec0EventChangeRelation',
    CHECKLIST: 'Psi0EventChecklistRelation'
};

export let VALID_RELATION_TYPE_FOR_EVENT_IN_PROGRAM_BOARD = {
    Deliverables: 'Psi0EventPrgDel',
    Risks: 'Psi0EventRiskRelation',
    Issues: 'Psi0EventIssueRelation',
    Opportunities: 'Psi0EventOppRelation',
    Schedules: 'Psi0EventScheduleRelation',
    Changes: 'Pec0EventChangeRelation',
    Checklists: 'Psi0EventChecklistRelation',
    Criteria: 'EventCriteria'
};

export let VALID_RELATION_TYPE_FOR_PROGRAM_IN_PROGRAM_BOARD = {
    Deliverables: 'Psi0PlanPrgDel',
    Risks: 'Psi0PlanRiskRelation',
    Issues: 'Psi0PlanIssueRelation',
    Opportunities: 'Psi0PlanOpportunityRelation',
    Schedules: 'Psi0PlanSchedule',
    Changes: 'Pch0PlanChangeRelation'
};

//Constants for Psi0 RYG decorator style
export let RYG_DECORATOR_STYLE = {
    Red: {
        cellDecoratorStyle: 'aw-prgSchedulemanager-checklistStopColor',
        gridDecoratorStyle: 'aw-prgSchedulemanager-checklistTableStopColor'

    },
    Green: {
        cellDecoratorStyle: 'aw-prgSchedulemanager-checklistGoodColor',
        gridDecoratorStyle: 'aw-prgSchedulemanager-checklistTableGoodColor'
    },
    Yellow: {
        cellDecoratorStyle: 'aw-prgSchedulemanager-checklistWarningColor',
        gridDecoratorStyle: 'aw-prgSchedulemanager-checklistTableWarningColor'
    }
};

//Constant for RIO/Checklist/ChecklistQuestion state flag
export let RIO_CHECKLIST_CHECKLISTQUESTION_STATE = {
    New: 'indicatorFlagWhite16.svg',
    InProgress: 'indicatorReleasedPending16.svg',
    Closed: 'indicatorReleasedApproved16.svg',
    Cancelled: 'indicatorReleasedRejected16.svg'
};

//Constants for show-hide milestones functionality
export let OPERATION_TYPE_FOR_SHOW_AND_HIDE_MILESTONES = {
    SHOW_ALL: 'SHOW_ALL',
    HIDE_ALL: 'HIDE_ALL',
    SHOW_SELECTED: 'SHOW_SELECTED',
    HIDE_SELECTED: 'HIDE_SELECTED',
    SHOW_MILESTONES: 'SHOW_MILESTONES',
    HIDE_MILESTONES: 'HIDE_MILESTONES'
};

//Constant for PDR state flag
export let PROGRAM_DELIVERABLE_STATE = {
    Not_Started: 'indicatorNotStarted16.svg',
    In_Progress: 'indicatorInProgress16.svg',
    Complete: 'indicatorStatusComplete16.svg',
    Closed: 'indicatorClosed16.svg'
};

export default exports = {
    INPUT_TYPES,
    VALID_INPUT_TYPES_FOR_PROGRAM,
    VALID_FILTER_TYPES_FOR_EVENT,
    VALID_INPUT_TYPES_FOR_EVENT,
    VALID_FILTER_TYPES_FOR_PROGRAM,
    VALID_RELATION_TYPE_FOR_EVENT,
    VALID_RELATION_TYPE_FOR_EVENT_IN_PROGRAM_BOARD,
    VALID_RELATION_TYPE_FOR_PROGRAM_IN_PROGRAM_BOARD,
    RYG_DECORATOR_STYLE,
    RIO_CHECKLIST_CHECKLISTQUESTION_STATE,
    OBJECT_TYPE,
    VALID_OBJECT_TYPE_FOR_PROGRAM_BOARD,
    VALID_RELATION_TYPE_FOR_PROGRAM,
    OPERATION_TYPE_FOR_SHOW_AND_HIDE_MILESTONES,
    PROGRAM_DELIVERABLE_STATE
};
