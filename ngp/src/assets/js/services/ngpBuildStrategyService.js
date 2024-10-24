// Copyright (c) 2022 Siemens

import ngpRelationSvc from 'js/services/ngpRelationService';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import ngpSelectUponLoadSvc from 'js/services/ngpSelectUponLoadService';
import ngpTableSvc from 'js/services/ngpTableService';
import ngpCloneSvc from 'js/services/ngpCloneService';
import ngpCloneStatusCache from 'js/services/ngpCloneStatusCache';
import ngpVMOPropSvc from 'js/services/ngpViewModelPropertyService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import mfeTableSvc from 'js/mfeTableService';
import ngpLoadService from 'js/services/ngpLoadService';
import ngpTableCellRenderSvc from 'js/services/ngpTableCellRenderService';
import AwPromiseService from 'js/awPromiseService';
import ngpSoaSvc from 'js/services/ngpSoaService';

import _ from 'lodash';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import awTableStateSvc from 'js/awTableStateService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import msgSvc from 'js/messagingService';
import localeService from 'js/localeService';
import { getBaseUrlPath } from 'app';
import eventBus from 'js/eventBus';
import mfeTooltipUtils from 'js/mfeGenericTooltipUtil';
import ngpClientRequiredInfoConstants from 'js/constants/ngpClientRequiredInfoConstants';
import ngpVisInteropSvc from 'js/services/ngpVisInteropService';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import mfeFilterAndSortSvc from 'js/mfeFilterAndSortService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import awColumnFilterService from 'js/awColumnFilterService';
import ngpVmoPropSvc from 'js/services/ngpViewModelPropertyService';

/**
 * NGP Build Strategy service
 *
 * @module js/services/ngpBuildStrategyService
 */

const localizedMessages = localeService.getLoadedText( 'NgpBuildStrategyMessages' );
const cloneImageCellStyling = 'aw-ngp-cloneStatusImageTableCell';
let escapeKeyListener;
let opaqueObjectsCellRenderer;
const SET_MOVE_CANDIDATES_EVENT_NAME = 'ngp.moveCandidatesHaveBeenSet';

let opaqueObjects = [];
let moveCandidates = [];

/**
 *
 */
function updateOpaqueObjects() {
    opaqueObjectsCellRenderer.updateOpaqueObjects(  opaqueObjects.concat( moveCandidates ) );
}

/**
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @param {Object} columnProvider - the column provider created in the viewModel
 * @param {string[]} savedCloneStatusUids - an array of uids which we have its clone status saved on
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @return {Promise} - a promise object
 */
export function loadTableData( treeLoadInput, dataProvider, columnProvider, savedCloneStatusUids, viewModelData ) {
    const nodeToExpand = treeLoadInput.parentNode;
    nodeToExpand.cursorObject = {
        startReached: true,
        endReached: true
    };

    if ( nodeToExpand.levelNdx === -1 ) {
        opaqueObjects = [];
        updateOpaqueObjects();
        nodeToExpand.foundationID = ngpDataUtils.getFoundationId( nodeToExpand );
    }
    const hasCloneOrMasterStatusColumn = ngpTableSvc.hasCloneStatusColumn( dataProvider );
    return ngpRelationSvc.getContentElements( nodeToExpand.uid, true ).then(
        ( contentElements ) => {
            if ( columnProvider.columnFilters && columnProvider.columnFilters.length > 0 ) {
                contentElements = findElementsToShow( contentElements, viewModelData, columnProvider.columnFilters );
            }
            if ( hasCloneOrMasterStatusColumn ) {
                return ngpCloneSvc.getCloneStatuses( contentElements ).then(
                    ( uidToCloneStatus ) => {
                        savedCloneStatusUids.push( ...Object.keys( uidToCloneStatus ) );
                        savedCloneStatusUids = savedCloneStatusUids.filter( ( uid, index, array ) => array.indexOf( uid ) === index );
                        return {
                            contentElements,
                            savedCloneStatusUids
                        };
                    }
                );
            }
            return {
                contentElements,
                savedCloneStatusUids
            };
        }
    ).then(
        ( { contentElements, savedCloneStatusUids } ) => {
            const sortedContentElements = ngpTableSvc.sortTable( contentElements, columnProvider.sortCriteria );
            const childTreeNodes = sortedContentElements.map( ( object, index ) => {
                const isLeaf = !ngpModelUtils.hasContentElements( object );
                const treeNodeObj = mfeTableSvc.getTreeNodeObject( object, nodeToExpand, isLeaf, index );
                if ( hasCloneOrMasterStatusColumn ) {
                    const status = ngpCloneStatusCache.getStatus( treeNodeObj.uid );
                    treeNodeObj.props.MasterStatus = ngpVmoPropSvc.createStringViewModelProperty( 'MasterStatus', status, treeNodeObj );
                    treeNodeObj.props.CloneStatus = ngpVmoPropSvc.createStringViewModelProperty( 'CloneStatus', status, treeNodeObj );
                }
                ngpVMOPropSvc.addLocalizedTypeDisplayNames( treeNodeObj );
                treeNodeObj.foundationID = ngpDataUtils.getFoundationId( object );
                return treeNodeObj;
            } );
            const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childTreeNodes, false, true, true, null );
            if ( childTreeNodes.length === 0 ) {
                nodeToExpand.isLeaf = true;
            }
            setSelectionUponInitialLoad( dataProvider, viewModelData );
            return {
                treeLoadResult,
                savedCloneStatusUids
            };
        }
    );
}

/**
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @param {object[]} filters - the filters object array
 * @return {modelObject[]} an array of modelObjects to show
 */
function findElementsToShow( modelObjects, viewModelData, filters ) {
    let elementsToShow = mfeFilterAndSortSvc.filterModelObjects( modelObjects, filters );
    const filteredOutElements = modelObjects.filter( ( object ) => !elementsToShow.includes( object ) );
    const treeTableState = awTableStateSvc.getTreeTableState( viewModelData, 'ngpBuildStrategyTable' );

    filteredOutElements.forEach( ( object ) => {
        // if object should be expanded later because of saved expansion state, we consider it as filtered in if any of its descendants are filtered in
        if ( ngpModelUtils.hasContentElements( object ) && awTableStateSvc.isNodeExpanded( treeTableState, ngpDataUtils.getFoundationId( object ) ) ) {
            const contentElements = getContentElements( object );
            const contentElementsToShow = findElementsToShow( contentElements, viewModelData, filters );
            if ( contentElementsToShow.length > 0 ) {
                elementsToShow.push( object );
                opaqueObjects.push( object );
                updateOpaqueObjects();
            }
        }
    } );
    return elementsToShow;
}

/**
 *
 * @param {ModelObject} modelObject - a given modelObject
 * @return {Object[]} an array of the content elements
 */
function getContentElements( modelObject ) {
    let contentElements = [];
    if ( modelObject ) {
        let childrenPropArray = ngpModelUtils.getChildrenProperties( modelObject );
        if ( childrenPropArray ) {
            childrenPropArray.forEach( ( childProp ) => {
                const childObjects = modelObject.props[childProp].dbValues.map( ( childUid ) => cdm.getObject( childUid ) );
                contentElements = contentElements.concat( childObjects );
            } );
        }
    }
    return contentElements;
}

/**
 *
 * @param {ViewModelObject} vmo - the VMO which represents the row the cell exists it
 * @param {DOMElement} containerElement - DOMElement that should contain the image
 */
export function renderMissingInSourceOrMismatchStatusCellImage( vmo, containerElement ) {
    const status = vmo.props[ ngpClientRequiredInfoConstants.MISMATCH_OR_MISSING_COLUMN ].dbValue;
    let imageUrl;
    let element;

    if ( status === ngpClientRequiredInfoConstants.MISSING_IN_SOURCE_VALUE || status === ngpClientRequiredInfoConstants.MISSING_IN_SOURCE_AT_ACTIVITY_LEVEL_VALUE ) {
        imageUrl = `${getBaseUrlPath()}/image/indicatorMissingInSource16.svg`;
    } else if ( status === ngpClientRequiredInfoConstants.MISMATCH_STATUS_VALUE || status === ngpClientRequiredInfoConstants.MISMATCH_AT_ACTIVITY_LEVEL_VALUE ) {
        imageUrl = `${getBaseUrlPath()}/image/indicatorMismatch16.svg`;
    } else if ( status === ngpClientRequiredInfoConstants.FALSE_POSITIVE_STATUS_VALUE ) {
        imageUrl = `${getBaseUrlPath()}/image/indicatorRevisedNotChanged16.svg`;
    }
    if ( imageUrl ) {
        element = createAndAppendIconCellElement( imageUrl, containerElement );
        element.addEventListener( 'mouseover', onHover.bind( this, element, vmo ) );
        element.addEventListener( 'mouseout', mfeTooltipUtils.hideCellIconIndicationTooltip );
    }
}

/**
 *
 * @param {DomElement} element - the dom element we hover over
 * @param {ViewModelObject} vmo - the vmo represented in the row
 */
function onHover( element, vmo ) {
    const tooltipObj = {};
    const status = vmo.props[ ngpClientRequiredInfoConstants.MISMATCH_OR_MISSING_COLUMN ].dbValue;
    if ( status === ngpClientRequiredInfoConstants.MISSING_IN_SOURCE_VALUE || status === ngpClientRequiredInfoConstants.MISSING_IN_SOURCE_AT_ACTIVITY_LEVEL_VALUE ) {
        if ( ngpTypeUtils.isProcessElement( vmo.contextObject ) ) {
            tooltipObj.title = localizedMessages.missingInActivityMessage;
        } else if ( ngpTypeUtils.isOperation( vmo.contextObject ) ) {
            tooltipObj.title = localizedMessages.missingInProcessMessage;
        } else {
            tooltipObj.title = localizedMessages.missingMessage;
        }
    } else if ( status === ngpClientRequiredInfoConstants.FALSE_POSITIVE_STATUS_VALUE ) {
        tooltipObj.title = localizedMessages.revisedButNotChanged;
    } else if ( status === ngpClientRequiredInfoConstants.MISMATCH_STATUS_VALUE || status === ngpClientRequiredInfoConstants.MISMATCH_AT_ACTIVITY_LEVEL_VALUE ) {
        tooltipObj.title = localizedMessages.mismatchMessage;
    }

    mfeTooltipUtils.displayCellIconIndicationTooltip( element, tooltipObj );
}

/**
 *
 * @param {string} imageUrl - the image url path
 * @param {DOMElement} parentElement - the parent element which should contain the cell
 * @return {DOMElement} the created element
 */
function createAndAppendIconCellElement( imageUrl, parentElement ) {
    const cellImage = document.createElement( 'img' );
    cellImage.src = imageUrl;
    cellImage.classList.add( cloneImageCellStyling );
    parentElement.appendChild( cellImage );
    return cellImage;
}

/**
 * Creates the table column in the given dataProvider
 *
 * @param {Object} contentModel - the content model
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table
 * @param {Object} dataProvider - the table data provider
 * @param {object} columnProvider - the table column provider
 * @param {object} additionalPolicyObjects - object with more policy data
 * @param {string} tableCmdColumnPropName - the property name column we want to have the command icons
 * @param {string} tableTreeNavColumnPropName - the property name column we want to have the expand icon
 */
export function createTableColumns( contentModel, preferenceName, dataProvider, columnProvider, additionalPolicyObjects, tableCmdColumnPropName, tableTreeNavColumnPropName ) {
    mfeTableSvc.createColumns( preferenceName, dataProvider, columnProvider, additionalPolicyObjects, tableCmdColumnPropName, tableTreeNavColumnPropName ).then(
        () => {
            createCellRenderers( dataProvider.columnConfig.columns, contentModel );
            ngpTableSvc.ensureObjectStringColumnInTable( dataProvider.columnConfig.columns, columnProvider );
        }
    );
}

/**
 *
 * @param {object[]} columns - an array of column objects
 * @param {object} contentModel - the content model
 */
function createCellRenderers( columns, contentModel ) {
    opaqueObjectsCellRenderer =  ngpTableCellRenderSvc.getOpaqueRowCellRenderer();
    columns.forEach( ( column ) => {
        if ( !column.cellRenderers ) {
            column.cellRenderers = [];
        }
        column.cellRenderers.push( opaqueObjectsCellRenderer );
    } );
    setClearMoveCandidatesOnEscapeCharacterListener();
}

/**
 *
 * @param {object} dataProvider - the data provider object
 * @param {object} viewModelData - the data of the view model which uses this service
 */
export function setSelectionUponInitialLoad( dataProvider, viewModelData ) {
    const uidsToSelect = ngpSelectUponLoadSvc.getUidsToSelectUponLoad();
    if ( uidsToSelect && uidsToSelect.length > 0 ) {
        setTimeout( () => {
            findAndSetSelection( uidsToSelect, dataProvider, viewModelData );
        }, 100 );
    }
}

/**
 *
 * @param {string[]} uidsToSelect - an array of uids to select
 * @param {object} dataProvider - the data provider object
 * @param {object} viewModelData - the view model data which is using this service
 */
export function findAndSetSelection( uidsToSelect, dataProvider, viewModelData ) {
    if ( uidsToSelect && dataProvider && viewModelData ) {
        const foundationUidsToSelect = uidsToSelect.map( ( uid ) => ngpDataUtils.getFoundationIdFromUid( uid ) );
        //for now, we assume that only one object needs to get selected
        //if multiple needs to get selected, then need to make sure all of them are loaded and only then select
        if ( Array.isArray( uidsToSelect ) && uidsToSelect.length === 1 ) {
            const uid = foundationUidsToSelect[0];
            const vmoToSelect = _.find( dataProvider.viewModelCollection.loadedVMObjects, ( loadedObj ) => loadedObj.foundationID === uid );
            if ( vmoToSelect ) {
                dataProvider.selectionModel.setSelection( vmoToSelect );
                return;
            }
            ngpLoadService.ensureObjectsLoaded( [ uid ] ).then( () => {
                const topNodeFoundationUid = ngpDataUtils.getFoundationIdFromUid( dataProvider.topNodeUid );
                const modelObj = cdm.getObject( uid );
                ngpModelUtils.getAncestorUidsAsync( modelObj, [] ).then( ( ancestorUids ) => {
                    const index = ancestorUids.indexOf( topNodeFoundationUid );
                    if ( index === -1 ) {
                        return;
                    }
                    ancestorUids.splice( index );
                    expandAncestors( ancestorUids, dataProvider, viewModelData ).then( ( allAncestorsExpanded ) => {
                        if ( allAncestorsExpanded ) {
                            const vmoToSelect = _.find( dataProvider.viewModelCollection.loadedVMObjects, ( loadedObj ) => loadedObj.foundationID === uid );
                            if ( vmoToSelect ) {
                                dataProvider.selectionModel.setSelection( vmoToSelect );
                                return;
                            }
                        }
                        if ( awColumnFilterService.isColumnFilterApplied( dataProvider ) ) {
                            removeFilters( modelObj, dataProvider, viewModelData, ancestorUids ).then( () => {
                                // expand all the ancestors
                                ancestorUids.forEach( ( uid ) => eventBus.publish( dataProvider.name + '.expandTreeNode', {
                                    parentNode: {
                                        id: uid
                                    }
                                } ) );
                                findAndSetSelection( uidsToSelect, dataProvider, viewModelData );
                            } );
                        }
                    } );
                } );
            } );
        }
    }
}

/**
 * @param {modelObject} modelObj - the model object
 * @param {object} dataProvider - the data provider object
 * @param {object} viewModelData - the view model data which is using this service
 * @param {String[]} ancestors - an array of ancestors uids ordered bottom-up
 * @return {Promise} - a promise object
 */
function removeFilters( modelObj, dataProvider, viewModelData, ancestors ) {
    let deferred = AwPromiseService.instance.defer();
    const removeFiltersConfirmMsg = localizedMessages.removeFiltersConfirmMsg.format( modelObj.props.object_string.dbValues[ 0 ] );
    mfgNotificationUtils.displayConfirmationMessage( removeFiltersConfirmMsg, localizedMessages.removeFiltersCmdTitle, localizedMessages.cancel ).then(
        () => {
            const subDef = eventBus.subscribe( dataProvider.name + '.treeNodesLoaded', function() {
                eventBus.unsubscribe( subDef );
                deferred.resolve();
                deferred = null;
            } );
            // mark the ancestors as collapsed so they will not be auto expanded, because we expand them ourselves
            ancestors.forEach( ( ancestor ) => awTableStateSvc.saveRowCollapsed( viewModelData, 'ngpBuildStrategyTable', ancestor ) );
            eventBus.publish( dataProvider.name + '.columnsArranged', { columns: [] } );
            eventBus.publish( 'pltable.columnFilterApplied', { gridId: 'ngpBuildStrategyTable' } );
        }, () => { } );
    return deferred.promise;
}

/**
 * Updates the table after the restructure
 * @param {modelObject} parentOfClones - the object that we need to add the cloned object which were moved to
 * @param {string[]} cloneUids - the clone uids
 * @param {modelObject} rootNodeTree - the root node of the tree
 * @param {object} dataProvider - the dataprovider object
 */
function updateTableAfterClone( parentOfClones, cloneUids, rootNodeTree, dataProvider ) {
    let parentTreeNode;
    if ( parentOfClones.uid === rootNodeTree.uid ) {
        parentTreeNode = rootNodeTree;
    } else {
        parentTreeNode = _.find( dataProvider.getViewModelCollection().getLoadedViewModelObjects(), ( treeNode ) => treeNode.uid === parentOfClones.uid );
    }
    if ( parentTreeNode ) {
        if ( parentTreeNode.isExpanded || parentTreeNode.uid === rootNodeTree.uid ) {
            const isLeafFunc = ( modelObj ) => !ngpModelUtils.hasContentElements( modelObj );
            const cloneObjects = cloneUids.map( ( uid ) => cdm.getObject( uid ) );
            mfeTableSvc.appendChildNodes( parentTreeNode, cloneObjects, dataProvider, isLeafFunc );
        } else {
            eventBus.publish( dataProvider.name + '.expandTreeNode', {
                parentNode: {
                    id: parentTreeNode.uid
                }
            } );
        }
    }
}

/**
 *
 * @param {modelObject[]} updatedClones - a list of clones that were updated
 * @param {object} dataProvider - a given data provider object
 * @param {string} tableId - the table id
 * @param {object} viewModelData - the viewModel data of the viewModel which calls this service
 */
export function onClonesUpdated( updatedClones, dataProvider, tableId, viewModelData ) {
    //currently we're updating only one clone and not multiple
    if ( Array.isArray( updatedClones ) ) {
        const clone = updatedClones[0];
        const scopeObject = appCtxSvc.getCtx( 'ngp.scopeObject' );
        if ( ngpTypeUtils.isBuildElement( scopeObject ) ) {
            let uidToCollapseAndExpand;
            if ( ngpTypeUtils.isActivity( clone ) ) {
                uidToCollapseAndExpand = clone.uid;
            } else {
                uidToCollapseAndExpand = clone.props[ngpPropConstants.PARENT_OF_PROCESS_OR_ME].dbValues[0];
            }
            const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
            const vmoTreeNode = _.find( loadedObjects, ( loadedObj ) => loadedObj.uid === uidToCollapseAndExpand );
            mfeTableSvc.collapseTreeNode( dataProvider, vmoTreeNode, viewModelData ).then(
                () =>  mfeTableSvc.expandTreeNode( dataProvider, vmoTreeNode, viewModelData )
            );
        } else {
            //TODO need to think of a more optimal solution
            mfeTableSvc.reloadTable( tableId );
        }
    }
}

/**
 *
 * @param {ModelObject[]} newMoveCandidates - the new move condidates
 */
export function setMoveCandidates( newMoveCandidates ) {
    showMoveCandidatesInfoMsg( newMoveCandidates );
    updateMoveCandidatesObjects( newMoveCandidates );
    eventBus.publish( SET_MOVE_CANDIDATES_EVENT_NAME, { moveCandidates: newMoveCandidates } );
}

/**
 * @param {ModelObject[]} currentMoveCandidates - the current move candidates
 * @param {ModelObject[]} newMoveCandidates - the new move condidates
 * @return {Promise} - a promise object
 */
export function setMoveCandidatesForPEs( currentMoveCandidates, newMoveCandidates ) {
    let msg;
    const moveCandidateDisplayName = newMoveCandidates[0].props.object_string.dbValue;
    if ( !ngpModelUtils.areAllModifiable( newMoveCandidates ) ) {
        msg = newMoveCandidates.length > 1 ? localizedMessages.moveCandidateMultipleSelectionError :
            localizedMessages.moveCandidateNonmodifiableProcessError.format( moveCandidateDisplayName );
        msgSvc.showError( msg );
        return new Promise( ( res )=>res( currentMoveCandidates ) );
    }

    const multipleRevisionsPromise = ngpModelUtils.isArrayOfObjectsHasMultipleRev( newMoveCandidates );
    const cloneStatusPromise = ngpCloneSvc.getCloneStatuses( newMoveCandidates );
    return Promise.all( [ multipleRevisionsPromise, cloneStatusPromise ] ).then(
        ( [ multipleRevisionsRes, cloneStatusRes ] ) => {
            let validToMove = true;
            if ( multipleRevisionsRes ) {
                msg = newMoveCandidates.length > 1 ? localizedMessages.moveCandidateMultipleSelectionError :
                    localizedMessages.moveCandidateMultipleRevisionProcessError.format( moveCandidateDisplayName );
                validToMove = false;
            }
            //need to refactor
            validToMove && newMoveCandidates.some( ( candidate ) =>  {
                if ( cloneStatusRes ) {
                    if ( ngpCloneStatusCache.isClone( candidate.uid ) ) {
                        msg = newMoveCandidates.length > 1 ? localizedMessages.moveCandidateMultipleSelectionError :
                            localizedMessages.moveCandidateCloneProcessError.format( moveCandidateDisplayName );
                        validToMove = false;
                        return true;
                    } else if ( ngpCloneStatusCache.isMaster( candidate.uid ) ) {
                        msg = newMoveCandidates.length > 1 ? localizedMessages.moveCandidateMultipleSelectionError :
                            localizedMessages.moveCandidateMasterProcessError.format( moveCandidateDisplayName );
                        validToMove = false;
                        return true;
                    }
                }
                return false;
            } );

            if ( validToMove ) {
                showMoveCandidatesInfoMsg( newMoveCandidates );
                updateMoveCandidatesObjects( newMoveCandidates );
                eventBus.publish( SET_MOVE_CANDIDATES_EVENT_NAME, { moveCandidates: newMoveCandidates } );
            } else {
                msgSvc.showError( msg );
            }
        }
    );
}

/**
 * @param {ModelObject[]} moveCandidates - the new move condidates
 */
function showMoveCandidatesInfoMsg( moveCandidates ) {
    let msg;
    if ( moveCandidates.length === 1 ) {
        const moveCandidateDisplayName = moveCandidates[0].props.object_string.dbValue;
        msg = localizedMessages.successfullySetSingleMoveCandidate.format( moveCandidateDisplayName );
    } else {
        msg = localizedMessages.successfullySetMultipleMoveCandidates.format( moveCandidates.length );
    }
    msgSvc.showInfo( msg );
}

/**
 *

 * @param {modelObject[]} objectsToExpand array of selected object to be expanded
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @param {string} gridId - the grid Id that we are expanding at
 */
function expandAll( objectsToExpand, dataProvider, viewModelData, gridId ) {
    if ( objectsToExpand.length > 0 ) {
        //filter out operations
        const toLoadChildrenOf = objectsToExpand.filter( ( obj ) => !ngpTypeUtils.isOperation( obj ) );
        return getAllchildren( toLoadChildrenOf ).then( ( children ) => {
            if ( children.length > 0 && ngpTableSvc.hasCloneStatusColumn( dataProvider ) ) {
                ngpCloneSvc.getCloneStatuses( children ).then(
                    doExpand.bind( this, objectsToExpand, dataProvider, viewModelData, gridId )
                ).then(
                    expandAll.bind( this, children, dataProvider, viewModelData, gridId )
                );
            } else {
                doExpand( objectsToExpand, dataProvider, viewModelData, gridId ).then(
                    expandAll.bind( this, children, dataProvider, viewModelData, gridId )
                );
            }
        } );
    }
}

/**
 *
 * @param {modelObject[]} objectsToExpand array of selected object to be expanded
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @param {string} gridId - the grid Id that we are expanding at
 * @return {Promise} - a promise object
 */
function doExpand( objectsToExpand, dataProvider, viewModelData, gridId ) {
    const treeTableState = awTableStateSvc.getTreeTableState( viewModelData, gridId );
    const loaded = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    const vmoTreeNodes = objectsToExpand.map( ( obj ) => {
        return _.find( loaded, ( treeNode ) => treeNode.uid === obj.uid );
    } ).filter( ( obj ) => Boolean( obj ) && !obj.isExpanded && !awTableStateSvc.isNodeExpanded( treeTableState, obj ) );

    const deferred = AwPromiseService.instance.defer();
    expandOneByOne( vmoTreeNodes, 0, dataProvider, viewModelData, gridId, deferred );
    return deferred.promise;
}

/**
 *
 * @param {ViewModelTreeNode[]} vMOTreeNodes - the view model tree node objects array
 * @param {Integer} index - index in the vmoTreeNodes array
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @param {string} gridId - the grid Id that we are expanding at
 * @param {Promise} promise - promise object
 */
function expandOneByOne( vMOTreeNodes, index, dataProvider, viewModelData, gridId, promise ) {
    if( vMOTreeNodes.length > 0 ) {
        mfeTableSvc.expandTreeNode( dataProvider, vMOTreeNodes[ index ], viewModelData, gridId ).then( () => {
            index++;
            if( index < vMOTreeNodes.length ) {
                expandOneByOne( vMOTreeNodes, index, dataProvider, viewModelData, gridId, promise );
            } else {
                promise.resolve();
            }
        } );
    } else {
        promise.resolve();
    }
}

/**
 *
 * @param {String[]} ancestorUids - an array of ancestors uids ordered bottom-up
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @returns {Promise} - a promise object
 */
function expandAncestors( ancestorUids, dataProvider, viewModelData ) {
    // find the first ancestor (ordered bottom-up) that is visible
    let index = ancestorUids.findIndex( ( uid ) => dataProvider.viewModelCollection.loadedVMObjects.findIndex( ( vmo ) => vmo.foundationID === uid ) > -1 );
    // remove the rest of the ancestors (those that are above the found one) since they are already expanded
    const ancestors = ancestorUids.slice( 0, index + 1 );
    let result = ancestors.reduceRight( ( previousPromise, uid ) => previousPromise.then( ( expandedAncestors ) => {
        const vmo = dataProvider.viewModelCollection.loadedVMObjects.find( ( vmo ) => vmo.foundationID === uid );
        if ( vmo ) {
            ++expandedAncestors;
            return mfeTableSvc.expandTreeNode( dataProvider, vmo, viewModelData ).then( () => new Promise( ( res ) => res( expandedAncestors ) ) );
        }
        return new Promise( ( res ) => res( expandedAncestors ) );
    } ), Promise.resolve( 0 ) );
    return result.then( ( expandedAncestors ) => new Promise( ( res ) => res( expandedAncestors === ancestors.length ) ) );
}

/**
 * Create the escape key listener
 * @param {modelObject[]} moveCandidates - the move candidates
 */
function setClearMoveCandidatesOnEscapeCharacterListener( ) {
    if ( !escapeKeyListener ) {
        document.addEventListener( 'keydown', clearCandidatesOnEscapeKey );
        escapeKeyListener = true;
    }
}

/**
 * @param {object} keyDownEvent - the key down event object
 */
function clearCandidatesOnEscapeKey( keyDownEvent ) {
    if( keyDownEvent.key === 'Escape' ) {
        updateMoveCandidatesObjects( [] );
        eventBus.publish( SET_MOVE_CANDIDATES_EVENT_NAME, { moveCandidates:[] } );
    }
}

/**
 * Clears the listener
 */
export function clearEscapeCharacterListener() {
    if ( escapeKeyListener ) {
        document.removeEventListener( 'keydown', clearCandidatesOnEscapeKey );
        escapeKeyListener = null;
    }
}

/**
 *
 * @param {modelObject[]} newMoveObjects - the new move objects
 */
export function updateMoveCandidatesObjects( newMoveObjects ) {
    moveCandidates = newMoveObjects;
    updateOpaqueObjects();
}

/**
 *
 * @param {object} dataProvider - a given data provider
 * @param {modelObject[]} modelObjects - a given set of model objects
 * @returns {promise} a promise
 */
export function refreshObjects( dataProvider, modelObjects ) {
    const promiseArray = [];
    promiseArray.push( ngpLoadService.refreshObjects( modelObjects ) );
    if ( ngpTableSvc.hasCloneStatusColumn( dataProvider ) ) {
        promiseArray.push( ngpCloneSvc.getCloneStatuses( modelObjects ) );
    }
    return Promise.all( promiseArray );
}

/**
 * This is a recursive function that finds all Activity/BE descendants of a given array of model objects
 *
 * @param {ModelObject[]} modelObjects - a given array of Activity/BE model objects
 * @param {ModelObject[]} allDescendantsArr - an array for all found descendants
 * @returns {promise} a promise
 */
export function getAllActivityAndBuildElementDescendants( modelObjects, allDescendantsArr ) {
    // getAllchildren finds all direct descendants
    return getAllchildren( modelObjects ).then( ( children ) => {
        if ( children.length === 0 ) {
            return allDescendantsArr;
        }
        // filter for only Activities and Build Elements
        children = children.filter( ( obj ) => mfeTableSvc.getTreeNodeObjectByPropertyAndValue( allDescendantsArr, 'uid', obj.uid ) === undefined )
            .filter( ( obj ) => ngpTypeUtils.isBuildElement( obj ) || ngpTypeUtils.isActivity( obj ) );
        allDescendantsArr = allDescendantsArr.concat( children );
        children = children.filter( ( obj ) => ngpTypeUtils.isBuildElement( obj ) );
        return getAllActivityAndBuildElementDescendants( children, allDescendantsArr ).then( ( allDescendantsArr ) => {
            return allDescendantsArr;
        } );
    } );
}

/**
 *
 * @param {ModelObject[]} parentObjects - a given array of modelObjects
 * @returns {promise} a promise
 */
function getAllchildren( parentObjects ) {
    let childrenPropArray = [];
    parentObjects.forEach( ( obj ) => {
        childrenPropArray = childrenPropArray.concat( ngpModelUtils.getChildrenProperties( obj ) );
    } );

    childrenPropArray = childrenPropArray.filter( ( propName, index, array ) => array.indexOf( propName ) === index );

    const parentObjectUids = parentObjects.map( ( object ) => object.uid );
    let children = [];
    return ngpLoadService.getPropertiesAndLoad( parentObjectUids, childrenPropArray ).then(
        () => {
            childrenPropArray.forEach( ( childProp ) => {
                parentObjects.forEach( ( modelObject ) => {
                    if ( modelObject.props[childProp] ) {
                        const childObjects = modelObject.props[childProp].dbValues.map( ( childUid ) => cdm.getObject( childUid ) );
                        children = children.concat( childObjects );
                    }
                } );
            } );
            return children;
        } );
}

/**
 *
 * @param {ModelObject[]} objectsToRecalculate - a given array of objects to recalculate
 */
export function recalculateSubset( objectsToRecalculate ) {
    let recalculateConfirmationMessage = null;
    if ( objectsToRecalculate && objectsToRecalculate.length === 1 ) {
        const objectToRecalculateDisplayName = objectsToRecalculate[0].props[ngpPropConstants.OBJECT_STRING].uiValues[0];
        recalculateConfirmationMessage = localizedMessages.singleRecalculateObjectMessage.format( objectToRecalculateDisplayName );
    } else {
        recalculateConfirmationMessage = localizedMessages.multipleRecalculateObjectsMessage.format( objectsToRecalculate.length );
    }
    mfgNotificationUtils.displayConfirmationMessage( recalculateConfirmationMessage, localizedMessages.updateRevisions, localizedMessages.cancel )
        .then( () => {
            const allDescendantsArr = objectsToRecalculate;
            return getAllActivityAndBuildElementDescendants( objectsToRecalculate, allDescendantsArr ).then( ( allDescendantsArr ) => {
                return ngpSoaSvc.executeSoa( 'Process-2017-05-ProductSubset', 'recalculate', { scopes: allDescendantsArr } ).then(
                    () => {
                        if ( objectsToRecalculate.length === 1 ) {
                            eventBus.publish( 'ngp.assignedPartsTableRefreshEvent', { targetObject: objectsToRecalculate[0] } );
                        }
                    }
                );
            } );
        }, () => { } );
}

/**
 *
 * @param {ModelObject[]} selectedObjects - the selected objects
 * @returns {promise} a promise
 */
export function highlightInVis( selectedObjects ) {
    const inputs = selectedObjects.map( ( object ) => {
        return {
            context: object,
            clientRequiredInformation: [ ngpClientRequiredInfoConstants.ASSIGNMENTS_VISUALIZATION_IDS_KEY ],
            updatedObjects: [ object ]
        };
    } );
    const soaInput = {
        input: inputs
    };

    return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getClientRequiredInfo', soaInput ).then(
        ( result ) => {
            let idChains = [];
            result.output.forEach( ( output ) => {
                if( output.objectClientRequiredInfoMap[ 1 ][ 0 ].stringArrayInfo ) {
                    idChains.push( ...output.objectClientRequiredInfoMap[ 1 ][ 0 ].stringArrayInfo[ ngpClientRequiredInfoConstants.ASSIGNMENTS_VISUALIZATION_IDS_KEY ] );
                }
            } );
            return ngpVisInteropSvc.selectObjectsInVis( idChains );
        } );
}

/**
 * This function togggles the given layout mode by writing to the local storage
 *
 * @param {String} layoutName - a given layout name
 */
export function toggleLayoutPanel( layoutName ) {
    const layoutToggledValue = JSON.parse( localStorage.getItem( layoutName ) );
    if ( layoutToggledValue ) {
        localStorage.setItem( layoutName, !layoutToggledValue );
        appCtxSvc.updatePartialCtx( `ngp.${layoutName}`, JSON.stringify( !layoutToggledValue ) );
    } else {
        localStorage.setItem( layoutName, true );
        appCtxSvc.updatePartialCtx( `ngp.${layoutName}`, 'true' );
    }
}

/**
 * This function is reading from the local storage the layout modes and update the ctx
 *
 * @param {String[]} layoutNames - an array of layout names
 */
export function updateCtxWithLayoutPanelModes( layoutNames ) {
    layoutNames.forEach( ( layout ) => {
        let layoutToggledValue = JSON.parse( localStorage.getItem( layout ) );
        layoutToggledValue = layoutToggledValue ? layoutToggledValue : false;
        appCtxSvc.updatePartialCtx( `ngp.${layout}`, JSON.stringify( layoutToggledValue ) );
    } );
}

let exports = {};
export default exports = {
    updateCtxWithLayoutPanelModes,
    toggleLayoutPanel,
    loadTableData,
    findAndSetSelection,
    onClonesUpdated,
    createTableColumns,
    updateTableAfterClone,
    setMoveCandidates,
    setMoveCandidatesForPEs,
    expandAll,
    clearEscapeCharacterListener,
    refreshObjects,
    updateMoveCandidatesObjects,
    renderMissingInSourceOrMismatchStatusCellImage,
    recalculateSubset,
    highlightInVis
};
