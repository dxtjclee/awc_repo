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
 * @module js/Aqc0ExpandOptionService
 */
import _ from 'lodash';
import AwWidget from 'viewmodel/AwWidgetViewModel';
import { AwServerVisibilityPopupCommandBar } from 'js/AwServerVisibilityCommandBarService';
import AwPopup2 from 'viewmodel/AwPopup2ViewModel';
import appCtxService from 'js/appCtxService';

var exports = {};

export const Aqc0ExpandOptionsRenderFunction = ( props ) => {
    const {
        viewModel,
        actions,
        fields
    } = props;

    let { subPanelContext } = viewModel;
    const anchorValue = 'Aqc0Expand';
    const keyPressed = function( event, actions ) {
        if( event.key === 'Enter' ) {
            event.preventDefault();
            actions.performExpandToLevel();
        }
    };

    return (
        <div className='aw-apqp-expand'>
            <AwPopup2>
                <AwServerVisibilityPopupCommandBar
                    anchor={anchorValue}
                    context={subPanelContext.context} >
                </AwServerVisibilityPopupCommandBar>
                <AwWidget className='aw-apqp-expandToLevelInput' onKeyDown={( event ) => keyPressed( event, actions )} {...fields.expansionLevel}></AwWidget>
            </AwPopup2>
        </div>
    );
};
export default exports = {
    Aqc0ExpandOptionsRenderFunction
};
