// Copyright (c) 2022 Siemens

/**
 * @module js/senLotInfoViewerService
 */

import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import policySvc from 'soa/kernel/propertyPolicyService';
import appCtxSvc from 'js/appCtxService';
let exports = {};

/**
 * Method to get the Lots on the Neutral Object
 *  @param neutralPartRevUid Neutral Part Revision Uid
 *
 */

export let loadLotsOnNeutralPart = async function( neutralPartRevUid ) {
    let neutralPartRevision = cdm.getObject( neutralPartRevUid );
    let modelObj = cdm.getObject( neutralPartRevision.props.items_tag.dbValues[ 0 ] );
    let lots = [];
    if( modelObj ) {
        let inputData = {
            inputs: [ {
                clientId: '1',
                item: modelObj
            } ]
        };
        let policy = {
            types: [ {
                name: 'Lot',
                properties: [ {
                    name: 'lotSize'
                }, {
                    name: 'lotUsage'
                },
                {
                    name: 'lotNumber'
                },
                {
                    name: 'manufacturerOrgId'
                },
                {
                    name: 'expirationDate'
                }
                ]
            } ]
        };
        let policyId = policySvc.register( policy );
        await soaSvc.postUnchecked( 'Internal-MROCore-2012-02-MROCore', 'getLotsforItem', inputData ).then( function( response ) {
            if( response.output[ 0 ].lots ) {
                for( let i = 0; i < response.output[ 0 ].lots.length; i++ ) {
                    lots[ i ] = response.output[ 0 ].lots[ i ];
                }
            }
            if( policyId ) {
                policySvc.unregister( policyId );
            }
        } );
    }
    return lots;
};

/**
 * Method to get the PLF Value for isLot on the Neutral Object
 *  @param selectedObjectUid Selected Object Uid
 *  @param MROSRUidList MRO SRUid List for SBOM
 *  @param MROPartList MRO Part List for SBOM
 */

export let getLotValueForSelectedObject = function( selectedObjectUid, MROSRUidList, MROPartList ) {
    let isMRONeutral = MROSRUidList.includes( selectedObjectUid );
    let showLotTable = false;
    if( isMRONeutral ) {
        let ind = MROSRUidList.indexOf( selectedObjectUid );
        showLotTable = MROPartList[ ind ].plfValues.isLot;
    }
    appCtxSvc.registerCtx( 'showLotTable', showLotTable );
};

export default exports = {
    loadLotsOnNeutralPart,
    getLotValueForSelectedObject
};
