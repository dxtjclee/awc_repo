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
 * This implements the tooltip handler interface APIs defined by aw-graph widget to provide tooltip functionalities for
 * Architecture tab.
 *
 * @module js/Ase0ArchitectureGraphTooltipHandler
 */
import clientMetaModel from 'soa/kernel/clientMetaModel';

/**
 * Function to be called to get tooltip
 *
 * @param {Object} graphItem graph item
 * @param {Object} graphModel graph Model
 * @return {String} tooltip
 */
export let getTooltip = function( graphItem, graphModel ) {
    var tooltip = null;
    if( graphItem.getItemType() === 'Label' ) {
        tooltip = graphItem.getText();
    } else if( graphItem.getItemType() === 'Edge' || graphItem.getItemType() === 'Port' ) {
        var label = graphItem.getLabel();
        if( label ) {
            tooltip = label.getText();
        } else {
            if( graphItem.modelObject && graphItem.modelObject.modelType ) {
                if( clientMetaModel.isInstanceOf( 'FND_TraceLink', graphItem.modelObject.modelType ) ) {
                    if( graphItem.modelObject.props.name && graphItem.modelObject.props.name.uiValues &&
                        graphItem.modelObject.props.name.uiValues.length > 0 ) {
                        tooltip = graphItem.modelObject.props.name.uiValues[ 0 ];
                    }
                } else if( clientMetaModel.isInstanceOf( 'Awb0Connection', graphItem.modelObject.modelType ) ) {
                    if( graphItem.modelObject.props.object_string && graphItem.modelObject.props.object_string.uiValues &&
                        graphItem.modelObject.props.object_string.uiValues.length > 0 ) {
                        tooltip = graphItem.modelObject.props.object_string.uiValues[ 0 ];
                    }
                }
            }
        }
    } else if( graphItem.getItemType() === 'Node' ) {
        var bindData = graphItem.getAppObj();
        var propVal = bindData.Title;
        if( propVal ) {
            tooltip = bindData[ propVal ];
        }
    }
    return tooltip;
};

const exports = {
    getTooltip
};
export default exports;
