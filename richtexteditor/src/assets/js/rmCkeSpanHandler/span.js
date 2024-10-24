
import appCtxSvc from 'js/appCtxService';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';

export default class Span extends ckeditor5ServiceInstance.Plugin {
    static get pluginName() {
        return 'Span';
    }
    init() {
        const editor = this.editor;
        const schema = editor.model.schema;

        schema.extend( '$text', { allowAttributes: [ 'spanMargin', 'spanAttribute', 'spanId', 'spanStyle' ] } );

        editor.conversion.attributeToElement( {
            model: 'spanAttribute',
            view: 'span'
        } );

        editor.conversion.for( 'upcast' ).elementToAttribute( {
            view: {
                name: 'span',
                attributes: { id: true }
            },
            model: {
                key: 'spanId',
                value: viewElement => viewElement.getAttribute( 'id' )
            },
            converterPriority: 'normal'
        } );

        editor.conversion.for( 'downcast' ).attributeToElement( {
            model: 'spanId',
            view: ( modelAttributeValue, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return viewWriter.createAttributeElement( 'span', {
                    id: `${modelAttributeValue}`
                } );
            },
            converterPriority: 'normal'
        } );

        editor.conversion.for( 'upcast' ).elementToAttribute( {
            view: {
                name: 'span',
                styles: { margin: /\s*\d+([a-zA-Z])*/ }
            },
            model: {
                key: 'spanMargin',
                value: viewElement => viewElement.getStyle( 'margin' )
            },
            converterPriority: 'high'
        } );


        editor.conversion.for( 'downcast' ).attributeToElement( {
            model: {
                key: 'spanMargin'
            },
            view: ( modelAttributeValue, { writer: viewWriter }  ) => {
                return viewWriter.createAttributeElement( 'span', {
                    style: `margin: ${ modelAttributeValue }`
                }, { priority: 7 } );
            },
            converterPriority: 'high'
        } );

        editor.conversion.for( 'upcast' ).elementToAttribute( {
            view: {
                name: 'span',
                style: true
            },
            model: {
                key: 'spanStyle',
                value: viewElement => {
                    const styles = viewElement.getStyle();
                    // Filter out color and italic  style, to avoid duplicates as these styles are handled by editor plugins.
                    if( styles && styles[ 'font-family' ] ) {
                        // The reduce() method executes a reducer function (that you provide) on each element of the array, resulting in single output value.
                        return Object.keys( styles ).reduce( ( accumulator, key ) => {
                            return key !== 'font-family' ? accumulator + key + ':' + styles[ key ] + ';' : accumulator;
                        }, '' );
                    }
                    return viewElement.getAttribute( 'style' );
                }
            },
            converterPriority: 'low'
        } );

        // Add an downcast (model-to-view) converter for style attribute of a span.
        // This attribute should support all the styles not supported by native pluginss
        editor.conversion.for( 'downcast' ).attributeToElement( {
            model: 'spanStyle',
            view: ( modelAttributeValue, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                return viewWriter.createAttributeElement( 'span', {
                    style: `${ modelAttributeValue }`
                } );
            },
            converterPriority: 'low'
        } );


        const locale = this.editor.locale;
        const marginProperty = locale.contentLanguageDirection === 'rtl' ? 'margin-right' : 'margin-left';

        editor.conversion.for( 'downcast' ).attributeToElement( {
            model: {
                key: 'blockIndent',
                name: '$text'
            },
            view: ( modelAttributeValue, { writer: viewWriter }  ) => {
                return viewWriter.createAttributeElement( 'span', {
                    style: marginProperty + `: ${ modelAttributeValue }`
                } );
            },
            converterPriority: 'high'
        } );
    }
}
