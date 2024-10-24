// Copyright (c) 2022 Siemens

/**
 * @module js/senCompareService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import senCompareUtils from 'js/senCompareUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

/**
 * performCompare
 * @param {Object} vmos selectd view model object
 * @param {String } contextKey  view key that represent the view
 * @return {Promise} promise of  soa response
 */
let performCompare = function( vmos, contextKey ) {
    let element = appCtxService.getCtx( contextKey + '.modelObject' );
    let productContextInfo = appCtxService.getCtx( contextKey + '.productContextInfo' );

    let comapreContext = senCompareUtils.updateAndGetCompareContext( contextKey, vmos, element, productContextInfo );
    let sourceContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 0 ];
    let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];
    let sourceCompareInfo = comapreContext[ sourceContextKey ];
    let targetCompareInfo = comapreContext[ targetContextKey ];

    return _performCompare( sourceContextKey, targetContextKey, sourceCompareInfo, targetCompareInfo );
};


/**
 * _performCompare
 * @param {Object} sourceContextKey context view key of source
 * @param {Object} targetContextKey context view key of source
 * @param {Object} sourceCompareInfo compare information of source
 * @param {Object} targetCompareInfo compare information of target
 * @return {promise} promise
 */
let _performCompare = function( sourceContextKey, targetContextKey, sourceCompareInfo, targetCompareInfo ) {
    let deferred = AwPromiseService.instance.defer();
    let sourceElement = appCtxService.getCtx( sourceContextKey + '.topElement' );
    let targetElement = appCtxService.getCtx( targetContextKey + '.topElement' );

    let srcVmosToUpdate = getVmosToUpdate( sourceCompareInfo );
    let trgVmosToUpdate = getVmosToUpdate( targetCompareInfo );

    if( _isValidCompare( sourceElement, srcVmosToUpdate, targetElement, trgVmosToUpdate ) ) {
        let srcElement = getTopElement( sourceCompareInfo );
        let srcPciObject = getProductContext( sourceCompareInfo );
        let srcInput = _getInputFor( srcElement, srcPciObject, srcVmosToUpdate );

        let trgElement = getTopElement( targetCompareInfo );
        let trgPciObject = getProductContext( targetCompareInfo );
        let trgInput = _getInputFor( trgElement, trgPciObject, trgVmosToUpdate );

       let compareInput = _getSoaInput( srcElement, trgElement, srcInput, trgInput );

       _invokeCompareSoa( compareInput ).then( function( response ) {
            let sourceDifference = processElementsStatus(response.sourceBomElementStatus);
            let targetDifference = processElementsStatus(response.targetBomElementStatus);

            senCompareUtils.updateDifferencesInContext( sourceCompareInfo, sourceDifference );
            senCompareUtils.updateDifferencesInContext( targetCompareInfo, targetDifference );

            let updatedCompareObject = {
                sourceIdsToUpdate: _getVisibleUidsFor( srcVmosToUpdate ),
                targetIdsToUpdate: _getVisibleUidsFor( trgVmosToUpdate )
            };
            eventBus.publish( 'sen.compareComplete', updatedCompareObject );
        } );
    }

    deferred.resolve();
    return deferred.promise;
};


/**
 * Get view model objects of given object
 * @param  {Object}compareInfo compareInfo
 * @return {Array} view model objects
 */
 let getVmosToUpdate = function( compareInfo ) {
    return compareInfo ? compareInfo.visibleVmos : null;
};

/**
 * Get top element of given of object
 * @param  {Object}compareInfo compareInfo
 * @return {Object} top element
 */
 let getTopElement = function( compareInfo ) {
    return compareInfo ? compareInfo.topElement : null;
};

/**
 * Get product context objects of given object
 * @param  {Object}compareInfo compareInfo
 * @return {Object} product context objects
 */
 let getProductContext = function( compareInfo ) {
    return compareInfo ? compareInfo.productContextInfo : null;
};

/**
 * Get the  input for getAssignmentStatus soa
 * @param {Object} srcVmo source object
 * @param {Object} trgVmo target object
 * @param {Object} srcInput source information
 * @param {Object} trgInput target information
 * @return {Object} input data
 */
let _getSoaInput = function(srcVmo, trgVmo, srcInput, trgInput ) {
    let sourceInfo = getInfoObject(srcVmo, srcInput);
    let targetInfo = getInfoObject(trgVmo,trgInput);

    let changeNoticeInfo = {
        "changeNoticeRev": {
            "uid": "",
            "type": ""
        },
        "changeRecords": []
    };

    let acCriteria = {
        "inputDataStore": {},
        "filterOptions": {},
        "userOptions": {doFreshCompare : true},
        "supportingObjects": {}
    };

    return {
        input: {
            sourceBomInfo: sourceInfo,
            targetBomInfo: targetInfo,
            changeNoticeInfo: changeNoticeInfo,
            accCheckCriteria: acCriteria
        }
    };
};


/**
 * Get sourceBomInfo/targetBomInfo object in required format
 * @param {Object} element source or target object
 * @param {Object} input target object
 * @return {Object} Object format required in soa input
 */
let getInfoObject = function (element, input){

    let topElement = {
        type : element.type,
        uid : element.uid
    };

    let productCtxInfo = {
        type : input.productContextInfo.type,
        uid : input.productContextInfo.uid
    };

    let visibleUids = input.visibleUids ;

    return {
        scopeObject : topElement,
        contextInfo : productCtxInfo,
        objectsToProcess : visibleUids
    };
};


/**
 * Process the differences of given parameter
 * @param {Object} elementsStatus elementsStatus
 * @return {Object} differences
 */
 function processElementsStatus(elementsStatus) {
    let statusMaping = {};
    if (elementsStatus) {
        for (let key in elementsStatus) {
            let elemStatus = {
                status: elementsStatus[key].status
            };
            if (elementsStatus[key].equivalentElements) {
                elemStatus.mappingUids = [];
                elementsStatus[key].equivalentElements.forEach(element => {
                    elemStatus.mappingUids.push({ uid: element });
                });
            }
            statusMaping[key] = elemStatus;
        }
    }
    return statusMaping;
}

/**
 * Get input of given object
 * @param {Object} element comparable object
 * @param {Object} pci product context information
 * @param {Array} visibleVmos array of view model objects
 * @return {Object}  object
 */
let _getInputFor = function( element, pci, visibleVmos ) {
    return {
        element: element,
        productContextInfo: pci,
        visibleUids: _getVisibleUidsFor( visibleVmos ),
        depth: -1
    };
};

/**
 *Check the  validity of compare of given parameter
 * @param {Object} sourceElement top element of source view
 * @param {Array} sourceVmosToUpdate vmos to update of source view
 * @param {Object} targetElement top element of target view
 * @param {Array} targetVmosToUpdate vmos to update of target view
 * @return {boolean} true if valid otherwise false
 */
let _isValidCompare = function( sourceElement, sourceVmosToUpdate, targetElement, targetVmosToUpdate ) {
    if( !sourceElement || !targetElement || sourceElement && targetElement && sourceElement.uid === targetElement.uid ) {
        return false;
    }

    if( sourceVmosToUpdate && targetVmosToUpdate ) {
        return sourceVmosToUpdate.length > 0 && targetVmosToUpdate.length > 0;
    }

    return false;
};

let _invokeCompareSoa = function( soaInput ) {
    return soaSvc.postUnchecked( 'ServiceEngineeringAw-2023-06-ServiceEngineeringAw', 'getAssignmentStatus', soaInput );
};

/**
 *
 * @param {Array} vmos  array of view model object
 * @return {Array} array of uids
 */
let _getVisibleUidsFor = function( vmos ) {
    let uids = [];
    _.forEach( vmos, function( vmo ) {
        uids.push( vmo.uid );
    } );

    return uids;
};

export default {
    performCompare
};
