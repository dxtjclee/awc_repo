//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*
 global
 */

/**
 * Ase0ArchitectureGraphAlignmentService
 *
 * @module js/Ase0ArchitectureGraphAlignmentService
 */

/**
 * Change Alignment
 * @param {eventData} eventData - The qualified event data
 * @param {Object} graphModel graph model
 */
export let changeAlignment = function( eventData, graphModel ) {
    var alignSide = eventData.userAction;
    var graphControl = graphModel.graphControl;
    var nodes = graphControl.getSelected( 'Node' );
    var edges = graphControl.getSelected( 'Edge' );
    var ports = graphControl.getSelected( 'Port' );
    var itemsToAlignment = [].concat( nodes, edges, ports );
    if( itemsToAlignment.length > 0 ) {
        graphControl.alignment.quickAlignment( itemsToAlignment, alignSide, 'BOUNDING_BOX' );
    }
};

const exports = {
    changeAlignment
};
export default exports;
