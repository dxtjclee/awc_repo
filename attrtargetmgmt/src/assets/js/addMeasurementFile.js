// Copyright (c) 2022 Siemens

/**
 * @module js/addMeasurementFile
 */
import cdm from 'soa/kernel/clientDataModel';

var exports = {};

export let initAddFilePanelTypes = function( subPanelContext ) {
    var selectedParameter;
    var openedObject;
    var measureObj = null;

    //getValue fetch the latest value of the context.
    //This could be issue in Framework due to which the subPanleContext passed to wide panel does not get updated whn original context updated from outside
    //calling getValue function gets the udpated value
    if( subPanelContext.parametersTable && subPanelContext.parametersTable.getValue().selectedUnderlyingObjects ) {
        openedObject = subPanelContext.parametersTable.getValue().selectedUnderlyingObjects[ 0 ];
    } else {
        openedObject = subPanelContext.openedObject;
    }
    if( openedObject && openedObject.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
        selectedParameter = openedObject;
        if( subPanelContext && subPanelContext.engrTable && subPanelContext.engrTable.measurementTable ) {
            measureObj = subPanelContext.engrTable.measurementTable.selectedMeasurement;
        }else if( selectedParameter && selectedParameter.props && selectedParameter.props.att0CurrentValue ) {
            var measureObjUid = selectedParameter.props.att0CurrentValue.dbValues[ 0 ];
            measureObj = cdm.getObject( measureObjUid );
        }
    }

    var addValueFile;
    if( measureObj ) {
        var relationMap = {};
        relationMap.Dataset = [ 'Att0HasMeasurementFile' ];

        addValueFile = {
            relationMap: relationMap,
            target: measureObj
        };
    }
    return { ...addValueFile };
};

export default exports = {
    initAddFilePanelTypes
};
