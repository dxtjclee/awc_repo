// Copyright (c) 2022 Siemens

/**
 * @module js/senCreateEOLService
 */
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';


import appCtxSvc from 'js/appCtxService';
import senEndOfLifeService from 'js/senEndOfLifeService';

const SELECTED = 'selected';
const REMOVE = 'remove';
const SET = 'set';

/**
  * Get input data for object creation.
  *
  * @param {Object} data the view model data object
  * @param {Object} selected selected vmo on UI
  *
  * @returns {Object} SOA input for createRelateAndSubmitObjects()
  */
let getCreateInput = function( data, selected ) {
    let creInputMap = {};
    let targetObject = [];
    let boName = 'Smr0EndOfLife';
    creInputMap[ '' ] = {
        boName: boName,
        compoundCreateInput: {}
    };
    creInputMap[''].propertyNameValues = {
        object_name: [ data.Name.dbValue ],
        fnd0RevisionId: [ data.fnd0RevisionId.dbValue ],
        object_desc: [ data.object_desc.dbValue ],
        smr0FromDate: [ data.smr0FromDate.dbValue ],
        smr0Duration: [ data.smr0Duration.dbValue ],
        smr0DurationUnit: [ data.smr0DurationUnit.dbValue ],
        smr0IsDate : [ 'true' ]
    };
    if( selected[0] !== null ) {
        targetObject = data.isUsagePLFOnSelectedObj ? data.selectedNeutralBomLines[0] : cdm.getObject( cdm.getObject( selected[0].props.awb0UnderlyingObject.dbValues[0] ).props.items_tag.dbValues[0] );
    }
    return [ {
        clientId: 'CreateObject',
        createData: _.get( creInputMap, '' ),
        dataToBeRelated: {},
        targetObject: targetObject,
        pasteProp: 'Smr0NeutralEOL',
        workflowData: {}
    } ];
};
/**
  * Get input data for object creation.
  *
  * @param {Object} createdObject created EOL object
  * @param {Object} actionType action performed on EOL (set/edit/remove)
  */

let registerEOL =  function( createdObject, actionType ) {
    const eolAndPartMap = appCtxSvc.getCtx( 'eolAndPartMap' );
    let selectedObj = appCtxSvc.getCtx( SELECTED );
    let selectedPart;
    let mroPart = null;
    if( selectedObj !== null ) {
        const mroPartList = appCtxSvc.getCtx( 'MROPartList' );
        if( mroPartList ) {
            for( let index = 0; index < mroPartList.length; index++ ) {
                if( mroPartList[ index ].partId === selectedObj.uid ) {
                    mroPart = mroPartList[ index ];
                    break;
                }
            }
        }
        if( mroPart ) {
            const isUsage = mroPart.isUsage;
            selectedPart =  isUsage ? selectedObj : cdm.getObject( cdm.getObject( selectedObj.props.awb0UnderlyingObject.dbValues[0] ).props.items_tag.dbValues[0] );
        }
    }
    if( actionType === REMOVE ) {
        eolAndPartMap.delete( selectedPart.uid, createdObject.uid );
    } else if ( actionType === SET ) {
        eolAndPartMap.set( selectedPart.uid, createdObject.uid );
    }
    appCtxSvc.registerCtx( 'eolAndPartMap', eolAndPartMap );
};

/**
  * Method to update EOL on selected object.
  *
  * @param {Object} selectedObj the view model selected object
  */
let updateEOLOnSelectedPart = function( selectedObj ) {
    const selectedObject = selectedObj ? selectedObj : appCtxSvc.getCtx( 'sbomContext.topElement' );
    let eolOnSelectedPart = [];
    let eolOnPartPresent = false;
    const eolAndPartMap = appCtxSvc.getCtx( 'eolAndPartMap' );
    if( selectedObject && eolAndPartMap.size !== 0 ) {
        const mroPartList = appCtxSvc.getCtx( 'MROPartList' );
        let mroPart = null;
        if( mroPartList ) {
            for( let index = 0; index < mroPartList.length; index++ ) {
                if( mroPartList[ index ].partId === selectedObject.uid ) {
                    mroPart = mroPartList[ index ];
                    break;
                }
            }
        }
        if( mroPart ) {
            const isUsage = mroPart.isUsage;
            for( let keys of eolAndPartMap ) {
                const uidToSearch =  isUsage ? selectedObject.uid : cdm.getObject( cdm.getObject( selectedObject.props.awb0UnderlyingObject.dbValues[0] ).props.items_tag.dbValues[0] ).uid;
                if( keys[0] === uidToSearch ) {
                    let eolRevList =  senEndOfLifeService.getEOLRevisionListByCreationDate( cdm.getObject( keys[1] ) );
                    eolOnSelectedPart.push( eolRevList[ 0 ] );
                    eolOnPartPresent = true;
                    break;
                }
            }
        }
    }
    appCtxSvc.registerCtx( 'eolOnSelectedPart',  eolOnSelectedPart );
    appCtxSvc.registerCtx( 'isEolAvailable', eolOnPartPresent );
};

/**
  * Get input data for object creation.
  *
  * @returns {Bool} returns the usagePLF value
  */
let validateItemOrOccLevelEOL =  function( ) {
    const MROPartList = appCtxSvc.getCtx( 'MROPartList' );
    const selected = appCtxSvc.getCtx( SELECTED );
    let isUsagePLFOnSelectedObj = false;
    for ( let index = 0; index < MROPartList.length; index++ ) {
        if ( MROPartList[index].partId === selected.uid && MROPartList[index].isUsage ) {
            isUsagePLFOnSelectedObj = true;
            break;
        }
    }
    return isUsagePLFOnSelectedObj;
};
export default {
    getCreateInput,
    registerEOL,
    updateEOLOnSelectedPart,
    validateItemOrOccLevelEOL
};
