//@<COPYRIGHT>@
//==================================================
//Copyright 2018.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/*global
 define
 */
/**
 * @module js/associatedItemsService
 */

import _ from 'lodash';
import eventBus from 'js/eventBus';

import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import preferenceService from 'soa/preferenceService';

var exports = {};
var _useSubclasses = false;
var _typeNameList = [];

//-------------------------------------------------------------------------
/**
 * Send the aceElementsSelectedEvent. The eventBus is accessible in this scope.
 *
 * @param {selectedCtxObject} - The data to send with the event.
 */
function sendAceElementsSelectedEvent( selectedCtxObject ) {
    // Update ACE to select the new object
    eventBus.publish( 'aceElementsSelectedEvent', {
        elementsToSelect: [ selectedCtxObject ],
        multiSelect: false
    } );

    // Close Panel via event
    eventBus.publish( 'complete', {
        source: 'toolAndInfoPanel'
    } );
}

//-------------------------------------------------------------------------
/**
 * Perform the action to cause the associated item to show in the ACE list and sub-location. The eventBus is not
 * accessible in this context. Call the appropriate function to send the event.
 *
 * @param {eventData} - The declarative event data object.
 */
export let gotoAssociatedItem = function( eventData ) {
    eventData.scope.data.panelIsActive = false;

    if( eventData && eventData.selectedObjects && eventData.selectedObjects[ 0 ] ) {
        sendAceElementsSelectedEvent( cdm.getObject( eventData.selectedObjects[ 0 ].uid ) );
    }
};

//-------------------------------------------------------------------------
/**
 * Check if input object is a positioned element or a type in ASE0_Show_3D_Data_On_Selection
 *
 * @param {obj} - The model object.
 */
function checkIfTypeDisplayedInResultsList( obj ) {
    if( obj !== null ) {
        if( cmm.isInstanceOf( 'Awb0PositionedElement', obj.modelType ) ) {
            return true;
        }

        for( var j = 0; j < _typeNameList.length; j++ ) {
            if( _useSubclasses ) {
                if( cmm.isInstanceOf( _typeNameList[ j ], obj.modelType ) ) {
                    return true;
                }
            } else {
                if( obj.type === _typeNameList[ j ] ) {
                    return true;
                }
            }
        }
    }

    return false;
}

//-------------------------------------------------------------------------
/**
 * Create an array of all model objects that are not themselves tracelinks.  These are the objects the tracelinks reference.
 * Replace the previous, referencing, entries with the model objects being referenced.
 *
 * @param {data} - The declarative data view model object.
 */
export let modifyResultsList = function( data ) {
    if( !data ) {
        return null;
    }

    // If the search found related objects, replace the relations/tracelink objects with them.
    var related = [];
    if( data.searchResults ) {
        for( var i = 0; i < data.searchResults.length; i++ ) {
            related.push( data.searchResults[ i ].props.ase0RelatedElement.dbValues[ 0 ] );
        }
    } else {
        data.searchResults = [];
    }

    if( related.length > 0 ) {
        data.searchResults.length = 0;
        for( var k = 0; k < related.length; k++ ) {
            var obj = data.ServiceData.modelObjects[ related[ k ] ];

            if( checkIfTypeDisplayedInResultsList( obj ) ) {
                data.searchResults.push( obj );
            }
        }
    }

    return data.searchResults;
};

//-------------------------------------------------------------------------
/**
 * getRootElementUids joins the UIDs array (keys of elementToPCIMap) into a space-separated string/list.
 */
export let getRootElementUids = function( data ) {
    data.panelIsActive = true;

    if( data.subPanelContext.occContext.elementToPCIMap ) {
        return Object.keys( data.subPanelContext.occContext.elementToPCIMap ).join( ' ' );
    } else if( data.subPanelContext.occContext.topElement ) {
        return data.subPanelContext.occContext.topElement.uid;
    }

    return '';
};

//-------------------------------------------------------------------------
/**
 * getProductContextUids joins the UIDs array (values of elementToPCIMap) into a space-separated string/list.
 */
export let getProductContextUids = function( data ) {
    if( data.subPanelContext.occContext.elementToPCIMap ) {
        var uids = [];
        for( var i in data.subPanelContext.occContext.elementToPCIMap ) {
            if( data.subPanelContext.occContext.elementToPCIMap.hasOwnProperty( i ) ) {
                uids.push( data.subPanelContext.occContext.elementToPCIMap[ i ] );
            }
        }
        return uids.join( ' ' );
    } else if( data.subPanelContext.occContext.productContextInfo ) {
        return data.subPanelContext.occContext.productContextInfo.uid;
    }

    return '';
};

var loadConfiguration = function() {
    preferenceService.getStringValues( [ 'ASE0_Show_3D_Data_On_Selection' ] ).then( function( types ) {
        if( types ) {
            for( var i = 0; i < types.length; i++ ) {
                _typeNameList.push( types[ i ] );
            }
        }
    } );

    preferenceService.getLogicalValue( 'ASE0_Show_3D_Data_For_Subclasses' ).then(
        function( result ) {
            if( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
                _useSubclasses = true;
            } else {
                _useSubclasses = false;
            }
        } );
};

loadConfiguration();

//-------------------------------------------------------------------------
/**
 * Closure Rule Configuration service utility
 */

export default exports = {
    gotoAssociatedItem,
    modifyResultsList,
    getRootElementUids,
    getProductContextUids
};


//-------------------------------------------------------------------------
