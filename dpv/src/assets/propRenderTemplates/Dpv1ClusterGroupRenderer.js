// Copyright (c) 2023 Siemens

/**
 *
 * @module propRenderTemplates/Dpv1ClusterGroupRenderer
 */


var exports = {};

const CLASS_SPLM_TABLE_CELL = 'aw-splm-tableCellText';
const FONT_WT = 'font-weight';
const FONT_STYLE = 'font-style';

/**
 * This method highlighs in bold the table row representing second latest routine revision
 * @param {ViewModelObject} vmo the view model object of the table being used.
 * @param {HTMLElement} containerElement the direct HTML elements in the table to be modified.
 * @param {String} columnField which column's properties we want to modify.
 */
export let secondLatestRoutineRevRender = function( vmo, containerElement, columnField ) {
    var labelText = document.createElement( 'div' );
    labelText.textContent = vmo.props[ columnField ].uiValue;
    labelText.classList.add( CLASS_SPLM_TABLE_CELL );
    if( vmo.props.is2ndLatestRev && vmo.props.is2ndLatestRev.dbValue ) {
        labelText.style[ FONT_WT ] = 'bold';
        labelText.style[ FONT_STYLE ] = 'italic';
    }
    containerElement.appendChild( labelText );
};

/**
 * This method highlighs in bold the table rows which satisfy specific conditions related to cluster group revision
 * @param {ViewModelObject} vmo the view model object of the table being used.
 * @param {HTMLElement} containerElement the direct HTML elements in the table to be modified.
 * @param {String} columnField which column's properties we want to modify.
 */
export let clsGrpRevCurrRender = function( vmo, containerElement, columnField ) {
    var labelText = document.createElement( 'div' );
    labelText.textContent = vmo.props[ columnField ].uiValue;
    labelText.classList.add( CLASS_SPLM_TABLE_CELL );
    if( columnField === 'item_revision_id' && vmo.props.exclusiveInEitherRoutineRev && vmo.props.exclusiveInEitherRoutineRev.dbValue ) {
        labelText.textContent = '*' + labelText.textContent;
    }
    if( vmo.props.markClsGrpRev && vmo.props.markClsGrpRev.dbValue ) {
        labelText.style[ FONT_WT ] = 'bold';
        labelText.style[ FONT_STYLE ] = 'italic';
    }
    containerElement.appendChild( labelText );
};

/**
 * This method highlighs in bold the table rows which satisfy specific conditions related to cluster group revision
 * @param {ViewModelObject} vmo the view model object of the table being used.
 * @param {HTMLElement} containerElement the direct HTML elements in the table to be modified.
 * @param {String} columnField which column's properties we want to modify.
 */
export let clsGrpRevSelRender = function( vmo, containerElement, columnField ) {
    var labelText = document.createElement( 'div' );
    labelText.textContent = vmo.props[ columnField ].uiValue;
    labelText.classList.add( CLASS_SPLM_TABLE_CELL );
    if( vmo.props.exclusiveInSelRoutineRev && vmo.props.exclusiveInSelRoutineRev.dbValue ) {
        if( columnField === 'item_revision_id' && vmo.props.exclusiveInEitherRoutineRev && vmo.props.exclusiveInEitherRoutineRev.dbValue ) {
            labelText.textContent = '*' + labelText.textContent;
        }
        labelText.style[ FONT_WT ] = 'bold';
        labelText.style[ FONT_STYLE ] = 'italic';
    }
    if( vmo.props.markClsGrpRev && vmo.props.markClsGrpRev.dbValue ) {
        labelText.style[ FONT_WT ] = 'bold';
        labelText.style[ FONT_STYLE ] = 'italic';
    }
    containerElement.appendChild( labelText );
};

export default exports = {
    secondLatestRoutineRevRender,
    clsGrpRevCurrRender,
    clsGrpRevSelRender
};
