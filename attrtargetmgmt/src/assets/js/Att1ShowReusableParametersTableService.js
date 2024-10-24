// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ShowReusableParametersTableService
 */
import _ from 'lodash';
import columnArrangeService from 'js/columnArrangeService';

var exports = {};

/**
 * Synchronize the selection of parameters
 *
 * @param {Object} uwDataProvider The Data Provider object
 */
export let setReusableTableFlagsForWidePanel = function( eventData, parametersTable ) {
    let parametersTableCtx = { ...parametersTable.value };
    if( eventData && eventData.name ) {
        if( eventData.name === 'addNewTableValueCommandClicked' ) {
            parametersTableCtx.addNewTableValueCommandClicked = eventData.value;
            parametersTableCtx.isComplexDataImportInProgress = undefined;
            parametersTableCtx.manageMeasurementsCommandClicked = undefined;
            parametersTableCtx.isParameterWidePanelOpen = true;
        } else if( eventData.name === 'isComplexDataImportInProgress' ) {
            parametersTableCtx.isComplexDataImportInProgress = eventData.value;
            parametersTableCtx.addNewTableValueCommandClicked = undefined;
            parametersTableCtx.manageMeasurementsCommandClicked = undefined;
            parametersTableCtx.invokeSelectiondialog = true;
        } else if( eventData.name === 'manageMeasurementsCommandClicked' ) {
            parametersTableCtx.manageMeasurementsCommandClicked = eventData.value;
            parametersTableCtx.isComplexDataImportInProgress = undefined;
            parametersTableCtx.addNewTableValueCommandClicked = undefined;
            parametersTableCtx.isParameterWidePanelOpen = true;
        } else if( eventData.name === 'plotChartCommandClicked' ) {
            parametersTableCtx.manageMeasurementsCommandClicked = undefined;
            parametersTableCtx.isComplexDataImportInProgress = undefined;
            parametersTableCtx.addNewTableValueCommandClicked = undefined;
            parametersTableCtx.plotChartCommandClicked = eventData.value;
            parametersTableCtx.isShowValuesTable = false;
            parametersTableCtx.isShowChart = true;
            parametersTableCtx.isParameterWidePanelOpen = true;
        }
    }else{
        parametersTableCtx.isParameterWidePanelOpen = true;
    }
    if( eventData && eventData.isShowMeasurementTab ) {
        parametersTableCtx.isShowValuesTable = true;
        parametersTableCtx.isShowChart = false;
    }
    parametersTable.update( parametersTableCtx );
};

export let displayMultiselectParameters = function( commandContext  ) {
    if ( commandContext.showCheckBox && commandContext.showCheckBox.update ) {
        commandContext.showCheckBox.update( !commandContext.showCheckBox.value );
    }
};

/**
  * Returns the Att1ShowReusableParametersTableService instance
  */
export default exports = {
    displayMultiselectParameters,
    setReusableTableFlagsForWidePanel
};
