//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/**
 * Plugin will Allow user to copy the cross reference link to clipboard
 */

import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import RequirementWidgetUtil from 'js/rmCkeRequirementWidget/requirementWidgetUtil';

let eventToHandleClickOnCrossReferenceLink;

export default class RMCrossReferenceLink extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        editor.ui.componentFactory.add( 'rmCrossReferenceLink', new RMCrossReferenceLink( editor ) );
        let viewDocument = editor.editing.view.document;

        editor.listenTo( viewDocument, 'clipboardInput', ( evt, data ) => {
            if ( localStorage.getItem( 'rmCrossRefLinkClipboard' ) !== null ) {
                evt.stop();
            }
            let selection = evt.source.selection.editableElement;
            let modelRequirement = RequirementWidgetUtil.getRequirementViewElement( selection );
            const idAttr = modelRequirement && modelRequirement.getAttribute( 'id' );
            if( idAttr && ( idAttr.indexOf( 'figures' ) !== -1 || idAttr.indexOf( 'specContent' ) !== -1 ) )            {
                evt.stop();
                data.preventDefault();
            }
        } );


        editor.listenTo( viewDocument, 'paste', ( evt, data ) => {
            if ( localStorage.getItem( 'rmCrossRefLinkClipboard' ) !== null ) {
                eventBus.publish( 'requirementDocumentation.canShowPasteCrossRefLinkPopup' );
            }
            let selection = evt.source.selection.editableElement;
            let modelRequirement = RequirementWidgetUtil.getRequirementViewElement( selection );
            const idAttr = modelRequirement && modelRequirement.getAttribute( 'id' );
            if( idAttr && ( idAttr.indexOf( 'tables' ) !== -1 || idAttr.indexOf( 'specContent' ) !== -1 || idAttr.indexOf( 'figures' ) !== -1 ) ) {
                evt.stop();
                data.preventDefault();
            }
        } );

        editor.listenTo( viewDocument, 'copy', ( evt, data ) => {
            let crossRefLinkData = JSON.parse( localStorage.getItem( 'rmCrossRefLinkClipboard' ) );
            if ( crossRefLinkData ) {
                localStorage.removeItem( 'rmCrossRefLinkClipboard' );
            }
        } );

        eventToHandleClickOnCrossReferenceLink =  eventBus.subscribe( 'ckeditor.handleClickOnCrossReferenceLink', function( eventData ) {
            eventBus.publish( 'requirementDocumentation.openCrossRefLinkInNewTab', {
                crossRefLinkElement: eventData.requirementElement,
                id: ''
            } );
        } );
    }

    destroy() {
        super.destroy();
        eventBus.unsubscribe( eventToHandleClickOnCrossReferenceLink );
    }
}
