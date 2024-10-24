// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ParamCommandDelegator
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

var exports = {};

export let att1RegisterCreateChange = function() {
    var selectedObjs = _.get( appCtxSvc, 'ctx.parammgmtctx.mselected', undefined );
    if( selectedObjs ) {
        var appSelectedObjects = {
            appSelectedObjects: selectedObjs
        };
        appCtxSvc.registerCtx( 'appCreateChangePanel', appSelectedObjects );
    }
};

export let att1RegisterCreateTraceLink = function() {
    var selectedObjs = _.get( appCtxSvc, 'ctx.parammgmtctx.mselected', undefined );
    if( selectedObjs ) {
        var sourceObjects = {
            sourceObject: selectedObjs
        };
        appCtxSvc.registerCtx( 'rmTracelinkPanelContext', sourceObjects );
    }
};

export let att1RegisterGnerateReport = function() {
    var selectedObjs = _.get( appCtxSvc, 'ctx.mselected', undefined );
    if( selectedObjs ) {
        _.forEach( selectedObjs, function( obj ) {
            if( obj.props && obj.props.att1SourceAttribute ) {
                obj.props.awb0UnderlyingObject = obj.props.att1SourceAttribute;
            }
        } );
    }
};

/**
 *Parameter Management UtilService
 */

export default exports = {
    att1RegisterCreateChange,
    att1RegisterCreateTraceLink,
    att1RegisterGnerateReport
};
