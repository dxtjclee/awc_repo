// Copyright (c) 2022 Siemens

/**
 * This file populates data related to label setting panel
 *
 * @module js/Ase0SettingsLabelService
 */
import modelPropertySvc from 'js/modelPropertyService';
import _ from 'lodash';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

/*
 * Populate panel data @param {data} data - The qualified data of the viewModel
 */
export let populatePanelData = function( graphState ) {
    let labelCategories = [];
    _.forEach( graphState.labelCategories, function( category ) {
        let labelCategory = {
            displayName: category.categoryName,
            type: 'BOOLEAN',
            isRequired: 'false',
            isEditable: 'true',
            dispValue: category.internalName,
            labelPosition: 'PROPERTY_LABEL_AT_RIGHT',
            dbValue: category.categoryState
        };
        //Properties not getting loaded when using aw-repeat for checkbox so need to load it explicitly
        let prop = modelPropertySvc.createViewModelProperty( labelCategory );
        labelCategories.push( prop );
    } );
    return labelCategories;
};
/*
 * Apply label setting data @param {data} data - The qualified data of the viewModel
 */
export let applyLabelSetting = function( data, graphState, graphModel ) {
    let showHideCmdState = true;
    let newLabelCategories = [];
    //Take panel data and apply it
    const newGraphState = { ...graphState.value };
    _.forEach( data.labelCategories, function( category ) {
        let updatedCat = {
            categoryName: category.propertyName,
            internalName: category.uiValues[ 0 ],
            categoryState: category.dbValue
        };
        newLabelCategories.push( updatedCat );
    } );
    let graph = graphModel.graphControl.graph;
    let edges = graph.getVisibleEdges();
    let ports = graph.getVisiblePorts();
    showHideCmdState = updateLabelVisibility( graphModel, newLabelCategories, edges.concat( ports ) );
    if( data.resetLabelPositions.dbValue ) {
        resetAllLabelPosition( graph );
    }
    newGraphState.labelCategories = newLabelCategories;
    newGraphState.showLabels = showHideCmdState;
    graphState.update && graphState.update( newGraphState );
};

var updateLabelVisibility = function( graphModel, labelCategories, graphItems ) {
    let showHideCmdState = true;
    let labels = [];
    let graph = graphModel.graphControl.graph;
    _.forEach( graphItems, function( graphItem ) {
        let itemCategory = graphItem.category;
        let label = graphItem.getLabel();
        if( itemCategory ) {
            var state = _.find( labelCategories, { internalName: itemCategory } );
            if( state && state.categoryState ) {
                showHideCmdState = false;
                if( !label ) {
                    label = createGraphItemLabel( graphItem, graph );
                }
            }
            if( label ) {
                var labelState = {
                    label: label,
                    state: state
                };
                labels.push( labelState );
            }
        }
    } );
    graph.update( function() {
        _.forEach( labels, function( labelItem ) {
            labelItem.label.setVisible( labelItem.state.categoryState );
        } );
    } );
    return showHideCmdState;
};
var createGraphItemLabel = function( graphItem, graph ) {
    let modelObject = graphItem.modelObject;
    let labelText = null;
    if( cmm.isInstanceOf( 'Awb0Connection', modelObject.modelType ) && modelObject.props.object_string ) {
        labelText = modelObject.props.object_string.uiValues[ 0 ];
    } else if( cmm.isInstanceOf( 'FND_TraceLink', modelObject.modelType ) && modelObject.props.name ) {
        labelText = modelObject.props.name.uiValues[ 0 ];
    } else if( cmm.isInstanceOf( 'Awb0Interface', modelObject.modelType ) && modelObject.props.object_string ) {
        labelText = modelObject.props.object_string.uiValues[ 0 ];
    }
    graph.setLabel( graphItem, labelText );
    let label = graphItem.getLabel();
    if( graphItem.labelPosition ) {
        label.setPosition( graphItem.labelPosition );
    }
    return label;
};
/*
 *This function will show, hide labels depend on the input data from one step command group
 */
export let showHideLabels = function( showHide, graphState, graphModel ) {
    let selectedEdges = graphModel.graphControl.getSelected( 'Edge' );
    let selectedPorts = graphModel.graphControl.getSelected( 'Port' );
    let graph = graphModel.graphControl.graph;
    let graphItems = [];
    //Show/Hide/Reset label position depend on diagram selection or category selection
    const newGraphState = { ...graphState };
    if( selectedEdges.length > 0 || selectedPorts.length > 0 ) {
        _.forEach( selectedEdges, function( edgeItem ) {
            graphItems.push( edgeItem );
        } );
        _.forEach( selectedPorts, function( portItem ) {
            graphItems.push( portItem );
        } );
        showHideSelectedLabel( graphItems, graph, showHide );
        newGraphState.showLabels = !showHide;
    } else {
        let labelCategories = newGraphState.labelCategories;
        let edges = graph.getVisibleEdges();
        let ports = graph.getVisiblePorts();
        graphItems = _.concat( edges, ports );
        showHideSelectedLabel( graphItems, graph, showHide );
        _.forEach( labelCategories, function( category ) {
            category.categoryState = showHide;
        } );
        newGraphState.showLabels = !showHide;
    }
    graphState.update && graphState.update( newGraphState );
};
/*
 *This function will reset the label position
 */
export let resetLabel = function( graphModel ) {
    let selectedEdges = graphModel.graphControl.getSelected( 'Edge' );
    let selectedPorts = graphModel.graphControl.getSelected( 'Port' );
    let graph = graphModel.graphControl.graph;
    let graphItems = [];
    let labels = [];
    if( selectedEdges.length > 0 || selectedPorts.length > 0 ) {
        _.forEach( selectedEdges, function( edgeItem ) {
            graphItems.push( edgeItem );
        } );
        _.forEach( selectedPorts, function( portItem ) {
            graphItems.push( portItem );
        } );
        _.forEach( graphItems, function( graphItem ) {
            let label = graphItem.getLabel();
            if( label ) {
                labels.push( label );
            }
        } );
    } else {
        let edges = graph.getVisibleEdges();
        let ports = graph.getVisiblePorts();
        let items = edges.concat( ports );
        _.forEach( items, function( item ) {
            let label = item.getLabel();
            if( label && !label.isFiltered() ) {
                labels.push( label );
            }
        } );
    }
    graph.update( function() {
        _.forEach( labels, function( label ) {
            label.resetPosition();
        } );
    } );
};
var showHideSelectedLabel = function( graphItems, graph, showHide ) {
    graph.update( function() {
        {
            _.forEach( graphItems, function( graphItem ) {
                let label = graphItem.getLabel();
                if( showHide && !label && graphItem.modelObject ) {
                    label = createGraphItemLabel( graphItem, graph );
                }
                if( label ) {
                    label.setVisible( showHide );
                }
            } );
        }
    } );
};

let resetAllLabelPosition = function( graph ) {
    let edges = graph.getVisibleEdges();
    let ports = graph.getVisiblePorts();
    let graphItems = [];
    _.forEach( edges.concat( ports ), function( item ) {
        var label = item.getLabel();
        if( label && !label.isFiltered() ) {
            label.resetPosition();
        }
        graphItems.push( label );
    } );
    graph.update && graph.update( graphItems );
};

export default exports = {
    populatePanelData,
    applyLabelSetting,
    showHideLabels,
    resetLabel
};
