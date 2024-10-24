// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * Property Icon Renderer
 *
 * @module propRenderTemplates/Arm0PropertyIconRenderer
 */
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import _ from 'lodash';

let loadViewAndAppendIcon = function( viewToRender, vmo, containerElement, propName ) {
    const props = {
        subPanelContext: {
            vmo: vmo,
            propName: propName
        }
    };
    props.subPanelContext.vmo.iswrapped = false;
    if (containerElement.classList.contains('aw-splm-tableCellTopDynamic')) {
        // If it contains the class, add the flag iswrapped:true to vmo.props
        props.subPanelContext.vmo.iswrapped = true;
    }
    const componentElement = includeComponent( viewToRender, props );
    if( containerElement ) {
        renderComponent( componentElement, containerElement );
        return containerElement;
    }
};

/**
 * Generates DOM Element for input property
 * @param {Object} vmo ViewModelObject for which element config is being rendered
 * @param {Object} containerElement The container DOM Element inside which element config will be rendered
 * @param {String} propName property name to render for
 */
export let propertyIconRenderer = function( vmo, containerElement, propName ) {
    const _propertyToBeRendered = vmo.props && vmo.props[ propName ] && vmo.props[ propName ].dbValue;
    if( _propertyToBeRendered || propName === 'arm0TracelinkCount' ) {
        // if this is a DCP property, find the real property name, to be used as view to render
        const startPos = propName.lastIndexOf( '.' );
        const realPropName = startPos > -1 ? propName.slice( startPos + 1 ) : propName;
        const viewToRender = _.upperFirst( realPropName ) + 'Renderer';
        loadViewAndAppendIcon( viewToRender, vmo, containerElement, propName );
    }
};

/**
 * Generates DOM Element for input property
 * @param {Object} vmo ViewModelObject for which element config is being rendered
 * @param {Object} containerElement The container DOM Element inside which element config will be rendered
 * @param {String} propName property name to render for
 */
export let bodyClearTextPropertyIconRenderer = function( vmo, containerElement, propName ) {
    loadViewAndAppendIcon( 'Arm0BodyClearTextRenderer', vmo, containerElement, propName );
};

const exports = {
    propertyIconRenderer,
    bodyClearTextPropertyIconRenderer
};
export default exports;
