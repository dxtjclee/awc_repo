// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global

 */

/**
 * This implements the graph overlay handler for Architecture tab
 *
 * @module js/Ase0ArchitectureGraphOverlayHandler
 */

export let setOverlayNode = function( graphModel, node, pointOnPage ) {
    if( graphModel && graphModel.graphControl ) {
        var nodeSize = {
            width: 312,
            height: 120
        };
        var nodeStyle = node.style;
        var nodeData = node.getAppObj();
        if( node.appData.isGroup ) {
            nodeSize.height = node.getAppObj().HEADER_HEIGHT;
        }
        graphModel.graphControl.setCustomOverlayNode( node, nodeStyle, nodeSize, nodeData, pointOnPage );
    }
};

const exports = {
    setOverlayNode
};
export default exports;
