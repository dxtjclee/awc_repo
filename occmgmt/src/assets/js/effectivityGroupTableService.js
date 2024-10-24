// Copyright (c) 2022 Siemens

/**
 * @module js/effectivityGroupTableService
 */

import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import unitEffConfigration from 'js/endItemUnitEffectivityConfigurationService';

var exports = {};

// This method is used in unit and date range EGO
export let getEffectivityGroupRevision = function( response ) {
    if(  response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }
    var newObject = response.output[ 0 ].objects[ 0 ];
    var effItem = cdm.getObject( newObject.uid );
    return cdm.getObject( effItem.props.revision_list.dbValues[ 0 ] );
};

// Used in both dateRange and Unit EGO
export let applyConfiguration = function( value, occContext ) {
    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    popupService.hide();
};

// Need to check this method - why this was used on scroll event in - used only in unit EGO
/**
    * Populate initial data
    *
    * @param {data} data The view model data
    */
export let populateInitialData = function( data ) {
    if( data ) {
        var vmoSize = data.dataProviders.effGroupDataProvider.viewModelCollection.loadedVMObjects.length;
        if( vmoSize > 0 ) {
            for( var vmoIndex = 0; vmoIndex < vmoSize; vmoIndex++ ) {
                var viewModelObj = data.dataProviders.effGroupDataProvider.viewModelCollection.loadedVMObjects[ vmoIndex ];
                if( viewModelObj ) {
                    var units = viewModelObj.props.units;
                    if( units ) {
                        units.isEditable = true;
                        units.isModifiable = true;
                        uwPropertyService.setEditState( units, true );
                    }
                    var endItem = viewModelObj.props.endItem;
                    if( endItem ) {
                        endItem.isEditable = true;
                        endItem.isModifiable = true;
                        endItem.finalReferenceType = 'ItemRevision';
                        uwPropertyService.setEditState( endItem, true );
                    }
                }
            }
        }
    }
};

// Used only in dateRange
let getFormattedDate_timezoned = function( date ) {
    date = typeof date === 'number' || typeof date === 'string' ? new Date( date ) : date;
    var MM = date.getMonth() + 1;
    MM = MM < 10 ? '0' + MM : MM;
    var dd = date.getDate();
    dd = dd < 10 ? '0' + dd : dd;
    var hh = date.getHours();
    hh = hh < 10 ? '0' + hh : hh;
    var mm = date.getMinutes();
    mm = mm < 10 ? '0' + mm : mm;
    var ss = date.getSeconds();
    ss = ss < 10 ? '0' + ss : ss;
    return date.getFullYear() + '-' + MM + '-' + dd + 'T' + hh + ':' + mm + ':' + ss + date.toString().slice( 28, 33 );
};

// Used only in dateRange
export let getDateRange = function( data ) {
    let result = [];
    if( data ) {
        if ( data.endDateOptions.dbValue === 'UP' || data.endDateOptions.dbValue === 'SO' ) {
            result = [ getFormattedDate_timezoned( data.startDateTime.dbValue ) ];
        } else{
            result = [ getFormattedDate_timezoned( data.startDateTime.dbValue ), getFormattedDate_timezoned( data.endDateTime.dbValue ) ];
        }
    }
    return result;
};

// Used only in dateRange
export let getOpenEndedStatus = function( data ) {
    if( data ) {
        if ( data.endDateOptions.dbValue === 'UP' ) {
            return 1;
        } else if( data.endDateOptions.dbValue === 'SO' ) {
            return 2;
        }
        return 0;
    }
};

// Used only in dateRange
export let applyDateEffectivityGroups = function( data, selectedGroupEffectivities ) {
    selectedGroupEffectivities = selectedGroupEffectivities.length ? selectedGroupEffectivities : [ selectedGroupEffectivities ];
    let groupEffectivityUidArray = unitEffConfigration.getUnitEffectivityGroupsFromProductContextInfo( data.subPanelContext.occContext );
    for( var i = 0; i < selectedGroupEffectivities.length; ++i ) {
        // Add to PCI if not present
        var index = groupEffectivityUidArray.indexOf( selectedGroupEffectivities[ i ].uid );
        if( index === -1 ) {
            groupEffectivityUidArray.push( selectedGroupEffectivities[ i ].uid );
        }
    }
    return groupEffectivityUidArray;
};

// Used only in dateRange
export let getEffComponent = ( data )=>{
    var obj = cdm.getObject( data.effectivity );
    return {
        uid: data.effectivity,
        type: obj.type
    };
};

export default exports = {
    getEffectivityGroupRevision,
    populateInitialData,
    applyConfiguration,
    getDateRange,
    getOpenEndedStatus,
    applyDateEffectivityGroups,
    getEffComponent
};
