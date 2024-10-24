// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpDataUtils from 'js/utils/ngpDataUtils';
import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpNavigationSvc from 'js/services/ngpNavigationService';
import ngpCmdCtxSvc from 'js/services/ngpCommandContextService';
import _ from 'lodash';

/**
 * NGP Pin service
 *
 * @module js/services/ngpPinService
 */
'use strict';

const NGP_TILE_TEMPLATE = 'Ngp0PinnedObjectTemplate';

/**
 * @param {modelObject} modelObj - a given modelObject
 * @return {promise} a promise object which returns a JSON
 *
 */
function getPinObjectsSoaInput( modelObj ) {
    return ngpNavigationSvc.getDefaultSubpageName( modelObj ).then(
        ( subpageName ) => {
            return {
                input: [ {
                    uid: ngpDataUtils.getFoundationId( modelObj ),
                    actionParams: getPinParameters( modelObj, subpageName ),
                    templateId: NGP_TILE_TEMPLATE
                } ]
            };
        }
    );
}

/**
 * @param {modelObject} modelObj - a given modelObject
 * @return {JSON} the soa input object
 */
function getUnpinObjectSoaInput( modelObj ) {
    return {
        returnGateway: false,
        uidsToUnpin: [ ngpDataUtils.getFoundationId( modelObj ) ]
    };
}

/**
 * @param {modelObject} modelObj - a given modelObject
 * @param {string} subpageName - the subpage name
 * @return {string} the string pin parameters
 */
function getPinParameters( modelObj, subpageName ) {
    const locationString = subpageName.replace( '/', '' );
    const foundationId = ngpDataUtils.getFoundationId( modelObj );
    return `${locationString}?uid=${foundationId}`;
}

/**
 * @param {modelObject} modelObj - a given modelObject
 * @return {promise} a promise object
 */
export function pinNgpObjectToHome( modelObj ) {
    if( modelObj ) {
        return getPinObjectsSoaInput( modelObj )
            .then(
                ( soaInput ) => ngpSoaSvc.executeSoa( 'Internal-AWS2-2018-05-DataManagement', 'pinObjects', soaInput ) )
            .then(
                () => true,
                () => false
            );
    }
}

/**
 *
 * @param {Object} cmdCtx - the command context object
 * @param {string} pathToRelevantData - the path in the cmdCtx to fetch the relevant data
 * @param {string} pathToSaveInCmdCtx - the path to save in the cmdCtx
 * @returns {promise} - a promise
 */
export function pinNgpObjectToHomeWithCmdCtxUpdate( cmdCtx, pathToRelevantData, pathToSaveInCmdCtx ) {
    const modelObj = _.get( cmdCtx, pathToRelevantData );
    return pinNgpObjectToHome( modelObj ).then( ( isPinnedToHome ) => ngpCmdCtxSvc.updateObjectWithValue( cmdCtx, pathToSaveInCmdCtx, isPinnedToHome ) );
}

/**
 * @param {modelObject} modelObj - a given modelObject
 * @return {promise} a promise object
 */
export function unpinNgpObjectFromHome( modelObj ) {
    if( modelObj ) {
        return ngpSoaSvc.executeSoa( 'Internal-AWS2-2018-05-DataManagement', 'unpinObjects', getUnpinObjectSoaInput( modelObj ) ).then(
            () => false,
            () => true
        );
    }
}

/**
 *
 * @param {Object} cmdCtx - the command context object
 * @param {string} pathToRelevantData - the path in the cmdCtx to fetch the relevant data
 * @param {string} pathToSaveInCmdCtx - the path to save in the cmdCtx
 * @returns {promise} - a promise
 */
export function unpinNgpObjectFromHomeWithCmdCtxUpdate( cmdCtx, pathToRelevantData, pathToSaveInCmdCtx ) {
    const modelObj = _.get( cmdCtx, pathToRelevantData );
    return unpinNgpObjectFromHome( modelObj ).then( ( isPinnedToHome ) => ngpCmdCtxSvc.updateObjectWithValue( cmdCtx, pathToSaveInCmdCtx, isPinnedToHome )  );
}

/**
 * Updates the visibility of the current scope object
 * @param {modelObject} modelObject - a given model object
 * @return {Promise} a promise object
 */
export function isPinnedToHome( modelObject ) {
    if( modelObject ) {
        return ngpSoaSvc.executeSoa( 'Internal-AWS2-2022-12-DataManagement', 'getCurrentUserGateway3', {} ).then(
            ( response ) => {
                let isPinned = false;
                const foundationId = ngpDataUtils.getFoundationId( modelObject );
                if( response && response.tileGroups ) {
                    response.tileGroups.some( ( group ) => {
                        group.tiles.some( ( tile ) => {
                            if( tile.action && tile.action.actionParams && tile.action.actionParams.uid === foundationId ) {
                                isPinned = true;
                            }
                            return isPinned;
                        } );
                        return isPinned;
                    } );
                }
                return isPinned;
            }
        );
    }
    return new Promise( ( resolve ) => {
        resolve( false );
    } );
}

let exports;
export default exports = {
    pinNgpObjectToHome,
    pinNgpObjectToHomeWithCmdCtxUpdate,
    unpinNgpObjectFromHome,
    unpinNgpObjectFromHomeWithCmdCtxUpdate,
    isPinnedToHome
};
