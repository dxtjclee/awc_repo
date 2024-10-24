
// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import { svgString as cloneColumnHeaderImg } from 'image/miscTableHeaderClone16.svg';
import { svgString as masterColumnHeaderImg } from 'image/miscTableHeaderIsMasterOfClone16.svg';
import { svgString as externalDependenciesColumnHeaderImg } from 'image/miscTableHeaderHasExternalDependencies16.svg';
import { svgString as externalSuccessorsColumnHeaderImg } from 'image/miscTableHeaderHasExternalSuccessors16.svg';
import { svgString as mismatchColumnHeaderImg } from 'image/miscTableHeaderMismatch16.svg';
import { svgString as inContextAgsColumnHeader } from 'image/miscTableHeaderHasAttributeGroup16.svg';
import { svgString as completionColumnHeaderImg } from 'image/miscTableHeaderCompletion16.svg';
import { convertToHtml } from 'js/reactHelper';

/**
 * NGP table column header render service
 *
 * @module js/services/ngpTableColumnHeaderRenderService
 */
'use strict';

/**
 *
 * @param {object} column - the column object
 * @returns {Html} a html element
 */
export function tableColumnHeaderRenderFn( { column } ) {
    let image;
    switch ( column.field ) {
        case 'CloneStatus':
            image = cloneColumnHeaderImg;
            break;
        case 'MasterStatus':
            image = masterColumnHeaderImg;
            break;
        case 'hasDependency':
            image = externalDependenciesColumnHeaderImg;
            break;
        case 'successorDependency':
            image = externalSuccessorsColumnHeaderImg;
            break;
        case 'mismatchOrMissing':
        case 'MismatchStatus':
            image = mismatchColumnHeaderImg;
            break;
        case 'AssignmentInContextAttributeGroups':
            image = inContextAgsColumnHeader;
            break;
        case 'assignmentIndication':
            image = completionColumnHeaderImg;
            break;
    }
    return image ?
        <span className='aw-visual-indicator' title={column.displayName}>{convertToHtml( image )}</span>
        :
        <> {column.displayName} </>;
}

let exports = {};
export default exports = {
    tableColumnHeaderRenderFn
};
