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
 *AutoLayout command handler
 *
 * @module js/Ase0ArchitectureAutoLayoutHandler
 */

/*
 * Disable auto layout
 */
export let disableAutoLayout = function( graphModel, graphState ) {
    //Need to return autoLayoutState to avoid execution of enable and disable auto layout in one flow
    let autoLayoutState = graphState.isAutoLayoutOn;
    var graphControl = graphModel.graphControl;
    var alignPreferences = graphControl.alignment.preferences;
    var graph = graphControl.graph;
    const newGraphState = { ...graphState.value };
    var layout = graphControl.layout;
    if( layout ) {
        layout.deactivate();
        graph.update( function() {
            //Enable auto alignment on auto layout OFF
            alignPreferences.enabled = true;
        } );
        newGraphState.isAutoLayoutOn = false;
    }
    graphState.update && graphState.update( newGraphState );
    return {
        autoLayoutState: autoLayoutState,
        actionState : {}
    };
};

/*
 * Enable auto layout
 */
export let enableAutoLayout = function( graphModel, graphState ) {
    var graphControl = graphModel.graphControl;
    var gridPreferences = graphControl.grid.preferences;
    var alignPreferences = graphControl.alignment.preferences;
    var graph = graphControl.graph;
    const newGraphState = { ...graphState.value };
    var layout = graphControl.layout;
    if( layout ) {
        layout.activate();
        newGraphState.Ase0SnapToGrid = false;
        graph.update( function() {
            //Disable auto alignment and snapping on auto layout ON
            gridPreferences.enableSnapping = false;
            alignPreferences.enabled = false;
        } );
        newGraphState.isAutoLayoutOn = true;
    }
    graphState.update && graphState.update( newGraphState );
    return {
        actionState : {}
    };
};

const exports = {
    disableAutoLayout,
    enableAutoLayout
};
export default exports;
