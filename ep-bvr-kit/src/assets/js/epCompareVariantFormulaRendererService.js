// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * This module render formsheet header
 *
 * @module js/epCompareVariantFormulaRendererService
 */

/**
 * Variant formula html renderer
 *
 * @param {*} props props
 * @returns {JSX} html
 */
export function render( props ) {
    const formattedVariantFormula = props.variantFormula.replace( /\s+AND\s+|\s+OR\s+/g, '</br><span class=\'aw-epBalancingComparePanel-contentAndOr\'>$&</span>' );
    return (
        <div dangerouslySetInnerHTML={{ __html: formattedVariantFormula }}></div>
    );
}

export default {
    render
};
