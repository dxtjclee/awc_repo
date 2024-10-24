//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/*global
 */
/**
 * @module js/Ase1ShowInterfacesPanelService
 */
import dataManagementSvc from 'soa/dataManagementService';
import Ase0VisSelectionService from 'js/Ase0VisSelectionService';
import _ from 'lodash';


/**
 * Extract all the external nodes from the return data
 *
 * @param {Object} soaResponse The declarative data view model object.
 * @returns {Object} Promise with results array
 */
export let modifyResultsList = function( soaResponse ) {
    if( !soaResponse ) {
        return [];
    }

    const uids = [];
    const retResults = [];
    const bundledConnectionMap = {};

    for( const result of soaResponse.results ) {
        for( const edge of result.edgeData ) {
            // Workaround for issue with getInterfaces returning duplicate edges
            if( !bundledConnectionMap[ edge.end2Element.uid ] ) {
                retResults.push( edge.end2Element );
                uids.push( edge.end2Element.uid );
            }
            bundledConnectionMap[ edge.end2Element.uid ] = edge.edge;
        }
    }

    const columnPropNames = [];
    columnPropNames.push( 'awb0ArchetypeName' );
    columnPropNames.push( 'awb0ArchetypeRevName' );
    columnPropNames.push( 'awb0ArchetypeId' );
    columnPropNames.push( 'awb0ArchetypeRevId' );

    return dataManagementSvc.getProperties( uids, columnPropNames ).then( function() {
        return {
            retResults: retResults,
            bundledConnectionMap: bundledConnectionMap
        };
    } );
};

export let onButtonClick = function( selectedObjectsInPanel, pwaSelectedObj, bundledConnectionMap, occContext ) {
    var selObjects = [];
    selObjects.push( pwaSelectedObj );

    for( const obj of selectedObjectsInPanel ) {
        // Push the end element
        selObjects.push( obj );

        // Push the bundled connection
        const edge = bundledConnectionMap[ obj.uid ];
        selObjects.push( edge );
    }

    Ase0VisSelectionService.setViewerVisibility( selObjects, 'selectedOn', 'awDefaultViewer', occContext );
};

/**
 * Filters the other end objects based on the property value match
 *
 * @param {String} elementList - list of other end objects
 * @param {String} filter - filter text
 * @returns {Array} filtered list
 */
export let checkFilter = function( elementList, filter ) {
    var rData = [];
    for( const element of elementList ) {
        let filterMatched = _.isEmpty( filter );
        if( !filterMatched ) {
            // We have a filter, don't add nodes unless the filter matches a cell property
            for( const cellPropDbValue of element.props.awp0CellProperties.dbValues ) {
                const property = cellPropDbValue.toLocaleLowerCase().replace( /\\|\s/g, '' );
                if( property.indexOf( filter.toLocaleLowerCase().replace( /\\|\s/g, '' ) ) !== -1 ) {
                    // Filter matches a property, add node to output elementList and go to next node
                    filterMatched = true;
                    break;
                }
            }
        }
        if( filterMatched ) {
            rData.push( element );
        }
    }
    return rData;
};

/**
 * update inverse selection
 *
 * @param {Object} dataProvider data provider
 */
export let onInverseSelection = function( dataProvider ) {
    var selectionModel = dataProvider.selectionModel;
    //Toggle selection on every object in the list
    selectionModel.toggleSelection( dataProvider.viewModelCollection.getLoadedViewModelObjects() );
};

const exports = {
    modifyResultsList,
    onButtonClick,
    checkFilter,
    onInverseSelection
};

export default exports;
