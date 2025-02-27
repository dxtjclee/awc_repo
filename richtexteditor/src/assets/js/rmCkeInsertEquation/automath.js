
import { extractDelimiters, hasDelimiters, delimitersCounts } from 'js/rmCkeInsertEquation/utils';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
export default class AutoMath extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Clipboard, ckeditor5ServiceInstance.Undo ];
    }

    static get pluginName() {
        return 'AutoMath';
    }

    constructor( editor ) {
        super( editor );

        this._timeoutId = null;

        this._positionToInsert = null;
    }

    init() {
        const editor = this.editor;
        const modelDocument = editor.model.document;

        this.listenTo( editor.plugins.get( ckeditor5ServiceInstance.Clipboard ), 'inputTransformation', () => {
            const firstRange = modelDocument.selection.getFirstRange();

            const leftLivePosition = ckeditor5ServiceInstance.LivePosition.fromPosition( firstRange.start );
            leftLivePosition.stickiness = 'toPrevious';

            const rightLivePosition = ckeditor5ServiceInstance.LivePosition.fromPosition( firstRange.end );
            rightLivePosition.stickiness = 'toNext';

            modelDocument.once( 'change:data', () => {
                this._mathBetweenPositions( leftLivePosition, rightLivePosition );

                leftLivePosition.detach();
                rightLivePosition.detach();
            }, { priority: 'high' } );
        } );

        editor.commands.get( 'undo' ).on( 'execute', () => {
            if ( this._timeoutId ) {
                window.clearTimeout( this._timeoutId );
                this._positionToInsert.detach();

                this._timeoutId = null;
                this._positionToInsert = null;
            }
        }, { priority: 'high' } );
    }

    _mathBetweenPositions( leftPosition, rightPosition ) {
        const editor = this.editor;

        const mathConfig = this.editor.config.get( 'math' );

        const equationRange = new ckeditor5ServiceInstance.LiveRange( leftPosition, rightPosition );
        const walker = equationRange.getWalker( { ignoreElementEnd: true } );

        let text = '';

        // Get equation text
        for ( const node of walker ) {
            if ( node.item.is( '$textProxy' ) ) {
                text += node.item.data;
            }
        }

        text = text.trim();

        // Skip if don't have delimiters
        if ( !hasDelimiters( text ) || delimitersCounts( text ) !== 2 ) {
            return;
        }

        const mathCommand = editor.commands.get( 'math' );

        // Do not anything if math element cannot be inserted at the current position
        if ( !mathCommand.isEnabled ) {
            return;
        }

        this._positionToInsert = ckeditor5ServiceInstance.LivePosition.fromPosition( leftPosition );

        // With timeout user can undo conversation if want use plain text
        this._timeoutId = window.setTimeout( () => {
            editor.model.change( writer => {
                this._timeoutId = null;

                writer.remove( equationRange );

                let insertPosition;

                // Check if position where the math element should be inserted is still valid.
                if ( this._positionToInsert.root.rootName !== '$graveyard' ) {
                    insertPosition = this._positionToInsert;
                }

                editor.model.change( writer => {
                    const params = Object.assign( extractDelimiters( text ), {
                        type: mathConfig.outputType
                    } );
                    const mathElement = writer.createElement( params.display ? 'mathtex-display' : 'mathtex-inline', params );

                    editor.model.insertContent( mathElement, insertPosition );

                    writer.setSelection( mathElement, 'on' );
                } );

                this._positionToInsert.detach();
                this._positionToInsert = null;
            } );
        }, 100 );
    }
}
