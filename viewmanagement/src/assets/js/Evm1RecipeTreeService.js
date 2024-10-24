// Copyright (c) 2022 Siemens

/**
 * @module js/Evm1RecipeTreeService
 */
import parsingUtils from 'js/parsingUtils';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdmSvc from 'soa/kernel/clientDataModel';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import tcVmoService from 'js/tcViewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import awColumnSvc from 'js/awColumnService';
import _ from 'lodash';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

let exports = {};

let _columnForObjectName;

/**
 * Get a page of row data for a 'tree' table.
 * @returns {promise} promise
 */
export let loadTreeTableProperties = function() {
    /**
     * Extract action parameters from the arguments to this function.
     * <P>
     * Note: The order or existence of parameters can varey when more-than-one property is specified in the
     * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
     */
    let propertyLoadInput = '';
    for( let ndx = 0; ndx < arguments.length; ndx++ ) {
        let arg = arguments[ ndx ];

        if( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        }
    }

    return loadTreeProperties( propertyLoadInput );
};

/**
 * This function will be used to load tree node properties.
 * @param {object} propertyLoadInput property load inputs
 * @returns {promise} Promise object
 */
let loadTreeProperties = function( propertyLoadInput ) {
    let allChildNodes = [];
    let propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Evm1RecipeResults'
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, ( propertyLoadRequest ) => {
        _.forEach( propertyLoadRequest.childNodes, ( childNode ) => {
            if( !childNode.props ) {
                childNode.props = {};
            }
            allChildNodes.push( childNode );
        } );
    } );

    //ensure the required properties are loaded
    let policyId = policySvc.register( {
        types: [ {
            name: 'Evm1RecipeResultProxy',
            properties: [ {
                name: 'evm1UnderlyingObject'
            },
            {
                name: 'evm1SourceObject'
            },
            {
                name: 'evm1HasChildren'
            },
            {
                name: 'evm1Parent'
            }
            ]
        } ]
    } );

    let propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        () => {
            _.forEach( allChildNodes, ( childNode ) => {
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdmSvc
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, ( vmProp ) => {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                } );
            } );

            if( policyId ) {
                policySvc.unregister( policyId );
            }
            //update viewModelProperties
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
};

/**
 * This function is use to load result of recipe execution.
 * @returns {promise} promise
 */
export let loadRecipeSearchTreeData = async function() {
    /**
     * Extract action parameters from the arguments to this function.
     */
    let treeLoadInput = awTableSvc.findTreeLoadInput( arguments );
    /**
     * Check the validity of the parameters
     */

    return await buildTreeTableStructure( treeLoadInput, arguments[ 1 ], arguments[ 2 ] );
};

/**
 * This function calls the Soa performSearchViewModel5 to get the Recipe execution result.
 *
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {Data} data - data.
 *
 * @returns {promise} promise object
 */

let buildTreeTableStructure = async function( treeLoadInput, data, recipeState ) {
    const newRecipeState = { ...recipeState };
    newRecipeState.isRecipeExecuting = false;
    newRecipeState.recipeSearchCriteriaProvider.viewType = 'treeView';
    let soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Evm1RecipeResults',
            operationType: 'union'
        },
        searchInput: {
            maxToLoad: -1,
            maxToReturn: -1,
            providerName: 'Evm1ShowRecipeRsltsProvider',
            searchCriteria: recipeState.recipeSearchCriteriaProvider,
            searchFilterFieldSortType: 'Priority',
            searchSortCriteria: data.columnProviders.recipeSearchColumnProvider.sortCriteria,
            startIndex: data.dataProviders.recipeSearchDataProvider.startIndex,
            columnFilters: data.columnProviders.recipeSearchColumnProvider.columnFilters
        }
    };

    //ensure the required objects are loaded
    let policyId = policySvc.register( {
        types: [ {
            name: 'Evm1RecipeResultProxy',
            properties: [ {
                name: 'evm1UnderlyingObject'
            },
            {
                name: 'evm1SourceObject'
            },
            {
                name: 'evm1HasChildren'
            },
            {
                name: 'evm1Parent'
            }
            ]
        } ]
    } );

    const { searchResultsJSON } = await soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput );
    let recipeResultProxyObjects = [];
    if( searchResultsJSON ) {
        let searchResults = parsingUtils.parseJsonString( searchResultsJSON );
        if( searchResults && isArrayPopulated( searchResults.objects ) ) {
            _.forEach( searchResults.objects, ( object ) => {
                recipeResultProxyObjects.push( object );
            } );
        }
    }
    if( policyId ) {
        policySvc.unregister( policyId );
    }

    let treeLoadResult = processProviderResponse( treeLoadInput, recipeResultProxyObjects );
    newRecipeState.recipeResultProxyObjects = recipeResultProxyObjects;
    recipeState.update && recipeState.update( newRecipeState );
    return {
        treeLoadResult: treeLoadResult,
        recipeResultProxyObjects: recipeResultProxyObjects
    };
};

/**
 * isArrayPopulated
 *
 * @param {Object} object array of object
 * @returns {boolean} true if the array is populated
 */
let isArrayPopulated = function( object ) {
    let isPopulated = false;
    if( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
};

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {Array} recipeResultProxyObjects array of recipe result proxy objects
 * @return {object} response
 */

let processProviderResponse = function( treeLoadInput, recipeResultProxyObjects ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    let parentNode = treeLoadInput.parentNode;
    treeLoadInput.displayMode = 'Tree';
    treeLoadInput.parentElement = treeLoadInput.parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : treeLoadInput.parentNode.id;

    let levelNdx = parentNode.levelNdx + 1;
    let vmNodes = [];

    for( let idx = 0; idx < recipeResultProxyObjects.length; idx++ ) {
        let object = recipeResultProxyObjects[ idx ];
        let proxyObject = cdmSvc.getObject( object.uid );
        let parentProxyUid = _.get( proxyObject, 'props.evm1Parent.dbValues[0]', undefined );

        if( levelNdx === 0 ) {
            if( parentProxyUid ) {
                continue;
            }
        } else {
            let proxyObjectToExpand = cdmSvc.getObject( parentNode.uid );
            let sourceObjectUidToExpand = _.get( proxyObjectToExpand, 'props.evm1SourceObject.dbValues[0]', undefined );
            if( !sourceObjectUidToExpand || !parentProxyUid ) {
                continue;
            }
            let parentProxyObject = cdmSvc.getObject( parentProxyUid );
            let parentSourceObjectUid = _.get( parentProxyObject, 'props.evm1SourceObject.dbValues[0]', undefined );

            if( sourceObjectUidToExpand !== parentSourceObjectUid ) {
                continue;
            }
        }

        let displayName = '';
        if( object.props.hasOwnProperty( _columnForObjectName ) ) {
            displayName = object.props[ _columnForObjectName ].uiValues[ 0 ];
        } else {
            displayName = proxyObject.props.evm1SourceObject.uiValues[ 0 ];
        }

        let objType = object.type;
        let objUid = object.uid;
        let iconType = object.type;
        let iconURL = null;

        let endObjectVmo = viewModelObjectSvc.createViewModelObject( object.uid, 'EDIT' );
        if( endObjectVmo ) {
            iconType = endObjectVmo.type;
        }
        if( iconType ) {
            iconURL = iconSvc.getTypeIconURL( iconType );
        }
        let vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, idx, iconURL );

        let hasChildren = proxyObject.props.evm1HasChildren.dbValues[ 0 ];
        vmNode.isLeaf = hasChildren === '0';
        vmNode.alternateID = getUniqueId( vmNode );
        if( vmNode ) {
            vmNodes.push( vmNode );
        }
    }
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, false, true, true, null );
};

let getUniqueId = function( vmNode ) {
    return vmNode.uid + getNextCount();
};

const getNextCount = ( function() {
    let counter = 0;
    return function() {
        counter += 1;
        return counter;
    };
} )();

/**
 * _processUiConfigColumns
 *
 * @param {object} columns column
 * @return {Array} List of columns
 */
let _processUiConfigColumns = function( columns ) {
    // Save Column data for later arrange
    let treeColumnInfos = [];

    for( let idx = 0; idx < columns.length; ++idx ) {
        let columnInfo = awColumnSvc.createColumnInfo( {
            name: columns[ idx ].propertyName,
            propertyName: columns[ idx ].propertyName,
            displayName: columns[ idx ].displayName,
            typeName: columns[ idx ].associatedTypeName || columns[ idx ].typeName,
            maxWidth: 400,
            minWidth: 60,
            hiddenFlag: columns[ idx ].hiddenFlag,
            pixelWidth: columns[ idx ].pixelWidth,
            width: columns[ idx ].pixelWidth,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableSorting: true,
            enableColumnMoving: true,
            isTextWrapped: columns[ idx ].isTextWrapped
        } );

        treeColumnInfos.push( columnInfo );
    }

    if( treeColumnInfos.length > 0 ) {
        treeColumnInfos[ 0 ].isTreeNavigation = true;
        treeColumnInfos[ 0 ].enableColumnMoving = false;
        _columnForObjectName = treeColumnInfos[ 0 ].name;
    }
    return treeColumnInfos;
};

/**
 * Populate AwColumns from ColumnInfo
 * @param {Object} response SOA response of getOrResetUIColumnConfigs4
 * @param {Array} typesForArrange Original object type for arrange
 * @returns {Object} column config
 */
export let populateAwColumns = function( response, typesForArrange ) {
    let columnConfigData = _.get( response, 'columnConfigurations[0].columnConfigurations[0]' );
    if( columnConfigData ) {
        columnConfigData.columns = _processUiConfigColumns( columnConfigData.columns );
        columnConfigData.typesForArrange = typesForArrange;
    }
    return columnConfigData;
};

/**
 * Checks if string ends with given suffix
 * @param {str} str string
 * @param {suffix} suffix suffix
 * @return {boolean} true if the suffix is exists in given string
 */
let stringEndsWith = function( str, suffix ) {
    return str.indexOf( suffix, str.length - suffix.length ) !== -1;
};

/**
 * filterForProxy
 *
 * @param {vmos} vmos view model objects
 * @return {Array} List of proxy objects
 */

export let filterForProxy = function( vmos ) {
    let proxys = [];
    if( vmos ) {
        _.forEach( vmos, ( vmo ) => {
            if( stringEndsWith( vmo.type, 'Proxy' ) ) { proxys.push( vmo ); }
        } );
    }
    return proxys;
};

/**
 * Function to load child tree nodes. Its a next action function for dataprovider.
 * @returns {Object} data for child tree nodes.
 */
export let loadRecipeSearchChildData = function() {
    // Extract action parameters from the arguments to this function.
    let treeLoadInput = awTableSvc.findTreeLoadInput( arguments );

    // Check the validity of the parameters

    // Get the 'child' nodes
    let treeLoadResult = processProviderResponse( treeLoadInput, arguments[ 2 ].recipeResultProxyObjects );
    return {
        treeLoadResult: treeLoadResult
    };
};

export default exports = {
    loadTreeTableProperties,
    loadRecipeSearchTreeData,
    filterForProxy,
    populateAwColumns,
    loadRecipeSearchChildData
};
