// Copyright (c) 2022 Siemens

import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpRelationSvc from 'js/services/ngpRelationService';
import cdm from 'soa/kernel/clientDataModel';
import mfeTableSvc from 'js/mfeTableService';
import msgSvc from 'js/messagingService';
import localeService from 'js/localeService';
import popupSvc from 'js/popupService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import ngpProductScopeSvc from 'js/services/ngpProductScopeService';
import eventBus from 'js/eventBus';
import listBoxSvc from 'js/listBoxService';
import ngpLoadService from 'js/services/ngpLoadService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import mfePolicyService from 'js/mfePolicyService';
import uwPropertySvc from 'js/uwPropertyService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';


/**
 * The ngp associate partitions service
 *
 * @module js/services/ngpAssociatePartitionsService
 */

const localizedMessages = localeService.getLoadedText( 'NgpAssociatePartitionsMessages' );
// a map of model uids to a list of partition schemes
const modelUidToPartitionSchemes = {};

// a map of partition scheme uid to a list of top level partitions
const cachedTopLevelPartitions = {};

// an array of all revsion rules
const cachedRevisionRules = [];

const ngpConfigContextPolicy = {
    types: [ {
        name: 'ConfigurationContext',
        properties: [ {
            name: 'revision_rule'
        } ]
    } ]
};

const ngpRevisionRulePolicy = {
    types: [ {
        name: 'RevisionRule',
        properties: [ {
            name: 'suppressed'
        },
        {
            name: 'user_visible'
        }
        ]
    } ]
};


/**
 *
 * @param {object} modelObject - cmdObjects
 * @return {Promise} a promise
 */
export function displayAssociatePartitionsDlg( modelObject ) {
    return ngpRelationSvc.getCollaborationDesignObject( modelObject ).then(
        ( cdModel ) => {
            if( cdModel ) {
                return getSchemesInModels( [ cdModel ] ).then(
                    () => {
                        const partitionSchemes = modelUidToPartitionSchemes[ cdModel.uid ];
                        if( partitionSchemes.length > 0 ) {
                            const partitionSchemesUids = partitionSchemes.map( ( obj ) => obj.uid );
                            return ngpLoadService.ensureObjectsLoaded( partitionSchemesUids ).then(
                                () => showAssociatePartitionsDlg( modelObject, partitionSchemes )
                            );
                        }
                        return msgSvc.showError( localizedMessages.partitionSchemesDontExist );
                    }
                );
            }
            return msgSvc.showError( localizedMessages.NoAssociatedProductModel );
        }
    );
}


/**
 *
 * @param {modelObject[]} collaborativeDesigns - a set of collaborative designs
 * @returns {promise} a promise resolved to an object with modelUid to partition schemes
 */
function getSchemesInModels( collaborativeDesigns ) {
    const notCached = collaborativeDesigns.filter( ( cd ) => !modelUidToPartitionSchemes[ cd.uid ] );
    if( notCached.length > 0 ) {
        const soaInput = {
            inputs: notCached
        };
        return ngpSoaSvc.executeSoa( 'Partition-2011-06-PartitionManagement', 'getSchemesInModel', soaInput ).then(
            ( response ) => {
                response.output.forEach( ( schemeData ) => modelUidToPartitionSchemes[ schemeData.model.uid ] = schemeData.partitionSchemes || [] );
            }
        );
    }
    return new Promise( ( res ) => res() );
}

/**
 * Displays Create Dataset dialog.
 * @param {modelObject} context - the current BE modelObject
 * @param {modelObject[]} partitionSchemes - list of partition scheme model objects
 */
function showAssociatePartitionsDlg( context, partitionSchemes ) {
    popupSvc.show( {
        declView: 'NgpAssociatePartitionsDlg',
        options: {
            height: '700',
            width: '1200',
            preset: 'modal',
            caption: localizedMessages.associatePartitionsDialogTitle
        },
        subPanelContext: {
            context,
            partitionSchemes
        }
    } );
}


/**
 *
 * @param {modelObject} planningScopeModelObject - a given BE object to associate partition with
 * @param {modelObject} partitionScheme - a partition scheme model object
 * @param {Object} policy policy for soa call
 * @param {modelObject} configurationContext - configuration context
 * @return {Promise<modelObject[]>} a promise resolved to a list of partitions
 */
 function getTopLevelPartitions( planningScopeModelObject, partitionScheme, policy, configurationContext = null ) {
    return ngpRelationSvc.getCollaborationDesignObject( planningScopeModelObject ).then(
        ( model ) => {
            if( cachedTopLevelPartitions[ partitionScheme.uid ] ) {
                const partitionsUids = cachedTopLevelPartitions[ partitionScheme.uid ].map( ( partition ) => partition.uid );
                return ngpLoadService.ensureObjectsLoaded( partitionsUids ).then( () => cachedTopLevelPartitions[ partitionScheme.uid ] );
            }
            const soaInput = {
                inputs: [ {
                    configurationContext,
                    modelCntxt: model,
                    partitionScheme
                } ]
            };
            const options = {
                propertyPolicyOverride : policy
            };
            return ngpSoaSvc.executeSoa( 'Partition-2011-06-PartitionManagement', 'getTopLevelPartitions', soaInput, options ).then(
                ( result ) => {
                    const partitionData = _.find( result.output, ( partitionData ) => partitionData.paritionScheme.uid === partitionScheme.uid );
                    cachedTopLevelPartitions[ partitionScheme.uid ] = partitionData ? partitionData.topLevelPartitions : [];
                    return cachedTopLevelPartitions[ partitionScheme.uid ];
                }
            );
        }
    );
}

/**
 * Creates the table column in the given dataProvider
 *
 * @param {Object} partitionsDataProvider - the partitions to associate table data provider
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table
 * @param {Object} dataProvider - the table data provider
 * @param {object} columnProvider - the table column provider
 * @param {object} additionalPolicyObjects - object with more policy data
 * @param {string} tableCmdColumnPropName - the property name column we want to have the command icons
 * @param {string} tableTreeNavColumnPropName - the property name column we want to have the expand icon
 */
export function createColumns( partitionsDataProvider, preferenceName, dataProvider, columnProvider, additionalPolicyObjects, tableCmdColumnPropName, tableTreeNavColumnPropName ) {
    mfeTableSvc.createColumns( preferenceName, dataProvider, columnProvider, additionalPolicyObjects, tableCmdColumnPropName, tableTreeNavColumnPropName ).then(
        () => {
            createCellRenderers( dataProvider.columnConfig.columns, partitionsDataProvider );
        }
    );
}

/**
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {modelObject} planningScopeModelObject - a given BE object to associate partition with
 * @param {modelObject} partitionScheme - a current partition scheme name string that user chose from the combobox
 * @param {Object} policy policy for soa call
 * @return {Promise} - a promise object
 */
 export function loadAvailablePartitionsTableData( treeLoadInput, planningScopeModelObject, partitionScheme, policy ) {
    const nodeToExpand = treeLoadInput.parentNode;
    nodeToExpand.cursorObject = {
        startReached: true,
        endReached: true
    };

    let promise;
    if( treeLoadInput && treeLoadInput.parentNode && treeLoadInput.parentNode.uid === 'top' ) {
        promise = getTopLevelPartitions( planningScopeModelObject, partitionScheme, policy );
    } else {
        promise = getChildrenOfParentPartition( nodeToExpand, policy  );
    }
    return promise.then(
        ( partitions ) => {
            let childTreeNodes = [];
            if ( Array.isArray( partitions ) ) {
                childTreeNodes = partitions.map( ( object, index ) => mfeTableSvc.getTreeNodeObject( object, nodeToExpand, false, index ) );
            }
            if( childTreeNodes.length === 0 ) {
                nodeToExpand.isLeaf = true;
            }
            const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childTreeNodes, false, true, true, null );
            return {
                treeLoadResult
            };
        }
    );
}

/**
 *
 * @param {modelObject} parentPartition the parent partition
 * @param {Object} policy policy for soa call
 * @return {Object[]} - an Array of child nodes of the nodeToExpand object
 */
function getChildrenOfParentPartition( parentPartition, policy ) {
    const soaInput = {
        inputs: [ {
            configurationContext: null,
            parentPartitions: [ parentPartition ],
            maxLevelCount: 1, //only one level
            maxChildCount: 0 // no paging in the client yet.
        } ]
    };
    const options = {
        propertyPolicyOverride : policy
    };

    return ngpSoaSvc.executeSoa( 'Partition-2014-12-PartitionManagement', 'getChildren', soaInput, options ).then(
        ( response ) => {
            const parentPartitions = response.output[ 0 ].parentChildMap[ 0 ];
            const childrenMap = response.output[ 0 ].parentChildMap[ 1 ];
            const parentPartitionIndex = _.findIndex( parentPartitions, ( partition ) => partition.uid === parentPartition.uid );
            return parentPartitionIndex > -1 ? childrenMap[ parentPartitionIndex ] : [];
        }
    );
}

/**
 * @param {modelObject[]} subsetDefinitions - a given subset definition
 * @param {Array} defaultRevRulePref - a given array of string value for the NGP_Default_Product_Revision_Rule preference
 * @param {String[]} currRevRuleNames - given curr RevRule Name
 * @returns {Array} list of Revision Rules names
 */
export function getRevisionRuleList( subsetDefinitions, defaultRevRulePref, currRevRuleNames ) {
    const revRuleListPromise = getRevisionRuleListFromServer();
    const currRevRulePromise = getCurrRevRuleName( subsetDefinitions, defaultRevRulePref );

    return Promise.all( [ revRuleListPromise, currRevRulePromise ] ).then(
        ( [ revisionRuleList, currRevRuleName ] ) => {
            const currRevRuleNamesSet = new Set( currRevRuleNames );
            if ( currRevRuleNames && currRevRuleNamesSet.size === 1 ) {
                currRevRuleName = currRevRuleNames[0];
            }else if ( currRevRuleNames && currRevRuleNamesSet.size > 1 ) {
                currRevRuleName =  '';
            }
            if( revisionRuleList ) {
                const index = _.findIndex( revisionRuleList, ( object ) => object.dispValue === currRevRuleName );
                if( index > -1 ) {
                    //move this found rev rule to the 1st place of the list
                    revisionRuleList.unshift( revisionRuleList[ index ] );
                    revisionRuleList.splice( index + 1, 1 );
                }else if ( currRevRuleName !== null && index === -1 ) {
                    const revRulePropDisplayName = {
                        propDisplayValue: currRevRuleName,
                        dispValue: currRevRuleName,
                        propInternalValue: 'AAAAAAAAAAAAAA'
                    };
                    revisionRuleList.unshift( revRulePropDisplayName );
                }

                return revisionRuleList;
            }
        }
    );
}

/**
 * @returns {Array} list of Revision Rules names
 */
function getRevisionRuleListFromServer() {
    if( cachedRevisionRules.length > 0 ) {
        return new Promise( ( resolve ) => resolve( cachedRevisionRules ) );
    }
    mfePolicyService.register( 'ngpRevisionRulePolicy', ngpRevisionRulePolicy );
    return ngpSoaSvc.executeSoa( 'ModelCore-2011-06-ModelConfiguration', 'findRevisionRulesForModel' ).then(
        ( response ) => {
            if( Array.isArray( response.revisonRules ) ) {
                response.revisonRules.forEach( ( rule ) => {
                    if( rule.props[ ngpPropConstants.SUPPRESSED ].dbValues[ 0 ] === '0' && rule.props[ngpPropConstants.USER_VISIBLE].dbValues[ 0 ] === '1' ) {
                        const revisionRuleName = rule.props[ ngpPropConstants.OBJECT_NAME ].dbValues[ 0 ];
                        cachedRevisionRules.push( {
                            propDisplayValue: revisionRuleName,
                            dispValue: revisionRuleName,
                            propInternalValue: rule.uid
                        } );
                    }
                } );
            }
            mfePolicyService.unregister( 'ngpRevisionRulePolicy' );
            return cachedRevisionRules;
        }
    );
}

/**
 * @param {modelObject} subsetDefinition - a given subset definition
 * @param {Array} defaultRevRulePref - a given array of string value for the NGP_Default_Product_Revision_Rule preference
 * @returns {String} name of the current Revision Rule taken from preference
 */
function getCurrRevRuleName( subsetDefinition, defaultRevRulePref ) {
    //find the index of current revRule from the subset/preference/context
    return getCurrRevRuleFromSubset(  subsetDefinition  ).then(
        ( subsetRevRules ) => {
            if( Array.isArray( subsetRevRules ) && subsetRevRules.length > 0 ) {
                return subsetRevRules[0];
            }
            let prefRevRule = getCurrRevRuleFromPreference( defaultRevRulePref );
            if( prefRevRule ) {
                return prefRevRule;
            }
            return getCurrRevRuleFromCtx();
        } );
}


/**
 * @param {Array} defaultRevRulePref - a given array of string value for the NGP_Default_Product_Revision_Rule preference
 * @returns {String} name of the current Revision Rule taken from preference
 */
function getCurrRevRuleFromPreference( defaultRevRulePref ) {
    if( Array.isArray( defaultRevRulePref ) && defaultRevRulePref.length > 0 ) {
        return defaultRevRulePref[ 0 ];
    }
    return '';
}

/**
 * @returns {String} name of the current Revision Rule taken from context
 */
function getCurrRevRuleFromCtx() {
    const currRevRule = appCtxSvc.getCtx( 'userSession.props.awp0RevRule' );
    return currRevRule.displayValues[ 0 ];
}

/**
 * @param {modelObject} subsetDefinitions - a given subset definition
 * @return {Strings} name of the current Revision Rule taken from product subset
 */
function getCurrRevRuleFromSubset( subsetDefinitions ) {
    subsetDefinitions = subsetDefinitions && subsetDefinitions.length ? subsetDefinitions.filter( Boolean ) : [];
    if( subsetDefinitions.length > 0 ) {
        let configCtxUids;
        const subsetDefinitionUids = subsetDefinitions.map( ( subsetDefinition )=>subsetDefinition.uid );
        return ngpLoadService.getPropertiesAndLoad( subsetDefinitionUids, [ ngpPropConstants.SUBSET_DEF_CONFIG_CONTEXT ] )
            .then(
                () => {
                    configCtxUids = subsetDefinitions.map( ( subsetDefinition ) => subsetDefinition.props[ ngpPropConstants.SUBSET_DEF_CONFIG_CONTEXT ].dbValues[ 0 ] );
                    return ngpLoadService.getPropertiesAndLoad( configCtxUids, [ ngpPropConstants.REVISION_RULE ] );
                } )
            .then( () => {
                // we need to load the configuration context in order to refresh its properties which are not updated after set Product Subsets From Partitions
                mfePolicyService.register( 'ngpConfigContextPolicy', ngpConfigContextPolicy );
                return ngpLoadService.loadObjects( configCtxUids  )
                    .then(
                        () => configCtxUids.map( ( configCtxUid )=>fixCurrRevRuleStr( cdm.getObject( configCtxUid ).props[ ngpPropConstants.REVISION_RULE ].uiValues[ 0 ] ) )
                    );
            } );
    }
    return new Promise( ( res ) => res( [] ) );
}

/**
 * @param {String} originalName - a current revision name gotten from product subset. It ends with (Modified). We need to remove it from the name
 * @return {String} name of the current Revision Rule taken from product subset
 */
export function fixCurrRevRuleStr( originalName ) {
    let templateLit = ` (${localizedMessages.modifiedRevRule})`;
    return originalName.replace( templateLit, '' );
}
/**
 * Adds selected partitions from the Avavilable Partitions tree to Partitions to Associate table.
 * @param {object} availablePartitionsTableDataProvider - data provider
 * @param {object} partitionsToAssociateTableDataProvider - data provider
 */
export function addPartitionsToAssociate( availablePartitionsTableDataProvider, partitionsToAssociateTableDataProvider ) {
    let selectedPartitionUids = availablePartitionsTableDataProvider.getSelectedObjects().map( ( partition ) => partition.uid );
    const currentlyAssociatedPartitionUids = partitionsToAssociateTableDataProvider.getViewModelCollection().getLoadedViewModelObjects().map( ( partition ) => partition.uid );
    selectedPartitionUids = selectedPartitionUids.filter( ( partitionUid ) => currentlyAssociatedPartitionUids.indexOf( partitionUid ) === -1 );
    if( selectedPartitionUids && selectedPartitionUids.length > 0 ) {
        mfeTableSvc.addToDataProvider( selectedPartitionUids, partitionsToAssociateTableDataProvider, true );
        eventBus.publish( 'ngpAssociatePartitions.associatePartitionsListChanged' );
    }
}

/**
 * Removes selected partitions from the Partitions to Associate table.
 *
 * @param {object} partitionsToAssociateTableDataProvider - data provider
 */
export function removePartitionsFromAssociate( partitionsToAssociateTableDataProvider ) {
    let selectedPartitions = partitionsToAssociateTableDataProvider.getSelectedObjects();
    if( selectedPartitions.length ) {
        const selectedPartitionsUids = selectedPartitions.map( ( object ) => object.uid );
        mfeTableSvc.removeFromDataProvider( selectedPartitionsUids, partitionsToAssociateTableDataProvider );
        partitionsToAssociateTableDataProvider.selectNone();
        eventBus.publish( 'ngpAssociatePartitions.associatePartitionsListChanged' );
    }
}

/**
 * @param {object} columns - the columns
 * @param {object} partitionsDataProvider - data provider of the write side of the table
 */
function createCellRenderers( columns, partitionsDataProvider ) {
    columns.forEach( ( column ) => {
        if( !column.cellRenderers ) {
            column.cellRenderers = [];
        }
        column.cellRenderers.push( mfeTableSvc.getRowRenderer( 'aw-ngp-boldedTableRow', 'boldFontRowRenderer', shouldCellBeMarkedBold.bind( this, partitionsDataProvider ) ) );
    } );
}

/**
 *
 * @param {object} partitionsDataProvider - data provider of the write side of the table
 * @param {object} column - the column
 * @param {ViewModelObject} rowVMO - the row ViewModelObject
 * @return {boolean} true if the cell should be marked in bold font
 */
function shouldCellBeMarkedBold( partitionsDataProvider, column, rowVMO ) {
    const obj = _.find( partitionsDataProvider.viewModelCollection.loadedVMObjects, ( partition ) => partition.uid === rowVMO.uid );
    return Boolean( obj );
}


/**
 * @param {modelObject} planningScopeModelObject - a given BE object to associate partition with
 * @return {Promise} - a promise object
 */
export function getCurrentlyAssociatedPartitionsAndPartitionScheme( planningScopeModelObject ) {
    let relation = null;
    return ngpProductScopeSvc.getRelatedProductScopeAndRelation( [ planningScopeModelObject ] )
        .then(
            ( relationDataArray ) => {
                if ( relationDataArray && relationDataArray.length === 1 && relationDataArray[0].productScope ) {
                    relation = relationDataArray[0].relation;
                    return ngpProductScopeSvc.getProductSubsetConfiguration( relationDataArray[0].productScope );
                }
            } )
        .then(
            ( productScopeConfiguration ) => {
                let currentlyAssociatedPartitions = [];
                let currentPartitionScheme;
                let subsetDefinition;
                if( productScopeConfiguration ) {
                    currentlyAssociatedPartitions = productScopeConfiguration.partitions.map( ( uid ) => cdm.getObject( uid ) );
                    currentPartitionScheme = productScopeConfiguration.partitionScheme;
                    subsetDefinition = productScopeConfiguration.subsetDefinition;
                }
                return {
                    currentlyAssociatedPartitions,
                    currentPartitionScheme,
                    subsetDefinition,
                    relation
                };
            }
        );
}

/**
 *
 * @param {modelObject[]} partitionSchemes - a set of partition scheme
 * @param {modelObject} currentPartitionScheme - the current associated partition scheme
 * @returns {object[]} a list of items
 */
export function createPartitionsSchemesList( partitionSchemes, currentPartitionScheme ) {
    //need to put current partition first
    const duplicateSchemes = [ ...partitionSchemes ];
    if( !currentPartitionScheme && partitionSchemes.length > 1 ) {
        const defaultScheme = getDefaultPartitionSchemeFromPreference();
        if( defaultScheme !== '' ) {
            const index = partitionSchemes.findIndex( ( scheme ) => scheme.type === defaultScheme );
            if( index > 0 ) {
                currentPartitionScheme = duplicateSchemes[index];
            }
        }
    }
    if( currentPartitionScheme && partitionSchemes.length > 1 ) {
        const index = _.findIndex( partitionSchemes, ( scheme ) => scheme.uid === currentPartitionScheme.uid );
        if( index > 0 ) {
            duplicateSchemes.unshift( duplicateSchemes[ index ] );
            duplicateSchemes.splice( index + 1, 1 );
        }
    }
    return listBoxSvc.createListModelObjects( duplicateSchemes, 'props.object_string', false );
}

/**
 * @returns {String} type of default partition scheme taken from preference
 */
function getDefaultPartitionSchemeFromPreference() {
    let ctxPreferences = appCtxSvc.getCtx( 'preferences' );
    if ( Array.isArray( ctxPreferences.NGP_Default_Partition_Scheme ) && ctxPreferences.NGP_Default_Partition_Scheme.length > 0 ) {
        return ctxPreferences.NGP_Default_Partition_Scheme[ 0 ];
    }
    return '';
}

/**
 *
 * @param {modelObject} planningScopeModelObject - the planning scope model object
 * @param {modelObject} subsetDef - the subset definition
 * @param {modelObject} relation - the relation
 * @return {Promise} a promise
 */
export function removeProductScope( planningScopeModelObject, subsetDef, relation ) {
    const removeProductScopeConfirmMsg = localizedMessages.removeProductScopeConfirmMsg.format( planningScopeModelObject.props.object_string.uiValue );
    return mfgNotificationUtils.displayConfirmationMessage( removeProductScopeConfirmMsg, localizedMessages.removeProductScope, localizedMessages.cancel )
        .then( ( ) => {
            return ngpRelationSvc.deleteObjects( [ relation, subsetDef ] ).then( () => {
                eventBus.publish( 'ngp.productScopeRemoved',  { planningScopeModelObject } );
            } );
        }, () => {} );
}

let exports = {};
export default exports = {
    createColumns,
    loadAvailablePartitionsTableData,
    getCurrentlyAssociatedPartitionsAndPartitionScheme,
    displayAssociatePartitionsDlg,
    getRevisionRuleList,
    addPartitionsToAssociate,
    removePartitionsFromAssociate,
    fixCurrRevRuleStr,
    createPartitionsSchemesList,
    removeProductScope
};
