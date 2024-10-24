// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for characteristics manager from quality center foundation module
 *
 * @module js/Aqc0ColumnChartActions
 */
import AwStateService from 'js/awStateService';

var exports = {};
var chartProvider = {
    title: '',
    columns: [],
    onSelect: function( column ) { exports.barSelection( column ); }
};

var FAILURE_SPEC = 'FailureSpec';
var CHECKLIST_SPEC = 'ChecklistSpec';
var FUNTION_SPEC = 'FunctionSpec';
var CHARACTERISTIC_GROUP = 'CharGroups';
var SYSTEM_ELE_SPEC = 'SystemEleSpec';
var QUALITYACTIONS = 'QualityActions';

export let barSelection = function( column ) {
    var stateSvc = AwStateService.instance;
    if( column.key === QUALITYACTIONS ) {
        stateSvc.go( 'QualityActionSubLocation', {}, {} );
    }
    if( column.key === FAILURE_SPEC ) {
        stateSvc.go( 'FailureSpecificationSubLocation', {}, {} );
    }
    if( column.key === CHECKLIST_SPEC ) {
        stateSvc.go( 'ChecklistSpecificationSubLocation', {}, {} );
    }
    if( column.key === CHARACTERISTIC_GROUP ) {
        stateSvc.go( 'CharacteristicsLibrarySubLocation', {}, {} );
    }
    if( column.key === FUNTION_SPEC ) {
        stateSvc.go( 'FunctionSpecificationSubLocation', {}, {} );
    }

    if( column.key === SYSTEM_ELE_SPEC ) {
        stateSvc.go( 'SystemEleSpecificationSubLocation', {}, {} );
    }
};
export let createChart = function( data ) {
    chartProvider.columns = [];
    if( data.systemEleSpecsTotalFound !== undefined && data.systemEleSpecsTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.systemSpec, value: data.systemEleSpecsTotalFound, key: SYSTEM_ELE_SPEC } );
    }
    if( data.functionSpecsTotalFound !== undefined && data.functionSpecsTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.functionSpec, value: data.functionSpecsTotalFound, key: FUNTION_SPEC } );
    }
    if( data.failureSpecsTotalFound !== undefined && data.failureSpecsTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.failureSpec, value: data.failureSpecsTotalFound, key: FAILURE_SPEC } );
    }
    if( data.charGroupsTotalFound !== undefined && data.charGroupsTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.characteristicGroups, value: data.charGroupsTotalFound, key: CHARACTERISTIC_GROUP } );
    }
    if( data.checklistSpecsTotalFound !== undefined && data.checklistSpecsTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.checklists, value: data.checklistSpecsTotalFound, key: CHECKLIST_SPEC } );
    }
    if( data.qualityActionsTotalFound !== undefined && data.qualityActionsTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.quality, value: data.qualityActionsTotalFound, key: QUALITYACTIONS } );
    }
    return chartProvider;
};

export default exports = {
    barSelection,
    createChart
};
