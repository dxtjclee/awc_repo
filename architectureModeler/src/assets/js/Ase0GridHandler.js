// Copyright (c) 2022 Siemens

/**
 * Ase0GridHandler command handler
 *
 * @module js/Ase0GridHandler
 */

var exports = {};

/*
 * Toggle on off grid
 */
export let toggleGrid = function( graphState, graphModel ) {
    const newGraphState = { ...graphState.value };
    var preferences = graphModel.graphControl.grid.preferences;
    var graph = graphModel.graphControl.graph;
    //If major/minor lines not present on graph then toggle both ON else OFF
    if( !newGraphState.Ase0MajorLines && !newGraphState.Ase0MinorLines ) {
        graph.update( function() {
            preferences.enabled = true;
            preferences.showMajorLines = true;
            preferences.showMinorLines = true;
        } );
    } else {
        graph.update( function() {
            preferences.enabled = !preferences.enabled;
        } );
    }
    newGraphState.gridOptions = preferences.enabled;
    newGraphState.Ase0MajorLines = preferences.showMajorLines;
    newGraphState.Ase0MinorLines = preferences.showMinorLines;
    newGraphState.Ase0SnapToGrid = preferences.enableSnapping;
    graphState.update && graphState.update( newGraphState );
};
/*
 * Update Grid Setting @param {data} data - The qualified data of the viewModel
 */
export let applyGridSetting = function( data, graphState, graphModel ) {
    const newGraphState = { ...graphState.value };
    var preferences = graphModel.graphControl.grid.preferences;
    if( preferences ) {
        var graph = graphModel.graphControl.graph;
        graph.update( function() {
            preferences.enabled = data.showGridData.dbValue;
            preferences.showMajorLines = data.majorLines.dbValue;
            preferences.showMinorLines = data.minorLines.dbValue;
            preferences.enableSnapping = data.snapToGridData.dbValue;
        } );
    }
    newGraphState.gridOptions = data.showGridData.dbValue;
    newGraphState.Ase0MajorLines = data.majorLines.dbValue;
    newGraphState.Ase0MinorLines = data.minorLines.dbValue;
    newGraphState.Ase0SnapToGrid = data.snapToGridData.dbValue;
    graphState.update && graphState.update( newGraphState );
};

export default exports = {
    toggleGrid,
    applyGridSetting
};
