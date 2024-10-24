/* eslint-disable max-lines, class-methods-use-this*/
// Copyright (c) 2022 Siemens


import appCtxSvc from 'js/appCtxService';
import RequirementWidgetCommand from 'js/rmCkeRequirementWidget/requirementWidgetCommand';
import eventBus from 'js/eventBus';
import Arm0LoadSpecService from 'js/Arm0LoadSpecService';
import localeService from 'js/localeService';
import RequirementWidgetUtil from 'js/rmCkeRequirementWidget/requirementWidgetUtil';
import RequirmentQualityReuse from 'js/rmCkeReuseToolIntegration/reuseToolIntegrationUtil';
import ckeditorOperations from 'js/ckeditorOperations';
import reqUtils from 'js/requirementsUtils';
import { createListItems, ConvertHtmlToModel } from 'js/rmCkeRMContentTable/rmCreateContentTable';
import { getSpecDataAttributes, getSpecImageData } from 'js/rmCkeRequirementWidget/requirementWidgetMetadataService';
import { ckeditor5ServiceInstance, setCkeditor5Instance } from 'js/Arm0CkeditorServiceInstance';
import { svgString as CmdSettings } from 'image/cmdSettings24.svg';
import { svgString as cmdAdd } from 'image/cmdAdd24.svg';
import { svgString as cmdRemove } from 'image/cmdRemove24.svg';
import { svgString as cmdCreateTraceLink } from 'image/cmdCreateTraceLink24.svg';
import { svgString as indicatorTraceLink } from 'image/indicatorTraceLink16.svg';
import { svgString as indicatorSuspectLink } from 'image/indicatorSuspectLink16.svg';


var editor = null;
var scrollTop = null;
let eventNewElementCreatedUsingAddPanel;
let eventPostLoadSubscription;
var isCollaborationModeOn;
var isOwnerUserId;
var currentUserId;
let isOtherUserCreatedNewRequirement;

export default class RequirementWidget extends ckeditor5ServiceInstance.Plugin {
    init() {
        editor = this.editor;

        setCkeditor5Instance( editor );

        this._defineSchema();
        this._defineConversion();

        editor.commands.add( 'insertRequirement', new RequirementWidgetCommand( editor ) );

        eventPostLoadSubscription = eventBus.subscribe( 'ckeditor.postLoadSubscription', function() {
            //handle creation of widgets on keystrokes
            handleKeystrokeEvents();
        } );

        eventNewElementCreatedUsingAddPanel = eventBus.subscribe( 'requirementDocumentation.newElementCreatedUsingAddPanel', function( eventData ) {
            editor.execute( 'insertRequirement', eventData );
        } );

        /**
         * Function to insert new widget on keystroke
         *
         * @param {eventdata} data - contains the event data for the keystroke
         * @param {eventdata} cancel - cancel keystroke event
         * @param {eventdata} option - child/sibling
         */
        function createNewRequirement( data, cancel, option ) {
            var requirementAncestor = getNestedEditable( data.domTarget );
            if( requirementAncestor ) {
                var eventdata = { after: '', addOption: option };
                var t1 = editor.editing.view.document.selection.editableElement.parent.parent;
                if( !t1.hasClass( 'requirement' ) ) {
                    //in case the selection is in header
                    t1 = t1.parent;
                }
                var t2 = editor.editing.mapper.toModelElement( t1 );
                eventdata.after = t2;
                editor.execute( 'insertRequirement', eventdata );
                cancel();
            }
        }

        /**
         * Method to handle keystroke event
         */
        function handleKeystrokeEvents() {
            editor.keystrokes.set( 'Ctrl+Enter', ( data, cancel ) => {
                createNewRequirement( data, cancel, 'SIBLING' );
            } );
            editor.keystrokes.set( 'Shift+Enter', ( data, cancel ) => {
                createNewRequirement( data, cancel, 'CHILD' );
            } );
        }

        /**
         *
         * @param {*} editor - contains the editor instance
         * Disables commands for read-only objects
         */
        editor.model.document.on( 'change', () => {
            const selection = editor.model.document.selection;
            const blocks = selection.getSelectedBlocks();
            const command = editor.commands.get( 'trackChanges' );

            let shouldEnableTrackChanges = false;
            for( const block of blocks ) {
                var bodyTextElement = RequirementWidgetUtil.disableCmdForReadOnlyObj( block, editor );
                bodyTextElement && bodyTextElement.name === 'requirementBodyText' ? shouldEnableTrackChanges = true : '';
            }
            if( appCtxSvc.ctx.trackChanges && appCtxSvc.ctx.trackChanges.isOn ) {   // Handle only if Track Change mode is ON
                if ( shouldEnableTrackChanges && bodyTextElement && bodyTextElement.name === 'requirementBodyText'
                    && bodyTextElement.parent.parent.getAttribute( 'id' ).indexOf( 'RM::NEW::' ) === -1 ) {  // Enable only for bodyText of existing objects
                    command.value = true;
                    command.clearForceDisabled();
                } else {
                    command.value = false;
                    command.forceDisabled();
                }
            }
        } );

        [
            'click', 'mousedown', 'mouseup', 'mousemove', 'paste', 'cut', 'copy', 'drop', 'focus', 'blur', 'beforeinput', 'keydown', 'keyup'
        ].forEach( eventName => {
            editor.editing.view.document.on( eventName, ( evt, data ) => {
                if( data.domTarget.matches( '[data-cke-ignore-events], [data-cke-ignore-events] *' ) ) {
                    evt.stop();
                }
                if( evt.name === 'keydown' || evt.name === 'keyup' ) {
                    var keyId = data.keyCode;
                    var ctrl = data.ctrlKey;
                    if( ctrl && keyId !== 17 && keyId === 86 ) {
                        data.stopPropagation();
                    }
                    var selectedEle = null;
                    if( evt.source.selection.isFake && evt.source.selection ) {
                        selectedEle = evt.source.selection.getSelectedElement();
                    }
                    if( selectedEle && selectedEle.hasClass( 'requirement' ) ) {
                        evt.stop();
                    }
                }
            }, { priority: 999999999 } );
        } );
    }

    destroy() {
        super.destroy();
        eventBus.unsubscribe( eventPostLoadSubscription );
        eventBus.unsubscribe( eventNewElementCreatedUsingAddPanel );
    }
    /**
     *    <requirement hastracelink="FALSE" id="..." objecttype="Requirement Revision" itemtype="Requirement" parentid="" parenttype="">
     *        <requirementMarkers hasTraceIcon=true></requirementMarkers>
     *        <requirementHeader requirementName="REQ-000009-">Program Context</requirementHeader>
     *        <requirementContent hasForm="true">
     *            <div>
     *                <paragraph dir="ltr" style="font-family: 'Arial', 'sans-serif';font-size: 11pt;line-height: 108%;margin-bottom: 0;margin-left: 0;margin-right: 0;margin-top: 0;">
     *                    <span style="color: #000000;font-family: 'Arial', 'sans-serif';font-size: 11pt;font-style: normal;font-weight: normal;margin: 0;padding: 0;">Program Context</span>
     *                </paragraph>
     *            </div>
     *        </requirementContent>
     *    </requirement>
     */
    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'requirement', {
            allowWhere: '$block',
            allowAttributes: [ 'class', 'isspecification', 'hastracelink', 'id', 'lmd', 'lmu', 'objecttype', 'itemtype', 'ownerid',
                'parentid', 'parenttype', 'siblingid', 'siblingtype', 'parentitemtype', 'contenteditable', 'revisionid',
                'top_line', 'style', 'checkedoutby', 'checkedouttime', 'bomChangePresent'
            ],
            isObject: true,
            isBlock: true
        } );

        schema.register( 'requirementHeader', {
            allowIn: 'requirement',
            allowAttributes: [ 'class', 'contenttype', 'selected', 'contenteditable', 'requirementNamePrefix', 'isDirty' ],
            isLimit: true
        } );

        schema.register( 'requirementMarker', {
            allowIn: 'requirement',
            allowAttributes: [ 'class', 'style' ],
            isLimit: true
        } );

        schema.register( 'requirementContent', {
            allowIn: 'requirement',
            allowContentOf: '$root',
            isLimit: true
        } );

        schema.register( 'requirementDerived', {
            allowIn: 'requirement',
            allowAttributes: [ 'class', 'title' ],
            allowContentOf: '$root',
            isLimit: true
        } );

        schema.register( 'requirementBodyText', {
            allowIn: [ 'requirementContent', '$root', '$block' ],
            allowAttributes: [ 'class', 'contenttype', 'contenteditable', 'isDirty', 'isBasedon', 'isderived', 'masterreqname', 'masterReqUid', 'basedOnMasterReqName',
                'basedonmasterreqid', 'isdirtyforcomment' ],
            allowContentOf: '$root',
            isLimit: true
        } );
        schema.register( 'requirementProperty', {
            allowIn: [ 'requirementContent', 'paragraph' ],
            allowAttributes: [ 'class', 'isDirty', 'isModifible', 'isEditable', 'iseditable', 'propertyType', 'propertytype',
                'internalName', 'internalname', 'title', 'contenteditable', 'isRequired'
            ],
            isLimit: true
        } );
        schema.register( 'requirementLovProperty', {
            allowIn: [ 'requirementContent' ],
            allowAttributes: [ 'class', 'isDirty', 'isModifible', 'isEditable', 'iseditable', 'propertyType', 'propertytype',
                'internalName', 'internalname', 'title', 'contenteditable', 'isRequired', 'selectOptions', 'selected'
            ],
            allowContentOf: '$root',
            isLimit: true
        } );
        schema.register( 'typeicon', {
            allowIn: 'requirementMarker',
            allowAttributes: [ 'title', 'class' ],
            isLimit: true
        } );

        schema.register( 'addelementicon', {
            allowIn: 'requirementMarker'
        } );

        schema.register( 'removeelementicon', {
            allowIn: 'requirementMarker'
        } );
        schema.register( 'tracelinkicon', {
            allowIn: 'requirementMarker',
            allowAttributes: [ 'svgname', 'class', 'tracelinkCount', 'title' ]
        } );
        schema.register( 'settingsicon', {
            allowIn: [ 'tocWidget' ],
            allowAttributes: [ 'class', 'title' ]
        } );

        schema.register( 'tocWidget', {
            allowIn: [ 'requirementBodyText' ],
            //inheritAllFrom: '$block',
            isObject: true,
            allowAttributes: [ 'class', 'id' ]
        } );

        schema.register( 'iconImage', {
            allowIn: [ 'typeicon' ],
            allowAttributes: [ 'alt', 'src', 'srcset', 'class' ]
        } );

        schema.register( 'faulticonup', {
            // isInline: true,
            // allowWhere: '$text',
            allowIn: 'requirementHeader'
        } );

        schema.register( 'faulticondown', {
            allowIn: 'requirementHeader'
        } );

        schema.register( 'correction', {
            allowIn: 'requirementHeader'
        } );

        schema.register( 'toggleButton', {
            allowIn: 'requirementHeader',
            allowAttributes: [ 'class' ]
        } );

        schema.register( 'mark', {
            allowIn: 'requirementContent',
            allowAttributes: [ 'class' ]
        } );

        schema.register( 'checkedout', {
            allowIn: 'requirementMarker',
            allowAttributes: [ 'imgSrc', 'class', 'title', 'checkedOutBy' ]
        } );

        schema.register( 'division', {
            inheritAllFrom: '$block',
            allowWhere: '$block',
            allowContentOf: '$root'
        } );

        schema.register( 'oleimage', {
            allowIn: [ 'requirementBodyText', '$text', 'paragraph' ],
            allowAttributes: [ 'alt', 'src', 'datasettype', 'style', 'oleid' ]
        } );

        schema.register( 'crossRefimage', {
            allowIn: [ 'requirementBodyText', '$text', 'paragraph', 'division' ],
            allowAttributes: [ 'class', 'src', 'crossrefimg', 'style' ]
        } );

        // Allow requirements in the model to have all attributes.
        schema.addAttributeCheck( context => {
            if( context.endsWith( '$text' ) || context.endsWith( 'division' ) ) {
                return true;
            }
        } );
        //extend list schema to support id,style and class attributes
        schema.extend( 'listItem', {
            inheritAllFrom: '$block',
            allowAttributes: [ 'id', 'class', 'listStyle' ],
            allowIn: [ 'tocWidget' ]
        } );
        editor.conversion.for( 'upcast' ).attributeToAttribute( {
            model: {
                name: 'listItem',
                key: 'listStyle'
            },
            view: {
                name: 'li',
                key: 'style',
                value: /[\s\S]+/
            }
        } );

        //if content modified by other users then update local copy of data and show updated message to other users
        editor.conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'attribute:lmd:requirement', ( evt, data, conversionApi ) => {
                if( data.item.getAttribute( 'lmd' ) ) {
                    const reqModelElement = data.item;
                    var last_mod_user = reqModelElement.getAttribute( 'lmu' );
                    var idAttribute = reqModelElement.getAttribute( 'id' );

                    var eventData = {
                        idAttribute: idAttribute,
                        last_mod_user:last_mod_user
                    };
                    eventBus.publish( 'requirementDocumentation.updateContentMap', eventData );


                    var session = appCtxSvc.getCtx( 'userSession' );
                    var username;
                    if( session ) {
                        username = session.props.user_id.dbValue;
                    }
                    //if dirty element then show update message
                    if( last_mod_user !== username && ifPresentInDirtyElements( editor, reqModelElement, username ) ) {
                        var elementId = reqModelElement.getAttribute( 'id' );

                        if( editor.dirtyElementsIds && editor.dirtyElementsIds.includes( elementId ) ) {
                            editor.dirtyElementsIds = editor.dirtyElementsIds.filter( item => item !== elementId );
                        }
                        eventBus.publish( 'requirementDocumentation.showUpdateMessage', eventData );
                    }
                }
            } );
        } );

        //If any BOM change is done then inform all users in session to add event listner for refresh page
        editor.conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'attribute:bomChangePresent:requirement', ( evt, data, conversionApi ) => {
                if( data.item.getAttribute( 'bomChangePresent' ) ) {
                    eventBus.publish( 'requirementDocumentation.addUnloadListenerForRefresh' );
                    data.item._removeAttribute( 'bomChangePresent' );
                }
            } );
        } );

        //Fix for bullets and numbering issue
        //if style attribute added on ListItem, it throws as exception. This function removed the style attribute
        editor.conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'attribute:style:listItem', ( evt, data, conversionApi ) => {
                if( data.item.getAttribute( 'style' ) ) {
                    data.item._removeAttribute( 'style' );
                }
            } );
        } );

        editor.conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'attribute:listStyle:listItem', ( evt, data, conversionApi ) => {
                const viewElement = conversionApi.mapper.toViewElement( data.item );

                conversionApi.writer.setAttribute( 'style', data.attributeNewValue, viewElement );
            } );
        }, { priority: 'highest' } );

        editor.conversion.attributeToAttribute( {
            model: {
                name: 'listItem',
                key: 'id'
            },
            view: {
                name: 'li',
                key: 'id'
            }
        } );

        editor.conversion.attributeToAttribute( {
            model: {
                name: 'listItem',
                key: 'class',
                values: [ 'tocunderlineonhover' ]
            },
            view: {
                tocunderlineonhover: {
                    name: 'li',
                    key: 'class',
                    value: 'aw-requirement-tocUnderlineOnHover'
                }
            }
        } );

        editor.conversion.attributeToAttribute( {
            model: {
                name: 'iconImage',
                key: 'src'
            },
            view: {
                name: 'img',
                key: 'src'
            }
        } );

        editor.conversion.attributeToAttribute( {
            model: {
                name: 'requirement',
                key: 'id'
            },
            view: {
                name: 'div',
                key: 'id'
            }
        } );

        editor.conversion.attributeToAttribute( {
            model: {
                name: 'requirement',
                key: 'parentid'
            },
            view: {
                name: 'div',
                key: 'parentid'
            }
        } );

        schema.extend( '$text', { allowIn: [ 'requirementHeader', 'requirementProperty', 'span', 'div' ], allowAttributes: 'highlight' } );

        schema.extend( '$block', { allowIn: [ 'requirementContent', 'requirementBodyText' ] } );
        var options = this.editor.config._config.highlight.options;
        this.editor.conversion.attributeToElement( this._buildDefinition( options ) );
    }

    _buildDefinition( options ) {
        const definition = {
            model: {
                key: 'highlight',
                values: []
            },
            view: {}
        };

        for( const option of options ) {
            definition.model.values.push( option.model );
            definition.view[ option.model ] = {
                name: 'mark',
                classes: option.class
            };
        }
        return definition;
    }

    _defineConversion() {
        const conversion = this.editor.conversion;

        this._defineRequirementConversion( conversion );
        this._defineMarkerConversion( conversion );
        this._defineHeaderConversion( conversion );

        this._defineContentConversion( conversion );
        this._defineTOCDIVConversion( conversion );
        this._defineDerivedClassConversion( conversion );
    }

    _defineDerivedClassConversion( conversion ) {
        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: 'div',
                classes: 'aw-requirement-readOnly'
            },
            model: ( viewElement, conversionApi ) => {
                const modelWriter = conversionApi.writer;
                const derivedClass = modelWriter.createElement( 'requirementDerived', viewElement.getAttributes() );
                var clsStrings = '';
                for( let clsStr of viewElement.getClassNames() ) {
                    clsStrings += clsStr + ' ';
                }
                modelWriter.setAttribute( 'class', clsStrings, derivedClass );
                return derivedClass;
            },

            // Execute this converter before the generic <div> converter defined in _defineDivInsideContentConversion().
            converterPriority: 'high'
        } );
        conversion.for( 'downcast' ).elementToElement( {
            model: 'requirementDerived',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return viewWriter.createContainerElement( 'div',  modelElement.getAttributes() );
            }
        } );
    }
    _defineTOCDIVConversion( conversion ) {
        conversion.for( 'upcast' ).add( dispatcher => {
            dispatcher.on( 'element:div', ( evt, data, conversionApi ) => {
                const matcher = new ckeditor5ServiceInstance.Matcher( {
                    name: 'div',
                    classes: 'aw-requirement-tocFont'
                } );
                // This will be usually just one pattern but we support matchers with many patterns too.
                const match = matcher.match( data.viewItem );
                // If there is no match, this callback should not do anything.
                if( !match ) {
                    return;
                }
                const viewDiv = data.viewItem;
                conversionApi.consumable.consume( viewDiv, { name: true } );
                const tocWidget = conversionApi.writer.createElement( 'tocWidget', viewDiv.getAttributes() );

                conversionApi.writer.insert( tocWidget, data.modelCursor );
                conversionApi.convertChildren( viewDiv, conversionApi.writer.createPositionAt( tocWidget, 'end' ) );
                data.modelRange = conversionApi.writer.createRange(
                    conversionApi.writer.createPositionBefore( tocWidget ),
                    conversionApi.writer.createPositionAfter( tocWidget )
                );
                data.modelCursor = data.modelRange.end;
            }, { priority: 'highest' } );
        } );

        conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'insert:tocWidget', ( evt, data, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const tocWidget = data.item;

                conversionApi.consumable.consume( tocWidget, 'insert' );

                var viewtocWidget = viewWriter.createContainerElement( 'div', tocWidget.getAttributes() );
                var tocWidgetElement = ckeditor5ServiceInstance.toWidget( viewtocWidget, conversionApi.writer );

                const viewPosition = conversionApi.mapper.toViewPosition( data.range.start );

                conversionApi.mapper.bindElements( tocWidget, viewtocWidget );
                conversionApi.writer.insert( viewPosition, tocWidgetElement );
            }, { priority: 'highest' } );
        } );
    }
    _defineRequirementConversion( conversion ) {
        let addedChildOrSibilingRevId = [];
        var allAddedChildOrSibilingRevId = [];
        var tempArrayOfaddedChildOrSibilingRevId = [];
        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: 'div',
                classes: 'requirement'
            },
            model: ( viewElement, conversionApi ) => {
                const modelWriter = conversionApi.writer;
                return modelWriter.createElement( 'requirement', viewElement.getAttributes() );
            },

            // Execute this converter before the generic <div> converter defined in _defineDivInsideContentConversion().
            converterPriority: 'high'
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: 'requirement',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                isOtherUserCreatedNewRequirement = false;
                isCollaborationModeOn = Boolean( editor.config._config && editor.config._config.collaboration && editor.config._config.collaboration.channelId );
                if( isCollaborationModeOn ) {
                    getModelElementOwnerAndCurrentUserId( modelElement );
                    var ownerId;
                    if( !isOwnerUserId ) {
                        ownerId = modelElement.getAttribute( 'ownerid' );
                    }
                    if( ownerId && ownerId !==  currentUserId ) {
                        setElementReadOnlyForOtherUsersAtCollaboration( conversionApi, modelElement );
                        isOtherUserCreatedNewRequirement = true;
                    }
                }

                const reqRevId = modelElement.getAttribute( 'revisionid' );
                const reqMetadata = getSpecDataAttributes( reqRevId );
                if( reqMetadata ) {
                    if( reqMetadata.id && modelElement.getAttribute( 'id' ) !== reqMetadata.id ) {
                        conversionApi.writer.setAttribute( 'id', reqMetadata.id, modelElement );
                    }
                    if( reqMetadata.parentid && modelElement.getAttribute( 'parentid' ) !== reqMetadata.parentid ) {
                        conversionApi.writer.setAttribute( 'parentid', reqMetadata.parentid, modelElement );
                    }
                }
                const viewRequirement = viewWriter.createContainerElement( 'div', modelElement.getAttributes() );

                if( isOtherUserCreatedNewRequirement ) {
                    conversionApi.writer.addClass( 'aw-requirements-readOnlyRequirementContent', viewRequirement );
                }

                if( reqMetadata && reqMetadata.bodytext ) {
                    if( reqMetadata.bodytext.contenteditable === 'false' ) {
                        conversionApi.writer.addClass( 'aw-requirements-readOnlyRequirementContent', viewRequirement );
                    }
                    if( reqMetadata.bodytext.contenteditable === 'true' ) {
                        conversionApi.writer.removeClass( 'aw-requirements-readOnlyRequirementContent', viewRequirement );
                    }
                    if( reqMetadata.bodytext.contenttype === 'READONLY' ) {
                        conversionApi.writer.addClass( 'aw-requirements-readOnlyRequirementContent', viewRequirement );
                    }
                }

                viewWriter.setCustomProperty( 'requirement', true, viewRequirement );

                return ckeditor5ServiceInstance.toWidget( viewRequirement, viewWriter );
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: 'requirement',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return viewWriter.createContainerElement( 'div', modelElement.getAttributes() );
            }
        } );

        conversion.for( 'downcast' ).add( dispatcher => dispatcher.on( 'attribute:checkedoutby', ( evt, data, conversionApi ) => {
            const modelRequirement = data.item;
            const viewWriter = conversionApi.writer;

            // Mark element as consumed by conversion.
            conversionApi.consumable.consume( data.item, evt.name );

            var checkoutElement = null;

            if( modelRequirement.name === 'requirement' ) {
                checkoutElement = RequirementWidgetUtil.getModelElement( editor, modelRequirement, 'checkedout' );
            }
            var viewElement = null;

            if( checkoutElement ) {
                viewElement = conversionApi.mapper.toViewElement( checkoutElement );
            }

            if( viewElement ) {
                viewWriter.remove( viewElement );
            }
        } ) );
    }

    _defineMarkerConversion( conversion ) {
        this._defineSettingIconConversion();
        conversion.for( 'upcast' ).elementToElement( {
            model: 'requirementMarker',
            view: {
                name: 'div',
                classes: 'aw-requirement-marker'
            },
            converterPriority: 'high'
        } );

        conversion.for( 'downcast' ).elementToElement( {
            model: 'requirementMarker',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                var opacityProperty = '';
                if( isOtherUserCreatedNewRequirement ) {
                    opacityProperty = 'opacity:0.5';
                }
                return viewWriter.createContainerElement( 'div', {
                    class: 'aw-requirement-marker',
                    style: opacityProperty
                } );
            },
            converterPriority: 'high'
        } );

        conversion.for( 'upcast' ).elementToElement( {
            view: 'typeicon',
            model: ( viewElement, conversionApi ) => {
                const modelWriter = conversionApi.writer;
                return modelWriter.createElement( 'typeicon', viewElement.getAttributes() );
            }
        } );

        // Model-to-view convert for the div element (attributes are converted separately).
        conversion.for( 'downcast' ).elementToElement( {
            model: 'typeicon',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const typeTitle = modelElement.getAttribute( 'title' );
                return viewWriter.createContainerElement( 'typeicon', {
                    class: 'aw-ckeditor-marker-element',
                    title: typeTitle
                } );
            }
        } );

        conversion.for( 'downcast' ).elementToElement( {
            model: 'addelementicon',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return renderToEditing( viewWriter, this.editor, modelElement );
            }
        } );
        conversion.for( 'upcast' ).elementToElement( {
            model: 'addelementicon',
            view: 'addelementicon'
        } );
        conversion.for( 'downcast' ).elementToElement( {
            model: 'removeelementicon',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return renderToEditingRemoveIcon( viewWriter, this.editor, modelElement );
            }
        } );
        conversion.for( 'upcast' ).elementToElement( {
            model: 'removeelementicon',
            view: 'removeelementicon'
        } );
        conversion.for( 'downcast' ).elementToElement( {
            model: 'checkedout',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return renderForCheckout( viewWriter, this.editor, modelElement );
            }
        } );
        conversion.for( 'upcast' ).elementToElement( {
            model: 'checkedout',
            view: 'checkedout'
        } );
        this._defineTracelinkIconConversion();

        // icon image
        conversion.for( 'downcast' ).elementToElement( {
            model: 'iconImage',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return renderForIcon( viewWriter, this.editor, modelElement );
            }

        } );
        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: 'img',
                classes: 'aw-base-icon'
            },
            model: ( viewElement, conversionApi ) => {
                const modelWriter = conversionApi.writer;
                return modelWriter.createElement( 'iconImage', viewElement.getAttributes() );
            }
        } );
    }
    _defineSettingIconConversion() {
        const conversion = this.editor.conversion;
        conversion.for( 'upcast' ).add( dispatcher => {
            dispatcher.on( 'element:settingsicon', ( evt, data, conversionApi ) => {
                const matcher = new ckeditor5ServiceInstance.Matcher( {
                    name: 'settingsicon'
                } );

                // This will be usually just one pattern but we support matchers with many patterns too.
                const match = matcher.match( data.viewItem );

                // If there is no match, this callback should not do anything.
                if( !match ) {
                    return;
                }

                const viewDiv = data.viewItem;
                if( viewDiv ) {
                    conversionApi.consumable.consume( viewDiv, { name: true } );
                    var clsStrings = 'aw-requirement-tocsettings aw-ckeditor-linkAction';

                    var title = editor.tocSettingsCmdTitle;

                    const settingicon = conversionApi.writer.createElement( 'settingsicon' );
                    conversionApi.writer.setAttribute( 'class', clsStrings, settingicon );
                    conversionApi.writer.setAttribute( 'title', title, settingicon );
                    conversionApi.writer.insert( settingicon, data.modelCursor );
                }
            }, { priority: 'high' } );
        } );

        conversion.for( 'downcast' ).add( dispatcher => dispatcher.on( 'insert:settingsicon', ( evt, data, conversionApi ) => {
            const viewWriter = conversionApi.writer;
            const settingicon = data.item;
            if( settingicon ) {
                conversionApi.consumable.consume( settingicon, 'insert' );

                // Consume attributes if present to not fire attribute change downcast

                conversionApi.consumable.consume( settingicon, 'attribute:class:settingsicon' );
                conversionApi.consumable.consume( settingicon, 'attribute:title:settingsicon' );

                var title = settingicon.getAttribute( 'title' );
                var classes = settingicon.getAttribute( 'class' );

                const settingiconElement = viewWriter.createUIElement( 'settingsicon', { class: classes, title: title }, function( domDocument ) {
                    const domElement = this.toDomElement( domDocument );
                    var imgElement = CmdSettings;
                    domElement.innerHTML = imgElement;
                    domElement.addEventListener( 'click', ( event ) => {
                        var target = event.currentTarget ? event.currentTarget : event.srcElement;
                        var nestedWidget = getNestedEditable( target );

                        // Create panel definition for menu
                        var menus = [ {
                            displayTypeName: editor.update,
                            typeName: editor.update
                        },
                        {
                            displayTypeName: editor.delete,
                            typeName: editor.delete
                        }
                        ];
                        var menuList = [];
                        for( var i = 0; i < menus.length; i++ ) {
                            var typeWithIcon = menus[ i ];
                            menuList.push( {
                                label: typeWithIcon.displayTypeName,
                                internalName: typeWithIcon.typeName,
                                icon: typeWithIcon.typeIconURL,
                                actionHandler: typeWithIcon.typeName
                            } );
                        }
                        // Create and attach the menu,
                        var rect = target.getBoundingClientRect();
                        var iconDimension = {
                            offsetHeight: rect.height,
                            offsetLeft: rect.left,
                            offsetTop: rect.top,
                            offsetWidth: rect.width
                        };
                        var actionList = [];
                        if( menuList ) {
                            for( var i = 0; i < menuList.length; i++ ) {
                                actionList.push( { displayName: menuList[ i ].label, internalName: menuList[ i ].internalName, iconURL: menuList[ i ].icon } );
                            }
                        }
                        var eventData = {
                            sourceObject: {
                                uid: nestedWidget.id
                            },
                            commandDimension: iconDimension,
                            actionItemList: actionList,
                            targetElement:target,
                            callback: function( response ) {
                                const settingIconElement = editor.editing.mapper.toModelElement( settingiconElement );
                                const modelRequirement = RequirementWidgetUtil.getRequirementModelElement( settingIconElement );
                                const reqContent = RequirementWidgetUtil.getModelElement( editor, modelRequirement, 'requirementContent' );
                                const reqBodytext = RequirementWidgetUtil.getModelElement( editor, reqContent, 'requirementBodyText' );
                                if( response === editor.delete ) {
                                    for( let child of reqBodytext.getChildren() ) {
                                        const id = child.getAttribute( 'id' );
                                        if( id && id === 'TOC' ) {
                                            editor.model.change( writer => {
                                                writer.remove( child );
                                            } );
                                        }
                                    }
                                    eventBus.publish( 'showActionPopup.close' );
                                } else if( response === editor.update ) {
                                    var foundListItems = [];
                                    for( let child of reqBodytext.getChildren() ) {
                                        const id = child.getAttribute( 'id' );
                                        if( id && id === 'TOC' ) {
                                            var divElement = child;
                                            if( child ) {
                                                for( let listElement of child.getChildren() ) {
                                                    foundListItems.push( listElement );
                                                }
                                            }
                                        }
                                    }
                                    editor.model.change( writer => {
                                        foundListItems.forEach( function( item, index ) {
                                            if( item.name === 'listItem' ) {
                                                writer.remove( item );
                                            }
                                        } );
                                    } );
                                    var Container = document.createElement( 'ol' );
                                    Container.setAttribute( 'id', 'TOCOL' );
                                    createListItems( Container, editor );
                                    const modellistFragment = ConvertHtmlToModel( Container.outerHTML );

                                    editor.model.change( writer => {
                                        writer.insert( modellistFragment, writer.createPositionAt( divElement, 1 ) );
                                    } );
                                    eventBus.publish( 'showActionPopup.close' );
                                }
                            }
                        };
                        eventBus.publish( 'requirementDocumentation.registerCxtForBalloonPopup', eventData );
                    } );
                    return domElement;
                } );
                conversionApi.mapper.bindElements( settingicon, settingiconElement );

                const tocDivision = settingicon.parent;
                const viewTocDiv = conversionApi.mapper.toViewElement( tocDivision );
                const viewPosition = viewWriter.createPositionAt( viewTocDiv, 0 );
                conversionApi.writer.insert( viewPosition, settingiconElement );
            }
        }, { priority: 'high' } ) );
    }

    _defineTracelinkIconConversion() {
        const conversion = this.editor.conversion;
        conversion.for( 'upcast' ).add( dispatcher => {
            dispatcher.on( 'element:tracelinkicon', ( evt, data, conversionApi ) => {
                const matcher = new ckeditor5ServiceInstance.Matcher( {
                    name: 'tracelinkicon',
                    classes: 'aw-requirement-sidebar-icon'
                } );

                // This will be usually just one pattern but we support matchers with many patterns too.
                const match = matcher.match( data.viewItem );

                // If there is no match, this callback should not do anything.
                if ( !match ) {
                    return;
                }

                const viewDiv = data.viewItem;
                if ( viewDiv ) {
                    conversionApi.consumable.consume( viewDiv, { name: true } );

                    const tracelinkIcon = conversionApi.writer.createElement( 'tracelinkicon' );

                    conversionApi.writer.insert( tracelinkIcon, data.modelCursor );

                    var clsStrings = '';
                    for ( let clsStr of viewDiv.getClassNames() ) {
                        clsStrings += clsStr + ' ';
                    }
                    clsStrings += ' aw-ckeditor-marker-element';

                    var svgname = '';
                    var tracelinkCnt = '';
                    var title = viewDiv.getAttribute( 'title' );

                    for ( let child of viewDiv.getChildren() ) {
                        if ( child.hasClass( 'aw-requirement-tracelinkCount' ) ) {
                            const textChild = child.getChild( 0 );
                            tracelinkCnt = textChild ? textChild.data : ' ';
                        } else if ( child.name === 'span' ) {
                            svgname = child.getAttribute( 'iconname' );
                        }
                    }
                    conversionApi.writer.setAttribute( 'class', clsStrings, tracelinkIcon );
                    conversionApi.writer.setAttribute( 'svgname', svgname, tracelinkIcon );
                    conversionApi.writer.setAttribute( 'tracelinkCount', tracelinkCnt, tracelinkIcon );
                    conversionApi.writer.setAttribute( 'title', title, tracelinkIcon );
                }
            } );
        } );

        conversion.for( 'downcast' ).add( dispatcher => dispatcher.on( 'insert:tracelinkicon', ( evt, data, conversionApi ) => {
            const viewWriter = conversionApi.writer;
            const tracelinkIcon = data.item;
            if ( tracelinkIcon ) {
                conversionApi.consumable.consume( tracelinkIcon, 'insert' );

                // Consume attributes if present to not fire attribute change downcast
                conversionApi.consumable.consume( tracelinkIcon, 'attribute:tracelinkCount:tracelinkicon' );
                conversionApi.consumable.consume( tracelinkIcon, 'attribute:svgname:tracelinkicon' );
                conversionApi.consumable.consume( tracelinkIcon, 'attribute:class:tracelinkicon' );
                conversionApi.consumable.consume( tracelinkIcon, 'attribute:title:tracelinkicon' );

                var title;
                if ( tracelinkIcon.hasAttribute( 'title' ) ) {
                    title = tracelinkIcon.getAttribute( 'title' );
                } else {
                    title = editor.createTraceLinkTitle;
                }
                var classes = tracelinkIcon.getAttribute( 'class' );

                const tracelinkIconElement = viewWriter.createContainerElement( 'tracelinkicon', {
                    //class: 'aw-requirement-sidebar-icon aw-commands-commandIconButton aw-requirement-create-tracelink aw-requirement-traceLinkIconButton',
                    class: classes,
                    title: title
                } );

                var svgname = tracelinkIcon.getAttribute( 'svgname' );
                const imgElement = viewWriter.createUIElement( 'span', { class: 'aw-base-icon aw-aria-border', iconname:svgname }, function( domDocument ) {
                    const domElement = this.toDomElement( domDocument );
                    if ( svgname === 'cmdCreateTraceLink' ) {
                        domElement.innerHTML = cmdCreateTraceLink;
                    }
                    if ( svgname === 'indicatorTraceLink' ) {
                        domElement.innerHTML = indicatorTraceLink;
                    }
                    if ( svgname === 'indicatorSuspectLink' ) {
                        domElement.innerHTML = indicatorSuspectLink;
                    }

                    if( !isOtherUserCreatedNewRequirement ) {
                        [ 'click', 'keyup', 'mouseover', 'focus' ].forEach( eventName => {
                            domElement.addEventListener( eventName, ( event ) => {
                                if ( eventName === 'click' || eventName === 'keyup' && event.keyCode === 13 ) {
                                    var target = event.currentTarget ? event.currentTarget : event.srcElement;
                                    var nestedWidget = getNestedEditable( target );
                                    var eventData = {
                                        sourceObject: { uid: nestedWidget.id }
                                    };
                                    eventBus.publish( 'requirementDocumentation.addObjectToTracelinkPanel', eventData );
                                }
                                if ( eventName === 'mouseover' || eventName === 'focus' ) {
                                    var placeholder = this;
                                    var delay = setTimeout( function() {
                                        var target = event.currentTarget ? event.currentTarget : event.srcElement;
                                        var nestedWidget = getNestedEditable( target );
                                        var revisionid = nestedWidget.getAttribute( 'revisionid' );
                                        const tlCount = tracelinkIcon.getAttribute( 'tracelinkCount' );
                                        var tracelinkicon = 'div[revisionid=\"' + revisionid + '"\] tracelinkicon';
                                        var bodyTextElement = nestedWidget.getElementsByClassName( 'aw-requirement-bodytext' );
                                        if ( bodyTextElement ) {
                                            var isDerived = bodyTextElement[0].getAttribute( 'isDerived' );
                                            var isBasedon = bodyTextElement[0].getAttribute( 'isBasedon' );
                                            var masterreqname = bodyTextElement[0].getAttribute( 'masterreqname' );
                                            var masterReqUid = bodyTextElement[0].getAttribute( 'masterReqUid' );
                                            var basedOnMasterReqName = bodyTextElement[0].getAttribute( 'basedOnMasterReqName' );
                                            var basedonmasterreqid = bodyTextElement[0].getAttribute( 'basedonmasterreqid' );
                                        }

                                        var rect = target.getBoundingClientRect();
                                        var iconDimension = {
                                            offsetHeight: rect.height,
                                            offsetLeft: rect.left,
                                            offsetTop: rect.top,
                                            offsetWidth: rect.width
                                        };
                                        var nestedWidget = getNestedEditable( target );
                                        var eventData = {
                                            sourceObject: {
                                                uid: nestedWidget.id,
                                                isBasedon: isBasedon,
                                                masterReqName: masterreqname,
                                                masterReqUid: masterReqUid,
                                                isderived: isDerived,
                                                basedOnMasterReqName: basedOnMasterReqName,
                                                basedonmasterreqid: basedonmasterreqid,
                                                tlCount: tlCount
                                            },
                                            targetElement: tracelinkicon,
                                            commandDimension: iconDimension
                                        };
                                        if ( tlCount > 0 ) {
                                            eventBus.publish( 'requirementDocumentation.setTooltipContentData', eventData );
                                        }
                                    }, 500 );
                                    domElement.addEventListener( 'mouseout', function( evt ) {
                                        clearTimeout( delay );
                                    } );
                                }
                            } );
                        } );
                    }
                    return domElement;
                } );
                /////

                const tlCount = tracelinkIcon.getAttribute( 'tracelinkCount' );

                const tlCountElement = viewWriter.createUIElement( 'div', { class: 'aw-requirement-tracelinkCount' }, function( domDocument ) {
                    const domElement = this.toDomElement( domDocument );
                    domElement.innerHTML = tlCount;
                    return domElement;
                } );

                //viewWriter.insert( viewWriter.createPositionAt( traceLinkSpan, 0 ), imgElement );
                viewWriter.insert( viewWriter.createPositionAt( tracelinkIconElement, 0 ), [ imgElement, tlCountElement ] );

                conversionApi.mapper.bindElements( tracelinkIcon, tracelinkIconElement );

                const viewPosition = conversionApi.mapper.toViewPosition( data.range.start );
                conversionApi.writer.insert( viewPosition, tracelinkIconElement );
            }
        } ) )
            .add( dispatcher => dispatcher.on( 'attribute:tracelinkCount', ( evt, data, conversionApi ) => {
                const myModelElement = data.item;
                const viewWriter = conversionApi.writer;

                // Mark element as consumed by conversion.
                conversionApi.consumable.consume( data.item, evt.name );

                // Get mapped view element to update.
                const viewElement = conversionApi.mapper.toViewElement( myModelElement );

                var tracelinkCnt = myModelElement.getAttribute( 'tracelinkCount' );
                var clsStrings = myModelElement.getAttribute( 'class' );
                let svgname = myModelElement.getAttribute( 'svgname' );


                for ( let child of viewElement.getChildren() ) {
                    if ( child.name === 'span' && child.childCount > 0 ) {
                        child = child.getChild( 0 );
                    }
                    if ( child.hasClass( 'aw-base-icon' ) ) {
                        let childDomElement = editor.editing.view.domConverter.mapViewToDom( child );
                        if ( childDomElement ) {
                            if ( svgname === 'cmdCreateTraceLink' ) {
                                childDomElement.innerHTML = cmdCreateTraceLink;
                            }
                            if ( svgname === 'indicatorTraceLink' ) {
                                childDomElement.innerHTML = indicatorTraceLink;
                            }
                            if ( svgname === 'indicatorSuspectLink' ) {
                                childDomElement.innerHTML = indicatorSuspectLink;
                            }
                        }
                    }
                }

                if ( viewElement.childCount > 1 ) {
                    viewWriter.remove( viewElement.getChild( 1 ) );
                    const tlCountElement = viewWriter.createUIElement( 'div', { class: 'aw-requirement-tracelinkCount' }, function( domDocument ) {
                        const domElement = this.toDomElement( domDocument );
                        domElement.innerHTML = tracelinkCnt;
                        return domElement;
                    } );
                    viewWriter.insert( viewWriter.createPositionAt( viewElement, 1 ), tlCountElement );
                }

                viewWriter.setAttribute( 'class', clsStrings, viewElement );
            } ) );
    }
    _defineHeaderConversion( conversion ) {
        conversion.for( 'upcast' ).add( dispatcher => {
            dispatcher.on( 'element:div', ( evt, data, conversionApi ) => {
                const matcher = new ckeditor5ServiceInstance.Matcher( {
                    name: 'div',
                    classes: 'aw-requirement-header'
                } );

                // This will be usually just one pattern but we support matchers with many patterns too.
                const match = matcher.match( data.viewItem );

                // If there is no match, this callback should not do anything.
                if( !match ) {
                    return;
                }

                const viewDiv = data.viewItem;

                if( viewDiv ) {
                    conversionApi.consumable.consume( viewDiv, { name: true } );

                    const requirementHeader = conversionApi.writer.createElement( 'requirementHeader', viewDiv.getAttributes() );

                    conversionApi.writer.insert( requirementHeader, data.modelCursor );

                    const viewH3 = viewDiv.getChild( 0 );

                    var allNestedChilds = [];
                    RequirementWidgetUtil.getAllRecurrsiveChilds( viewH3, allNestedChilds );
                    for( const child of allNestedChilds ) {
                        if( child.name === 'span' && ( child.hasClass( 'aw-requirement-headerNonEditable' ) || child.hasClass( 'aw-requirement-headerId' ) ) ) {
                            const textChild = child.getChild( 0 );
                            const text = textChild ? textChild.data : '';

                            conversionApi.writer.setAttribute( 'requirementNamePrefix', text, requirementHeader );
                            conversionApi.consumable.consume( textChild );
                        } else if( child.name === 'span' && ( child.hasClass( 'aw-requirement-properties' ) || child.hasClass( 'aw-requirement-title' ) ) ) {
                            const textChild = child.getChild( 0 );
                            const text = textChild ? textChild.data : '';

                            conversionApi.writer.insertText( text, requirementHeader );
                            conversionApi.consumable.consume( textChild );
                        } else if( child.name === 'label' ) {
                            var textChild = child.getChild( 0 );
                            var text = textChild ? textChild.data : 'title';
                            conversionApi.writer.setAttribute( 'requirementNamePrefix', text, requirementHeader );
                            conversionApi.consumable.consume( textChild );
                        }
                    }

                    data.modelRange = conversionApi.writer.createRange(
                        conversionApi.writer.createPositionBefore( requirementHeader ),
                        conversionApi.writer.createPositionAfter( requirementHeader )
                    );

                    data.modelCursor = data.modelRange.end;
                }
            } );
        } );

        //<div class="aw-requirement-header" contenttype="TITLE" contenteditable="FALSE">
        //<h3 contenteditable="false">
        //<span class="aw-requirement-headerNonEditable"> 026271-Aliena</span>
        //<span class="aw-requirement-properties" internalname="object_name" contenteditable="true"></span>
        //</h3>
        //</div>
        conversion.for( 'downcast' ).add( dispatcher => dispatcher.on( 'insert:requirementHeader', ( evt, data, conversionApi ) => {
            const viewWriter = conversionApi.writer;
            const requirementHeader = data.item;

            if( requirementHeader ) {
                conversionApi.consumable.consume( requirementHeader, 'insert' );

                // Consume attributes if present to not fire attribute change downcast
                conversionApi.consumable.consume( requirementHeader, 'attribute:requirementNamePrefix:requirementHeader' );
                var selectedAttribute = requirementHeader.getAttribute( 'selected' );
                var isDirtyAttrValue = requirementHeader.getAttribute( 'isDirty' );

                const header = viewWriter.createContainerElement( 'div', {
                    class: 'aw-requirement-header',
                    contenttype: 'TITLE',
                    selected: selectedAttribute,
                    isDirty: isDirtyAttrValue
                } );

                const h3 = viewWriter.createContainerElement( 'h3' );

                const paragraphNumber = requirementHeader.getAttribute( 'requirementNamePrefix' );

                const headerNonEditable = viewWriter.createUIElement( 'span', { class: 'aw-requirement-headerId aw-requirement-headerNonEditable' }, function( domDocument ) {
                    const domElement = this.toDomElement( domDocument );
                    domElement.innerText = paragraphNumber;
                    return domElement;
                } );

                viewWriter.insert( viewWriter.createPositionAt( h3, 0 ), headerNonEditable );

                const reqModelElement = RequirementWidgetUtil.getRequirementModelElement( requirementHeader );
                const reqElementRevId = reqModelElement ? reqModelElement.getAttribute( 'revisionid' ) : undefined;
                const reqMetadata = getSpecDataAttributes( reqElementRevId );
                let nonEditableHeader = false;
                if( reqMetadata && reqMetadata.header && reqMetadata.header.contenteditable === 'false' ) {
                    nonEditableHeader = true;
                }

                //if object is editable then only add 'aw-requirement-properties' class
                if( requirementHeader.getChild( 0 ) ) {
                    const headerEditable = viewWriter.createEditableElement( 'span', {
                        class: 'aw-requirement-title aw-requirement-properties',
                        internalname: 'object_name'
                    } );
                    requirementHeader._removeAttribute( 'editablerequirement' );
                    const reqBodyTextModelElement = RequirementWidgetUtil.getModelElement( editor, reqModelElement, 'requirementBodyText' );
                    let headerWidgetEditable;
                    if( nonEditableHeader || isOwnerUserId && isOwnerUserId !== currentUserId || isOtherUserCreatedNewRequirement || reqBodyTextModelElement && reqBodyTextModelElement.getAttribute( 'contenteditable' ) === 'false' ) {   // need to change afer getting sync changes from collaboration
                        headerWidgetEditable = ckeditor5ServiceInstance.toWidget( headerEditable, conversionApi.writer );
                    } else {
                        headerWidgetEditable = ckeditor5ServiceInstance.toWidgetEditable( headerEditable, conversionApi.writer );
                    }
                    viewWriter.insert( viewWriter.createPositionAt( h3, 1 ), headerWidgetEditable );
                    conversionApi.mapper.bindElements( requirementHeader, headerWidgetEditable );
                } else {
                    conversionApi.mapper.bindElements( requirementHeader, headerNonEditable );
                }
                viewWriter.insert( viewWriter.createPositionAt( header, 0 ), h3 );
                if( editor.setReuseCmdsInHeader ) {
                    RequirmentQualityReuse.insertNavigationCommands( viewWriter, this.editor, h3, requirementHeader );
                }
                const viewPosition = conversionApi.mapper.toViewPosition( data.range.start );
                conversionApi.writer.insert( viewPosition, header );
            }
        } ) ).add( dispatcher => dispatcher.on( 'attribute:requirementNamePrefix', ( evt, data, conversionApi ) => {
            const myModelElement = data.item;
            // Get mapped view element to update.
            const viewElement = conversionApi.mapper.toViewElement( myModelElement );
            var hrEle = viewElement.parent;
            if( hrEle.childCount > 1 ) {
                var domEle = editor.editing.view.domConverter.mapViewToDom( hrEle.getChild( 0 ) );
                if( domEle ) {
                    domEle.innerHTML = myModelElement.getAttribute( 'requirementNamePrefix' );
                }
            }
        } ) );
    }

    _defineContentConversion( conversion ) {
        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: 'div',
                classes: 'aw-requirement-content'
            },
            model: ( viewElement, conversionApi ) => {
                const modelWriter = conversionApi.writer;
                return modelWriter.createElement( 'requirementContent', viewElement.getAttributes() );
            },
            // Execute this converter before the generic <div> converter defined in _defineDivInsideContentConversion().
            converterPriority: 'high'
        } );
        conversion.for( 'downcast' ).elementToElement( {
            model: 'requirementContent',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return viewWriter.createContainerElement( 'div', { class: 'aw-requirement-content' } );
            }
        } );

        this._defineBodyTextConversion();
        this._definePropertyConversion();
        this._defineLovPropertyConversion();
    }
    _defineBodyTextConversion() {
        const conversion = this.editor.conversion;
        conversion.for( 'upcast' ).add( dispatcher => {
            dispatcher.on( 'element:div', ( evt, data, conversionApi ) => {
                const matcher = new ckeditor5ServiceInstance.Matcher( {
                    name: 'div',
                    classes: 'aw-requirement-bodytext'
                } );

                // This will be usually just one pattern but we support matchers with many patterns too.
                const match = matcher.match( data.viewItem );

                // If there is no match, this callback should not do anything.
                if( !match ) {
                    return;
                }

                const viewDiv = data.viewItem;

                conversionApi.consumable.consume( viewDiv, { name: true } );

                const requirementBodyText = conversionApi.writer.createElement( 'requirementBodyText', viewDiv.getAttributes() );

                conversionApi.writer.insert( requirementBodyText, data.modelCursor );

                conversionApi.convertChildren( viewDiv, conversionApi.writer.createPositionAt( requirementBodyText, 0 ) );
                data.modelRange = conversionApi.writer.createRange(
                    conversionApi.writer.createPositionBefore( requirementBodyText ),
                    conversionApi.writer.createPositionAfter( requirementBodyText )
                );

                data.modelCursor = data.modelRange.end;
            }, { priority: 'high' } );
        } );

        conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'insert:requirementBodyText', ( evt, data, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const requirementBodyText = data.item;

                conversionApi.consumable.consume( requirementBodyText, 'insert' );
                conversionApi.consumable.consume( requirementBodyText, 'attribute:contenttype:requirementBodyText' );


                const reqModelElement = RequirementWidgetUtil.getRequirementModelElement( requirementBodyText );
                const reqElementRevId = reqModelElement ? reqModelElement.getAttribute( 'revisionid' ) : undefined;
                const reqMetadata = getSpecDataAttributes( reqElementRevId );
                if( reqMetadata && reqMetadata.bodytext ) {
                    if( requirementBodyText.getAttribute( 'contenteditable' ) !== reqMetadata.bodytext.contenteditable ) {
                        conversionApi.writer.setAttribute( 'contenteditable', reqMetadata.bodytext.contenteditable, requirementBodyText );
                    }
                    if( requirementBodyText.getAttribute( 'contenttype' ) !== reqMetadata.bodytext.contenttype ) {
                        conversionApi.writer.setAttribute( 'contenttype', reqMetadata.bodytext.contenttype, requirementBodyText );
                    }
                    if( requirementBodyText.getAttribute( 'title' ) !== reqMetadata.bodytext.title ) {
                        conversionApi.writer.setAttribute( 'title', reqMetadata.bodytext.title, requirementBodyText );
                    }
                }

                if( requirementBodyText.getAttribute( 'isoverwrite' ) && requirementBodyText.getAttribute( 'contenttype' ) !== 'READONLY' ) {
                    conversionApi.writer.setAttribute( 'contenteditable', true, requirementBodyText );
                    let reqView = conversionApi.mapper.toViewElement( reqModelElement );
                    if( reqView && reqView.hasClass && reqView.hasClass( 'aw-requirements-readOnlyRequirementContent' ) ) {
                        conversionApi.writer.removeClass( 'aw-requirements-readOnlyRequirementContent', reqView );
                    }
                }

                var viewBodyText;
                var bodyTextWidget;

                if( isOwnerUserId && isOwnerUserId !== currentUserId ) {
                    conversionApi.writer.setAttribute( 'contenteditable', 'false', requirementBodyText );
                }
                if( requirementBodyText.getAttribute( 'contenttype' ) === 'READONLY' || requirementBodyText.getAttribute( 'contenteditable' ) === 'false' ) {
                    viewBodyText = viewWriter.createContainerElement( 'div', requirementBodyText.getAttributes() );
                    bodyTextWidget = ckeditor5ServiceInstance.toWidget( viewBodyText, conversionApi.writer );
                } else {
                    viewBodyText = viewWriter.createEditableElement( 'div', requirementBodyText.getAttributes() );
                    bodyTextWidget = ckeditor5ServiceInstance.toWidgetEditable( viewBodyText, conversionApi.writer );
                }

                if( isOtherUserCreatedNewRequirement ) {
                    var resource = 'RichTextEditorCommandPanelsMessages';
                    var localTextBundle = localeService.getLoadedText( resource );
                    viewWriter.setAttribute( 'contenteditable', false, viewBodyText );
                    viewWriter.setAttribute( 'title', localTextBundle.readOnlyReqCanNotBeEdited, viewBodyText );
                    viewWriter.setAttribute( 'contenttype', 'READONLY', viewBodyText );
                }
                const viewPosition = conversionApi.mapper.toViewPosition( data.range.start );
                conversionApi.writer.insert( viewPosition, bodyTextWidget );
                conversionApi.mapper.bindElements( requirementBodyText, viewBodyText );

                var session = appCtxSvc.getCtx( 'userSession' );
                var userId;
                if ( session ) {
                    userId = session.props.user_id.dbValues[0];
                }
                var isDirty = requirementBodyText.getAttribute( 'isDirty' );
                if( isDirty ) {
                    var ids = isDirty.split( ',' );
                    if( ids.includes( userId ) ) {
                        appCtxSvc.updateCtx( 'requirementEditorContentChanged', true );

                        //after refresh restore dirty requirements
                        if( !editor.dirtyElementsIds ) {
                            editor.dirtyElementsIds = [];
                        }
                        var elementId = reqModelElement.getAttribute( 'id' );
                        if( !editor.dirtyElementsIds.includes( elementId ) ) {
                            editor.dirtyElementsIds.push( elementId );
                        }
                    }
                }
            }, { priority: 'high' } );
        } );
    }

    _definePropertyConversion() {
        const conversion = this.editor.conversion;
        conversion.for( 'upcast' ).add( dispatcher => {
            dispatcher.on( 'element:span', ( evt, data, conversionApi ) => {
                const matcher = new ckeditor5ServiceInstance.Matcher( {
                    name: 'span',
                    classes: 'aw-requirement-properties'
                } );
                // This will be usually just one pattern but we support matchers with many patterns too.
                const match = matcher.match( data.viewItem );
                // If there is no match, this callback should not do anything.
                if( !match ) {
                    return;
                }
                const viewDiv = data.viewItem;
                conversionApi.consumable.consume( viewDiv, { name: true } );
                const requirementProperty = conversionApi.writer.createElement( 'requirementProperty', viewDiv.getAttributes() );
                if( viewDiv.getAttribute( 'internalname' ) === '' ) {
                    conversionApi.writer.setAttribute( 'internalname', viewDiv.getAttribute( 'title' ), requirementProperty );
                }
                conversionApi.writer.insert( requirementProperty, data.modelCursor );
                var textChild = viewDiv.getChild( 0 );
                const text = textChild ? textChild.data : '';
                conversionApi.writer.insertText( text, requirementProperty );
                if( textChild ) {
                    conversionApi.consumable.consume( textChild );
                }
            }, { priority: 'high' } );
        } );
        conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'insert:requirementProperty', ( evt, data, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const requirementProperty = data.item;
                conversionApi.consumable.consume( requirementProperty, 'insert' );
                var viewPropertyEle;
                var propertyWidget;

                if( requirementProperty.hasAttribute( 'contenteditable' ) &&
                    requirementProperty.getAttribute( 'contenteditable' ) === 'true'
                ) {
                    viewPropertyEle = viewWriter.createEditableElement( 'span', requirementProperty.getAttributes() );
                    propertyWidget = ckeditor5ServiceInstance.toWidgetEditable( viewPropertyEle, conversionApi.writer );
                } else {
                    viewPropertyEle = viewWriter.createContainerElement( 'span', requirementProperty.getAttributes() );
                    propertyWidget = ckeditor5ServiceInstance.toWidget( viewPropertyEle, conversionApi.writer );
                }
                const requirementContent = requirementProperty.parent;
                const viewrequirementContent = conversionApi.mapper.toViewElement( requirementContent );
                const viewPosition = viewWriter.createPositionAt( viewrequirementContent, 'end' );

                conversionApi.mapper.bindElements( requirementProperty, propertyWidget );
                conversionApi.writer.insert( viewPosition, propertyWidget );
            }, { priority: 'high' } );
        } );
    }
    _defineLovPropertyConversion() {
        const conversion = this.editor.conversion;
        conversion.for( 'upcast' ).add( dispatcher => {
            dispatcher.on( 'element:span', ( evt, data, conversionApi ) => {
                const matcher = new ckeditor5ServiceInstance.Matcher( {
                    name: 'span',
                    classes: 'aw-requirement-lovProperties'
                } );
                // This will be usually just one pattern but we support matchers with many patterns too.
                const match = matcher.match( data.viewItem );
                // If there is no match, this callback should not do anything.
                if( !match ) {
                    return;
                }
                const viewDiv = data.viewItem;
                conversionApi.consumable.consume( viewDiv, { name: true } );
                const requirementProperty = conversionApi.writer.createElement( 'requirementLovProperty', viewDiv.getAttributes() );
                conversionApi.writer.insert( requirementProperty, data.modelCursor );
                var selectDiv = viewDiv.getChild( 0 );
                var optionsStr = '';
                if( selectDiv ) {
                    for( const child of selectDiv.getChildren() ) {
                        var optionVal = child.getAttribute( 'value' );
                        var selected = child.getAttribute( 'selected' );
                        var selString = '';
                        if( selected ) {
                            selString = ' selected="selected"';
                        }
                        optionsStr += '<option value="' + optionVal + '"' + selString + '>' + optionVal + '</option>';
                        const textChild = child.getChild( 0 );
                        if( textChild ) {
                            conversionApi.consumable.consume( textChild );
                        }
                    }
                }
                conversionApi.writer.setAttribute( 'selectOptions', optionsStr, requirementProperty );
                conversionApi.writer.setAttribute( 'data-cke-ignore-events', 'true', requirementProperty );
            }, { priority: 'highest' } );
        } );
        conversion.for( 'downcast' ).add( dispatcher => {
            dispatcher.on( 'insert:requirementLovProperty', ( evt, data, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const requirementProperty = data.item;
                conversionApi.consumable.consume( requirementProperty, 'insert' );
                conversionApi.consumable.consume( requirementProperty, 'attribute:selectOptions:requirementLovProperty' );

                var options = requirementProperty.getAttribute( 'selectOptions' );

                const propertyLovEle = viewWriter.createContainerElement( 'span', requirementProperty.getAttributes() );
                viewWriter.removeAttribute( 'selectOptions', propertyLovEle );
                if( requirementProperty.hasAttribute( 'contenteditable' ) ) {
                    viewWriter.removeAttribute( 'contenteditable', propertyLovEle );
                }
                const selectElement = viewWriter.createUIElement( 'select', {}, function( domDocument ) {
                    const lovDomElement = this.toDomElement( domDocument );
                    lovDomElement.setAttribute( 'data-cke-ignore-events', 'true' );
                    lovDomElement.innerHTML = options;

                    if( lovDomElement.hasAttribute( 'multiple' ) ) {
                        lovDomElement.onchange = function( evt ) {
                            var selectedOptionsObject = this.selectedOptions;
                            var selectedOptions = Object.values( selectedOptionsObject ); //convert to array
                            for( var i = 0; i < this.options.length; i++ ) {
                                var option = this.options[ i ];
                                if( selectedOptions.indexOf( option ) === -1 ) {
                                    option.removeAttribute( 'selected' );
                                } else {
                                    option.setAttribute( 'selected', 'selected' );
                                }
                            }
                        };
                    } else {
                        lovDomElement.onchange = function( evt ) {
                            var selectedOption = this.options[ this.selectedIndex ];
                            selectedOption.setAttribute( 'selected', 'selected' );

                            for( var i = 0; i < this.options.length; i++ ) {
                                var option = this.options[ i ];
                                if( option !== selectedOption ) {
                                    option.removeAttribute( 'selected' );
                                }
                            }
                            var selectOptions = this.innerHTML;
                            var modelEle = editor.editing.mapper.toModelElement( propertyLovEle );
                            editor.editing.model.change( writer => {
                                writer.setAttribute( 'selectOptions', selectOptions, modelEle );
                            } );
                        };
                    }
                    return lovDomElement;
                } );

                conversionApi.writer.insert( viewWriter.createPositionAt( propertyLovEle, 0 ), selectElement );
                const parentModelEle = requirementProperty.parent;
                const parentViewEle = conversionApi.mapper.toViewElement( parentModelEle );
                conversionApi.mapper.bindElements( requirementProperty, propertyLovEle );

                const viewPosition = viewWriter.createPositionAt( parentViewEle, 'end' );
                conversionApi.writer.insert( viewPosition, propertyLovEle );
            }, { priority: 'highest' } );
        } );
    }
}

/**
 *
 * @param {*} viewWriter
 * @param {*} editor
 * @param {*} modelElement
 */
function renderForIcon( viewWriter, editor, modelElement ) {
    var modelEle = modelElement;
    const viewTypeIcon = viewWriter.createUIElement( 'img', modelElement.getAttributes(), function( domDocument, modelElement ) {
        const domElement = this.toDomElement( domDocument );
        if( modelEle.parent.name === 'typeicon' ) {
            domElement.addEventListener( 'click', ( event ) => {
                var target = event.currentTarget ? event.currentTarget : event.srcElement;
                var nestedWidget = getNestedEditable( target );
                if( isCollaborationModeOn ) {
                    var reqElement = RequirementWidgetUtil.getRequirementModelElement( modelEle );
                    getModelElementOwnerAndCurrentUserId( reqElement );
                }
                if( !isOwnerUserId || isOwnerUserId === currentUserId ) {
                    if( nestedWidget.id.indexOf( 'RM::NEW::' ) === 0 || editor.isHtmlSpecTemplate === true && nestedWidget.id.indexOf( 'RM::OLD::' ) === 0 ) {
                    // Create panel definition for menu
                        var menuList = [];

                        menuList = getTypeMenu( nestedWidget, event, editor, viewTypeIcon, viewWriter, domElement );
                        if( menuList ) {
                        // Create and attach the menu,
                            var rect = target.getBoundingClientRect();
                            //var contentFrameElement = editor.window.$.frameElement;
                            var iconDimension = {
                                offsetHeight: rect.height,
                                offsetLeft: rect.left,
                                offsetTop: rect.top,
                                offsetWidth: rect.width
                            };
                            var actionList = [];

                            for( var i = 0; i < menuList.length; i++ ) {
                                actionList.push( { displayName: menuList[ i ].label, internalName: menuList[ i ].internalName, iconId: menuList[ i ].icon } );
                            }
                        }
                        var eventData = {
                            sourceObject: {
                                uid: nestedWidget.id
                            },
                            targetElement:target,
                            commandDimension: iconDimension,
                            actionItemList: actionList,
                            callback: function( response ) {
                                var typeName = response;
                                const typeImageElement = editor.editing.mapper.toModelElement( viewTypeIcon );
                                const modelRequirement = RequirementWidgetUtil.getRequirementModelElement( typeImageElement );
                                RequirementWidgetUtil.setType( viewWriter, modelRequirement, typeName );
                                editor.model.change( modelWriter => {
                                    RequirementWidgetUtil.setTypeIcon( viewWriter, typeImageElement, modelRequirement.objectTypesWithIcon, typeName, domElement, modelWriter );
                                } );
                                var newTemplate = RequirementWidgetUtil.getTemplateFromGlobalTemplateMap( editor, typeName );
                                RequirementWidgetUtil.changeWidgetTemplate( modelRequirement, editor, newTemplate );
                                eventBus.publish( 'showActionPopup.close' );
                            }
                        };
                        eventBus.publish( 'requirementDocumentation.registerCxtForBalloonPopup', eventData );
                    }
                }
            } );
            [ 'contextmenu', 'keyup' ].forEach( eventName => {
                domElement.addEventListener( eventName, ( event ) => {
                    event.preventDefault();
                    if( eventName === 'contextmenu' || eventName === 'keyup' && event.keyCode === 13 ) {
                        var target = event.currentTarget ? event.currentTarget : event.srcElement;
                        var nestedWidget = getNestedEditable( target );
                        if(  nestedWidget.id.indexOf( 'RM::NEW::' ) === -1 && ( editor.isHtmlSpecTemplate === undefined || editor.isHtmlSpecTemplate === false ) || editor.isHtmlSpecTemplate === true && nestedWidget.id.indexOf( 'RM::OLD::' ) === 0 ) {
                            var ownerId;
                            if( isCollaborationModeOn ) {
                                ownerId = modelEle.parent.parent.parent.getAttribute( 'ownerid' );
                            }
                            if( !ownerId || currentUserId === ownerId ) {
                                RequirementWidgetUtil.showPopupOnContextClick( editor, nestedWidget, target, null );
                            }
                        }
                    }
                } );
            } );
        }
        return domElement;
    } );
    return viewTypeIcon;
}

/**
 *
 * @param {*} viewWriter
 * @param {*} editor
 * @param {*} modelElement
 */
function renderToEditing( viewWriter, editor, modelElement ) {
//     const modelMarker = editor.editing.mapper.toModelElement( viewMarker );
//     if(modelMarker){
//         const modelRequirement2 = modelMarker.parent.parent;
// }

    var modelElement1 = modelElement;
    const viewMarker = viewWriter.createUIElement( 'addelementicon', { class: 'aw-ckeditor-marker-element aw-ckeditor-linkAction aw-aria-border', tabIndex: 0 }, function( domDocument, modelElement ) {
        const domElement = this.toDomElement( domDocument );
        if( isCollaborationModeOn ) {
            var reqElement = RequirementWidgetUtil.getRequirementModelElement( modelElement1 );
            getModelElementOwnerAndCurrentUserId( reqElement );
        }
        if( !isOwnerUserId || isOwnerUserId === currentUserId ) {
            domElement.innerHTML = cmdAdd;
            if( !editor.addTitle || !editor.addSiblingKeyTitle || !editor.addChildKeyTitle ) {
                var resource = 'RichTextEditorCommandPanelsMessages';
                var ckeditorTitleInfo = localeService.getLoadedText( resource );
                editor.addTitle = ckeditorTitleInfo.addTitle;
                editor.addSiblingKeyTitle = ckeditorTitleInfo.addSiblingKeyTitle;
                editor.addChildKeyTitle = ckeditorTitleInfo.addChildKeyTitle;
            }
            domElement.title = editor.addTitle +
            '\n' + editor.addSiblingKeyTitle +
            '\n' + editor.addChildKeyTitle;

            if( !isOtherUserCreatedNewRequirement ) {
                [ 'click', 'keydown' ].forEach( eventName => {
                    if( viewMarker ) {
                        const modelMarker = editor.editing.mapper.toModelElement( viewMarker );
                        if( modelMarker ) {
                            const modelRequirement2 = modelMarker.parent.parent;
                        }
                    }
                    domElement.addEventListener( eventName, ( event ) => {
                        if( eventName === 'click' || eventName === 'keydown' && event.keyCode === 13 ) {
                            var target = event.currentTarget ? event.currentTarget : event.srcElement;
                            var element = getNestedEditable( target );
                            var addOptions = getAddElementOptions( element );
                            var resource = 'RichTextEditorCommandPanelsMessages';
                            var localTextBundle = localeService.getLoadedText( resource );
                            let requirementElement;
                            let requirementSpecElement;
                            var locationContext = appCtxSvc.getCtx( 'locationContext' );
                            if( addOptions.length > 1 ) {
                                var prevent = false;
                                var timer = setTimeout( function() {
                                    if( !prevent ) {
                                        var rect = target.getBoundingClientRect();
                                        var iconDimension = {
                                            offsetHeight: rect.height,
                                            offsetLeft: rect.left,
                                            offsetTop: rect.top,
                                            offsetWidth: rect.width
                                        };

                                        var actionList = [];


                                        if( viewMarker ) {
                                            const modelMarker = editor.editing.mapper.toModelElement( viewMarker );
                                            if( modelMarker ) {
                                                const modelRequirement2 = modelMarker.parent.parent;
                                                requirementElement = modelRequirement2._attrs.get( 'id' );
                                                requirementSpecElement = modelRequirement2.parent._children._nodes[0]._attrs.get( 'id' );
                                            }
                                        }

                                        var eventData = {
                                            sourceObject: {
                                                uid: element.id
                                            },

                                            commandDimension: iconDimension,
                                            actionItemList: actionList,
                                            callback: function( response ) {
                                            // const modelMarker = editor.editing.mapper.toModelElement( viewMarker );
                                            // const modelRequirement = modelMarker.parent.parent;
                                            // if( response === localTextBundle.childTitle ) {
                                            //     editor.execute( 'insertRequirement', { after: modelRequirement, addOption: 'CHILD' } );
                                            //     eventBus.publish( 'showActionPopup.close' );
                                            // } else if( response === localTextBundle.siblingTitle ) {
                                            //     editor.execute( 'insertRequirement', { after: modelRequirement, addOption: 'SIBLING' } );
                                            //     eventBus.publish( 'showActionPopup.close' );
                                            // }
                                            },
                                            targetElement : target,
                                            //we can use sourceObject.uid also in place of requirementElement
                                            requirementElement : requirementElement,
                                            requirementSpecElement : requirementSpecElement
                                        };

                                        eventBus.publish( 'requirementDocumentation.registerCxtForChildSiblingPopup', eventData );
                                    }
                                }, 200 );
                            } else {
                                const modelMarker = editor.editing.mapper.toModelElement( viewMarker );
                                const modelRequirement = modelMarker.parent.parent;
                                requirementElement = modelRequirement._attrs.get( 'id' );
                                requirementSpecElement = modelRequirement.parent._children._nodes[0]._attrs.get( 'id' );

                                var eventData = {
                                    sourceObject: {
                                        uid: element.id
                                    },
                                    requirementElement:requirementElement,
                                    requirementSpecElement:requirementSpecElement
                                };


                                if( locationContext && locationContext['ActiveWorkspace:SubLocation'] === 'htmlSpecSubLocation'  ) {
                                    editor.execute( 'insertRequirement', { after: modelRequirement, addOption: 'CHILD' } );
                                }else{
                                    eventBus.publish( 'requirementDocumentation.registerChildForRequirementSpec', eventData );
                                }
                            }
                        }
                    } );
                } );
            }
        }
        return domElement;
    } );

    return viewMarker;
}
/**
 *
 * @param {*} viewWriter
 * @param {*} editor
 * @param {*} modelElement
 */
function renderToEditingRemoveIcon( viewWriter, editor, modelElement ) {
    var modelElement1 = modelElement;
    return viewWriter.createUIElement( 'removeelementicon', { class: 'aw-ckeditor-marker-element aw-ckeditor-linkAction' }, function( domDocument, modelElement ) {
        const domElement = this.toDomElement( domDocument );
        domElement.innerHTML = cmdRemove;
        domElement.title = editor.removeTitle;
        domElement.addEventListener( 'click', ( event ) => {
            var element = RequirementWidgetUtil.getRequirementModelElement( modelElement1 );
            var tmpParentId = element.getAttribute( 'parentid' );
            var uid = element.getAttribute( 'id' );
            _setElementDirty( tmpParentId, editor );
            _createMapOfPartenChild( uid, editor );
            if( element ) {
                editor.editing.model.change( writer => {
                    writer.remove( element );
                } );
            }
            // fire change event after addition of new widget
            editor.fire( 'change' );
        } );
        return domElement;
    } );
}
/**
 *
 * @param {*} viewWriter
 * @param {*} editor
 * @param {*} modelElement
 */
function renderForCheckout( viewWriter, editor, modelElement ) {
    const modelRequirement = RequirementWidgetUtil.getRequirementModelElement( modelElement );
    var checkedOutBy = modelRequirement.getAttribute( 'checkedoutby' );
    var checkedouttime = modelRequirement.getAttribute( 'checkedouttime' );

    return viewWriter.createUIElement( 'checkout', { class: 'aw-ckeditor-marker-element' }, function( domDocument, modelElement ) {
        const domElement = this.toDomElement( domDocument );
        if( checkedOutBy ) {
            domElement.innerHTML = editor.checkoutIconImgElement;
            domElement.title = editor.checkedOutByTitle + ': ' + checkedOutBy + '\n' + editor.checkedOutDateTitle + ': ' + checkedouttime;
        }
        return domElement;
    } );
}
/**
 * Create map of elements and their all children
 *
 * @param {String} elementId - id of the element needs to removed along with all its children
 */
function _createMapOfPartenChild( elementId, editor ) {
    if( elementId ) {
        var mapParentChildElement = {};
        var widgetData = editor.model.document.getRoot();
        for( var iinstance = 0; iinstance < widgetData.childCount; iinstance++ ) {
            var objWidget = widgetData.getChild( iinstance );
            var idParent = objWidget.getAttribute( 'parentid' );
            var arrChildren = [];
            if( mapParentChildElement.hasOwnProperty( idParent ) ) {
                arrChildren = mapParentChildElement[ idParent ];
            }
            arrChildren.push( objWidget );
            mapParentChildElement[ idParent ] = arrChildren;
        }
    }
    if( mapParentChildElement ) {
        _removeChildRecursive( mapParentChildElement, elementId, editor );
    }
}
/**
 * Remove children recursively
 *
 * @param {Object} mapParentChildElement - map of elements and their all children
 * @param {String} parentID - id of the element needs to removed along with all its children
 */
function _removeChildRecursive( mapParentChildElement, parentID, editor ) {
    var foundItems = [];
    findItemsToRemove( mapParentChildElement, parentID );

    function findItemsToRemove( mapParentChildElement, parentID ) {
        if( mapParentChildElement.hasOwnProperty( parentID ) ) {
            var arrChildren = [];
            arrChildren = mapParentChildElement[ parentID ];
            if( arrChildren && arrChildren.length > 0 ) {
                for( var i = arrChildren.length - 1; i >= 0; i-- ) {
                    var widget = arrChildren[ i ];
                    foundItems.push( widget );
                    var uid = widget.getAttribute( 'id' );
                    findItemsToRemove( mapParentChildElement, uid );
                }
            }
        }
    }
    foundItems.forEach( function( item, index ) {
        editor.model.change( writer => {
            writer.remove( item );
        } );
    } );
}
function ifPresentInDirtyElements( editor, item, userId ) {
    if( editor.dirtyElementsIds ) {
        var id  = item.getAttribute( 'id' );
        if( editor.dirtyElementsIds.indexOf( id ) !== -1 ) {
            return true;
        }
    }
    return false;
}

/**
 * Set Element content dirty
 *
 * @param {String} elementId - element ID
 */
function _setElementDirty( elementId, editor ) {
    if( elementId ) {
        var documentData = editor.getData();
        var doc = document.createElement( 'div' );
        doc.innerHTML = documentData;
        var widgets = doc.getElementsByClassName( 'requirement' );
        for( var w in widgets ) {
            var widget = widgets[ w ];
            var tmpElementId = widget.getAttribute( 'id' );
            if( tmpElementId === elementId ) {
                widget.setAttribute( 'isDirty', true );
                return;
            }
        }
    }
}

/**
 * Set newly added requirement content type as Read only and content editable false for other users at collaboration
 *
 * @param {*} modelElement - newly added requirement modelElement
 */
function setElementReadOnlyForOtherUsersAtCollaboration( conversionApi, modelelement ) {
    var viewWriter = conversionApi.writer;
    const reqBodyText = RequirementWidgetUtil.getModelElement( editor, modelelement, 'requirementBodyText' );
    viewWriter.setAttribute( 'contenttype', 'READONLY', reqBodyText );
    viewWriter.setAttribute( 'contenteditable', 'false', reqBodyText );
}


/**
 * get Element OwnerId from modelelement
 * And current User Id from the session
 *
 * @param {*} modelElement
 */
function getModelElementOwnerAndCurrentUserId( modelElement ) {
    for( var i = 0; i < modelElement._children._nodes.length; i++ ) {
        var children = modelElement._children._nodes[i];
        if( children.name === 'requirementHeader' ) {
            isOwnerUserId = children.getAttribute( 'isDirty' );
        }
    }
    var session = appCtxSvc.getCtx( 'userSession' );
    if ( session ) {
        currentUserId = session.props.user_id.dbValues[0];
    }
}


/**
 * Attach type menu list on click of type element for existing elements for HTML Spec template
 * @param {Object} widget element clicked on
 * @param {MouseEvent} event : Mouse click event
 */
function getTypeMenu( element, event, editor, viewTypeIcon, viewWriter, domElement ) {
    var parentItemType = element.getAttribute( 'parentitemtype' );
    if( !parentItemType || parentItemType === '' ) {
        parentItemType = element.getAttribute( 'parenttype' );
    }
    var objectTypesWithIcon = RequirementWidgetUtil.getAllowedTypesFromGlobalTypeMap( editor, parentItemType ) &&
        RequirementWidgetUtil.getAllowedTypesFromGlobalTypeMap( editor, parentItemType ).objectTypesWithIcon;
    element.objectTypesWithIcon = objectTypesWithIcon;
    const typeImageElement = editor.editing.mapper.toModelElement( viewTypeIcon );
    const modelRequirement = RequirementWidgetUtil.getRequirementModelElement( typeImageElement );
    modelRequirement.objectTypesWithIcon = objectTypesWithIcon;
    if( objectTypesWithIcon ) {
        return getTypeMenuData( element );
    }
    var selected = {
        type: parentItemType
    };
    var eventData = {
        selected: selected,
        callback: function( response ) {
            const typeImageElement = editor.editing.mapper.toModelElement( viewTypeIcon );
            const modelRequirement = RequirementWidgetUtil.getRequirementModelElement( typeImageElement );
            modelRequirement.objectTypesWithIcon = response.objectTypesWithIcon;
            modelRequirement.preferedType = response.preferredType;
            element.objectTypesWithIcon = response.objectTypesWithIcon;
            //element.setAttribute( 'parentType', parentItemType );
            changeTypeClickHandler( event, editor, viewTypeIcon, viewWriter, domElement );
        }
    };
    var eventBus = editor.eventBus;
    if( element.getAttribute( 'top_line' ) === 'true' ) {
        eventBus.publish( 'ACEXRTHTMLEditor.getReqSpecSubTypes', eventData );
    } else {
        eventBus.publish( 'ACEXRTHTMLEditor.getDisplayableTypes', eventData );
    }
}
/**
 * Attach type menu list on click of type element
 *
 * @param {evt} click even
 */
function changeTypeClickHandler( event, editor, viewTypeIcon, viewWriter, domElement ) {
    var target = event.currentTarget ? event.currentTarget : event.srcElement;
    var nestedWidget = getNestedEditable( target );

    if( nestedWidget ) {
        // Create panel definition for menu
        // Create and attach the menu
        var menuList = [];
        menuList = getTypeMenuData( nestedWidget );
        // Create and attach the menu,
        var rect = target.getBoundingClientRect();
        var iconDimension = {
            offsetHeight: rect.height,
            offsetLeft: rect.left,
            offsetTop: rect.top,
            offsetWidth: rect.width
        };
        var actionList = [];
        if( menuList ) {
            for( var i = 0; i < menuList.length; i++ ) {
                actionList.push( { displayName: menuList[ i ].label, internalName: menuList[ i ].internalName, iconURL: menuList[ i ].icon } );
            }
        }
        var eventData = {
            sourceObject: {
                uid: nestedWidget.id
            },
            targetElement:target,
            commandDimension: iconDimension,
            actionItemList: actionList,
            callback: function( response ) {
                var typeName = response;
                const typeImageElement = editor.editing.mapper.toModelElement( viewTypeIcon );
                const modelRequirement = RequirementWidgetUtil.getRequirementModelElement( typeImageElement );
                RequirementWidgetUtil.setType( viewWriter, modelRequirement, typeName );
                RequirementWidgetUtil.setTypeIcon( viewWriter, typeImageElement, modelRequirement.objectTypesWithIcon, typeName, domElement );

                var newTemplate = RequirementWidgetUtil.getTemplateFromGlobalTemplateMap( editor, typeName );
                RequirementWidgetUtil.changeWidgetTemplate( modelRequirement, editor, newTemplate );
                eventBus.publish( 'showActionPopup.close' );
            }
        };
        eventBus.publish( 'requirementDocumentation.registerCxtForBalloonPopup', eventData );
    }
}
/**
 * Create and return the list of menu in the JSON format
 *
 * @param {widget} widget
 */
function getTypeMenuData( widget ) {
    // --- Construct Menu
    var objectTypesWithIcon = widget.objectTypesWithIcon;
    // var selectedType = widget.getType(); //TODO
    // var selectedTypeObject = getTypeObject(objectTypesWithIcon, selectedType);
    var menuList = [];
    for( var i = 0; i < objectTypesWithIcon.length; i++ ) {
        var typeWithIcon = objectTypesWithIcon[ i ];
        // var isSelected = false;
        // if (selectedTypeObject && selectedTypeObject.typeName === typeWithIcon.typeName) {
        //     isSelected = true;
        // }
        menuList.push( {
            label: typeWithIcon.displayTypeName,
            internalName: typeWithIcon.typeName,
            icon: typeWithIcon.typeIconURL,
            // selected: isSelected,
            actionHandler: typeWithIcon.typeName
        } );
    }
    return menuList;
}
/**
 * Returns the options for add element, Child/Sibling
 *
 * @param {widget} widget element
 */
function getAddElementOptions( element ) {
    var resource = 'RichTextEditorCommandPanelsMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    var addOptions = [];
    var id = element.id;
    // Can not create child of newly added object.
    if( id && id !== '' ) {
        addOptions.push( localTextBundle.childTitle );
    }
    var parentId = element.getAttribute( 'parentid' );
    // Can not create sibling for top object.
    if( parentId && parentId !== '' ) {
        addOptions.push( localTextBundle.siblingTitle );
    }
    return addOptions;
}
/**
 * Gets the CKEDITOR.dom.element closest to the 'node'
 *
 * @param {CKEDITOR.dom.element}
 *            guard Stop ancestor search on this node
 *            (usually editor's editable).
 * @param {CKEDITOR.dom.node}
 *            node Start the search from this node.
 * @returns {CKEDITOR.dom.element/null} Element or
 *          `null` if not found.
 */
function getNestedEditable( node ) {
    if( isRequirementWidget( node ) ) { return node; }
    return getNestedEditable( node.parentElement );
}
// Checks whether node is a requirement widget
function isRequirementWidget( node ) {
    return hasClass( node, 'requirement' );
}
// Checks if element has given class
function hasClass( element, cls ) {
    return ( ' ' + element.className + ' ' )
        .indexOf( ' ' + cls + ' ' ) > -1;
}
