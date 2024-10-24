// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0RequirementDashboardTable
 */
import appCtxSvc from 'js/appCtxService';
import commandSvc from 'js/command.service';
import $ from 'jquery';

var exports = {};

export let processColumns = function( data ) {
    if ( data.columnConfig && data.columnConfig.columns ) {
        for( var i = 0; i < data.columnConfig.columns.length; i++ ) {
            var columnInfo = data.columnConfig.columns[i];
            if( columnInfo.propertyName === 'awb0ArchetypeRevName' ) {
                columnInfo.isTableCommand = true;
            } else if( i === data.columnConfig.columns.length - 1 ) {
                columnInfo.enableColumnResizing = false;
            }
        }
    }
    return data.columnConfig;
};

export let getColumnFilters = function( data ) {
    if ( appCtxSvc.ctx.reqDashboardTableColumnFilters ) {
        data.columnProviders.reqDashboardTableColumnProvider.columnFilters = appCtxSvc.ctx.reqDashboardTableColumnFilters;
    }
    return data.columnProviders.reqDashboardTableColumnProvider.columnFilters;
};

export let clearProviderSelection = function( data ) {
    if ( data && data.dataProviders ) {
        var dataProvider = data.dataProviders.showReqDashboardTableProvider;
        if ( dataProvider ) {
            dataProvider.selectNone();
        }
    }
};

/**
 * Set Summary Table height
 */
export let setDashboardTableHeight = function() {
    var subLocHeight = document.getElementsByClassName( 'aw-layout-sublocationContent' )[0].clientHeight;
    var requiredHeight = subLocHeight - 70;
    var element = document.getElementsByClassName( 'aw-layout-panelMain' )[0];
    if ( element && ( !element.style.maxHeight || element.style.maxHeight.indexOf( requiredHeight ) === -1 ) ) {
        var panelScrollBody = $( element );
        panelScrollBody.attr( 'style', 'max-height:' + requiredHeight + 'px' );
    }
};

/**
 * Execute the command.
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let executeOpenReqInTable = function( vmo ) {
    var commandContext = {
        vmo: vmo,
        edit: false
    };
    commandSvc.executeCommand( 'Awp0ShowObjectCell', null, null, commandContext );
};

/**
 * @param {String} objectSetUri - URI
 * @returns {Object} -
 */
function updateDataProvider( objectSetUri ) {
    let objectSetUriOutput = {};
    if( objectSetUri ) {
        objectSetUriOutput.clientScopeURI = objectSetUri;
    }
    return objectSetUriOutput;
}

export default exports = {
    getColumnFilters,
    clearProviderSelection,
    setDashboardTableHeight,
    executeOpenReqInTable,
    processColumns,
    updateDataProvider
};
