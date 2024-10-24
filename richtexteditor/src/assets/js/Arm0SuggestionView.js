// Copyright (c) 2022 Siemens

/**
 * This Plugin is for enhancing the OOTB suggestion view to AW Standard.
 *
 * @module js/Arm0SuggestionView
 */
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import ckEditor5Utils from 'js/ckEditor5Utils';

export default class NewSuggestionThreadView extends ckeditor5ServiceInstance.SuggestionThreadView {
    constructor( ...args ) {
        super( ...args );
        this.getTemplate();
    }

    render() {
        super.render();
        let suggestionId = this.element.getAttribute( 'data-suggestion-id' );
        const isContentEditable = _checkContentEditable( suggestionId );
        this.isEnabled = isContentEditable;
        // If user does not have access to edit requirement content then disabling suggestion should be sufficient as per above line
        // but its not disabling accept and discard command hence hiding both commands for now
        this.acceptButton.isVisible = isContentEditable;
        this.discardButton.isVisible = isContentEditable;
    }
}

let _checkContentEditable = function( suggestionId ) {
    const trackChangeEditableMap = ckEditor5Utils.getTrackChangesEditableMap();
    if( suggestionId && trackChangeEditableMap && trackChangeEditableMap.get( suggestionId ) && trackChangeEditableMap.get( suggestionId ) === 'false' ) {
        return false;
    }
    return true;
};
