//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 *
 * @module js/Ase0ArchitectureTransformationService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';

/**
 * This method transform the SOA response to create object uid vs node info map
 *
 * @param {object} outputData - output response of SOA
 * @param {object} nodeMap - node map containing uid vs graph item
 * @returns {Object} updated nodeMap
 */
export let nodeDataCacheTransform = function( outputData, nodeMap ) {
    if( outputData && outputData.length > 0 ) {
        _.forEach( outputData, function( output ) {
            _.forEach( output.nodeData, function( nodeInformation ) {
                if( !nodeMap[ nodeInformation.node.uid ] ) {
                    nodeMap[ nodeInformation.node.uid ] = nodeInformation;
                }
            } );
        } );
    }
    return nodeMap;
};

/**
 * This method transform the SOA response to create object uid vs edge info map
 *
 * @param {object} outputData -output response of SOA
 * @param {object} edgeMap - edge map containing uid vs graph item
 * @returns {object} updated edgeMap
 */
export let edgeDataCacheTransform = function( outputData, edgeMap ) {
    var edgeModel = null;
    var uidToCheck;
    if( outputData && outputData.length > 0 ) {
        _.forEach( outputData, function( output ) {
            _.forEach( output.edgeData, function( edgeInformation ) {
                //TODO: server should return unique uid for tracelinks
                if( edgeInformation && edgeInformation.edgeInfo.edgeType[ 0 ].localeCompare( 'Structure' ) !== 0 && edgeInformation.edge ) {
                    edgeModel = cdm.getObject( edgeInformation.edge.uid );
                    var isConnection = false;
                    if( edgeModel ) {
                        isConnection = cmm.isInstanceOf( 'Awb0Connection', edgeModel.modelType );
                    }
                    if( isConnection ) {
                        uidToCheck = edgeInformation.edge.uid;
                    } else if( edgeInformation.end1Element && edgeInformation.end2Element ) {
                        uidToCheck = edgeInformation.edge.uid + '+' + edgeInformation.end1Element.uid + '+' + edgeInformation.end2Element.uid;
                    }
                    if( !edgeMap[ uidToCheck ] ) {
                        edgeMap[ uidToCheck ] = edgeInformation;
                    }
                }
            } );
        } );
    }
    return edgeMap;
};

/**
 * This method transform the SOA response to create object uid vs port info map
 *
 * @param {object} outputData - output response of SOA
 * @param {object} portMap - port map containing uid vs graph item
 * @returns {object} updated portMap
 */
export let portDataCacheTransform = function( outputData, portMap ) {
    if( outputData && outputData.length > 0 ) {
        _.forEach( outputData, function( output ) {
            _.forEach( output.portData, function( portInformation ) {
                if( !portMap[ portInformation.port.uid ] ) {
                    portMap[ portInformation.port.uid ] = portInformation;
                }
            } );
        } );
    }
    return portMap;
};

const exports = {
    nodeDataCacheTransform,
    edgeDataCacheTransform,
    portDataCacheTransform
};
export default exports;
