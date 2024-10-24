// Copyright (c) 2022 Siemens

/**
 * Service used to back track objects
 *
 * @module js/ssp0BackingObjectProviderService
 *
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';

let exports = {};

/**
  * @param {String} uid uid
  * @param {String} type type
  */
const IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};
const excludeUiValues = {
    name: 'excludeUiValues',
    Value: 'true'
};

/**
  * Get SR Uid of Awb0Element from BOMLine Object Based on BOMLine Object Type
  * @param {String} bomLineObject BOMLine Object
  * @return {String} uid of design element object
  */
export let getDesignElementObject = function (bomLineObject) {
    let propertyPolicyOverride = {
        types: [{
            name: 'Awb0Element',
            properties: [{
                name: 'awb0UnderlyingObject',
                modifiers: [excludeUiValues]
            },
            {
                name: 'object_string',
                modifiers: [{
                    name: 'uIValueOnly',
                    Value: 'true'
                }]
            },
            {
                name: 'awb0Parent',
                modifiers: [{
                    name: 'withProperties',
                    Value: 'true'
                }]
            },
            {
                name: 'awb0CopyStableId',
                modifiers: [excludeUiValues]
            },
            {
                name: 'awb0NumberOfChildren',
                modifiers: [excludeUiValues]
            }
            ]
        }]
    };
    const productContext = appCtxSvc.getCtx('sbomProductContext');
    let elementsIn = {
        typeOfElementUids: 'SR_UID',
        elementUids: bomLineObject,
        productContext: productContext,
        requestPref: {

        }
    };

    return soaService.postUnchecked('Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getElementsForIds', { //$NON-NLS-1$
        elementsIn: elementsIn
    }, propertyPolicyOverride);
};

/**
  * Get Bom Lines of view Model Objects
  * @param {Array.Object} viewModelObjects viewModelObjects
  * @return {Array.Object} uid of Service Plan
  */
export let getBomLines = function( viewModelObjects ) {
    _.forEach( viewModelObjects, function( modelObjectUid, index ) {
        if ( modelObjectUid ) {
            let uid = modelObjectUid.uid.match( 'BOMLine(.*),' );
            uid = 'SR::N::' + uid[0].replace( ',,', '' );
            viewModelObjects[index] = new IModelObject( uid, 'BOMLine' );
        }
    } );
    return viewModelObjects;
};

/**
  * Get Bom Line of view Model Object
  * @param {Array.Object} viewModelObject viewModelObject
  * @return {Array.Object} uid of Service Plan
  */
export let getBomLine = function( viewModelObject ) {
    if ( viewModelObject ) {
        const vmo = getBomLines( [ viewModelObject ] );
        return vmo[0];
    }
};

/**
  * Get Bom Line Uid of view Model Object
  * @param {Array.Object} viewModelObject viewModelObject
  * @return {Object} object contains uid
  */
export let getBomLineUid = function( viewModelObject ) {
    if ( viewModelObject ) {
        const vmo = getBomLine( viewModelObject );
        return {
            bomLineUid: vmo.uid
        };
    }
};

export default exports = {
    getBomLines,
    getBomLine,
    getBomLineUid,
    getDesignElementObject
};
