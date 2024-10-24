// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/*global
 */

/**
 * Interfaces graph node service
 *
 * @module js/Ase1IntefacesGraphNodeService
 */
import interfacesGraphLegendManager from 'js/Ase1InterfacesGraphLegendManager';
import _ from 'lodash';
import declUtils from 'js/declUtils';
import templateService from 'js/Ase1InterfacesGraphTemplateService';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';

/**
 * Process node data
 *
 * @param {Object} graphModel Graph Model
 * @param {Object} nodes nodes to add in graph
 * @param {Object} systemType system type
 * @param {Object} activeLegendView Active Legend View
 * @param {Object} interfacesCtx Model Data
 */
export let processNodeData = function( graphModel, nodes, systemType, activeLegendView, interfacesCtx ) {
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;

    const isSystemOfInterest = systemType === 'SystemOfInterest';

    _.forEach( nodes, function( nodeData ) {
        var nodeObject = nodeData.nodeObject;

        if( !graphModel.dataModel.nodeModels[ nodeObject.uid ] && interfacesCtx.nodeMap[ nodeObject.uid ] ) {
            var labelText = interfacesCtx.nodeMap[ nodeObject.uid ].nodeLabel;
            var template = null;
            var nodeRect = null;
            var bindData = [];
            var nodeCategory = interfacesGraphLegendManager.getCategoryType( 'Node', activeLegendView );
            var nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory,
                activeLegendView );

            template = templateService.getNodeTemplate( graphModel.nodeTemplates, isSystemOfInterest );

            if( !template ) {
                logger.error( 'Failed to get SVG template for node object. Skip drawing the node. Object UID: ' +
                    nodeObject.uid );
                return;
            }

            bindData = templateService.getBindProperties( nodeObject, labelText );

            if( bindData ) {
                bindData.node_fill_color = 'rgb(121,121,121)';
            }

            //get node style from graph legend
            if( nodeStyle ) {
                bindData.bar_fill_color = nodeStyle.color;
            }
            if( isSystemOfInterest ) {
                nodeRect = {
                    width: 132,
                    height: 132
                };
            } else {
                nodeRect = {
                    width: 300,
                    height: 32
                };
            }

            //fill node command binding data
            if( graphModel.nodeCommandBindData ) {
                declUtils.consolidateObjects( bindData, graphModel.nodeCommandBindData );
            }

            const node = graph.createNodeWithBoundsStyleAndTag( nodeRect, template, bindData );
            node.category = 'Node';

            let labelConfiguration;

            //simulate application's root node
            if( isSystemOfInterest ) {
                labelConfiguration = {
                    hasBorder: true,
                    orientation: 'BOTTOM',
                    margin: [ 3, 2, 2, 2 ],
                    maxWidth: 300,
                    contentStyleClass: 'aw-widgets-cellListCellTitle',
                    backgroundStyleClass: 'aw-graph-node-filter',
                    textAlignment: 'MIDDLE',
                    allowWrapping: true
                };
                node.setMinNodeSize( [ 132, 132 ] );
            } else {
                labelConfiguration = {
                    margin: [ 5, 28, 5, 2 ],
                    maxWidth: 300,
                    sizeBinding: true,
                    contentStyleClass: 'aw-widgets-cellListCellTitle',
                    allowWrapping: true
                };
                node.setMinNodeSize( [ 180, 32 ] );
            }
            graph.setLabel( node, labelText, labelConfiguration );
            const nodeModel = {
                id: nodeObject.uid,
                modelObject: nodeObject,
                category: nodeCategory,
                systemType: systemType
            };

            //build node map to help create edges
            graphModel.addNodeModel( node, nodeModel );
        }
    } );
};

const exports = {
    processNodeData
};

export default exports;
