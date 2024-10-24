//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 *
 *
 * @module js/showAssociatedDiagramsService
 */


import viewModelObjectService from 'js/viewModelObjectService';
import showObjectCommandHandler from 'js/showObjectCommandHandler';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cmm from 'soa/kernel/clientMetaModel';

/**
 * Open created diagram object
 *
 * @param {data} data from declViewModel
 */
export let openDiagram = function( data ) {
    var vmo = null;
    if( data && data.createdObject ) {
        vmo = data.createdObject;
    } else if( data && data.selectedCell ) {
        vmo = data.selectedCell;
    }

    if( showObjectCommandHandler && vmo ) {
        showObjectCommandHandler.execute( vmo, null, false );
    }
};

/**
 * process the response and extract the relations from the related model objects
 *
 * Filter and return list of related data
 *
 * @param {response} data - response from SOA
 */
export let processSoaResponseFunc = function( data ) {
    var rData = [];
    var diagramProxyList = [];

    if( data.totalFound > 0 ) {
        diagramProxyList = data.searchResults;

        if( diagramProxyList.length > 0 ) {
            _.forEach( diagramProxyList, function( diagramProxyObj ) {
                var diagramProxyObject = viewModelObjectService
                    .createViewModelObject( diagramProxyObj.uid, 'EDIT' );

                if( diagramProxyObject.props && diagramProxyObject.props.ase0EndObject &&
                    diagramProxyObject.props.ase0EndObject.dbValues ) {
                    var diagramModelObject = viewModelObjectService.createViewModelObject(
                        diagramProxyObject.props.ase0EndObject.dbValue, 'EDIT' );

                    if( diagramModelObject && cmm.isInstanceOf( 'Ase0Diagram', diagramModelObject.modelType ) ) {
                        rData.push( diagramModelObject );
                    }
                }
            } );
        }
    }
    data.relatedDiagramList.dbValue = rData;
    data.relatedDiagramFilterList.dbValue = data.relatedDiagramList.dbValue;
};

/**
 * Filters the other end objects based on the property value match
 *
 * @param {String} elementList - list of other end objects
 * @param {String} filter - filter text
 * @returns {Object } rData data
 */
export let checkFilter = function( elementList, filter ) {
    var rData = [];
    for( var i = 0; i < elementList.length; ++i ) {
        var object = elementList[ i ];
        if( filter !== '' ) {
            if( object.props && object.props.awp0CellProperties ) {
                // We have a filter, don't add nodes unless the filter matches a cell property
                for( var idx = 0; idx < object.props.awp0CellProperties.dbValues.length; idx++ ) {
                    var property = object.props.awp0CellProperties.dbValues[ idx ].toLocaleLowerCase().replace(
                        /\\|\s/g, '' );
                    if( property.indexOf( filter.toLocaleLowerCase().replace( /\\|\s/g, '' ) ) !== -1 ) {
                        // Filter matches a property, add node to output elementList and go to next node
                        rData.push( elementList[ i ] );
                        break;
                    }
                }
            }
        } else {
            // No filter, just add the node to output elementList
            rData.push( elementList[ i ] );
        }
    }
    return rData;
};

/**
 * Filter and return list of related data
 *
 * @param {viewModelJson} data - The view model data
 */
export let actionFilterList = function( data ) {
    //maintaining list of original data
    var rData = data.relatedDiagramList.dbValue;

    var filter = '';
    if( 'filterBox' in data && 'dbValue' in data.filterBox ) {
        filter = data.filterBox.dbValue;
    }

    if( rData.length > 0 ) {
        var endElements = this.checkFilter( rData, filter );
        //update the list based on filter criteria
        data.relatedDiagramFilterList.dbValue = endElements;
    }
    return {
        showDeleteButton : false
    };
};

export let updateDeleteButtonVisibility = function( dataprovider, occMgmtContext, associateDiagramState ) {
    var selection = dataprovider.selectedObjects;

    var openDiagramObj = null;
    if( occMgmtContext && occMgmtContext.workingContextObj ) {
        openDiagramObj = occMgmtContext.workingContextObj;
    }
    associateDiagramState.showDeleteButton = false;

    if( selection && selection.length > 0 ) {
        for( var idx = 0; idx < selection.length; idx++ ) {
            if( selection[ idx ].props.is_modifiable.dbValue ) {
                if( openDiagramObj ) {
                    if( openDiagramObj.uid === selection[ idx ].uid ) {
                        associateDiagramState.showDeleteButton = false;
                        break;
                    }
                    associateDiagramState.showDeleteButton = true;
                } else {
                    associateDiagramState.showDeleteButton = true;
                    break;
                }
            }
        }
    }
    return associateDiagramState;
};

export let getDiagramTargets = function( selected ) {
    eventBus.publish( 'showAssociatedDiagramsSub.updatePanel' );
};

export let initDiagramsPanel = function( selected ) {
    eventBus.publish( 'showAssociatedDiagramsSub.updatePanel' );
};


const exports = {
    openDiagram,
    processSoaResponseFunc,
    checkFilter,
    actionFilterList,
    updateDeleteButtonVisibility,
    getDiagramTargets,
    initDiagramsPanel
};
export default exports;

