// Copyright (c) 2022 Siemens

/**
 * This service helps delete the data pass on method.
 *
 * @module js/epDeleteService
 */
import messagingService from 'js/messagingService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import localeService from 'js/localeService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import epReloadService from 'js/epReloadService';
import epBvrObjectService from 'js/epBvrObjectService';
import appCtxService from 'js/appCtxService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';

/**
  * This method deletes the selected objects
  *
  * @param {Object} objectsToDelete - uids of the objects to delete
  * @param {Object} connectToObject -  connectToObject
  * @param {String} reloadType - reload type for reload section
  * @param {String[]} reloadProperties - reload properties for reload section
  *
  */
function performDelete( objectsToDelete, connectToObject, reloadType, reloadProperties, additionalLoadParams ) {
    const connectedTo = [];
    const saveInputWriter = saveInputWriterService.get();
    const relatedObjects = [];

    if( connectToObject &&  typeof connectToObject === 'string'  ) {
        connectToObject = JSON.parse( connectToObject )[ 0 ];
    }
    if( objectsToDelete !== null && objectsToDelete !== undefined ) {
        objectsToDelete.forEach( selection => {
            const addDeleteObj = {
                id: selection.uid,
                Type: selection.type
            };
            if( connectToObject ) {
                connectedTo.push( connectToObject );
                addDeleteObj.connectTo = connectToObject.uid;
                relatedObjects.push( connectToObject );
            } else {
                const connectedToObjects = epBvrObjectService.getProcessResourceOrStationParent( selection );
                if( connectedToObjects ) {
                    connectedTo.push( connectedToObjects );
                    addDeleteObj.connectTo = connectedToObjects.uid;
                    relatedObjects.push( connectedToObjects );
                }
            }
            saveInputWriter.addDeleteObject( addDeleteObj );
            relatedObjects.push( selection );
        } );
        if( connectedTo && reloadType ) {
            epReloadService.registerReloadInput( 'epTreeTable', { reloadTypeName: reloadType, object: connectedTo, propertiesToLoad: reloadProperties, additionalLoadParams:additionalLoadParams } );
        }
        saveInputWriter.addRelatedObjects( relatedObjects );
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( serviceResponse ) {
            return epReloadService.unregisterReloadInput( 'epTreeTable' );
        } );
    }
}

/**
  * This method deletes the selected objects
  *
  * @param {Object} objectsToDelete - uids of the objects to delete
  * @param {Object} connectToObject -  connectToObject
  * @param {Object} relatedDataset - relatedDataset
  * @param {String} reloadType - reload type for reload section
  * @param {String[]} reloadProperties - reload properties for reload section

  */
export const deleteObjects = function( objectsToDelete, connectToObject, relatedDataset, reloadType, reloadProperties, additionalLoadParams ) {
    if( typeof objectsToDelete === 'string' ) {
        const objectsToDeleteStr = objectsToDelete;
        objectsToDelete = [];
        if( JSON.parse( objectsToDeleteStr )[ 0 ].vmo ) {
            objectsToDelete.push( JSON.parse( objectsToDeleteStr )[ 0 ].vmo );
        } else{
            objectsToDelete.push( JSON.parse( objectsToDeleteStr )[ 0 ] );
        }
    }
    const resource = localeService.getLoadedText( 'epDeleteMessages' );
    let isScopeObjectSelectedForDeletion = false;
    if( typeof objectsToDelete === 'object' && !Array.isArray( objectsToDelete ) ) {
        const objectsToDeleteStr = objectsToDelete;
        objectsToDelete = [];
        objectsToDelete.push( objectsToDeleteStr );
    }
    objectsToDelete.forEach( function( object ) {
        if( object.uid === appCtxService.ctx.ep.scopeObject.uid ) {
            isScopeObjectSelectedForDeletion = true;
        }
    } );


    if( isScopeObjectSelectedForDeletion ) {
        let buttonArray = [];
        buttonArray.push( mfgNotificationUtils.createButton( resource.close, function( callBack ) {
            callBack.close();
        } ) );
        messagingService.showError( resource.cannotDeleteScope.format( appCtxService.ctx.ep.scopeObject.props.object_string.dbValues[ 0 ] ), null, null, buttonArray );
        return;
    }
    // show the confirmation message
    const deleteConfirmationMessage = relatedDataset ? getLocalizedMessage( resource, [ relatedDataset ] ) :
        getLocalizedMessage( resource, objectsToDelete );
    return mfgNotificationUtils.displayConfirmationMessage( deleteConfirmationMessage, resource.delete, resource.discard ).then(
        () => {
            //on delete
            return performDelete( objectsToDelete, connectToObject, reloadType, reloadProperties, additionalLoadParams );
        },
        function() {
            //on discard
        } );
};


/**
  * Get the message for given key from given resource file, replace the parameter and return the localized string
  *
  * @param {String} localTextBundle - The message bundles localized files
  * @param {String} objectsToDelete - The objects to delete
  * @returns {String} localizedValue - The localized message string
  */
function getLocalizedMessage( localTextBundle, objectsToDelete ) {
    return objectsToDelete && objectsToDelete.length === 1 ? localTextBundle.DeleteSingleMessage.format( objectsToDelete[ 0 ].props.object_string.uiValues[ 0 ] ) :
        localTextBundle.DeleteMultipleMessage.format( objectsToDelete.length );
}

/**
 * Delete objects and remove them from objectPropertyCache
*/
function deleteObjectsAndRemovePropertyFromObjectPropertyCache( objectsToDelete, connectedToObject, propertyKey ) {
    deleteObjects( objectsToDelete, connectedToObject );
    const removedObjectsUids = objectsToDelete.map( object => object.uid );
    epObjectPropertyCacheService.removeProperty( connectedToObject.uid, propertyKey, removedObjectsUids );
}

const exports = {
    deleteObjects,
    deleteObjectsAndRemovePropertyFromObjectPropertyCache
};
export default exports;
