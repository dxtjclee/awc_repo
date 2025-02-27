// Copyright (c) 2022 Siemens

/**
 * @module js/packSimilarElementsService
 */
import occmgmtUtils from 'js/occmgmtUtils';
import appCtxSvc from 'js/appCtxService';
import occmgmtStructureEditService from 'js/occmgmtStructureEditService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import acePartialSelectionService from 'js/acePartialSelectionService';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Get display mode using add elements service.
 */
export let getTreeOrListDisplayMode = function() {
    var viewModeInfo = appCtxSvc.ctx.ViewModeContext;
    if( viewModeInfo.ViewModeContext === 'TreeView' || viewModeInfo.ViewModeContext === 'TreeSummaryView' ) {
        return 'Tree';
    }
    return 'List';
};

/**
 * Get selections.
 */
export let getSelections = function( subPanelContext ) {
    if( subPanelContext.occContext.selectedModelObjects.length > 0 ) {
        var mselected = [];
        _.forEach( subPanelContext.occContext.selectedModelObjects, function( selected ) {
            if( acePartialSelectionService.isPartiallySelected( selected.uid ) ) {
                var visibleNodeUid = acePartialSelectionService.getVisibleNodeForHiddenNodeInPartialSelection( selected.uid );
                var visibleNode = cdm.getObject( visibleNodeUid );
                if( visibleNode ) {
                    mselected.push( visibleNode );
                }
            } else {
                mselected.push( selected );
            }
        } );
        return mselected;
    }
    return subPanelContext.occContext.selectedModelObjects;
};

/*
* Get the array of uids corresponding to selections
*/
export let getSelectedUids = function( commandContext ) {
    return occmgmtUtils.getSelectedObjectUids( commandContext.occContext.selectedModelObjects );
};

/*
* Get the array of uids corresponding to selections
*/
export let getSelectedUidsForUnpack = function( selectedModelObjects ) {
    return occmgmtUtils.getSelectedObjectUids( selectedModelObjects );
};

/**
 * Get packed elements from service data.
*/

export let getPackedElementsFromServiceData = function( deletedObj ) {
    if( deletedObj ) {
        var mselected = appCtxSvc.ctx.mselected.map( function( obj ) {
            return obj.uid;
        } );
        return _.intersection( deletedObj, mselected );
    }
};


/**
 * Get Pack Similar Elements Configuration Data
 */
export let getInitialPackSimilarElementsConfigurationData = function( productContextInfo ) {
    let packSimilarElementsValue = false;
    if( productContextInfo ) {
        if( productContextInfo && productContextInfo.props.awb0PackSimilarElements ) {
            var packSimilarElements = productContextInfo.props.awb0PackSimilarElements.dbValues[ 0 ];
            if( packSimilarElements ) {
                if( packSimilarElements === '1' ) {
                    packSimilarElementsValue = true;
                }
            }
        }
    }
    return packSimilarElementsValue;
};
var updateVmcLoadedObjectsAsPerAllChildren = function( parentInfo, allChildren, loadedViewModelObjects ) {
    // parent uid may also have changed
    for( var childIndex = 0; childIndex < allChildren.length; childIndex++ ) {
        occmgmtStructureEditService.updateNodeIfUidChanged( allChildren[ childIndex ], parentInfo, loadedViewModelObjects );
    }

    var parentVMO = occmgmtStructureEditService.getTreeNode( parentInfo, loadedViewModelObjects );
    var childsDeleted = [];
    if( parentVMO.children && parentVMO.children.length > 0 ) {
        var allChildrenStableIds = allChildren.map( function( obj ) {
            return obj.stableId;
        } );
        _.forEach( parentVMO.children, function( child ) {
            if( !allChildrenStableIds.includes( child.stableId ) ) {
                childsDeleted.push( child );
            }
        } );
    }

    _.forEach( childsDeleted, function( child ) {
        occmgmtStructureEditService.removeNode( child, parentInfo, loadedViewModelObjects, true );
    } );

    for( var childIndex = 0; childIndex < allChildren.length; childIndex++ ) {
        occmgmtStructureEditService.addChildNode( allChildren[ childIndex ], childIndex, parentInfo, loadedViewModelObjects );
    }

    acePartialSelectionService.restorePartialSelection();
};

export let postProcessPackUnpackResponse = function( parentChildrenInfos, occContext ) {
    var loadedViewModelObjects = occContext.vmc.getLoadedViewModelObjects();
    let VMOchanged = false;
    if( parentChildrenInfos && loadedViewModelObjects.length > 0 && occmgmtUtils.isTreeView() ) {
        _.forEach( parentChildrenInfos, function( parentChildrenInfo ) {
            // check parent itself is not hidden when multiselected and packed
            if( occmgmtStructureEditService.isNodePresentInTree( parentChildrenInfo.parentInfo, occContext.vmc ) ) {
                updateVmcLoadedObjectsAsPerAllChildren( parentChildrenInfo.parentInfo, parentChildrenInfo.childrenInfo, loadedViewModelObjects );
                VMOchanged = true;
            }
        } );
    }
    if( VMOchanged ) {
        occContext.treeDataProvider.update( loadedViewModelObjects );
        // remove hidden nodes
        acePartialSelectionService.removeHiddenNodesFromSelection( occContext );
    }

    //Call this event to perform tree pack/Unpack Successfully
    eventBus.publish( 'tree.packUnpackSuccessful', { } );
};

/**
 * packSimilarElementsCompletedAction to perform action after perform similarElements SOA response
 */

export let packSimilarElementsCompletedAction = function( response ) {
    let displayMode = getTreeOrListDisplayMode();
    // This event will only fire in tree view mode
    if( displayMode === 'Tree' ) {
        postProcessPackUnpackResponse( response.parentChildrenInfos, response.occContext );
    } else {
        //Currently these events(aceElementsDeSelectedEvent and acePwa.reset ) will get fired only in non-tree mode
        eventBus.publish( 'aceElementsDeSelectedEvent', {
            elementsToDeselect: getPackedElementsFromServiceData( response.deletedElements )
        } );
        eventBus.publish( 'acePwa.reset', {
            viewToReset: response.viewToReset
        } );
    }
};

/**
 * Pack Similar Elements Configuration service utility
 */

export default exports = {
    getTreeOrListDisplayMode,
    getSelections,
    getSelectedUids,
    getInitialPackSimilarElementsConfigurationData,
    postProcessPackUnpackResponse,
    getSelectedUidsForUnpack,
    packSimilarElementsCompletedAction,
    getPackedElementsFromServiceData
};
