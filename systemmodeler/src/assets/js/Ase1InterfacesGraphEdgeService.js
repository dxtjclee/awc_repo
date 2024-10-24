//@<COPYRIGHT>@
//==================================================
//Copyright 2018.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Interfaces graph edge service
 *
 * @module js/Ase1InterfacesGraphEdgeService
 */
import interfacesGraphLegendManager from 'js/Ase1InterfacesGraphLegendManager';
import _ from 'lodash';
import graphLegendSvc from 'js/graphLegendService';

/**
 * Process edge data and create edges for them
 * @param {Object} graphModel - graph model
 * @param {Object} edges - edges to draw
 * @param {Object} activeLegendView - active legend view
 *
 * @return {Array} addedEdges
 */
export let processEdgeData = function( graphModel, edges, activeLegendView ) {
    var addedEdges = [];
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;

    _.forEach( edges,
        function( edgeInformation ) {
            var edgeObject = null;
            if( edgeInformation.edgeObject ) {
                edgeObject = edgeInformation.edgeObject;
            }

            let sourceNodeModel = graphModel.dataModel.nodeModels[ edgeInformation.end1Element.uid ];
            let targetNodeModel = graphModel.dataModel.nodeModels[ edgeInformation.end2Element.uid ];

            let edge;
            var edgeCategory = interfacesGraphLegendManager.getCategoryType( 'Connectivity', activeLegendView );
            var edgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory,
                activeLegendView );

            if( sourceNodeModel && targetNodeModel ) {
                edge = graph.createEdgeWithNodesStyleAndTag( sourceNodeModel.graphItem, targetNodeModel.graphItem, edgeStyle,
                    null );
            }

            if( edge && edgeObject ) {
                edge.category = 'Edge';

                let edgeModel = {
                    id: edgeObject.uid,
                    modelObject: edgeObject,
                    sourceId: sourceNodeModel.id,
                    targetId: targetNodeModel.id
                };

                // build edgeMap
                graphModel.addEdgeModel( edge, edgeModel );

                // record all added edges
                addedEdges.push( edge );
            }
        } );
    return addedEdges;
};

const exports = {
    processEdgeData
};

export default exports;
