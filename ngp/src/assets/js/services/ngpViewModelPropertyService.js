// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpDataUtils from 'js/utils/ngpDataUtils';
import localeSvc from 'js/localeService';
import ngpClassLibrarySvc from 'js/services/ngpClassLibraryService';
import ngpPropertyConstants from 'js/constants/ngpPropertyConstants';
import vmoSvc from 'js/viewModelObjectService';

import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import awIconService from 'js/awIconService';

/**
 * Utility to check mfg_ngp object type
 *
 * @module js/services/ngpViewModelPropertyService
 */
'use strict';

/**
 * Adds the class library property on the given modelObject. The class library object is fetched from the manufacturing model
 * @param {vmo} vmo - a given vmo
 * @return {promise} a promise object
 */
export function addClassLibraryProperty( vmo ) {
    const prop = ngpClassLibrarySvc.getClassLibraryProperty( vmo );
    if ( prop ) {
        vmo.props[prop.propertyDescriptor.name] = vmoSvc.constructViewModelProperty( prop, prop.propertyDescriptor.name, vmo );
        return new Promise( ( resolve ) => {
            resolve( null );
        } );
    }
    const mfgModelUid = ngpDataUtils.getMfgModelUid( vmo );
    return dms.getProperties( [ mfgModelUid ], [ ngpPropertyConstants.IS_CLASS_LIBRARY ] ).then(
        () => {
            const prop = ngpClassLibrarySvc.getClassLibraryProperty( vmo );
            if ( prop ) {
                vmo.props[prop.propertyDescriptor.name] = vmoSvc.constructViewModelProperty( prop, prop.propertyDescriptor.name, vmo );
            }
        }
    );
}

/**
 * Adds the
 * @param {modelObject} modelObject - a given modelObject
 */
export function addLocalizedTypeDisplayNames( modelObject ) {
    const localizedMessages = localeSvc.getLoadedText( 'NgpBaseMessages' );
    let uiDisplayName;
    if ( ngpTypeUtils.isActivity( modelObject ) ) {
        uiDisplayName = {
            capital: localizedMessages.activityDisplayNameCapital,
            lowerCase: localizedMessages.activityDisplayName,
            plural: localizedMessages.activitiesDisplayName
        };
    } else if ( ngpTypeUtils.isProcessElement( modelObject ) ) {
        uiDisplayName = {
            capital: localizedMessages.processDisplayNameCapital,
            lowerCase: localizedMessages.processDisplayName,
            plural: localizedMessages.processesDisplayName
        };
    } else if ( ngpTypeUtils.isBuildElement( modelObject ) ) {
        uiDisplayName = {
            capital: localizedMessages.beDisplayNameCapital,
            lowerCase: localizedMessages.beDisplayName,
            plural: localizedMessages.besDisplayName
        };
    } else if ( ngpTypeUtils.isOperation( modelObject ) ) {
        uiDisplayName = {
            capital: localizedMessages.operationDisplayNameCapital,
            lowerCase: localizedMessages.operationDisplayName,
            plural: localizedMessages.operationsDisplayName
        };
    } else if ( ngpTypeUtils.isManufacturingElement( modelObject ) ) {
        uiDisplayName = {
            capital: localizedMessages.meDisplayNameCapital,
            lowerCase: localizedMessages.meDisplayName,
            plural: localizedMessages.mesDisplayName
        };
    }
    modelObject.modelType.uiDisplayName = uiDisplayName;
}

/**
 * Sets typeIconURL property for the object
 * @param {ViewModelObject} vmo - given ViewModelObject
 */
export function setIconURL( vmo ) {
    vmo.thumbnailURL = awIconService.getThumbnailFileUrl( vmo );
    vmo.typeIconURL = awIconService.getTypeIconURL( vmo.type );
}

/**
 *
 * @param {ViewModelObject[]} vmos - a given set of VMOs
 * @returns {ViewModelObject[]} an updated set of VMOs
 */
export function updatePropertiesOfVmos( vmos ) {
    if( Array.isArray( vmos ) && vmos.length > 0 ) {
        return vmos.map( ( vmo ) => {
            const modelObj = cdm.getObject( vmo.uid );
            vmoSvc.updateViewModelObjectCollection( [ vmo ], [ modelObj ] );
            Object.keys( modelObj.props ).forEach( ( moPropName ) => {
                if( !vmo.props.hasOwnProperty( moPropName ) ) {
                    vmo.props[ moPropName ] = vmoSvc.constructViewModelProperty( modelObj.props[ moPropName ], moPropName, vmo );
                }
            } );
            return vmo;
        } );
    }
    return [];
}

/**
 * @param {String} name - the property name
 * @param {String} value - the property value
 * @param {ViewModelObject} vmo - the owning ViewModelObject
 * @returns {ViewModelProperty} the new property
 */
function createStringViewModelProperty( name, value, vmo ) {
    const property = {
        value: value,
        displayValue: [ value ],
        isModifiable: false,
        propType: 'STRING'
    };
    return vmoSvc.constructViewModelProperty( property, name, vmo );
}

/**
 * @param {String} name - the property name
 * @param {ModelObject[]} value - the property value
 * @param {ViewModelObject} vmo - the owning ViewModelObject
 * @returns {ViewModelProperty} the new property
 */
function createObjectArrayViewModelProperty( name, value, vmo ) {
    const property = {
        value: value,
        displayValue: [ value ],
        isModifiable: false,
        propType: 'OBJECTARRAY'
    };
    return vmoSvc.constructViewModelProperty( property, name, vmo );
}

export default {
    addLocalizedTypeDisplayNames,
    addClassLibraryProperty,
    setIconURL,
    updatePropertiesOfVmos,
    createStringViewModelProperty,
    createObjectArrayViewModelProperty
};
