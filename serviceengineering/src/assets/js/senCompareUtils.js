// Copyright (c) 2022 Siemens

/**
 * @module js/senCompareUtils
 */
import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';


const _compareContextKey = 'senCompareContext';

/**
 * Update and get compare information of given context
 * @param {String} contextKey name of the context e.g ebomContext, sbomContext etc.
 * @param {Array} visibleVmos array of visible view model object
 * @param {Object} topElement top element
 * @param {Object} productContextInfo product context information
 * @return {Object} an object for given context
 */
let updateAndGetCompareContext = function( contextKey, visibleVmos, topElement, productContextInfo ) {
    let comapreContext = appCtxService.getCtx( _compareContextKey );

    if( !comapreContext ) {
        comapreContext = {};
        appCtxService.updateCtx( _compareContextKey, comapreContext );
    }

    let compareInfo = comapreContext[ contextKey ];
    if( !compareInfo ) {
        compareInfo = {};
        comapreContext[ contextKey ] = compareInfo;
    }

    compareInfo.visibleVmos = visibleVmos;
    compareInfo.topElement = topElement;
    compareInfo.productContextInfo = productContextInfo;

    return comapreContext;
};

/**
 * Update the difference in cache of given compare information
 * @param {Object} compareInfo comapare information
 * @param {Object} differences differences
 */
let updateDifferencesInContext = function( compareInfo, differences ) {
    if( compareInfo ) {
        delete compareInfo.differences;
        compareInfo.differences = differences;
    }
};

/**
 * Get status of given uid
 * @param {String} contextKey view key tat represent the view
 * @param {String} uid uid of the object
 * @return {number} status
 */
let getStatus = function( contextKey, uid ) {
    let comapreContext = appCtxService.getCtx( _compareContextKey );
    if( comapreContext ) {
        let compareInfo = comapreContext[ contextKey ];
        if( compareInfo && compareInfo.differences ) {
            let diff = compareInfo.differences[ uid ];
            return diff ? diff.status : null;
        }
    }
};

/**
 * find target uids for a given uid from the given context
 * @param {String} contextKey name of the context e.g ebomContext, sbomContext etc.
 * @param {String} uid of source object.
 * @return {Array}  uids of target objects
 */
let findDifferencesFor = function( contextKey, uid ) {
    let comapreContext = appCtxService.getCtx( _compareContextKey );
    let uids = [];
    if( comapreContext ) {
        let compareInfo = comapreContext[ contextKey ];
        if( compareInfo && compareInfo.differences ) {
            let difference = compareInfo.differences[uid];
            if( difference && difference.mappingUids ) {
                difference.mappingUids.forEach( ( mappingUid )=>{
                    uids.push( mappingUid.uid );
                } );
            }
        }
    }
    return uids;
};

/**
 *Update compare status
 @param {String} contextKey view key that represent view
 @param {Array} uids array of uids
 @param {Object} supportedStatuses supportedStatuses
 */
let updateCompareStatus = function( contextKey, uids, supportedStatuses ) {
    let updatedCompareStatus = {};
    if( uids ) {
        let comapreContext = appCtxService.getCtx( _compareContextKey );
        let compareInfo = comapreContext[ contextKey ];
        if( compareInfo ) {
            _.forEach( uids, function( uid ) {
                let diff = compareInfo.differences ? compareInfo.differences[ uid ] : null;
                _.forEach( supportedStatuses, function( supportedStatus ) {
                    if( diff ) {
                        if( _.indexOf( supportedStatus.statuses, diff.status ) > -1 ) {
                            if( !updatedCompareStatus[ uid ] ) {
                                updatedCompareStatus[ uid ] = [ supportedStatus.columnName ];
                            } else if( !updatedCompareStatus[ uid ][ supportedStatus.columnName ] ) {
                                updatedCompareStatus[ uid ].push( supportedStatus.columnName );
                            }
                        }
                    } else {
                        // this required to remove status from column during unassigned
                        if( !updatedCompareStatus[ uid ] ) {
                            updatedCompareStatus[ uid ] = [ supportedStatus.columnName ];
                        } else if( !updatedCompareStatus[ uid ][ supportedStatus.columnName ] ) {
                            updatedCompareStatus[ uid ].push( supportedStatus.columnName );
                        }
                    }
                } );
            } );
        }
    }
    eventBus.publish( 'viewModelObject.propsUpdated', updatedCompareStatus );
};

export default {
    updateAndGetCompareContext,
    updateDifferencesInContext,
    getStatus,
    findDifferencesFor,
    updateCompareStatus
};
