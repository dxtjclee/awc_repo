// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for training and qualification module
 *
 * @module js/tq0ChartService
 */
import AwStateService from 'js/awStateService';

var exports = {};
var chartProvider = {
    title: '',
    columns: [],
    onSelect: function( column ) { exports.barSelection( column ); }
};


var QUALIFICATION_UNIT = 'QualificationUnit';
var QUALIFICATION_PROFILE = 'QualificationProfile';
var QUALIFICATION_PROFILE_GROUP = 'QualificationProfileGroup';


export let barSelection = function( column ) {
    var stateSvc = AwStateService.instance;

    if( column.key === QUALIFICATION_UNIT ) {
        stateSvc.go( 'showQUDashboard', {}, {} );
    }
    if( column.key === QUALIFICATION_PROFILE ) {
        stateSvc.go( 'showQPDashboard', {}, {} );
    }
    if( column.key === QUALIFICATION_PROFILE_GROUP ) {
        stateSvc.go( 'showQPGDashboard', {}, {} );
    }
};
export let createChart = function( data ) {
    chartProvider.columns = [];

    if( data.qualificationUnitTotalFound !== undefined && data.qualificationUnitTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.qualificationUnit, value: data.qualificationUnitTotalFound, key: QUALIFICATION_UNIT } );
    }
    if( data.qualificationProfileTotalFound !== undefined && data.qualificationProfileTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.qualificationProfile, value: data.qualificationProfileTotalFound, key: QUALIFICATION_PROFILE } );
    }
    if( data.qualificationProfileGroupTotalFound !== undefined && data.qualificationProfileGroupTotalFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.qualificationProfileGroup, value: data.qualificationProfileGroupTotalFound, key: QUALIFICATION_PROFILE_GROUP } );
    }


    return chartProvider;
};


export default exports = {
    barSelection,
    createChart
};

