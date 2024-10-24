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
 * This implements the graph hitTest.
 *
 * @module js/Ase1InterfaceGraphControlHitHandler
 */
import graphUtils from 'js/graphUtils';
import graphConstants from 'js/graphConstants';

/**
 * API to be called when the hit test on elements
 *
 * @param {Object} graphModel graph model
 * @param {Array} candidateItems candidate selection Sheet Element items
 * @param {Object} mousePosition mouse location point
 * @return {Object} HitTestHandle - it includes isHandle application handles the candidate or not, candidateElements, and cancel select
 */
export let onHitTest = function( graphModel, candidateItems, mousePosition ) {
    const hitTestHandle = {
        isHandled: false,
        candidateElements: candidateItems,
        cancel: false
    };

    if( graphModel.config.layout.layoutMode !== graphConstants.DFLayoutTypes.ColumnLayout ) {
        return hitTestHandle;
    }
    const length = candidateItems.length;
    const topHitTest = candidateItems[ length - 1 ];
    const itemType = topHitTest.getItemType();
    //hit test by shape
    if( itemType === 'Node' ) {
        if( topHitTest.model.systemType === 'SystemOfInterest' ) {
            const nodePos = {
                x: topHitTest.getAnchorPositionX() + 100,
                y: topHitTest.getAnchorPositionY() + 100
            };
            const graph = graphModel.graphControl.graph;
            const posOnView = graphUtils.pageToViewCoordinate( graph, mousePosition );
            const posOnSheet = graphUtils.viewToSheetCoordinate( graph, posOnView );
            const isHit = graphUtils.isPointInCircle( posOnSheet, nodePos, 100 );
            if( !isHit ) {
                hitTestHandle.candidateElements = [];
                hitTestHandle.isHandled = true;
                hitTestHandle.cancel = true;
            }
        }
    } else if( itemType === 'Label' ) {
        const owner = topHitTest.getOwner();
        const inputMode = graphModel.graphControl.getInputMode();
        //non authoring mode, if label is the top candidate and own node is candidate also, the node as the only one candidate.
        if( owner.getItemType() === 'Node' && !inputMode.editMode && length > 1 ) {
            const secondToLastItem = candidateItems[ length - 2 ];
            if( owner === secondToLastItem ) {
                hitTestHandle.candidateElements = [ secondToLastItem ];
                hitTestHandle.isHandled = true;
            }
        }
    }

    return hitTestHandle;
};

const exports = {
    onHitTest
};

export default exports;
