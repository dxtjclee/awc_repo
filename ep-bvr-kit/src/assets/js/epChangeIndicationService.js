// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epChangeIndicationService
 */

import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as _epLoadConstants } from 'js/epLoadConstants';
import epLoadService from 'js/epLoadService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import epTableCellRenderer from 'js/epTableCellRenderer';
import awPromiseService from 'js/awPromiseService';
import iconSvc from 'js/iconService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import localeService from 'js/localeService';
import mfeModelUtil from 'js/utils/mfeModelUtils';
import mfeTooltipUtil from 'js/mfeGenericTooltipUtil';
const localizedMsgs = localeService.getLoadedText( 'changeIndicationMessages' );
import cdm from 'soa/kernel/clientDataModel';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import eventBus from 'js/eventBus';

const childChangeIndication = 'indicatorImpacted16';
const childImpactedChangeIndication = 'indicatorContainsInnerMismatches16';
const CHANGE_PV_INDICATION = 'ChangeImpactedPVIndication';
const CHANGE_IMPACTED_INDICATION = 'ChangeImpactedIndication';
const TABLE_CELL_IMAGE_TOOLTIP_CLASS = 'AssignmentIndicationHiddenCellIcon';
const TABLE_CELL_IMAGE_VIEW = 'MfeTableCellImage';
const TOOLTIP_VIEW = 'MfeGenericTooltip';
const IMPACT_HANDLED_OBJECTS = 'ImpactHandledObjects';
const CHANGE_PV_IMPACTED_OBJECTS = 'changePVImpactedObjects';
const CHANGE_LOADED_PROCESS_INDICATION = 'ChangeLoadedProcessIndication';

let policyId;

/**
 *  Load Change Indication
 */
export function loadChangeIndication() {
    const awPromise = awPromiseService.instance;
    let affectedUIDs = [];
    const impactHandledUids = [];
    const epTaskPageContext = appCtxSvc.getCtx( 'epTaskPageContext' );
    let processContextUid = epTaskPageContext.processStructure && epTaskPageContext.processStructure.uid ? epTaskPageContext.processStructure.uid : epTaskPageContext.loadedObject.uid;
    let isContextHasImpacted = false;
    policyId = propertyPolicySvc.register( {
        types: [ {
            name: epBvrConstants.IMAN_ITEM_BOP_LINE,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            } ]
        } ]
    } );
    let srcObj = {
        tagName: 'sourceObject',
        attributeName: 'objectUid',
        attributeValue: epTaskPageContext.productStructure.uid
    };
    let targetObj = {
        tagName: 'targetObject',
        attributeName: 'objectUid',
        attributeValue: epTaskPageContext.loadedObject.uid
    };
    let addLoadParams = [];
    addLoadParams.push( srcObj );
    addLoadParams.push( targetObj );

    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.CHANGE_INDICATIONS, '', [ epBvrConstants.BL_PARENT ], '', addLoadParams );
    return epLoadService.loadObject( loadTypeInputs, false ).then( response => {
        if( response.relatedObjectsMap ) {
            affectedUIDs.push( processContextUid );
            Object.keys( response.relatedObjectsMap ).forEach( affectedUid => {
                if( affectedUid !== 'ImpactHandledItemRevs' ) {
                    const impactedChange = response.relatedObjectsMap[ affectedUid ].additionalPropertiesMap2.ChangeIndication ? response.relatedObjectsMap[ affectedUid ]
                        .additionalPropertiesMap2.ChangeIndication[ 0 ] : '';
                    isContextHasImpacted = impactedChange === 'Impacted' && isContextHasImpacted === false ? true : isContextHasImpacted;
                    affectedUIDs.push( affectedUid );
                    // Checking impact on parts on clear/load impact indication so impact due to PV should not be affected and vice-versa
                    epObjectPropertyCacheService.setProperty( affectedUid, 'ImpactedChangePart', impactedChange );
                } else {
                    impactHandledUids.push( ...response.relatedObjectsMap[ affectedUid ].additionalPropertiesMap2.childAssembly );
                }
            } );
            epObjectPropertyCacheService.setProperty( processContextUid, epBvrConstants.CHANGE_INDICATION, affectedUIDs );
            epObjectPropertyCacheService.setProperty( processContextUid, CHANGE_IMPACTED_INDICATION, isContextHasImpacted );
            if( affectedUIDs.length > 0 ) {
                if( affectedUIDs.includes( epTaskPageContext.loadedObject.uid ) ) {
                    epObjectPropertyCacheService.setProperty( epTaskPageContext.loadedObject.uid, CHANGE_LOADED_PROCESS_INDICATION, true );
                } else {
                    epObjectPropertyCacheService.clearPropertyKeyCache( epTaskPageContext.loadedObject.uid, CHANGE_LOADED_PROCESS_INDICATION );
                }
            }
            const impactHandledObjects = cdm.getObjects( impactHandledUids );
            epObjectPropertyCacheService.updateProperty( epTaskPageContext.loadedObject.uid, IMPACT_HANDLED_OBJECTS, impactHandledObjects );

            return awPromise.resolve( { response: affectedUIDs } );
        }
    } );
}

/**
 *  Load ProductView Indication
 */
export function loadProductViewChangeIndication() {
    const awPromise = awPromiseService.instance;
    let affectedUIDs = [];
    let isContextHasImpacted = false;
    const impactHandledUids = [];
    const epTaskPageContext = appCtxSvc.getCtx( 'epTaskPageContext' );
    let processContextUid = epTaskPageContext.processStructure && epTaskPageContext.processStructure.uid ? epTaskPageContext.processStructure.uid : epTaskPageContext.loadedObject.uid;

    let targetObj = {
        tagName: 'targetObject',
        attributeName: 'objectUid',
        attributeValue: epTaskPageContext.loadedObject.uid
    };
    let addLoadParams = [];
    addLoadParams.push( targetObj );

    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.PRODUCT_VIEW_CHANGE_INDICATIONS, '', [ epBvrConstants.BL_PARENT ], '', addLoadParams );
    return epLoadService.loadObject( loadTypeInputs, false ).then( response => {
        if( response.relatedObjectsMap ) {
            affectedUIDs.push( processContextUid );
            Object.keys( response.relatedObjectsMap ).forEach( affectedUid => {
                if( affectedUid !== 'ImpactHandledPVs' ) {
                    const impactedChange = response.relatedObjectsMap[ affectedUid ].additionalPropertiesMap2.ChangeIndication ? response.relatedObjectsMap[ affectedUid ]
                        .additionalPropertiesMap2.ChangeIndication[ 0 ] : '';
                    isContextHasImpacted = impactedChange === 'Impacted' && isContextHasImpacted === false ? true : isContextHasImpacted;
                    affectedUIDs.push( affectedUid );
                    // Checking impact on parts on clear/load impact indication so impact due to PV should not be affected and vice-versa
                    epObjectPropertyCacheService.setProperty( affectedUid, 'ImpactedChangePV', impactedChange );
                } else {
                    impactHandledUids.push( ...response.relatedObjectsMap[ affectedUid ].additionalPropertiesMap2.childAssembly );
                }
            } );
            epObjectPropertyCacheService.setProperty( processContextUid, CHANGE_PV_INDICATION, isContextHasImpacted );
            epObjectPropertyCacheService.setProperty( processContextUid, CHANGE_PV_IMPACTED_OBJECTS, affectedUIDs );
            if( affectedUIDs.length > 0 ) {
                if( affectedUIDs.includes( epTaskPageContext.loadedObject.uid ) ) {
                    epObjectPropertyCacheService.setProperty( epTaskPageContext.loadedObject.uid, CHANGE_LOADED_PROCESS_INDICATION, true );
                } else {
                    epObjectPropertyCacheService.clearPropertyKeyCache( epTaskPageContext.loadedObject.uid, CHANGE_LOADED_PROCESS_INDICATION );
                }
            }
            const impactHandledObjects = cdm.getObjects( impactHandledUids );
            epObjectPropertyCacheService.updateProperty( epTaskPageContext.loadedObject.uid, IMPACT_HANDLED_OBJECTS, impactHandledObjects );

            return awPromise.resolve( { response: affectedUIDs } );
        }
    } );
}

/**
 * This method clears impact indications.
 * @param {Object} inputObject : Input Object
 * @param { ObjectArray } impactedObjects : Impacted Objects
 * @param { string } impactClearedFor : part/PV
 * @returns {promise} : promise
 */
export function clearImpactIndication( inputObject, impactedObjects, impactClearedFor ) {
    const impactedUids = impactedObjects.map( ele => ele.uid );

    const saveInputWriter = saveInputWriterService.get();
    saveInputWriter.clearImpactIndications( inputObject.uid, impactedUids );
    return epSaveService.saveChanges( saveInputWriter, true, impactedObjects ).then( () => {
        updateChangeIndicationObjectPropertyCache( inputObject.uid, impactClearedFor );
    } );
}
/**
 * This method updates impact indication property.
 * @param { string } inputObjectUid : Input Object Uid
 * @param { string } impactClearedFor : part/PV
 * @returns {promise} : promise
 */
export function updateChangeIndicationObjectPropertyCache( inputObjectUid, impactClearedFor ) {
    const processContextUid = appCtxSvc.getCtx( 'epTaskPageContext.processStructure' ).uid;
    const previouslyAffectedUidsDueToParts = epObjectPropertyCacheService.getProperty( processContextUid, epBvrConstants.CHANGE_INDICATION );
    const previouslyAffectedUidsDueToPVs = epObjectPropertyCacheService.getProperty( processContextUid, CHANGE_PV_IMPACTED_OBJECTS );
    if( impactClearedFor === 'part' ) {
        previouslyAffectedUidsDueToParts !== '' && previouslyAffectedUidsDueToParts.forEach( ( affecteUid ) => {
            if( !previouslyAffectedUidsDueToPVs.includes( affecteUid ) ) { epObjectPropertyCacheService.clearPropertyKeyCache( affecteUid, epBvrConstants.CHANGE_INDICATION ); }
            epObjectPropertyCacheService.clearPropertyKeyCache( affecteUid, 'ImpactedChangePart' );
        } );

        epObjectPropertyCacheService.removeProperty( processContextUid, epBvrConstants.CHANGE_INDICATION, inputObjectUid );
        return loadChangeIndication().then( () => {
            eventBus.publish( 'ep.publishAssignmentIndicationChange' );
        } );
    } else if( impactClearedFor === 'PV' ) {
        previouslyAffectedUidsDueToPVs !== '' && previouslyAffectedUidsDueToPVs.forEach( ( affecteUid ) => {
            if( !previouslyAffectedUidsDueToParts.includes( affecteUid ) ) { epObjectPropertyCacheService.clearPropertyKeyCache( affecteUid, epBvrConstants.CHANGE_INDICATION ); }
            epObjectPropertyCacheService.clearPropertyKeyCache( affecteUid, 'ImpactedChangePV' );
        } );
        epObjectPropertyCacheService.removeProperty( processContextUid, CHANGE_PV_IMPACTED_OBJECTS, inputObjectUid );
        epObjectPropertyCacheService.clearPropertyKeyCache( inputObjectUid, 'changePVImpacted' );
        return loadProductViewChangeIndication().then( () => {
            return loadChangeIndication().then( () => {
                eventBus.publish( 'ep.publishAssignmentIndicationChange' );
            } );
        } );
    }
}

/**
 * This method clears cached data related to PVs only.
 * @param {Boolean} indicationMode : Assignment Indication toggle on/off
 * @param { String } key: input for epReloadService.unregisterReloadInput
 */
export function destroyPVObjectCache( processContextUid, affectedUids ) {
    const previouslyAffectedUidsDueToParts = epObjectPropertyCacheService.getProperty( processContextUid, epBvrConstants.CHANGE_INDICATION );
    if( Array.isArray( affectedUids ) ) {
        affectedUids.forEach( ( contextObjectUid ) => {
            if( !previouslyAffectedUidsDueToParts.includes( contextObjectUid ) ) { epObjectPropertyCacheService.clearPropertyKeyCache( contextObjectUid, epBvrConstants.CHANGE_INDICATION ); }
        } );
        propertyPolicySvc.unregister( policyId );
    }
}

/**
 * This method restores impact data for selected.
 * @param { ObjectArray } impactHandledObjects : Impacted Objects
 * @returns {promise}
 */
export function restoreImpactIndication( impactHandledObjects ) {
    const epTaskPageContext = appCtxSvc.getCtx( 'epTaskPageContext' );
    const impactHandledUids = impactHandledObjects.map( ele => ele.uid );
    const impactHandledObjectTypes = new Set( impactHandledObjects.map( ele => ele.type ) );
    const saveInputWriter = saveInputWriterService.get();
    saveInputWriter.restoreImpactIndications( impactHandledUids );
    return epSaveService.saveChanges( saveInputWriter, true, impactHandledObjects ).then( () => {
        // Remove the selected Item Revision from cache so that Impacts Handled tab shows updated list
        const objectsToRestoreImpact = cdm.getObjects( impactHandledUids );
        epObjectPropertyCacheService.removeProperty( epTaskPageContext.loadedObject.uid, IMPACT_HANDLED_OBJECTS, objectsToRestoreImpact );
        // If impacted objects contains both PVs and Parts, we need to call loadObject for both else call relevant loader
        if( impactHandledObjectTypes.length > 1 ) {
            return loadChangeIndication().then( () => {
                return loadProductViewChangeIndication().then( () => {
                    eventBus.publish( 'ep.publishAssignmentIndicationChange' );
                } );
            } );
        }
        if( impactHandledObjectTypes[ 0 ] === 'SnapShotViewData' ) {
            return loadProductViewChangeIndication().then( () => {
                eventBus.publish( 'ep.publishAssignmentIndicationChange' );
            } );
        }
        return loadChangeIndication().then( () => {
            eventBus.publish( 'ep.publishAssignmentIndicationChange' );
        } );
    } );
}

/**
 * This method clears cached data once Indication toggle is turned off.
 * @param {Boolean} indicationMode : Assignment Indication toggle on/off
 * @param { String } key: input for epReloadService.unregisterReloadInput
 */
export function destroy( indicationMode, affectedUids ) {
    if( !indicationMode && Array.isArray( affectedUids ) ) {
        affectedUids.forEach( ( contextObject ) => {
            if( contextObject && contextObject.uid ) {
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject.uid, epBvrConstants.CHANGE_INDICATION, true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject.uid, 'ImpactedChangePart', true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject.uid, 'ImpactedChangePV', true );
            } else {
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject, epBvrConstants.CHANGE_INDICATION, true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject, 'ImpactedChangePart', true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject, 'ImpactedChangePV', true );
            }
        } );
        propertyPolicySvc.unregister( policyId );
    }
}

/**
 * Get the property from objectCache for each affected parts
 * @param {Object} contextUids - all consume parts
 * @param {Object} selectedContext - selected parent from process view
 */
export function getProperties( contextUids, selectedContext ) {
    let impactConsumeParts = [];
    if( _.isArray( contextUids ) ) {
        contextUids.forEach( ( contextUid ) => {
            const Object = epObjectPropertyCacheService.getProperty( contextUid, epBvrConstants.CHANGE_INDICATION );
            if( Object ) {
                impactConsumeParts.push( contextUid );
            }
        } );
        if( impactConsumeParts.length > 0 ) {
            epObjectPropertyCacheService.setProperty( selectedContext.uid, epBvrConstants.CHANGE_PART_INDICATION,
                impactConsumeParts );
        }
    }
    return impactConsumeParts.length > 0 ? impactConsumeParts : '';
}

/**
 * This method takes Array of VMOs and updates each VMO's changeIndicationProp value.
 * @param { ObjectArray } vmos: ViewModelObjects to update
 * @param { Boolean } toggleIndicationValue: If Indication toggle is on/off
 * @param { String } propertyValue: based on this vmo property decide change indication state
 */
export function updateChangeIndicationPropertyOnVmos( vmos, toggleIndicationValue, propertyValue ) {
    let isInputObjectImpacted = false;
    if( _.isArray( vmos ) ) {
        vmos.forEach( ( vmo ) => {
            let vmoUpdated = updateIndicationMatchPropertyOnVmo( vmo, toggleIndicationValue, propertyValue );
            isInputObjectImpacted = vmoUpdated === true && isInputObjectImpacted === false ? true : isInputObjectImpacted;
        } );
    }
    return isInputObjectImpacted;
}

/**
 * updateIndicationMatchPropertyOnVmo
 * @param {*} vmo
 * @param {*} toggleIndicationValue
 * @param {*} propertyValue
 */
export function updateIndicationMatchPropertyOnVmo( vmo, toggleIndicationValue, propertyValue ) {
    let imageName;
    let indicator = {
        tooltip: '',
        image: '',
        matchType: ''
    };
    let resource = 'changeIndicationMessages';
    let localTextBundle = localeService.getLoadedText( resource );
    let impactedMsg = [];
    let childImpactedMsg = [];
    let childmsg;

    let trackingCNUid = appCtxSvc.getCtx( 'state' ).params.tracking_cn;
    if( trackingCNUid ) {
        let impactedCnMsg = localTextBundle.impactedIndicationTooltipFirstText;
        let childImpactedCnMsg = localTextBundle.childImpactedChangeIndicationTooltipSecondText;
        let tracking_cn = cdm.getObject( trackingCNUid );
        let cnName = tracking_cn && tracking_cn.props.object_string ? tracking_cn.props.object_string.uiValues[ 0 ] : '';
        let msg = impactedCnMsg.replace( '{0}', cnName );
        childmsg = childImpactedCnMsg.replace( '{0}', cnName );
        impactedMsg.push( msg );
    }

    impactedMsg.push(
        localTextBundle.impactedIndicationTooltipSecondText, localTextBundle.impactedIndicationTooltipThirdText );

    childImpactedMsg.push(
        localTextBundle.childImpactedChangeIndicationTooltipFirstText, childmsg );

    vmo.chnageIndicationProp = [];
    const changeIndicationProp = {
        value: [],
        displayValue: '',
        propType: 'OBJECTARRAY',
        isArray: true,
        displayName: 'changeIndicationProp'
    };
    vmo.props.changeIndicationProp = viewModelObjectSvc.constructViewModelProperty( changeIndicationProp, 'changeIndicationProp', vmo, false );
    // Checking impact on parts on clear/load impact indication so impact due to PV should not be affected and vice-versa
    let result = [];
    result.push( epObjectPropertyCacheService.getProperty( vmo.uid, 'ImpactedChangePart' ) );
    result.push( epObjectPropertyCacheService.getProperty( vmo.uid, 'ImpactedChangePV' ) );
    let changeIndicationType = result.includes( 'ChildImpacted' ) ? 'ChildImpacted' : '';
    changeIndicationType = result.includes( 'Impacted' ) ? 'Impacted' : changeIndicationType;

    if( toggleIndicationValue ) {
        if( changeIndicationType === 'ChildImpacted' ) {
            imageName = iconSvc.getTypeIconFileUrl( childImpactedChangeIndication );
            indicator.image = imageName + '.svg';
            indicator.tooltip = childImpactedMsg;
            indicator.changeType = 'ChildImpacted';
        }

        if( changeIndicationType === 'Impacted' ) {
            imageName = iconSvc.getTypeIconFileUrl( childChangeIndication );
            indicator.image = imageName + '.svg';
            indicator.tooltip = impactedMsg;
            indicator.changeType = 'Impacted';
        }
    } else {
        indicator.image = '';
    }
    vmo.props.changeIndicationProp.value.push( indicator );

    return indicator.image !== '';
}

/**
 * Render change Indication on cell.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
export function rendererForChangeIndication( vmo, containerElement ) {
    if( !containerElement ) {
        return;
    }
    let changeIndicationProp;
    let contextObject = {};
    if( vmo.props && vmo.props.changeIndicationProp && vmo.props.changeIndicationProp.value.length > 0 ) {
        changeIndicationProp = vmo.props.changeIndicationProp.value[ 0 ];
        contextObject.reference = mfeModelUtil.getUniqueIdFromVmo( vmo.uid );
        contextObject.changeType = changeIndicationProp.changeType;
        contextObject.tooltip = changeIndicationProp.tooltip;
    }

    const iconId = changeIndicationProp && changeIndicationProp.image ? changeIndicationProp.image : '';
    if( iconId !== null ) {
        contextObject.reference = containerElement;
        contextObject.popupReferenceElement = containerElement.parentElement;
        const tooltipData = getTooltipData( contextObject );
        const props = {
            imageSrc: iconId,
            tooltipView: TOOLTIP_VIEW,
            tooltipData,
            isClickable: false
        };
        const imageElement = includeComponent( TABLE_CELL_IMAGE_VIEW, props );
        renderComponent( imageElement, containerElement );
    }
}

function getTooltipData( contextObject ) {
    let title = '';
    let messages = '';
    switch ( contextObject.changeType ) {
        case 'Impacted':
            title = localizedMsgs.changeIndicationTooltipTitle;
            messages = contextObject.tooltip;
            break;
        case 'ChildImpacted':
            title = localizedMsgs.changeIndicationTooltipChildTitle;
            messages = contextObject.tooltip;
            break;
    }
    return {
        extendedTooltip: {
            title,
            messages,
            className: TABLE_CELL_IMAGE_TOOLTIP_CLASS
        }
    };
}

/**
 * show Tooltip On Hover Of Cell Icon.
 *
 * @param { Object } contextObject - the vmo for the cell
 * @param { Boolean } showTooltip - true/false
 */
function showTooltipOnHoverOfCellIcon( contextObject, showTooltip ) {
    if( showTooltip ) {
        let tooltipArgs = {
            title: '',
            instruction: ''
        };
        switch ( contextObject.changeType ) {
            case 'ChildImpacted':
                tooltipArgs.title = localizedMsgs.changeIndicationTooltipChildTitle;
                tooltipArgs.messages = contextObject.tooltip;
                tooltipArgs.className = 'aw-ep-changeTooltip';
                break;
            case 'Impacted':
                tooltipArgs.title = localizedMsgs.changeIndicationTooltipTitle;
                tooltipArgs.messages = contextObject.tooltip;
                tooltipArgs.className = 'aw-ep-changeTooltip';
                break;
        }
        if( tooltipArgs.title ) {
            mfeTooltipUtil.displayCellIconIndicationTooltip( contextObject.reference, tooltipArgs );
        }
    } else {
        mfeTooltipUtil.hideCellIconIndicationTooltip();
    }
}

/**
 * Update the ECNInfo from the tracking changes on chip
 * @param { Object } data
 * @param { Object } trackingCnObj
 */
export function updateECNInfoOnChip( trackingCnObj ) {
    if( trackingCnObj && trackingCnObj.props ) {
        appCtxSvc.updatePartialCtx( 'epTaskPageContext.activeCNName', trackingCnObj.props.object_string.uiValues[ 0 ] );
        return {
            ecnName: trackingCnObj.props.object_string.uiValues[ 0 ],
            isCNReadonly: trackingCnObj.props.is_modifiable.dbValues[ 0 ] === '0',
            iconId: 'indicatorChipTrackingChanges'
        };
    }
}

/**
 *
 * @param {Object} targetObj - the target object to merge to
 * @param {Object} key - key to delete
 */
export function deleteKey( targetObj, key ) {
    delete targetObj[ key ];
}
/**

 * Renderer for changeIndication column header
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} tooltip - tooltip object
 * @param {Object} column - column object
 */
export function changeIndicationHeaderRenderer( containerElement, columnField, tooltip, column ) {
    epTableCellRenderer.columnHeaderIndicationRenderer( containerElement, columnField, column );
}

/**
 * Calculate if selection contains impacted part
 *
 * @param {ObjectArray} vmos - the vmo for the cell
 * @returns {boolean} : If selection contains impacted part
 */
export function calculateImpactForSelection( vmos ) {
    let  handleImpact = false;
    vmos.forEach( vmo => {
        const changeInSrc = epObjectPropertyCacheService.getProperty( vmo.uid, 'ChangeIndication' );
        if( changeInSrc && changeInSrc[ 0 ] === 'Impacted' ) {
            handleImpact = true;
            return handleImpact;
        }
        return handleImpact;
    } );

    return handleImpact;
}


/**
 * This method clears cached data once Indication toggle is turned off.
 * @param {Boolean} indicationMode : Assignment Indication toggle on/off
 * @param { String } key: input for epReloadService.unregisterReloadInput
 */
export function clearImpactedChangePartCache( ) {
    const processContextUid = appCtxSvc.getCtx( 'epPageContext.processStructure' ).uid;
    const affectedUids = epObjectPropertyCacheService.getProperty( processContextUid, epBvrConstants.CHANGE_INDICATION );
    if( Array.isArray( affectedUids ) ) {
        affectedUids.forEach( ( contextObject ) => {
            if( contextObject && contextObject.uid ) {
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject.uid, epBvrConstants.CHANGE_INDICATION, true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject.uid, 'ImpactedChangePart', true );
            } else {
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject, epBvrConstants.CHANGE_INDICATION, true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject, 'ImpactedChangePart', true );
            }
        } );
        propertyPolicySvc.unregister( policyId );
    }
}

/**
 * This method clears cached data once Indication toggle is turned off.
 * @param {Boolean} indicationMode : Assignment Indication toggle on/off
 * @param { String } key: input for epReloadService.unregisterReloadInput
 */
export function clearImpactedChangePVCache( ) {
    const processContextUid = appCtxSvc.getCtx( 'epPageContext.processStructure' ).uid;
    const affectedUids = epObjectPropertyCacheService.getProperty( processContextUid, CHANGE_PV_IMPACTED_OBJECTS );
    if( Array.isArray( affectedUids ) ) {
        affectedUids.forEach( ( contextObject ) => {
            if( contextObject && contextObject.uid ) {
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject.uid, epBvrConstants.CHANGE_INDICATION, true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject.uid, 'ImpactedChangePV', true );
            } else {
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject, epBvrConstants.CHANGE_INDICATION, true );
                epObjectPropertyCacheService.clearPropertyKeyCache( contextObject, 'ImpactedChangePV', true );
            }
        } );
        propertyPolicySvc.unregister( policyId );
    }
}

let exports;
export default exports = {
    loadChangeIndication,
    loadProductViewChangeIndication,
    updateIndicationMatchPropertyOnVmo,
    updateChangeIndicationPropertyOnVmos,
    rendererForChangeIndication,
    destroy,
    getProperties,
    updateECNInfoOnChip,
    deleteKey,
    changeIndicationHeaderRenderer,
    clearImpactIndication,
    restoreImpactIndication,
    destroyPVObjectCache,
    updateChangeIndicationObjectPropertyCache,
    calculateImpactForSelection,
    clearImpactedChangePartCache,
    clearImpactedChangePVCache
};
