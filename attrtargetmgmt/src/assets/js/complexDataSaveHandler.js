// Copyright (c) 2022 Siemens

/**
 * This is the command handler for save edit in attribute system modeler
 *
 * @module js/complexDataSaveHandler
 */
import editHandlerSvc from 'js/editHandlerService';
import messagingSvc from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import dms from 'soa/dataManagementService';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';

var exports = {};

var saveHandler = {};
var eventDef = null;

export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * Update tableComplexDataRows
 * @param {Object} cellData
 * @param {Object} table
 * @returns {Object} table
 */
function _tableComplexDataRows( vmo, cellData, table ) {
    if( cellData.length > 0 ) {
        table.complexData.rows.push( {
            index: vmo.id,
            cells: cellData
        } );
    }

    return table;
}

var updateTable = function( vmo, vmProps, table ) {
    if( vmo.id === 0 ) {
        for( var j = 0; j < vmProps.length; j++ ) {
            if( vmProps[ j ].colId !== 0 ) {
                table.complexData.columnHeaders.push( {
                    index: vmProps[ j ].colId,
                    name: vmProps[ j ].dbValues[ 0 ]
                } );
            }
        }
    } else {
        var cellData = [];
        var xrtObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
        for( var j = 0; j < vmProps.length; j++ ) {
            if( vmProps[ j ].colId === 0 ) {
                table.complexData.rowHeaders.push( {
                    index: vmo.id,
                    name: vmProps[ j ].dbValues[ 0 ]
                } );
            } else {
                if( xrtObject.modelType.typeHierarchyArray.indexOf( 'Att0AttributeDefRevision' ) > -1 && xrtObject.props.att0AttrType.dbValues[ 0 ] === 'Boolean' ||
                    xrtObject.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttributeBool' ) > -1 ) {
                    if( vmProps[ j ].dbValues[ 0 ] === false ) {
                        cellData.push( {
                            index: vmProps[ j ].colId,
                            data: '0'
                        } );
                    } else {
                        cellData.push( {
                            index: vmProps[ j ].colId,
                            data: '1'
                        } );
                    }
                } else {
                    cellData.push( {
                        index: vmProps[ j ].colId,
                        data: vmProps[ j ].dbValues[ 0 ]
                    } );
                }
            }
        }

        _tableComplexDataRows( vmo, cellData, table );
    }
};

var checkIfAttrUpdated = function( obj ) {
    for( var idx = 0; idx < obj.length; ++idx ) {
        if( cmm.isInstanceOf( 'Att0MeasurableAttribute', obj[ idx ].modelType ) || cmm.isInstanceOf( 'Att0AttributeDefRevision', obj[ idx ].modelType ) ) {
            return true;
        }
    }
    return false;
};

/**
 * get eventDef when XrtModified
 * @param {Object} eventData
 * @param {Object} xrtObject
 * @param {Object} eventDef
 * @returns eventDef
 */
function afterXrtModifiedGetEventDef( eventData, xrtObject, eventDef ) {
    if( checkIfAttrUpdated( eventData.updatedObjects ) ) {
        eventBus.publish( 'cdm.relatedModified', {
            refreshLocationFlag: true,
            relations: '',
            relatedModified: [ xrtObject ],
            createdObjects: []
        } );
        if( eventDef ) {
            eventBus.unsubscribe( eventDef );
            eventDef = null;
        }
    }

    return eventDef;
}

/**
 * get eventDef when TableModified
 * @param {Object} xrtObject
 * @param {Object} eventDef
 * @returns eventDef
 */
function afterTableModifiedGetEventDef( xrtObject, eventDef ) {
    eventBus.publish( 'cdm.relatedModified', {
        refreshLocationFlag: true,
        relations: '',
        relatedModified: [ xrtObject ],
        createdObjects: []
    } );
    if( eventDef ) {
        eventBus.unsubscribe( eventDef );
        eventDef = null;
    }

    return eventDef;
}

/**
 * get att0GoalTable
 * @param {Object} att0GoalTable
 * @return att0GoalTable
 */
function _getAtt0GoalTable( att0GoalTable ) {
    if( !att0GoalTable ) {
        att0GoalTable = [ {
            operation: 'Update',
            complexData: {
                columnHeaders: [],
                rowHeaders: [],
                rows: []
            }
        } ];
    }
    return att0GoalTable;
}

/**
 * get att0MinTable
 * @param {Object} att0MinTable
 * @return att0MinTable
 */
function _getAtt0MinTable( att0MinTable ) {
    if( !att0MinTable ) {
        att0MinTable = [ {
            operation: 'Update',
            complexData: {
                columnHeaders: [],
                rowHeaders: [],
                rows: []
            }
        } ];
    }
    return att0MinTable;
}

/**
 * get Att0MaxTable
 * @param {Object} att0MaxTable
 * @return att0MaxTable
 */
function _getAtt0MaxTable( att0MaxTable ) {
    if( !att0MaxTable ) {
        att0MaxTable = [ {
            operation: 'Update',
            complexData: {
                columnHeaders: [],
                rowHeaders: [],
                rows: []
            }
        } ];
    }
    return att0MaxTable;
}

/**
 * get att0ValueTable
 * @param {Object} att0ValueTable
 * @return att0ValueTable
 */
function _getAtt0ValueTable( att0ValueTable ) {
    if( !att0ValueTable ) {
        att0ValueTable = [ {
            operation: 'Update',
            complexData: {
                columnHeaders: [],
                rowHeaders: [],
                rows: []
            }
        } ];
    }
    return att0ValueTable;
}

/**
 *
 * @param {Object} inputs
 * @param {Object} soaInput
 * @param {Object} complexDataInput
 *  @param {Object} isTableModified
 * @returns isXrtModified
 */
function _isXrtModified( inputs, soaInput, complexDataInput, isTableModified, isXrtModified ) {
    if( inputs.length > 0 ) {
        for( var i = 0; i < inputs.length; i++ ) {
            if( inputs[ i ].obj.modelType ) {
                soaInput.push( inputs[ i ] );
                isXrtModified = true;
            }
        }
    }
    if( !isXrtModified && isTableModified ) {
        soaSvc.post( 'AttrTargetMgmt-2018-06-AttributeTargetManagement', 'setAttributeComplexData', {
            inputs: complexDataInput
        } )
            .then(
                function( response ) {
                    if( response ) {
                        eventBus.publish( 'Att1ParametersWidePanel.refreshParameters' );
                    }
                } );
    }

    return isXrtModified;
}

/**
 * SOA call for saveViewModelEditAndSubmitWorkflow
 * @param {Object} eventDef
 */
function saveViewModelEditAndSubmitWorkflow( eventDef, soaInput, complexDataInput, isTableModified ) {
    if( soaInput.length > 0 ) {
        var deffer = AwPromiseService.instance.defer();
        var promise = dms.saveViewModelEditAndSubmitWorkflow( soaInput );
        promise.then( function( response ) {
            if( eventDef ) {
                eventBus.unsubscribe( eventDef );
                eventDef = null;
            }

            if( response ) {
                if( isTableModified ) {
                    soaSvc.post( 'AttrTargetMgmt-2018-06-AttributeTargetManagement', 'setAttributeComplexData', {
                        inputs: complexDataInput
                    } );
                }

                var error = null;
                if( response.partialErrors || response.PartialErrors ) {
                    error = soaSvc.createError( response );
                } else if( response.ServiceData && response.ServiceData.partialErrors ) {
                    error = soaSvc.createError( response.ServiceData );
                }

                if( error ) {
                    var errMessage = messagingSvc.getSOAErrorMessage( error );

                    messagingSvc.showError( errMessage );

                    editHandlerSvc.saveEditsPostActions( false );
                    return AwPromiseService.instance.reject( error );
                }
            }

            deffer.resolve();
        } )
            .catch( function( error ) {
                deffer.reject( error );
            } );

        return deffer.promise;
    }
}

saveHandler.saveEdits = function( datasource, inputs ) {
    var xrtObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
    var isTableModified = false;
    var isXrtModified = false;
    var soaInput = [];
    if( !eventDef ) {
        eventDef = eventBus.subscribe( 'cdm.updated', function( eventData ) {
            if( isXrtModified ) {
                eventDef = afterXrtModifiedGetEventDef( eventData, xrtObject, eventDef );
            } else if( isTableModified ) {
                eventDef = afterTableModifiedGetEventDef( xrtObject, eventDef );
            }
        } );
    }
    var modifiedViewModelProperties = datasource.getAllModifiedProperties();
    var modifiedPropsMap = datasource.getModifiedPropertiesMap( modifiedViewModelProperties );
    var complexDataInput = [];
    complexDataInput.push( {
        clientId: 'AWClient',
        isProceedWithValidationError: false,
        objectToModify: xrtObject,
        propNameToTableDataMap: {},
        propNameToMeasurementTableDataMap: {}
    } );
    for( var uid in modifiedPropsMap ) {
        if( modifiedPropsMap.hasOwnProperty( uid ) ) {
            if( modifiedPropsMap[ uid ].viewModelObject.tableName === 'att0GoalTable' ) {
                isTableModified = true;

                complexDataInput[ 0 ].propNameToTableDataMap.att0GoalTable = _getAtt0GoalTable( complexDataInput[ 0 ].propNameToTableDataMap.att0GoalTable );
                updateTable( modifiedPropsMap[ uid ].viewModelObject, modifiedPropsMap[ uid ].viewModelProps, complexDataInput[ 0 ].propNameToTableDataMap.att0GoalTable[ 0 ] );
            } else if( modifiedPropsMap[ uid ].viewModelObject.tableName === 'att0MinTable' ) {
                isTableModified = true;

                complexDataInput[ 0 ].propNameToTableDataMap.att0MinTable = _getAtt0MinTable( complexDataInput[ 0 ].propNameToTableDataMap.att0MinTable );
                updateTable( modifiedPropsMap[ uid ].viewModelObject, modifiedPropsMap[ uid ].viewModelProps, complexDataInput[ 0 ].propNameToTableDataMap.att0MinTable[ 0 ] );
            } else if( modifiedPropsMap[ uid ].viewModelObject.tableName === 'att0MaxTable' ) {
                isTableModified = true;

                complexDataInput[ 0 ].propNameToTableDataMap.att0MaxTable = _getAtt0MaxTable( complexDataInput[ 0 ].propNameToTableDataMap.att0MaxTable );
                updateTable( modifiedPropsMap[ uid ].viewModelObject, modifiedPropsMap[ uid ].viewModelProps, complexDataInput[ 0 ].propNameToTableDataMap.att0MaxTable[ 0 ] );
            } else if( modifiedPropsMap[ uid ].viewModelObject.tableName === 'att0ValueTable' ) {
                isTableModified = true;

                complexDataInput[ 0 ].propNameToMeasurementTableDataMap.att0ValueTable = _getAtt0ValueTable( complexDataInput[ 0 ].propNameToMeasurementTableDataMap.att0ValueTable );
                updateTable( modifiedPropsMap[ uid ].viewModelObject, modifiedPropsMap[ uid ].viewModelProps, complexDataInput[ 0 ].propNameToMeasurementTableDataMap.att0ValueTable[ 0 ] );
            }
        }
    }

    _isXrtModified( inputs, soaInput, complexDataInput, isTableModified, isXrtModified );

    saveViewModelEditAndSubmitWorkflow( eventDef, soaInput, complexDataInput, isTableModified );
};

saveHandler.isDirty = function() {
    return true;
};

export default exports = {
    getSaveHandler
};
