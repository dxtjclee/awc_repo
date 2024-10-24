// Copyright (c) 2022 Siemens

/**
 * @module js/senSaveandCancelEditPLF
 */

import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import senPLFCellRenderer from 'js/senPLFCellRenderer';
import AwPromiseService from 'js/awPromiseService';

/**
 * Creates the text container element for tree command cell.
 * @param {String} attributeValue The attribute value
 *
 * @returns {DOMElement} text element
 */
const savePLFValues = function() {
    let deferred = AwPromiseService.instance.defer();
    let EditedPLFandProps = appCtxSvc.getCtx( 'EditedPLFandProps' );

    if( EditedPLFandProps ) {
        let inputData = { info:EditedPLFandProps };
        if( inputData ) {
            soaSvc.post( 'MROCoreAw-2022-12-MROCoreAw', 'createOrUpdatePLFsOnOccurrence', inputData ).then( function( response ) {
                if( response ) {
                    let plfInfo = response.plfInfo;
                    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
                    let mroPart;
                    let i = -1;
                    plfInfo.forEach( ( element ) => {
                        for ( let index = 0; index < mroPartList.length; index++ ) {
                            if( mroPartList[index].partId === element.asset.uid ) {
                                mroPart = mroPartList[index];
                                i = index;
                                break;
                            }
                        }
                        let indices = [];
                        if( mroPart ) {
                            let usageVal = mroPart.updatedIsUsage ? mroPart.updatedIsUsage : mroPart.isUsage;
                            if( !usageVal ) {
                                let underlyingObject = mroPart.underlyingObject;
                                mroPartList.forEach( ( part, index )=>{
                                    if( part.underlyingObject === underlyingObject ) {
                                        let usageValtemp = part.updatedIsUsage ? part.updatedIsUsage : part.isUsage;
                                        if( !usageValtemp && i !== index ) {
                                            indices.push( index );
                                        }
                                    }
                                } );
                            }
                            setUpdatedPlfInfo( mroPart, i );
                            if( indices.length > 0 ) {
                                indices.forEach( ( ind )=>{
                                    setUpdatedPlfInfo( mroPartList[i], ind );
                                } );
                            }
                        }
                    } );
                    let updatedMroPartList = [];
                    mroPartList.forEach( ( part )=>{
                        part.updatedPlfValues = undefined;
                        part.updatedIsUsage = undefined;
                        updatedMroPartList.push( part );
                    } );

                    appCtxSvc.updateCtx( 'MROPartList', updatedMroPartList );
                    eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
                    appCtxSvc.updateCtx( 'isEditButtonClicked', false );
                    appCtxSvc.unRegisterCtx( 'EditedPLFandProps' );
                    deferred.resolve();
                }
            }, function( reason ) {
                deferred.reject( reason );
            } );
        }
    } else {
        eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
        appCtxSvc.updateCtx( 'isEditButtonClicked', false );
        deferred.resolve();
    }

    return deferred.promise;
};

/**
 * Returns updated value of plf attribute asssociated repsective plf column
 * @param {String} plfuid  uid of updated PLF object
 * @param {String} columnName PLF column name
 *
 * @returns {String} updated value of plf attribute
 */

let setUpdatedPlfInfo = function( element, index ) {
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    Object.keys( mroPartList[index].plfValues ).forEach( ( prop ) => {
        if( element.updatedPlfValues !== undefined && element.updatedPlfValues[prop] !== undefined ) {
            mroPartList[index].plfValues[prop] = element.updatedPlfValues[prop];
            appCtxSvc.updateCtx( 'MROPartList', mroPartList );
            if ( prop === 'isLot' ) {
                appCtxSvc.updateCtx( 'showLotTable', element.updatedPlfValues.isLot );
            }
        }
        if( element.updatedIsUsage !== undefined ) {
            mroPartList[index].isUsage = element.updatedIsUsage;
            appCtxSvc.updateCtx( 'MROPartList', mroPartList );
        }
    } );
};
/**
 * Returns updated value of plf attribute asssociated repsective plf column
 * @param {String} plfuid  uid of updated PLF object
 * @param {String} columnName PLF column name
 *
 * @returns {String} updated value of plf attribute
 */

export let getEditedValue = function( plfuid, columnName ) {
    let plfValue = '';
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    let mroPart;
    for ( let index = 0; index < mroPartList.length; index++ ) {
        if( mroPartList[index].partId === plfuid ) {
            mroPart = mroPartList[index];
            break;
        }
    }
    if( mroPart ) {
        let plfPropertyName = senPLFCellRenderer.getPropNameIndb( columnName );
        mroPart.updatedPlfValues && mroPart.updatedPlfValues[plfPropertyName] !== undefined ? plfValue = mroPart.updatedPlfValues[plfPropertyName] : plfValue = '';
    }
    return plfValue;
};

/**
 * update PLF columns on SaveEdit and CancelEdit
 *
 */
let senCancelPLFEdits = function( ) {
    let updatedMroPartList = [];
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    mroPartList.forEach( ( part )=>{
        part.updatedPlfValues = undefined;
        part.updatedIsUsage = undefined;
        updatedMroPartList.push( part );
    } );
    appCtxSvc.updateCtx( 'MROPartList', updatedMroPartList );
    appCtxSvc.unRegisterCtx( 'EditedPLFandProps' );
    appCtxSvc.unRegisterCtx( 'isTableDirty' );
    appCtxSvc.updateCtx( 'isEditButtonClicked', false );
    eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
};

/**
 * Register Sbom tree table edit state in Ctx
 *
 */
let registerEditStateInCtx = async function() {
    const dataProvider = appCtxSvc.getCtx( 'sbomDataProvider' );
    dataProvider.isDirty().then( function( state ) {
        appCtxSvc.updateCtx( 'isTableDirty', state );
    } );
};
export default {
    savePLFValues,
    senCancelPLFEdits,
    getEditedValue,
    registerEditStateInCtx
};

