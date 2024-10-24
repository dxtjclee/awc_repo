// Copyright (c) 2022 Siemens

/**
 * This file is used for calling data service provider for Target Entity.
 *
 * @module js/tq0AssignTargetEntity
 */
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';

var exports = {};
var localeTextBundle = localeService.getLoadedText( 'trainingandqualificationMessages' );

/**
 * prepare the input for set properties SOA call to add the target Entity
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} ctx - The data provider that will be used to get the correct content
 */

export let addTargetEntity = function( data, ctx, addPanelState ) {
    var inputData = [];

    var selected = ctx.mselected;

    selected.forEach( function( selectedTask ) {
        var infoObj = {};

        infoObj.object = cdm.getObject( selectedTask.uid );
        infoObj.timestamp = '';

        var temp = {};
        temp.name = 'tq0TargetEntity';

        switch ( data.selectedTab.name ) {
            case localeTextBundle.user:
                //For adding User as Target Entity.
                temp.values = [ data.dataProviders.userPerformSearch.selectedObjects[0].props.user.dbValue ];
                break;
            case localeTextBundle.palette:
                //For adding Palette as Target Entity.
                temp.values = [ data.dataProviders.paletteObjectProvider.selectedObjects[0].uid ];
                break;
            case localeTextBundle.equipment:
                //For adding Results tab value under 'Machine' tab as Target Entity.
                temp.values = [ addPanelState.sourceObjects[0].uid ];
                break;
        }

        var vecNameVal = [];
        vecNameVal.push( temp );

        infoObj.vecNameVal = vecNameVal;

        inputData.push( infoObj );
    } );

    return inputData;
};

/**
 * prepare the input for set properties SOA call to add the target Entity
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} ctx - The data provider that will be used to get the correct content
 */

export let replaceTargetEntity = function( data, ctx, addPanelState ) {
    var inputData = [];

    var infoObj = {};

    infoObj.object = ctx.pselected;
    infoObj.timestamp = '';

    var temp = {};
    temp.name = 'tq0TargetEntity';

    switch ( data.selectedTab.name ) {
        case localeTextBundle.user:
            //For replacing User as Target Entity.
            temp.values = [ data.dataProviders.userPerformSearch.selectedObjects[0].props.user.dbValue ];
            break;
        case localeTextBundle.palette:
            //For replacing Palette as Target Entity.
            temp.values = [ data.dataProviders.paletteObjectProvider.selectedObjects[0].uid ];
            break;
        case localeTextBundle.equipment:
            //For replacing Results tab value under 'Machine' tab as Target Entity.
            temp.values = [ addPanelState.sourceObjects[0].uid ];
            break;
    }

    var vecNameVal = [];
    vecNameVal.push( temp );

    infoObj.vecNameVal = vecNameVal;

    inputData.push( infoObj );


    return inputData;
};

/**
 * prepare the input for set properties SOA call to add the target Entity
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} ctx - The data provider that will be used to get the correct content
 */

export let setFlagSeachShowFilter = function( data ) {
    // Check if data is not null and selected tab is true then only set
    // the selected object to null always if user selected some object earlier before tab selection
    if ( data && data.selectedTab.tabKey === 'equipmentPage' ) {
        data.showSearchFilter = false;
    }
};

export default exports = {
    addTargetEntity,
    replaceTargetEntity,
    setFlagSeachShowFilter
};
