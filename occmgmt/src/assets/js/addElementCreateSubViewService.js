// Copyright (c) 2021 Siemens
// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/addElementCreateSubViewService
 */
import AwWidget from 'viewmodel/AwWidgetViewModel';
import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';
import AwXrt from 'viewmodel/AwXrtViewModel';
import _ from 'lodash';

export const addElementCreateSubViewRenderFunction = ( props ) => {
    const {
        fields,
        addElementState,
        addPanelState,
        xrtState
    } = props;

    const xrtType = 'CREATE';
    const objectType = 'PSOccurrence';
    var currentVal = addElementState.areNumberOfElementsInRange;
    var numberOfElementsValueInRange =  _.isUndefined( fields.numberOfElements.error );
    var hasValueChanged = currentVal !== numberOfElementsValueInRange;

    if( hasValueChanged ) {
        var newAddElementState = { ...addElementState.value };
        newAddElementState.areNumberOfElementsInRange = numberOfElementsValueInRange;
        addElementState.update( newAddElementState );
    }

    var isNewTabSelected = _.isEqual( addPanelState.value.selectedTab.view, 'NewTabPageSub' );
    var isAwb0ElementSelected = addPanelState.value.sourceObjects !== null && addPanelState.value.sourceObjects.length > 0 && addPanelState.value.sourceObjects[0].modelType && addPanelState.value.sourceObjects[0].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1;
    var subPanelXrtApplicable = _.isEqual( isAwb0ElementSelected, false ) || isNewTabSelected;

    if( subPanelXrtApplicable ) {
        return (
            <AwPanelSection className='aw-occmgmt-elementPropPanel'>
                <AwWidget {...fields.numberOfElements}></AwWidget>
                <AwXrt type={xrtType} objectType={objectType} xrtState={xrtState}></AwXrt>
            </AwPanelSection>
        );
    }

    return (
        <AwPanelSection className='aw-occmgmt-elementPropPanel'>
            <AwWidget {...fields.numberOfElements}></AwWidget>
        </AwPanelSection>
    );
};
