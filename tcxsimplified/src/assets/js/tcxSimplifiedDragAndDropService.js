// Copyright (c) 2022 Siemens

/**
 * Service to drag and drop on cells
 *
 * @module js/tcxSimplifiedDragAndDropService
 */

import _ from 'lodash';
let exports = {};

/**
    * dragOverTreeTable
    * @return {Object} the object with dropEffect
*/
export let dragOverTreeTable = () => {
    return {
        dropEffect: 'none',
        stopPropagation: true
    };
};

/**
    * dropOnTreeTable
    * @return {Object} the object with dropEffect
    */
export const dropOnTreeTable = () => {
    return {
        dragEffect: 'none',
        stopPropagation: true
    };
};

export default exports = {
    dropOnTreeTable,
    dragOverTreeTable
};

