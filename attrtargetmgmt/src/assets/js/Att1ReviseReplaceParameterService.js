// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ReviseReplaceParameterService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';

var exports = {};

export let getInputForReviseReplace = function( commandContext ) {
    var inputs = [];

    var selectedParent = commandContext.parametersTable ? commandContext.parametersTable.parentObjects[ 0 ] : commandContext.selection[ 0 ];
    var locationContext = commandContext.openedObject;
    //in case of Home Folder And item revision in its own location
    if( locationContext.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 || selectedParent.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        inputs = exports.getInputForItemRevision( selectedParent, commandContext.parametersTable.selectedUnderlyingObjects );
    } else {
        inputs = exports.getReviseReplaceInputInAceContext( commandContext.parametersTable );
    }
    return inputs;
};
export let getReviseReplaceInputInAceContext = function( parametersTable, targetParameter ) {
    var inputs = [];
    var parentParameterMap = _.get( parametersTable, 'parentToProxyParametersMap', undefined );

    for( const [ parentId, parameterList ] of parentParameterMap.entries() ) {
        var replaceParams = [];
        _.forEach( parameterList, function( parameter ) {
            var sourceAttribute = cdm.getObject( _.get( parameter, 'props.att1SourceAttribute.dbValues[0]', undefined ) );
            var replaceParam;
            if( targetParameter ) {
                replaceParam = { selectedParam: sourceAttribute, targetParam: targetParameter, reviseAndReplace: false };
            } else {
                replaceParam = { selectedParam: sourceAttribute, reviseAndReplace: true };
            }
            replaceParams.push( replaceParam );
        } );
        var input = { clientId: 'AW_ATT1', parent: cdm.getObject( parentId ), replaceParams: replaceParams };
        inputs.push( input );
    }
    return inputs;
};
export let getInputForItemRevision = function( selectedParent, selectedParameters, targetParameter ) {
    var inputs = [];
    var replaceParams = [];
    _.forEach( selectedParameters, function( parameter ) {
        if( targetParameter ) {
            replaceParams.push( { selectedParam: parameter, targetParam: targetParameter, reviseAndReplace: false } );
        } else {
            replaceParams.push( { selectedParam: parameter, reviseAndReplace: true } );
        }
    } );
    var input = { clientId: 'AW_ATT1', parent: selectedParent, replaceParams: replaceParams };
    inputs.push( input );
    return inputs;
};
export let getInputForReplaceRevision = function( data, parametersTable, openedObject ) {
    var inputs = [];
    var selectedParent = parametersTable.parentObjects[ 0 ];
    var selectedParameter = parametersTable.selectedUnderlyingObjects;

    var targetParameter = data.dataProviders.paramRevisionListProvider.selectedObjects[ 0 ];
    //in case of Home Folder And item revision in its own location
    if( openedObject.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 || selectedParent.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        inputs = exports.getInputForItemRevision( selectedParent, selectedParameter, targetParameter );
    } else {
        inputs = exports.getReviseReplaceInputInAceContext( parametersTable, targetParameter );
    }
    return inputs;
};

/**
 * Get the reviseInput for reviseObjects SOA
 *
 * @param {Object} ctx - ctx.
 * @return {Object} The reviseInput
 */
export let getReviseInputsForParameters = function( mselected ) {
    var deferred = AwPromiseService.instance.defer();
    var reviseInputsArray = [];
    var reviseInputsMap = new Map();
    var impactedItems = mselected;
    for( var i = 0; i < impactedItems.length; i++ ) {
        var reviseInputs = {};
        if( impactedItems[ i ].modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            reviseInputs.item_revision_id = [ '' ];
        }
        reviseInputs.object_desc = [ '' ];
        reviseInputs.fnd0ContextProvider = [ appCtxSvc.ctx.pselected.uid ];

        var reviseInput = {};
        reviseInput.targetObject = impactedItems[ i ];
        reviseInput.reviseInputs = reviseInputs;
        reviseInputsArray.push( reviseInput );
        reviseInputsMap.set( impactedItems[ i ].uid, reviseInput );
    }

    var promise = self.setReviseInDeepCopyData( impactedItems, reviseInputsMap );
    if( promise ) {
        promise.then( function( response ) {
            deferred.resolve( response );
        } );
    }
    return deferred.promise;
};
/**
 * Set deep copy data in revise inputs
 *
 * @param impactedItems The impacted items
 * @param reviseInputsMap Map of impacted items to their reviseIn
 * @return A list of revise inputs with the deep copy datas
 */
self.setReviseInDeepCopyData = function( impactedItems, reviseInputsMap ) {
    var deferred = AwPromiseService.instance.defer();
    var deepCopyDataInputs = [];
    for( var i = 0; i < impactedItems.length; i++ ) {
        var dcd = {
            operation: 'Revise',
            businessObject: impactedItems[ i ]
        };
        deepCopyDataInputs.push( dcd );
    }

    var inputData = {
        deepCopyDataInput: deepCopyDataInputs
    };

    var deepCopyInfoMap = [];
    var promise = soaSvc.post( 'Core-2014-10-DataManagement', 'getDeepCopyData', inputData );
    if( promise ) {
        promise.then( function( response ) {
            if( response !== undefined ) {
                deepCopyInfoMap = response.deepCopyInfoMap;
                for( var i = 0; i < impactedItems.length; i++ ) {
                    for( var b in deepCopyInfoMap[ 0 ] ) {
                        if( deepCopyInfoMap[ 0 ][ b ].uid === impactedItems[ i ].uid ) {
                            var reviseIn = reviseInputsMap.get( deepCopyInfoMap[ 0 ][ b ].uid );
                            reviseIn.deepCopyDatas = self.convertDeepCopyData( deepCopyInfoMap[ 1 ][ b ] );
                            break;
                        }
                    }
                }
            }
            deferred.resolve( Array.from( reviseInputsMap.values() ) );
        } );
    }
    return deferred.promise;
};

/**
 * Convert Deep Copy Data from client to server format
 *
 * @param deepCopyData property name
 * @return A list of deep copy datas
 */
self.convertDeepCopyData = function( deepCopyData ) {
    var deepCopyDataList = [];
    for( var i = 0; i < deepCopyData.length; i++ ) {
        var newDeepCopyData = {};
        newDeepCopyData.attachedObject = deepCopyData[ i ].attachedObject;
        newDeepCopyData.copyAction = deepCopyData[ i ].propertyValuesMap.copyAction[ 0 ];
        newDeepCopyData.propertyName = deepCopyData[ i ].propertyValuesMap.propertyName[ 0 ];
        newDeepCopyData.propertyType = deepCopyData[ i ].propertyValuesMap.propertyType[ 0 ];

        var value = false;
        var tempStrValue = deepCopyData[ i ].propertyValuesMap.copy_relations[ 0 ];
        if( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.copyRelations = value;

        value = false;
        tempStrValue = deepCopyData[ i ].propertyValuesMap.isTargetPrimary[ 0 ];
        if( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isTargetPrimary = value;

        value = false;
        tempStrValue = deepCopyData[ i ].propertyValuesMap.isRequired[ 0 ];
        if( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isRequired = value;

        newDeepCopyData.operationInputTypeName = deepCopyData[ i ].operationInputTypeName;

        var operationInputs = {};
        operationInputs = deepCopyData[ i ].operationInputs;
        newDeepCopyData.operationInputs = operationInputs;

        var aNewChildDeepCopyData = [];
        if( deepCopyData[ i ].childDeepCopyData && deepCopyData[ i ].childDeepCopyData.length > 0 ) {
            aNewChildDeepCopyData = self.convertDeepCopyData( deepCopyData[ i ].childDeepCopyData );
        }
        newDeepCopyData.childDeepCopyData = aNewChildDeepCopyData;
        deepCopyDataList.push( newDeepCopyData );
    }

    return deepCopyDataList;
};
export default exports = {
    getInputForReviseReplace,
    getReviseReplaceInputInAceContext,
    getInputForItemRevision,
    getInputForReplaceRevision,
    getReviseInputsForParameters
};
