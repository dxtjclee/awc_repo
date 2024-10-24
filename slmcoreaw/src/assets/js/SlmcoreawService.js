// Copyright (c) 2022 Siemens

/**
 * Service for Slmcoreaw
 *
 * @module js/SlmcoreawService
 */

import appCtxSvc from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import dmService from 'soa/dataManagementService';
import listBoxService from 'js/listBoxService';
import _ from 'lodash';
import messageService from 'js/messagingService';
import dateTimeSvc from 'js/dateTimeService';


var exports = {};


/* Loads the LOV for manufacturing org Id if defined
* @param {Object} data - The data object
*/
var loadMfgOrgIdList = function( data ) {
    var tmpData = _.clone( data );

    let revUid;
    if( appCtxSvc.getCtx( 'selected.modelType.typeHierarchyArray' ).indexOf( 'ItemRevision' ) > -1 ) {
        tmpData.selectedNeutralPartRev = appCtxSvc.getCtx( 'selected' );
    }else{
        revUid = appCtxSvc.getCtx( 'selected.props.awb0UnderlyingObject' ).dbValues[0];

        dmService.getProperties( [ revUid ], [ 'items_tag' ] ).then( function() {
            tmpData.selectedNeutralPartRev = cdm.getObject( revUid );
        } );
    }

    return soaService.postUnchecked( 'Core-2013-05-LOV', 'getInitialLOVValues', {
        initialData:
        {
            lovInput:
            {
                boName: 'Lot',
                operationName: 'Edit',
                propertyValues: {
                    SampleStringKey: [ 'fnd0LOVContextObject', 'fnd0LOVContextPropName' ]
                }
            },
            propertyName: 'manufacturerOrgId',
            filterData:
            {
                filterString: '',
                maxResults: 0,
                numberToReturn: 2000,
                sortPropertyName: '',
                order: 0
            }
        }
    } ).then( function( response ) {
        if ( response.lovValues.length > 0 ) {
            tmpData.isMfgOrgIdLov = true;
            if ( response.moreValuesExist ) {
                tmpData = loadAllManufacturerIDs( response.lovValues, response.lovData, tmpData );
            } else {
                tmpData.manufacturerOrgIdList = listBoxService.createListModelObjectsFromStrings( response.lovValues.map(
                    function( lov ) {
                        return lov.propDisplayValues.object_name ? lov.propDisplayValues.object_name[0] :
                            lov.propDisplayValues.lov_values[0];
                    }
                ) );
            }
        }
        return tmpData;
    } );
};

let loadAllManufacturerIDs = ( values, lovData, data ) => {
    var serviceInput = {};
    serviceInput.lovData = lovData;
    return soaService.postUnchecked( 'Core-2013-05-LOV', 'getNextLOVValues', serviceInput ).then( function( response ) {
        if ( response.lovValues.length > 0 ) {
            let lovValues = values.concat( response.lovValues );
            if ( response.moreValuesExist ) {
                loadAllManufacturerIDs( lovValues, response.lovData, data );
            } else {
                data.manufacturerOrgIdList = listBoxService.createListModelObjectsFromStrings( lovValues.map(
                    function( lov ) {
                        return lov.propDisplayValues.object_name ? lov.propDisplayValues.object_name[0] :
                            lov.propDisplayValues.lov_values[0];
                    }
                ) );
            }
            return data;
        }
    } );
};


/**
 * @param {Object} data data object includes popup data
 * @param {Object} vmo ViewModelObject
 * @return the array object which is used as input for create Object SOA
 */

let getInputsForCreateLot = function( data, vmo ) {
    let info = [];
    let dataVal;
    let selectedNeutralPartRev = cdm.getObject( vmo.props.awb0UnderlyingObject.dbValues[0] );

    dataVal = {
        boName: 'Lot',
        stringProps: {
            lotNumber: data.lotNumber.dbValue,
            manufacturerOrgId: data.isMfgOrgIdLov ? data.manufacturerOrgIdLOV.dbValue : data.manufacturerOrgId.dbValue,
            object_name: data.lotNumber.dbValue
        },
        intProps: {
            lotSize: data.lotSize.dbValue
        },
        dateProps: {
            expirationDate: exports.getDateString( data.expirationDate.dbValue )
        },
        tagProps: {
            designItemTag: { uid: null }
        }
    };

    // For tc14.2 and below it will create only item level PLF.
    if( isTCReleaseAtLeast( 14, 3 ) ) {
        dataVal.tagProps.designItemTag.uid = data.selectedNeutralBomLines[0].uid;
    } else {
        dataVal.tagProps.designItemTag.uid = selectedNeutralPartRev.props.items_tag.dbValues[0];
    }

    info.push( {
        clientId: '',
        data: dataVal
    } );

    return info;
};


/**
 * @param {Object} majorVersion majorVersion
 * @param {Object} minorVersion minorVersion
 * @return boolean value as true if tcVersion is greater than majorVersion
 *         else false if tcVersion is less than majorVersion.
 * @example isTCReleaseAtLeast( 14, 3 ) - return true if we are using tc14.3 and onwards
 */

let isTCReleaseAtLeast = function( majorVersion, minorVersion ) {
    let majVer =  appCtxSvc.getCtx( 'tcSessionData.tcMajorVersion' );
    let minVer =  appCtxSvc.getCtx( 'tcSessionData.tcMinorVersion' );

    if( majVer > majorVersion ||  majVer === majorVersion && minVer >= minorVersion   ) {
        return true;
    }

    return false;
};

export let licenseCheck = function( response ) {
    var output = null;
    var err = null;
    if ( response.PartialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        if ( response.ServiceData && response.ServiceData.partialErrors ) {
            err = soaService.createError( response.ServiceData );
        } else {
            err = soaService.createError( response );
        }
        var errMessage = messageService.getSOAErrorMessage( err );
        messageService.showError( errMessage );
    }

    if ( response && response.output ) {
        output = response.output;
    }
    return output;
};

export let getDateString = function( dateObject ) {
    var dateValue;
    dateValue = dateTimeSvc.formatUTC( dateObject );
    return dateValue;
};

export default exports = {
    getInputsForCreateLot,
    loadMfgOrgIdList,
    licenseCheck,
    getDateString,
    isTCReleaseAtLeast
};
