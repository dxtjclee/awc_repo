// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * This service helps pack or unpack a bomline
 *
 * @module js/epPackUnpackService
 */

import soaService from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import {
    constants as epBvrConstants
} from 'js/epBvrConstants';
import cdm from 'soa/kernel/clientDataModel';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as epLoadConstants } from 'js/epLoadConstants';


/**
 * Flag for pack bomlines
 */
const PACK = 0;
/**
 * Flag for unpack bomlines
 */
const UNPACK = 1;

/**
 * Flag for pack all bomlines
 */
const PACKALL = 2;
/**
 * Flag for unpack all bomlines
 */
const UNPACKALL = 3;
/**
 * @param {Object} obj - The message bundles localized files
 * @param {Boolean} packUnpackFlag -  true => pack, false => unpack
 */
function packOrUnpack( obj, packUnpackFlag ) {
    return performPackOrUnpack( obj, packUnpackFlag === '0' ? PACK : UNPACK );
}

/**
 * Pack or unpack All given sub assembly
 *
 * @param {Object} obj - selected line
 * @param {Boolean} packUnpackAllFlag -  true => pack, false => unpack
 * @returns {Object} lines
 */
function packOrUnpackAll( obj, packUnpackAllFlag ) {
    return performPackOrUnpack( obj, packUnpackAllFlag === '2' ? PACKALL : UNPACKALL );
}
/**
 * Update postPackUnpack for given treeTable
 *
* @param {Object} dataprovider dataprovider that contains list that needs to be updated
 */
function updateOnPackOrUnpack( dataProvider ) {
    if( dataProvider ) {
        dataProvider.getViewModelCollection().clear();
        dataProvider.resetDataProvider();
    }
}

/**
 * Checks whether the input object is a packed line
 * @param {String} objectUid object uid
 */
function isPacked( objectUid ) {
    const vmo = cdm.getObject( objectUid );
    if( vmo ) {
        return vmo.props.bl_is_packed ? vmo.props.bl_is_packed.dbValues[ 0 ] === '1' : false;
    }
    return false;
}

/**
 * @param {Object} obj - objects to be packed or unpacked
 * @param {Boolean} flag -  flag to pack or unpack or pack all or unpack all
 */
export function performPackOrUnpack( obj, flag ) {
    var selectedObjs = [];
    if( Array.isArray( obj ) ) {
        selectedObjs = obj;
    }else{
        selectedObjs.push( obj );
    }
    var input = {
        lines: selectedObjs,
        flag: flag
    };
    return soaService.post( 'StructureManagement-2010-09-Structure', 'packOrUnpack', input )
        .then( function( response ) {
            const selectedObjUids = selectedObjs.map( ( obj ) => obj.uid );
            //get properties which are not in packunpack soa
            const loadTypes = [ epLoadConstants.GET_PROPERTIES ];
            const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( loadTypes, selectedObjUids, [ epBvrConstants.BL_IS_PACKED, epBvrConstants.BL_PACKED_LINES, epBvrConstants.BL_PARENT ] );
            return epLoadService.loadObject( loadTypeInputs, false ).then( function( response ) {
                const affectedParentUids = selectedObjs.map( ( obj ) => obj.props.bl_parent.dbValues[0] );
                eventBus.publish( 'epPostPackOrUnpackEvent', { selectedLines: selectedObjs, affectedParentUids : affectedParentUids } );
            } );
        } );
}

export default {
    packOrUnpack,
    packOrUnpackAll,
    updateOnPackOrUnpack,
    isPacked
};
