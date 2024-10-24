// Copyright (c) 2022 Siemens

/**
 * This is a helper class for the Audit Norm Selection
 *
 * @module js/qa0AuditMetaStatusService
 */
import _ from 'lodash';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';

var exports = {};

export let initializeData = function( context ) {
    var deferred = AwPromiseService.instance.defer();
    var status = [];
    var currState;
    soaService.post( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: [ 'Qa0QualityAudit_default_releasestatus' ],
        includePreferenceDescriptions: false
    } ).then( function( result ) {
        if( result && result.response && result.response.length > 0 ) {
            var prefArray = result.response[0].values.values;

            for( var i = 0; i < prefArray.length; i++ ) {
                var mapObjs = prefArray[i].split( ':' );
                var statusList = mapObjs[1].split( ',' );
                var isActive = false;
                var displayValue = context.xrtSummaryContextObject.props.release_status_list.displayValues[0];
                if( displayValue !== null && statusList.includes( displayValue ) ) {
                    isActive = true;
                }
                status.push( {
                    dbValue:  mapObjs[0],
                    propertyDisplayName:  mapObjs[0],
                    isCurrentActive: isActive,
                    isCompleted: false,
                    isInProgress: isActive
                }  );
            }
        }

        return deferred.resolve( { states: status,
            currentState: currState }
        );
    } );
    return deferred.promise;
};


export default exports = {
    initializeData
};
