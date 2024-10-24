// Copyright (c) 2022 Siemens
/* eslint-disable no-undef */

/**
 * @module js/Att1MeasurementService
 */
import eventBus from 'js/eventBus';
import complexDataService from 'js/Att1ComplexDataService';
import engrTableService from 'js/Att1EngrTableService';
import _ from 'lodash';
var exports = {};

/**
 * Method to add a measure value
 * @param action Action to be performed: add new measure vale/copy from goal
 */
export let addMeasureValue = function( action ) {
    eventBus.publish( 'Att1MeasurementsService.createMeasurement', { operation: action } );
};

export let reloadMeasurementsTable = function() {
    // when measurement attachment file is added, measurements table needs to be refreshed after a timeout so that the new attachment/dataset is seen in table
    callEventAfterTimeout( 'MeasurementsTable.plTable.reload' );
};

function callEventAfterTimeout( eventName, eventData ) {
    setTimeout( () => {
        if( eventData ) {
            eventBus.publish( eventName, eventData );
        } else {
            eventBus.publish( eventName );
        }
    }, 500 );
}
export let getUpdateParameters2Input = function( data, subPanelContext ) {
    var operation = data.eventMap[ 'Att1MeasurementsService.createMeasurement' ].operation;
    var inputs = [];
    var valueTable = {
        toCreate: true,
        measureValue: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        valueTableInput: {
            operation: operation,
            fileTicket: '',
            jsonString: ''
        }
    };
    var complexDataInput = {
        clientId: 'AWClient',
        parameters: [ {
            clientId: 'Parameters',
            parameter: complexDataService.getSelectedParameterObject( subPanelContext ),
            goalTableInput: {},
            valueInputs: [ valueTable ]
        } ]
    };
    inputs.push( complexDataInput );
    return inputs;
};

/**
 * Method to select the first element int he measurements table
 * @param {DataProvider} uwDataProvider the table data provider
 */
export let selectFirstElement = function( uwDataProvider ) {
    if( uwDataProvider ) {
        var selModel = uwDataProvider.selectionModel;
        var vmObjects = uwDataProvider.viewModelCollection.loadedVMObjects;
        if( vmObjects && vmObjects.length > 0 ) {
            selModel.setSelection( vmObjects[ 0 ] );
        }
    }
};

/**
 *
 * @param {Object} data the view model object
 */
export let initializeMeasurementTable = function( data, subPanelContext ) {
    engrTableService.attachLeavePlaceHandler( subPanelContext, data );
    if( subPanelContext.parametersTable && subPanelContext.parametersTable.isParameterWidePanelOpen ) {
        let selectedParam = data.subPanelContext.parametersTable.selectedObjects[0];

        let propertyDisplayNames = {
            Goal: selectedParam.props['REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Goal'].propertyDisplayName,
            Max: selectedParam.props['REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max'].propertyDisplayName,
            Min: selectedParam.props['REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min'].propertyDisplayName,
            Measurement: selectedParam.props['REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value'].propertyDisplayName
        };
        var isShowGMMProps = _.clone( data.isShowGMMProps );
        var goalPropValue = _.clone( data.goalPropValue );
        var minPropValue = _.clone( data.minPropValue );
        var maxPropValue = _.clone( data.maxPropValue );
        var isShowChart = data.isShowChart !== undefined ? data.isShowChart : subPanelContext.parametersTable.isShowChart;
        var isShowValuesTable = data.isShowValuesTable !== undefined ? data.isShowValuesTable : subPanelContext.parametersTable.isShowValuesTable;
        if( isShowChart === undefined && isShowValuesTable === undefined ) {
            isShowValuesTable = true;
            isShowChart = false;
        }
        var isPlotCommandClicked = subPanelContext.parametersTable.plotChartCommandClicked;
        var selectedParameters = complexDataService.getSelectedParameterObject( subPanelContext );
        var parameterName = '';
        if( selectedParameters ) {
            parameterName = selectedParameters.props.object_name.uiValues[ 0 ];

            var attrTableProp = selectedParameters.props.att0AttributeTable;
            if( attrTableProp && attrTableProp.dbValues[ 0 ] === undefined ||
                attrTableProp.dbValues[ 0 ] === null ||
                attrTableProp.dbValues[ 0 ] === '' ) {
                isShowGMMProps = true;
                goalPropValue = selectedParameters.props.att0Goal.uiValues[ 0 ];
                minPropValue = selectedParameters.props.att0Min.uiValues[ 0 ];
                maxPropValue = selectedParameters.props.att0Max.uiValues[ 0 ];
            } else{
                isShowGMMProps = false;
            }
        }
        return {
            isShowGMMProps: isShowGMMProps,
            goalPropValue: goalPropValue,
            minPropValue: minPropValue,
            maxPropValue: maxPropValue,
            isShowChart:isShowChart,
            isShowValuesTable:isShowValuesTable,
            isPlotCommandClicked : isPlotCommandClicked,
            chartTitle:parameterName,
            propertyDisplayNames: propertyDisplayNames
        };
    }

    return {
        isShowChart:false,
        isShowValuesTable:true
    };
};

export let getMeasurementsTableClientScopeUri = function( subPanelContext ) {
    var selected = complexDataService.getSelectedParameterObject( subPanelContext );
    var clientScopeUri = 'Att1MeasurementsTableStr';
    if( selected && selected.modelType ) {
        var typeHierarchyArray = selected.modelType.typeHierarchyArray;
        if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributePnt' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTablePnt';
        } else if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributeDbl' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTableDbl';
        } else if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributeInt' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTableInt';
        } else if( typeHierarchyArray.indexOf( 'Att0MeasurableAttributeBool' ) > -1 ) {
            clientScopeUri = 'Att1MeasurementsTableBool';
        }
    }
    return clientScopeUri;
};
export let getSelectedObjectUid = function( subPanelContext ) {
    var selectedParameter = complexDataService.getSelectedParameterObject( subPanelContext );
    if( selectedParameter ) {
        return selectedParameter.uid;
    }
};

export let updateTabData = function( data ) {
    var objectName = '';
    var isPlotCommandClicked = false;
    if( data.eventData.selectedParameter[0] && data.eventData.selectedParameter[0].props && data.eventData.selectedParameter[0].props.att0AttributeTable ) {
        var isSelectedParameterContainsComplexData = data.eventData.selectedParameter[0].props.att0AttributeTable.dbValues[0];
        if( isSelectedParameterContainsComplexData !== null && isSelectedParameterContainsComplexData !== undefined && isSelectedParameterContainsComplexData !== '' ) {
            isPlotCommandClicked = true;
        }
        objectName = data.eventData.selectedParameter[ 0 ].props.object_name.uiValues[ 0 ];
    }
    eventBus.publish( 'MeasurementsTable.plTable.reload', { selectedObject: data.eventData.selectedParameter } );
    return{
        isPlotCommandClicked:isPlotCommandClicked,
        chartTitle:objectName
    };
};

export let updateCtxDeleteAttachedFile = function( datasetObject, engrTable ) {
    if( engrTable && engrTable.measurementTable ) {
        engrTable.measurementTable.selectedMeasurementDatasetUid = datasetObject.uid;
        engrTable.measurementTable.selectedMeasurementDatasetType = datasetObject.type;
        eventBus.publish( 'Att1MeasurementsView.deleteAttachedFile' );
    }
};
export let removeAttachedFileContents = function( data ) {
    let cellImg = data.eventMap['Att1MeasurementsView.updateCtxDeleteAttachedFile'].targetEle;
    cellImg.parentElement.innerHTML = '';
};

export let hideChartView = function() {
    return {
        isShowValuesTable : true,
        isShowChart : false
    };
};

export let hideValuesTableView = function( data ) {
    return {
        isShowValuesTable : false,
        isShowChart : true
    };
};

export let showValuesTableAndChartView = function( data ) {
    return {
        isShowValuesTable : true,
        isShowChart : true
    };
};

export default exports = {
    addMeasureValue,
    initializeMeasurementTable,
    getMeasurementsTableClientScopeUri,
    getSelectedObjectUid,
    selectFirstElement,
    getUpdateParameters2Input,
    updateTabData,
    updateCtxDeleteAttachedFile,
    reloadMeasurementsTable,
    removeAttachedFileContents,
    hideChartView,
    hideValuesTableView,
    showValuesTableAndChartView
};
