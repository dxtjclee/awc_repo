import MathCommand from 'js/rmCkeInsertEquation/mathcommand';
import { extractDelimiters, renderEquation } from 'js/rmCkeInsertEquation/utils';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
const inlineMathTexString = 'mathtex-inline';
const displayMathTexString = 'mathtex-display';

export default class MathEditing extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }

    static get pluginName() {
        return 'MathEditing';
    }

    init() {
        const editor = this.editor;
        editor.commands.add( 'math', new MathCommand( editor ) );

        this._defineSchema();
        this._defineConverters();

        editor.editing.mapper.on(
            'viewToModelPosition',
            ckeditor5ServiceInstance.viewToModelPositionOutsideModelElement( editor.model, viewElement => viewElement.hasClass( 'math' ) )
        );
        editor.config.define( 'math', {
            engine: 'mathjax',
            outputType: 'span',
            forceOutputType: false,
            enablePreview: true
        } );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;
        schema.register( inlineMathTexString, {
            allowWhere: '$text',
            isInline: true,
            isObject: true,
            allowAttributes: [ 'equation', 'type', 'display' ]
        } );

        schema.register( displayMathTexString, {
            allowWhere: '$block',
            isInline: false,
            isObject: true,
            allowAttributes: [ 'equation', 'type', 'display' ]
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;
        const mathConfig = this.editor.config.get( 'math' );

        // View -> Model
        conversion.for( 'upcast' )
            // MathJax inline way (e.g. <script type="math/tex">\sqrt{\frac{a}{b}}</script>)
            .elementToElement( {
                view: {
                    name: 'script',
                    attributes: {
                        type: 'math/tex'
                    }
                },
                model: ( viewElement, conversionApi ) => {
                    const equation = viewElement.getChild( 0 ).data.trim();
                    const modelWriter = conversionApi.writer;
                    return modelWriter.createElement( inlineMathTexString, {
                        equation,
                        type: mathConfig.forceOutputType ? mathConfig.outputType : 'script',
                        display: false
                    } );
                }
            } )
            // MathJax display way (e.g. <script type="math/tex; mode=display">\sqrt{\frac{a}{b}}</script>)
            .elementToElement( {
                view: {
                    name: 'script',
                    attributes: {
                        type: 'math/tex; mode=display'
                    }
                },
                model: ( viewElement, conversionApi ) => {
                    const equation = viewElement.getChild( 0 ).data.trim();
                    const modelWriter = conversionApi.writer;
                    return modelWriter.createElement( displayMathTexString, {
                        equation,
                        type: mathConfig.forceOutputType ? mathConfig.outputType : 'script',
                        display: true
                    } );
                }
            } )
            // CKEditor 4 way (e.g. <span class="math-tex">\( \sqrt{\frac{a}{b}} \)</span>)
            .elementToElement( {
                view: {
                    name: 'span',
                    classes: [ 'equation' ] //added for word round trip and matchup with ck4
                },
                model: ( viewElement, conversionApi ) => {
                    const equation = viewElement.getChild( 0 ).data.trim();
                    const modelWriter = conversionApi.writer;

                    const params = Object.assign( extractDelimiters( equation ), {
                        type: mathConfig.forceOutputType ? mathConfig.outputType : 'span'
                    } );

                    return modelWriter.createElement( params.display ? displayMathTexString : inlineMathTexString, params );
                }
            } );

        // Model -> View (element)
        conversion.for( 'editingDowncast' )
            .elementToElement( {
                model: inlineMathTexString,
                view: ( modelItem, conversionApi ) => {
                    const writer = conversionApi.writer;
                    const widgetElement = createMathtexEditingView( modelItem, writer, this.editor );
                    return ckeditor5ServiceInstance.toWidget( widgetElement, writer, 'span' );
                }
            } ).elementToElement( {
                model: displayMathTexString,
                view: ( modelItem, conversionApi ) => {
                    const viewWriter = conversionApi.writer;
                    const widgetElement = createMathtexEditingView( modelItem, viewWriter, this.editor );
                    return ckeditor5ServiceInstance.toWidget( widgetElement, viewWriter, 'div' );
                }
            } );

        // Model -> Data
        conversion.for( 'dataDowncast' )
            .elementToElement( {
                model: inlineMathTexString,
                view: createMathtexView
            } )
            .elementToElement( {
                model: displayMathTexString,
                view: createMathtexView
            } );

        //Create view for editor
        function createMathtexEditingView( modelItem, viewWriter, editor ) {
            const equation = modelItem.getAttribute( 'equation' );
            const display = modelItem.getAttribute( 'display' );

            const styles = 'user-select: none; ' + ( display ? '' : 'display: inline-block;' );
            const classes = 'ck-math-tex ' + ( display ? 'ck-math-tex-display' : 'ck-math-tex-inline' );

            const mathtexView = viewWriter.createContainerElement( display ? 'div' : 'span', {
                style: styles,
                class: classes
            } );

            const uiElement = viewWriter.createUIElement( 'div', null, function( domDocument ) {
                const domElement = this.toDomElement( domDocument );

                renderEquation( equation, domElement, mathConfig.engine, display, false );

                //to add double-click behavior similar to CKEDITOR4
                domElement.addEventListener( 'dblclick', function( event ) {
                    editor.plugins._plugins.get( 'MathUI' )._showUI();
                } );

                return domElement;
            } );

            viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), uiElement );

            return mathtexView;
        }

        //Create view for data
        function createMathtexView( modelItem, conversionApi ) {
            const equation = modelItem.getAttribute( 'equation' );
            const type = modelItem.getAttribute( 'type' );
            const display = modelItem.getAttribute( 'display' );
            const viewWriter = conversionApi.writer;

            if ( type === 'span' ) {
                const mathtexView = viewWriter.createContainerElement( 'span', {
                    class: 'equation' //added for word round trip and matchup with ck4
                } );

                if ( display ) {
                    viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), viewWriter.createText( '\\[' + equation + '\\]' ) );
                } else {
                    viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), viewWriter.createText( '\\(' + equation + '\\)' ) );
                }

                return mathtexView;
            }
            const mathtexView = viewWriter.createContainerElement( 'script', {
                type: display ? 'math/tex; mode=display' : 'math/tex'
            } );

            viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), viewWriter.createText( equation ) );

            return mathtexView;
        }
    }
}
