// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import ngpSoaSvc from 'js/services/ngpSoaService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import { getBaseUrlPath } from 'app';
import mfePolicyService from 'js/mfePolicyService';
import mfeTableService from 'js/mfeTableService';
import mfeTooltipUtils from 'js/mfeGenericTooltipUtil';
import ngpModelConstants from 'js/constants/ngpModelConstants';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpRelationSvc from 'js/services/ngpRelationService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import openInVisProductContextInfoProvider from 'js/openInVisualizationProductContextInfoProvider';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import ngpAssignmentSvc from 'js/services/ngpAssignmentStatusesService';
import ngpStorageService from 'js/services/ngpStorageService';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import appCtxSvc from 'js/appCtxService';
import ngpClientRequiredInfoConstants from 'js/constants/ngpClientRequiredInfoConstants';
import ngpClientRequiredInfoSvc from 'js/services/ngpClientRequiredInfoService';
import ngpLoadService from 'js/services/ngpLoadService';
import ngpAssociatePartitionsService from 'js/services/ngpAssociatePartitionsService';
import modelPropertySvc from 'js/modelPropertyService';
import ngpTableService from 'js/services/ngpTableService';
import ngpSearchService from 'js/services/ngpSearchService';


const localizedMsgs = localeService.getLoadedText( 'NgpAssociatePartitionsMessages' );
const buildStrategyLocalizedMsgs = localeService.getLoadedText( 'NgpBuildStrategyMessages' );
const assignmentFilter = 'AssignmentFilter';
const unassigned = 'Unassigned';
const assignedAndPartiallyAssignedByDescendants = 'Assigned And Partially Assigned By Descendants';

/**
 * NGP Product Scope service
 *
 * @module js/services/ngpProductScopeService
 */
'use strict';
const ngpSchemePolicy = {
    types: [ {
        name: ngpModelConstants.PARTITION_TYPE,
        properties: [ {
            name: 'ptn0partition_scheme_type'
        } ]
    },
    {
        name: ngpModelConstants.SEARCH_PARTITION_TYPE,
        properties: [ {
            name: 'ptn0partition_obj_criteria',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        } ]
    },
    {
        name: 'Mdl0SubsetDefinition',
        properties: [ {
            name: 'fnd0configuration_context'
        } ]
    },
    {
        name: 'Mdl0SearchSlctContent',
        properties: [ {
            name: 'mdl0selectedcontents',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        } ]
    }
    ]
};

const ngpConfigContextPolicy = {
    types: [ {
        name: 'ConfigurationContext',
        properties: [ {
            name: 'revision_rule'
        } ]
    } ]
};

const ngpSubsetPolicy = {
    types: [ {
        name: 'Mdl0SubsetDefinition',
        properties: [ {
            name: 'mdl0model_object'
        },
        {
            name: 'fnd0configuration_context'
        } ]
    } ]
};

let productScopePolicy = null;

const ClientColumns = [ 'assignmentIndication', 'MismatchStatus', 'AssignedToBuildElements', 'AssignedToActivities', 'AssignedToProcesses' ];

let nodesToUpdate = [];

/**
 * @param {ModelObject[]} planningScopeModelObjects - model object that the partition will be associated to (Activity, Build\element)
 * @param {ModelObject[]} partitions - array of partitions to be associated with the context
 * @param {ModelObject} revisionRuleUid - revisionRule uid
 * @param {String} intentValue - intent value
 * @return {Promise} a promise
 */
export function createOrUpdateProductSubsetsFromPartitions( planningScopeModelObjects, partitions, revisionRuleUid, intentValue ) {
    return ngpLoadService.ensureObjectsLoaded( [ revisionRuleUid ] ).then( () => {
        const soaInput = {
            input: []
        };
        const revisionRule = cdm.getObject( revisionRuleUid );
        planningScopeModelObjects.forEach( ( planningScopeModelObject ) => {
            const ctx = {
                context: planningScopeModelObject,
                partitions,
                revisionRule,
                intentOptions: [ {
                    intentNamespace: '',
                    intentFamily: '',
                    intentValue
                } ]
            };
            soaInput.input.push( ctx );
        } );

        return ngpSoaSvc.executeSoa( 'Process-2018-11-ProductSubset', 'createOrUpdateProductSubsetsFromPartitions', soaInput ).then(
            ( ) => {
                return true;
            },
            () => null
        );
    } );
}

/**
 * @param {ModelObject} currentBuildElement -cuurent  model object - Build Element
 * @param {ModelObject} newPotentialBuildElement - new  model object - Build Element
 * @param {ModelObject} currentSubsetDefObject - current subset def object
 * @param {ModelObject} currentPartitions - current partitions
 * @param {ModelObject} currentPartitionScheme - current scheme
 * @return {Promise} - a promise object
 *
 */
export function getProductScopeConfiguration( currentBuildElement, newPotentialBuildElement, currentSubsetDefObject, currentPartitions, currentPartitionScheme ) {
    const currentConfiguration = {
        subsetDefinition: currentSubsetDefObject,
        partitions: currentPartitions,
        partitionScheme: currentPartitionScheme,
        buildElement: currentBuildElement
    };
    if ( newPotentialBuildElement ) {
        return extractSubsetDefObject( newPotentialBuildElement ).then(
            ( subsetDefObjectAndbuildElement ) => {
                const { subsetDefObject, buildElement, isScopeDefinedOnAncestor } = subsetDefObjectAndbuildElement;
                if ( isScopeDefinedOnAncestor ) {
                    const message = localizedMsgs.displayProductOfAncestorBEConfirmationMassage.format(
                        newPotentialBuildElement.props.object_string.dbValues[ 0 ],
                        buildElement.props.object_string.dbValues[ 0 ] );

                    return mfgNotificationUtils.displayConfirmationMessage(
                        message,
                        localizedMsgs.yes,
                        localizedMsgs.cancel )
                        .then( () => getProductSubsetConfiguration( subsetDefObject, buildElement ) );
                }
                if ( !subsetDefObject ) {
                    const message = localizedMsgs.noProductScopeDefinedForContext.format( newPotentialBuildElement.props.object_string.dbValues[0] );
                    messagingService.showError( message );
                    currentConfiguration.subsetDefinition = null;
                    return new Promise( ( res ) => res( currentConfiguration ) );
                }
                return getProductSubsetConfiguration( subsetDefObject, buildElement );
            } );
    }
    return new Promise( ( res ) => res( currentConfiguration ) );
}

/**
 * @param {ModelObject} subsetDefinition - Subset Definition
 * @param {ModelObject} buildElement - build Element
 * @return {Promise} - a promise object
 *
 */
export function getProductSubsetConfiguration( subsetDefinition, buildElement ) {
    let partitions;
    return getPartitionsFromSubset( subsetDefinition )
        .then( ( partitionUids ) => {
            partitions = partitionUids;
            return getPartitionSchemeFromPartitions( partitions, subsetDefinition );
        } )
        .then(
            ( partitionScheme ) => ( {
                subsetDefinition,
                partitions,
                partitionScheme,
                buildElement
            } )
        );
}

/**
 * @param {string[]} partitionUids - list of partition uids
 * @param {ModelObject} subsetDefinition - subset definition
 * @return {Promise} - a promise object
 *
 */
function getPartitionSchemeFromPartitions( partitionUids, subsetDefinition ) {
    const partitionObj = cdm.getObject( partitionUids[ 0 ] );
    const partitionSchemeType = partitionObj.props[ ngpPropConstants.PARTITION_SCHEME_TYPE ].dbValues[ 0 ];
    const partitionSchemeTypeName = cmm.extractTypeNameFromUID( partitionSchemeType );
    return getPartitionScheme( subsetDefinition, partitionSchemeTypeName );
}

/**
 * @param {ModelObject} planningScopeModelObject - model object - Build Element
 *
 * @return {String} - Subset Definition UID
 *
 */
function extractSubsetDefObject( planningScopeModelObject ) {
    const ancestorsUids = ngpModelUtils.getAncestorUids( planningScopeModelObject );

    ancestorsUids.unshift( planningScopeModelObject.uid );

    mfePolicyService.register( 'ngpSubsetPolicy', ngpSubsetPolicy );

    const ancestorsObjects = ancestorsUids.map( ( uid ) => cdm.getObject( uid ) );
    return ngpRelationSvc.getSecondaryObjects( ancestorsObjects, [ ngpPropConstants.PRODUCT_SCOPE_RELATION ] ).then(
        ( secondaryObjects ) => {
            let buildElement;
            let subsetDefObject;
            let isScopeDefinedOnAncestor = false;

            mfePolicyService.unregister( 'ngpSubsetPolicy' );
            ancestorsUids.some( ( uid, index ) => {
                const seconderyObjectsValuesArr = secondaryObjects[ ancestorsUids[ index ] ][ 0 ];
                if( seconderyObjectsValuesArr && seconderyObjectsValuesArr.length > 0 ) {
                    subsetDefObject = seconderyObjectsValuesArr[ 0 ];
                    buildElement = cdm.getObject( uid );
                    isScopeDefinedOnAncestor = index !== 0;
                    return true;
                }
                return false;
            } );

            return {
                subsetDefObject,
                buildElement,
                isScopeDefinedOnAncestor
            };
        }
    );
}

/**
 * @param {ModelObject[]} planningScopeModelObjects - array of Build Elements
 * @return {Object[]} - array of relation data
 *
 */
export function getRelatedProductScopeAndRelation( planningScopeModelObjects ) {
    return ngpRelationSvc.getSecondaryRelation( planningScopeModelObjects, [ ngpPropConstants.PRODUCT_SCOPE_RELATION ] ).then(
        ( uidToRelationshipData ) => {
            const relationDataArray = [];
            planningScopeModelObjects.forEach( ( productObject ) => {
                const relationshipData = uidToRelationshipData[ productObject.uid ];
                if ( relationshipData ) {
                    const relationData = _.find( relationshipData, ( data ) => data.relationName === ngpPropConstants.PRODUCT_SCOPE_RELATION );
                    if( relationData && Array.isArray( relationData.relationshipObjects ) && relationData.relationshipObjects.length > 0 ) {
                        relationDataArray.push( {
                            planningScope: productObject,
                            relation: relationData.relationshipObjects[ 0 ].relation,
                            productScope: relationData.relationshipObjects[ 0 ].otherSideObject
                        } );
                    }
                }
            } );
            return relationDataArray;
        }
    );
}

/**
 *
 * @param {ModelObject} subsetDefinition - subset definition
 * @return {Promise} - a promise object
 *
 */
function getPartitionsFromSubset( subsetDefinition ) {
    if ( subsetDefinition ) {
        const getRecipesInput = {
            recipeContainers: [ subsetDefinition ]
        };
        mfePolicyService.register( 'ngpSchemePolicy', ngpSchemePolicy );
        return ngpSoaSvc.executeSoa( 'ModelCore-2011-06-Search', 'getRecipes', getRecipesInput ).then(
            ( response ) => {
                mfePolicyService.unregister( 'ngpSchemePolicy' );
                let partitionUids = [];
                const searchRecipe = _.find( response.searchRecipes, ( searchRecipe ) => searchRecipe.recipeContainer.uid === subsetDefinition.uid );
                if ( searchRecipe ) {
                    const recipe = searchRecipe.recipe;
                    partitionUids = getPartitionsFromRecipeSearchExpression( recipe.searchExpression );
                }
                return partitionUids;
            } );
    }
}

/**
 *
 * @param {object} searchExpression - an object
 * @returns {ModelObject[]} - an Array of partitions
 */
function getPartitionsFromRecipeSearchExpression( searchExpression ) {
    if ( searchExpression.searchExpression && searchExpression.searchExpression.searchExpressions ) {
        return getPartitionsFromSearchExpression( searchExpression.searchExpression.searchExpressions );
    }
    if ( searchExpression.searchExpressionSets ) {
        return getPartitionsFromSearchExpressionSets( searchExpression.searchExpressionSets );
    }
    return [];
}

/**
 *
 * @param {ModelObject} searchExpression - search expression
 * @return {ModelObject[]} - an Array of partitions
 *
 */
function getPartitionsFromSearchExpression( searchExpression ) {
    let partitions = [];
    searchExpression.every( ( modelObj ) => {
        if( mfeTypeUtils.isOfType( modelObj, ngpModelConstants.SEARCH_PARTITION_TYPE ) ) {
            const selectedContent = cdm.getObject( modelObj.props[ ngpPropConstants.PARTITION_OBJ_CRITERIA ].dbValues[ 0 ] );
            partitions = selectedContent.props[ ngpPropConstants.SELECTED_CONTENTS ].dbValues;
        }
        return partitions.length === 0;
    } );
    return partitions;
}

/**
 *
 * @param {object[]} searchExpressionSets - an array of search expressions
 *  @return {ModelObject[]} - an Array of partitions
 */
function getPartitionsFromSearchExpressionSets( searchExpressionSets ) {
    let partitions = [];
    searchExpressionSets.every( ( searchExpression ) => {
        partitions = getPartitionsFromSearchExpression( searchExpression.searchExpression.searchExpressions );
        return partitions.length === 0;
    } );
    return partitions;
}

/**
 *
 * @param {ModelObject} subsetDefinition - subset definition object
 * @param {String}  partitionSchemeType - partition scheme type
 * @return {Promise} promise - a promise object
 */
function getPartitionScheme( subsetDefinition, partitionSchemeType ) {
    const inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Fgf0PartitionSchemeProvider',
            searchCriteria: {
                uid: subsetDefinition.uid,
                searchString: ''
            },
            searchFilterFieldSortType: 'Priority',
            startIndex: 0
        }
    };

    return ngpSoaSvc.executeSoa( 'Query-2014-11-Finder', 'performSearch', inputData ).then(
        ( response ) => _.find( response.searchResults, ( obj ) => mfeTypeUtils.isOfType( obj, partitionSchemeType ) )
    );
}

/**
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {Object} dataProvider - the data provider
 * @param {Object} sortCriteria - the sort criteria object
 * @param {ModelObject} planningScopeModelObject - the planning scope model object
 * @return {Promise} - a promise object
 *
 */
export function loadTableData( treeLoadInput, dataProvider, sortCriteria, planningScopeModelObject ) {
    if ( !planningScopeModelObject ) {
        return new Promise( ( res ) => {
            const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, [], false, true, true, null );
            res( { treeLoadResult } );
        } );
    }
    const filterMode = appCtxSvc.getCtx( 'ngp.filterAssignedMode' );
    let nodeToExpand = treeLoadInput.parentNode;
    nodeToExpand.cursorObject = {
        startReached: true,
        endReached: false
    };
    nodeToExpand.hasAlreadyBeenExpanded = true;
    const scopeObject = nodeToExpand.uid === 'top' ? null : nodeToExpand;
    return getAssignmentData( scopeObject, dataProvider, sortCriteria, planningScopeModelObject ).then(
        ( result ) => {
            let assignedObjects = result.output[ 0 ].assignedObjects;
            if ( !assignedObjects ) {
                nodeToExpand.isLeaf = true;
                nodeToExpand.cursorObject.endReached = true;
                return new Promise( ( res ) => {
                    const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, [], false, true, true, null );
                    res( { treeLoadResult } );
                } );
            }
            let childTreeNodes = [];
            assignedObjects.forEach( ( object, index ) => {
                if( object.props !== undefined ) {
                    const isLeaf = ngpTypeUtils.isPartition( object ) ? false :
                        !( object.props[ ngpPropConstants.IS_LEAF ] && object.props[ ngpPropConstants.IS_LEAF ].dbValues[ 0 ] === '0' );
                    let treeNodeObject = mfeTableService.getTreeNodeObject( object, nodeToExpand, isLeaf, index );
                    const clientRequiredInfo = result.output[ 0 ].assignObjClientRequiredInfo[ index ];
                    populateClientColumns( treeNodeObject, clientRequiredInfo, dataProvider.columnConfig.columns );
                    treeNodeObject.isOpaque = filterMode && clientRequiredInfo.stringInfo.AssignmentCoverageStatus === assignedAndPartiallyAssignedByDescendants;
                    childTreeNodes.push( treeNodeObject );
                }
            } );
            nodeToExpand.isLeaf = childTreeNodes.length === 0;
            result.output[ 0 ].finished ? nodeToExpand.cursorObject.endReached = true : nodeToExpand.cursorObject.endReached = false;
            const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childTreeNodes, true, true, nodeToExpand.cursorObject.endReached, null );
            return {
                treeLoadResult
            };
        }
    );
}

/**
 * @param {Object} scopeObject node to expand
 * @param {Object} dataProvider - the data provider
 * @param {Object} sortCriteria - the sort criteria object
 * @param {ModelObject} planningScopeModelObject - the planning scope model object
 * @return {Promise} - a promise object
 */
function getAssignmentData( scopeObject, dataProvider, sortCriteria, planningScopeModelObject ) {
    let clientRequiredInformation = getClientRequiredInfo( dataProvider );
    // pass client required info GRAPHICS_INFORMATION to the server to inform it to return elements from the product scope and not the assigned elements
    clientRequiredInformation.push( ngpClientRequiredInfoConstants.GRAPHICS_INFORMATION );
    let filterCriteria = [];
    const filterMode = appCtxSvc.getCtx( 'ngp.filterAssignedMode' );
    if( filterMode === undefined ) {
        appCtxSvc.updatePartialCtx( 'ngp.filterAssignedMode', false );
    }
    if( filterMode ) {
        filterCriteria.push( {
            filterName: assignmentFilter,
            filterValues: [ unassigned, assignedAndPartiallyAssignedByDescendants ]
        } );
        clientRequiredInformation.push( ngpClientRequiredInfoConstants.ASSIGNMENT_COVERAGE_STATUS );
        addOpaqueCellRenderers( dataProvider.cols );
    }
    let sortOptions = [];
    if( Array.isArray( sortCriteria ) && sortCriteria.length > 0 ) {
        sortOptions = [ {
            sortAttribute: sortCriteria[ 0 ].fieldName,
            ascending: sortCriteria[ 0 ].sortDirection === 'ASC'
        } ];
    }
    const soaInput = {
        input: [ {
            context: planningScopeModelObject,
            clientRequiredInformation: clientRequiredInformation,
            scope: scopeObject,
            searchOptions: {
                sortOptions : sortOptions,
                startFrom: null,
                pageSize: 0
            },
            filterCriteria: filterCriteria
        } ]
    };
    return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getAssignmentData', soaInput, getAssignmentDataOptions() );
}

/**
 *
 * @param {object[]} columns - an array of column objects
 */
function addOpaqueCellRenderers( columns ) {
    columns.forEach( ( column ) => {
        if ( !column.cellRenderers ) {
            column.cellRenderers = [];
        }
        if ( column.cellRenderers.findIndex( ( renderer ) => renderer.name === 'opaqueRowRenderer' ) === -1 ) {
            column.cellRenderers.unshift( mfeTableService.getRowRenderer( 'aw-widgets-partialVisibility', 'opaqueRowRenderer', isOpaque ) );
        }
    } );
}

/**
 * @param {object} column - column configuration
 * @param {object} rowVMO - row vmo
 * @return {Boolean} isOpaque - returns true if the partial visibility for row vmo is set
 */
function isOpaque( column, rowVMO ) {
    return rowVMO.isOpaque;
}

/**
 *
 * @param {modelObject[]} newContextArray - the array of new context objects
 * @param {modelObject} currentContext - the current context
 * @returns {object} - an object with the new context and true if there was an actual change
 */
export function handleProductSourceContextChangeRequest( newContextArray, currentContext ) {
    let newPotentialBuildElement;
    if( Array.isArray( newContextArray ) && newContextArray.length > 1 || !ngpTypeUtils.isBuildElement( newContextArray[ 0 ] ) ) {
        newPotentialBuildElement = currentContext;
    } else {
        newPotentialBuildElement = newContextArray[ 0 ];
    }

    const contextHasChanged = currentContext ? ngpDataUtils.getFoundationId( currentContext ) !== ngpDataUtils.getFoundationId( newPotentialBuildElement ) : true;

    return {
        newPotentialBuildElement,
        contextHasChanged
    };
}

/**
 *
 * @param {Object[]} updatedProductScope
 * @param {Object} currentProductContext
 * @returns {boolean} - found product scope
 */
export function checkRelatedPartitionsUpdated( updatedProductScope, currentProductContext ) {
    const foundProductScope = updatedProductScope.filter( ( productScope ) =>
        productScope && currentProductContext &&
        ngpDataUtils.getFoundationId( productScope ) === ngpDataUtils.getFoundationId( currentProductContext ) );

    return foundProductScope.length > 0;
}

/**
 * Initialize the product scope data to show no product found
 *
 * @returns {Object} - the product scope data initialized to display empty Product Scope
 */
export function updateProductScopeDataForRemove() {
    return {
        subsetDefinition: null,
        productSourceContext: null,
        productScopeFromStorage: null,
        tabDisplayMode: 'ShowNoProductFound'
    };
}

/**
 *
 * @param {Object} removedUids -uids to remove
 * @param {Object} currentSubsetDefObject -subset
 * @param {Object} currentProductContext,- product conetxt
 * @param {Object} productScopeFromStorage,- product from storage
 * @param {String} tabDisplayMode - the tab disblay mode
 * @param {String} storageKey - the key in local storage
 * @returns {Object} - the object which conatins the updated subsetDefinition, and flag for reload
 */
export function checkObjectDeleted( removedUids, currentSubsetDefObject, currentProductContext, productScopeFromStorage, tabDisplayMode, storageKey ) {
    if ( removedUids && removedUids.length > 0 ) {
        removedUids = removedUids.map( uid => ngpDataUtils.getFoundationIdFromUid( uid ) );
    }
    let retValue = {
        subsetDefinition: currentSubsetDefObject,
        productSourceContext: currentProductContext,
        productScopeFromStorage: productScopeFromStorage,
        tabDisplayMode
    };

    if ( removedUids && currentProductContext && removedUids.length > 0 && removedUids.indexOf( ngpDataUtils.getFoundationIdFromUid( currentProductContext.uid ) ) >= 0 ) {
        retValue = updateProductScopeDataForRemove();
        ngpStorageService.removeItemFromLocalStorage( storageKey );
    }
    return retValue;
}

/**
 * Get a Product Launch Info to be used by Open in Vis command
 *
 * @param {ModelObject} inputObject - the object to open
 * @return {Promise} - a promise object
 */
function getOpenInVisLaunchInfo( inputObject ) {
    const productLaunchInfo = {
        productContextInfo: inputObject,
        selections: []
    };
    openInVisProductContextInfoProvider.resetProductContextInfo();
    return new Promise( ( resolve ) => resolve( [ productLaunchInfo ] ) );
}

/**
 * @param {ModelObject} inputObject - the object to open
 */
export function ngpOpenProductInStandaloneVis( inputObject ) {
    openInVisProductContextInfoProvider.registerProductContextToLaunchVis( getOpenInVisLaunchInfo.bind( this, inputObject ) );
    import( 'js/Awv0VisualizationService' ).then( ( Awv0VisualizationService ) => Awv0VisualizationService.launchProduct() );
}

/**
 *
 * @param {Object} dataProvider - the table data provider
 * @param {String} object - the uid of the object
 * @param {Map} parentsMap - a map with parents of each object
 * @param {String[]} parentsToExpand - an array of uids of parent partitions to expand
 */
function getParentPartitionsToExpand( dataProvider, object, parentsMap, parentsToExpand ) {
    if( parentsMap.has( object ) ) {
        for( let parentUid of parentsMap.get( object ).values() ) {
            const parent = findVmo( dataProvider, parentUid );
            if( parent ) {
                parentsToExpand.push( parentUid );
                return;
            }
        }
        for( let parentUid of parentsMap.get( object ).values() ) {
            getParentPartitionsToExpand( dataProvider, parentUid, parentsMap, parentsToExpand );
            if( parentsToExpand.length > 0 ) {
                parentsToExpand.push( parentUid );
                return;
            }
        }
    }
}

/**
 *
 * @param {String[]} chain - an array with the ids of a selected element
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @param {Set} notFoundTopElements - a set of not found top elements
 * @param {Map} elementIDsToExpand - a map from level to set of element IDs
 * @returns {Promise} promise
 */
function collectElementsToExpand( chain, dataProvider, viewModelData, notFoundTopElements, elementIDsToExpand ) {
    // iterate the chain in reverse (top-down) order
    for( let i = -1; i >= -chain.length; i-- ) {
        const vmo = findElement( dataProvider, chain.at( i ) );
        if( !vmo ) {
            if( i === -1 ) {
                notFoundTopElements.add( chain.at( i ) );
            } else {
                if( !elementIDsToExpand.has( -( i + 1 ) ) ) {
                    elementIDsToExpand.set( -( i + 1 ), new Set() );
                }
                elementIDsToExpand.get( -( i + 1 ) ).add( chain.at( i + 1 ) );
            }
            // if current element is not visible then add all the elemnts below it (except the lowest one) to elementIDsToExpand, since they are for sure not expanded yet
            for( let j = i; j > -chain.length; j-- ) {
                if( !elementIDsToExpand.has( -j ) ) {
                    elementIDsToExpand.set( -j, new Set() );
                }
                elementIDsToExpand.get( -j ).add( chain.at( j ) );
            }
            break;
        }
        if( vmo  && vmo.__expandState ) {
            const newChain = chain.slice( 0, i );
            return mfeTableService.expandTreeNode( dataProvider, vmo, viewModelData ).then( () => collectElementsToExpand( newChain, dataProvider, viewModelData ) );
        }
    }
    return new Promise( ( res ) => res() );
}

/**
 *
 * @param {String[]} selectionArray - an array of string arrays, with the ids chain of the selected elements
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @returns {Promise} promise
 */
function loadData( selectionArray, dataProvider, viewModelData ) {
    let notFoundTopElements = new Set();
    let elementIDsToExpand = new Map(); // map from level to set of element IDs
    let promiseArray = [];
    selectionArray.forEach( ( chain ) => {
        promiseArray.push( collectElementsToExpand( chain, dataProvider, viewModelData, notFoundTopElements, elementIDsToExpand ) );
    } );
    return Promise.all( promiseArray ).then( () =>
        expandParentPartitions( notFoundTopElements, dataProvider, viewModelData ).then( ( idMap ) => {
            const levels = Array.from( elementIDsToExpand.keys() );
            levels.sort();
            return levels.reduce( ( previousPromise, level ) => previousPromise.then( ( idMap ) => {
                let objectsToExpand = [];
                for( const id of elementIDsToExpand.get( level ) ) {
                    let uid = undefined;
                    if( idMap ) {
                        uid = idMap.get( id );
                    }
                    if( uid !== undefined ) {
                        objectsToExpand.push( uid );
                    } else {
                        const vmo = findElement( dataProvider, id );
                        if( vmo ) {
                            objectsToExpand.push( vmo.uid );
                        }
                    }
                }
                return expandOneLevel( objectsToExpand, dataProvider, viewModelData );
            } ), Promise.resolve( idMap ) );
        } )
    );
}

/**
 *
 * @param {String[]} objectsToExpand - an array with uids of objects to expand
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @returns {Promise} promise - a promise object
 * */
function expandOneLevel( objectsToExpand, dataProvider, viewModelData ) {
    return bulkGetAssignmentData( viewModelData.productScopeData.buildElement, objectsToExpand, viewModelData.columnProviders.ngpProductScopeTableColumnProvider.sortCriteria ).then(
        ( assignmentDataMap ) => {
            objectsToExpand.forEach( ( object ) => {
                const vmo = findVmo( dataProvider, object );
                if( vmo && !vmo.isExpanded ) {
                    const assignmentData = assignmentDataMap.get( object );
                    if( assignmentData ) {
                        vmo.isExpanded = true;
                        const isLeafFunc = ( modelObj ) => !( modelObj.props[ ngpPropConstants.IS_LEAF ] && modelObj.props[ ngpPropConstants.IS_LEAF ].dbValues[ 0 ] === '0' );
                        mfeTableService.appendChildNodes( vmo, assignmentData.assignedObjects, dataProvider, isLeafFunc );
                        nodesToUpdate.push( ...assignmentData.assignedObjects );
                    }
                }
            } );
            return new Promise( ( res ) => res() );
        } );
}

/**
 * updateSelectionData
 * @param {String} selectedObjectID - the selected object ID
 * @param {ViewModelTreeNode} treeNode - the tree node if found
 * @param {ViewModelTreeNode[]} selectedObjects - an array of the found vmos
 * @param {String[]} notFoundObjects - an array with IDs of the not found objects
 */
function updateSelectionData( selectedObjectID, treeNode, selectedObjects, notFoundObjects ) {
    if( treeNode ) {
        selectedObjects.push( treeNode );
    } else if( selectedObjectID ) {
        notFoundObjects.push( selectedObjectID.toString() );
    }
}

/**
 * updateSelectionFromVis
 * @param {String[]} selectionArray - an array of string arrays, with the ids chain of the selected elements
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 */
export function updateSelectionFromVis( selectionArray, dataProvider, viewModelData ) {
    if( selectionArray.length === 0 ) {
        dataProvider.selectionModel.setSelection( [] );
    } else if( dataProvider.topTreeNode.children ) {
        loadData( selectionArray, dataProvider, viewModelData ).then( () => {
            let selectedObjects = [];
            let notFoundObjects = [];
            return selectionArray.reduce( ( previousPromise, selection ) => previousPromise.then( ( result ) => {
                if( result ) {
                    updateSelectionData( result.selectedObjectID, result.treeNode, selectedObjects, notFoundObjects );
                }
                return findSelectionInTree( selection, dataProvider, viewModelData );
            } ), Promise.resolve() ).then( ( { selectedObjectID, treeNode } ) => {
                updateSelectionData( selectedObjectID, treeNode, selectedObjects, notFoundObjects );
                return updateClientColumns( nodesToUpdate, viewModelData.productScopeData.buildElement, dataProvider ).then( () => {
                    nodesToUpdate = [];
                    if( selectedObjects.length > 0 ) {
                        dataProvider.selectionModel.setSelection( selectedObjects );
                    }
                    if( notFoundObjects.length > 0 ) {
                        if( notFoundObjects.length === 1 ) {
                            messagingService.showInfo( '"{0}" was not found.'.format( notFoundObjects[ 0 ] ) );
                        } else if( notFoundObjects.length > 1 ) {
                            messagingService.showInfo( 'The following objects were not found: {0}'.format( notFoundObjects.join() ) );
                        }
                    }
                } );
            } );
        } );
    }
}

/**
 * expandPartitionsHierarchy
 * @param {ViewModelTreeNode[]} nodes - an array of ViewModelTreeNodes
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @returns {Promise} - a promise object
 */
function expandPartitionsHierarchy( nodes, dataProvider, viewModelData ) {
    let promise = new Promise( ( res ) => res() );
    if ( nodes ) {
        let result = nodes.reduce( ( previousPromise, node ) => previousPromise.then(
            () => expandPartitionHierarchy( node, dataProvider, viewModelData ) ), Promise.resolve() );

        return result.then( () => promise );
    }
    return promise;
}

/**
 * expandPartitionHierarchy
 * @param {ViewModelTreeNode} node - a ViewModelTreeNode
 * @param {Object} dataProvider - the table data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @returns {Promise} - a promise object
 */
function expandPartitionHierarchy( node, dataProvider, viewModelData ) {
    if( !node.isLeaf && ngpTypeUtils.isPartition( node ) ) {
        if( node.isExpanded ) {
            return expandPartitionsHierarchy( node.children, dataProvider, viewModelData );
        }
        return mfeTableService.expandTreeNode( dataProvider, node, viewModelData ).then(
            () => expandPartitionsHierarchy( node.children, dataProvider, viewModelData ) );
    }
    return new Promise( ( res ) => res() );
}

/**
 *
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @param {String} uid - element uid
 * @returns {ViewModelTreeNode} - the vmo if found
 */
function findVmo( dataProvider, uid ) {
    return dataProvider.viewModelCollection.loadedVMObjects.find( ( vmo ) => vmo.uid === uid );
}

/**
 *
 * @param {Object} dataProvider the data provider
 * @param {String} elementID - element ID
 * @returns {ViewModelTreeNode} - the vmo if found
 */
function findElement( dataProvider, elementID ) {
    return dataProvider.viewModelCollection.loadedVMObjects.find( vmo => vmo.props[ ngpPropConstants.DESIGN_ELEMENT_ID ] && vmo.props[ ngpPropConstants.DESIGN_ELEMENT_ID ].dbValue === elementID );
}

/**
 *
 * @param {String[]} selection the selection
 * @param {Object} dataProvider the data provider
 * @param {Object} viewModelData - the data of the view model which uses this service
 * @returns {Promise} - a promise resolved with the found vmo
 */
function findSelectionInTree( selection, dataProvider, viewModelData ) {
    const selectedObjectID = selection[ 0 ];
    const treeNode = findElement( dataProvider, selectedObjectID );
    if( !treeNode ) {
        for( let i = 1; i < selection.length; i++ ) {
            const vmo = findElement( dataProvider, selection[ i ] );
            if( vmo ) {
                if( !vmo.isExpanded ) {
                    return mfeTableService.expandTreeNode( dataProvider, vmo, viewModelData ).then(
                        () => findSelectionInTree( selection, dataProvider, viewModelData ) );
                }
                if( vmo.cursorObject && !vmo.cursorObject.endReached ) {
                    return dataProvider.getTreeNodePage( { data: viewModelData }, vmo, _.last( vmo.children ).id, true ).then(
                        () => findSelectionInTree( selection, dataProvider, viewModelData ) );
                }
                break;
            }
        }
    }
    return new Promise( ( res ) => res( { selectedObjectID, treeNode } ) );
}

/**
 *
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @return {Boolean} - True if the data provider includes any of the client columns, False - otherwise
 */
function hasClientColumn( dataProvider ) {
    return dataProvider.columnConfig ? dataProvider.columnConfig.columns.some( ( column ) => ClientColumns.includes( column.name ) ) : false;
}

/**
 *
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @param {Object} contextObject - the product scope context
 * @param {ViewModelTreeNode} currentNodeExpanded - ViewModelTreeNode from where to update
 */
export function updateStatuses( dataProvider, contextObject, currentNodeExpanded = undefined ) {
    const clientColumnExist = hasClientColumn( dataProvider );
    if( contextObject && clientColumnExist ) {
        const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        if( loadedObjects.length > 0 ) {
            let modelObjects = loadedObjects.filter( ( loadedObject ) => !ngpTypeUtils.isPartition( loadedObject ) ).map(
                ( filteredObject ) => cdm.getObject( filteredObject.uid ) );
            if ( currentNodeExpanded ) {
                const allLoadedDescendants = mfeTableService.getAllDescendantTreeNodes( currentNodeExpanded ).filter(
                    ( descendant ) => loadedObjects.find( node => node.uid === descendant.uid )
                );
                modelObjects = allLoadedDescendants.map( ( loadedDescendant ) => cdm.getObject( loadedDescendant.uid ) );
            }
            updateClientColumns( modelObjects, contextObject, dataProvider );
        }
    }
}

/**
 *
 * @param {ModelObject[]} modelObjects - an array of mode objects
 * @param {Object} contextObject - the product scope context
 * @param {Object} dataProvider - the data provider
 * @returns {Promise} - a promise object
 */
function updateClientColumns( modelObjects, contextObject, dataProvider ) {
    const promise = new Promise( ( res ) => res() );
    if( modelObjects.length > 0 ) {
        const clientRequiredInfo = getClientRequiredInfo( dataProvider );
        return ngpClientRequiredInfoSvc.getClientRequiredInfo( contextObject, modelObjects, clientRequiredInfo ).then( ( result ) => {
            const { objects, objectsInfos } = result;
            let assignedToObjects = [];
            objectsInfos.forEach( ( info ) => Object.values( info.tagArrayInfo ).forEach( ( array ) => assignedToObjects.push( ...array ) ) );
            const assignedToObjectsUids = assignedToObjects.map( ( obj ) => obj.uid );
            return ngpLoadService.ensureObjectsLoaded( assignedToObjectsUids ).then( () => {
                const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
                objects.forEach( ( object, index ) => {
                    const treeNodeObject = loadedObjects.find( node => node.uid === object.uid );
                    if( treeNodeObject ) {
                        populateClientColumns( treeNodeObject, objectsInfos[ index ], dataProvider.columnConfig.columns );
                    }
                } );
                mfeTableService.refreshTable( 'ngpProductScopeTable' );
                return promise;
            } );
        } );
    }
    return promise;
}

/**
 * @param {modelObject[]} subsetDefinitions - an array with subset definitions
 * @return {Strings[]} revision rule names
 */
export function getCurrRevRulesFromSubsets( subsetDefinitions ) {
    if( subsetDefinitions ) {
        let configCtxUids;
        const subsetDefinitionUids = subsetDefinitions.map( ( subsetDefinition ) => subsetDefinition.uid );
        return ngpLoadService.getPropertiesAndLoad( subsetDefinitionUids, [ ngpPropConstants.SUBSET_DEF_CONFIG_CONTEXT ] )
            .then(
                () => {
                    configCtxUids = subsetDefinitions.map( ( subsetDefinition ) => subsetDefinition.props[ ngpPropConstants.SUBSET_DEF_CONFIG_CONTEXT ].dbValues[ 0 ] );
                    return ngpLoadService.getPropertiesAndLoad( configCtxUids, [ ngpPropConstants.REVISION_RULE ] );
                } )
            .then( () => {
                // we need to load the configuration context in order to refresh its properties which are not updated after set Product Subsets From Partitions
                mfePolicyService.register( 'ngpConfigContextPolicy', ngpConfigContextPolicy );
                return ngpLoadService.loadObjects( configCtxUids )
                    .then( () => {
                        mfePolicyService.unregister( 'ngpConfigContextPolicy' );
                        return configCtxUids.map(
                            ( configCtxUid ) => ngpAssociatePartitionsService.fixCurrRevRuleStr( cdm.getObject( configCtxUid ).props[ ngpPropConstants.REVISION_RULE ].uiValues[ 0 ] ) );
                    } );
            } );
    }
    return new Promise( ( res ) => res( '' ) );
}

/**
 *
 * @param {Object} dataProvider - the dataprovider created in the viewModel
 * @return {String[]} array of client required info values
 */
function getClientRequiredInfo( dataProvider ) {
    let clientRequiredInfo = [];
    ClientColumns.forEach( ( columnName ) => {
        if( dataProvider.columnConfig.columns.some( ( column ) => column.name === columnName ) ) {
            switch ( columnName ) {
                case 'assignmentIndication':
                    clientRequiredInfo.push( ...ngpAssignmentSvc.clientRequiredInformation );
                    break;
                case 'MismatchStatus':
                    clientRequiredInfo.push( ngpClientRequiredInfoConstants.MISMATCH_STATUS_KEY );
                    break;
                case 'AssignedToBuildElements':
                    clientRequiredInfo.push( ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INCURRENTSCOPE );
                    clientRequiredInfo.push( ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INOTHERSCOPE );
                    break;
                case 'AssignedToActivities':
                    clientRequiredInfo.push( ngpClientRequiredInfoConstants.USED_IN_ACTIVITY );
                    break;
                case 'AssignedToProcesses':
                    clientRequiredInfo.push( ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INCURRENTSCOPE );
                    clientRequiredInfo.push( ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INOTHERSCOPE );
                    break;
                default:
                    break;
            }
        }
    } );
    // remove duplicates
    return clientRequiredInfo.filter( ( value, index ) => clientRequiredInfo.indexOf( value ) === index );
}

/**
 *
 * @param {Object} treeNodeObject - the tree node object
 * @param {Object} clientRequiredInfo - the clientRequiredInfo
 * @param {Object[]} columns - the current columns of the table
 */
function populateClientColumns( treeNodeObject, clientRequiredInfo, columns ) {
    if( clientRequiredInfo ) {
        ClientColumns.forEach( ( columnName ) => {
            if( columns.some( ( column ) => column.name === columnName ) ) {
                let propValue;
                let propTypeIsArray = true;
                switch ( columnName ) {
                    case 'assignmentIndication':
                        propValue = clientRequiredInfo.tagArrayInfo ? ngpAssignmentSvc.getAssignmentStatus( clientRequiredInfo.tagArrayInfo ) : '';
                        propTypeIsArray = false;
                        treeNodeObject.assignment_array = clientRequiredInfo.tagArrayInfo;
                        break;
                    case 'MismatchStatus':
                        propValue = clientRequiredInfo.stringInfo ? clientRequiredInfo.stringInfo[ ngpClientRequiredInfoConstants.MISMATCH_STATUS_KEY ] : '';
                        propTypeIsArray = false;
                        break;
                    case 'AssignedToBuildElements':
                        propValue = clientRequiredInfo.tagArrayInfo ? clientRequiredInfo.tagArrayInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INCURRENTSCOPE ].concat(
                            clientRequiredInfo.tagArrayInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_BUILDELEMENTS_INOTHERSCOPE ] ) : [];
                        propValue = propValue.map( ( object ) => object.props[ ngpPropConstants.OBJECT_STRING ].dbValues[0] );
                        break;
                    case 'AssignedToActivities':
                        propValue = clientRequiredInfo.tagArrayInfo ? clientRequiredInfo.tagArrayInfo[ ngpClientRequiredInfoConstants.USED_IN_ACTIVITY ] : [];
                        propValue = propValue.map( ( object ) => object.props[ ngpPropConstants.OBJECT_STRING ].dbValues[0] );
                        break;
                    case 'AssignedToProcesses':
                        propValue = clientRequiredInfo.tagArrayInfo ? clientRequiredInfo.tagArrayInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INCURRENTSCOPE ].concat(
                            clientRequiredInfo.tagArrayInfo[ ngpClientRequiredInfoConstants.ASSIGNEDTO_PROCESSES_INOTHERSCOPE ] ) : [];
                        propValue = propValue.map( ( object ) => object.props[ ngpPropConstants.OBJECT_STRING ].dbValues[0] );
                        break;
                    default:
                        break;
                }
                var propAttrHolder = {
                    displayName: columnName,
                    type: 'STRING',
                    isArray: propTypeIsArray,
                    dbValue: propValue,
                    dispValue: propValue
                };
                treeNodeObject.props[ columnName ] = modelPropertySvc.createViewModelProperty( propAttrHolder );
            }
        } );
    }
}

/**
 *
 * @param {ViewModelObject} vmo - the VMO which represents the row the cell exists it
 * @param {DOMElement} containerElement - DOMElement that should contain the image
 */
export function renderMismatchStatusCellImage( vmo, containerElement ) {
    if( !vmo.props[ ngpClientRequiredInfoConstants.MISMATCH_STATUS_KEY ] ) {
        return;
    }
    let imageUrl;
    switch ( vmo.props[ ngpClientRequiredInfoConstants.MISMATCH_STATUS_KEY ].dbValue ) {
        case ngpClientRequiredInfoConstants.MISMATCH_STATUS_VALUE:
            imageUrl = `${getBaseUrlPath()}/image/indicatorMismatch16.svg`;
            break;
        case ngpClientRequiredInfoConstants.FALSE_POSITIVE_STATUS_VALUE:
            imageUrl = `${getBaseUrlPath()}/image/indicatorRevisedNotChanged16.svg`;
            break;
        default:
            break;
    }
    if( imageUrl ) {
        const element = createAndAppendIconCellElement( imageUrl, containerElement );
        element.addEventListener( 'mouseover', onHover.bind( this, element, vmo.props[ ngpClientRequiredInfoConstants.MISMATCH_STATUS_KEY ].dbValue ) );
        element.addEventListener( 'mouseout', mfeTooltipUtils.hideCellIconIndicationTooltip );
    }
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
    parentElement.appendChild( cellImage );
    return cellImage;
}

/**
 *
 * @param {DomElement} element - the dom element we hover over
 * @param {string} status - the mismatch status of the given vmo
 */
function onHover( element, status ) {
    const tooltipObj = {};
    switch( status ) {
        case ngpClientRequiredInfoConstants.MISMATCH_STATUS_VALUE:
            tooltipObj.title = buildStrategyLocalizedMsgs.mismatchMessage;
            break;
        case ngpClientRequiredInfoConstants.FALSE_POSITIVE_STATUS_VALUE:
            tooltipObj.title = buildStrategyLocalizedMsgs.revisedButNotChanged;
            break;
        default:
            break;
    }
    mfeTooltipUtils.displayCellIconIndicationTooltip( element, tooltipObj );
}

/**
 *
 * @param {Set} notFoundTopElements - a set of not found top elements
 * @param {Object} dataProvider - the data provider
 * @param {Object} viewModelData - the view model data
 * @returns {Promise} - a promise object
 */
function expandParentPartitions( notFoundTopElements, dataProvider, viewModelData ) {
    const promise = new Promise( ( res ) => res() );
    if( notFoundTopElements.size > 0 ) {
        return getParentPartitions( notFoundTopElements, viewModelData ).then( ( { idMap, parentsMap } ) => {
            let parentsToExpandSet = new Set();
            let parentToExpandMap = new Map();
            for( const id of notFoundTopElements.values() ) {
                const uid = idMap.get( id );
                let parentsToExpand = [];
                getParentPartitionsToExpand( dataProvider, uid, parentsMap, parentsToExpand );
                parentToExpandMap.set( id, parentsToExpand );
                parentsToExpand.forEach( ( parent ) => parentsToExpandSet.add( parent ) );
            }
            const objectsToExpand = Array.from( parentsToExpandSet );
            return bulkGetAssignmentData( viewModelData.productScopeData.buildElement, objectsToExpand ).then( ( assignmentDataMap ) => {
                for( const id of notFoundTopElements.values() ) {
                    expandUntilFound( idMap.get( id ), parentToExpandMap.get( id ), dataProvider, assignmentDataMap );
                }
                return promise;
            } );
        } );
    }
    return promise;
}

/**
 *
 * @param {Set} elementIDs - a Set of element IDs
 * @param {Object} viewModelData - the view model data
 * @returns {Promise} - a promise object
*/
function getParentPartitions( elementIDs, viewModelData ) {
    if( elementIDs.size > 0 ) {
        const modelUid = viewModelData.productScopeData.subsetDefObject.props.mdl0model_object.dbValues[ 0 ];
        const modelObject = cdm.getObject( modelUid );
        const configContextUid = viewModelData.productScopeData.subsetDefObject.props.fnd0configuration_context.dbValues[ 0 ];
        const configContext = cdm.getObject( configContextUid );
        return ngpSearchService.searchWherePartitioned( elementIDs, modelObject, configContext, viewModelData.partitionScheme );
    }
    return new Promise( ( res ) => res() );
}

/**
 *
 * @param {String} uid - the uid of the object to find
 * @param {String[]} parentsToExpand - an array of ids of parent partitions to expand (in top-down order)
 * @param {Object} dataProvider - the data provider
 * @param {Map} assignmentDataMap - a map from object to its assignment data
 */
function expandUntilFound( uid, parentsToExpand, dataProvider, assignmentDataMap ) {
    const vmo = findVmo( dataProvider, uid );
    if( !vmo ) {
        parentsToExpand.forEach( ( parentUid ) => {
            const parent = findVmo( dataProvider, parentUid );
            if( parent && !parent.isExpanded ) {
                const assignmentData = assignmentDataMap.get( parentUid );
                if( assignmentData ) {
                    parent.isExpanded = true;
                    const isLeafFunc = ( modelObj ) => !( modelObj.props[ ngpPropConstants.IS_LEAF ] && modelObj.props[ ngpPropConstants.IS_LEAF ].dbValues[ 0 ] === '0' );
                    mfeTableService.appendChildNodes( parent, assignmentData.assignedObjects, dataProvider, isLeafFunc );
                    nodesToUpdate.push( ...assignmentData.assignedObjects );
                }
            }
        } );
    }
}

/**
 *
 * @returns {Object} the options to getAssignmentData SOA
 */
function getAssignmentDataOptions() {
    if( productScopePolicy === null ) {
        productScopePolicy = ngpTableService.getEffectiveOverriddenPolicy();
    }
    return {
        errorsToIgnore : [ {
            description: 'User does not have READ permissions to this object.',
            errorNum: 214000,
            printError: false
        } ],
        propertyPolicyOverride: productScopePolicy
    };
}

/**
 *
 * @param {ModelObject} planningScopeModelObject - the planning scope model object
 * @param {String[]} objectsToExpand - an array with uids of objects to expand
 * @returns {Promise} - a promise
 */
function bulkGetAssignmentData( planningScopeModelObject, objectsToExpand, sortCriteria ) {
    if( objectsToExpand.length > 0 ) {
        let sortOptions = [];
        if( Array.isArray( sortCriteria ) && sortCriteria.length > 0 ) {
            sortOptions = [ {
                sortAttribute: sortCriteria[ 0 ].fieldName,
                ascending: sortCriteria[ 0 ].sortDirection === 'ASC'
            } ];
        }
        const soaInput = {
            input: objectsToExpand.map( ( object ) => {
                return {
                    context: planningScopeModelObject,
                    clientRequiredInformation: [ ngpClientRequiredInfoConstants.GRAPHICS_INFORMATION ],
                    scope: cdm.getObject( object ),
                    searchOptions: {
                        sortOptions : sortOptions,
                        startFrom: null,
                        pageSize: 0
                    },
                    filterCriteria: []
                };
            } )
        };
        return ngpSoaSvc.executeSoa( 'Internal-Process-2017-05-Assignment', 'getAssignmentData', soaInput, getAssignmentDataOptions() ).then( ( response ) => {
            let assignmentDataMap = new Map();
            response.output.forEach( ( data, index ) => {
                delete data.assignObjClientRequiredInfo;
                delete data.clientRequiredInfo;
                delete data.context;
                assignmentDataMap.set( objectsToExpand[ index ], data );
            } );
            return  assignmentDataMap;
        } );
    }
    return new Promise( ( res ) => res( ) );
}

let exports = {};
export default exports = {
    loadTableData,
    getProductScopeConfiguration,
    getProductSubsetConfiguration,
    getRelatedProductScopeAndRelation,
    handleProductSourceContextChangeRequest,
    ngpOpenProductInStandaloneVis,
    updateSelectionFromVis,
    checkRelatedPartitionsUpdated,
    checkObjectDeleted,
    updateStatuses,
    renderMismatchStatusCellImage,
    updateProductScopeDataForRemove,
    createOrUpdateProductSubsetsFromPartitions,
    getCurrRevRulesFromSubsets
};
