// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/ShowDeliverableInstances
 */
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import _ from 'lodash';

var exports = {};

/**
 * Get dataset info
 *
 * @param {Object} addPanelState - addPanelState
 * @return {Object} dataSetFileInfos
 */
export let getDatasetFileInfos = function( addPanelState ) {
    let fileType = addPanelState.datasetVMO.props.datasetType.uiValue;
    let isTextFile = fileType && fileType.toLowerCase() === 'text';
    let  namedReferenceName = addPanelState.references[0].propInternalValue.referenceName;
    let file = addPanelState.datasetVMO.props.datasetName.dbValue;
    let fileExt = addPanelState.references[0].propInternalValue.fileExtension;
    let ext = fileExt.split( '*' ).pop();
    let fileName = file.concat( ext );

    return {
        isTextFile: isTextFile,
        namedReferenceName: namedReferenceName,
        fileName: fileName
    };
};


/**
 * It creates structure of form inputObject - otherSideObject , where
 * inputObject - Deliverable Instance(s) cut from the Deliverable Instances table
 * otherSideObject - List of Primary Objects attached to selected inputObject(s)
 *
 * @param {response} response - SOA response
 * @return {Object} - outputData object that holds the correct values .
 *
 */
export let getListOfPDRs = function( response ) {
    let outputData = [];
    let prgDelRevs = {};
    if( response.output && response.output.length > 0 ) {
        for( let i = 0; i < response.output.length; i++ ) {
            if( response.output[ i ].relationshipData[ 0 ] && response.output[ i ].relationshipData[ 0 ].relationshipObjects ) {
                // Its a Revisable Workspace object attached to Event , appears in Deliverable Instance and has no Secondary object
                //E.g.: 2D CAD is attached as Deliverable to Event and it also appears in Deliverable Instance table
                if( response.output[ i ].relationshipData[ 0 ].relationshipObjects.length === 0 ) {
                    prgDelRevs = {
                        inputObject: response.output[ i ].inputObject
                    };
                    outputData.push( prgDelRevs );
                } else {
                    for( let j = 0; j < response.output[ i ].relationshipData[ 0 ].relationshipObjects.length; j++ ) {
                        prgDelRevs = {
                            primaryObject: response.output[ i ].relationshipData[ 0 ].relationshipObjects[ j ].otherSideObject,
                            inputObject: response.output[ i ].inputObject
                        };
                        outputData.push( prgDelRevs );
                    }
                }
            }
        }
    }
    return outputData;
};

/**
 * Sets the correct relation between input and primary object
 *
 * @param {ctx} ctx - Location context object
 * @param {data} data - Data that contains information about the primary-secondary objects
 * @return {Object} - relation between input and primary object
 */
export let getInputToCutDelInstance = function( ctx, data ) {
    let input = [];
    let inputData = {};
    for( let i = 0; i < data.primaryObjs.length; i++ ) {
        let primaryObjs;
        let propertyName;
        if( _.isEmpty( data.primaryObjs[ i ].primaryObject ) ) {
            if( ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ) {
                primaryObjs = ctx.xrtSummaryContextObject;
                propertyName = 'Psi0PlanPrgDel';
            } else if( ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
                primaryObjs = ctx.xrtSummaryContextObject;
                if( cmm.isInstanceOf( 'Prg0AbsPlan', primaryObjs.modelType ) ) {
                    propertyName = 'Psi0PlanPrgDel';
                }else if( cmm.isInstanceOf( 'Prg0AbsEvent', primaryObjs.modelType ) ) {
                    propertyName = 'Psi0EventPrgDel';
                }
            } else {
                primaryObjs = data.primaryObjs[ i ].primaryObject;
                propertyName = 'Psi0DelInstances';
            }
            inputData = {
                parentObj: {
                    uid: primaryObjs.uid,
                    type: primaryObjs.type
                },
                childrenObj: [ {
                    uid: data.primaryObjs[ i ].inputObject.uid,
                    type: data.primaryObjs[ i ].inputObject.type
                } ],
                propertyName: propertyName
            };
            input.push( inputData );
        }
        return input;
    }
};

/**
 * Parse the perform search response and return the correct output data object
 *
 * @param {Object} response - The response of performSearch SOA call
 * @return {Object} - outputData object that holds the correct values .
 */
var processProviderResponse = function( response ) {
    // Check if response is not null and it has some search results then iterate for each result to formulate the
    // correct response
    if( response && response.searchResults ) {
        _.forEach( response.searchResults, function( result ) {
            // Get the model object for search result object UID present in response
            var resultObject = cdm.getObject( result.uid );

            if( resultObject ) {
                var props = [];

                var cellHeader1 = resultObject.props.object_string.uiValues[ 0 ];
                props.push( ' Object Name \\:' + cellHeader1 );

                var cellHeader2 = resultObject.props.object_type.uiValues[ 0 ];
                props.push( ' Object type \\:' + cellHeader2 );

                if( props ) {
                    resultObject.props.awp0CellProperties.dbValues = props;
                    resultObject.props.awp0CellProperties.uiValues = props;
                }
            }
        } );
    }
    return response.searchResults;
};

export let getCreateRelationsInput = function( data, selectedObj  ) {
    var input = [];
    var inputData = {};
    let secondaryObject = {};

    if( data.createdMainObject ) {
        secondaryObject = data.createdMainObject;
    } else if( data.createdObject ) {
        secondaryObject = data.createdObject;
    } else if( data.addPanelState.sourceObjects.length > 0 ) {
        secondaryObject = data.addPanelState.sourceObjects[0];
    }

    inputData = {
        primaryObject: selectedObj,
        relationType: 'Psi0DelInstances',
        secondaryObject: secondaryObject,
        clientId: '',
        userData: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        }
    };

    input.push( inputData );

    return input;
};

exports = {
    getDatasetFileInfos,
    getListOfPDRs,
    getInputToCutDelInstance,
    processProviderResponse,
    getCreateRelationsInput
};

export default exports;
