// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import mfeTableSvc from 'js/mfeTableService';
import _ from 'lodash';

/**
 * NGP Table Cell Render Service
 *
 * @module js/services/ngpTableCellRenderService
 */
'use strict';

/**
 * The opaque row render helper function sobjects
 */
const opaqueRowRendererHelperFunctions = {
    shouldCellBeOpaque( opaqueObjects, column, rowVMO ) {
        const obj = _.find( opaqueObjects, ( object ) => object.uid === rowVMO.uid );
        return Boolean( obj );
    },
    setOpaqueCells( column, vmo, tableElem, rowElem ) {
        if( rowElem ) {
            [ ...rowElem.childNodes ].forEach( ( child ) => child.classList.add( 'aw-widgets-partialVisibility' ) );
        }
    }
};

/**
 *
 * @param {string} imageUrl - the image url path
 * @param {DOMElement} parentElement - the parent element which should contain the cell
 * @param {string[]} classNames - class names to add
 * @return {DOMElement} the created element
 */
function createAndAppendIconCellElement( imageUrl, parentElement, classNames = [] ) {
    const cellImage = document.createElement( 'img' );
    cellImage.src = imageUrl;
    cellImage.classList.add( ...classNames );
    parentElement.appendChild( cellImage );
    return cellImage;
}

/**
 * @param {object[]} initialOpaqueRows - the initial opaque rows
 * @returns {object} the opaque row renderer object
 */
function getOpaqueRowCellRenderer( initialOpaqueRows = [] ) {
    const renderObj = mfeTableSvc.getRowRenderer( '', 'opaqueRowRenderer', opaqueRowRendererHelperFunctions.shouldCellBeOpaque.bind( this, initialOpaqueRows ), opaqueRowRendererHelperFunctions.setOpaqueCells );
    renderObj.updateOpaqueObjects = function( newOpaqueObjects = [] ) {
        this.condition = opaqueRowRendererHelperFunctions.shouldCellBeOpaque.bind( this, newOpaqueObjects );
    };
    return renderObj;
}

let exports = {};
export default exports = {
    createAndAppendIconCellElement,
    getOpaqueRowCellRenderer
};
