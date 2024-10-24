
import { ckeditor5ServiceInstance } from 'js/wiEditor.service';

export default class wiAddSymbolSchemaExtender extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [];
    }
    init() {
        const editor = this.editor;
        const schema = editor.model.schema;
        schema.extend( 'imageBlock', {
            allowAttributes: [ 'id','style' ]
        } );
        schema.extend( 'imageInline', {
            allowAttributes: [ 'id','style' ]
        } );

        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'id', 'id', 'imageBlock' ) );
        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'style', 'style', 'imageBlock' ) );
        setupCustomAttributeConversion( 'img', 'imageBlock', 'isanchoredimage', editor );

        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'id', 'id', 'imageInline' ) );
        editor.conversion.for( 'downcast' ).add( modelToViewAttributeConverter( 'style', 'style', 'imageInline' ) );
        setupCustomAttributeConversion( 'img', 'imageInline', 'isanchoredimage', editor );

        /** */
        function modelToViewAttributeConverter( attributeKey, viewAttribute, modelElementName ) {
            return dispatcher => {
                dispatcher.on( 'attribute:' + attributeKey + ':' + modelElementName, converter );
            };

            /** */
            function converter( evt, data, conversionApi ) {
                if ( !conversionApi.consumable.consume( data.item, evt.name ) ) {
                    return;
                }

                const viewWriter = conversionApi.writer;
                const figure = conversionApi.mapper.toViewElement( data.item );
                let img = figure;
                if( !figure.is( 'element', 'img' ) ) {
                    img = getViewImgFromWidget( figure );
                }
                viewWriter.setAttribute( viewAttribute, data.attributeNewValue || '', img );
                var isanchoredimage = img.getAttribute( 'isanchoredimage' );
                //adding style to figure tag if its anchored image
                if( isanchoredimage === 'true' ) {
                    if( img._styles && img._styles._styles && img._styles._styles['-aw-wrap-type'] === 'none' ) {
                        viewWriter.setAttribute( 'style', 'max-height:64px', figure );
                    }else{
                        viewWriter.setAttribute( 'style', 'max-height:64px', figure );
                    }
                }
            }
        }

        /** */
        function getViewImgFromWidget( figureView ) {
            const figureChildren = [];

            for ( const figureChild of figureView.getChildren() ) {
                figureChildren.push( figureChild );

                if ( figureChild.is( 'element' ) ) {
                    figureChildren.push( ...figureChild.getChildren() );
                }
            }

            return figureChildren.find( viewChild => viewChild.is( 'element', 'img' ) );
        }

        editor.conversion.for( 'upcast' ).attributeToAttribute( {
            view: {
                name: 'img',
                key: 'id'
            },
            model: 'id'
        } );

        editor.conversion.for( 'upcast' ).attributeToAttribute( {
            view: {
                name: 'img',
                key: 'style'
            },
            model: 'style'
        } );
    }
}
/**
 * Setups conversion for custom attribute on view elements contained inside figure.
 *
 * This method:
 *
 * - adds proper schema rules
 * - adds an upcast converter
 * - adds a downcast converter
 *
 * @param {String} viewElementName
 * @param {String} modelElementName
 * @param {String} viewAttribute
 * @param {module:core/editor/editor~Editor} editor
 */
 export function setupCustomAttributeConversion( viewElementName, modelElementName, viewAttribute, editor ) {
    // Extend schema to store attribute in the model.
    const modelAttribute = `custom-${viewAttribute}`;

    editor.model.schema.extend( modelElementName, { allowAttributes: [ modelAttribute ] } );

    editor.conversion.for( 'upcast' ).add( upcastAttribute( viewElementName, viewAttribute, modelAttribute ) );
    editor.conversion.for( 'downcast' ).add( downcastAttribute( modelElementName, viewElementName, viewAttribute, modelAttribute ) );
}
/**
 * Returns a custom attribute upcast converter.
 *
 * @param {String} viewElementName
 * @param {String} viewAttribute
 * @param {String} modelAttribute
 * @returns {Function}
 */
function upcastAttribute( viewElementName, viewAttribute, modelAttribute ) {
    return dispatcher => dispatcher.on( `element:${viewElementName}`, ( evt, data, conversionApi ) => {
        const viewItem = data.viewItem;
        const modelRange = data.modelRange;

        const modelElement = modelRange && modelRange.start.nodeAfter;

        if( !modelElement ) {
            return;
        }

        conversionApi.writer.setAttribute( modelAttribute, viewItem.getAttribute( viewAttribute ), modelElement );
    } );
}

/**
 * Returns a custom attribute downcast converter.
 *
 * @param {String} modelElementName
 * @param {String} viewElementName
 * @param {String} viewAttribute
 * @param {String} modelAttribute
 * @returns {Function}
 */
function downcastAttribute( modelElementName, viewElementName, viewAttribute, modelAttribute ) {
    return dispatcher => dispatcher.on( `attribute:${modelAttribute}:${modelElementName}`, ( evt, data, conversionApi ) => {
        const modelElement = data.item;

        const viewFigure = conversionApi.mapper.toViewElement( modelElement );
        const viewElement = findViewChild( viewFigure, viewElementName, conversionApi );

        if( !viewElement ) {
            return;
        }

        if( data.attributeNewValue === null ) {
            conversionApi.writer.removeAttribute( viewAttribute, viewElement );
        } else {
            conversionApi.writer.setAttribute( viewAttribute, data.attributeNewValue, viewElement );
        }

        conversionApi.writer.setAttribute( viewAttribute, modelElement.getAttribute( modelAttribute ), viewElement );
    } );
}
/**
 * Helper method that search for given view element in all children of model element.
 *
 * @param {module:engine/view/item~Item} viewElement
 * @param {String} viewElementName
 * @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
 * @return {module:engine/view/item~Item}
 */
function findViewChild( viewElement, viewElementName, conversionApi ) {
    const viewChildren = [ ...conversionApi.writer.createRangeIn( viewElement ).getItems() ];

    return viewChildren.find( item => item.is( 'element', viewElementName ) );
}

