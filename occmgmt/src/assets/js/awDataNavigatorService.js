// Copyright (c) 2022 Siemens

/**
 * @module js/awDataNavigatorService
 */
import appCtxSvc from 'js/appCtxService';
import aceConfiguratorTabsEvaluationService from 'js/aceConfiguratorTabsEvaluationService';
import _ from 'lodash';
import Debug from 'debug';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import cdm from 'soa/kernel/clientDataModel';
import logger from 'js/logger';
import selectionService from 'js/selection.service';
import cadBomOccurrenceAlignmentSvc from 'js/CadBomOccurrenceAlignmentService';
import editHandlerSvc from 'js/editHandlerService';
import ctxStateMgmtService from 'js/contextStateMgmtService';
import occmgmtSublocationService from 'js/occmgmtSublocationService';
import occmgmtUpdatePwaDisplayService from 'js/occmgmtUpdatePwaDisplayService';
import { urlParamsMap } from 'js/occmgmtSublocationService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import acePartialSelectionService from 'js/acePartialSelectionService';
import awTableService from 'js/awTableService';
import aceStructureConfigurationService from 'js/aceStructureConfigurationService';
const trace = new Debug( 'selection' );

var exports = {};
export let initializeDataNavigator = function( data, subPanelContext, propContextKey ) {
    //TOCHECK : When key is present in subPanelContext, why are we re-populating it?
    const contextKey = propContextKey ? propContextKey : subPanelContext.provider.contextKey;

    appCtxSvc.registerCtx( 'objectQuotaContext', {
        useObjectQuota: true
    } );
    if( data && data.aceSearchPolicyOverride ) {
        appCtxSvc.registerCtx( 'aceSearchPolicyOverride', data.aceSearchPolicyOverride );
    }

    return {
        contextKey,
        alternateSelection: null
    };
};

export let destroyDataNavigator = function( data ) {
    appCtxSvc.unRegisterCtx( 'objectQuotaContext' );
    appCtxSvc.unRegisterCtx( 'isRedLineMode' );
    delete appCtxSvc.ctx[ 'ActiveWorkspace:xrtContext' ];
};

/**
    * @param {Object} newState - Changed param-value map
    *
    * @return {Boolean} true if there is any change compared to existing values
    */
function _haveTopParamsOrTheirValuesChanged( newState, previousState ) {
    var changed = false;

    _.forEach( newState, function( value, name ) {
        /**
            * Check if we don't care about this parameter.
            */
        if( name !== 't_uid' || name === 'uid' ) {
            return true;
        }

        if(
            !previousState || !previousState.hasOwnProperty( name ) ||
               previousState[ name ] !== value ) {
            changed = true;
            return false;
        }
    } );

    return changed;
} // _haveTopParamsOrTheirValuesChanged

/**
    * @param {Object} newState - changed param-value map
    *
    * @return {Boolean} true if there is any change compared to existing values
    */
function _havePwaParamsOrTheirValuesChanged( newState, subPanelContext, previousState ) {
    var changed = false;

    _.forEach( newState, function( value, name ) {
        /**
            * Check if we don't care about this parameter. Eventually, we want to stop reload via currentState route.
            * Setting atomic data with pwaReset to true should be the way forward.
            *
            * Long term :
            * 1) Stop listening to currentState update in awDataNavigatorViewModel.json
            * 2) Reload call in syncPWASelection call.
            * 3) Looking for URL param updates for reload decision
            * 4) Let applications directly say that they want to reset.
            */
        if( name === 'page' || name === 'pageId' || name === urlParamsMap.selectionQueryParamKey ||
               name === 'pci_uid' || name === 'spageId' || name === 'incontext_uid' || name === 'filter' || name === 'uid' ) {
            return true;
        }

        /**
            * We don't care about o_uid changes when we are in tree viewMode.
            */
        // revisitMe - viewConfig will not be available on subPanelContext (It was done by aw.nav.controller - which is no more applicable)
        if( name === 'o_uid' ) { // && subPanelContext.viewConfig.view === 'tree' ) {
            return true;
        }

        if( !previousState || !previousState.hasOwnProperty( name ) ||
               previousState[ name ] !== value ) {
            changed = true;
            return false;
        }
    } );

    return changed;
} //_havePwaParamsOrTheirValuesChanged

function _isValidToRetrievePCIFromHierarchy( parentObject, selectedObject ) {
    var remoteSubsetSelected = false;
    var isObjectBOMWorkset = false;
    if( parentObject && parentObject.props && parentObject.props.awb0UnderlyingObject ) {
        var underlyingObjUid = parentObject.props.awb0UnderlyingObject.dbValues[ 0 ];
        var modelObjForUnderlyingObj = cdm.getObject( underlyingObjUid );
        if( modelObjForUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
            isObjectBOMWorkset = true;
            if( selectedObject && selectedObject.props && selectedObject.props.awb0ArchetypeId && selectedObject.props.awb0ArchetypeId.dbValues[ 0 ] === '' ) {
                remoteSubsetSelected = true;
            }
        }
    }
    return remoteSubsetSelected || !isObjectBOMWorkset;
} // _isValidToRetrievePCIFromHierarchy

var reloadPrimaryWorkArea = function( newState, subPanelContext, previousState, pwaSelectionModel ) {
    if( occmgmtUtils.isTreeView() && _haveTopParamsOrTheirValuesChanged( newState, previousState ) ) {
        resetPwaContents( pwaSelectionModel );
    } else if( _havePwaParamsOrTheirValuesChanged( newState, subPanelContext, previousState ) ) {
        resetPwaContents( pwaSelectionModel );
    }
};

export let getParentUid = function( view, currentState ) {
    if( view === 'tree' ) {
        return currentState.t_uid;
    }
    return currentState.o_uid;
};

/**
    * Ensure the correct object is selected
    *
    * @param {String} uidToSelect - The uid of the object that should be selected
    */
let updatePWASelection = function( subPanelContext, uidToSelect, pwaSelectionModel ) {
    let contextKey = subPanelContext.contextKey;
    let newSelection = [];
    let currentSelection = pwaSelectionModel.getSelection();
    let currentState = subPanelContext.occContext.currentState;
    /*Control comes to this function when we update current state. From different flows like select on open, select on cross select,
       select on pwa selection. When currentState is updated by some source to update selection ( source like breadcrumb ),
       this API updates pwaSelection for us. But when user select in pwa itself, this call is redundant as selection is already present
       in selection model. But control comes here as we update currentState to keep state in sync. We should do nothing if selection present */
    if( !_.isEmpty( currentSelection ) && currentSelection.indexOf( uidToSelect ) !== -1 ) {
        return;
    }

    //If multi select is enabled ignore single select changes
    if( uidToSelect && ( pwaSelectionModel.getCurrentSelectedCount() < 2 || currentState.o_uid !== currentState.c_uid ) ) {
        let parentUid = getParentUid(  'tree', currentState  );
        if( ( occmgmtUtils.isTreeView() || occmgmtUtils.isResourceView() ) && uidToSelect === parentUid  && subPanelContext.occContext.showTopNode ) {
            /*TODO : after standard sub-location adoption, base-selection is broken.
                 Commenting this. It will affect Port selection from Architecture tab (need to check flow in new world)
                 */
            newSelection = []; //[ uidToSelect ];
        } else if( uidToSelect === parentUid &&
                 ( pwaSelectionModel.getCurrentSelectedCount() < 2 && !pwaSelectionModel.isMultiSelectionEnabled() ) ) {
            //Ensure the base selection is the only selection
            newSelection = [];
        } else {
            //set new selection if markUpEnabled and not in multiselect.
            //Add new uid to selection if more than one selectedobjects
            if( uidToSelect !== parentUid ) {
                if( pwaSelectionModel.getCurrentSelectedCount() > 1 || pwaSelectionModel.isMultiSelectionEnabled() ) {
                    pwaSelectionModel.addToSelection( [ uidToSelect ] );
                    return;
                }
                newSelection = [ uidToSelect ];
            }
        }
    }


    if( !_.isEqual( currentSelection, newSelection ) ) {
        var newSelections = newSelection.map( function( selectedUid ) {
            return cdm.getObject( selectedUid );
        } );
        pwaSelectionModel.setSelection( newSelection );
        //pwaSelectionModel.selectionData.update( { selected: newSelections } );
    }
};

export let syncContextWithPWASelection = function( eventData, subPanelContext, contextKey, pwaSelectionModel ) {
    var newState;
    var previousState;
    if( eventData ) {
        newState = eventData.value[ contextKey ].currentState;
        previousState = eventData.value[ contextKey ].previousState;
    } else {
        newState = subPanelContext.occContext.currentState;
        previousState = subPanelContext.occContext.previousState;
    }
    //Tree will be loaded by dataProvider on 1st load. No need to force reload PWA. It triggers multiple SOA calls.
    if( _.isEmpty( previousState ) ) {
        return;
    }
    reloadPrimaryWorkArea( newState, subPanelContext, previousState, pwaSelectionModel );
    if( newState.hasOwnProperty( urlParamsMap.selectionQueryParamKey ) ) {
        updatePWASelection( subPanelContext, newState[ urlParamsMap.selectionQueryParamKey ], pwaSelectionModel );
    }
};

export let syncRootElementInfoForProvidedSelection = function( productInfo, subPanelContext ) {
    if( productInfo && productInfo.rootElement ) {
        var currentRootElement = subPanelContext.occContext.rootElement;
        if( !currentRootElement || currentRootElement.uid !== productInfo.rootElement.uid ) {
            appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.rootElement', productInfo.rootElement );
        }
    }
};

/**
    * @param {Object} selectedObject Object representing selection made by the user
    * @param {Object} occContext Object representing ACE atomic data
    *
    * @return {Object} Uid of the productContext corresponding to the selected object if it is available in
    *         the elementToPCIMap; the productContext from the URL otherwise and rootElement for current selected object.
    */
export let getProductInfoForCurrentSelection = function( selectedObject, occContext ) {
    //Default productInfo is current info
    let productInfo = {
        newPci_uid: _getDefaultProductContextInfo( selectedObject, occContext )
    };
    let elementToPCIMap = occContext.elementToPCIMap;

    if( elementToPCIMap ) {
        var parentObject = selectedObject;
        do {
            if( parentObject && elementToPCIMap[ parentObject.uid ] ) {
                productInfo.rootElement = parentObject;
                productInfo.newPci_uid = elementToPCIMap[ parentObject.uid ];

                return productInfo;
            }

            var parentUid = occmgmtUtils.getParentUid( parentObject );
            parentObject = cdm.getObject( parentUid );
        } while( parentObject && _isValidToRetrievePCIFromHierarchy( parentObject, selectedObject ) );
    } else {
        productInfo.rootElement = occContext.topElement;
    }

    return productInfo;
};

/**
    * @param {Object} selectedObject Object representing selection made by the user
    * @param {Object} occContext Object representing ACE atomic data
    *
    * @return {Object} Uid of the productContext corresponding to the selected object if it is available in
    *         the elementToPCIMap; the productContext from the URL otherwise and rootElement for current selected object.
    */
function _getDefaultProductContextInfo( selectedObject, occContext ) {
    let pci_uid = occContext.currentState.pci_uid;
    if( selectedObject && selectedObject.props && selectedObject.props && selectedObject.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1 ) {
        for( var k in occContext.elementToPCIMap ) {
            let pci = occContext.elementToPCIMap[ k ];
            let pciObject = cdm.getObject( pci );
            if( pciObject ) {
                let productObject = cdm.getObject( pciObject.props.awb0Product.dbValues[ 0 ] );
                if( productObject && productObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                    pci_uid = pci;
                    break;
                }
            }
        }
    }
    return pci_uid;
}

export let populateVisibleServerCommands = function( data, occContext ) {
    let currentSelection;
    if( occContext.selectedModelObjects && occContext.selectedModelObjects.length > 0 ) {
        currentSelection = occContext.selectedModelObjects[ 0 ].uid;
    }
    let SoaSelection = _.get( data.soaInput.getVisibleCommandsInfo[ 0 ].selectionInfo.filter( function( selection ) {
        return selection.parentSelectionIndex === 1;
    } )[ 0 ], 'selectedObjects.0.uid' );
    if( currentSelection === SoaSelection ) {
        appCtxSvc.updatePartialCtx( occContext.viewKey + '.visibleServerCommands', data.visibleCommandsInfo );
    }
};

export const updatePwaContextInformation = ( data, subPanelContext, pwaSelectionModel ) => {
    const alternateSelection = subPanelContext.occContext.baseModelObject;
    let currentContext = appCtxSvc.getCtx( subPanelContext.occContext.viewKey );
    // ToDo - Remove below line once selectedModelObjects is removed from appCtx
    if( hasSelectionsChanged( subPanelContext.occContext.selectedModelObjects, currentContext.selectedModelObjects )  ) {
        appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.selectedModelObjects', subPanelContext.occContext.selectedModelObjects );
    }
    //Caller should clearly inform which object to select to avoid any ambiguity
    onPWASelectionChange( data, subPanelContext, data.contextKey, {
        source: 'server',
        selected : subPanelContext.occContext.selectedModelObjects
    }, pwaSelectionModel, null, subPanelContext.occContext.lastDpAction );
    return alternateSelection;
};

export const addUpdatedSelectionToPWA = ( data, eventData, contextKey, selectionModel, subPanelContext ) => {
    let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReact ) {
        let selectionsToModify = {
            elementsToSelect: eventData.objectsToSelect,
            overwriteSelections: true,
            nodeToExpandAfterFocus: eventData.nodeToExpandAfterFocus
        };

        modifyPwaSelections( selectionModel, subPanelContext.occContext, selectionsToModify );
        //Select the objects provided by the event
        if( eventData.objectsToHighlight ) {
            let gridId;
            if( subPanelContext.provider ) {
                gridId  =  subPanelContext.provider.gridId;
            }
            acePartialSelectionService.setPartialSelection( eventData.objectsToSelect, eventData.objectsToHighlight, gridId );
            onPWASelectionChange( data, subPanelContext, contextKey, {
                source: 'server',
                selected : eventData.objectsToSelect
            }, selectionModel, undefined, 'selectNonPackMaster' );
        }
    }
};

export const removeSelectionFromPWA = ( eventData, contextKey, subPanelContext, occContext, alternateSelection ) => {
    if( eventData.elementsToDeselect && eventData.elementsToDeselect.length > 0 ) {
        let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
        if( contextKey === viewToReact ) {
            // Update selections by removing elements to deselect from current selections
            let occContextValue = { ...occContext.getValue() };
            let newSelection = _.clone( occContextValue.selectedModelObjects );
            for( let i = 0; i < eventData.elementsToDeselect.length; i++ ) {
                newSelection.splice( newSelection.indexOf( eventData.elementsToDeselect[i], 1 ) );
            }
            if( _.isEmpty( newSelection ) ) {
                // If all selections are removed, then default to topElement
                newSelection = [ occContextValue.topElement ];
            }
            _processSelectionChange( occContextValue, newSelection, subPanelContext, alternateSelection );
        }
    }
};

export const addSelectionToPWA = ( eventData, contextKey, selectionModel, occContext ) => {
    let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReact ) {
        let selectionsToModify = {
            elementsToSelect: eventData.elementsToSelect,
            overwriteSelections: eventData.overwriteSelections,
            nodeToExpandAfterFocus: eventData.nodeToExpandAfterFocus
        };
        modifyPwaSelections( selectionModel, occContext, selectionsToModify );
    }
};

export const modifyPwaSelections = ( selectionModel, occContext, selectionsToModify ) => {
    let occContextValue = { ...occContext.value };

    selectionsToModify = selectionsToModify ? selectionsToModify : occContextValue.selectionsToModify;

    if( !_.isEmpty( selectionsToModify.elementsToSelect ) || _.isEqual( selectionsToModify.overwriteSelections, true ) ) {
        let lastSelected = _.last( selectionsToModify.elementsToSelect );
        let overwriteWithEmptySelections = _.isEmpty( selectionsToModify.elementsToSelect ) && selectionsToModify.overwriteSelections;

        occContextValue.selectionSyncInProgress = selectionsToModify.elementsToSelect.length > 1;

        if( selectionsToModify.nodeToExpandAfterFocus ) {
            occContextValue.transientRequestPref.nodeToExpandAfterFocus = selectionsToModify.nodeToExpandAfterFocus;
        }
        if( selectionsToModify.overwriteSelections ) {
            selectionModel.setSelection( selectionsToModify.elementsToSelect );
        } else {
            if( selectionModel.getCurrentSelectedCount() > 1 || selectionModel.multiSelectEnabled ) {
                selectionModel.addToSelection( selectionsToModify.elementsToSelect );
            } else {
                selectionModel.setSelection( selectionsToModify.elementsToSelect );
            }
        }

        if( occContextValue.selectionSyncInProgress ) {
            occContextValue.elementsToCrossSelect = selectionsToModify.elementsToSelect;
        }
        occContextValue.selectionsToModify = {};

        //We cannot have empty c_uid in session. I see this deletion of c_uid was promoted for compare long back
        //Compare is using this in wrong way. they should use elementsToDeselect structure instead.
        if( overwriteWithEmptySelections ) {
            occContextValue.currentState.c_uid = occContextValue.currentState.t_uid;
            occContextValue.currentState.o_uid = occContextValue.currentState.t_uid;
            //_processSelectionChange( occContextValue, [occContext.topElement], subPanelContext, occContext.baseModelObject );
        } else {
            occContextValue.currentState.c_uid = lastSelected.uid;
        }
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    }
    if( !_.isEmpty( selectionsToModify.elementsToDeselect ) || _.isEqual( selectionsToModify.clearExistingSelections, true ) ) {
        var selectionsToClear = selectionsToModify.elementsToDeselect ? selectionsToModify.elementsToDeselect : selectionModel.getSelection();
        selectionModel.removeFromSelection( selectionsToClear );

        occContextValue.selectionsToModify = {};
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    }
};

/**
 * Get the XRTContext based on newly selected object
 * @param {*} subPanelContext subPanelContext
 * @param {*} selectedModelObject Newly selected object
 * @returns XRTContext with updated PCI information
 */
function _getXRTContextForPrimarySelection( subPanelContext, selectedModelObject ) {
    let xrtContext = subPanelContext.occContext.xrtContext;

    if( !xrtContext ) {
        xrtContext = {};
    }
    if( subPanelContext.occContext.productContextInfo ) {
        xrtContext.productContextUid = subPanelContext.occContext.productContextInfo.uid;
    }
    xrtContext.selectedUid = selectedModelObject.uid;

    return xrtContext;
}

export let onPWASelectionChange = function( data, subPanelContext, contextKey, selectionData, pwaSelectionModel, parentSelectionData, lastDpAction ) {
    if( selectionData ) {
        let selectedObjs = undefined;
        let nodeToExpandAfterFocus = subPanelContext.occContext.transientRequestPref.nodeToExpandAfterFocus;
        let occContextValue = { ...subPanelContext.occContext.getValue() };
        if( selectionData.source === 'primary' ) {
            selectedObjs = _processSelectionChange( occContextValue, selectionData.selected, subPanelContext, data.alternateSelection );
            aceConfiguratorTabsEvaluationService.evaluateConfiguratorTabsVisibility( selectedObjs, occContextValue );
        } else if( selectionData.source === 'base' || selectionData.source === undefined  ) {
            /*1) selection can be 'base' only when nothing is selected in PWA
               2) for Workset-Subset case, framework is updating selection change with source as 'base' even though there is
               selection in PWA
               3) This is incorrect call and should be ignored. Need to take this up with framework as to why this is coming.
               */
            let pwaSelectionEmpty = _.isEmpty( pwaSelectionModel.getSelection() );
            //let pwaSelectionIsSameAsBaseSel = !pwaSelectionEmpty && _.isEqual( pwaSelectionModel.getSelection()[0], selectionData.selected[0].uid );

            if( pwaSelectionEmpty ) {
                let topElement = occContextValue.topElement;
                let selected = selectionData.selected && selectionData.selected[ 0 ] ? selectionData.selected : topElement && [ topElement ];
                if( selected !== undefined ) {
                    selectedObjs = _processSelectionChange( occContextValue, selected, subPanelContext, data.alternateSelection );
                    aceConfiguratorTabsEvaluationService.evaluateConfiguratorTabsVisibility( selectedObjs, occContextValue );
                }
            }
        } else if( selectionData.source === 'server' ) {
            if( lastDpAction === 'loadAndSelect' || lastDpAction === 'focusAction' ) {
                selectionData.retainExistingSelsInMSMode = true;
            }
            processSelectionFromServer( pwaSelectionModel, subPanelContext, occContextValue, selectionData, lastDpAction );
            if( lastDpAction === 'loadAndSelect' ) {
                //XRTContext update and URL currentState update already done in processSelectionFromServer, so passing false for last 2 parameters
                updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext, false, false );
            }
            let currentSelection = pwaSelectionModel.selectionData.selected ? pwaSelectionModel.selectionData.selected : appCtxSvc.getCtx().mselected;
            if( lastDpAction === 'initializeActionWithWindowReuse' && !hasSelectionsChanged( currentSelection, selectionData.selected )  ) {
                var eventData = {};
                eventData.refreshLocationFlag = true;
                eventData.relations = '';
                eventData.forceReloadAceSWA = true;
                eventData.relatedModified = [];
                eventData.relatedModified[0] = occContextValue.selectedModelObjects[0];
                eventBus.publish( 'cdm.relatedModified', eventData );
            }
        } else if( selectionData.source === 'secondary' ) {
            updateSecondarySelection( selectionData.selected, selectionData.relationInfo, subPanelContext.occContext.selectedModelObjects, data.alternateSelection );
        }
        if( nodeToExpandAfterFocus ) {
            eventBus.publish( subPanelContext.occContext.vmc.name + '.expandTreeNode', {
                parentNode: {
                    id: nodeToExpandAfterFocus
                }
            } );
        }
        parentSelectionData && parentSelectionData.update( selectionData );
        trace( 'AwDataNavigator selectionData: ', selectionData );
    } else {
        selectionService.updateSelection( [ data.alternateSelection ] );
    }
};

let updatePrimarySelection = function( occContextValue, parentSelection, subPanelContext ) {
    /**
        * LCS-174734: When we get a selection from the 'primaryWorkArea' we assume the processing
        * is complete and it is OK to start sending selections back to the host.
        */
    if( appCtxSvc.getCtx( 'aw_hosting_enabled' ) ) {
        appCtxSvc.updatePartialCtx( 'aw_hosting_state.ignoreSelection', false );
        let selectionSentFromHost = appCtxSvc.getCtx( 'aw_selection_sent_from_host' );
        // NOTE: As hosts like NX and TcVis support opening of Session. It is important to make sure that alignment be checked only if the
        // selected object is a Facade object. Selections like Fnd0AppSession are not facade and do not have backing object.
        let isFacadeObjectSelected = occContextValue.selectedModelObjects && occContextValue.selectedModelObjects.length > 0
                                && occContextValue.selectedModelObjects[0].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1;
        //check for aligned lines if hosting is enabled
        if( ( appCtxSvc.ctx.aw_host_type === 'NX' || appCtxSvc.ctx.aw_host_type === 'TcIC' ) && !selectionSentFromHost && isFacadeObjectSelected ) {
            cadBomOccurrenceAlignmentSvc.getAlignedDesigns( occContextValue.selectedModelObjects, appCtxSvc.ctx.aw_host_type ).then( function() {
                updateSelectionIfApplicable( occContextValue.selectedModelObjects, parentSelection, subPanelContext.contextKey );
                if( !_.isEqual( occContextValue.selectedModelObjects, subPanelContext.occContext.selectedModelObjects ) ) {
                    updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext );
                }
            } );
            return;
        }
        appCtxSvc.registerPartialCtx( 'aw_selection_sent_from_host', false );
    }

    //If selection is empty revert to base selection
    updateSelectionIfApplicable( occContextValue.selectedModelObjects, parentSelection, subPanelContext.contextKey );
    let hasPCIChanged = !_.isEqual( occContextValue.productContextInfo.uid, subPanelContext.occContext.productContextInfo.uid );
    if( !_.isEqual( occContextValue.selectedModelObjects, subPanelContext.occContext.selectedModelObjects ) || hasPCIChanged  ) {
        updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext );
    }else if( !_.isEqual( occContextValue.pwaSelectionSource, subPanelContext.occContext.pwaSelectionSource ) ) {
        //If user de-select top node and selection goes to base-selection ( or vice versa), there is no selection change but source changes
        occmgmtUtils.updateValueOnCtxOrState( 'pwaSelectionSource', occContextValue.pwaSelectionSource, subPanelContext.occContext );
    }
};

let updateSecondarySelection = function( selection, relationInfo, selectedModelObjects, parentSelection ) {
    //If everything was deselected
    if( !selection || selection.length === 0 ) {
        //Revert to the previous selection (primary workarea)
        selectionService.updateSelection( selectedModelObjects, parentSelection );
    } else {
        //Update the current selection with primary workarea selection as parent
        //Check for valid BusinessObject
       let selectedModelObject = selection[0].modelType && selection[0].modelType.typeHierarchyArray.indexOf( 'BusinessObject' ) > -1 ? selectedModelObjects[ 0 ] : selection[0];
       selectionService.updateSelection( selection, selectedModelObject, relationInfo );   
    }
};

var _cleanDeletedObjectFromChildrenStructure = function( parentObject, deletedObjectUid ) {
    let hasChildrenCountChanged = false;
    if( parentObject && parentObject.children && parentObject.children.length ) {
        _.remove( parentObject.children, function( childVmo ) {
            return childVmo.uid === deletedObjectUid;
        } );
        hasChildrenCountChanged = parentObject.totalChildCount !== parentObject.children.length;
        parentObject.totalChildCount = parentObject.children.length;
    }

    return hasChildrenCountChanged === true ? 1 : 0;
};

var updateParentVmoOfDeleted = function( deletedVmo, vmc ) {
    let parentObject = undefined;
    if( vmc ) {
        let parentObjectUid = occmgmtUtils.getParentUid( deletedVmo );
        let parentVmoNdx = vmc.findViewModelObjectById( parentObjectUid );
        parentObject = vmc.getViewModelObject( parentVmoNdx );
        _cleanDeletedObjectFromChildrenStructure( parentObject, deletedVmo.uid );
    }
};

export const removeObjectsFromCollection = ( eventData, subPanelContext ) => {
    if( eventData && eventData.deletedObjectUids && eventData.deletedObjectUids.length > 0 ) {
        let vmc = subPanelContext.occContext.vmc;
        let treeDataProvider = subPanelContext.occContext.treeDataProvider;
        if( treeDataProvider ) {
            let needsUpdatesOnCollection = false;
            let loadedVMOs = vmc.getLoadedViewModelObjects();
            let deletedNodes = 0;

            _.forEach( eventData.deletedObjectUids, function( deletedObjectUid ) {
                _.forEach( loadedVMOs, function( vmo ) {
                    if( vmo && deletedObjectUid === vmo.uid ) {
                        if( vmo.isExpanded ) {
                            occmgmtUpdatePwaDisplayService.purgeExpandedNode( vmo, loadedVMOs );
                        }
                        //Update the parent VMO of deleted uids to reflect the correct children properties ( Drag-Drop, cut, remove)
                        updateParentVmoOfDeleted( vmo, vmc );
                        needsUpdatesOnCollection = true;
                    } else {
                        deletedNodes += _cleanDeletedObjectFromChildrenStructure( vmo, deletedObjectUid );
                    }
                } );
            } );

            if( ( needsUpdatesOnCollection || deletedNodes ) && treeDataProvider ) {
                var collectionToUpdatedOnProvier = vmc.getLoadedViewModelObjects();
                treeDataProvider.update( collectionToUpdatedOnProvier );
            }
        }

        //kulkaamo: Event is already listened to by both views. As we are using contextKey now, this is not needed.
        // var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
        // if( inactiveView ) {
        //     if( occmgmtSplitViewUpdateService.isConfigSameInBothViews() &&  appCtxSvc.ctx[ inactiveView ].vmc && appCtxSvc.ctx[ inactiveView ].treeDataProvider ) {
        //         updateVMCforDeletedNodes( eventData, appCtxSvc.ctx[ inactiveView ].vmc, appCtxSvc.ctx[ inactiveView ].treeDataProvider );
        //     }
        // }

        let elementToPCIMap = subPanelContext.occContext.elementToPCIMap;
        if( elementToPCIMap ) {
            var elementUidsInElementToPCIMap = Object.keys( elementToPCIMap );
            var keysToRemoveFromElementToPciMap = _.intersection(
                elementUidsInElementToPCIMap, eventData.deletedObjectUids );

            if( keysToRemoveFromElementToPciMap.length ) {
                _.forEach( keysToRemoveFromElementToPciMap, function( keyToRemoveFromElementToPciMap ) {
                    delete elementToPCIMap[ keyToRemoveFromElementToPciMap ];
                } );

                var elementsInElementToPCIMap = Object.keys( elementToPCIMap );
                //TODO - Below code will be removed once we cleanup usages of elementToPCIMap on global context
                appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.elementToPCIMap', elementToPCIMap );

                let occContextValue = { ...subPanelContext.occContext.value };
                occContextValue.elementToPCIMap = elementToPCIMap;
                occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, subPanelContext.occContext );
            }
        }
    }
};

export const updateActiveWindow = ( eventData, data, subPanelContext, selectionData, pwaSelectionModel ) => {
    if( appCtxSvc.ctx.aceActiveContext.key !== eventData.key && eventData.key === data.contextKey ) {
        ctxStateMgmtService.updateActiveContext( eventData.key );
        onPWASelectionChange( data, subPanelContext, data.contextKey, selectionData, pwaSelectionModel );
    }
};

export const resetDataNavigator = ( eventData, contextKey, selectionModel ) => {
    var viewToReset = eventData && eventData.viewToReset ? eventData.viewToReset : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReset ) {
        let currentContext = appCtxSvc.getCtx( contextKey );
        if( currentContext ) {
            if( occmgmtUtils.isTreeView() && eventData && eventData.retainTreeExpansionStates === false && currentContext.vmc ) {
                eventBus.publish( currentContext.vmc.name + '.resetState' );
            }
            currentContext.silentReload = eventData ? eventData.silentReload : false;
        }
        //TODO: reset self dp
        const dp = selectionModel.getDpListener();
        if( dp ) {
            //dp.selectNone();
            dp.resetDataProvider();
        }
    }
};


export const resetTreeDataProvider = ( inputOccContext, occContext ) => {
    let transientRequestPref = inputOccContext.transientRequestPref;
    if( !_.isEmpty( transientRequestPref ) && transientRequestPref.retainTreeExpansionStates === false ) {
        eventBus.publish( occContext.vmc.name + '.resetState' );
    }
    if( editHandlerSvc.editInProgress().editInProgress ) {
        editHandlerSvc.leaveConfirmation().then( function() {
            if( !_.isEmpty( inputOccContext.configContext ) ) {
                aceStructureConfigurationService.resetTreeOnConfigChange( inputOccContext, occContext );
            } else {
                occmgmtUtils.resetTreeDisplayWithProvidedInput( '', inputOccContext, occContext );
            }
        } );
    } else {
        if( !_.isEmpty( inputOccContext.configContext ) ) {
            aceStructureConfigurationService.resetTreeOnConfigChange( inputOccContext, occContext );
        } else {
            occmgmtUtils.resetTreeDisplayWithProvidedInput( '', inputOccContext, occContext );
        }
    }
};

export const resetPwaContents = ( selectionModel ) => {
    const dp = selectionModel.getDpListener();
    if( dp && editHandlerSvc.editInProgress().editInProgress ) {
        editHandlerSvc.leaveConfirmation().then( function() {
            dp.resetDataProvider();
        } );
    } else if( dp ) {
        dp.resetDataProvider();
    }
};

export const expandNodeForExpandBelow = ( subPanelContext ) => {
    let vmc = subPanelContext.occContext.vmc;
    let loadedVMOs = vmc.getLoadedViewModelObjects();
    let vmoId = vmc.findViewModelObjectById( subPanelContext.occContext.transientRequestPref.scopeForExpandBelow );
    let vmoForExpandBelow = loadedVMOs[ vmoId ];
    vmoForExpandBelow.isExpanded = false;

    eventBus.publish( subPanelContext.occContext.vmc.name + '.expandTreeNode', {
        parentNode: {
            id: vmoForExpandBelow.id
        }
    } );
};

export const selectActionForPWA = ( selectionModel, eventData ) => {
    const dp = selectionModel.getDpListener();
    if( dp ) {
        if( eventData.selectAll ) {
            dp.selectAll();
        } else {
            dp.selectNone();
        }
    }
};

export const setShowCheckBoxValue = ( eventData ) => {
    return eventData.multiSelect;
};

export const multiSelectActionForPWA = ( selectionModel, eventData ) => {
    const dp = selectionModel.getDpListener();
    if( dp ) {
        dp.selectionModel.setMultiSelectionEnabled( eventData.multiSelect );
        return eventData.multiSelect;
    }
    return false;
};

export const handleHostingOccSelectionChange = ( data, eventData, selectionModel, contextKey, subPanelContext ) => {
    if( eventData.objectsToSelect ) {
        if( eventData.operation === 'replace' ) {
            if( eventData.objectsToSelect.length < 2 ) {
                selectionModel.setMultiSelectionEnabled(false);
            }
            // Check to make sure the selection has changed
            var newSelection = true;
            for( var i = 0; i < eventData.objectsToSelect.length; i++ ) {
                if( selectionModel.isSelected( eventData.objectsToSelect[ i ] ) ) {
                    newSelection = false;
                    break;
                }
            }

            if( newSelection ) {
                /**
                  * LCS-174734: When we get a selection request from a host we want to stop sending
                  * that 'host' any selections from this 'client' until this selection is reflected
                  * in the 'primaryWorkArea'.
                  */
                appCtxSvc.registerPartialCtx( 'aw_hosting_state.ignoreSelection', true) ;
                appCtxSvc.registerPartialCtx( 'aw_selection_sent_from_host', true );
            }
            addUpdatedSelectionToPWA( data, eventData, contextKey, selectionModel, subPanelContext );
        } else if( eventData.operation === 'add' ) {
            let selectionsToModify = {
                elementsToSelect: eventData.objectsToSelect
            };
            modifyPwaSelections( selectionModel, subPanelContext.occContext, selectionsToModify );
        } else {
            /**
              * Note: This default case is required to keep some non-hosting use of this hosting
              * event. This default case will be removed once those uses are moved over to use
              * another way to handle their selection.
            */
            addUpdatedSelectionToPWA( data, eventData, contextKey, selectionModel, subPanelContext );
        }
    }
};

const updateSelectionIfApplicable = ( selection, parentSelection, contextKey ) => {
    let currentContext = appCtxSvc.getCtx( contextKey );
    if( !currentContext.silentReload && appCtxSvc.ctx.aceActiveContext.key === contextKey ) {
        selectionService.updateSelection( selection, parentSelection );
    } else {
        delete currentContext.silentReload;
    }
};

const updateOccContextAndNotifyProductChangeIfApplicable = function( occContextValue, subPanelContext, shouldUpdateXRTContext = true, shouldUpdateURL = true ) {
    let occContext = subPanelContext.occContext;
    let ctxValuesToUpdate = {
        selectedModelObjects: occContextValue.selectedModelObjects,
        currentState: occContextValue.currentState
    };

    let isProductChanged = !_.isEqual( occContext.value.productContextInfo, occContextValue.productContextInfo );

    let currentContext = appCtxSvc.getCtx( subPanelContext.provider.contextKey );
    if( !_.isEqual( occContextValue.productContextInfo, currentContext.productContextInfo ) ) {
        ctxValuesToUpdate.productContextInfo = occContextValue.productContextInfo;
        ctxValuesToUpdate.rootElement = occContextValue.rootElement;
        isProductChanged =  true;
    }
    if( shouldUpdateXRTContext ) {
        occContextValue.xrtContext = _getXRTContextForPrimarySelection( subPanelContext, occContextValue.selectedModelObjects[ 0 ] );
    }

    if( shouldUpdateURL ) {
        occmgmtSublocationService.updateUrlFromCurrentState( subPanelContext.provider, occContextValue.currentState );
    }

    let _occContextDiff = {};
    let _targetValue = occContext.value;
    for( const item in occContextValue ) {
        if( _targetValue.hasOwnProperty( item ) ) {
            if( !_.isEqual( occContextValue[ item ], _targetValue[ item ] ) ) {
                _occContextDiff[ item ] = occContextValue[ item ];
            }
        }else{
            _occContextDiff[ item ] = occContextValue[ item ];
        }
    }

    if( _targetValue.selectionSyncInProgress ) {
        _occContextDiff.selectionSyncInProgress = false;
        _occContextDiff.elementsToCrossSelect = {};
    }

    if( _.keys( _occContextDiff ).length > 0 ) {
        occmgmtUtils.updateValueOnCtxOrState( '', _occContextDiff, occContext );
    }
    occmgmtUtils.updateValueOnCtxOrState( '', ctxValuesToUpdate, occContext.viewKey );

    if( isProductChanged ) {
        let occDataLoadedEventData = {
            dataProviderActionType: 'productChangedOnSelectionChange'
        };
        eventBus.publish( 'occDataLoadedEvent', occDataLoadedEventData );
        let productChangedEventData = {
            newProductContextUID: occContextValue.productContextInfo.uid
        };
        eventBus.publish( 'ace.productChangedEvent', productChangedEventData );
    }
};

const occUpdateStateForSelection = function( occContextValue, subPanelContext ) {
    let selectedObjs = occContextValue.selectedModelObjects;
    if( selectedObjs.length > 0 ) {
        /**
            * Attempt to locate the single selection object
            */
        var selObj = selectedObjs[ selectedObjs.length - 1 ];

        if( selObj ) {
            /**
                * Set the 'o_uid' to the selected object's immediate parent if one exists
                */
            var parentUid = occmgmtUtils.getParentUid( selObj );
            if( parentUid ) {
                occContextValue.currentState.o_uid = parentUid;
                occContextValue.openedElement = cdm.getObject( parentUid );
            } else {
                occContextValue.currentState.o_uid = selObj.uid;
                occContextValue.openedElement = cdm.getObject( selObj.uid );
            }
        }
    }
    let currentOccContext = subPanelContext.occContext;
    _syncRootElementAndPCIOnSelectionChange( occContextValue, currentOccContext );
};

function _processSelectionChange( occContextValue, selected, subPanelContext, alternateSelection ) {
    let pwaSelectionSource = 'primary';
    let selectedObjs = occContextValue.selectionSyncInProgress ? occContextValue.elementsToCrossSelect : selected.map( function( obj ) {
        if ( !occContextValue.elementsToCrossSelect && !awTableService.isViewModelTreeNode( obj ) ) { pwaSelectionSource = 'base'; }
        return cdm.getObject( obj.uid );
    } ).filter( function( mo, idx ) {
        if ( !mo ) {
            logger.error( selected[idx].uid + ' was selected but is not in CDM!' );
        }
        return mo;
    } );

    // update the partial selection on removed selections
    acePartialSelectionService.removePartialSelection( selectedObjs /* new selections */, occContextValue.selectedModelObjects /* old selections */ );

    let lastSelected = _.last( selectedObjs );
    occContextValue.selectedModelObjects = selectedObjs;
    occContextValue.pwaSelection = selectedObjs;
    occContextValue.previousState = occContextValue.currentState;
    occContextValue.currentState[urlParamsMap.selectionQueryParamKey] = lastSelected.uid;
    occContextValue.pwaSelectionSource = pwaSelectionSource;

    //Add additional info into newState
    occUpdateStateForSelection( occContextValue, subPanelContext );
    updatePrimarySelection( occContextValue, alternateSelection, subPanelContext );
    return selectedObjs;
}

const hasSelectionsChanged = function( currentSelection, newSelection ) {
    var currentSelectedUids = currentSelection && currentSelection.map( function( obj ) { return obj.uid; } );
    var newlySelectedUids = newSelection && newSelection.map( function( obj ) { return obj.uid; } );

    /*selected UIDs could be same but objects in currentSelection & newSelection could be different.
     In that case, hasSelectionChanged should be false.*/
    return !_.isEqual( JSON.stringify( currentSelectedUids ), JSON.stringify( newlySelectedUids ) );
};

/**
 *
 * @param {*} pwaSelectionModel Primary Workarea Selection model which has more details about selection mode and current selection
 * @param {*} subPanelContext SubPanelContext
 * @param {*} occContextValue atomic data of ACE with updated values
 * @param {*} selectionData Selection data which has information about new selection to process
 * @param {*} lastDpAction Last data provider action which provides some decision points about when to honor the selection and what all other things to do
 */
function processSelectionFromServer( pwaSelectionModel, subPanelContext, occContextValue, selectionData, lastDpAction ) {
    let currentSelection = pwaSelectionModel.selectionData.selected ? pwaSelectionModel.selectionData.selected : appCtxSvc.getCtx().mselected;
    let newSelection =  selectionData.selected;

    if( hasSelectionsChanged( currentSelection, newSelection ) ) {
        if( lastDpAction === 'selectNonPackMaster' ) {
            pwaSelectionModel.selectionData.update( { selected: newSelection } );
        }else{
            let selectionsInMSMode =  pwaSelectionModel.isMultiSelectionEnabled() || pwaSelectionModel.getCurrentSelectedCount() > 1 || newSelection.length > 1;
            /*with reusebom window, existing selections, after server interaction may still be valid...
           In that case, existing selections get retained...its kind of RAC parity, but we want to enable it
           after addressing all gaps around it..so, retainExistingSelsInMSMode keeping true only for cross-select.
           For all other server intractions, we will goto single-select.
           */
            if( selectionsInMSMode ) {
                if ( selectionData.retainExistingSelsInMSMode ) {
                    pwaSelectionModel.addToSelection( newSelection );
                }else {
                    pwaSelectionModel.setSelection( newSelection );
                }
            } else {
            // pwaSelectionModel.setSelection() call would PWA component selection.
            //selectionService.updateSelection() would update global selection. We are supposed to update both.

                //if selection is primary, upating global selection should happen in updateSelectionIfApplicable()
                if( subPanelContext.occContext.pwaSelectionSource === 'base' ) {
                    selectionService.updateSelection( newSelection, subPanelContext.occContext.baseModelObject );
                }

                if( lastDpAction === 'loadAndSelect'  ) {
                    pwaSelectionModel.selectionData.update( { selected: newSelection } );
                }
            }
        }
    }

    let xrtContext = _getXRTContextForPrimarySelection( subPanelContext, newSelection[ 0 ] );

    occmgmtSublocationService.updateUrlFromCurrentState( subPanelContext.provider, occContextValue.currentState, false );

    if( !_.isEqual( xrtContext.selectedUid, occContextValue.xrtContext.selectedUid ) && !_.isEqual( xrtContext.productContextUid, occContextValue.xrtContext.productContextUid ) ) {
        occUpdateStateForSelection( occContextValue, subPanelContext );
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, subPanelContext.occContext );
    }
}


/**
    * Function to set the ProductContextInfo and RootElement information based on the current selection
    * @param {Object} occContextValue Object representing ACE atomic data
    * @param {Object} subPanelContext SubPanelContext
    */
function _syncRootElementAndPCIOnSelectionChange( occContextValue, currentOccContext ) {
    var lastSelectedObject = cdm.getObject( occContextValue.currentState.c_uid );
    var productInfo = exports.getProductInfoForCurrentSelection( lastSelectedObject, currentOccContext );

    _syncPCIOnSelectionChange( productInfo, occContextValue, currentOccContext );

    let currentRootElement = currentOccContext.rootElement;
    let rootElement = productInfo && productInfo.rootElement;
    if( !currentRootElement || rootElement && currentRootElement.uid !== rootElement.uid ) {
        appCtxSvc.updatePartialCtx( currentOccContext.contextKey + '.rootElement', rootElement );
    }
}


/**
    * Function to set the ProductContextInfo based on the current selection
    * @param {Object} productInfo Object representing ProductContextInfo
    * @param {Object} occContextValue Object representing ACE atomic data
    * @param {Object} subPanelContext SubPanelContext
    */
function _syncPCIOnSelectionChange( productInfo, occContextValue, currentOccContext ) {
    // We are not triggering either tree reload or pwa.reset for change in pci_uid
    // so make sure it has actually changed and then fire updatePartialCtx
    var currentPci_Uid = currentOccContext.currentState.pci_uid;
    if( productInfo && productInfo.newPci_uid && productInfo.newPci_uid !== currentPci_Uid ) {
        let newPCIObject = cdm.getObject( productInfo.newPci_uid );

        occContextValue.currentState.pci_uid = productInfo.newPci_uid;
        occContextValue.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( newPCIObject );
        occContextValue.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( newPCIObject );
        occContextValue.productContextInfo = newPCIObject;
        occContextValue.rootElement = productInfo.rootElement;
    }
}

export default exports = {
    initializeDataNavigator,
    destroyDataNavigator,
    syncContextWithPWASelection,
    getParentUid,
    getProductInfoForCurrentSelection,
    populateVisibleServerCommands,
    updatePwaContextInformation,
    addUpdatedSelectionToPWA,
    removeSelectionFromPWA,
    addSelectionToPWA,
    updateActiveWindow,
    resetDataNavigator,
    selectActionForPWA,
    setShowCheckBoxValue,
    multiSelectActionForPWA,
    onPWASelectionChange,
    resetPwaContents,
    modifyPwaSelections,
    removeObjectsFromCollection,
    expandNodeForExpandBelow,
    handleHostingOccSelectionChange,
    resetTreeDataProvider
};
