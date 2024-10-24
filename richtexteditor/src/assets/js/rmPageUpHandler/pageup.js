
import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

export default class pageUp extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ PageUpEditing, PageUpUI ];
    }
}

/** */
export function addPageUpCommand( editor, doEnableCommand ) {
    if( buttonView ) {
        buttonView.isVisible = true;
        var cmd = editor.commands.get( 'pageup' );
        if ( doEnableCommand ) {
            enableCommand( cmd );
        } else {
            disableCommand( cmd );
        }
    }
}

/** */
export function removePageUpCommand( ) {
    if( buttonView ) {
        buttonView.isVisible = false;
    }
}

var buttonView;

class PageUpUI extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        const t = editor.t;
        editor.ui.componentFactory.add( 'pageup', locale => {
            // The state of the button will be bound to the widget command.
            const command = editor.commands.get( 'pageup' );

            // The button will be an instance of ButtonView.
            buttonView = new ckeditor5ServiceInstance.ButtonView( locale );
            buttonView.set( {
                // The t() function helps localize the editor. All strings enclosed in t() can be
                // translated and change when the language of the editor changes.
                label: t( 'Page Up' ),
                tooltip: true,
                icon: PageUpIcon
            } );

            // Bind the state of the button to the command.
            buttonView.bind( 'isOn', 'isEnabled' ).to( command, 'value', 'isEnabled' );

            // Execute the command when the button is clicked (executed).
            this.listenTo( buttonView, 'execute', () => editor.execute( 'pageup' ) );

            buttonView.isVisible = false;   // Default to false

            return buttonView;
        } );
    }
}

const PageUpIcon = '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 24 24" enable-background="new 0 0 24 24" xml:space="preserve"><polygon class="aw-theme-iconOutline" fill="#464646" points="18.4,7.6 11.5,0.8 4.6,7.6 5.4,8.4 11,2.7 11,23 12,23 12,2.7 17.6,8.4 "/></svg>';

var arm0EnablePageUpButtonEvent;

class PageUpEditing extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }

    init() {
        this._defineSchema();
        this._defineConverters();
        const editor = this.editor;

        this.editor.commands.add( 'pageup', new InsertPageUpCommand( this.editor ) );

        arm0EnablePageUpButtonEvent = eventBus.subscribe( 'arm0EnablePageUpButton', function( eventData ) {
            buttonView.isVisible = true;
            var cmd = editor.commands.get( 'pageup' );
            if ( eventData.enable ) {
                enableCommand( cmd );
            } else {
                disableCommand( cmd );
            }
        } );
    }

    destroy() {
        super.destroy();
        eventBus.unsubscribe( arm0EnablePageUpButtonEvent );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'pageup', {
            // Behaves like a self-contained object (e.g. an image).
            isObject: true,

            // Allow in places where other blocks are allowed (e.g. directly in the root).
            allowWhere: '$block'
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        // <pageup> converters
        conversion.for( 'upcast' ).elementToElement( {
            model: 'pageup',
            view: {
                name: 'section',
                classes: 'pageup'
            }
        } );
        conversion.for( 'dataDowncast' ).elementToElement( {
            model: 'pageup',
            view: {
                name: 'section',
                classes: 'pageup'
            }
        } );
        conversion.for( 'editingDowncast' ).elementToElement( {
            model: 'pageup',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const section = viewWriter.createContainerElement( 'section', { class: 'pageup' } );

                return ckeditor5ServiceInstance.toWidget( section, viewWriter, { label: 'pageup widget' } );
            }
        } );
    }
}

class InsertPageUpCommand extends ckeditor5ServiceInstance.Command {
    execute() {
        const editor = this.editor;
        var eventBus = editor.eventBus;
        eventBus.publish( 'requirementDocumentation.pageUp' );
    }

    refresh() {
        const model = this.editor.model;
        const selection = model.document.selection;
        const allowedIn = model.schema.findAllowedParent( selection.getFirstPosition(), 'pageup' );

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
