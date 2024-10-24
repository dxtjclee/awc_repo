//@<COPYRIGHT>@
//==================================================
//Copyright 2018.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Interfaces tab legend manager
 *
 * @module js/Ase1InterfacesGraphLegendManager
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

let _legendData;

/**
 * Method to get the legend information
 *
 * @param {String} viewName - Interfaces tab view name
 * @param {Object} actionState action state
 * @returns {Promise} Resolved when ...
 */
export let getLegendData = function( viewName, actionState ) {
    if( _legendData ) {
        const activeLegendView = _.get( _legendData, 'legendViews[0]' );
        actionState && actionState.update( { modelUpdated: true } );
        return AwPromiseService.instance.resolve( activeLegendView );
    }

    var soaInput = {
        viewName: viewName
    };
    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceSysEng-2018-05-DiagramManagement', 'getDiagramLegend5', soaInput )
        .then( function( response ) {
            // Process SOA response
            if( response.legendTypesJSON ) {
                _legendData = JSON.parse( response.legendTypesJSON );
            }
            actionState && actionState.update( { modelUpdated: true } );
            return _.get( _legendData, 'legendViews[0]' );
        } );
};

export let getCategoryType = function( type, legendViews ) {
    var categoryType = '';
    if( legendViews && legendViews.categoryTypes && legendViews.categoryTypes.length > 0 ) {
        for( var i = 0; i < legendViews.categoryTypes.length; i++ ) {
            var categories = legendViews.categoryTypes[ i ];
            for( var j = 0; j < categories.categories.length; j++ ) {
                var typeName = categories.categories[ j ].internalName;
                if( typeName === type ) {
                    return typeName;
                }
            }
        }
    }
    return categoryType;
};

const exports = {
    getLegendData,
    getCategoryType
};

export default exports;
