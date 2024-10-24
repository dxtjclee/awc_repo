import eventBus from 'js/eventBus';

/**
 * Ckeditor Configuration provider
 * @module js/rmCkeReuseToolIntegration/patternAssistHandler
 */

var autoCompleteList =
    [

    ];

var fromSoa = true;

/**
 * function to allow attributes in <div> tag
 * @param {Object} list - ckeditor instance
 */
export function updateAutocompleteList( value ) {
    fromSoa = value;
    if( !value ) {
        autoCompleteList = [];
    }
}

/**
 * function to allow attributes in <div> tag
 * @param {Object} editor - ckeditor instance
 */
export function getAutoCompleteItems( queryText ) {
     // As an example of an asynchronous action, return a promise
    // that resolves after a 100ms timeout.
    // This can be a server request or any sort of delayed action.
    return new Promise( resolve => {
        if( fromSoa ) {
            eventBus.publish( 'Arm0ReqPatternStructure.getNextElementTerms', function( items ) {
                if( items.length > 0 ) {
                    autoCompleteList = items;
                    const itemsToDisplay = autoCompleteList.filter( isItemMatching );
                    itemsToDisplay.forEach( item => {
                        item.id = item.id.toLowerCase();
                    } );
                    fromSoa = false;
                    resolve( itemsToDisplay );
                } else {
                    const itemsToDisplay = autoCompleteList.filter( isItemMatching );
                    resolve( itemsToDisplay );
                }
            } );
        } else {
            var filteredList = autoCompleteList.filter( isItemMatching );
            filteredList.forEach( item => {
                item.id = item.id.toLowerCase();
            } );
            resolve( filteredList );
        }
    } );


    /**
 * function to allow attributes in <div> tag
 * @param {Object} item - ckeditor instance
 */
    function isItemMatching( item ) {
        // Make the search case-insensitive.
        const searchString = queryText.toLowerCase();

        // Include an item in the search results if the name or username includes the current user input.
        return (
            item.id.trim().toLowerCase().startsWith( searchString )
        );
    }
}


