// Copyright (c) 2022 Siemens

/**
 * @module js/Evm1PropertyRenderer
 */
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';

let exports = {};

let _loadViewAndAppendIcon = function( viewToRender, vmo, containerElement, propName ) {
    let subPanelContextForTooltipWithPropertyOverride = {
        treeNodeUid: vmo.uid,
        isEnabled: vmo.props[ propName ].isEnabled,
        dbValue: vmo.props[ propName ].dbValue
    };
    let subPanelContext = {
        subPanelContextForTooltipWithPropertyOverride
    };
    let extendedTooltipElement = includeComponent( viewToRender, subPanelContext );

    if( containerElement ) {
        renderComponent( extendedTooltipElement, containerElement );
        return containerElement;
    }
};

/**
 * Generates DOM Element for evm1Include
 * @param {Object} vmo - ViewModelObject for which element config is being rendered
 * @param {Object} containerElem - The container DOM Element inside which element config will be rendered
 * @param {String} propName - the name of property to render
 */
export let propertyRendererFunc = function( vmo, containerElem, propName ) {
    let _propertyToBeRendered = vmo.props && vmo.props[ propName ];
    let viewToRender = propName + 'Renderer';

    if( _propertyToBeRendered ) {
        _loadViewAndAppendIcon( viewToRender, vmo, containerElem, propName );
    }
};

export default exports = {
    propertyRendererFunc
};
