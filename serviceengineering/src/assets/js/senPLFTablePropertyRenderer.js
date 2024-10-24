// Copyright (c) 2022 Siemens

/**
 * @module js/senPLFTablePropertyRenderer
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import senPLFCellRenderer from 'js/senPLFCellRenderer';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import senCreateEOLService from 'js/senCreateEOLService';
import AwPromiseService from 'js/awPromiseService';

/**
 * Calls a method get partLogisticForm list using  mroPartList and the relation.
 *
 */
let getPLF = function( mroPartListInput ) {
    let deferred = AwPromiseService.instance.defer();

    let input = {
        info: mroPartListInput
    };

    let mroPartList = [];
    let mroSRUidtList = [];
    soaSvc.postUnchecked( 'MROCoreAw-2022-12-MROCoreAw', 'getPLFsOnOccurrence', input ).then( function( response ) {
        let outputArray = _.values( response.plfInfo );
        _.forEach( outputArray, function( output, itr ) {
            let partObject = {};
            partObject.part = output.asset;
            partObject.partId = output.asset.uid;
            partObject.underlyingObject = output.asset.props.awb0UnderlyingObject.dbValues[ 0 ];
            partObject.isUsage = output.plfValues !== undefined ? output.isUsagePLF : 'No PLF';
            partObject.plfValues = output.plfValues;
            mroPartList[ itr ] = partObject;
            mroSRUidtList[ itr ] = partObject.partId;
        } );
        appCtxSvc.updateCtx( 'MROPartList', mroPartList );
        appCtxSvc.updateCtx( 'MROSRUidList', mroSRUidtList );
        eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
        deferred.resolve();
    }, function( reason ) {
        deferred.reject( reason );
    } );

    return deferred.promise;
};
/**
 * Calls a method get partList and partRevisionList using getProperties SOA and vnos.
 * @param {Object} vmos selectd view model object
 *@returns {Array} list of all the
 */
let getPartList = function( vmos ) {
    let trgVmosToUpdate = vmos;
    let partList = [];

    _.forEach( trgVmosToUpdate, function( trgVmoToUpdate ) {
        var trgVmoToUpdateObject = cdm.getObject( trgVmoToUpdate.uid );
        if( trgVmoToUpdateObject ) {
            let modelObject = {
                type: trgVmoToUpdateObject.type,
                uid: trgVmoToUpdateObject.uid
            };
            partList.push( modelObject );
        }
    } );
    return partList;
};

/**
 * getPLFPropertyValue
 * @param {Object} vmo selectd view model object
 * @param {String} propertyflag flag for the PLF property
 * @param {Object} mroPart flag for the PLF property
 * @returns {Object} ref object for the respective Mro part
 */
let getPLFPropertyValue = function( vmo, propertyflag, mroPart ) {
    let valueUpdated = 0;
    let refObj = {};
    const inputVmo = cdm.getObject( vmo.uid );
    if( vmo.uid && inputVmo && inputVmo.props.awb0UnderlyingObject ) {
        {
            let PLF;
            if( mroPart ) {
                PLF = mroPart.plfValues;
                refObj.plfuid = vmo.uid;
                refObj.usagePLFValue = mroPart.isUsage;
                if( PLF ) {
                    refObj.plfValue = PLF[ propertyflag ];
                } else {
                    refObj.plfuid = 'No PLF';
                    refObj.plfValue = 'No PLF';
                }
                valueUpdated = 1;
            }
        }
    }
    if( valueUpdated === 1 ) {
        eventBus.publish( 'senSbomTreeTable.plTable.updated', { updatedObjects: [ vmo ] } );
    }
    return refObj;
};

let getUsagePlfValue = function( refObj, vmo, mroPart ) {
    if( mroPart ) {
        refObj.plfuid = vmo.uid;
        refObj.usagePLFValue = mroPart.isUsage;
    }
    return refObj;
};

/**
 * Calls methods to get PLF property value as cell text element. Appends it to the container element.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 *
 */

let getPLFValueRenderer = function( vmo, containerElement, columnName ) {
    let refobj = {
        usagePLFValue: false
    };
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    if( mroPartList ) {
        let mroPart;
        for( let index = 0; index < mroPartList.length; index++ ) {
            if( mroPartList[ index ].partId === vmo.uid ) {
                mroPart = mroPartList[ index ];
                break;
            }
        }
        if( mroPart ) {
            let plfPropertyName = senPLFCellRenderer.getPropNameIndb( columnName );
            refobj = getRefObjectBasedOnPLFProp( plfPropertyName, mroPart, vmo );
        }
        let iconElement = senPLFCellRenderer.getIconCellElement( refobj, containerElement, columnName, vmo );
        if( iconElement !== null ) {
            containerElement.appendChild( iconElement );
        }
        if( columnName === 'lotValueColumn' && refobj.plfValue === true ) {
            let iconElement2 = senPLFCellRenderer.getLotIconCellElement( refobj, containerElement, columnName, vmo );
            if( iconElement2 !== null ) {
                iconElement2.style.marginLeft = '18px';
                containerElement.appendChild( iconElement2 );
            }
        }
    }
};
/**
 * Calls methods to get PLF property value as cell text element. Appends it to the container element.
 *
 * @param {String} plfPropertyName plf property name
 * @param {Object} mroPart Part object associated with the cell
 * @param {Object} vmo the vmo for the cell
 *
 * @returns{Object} the refernce object with PLF uid/vmo uid and plfValue/usagePlf value for the cell
 */
let getRefObjectBasedOnPLFProp = function( plfPropertyName, mroPart, vmo ) {
    let refObj = {};
    if( ( mroPart.plfValues && mroPart.plfValues.plfPropertyName !== undefined || mroPart.updatedPlfValues &&
            mroPart.updatedPlfValues[ plfPropertyName ] !== undefined ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
        if( mroPart.updatedPlfValues && mroPart.updatedPlfValues[ plfPropertyName ] !== undefined ) {
            refObj.plfValue = mroPart.updatedPlfValues[ plfPropertyName ];
            refObj = getUsagePlfValue( refObj, vmo, mroPart );
        } else {
            refObj.plfValue = mroPart.plfValues[ plfPropertyName ];
            refObj = getUsagePlfValue( refObj, vmo, mroPart );
        }
    } else {
        refObj = getPLFPropertyValue( vmo, plfPropertyName, mroPart );
    }
    return refObj;
};

/**
 * Method is to process soa and register data in Ctx for PLF.

 * @param {Object} soaResponse getPLFonOccurrence SOA response
 */
let processResponseAndUpdateCtx = function( soaResponse ) {
    let eolAndPartMap = new Map();
    let mroPartList = [];
    let mroSRUidtList = [];
    const outputArray = _.values( soaResponse.plfInfo );
    _.forEach( outputArray, function( output, itr ) {
        let partObject = {};
        partObject.part = output.asset;
        partObject.partId = output.asset.uid;
        partObject.underlyingObject = output.asset.props.awb0UnderlyingObject.dbValues[ 0 ];
        partObject.isUsage = output.plfValues !== undefined ? output.isUsagePLF : 'No PLF';
        partObject.plfValues = output.plfValues;
        mroPartList[ itr ] = partObject;
        mroSRUidtList[ itr ] = partObject.partId;
    } );
    appCtxSvc.updateCtx( 'MROPartList', mroPartList );
    appCtxSvc.updateCtx( 'MROSRUidList', mroSRUidtList );
    appCtxSvc.updateCtx( 'eolAndPartMap', eolAndPartMap );
    eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
};

/**
 * Method is to process soa and register data in Ctx for plf anf End of life.

 * @param {Object} soaResponse getPLFonOccurrence2 SOA response
 */
let processResponseAndUpdateCtx2 = function( soaResponse ) {
    let eolAndPartMap = new Map();
    let mroPartList = [];
    let mroSRUidtList = [];
    const outputArray = _.values( soaResponse.plfInfo );
    _.forEach( outputArray, function( output ) {
        if ( output.plfValuesWithRelatedObjects.length > 0 ) {
            let partObject = {};
            partObject.part = output.asset;
            partObject.partId = output.asset.uid;
            partObject.underlyingObject = output.asset.props.awb0UnderlyingObject.dbValues[ 0 ];
            partObject.isUsage = output.plfValuesWithRelatedObjects.length !== 0 ? output.isUsagePLF : 'No PLF';
            partObject.plfValues = getPLFValues( output.plfValuesWithRelatedObjects );
            mroPartList.push( partObject );
            mroSRUidtList.push( partObject.partId );
            let eolObject = getEOLObjects( output.plfValuesWithRelatedObjects, 'lifeLimited' );
            if ( eolObject !== null ) {
                let asset =  partObject.isUsage ? output.asset : cdm.getObject( cdm.getObject( output.asset.props.awb0UnderlyingObject.dbValues[0] ).props.items_tag.dbValues[0] );
                eolAndPartMap.set( asset.uid, eolObject.uid );
            }
        }
    } );
    appCtxSvc.updateCtx( 'MROPartList', mroPartList );
    appCtxSvc.updateCtx( 'MROSRUidList', mroSRUidtList );
    appCtxSvc.updateCtx( 'eolAndPartMap', eolAndPartMap );
    senCreateEOLService.updateEOLOnSelectedPart( appCtxSvc.getCtx( 'sbomContext.selectedModelObjects[0]' ) );
    eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
};

/**
 * Calls methods to get PLF property value as cell text element. Appends it to the container element.
 *
 * @param {Array} plfValuesWithRelatedObjects plf property name and related objects array
 * @param {String} propName property name for which related object to be returned
 *
 * @returns{Object} related objects for the requested property
 */
let getEOLObjects = function( plfValuesWithRelatedObjects, propName ) {
    let eolObject = null;
    plfValuesWithRelatedObjects.forEach( element => {
        if ( element.propertyName === propName && element.relatedObjects !== undefined ) {
            eolObject = element.relatedObjects[0];
        }
    } );
    return eolObject;
};

/**
 * Calls methods to get PLF property value as cell text element. Appends it to the container element.
 *
 * @param {Array} partList Mro part list loaded on tree
 *
 * @returns{Object} getPlfOnOcc SOA input
 */
let getInputForGetPlfOnOcc2 = function( partList ) {
    let soaInput = [];
    let plfPropNames = [ 'lifeLimited' ];
    partList.forEach( element => {
        let inputObj = {
            contextObject:element,
            plfPropertyNames:plfPropNames
        };
        soaInput.push( inputObj );
    } );

    return soaInput;
};

/**
 * Calls methods to get PLF property value as cell text element. Appends it to the container element.
 *
 * @param {Array} plfVals Array of all plf values
 *
 * @returns{Object} getPlfOnOcc SOA input
 */
let getPLFValues = function( plfVals ) {
    let plfValues = {};
    plfVals.forEach( element => {
        plfValues[element.propertyName] = element.booleanPropertyValue;
    } );
    return plfValues;
};


export default {
    getPLFValueRenderer,
    getPartList,
    getPLF,
    getUsagePlfValue,
    getPLFPropertyValue,
    getRefObjectBasedOnPLFProp,
    processResponseAndUpdateCtx,
    getInputForGetPlfOnOcc2,
    processResponseAndUpdateCtx2
};
