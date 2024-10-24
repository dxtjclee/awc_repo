/* eslint-disable sonarjs/no-one-iteration-loop */
// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */
/**
 * @module js/Apm0PropertyUpdateService
 */
import app from 'app';
import _uwPropertySvc from 'js/uwPropertyService';
import _cdmSvc from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import _dms from 'soa/dataManagementService';
import appCtxService from 'js/appCtxService';
import showReportBuilderReportsService from 'js/showReportBuilderReportsService';
import _localeSvc from 'js/localeService';
import 'js/pasteService';
import 'js/dataSourceService';
import 'js/editHandlerFactory';
import 'js/xrtParser.service';
import 'soa/kernel/clientMetaModel';
import 'soa/dataManagementService';

var exports = {};

export let raiseEventToPerformFiltering = function( filterStr ) {
    appCtxService.updatePartialCtx( 'awp0SummaryReports.reportFilter', filterStr );
    eventBus.publish( 'apm0.reveal' );
};

export let getReportDefinitionVal = function( response ) {
    var preference_Name = getPreferenceForQPMDashboard().preference_Name;
    var reportDefinitions = showReportBuilderReportsService.getReportDefinitionVal( response, null, preference_Name );
    reportDefinitions = reportDefinitions.reportdefinitions.filter( function( rd ) {
        return rd.type === 'ReportDefinition' && rd.props.rd_type.dbValues[ 0 ] === '4';
    } );

    if( appCtxService.ctx.preferences[ preference_Name ] !== null && appCtxService.ctx.preferences[ preference_Name ].length > 0 ) {
        var addedReportDefinations = appCtxService.getCtx( 'preferences.' + preference_Name ).map( function( report ) {
            return report.split( ':' )[ 0 ];
        } );

        reportDefinitions = reportDefinitions.filter( ( repDefObj ) => !addedReportDefinations.includes( repDefObj.props.rd_id.dbValues[ 0 ] ) );
    }

    return {
        reportdefinitions: reportDefinitions
    };
};

export let getPreferenceForQPMDashboard = function() {
    var preference_Name;
    if( appCtxService.ctx.sublocation.nameToken === 'com.siemens.splm.client.qualityCenterManager:showQPMDashboard' ) {
        preference_Name = 'APM0_QPMDashboard_TC_Report';
    }
    return { preference_Name: preference_Name };
};

export default exports = {
    raiseEventToPerformFiltering,
    getReportDefinitionVal,
    getPreferenceForQPMDashboard
};
app.factory( 'Apm0PropertyUpdateService', () => exports );

