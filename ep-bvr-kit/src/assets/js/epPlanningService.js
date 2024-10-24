// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * EP Planning service
 *
 * @module js/epPlanningService
 */

import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';
import messagingService from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import tableSvc from 'js/published/splmTablePublishedService';
import awColumnSvc from 'js/awColumnService';
import { getBaseUrlPath } from 'app';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import cdm from 'soa/kernel/clientDataModel';
import i18n from 'i18n/PlanningMessages';
import eventBus from 'js/eventBus';

const GET_STATION_OPERATIONS_LOAD_TYPE = 'StationOperations';
let operationsPvsMapping = [];
let pvsProbabilityMapping = [];
let operationsColumns = [];
let totalWeightedTime = 0;

/**
 *
 * @param {Array} contextUids context Objects uid
 * @returns {Array} list of operations
 * @returns {Array} list of product variants
 */
export function getOperations( contextUids ) {
    if( contextUids ) {
        const policy = {
            types: [
                {
                    name: 'Mfg0BvrProcessArea',
                    properties: [
                        {
                            name: 'elb0taktTimeConverted'
                        }
                    ]
                },
                {
                    name: 'Mfg0BvrProcessStation',
                    properties: [
                        {
                            name: 'Mfg0allocated_ops'
                        }
                    ]
                },
                {
                    name: 'Mfg0BvrOperation',
                    properties: [
                        {
                            name: 'elb0allocatedTimeByPV'
                        }
                    ]
                },
                {
                    name: 'Mfg0BvrProductVariant',
                    properties: [
                        {
                            name: 'Mfg0productionRate'
                        }
                    ]
                } ]
        };
        propPolicySvc.register( policy );
    }
    let listOfOperations = [];
    let listOfOperationObjects = [];
    let listOfPVObjects = [];
    let loadTypeArray = [ GET_STATION_OPERATIONS_LOAD_TYPE, epLoadConstants.PRODUCTION_PROGRAM ];
    let loadTypeInputs = [];

    contextUids.forEach( ( contextUid, i )=> {
        const loadTypeInput =  epLoadInputHelper.getLoadTypeInputs( loadTypeArray[i], contextUid );
        loadTypeInputs = [ ...loadTypeInput, ...loadTypeInputs ];
    } );
    return epLoadService.loadObject( loadTypeInputs, false, i18n.noProductionProgram ).then( function( result ) {
        const loadedTaskProps = result.ServiceData.modelObjects[contextUids[0]].props;
        listOfOperationObjects = loadedTaskProps.Mfg0allocated_ops.dbValues;
        let listOfPVs = result.relatedObjectsMap[contextUids[1]].additionalPropertiesMap2.productVariants;
        listOfOperationObjects.forEach( operationUid => {
            listOfOperations.push( result.ServiceData.modelObjects[ operationUid ] );
        } );
        if( listOfPVs !== undefined && listOfPVs.length > 0 ) {
            listOfPVs.forEach( pvUid => {
                listOfPVObjects.push( result.ServiceData.modelObjects[ pvUid ] );
            } );
        }

        let taktTime = loadedTaskProps.elb0taktTimeConverted.uiValues[0];
        let isTaktTimeFromLine = false;
        if( taktTime === '0' ) {
            taktTime = result.ServiceData.modelObjects[ loadedTaskProps.bl_parent.dbValues[ 0 ]].props.elb0taktTimeConverted.uiValues[0];
            isTaktTimeFromLine = true;
        }
        eventBus.publish( 'ep.stationOperationsLoaded', { taktTime: taktTime, isTaktTimeFromLine: isTaktTimeFromLine } );
        return {
            listOfOperations,
            listOfPVObjects
        };
    } );
}

/**
 *
 * @param {Array} listOfOperationsObject context for loading operations
 * @param {Array} listOfPVObjects context for loading operations
 * @returns {Array} list of operations
 */
export function loadPvRelatedObjects( listOfOperationsObject, listOfPVObjects ) {
    let listOfOperations = listOfOperationsObject.map( ( { uid, type } ) => ( { uid, type } )  );
    let listOfPvs = listOfPVObjects.map( ( { uid, type } ) => ( { uid, type } )  );
    let args = [ {
        objects:listOfOperations,
        variantRules:listOfPvs
    } ];

    return soaService.postUnchecked( 'Manufacturing-2013-05-Core', 'matchObjectsAgainstVariantRules',
        { args } ).then( function( response ) {
        if( response.ServiceData && response.ServiceData.partialErrors ) {
            const err = messagingService.getSOAErrorMessage( response.ServiceData );
            messagingService.showError( err );
            let awPromise = AwPromiseService.instance;
            return awPromise.reject( err );
        }
        let matrix = response.results[0].matrix;
        operationsPvsMapping = _.map( matrix[0], function( item, i ) {
            return _.extend( item, [ matrix[1][i] ] );
        } );
        return operationsPvsMapping;
    } );
}

/**
 *
 * @param {*} vmos the pv object
 */
export function calculatePvsProbability( productVariants ) {
    if( productVariants ) {
        productVariants.forEach( ( vmo, i ) => {
            const probability = parseFloat( vmo.props[ epBvrConstants.MFG_PRODUCTION_RATE ].uiValues ) / vmo.totalProductionRate * 100;
            vmo.probability = parseFloat( probability );
        } );
        pvsProbabilityMapping = productVariants;
    }
}

/**
 *
 * @returns {Float} Total weighted time
 */
export function calculateWeightedAndTotalWeightedTime(  ) {
    totalWeightedTime = 0;
    operationsPvsMapping.forEach( operation => {
        let pvs = operation[0].map( ( { uid } ) => ( { uid } )  );

        let sumProbability = 0;

        pvs.forEach( pv =>{
            pvsProbabilityMapping.forEach( p =>{
                if( pv.uid === p.uid ) {
                    sumProbability += p.probability;
                }
            } );
        }
        );
        if( operation.props.elb0allocatedTimeByPV !== undefined ) {
            const weightedTime = sumProbability / 100 * parseFloat( operation.props.elb0allocatedTimeByPV.uiValues[0] ).toFixed( 2 );
            operation.weightedTime = weightedTime;
            totalWeightedTime += weightedTime;
        }
    } );
    return totalWeightedTime;
}

/**
 *
 * @param {Array} operationUid the operation uid
 *  * @returns {Float} weighted time
 */
export function getWeightedTime( operationUid ) {
    let operationObj = operationsPvsMapping.find( o => o.uid === operationUid );
    if( operationObj !== undefined ) {
        return operationObj.weightedTime;
    }
    return 0;
}

/**
 * Override property of cellHeader1 with cellHeader1 and  probability
 * @param {Array} productVariantsList
 * @returns {Array} productVariantsList
 */
function updateProductVariantsInfoList( productVariantsList ) {
    return productVariantsList.map( ( pv ) => {
        const vmo = mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( pv.uid ) );
        const probability = parseFloat( pv.probability.toFixed( 3 ) );
        vmo.cellHeader1 = `${pv.props.bl_rev_object_name.uiValues[0]} (${probability}%)`;
        return vmo;
    } );
}

/**
 * cache initial table columns
 * @param {Array} columns
 */
export function cacheTableColumns( columns ) {
    operationsColumns = columns;
}

/**
 * Update table with pvs column and render pvs cell info
 * @param {Array} pvsList
 * @param {Array} existingColumns
 * @returns {Array} columns
 */
export function updateTablesWithPvsColumns( pvsList, existingColumns ) {
    let columns = [];
    let newColumns = [];
    if( existingColumns ) {
        // Filter unchanged pvs columns / remove removed pv columns
        const unchangedPvsColumns = existingColumns.filter( ( existingColumn ) => existingColumn.propertyName.split( '_' )[ 0 ] === 'dynamic' && pvsList.some( ( pv ) => existingColumn.name === pv.uid ) );

        newColumns = [ ...operationsColumns, ...unchangedPvsColumns ];
        // Filter pvs columns to add in table
        const columnsToAdd = pvsList.filter( pv => !newColumns.find( column => column.name === pv.uid ) );

        // create pvs columns
        columns = _.map( columnsToAdd, pv => awColumnSvc.createColumnInfo( {
            displayName: pv.cellHeader1,
            name: pv.uid,
            propertyName: `dynamic_${pv.uid}`,
            propertyDisplayName: pv.cellHeader1,
            minWidth: 50,
            width: 100,
            enableFiltering: false,
            enableColumnResizing: true,
            enablePinning: false,
            enableSorting: false,
            enableCellEdit: false,
            pv: true,
            cellRenderers: [ {
                action: function( column, vmo, tableElem, rowElem ) {
                    const cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
                    for( let operations of operationsPvsMapping ) {
                        if( operations.uid === vmo.uid ) {
                            for( let pvs of operations[ 0 ] ) {
                                if( pvs.uid === column.name ) {
                                    cellContent.classList.add( 'justify-center' );
                                    let cellImg = document.createElement( 'img' );
                                    cellImg.src = `${getBaseUrlPath()}/image/indicatorCheckmarkGreen16.svg`;
                                    cellContent.appendChild( cellImg );
                                    return cellContent;
                                }
                            }
                        }
                    }
                    return cellContent;
                },
                condition: function( column, vmo, tableElem, rowElem ) {
                    return true;
                }
            } ]
        } ) );
    }
    return [ ...newColumns, ...columns ];
}

/**
 * condition for done button enable
 * @param {*} updateListInfos
 * @param {*} variantsListInfo
 * @returns {Boolean} is done button enable
 */
export function enableDoneButton( updateListInfos, variantsListInfo ) {
    if( updateListInfos.selectedList.length === 0 && updateListInfos.availableList.length === 0 ) {
        return false;
    }
    if( JSON.stringify( updateListInfos.selectedList ) === JSON.stringify( variantsListInfo.selectedList ) ) {
        return false;
    }
    if( updateListInfos.selectedList.length > 0 && JSON.stringify( updateListInfos.selectedList ) !== JSON.stringify( variantsListInfo.selectedList ) ) {
        return true;
    }
    if( updateListInfos.selectedList.length === 0 && variantsListInfo.selectedList.length > 0 ) {
        return true;
    }

    return false;
}

/**
 * Resets total property of PV columns to 0.
 * @param {Array} columns all columns of the operations table
 * @returns {Array} Array of columns after resetting total
 */
function resetPVColumnsTotal( columns ) {
    return [ ...columns ];
}

/**
 * @param {String} pvUid uid of pv
 * @returns {Array} operations applicable for this pv
 */
function getOperationsForProductVariant( pvUid ) {
    return _.filter( operationsPvsMapping, operation => _.find( operation[0], { uid: pvUid } ) );
}

/**
 * getTotalWeightedTime
 * @returns {Number} totalWeightedTime
 */
export function getTotalWeightedTime() {
    return totalWeightedTime;
}

/**
 * getLoadedOperations
 * @returns {Number} totalWeightedTime
 */
export function getLoadedOperations() {
    return operationsPvsMapping;
}

export default {
    getOperations,
    loadPvRelatedObjects,
    calculatePvsProbability,
    calculateWeightedAndTotalWeightedTime,
    getWeightedTime,
    cacheTableColumns,
    updateProductVariantsInfoList,
    updateTablesWithPvsColumns,
    resetPVColumnsTotal,
    enableDoneButton,
    getOperationsForProductVariant,
    getTotalWeightedTime,
    getLoadedOperations
};
