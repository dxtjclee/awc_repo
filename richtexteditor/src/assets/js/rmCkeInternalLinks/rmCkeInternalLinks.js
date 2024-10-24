//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * This Plugin will Allow user to navigate through a document with internal links
 */
import eventBus from 'js/eventBus';
import RequirementWidgetUtil from 'js/rmCkeRequirementWidget/requirementWidgetUtil';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

var focusHandleRequired = false;
var targetElement = null;

export default class RMInternalLinks extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        _defineConversionForLinkTag( editor );

        var resource = 'RichTextEditorCommandPanelsMessages';
        var localeTextBundle = localeService.getLoadedText( resource );

        const linkActionsView = editor.plugins.get( 'LinkUI' ).actionsView;
        const previewButtonView = linkActionsView.previewButtonView;
        const editButtonView = editor.plugins.get( 'LinkUI' ).actionsView.editButtonView;

        // By default, the link edit button is enabled. We want to disable it every time the href starts with "#". 
        // Removing the default binding, then creating a new one.      
        editButtonView.unbind( 'isEnabled' );
        editButtonView.bind( 'isEnabled' ).to( linkActionsView, 'href', href => {
            return _setTooltipForLinks( href, linkActionsView, localeTextBundle );
        } );

        previewButtonView.on( 'render', ( evt ) => {
            evt.source.element.addEventListener( 'click', ( evt ) => {
                const href = linkActionsView.href;
                if ( href && href.startsWith( '#' ) && href.length > 1 ) {
                    let internalLink = href.substring( 1 );
                    if ( internalLink ) {
                        const eventData = {
                            requirementElement: {
                                isLink: true
                            }
                        };
                        let requirementElement = null;
                        if ( internalLink.startsWith( 'revuid_' ) ) {
                            internalLink = internalLink.substring( 'revuid_'.length );
                            requirementElement = document.querySelector( 'div[revisionid="' + internalLink + '"]' );
                            if ( requirementElement ) {
                                eventData.requirementElement.revisionid = internalLink;
                                eventData.requirementElement.id = requirementElement.getAttribute( 'id' );
                            } else {
                                eventData.requirementElement.revisionid = internalLink;
                            }
                            eventBus.publish( 'ckeditor.handleClickOnCrossReferenceLink', eventData );
                        } else {
                            let anchorElement = document.querySelector( 'a[name="' + internalLink + '"]' );
                            requirementElement = RequirementWidgetUtil.getRequirementElement( anchorElement );
                            if ( !requirementElement ) {
                                let msg = localeTextBundle.Arm0LinkNotFoundErrorMessage.replace( '{0}', href );
                                messagingService.showError( msg );
                            } else {
                                eventData.requirementElement.revisionid = requirementElement.getAttribute( 'revisionid' );
                                eventData.requirementElement.id = requirementElement.getAttribute( 'id' );
                                eventBus.publish( 'ckeditor.handleClickOnCrossReferenceLink', eventData );
                                focusHandleRequired = true;
                                targetElement = anchorElement;

                                /*
                                *   Timeout is required if event primaryWorkArea.selectionChangeEvent doesn't get fire
                                *   We can't rely on above event for internal links of type text-to-text
                                */
                                setTimeout( () => {
                                    editor.fire( 'ckeditor.handleCkeditorFocusOnBodyText' );
                                }, 1500 );
                            }
                        }
                        evt.preventDefault();
                    }
                }
            } );
        } );

        editor.on( 'ckeditor.handleCkeditorFocusOnBodyText', function( eventData ) {
            if ( focusHandleRequired ) {
                _handleCkeditorFocusForAnchorElement( targetElement, editor, editor.editing.view );
                focusHandleRequired = false;
                targetElement = null;
            }
        } );
    }
}

/**
 * Method to handle ckeditor's focus on requirment body text
 *
 * @param {Object} anchorElement - destination dom element
 * @param {Object} editor - The editor instance
 * @param {Object} view - The editor's view 
 */
function _handleCkeditorFocusForAnchorElement( anchorElement, editor, view ) {
    setTimeout( () => {
        const viewEle = view.domConverter.mapDomToView( anchorElement );
        let viewRange = null;
        view.change( writer => {
            viewRange = writer.createRangeIn( viewEle );
        } );
        if ( viewRange ) {
            const range = editor.editing.mapper.toModelRange( viewRange );
            view.focus();
            editor.model.change( writer => {
                var newselection = writer.createSelection( range );
                writer.setSelection( newselection );
                writer.setSelectionFocus( newselection.getFirstPosition() );
                if ( !view.document.isFocused ) {
                    view.document.isFocused = true;
                }
            } );
        }
    }, 200 );
}

/**
 * Method to support 'name' attribute on anchor tag
 *
 * @param {Object} editor - The editor instance
 */
function _defineConversionForLinkTag( editor ) {
    // Extending the text schema to allow a attribute 'linkName'
    editor.model.schema.extend( '$text', {
        allowAttributes: 'linkName'
    } );

    editor.conversion.for( 'downcast' ).attributeToElement( {
        model: 'linkName',
        view: ( attributeValue, conversionApi ) => {
            const writer = conversionApi.writer;
            return writer.createAttributeElement( 'a', { name: attributeValue }, { priority: 5 } );
        },
        converterPriority: 'low'
    } );
    editor.conversion.for( 'upcast' ).attributeToAttribute( {
        view: {
            name: 'a',
            key: 'name'
        },
        model: 'linkName',
        converterPriority: 'low'
    } );
}

/**
 * Method to set tooltip on the link element and toggle the edit link button
 *
 * @param {Object} href - destination dom element
 * @param {Object} linkActionsView - The editor instance
 * @param {Object} localeTextBundle - The editor instance
 * @return {Boolean} returns true if external link and vice versa
 */
function _setTooltipForLinks( href, linkActionsView, localeTextBundle ) {
    const prevBtn = linkActionsView.previewButtonView;
    if( href && !href.startsWith( '#' ) ) {
        prevBtn.tooltip = localeTextBundle.Arm0OpenInNewTabTitle;
        return true;
    }
    if ( href && href.startsWith( '#' ) ) {
        if( href.startsWith( '#revuid_' ) ) {
            var internalLink = href.substring( '#revuid_'.length );
            var requirementElement = document.querySelector( 'div[revisionid="' + internalLink + '"]' );
            if( !requirementElement ) {
                prevBtn.tooltip = localeTextBundle.Arm0OpenInNewTabTitle;
            }else{
                prevBtn.tooltip = localeTextBundle.Arm0NavigateToContentLabel;
            }
        } else{
            var anchorElement = document.querySelector( 'a[name="' + href.substring( 1 ) + '"]' );
            if( !anchorElement ) {
                prevBtn.tooltip = localeTextBundle.Arm0OpenInNewTabTitle;
            }else{
                prevBtn.tooltip = localeTextBundle.Arm0NavigateToContentLabel;
            }
        }
        return false;
    }
}
