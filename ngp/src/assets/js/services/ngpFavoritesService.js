// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpDataUtils from 'js/utils/ngpDataUtils';
import cdm from 'soa/kernel/clientDataModel';
import ngpLoadSvc from 'js/services/ngpLoadService';
import ngpCmdCtxSvc from 'js/services/ngpCommandContextService';
import msgSvc from 'js/messagingService';
import favSvc from 'js/favoritesService';
import _ from 'lodash';

/**
 * NGP Favorites service
 *
 * @module js/services/ngpFavoritesService
 */
'use strict';

/**
 *
 * @param {modelObject} foundationObj - the foundation object
 * @return {promise} a promise object
 */
function addToFavoirtes( foundationObj ) {
    return favSvc.addFavorites( [ foundationObj ] ).then(
        () => true,
        ( error ) => {
            msgSvc.showError( error );
            return false;
        }
    );
}

/**
 *
 * @param {modelObject} foundationObj - the foundation object
 * @return {promise} a promise object
 */
function removeFromFavorites( foundationObj ) {
    return favSvc.removeFavorites( [ foundationObj ] ).then(
        () => false,
        ( error ) => {
            msgSvc.showError( error );
            return true;
        }
    );
}

/**
 *
 * @param {modelObject} modelObj - a given modelObject
 * @return {Promise} a promise object
 */
export function addNgpObjectToFavorites( modelObj ) {
    const foundationId = ngpDataUtils.getFoundationId( modelObj );
    let foundationObj = cdm.getObject( foundationId );
    if( !foundationObj ) {
        return ngpLoadSvc.loadObjects( [ foundationId ] ).then(
            ( response ) => {
                foundationObj = response.modelObjects[ foundationId ];
                return addToFavoirtes( foundationObj );
            }
        );
    }
    return addToFavoirtes( foundationObj );
}

/**
 *
 * @param {modelObject} modelObj - a given modelObject
 * @return {Promise} a promise object
 */
export function removeNgpObjectFromFavorites( modelObj ) {
    const foundationId = ngpDataUtils.getFoundationId( modelObj );
    let foundationObj = cdm.getObject( foundationId );
    if( !foundationObj ) {
        return ngpLoadSvc.loadObjects( [ foundationId ] ).then(
            ( response ) => {
                foundationObj = response.modelObjects[ foundationId ];
                return removeFromFavorites( foundationObj );
            }
        );
    }
    return removeFromFavorites( foundationObj );
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {Promise} a promise object
 */
export function isInFavorites( modelObject ) {
    if( modelObject ) {
        return favSvc.getFavorites( true ).then(
            ( favorites ) => {
                let isInFavorites = false;
                const foundationId = ngpDataUtils.getFoundationId( modelObject );
                for( let i in favorites ) {
                    if( favorites[ i ].uid === foundationId ) {
                        isInFavorites = true;
                        break;
                    }
                }
                return isInFavorites;
            }
        );
    }
    return new Promise( ( resolve ) => {
        resolve( null );
    } );
}

/**
 *
 * @param {Object} cmdCtx - the command context object
 * @param {string} pathToRelevantData - the path in the cmdCtx to fetch the relevant data
 * @param {string} pathToSaveInCmdCtx - the path to save in the cmdCtx
 * @returns {promise} - a promise
 */
export function addNgpObjectToFavoritesWithCmdCtxUpdate( cmdCtx, pathToRelevantData, pathToSaveInCmdCtx ) {
    const modelObj = _.get( cmdCtx, pathToRelevantData );
    return addNgpObjectToFavorites( modelObj ).then( ( isInFavorites ) => ngpCmdCtxSvc.updateObjectWithValue( cmdCtx, pathToSaveInCmdCtx, isInFavorites ) );
}

/**
 *
 * @param {Object} cmdCtx - the command context object
 * @param {string} pathToRelevantData - the path in the cmdCtx to fetch the relevant data
 * @param {string} pathToSaveInCmdCtx - the path to save in the cmdCtx
 * @returns {promise} - a promise
 */
export function removeNgpObjectFromFavoritesWithCmdCtxUpdate( cmdCtx, pathToRelevantData, pathToSaveInCmdCtx ) {
    const modelObj = _.get( cmdCtx, pathToRelevantData );
    return removeNgpObjectFromFavorites( modelObj ).then( ( isInFavorites ) => ngpCmdCtxSvc.updateObjectWithValue( cmdCtx, pathToSaveInCmdCtx, isInFavorites ) );
}

let exports;
export default exports = {
    addNgpObjectToFavorites,
    addNgpObjectToFavoritesWithCmdCtxUpdate,
    removeNgpObjectFromFavorites,
    removeNgpObjectFromFavoritesWithCmdCtxUpdate,
    isInFavorites
};
