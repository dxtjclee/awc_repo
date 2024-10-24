// Copyright (c) 2023 Siemens

/**
 * @module js/mrlTargetClassesLOVService
 */

import _ from 'lodash';
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import mrmResourceGraphConstants from 'js/MrmResourceGraphConstants';

var exports = {};

/**
 * render function for AwLovEdit
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const targetClassesLOVRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.targetClassesOptionListDataProvider;

    const passedProps = { ...prop,  fielddata };


    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

export let getTargetClassesOptionList = function( vmo, doNotMapOptionStr ) {
    var lovEntries = [];

    let tcDonotMapEntry = {
        propDisplayValue: doNotMapOptionStr,
        propInternalValue: mrmResourceGraphConstants.MRMResourceGraphConstants.MRLDoNotMapOption
    };

    var targetClassesList = vmo.props.targetClass.allTargetClasses;

    lovEntries.push( tcDonotMapEntry );

    _.forEach( targetClassesList, function( targetClass ) {
        let tc = {
            propDisplayValue: targetClass.targetClassID + ' - ' + targetClass.targetClassName,
            propInternalValue: targetClass.targetClassID
        };
        lovEntries.push( tc );
    } );

    return {
        targetClassesOptionList : lovEntries,
        moreValuesExist : false
    };
};


export let startEditTargetClasses = function( ) {
    return;
};

export let saveEditedTargetClasses = function() {
    return Promise.resolve();
};

export default exports = {
    targetClassesLOVRenderFunction,
    getTargetClassesOptionList,
    saveEditedTargetClasses,
    startEditTargetClasses
};
