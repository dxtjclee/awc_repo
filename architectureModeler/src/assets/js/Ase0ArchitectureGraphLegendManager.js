// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module js/Ase0ArchitectureGraphLegendManager
 */
import soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import legendSvc from 'js/graphLegendService';

let _legendData = {};

/**
 * Get Legend Data
 * @param {String} viewName view name
 * @param {Object} occContext occ context
 * @returns {Object} legend data
 */
const getLegendData = async function( viewName, occContext ) {
    let underlyingObject = null;
    let localViewName = viewName;
    let topElement = occContext.topElement;
    if( occContext.elementToPCIMap ) {
        let topElementUid = _.findKey( occContext.elementToPCIMap, _.matches( occContext.productContextInfo.uid ) );
        if( topElementUid ) {
            topElement = cdm.getObject( topElementUid );
        }
    }

    if( topElement ) {
        const underlyingObjectUid = _.get( topElement, 'props.awb0UnderlyingObject.dbValues[0]' );
        if( underlyingObjectUid ) {
            underlyingObject = cdm.getObject( underlyingObjectUid );
        }
    }
    if( underlyingObject && underlyingObject.modelType ) {
        localViewName = viewName + '.' + underlyingObject.modelType.name;
    }

    if( _legendData && _legendData[ localViewName ] ) {
        // found in local cache, no need to call SOA
        return _legendData[ localViewName ];
    }

    const soaInput = {
        viewName: localViewName
    };
    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceSysEng-2018-05-DiagramManagement', 'getDiagramLegend5', soaInput ).then(
        function( response ) {
            let legData = null;
            // Process SOA response
            if( response.legendTypesJSON && response.legendTypesJSON.length > 0 ) {
                legData = JSON.parse( response.legendTypesJSON );
                _legendData[ localViewName ] = legData;
            }

            if( response.legendTypeNames && response.legendTypeNames.length > 0 ) {
                loadModelTypes( response.legendTypeNames );
            }

            return legData;
        } );
};

/*
 * method to populate the legend information in Graphing Component
 */
const initLegendData = function( graphCtx, data, graphState ) {
    const newGraphState = { ...graphState.value };
    if( graphCtx && data.legendData ) {
        const newLegend = { ...data.legend };
        legendSvc.initLegendViewsData( data.legendData );
        newLegend.legendViews = data.legendData.legendViews;
        setLabelCategories( newLegend.legendViews[ 0 ], newGraphState );
        data.legend.update( null, newLegend );
    }
    graphState.update && graphState.update( newGraphState );
};

/**
 *
 * Loading Relation model types in cache which are added in Relations Legend which are needed to decide whether its
 * type of connection or Trace link relation while drawing
 *
 * @param {StringArray} listOfModelTypes - relation type names loaded in relation legend panel
 */
var loadModelTypes = function( listOfModelTypes ) {
    if( listOfModelTypes.length > 0 ) {
        soaSvc.ensureModelTypesLoaded( listOfModelTypes );
    }
};

/*
 * method returns the category type of the graph element
 */
export let getCategoryType = function( type, scopeFilter, legendViews ) {
    var categoryType =  type.length > 0  ? 'Other' : '';

    if( legendViews && legendViews.categoryTypes ) {
        for( var i = 0; i < legendViews.categoryTypes.length; i++ ) {
            var categories = legendViews.categoryTypes[ i ];
            for( var j = 0; j < categories.categories.length; j++ ) {
                var subCategory = categories.categories[ j ].subCategories;
                if( scopeFilter && (  !categories.categories[ j ].scope  ||
                    categories.categories[ j ].scope && categories.categories[ j ].scope !== scopeFilter  ) ) {
                    continue;
                }

                var categoryElement = _.filter( subCategory, function( typeName ) {
                    return  typeName.internalName === type;
                } );
                if( categoryElement.length > 0 ) {
                    return categoryElement[ 0 ].parent.internalName;
                }
            }
        }
    }

    return categoryType;
};

/*
 * method returns the category type of the graph element
 */
export let getCategoryTypeFromObjectUid = function( uid, scopeFilter, legendViews ) {
    var modelObject = cdm.getObject( uid );
    if( !modelObject ) {
        return '';
    }

    return exports.getCategoryType( modelObject.type, scopeFilter, legendViews );
};

/*
 * method to set the filtered categories in legend
 */
export let setCategoryFilters = function( categoryType, categoryNames, legendView ) {
    if( !categoryType || !categoryNames || !legendView ||  categoryNames && categoryNames.length === 0  ) {
        return;
    }

    var objectCategoryType = _.find( legendView.categoryTypes, {
        internalName: categoryType
    } );

    if( objectCategoryType ) {
        _.forEach( categoryNames, function( categoryName ) {
            var category = _.find( objectCategoryType.categories, {
                internalName: categoryName
            } );
            if( category ) {
                category.isFiltered = true;
            }
        } );
    }
};

/**
 * Initialize the category API on graph model. The APIs will be used to calculate legend count.
 *
 * @param {Object} graphModel the graph model object
 */
export let initGraphCategoryApi = function( graphModel ) {
    let categoryApi = {
        getNodeCategory: function( node ) {
            if( node && node.appData ) {
                return node.appData.category;
            }

            return null;
        },
        getEdgeCategory: function( edge ) {
            if( edge ) {
                return edge.category;
            }
            return null;
        },
        getGroupRelationCategory: function() {
            return 'Structure';
        },
        getPortCategory: function( port ) {
            if( port ) {
                return port.category;
            }
            return null;
        },
        getBoundaryCategory: function( boundary ) {
            if( boundary ) {
                return boundary.category;
            }
            return null;
        }
    };
    graphModel.categoryApi = categoryApi;
    graphModel.update( 'categoryApi', categoryApi );
};
/**
 * Set label categories from legend view
 *
 * @param {Object} legendView the legend view object
 */
var setLabelCategories = function( legendView, graphState ) {
    var labelCategories = [];
    var relationsCategoryType = _.find( legendView.categoryTypes, {
        internalName: 'relations'
    } );
    var portsCategoryType = _.find( legendView.categoryTypes, {
        internalName: 'ports'
    } );
    if( relationsCategoryType ) {
        _.forEach( relationsCategoryType.categories, function( category ) {
            var categoryName = category.displayName;
            var internalName = category.internalName;
            //Need to skip Structure category
            if( categoryName.localeCompare( 'Structure' ) !== 0 &&
                categoryName.localeCompare( '' ) !== 0 ) {
                var relationsCat = {
                    categoryName: categoryName,
                    internalName: internalName,
                    categoryState: false
                };
                labelCategories.push( relationsCat );
            }
        } );
    }
    if( portsCategoryType ) {
        _.forEach( portsCategoryType.categories, function( category ) {
            var categoryName = category.displayName;
            var internalName = category.internalName;
            if( categoryName.localeCompare( '' ) !== 0 ) {
                var portCat = {
                    categoryName: categoryName,
                    internalName: internalName,
                    categoryState: false
                };
                labelCategories.push( portCat );
            }
        } );
    }

    if( graphState ) {
        graphState.labelCategories = labelCategories;
    }
};

/**
 *  Get filtered out types list of given category type
 *
 * @param {categoryType} categoryType type of category 'objects' 'relations' or 'ports'
 * @param {Object} activeLegendView active legend view
 * @return {filtered} list of types filtered out
 */
export let getFilteredTypes = function( categoryType, activeLegendView ) {
    var filtered = [];
    if( activeLegendView && activeLegendView.filteredCategories ) {
        _.forEach( activeLegendView.filteredCategories, function( category ) {
            if( category.categoryType === categoryType ) {
                _.forEach( category.subCategories, function( subcategory ) {
                    filtered.push( subcategory.internalName );
                } );
            }
        } );
    }
    return filtered;
};

/**
 * Get active categories list of given category type
 * @param {categoryType} categoryType categoryType type of category 'objects' 'relations' or 'ports'
 * @param {Object} activeLegendView active legend view
 * @return {unfiltered} list of categories which are active
 */
var getUnfilteredCategories = function( categoryType, activeLegendView ) {
    var unfiltered = [];
    if( activeLegendView ) {
        var relationsCategoryType = _.find( activeLegendView.categoryTypes, {
            internalName: categoryType
        } );
        if( relationsCategoryType ) {
            _.forEach( relationsCategoryType.categories, function( category ) {
                if( !category.isFiltered ) {
                    _.forEach( category.subCategories, function( subcategory ) {
                        unfiltered.push( subcategory );
                    } );
                }
            } );
        }
    }
    return unfiltered;
};

/**
 * Get active types list of given category type
 * @param {categoryType} categoryType categoryType type of category 'objects' 'relations' or 'ports'
 * @param {Object} activeLegendView active legend view
 * @return {unfilteredTypes} list of types which are active
 */
export let getUnfilteredTypes = function( categoryType, activeLegendView ) {
    var unfilteredTypes = [];
    var unfilteredCategories = getUnfilteredCategories( categoryType, activeLegendView );
    if( unfilteredCategories && unfilteredCategories.length > 0 ) {
        _.forEach( unfilteredCategories, function( subcategory ) {
            unfilteredTypes.push( subcategory.internalName );
        } );
    }
    return unfilteredTypes;
};

/**
 * Check which all types are active as per Relations Legend filter
 *
 * @param {types} types types to check if active or inactive as per legend filters
 * @param {Object} activeLegendView active legend view
 * @return {unfiltered} unfiltered types list
 */
export let getVisibleRelationTypes = function( types, activeLegendView ) {
    var unfiltered = [];
    if( types && types.length > 0 ) {
        var activeRelationTypes = exports.getUnfilteredTypes( 'relations', activeLegendView );
        var unfilteredCategories = getUnfilteredCategories( 'relations', activeLegendView );
        var filteredTypes = exports.getFilteredTypes( 'objects', activeLegendView );
        if( activeRelationTypes && activeRelationTypes.length > 0 ) {
            _.forEach( types, function( type ) {
                var typeToAdd = null;
                var objTypes = type.split( ';' );

                if( objTypes.length > 0 && objTypes[ 0 ] && objTypes[ 1 ] ) {
                    var relType = objTypes[ 0 ];
                    var objType = objTypes[ 1 ];
                    var scope = null;
                    var tlType = false;
                    if( _.indexOf( relType, ':' ) !== -1 ) {
                        var tlTypes = relType.split( ':' );
                        if( tlTypes.length > 0 && tlTypes[ 0 ] && tlTypes[ 1 ] === 'Context' ) {
                            relType = tlTypes[ 0 ];
                            scope = 'Context';
                        }
                    }
                    // Additional check for checking if trace link wso or occurrence
                    if( scope === 'Context' ) {
                        tlType = true;
                    } else {
                        var modelType = cmm.getType( relType );
                        if( modelType && cmm.isInstanceOf( 'FND_TraceLink', modelType ) ) {
                            tlType = true;
                            scope = 'Global';
                        }
                    }

                    if( !tlType && _.indexOf( activeRelationTypes, relType ) !== -1 ) {
                        typeToAdd = type;
                    } else if( tlType && unfilteredCategories.length > 0 ) {
                        var matchingCategory = _.find( unfilteredCategories, function( typeCategory ) {
                            return typeCategory.internalName === relType && typeCategory.parent && typeCategory.parent.scope === scope;
                        } );
                        if( matchingCategory ) {
                            typeToAdd = type;
                        }
                    }
                    // check if other end of relations in filtered or not filtered
                    if( typeToAdd && objType && filteredTypes && _.indexOf( filteredTypes, objType ) === -1 ) {
                        unfiltered.push( type );
                    }
                }
            } );
        }
    }
    return unfiltered;
};

const exports = {
    getLegendData,
    initLegendData,
    getCategoryType,
    getCategoryTypeFromObjectUid,
    setCategoryFilters,
    initGraphCategoryApi,
    getFilteredTypes,
    getUnfilteredTypes,
    getVisibleRelationTypes
};
export default exports;
