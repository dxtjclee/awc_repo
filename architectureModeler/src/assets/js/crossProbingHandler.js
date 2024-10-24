// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * @module js/crossProbingHandler
 */
import AwPromiseService from 'js/awPromiseService';
import AwTimeoutService from 'js/awTimeoutService';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import soaSvc from 'soa/kernel/soaService';
import preferenceSvc from 'soa/preferenceService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';

var _selectedObjects = [];
var _tracelinkTypes = null;
var _tracelinkDirection = 0;

var _selectionSubDef = null;
var _occCtxSubDef = null;

/** Preference Name of Tracelink relations to navigate */
var CROSSPROBING_SELECTEDRELATIONTYPES = 'CrossProbing_SelectedRelationTypes'; //$NON-NLS-1$

/** Preference Name of Tracelink directions to navigate */
var CROSSPROBING_RELATIONTRAVERSALTYPE = 'CrossProbing_RelationTraversalType'; //$NON-NLS-1$

/**
 * Returns true if modelObjects1 array contains all elements of modelObjects2 array, false otherwise.
 *
 * @param {ModelObjectArray} modelObjects1 - Model Object array
 * @param {ModelObjectArray} modelObjects2 - Model Object array
 * @return {boolean} true if modelObjects1 contains all elements of modelObjects2, false otherwise.
 */
var arrayContains = function( modelObjects1, modelObjects2 ) {
    return modelObjects2.every( function( object1 ) {
        return _.findIndex( modelObjects1, _.matchesProperty( 'uid', object1.uid ) ) >= 0;
    } );
};

/**
 * Ensure the necessary preferences are loaded
 *
 * @return {Object} Promise
 */
var ensurePreferenceLoaded = function() {
    var deferred = AwPromiseService.instance.defer();
    if( _tracelinkTypes === null ) {
        var prefNames = [ CROSSPROBING_SELECTEDRELATIONTYPES, CROSSPROBING_RELATIONTRAVERSALTYPE ];
        var prefPromise = preferenceSvc.getMultiStringValues( prefNames );
        prefPromise.then( function( prefValuesMap ) {
            var relTypePrefValues = prefValuesMap[ CROSSPROBING_SELECTEDRELATIONTYPES ];
            if( relTypePrefValues && relTypePrefValues.length > 0 ) {
                _tracelinkTypes = '';
                _.forEach( relTypePrefValues, function( prefValue ) {
                    if( _tracelinkTypes.length > 0 ) {
                        _tracelinkTypes = _tracelinkTypes.concat( ',' );
                    }
                    _tracelinkTypes = _tracelinkTypes.concat( prefValue );
                } );
            }

            var relDirectionPrefValues = prefValuesMap[ CROSSPROBING_RELATIONTRAVERSALTYPE ];
            if( relDirectionPrefValues && relDirectionPrefValues.length > 0 ) {
                _tracelinkDirection = parseInt( relDirectionPrefValues[ 0 ] );
            }

            deferred.resolve( null );
        } );
    } else {
        deferred.resolve( null );
    }

    return deferred.promise;
};

/**
 * Construct SOA input for getRelatedElements SOA.
 *
 * @param {ModelObjectArray} elementsToExpand - elements to get related objects for
 * @param {ModelObject} productContextInfo - Product Context
 * @return {Object} SOA input for getRelatedElements SOA.
 */
var getGetRelatedElementsInput = function( elementsToExpand, productContextInfo ) {
    var inputs = {
        input: [ {
            elements: elementsToExpand,
            inputCtxt: {
                productContext: productContextInfo
            },
            requestPref: {
                activeRelationTypes: _tracelinkTypes,
                processDefiningObjects: 'false',
                processComplyingObjects: 'false',
                IncludeSubtypeLinks: 'false',
                processConnections: 'false',
                processReceivingSignals: 'false',
                processTransmittingSignals: 'false'
            }
        } ]
    };

    if( _tracelinkDirection !== 2 ) {
        inputs.input[ 0 ].requestPref.processDefiningObjects = 'true';
    }
    if( _tracelinkDirection !== 1 ) {
        inputs.input[ 0 ].requestPref.processComplyingObjects = 'true';
    }

    return inputs;
};

/**
 * Get Related Objects from getRelatedElements SOA response.
 *
 * @param {ISOAResponse} response - SOA response
 * @return {ModelObjectArray} Related Model Objects
 */
var getRelatedObjectsFromSOAResponse = function( response ) {
    var relatedObjects = [];

    var end1Elements = response.end1Elements;
    if( end1Elements ) {
        _.forEach( end1Elements, function( end1Element ) {
            var relatedDataMap = end1Element.relationData;
            // here map is double array, 1st array is keys, 2nd array is values
            if( relatedDataMap && relatedDataMap.length > 0 ) {
                relatedObjects = relatedObjects.concat( relatedDataMap[ 0 ] );
            }
        } );
    }

    var end2Elements = response.end2Elements;
    if( end2Elements ) {
        _.forEach( end2Elements, function( end2Element ) {
            var relatedDataMap = end2Element.relationData;
            // here map is double array, 1st array is keys, 2nd array is values
            if( relatedDataMap && relatedDataMap.length > 0 ) {
                relatedObjects = relatedObjects.concat( relatedDataMap[ 0 ] );
            }
        } );
    }

    return relatedObjects;
};

/**
 * Get Related Elements by invoking SOA
 *
 * @param {ModelObjectArray} selectedObjects - Selected Objects
 * @param {ModelObject} productContext - Product Context
 * @return {Object} Promise
 */
var getRelatedElements = function( selectedObjects, productContext ) {
    var deferred = AwPromiseService.instance.defer();
    if( _tracelinkTypes === null || _tracelinkTypes.length <= 0 ) {
        // if there are no tracelinks types to navigate, no need to proceed further
        return deferred.resolve( null );
    }

    var input = getGetRelatedElementsInput( selectedObjects, productContext );
    var promise = soaSvc.post( 'Internal-ActiveWorkspaceSysEng-2014-11-DiagramManagement', 'getRelatedElements',
        input );

    promise.then( function( response ) {
        var relatedObjects = getRelatedObjectsFromSOAResponse( response );
        deferred.resolve( relatedObjects );
    } );

    return deferred.promise;
};

/**
 * Cross-probe selected objects to select other end of the tracelinks
 * @param {Object} occContext occ mgmt context
 * @param {boolean} crossProbingMode cross probling mode
 */
var _crossProbe = function( occContext, crossProbingMode ) {
    // get selections
    var mselection = appCtxSvc.getCtx( 'mselected' );
    var selectedObjects = [];
    _.forEach( mselection, function( selection ) {
        if( selection && selection.modelType && cmm.isInstanceOf( 'Awb0ConditionalElement', selection.modelType ) ) {
            selectedObjects.push( selection );
        }
    } );

    // nothing is selected
    if( selectedObjects.length <= 0 ) {
        return;
    }

    if( _selectedObjects.length === selectedObjects.length && arrayContains( _selectedObjects, selectedObjects ) ) {
        // we are getting same selection that we had processed earlier. So, just return back
        return;
    }

    _selectedObjects = [];
    _selectedObjects = _selectedObjects.concat( selectedObjects );

    // ensure preference is loaded
    ensurePreferenceLoaded().then( function( /* result */ ) {
        // get Related Elements
        var productContext = occContext.productContextInfo;
        getRelatedElements( selectedObjects, productContext ).then( function( relatedObjects ) {
            // Select related objects
            if( relatedObjects && relatedObjects.length > 0 ) {
                _selectedObjects = _.uniq( _selectedObjects.concat( relatedObjects ) );

                let modifyOccContext = {
                    selectionsToModify: {
                        elementsToSelect:relatedObjects
                    },
                    CrossProbeMode : crossProbingMode };


                // fire aceElementsSelectedEvent to select the elements in ACE
                occmgmtUtils.updateValueOnCtxOrState( '', modifyOccContext, occContext );
            } else {
                occmgmtUtils.updateValueOnCtxOrState( 'CrossProbeMode', crossProbingMode, occContext, true );
            }
        } );
    } );

    return;
};

var _delayedCrossProbe = function( occContext, crossProbingMode ) {
    AwTimeoutService.instance( function() {
        _crossProbe( occContext, crossProbingMode );
    }, 500 );
};

/**
 * Method to get whether Cross-Probing Mode is On
 *
 * @param {Object} occContext occ mgmt context
 * @return {boolean} true when Cross-Probing Mode is On, false otherwise
 */
export let isCrossProbingActive = function( occContext ) {
    var crossProbingMode = occContext.CrossProbeMode;
    if( crossProbingMode ) {
        return crossProbingMode;
    }
    return false;
};

/**
 * Toggle the Cross-Probing mode On/Off
 *
 * @param {Object} occContext occ mgmt context
 * @return {boolean} true when Cross_Probing mode is turned ON, false otherwise
 */
export let toggleCrossProbing = function( occContext ) {
    var crossProbingMode = !exports.isCrossProbingActive( occContext );

    if( !crossProbingMode ) {
        _selectedObjects = [];
    }

    if( crossProbingMode ) {
        _delayedCrossProbe( occContext, crossProbingMode );

        // subscribe to selection changes, if not already subscribed
        if( !_selectionSubDef ) {
            _selectionSubDef = eventBus.subscribe( 'appCtx.update', function( eventData ) {
                if( eventData.name === 'mselected' ) {
                    _delayedCrossProbe( occContext, crossProbingMode );
                }
            } );
        }

        // subscribe to occ ctx change, if not already subscribed
        if( !_occCtxSubDef ) {
            _occCtxSubDef = eventBus.subscribe( 'appCtx.register', function( eventData ) {
                if( eventData.name === 'mselected' && eventData.value ) {
                    _delayedCrossProbe( occContext, crossProbingMode );
                } else if( eventData.name === 'occmgmtContext' && !eventData.value ) {
                    // de-registering
                    if( _selectionSubDef ) {
                        eventBus.unsubscribe( _selectionSubDef );
                        _selectionSubDef = null;
                    }
                    if( _occCtxSubDef ) {
                        eventBus.unsubscribe( _occCtxSubDef );
                        _occCtxSubDef = null;
                    }
                }
            } );
        }
    } else {
        // on toggle-off, unsubscribe event listeners
        if( _selectionSubDef ) {
            eventBus.unsubscribe( _selectionSubDef );
            _selectionSubDef = null;
        }
        if( _occCtxSubDef ) {
            eventBus.unsubscribe( _occCtxSubDef );
            _occCtxSubDef = null;
        }
        occmgmtUtils.updateValueOnCtxOrState( 'CrossProbeMode', crossProbingMode, occContext, true );
    }

    return crossProbingMode;
};

const exports = {
    isCrossProbingActive,
    toggleCrossProbing
};
/**
 * Register the Cross Probing Handler service
 *
 * @memberof NgServices
 * @member crossProbingHandler
 */
export default exports;
