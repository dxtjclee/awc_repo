// Copyright (c) 2022 Siemens

/**
 * @module js/Att1AssociateParamDictonariesService
 */
import adapterSvc from 'js/adapterService';

var exports = {};

export let setTargetObject = function( selectedObj ) {
    var targetObj;
    if( selectedObj ) {
        if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Att0ParamProject' ) > -1 || selectedObj.modelType.typeHierarchyArray.indexOf( 'Att0ParameterPrjRevision' ) > -1 ) {
            targetObj = selectedObj;
        } else if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Att1ParameterPrjElement' ) > -1 ) {
            var targetObjs = adapterSvc.getAdaptedObjectsSync( [ selectedObj ] );
            targetObj = targetObjs[ 0 ];
        }
    }
    var addObjectData = {
        target: targetObj
    };
    return { ...addObjectData };
};

/**
 * Returns the Att1AssociateParamDictonariesService instance
 *
 * @member Att1AssociateParamDictonariesService
 */

export default exports = {
    setTargetObject
};
