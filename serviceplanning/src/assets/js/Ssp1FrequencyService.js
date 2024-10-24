// Copyright (c) 2022 Siemens

import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import messagingService from 'js/messagingService';

var exports = {};

export let loadFrequencyColumns = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = [];
    var firstColumnConfigCol = {
        name: 'object_string',
        displayName: data.grids.frequencyList.i18n.FrequencyName,
        propertyName: 'object_string',
        minWidth: 100,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true
    };
    var secondColumnConfigCol = {
        name: 'ssp0FrequencyExpression',
        displayName: data.grids.frequencyList.i18n.FrequencyExpression,
        propertyName: 'ssp0FrequencyExpression',
        minWidth: 100,
        width: 300,
        enableColumnMenu: false,
        enableColumnMoving: false,
        typeName: 'STRING',
        pinnedLeft: false
    };
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );
    awColumnSvc.createColumnInfo( awColumnInfos );
    deferred.resolve(
        {
            columnConfig: {
                columns: awColumnInfos
            }
        }
    );
    return deferred.promise;
};

export let setNodeProperties = function( response ) {
    let objectsToReturn = [];
    if ( response.modelObjects !== undefined ) {
        var modelObjects = response.modelObjects || response.data.modelObjects;
        Object.values( modelObjects ).filter( obj => obj.modelType.typeHierarchyArray.includes( 'SSP0FrequencyRevision' ) ).forEach( function( revisionModelObjectJson ) {
            let modelObjectJson = Object.values( modelObjects ).filter( obj => 
                obj.modelType.typeHierarchyArray.includes( 'SSP0BvrFrequency' ) && obj.props.bl_revision.dbValues[0] === revisionModelObjectJson.uid )[0];
            if(modelObjectJson !== undefined){
                modelObjectJson.props.ssp0FrequencyExpression = modelObjects[modelObjectJson.props.bl_revision.dbValues[0]].props.ssp0FrequencyExpression;
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObjectJson, 'create', undefined, undefined, true );
                vmo.displayName = modelObjectJson.props.object_string.dbValues[0];
                vmo.isVisible = false;
                vmo.isLeaf = true;
                objectsToReturn.push( vmo );
            }
        }
        );
    }
    return {
        response: objectsToReturn,
        totalFound: objectsToReturn.length
    };
};


/**
 * This function disconnects frequency from service requirement
 *
 * @param {Array} sourceObjects - selected frequency
 * @param {Object} target - service requirement
 */
export let unassignFrequency = function( sourceObjects, target ) {
    let input = [];
    for ( let sourceObject of sourceObjects ) {
        input.push( {
            disconnectFrom: {
                uid: target.uid,
                type: target.type
            },
            clientId: '',
            relationName: '',
            object: {
                uid: sourceObject.uid,
                type: sourceObject.type
            }
        } );
    }
    soaService.postUnchecked( 'Manufacturing-2009-10-DataManagement', 'disconnectObjects', {
        input: input
    } ).then( function( response ) {
        if ( response.partialErrors && response.partialErrors.length > 0 ) {
            showError( response.partialErrors );
        }
    } );
};

/**
 *
 * @param {Array} partialErrors - partial errors array
 */
function showError( partialErrors ) {
    for ( let i = 0; i < partialErrors.length; i++ ) {
        messagingService.showError( partialErrors[i].errorValues[0].message );
    }
}

/**
 * this method will update current selection
 *
 * @param {Object} vmo will be the current selection list
 * */
let registerFrequencyInCtx = function( vmo ) {
    if( vmo && vmo.length >= 1 ) {
        if( !appCtxService.getCtx( 'ssp0SelectedFrequency' )  ) {
            appCtxService.registerCtx( 'ssp0SelectedFrequency', vmo );
        }else{
            appCtxService.updateCtx( 'ssp0SelectedFrequency', vmo );
        }
    } else if( vmo.length <= 0 && appCtxService.ctx.ssp0SelectedFrequency ) {
        appCtxService.unRegisterCtx( 'ssp0SelectedFrequency' );
    }
};

export default exports = {
    loadFrequencyColumns,
    setNodeProperties,
    unassignFrequency,
    registerFrequencyInCtx
};
