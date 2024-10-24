// Copyright (c) 2022 Siemens

/**
 * @module js/Att1DatasetService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

/**
 * Gets the goal file and measurement file.
 *
 * @param {Object} response The soa response
 * Need to load property ref_names of dtaaset in case of multiple "Reference Type" to a Dataset, replace action should be performed correctly : ref CP promoted by CFx PLM835662
 */
export let getDatasets = function( response ) {
    var goalFile = [];
    var measurementFile = [];

    for( var i = 0; i < response.output.length; i++ ) {
        for( var j in response.output[ i ].relationshipData ) {
            if( cmm.isInstanceOf( 'Att0MeasurableAttribute', response.output[ i ].inputObject.modelType ) &&
                response.output[ i ].relationshipData[ j ].relationName === 'Att0HasGoalFile' &&
                response.output[ i ].relationshipData[ j ].relationshipObjects[ 0 ] ) {
                dms.getProperties(
                    [ response.output[ i ].relationshipData[ j ].relationshipObjects[ 0 ].otherSideObject.uid ], [
                        'object_name', 'original_file_name', 'ref_names'
                    ] );
                goalFile
                    .push( cdm
                        .getObject( response.output[ i ].relationshipData[ j ].relationshipObjects[ 0 ].otherSideObject.uid ) );
            } else if( cmm.isInstanceOf( 'Att0MeasureValue', response.output[ i ].inputObject.modelType ) &&
                response.output[ i ].relationshipData[ j ].relationName === 'Att0HasMeasurementFile' &&
                response.output[ i ].relationshipData[ j ].relationshipObjects[ 0 ] ) {
                dms.getProperties(
                    [ response.output[ i ].relationshipData[ j ].relationshipObjects[ 0 ].otherSideObject.uid ], [
                        'object_name', 'original_file_name', 'ref_names'
                    ] );
                measurementFile
                    .push( cdm
                        .getObject( response.output[ i ].relationshipData[ j ].relationshipObjects[ 0 ].otherSideObject.uid ) );
            }
        }
    }
    return {
        goalFile: goalFile,
        measurementFile: measurementFile
    };
};

/**
 * Open the file select dialog box
 */
export let openFileSelectDialog = function( vmo ) {
    var datasetFileFullName = vmo.props.ref_list.uiValues[ 0 ];
    var elements = document.getElementsByTagName( 'input' );
    var temp = datasetFileFullName.split( '.' );
    appCtxSvc.registerCtx( 'isNewDataset', false );
    appCtxSvc.registerCtx( 'dataset', vmo );
    appCtxSvc.registerCtx( 'oldDataset', vmo );
    appCtxSvc.registerCtx( 'datasetFileExt', temp[ 1 ] );
    elements[ 0 ].click();
};

/*
 * Get Measure Value Object
 */
export let getMeasureValue = function() {
    var selectedObj = appCtxSvc.getCtx( 'selected' );
    if( cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', selectedObj.modelType ) ) {
        if( selectedObj.props && selectedObj.props.att1SourceAttribute ) {
            selectedObj = cdm.getObject( selectedObj.props.att1SourceAttribute.dbValues[ 0 ] );
        }
    }
    if( !cmm.isInstanceOf( 'Att0MeasurableAttribute', selectedObj.modelType ) ) {
        selectedObj = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
    }
    appCtxSvc.registerCtx( 'owningParam', selectedObj );

    var selected = cdm.getObject( selectedObj.uid );
    if( selected.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 &&
        selected.props.att0CurrentValue.dbValues[ 0 ] ) {
        return cdm.getObject( selected.props.att0CurrentValue.dbValues[ 0 ] );
    }
    return null;
};

/*
 * Return input for createOrUpdateMeasurableAttribute Soa call
 */
export let getCreateOrUpdateMeasurableAttributeSoaInput = function( datasetFiles ) {
    var soaInput = [];
    var selected = appCtxSvc.getCtx( 'owningParam' );
    var pselected = appCtxSvc.getCtx( 'pselected' );
    var dataset = appCtxSvc.getCtx( 'dataset' );
    var oldDataset = appCtxSvc.getCtx( 'oldDataset' );
    if( datasetFiles.goalFile[ 0 ].uid === oldDataset.uid ) {
        soaInput
            .push( {
                attribute: selected,
                clientId: 'com.siemens.splm.client.attrtargetmgmt.internal.operations.CreateOrModifyMeasurableAttrOperation',
                parentLine: pselected,
                measurementDatasetRelationName: 'Att0HasGoalFile',
                measurementDatasetObject: dataset
            } );
    } else if( datasetFiles.measurementFile[ 0 ].uid === oldDataset.uid ) {
        soaInput
            .push( {
                attribute: selected,
                clientId: 'com.siemens.splm.client.attrtargetmgmt.internal.operations.CreateOrModifyMeasurableAttrOperation',
                parentLine: pselected,
                measurementDatasetRelationName: 'Att0HasMeasurementFile',
                measurementDatasetObject: dataset
            } );
    }
    return soaInput;
};

export let getCreatedDataset = function( response ) {
    appCtxSvc.registerCtx( 'dataset', response.datasetOutput[ 0 ].dataset );
    appCtxSvc.registerCtx( 'isNewDataset', true );
    return cdm.getObject( response.datasetOutput[ 0 ].dataset.uid );
};

export default exports = {
    getDatasets,
    openFileSelectDialog,
    getMeasureValue,
    getCreateOrUpdateMeasurableAttributeSoaInput,
    getCreatedDataset
};
