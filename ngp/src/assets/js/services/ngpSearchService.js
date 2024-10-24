// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';

/**
 * The ngp search service
 *
 * @module js/services/ngpSearchService
 */
'use strict';

let DesignElementQuery = null;
let DesignFeatureQuery = null;

const ngpSearchPolicy = {
    types: [ {
            name: 'Cpd0DesignElement',
            properties: [ {
                name: 'cpd0design_element_id'
            } ]
        },
        {
            name: 'Cpd0DesignFeature',
            properties: [ {
                name: 'cpd0design_feature_id'
            } ]
        }
    ]
};

/**
 * Finds the saved queries 'Design Component' and 'Design Feature'
 *
 * @returns {Promise} promise
 */
function getQueries() {
    if( DesignElementQuery !== null ) {
        return new Promise( ( res ) => res( ) );
    }
    const soaInput = {
            inputCriteria: [ {
                    queryNames: [ 'Design Component' ],
                    queryType: 0
                },
                {
                    queryNames: [ 'Design Feature' ],
                    queryType: 0
                }
            ]
    };
    return ngpSoaSvc.executeSoa( 'Query-2010-04-SavedQuery', 'findSavedQueries', soaInput ).then(
        ( response ) => {
            if( response.savedQueries && response.savedQueries.length === 2 ) {
                DesignElementQuery = response.savedQueries[ 0 ];
                DesignFeatureQuery = response.savedQueries[ 1 ];
                return new Promise( ( res ) => res( ) );
            }
    } );
}

/**
 *
 * @param {Set} elementIDs
 * @param {ModelObject} model - the model to search in
 * @param {ModelObject} configContext - the configuration context
 * @returns {Promise} promise
 */
function searchByIDs( elementIDs, model, configContext ) {
    return createSearchByIDExpressions( elementIDs ).then( ( expressions ) => {
        if( expressions && expressions.length > 0 ) {
            const executeSearchInput = {
                options: {
                    defaultLoadCount: 0
                },
                recipe: {
                    scope: {
                        model: model
                    },
                    configDetails: [ {
                        configContext: configContext,
                        configurationFor: 'Universal'
                    } ],
                    searchExpression: {
                        searchOperator: 'And',
                        searchExpression: {
                            doTrushapeRefinement: false,
                            searchExpressions: expressions
                        }
                    }
                }
            };
            const options = {
                propertyPolicyOverride: ngpSearchPolicy
            };
            return ngpSoaSvc.executeSoa( 'ModelCore-2011-06-Search', 'executeSearch', executeSearchInput, options ).then(
                ( response ) => {
                    let idMap = new Map();
                    response.modelElements.forEach( ( element ) => {
                        const element_id = ngpTypeUtils.getProductElementID( element );
                        idMap.set( element_id, element.uid );
                    } );
                    return idMap;
            } );
        }
    } );
}

/**
 *
 * @param {Set} elementIDs - a set of element IDs
 * @param {ModelObject} model - the model to search in
 * @param {ModelObject} configContext - the configuration context
 * @param {ModelObject} partitionScheme - the partition scheme
 * @returns {Promise} - a promise with parents map
 */
function searchWherePartitioned( elementIDs, model, configContext, partitionScheme ) {
    return createSearchByIDExpressions( elementIDs ).then( ( expressions ) => {
        const executeSearchInput = {
            options: {
                defaultLoadCount: 0
            },
            scope: {
                scheme: partitionScheme,
                isOnlyImmediateGroupsReqd: false
            },
            recipe: {
                scope: {
                    model: model
                },
                configDetails: [ {
                    configContext: configContext,
                    configurationFor: 'Universal'
                } ],
                searchExpression: {
                    searchOperator: 'And',
                    searchExpression: {
                        doTrushapeRefinement: false,
                        searchExpressions: expressions
                    }
                }
            },
            exportOption: {
                applicationFormat: '',
                columnAttributes: []
            }
        };
        const options = {
            propertyPolicyOverride: ngpSearchPolicy
        };
        return ngpSoaSvc.executeSoa( 'Partition-2019-06-Search', 'executeSearch', executeSearchInput, options ).then(
            ( response ) => {
                let idMap = new Map();
                let parentsMap = new Map();
                if( response.modelElements ) {
                    response.modelElements.forEach( ( element ) => {
                        const element_id = ngpTypeUtils.getProductElementID( element );
                        idMap.set( element_id, element.uid );
                    } );
                    response.partitionGrps.forEach( ( group ) => {
                        if( group.members ) {
                            group.members.forEach( ( member ) => {
                                if( !parentsMap.has( member.uid ) ) {
                                    parentsMap.set( member.uid, new Set() );
                                }
                                parentsMap.get( member.uid ).add( group.partition.uid );
                            } );
                        }
                        group.childPartitionGroups.forEach( ( child ) => {
                            if( !parentsMap.has( child.partition.uid ) ) {
                                parentsMap.set( child.partition.uid, new Set() );
                            }
                            parentsMap.get( child.partition.uid ).add( group.partition.uid );
                        } );
                    } );
                }
                return { idMap, parentsMap };
            }
        );
    } );
}

/**
 *
 * @param {Set} elementIDs - a set of element IDs
 * @returns {Promise} - a promise with search expressions
 */
function createSearchByIDExpressions( elementIDs ) {
    if( elementIDs.size > 0 ) {
        return getQueries().then( () => {
            let DEIDs = [];
            let DFIDs = [];
            for( const id of elementIDs.values() ) {
                if( id.startsWith( 'DE' ) ) {
                    DEIDs.push( id );
                } else if( id.startsWith( 'DF' ) ) {
                    DFIDs.push( id );
                }
            }
            const searchExpInput = {
                savedQueryExpressions: []
            };
            if( DEIDs.length > 0 ) {
                const DEIDsString = DEIDs.join( ';' );
                searchExpInput.savedQueryExpressions.push( {
                    savedQueryExpression: {
                        savedQuery: DesignElementQuery,
                        entries: [ 'ID' ],
                        values: [ DEIDsString ]
                    },
                    clientid: 'DESearcExpression'
                } );
            }
            if( DFIDs.length > 0 ) {
                const DFIDsString = DFIDs.join( ';' );
                searchExpInput.savedQueryExpressions.push( {
                    savedQueryExpression: {
                        savedQuery: DesignFeatureQuery,
                        entries: [ 'ID' ],
                        values: [ DFIDsString ]
                    },
                    clientid: 'DFSearcExpression'
                } );
            }
            if( searchExpInput.savedQueryExpressions.length > 0 ) {
                return ngpSoaSvc.executeSoa( 'ModelCore-2014-10-Search', 'createSearchExpressions', { searchExpInput } ).then(
                    ( response ) => response.expressions.map( ( expr ) => expr.searchDef ) );
            }
        } );
    }
    return new Promise( ( res ) => res() );
}

let exports = {};
export default exports = {
    createSearchByIDExpressions,
    getQueries,
    searchWherePartitioned,
    searchByIDs
};
