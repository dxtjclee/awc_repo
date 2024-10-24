//@<COPYRIGHT>@
//==================================================
//Copyright 2019.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/*global
 */

/**
 *
 *
 * @module js/Evm1RecipeSeedTreeTableService
 */
import vmcs from 'js/viewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import evm1RecipeBuilderService from 'js/Evm1RecipeBuilderService';
import clientMetaModel from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

var exports = {};

var expandTopBOMNodes = function( parentNode, seeds, levelNdx, rootChildNdx, data, treeNodes, recipeState ) {
    _.forEach( seeds, function( seed ) {
        var seedVMO = vmcs.createViewModelObject( seed.uid, 'EDIT' );
        var underLyingObjectVMO = vmcs.createViewModelObject( seedVMO.props.awb0UnderlyingObject.dbValues[ 0 ], 'EDIT' );
        var iconURL = underLyingObjectVMO.typeIconURL;
        var seedTreeNode = awTableTreeSvc.createViewModelTreeNode( seedVMO.uid, seedVMO.type, seedVMO.props.object_string.uiValues[ 0 ], levelNdx, rootChildNdx, iconURL );

        seedTreeNode.isLeaf = true;
        seedTreeNode.props = seedVMO.props;
        seedTreeNode.props.CustType = uwPropertyService.createViewModelProperty( 'CustType', data.i18n.evm1CategoryColumn,
            'STRING', data.i18n.Selection, [ data.i18n.Selection ] );

        var seedEvm1Include;

        if( recipeState ) {
            seedEvm1Include = recipeState.includeToggleMap[ seedVMO.uid ];
        }
        if( !seedEvm1Include ) {
            seedEvm1Include = uwPropertyService.createViewModelProperty( 'evm1Include', data.i18n.evm1IncludeColumn,
                'BOOLEAN', true, [ 'True' ] );
            seedEvm1Include.isEditable = true;
            seedEvm1Include.isEnabled = true;
            recipeState.includeToggleMap[ seedVMO.uid ] = seedEvm1Include;
        }
        seedTreeNode.props.evm1Include = seedEvm1Include;
        seedTreeNode.props.item_revision_id = underLyingObjectVMO.props.item_revision_id;
        seedTreeNode.props.owning_user = underLyingObjectVMO.props.owning_user;
        if( parentNode ) {
            seedTreeNode.props.evm1SeedParent = uwPropertyService.createViewModelProperty( 'evm1SeedParent', 'Parent',
                'STRING', parentNode.uid, [ parentNode.uid ] );
        }
        treeNodes.push( seedTreeNode );
        rootChildNdx += 1;
    } );
};

/**
 * This method is for creating the TreeTable for seed when we expand the tree node
 * @param {Object} data the view-model data
 * @returns {Object} outputData the outputData with TreeTable result
 */
export let getSeedTreeChildren = function( data ) {
    var treeLoadInput = awTableSvc.findTreeLoadInput( arguments );
    if( arguments[ 1 ] === undefined ) {
        return {
            treeLoadResult: ''
        };
    }
    var levelNdx = treeLoadInput.parentNode.levelNdx + 1;
    let recipeState = arguments[ 2 ];
    const newRecipeState = { ...recipeState };
    var treeNodes = [];
    var rootChildNdx = 0;
    var contextChildNdx = 0;

    treeLoadInput.displayMode = 'Tree';
    treeLoadInput.parentElement = treeLoadInput.parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : treeLoadInput.parentNode.uid;
    if( newRecipeState.context ) {
        if( levelNdx === 1 ) {
            _.forEach( newRecipeState.seedInfos, function( seedInfo ) {
                var rootElementModel = cdm.getObject( seedInfo.rootElement.uid );

                if( rootElementModel ) {
                    var rootElementVMO = vmcs.createViewModelObject( rootElementModel.uid, 'EDIT' );
                    var underLyingObjectVMO = cdm.getObject( rootElementVMO.props.awb0UnderlyingObject.dbValues[ 0 ] );
                    var custTypeTopBOM = data.i18n.evm1TOPBOMNode;
                    var iconURL = underLyingObjectVMO.typeIconURL;
                    var rootTreeNode = awTableTreeSvc.createViewModelTreeNode( rootElementVMO.uid, rootElementVMO.type,
                        rootElementVMO.props.object_string.uiValues[ 0 ], levelNdx, contextChildNdx, iconURL );

                    if( _.findIndex( newRecipeState.seedSelections, function( o ) { return o.uid === rootElementVMO.uid; } ) !== -1 ) {
                        custTypeTopBOM = data.i18n.evm1TOPBOMNodeAndSeed;
                        _.remove( seedInfo.seeds, function( seed ) {
                            return seed.uid === rootElementVMO.uid;
                        } );
                    }
                    rootTreeNode.isLeaf = !seedInfo.seeds || seedInfo.seeds && seedInfo.seeds.length === 0;
                    rootTreeNode.props = rootElementVMO.props;
                    rootTreeNode.props.CustType = uwPropertyService.createViewModelProperty( 'CustType', data.i18n.evm1CategoryColumn,
                        'STRING', custTypeTopBOM, [ custTypeTopBOM ] );

                    var rootEvm1Include = newRecipeState.includeToggleMap[ rootElementVMO.uid ];

                    if( !rootEvm1Include ) {
                        rootEvm1Include = uwPropertyService.createViewModelProperty( 'evm1Include', data.i18n.evm1IncludeColumn,
                            'BOOLEAN', true, [ 'True' ] );
                        rootEvm1Include.isEditable = true;
                        rootEvm1Include.isEnabled = true;
                        newRecipeState.includeToggleMap[ rootElementVMO.uid ] = rootEvm1Include;
                    }
                    rootTreeNode.props.evm1Include = rootEvm1Include;
                    rootTreeNode.props.item_revision_id = underLyingObjectVMO.props.item_revision_id;
                    rootTreeNode.props.owning_user = underLyingObjectVMO.props.owning_user;
                    if( treeLoadInput.parentNode ) {
                        rootTreeNode.props.evm1SeedParent = uwPropertyService.createViewModelProperty( 'evm1SeedParent', 'Parent',
                            'STRING', treeLoadInput.parentNode.uid, [ treeLoadInput.parentNode.uid ] );
                    }
                    treeNodes.push( rootTreeNode );
                    contextChildNdx += 1;
                }
            } );
        }
        // expand Top NOM Node
        else {
            _.forEach( newRecipeState.seedInfos, function( seedInfo ) {
                if( treeLoadInput.parentNode.uid === seedInfo.rootElement.uid ) {
                    rootChildNdx = 0;
                    expandTopBOMNodes( treeLoadInput.parentNode, seedInfo.seeds, levelNdx, rootChildNdx, data, treeNodes, newRecipeState );
                }
            } );
        }
    }
    // expand Top BOM Node
    else {
        _.forEach( newRecipeState.seedInfos, function( seedInfo ) {
            if( treeLoadInput.parentNode.uid === seedInfo.rootElement.uid ) {
                rootChildNdx = 0;
                expandTopBOMNodes( treeLoadInput.parentNode, seedInfo.seeds, levelNdx, rootChildNdx, data, treeNodes, newRecipeState );
            }
        } );
    }
    let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, treeNodes, false, true, true, null );

    recipeState.update && recipeState.update( newRecipeState );
    return {
        treeLoadResult: treeLoadResult
    };
};

/**
 * This method is for creating the TreeTable for seed
 * @param {Object} data the view-model data
 * @returns {Object} outputData the outputData with TreeTable result
 */
export let loadSeedTreeData = function( data ) {
    var treeLoadInput = awTableSvc.findTreeLoadInput( arguments );
    if( arguments[ 1 ] === undefined ) {
        return {
            treeLoadResult: ''
        };
    }
    var levelNdx = treeLoadInput.parentNode.levelNdx + 1;
    let recipeState = arguments[ 2 ];
    const newRecipeState = { ...recipeState };
    var treeNodes = [];
    var topChildNdx = 0;
    var rootChildNdx = 0;
    var contextChildNdx = 0;
    var iconURL = null;
    var contextTreeNode;

    treeLoadInput.displayMode = 'Tree';
    treeLoadInput.parentElement = treeLoadInput.parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : treeLoadInput.parentNode.uid;

    // Add Context node if there
    if( levelNdx === 0 ) {
        if( newRecipeState.context ) {
            var custTypeContext = data.i18n.evm1Context;

            if( _.findIndex( newRecipeState.seedSelections, function( o ) { return o.uid === newRecipeState.context.uid; } ) !== -1 ) {
                custTypeContext = data.i18n.evm1ContextAndSeed;
                _.remove( newRecipeState.seedInfos, function( seedInfo ) {
                    _.remove( seedInfo.seeds, function( seed ) {
                        return seed.uid === newRecipeState.context.uid;
                    } );
                    return seedInfo.seeds.length === 0;
                } );
            }

            iconURL = iconSvc.getTypeIconURL( newRecipeState.context.type );
            contextTreeNode = awTableTreeSvc.createViewModelTreeNode( newRecipeState.context.uid, newRecipeState.context.type, newRecipeState.context.props.object_string.uiValues[ 0 ],
                levelNdx, topChildNdx, iconURL );
            contextTreeNode.isLeaf = true;
            contextTreeNode.props = newRecipeState.context.props;
            contextTreeNode.props.CustType = uwPropertyService.createViewModelProperty( 'CustType', data.i18n.evm1CategoryColumn,
                'STRING', custTypeContext, [ custTypeContext ] );

            var evm1Include = newRecipeState.includeToggleMap[ newRecipeState.context.uid ];
            if( !evm1Include ) {
                evm1Include = uwPropertyService.createViewModelProperty( 'evm1Include', data.i18n.evm1IncludeColumn,
                    'BOOLEAN', true, [ 'True' ] );
                evm1Include.isEditable = true;
                evm1Include.isEnabled = true;
                newRecipeState.includeToggleMap[ newRecipeState.context.uid ] = evm1Include;
            }
            contextTreeNode.props.evm1Include = evm1Include;
            contextTreeNode.isExpanded = true;
            contextTreeNode.expanded = true;
            treeNodes.push( contextTreeNode );
            topChildNdx += 1;
        }
    }

    // Add Top BOM Nodes and their seeds
    _.forEach( newRecipeState.seedInfos, function( seedInfo ) {
        var rootElementModel = cdm.getObject( seedInfo.rootElement.uid );
        var underLyingObjectVMO = null;

        if( rootElementModel ) {
            var rootElementVMO = vmcs.createViewModelObject( rootElementModel.uid, 'EDIT' );
            var rootLevelNdx = levelNdx;
            var custTypeTopBOM = data.i18n.evm1TOPBOMNode;

            underLyingObjectVMO = vmcs.createViewModelObject( rootElementVMO.props.awb0UnderlyingObject.dbValues[ 0 ], 'EDIT' );
            if( contextTreeNode ) {
                contextTreeNode.isLeaf = false;
                rootLevelNdx = contextTreeNode.levelNdx + 1;
            }
            iconURL = underLyingObjectVMO.typeIconURL;

            var rootTreeNode = awTableTreeSvc.createViewModelTreeNode( rootElementVMO.uid, rootElementVMO.type, rootElementVMO.props.object_string.uiValues[ 0 ], rootLevelNdx, contextChildNdx,
                iconURL );

            if( _.findIndex( newRecipeState.seedSelections, function( o ) { return o.uid === rootElementVMO.uid; } ) !== -1 ) {
                custTypeTopBOM = data.i18n.evm1TOPBOMNodeAndSeed;
                _.remove( seedInfo.seeds, function( seed ) {
                    return seed.uid === rootElementVMO.uid;
                } );
            }
            rootTreeNode.isLeaf = !seedInfo.seeds || seedInfo.seeds && seedInfo.seeds.length === 0;
            rootTreeNode.props = rootElementVMO.props;
            rootTreeNode.props.CustType = uwPropertyService.createViewModelProperty( 'CustType', data.i18n.evm1CategoryColumn,
                'STRING', custTypeTopBOM, [ custTypeTopBOM ] );

            var rootEvm1Include = newRecipeState.includeToggleMap[ rootElementVMO.uid ];

            if( !rootEvm1Include ) {
                rootEvm1Include = uwPropertyService.createViewModelProperty( 'evm1Include', data.i18n.evm1IncludeColumn,
                    'BOOLEAN', true, [ 'True' ] );
                rootEvm1Include.isEditable = true;
                rootEvm1Include.isEnabled = true;
                newRecipeState.includeToggleMap[ rootElementVMO.uid ] = rootEvm1Include;
            }
            rootTreeNode.props.evm1Include = rootEvm1Include;
            rootTreeNode.props.item_revision_id = underLyingObjectVMO.props.item_revision_id;
            rootTreeNode.props.owning_user = underLyingObjectVMO.props.owning_user;
            if( contextTreeNode ) {
                rootTreeNode.props.evm1SeedParent = uwPropertyService.createViewModelProperty( 'evm1SeedParent', 'Parent',
                    'STRING', contextTreeNode.uid, [ contextTreeNode.uid ] );
            }
            treeNodes.push( rootTreeNode );
            if( !rootTreeNode.isLeaf ) {
                rootTreeNode.isExpanded = true;
                rootTreeNode.expanded = true;
                rootChildNdx = 0;
                expandTopBOMNodes( rootTreeNode, seedInfo.seeds, rootLevelNdx + 1, rootChildNdx, data, treeNodes, newRecipeState );
            }
            contextChildNdx += 1;
        }
    } );

    // Add Non BOM Nodes
    _.forEach( newRecipeState.seedInfos, function( seedInfo ) {
        var rootElementModel = cdm.getObject( seedInfo.rootElement.uid );

        if( !rootElementModel ) {
            if( !newRecipeState.context ) {
                topChildNdx = contextChildNdx;
            }
            _.forEach( seedInfo.seeds, function( seed ) {
                var seedVMO = vmcs.createViewModelObject( seed.uid, 'EDIT' );
                var seedName = _.get( seedVMO, 'props.object_string.uiValues[0]', undefined );
                var propsToLoad = [ 'item_revision_id', 'owning_user' ];

                if( !seedName ) {
                    seedName = _.get( seed, 'props.object_string.uiValues[0]', undefined );
                    propsToLoad.push( 'object_string' );
                }

                iconURL = seedVMO.typeIconURL;
                var nonBOMTreeNode = awTableTreeSvc.createViewModelTreeNode( seedVMO.uid, seedVMO.type, seedName, levelNdx, topChildNdx, iconURL );

                nonBOMTreeNode.isLeaf = true;
                if( !seedVMO.props.item_revision_id || !seedVMO.props.owning_user ) {
                    //loadProperties
                    dmSvc.getProperties( [ seedVMO.uid ], propsToLoad ).then(
                        function() {
                            var seedModel = cdm.getObject( seedVMO.uid );
                            exports.updateSeedTreeOnObjectChanged( [ seedModel ], [
                                nonBOMTreeNode
                            ] );
                        } );
                }
                nonBOMTreeNode.props = seedVMO.props;
                nonBOMTreeNode.props.CustType = uwPropertyService.createViewModelProperty( 'CustType', data.i18n.evm1CategoryColumn,
                    'STRING', data.i18n.Selection, [ data.i18n.Selection ] );

                var seedEvm1Include = newRecipeState.includeToggleMap[ seedVMO.uid ];

                if( !seedEvm1Include ) {
                    seedEvm1Include = uwPropertyService.createViewModelProperty( 'evm1Include', data.i18n.evm1IncludeColumn,
                        'BOOLEAN', true, [ 'True' ] );
                    seedEvm1Include.isEditable = true;
                    seedEvm1Include.isEnabled = true;
                    newRecipeState.includeToggleMap[ seedVMO.uid ] = seedEvm1Include;
                }
                nonBOMTreeNode.props.evm1Include = seedEvm1Include;
                treeNodes.push( nonBOMTreeNode );
                topChildNdx += 1;
            } );
        }
    } );
    let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, treeNodes, false, true, true, null );

    recipeState.update && recipeState.update( newRecipeState );
    return {
        treeLoadResult: treeLoadResult
    };
};

/**
 * This method is used to process the selections made in the seed tree table
 * @param {Object} eventData the event-data which has the selected tree node in the tree table
 * @param {object} recipeState the recipe state
 */
export let processSeedTreeSelection = function( eventData, recipeState ) {
    const newRecipeState = { ...recipeState };

    if( eventData && eventData.selectedObjects && eventData.selectedObjects.length > 0 ) {
        newRecipeState.selectedTreeNode = eventData.selectedObjects[ 0 ];
        //Set the flag for remove command for recipe. Only for leaf nodes the remove command should be visible
        if( recipeState && recipeState.seedSelections && _.findIndex( recipeState.seedSelections, function( o ) { return o.uid === eventData.selectedObjects[ 0 ].uid; } ) !== -1 ) {
            newRecipeState.childSeedSelectedInTree = true;
        } else {
            newRecipeState.childSeedSelectedInTree = false;
            newRecipeState.selectedTreeNode = {};
        }
    } else {
        newRecipeState.childSeedSelectedInTree = false;
        newRecipeState.selectedTreeNode = {};
    }
    recipeState.update && recipeState.update( newRecipeState );
};

/**
 * This method is used to get the seed selections from the recipeCtx is set it in data which is consumed by data provider
 * @returns {Boolean} true/false
 */
export let showSeedsTree = function( showSeedsTree ) {
    if( !showSeedsTree ) {
        showSeedsTree = true;
    }
    // Set showSeedsTree flag for showing the Seeds TreeTable
    return showSeedsTree;
};

/**
 * This method is used to store the seed selections, in the recipeCtx, from listening to storeSeedSelectionFromEvent
 * @param {Object} seedsToAdd the list of new seeds to be added
 * @param {Object} recipeState the recipe state
 *
 */
export let storeSeedSelectionFromEvent = function( seedsToAdd, recipeState ) {
    if( seedsToAdd ) {
        // Add the selected object from seedsToAdd to the current Seed Selections
        const newRecipeState = { ...recipeState };
        if( newRecipeState.seedSelections && newRecipeState.seedSelections.length > 0 ) {
            newRecipeState.seedSelections = _.unionBy( newRecipeState.seedSelections, seedsToAdd, 'uid' );
        } else {
            newRecipeState.seedSelections = seedsToAdd;
        }

        _.forEach( seedsToAdd, function( vmo ) {
            var seedInfo = {
                rootElement: {
                    uid: '',
                    type: ''
                },
                seeds: [ vmo ]
            };

            if( newRecipeState.seedInfos ) {
                newRecipeState.seedInfos.push( seedInfo );
            } else {
                newRecipeState.seedInfos = [ seedInfo ];
            }
        } );
        newRecipeState.seedsIsDirty = true;
        newRecipeState.childSeedSelectedInTree = false;
        newRecipeState.selectedTreeNode = {};
        recipeState.update && recipeState.update( newRecipeState );
    }
};

/**
 * This method is used to delete the seed selection from the ctx when it is removed
 * @param {Object} data the view-model data
 * @param {Object} recipeState the recipe state
 */
export let deleteSeedSelection = function( data, recipeState ) {
    // if the object exist in the ctx then remove it
    const newRecipeState = { ...recipeState };
    if( newRecipeState && newRecipeState.seedSelections && newRecipeState.seedSelections.length > 0 && newRecipeState.selectedTreeNode ) {
        removeSeed( newRecipeState );
        // Unset the flag for remove seed command
        newRecipeState.childSeedSelectedInTree = false;
        newRecipeState.selectedTreeNode = {};
        evm1RecipeBuilderService.validateInScopeNavigation( data, newRecipeState );
        recipeState.update && recipeState.update( newRecipeState );
    }
};

var removeSeed = function( recipeState ) {
    recipeState.seedSelections = _.remove( recipeState.seedSelections, function( seedObject ) {
        return seedObject.uid !== recipeState.selectedTreeNode.uid;
    } );

    var seedsToRemoveUids = [];

    if( recipeState.context && recipeState.selectedTreeNode.uid === recipeState.context.uid ) {
        // Remove all BOM seeds
        _.remove( recipeState.seedInfos, function( seedInfo ) {
            var rootElementModel = cdm.getObject( seedInfo.rootElement.uid );

            if( rootElementModel ) {
                seedsToRemoveUids.push( seedInfo.rootElement.uid );
                _.forEach( seedInfo.seeds, function( seed ) {
                    seedsToRemoveUids.push( seed.uid );
                } );
                return true;
            }
        } );
    } else {
        _.remove( recipeState.seedInfos, function( seedInfo ) {
            if( recipeState.selectedTreeNode.uid === seedInfo.rootElement.uid ) {
                seedsToRemoveUids.push( seedInfo.rootElement.uid );
                _.forEach( seedInfo.seeds, function( seed ) {
                    seedsToRemoveUids.push( seed.uid );
                } );
                return true;
            }

            _.remove( seedInfo.seeds, function( seed ) {
                var isRemoveSeed = false;

                if( seed.uid === recipeState.selectedTreeNode.uid ) {
                    seedsToRemoveUids.push( seed.uid );
                    isRemoveSeed = true;
                }
                return isRemoveSeed;
            } );

            var isRemoveRoot = false;

            if( seedInfo.seeds.length === 0 && _.findIndex( recipeState.seedSelections, function( o ) { return o.uid === seedInfo.rootElement.uid; } ) === -1 ) {
                seedsToRemoveUids.push( seedInfo.rootElement.uid );
                isRemoveRoot = true;
            }
            return isRemoveRoot;
        } );
    }

    _.remove( recipeState.seedSelections, function( seedSelection ) {
        return _.findIndex( seedsToRemoveUids, function( seedsToRemoveUid ) { return seedsToRemoveUid === seedSelection.uid; } ) !== -1;
    } );

    // Check if we need to remove Context as well
    if( recipeState.context ) {
        var isAllBOMSeedsRemoved = true;

        _.forEach( recipeState.seedInfos, function( seedInfo ) {
            var rootElement = cdm.getObject( seedInfo.rootElement.uid );

            if( rootElement ) {
                isAllBOMSeedsRemoved = false;
                return;
            }
        } );
        if( isAllBOMSeedsRemoved ) {
            if( _.findIndex( recipeState.seedSelections, function( o ) { return o.uid === recipeState.context.uid; } ) === -1 ) {
                seedsToRemoveUids.push( recipeState.context.uid );
                recipeState.context = undefined;
            }
        }
    }

    _.forEach( seedsToRemoveUids, function( seedsToRemoveUid ) {
        recipeState.includeToggleMap[ seedsToRemoveUid ] = undefined;
    } );
};

/**
 * This method is used to update SeedTreeViewModel objects display name when its related ModelObject is updated.
 * @param {Array} updatedObjects updated ModelObjects
 * @param {Array} seedTreeNodes loaded SeedTreeViewModel objects
 */
export let updateSeedTreeOnObjectChanged = function( updatedObjects, seedTreeNodes ) {
    _.forEach( updatedObjects, function( updatedObject ) {
        var treeNode = _.find( seedTreeNodes, function( treeNode ) {
            return treeNode.uid === updatedObject.uid;
        } );

        if( treeNode ) {
            var custProp = treeNode.props.CustType;
            var evm1Include = treeNode.props.evm1Include;
            var item_revision_id;
            var owning_user;
            var updatedObjectVMO = vmcs.createViewModelObject( updatedObject.uid, 'EDIT' );

            treeNode.displayName = updatedObjectVMO.props.object_string.uiValues[ 0 ];
            if( clientMetaModel.isInstanceOf( 'Awb0Element', updatedObjectVMO.modelType ) && _.get( updatedObjectVMO, 'props.awb0UnderlyingObject.dbValues[0]', undefined ) ) {
                var UnderlyingObjectVMO = vmcs.createViewModelObject( updatedObjectVMO.props.awb0UnderlyingObject.dbValues[ 0 ], 'EDIT' );
                item_revision_id = UnderlyingObjectVMO.props.item_revision_id;
                owning_user = UnderlyingObjectVMO.props.owning_user;
            } else {
                item_revision_id = updatedObjectVMO.props.item_revision_id;
                owning_user = updatedObjectVMO.props.owning_user;
            }
            treeNode.props = updatedObjectVMO.props;
            treeNode.props.CustType = custProp;
            treeNode.props.evm1Include = evm1Include;
            if( item_revision_id ) {
                treeNode.props.item_revision_id = item_revision_id;
            }
            if( owning_user ) {
                treeNode.props.owning_user = owning_user;
            }
        }
    } );
    eventBus.publish( 'seedTreeGrid.plTable.clientRefresh', {} );
};

export let updateSeedTreeNodesOnIncludeToggled = function( treeNodeUid, newValue, seedTreeNodes, recipeState ) {
    let isTopTreeNodeToggled = false;
    const newRecipeState = { ...recipeState };

    _.forEach( seedTreeNodes, function( treeNode ) {
        let parentUid = _.get( treeNode, 'props.evm1SeedParent.dbValue', undefined );

        if( treeNode.uid === treeNodeUid ) {
            treeNode.props.evm1Include.isEnabled = true;
            treeNode.props.evm1Include.dbValue = newValue;
            if( treeNode.levelNdx === 0 && !treeNode.isLeaf ) {
                isTopTreeNodeToggled = true;
            }
            if( newRecipeState && newRecipeState.includeToggleMap ) {
                let evm1Include = newRecipeState.includeToggleMap[ treeNode.uid ];

                if( evm1Include ) {
                    evm1Include.isEnabled = true;
                    evm1Include.dbValue = newValue;
                }
            }
        }

        if( parentUid === treeNodeUid ) {
            // To toggle immediate child
            treeNode.props.evm1Include.isEnabled = newValue;
            treeNode.props.evm1Include.dbValue = newValue;
            if( newRecipeState && newRecipeState.includeToggleMap ) {
                let evm1Include = newRecipeState.includeToggleMap[ treeNode.uid ];

                if( evm1Include ) {
                    evm1Include.isEnabled = newValue;
                    evm1Include.dbValue = newValue;
                }
            }
        }
    } );

    if( isTopTreeNodeToggled ) {
        // To toggle all children
        _.forEach( seedTreeNodes, function( treeNode ) {
            if( treeNode.levelNdx > 0 ) {
                treeNode.props.evm1Include.isEnabled = newValue;
                treeNode.props.evm1Include.dbValue = newValue;
                if( newRecipeState && newRecipeState.includeToggleMap ) {
                    let evm1Include = newRecipeState.includeToggleMap[ treeNode.uid ];

                    if( evm1Include ) {
                        evm1Include.isEnabled = newValue;
                        evm1Include.dbValue = newValue;
                    }
                }
            }
        } );
    }
    recipeState.update && recipeState.update( newRecipeState );
};

export default exports = {
    getSeedTreeChildren,
    loadSeedTreeData,
    processSeedTreeSelection,
    showSeedsTree,
    storeSeedSelectionFromEvent,
    deleteSeedSelection,
    updateSeedTreeOnObjectChanged,
    updateSeedTreeNodesOnIncludeToggled
};
