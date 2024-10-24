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
 * Node commands service
 *
 * @module js/Ase0ArchitectureNodeCommandService
 */
import archGraphLegendManager from 'js/Ase0ArchitectureGraphLegendManager';
import nodeService from 'js/Ase0ArchitectureNodeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import { svgString as cmdParent } from 'image/cmdParent24.svg';
import { svgString as cmdChildPartial } from 'image/cmdChildPartial24.svg';
import { svgString as cmdChild } from 'image/cmdChild24.svg';
import { svgString as cmdIncomingPartial } from 'image/cmdIncomingPartial24.svg';
import { svgString as cmdShowIncomingRelations } from 'image/cmdShowIncomingRelations24.svg';
import { svgString as cmdOutgoingPartial } from 'image/cmdOutgoingPartial24.svg';
import { svgString as cmdShowOutgoingRelations } from 'image/cmdShowOutgoingRelations24.svg';


var SHOW_PARENT_IMG = 'show_parent_img';

var SHOW_CHILD_IMG = 'show_child_img';

var SHOW_INCOMING_IMG = 'show_incoming_img';

var SHOW_OUTGOING_IMG = 'show_outgoing_img';

var SHOW_PARENT_TOOLTIP = 'parent_tooltip';

var SHOW_CHILDREN_TOOLTIP = 'children_tooltip';

var SHOW_INCOMING_TOOLTIP = 'incoming_tooltip';

var SHOW_OUTGOING_TOOLTIP = 'outgoing_tooltip';

var PARENT_DEGREE = 'parent_degree';

var CHILD_DEGREE = 'child_degree';

var IN_DEGREE = 'in_degree';

var OUT_DEGREE = 'out_degree';

var PARTIAL_STATE = 'partial';

var EXPAND_STATE = 'expanded';

var CHILD_COUNT = 'child_count';

var IN_COUNT = 'in_count';

var OUT_COUNT = 'out_count';

var HAS_PARENT = 'has_parent';

var CHILDREN_FULL_LOADED = 'children_full_loaded';

var CHILDREN_PARTIALLY_LOADED = 'children_partially_loaded';

var CHILDREN_NUMBER_STYLE_SVG = 'children_number_style_svg';

var INCOMING_FULL_LOADED = 'incoming_full_loaded';

var OUTGOING_FULL_LOADED = 'outgoing_full_loaded';

var INCOMING_PARTIALLY_LOADED = 'incoming_partially_loaded';

var OUTGOING_PARTIALLY_LOADED = 'outgoing_partially_loaded';

var INCOMING_NUMBER_STYLE_SVG = 'in_degree_number_style_svg';

var OUTGOING_NUMBER_STYLE_SVG = 'out_degree_number_style_svg';

/**
 * Get the whole image string of the button
 *
 * @param {imageKey} imageKey key of the button image
 * @return {commandIcon} string of the image content
 */
var getButtonImage = function( commandIcon ) {
    if( commandIcon ) {
        var svgString = '<svg class="aw-base-icon" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
        return commandIcon.replace( '<svg class="aw-base-icon"', svgString );
    }
    return null;
};

var setIconBackground = function( selected, bindProperties, buttonStyleKey, state, visible ) {
    if( selected && state !== PARTIAL_STATE && visible ) {
        bindProperties[ buttonStyleKey ] = 'aw-state-selected';
    } else {
        bindProperties[ buttonStyleKey ] = 'hidden';
    }
};

var setIconImage = function( bindProperties, buttonStyleKey, state, visible ) {
    switch ( buttonStyleKey ) {
        case PARENT_DEGREE:
            bindProperties[ SHOW_PARENT_IMG ] = visible ? cmdParent : null;
            break;
        case CHILD_DEGREE:
            if( visible ) {
                bindProperties[ SHOW_CHILD_IMG ] =  state === PARTIAL_STATE  ? cmdChildPartial : cmdChild;
            } else {
                bindProperties[ SHOW_CHILD_IMG ] = null;
            }
            break;
        case IN_DEGREE:
            if( visible ) {
                bindProperties[ SHOW_INCOMING_IMG ] =  state === PARTIAL_STATE  ? cmdIncomingPartial : cmdShowIncomingRelations;
            } else {
                bindProperties[ SHOW_INCOMING_IMG ] = null;
            }
            break;
        case OUT_DEGREE:
            if( visible ) {
                bindProperties[ SHOW_OUTGOING_IMG ] =  state === PARTIAL_STATE  ? cmdOutgoingPartial : cmdShowOutgoingRelations;
            } else {
                bindProperties[ SHOW_OUTGOING_IMG ] = null;
            }
            break;
    }
};

var setIconTooltip = function( selected, bindProperties, data, buttonStyleKey, state, visible, totalCount ) {
    // Do not show tooltips when tile commands are disabled
    if( visible && data && data.graphModel && data.graphModel.config.aName ) {
        visible = false;
    }
    switch ( buttonStyleKey ) {
        case PARENT_DEGREE:
            if( visible ) {
                bindProperties[ SHOW_PARENT_TOOLTIP ] = selected ? data.i18n.hideParentCmdTitle : data.i18n.showParentCmdTitle;
            } else {
                bindProperties[ SHOW_PARENT_TOOLTIP ] = null;
            }
            break;
        case CHILD_DEGREE:
            if( visible ) {
                if( state === PARTIAL_STATE ) {
                    bindProperties[ SHOW_CHILDREN_TOOLTIP ] = selected ? data.i18n.hideAllChildren : data.i18n.showAllChildren.replace( '{0}', totalCount );
                } else {
                    bindProperties[ SHOW_CHILDREN_TOOLTIP ] = selected ? data.i18n.hideChildren : data.i18n.showChildren;
                }
            } else {
                bindProperties[ SHOW_CHILDREN_TOOLTIP ] = null;
            }
            break;
        case IN_DEGREE:
            if( visible ) {
                if( state === PARTIAL_STATE ) {
                    bindProperties[ SHOW_INCOMING_TOOLTIP ] = selected ? data.i18n.hideAllIncomingRelations : data.i18n.showAllIncomingRelations.replace( '{0}', totalCount );
                } else {
                    bindProperties[ SHOW_INCOMING_TOOLTIP ] = selected ? data.i18n.hideIncomingRelations : data.i18n.showIncomingRelations;
                }
            } else {
                bindProperties[ SHOW_INCOMING_TOOLTIP ] = null;
            }
            break;
        case OUT_DEGREE:
            if( visible ) {
                if( state === PARTIAL_STATE ) {
                    bindProperties[ SHOW_OUTGOING_TOOLTIP ] = selected ? data.i18n.hideAllOutgoingRelations : data.i18n.showAllOutgoingRelations.replace( '{0}', totalCount );
                } else {
                    bindProperties[ SHOW_OUTGOING_TOOLTIP ] = selected ? data.i18n.hideOutgoingRelations : data.i18n.showOutgoingRelations;
                }
            } else {
                bindProperties[ SHOW_OUTGOING_TOOLTIP ] = null;
            }
            break;
    }
};

var updateParentDegreeAttributesOnNode = function( node, bindData, graphModel, data ) {
    var groupGraph = graphModel.graphControl.groupGraph;
    var parentNode = groupGraph.getParent( node );
    var selected = false;
    var isGrandChild = false;
    if( parentNode && parentNode.isVisible() ) {
        selected = true;
        var grandParentNode = groupGraph.getParent( parentNode );
        if( grandParentNode && grandParentNode.isVisible() ) {
            isGrandChild = true;
            selected = false;
        }
    }

    if( isGrandChild || !node.hasParent ) {
        bindData[ HAS_PARENT ] = false;
    } else if( node.hasParent ) {
        bindData[ HAS_PARENT ] = true;
    }

    var visible = false;
    if( node.hasParent ) {
        visible = true;
    }

    if( !isGrandChild ) {
        var buttonStyleKey = PARENT_DEGREE;

        // set icon image
        setIconImage( bindData, buttonStyleKey, EXPAND_STATE, visible );

        // set the tooltip
        setIconTooltip( selected, bindData, data, buttonStyleKey, EXPAND_STATE, visible );
    }
    setIconBackground( selected, bindData, buttonStyleKey, EXPAND_STATE, visible );
    return bindData;
};

var updateChildDegreeAttributesOnNode = function( node, bindData, graphModel, data ) {
    var state = EXPAND_STATE;
    var selected = false;
    var allChildNodes = nodeService.getChildNodes( node, graphModel );
    var collpasedChildNodes = nodeService.getHiddenChildNodes( node, graphModel );
    var visibleChildren = nodeService.getVisibleChildNodes( node, graphModel );
    var visibleChildrenCount = visibleChildren.length;
    var childCount = 0;
    var hiddenChildrenCount = 0;
    if( allChildNodes && allChildNodes.length ) {
        hiddenChildrenCount = allChildNodes.length - visibleChildrenCount - collpasedChildNodes.length;
    }
    if( hiddenChildrenCount > 0 ) {
        childCount = node.numChildren - hiddenChildrenCount;
    } else {
        childCount = node.numChildren;
    }
    if( visibleChildrenCount === childCount ) {
        selected = true;
        bindData[ CHILD_COUNT ] = 0;
        bindData[ CHILDREN_NUMBER_STYLE_SVG ] = 'hidden';
    } else if( visibleChildrenCount > 0 ) {
        state = PARTIAL_STATE;
        bindData[ CHILD_COUNT ] = 0;
        bindData[ CHILDREN_NUMBER_STYLE_SVG ] = 'hidden';
    } else {
        bindData[ CHILD_COUNT ] = childCount;
        bindData[ CHILDREN_NUMBER_STYLE_SVG ] = 'aw-widgets-propertyLabel aw-base-small aw-relations-nodeChildCountSvg';
    }

    bindData[ CHILDREN_FULL_LOADED ] = childCount > 0 && ( visibleChildrenCount === 0 || childCount === visibleChildrenCount );
    bindData[ CHILDREN_PARTIALLY_LOADED ] = childCount > 0 && visibleChildrenCount > 0 && childCount > visibleChildrenCount;

    var buttonStyleKey = CHILD_DEGREE;
    var visible = false;
    if( node.numChildren > 0 ) {
        visible = true;
    }

    // set icon image
    setIconImage( bindData, buttonStyleKey, state, visible );

    // set the tooltip
    setIconTooltip( selected, bindData, data, buttonStyleKey, state, visible, childCount );
    setIconBackground( selected, bindData, buttonStyleKey, state, visible );
    return bindData;
};

var updateInOutDegreeAttributesOnNode = function( node, bindData, data, direction, activeLegendView ) {
    var state = EXPAND_STATE;
    var selected = false;
    var allVisibleRelations = direction === 'IN' ? archGraphLegendManager.getVisibleRelationTypes( node.incomingRelations, activeLegendView ).length : archGraphLegendManager.getVisibleRelationTypes( node.outgoingRelations, activeLegendView ).length;
    var visibleRelations = nodeService.getVisibleEdgesAtNode( node, direction ).length;
    var countKey = direction === 'IN' ? IN_COUNT : OUT_COUNT;
    var countStyleKey = direction === 'IN' ? INCOMING_NUMBER_STYLE_SVG : OUTGOING_NUMBER_STYLE_SVG;
    var fullLoadedKey = direction === 'IN' ? INCOMING_FULL_LOADED : OUTGOING_FULL_LOADED;
    var partialLoadedKey = direction === 'IN' ? INCOMING_PARTIALLY_LOADED : OUTGOING_PARTIALLY_LOADED;

    if( visibleRelations === allVisibleRelations ) {
        selected = true;
        bindData[ countKey ] = 0;
        bindData[ countStyleKey ] = 'hidden';
    } else if( visibleRelations > 0 ) {
        state = PARTIAL_STATE;
        bindData[ countKey ] = 0;
        bindData[ countStyleKey ] = 'hidden';
    } else {
        bindData[ countKey ] = allVisibleRelations;
        bindData[ countStyleKey ] = direction === 'IN' ? 'aw-widgets-propertyLabel aw-base-small aw-relations-nodeInDegreeSvg' : 'aw-widgets-propertyLabel aw-base-small aw-relations-nodeOutDegreeSvg';
    }

    bindData[ fullLoadedKey ] = allVisibleRelations > 0 && ( visibleRelations === 0 || allVisibleRelations === visibleRelations );
    bindData[ partialLoadedKey ] = allVisibleRelations > 0 && visibleRelations > 0 && allVisibleRelations > visibleRelations;

    var visible = false;
    if( allVisibleRelations > 0 ) {
        visible = true;
    }

    var buttonStyleKey = direction === 'IN' ? IN_DEGREE : OUT_DEGREE;

    // set icon image
    setIconImage( bindData, buttonStyleKey, state, visible );

    // set the tooltip
    setIconTooltip( selected, bindData, data, buttonStyleKey, state, visible, allVisibleRelations );
    setIconBackground( selected, bindData, buttonStyleKey, state, visible );

    return bindData;
};

/**
 * Update given nodes for in/out and parent/child degree
 *
 * @param {List} affectedNodeList affected node list
 * @param {Object} graphModel graph model
 * @param {Data} data data
 * @param {Object} activeLegendView active legend view
 */
export let updateGraphInfoOnNodes = function( affectedNodeList, graphModel, data, activeLegendView ) {
    _.forOwn( affectedNodeList, function( node ) {
        var bindData = {};
        bindData = updateParentDegreeAttributesOnNode( node, bindData, graphModel, data );
        bindData = updateChildDegreeAttributesOnNode( node, bindData, graphModel, data );
        bindData = updateInOutDegreeAttributesOnNode( node, bindData, data, 'IN', activeLegendView );
        bindData = updateInOutDegreeAttributesOnNode( node, bindData, data, 'OUT', activeLegendView );

        //update the bindings
        graphModel.graphControl.graph.updateNodeBinding( node, bindData );
    } );
};

/**
 * Validate if need to update the graph on filter applied/removed in Relations Legend
 *
 * @param {Object} graphModel graph model
 */
export let validateForUpdateGraphNodeDegree = function( graphModel ) {
    if( graphModel ) {
        const nodeModels = Object.values( graphModel.dataModel.nodeModels );
        var affectedNodeList = [];
        _.forEach( nodeModels, function( nodeModel ) {
            if( nodeModel.graphItem.isVisible() && !nodeModel.graphItem.isFiltered() ) {
                affectedNodeList.push( nodeModel.graphItem );
            }
        } );
        if( affectedNodeList.length > 0 ) {
            eventBus.publish( 'AMDiagram.updateGraphNodeDegree', {
                affectedNodeList: affectedNodeList
            } );
        }
    }
};

const exports = {
    updateGraphInfoOnNodes,
    validateForUpdateGraphNodeDegree
};
export default exports;
