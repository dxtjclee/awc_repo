// Copyright (c) 2022 Siemens

import ClipboardService from 'js/clipboardService';
import localeService from 'js/localeService';
import messagingSvc from 'js/messagingService';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

/**
 * EP Cut Copy service
 *
 * @module js/epCutCopyService
 */


/**
 *
 * @param {ViewModelObject} objectsToCopy - objectsToCopy
 */
export function copy( objectsToCopy ) {
    removeExistingCutIndication();

    ClipboardService.instance.setContents( objectsToCopy );
    const resource = localeService.getLoadedText( 'epCopyMessages' );
    const addedToClipBoardMessage = getCopiedLocalizedMessage( resource, objectsToCopy );
    messagingSvc.showInfo( addedToClipBoardMessage );
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {String} objectsCopied - The copied objects
 * @returns {String} localizedValue - The localized message string
 */
function getCopiedLocalizedMessage( localTextBundle, objectsCopied ) {
    return objectsCopied && objectsCopied.length === 1 ? localTextBundle.epCopySingleSuccessful.format( objectsCopied[ 0 ].props.object_string.uiValues[ 0 ] ) :
        localTextBundle.epCopyMultipleSuccessful.format( objectsCopied.length );
}

/**
 *
 * @param {ViewModelObject} objectsToCut - objectsToCut
 */
export function cut( objectsToCut ) {
    removeExistingCutIndication();
    appCtxService.updatePartialCtx( 'cutIntent', true );
    ClipboardService.instance.setContents( objectsToCut );
}

/**
 * Remove existing cut indication
 */
export function removeExistingCutIndication() {
    if( appCtxService.getCtx( 'cutIntent' ) && appCtxService.getCtx( 'cutIntent' ) === true ) {
        appCtxService.updatePartialCtx( 'cutIntent', false );
        ClipboardService.instance.setContents( [] );
    }
}

/**
 * isObjectCut
 * @param {*} object object to check if cut
 * @returns {Boolean} yes/no
 */
export function isObjectCut( object ) {
    if( !appCtxService.getCtx( 'cutIntent' ) ) {
        return false;
    }
    const clipboardContents = ClipboardService.instance.getContents(  );
    return _.find( clipboardContents, ( clippedObject ) => clippedObject.uid === object.uid );
}

export default {
    copy,
    cut,
    removeExistingCutIndication,
    isObjectCut
};
