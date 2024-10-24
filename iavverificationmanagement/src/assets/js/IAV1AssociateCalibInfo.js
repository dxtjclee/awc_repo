// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/IAV1AssociateCalibInfo
 */
import cdm from 'soa/kernel/clientDataModel';

var exports = {};
export let getCreateRelationInputForCalibInfo = function( primaryObject, secondaryObject ) {
    var input = [];
    var primary = _getObjects( primaryObject );
    var secondary = _getObjects( secondaryObject[0] );
    var tracelinkType = 'IAV0VerificationTL';
    var jsoObj = {
        clientId: '',
        primaryObject: {
            type: primary.type,
            uid: primary.uid
        },
        relationType: tracelinkType,
        secondaryObject: {
            type: secondary.type,
            uid: secondary.uid
        }
    };
    input.push( jsoObj );
    return input;
};

/**
 * This function returns the Item from ItemRevision.
 *
 * @param {String} uid - uid of an Item Revision.
 * @returns {Object} Item Object.
 */
var _getObjects = function( itemRev ) {
    var item = null;
    var selected = null;
    var mObject = null;
    var obj = {};
    if( itemRev.modelType.typeHierarchyArray.indexOf( 'PhysicalPartRevision' ) > -1 || itemRev.modelType.typeHierarchyArray.indexOf( 'IAV0CalibDataRevision' ) > -1 ) {
        mObject = cdm.getObject( itemRev.uid );
        selected = mObject.props.items_tag.dbValues[ 0 ];
    } else if( itemRev.modelType.typeHierarchyArray.indexOf( 'Sam1AsMaintainedElement' ) > -1 ) {
        var uid = itemRev.props.awb0UnderlyingObject.dbValues[ 0 ];
        mObject = cdm.getObject( uid );
        selected = mObject.props.items_tag.dbValues[ 0 ];
    }
    item = cdm.getObject( selected );
    obj = {
        type: item.type,
        uid: item.uid
    };
    return obj;
};

export let getSearchStringValue = function( data ) {
    if( data.filterBox && data.filterBox.dbValue === '' ) {
        return '';
    }
    return data.filterBox.dbValue;
};

export default exports = {
    getCreateRelationInputForCalibInfo,
    getSearchStringValue
};
