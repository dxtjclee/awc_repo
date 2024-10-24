//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * InterfacesShowIcons service populates the icons and data
 * in various columns of the Interfaces and Exchange Items table.
 *
 * @module js/Ase1InterfacesShowIcons
 */
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import _ from 'lodash';

/*
* Loads the 'viewToRender' view containing the icon and the link in the Table cell
*/
export let loadViewAndAppendIcon = function( viewToRender, vmo, containerElement, propName ) {
    let subPanelContext = {
        vmo: vmo,
        propName: propName
    };
    const props = {
        subPanelContext
    };
    let linkElement = includeComponent( viewToRender, props );
    if( containerElement ) {
        renderComponent( linkElement, containerElement );
        return containerElement;
    }
};

/*
* Loads the property Renderer component in the prop column of the Interfaces/Exchange Items Table
* The function is generic and works for both tables
*/
export let showInterfacesIconsRenderer = function( vmo, containerElement, propName ) {
    let _propertyToBeRendered = vmo.props && vmo.props[ propName ];
    if( _propertyToBeRendered ) {
    // if this is a DCP property, find the real property name, to be used as view to render
        const startPos = propName.lastIndexOf( '.' );
        const realPropName = startPos > -1 ? propName.slice( startPos + 1 ) : propName;
        let viewToRender = _.upperFirst( realPropName ) + 'Renderer';
        if( realPropName === 'ase1InterfaceAlignment' ) {
            viewToRender = 'Ase1AlignmentRenderer';
        }

        loadViewAndAppendIcon( viewToRender, vmo, containerElement, propName );
    }
};

/*
* Loads the property Renderer component in the prop column of the Interfaces/Exchange Items Table
* The function is generic and works for both tables
*/
export let showConnectionsTableIconsRenderer = function( vmo, containerElement, propName ) {
    let _propertyToBeRendered = vmo.props && vmo.props[ propName ] && vmo.props[ propName ].dbValue;
    if( _propertyToBeRendered ) {
        // if this is a DCP property, find the real property name, to be used as view to render
        const startPos = propName.lastIndexOf( '.' );
        const realPropName = startPos > -1 ? propName.slice( startPos + 1 ) : propName;
        let viewToRender = _.upperFirst( realPropName ) + 'Renderer';

        if( propName === 'REF(awb0End2,Awb0Element).REF(awb0Parent,Awb0Element).awb0UnderlyingObject' || propName === 'REF(awb0End1,Awb0Element).REF(awb0Parent,Awb0Element).awb0UnderlyingObject' ) {
            viewToRender = 'Ase1ComponentObjectRenderer';
        } else if( propName === 'REF(awb0End2,Awb0Interface).awb0UnderlyingObject' || propName === 'REF(awb0End1,Awb0Interface).awb0UnderlyingObject' ) {
            viewToRender = 'Ase1PortObjectRenderer';
        }

        loadViewAndAppendIcon( viewToRender, vmo, containerElement, propName );
    }
};

const exports = {
    loadViewAndAppendIcon,
    showInterfacesIconsRenderer,
    showConnectionsTableIconsRenderer
};

export default exports;
