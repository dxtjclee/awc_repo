// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for Planning / twin / sync creation
 *
 * @module js/syncOperationService
 */
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import mfeTableSvc from 'js/mfeTableService';
import _ from 'lodash';
import epReloadService from 'js/epReloadService';
import occmgmtBackingObjectProviderService from 'js/occmgmtBackingObjectProviderService';

/**
 * Create sync for the Plant BOP with associated Plant
 *
 * @param {ModelObject} objToSync - the object to sync
 * @param {boolean} isRemoveObsoleteLine - flag to remove async lines
 */
const syncBOPToPlant = function( objToSync, isRemoveObsoleteLine ) {
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const collaborationContext = epPageContext.collaborationContext;
    let objectsToSyncUids = [];
    let objectsToSync = [];

    if( !Array.isArray( objToSync ) ) {
        objectsToSync.push( objToSync );
    } else {
        objectsToSync = objToSync;
    }

    if( isRemoveObsoleteLine === undefined ) {
        isRemoveObsoleteLine = 'false';
    }
    _.each( objectsToSync, function( selectedNode ) {
        if( selectedNode.uid ) {
            objectsToSyncUids.push( selectedNode.uid );
        }
    } );
    if( collaborationContext ) {
        let pageContextModelObject = {
            Object: collaborationContext.uid,
            syncFrom: objectsToSyncUids,
            isRemoveObsoleteTwin: isRemoveObsoleteLine
        };

        let saveInputWriter = saveInputWriterService.get();
        saveInputWriter.addSyncObject( pageContextModelObject );
        saveInputWriter.addRelatedObjects( objectsToSync );
        const additionalLoadParamsForChildLoadInputData = [ {

                tagName: 'expandType',
                attributeName: 'type',
                attributeValue: 'ExpandProcessHighLevelPlanning'
            },
            {
                tagName: 'expandInfo',
                attributeName: 'level',
                attributeValue: 'CHILDREN'
            },
            {
                tagName: 'expandInfo',
                attributeName: 'rootsProperty',
                attributeValue: 'RootObject'
            }
        ];
        epReloadService.registerReloadInput( 'epSync', { reloadTypeName: 'CommonExpand', object: objectsToSync[ 0 ].uid, additionalLoadParams: additionalLoadParamsForChildLoadInputData } );
        return epSaveService.saveChanges( saveInputWriter, true, [ collaborationContext ] ).then( ( response ) => {
            /* Below forEach loop should be removed when TCM-430416 is resolved. */
            objectsToSync[ 0 ].children.forEach( treeNodeToToggle => {
                treeNodeToToggle.isExpanded = false;
                if( response.relatedObjectsMap.hasOwnProperty( treeNodeToToggle.uid ) ) {
                    treeNodeToToggle.isLeaf = !JSON.parse( response.relatedObjectsMap[ treeNodeToToggle.uid ].additionalPropertiesMap2.hasChildren[ 0 ].toLowerCase() );
                }
                eventBus.publish( 'EpTreeTable.plTable.toggleTreeNode', treeNodeToToggle );
            } );

            //No saveResults in case saveChanges fails
            if( response.saveResults ) {
                showSynSuccessMessage( response.saveResults );
            }
            epReloadService.unregisterReloadInput( 'epSync' );
        } );
    }
};

/**
 * Create sync for the Plant with associated plant BOP
 *
 * @param {ModelObject} objToSync - the object to sync
 * @param {boolean} isRemoveObsoleteLine - flag to remove async lines
 */
const syncPlantToBOP = function( objToSync, isRemoveObsoleteLine ) {
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const collaborationContext = epPageContext.collaborationContext;
    let objectsToSyncUids = [];
    let objectsToSync = [];

    if( !Array.isArray( objToSync ) ) {
        objectsToSync.push( objToSync );
    } else {
        objectsToSync = objToSync;
    }

    if( isRemoveObsoleteLine === undefined ) {
        isRemoveObsoleteLine = 'false';
    }
    _.each( objectsToSync, function( selectedNode ) {
        if( selectedNode.uid ) {
            objectsToSyncUids.push( selectedNode.uid );
        }
    } );
    if( collaborationContext ) {
        let pageContextModelObject = {
            Object: collaborationContext.uid,
            syncFrom: objectsToSyncUids,
            isRemoveObsoleteTwin: isRemoveObsoleteLine
        };

        let saveInputWriter = saveInputWriterService.get();
        saveInputWriter.addSyncObject( pageContextModelObject );
        saveInputWriter.addRelatedObjects( objectsToSync );

        return epSaveService.saveChanges( saveInputWriter, true, [ collaborationContext ] ).then( ( response ) => {
            if( objectsToSync[ 0 ].type === epBvrConstants.MBC_WORKAREA_ELEMENT ) {
                let nodesToToggle = [];
                let treeDataObject = appCtxService.getCtx( 'occmgmtContext' );
                _.each( treeDataObject.vmc.getLoadedViewModelObjects(), function( child ) {
                    if( objectsToSyncUids.includes( child.uid ) ) {
                        nodesToToggle.push( child );
                    }
                } );
                _.each( nodesToToggle, function( node ) {
                    fireTreeExpandEvent( node, 'occTreeTable' );
                } );
            }
            //No saveResults in case saveChanges fails
            if( response.saveResults ) {
                showSynSuccessMessage( response.saveResults );
            }
        } );
    }
};

/**
 * Show the message stating the sync action was successful.
 * @param {*} saveResults
 */
function showSynSuccessMessage( saveResults ) {
    if( Array.isArray( saveResults ) && saveResults.length > 0 ) {
        for( let resultObj of saveResults ) {
            if( resultObj.saveResultObject.type !== epBvrConstants.ME_COLLABORATION_CONTEXT ) {
                const source = resultObj.saveResultObject.props.object_string.uiValues[ 0 ];
                let localTextBundle = localeService.getLoadedText( 'TwinMessages' );
                let successResponseMessage = localTextBundle.syncSuccessful;
                let msg = successResponseMessage.replace( '{0}', source );
                msgSvc.showInfo( msg );
            }
        }
    }
}

/**
 * Expand/Collapse selected node
 * @param {Object} treeNodeToToggle tree node to be toggled
 * @param {string} tableID of the table to expand
 */
function fireTreeExpandEvent( treeNodeToToggle, tableID ) {
    /* If this node is already expanded, then we have to collapse and
    then expand this tree to refresh the contents of this node. */
    if( treeNodeToToggle.isLeaf || treeNodeToToggle.isExpanded ) {
        treeNodeToToggle.isExpanded = false;
        eventBus.publish( `${tableID}.plTable.toggleTreeNode`, treeNodeToToggle );
    }
    if( treeNodeToToggle.__expandState ) {
        delete treeNodeToToggle.__expandState;
    }
    treeNodeToToggle.isExpanded = true;
    //Need to run this call in a separate thread to make expanded node refresh correctly.
    setTimeout( function() {
        eventBus.publish( `${tableID}.plTable.toggleTreeNode`, treeNodeToToggle );
    }, 0 );
}

export default {
    syncBOPToPlant,
    syncPlantToBOP,
    fireTreeExpandEvent
};
