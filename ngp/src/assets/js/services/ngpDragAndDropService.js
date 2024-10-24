// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for attaching files to an object.
 *
 * @module js/services/ngpDragAndDropService
 */

/**
 * The currently highlighted data which containts the
 * target element and the callback api to highlight
 */
 let currentlyHighlightedData;
 const VALID_TO_DROP_OBJECT = {
    dropEffect: 'link',
    preventDefault: true,
    stopPropagation: true
};
const INVALID_TO_DROP_OBJECT = {
    dropEffect: 'none',
    stopPropagation: true
};

 /**
  *
  * @param {DomElement} element - a given element
  * @returns {boolean} true if it is a table row element
  */
  function isTableRowObject( element ) {
     return element.classList.contains( 'ui-grid-row' );
 }

 /**
  *
  * @param {object} dropCallbackApis an object with callback apis
  * @param {DomElement} targetElement a target element
  */
 export function highlightValidTableRowDropTarget( dropCallbackApis, targetElement ) {
     if( isTableRowObject( targetElement ) ) {
         highlightValidTarget( dropCallbackApis, targetElement );
     }
 }

 /**
  *
  * @param {object} dropCallbackApis an object with callback apis
  * @param {DomElement} targetElement a target element
  */
 function highlightValidTarget( dropCallbackApis, targetElement ) {
     dropCallbackApis.highlightTarget( {
         isHighlightFlag: true,
         targetElement
     } );
     currentlyHighlightedData = {
         dropCallbackApis,
         targetElement
     };
 }

 /**
  * Clears the currently highlighted elmenet
  */
 export function clearCurrentlyHighlightedElement() {
     if( currentlyHighlightedData ) {
         const { targetElement, dropCallbackApis } = currentlyHighlightedData;
         if( targetElement && targetElement.parentElement && dropCallbackApis ) {
            dropCallbackApis.highlightTarget( {
                isHighlightFlag: false,
                targetElement
            } );
         }
     }
     currentlyHighlightedData = null;
 }

 /**
  *
  * @returns {object} the object which marks a valid drop target
  */
 export function getValidToDropReturnObject() {
    return VALID_TO_DROP_OBJECT;
 }

 /**
  *
  * @returns {object} the object which marks an invalid drop target
  */
 export function getInvalidToDropReturnObject() {
    return INVALID_TO_DROP_OBJECT;
}

  let exports;
  export default exports = {
     highlightValidTableRowDropTarget,
     clearCurrentlyHighlightedElement,
     getValidToDropReturnObject,
     getInvalidToDropReturnObject
  };

