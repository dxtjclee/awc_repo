// Copyright (c) 2020 Siemens

import localeService from 'js/localeService';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import { setupCustomAttributeConversion } from 'js/rmCkeInsertImage/rmImageSchemaExtender';
import { getSpecOLEData } from 'js/rmCkeRequirementWidget/requirementWidgetMetadataService';

export default class InsertOLE extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ InsertOLEEditing, InsertOLEUI ];
    }
}

class InsertOLEUI extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        const conversion = this.editor.conversion;
        this._defineOleImageConversion( conversion );
        var resource = 'RichTextEditorCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );
        editor.ui.componentFactory.add( 'rmInsertOLE', locale => {
            // The state of the button will be bound to the widget command.
            const command = editor.commands.get( 'rmInsertOLE' );

            // The button will be an instance of ButtonView.
            const buttonView = new ckeditor5ServiceInstance.ButtonView( locale );
            buttonView.set( {
                allowMultipleFiles: true,
                label: localTextBundle.insertOLE,
                tooltip: true,
                icon: cmdInsertOLE16
            } );

            // Bind the state of the button to the command.
            buttonView.bind( 'isOn', 'isEnabled' ).to( command, 'value', 'isEnabled' );

            // Execute the command when the button is clicked (executed).
            this.listenTo( buttonView, 'execute', () => editor.execute( 'rmInsertOLE' ) );

            // Define schema and converters (two-way) for specific attributes on the <img> and <table> elements.
            setupCustomAttributeConversion( 'img', 'imageBlock', 'datasettype', editor );
            setupCustomAttributeConversion( 'img', 'imageBlock', 'oleid', editor );
            setupCustomAttributeConversion( 'img', 'imageBlock', 'style', editor );
            setupCustomAttributeConversion( 'img', 'imageBlock', 'olepreviewid', editor );

            setupConversionToAttachClassOnFigure();

            function setupConversionToAttachClassOnFigure() {
                editor.conversion.for( 'downcast' ).add( dispatcher =>
                    dispatcher.on( 'attribute:custom-oleid:imageBlock', ( evt, data, conversionApi ) => {
                        if( !conversionApi.consumable.consume( data.item, evt.name ) ) {
                            return;
                        }

                        const viewWriter = conversionApi.writer;
                        const figure = conversionApi.mapper.toViewElement( data.item );

                        // Add class to identify img is for ole
                        viewWriter.addClass( 'aw-requirement-oleImage', figure );
                    } )
                );
            }

            return buttonView;
        } );

        addDoubleClickEvent( editor );
    }
    _defineOleImageConversion( conversion ) {
        // ole image
        conversion.for( 'downcast' ).elementToElement( {
            model: 'oleimage',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const oleid = modelElement.getAttribute( 'oleid' );
                const oleMetaData = getSpecOLEData( oleid );
                if( oleMetaData ) {
                    if( oleMetaData.datasetfileticket ) {
                        conversionApi.writer.setAttribute( 'datasetfileticket', oleMetaData.datasetfileticket, modelElement );
                    }
                    if( oleMetaData.src ) {
                        conversionApi.writer.setAttribute( 'src', oleMetaData.src, modelElement );
                    }
                }

                return renderForOle( viewWriter, this.editor, modelElement );
            },
            converterPriority: 'high'

        } );
        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: 'img',
                attributes:{ oleid:true }
            },
            model: ( viewElement, conversionApi ) => {
                const modelWriter = conversionApi.writer;
                return modelWriter.createElement( 'oleimage', viewElement.getAttributes() );
            },
            converterPriority: 'high'
        } );
    }
}

class InsertOLEEditing extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }

    init() {
        this._defineSchema();
        this._defineConverters();

        this.editor.commands.add( 'rmInsertOLE', new InsertOLECommand( this.editor ) );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'rmInsertOLE', {
            isObject: true,
            allowWhere: '$block'
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        conversion.for( 'upcast' ).elementToElement( {
            model: 'rmInsertOLE',
            view: {
                name: 'section',
                classes: 'rmInsertOLE'
            }
        } );

        conversion.for( 'downcast' ).elementToElement( {
            model: 'rmInsertOLE',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const section = viewWriter.createContainerElement( 'section', { class: 'rmInsertOLE' } );

                return ckeditor5ServiceInstance.toWidget( section, viewWriter );
            }
        } );
    }
}

class InsertOLECommand extends ckeditor5ServiceInstance.Command {
    execute() {
        const editor = this.editor;
        var form = document.createElement( 'form' );
        form.setAttribute( 'id', 'fileUploadForm' );

        var input = document.createElement( 'input' );
        form.appendChild( input );

        input.setAttribute( 'type', 'file' );
        input.setAttribute( 'id', 'fmsFile' );
        input.setAttribute( 'name', 'fmsFile' );

        input.addEventListener( 'change', function() {
            var file = this.files[ 0 ];

            if( file ) {
                var eventBus = editor.eventBus;

                var eventData = {
                    clientid: this.value,
                    file: file,
                    form: this.form
                };
                eventBus.publish( 'requirementDocumentation.InsertOLEInCKEditor',
                    eventData );
            }
        }, false );

        input.click();
    }

    refresh() {
        const model = this.editor.model;
        const selection = model.document.selection;
        const selectedElement = selection.getSelectedElement();
        const allowedIn = model.schema.findAllowedParent( selection.getFirstPosition(), 'rmInsertOLE' );
        this.isEnabled = allowedIn !== null && selectedElement === null;
    }
}
/**
 *
 * @param {*} viewWriter
 * @param {*} editor
 * @param {*} modelElement
 */
function renderForOle( viewWriter, editor, modelElement ) {
    return viewWriter.createEditableElement( 'img', modelElement.getAttributes() );
}

class DoubleClickObserver extends ckeditor5ServiceInstance.DomEventObserver {
    constructor( view ) {
        super( view );

        this.domEventType = 'dblclick';
    }

    onDomEvent( domEvent ) {
        this.fire( domEvent.type, domEvent );
    }
}

/**
 * Function to handle double click event to download OLE
 * @param {Object} editor - editor instance
 */
function addDoubleClickEvent( editor ) {
    const view = editor.editing.view;
    const viewDocument = view.document;

    view.addObserver( DoubleClickObserver );
    editor.listenTo( viewDocument, 'dblclick', ( evt, data ) => {
        if( data && data.domTarget && data.domTarget.hasAttribute( 'oleid' ) ) {
            // Fire an event to download ole
            var eventBus = editor.eventBus;
            var eventData = {
                targetElement: data.domTarget
            };
            eventBus.publish( 'requirementDocumentation.handleOLEClick', eventData );
        }
    } );
}

const cmdInsertOLE16 =
    '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">\n  <path d="M11.5,16A4.5,4.5,0,1,1,16,11.5,4.5,4.5,0,0,1,11.5,16Zm0-8A3.5,3.5,0,1,0,15,11.5,3.5,3.5,0,0,0,11.5,8Z" class="aw-theme-iconOutline" fill="#464646"/>\n  <path d="M6.707,0H0V14H6V13H1V1H6l.006,4H10V6h1V4.293ZM7,1.709,9.293,4H7.005Z" class="aw-theme-iconOutline" fill="#464646"/>\n  <polygon points="14 11 12 11 12 9 11 9 11 11 9 11 9 12 11 12 11 14 12 14 12 12 14 12 14 11" class="aw-theme-iconOutline" fill="#464646"/>\n</svg>\n';
