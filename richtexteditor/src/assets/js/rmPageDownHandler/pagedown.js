

import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import eventBus from 'js/eventBus';

export default class pageDown extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ PageDownEditing, PageDownUI ];
    }
}

/** */
export function addPageDownCommand( editor, doEnableCommand ) {
    if( buttonView ) {
        buttonView.isVisible = true;
        var cmd = editor.commands.get( 'pagedown' );
        if ( doEnableCommand ) {
            enableCommand( cmd );
        } else {
            disableCommand( cmd );
        }
    }
}

/** */
export function removePageDownCommand( ) {
    if( buttonView ) {
        buttonView.isVisible = false;
    }
}

var buttonView;

class PageDownUI extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        const t = editor.t;
        editor.ui.componentFactory.add( 'pagedown', locale => {
            // The state of the button will be bound to the widget command.
            const command = editor.commands.get( 'pagedown' );
            // The button will be an instance of ButtonView.
            buttonView = new ckeditor5ServiceInstance.ButtonView( locale );
            buttonView.set( {
                // The t() function helps localize the editor. All strings enclosed in t() can be
                // translated and change when the language of the editor changes.
                label: t( 'Page Down' ),
                tooltip: true,
                icon: PageDownIcon
            } );

            // Bind the state of the button to the command.
            buttonView.bind( 'isOn', 'isEnabled' ).to( command, 'value', 'isEnabled' );

            // Execute the command when the button is clicked (executed).
            this.listenTo( buttonView, 'execute', () => editor.execute( 'pagedown' ) );

            buttonView.isVisible = false;   // Default to false

            return buttonView;
        } );
    }
}

const PageDownIcon = '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 24 24" enable-background="new 0 0 24 24" xml:space="preserve"><polygon class="aw-theme-iconOutline" fill="#464646" points="17.6,15.6 12,21.3 12,1 11,1 11,21.3 5.4,15.6 4.6,16.4 11.5,23.2 18.4,16.4 "/></svg>';

var arm0EnablePageDownButtonEvent;

class PageDownEditing extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }

    init() {
        this._defineSchema();
        this._defineConverters();
        var editor = this.editor;

        this.editor.commands.add( 'pagedown', new InsertPageDownCommand( this.editor ) );

        arm0EnablePageDownButtonEvent = eventBus.subscribe( 'arm0EnablePageDownButton', function( eventData ) {
            buttonView.isVisible = true;
            var cmd = editor.commands.get( 'pagedown' );
            if ( eventData.enable ) {
                enableCommand( cmd );
            } else {
                disableCommand( cmd );
            }
        } );
    }

    destroy() {
        super.destroy();
        eventBus.unsubscribe( arm0EnablePageDownButtonEvent );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'pagedown', {
            // Behaves like a self-contained object (e.g. an image).
            isObject: true,

            // Allow in places where other blocks are allowed (e.g. directly in the root).
            allowWhere: '$block'
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        // <pagedown> converters
        conversion.for( 'upcast' ).elementToElement( {
            model: 'pagedown',
            view: {
                name: 'section',
                classes: 'pagedown'
            }
        } );
        conversion.for( 'dataDowncast' ).elementToElement( {
            model: 'pagedown',
            view: {
                name: 'section',
                classes: 'pagedown'
            }
        } );
        conversion.for( 'editingDowncast' ).elementToElement( {
            model: 'pagedown',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const section = viewWriter.createContainerElement( 'section', { class: 'pagedown' } );

                return ckeditor5ServiceInstance.toWidget( section, viewWriter, { label: 'pagedown widget' } );
            }
        } );
    }
}

class InsertPageDownCommand extends ckeditor5ServiceInstance.Command {
    execute() {
        const editor = this.editor;
        var eventBus = editor.eventBus;
        eventBus.publish( 'requirementDocumentation.pageDown' );
    }

    refresh() {
        const model = this.editor.model;
        const selection = model.document.selection;
        const allowedIn = model.schema.findAllowedParent( selection.getFirstPosition(), 'pagedown' );

        this.isEnabled = allowedIn !== null;
    }
}

/** Function to disable given command */
function disableCommand( cmd ) {
    cmd.on( 'set:isEnabled', forceDisable, { priority: 'highest' } );
    cmd.isEnabled = false;
}

/** Function to enable given command */
function enableCommand( cmd ) {
    cmd.off( 'set:isEnabled', forceDisable );
    cmd.isEnabled = true;
}

/** Function to force disable event */
function forceDisable( evt ) {
    evt.return = false;
    evt.stop();
}
