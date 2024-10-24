// Copyright (c) 2022 Siemens

/**
 * @module js/tq0AddProfilesToQPGPanelService
 */

import cdm from 'soa/kernel/clientDataModel';

/**
   * Define public API
  */
var exports = {};

/**
   * prepare the input for set properties SOA call to add the Qualification Profiles
   *
   * @param {data} ctx - The qualified data of the viewModel
   * @param {ctx}  dataProviders - The data provider that will be used to get the correct content
   * @returns {String} Resource provider content type
   */
export let addProfileToQPG = function( dataProviders, ctx ) {
    var inputData = [];
    var selected = ctx.mselected;
    var tableVals = ctx.mselected[0].props.tq0QualProfileList.dbValues;
    selected.forEach( function( selectedTask ) {
        var infoObj = {};

        infoObj.object = cdm.getObject( selectedTask.uid );
        infoObj.timestamp = '';

        var temp = {};
        temp.name = 'tq0QualProfileList';
        dataProviders.getQualificationProfileList.selectedObjects.forEach( function( vals ) {
            if( tableVals.indexOf( vals.uid ) === -1 ) {
                tableVals.push( vals.uid );
            }
        } );
        temp.values = tableVals;

        var vecNameVal = [];
        vecNameVal.push( temp );

        infoObj.vecNameVal = vecNameVal;

        inputData.push( infoObj );
    } );

    return inputData;
};

export default exports = {
    addProfileToQPG
};

