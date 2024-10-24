// Copyright (c) 2022 Siemens

/**
 * Service to query recent model types and available model types form server
 *
 * @module js/attributeDefinitionTypesService
 */
import AwPromiseService from 'js/awPromiseService';
import prefSvc from 'soa/preferenceService';
import _ from 'lodash';
import logger from 'js/logger';

var exports = {};

var _prefMap = null;

var MRU_MODEL_TYPES_PREFERENCE = 'Create_Att0MeasurableAttribute_mru_list';

var MAX_NUMBER_OF_MRU_MODEL_TYPES_PREFERENCE = 'Create_Att0MeasurableAttribute_mru_max';

var PLE_MEASURABLEATTRPARENTOBJECTTYPES_PREFERENCE = 'PLE_MeasurableAttrParentObjectTypes';

var PLE_MEASURABLEATTRSUBTYPES_PREFERENCE = 'PLE_MeasurableAttrSubTypes';

var DEFAULT_MRU_MAX = 5;

var defaultParentObjectTypes = [ 'Fnd0LogicalBlockRevision', 'Fnd0SystemModelRevision', 'Requirement Revision',
    'PSConnectionRevision'
];

/**
 * Get the allowed parent objects for measurable attribute
 *
 * @return {Object} promise object
 */
export let getMeasurableAttrParentObjectTypes = function() {
    var measurementParentTypes = defaultParentObjectTypes;
    var deferred = AwPromiseService.instance.defer();
    prefSvc.getStringValues( [ PLE_MEASURABLEATTRPARENTOBJECTTYPES_PREFERENCE ] ).then( function( types ) {
        if( types ) {
            measurementParentTypes = [];

            for( var i = 0; i < types.length; i++ ) {
                measurementParentTypes.push( types[ i ] );
            }
        }
        deferred.resolve( {
            parentObjectTypes: measurementParentTypes
        } );
    } );
    return deferred.promise;
};

/**
 * Get the Attribute Definition Type for the styesheet to be loaded
 *
 * @return {Object} promise object
 */
export let getMeasurableAttrType = function( typeName, defaultAttrType, applicationName ) {
    var deferred = AwPromiseService.instance.defer();
    var attrType = null;
    prefSvc.getStringValues( [ PLE_MEASURABLEATTRSUBTYPES_PREFERENCE ] ).then(
        function( types ) {
            if( types ) {
                for( var i = 0; i < types.length; i++ ) {
                    var typeToAttrTypeArray = types[ i ].split( ',' );
                    if( typeToAttrTypeArray && typeToAttrTypeArray.length === 3 &&
                        typeToAttrTypeArray[ 0 ].toUpperCase() === applicationName.toUpperCase() && typeToAttrTypeArray[ 1 ].toUpperCase() === typeName.toUpperCase() ) {
                        //eg: Weight,Double,Wnb0MassMeasurableAttribute
                        if( !( applicationName === 'Engineering' && applicationName === '' ) ) {
                            attrType = typeToAttrTypeArray[ 2 ];
                        }
                    } else if( typeToAttrTypeArray && typeToAttrTypeArray.length === 2 &&
                        typeToAttrTypeArray[ 0 ].toUpperCase() === typeName.toUpperCase() ) {
                        //eg: Integer,Att0MeasurableAttributeInt
                        if( applicationName === 'Engineering' || applicationName === '' ) {
                            attrType = typeToAttrTypeArray[ 1 ];
                        }
                    }
                }
            }
            if( !attrType ) {
                attrType = defaultAttrType;
            }
            deferred.resolve( attrType );
        } );
    return deferred.promise;
};

/**
 * Get the most recent Uids.
 *
 * @return {Object} promise object
 */
export let getRecentMruUids = function( maxRecentCountIn ) {
    var deferred = AwPromiseService.instance.defer();
    prefSvc.getMultiStringValues( [ MRU_MODEL_TYPES_PREFERENCE, MAX_NUMBER_OF_MRU_MODEL_TYPES_PREFERENCE ] ).then(
        function( prefs ) {
            _prefMap = prefs;

            var maxRecent = maxRecentCountIn;
            if( !maxRecent || !_.isNumber( maxRecent ) ) {
                maxRecent = DEFAULT_MRU_MAX;

                var maxRecentTypeCount = prefs[ MAX_NUMBER_OF_MRU_MODEL_TYPES_PREFERENCE ];
                if( maxRecentTypeCount && maxRecentTypeCount.length > 0 ) {
                    try {
                        maxRecent = parseInt( maxRecentTypeCount[ 0 ] );
                    } catch ( exception ) {
                        logger.error( 'Invalid Create_Att0MeasurableAttribute_mru_max preference value.' );
                    }
                }
            }
            var recentUsedTypeNames = prefs[ MRU_MODEL_TYPES_PREFERENCE ];
            var recentTypesToLoad = _.uniq( recentUsedTypeNames ).slice( 0, maxRecent );
            deferred.resolve( recentTypesToLoad );
        } );
    return deferred.promise;
};

/**
 * Update the recent MruUids
 *
 * @return {Object} the promise object
 */
export let updateRecentMruUids = function( recentAttributeUid ) {
    if( !recentAttributeUid ) {
        return null;
    }

    var existingMruUids = null;
    if( _prefMap ) {
        existingMruUids = _prefMap[ MRU_MODEL_TYPES_PREFERENCE ];
    }

    var mruUids = [];
    mruUids.push( recentAttributeUid );
    if( existingMruUids ) {
        mruUids = _.union( mruUids, existingMruUids );
    }

    mruUids = _.uniq( mruUids );
    return prefSvc.setStringValue( MRU_MODEL_TYPES_PREFERENCE, mruUids );
};

export default exports = {
    getMeasurableAttrParentObjectTypes,
    getMeasurableAttrType,
    getRecentMruUids,
    updateRecentMruUids
};
